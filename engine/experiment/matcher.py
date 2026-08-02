from __future__ import annotations

import json
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class MatchResult:
    job_id: str
    score: float
    excluded: bool
    exclusion_reasons: list[str]
    component_scores: dict[str, float]
    penalties: dict[str, float]
    reasons: list[str]
    gaps: list[str]
    disabled_filters: list[str]


def load_json(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def normalize_term(value: str, aliases: dict[str, str]) -> str:
    ascii_value = "".join(
        character
        for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    )
    normalized = " ".join(ascii_value.casefold().strip().split())
    return aliases.get(normalized, normalized)


class Matcher:
    def __init__(self, profile: dict[str, Any], config: dict[str, Any]) -> None:
        self.profile = profile
        self.config = config
        self.aliases = {
            normalize_term(key, {}): normalize_term(value, {})
            for key, value in config["skill_aliases"].items()
        }
        self.desired_priorities = {
            normalize_term(skill["name"], self.aliases): float(skill["priority"])
            for skill in profile["skills_desired"]
        }
        evidenced = profile["skills_known"]["desired_and_evidenced"]
        secondary = profile["skills_known"]["secondary_or_limited_evidence"]
        self.known_skills = {
            normalize_term(skill, self.aliases) for skill in [*evidenced, *secondary]
        }
        self.excluded_support_skills = {
            normalize_term(skill, self.aliases)
            for skill in profile["skills_known"]["known_but_not_desired_for_matching"]
        }
        self.technical_gap_skills = {
            normalize_term(skill, self.aliases)
            for skill in config["technical_gap_skills"]
        }
        self.capability_evidence = {
            normalize_term(capability, self.aliases): {
                normalize_term(skill, self.aliases) for skill in evidence
            }
            for capability, evidence in config["capability_evidence"].items()
        }
        self._assert_enabled_filters_implemented()

    def match(self, job: dict[str, Any]) -> MatchResult:
        exclusion_reasons = self._hard_filter_reasons(job)
        required = [normalize_term(skill, self.aliases) for skill in job["required_skills"]]
        preferred = [normalize_term(skill, self.aliases) for skill in job["preferred_skills"]]
        components = {
            "desired_skill_alignment": self._desired_skill_score(required, preferred),
            "required_skill_coverage": self._required_coverage_score(required),
            "role_fit": self._role_fit_score(job),
            "experience_fit": self._experience_fit_score(job),
            "evidence_bonus": self._evidence_bonus_score(required, preferred),
        }
        missing_skills = sorted(
            {
                skill
                for skill in required
                if skill in self.technical_gap_skills and not self._requirement_is_met(skill)
            }
        )
        penalties = self._penalties(job, missing_skills)
        raw_score = sum(components.values()) - sum(penalties.values())
        score_min = float(self.config["score_range"]["min"])
        score_max = float(self.config["score_range"]["max"])
        score = 0.0 if exclusion_reasons else max(score_min, min(score_max, raw_score))
        reasons = self._reasons(job, required, preferred, components)
        gaps = self._gaps(job, missing_skills)
        disabled_filters = [
            name for name, enabled in self.config["hard_filters"].items() if not enabled
        ]
        return MatchResult(
            job_id=job["id"],
            score=round(score, 2),
            excluded=bool(exclusion_reasons),
            exclusion_reasons=exclusion_reasons,
            component_scores={name: round(value, 2) for name, value in components.items()},
            penalties={name: round(value, 2) for name, value in penalties.items()},
            reasons=reasons,
            gaps=gaps,
            disabled_filters=disabled_filters,
        )

    # Filtros com implementacao em `_hard_filter_reasons`. Os demais em
    # `hard_filters` dependem de fatos ainda pendentes no Perfil Canonico
    # (ver `facts_pending_confirmation`) e por isso continuam desligados.
    IMPLEMENTED_HARD_FILTERS = frozenset({"work_model", "language"})

    def _assert_enabled_filters_implemented(self) -> None:
        enabled = {name for name, on in self.config["hard_filters"].items() if on}
        unsupported = sorted(enabled - self.IMPLEMENTED_HARD_FILTERS)
        if unsupported:
            raise ValueError(
                "Filtro duro ligado sem implementacao: "
                f"{', '.join(unsupported)}. Ligar a flag nao filtra nada e "
                "mascara o problema — implemente em _hard_filter_reasons ou "
                "mantenha desligado ate confirmar os fatos do perfil."
            )

    def _hard_filter_reasons(self, job: dict[str, Any]) -> list[str]:
        reasons: list[str] = []
        hard_filters = self.config["hard_filters"]
        desired_models = self.profile["work_preferences"]["desired_work_models"]
        if hard_filters["work_model"]:
            work_model_reason = self._work_model_filter_reason(job, desired_models)
            if work_model_reason:
                reasons.append(work_model_reason)
        if hard_filters["language"]:
            reasons.extend(self._language_filter_reasons(job))
        return reasons

    def _work_model_filter_reason(self, job: dict[str, Any], desired_models: list[str]) -> str | None:
        location = job["location"]
        if location["remote"]:
            if "remote" not in desired_models:
                return "Modelo remoto nao aceito pelo perfil."
            return self._region_filter_reason(location)

        display = location.get("display", "").casefold()
        work_model = location.get("work_model")
        if not work_model:
            work_model = "hybrid" if "hibrid" in display else "on_site"

        if work_model == "hybrid" and "hybrid" in desired_models:
            if self._is_accepted_hybrid_location(location):
                return None
            return "Vaga hibrida fora de Belo Horizonte e regiao."
        return "Modelo de trabalho nao compativel com o perfil."

    def _region_filter_reason(self, location: dict[str, Any]) -> str | None:
        """Exclui vaga remota restrita a regiao onde o perfil nao pode atuar.

        `remote: true` nao significa "remoto de qualquer lugar" — a maioria das
        vagas internacionais restringe por regiao em `eligible_regions`. Sem
        esta checagem, uma vaga US-only entra no ranking como se fosse elegivel.
        """
        settings = self.config["region_filter"]
        eligible = [
            region.strip().upper()
            for region in location.get("eligible_regions", [])
            if str(region).strip()
        ]
        if not eligible:
            return None

        global_tokens = {token.upper() for token in settings["global_tokens"]}
        if global_tokens.intersection(eligible):
            return None

        accepted = self._accepted_regions()
        if accepted.intersection(eligible):
            return None

        return f"Vaga remota restrita a {', '.join(eligible)}."

    def _accepted_regions(self) -> set[str]:
        settings = self.config["region_filter"]
        declared = self.profile["work_preferences"].get("work_authorization_by_region")
        if declared:
            return {str(region).strip().upper() for region in declared}

        country = str(self.profile["identity"]["location"]["country"]).strip().casefold()
        fallback = settings["country_fallback"].get(country)
        return {fallback} if fallback else set()

    def _is_accepted_hybrid_location(self, location: dict[str, Any]) -> bool:
        city = str(location.get("city", "")).casefold()
        metropolitan_area = str(location.get("metropolitan_area", "")).casefold()
        display = str(location.get("display", "")).casefold()
        for accepted in self.profile["work_preferences"].get("hybrid_locations", []):
            accepted_city = str(accepted["city"]).casefold()
            if city == accepted_city or metropolitan_area == accepted_city:
                return True
            if accepted_city in display:
                return True
        return False

    def _language_filter_reasons(self, job: dict[str, Any]) -> list[str]:
        levels = self.config["language_levels"]
        profile_languages = {
            language["language"].casefold(): levels[language["level"]]
            for language in self.profile["languages"]
        }
        reasons: list[str] = []
        for requirement in job["language"]["required"]:
            language_name, separator, required_level = requirement.partition(":")
            label = language_name.strip()
            language_key = label.casefold()
            level_key = required_level.strip().casefold()
            if language_key not in profile_languages:
                reasons.append(f"Idioma obrigatorio ausente: {label}.")
                continue
            if not separator or not level_key:
                # Requisito sem nivel declarado: o perfil fala o idioma, aceita.
                continue
            if level_key not in levels:
                # Fail closed — nivel desconhecido nao pode ser comparado, e
                # deixar passar mascara requisito real ("English: C1").
                reasons.append(
                    f"Nivel de {label} nao reconhecido ({required_level.strip()}); revise manualmente."
                )
                continue
            if profile_languages[language_key] < levels[level_key]:
                reasons.append(f"Nivel insuficiente em {label}.")
        return reasons

    def _desired_skill_score(self, required: list[str], preferred: list[str]) -> float:
        settings = self.config["desired_skill_alignment"]
        required_terms = set(required)
        preferred_terms = set(preferred) - required_terms
        matched_weight = sum(
            priority * float(settings["required_multiplier"])
            for skill, priority in self.desired_priorities.items()
            if skill in required_terms
        )
        matched_weight += sum(
            priority * float(settings["preferred_multiplier"])
            for skill, priority in self.desired_priorities.items()
            if skill in preferred_terms
        )
        ratio = min(1.0, matched_weight / float(settings["target_weight_for_full_score"]))
        return ratio * float(self.config["component_weights"]["desired_skill_alignment"])

    def _required_coverage_score(self, required: list[str]) -> float:
        if not required:
            return float(self.config["component_weights"]["required_skill_coverage"])
        unknown_credit = float(
            self.config["required_skill_coverage"]["unknown_requirement_credit"]
        )
        credits = []
        for skill in required:
            if self._requirement_is_met(skill):
                credits.append(1.0)
            elif skill in self.technical_gap_skills or skill in self.excluded_support_skills:
                credits.append(0.0)
            else:
                credits.append(unknown_credit)
        coverage = sum(credits) / len(credits)
        return coverage * float(self.config["component_weights"]["required_skill_coverage"])

    def _requirement_is_met(self, requirement: str) -> bool:
        if requirement in self.excluded_support_skills:
            return False
        if requirement in self.known_skills:
            return True
        evidence = self.capability_evidence.get(requirement, set())
        return bool(evidence & self.known_skills)

    def _role_fit_score(self, job: dict[str, Any]) -> float:
        role_ratio = float(
            self.config["role_fit"].get(
                job["role_family"], self.config["role_fit"]["other"]
            )
        )
        return role_ratio * float(self.config["component_weights"]["role_fit"])

    def _experience_fit_score(self, job: dict[str, Any]) -> float:
        settings = self.config["experience_fit"]
        facts = self.profile["matching_facts"]
        years = float(facts["professional_development_years_approx"])
        if facts["startup_founder_experience"]:
            years += min(
                float(settings["founder_experience_credit_years"]),
                float(settings["maximum_founder_credit_years"]),
            )
        gap = max(0.0, float(job["minimum_years"]) - years)
        ratio = max(0.0, 1.0 - gap / float(settings["gap_years_for_zero_score"]))
        return ratio * float(self.config["component_weights"]["experience_fit"])

    def _evidence_bonus_score(self, required: list[str], preferred: list[str]) -> float:
        all_terms = set(required) | set(preferred)
        facts = self.profile["matching_facts"]
        weight = float(self.config["component_weights"]["evidence_bonus"])
        score = 0.0
        for rule in self.config["evidence_bonus"].values():
            job_terms = {
                normalize_term(term, self.aliases) for term in rule["job_terms"]
            }
            if facts[rule["profile_flag"]] and all_terms & job_terms:
                score += weight * float(rule["points_ratio"])
        return min(weight, score)

    def _penalties(self, job: dict[str, Any], missing_skills: list[str]) -> dict[str, float]:
        settings = self.config["penalties"]
        missing_penalty = min(
            float(settings["missing_required_skill_cap"]),
            len(missing_skills) * float(settings["missing_required_skill_points"]),
        )
        education_penalty = 0.0
        completed_degree = normalize_term("completed degree", self.aliases)
        required = {normalize_term(skill, self.aliases) for skill in job["required_skills"]}
        if completed_degree in required and not self.profile["matching_facts"]["has_completed_higher_education"]:
            education_penalty = float(settings["completed_degree_required"])
        return {
            "missing_required_skills": missing_penalty,
            "completed_degree": education_penalty,
        }

    def _reasons(
        self,
        job: dict[str, Any],
        required: list[str],
        preferred: list[str],
        components: dict[str, float],
    ) -> list[str]:
        matched_desired = sorted(
            skill
            for skill in set(required) | set(preferred)
            if skill in self.desired_priorities
        )
        reasons = []
        if matched_desired:
            reasons.append("Stack desejada presente: " + ", ".join(matched_desired) + ".")
        if components["role_fit"] == float(self.config["component_weights"]["role_fit"]):
            reasons.append("Familia de papel alinhada ao objetivo profissional.")
        if components["evidence_bonus"] > 0:
            reasons.append("Ha evidencia transferivel em produto/startup ou IA aplicada.")
        if job["location"]["remote"]:
            reasons.append("Modelo remoto compativel.")
        return reasons

    def _gaps(self, job: dict[str, Any], missing_skills: list[str]) -> list[str]:
        gaps = []
        if missing_skills:
            gaps.append("Requisitos tecnicos sem evidencia: " + ", ".join(missing_skills) + ".")
        candidate_years = float(
            self.profile["matching_facts"]["professional_development_years_approx"]
        )
        if float(job["minimum_years"]) > candidate_years:
            gaps.append(
                f"Vaga pede cerca de {job['minimum_years']} anos; perfil registra aproximadamente {candidate_years:.1f} ano(s) profissionais em desenvolvimento."
            )
        completed_degree = normalize_term("completed degree", self.aliases)
        required = {normalize_term(skill, self.aliases) for skill in job["required_skills"]}
        if completed_degree in required and not self.profile["matching_facts"]["has_completed_higher_education"]:
            gaps.append("Vaga exige graduacao concluida; conclusao prevista para dezembro de 2026.")
        return gaps


def rank_jobs(
    profile: dict[str, Any], jobs: list[dict[str, Any]], config: dict[str, Any]
) -> list[tuple[dict[str, Any], MatchResult]]:
    matcher = Matcher(profile, config)
    matches = [(job, matcher.match(job)) for job in jobs]
    return sorted(
        matches,
        key=lambda item: (
            item[1].excluded,
            -item[1].score,
            item[0]["id"],
        ),
    )
