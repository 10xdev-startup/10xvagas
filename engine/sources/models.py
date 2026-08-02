from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import asdict, dataclass
from typing import Any


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

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class SourceAdapter(ABC):
    source_type: str

    @abstractmethod
    def fetch(self, config: SourceConfig) -> list[SourceJob]:
        """Busca vagas publicadas e devolve o contrato normalizado."""
