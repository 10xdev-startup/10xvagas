import unittest
from unittest.mock import MagicMock, patch
from urllib import parse

from engine.billing.stripe_meter import StripeMeterError, emit_meter_event


class StripeMeterTest(unittest.TestCase):
    def test_emits_namespaced_token_event_with_dimensions(self) -> None:
        response = MagicMock()
        response.read.return_value = b'{"object":"billing.meter_event"}'
        response.__enter__.return_value = response
        with patch("engine.billing.stripe_meter.request.urlopen", return_value=response) as urlopen:
            result = emit_meter_event(
                secret_key="sk_test_example",
                customer_id="cus_123",
                event_name="10xvagas_tokens",
                value=42,
                dimensions={"model": "gpt-test", "token_type": "input"},
                identifier="event-123",
                timestamp=1_700_000_000,
            )

        request_body = parse.parse_qs(urlopen.call_args.args[0].data.decode("utf-8"))
        self.assertEqual(result["object"], "billing.meter_event")
        self.assertEqual(request_body["event_name"], ["10xvagas_tokens"])
        self.assertEqual(request_body["payload[stripe_customer_id]"], ["cus_123"])
        self.assertEqual(request_body["payload[model]"], ["gpt-test"])
        self.assertEqual(request_body["payload[token_type]"], ["input"])

    def test_rejects_event_from_another_product(self) -> None:
        with self.assertRaises(StripeMeterError):
            emit_meter_event(
                secret_key="sk_test_example",
                customer_id="cus_123",
                event_name="10xdev_tokens",
                value=1,
            )

    def test_token_event_requires_dimensions(self) -> None:
        with self.assertRaises(StripeMeterError):
            emit_meter_event(
                secret_key="sk_test_example",
                customer_id="cus_123",
                event_name="10xvagas_tokens",
                value=1,
            )


if __name__ == "__main__":
    unittest.main()
