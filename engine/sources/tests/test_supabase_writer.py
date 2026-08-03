from __future__ import annotations

import unittest
from unittest.mock import Mock, patch

from engine.sources.collect import record_source_runs, upsert_jobs
from engine.supabase_rest import SupabaseRestClient, SupabaseRestError


class SupabaseWriterTest(unittest.TestCase):
    def test_upsert_uses_natural_key_and_collection_timestamp(self) -> None:
        client = Mock(spec=SupabaseRestClient)
        client.request.return_value = [{"id": "job-uuid"}]
        job = {
            "external_id": "42",
            "source": "greenhouse",
            "source_label": "Greenhouse",
            "title": "Backend Engineer",
            "company": "Acme",
            "source_url": "https://example.com/jobs/42",
            "apply_url": None,
            "description": "Build APIs.",
            "location": "Brazil",
            "workplace_type": "remote",
            "employment_type": "full_time",
            "published_at": None,
            "salary_raw": None,
            "market": "brazil",
        }

        result = upsert_jobs([job], "2026-08-03T12:00:00+00:00", client)

        self.assertEqual(result, [{"id": "job-uuid"}])
        client.request.assert_called_once_with(
            "job?on_conflict=source%2Cexternal_id",
            method="POST",
            payload=[{**job, "last_seen_at": "2026-08-03T12:00:00+00:00"}],
            prefer="resolution=merge-duplicates,return=representation,missing=default",
        )

    def test_empty_collection_does_not_call_supabase(self) -> None:
        client = Mock(spec=SupabaseRestClient)
        self.assertEqual(upsert_jobs([], "2026-08-03T12:00:00+00:00", client), [])
        client.request.assert_not_called()

    @patch.dict("os.environ", {}, clear=True)
    def test_client_requires_environment_credentials(self) -> None:
        with self.assertRaisesRegex(SupabaseRestError, "SUPABASE_URL"):
            SupabaseRestClient.from_env()

    def test_records_source_health_as_append_only_run(self) -> None:
        client = Mock(spec=SupabaseRestClient)
        client.request.return_value = None
        sources = [
            {"id": "lever", "label": "Lever", "mode": "automatic", "status": "ok", "count": 12},
            {"id": "linkedin", "label": "LinkedIn", "mode": "assisted", "status": "assisted", "count": 0},
        ]

        self.assertEqual(
            record_source_runs(sources, "2026-08-03T12:00:00+00:00", client, "run-1"),
            2,
        )
        client.request.assert_called_once_with(
            "source_run",
            method="POST",
            payload=[
                {
                    "run_id": "run-1",
                    "source_id": "lever",
                    "source_label": "Lever",
                    "mode": "automatic",
                    "status": "ok",
                    "job_count": 12,
                    "error_message": None,
                    "collected_at": "2026-08-03T12:00:00+00:00",
                },
                {
                    "run_id": "run-1",
                    "source_id": "linkedin",
                    "source_label": "LinkedIn",
                    "mode": "assisted",
                    "status": "assisted",
                    "job_count": 0,
                    "error_message": None,
                    "collected_at": "2026-08-03T12:00:00+00:00",
                },
            ],
            prefer="return=minimal",
        )


if __name__ == "__main__":
    unittest.main()
