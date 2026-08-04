from __future__ import annotations

import unittest
from copy import deepcopy
from pathlib import Path

from engine.experiment.matcher import Matcher, load_json, rank_jobs


BASE_DIR = Path(__file__).resolve().parents[1]


class MatcherTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.profile = load_json(BASE_DIR / "data" / "canonical-profile.json")
        cls.jobs_document = load_json(BASE_DIR / "data" / "jobs.json")
        cls.config = load_json(BASE_DIR / "config" / "matching-weights.json")

    def test_dataset_has_thirty_balanced_unique_jobs(self) -> None:
        jobs = self.jobs_document["jobs"]
        self.assertEqual(len(jobs), 30)
        self.assertEqual(sum(job["market"] == "brazil" for job in jobs), 15)
        self.assertEqual(sum(job["market"] == "international" for job in jobs), 15)
        self.assertEqual(len({job["id"] for job in jobs}), 30)
        self.assertEqual(len({job["source_url"] for job in jobs}), 30)

    def test_component_weights_total_one_hundred(self) -> None:
        self.assertEqual(sum(self.config["component_weights"].values()), 100)

    def test_support_skills_never_add_positive_skill_score(self) -> None:
        matcher = Matcher(self.profile, self.config)
        job = deepcopy(self.jobs_document["jobs"][0])
        job["id"] = "TEST-SUPPORT"
        job["required_skills"] = ["technical support", "Office 365", "AnyDesk"]
        job["preferred_skills"] = ["helpdesk", "network configuration"]
        result = matcher.match(job)
        self.assertEqual(result.component_scores["desired_skill_alignment"], 0)
        self.assertEqual(result.component_scores["required_skill_coverage"], 0)
        self.assertFalse(any("office" in reason.casefold() for reason in result.reasons))

    def test_hybrid_job_outside_belo_horizonte_is_excluded(self) -> None:
        matcher = Matcher(self.profile, self.config)
        job = next(
            job for job in self.jobs_document["jobs"] if job["id"] == "INT-007"
        )
        result = matcher.match(job)
        self.assertTrue(result.excluded)
        self.assertIn(
            "Vaga hibrida fora das localidades aceitas pelo perfil.",
            result.exclusion_reasons,
        )

    def test_hybrid_job_in_belo_horizonte_is_accepted(self) -> None:
        matcher = Matcher(self.profile, self.config)
        job = deepcopy(
            next(job for job in self.jobs_document["jobs"] if job["id"] == "INT-007")
        )
        job["location"] = {
            "display": "Belo Horizonte, MG",
            "remote": False,
            "work_model": "hybrid",
            "city": "Belo Horizonte",
            "state": "Minas Gerais",
            "eligible_regions": ["BR"],
        }
        result = matcher.match(job)
        self.assertFalse(result.excluded)

    def test_onsite_job_in_accepted_location_is_accepted_when_requested(self) -> None:
        profile = deepcopy(self.profile)
        profile["work_preferences"]["desired_work_models"].append("onsite")
        matcher = Matcher(profile, self.config)
        job = deepcopy(self.jobs_document["jobs"][0])
        job["location"] = {
            "display": "Belo Horizonte, MG",
            "remote": False,
            "work_model": "onsite",
            "city": "Belo Horizonte",
            "eligible_regions": ["BR"],
        }
        self.assertFalse(matcher.match(job).excluded)

    def test_secondary_skill_does_not_count_as_required_coverage(self) -> None:
        profile = deepcopy(self.profile)
        profile["skills_known"]["secondary_or_limited_evidence"] = ["Ruby"]
        matcher = Matcher(profile, self.config)
        job = deepcopy(self.jobs_document["jobs"][0])
        job["required_skills"] = ["Ruby"]
        job["preferred_skills"] = []
        result = matcher.match(job)
        full_score = self.config["component_weights"]["required_skill_coverage"]
        self.assertLess(result.component_scores["required_skill_coverage"], full_score)

    def test_pending_profile_facts_leave_filters_disabled(self) -> None:
        matcher = Matcher(self.profile, self.config)
        job = next(
            job for job in self.jobs_document["jobs"] if job["id"] == "BR-004"
        )
        result = matcher.match(job)
        self.assertFalse(result.excluded)
        self.assertIn("salary", result.disabled_filters)
        self.assertIn("employment_type", result.disabled_filters)
        self.assertIn("seniority", result.disabled_filters)

    def test_ranking_is_deterministic(self) -> None:
        first = [
            (job["id"], result.score)
            for job, result in rank_jobs(
                self.profile, self.jobs_document["jobs"], self.config
            )
        ]
        second = [
            (job["id"], result.score)
            for job, result in rank_jobs(
                self.profile, self.jobs_document["jobs"], self.config
            )
        ]
        self.assertEqual(first, second)

    def test_ranking_contains_every_job_once_and_valid_scores(self) -> None:
        ranked = rank_jobs(self.profile, self.jobs_document["jobs"], self.config)
        ids = [job["id"] for job, _ in ranked]
        self.assertEqual(len(ids), 30)
        self.assertEqual(len(set(ids)), 30)
        self.assertTrue(all(0 <= result.score <= 100 for _, result in ranked))
        eligible_scores = [result.score for _, result in ranked if not result.excluded]
        self.assertEqual(eligible_scores, sorted(eligible_scores, reverse=True))


