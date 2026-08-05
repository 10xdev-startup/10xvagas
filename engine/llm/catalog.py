from __future__ import annotations

from dataclasses import dataclass
import json
import os
import time
from typing import Any
from urllib import error, request


STRIPE_API_BASE = "https://api.stripe.com"
STRIPE_GATEWAY_BASE = "https://llm.stripe.com"
STRIPE_V2_VERSION = "2026-03-25.preview"
REQUIRED_TOKEN_TYPES = frozenset({"cached", "input", "output"})
SUPPORTED_PROVIDERS = frozenset({"anthropic", "google", "openai"})
CACHE_TTL_SECONDS = 300


@dataclass(frozen=True)
class LlmModel:
    id: str
    provider: str
    label: str
    api_model: str
    selectable: bool = True


_cache: tuple[float, tuple[LlmModel, ...], str] | None = None


def _get_json(url: str, secret_key: str, *, stripe_v2: bool = False) -> dict[str, Any]:
    headers = {"Authorization": f"Bearer {secret_key}"}
    if stripe_v2:
        headers["Stripe-Version"] = STRIPE_V2_VERSION
    req = request.Request(url, headers=headers, method="GET")
    try:
        with request.urlopen(req, timeout=30) as response:
            value = json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        raise RuntimeError(f"STRIPE_MODEL_CATALOG_HTTP_{exc.code}") from exc
    except (error.URLError, json.JSONDecodeError) as exc:
        raise RuntimeError("STRIPE_MODEL_CATALOG_UNAVAILABLE") from exc
    if not isinstance(value, dict):
        raise RuntimeError("STRIPE_MODEL_CATALOG_INVALID")
    return value


def _label(model_id: str) -> str:
    words = []
    for part in model_id.split("-"):
        if part == "gpt":
            words.append("GPT")
        elif part == "luna":
            words.append("Lua")
        elif part.replace(".", "").isdigit():
            words.append(part)
        else:
            words.append(part[:1].upper() + part[1:])
    label = " ".join(words)
    if label.startswith("GPT "):
        label = label.replace("GPT ", "GPT-", 1)
    return label


def _load_catalog() -> tuple[tuple[LlmModel, ...], str]:
    secret_key = os.environ.get("STRIPE_SECRET_KEY", "").strip()
    rate_card_id = os.environ.get("STRIPE_RATE_CARD_ID", "").strip()
    if not secret_key or not rate_card_id:
        raise RuntimeError("STRIPE_MODEL_CATALOG_NOT_CONFIGURED")

    card = _get_json(f"{STRIPE_API_BASE}/v2/billing/rate_cards/{rate_card_id}", secret_key, stripe_v2=True)
    rate_page = _get_json(
        f"{STRIPE_API_BASE}/v2/billing/rate_cards/{rate_card_id}/rates?limit=100",
        secret_key,
        stripe_v2=True,
    )
    gateway_page = _get_json(f"{STRIPE_GATEWAY_BASE}/v1/models", secret_key)

    token_types_by_model: dict[str, set[str]] = {}
    for rate in rate_page.get("data", []):
        if not isinstance(rate, dict):
            continue
        item = rate.get("metered_item")
        if not isinstance(item, dict):
            continue
        conditions = item.get("meter_segment_conditions")
        if not isinstance(conditions, list):
            continue
        dimensions = {
            condition.get("dimension"): condition.get("value")
            for condition in conditions
            if isinstance(condition, dict)
        }
        model_id = dimensions.get("model")
        token_type = dimensions.get("token_type")
        if not isinstance(model_id, str) or token_type not in REQUIRED_TOKEN_TYPES:
            continue
        model_token_types = token_types_by_model.setdefault(model_id, set())
        if token_type in model_token_types:
            raise RuntimeError(f"RATE_NOT_UNIQUE:{model_id}:{token_type}")
        model_token_types.add(token_type)

    incomplete = next((model for model, types in token_types_by_model.items() if types != REQUIRED_TOKEN_TYPES), None)
    if incomplete:
        raise RuntimeError(f"RATE_MODEL_INCOMPLETE:{incomplete}")

    gateway_by_model: dict[str, dict[str, Any]] = {}
    for item in gateway_page.get("data", []):
        if not isinstance(item, dict) or item.get("stripe_ai_gateway_support") is not True:
            continue
        model_id = item.get("model")
        if isinstance(model_id, str):
            gateway_by_model[model_id] = item

    models = []
    for model_id in token_types_by_model:
        gateway_model = gateway_by_model.get(model_id)
        if not gateway_model:
            raise RuntimeError(f"RATE_MODEL_UNAVAILABLE_IN_GATEWAY:{model_id}")
        api_model = gateway_model.get("id")
        provider = gateway_model.get("author") or gateway_model.get("owned_by")
        if not isinstance(api_model, str) or provider not in SUPPORTED_PROVIDERS:
            raise RuntimeError(f"RATE_MODEL_PROVIDER_UNSUPPORTED:{model_id}")
        models.append(LlmModel(model_id, provider, _label(model_id), api_model))

    metadata = card.get("metadata")
    default_id = metadata.get("default_profile_analysis_model") if isinstance(metadata, dict) else None
    if not isinstance(default_id, str) or default_id not in token_types_by_model:
        raise RuntimeError("RATE_CARD_DEFAULT_MODEL_UNAVAILABLE")
    if not models:
        raise RuntimeError("RATE_CARD_HAS_NO_AI_MODELS")
    return tuple(models), default_id


def _catalog() -> tuple[tuple[LlmModel, ...], str]:
    global _cache
    now = time.monotonic()
    if _cache and _cache[0] > now:
        return _cache[1], _cache[2]
    models, default_id = _load_catalog()
    _cache = (now + CACHE_TTL_SECONDS, models, default_id)
    return models, default_id


def clear_catalog_cache() -> None:
    global _cache
    _cache = None


def get_model(model_id: str) -> LlmModel | None:
    models, _default_id = _catalog()
    return next((model for model in models if model.id == model_id), None)


def get_selectable_model(model_id: str) -> LlmModel | None:
    return get_model(model_id)


def get_default_model() -> LlmModel:
    models, default_id = _catalog()
    model = next((item for item in models if item.id == default_id), None)
    if not model:
        raise RuntimeError("RATE_CARD_DEFAULT_MODEL_UNAVAILABLE")
    return model
