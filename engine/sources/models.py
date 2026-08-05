from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Any


WORKPLACE_ALIASES = {
    "homeoffice": "remote",
    "hybrid": "hybrid",
    "hybridremote": "hybrid",
    "inoffice": "onsite",
    "office": "onsite",
    "onsite": "onsite",
    "presential": "onsite",
    "remote": "remote",
    "remotefirst": "remote",
    "workfromhome": "remote",
}

EMPLOYMENT_ALIASES = {
    "contract": "contract",
    "contractor": "contract",
    "freelance": "contract",
    "freelancer": "contract",
    "fulltime": "full_time",
    "intern": "internship",
    "internship": "internship",
    "parttime": "part_time",
    "permanent": "full_time",
    "temp": "temporary",
    "temporary": "temporary",
}


def _taxonomy_key(value: str | None) -> str:
    return "".join(character for character in (value or "").casefold() if character.isalpha())


def normalize_workplace_type(value: str | None) -> str:
    return WORKPLACE_ALIASES.get(_taxonomy_key(value), "unknown")


def normalize_employment_type(value: str | None) -> str | None:
    key = _taxonomy_key(value)
    if key in {"", "notinformed", "remote", "unknown", "unspecified"}:
        return None
    return EMPLOYMENT_ALIASES.get(key, "other")


@dataclass(frozen=True)
class SourceConfig:
    id: str
    type: str
    label: str
    mode: str
    enabled: bool
    settings: dict[str, Any]


@dataclass(frozen=True)
class SourceJob:
    external_id: str
    source: str
    source_label: str
    title: str
    company: str
    source_url: str
    apply_url: str | None
    description: str
    location: str
    workplace_type: str
    employment_type: str | None
    published_at: str | None
    salary_raw: str | None
    market: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "workplace_type", normalize_workplace_type(self.workplace_type))
        object.__setattr__(self, "employment_type", normalize_employment_type(self.employment_type))

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class SourceAdapter(ABC):
    source_type: str

    @abstractmethod
    def fetch(self, config: SourceConfig) -> list[SourceJob]:
        """Busca vagas publicadas e devolve o contrato normalizado."""
