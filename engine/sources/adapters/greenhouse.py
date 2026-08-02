from __future__ import annotations

from typing import Any
from urllib.parse import quote

from engine.sources.http import fetch_json
from engine.sources.models import SourceAdapter, SourceConfig, SourceJob
from engine.sources.text import coerce_text, html_to_text


class GreenhouseAdapter(SourceAdapter):
    source_type = "greenhouse"

    def fetch(self, config: SourceConfig) -> list[SourceJob]:
        jobs: list[SourceJob] = []
        for board in config.settings.get("boards", []):
            url = f"https://boards-api.greenhouse.io/v1/boards/{quote(board['token'])}/jobs?content=true"
            payload = fetch_json(url)
            jobs.extend(self.parse(payload, config, board["company"]))
        return jobs

    def parse(
        self,
        payload: dict[str, Any],
        config: SourceConfig,
        company: str,
    ) -> list[SourceJob]:
        jobs: list[SourceJob] = []
        for item in payload.get("jobs", []) or []:
            location_container = item.get("location") or {}
            location = coerce_text(location_container.get("name"), "Nao informado")
            location_key = location.casefold()
            absolute_url = coerce_text(item.get("absolute_url"))
            jobs.append(
                SourceJob(
                    external_id=coerce_text(item.get("id")),
                    source=config.id,
                    source_label=config.label,
                    title=coerce_text(item.get("title")),
                    company=company,
                    source_url=absolute_url,
                    apply_url=absolute_url or None,
                    description=html_to_text(item.get("content")),
                    location=location,
                    workplace_type="remote" if "remote" in location_key else "unspecified",
                    employment_type=None,
                    published_at=item.get("updated_at"),
                    salary_raw=None,
                    market="brazil" if "brazil" in location_key or "brasil" in location_key else "international",
                )
            )
        return jobs
