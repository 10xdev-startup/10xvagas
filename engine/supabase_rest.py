from __future__ import annotations

import json
import os
from typing import Any
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


class SupabaseRestError(RuntimeError):
    """Falha acionavel da REST API sem vazar credenciais."""


class SupabaseRestClient:
    def __init__(self, base_url: str, service_role_key: str, timeout: float = 30.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.service_role_key = service_role_key
        self.timeout = timeout

    @classmethod
    def from_env(cls) -> SupabaseRestClient:
        base_url = os.environ.get("SUPABASE_URL", "").strip()
        service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
        if not base_url or not service_role_key:
            raise SupabaseRestError(
                "Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de persistir no Supabase."
            )
        return cls(base_url, service_role_key)

    def request(
        self,
        resource: str,
        *,
        method: str = "GET",
        payload: list[dict[str, Any]] | dict[str, Any] | None = None,
        prefer: str | None = None,
    ) -> Any:
        body = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Accept": "application/json",
        }
        if body is not None:
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer

        request = Request(
            f"{self.base_url}/rest/v1/{resource.lstrip('/')}",
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                content = response.read()
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise SupabaseRestError(
                f"Supabase REST respondeu HTTP {error.code}: {detail[:500]}"
            ) from error
        except URLError as error:
            raise SupabaseRestError(f"Nao foi possivel acessar o Supabase: {error.reason}") from error

        if not content:
            return None
        return json.loads(content.decode("utf-8"))

    def rpc(self, function_name: str, payload: dict[str, Any]) -> Any:
        return self.request(f"rpc/{function_name}", method="POST", payload=payload)

    def download_storage_object(self, bucket: str, object_path: str) -> bytes:
        encoded_path = quote(object_path.lstrip("/"), safe="/")
        request = Request(
            f"{self.base_url}/storage/v1/object/{quote(bucket, safe='')}/{encoded_path}",
            headers={
                "apikey": self.service_role_key,
                "Authorization": f"Bearer {self.service_role_key}",
            },
            method="GET",
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return response.read()
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise SupabaseRestError(
                f"Supabase Storage respondeu HTTP {error.code}: {detail[:500]}"
            ) from error
        except URLError as error:
            raise SupabaseRestError(f"Nao foi possivel acessar o Supabase Storage: {error.reason}") from error
