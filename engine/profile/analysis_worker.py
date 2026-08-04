from __future__ import annotations

import argparse
import copy
import json
import os
import socket
import threading
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from engine.llm.catalog import get_selectable_model
from engine.llm.stripe_gateway import StripeGatewayError, StripeLlmGateway
from engine.profile.analysis_context import PROMPT_VERSION, apply_declared_preferences, build_profile_analysis_prompt, empty_canonical_profile
from engine.profile.import_profile import ProfileImportError, SourceDocument, build_deterministic_draft, merge_profile_proposal, read_document
from engine.supabase_rest import SupabaseRestClient, SupabaseRestError

PROFILE_DOCUMENT_BUCKET = "profile-documents"
ANALYSIS_SCHEMA_PATH = Path(__file__).with_name("analysis_schema.json")
LEASE_SECONDS = 300
POLL_SECONDS = 2.0


class _HealthHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:  # noqa: N802 - nome definido pela stdlib
        if self.path not in {"/health", "/ready"}:
            self.send_response(404)
            self.end_headers()
            return
        body = b'{"status":"ok"}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def start_health_server(port: int) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("0.0.0.0", port), _HealthHandler)
    threading.Thread(target=server.serve_forever, name="health-server", daemon=True).start()
    return server


class ProfileAnalysisError(RuntimeError):
    """Falha segura do processamento de um job de Perfil Canonico."""


def _validate_schema(value: Any, schema: dict[str, Any], path: str = "response") -> None:
    expected = schema.get("type")
    allowed_types = expected if isinstance(expected, list) else [expected]
    type_matches = {
        "array": lambda item: isinstance(item, list),
        "boolean": lambda item: isinstance(item, bool),
        "integer": lambda item: isinstance(item, int) and not isinstance(item, bool),
        "null": lambda item: item is None,
        "object": lambda item: isinstance(item, dict),
        "string": lambda item: isinstance(item, str),
    }
    if expected and not any(type_matches.get(kind, lambda _item: False)(value) for kind in allowed_types):
        raise ProfileAnalysisError(f"Resposta estruturada possui {path} invalido")
    if value is None:
        return
    if "enum" in schema and value not in schema["enum"]:
        raise ProfileAnalysisError(f"Resposta estruturada possui {path} fora do enum")
    if isinstance(value, int) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            raise ProfileAnalysisError(f"Resposta estruturada possui {path} abaixo do minimo")
        if "maximum" in schema and value > schema["maximum"]:
            raise ProfileAnalysisError(f"Resposta estruturada possui {path} acima do maximo")
    if isinstance(value, dict):
        required = schema.get("required", [])
        missing = [field for field in required if field not in value]
        if missing:
            raise ProfileAnalysisError(f"Resposta estruturada nao possui {path}.{missing[0]}")
        properties = schema.get("properties", {})
        for key, child in value.items():
            child_schema = properties.get(key)
            if isinstance(child_schema, dict):
                _validate_schema(child, child_schema, f"{path}.{key}")
            elif schema.get("additionalProperties") is False:
                raise ProfileAnalysisError(f"Resposta estruturada possui campo inesperado {path}.{key}")
    if isinstance(value, list) and isinstance(schema.get("items"), dict):
        for index, item in enumerate(value):
            _validate_schema(item, schema["items"], f"{path}[{index}]")


def validate_analysis_response(value: dict[str, Any], schema: dict[str, Any] | None = None) -> None:
    contract = schema or json.loads(ANALYSIS_SCHEMA_PATH.read_text(encoding="utf-8"))
    _validate_schema(value, contract)


def _single_row(value: Any) -> dict[str, Any] | None:
    if isinstance(value, list):
        return value[0] if value and isinstance(value[0], dict) else None
    return value if isinstance(value, dict) else None


