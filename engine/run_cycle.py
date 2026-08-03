from __future__ import annotations

from engine.matching.live import match_all_users
from engine.sources.collect import collect, record_source_runs, upsert_jobs
from engine.supabase_rest import SupabaseRestClient


def run_cycle(client: SupabaseRestClient | None = None) -> dict[str, int]:
    rest = client or SupabaseRestClient.from_env()
    document = collect()
    jobs = upsert_jobs(document["jobs"], document["collected_at"], rest)
    source_runs = record_source_runs(document["sources"], document["collected_at"], rest)
    matching = match_all_users(rest)
    return {
        "jobs": len(jobs),
        "source_runs": source_runs,
        "users": matching["users"],
        "matches": matching["matches"],
        "failed_users": matching["failed_users"],
    }


def main() -> None:
    result = run_cycle()
    print(
        "Ciclo concluido: "
        f"{result['jobs']} vagas, {result['source_runs']} fontes, "
        f"{result['matches']} matches para {result['users']} usuario(s)."
    )
    if result["failed_users"]:
        raise RuntimeError(
            f"Ciclo incompleto: {result['failed_users']} perfil(is) invalido(s)."
        )


if __name__ == "__main__":
    main()