if __name__ == "__main__":
    unittest.main()


class HardFilterFailClosedTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.profile = load_json(BASE_DIR / "data" / "canonical-profile.json")
        cls.jobs_document = load_json(BASE_DIR / "data" / "jobs.json")
        cls.config = load_json(BASE_DIR / "config" / "matching-weights.json")

    def _job(self, **overrides: object) -> dict:
        job = deepcopy(self.jobs_document["jobs"][0])
        job.update(overrides)
        return job

    def test_remote_job_restricted_to_foreign_region_is_excluded(self) -> None:
        job = self._job(id="TEST-US-ONLY")
        job["location"] = {"display": "US only", "remote": True, "eligible_regions": ["US"]}
        result = Matcher(self.profile, self.config).match(job)
        self.assertTrue(result.excluded)

    def test_remote_job_open_worldwide_is_accepted(self) -> None:
        job = self._job(id="TEST-GLOBAL")
        job["location"] = {"display": "Worldwide", "remote": True, "eligible_regions": ["GLOBAL"]}
        result = Matcher(self.profile, self.config).match(job)
        self.assertFalse(result.excluded)

    def test_unknown_language_level_is_flagged_instead_of_ignored(self) -> None:
        job = self._job(id="TEST-C1")
        job["language"] = {"posting": "en", "required": ["English: C1"]}
        result = Matcher(self.profile, self.config).match(job)
        self.assertTrue(result.excluded)

    def test_language_requirement_without_level_is_accepted(self) -> None:
        job = self._job(id="TEST-NO-LEVEL")
        job["language"] = {"posting": "en", "required": ["English"]}
        result = Matcher(self.profile, self.config).match(job)
        self.assertFalse(result.excluded)

    def test_enabling_unimplemented_hard_filter_raises(self) -> None:
        config = deepcopy(self.config)
        config["hard_filters"]["salary"] = True
        with self.assertRaises(ValueError):
            Matcher(self.profile, config)


class VersionedProfilePrivacyTest(unittest.TestCase):
    """O repo e publico e o importador repopula `contact` a cada execucao.

    Sem esta trava, rodar `npm run profile:import` reinsere telefone e e-mail
    no arquivo versionado e o proximo commit publica os dois sem ninguem notar.
    """

    FORBIDDEN_CONTACT_KEYS = ("email", "phone")

    def test_versioned_profile_carries_no_personal_contact(self) -> None:
        profile = load_json(BASE_DIR / "data" / "canonical-profile.json")
        contact = profile["identity"]["contact"]
        present = [key for key in self.FORBIDDEN_CONTACT_KEYS if contact.get(key)]
        self.assertEqual(
            present,
            [],
            f"Dado pessoal no perfil versionado: {present}. Remova antes de commitar.",
        )