class ProfileAnalysisWorker:
    def __init__(
        self,
        client: SupabaseRestClient,
        gateway: StripeLlmGateway,
        *,
        worker_id: str | None = None,
    ) -> None:
        self.client = client
        self.gateway = gateway
        self.worker_id = worker_id or f"{socket.gethostname()}-{os.getpid()}"
        self.schema = json.loads(ANALYSIS_SCHEMA_PATH.read_text(encoding="utf-8"))

    def claim(self) -> dict[str, Any] | None:
        return _single_row(self.client.rpc(
            "claim_profile_analysis_job",
            {"p_lease_seconds": LEASE_SECONDS, "p_worker_id": self.worker_id},
        ))

    def _patch_job(self, job_id: str, patch: dict[str, Any]) -> None:
        self.client.request(
            f"profile_analysis_job?id=eq.{job_id}",
            method="PATCH",
            payload={**patch, "updated_at": _now_iso()},
        )

    def _heartbeat(self, job_id: str, progress: int, current_step: str) -> None:
        now = _now_iso()
        self._patch_job(job_id, {
            "current_step": current_step,
            "heartbeat_at": now,
            "lease_expires_at": _future_iso(LEASE_SECONDS),
            "progress": progress,
        })

    def _is_cancel_requested(self, job_id: str) -> bool:
        rows = self.client.request(
            f"profile_analysis_job?select=status&id=eq.{job_id}&limit=1",
        )
        row = _single_row(rows)
        return bool(row and row.get("status") == "cancel_requested")

    def _cancel(self, job_id: str) -> None:
        now = _now_iso()
        self._patch_job(job_id, {
            "current_step": None,
            "finished_at": now,
            "lease_expires_at": None,
            "progress": 100,
            "status": "cancelled",
            "worker_id": None,
        })

    def _active_profile(self, user_id: str) -> dict[str, Any]:
        rows = self.client.request(f"profile?select=document&user_id=eq.{user_id}&limit=1")
        row = _single_row(rows)
        document = row.get("document") if row else None
        return copy.deepcopy(document) if isinstance(document, dict) else empty_canonical_profile()

    def _insert_usage(self, job: dict[str, Any], usage_id: str) -> None:
        identifiers = {
            "input": f"{usage_id}:input",
            "output": f"{usage_id}:output",
            "cached": f"{usage_id}:cached",
            "feature": f"{job['id']}:profile_extracted",
        }
        self.client.request(
            "ai_usage_event",
            method="POST",
            payload={
                "id": usage_id,
                "user_id": job["user_id"],
                "job_id": job["id"],
                "stripe_customer_id": job["stripe_customer_id"],
                "operation": "profile_analysis",
                "provider": "openai",
                "requested_model": job["model_id"],
                "model": job["model_id"],
                "input_tokens": 0,
                "output_tokens": 0,
                "cached_tokens": 0,
                "total_tokens": 0,
                "meter_identifiers": identifiers,
                "meter_status": "pending",
                "settlement_status": "started",
            },
        )

    def _usage_id_for_job(self, job: dict[str, Any]) -> str:
        rows = self.client.request(
            f"ai_usage_event?select=id&job_id=eq.{job['id']}&operation=eq.profile_analysis&limit=1",
        )
        existing = _single_row(rows)
        if existing and isinstance(existing.get("id"), str):
            return existing["id"]
        usage_id = str(uuid.uuid4())
        self._insert_usage(job, usage_id)
        return usage_id

    def _existing_analysis(self, job_id: str) -> dict[str, Any] | None:
        rows = self.client.request(
            f"profile_analysis?select=id&job_id=eq.{job_id}&limit=1",
        )
        return _single_row(rows)

    def _finish_succeeded(self, job_id: str) -> None:
        now = _now_iso()
        self._patch_job(job_id, {
            "current_step": "Aguardando sua revisao",
            "finished_at": now,
            "heartbeat_at": now,
            "lease_expires_at": None,
            "progress": 100,
            "status": "succeeded",
            "worker_id": None,
        })

    def _update_usage_after_llm(self, usage_id: str, response: Any) -> None:
        usage = response.usage
        self.client.request(
            f"ai_usage_event?id=eq.{usage_id}",
            method="PATCH",
            payload={
                "api_model": response.model,
                "stripe_response_id": response.response_id or None,
                "finish_reason": response.finish_reason,
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "cached_tokens": usage.cached_tokens,
                "total_tokens": usage.input_tokens + usage.output_tokens + usage.cached_tokens,
                "settlement_status": "captured",
                "updated_at": _now_iso(),
            },
        )

    def _queue_usage_settlement(
        self,
        usage_id: str,
        *,
        analysis_id: str | None,
        feature_meter_status: str,
    ) -> None:
        self.client.request(
            f"ai_usage_event?id=eq.{usage_id}",
            method="PATCH",
            payload={
                "analysis_id": analysis_id,
                "feature_meter_status": feature_meter_status,
                "settlement_status": "pending",
                "updated_at": _now_iso(),
            },
        )

    def _mark_usage_failed(self, usage_id: str, error: Exception) -> None:
        self.client.request(
            f"ai_usage_event?id=eq.{usage_id}",
            method="PATCH",
            payload={
                "settlement_error": str(error)[:500],
                "settlement_status": "failed",
                "updated_at": _now_iso(),
            },
        )

    def _document_for_job(self, job: dict[str, Any]) -> SourceDocument:
        raw = self.client.download_storage_object(PROFILE_DOCUMENT_BUCKET, job["document_path"])
        suffix = {
            "application/pdf": ".pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
            "text/plain": ".txt",
        }.get(job["document_mime_type"])
        if not suffix:
            raise ProfileAnalysisError("Job possui MIME type nao suportado")
        with tempfile.TemporaryDirectory(prefix="10xvagas-profile-job-") as temporary_dir:
            path = Path(temporary_dir) / f"document{suffix}"
            path.write_bytes(raw)
            parsed = read_document(path)
        return SourceDocument(
            name=job["document_name"],
            content=parsed.content,
            sha256=parsed.sha256,
            truncated=parsed.truncated,
        )

    def process(self, job: dict[str, Any]) -> None:
        job_id = str(job["id"])
        usage_id = ""
        usage_inserted = False
        usage_captured = False
        try:
            if self._is_cancel_requested(job_id):
                self._cancel(job_id)
                return
            existing_analysis = self._existing_analysis(job_id)
            if existing_analysis:
                usage_id = self._usage_id_for_job(job)
                self._queue_usage_settlement(
                    usage_id,
                    analysis_id=str(existing_analysis["id"]),
                    feature_meter_status="pending",
                )
                self._finish_succeeded(job_id)
                return
            self._heartbeat(job_id, 15, "Extraindo documento")
            document = self._document_for_job(job)
            if self._is_cancel_requested(job_id):
                self._cancel(job_id)
                return

            self._heartbeat(job_id, 35, "Preparando contexto")
            active_profile = self._active_profile(job["user_id"])
            desired_overrides = [
                f"{item['name']}:{item['priority']}"
                for item in job["preferences"].get("desiredSkills", [])
            ]
            deterministic = apply_declared_preferences(
                build_deterministic_draft(active_profile, [document], desired_overrides),
                job["preferences"],
            )
            prompt = build_profile_analysis_prompt(
                deterministic_draft=deterministic,
                document=document,
                preferences=job["preferences"],
            )
            model = get_selectable_model(job["model_id"])
            if not model:
                raise ProfileAnalysisError("Modelo do job nao esta disponivel para novas analises")

            usage_id = self._usage_id_for_job(job)
            usage_inserted = True
            self._heartbeat(job_id, 50, "Analisando perfil e curriculo")
            response = self.gateway.call_structured(
                idempotency_key=f"10xvagas_profile_{usage_id}",
                model=model,
                prompt=prompt,
                schema=self.schema,
            )
            self._update_usage_after_llm(usage_id, response)
            usage_captured = True
            validate_analysis_response(response.arguments, self.schema)
            if self._is_cancel_requested(job_id):
                self._cancel(job_id)
                return

            self._heartbeat(job_id, 85, "Preparando rascunho")
            draft = merge_profile_proposal(
                deterministic,
                response.arguments["canonical_profile_draft"],
                skills_evidenced=response.arguments["skills_evidenced"],
                support_skills_evidenced=response.arguments["support_skills_evidenced"],
                warnings=response.arguments["warnings"],
                mode="stripe_llm_gateway",
                extra_metadata={
                    "api_model": response.model,
                    "prompt_version": PROMPT_VERSION,
                    "stripe_response_id": response.response_id,
                },
            )
            persisted = self.client.request(
                "profile_analysis?on_conflict=job_id",
                method="POST",
                prefer="resolution=merge-duplicates,return=representation",
                payload={
                    "user_id": job["user_id"],
                    "job_id": job_id,
                    "model_id": job["model_id"],
                    "prompt_version": PROMPT_VERSION,
                    "canonical_profile_draft": draft,
                    "cv_assessment": response.arguments["cv_assessment"],
                    "source_evidence": response.arguments["source_evidence"],
                    "pending_questions": response.arguments["pending_questions"],
                },
            )
            analysis = _single_row(persisted)
            if not analysis or not isinstance(analysis.get("id"), str):
                raise ProfileAnalysisError("Nao foi possivel confirmar a analise persistida")
            self._queue_usage_settlement(
                usage_id,
                analysis_id=analysis["id"],
                feature_meter_status="pending",
            )
            self._finish_succeeded(job_id)
        except (ProfileAnalysisError, ProfileImportError, StripeGatewayError, SupabaseRestError) as error:
            if usage_inserted and not usage_captured:
                try:
                    self._mark_usage_failed(usage_id, error)
                except SupabaseRestError:
                    pass
            elif usage_captured:
                try:
                    self._queue_usage_settlement(
                        usage_id,
                        analysis_id=None,
                        feature_meter_status="not_applicable",
                    )
                except SupabaseRestError:
                    pass
            self._fail(job_id, error)
        except Exception as error:  # noqa: BLE001 - fronteira do worker precisa encerrar o job
            safe_error = ProfileAnalysisError(f"Falha inesperada: {type(error).__name__}")
            if usage_inserted and not usage_captured:
                try:
                    self._mark_usage_failed(usage_id, safe_error)
                except SupabaseRestError:
                    pass
            elif usage_captured:
                try:
                    self._queue_usage_settlement(
                        usage_id,
                        analysis_id=None,
                        feature_meter_status="not_applicable",
                    )
                except SupabaseRestError:
                    pass
            self._fail(job_id, safe_error)

    def _fail(self, job_id: str, error: Exception) -> None:
        now = _now_iso()
        try:
            self._patch_job(job_id, {
                "current_step": None,
                "error_code": type(error).__name__,
                "error_message": str(error)[:500],
                "finished_at": now,
                "lease_expires_at": None,
                "status": "failed",
                "worker_id": None,
            })
        except SupabaseRestError as update_error:
            print(f"[profile-worker] nao foi possivel encerrar job={job_id}: {update_error}")

    def run_once(self) -> bool:
        job = self.claim()
        if not job:
            return False
        self.process(job)
        return True


def _now_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _future_iso(seconds: int) -> str:
    from datetime import datetime, timedelta, timezone

    return (datetime.now(timezone.utc) + timedelta(seconds=seconds)).isoformat()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Processa jobs de analise de Perfil Canonico.")
    parser.add_argument("--once", action="store_true", help="Tenta processar um job e encerra.")
    parser.add_argument("--poll-seconds", type=float, default=POLL_SECONDS)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    health_server = None
    port = os.environ.get("PORT", "").strip()
    if port and not args.once:
        health_server = start_health_server(int(port))
    worker = ProfileAnalysisWorker(SupabaseRestClient.from_env(), StripeLlmGateway.from_env())
    if args.once:
        return 0 if worker.run_once() else 3
    while True:
        try:
            processed = worker.run_once()
        except SupabaseRestError as error:
            print(f"[profile-worker] fila indisponivel: {error}")
            processed = False
        if not processed:
            time.sleep(max(0.5, min(args.poll_seconds, 30.0)))


if __name__ == "__main__":
    raise SystemExit(main())
