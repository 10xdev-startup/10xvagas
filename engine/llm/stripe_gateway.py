from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib import error, request

from engine.llm.catalog import LlmModel


class StripeGatewayError(RuntimeError):
    """Falha acionavel do Stripe LLM Gateway sem expor credenciais ou prompt."""


@dataclass(frozen=True)
class LlmUsage:
    input_tokens: int
    output_tokens: int
    cached_tokens: int


@dataclass(frozen=True)
class StructuredLlmResponse:
    arguments: dict[str, Any]
    finish_reason: str | None
    model: str
    response_id: str
    usage: LlmUsage


class StripeLlmGateway:
    def __init__(
        self,
        secret_key: str,
        *,
        base_url: str = "https://llm.stripe.com",
        timeout: float = 150.0,
    ) -> None:
        if not secret_key.strip():
            raise StripeGatewayError("STRIPE_SECRET_KEY nao configurada para o LLM Gateway")
        self.secret_key = secret_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    @classmethod
    def from_env(cls) -> StripeLlmGateway:
        return cls(
            os.environ.get("STRIPE_SECRET_KEY", ""),
            base_url=os.environ.get("STRIPE_LLM_GATEWAY_URL", "https://llm.stripe.com"),
        )

    def call_structured(
        self,
        *,
        idempotency_key: str,
        model: LlmModel,
        prompt: str,
        schema: dict[str, Any],
        max_output_tokens: int = 12_000,
    ) -> StructuredLlmResponse:
        payload = {
            "model": model.api_model,
            "max_output_tokens": max_output_tokens,
            "input": prompt,
            "tools": [
                {
                    "type": "function",
                    "name": "respond",
                    "description": "Retorna a analise estruturada do curriculo e Perfil Canonico.",
                    "parameters": schema,
                }
            ],
            "tool_choice": {"type": "function", "name": "respond"},
        }
        req = request.Request(
            f"{self.base_url}/responses",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.secret_key}",
                "Content-Type": "application/json",
                "Idempotency-Key": idempotency_key,
            },
            method="POST",
        )
        try:
            with request.urlopen(req, timeout=self.timeout) as response:
                body = json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            request_id = exc.headers.get("request-id") or exc.headers.get("stripe-request-id")
            suffix = f" (request_id={request_id})" if request_id else ""
            raise StripeGatewayError(f"LLM Gateway respondeu HTTP {exc.code}{suffix}") from exc
        except error.URLError as exc:
            raise StripeGatewayError(f"Falha de rede no LLM Gateway: {exc.reason}") from exc
        except json.JSONDecodeError as exc:
            raise StripeGatewayError("LLM Gateway retornou JSON invalido") from exc

        output = body.get("output")
        tool_call = next(
            (
                item
                for item in output
                if isinstance(item, dict)
                and item.get("type") == "function_call"
                and item.get("name") == "respond"
            ),
            None,
        ) if isinstance(output, list) else None
        if not tool_call or not isinstance(tool_call.get("arguments"), str):
            raise StripeGatewayError("LLM Gateway nao retornou a tool respond")
        try:
            arguments = json.loads(tool_call["arguments"])
        except json.JSONDecodeError as exc:
            raise StripeGatewayError("A tool respond retornou argumentos invalidos") from exc
        if not isinstance(arguments, dict):
            raise StripeGatewayError("A tool respond nao retornou um objeto")

        usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
        details = usage.get("input_tokens_details") if isinstance(usage.get("input_tokens_details"), dict) else {}
        return StructuredLlmResponse(
            arguments=arguments,
            finish_reason=body.get("status") if isinstance(body.get("status"), str) else None,
            model=body.get("model") if isinstance(body.get("model"), str) else model.id,
            response_id=body.get("id") if isinstance(body.get("id"), str) else "",
            usage=LlmUsage(
                input_tokens=int(usage.get("input_tokens") or 0),
                output_tokens=int(usage.get("output_tokens") or 0),
                cached_tokens=int(details.get("cached_tokens") or 0),
            ),
        )
