from __future__ import annotations

from typing import Any

from engine.sources.http import fetch_json
from engine.sources.models import SourceAdapter, SourceConfig, SourceJob
from engine.sources.text import coerce_text, html_to_text


class RemotiveAdapter(SourceAdapter):
    source_type = "remotive"

    def fetch(self, config: SourceConfig) -> list[SourceJob]:
        endpoint = config.settings.get(
            "endpoint",
            "https://remotive.com/api/remote-jobs?category=software-dev",
        )
        return self.parse(fetch_json(endpoint), config)

    def parse(self, payload: dict[str, Any], config: SourceConfig) -> list[SourceJob]:
        jobs: list[SourceJob] = []
        for item in payload.get("jobs", []) or []:
            location = coerce_text(item.get("candidate_required_location"), "Worldwide")
            location_key = location.casefold()
            url = coerce_text(item.get("url"))
            jobs.append(
                SourceJob(
                    external_id=coerce_text(item.get("id")),
                    source=config.id,
                    source_label=config.label,
                    title=coerce_text(item.get("title")),
                    company=coerce_text(item.get("company_name")),
                    source_url=url,
                    apply_url=url or None,
                    description=html_to_text(item.get("description")),
                    location=location,
                    workplace_type="remote",
                    employment_type=item.get("job_type"),
                    published_at=item.get("publication_date"),
                    salary_raw=item.get("salary") or None,
                    market="brazil" if "brazil" in location_key or "brasil" in location_key else "international",
                )
            )
        return jobs
