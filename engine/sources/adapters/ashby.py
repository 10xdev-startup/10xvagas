from __future__ import annotations

from typing import Any
from urllib.parse import quote

from engine.sources.http import fetch_json
from engine.sources.models import SourceAdapter, SourceConfig, SourceJob
from engine.sources.text import coerce_text, html_to_text


class AshbyAdapter(SourceAdapter):
    source_type = "ashby"

    def fetch(self, config: SourceConfig) -> list[SourceJob]:
        jobs: list[SourceJob] = []
        for board in config.settings.get("boards", []):
            url = (
                "https://api.ashbyhq.com/posting-api/job-board/"
                f"{quote(board['slug'])}?includeCompensation=true"
            )
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
            if not item.get("isListed", True):
                continue
            address_container = item.get("address") or {}
            address = address_container.get("postalAddress") or {}
            country_value = coerce_text(address.get("addressCountry"))
            country = country_value.casefold()
            location = coerce_text(item.get("location"), "Nao informado")
            if location.casefold() == "remote" and country_value:
                location = f"Remote · {country_value}"
            compensation = item.get("compensation") or {}
            job_url = coerce_text(item.get("jobUrl"))
            jobs.append(
                SourceJob(
                    external_id=job_url.rstrip("/").split("/")[-1],
                    source=config.id,
                    source_label=config.label,
                    title=coerce_text(item.get("title")),
                    company=company,
                    source_url=job_url,
                    apply_url=item.get("applyUrl"),
                    description=coerce_text(item.get("descriptionPlain"))
                    or html_to_text(coerce_text(item.get("descriptionHtml"))),
                    location=location,
                    workplace_type=coerce_text(item.get("workplaceType"), "unspecified").casefold(),
                    employment_type=item.get("employmentType"),
                    published_at=item.get("publishedAt"),
                    salary_raw=compensation.get("compensationTierSummary"),
                    market="brazil" if country in {"br", "bra", "brazil", "brasil"} else "international",
                )
            )
        return jobs
