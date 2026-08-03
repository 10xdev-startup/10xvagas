from __future__ import annotations

import argparse
import json
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from uuid import UUID

from engine.supabase_rest import SupabaseRestClient


DEFAULT_PROFILE = Path(__file__).resolve().parents[1] / "experiment" / "data" / "canonical-profile.json"
REQUIRED_MATCHING_FIELDS = (
    "identity",
    "work_preferences",
    "matching_facts",
    "languages",
    "skills_desired",
    "skills_known",
)


class ProfileSyncError(RuntimeError):
    """Falha acionavel antes de persistir um Perfil Canonico."""


def load_profile(path: Path) -> dict[str, Any]:
    try:
        profile = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ProfileSyncError(f"Perfil Canonico nao encontrado: {path}") from error
    except json.JSONDecodeError as error:
        raise ProfileSyncError(f"Perfil Canonico possui JSON invalido: {path}: {error}") from error
    if not isinstance(profile, dict):
        raise ProfileSyncError("O Perfil Canonico deve ser um objeto JSON.")
    return profile


def validate_profile(profile: dict[str, Any]) -> None:
    missing = [field for field in REQUIRED_MATCHING_FIELDS if not profile.get(field)]
    if missing:
        raise ProfileSyncError(
            "Perfil Canonico incompleto para matching; revise: " + ", ".join(missing)
        )


def sync_profile(
    user_id: str,
    profile: dict[str, Any],
    client: SupabaseRestClient | None = None,
) -> None:
    try:
        UUID(user_id)
    except ValueError as error:
        raise ProfileSyncError("PROFILE_USER_ID deve ser um UUID valido.") from error
    validate_profile(profile)
    rest = client or SupabaseRestClient.from_env()
    rest.request(
        "profile?on_conflict=user_id",
        method="POST",
        payload={
            "user_id": user_id,
            "document": profile,
            "updated_at": datetime.now(UTC).isoformat(),
        },
        prefer="resolution=merge-duplicates,return=minimal,missing=default",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sincroniza um Perfil Canonico revisado com um usuario explicito."
    )
    parser.add_argument("--profile", type=Path, default=DEFAULT_PROFILE)
    parser.add_argument("--user-id", default=os.environ.get("PROFILE_USER_ID", ""))
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    user_id = str(args.user_id).strip()
    if not user_id:
        raise ProfileSyncError(
            "Informe --user-id ou defina PROFILE_USER_ID; o engine nunca escolhe um usuario implicitamente."
        )
    profile = load_profile(args.profile)
    sync_profile(user_id, profile)
    print("Perfil Canonico sincronizado para o usuario informado.")


if __name__ == "__main__":
    main()
