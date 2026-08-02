from __future__ import annotations

from typing import Any
from urllib.parse import quote

from engine.sources.http import fetch_json
from engine.sources.models import SourceAdapter, SourceConfig, SourceJob
from engine.sources.text import coerce_text, html_to_text


class LeverAdapter(SourceAdapter):
    source_type = "lever"

    def fetch(self, config: SourceConfig) -> list[SourceJob]:
        jobs: list[SourceJob] = []
        for site in config.settings.get("sites", []):
            url = f"https://api.lever.co/v0/postings/{quote(site['slug'])}?mode=json"
            payload = fetch_json(url)
            jobs.extend(self.parse(payload, config, site["company"]))
        return jobs

    def parse(
        self,
        payload: list[dict[str, Any]],
        config: SourceConfig,
        company: str,
    ) -> list[SourceJob]:
        jobs: list[SourceJob] = []
        for item in payload or []:
            categories = item.get("categories") or {}
            location = coerce_text(categories.get("location"), "Nao informado")
            country = coerce_text(item.get("country")).casefold()
            salary = item.get("salaryRange") or {}
            salary_raw = None
            if salary:
                salary_raw = (
                    f"{salary.get('currency', '')} {salary.get('min', '')}–"
                    f"{salary.get('max', '')} / {salary.get('interval', '')}"
                ).strip()
            jobs.append(
                SourceJob(
                    external_id=str(item.get("id", "")),
                    source=config.id,
                    source_label=config.label,
                    title=coerce_text(item.get("text")),
                    company=company,
                    source_url=coerce_text(item.get("hostedUrl")),
                    apply_url=item.get("applyUrl"),
                    description=coerce_text(item.get("descriptionPlain"))
                    or html_to_text(coerce_text(item.get("description"))),
                    location=location,
                    workplace_type=coerce_text(item.get("workplaceType"), "unspecified"),
                    employment_type=categories.get("commitment"),
                    published_at=None,
                    salary_raw=salary_raw,
                    market="brazil" if country in {"br", "bra"} else "international",
                )
            )
        return jobs
