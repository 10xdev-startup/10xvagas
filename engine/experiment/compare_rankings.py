from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


BASE_DIR = Path(__file__).resolve().parent
DEFAULT_HUMAN_PATH = BASE_DIR / "output" / "human-ranking.csv"
DEFAULT_SYSTEM_PATH = BASE_DIR / "output" / "system-ranking.json"
DEFAULT_REPORT_PATH = BASE_DIR / "output" / "comparison-report.json"


def load_human_ranking(path: Path) -> list[str]:
    with path.open(encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))
    if not rows:
        raise ValueError("O ranking humano esta vazio.")
    parsed: list[tuple[int, str]] = []
    for row_number, row in enumerate(rows, start=2):
        rank_value = (row.get("rank") or "").strip()
        job_id = (row.get("id") or "").strip()
        if not rank_value:
            raise ValueError(f"Preencha o rank na linha {row_number} ({job_id}).")
        try:
            rank = int(rank_value)
        except ValueError as error:
            raise ValueError(
                f"Rank invalido na linha {row_number}: {rank_value!r}."
            ) from error
        parsed.append((rank, job_id))
    expected_ranks = set(range(1, len(rows) + 1))
    actual_ranks = {rank for rank, _ in parsed}
    if len(actual_ranks) != len(parsed) or actual_ranks != expected_ranks:
        raise ValueError(
            f"Use cada rank de 1 a {len(rows)} exatamente uma vez."
        )
    job_ids = [job_id for _, job_id in parsed]
    if len(set(job_ids)) != len(job_ids):
        raise ValueError("O ranking humano contem ID de vaga duplicado.")
    return [job_id for _, job_id in sorted(parsed)]


def load_system_document(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def rank_biased_overlap(first: list[str], second: list[str], persistence: float) -> float:
    depth = min(len(first), len(second))
    weighted_overlap = 0.0
    first_seen: set[str] = set()
    second_seen: set[str] = set()
    overlap = 0
    for index in range(depth):
        first_seen.add(first[index])
        second_seen.add(second[index])
        overlap = len(first_seen & second_seen)
        agreement = overlap / (index + 1)
        weighted_overlap += agreement * (persistence**index)
    extrapolated = (overlap / depth) * (persistence**depth)
    return (1 - persistence) * weighted_overlap + extrapolated


def compare(human_ranking: list[str], system_document: dict[str, Any]) -> dict[str, Any]:
    system_ranking = [item["id"] for item in system_document["ranking"]]
    if set(human_ranking) != set(system_ranking):
        missing = sorted(set(system_ranking) - set(human_ranking))
        unknown = sorted(set(human_ranking) - set(system_ranking))
        raise ValueError(
            f"IDs divergentes. Ausentes no humano: {missing}; desconhecidos: {unknown}."
        )
    evaluation = system_document["evaluation"]
    top_k = int(evaluation["top_k"])
    minimum_overlap = int(evaluation["minimum_overlap"])
    human_top = human_ranking[:top_k]
    system_top = system_ranking[:top_k]
    common = [job_id for job_id in human_top if job_id in set(system_top)]
    overlap = len(common)
    return {
        "metric": f"top_{top_k}_set_overlap",
        "overlap": overlap,
        "target": minimum_overlap,
        "passed": overlap >= minimum_overlap,
        "human_top": human_top,
        "system_top": system_top,
        "common_jobs_in_human_order": common,
        "missing_from_system_top": [
            job_id for job_id in human_top if job_id not in set(system_top)
        ],
        "unexpected_in_system_top": [
            job_id for job_id in system_top if job_id not in set(human_top)
        ],
        "rank_biased_overlap": round(
            rank_biased_overlap(
                human_ranking, system_ranking, float(evaluation["rbo_p"])
            ),
            4,
        ),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Compara o ranking humano cego com o ranking do 10xVagas."
    )
    parser.add_argument("--human", type=Path, default=DEFAULT_HUMAN_PATH)
    parser.add_argument("--system", type=Path, default=DEFAULT_SYSTEM_PATH)
    parser.add_argument("--output", type=Path, default=DEFAULT_REPORT_PATH)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    try:
        human_ranking = load_human_ranking(args.human)
        system_document = load_system_document(args.system)
        report = compare(human_ranking, system_document)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as error:
        raise SystemExit(f"Nao foi possivel comparar: {error}") from error
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    status = "APROVADO" if report["passed"] else "REPROVADO"
    print(
        f"{status}: {report['overlap']}/{report['target']} vagas em comum no top 10 minimo."
    )
    print(f"Relatorio: {args.output}")


if __name__ == "__main__":
    main()
