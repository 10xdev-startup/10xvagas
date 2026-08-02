from __future__ import annotations

import unittest

from engine.sources.adapters import AshbyAdapter, GreenhouseAdapter, LeverAdapter, RemotiveAdapter
from engine.sources.collect import deduplicate, is_relevant
from engine.sources.models import SourceConfig


def config(source_id: str, source_type: str, label: str) -> SourceConfig:
    return SourceConfig(
        id=source_id,
        type=source_type,
        label=label,
        mode="automatic",
        enabled=True,
        settings={},
    )


class AdapterContractTest(unittest.TestCase):
    def test_ashby_preserves_plain_description_and_workplace(self) -> None:
        payload = {
            "jobs": [
                {
                    "title": "Software Engineer",
                    "location": "LATAM Remote",
                    "isListed": True,
                    "isRemote": True,
                    "workplaceType": "Remote",
                    "descriptionPlain": "Build a TypeScript product.",
                    "publishedAt": "2026-08-01T10:00:00Z",
                    "employmentType": "FullTime",
                    "jobUrl": "https://jobs.ashbyhq.com/example/job-1",
                    "applyUrl": "https://jobs.ashbyhq.com/example/job-1/apply",
                    "address": {"postalAddress": {"addressCountry": "Brazil"}},
                    "compensation": {"compensationTierSummary": "USD 70k–90k"},
                }
            ]
        }
        job = AshbyAdapter().parse(payload, config("ashby", "ashby", "Ashby"), "Example")[0]
        self.assertEqual(job.description, "Build a TypeScript product.")
        self.assertEqual(job.workplace_type, "remote")
        self.assertEqual(job.market, "brazil")

    def test_greenhouse_converts_description_html_to_text(self) -> None:
        payload = {
            "jobs": [
                {
                    "id": 42,
                    "title": "Backend Developer",
                    "absolute_url": "https://boards.greenhouse.io/example/jobs/42",
                    "location": {"name": "Brazil - Remote"},
                    "content": "<p>Build <strong>APIs</strong>.</p>",
                    "updated_at": "2026-08-01T10:00:00Z",
                }
            ]
        }
        job = GreenhouseAdapter().parse(
            payload,
            config("greenhouse", "greenhouse", "Greenhouse"),
            "Example",
        )[0]
        self.assertEqual(job.description, "Build\nAPIs\n.")
        self.assertEqual(job.market, "brazil")

    def test_lever_preserves_salary_and_description(self) -> None:
        payload = [
            {
                "id": "job-1",
                "text": "Full Stack Engineer",
                "descriptionPlain": "Own the product end to end.",
                "hostedUrl": "https://jobs.lever.co/example/job-1",
                "applyUrl": "https://jobs.lever.co/example/job-1/apply",
                "workplaceType": "remote",
                "country": "BR",
                "categories": {"location": "Brazil", "commitment": "Full-time"},
                "salaryRange": {"currency": "USD", "min": 60000, "max": 80000, "interval": "year"},
            }
        ]
        job = LeverAdapter().parse(payload, config("lever", "lever", "Lever"), "Example")[0]
        self.assertIn("60000", job.salary_raw or "")
        self.assertEqual(job.description, "Own the product end to end.")

    def test_remotive_converts_html_and_filters_location(self) -> None:
        payload = {
            "jobs": [
                {
                    "id": 1,
                    "title": "Node.js Developer",
                    "company_name": "Example",
                    "url": "https://remotive.com/jobs/1",
                    "description": "<p>Build APIs.</p>",
                    "candidate_required_location": "LATAM",
                    "job_type": "full_time",
                    "publication_date": "2026-08-01T10:00:00Z",
                    "salary": "USD 70k",
                }
            ]
        }
        job = RemotiveAdapter().parse(payload, config("remotive", "remotive", "Remotive"))[0]
        self.assertTrue(is_relevant(job))
        self.assertEqual(job.description, "Build APIs.")

    def test_deduplication_uses_canonical_source_url(self) -> None:
        payload = {
            "jobs": [
                {
                    "id": 1,
                    "title": "Node.js Developer",
                    "company_name": "Example",
                    "url": "https://remotive.com/jobs/1",
                    "description": "Build APIs.",
                    "candidate_required_location": "LATAM",
                    "job_type": "full_time",
                    "publication_date": None,
                    "salary": "",
                }
            ]
        }
        job = RemotiveAdapter().parse(payload, config("remotive", "remotive", "Remotive"))[0]
        self.assertEqual(len(deduplicate([job, job])), 1)

    def test_support_role_never_enters_discovery(self) -> None:
        payload = {
            "jobs": [
                {
                    "id": 2,
                    "title": "Technical Support Engineer",
                    "company_name": "Example",
                    "url": "https://remotive.com/jobs/2",
                    "description": "Support Office 365 users.",
                    "candidate_required_location": "Worldwide",
                    "job_type": "full_time",
                    "publication_date": None,
                    "salary": "",
                }
            ]
        }
        job = RemotiveAdapter().parse(payload, config("remotive", "remotive", "Remotive"))[0]
        self.assertFalse(is_relevant(job))


if __name__ == "__main__":
    unittest.main()


class AdapterNullSafetyTest(unittest.TestCase):
    """Fontes reais mandam `null` explicito — o default do dict.get nao cobre."""

    def test_greenhouse_survives_null_location(self) -> None:
        payload = {"jobs": [{"id": 1, "title": "Dev", "location": None, "absolute_url": None}]}
        jobs = GreenhouseAdapter().parse(payload, config("gh", "greenhouse", "GH"), "Acme")
        self.assertEqual(jobs[0].location, "Nao informado")
        self.assertIsNone(jobs[0].apply_url)

    def test_ashby_survives_null_location_and_job_url(self) -> None:
        payload = {"jobs": [{"title": "Dev", "location": None, "jobUrl": None, "isListed": True}]}
        jobs = AshbyAdapter().parse(payload, config("ab", "ashby", "AB"), "Acme")
        self.assertEqual(jobs[0].location, "Nao informado")
        self.assertEqual(jobs[0].source_url, "")

    def test_remotive_survives_null_location(self) -> None:
        payload = {"jobs": [{"id": 7, "title": "Dev", "candidate_required_location": None}]}
        jobs = RemotiveAdapter().parse(payload, config("rm", "remotive", "RM"))
        self.assertEqual(jobs[0].location, "Worldwide")

    def test_lever_survives_null_categories_and_falls_back_to_html(self) -> None:
        payload = [{"id": "x", "text": "Dev", "categories": None, "description": "<p>Ola</p>"}]
        jobs = LeverAdapter().parse(payload, config("lv", "lever", "LV"), "Acme")
        self.assertEqual(jobs[0].location, "Nao informado")
        self.assertEqual(jobs[0].description, "Ola")
