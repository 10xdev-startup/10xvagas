from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from engine.llm.catalog import LlmModel
from engine.llm.stripe_gateway import PROFILE_ANALYSIS_TOOL_NAME
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
    def model(self, model_id: str):
        provider = "anthropic" if model_id.startswith("claude-") else "google" if model_id.startswith("gemini-") else "openai"
        return LlmModel(
            id=model_id,
            provider=provider,
            label=model_id,
            api_model=f"{provider}/{model_id}",
        )

    def test_sends_idempotency_key_and_captures_all_token_types(self) -> None:
        captured = {}
        body = {
            "id": "resp_1",
            "model": "openai/gpt-5.6-sol",
            "output": [{"type": "function_call", "name": PROFILE_ANALYSIS_TOOL_NAME, "arguments": "{\"ok\": true}"}],
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
                model=self.model("gpt-5.6-sol"),
                prompt="context",
                schema={"type": "object"},
            )

        self.assertEqual(captured["request"].get_header("Idempotency-key"), "10xvagas_profile_usage-1")
        self.assertEqual(response.usage.input_tokens, 100)
        self.assertEqual(response.usage.output_tokens, 20)
        self.assertEqual(response.usage.cached_tokens, 10)
        self.assertEqual(response.arguments, {"ok": True})
        self.assertEqual(response.tool_name, PROFILE_ANALYSIS_TOOL_NAME)

    def test_routes_anthropic_tool_call_and_normalizes_returned_model(self) -> None:
        captured = {}
        body = {
            "id": "msg_1",
            "model": "claude-opus-5",
            "content": [{"type": "tool_use", "name": PROFILE_ANALYSIS_TOOL_NAME, "input": {"ok": True}}],
            "stop_reason": "tool_use",
            "usage": {
                "input_tokens": 80,
                "output_tokens": 10,
                "cache_creation_input_tokens": 5,
                "cache_read_input_tokens": 15,
            },
        }

        def fake_urlopen(req, timeout):
            captured["request"] = req
            captured["timeout"] = timeout
            return FakeResponse(body)

        gateway = StripeLlmGateway("sk_test_secret")
        with patch("engine.llm.stripe_gateway.request.urlopen", side_effect=fake_urlopen):
            response = gateway.call_structured(
                idempotency_key="anthropic-1",
                model=self.model("claude-opus-5"),
                prompt="context",
                schema={"type": "object"},
            )

        self.assertTrue(captured["request"].full_url.endswith("/v1/messages"))
        self.assertEqual(response.model, "claude-opus-5")
        self.assertEqual(response.provider, "anthropic")
        self.assertEqual(response.usage.input_tokens, 100)
        self.assertEqual(response.usage.cached_tokens, 15)

    def test_google_uses_required_tool_choice(self) -> None:
        captured = {}
        body = {
            "id": "chat_1",
            "model": "google/gemini-2.5-pro",
            "choices": [{
                "finish_reason": "tool_calls",
                "message": {"tool_calls": [{
                    "type": "function",
                    "function": {"name": PROFILE_ANALYSIS_TOOL_NAME, "arguments": "{\"ok\": true}"},
                }]},
            }],
            "usage": {"prompt_tokens": 90, "completion_tokens": 11},
        }

        def fake_urlopen(req, timeout):
            captured["payload"] = json.loads(req.data.decode("utf-8"))
            captured["request"] = req
            captured["timeout"] = timeout
            return FakeResponse(body)

        gateway = StripeLlmGateway("sk_test_secret")
        with patch("engine.llm.stripe_gateway.request.urlopen", side_effect=fake_urlopen):
            response = gateway.call_structured(
                idempotency_key="google-1",
                model=self.model("gemini-2.5-pro"),
                prompt="context",
                schema={"type": "object"},
            )

        self.assertTrue(captured["request"].full_url.endswith("/chat/completions"))
        self.assertEqual(captured["payload"]["tool_choice"], "required")
        self.assertEqual(response.model, "gemini-2.5-pro")
        self.assertEqual(response.arguments, {"ok": True})


if __name__ == "__main__":
    unittest.main()
