"""Emit 10xVagas meter events through Stripe REST without external dependencies."""

from __future__ import annotations

import json
import os
import time
import uuid
from typing import Any, Mapping
from urllib import error, parse, request

BILLING_NAMESPACE = "10xvagas"
TOKEN_EVENT_NAME = "10xvagas_tokens"
ALLOWED_EVENT_NAMES = frozenset(
    {
        TOKEN_EVENT_NAME,
        "10xvagas_profile_extracted",
        "10xvagas_job_match_judged",
        "10xvagas_cv_adapted",
        "10xvagas_form_answer_generated",
    }
)


class StripeMeterError(RuntimeError):
    """Raised when a meter event is invalid or Stripe rejects it."""


def _validate_event(
    event_name: str,
    value: int,
    dimensions: Mapping[str, str] | None,
) -> None:
    if event_name not in ALLOWED_EVENT_NAMES:
        raise StripeMeterError(f"meter event fora do namespace permitido: {event_name}")
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise StripeMeterError("value deve ser um inteiro positivo")
    if event_name == TOKEN_EVENT_NAME:
        if not dimensions or not dimensions.get("model") or not dimensions.get("token_type"):
            raise StripeMeterError("10xvagas_tokens exige model e token_type")


def emit_meter_event(
    *,
    secret_key: str,
    customer_id: str,
    event_name: str,
    value: int,
    dimensions: Mapping[str, str] | None = None,
    identifier: str | None = None,
    timestamp: int | None = None,
    api_base: str = "https://api.stripe.com",
) -> dict[str, Any]:
    """Emit a namespaced Stripe meter event and return Stripe's JSON response."""
    if not secret_key.strip():
        raise StripeMeterError("STRIPE_SECRET_KEY nao configurada")
    if not customer_id.strip():
        raise StripeMeterError("stripe_customer_id nao informado")
    _validate_event(event_name, value, dimensions)

    payload: dict[str, str] = {
        "event_name": event_name,
        "identifier": identifier or str(uuid.uuid4()),
        "timestamp": str(timestamp if timestamp is not None else int(time.time())),
        "payload[stripe_customer_id]": customer_id,
        "payload[value]": str(value),
    }
    for key, dimension_value in (dimensions or {}).items():
        payload[f"payload[{key}]"] = dimension_value

    req = request.Request(
        f"{api_base.rstrip('/')}/v1/billing/meter_events",
        data=parse.urlencode(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {secret_key}",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=20) as response:
            return json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise StripeMeterError(f"Stripe rejeitou meter event ({exc.code}): {body[:300]}") from exc
    except error.URLError as exc:
        raise StripeMeterError(f"Falha de rede ao emitir meter event: {exc.reason}") from exc


def emit_meter_event_from_env(
    *,
    customer_id: str,
    event_name: str,
    value: int,
    dimensions: Mapping[str, str] | None = None,
    identifier: str | None = None,
) -> dict[str, Any]:
    """Convenience wrapper that reads only the Stripe secret from the environment."""
    return emit_meter_event(
        secret_key=os.environ.get("STRIPE_SECRET_KEY", ""),
        customer_id=customer_id,
        event_name=event_name,
        value=value,
        dimensions=dimensions,
        identifier=identifier,
    )
