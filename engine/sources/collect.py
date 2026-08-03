from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import uuid4

from engine.supabase_rest import SupabaseRestClient
from engine.sources.adapters import AshbyAdapter, GreenhouseAdapter, LeverAdapter, RemotiveAdapter
from engine.sources.models import SourceAdapter, SourceConfig, SourceJob


BASE_DIR = Path(__file__).resolve().parent
REGISTRY_PATH = BASE_DIR / "registry.json"

ADAPTERS: dict[str, SourceAdapter] = {
    adapter.source_type: adapter
    for adapter in [AshbyAdapter(), GreenhouseAdapter(), LeverAdapter(), RemotiveAdapter()]
}

ROLE_TERMS = {
    "ai engineer",
    "backend developer",
    "backend engineer",
    "developer",
    "desenvolvedor",
    "devops engineer",
    "frontend developer",
    "frontend engineer",
    "full stack",
    "fullstack",
    "llm engineer",
    "machine learning engineer",
    "node.js",
    "product engineer",
    "python",
    "react",
    "software developer",
    "software engineer",
    "typescript",
}

ELIGIBLE_REMOTE_TERMS = {
    "americas",
    "anywhere",
    "brazil",
    "brasil",
    "global",
    "latam",
    "south america",
    "worldwide",
}

EXCLUDED_ROLE_TERMS = {
    "customer support",
    "engineering manager",
    "help desk",
    "helpdesk",
    "service desk",
    "support engineer",
    "technical support",
}


def load_registry() -> list[SourceConfig]:
    document = json.loads(REGISTRY_PATH.read_text(encoding="utf-8"))
    return [SourceConfig(**item) for item in document["sources"]]


def is_relevant(job: SourceJob) -> bool:
    title = job.title.casefold()
    if any(term in title for term in EXCLUDED_ROLE_TERMS):
        return False
    if not any(term in title for term in ROLE_TERMS):
        return False
    if job.market == "brazil":
        return True
    if job.workplace_type.casefold() != "remote":
        return False
    location = job.location.casefold()
    eligibility_text = f"{title} {location}"
    return location.strip() == "remote" or any(
        term in eligibility_text for term in ELIGIBLE_REMOTE_TERMS
    )


def deduplicate(jobs: list[SourceJob]) -> list[SourceJob]:
    unique: dict[str, SourceJob] = {}
    for job in jobs:
        key = job.source_url.rstrip("/").casefold()
        if key and key not in unique:
            unique[key] = job
    return list(unique.values())


def collect() -> dict[str, Any]:
    collected_jobs: list[SourceJob] = []
    source_runs: list[dict[str, Any]] = []
    for config in load_registry():
        if not config.enabled or config.mode != "automatic":
            source_runs.append(
                {"id": config.id, "label": config.label, "mode": config.mode, "status": "assisted", "count": 0}
            )
            continue
        adapter = ADAPTERS.get(config.type)
        if adapter is None:
            source_runs.append(
                {"id": config.id, "label": config.label, "mode": config.mode, "status": "unsupported", "count": 0}
            )
            continue
        try:
            jobs = [job for job in adapter.fetch(config) if is_relevant(job)]
            collected_jobs.extend(jobs)
            source_runs.append(
                {"id": config.id, "label": config.label, "mode": config.mode, "status": "ok", "count": len(jobs)}
            )
        except Exception as error:
            source_runs.append(
                {
                    "id": config.id,
                    "label": config.label,
                    "mode": config.mode,
                    "status": "error",
                    "count": 0,
                    "error": str(error),
                }
            )

    jobs = deduplicate(collected_jobs)
    jobs.sort(key=lambda job: job.published_at or "", reverse=True)
    return {
        "schema_version": 1,
        "collected_at": datetime.now(UTC).isoformat(),
        "sources": source_runs,
        "jobs": [job.to_dict() for job in jobs[:120]],
    }


def upsert_jobs(
    jobs: list[dict[str, Any]],
    collected_at: str,
    client: SupabaseRestClient | None = None,
) -> list[dict[str, Any]]:
    if not jobs:
        return []
    rest = client or SupabaseRestClient.from_env()
    payload = [{**job, "last_seen_at": collected_at} for job in jobs]
    result = rest.request(
        "job?on_conflict=source%2Cexternal_id",
        method="POST",
        payload=payload,
        prefer="resolution=merge-duplicates,return=representation,missing=default",
    )
    return result if isinstance(result, list) else []


def record_source_runs(
    sources: list[dict[str, Any]],
    collected_at: str,
    client: SupabaseRestClient | None = None,
    run_id: str | None = None,
) -> int:
    if not sources:
        return 0
    rest = client or SupabaseRestClient.from_env()
    cycle_id = run_id or str(uuid4())
    payload = [
        {
            "run_id": cycle_id,
            "source_id": source["id"],
            "source_label": source["label"],
            "mode": source["mode"],
            "status": source["status"],
            "job_count": source["count"],
            "error_message": str(source["error"])[:1000] if source.get("error") else None,
            "collected_at": collected_at,
        }
        for source in sources
    ]
    rest.request(
        "source_run",
        method="POST",
        payload=payload,
        prefer="return=minimal",
    )
    return len(payload)


def main() -> None:
    document = collect()
    persisted = upsert_jobs(document["jobs"], document["collected_at"])
    recorded_sources = record_source_runs(document["sources"], document["collected_at"])
    print(f"Supabase atualizado: {len(persisted)} vagas")
    print(f"Execucoes de fonte registradas: {recorded_sources}")
    for source in document["sources"]:
        print(f"- {source['label']}: {source['status']} ({source['count']})")


if __name__ == "__main__":
    main()
