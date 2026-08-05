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
from typing import Any, Callable
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from engine.llm.catalog import get_model
from engine.llm.catalog import get_selectable_model
from engine.llm.stripe_gateway import PROFILE_ANALYSIS_TOOL_NAME
from engine.llm.stripe_gateway import StripeGatewayError
from engine.llm.stripe_gateway import StripeLlmGateway
from engine.profile.analysis_context import PROMPT_VERSION, apply_declared_preferences, build_profile_analysis_prompt, empty_canonical_profile
from engine.profile.import_profile import ProfileImportError, SourceDocument, build_deterministic_draft, merge_profile_proposal, read_document
from engine.supabase_rest import SupabaseRestClient, SupabaseRestError

PROFILE_DOCUMENT_BUCKET = "profile-documents"
ANALYSIS_SCHEMA_PATH = Path(__file__).with_name("analysis_schema.json")
LEASE_SECONDS = 300
POLL_SECONDS = 2.0


def _health_handler(readiness_check: Callable[[], bool]) -> type[BaseHTTPRequestHandler]:
    class HealthHandler(BaseHTTPRequestHandler):
        def do_GET(self) -> None:  # noqa: N802 - nome definido pela stdlib
            if self.path not in {"/health", "/ready"}:
                self.send_response(404)
                self.end_headers()
                return
            ready = self.path == "/health" or readiness_check()
            body = b'{"status":"ok"}' if ready else b'{"status":"not_ready"}'
            self.send_response(200 if ready else 503)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, _format: str, *_args: object) -> None:
            return

    return HealthHandler


