from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any
from urllib import error, request

from engine.llm.catalog import LlmModel

PROFILE_ANALYSIS_TOOL_NAME = "submit_profile_analysis"


class StripeGatewayError(RuntimeError):
    """Falha acionavel do Stripe LLM Gateway sem expor credenciais ou prompt."""


@dataclass(frozen=True)
class LlmUsage:
    input_tokens: int
    output_tokens: int
    cached_tokens: int


@dataclass(frozen=True)
class StructuredLlmResponse:
    api_model: str
    arguments: dict[str, Any]
    finish_reason: str | None
    model: str
    provider: str
    response_id: str
    tool_name: str
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
        endpoint, payload, extra_headers = self._request_contract(
            model=model,
            prompt=prompt,
            schema=schema,
            max_output_tokens=max_output_tokens,
        )
        req = request.Request(
            f"{self.base_url}{endpoint}",
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            headers={
                "Authorization": f"Bearer {self.secret_key}",
                "Content-Type": "application/json",
                "Idempotency-Key": idempotency_key,
                **extra_headers,
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

        tool_arguments, finish_reason = self._extract_tool_call(model.provider, body)
        try:
            arguments = json.loads(tool_arguments) if isinstance(tool_arguments, str) else tool_arguments
        except json.JSONDecodeError as exc:
            raise StripeGatewayError(f"A tool {PROFILE_ANALYSIS_TOOL_NAME} retornou argumentos invalidos") from exc
        if not isinstance(arguments, dict):
            raise StripeGatewayError(f"A tool {PROFILE_ANALYSIS_TOOL_NAME} nao retornou um objeto")

        usage = self._extract_usage(model.provider, body)
        raw_model = body.get("model") if isinstance(body.get("model"), str) else model.api_model
        return StructuredLlmResponse(
            api_model=raw_model,
            arguments=arguments,
            finish_reason=finish_reason,
            model=_strip_vendor_prefix(raw_model),
            provider=model.provider,
            response_id=body.get("id") if isinstance(body.get("id"), str) else "",
            tool_name=PROFILE_ANALYSIS_TOOL_NAME,
            usage=usage,
        )

    def _request_contract(
        self,
        *,
        model: LlmModel,
        prompt: str,
        schema: dict[str, Any],
        max_output_tokens: int,
    ) -> tuple[str, dict[str, Any], dict[str, str]]:
        description = "Retorna a analise estruturada do curriculo e Perfil Canonico."
        if model.provider == "anthropic":
            return "/v1/messages", {
                "model": model.api_model,
                "max_tokens": max_output_tokens,
                "messages": [{"role": "user", "content": prompt}],
                "tools": [{
                    "name": PROFILE_ANALYSIS_TOOL_NAME,
                    "description": description,
                    "input_schema": schema,
                }],
                "tool_choice": {"type": "tool", "name": PROFILE_ANALYSIS_TOOL_NAME},
            }, {"anthropic-version": "2023-06-01"}
        if model.provider == "google":
            return "/chat/completions", {
                "model": model.api_model,
                "max_tokens": max_output_tokens,
                "messages": [{"role": "user", "content": prompt}],
                "tools": [{
                    "type": "function",
                    "function": {
                        "name": PROFILE_ANALYSIS_TOOL_NAME,
                        "description": description,
                        "parameters": schema,
                    },
                }],
                # O gateway Gemini devolve malformed_function_call quando recebe
                # a escolha nomeada. `required` foi validado por smoke nos dois modelos.
                "tool_choice": "required",
            }, {}
        if model.provider == "openai":
            return "/responses", {
                "model": model.api_model,
                "max_output_tokens": max_output_tokens,
                "input": prompt,
                "tools": [{
                    "type": "function",
                    "name": PROFILE_ANALYSIS_TOOL_NAME,
                    "description": description,
                    "parameters": schema,
                }],
                "tool_choice": {"type": "function", "name": PROFILE_ANALYSIS_TOOL_NAME},
            }, {}
        raise StripeGatewayError(f"Provider nao suportado: {model.provider}")

    def _extract_tool_call(self, provider: str, body: dict[str, Any]) -> tuple[Any, str | None]:
        if provider == "anthropic":
            content = body.get("content")
            tool_call = next((
                item for item in content
                if isinstance(item, dict)
                and item.get("type") == "tool_use"
                and item.get("name") == PROFILE_ANALYSIS_TOOL_NAME
            ), None) if isinstance(content, list) else None
            if not tool_call or "input" not in tool_call:
                raise StripeGatewayError(f"LLM Gateway nao retornou a tool {PROFILE_ANALYSIS_TOOL_NAME}")
            finish_reason = body.get("stop_reason") if isinstance(body.get("stop_reason"), str) else None
            return tool_call["input"], finish_reason

        if provider == "google":
            choices = body.get("choices")
            choice = choices[0] if isinstance(choices, list) and choices and isinstance(choices[0], dict) else None
            message = choice.get("message") if isinstance(choice, dict) and isinstance(choice.get("message"), dict) else {}
            calls = message.get("tool_calls")
            call = calls[0] if isinstance(calls, list) and calls and isinstance(calls[0], dict) else None
            function = call.get("function") if isinstance(call, dict) and isinstance(call.get("function"), dict) else None
            if not function or function.get("name") != PROFILE_ANALYSIS_TOOL_NAME or not isinstance(function.get("arguments"), str):
                raise StripeGatewayError(f"LLM Gateway nao retornou a tool {PROFILE_ANALYSIS_TOOL_NAME}")
            finish_reason = choice.get("finish_reason") if isinstance(choice.get("finish_reason"), str) else None
            return function["arguments"], finish_reason

        output = body.get("output")
        tool_call = next((
            item for item in output
            if isinstance(item, dict)
            and item.get("type") == "function_call"
            and item.get("name") == PROFILE_ANALYSIS_TOOL_NAME
        ), None) if isinstance(output, list) else None
        if not tool_call or not isinstance(tool_call.get("arguments"), str):
            raise StripeGatewayError(f"LLM Gateway nao retornou a tool {PROFILE_ANALYSIS_TOOL_NAME}")
        finish_reason = body.get("status") if isinstance(body.get("status"), str) else None
        return tool_call["arguments"], finish_reason

    def _extract_usage(self, provider: str, body: dict[str, Any]) -> LlmUsage:
        usage = body.get("usage") if isinstance(body.get("usage"), dict) else {}
        if provider == "anthropic":
            cached = int(usage.get("cache_read_input_tokens") or 0)
            input_tokens = (
                int(usage.get("input_tokens") or 0)
                + int(usage.get("cache_creation_input_tokens") or 0)
                + cached
            )
            return LlmUsage(
                input_tokens=input_tokens,
                output_tokens=int(usage.get("output_tokens") or 0),
                cached_tokens=cached,
            )
        if provider == "google":
            details = usage.get("prompt_tokens_details") if isinstance(usage.get("prompt_tokens_details"), dict) else {}
            return LlmUsage(
                input_tokens=int(usage.get("prompt_tokens") or 0),
                output_tokens=int(usage.get("completion_tokens") or 0),
                cached_tokens=int(details.get("cached_tokens") or 0),
            )
        details = usage.get("input_tokens_details") if isinstance(usage.get("input_tokens_details"), dict) else {}
        return LlmUsage(
            input_tokens=int(usage.get("input_tokens") or 0),
            output_tokens=int(usage.get("output_tokens") or 0),
            cached_tokens=int(details.get("cached_tokens") or 0),
        )


def _strip_vendor_prefix(model: str) -> str:
    return model.split("/", 1)[1] if "/" in model else model
