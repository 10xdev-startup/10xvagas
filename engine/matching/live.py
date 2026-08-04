from __future__ import annotations

import json
import re
import unicodedata
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from engine.experiment.matcher import normalize_term, rank_jobs
from engine.supabase_rest import SupabaseRestClient


CONFIG_PATH = Path(__file__).resolve().parents[1] / "experiment" / "config" / "matching-weights.json"
READ_PAGE_SIZE = 500
WRITE_BATCH_SIZE = 200


def load_matching_config() -> dict[str, Any]:
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))


def normalized_text(value: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value).casefold()
        if not unicodedata.combining(character)
    )


def role_family(title: str) -> str:
    value = normalized_text(title)
    if (
        any(term in value for term in ("machine learning", "llm", "artificial intelligence"))
        or re.search(r"\bai\b", value)
    ):
        return "ai_application_engineer"
    if any(term in value for term in ("full stack", "fullstack", "full-stack")):
        return "full_stack_engineer"
    if any(term in value for term in ("backend", "back-end", "node.js", "golang")):
        return "backend_engineer"
    if any(term in value for term in ("frontend", "front-end", "react")):
        return "frontend_engineer"
    if any(term in value for term in ("tech lead", "technical lead", "engineering lead")):
        return "tech_lead"
    if any(term in value for term in ("software", "developer", "desenvolvedor", "product engineer")):
        return "software_engineer"
    return "other"


def seniority_and_minimum_years(title: str, description: str) -> tuple[int, int]:
    value = normalized_text(f"{title} {description}")
    title_value = normalized_text(title)
    if any(term in title_value for term in ("principal", "staff")):
        seniority, fallback_years = 5, 7
    elif any(term in title_value for term in ("senior", "sr.", "sr ")):
        seniority, fallback_years = 4, 5
    elif any(term in title_value for term in ("pleno", "mid-level", "mid level")):
        seniority, fallback_years = 3, 2
    elif any(term in title_value for term in ("junior", "jr.", "jr ")):
        seniority, fallback_years = 2, 0
    else:
        seniority, fallback_years = 3, 1

    years = [
        int(match)
        for match in re.findall(r"(?<!\d)(\d{1,2})\+?\s*(?:years?|anos?)(?![a-z])", value)
        if int(match) <= 20
    ]
    return seniority, min(years) if years else fallback_years


def _skill_vocabulary(profile: dict[str, Any], config: dict[str, Any]) -> dict[str, set[str]]:
    values: list[str] = []
    values.extend(str(skill["name"]) for skill in profile.get("skills_desired", []))
    known = profile.get("skills_known", {})
    for group in (
        "desired_and_evidenced",
        "known_but_not_desired_for_matching",
        "secondary_or_limited_evidence",
    ):
        values.extend(str(skill) for skill in known.get(group, []))
    values.extend(str(skill) for skill in config.get("technical_gap_skills", []))
    values.extend(str(skill) for skill in config.get("capability_evidence", {}).keys())

    aliases = config.get("skill_aliases", {})
    vocabulary: dict[str, set[str]] = {}
    for value in values:
        canonical = normalize_term(value, aliases)
        vocabulary.setdefault(canonical, set()).add(normalize_term(value, {}))
    for alias, target in aliases.items():
        canonical = normalize_term(target, aliases)
        vocabulary.setdefault(canonical, set()).add(normalize_term(alias, {}))
        vocabulary[canonical].add(normalize_term(target, {}))
    return vocabulary


def extract_skills(text: str, profile: dict[str, Any], config: dict[str, Any]) -> list[str]:
    haystack = normalized_text(text)
    found: list[str] = []
    for canonical, variants in _skill_vocabulary(profile, config).items():
        if any(
            re.search(rf"(?<![a-z0-9]){re.escape(variant)}(?![a-z0-9])", haystack)
            for variant in variants
        ):
            found.append(canonical)
    return sorted(found)


def location_contract(row: dict[str, Any]) -> dict[str, Any]:
    display = str(row.get("location") or "Nao informado")
    location = normalized_text(display)
    workplace = normalized_text(str(row.get("workplace_type") or ""))
    remote = "remote" in workplace or "remot" in workplace
    work_model = "remote" if remote else "hybrid" if "hybrid" in workplace or "hibrid" in workplace else "onsite"
    eligible_regions: list[str] = []
    if any(term in location for term in ("worldwide", "anywhere", "global")):
        eligible_regions.append("GLOBAL")
    if any(term in location for term in ("brazil", "brasil", "latam", "latin america", "americas", "south america")):
        eligible_regions.append("BR")
    city = "Belo Horizonte" if any(term in location for term in ("belo horizonte", "bh", "nova lima", "contagem", "betim")) else ""
    return {
        "display": display,
        "remote": remote,
        "work_model": work_model,
        "eligible_regions": eligible_regions,
        "city": city,
        "metropolitan_area": "Belo Horizonte" if city else "",
    }


