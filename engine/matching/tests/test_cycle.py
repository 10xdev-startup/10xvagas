from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from engine.run_cycle import run_cycle
from engine.supabase_rest import SupabaseRestClient


class EngineCycleTest(unittest.TestCase):
    @patch("engine.run_cycle.match_all_users")
    @patch("engine.run_cycle.record_source_runs")
    @patch("engine.run_cycle.upsert_jobs")
    @patch("engine.run_cycle.collect")
    def test_cycle_orders_collection_health_and_matching(
        self,
        collect: Mock,
        upsert_jobs: Mock,
        record_source_runs: Mock,
        match_all_users: Mock,
    ) -> None:
        client = Mock(spec=SupabaseRestClient)
        collect.return_value = {
            "jobs": [{"external_id": "42"}],
            "sources": [{"id": "lever"}],
            "collected_at": "2026-08-03T12:00:00+00:00",
        }
        upsert_jobs.return_value = [{"id": "job-1"}]
        record_source_runs.return_value = 1
        match_all_users.return_value = {"users": 1, "jobs": 1, "matches": 1, "failed_users": 0}

        self.assertEqual(
            run_cycle(client),
            {"jobs": 1, "source_runs": 1, "users": 1, "matches": 1, "failed_users": 0},
        )
        upsert_jobs.assert_called_once_with(
            collect.return_value["jobs"],
            collect.return_value["collected_at"],
            client,
        )
        record_source_runs.assert_called_once_with(
            collect.return_value["sources"],
            collect.return_value["collected_at"],
            client,
        )
        match_all_users.assert_called_once_with(client)


if __name__ == "__main__":
    unittest.main()
