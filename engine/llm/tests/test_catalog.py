from __future__ import annotations

import json
import os
import unittest
from unittest.mock import patch

from engine.llm.catalog import clear_catalog_cache
from engine.llm.catalog import get_default_model
from engine.llm.catalog import get_model


class FakeResponse:
    def __init__(self, body: dict) -> None:
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return None

    def read(self) -> bytes:
        return json.dumps(self.body).encode("utf-8")


def rate(token_type: str) -> dict:
    return {
        "metered_item": {
            "meter_segment_conditions": [
                {"dimension": "model", "value": "gpt-5.6-sol"},
                {"dimension": "token_type", "value": token_type},
            ],
        },
    }


class StripeModelCatalogTests(unittest.TestCase):
    def setUp(self) -> None:
        clear_catalog_cache()

    def fake_urlopen(self, req, timeout):
        del timeout
        if req.full_url.endswith("/rates?limit=100"):
            return FakeResponse({"data": [rate("input"), rate("output"), rate("cached")]})
        if req.full_url.endswith("/v1/models"):
            return FakeResponse({"data": [{
                "author": "openai",
                "id": "openai/gpt-5.6-sol",
                "model": "gpt-5.6-sol",
                "stripe_ai_gateway_support": True,
            }]})
        return FakeResponse({"metadata": {"default_profile_analysis_model": "gpt-5.6-sol"}})

    def test_resolves_only_models_present_in_rate_card_and_gateway(self) -> None:
        with patch.dict(os.environ, {"STRIPE_SECRET_KEY": "sk_test", "STRIPE_RATE_CARD_ID": "rcd_test"}), patch(
            "engine.llm.catalog.request.urlopen",
            side_effect=self.fake_urlopen,
        ):
            model = get_default_model()
            self.assertEqual(model.id, "gpt-5.6-sol")
            self.assertEqual(model.api_model, "openai/gpt-5.6-sol")
            self.assertEqual(get_model("gpt-5.6-terra"), None)

    def test_rejects_duplicate_rate_tuple(self) -> None:
        def duplicate_urlopen(req, timeout):
            if req.full_url.endswith("/rates?limit=100"):
                return FakeResponse({"data": [rate("input"), rate("input")]})
            return self.fake_urlopen(req, timeout)

        with patch.dict(os.environ, {"STRIPE_SECRET_KEY": "sk_test", "STRIPE_RATE_CARD_ID": "rcd_test"}), patch(
            "engine.llm.catalog.request.urlopen",
            side_effect=duplicate_urlopen,
        ):
            with self.assertRaisesRegex(RuntimeError, "RATE_NOT_UNIQUE:gpt-5.6-sol:input"):
                get_model("gpt-5.6-sol")


if __name__ == "__main__":
    unittest.main()
