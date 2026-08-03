from __future__ import annotations

import csv
import hashlib
import json
import os
import sys
from dataclasses import asdict
from pathlib import Path
from typing import Any

if __package__:
    from engine.supabase_rest import SupabaseRestClient
    from .matcher import load_json, rank_jobs
else:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from engine.supabase_rest import SupabaseRestClient
    from engine.experiment.matcher import load_json, rank_jobs


BASE_DIR = Path(__file__).resolve().parent
PROFILE_PATH = BASE_DIR / "data" / "canonical-profile.json"
JOBS_PATH = BASE_DIR / "data" / "jobs.json"
CONFIG_PATH = BASE_DIR / "config" / "matching-weights.json"
OUTPUT_DIR = BASE_DIR / "output"
SYSTEM_RANKING_PATH = OUTPUT_DIR / "system-ranking.json"
HUMAN_RANKING_PATH = OUTPUT_DIR / "human-ranking.csv"


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def neutral_job_order(jobs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        jobs,
        key=lambda job: hashlib.sha256(
            f"10xjobs-blind-v1:{job['id']}".encode()
        ).hexdigest(),
    )


def build_system_ranking() -> dict[str, Any]:
    profile = load_json(PROFILE_PATH)
    jobs_document = load_json(JOBS_PATH)
    config = load_json(CONFIG_PATH)
    ranked = rank_jobs(profile, jobs_document["jobs"], config)
    ranking = []
    for position, (job, result) in enumerate(ranked, start=1):
        ranking.append(
            {
                "rank": position,
                "id": job["id"],
                "market": job["market"],
                "company": job["company"],
                "title": job["title"],
                "source_url": job["source_url"],
                "skills": job["required_skills"],
                **asdict(result),
            }
        )
    return {
        "schema_version": 1,
        "generated_from_snapshot": jobs_document["collected_at"],
        "warning": "Para preservar o teste cego, nao abra este arquivo antes de concluir human-ranking.csv.",
        "input_hashes": {
            "canonical_profile_sha256": file_sha256(PROFILE_PATH),
            "jobs_sha256": file_sha256(JOBS_PATH),
            "matching_config_sha256": file_sha256(CONFIG_PATH),
        },
        "evaluation": config["evaluation"],
        "ranking": ranking,
    }


def write_system_ranking(document: dict[str, Any]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    SYSTEM_RANKING_PATH.write_text(
        json.dumps(document, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def persist_system_ranking(
    document: dict[str, Any],
    user_id: str,
    client: SupabaseRestClient | None = None,
) -> int:
    rest = client or SupabaseRestClient.from_env()
    job_rows = rest.request("job?select=id%2Csource_url")
    if not isinstance(job_rows, list):
        return 0
    ids_by_url = {
        row["source_url"].rstrip("/").casefold(): row["id"]
        for row in job_rows
        if isinstance(row, dict) and isinstance(row.get("id"), str) and isinstance(row.get("source_url"), str)
    }
    matches = []
    for item in document["ranking"]:
        job_id = ids_by_url.get(item["source_url"].rstrip("/").casefold())
        if not job_id:
            continue
        matches.append(
            {
                "user_id": user_id,
                "job_id": job_id,
                "score": item["score"],
                "rank": item["rank"],
                "excluded": item["excluded"],
                "reasons": item["reasons"],
                "gaps": item["gaps"],
                "skills": item["skills"],
            }
        )
    if not matches:
        return 0
    result = rest.request(
        "job_match?on_conflict=user_id%2Cjob_id",
        method="POST",
        payload=matches,
        prefer="resolution=merge-duplicates,return=representation,missing=default",
    )
    return len(result) if isinstance(result, list) else 0


def write_human_ranking(jobs: list[dict[str, Any]], overwrite: bool = False) -> None:
    if HUMAN_RANKING_PATH.exists() and not overwrite:
        return
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "rank",
        "id",
        "market",
        "company",
        "title",
        "location",
        "employment_type",
        "salary_original",
        "required_skills",
        "preferred_skills",
        "summary",
        "source_url",
        "notes",
    ]
    with HUMAN_RANKING_PATH.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        for job in neutral_job_order(jobs):
            salary = job["salary_original"]
            writer.writerow(
                {
                    "rank": "",
                    "id": job["id"],
                    "market": job["market"],
                    "company": job["company"],
                    "title": job["title"],
                    "location": job["location"]["display"],
                    "employment_type": job["employment_type"],
                    "salary_original": "" if salary is None else salary["raw"],
                    "required_skills": " | ".join(job["required_skills"]),
                    "preferred_skills": " | ".join(job["preferred_skills"]),
                    "summary": job["summary"],
                    "source_url": job["source_url"],
                    "notes": "",
                }
            )


def main() -> None:
    jobs_document = load_json(JOBS_PATH)
    system_ranking = build_system_ranking()
    write_system_ranking(system_ranking)
    write_human_ranking(jobs_document["jobs"])
    match_user_id = os.environ.get("MATCH_USER_ID", "").strip()
    if match_user_id:
        persisted = persist_system_ranking(system_ranking, match_user_id)
        print(f"Matches persistidos no Supabase: {persisted}")
    print(f"Ranking do sistema: {SYSTEM_RANKING_PATH}")
    print(f"Planilha cega: {HUMAN_RANKING_PATH}")
    print("Preencha rank de 1 a 30 sem abrir o ranking do sistema.")


if __name__ == "__main__":
    main()
