from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest.mock import Mock

from engine.experiment.matcher import Matcher
from engine.matching.live import load_matching_config, match_all_users, normalize_live_job, role_family
from engine.supabase_rest import SupabaseRestClient


ROOT = Path(__file__).resolve().parents[3]
PROFILE = json.loads(
    (ROOT / "engine" / "experiment" / "data" / "canonical-profile.json").read_text(encoding="utf-8")
)


def live_job(job_id: str = "11111111-1111-4111-8111-111111111111") -> dict[str, object]:
    return {
        "id": job_id,
        "external_id": "42",
        "source": "lever",
        "source_label": "Lever",
        "title": "Senior Backend Node.js Engineer",
        "company": "Acme",
        "source_url": "https://example.com/jobs/42",
        "apply_url": None,
        "description": "5+ years. Build TypeScript, Node.js and PostgreSQL APIs. Previous Office 365 support is irrelevant.",
        "location": "Brazil / LATAM",
        "workplace_type": "remote",
        "employment_type": "contractor",
        "published_at": None,
        "salary_raw": None,
        "market": "international",
    }


class LiveJobNormalizerTest(unittest.TestCase):
    def test_recognizes_ai_at_title_boundary(self) -> None:
        self.assertEqual(role_family("AI Engineer"), "ai_application_engineer")

    def test_builds_complete_matcher_contract_from_live_row(self) -> None:
        config = load_matching_config()
        normalized = normalize_live_job(live_job(), PROFILE, config)

        self.assertEqual(normalized["role_family"], "backend_engineer")
        self.assertEqual(normalized["minimum_years"], 5)
        self.assertEqual(normalized["location"]["eligible_regions"], ["BR"])
        self.assertIn("typescript", normalized["required_skills"])
        self.assertIn("node.js", normalized["required_skills"])
        self.assertIn("office 365", normalized["required_skills"])

    def test_support_knowledge_never_becomes_positive_match_reason(self) -> None:
        config = load_matching_config()
        normalized = normalize_live_job(live_job(), PROFILE, config)
        result = Matcher(PROFILE, config).match(normalized)

        reasons = " ".join(result.reasons).casefold()
        self.assertIn("typescript", reasons)
        self.assertNotIn("office 365", reasons)

    def test_persists_one_match_per_job_for_each_profile(self) -> None:
        client = Mock(spec=SupabaseRestClient)
        second_job = live_job("22222222-2222-4222-8222-222222222222")
        client.request.side_effect = [
            [{"user_id": "user-1", "document": PROFILE}],
            [live_job(), second_job],
            None,
        ]

        self.assertEqual(
            match_all_users(client),
            {"users": 1, "jobs": 2, "matches": 2, "failed_users": 0},
        )
        self.assertIn("is_active=eq.true", client.request.call_args_list[1].args[0])
        call = client.request.call_args_list[2]
        self.assertEqual(call.args[0], "job_match?on_conflict=user_id%2Cjob_id")
        payload = call.kwargs["payload"]
        self.assertEqual(len(payload), 2)
        self.assertTrue(all(item["user_id"] == "user-1" for item in payload))
        self.assertEqual({item["job_id"] for item in payload}, {live_job()["id"], second_job["id"]})

    def test_isolates_invalid_profile_and_keeps_valid_user(self) -> None:
        client = Mock(spec=SupabaseRestClient)
        client.request.side_effect = [
            [
                {"user_id": "invalid-user", "document": {"identity": {}}},
                {"user_id": "valid-user", "document": PROFILE},
            ],
            [live_job()],
            None,
        ]

        self.assertEqual(
            match_all_users(client),
            {"users": 1, "jobs": 1, "matches": 1, "failed_users": 1},
        )

    def test_rejects_profile_with_empty_matching_facts_before_ranking(self) -> None:
        invalid = json.loads(json.dumps(PROFILE))
        invalid["matching_facts"] = {}
        client = Mock(spec=SupabaseRestClient)
        client.request.side_effect = [
            [{"user_id": "invalid-user", "document": invalid}],
            [live_job()],
        ]

        self.assertEqual(
            match_all_users(client),
            {"users": 0, "jobs": 1, "matches": 0, "failed_users": 1},
        )


if __name__ == "__main__":
    unittest.main()
