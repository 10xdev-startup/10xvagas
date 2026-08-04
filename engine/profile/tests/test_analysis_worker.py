from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest.mock import Mock

from engine.profile.analysis_worker import (
    ANALYSIS_SCHEMA_PATH,
    ProfileAnalysisError,
    ProfileAnalysisWorker,
    validate_analysis_response,
)


def schema_value(schema: dict) -> object:
    raw_type = schema.get("type")
    value_type = next((item for item in raw_type if item != "null"), "null") if isinstance(raw_type, list) else raw_type
    if schema.get("enum"):
        return schema["enum"][0]
    if value_type == "object":
        properties = schema.get("properties", {})
        return {key: schema_value(properties[key]) for key in schema.get("required", [])}
    if value_type == "array":
        return []
    if value_type == "string":
        return "evidence"
    if value_type == "integer":
        return schema.get("minimum", 1)
    if value_type == "boolean":
        return False
    return None


class FakeClient:
    def __init__(self, *, cancelled: bool = False, existing_analysis: bool = False) -> None:
        self.cancelled = cancelled
        self.existing_analysis = existing_analysis
        self.patches: list[tuple[str, dict]] = []

    def rpc(self, _function: str, _payload: dict) -> list[dict]:
        return []

    def request(self, path: str, *, method: str = "GET", payload=None, prefer=None):
        del prefer
        if path.startswith("profile_analysis_job?select=status"):
            return [{"status": "cancel_requested" if self.cancelled else "running"}]
        if path.startswith("profile_analysis?select=id"):
            return [{"id": "analysis-1"}] if self.existing_analysis else []
        if path.startswith("ai_usage_event?select=id"):
            return [{"id": "usage-1"}]
        if method == "PATCH":
            self.patches.append((path, payload or {}))
            return []
        return []


class ProfileAnalysisWorkerTests(unittest.TestCase):
    def setUp(self) -> None:
        self.schema = json.loads(Path(ANALYSIS_SCHEMA_PATH).read_text(encoding="utf-8"))

    def test_complete_schema_accepts_valid_contract_and_rejects_bad_provenance(self) -> None:
        response = schema_value(self.schema)
        assert isinstance(response, dict)
        response["source_evidence"] = [{
            "field": "experience[0].company",
            "source": "cv.pdf",
            "page_or_section": "Experiencia",
            "excerpt_summary": "Empresa explicitamente informada",
            "confidence": "high",
            "kind": "explicit",
        }]

        validate_analysis_response(response, self.schema)
        response["source_evidence"][0]["kind"] = "invented"
        with self.assertRaises(ProfileAnalysisError):
            validate_analysis_response(response, self.schema)

    def test_cancel_requested_is_observed_before_document_download(self) -> None:
        client = FakeClient(cancelled=True)
        gateway = Mock()
        worker = ProfileAnalysisWorker(client, gateway, worker_id="test-worker")

        worker.process({"id": "job-1"})

        gateway.call_structured.assert_not_called()
        self.assertTrue(any(patch.get("status") == "cancelled" for _, patch in client.patches))

    def test_abandoned_job_with_persisted_analysis_is_finalized_without_second_llm_call(self) -> None:
        client = FakeClient(existing_analysis=True)
        gateway = Mock()
        worker = ProfileAnalysisWorker(client, gateway, worker_id="test-worker")
        job = {
            "id": "job-1",
            "stripe_customer_id": "cus_vagas",
            "user_id": "user-1",
        }

        worker.process(job)

        gateway.call_structured.assert_not_called()
        usage_patches = [patch for path, patch in client.patches if path.startswith("ai_usage_event?")]
        self.assertEqual(usage_patches[0]["analysis_id"], "analysis-1")
        self.assertEqual(usage_patches[0]["feature_meter_status"], "pending")
        self.assertTrue(any(patch.get("status") == "succeeded" for _, patch in client.patches))


if __name__ == "__main__":
    unittest.main()
