from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from engine.llm.catalog import MODELS
from engine.llm.stripe_gateway import StripeLlmGateway


class FakeResponse:
    def __init__(self, body: dict) -> None:
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self) -> bytes:
        return json.dumps(self.body).encode("utf-8")


class StripeLlmGatewayTests(unittest.TestCase):
    def test_sends_idempotency_key_and_captures_all_token_types(self) -> None:
        captured = {}
        body = {
            "id": "resp_1",
            "model": "openai/gpt-5.6-terra",
            "output": [{"type": "function_call", "name": "respond", "arguments": "{\"ok\": true}"}],
            "status": "completed",
            "usage": {
                "input_tokens": 100,
                "output_tokens": 20,
                "input_tokens_details": {"cached_tokens": 10},
            },
        }

        def fake_urlopen(req, timeout):
            captured["request"] = req
            captured["timeout"] = timeout
            return FakeResponse(body)

        gateway = StripeLlmGateway("sk_test_secret")
        with patch("engine.llm.stripe_gateway.request.urlopen", side_effect=fake_urlopen):
            response = gateway.call_structured(
                idempotency_key="10xvagas_profile_usage-1",
                model=MODELS[0],
                prompt="context",
                schema={"type": "object"},
            )

        self.assertEqual(captured["request"].get_header("Idempotency-key"), "10xvagas_profile_usage-1")
        self.assertEqual(response.usage.input_tokens, 100)
        self.assertEqual(response.usage.output_tokens, 20)
        self.assertEqual(response.usage.cached_tokens, 10)
        self.assertEqual(response.arguments, {"ok": True})


if __name__ == "__main__":
    unittest.main()