def language_contract(row: dict[str, Any]) -> dict[str, Any]:
    text = normalized_text(f"{row.get('title', '')} {row.get('description', '')}")
    required: list[str] = []
    if row.get("market") == "international":
        required.append("English: professional")
    elif "english" in text or "ingles" in text:
        level = "advanced" if any(term in text for term in ("advanced", "avancado", "fluent", "fluente", "c1")) else "intermediate"
        required.append(f"English: {level}")
    posting = "pt" if any(term in text for term in (" voce ", " vaga ", " experiencia ", " desenvolv")) else "en"
    return {"posting": posting, "required": required}


def normalize_live_job(row: dict[str, Any], profile: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    title = str(row.get("title") or "")
    description = str(row.get("description") or "")
    seniority, minimum_years = seniority_and_minimum_years(title, description)
    skills = extract_skills(f"{title}\n{description}", profile, config)
    return {
        "id": str(row["id"]),
        "market": row["market"],
        "company": row["company"],
        "title": title,
        "source": row["source"],
        "source_url": row["source_url"],
        "listing_status": "available_at_collection",
        "location": location_contract(row),
        "language": language_contract(row),
        "employment_type": row.get("employment_type") or "unknown",
        "role_family": role_family(title),
        "seniority": seniority,
        "minimum_years": minimum_years,
        "salary_original": None if not row.get("salary_raw") else {"raw": row["salary_raw"]},
        "required_skills": skills,
        "preferred_skills": [],
        "summary": description,
    }


def _validate_profile(profile: dict[str, Any]) -> None:
    required = (
        "identity",
        "work_preferences",
        "matching_facts",
        "languages",
        "skills_desired",
        "skills_known",
    )
    missing = [field for field in required if not profile.get(field)]
    if missing:
        raise ValueError("Perfil incompleto: " + ", ".join(missing))
    facts = profile["matching_facts"]
    required_facts = {
        "professional_development_years_approx": (int, float),
        "commercial_production_experience": (bool,),
        "startup_founder_experience": (bool,),
        "has_ai_project": (bool,),
        "has_completed_higher_education": (bool,),
    }
    invalid_facts = [
        name
        for name, expected_types in required_facts.items()
        if name not in facts
        or not isinstance(facts[name], expected_types)
        or (name == "professional_development_years_approx" and isinstance(facts[name], bool))
    ]
    if invalid_facts:
        raise ValueError("matching_facts invalidos: " + ", ".join(invalid_facts))


def _read_all(rest: SupabaseRestClient, resource: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        separator = "&" if "?" in resource else "?"
        page = rest.request(f"{resource}{separator}offset={offset}&limit={READ_PAGE_SIZE}")
        if not isinstance(page, list):
            return rows
        rows.extend(item for item in page if isinstance(item, dict))
        if len(page) < READ_PAGE_SIZE:
            return rows
        offset += READ_PAGE_SIZE


def match_all_users(client: SupabaseRestClient | None = None) -> dict[str, int]:
    rest = client or SupabaseRestClient.from_env()
    profiles = _read_all(rest, "profile?select=user_id%2Cdocument")
    jobs = _read_all(rest, "job?select=*&is_active=eq.true&order=last_seen_at.desc")

    config = load_matching_config()
    matched_at = datetime.now(UTC).isoformat()
    total = 0
    processed_users = 0
    failed_users = 0
    for profile_row in profiles:
        if not isinstance(profile_row, dict) or not isinstance(profile_row.get("document"), dict):
            continue
        user_id = profile_row.get("user_id")
        if not isinstance(user_id, str):
            continue
        profile = profile_row["document"]
        try:
            _validate_profile(profile)
            normalized_jobs = [normalize_live_job(row, profile, config) for row in jobs]
            ranked = rank_jobs(profile, normalized_jobs, config)
        except (KeyError, TypeError, ValueError) as error:
            failed_users += 1
            print(f"Perfil do usuario {user_id} ignorado: {error}")
            continue
        payload = [
            {
                "user_id": user_id,
                "job_id": job["id"],
                "score": result.score,
                "rank": rank,
                "excluded": result.excluded,
                "reasons": result.reasons,
                "gaps": result.gaps,
                "skills": job["required_skills"],
                "matched_at": matched_at,
            }
            for rank, (job, result) in enumerate(ranked, start=1)
        ]
        for start in range(0, len(payload), WRITE_BATCH_SIZE):
            rest.request(
                "job_match?on_conflict=user_id%2Cjob_id",
                method="POST",
                payload=payload[start:start + WRITE_BATCH_SIZE],
                prefer="resolution=merge-duplicates,return=minimal,missing=default",
            )
        processed_users += 1
        total += len(payload)
    return {
        "users": processed_users,
        "jobs": len(jobs),
        "matches": total,
        "failed_users": failed_users,
    }


def main() -> None:
    result = match_all_users()
    print(
        f"Matching concluido: {result['matches']} matches para "
        f"{result['users']} usuario(s) em {result['jobs']} vagas."
    )
    if result["failed_users"]:
        raise RuntimeError(
            f"Matching incompleto: {result['failed_users']} perfil(is) invalido(s)."
        )


if __name__ == "__main__":
    main()