def start_health_server(port: int, readiness_check: Callable[[], bool]) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("0.0.0.0", port), _health_handler(readiness_check))
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
        "number": lambda item: isinstance(item, (int, float)) and not isinstance(item, bool),
        "object": lambda item: isinstance(item, dict),
        "string": lambda item: isinstance(item, str),
    }
    if expected and not any(type_matches.get(kind, lambda _item: False)(value) for kind in allowed_types):
        raise ProfileAnalysisError(f"Resposta estruturada possui {path} invalido")
    if value is None:
        return
    if "enum" in schema and value not in schema["enum"]:
        raise ProfileAnalysisError(f"Resposta estruturada possui {path} fora do enum")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            raise ProfileAnalysisError(f"Resposta estruturada possui {path} abaixo do minimo")
        if "maximum" in schema and value > schema["maximum"]:
            raise ProfileAnalysisError(f"Resposta estruturada possui {path} acima do maximo")
        if "exclusiveMinimum" in schema and value <= schema["exclusiveMinimum"]:
            raise ProfileAnalysisError(f"Resposta estruturada possui {path} abaixo do minimo exclusivo")
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
        heartbeat_interval_seconds: float | None = None,
        lease_seconds: int = LEASE_SECONDS,
        worker_id: str | None = None,
    ) -> None:
        self.client = client
        self.gateway = gateway
        self.lease_seconds = lease_seconds
        self.heartbeat_interval_seconds = heartbeat_interval_seconds or max(5.0, min(60.0, lease_seconds / 3))
        self.worker_id = worker_id or f"{socket.gethostname()}-{os.getpid()}"
        self.schema = json.loads(ANALYSIS_SCHEMA_PATH.read_text(encoding="utf-8"))

    def claim(self) -> dict[str, Any] | None:
        return _single_row(self.client.rpc(
            "claim_profile_analysis_job",
            {"p_lease_seconds": self.lease_seconds, "p_worker_id": self.worker_id},
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
            "lease_expires_at": _future_iso(self.lease_seconds),
            "progress": progress,
        })

    def _record_event(
        self,
        job: dict[str, Any],
        *,
        event_key: str,
        event_type: str,
        stage: str,
        message: str,
        progress: int,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        safe_metadata = metadata or {}
        try:
            self.client.request(
                "profile_analysis_event?on_conflict=job_id,event_key",
                method="POST",
                prefer="resolution=merge-duplicates,return=minimal",
                payload={
                    "event_key": event_key,
                    "event_type": event_type,
                    "job_id": job["id"],
                    "message": message,
                    "metadata": safe_metadata,
                    "progress": progress,
                    "stage": stage,
                    "user_id": job["user_id"],
                },
            )
        except SupabaseRestError as error:
            print(json.dumps({
                "component": "profile-worker",
                "event": "progress_event_write_failed",
                "job_id": job.get("id"),
                "stage": stage,
                "error": type(error).__name__,
            }, ensure_ascii=False))
            return
        print(json.dumps({
            "component": "profile-worker",
            "event": event_type,
            "job_id": job["id"],
            "message": message,
            "progress": progress,
            "stage": stage,
            **safe_metadata,
        }, ensure_ascii=False))

    def _advance(
        self,
        job: dict[str, Any],
        *,
        event_key: str,
        message: str,
        progress: int,
        stage: str,
        event_type: str = "stage",
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self._heartbeat(str(job["id"]), progress, message)
        self._record_event(
            job,
            event_key=event_key,
            event_type=event_type,
            stage=stage,
            message=message,
            progress=progress,
            metadata=metadata,
        )

    def _is_cancel_requested(self, job_id: str) -> bool:
        rows = self.client.request(
            f"profile_analysis_job?select=status&id=eq.{job_id}&limit=1",
        )
        row = _single_row(rows)
        return bool(row and row.get("status") == "cancel_requested")

    def _cancel(self, job: dict[str, Any]) -> None:
        job_id = str(job["id"])
        now = _now_iso()
        self._patch_job(job_id, {
            "current_step": None,
            "finished_at": now,
            "lease_expires_at": None,
            "progress": 100,
            "status": "cancelled",
            "worker_id": None,
        })
        self._record_event(
            job,
            event_key="cancelled",
            event_type="cancelled",
            stage="cancelled",
            message="Análise cancelada sem alterar seu perfil",
            progress=100,
        )

    def _active_profile(self, user_id: str) -> dict[str, Any]:
        rows = self.client.request(f"profile?select=document&user_id=eq.{user_id}&limit=1")
        row = _single_row(rows)
        document = row.get("document") if row else None
        return copy.deepcopy(document) if isinstance(document, dict) else empty_canonical_profile()

    def _insert_usage(self, job: dict[str, Any], usage_id: str) -> None:
        model = get_model(str(job["model_id"]))
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
                "provider": model.provider if model else "unknown",
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

    def _call_gateway_with_heartbeat(
        self,
        job_id: str,
        *,
        idempotency_key: str,
        model: Any,
        prompt: str,
    ) -> Any:
        stopped = threading.Event()

        def keep_lease() -> None:
            while not stopped.wait(self.heartbeat_interval_seconds):
                try:
                    self._heartbeat(job_id, 55, "Traçando seu posicionamento profissional com IA")
                except SupabaseRestError as error:
                    print(f"[profile-worker] heartbeat falhou job={job_id}: {error}")

        heartbeat = threading.Thread(target=keep_lease, name=f"heartbeat-{job_id}", daemon=True)
        heartbeat.start()
        try:
            return self.gateway.call_structured(
                idempotency_key=idempotency_key,
                model=model,
                prompt=prompt,
                schema=self.schema,
            )
        finally:
            stopped.set()
            heartbeat.join(timeout=max(1.0, self.heartbeat_interval_seconds * 2))

    def _finish_succeeded(self, job: dict[str, Any]) -> None:
        job_id = str(job["id"])
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
        self._record_event(
            job,
            event_key="completed",
            event_type="completed",
            stage="review_ready",
            message="Análise concluída — revise o rascunho antes de ativar",
            progress=100,
        )

    def _update_usage_after_llm(self, usage_id: str, response: Any) -> None:
        usage = response.usage
        self.client.request(
            f"ai_usage_event?id=eq.{usage_id}",
            method="PATCH",
            payload={
                "api_model": response.api_model,
                "stripe_response_id": response.response_id or None,
                "finish_reason": response.finish_reason,
                "model": response.model,
                "provider": response.provider,
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "cached_tokens": usage.cached_tokens,
                # O gateway inclui cached_tokens dentro de input_tokens. Cached e
                # uma decomposicao para rate card, nao uma terceira parcela.
                "total_tokens": usage.input_tokens + usage.output_tokens,
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
                self._cancel(job)
                return
            self._advance(
                job,
                event_key="worker_claimed",
                message="Preparando uma análise segura do seu currículo",
                progress=5,
                stage="preparing",
            )
            existing_analysis = self._existing_analysis(job_id)
            if existing_analysis:
                usage_id = self._usage_id_for_job(job)
                self._queue_usage_settlement(
                    usage_id,
                    analysis_id=str(existing_analysis["id"]),
                    feature_meter_status="pending",
                )
                self._finish_succeeded(job)
                return
            self._advance(
                job,
                event_key="document_extraction",
                message="Lendo e validando o documento",
                progress=15,
                stage="document_extraction",
            )
            document = self._document_for_job(job)
            if self._is_cancel_requested(job_id):
                self._cancel(job)
                return

            self._advance(
                job,
                event_key="context_building",
                message="Organizando experiências, projetos e formação",
                progress=30,
                stage="context_building",
            )
            active_profile = self._active_profile(job["user_id"])
            desired_overrides = [
                f"{item['name']}:{item['priority']}"
                for item in job["preferences"].get("desiredSkills", [])
            ]
            deterministic = apply_declared_preferences(
                build_deterministic_draft(active_profile, [document], desired_overrides),
                job["preferences"],
            )
            self._advance(
                job,
                event_key="skill_intent",
                message="Separando o que você sabe do que quer usar",
                progress=42,
                stage="skill_intent",
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
            self._advance(
                job,
                event_key=f"tool:{PROFILE_ANALYSIS_TOOL_NAME}:requested",
                event_type="tool_call",
                message="Traçando seu posicionamento profissional com IA",
                metadata={"model": model.id, "tool": PROFILE_ANALYSIS_TOOL_NAME},
                progress=55,
                stage="profile_analysis",
            )
            response = self._call_gateway_with_heartbeat(
                job_id,
                idempotency_key=f"10xvagas_profile_{usage_id}",
                model=model,
                prompt=prompt,
            )
            self._update_usage_after_llm(usage_id, response)
            usage_captured = True
            self._advance(
                job,
                event_key=f"tool:{PROFILE_ANALYSIS_TOOL_NAME}:completed",
                event_type="tool_result",
                message="Análise estruturada recebida e pronta para conferência",
                metadata={"model": response.model, "tool": response.tool_name},
                progress=76,
                stage="evidence_review",
            )
            validate_analysis_response(response.arguments, self.schema)
            if self._is_cancel_requested(job_id):
                self._cancel(job)
                return

            self._advance(
                job,
                event_key="draft_building",
                message="Conferindo evidências, gaps e possíveis contradições",
                progress=86,
                stage="draft_building",
            )
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
            self._advance(
                job,
                event_key="matching_ready",
                message="Preparando o perfil que encontrará vagas compatíveis",
                progress=95,
                stage="matching_ready",
            )
            self._finish_succeeded(job)
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
            self._fail(job, error)
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
            self._fail(job, safe_error)

    def _fail(self, job: dict[str, Any], error: Exception) -> None:
        job_id = str(job["id"])
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
            self._record_event(
                job,
                event_key="failed",
                event_type="failed",
                stage="failed",
                message="Não foi possível concluir esta análise",
                progress=int(job.get("progress") or 0),
                metadata={"error_code": type(error).__name__},
            )
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
    client = SupabaseRestClient.from_env()
    worker = ProfileAnalysisWorker(client, StripeLlmGateway.from_env())
    health_server = None
    port = os.environ.get("PORT", "").strip()
    if port and not args.once:
        def ready() -> bool:
            try:
                client.request("profile_analysis_job?select=id&limit=1")
                return True
            except SupabaseRestError:
                return False

        health_server = start_health_server(int(port), ready)
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
