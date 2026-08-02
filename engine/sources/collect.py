from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from engine.sources.adapters import AshbyAdapter, GreenhouseAdapter, LeverAdapter, RemotiveAdapter
from engine.sources.models import SourceAdapter, SourceConfig, SourceJob


BASE_DIR = Path(__file__).resolve().parent
REGISTRY_PATH = BASE_DIR / "registry.json"
OUTPUT_PATH = BASE_DIR / "output" / "live-jobs.json"

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


def main() -> None:
    document = collect()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Snapshot ao vivo: {OUTPUT_PATH}")
    for source in document["sources"]:
        print(f"- {source['label']}: {source['status']} ({source['count']})")


if __name__ == "__main__":
    main()
