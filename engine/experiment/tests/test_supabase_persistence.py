from __future__ import annotations

import unittest
from unittest.mock import Mock

from engine.experiment.run_experiment import persist_system_ranking
from engine.supabase_rest import SupabaseRestClient


class MatchPersistenceTest(unittest.TestCase):
    def test_persists_only_jobs_present_in_catalog_for_supplied_user(self) -> None:
        client = Mock(spec=SupabaseRestClient)
        client.request.side_effect = [
            [{"id": "job-uuid", "source_url": "https://example.com/jobs/42/"}],
            [{"user_id": "user-1", "job_id": "job-uuid"}],
        ]
        document = {
            "ranking": [
                {
                    "source_url": "https://example.com/jobs/42",
                    "score": 91,
                    "rank": 1,
                    "excluded": False,
                    "reasons": ["Stack alinhada"],
                    "gaps": [],
                    "skills": ["TypeScript"],
                },
                {
                    "source_url": "https://example.com/jobs/missing",
                    "score": 70,
                    "rank": 2,
                    "excluded": False,
                    "reasons": [],
                    "gaps": [],
                    "skills": [],
                },
            ]
        }

        self.assertEqual(persist_system_ranking(document, "user-1", client), 1)
        client.request.assert_called_with(
            "job_match?on_conflict=user_id%2Cjob_id",
            method="POST",
            payload=[
                {
                    "user_id": "user-1",
                    "job_id": "job-uuid",
                    "score": 91,
                    "rank": 1,
                    "excluded": False,
                    "reasons": ["Stack alinhada"],
                    "gaps": [],
                    "skills": ["TypeScript"],
                }
            ],
            prefer="resolution=merge-duplicates,return=representation,missing=default",
        )


if __name__ == "__main__":
    unittest.main()
