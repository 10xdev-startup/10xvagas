from __future__ import annotations

import copy
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine.profile.import_profile import (
    ProfileImportError,
    SourceDocument,
    build_deterministic_draft,
    collect_documents,
    merge_codex_response,
    read_document,
)


def base_profile() -> dict:
    return {
        "schema_version": 1,
        "source_files": [],
        "identity": {"contact": {}},
        "skills_desired": [
            {"name": "TypeScript", "priority": 3},
            {"name": "Node.js", "priority": 3},
        ],
        "skills_known": {
            "desired_and_evidenced": ["TypeScript"],
            "known_but_not_desired_for_matching": [],
            "secondary_or_limited_evidence": [],
        },
    }


def document(content: str) -> SourceDocument:
    return SourceDocument("cv.txt", content, "digest")


class ProfileImportTests(unittest.TestCase):
    def test_support_is_excluded_and_never_becomes_desired(self) -> None:
        original = base_profile()

        draft = build_deterministic_draft(
            original,
            [
                document(
                    "Suporte técnico e helpdesk com Office 365, AnyDesk, redes e VPN. "
                    "Desenvolvimento posterior com Python e FastAPI."
                )
            ],
        )

        self.assertEqual(draft["skills_desired"], original["skills_desired"])
        excluded = draft["skills_known"]["known_but_not_desired_for_matching"]
        self.assertIn("technical support", excluded)
        self.assertIn("helpdesk", excluded)
        self.assertIn("Office 365", excluded)
        self.assertIn("AnyDesk", excluded)
        self.assertIn("network configuration", excluded)
        self.assertIn("VPN configuration", excluded)
        evidenced = draft["skills_known"]["desired_and_evidenced"]
        self.assertIn("Python", evidenced)
        self.assertIn("FastAPI", evidenced)
        self.assertNotIn("technical support", evidenced)

    def test_explicit_desired_skill_updates_priority(self) -> None:
        draft = build_deterministic_draft(
            base_profile(),
            [document("Projetos em Go e TypeScript")],
            ["Go:3", "TypeScript:1"],
        )

        desired = {item["name"]: item["priority"] for item in draft["skills_desired"]}
        self.assertEqual(desired["Go"], 3)
        self.assertEqual(desired["TypeScript"], 1)

    def test_support_cannot_be_requested_as_desired_skill(self) -> None:
        with self.assertRaisesRegex(ProfileImportError, "nao pode guiar o matching"):
            build_deterministic_draft(
                base_profile(),
                [document("Helpdesk")],
                ["helpdesk:3"],
            )

    def test_base_profile_is_not_mutated(self) -> None:
        profile = base_profile()
        before = copy.deepcopy(profile)

        build_deterministic_draft(profile, [document("Python e suporte tecnico")])

        self.assertEqual(profile, before)

    def test_codex_cannot_replace_desired_skills_or_promote_support(self) -> None:
        deterministic = build_deterministic_draft(
            base_profile(),
            [document("TypeScript")],
        )
        proposed = copy.deepcopy(deterministic)
        proposed["skills_desired"] = [{"name": "helpdesk", "priority": 3}]
        proposed["skills_known"]["desired_and_evidenced"].append("helpdesk")

        result = merge_codex_response(
            deterministic,
            proposed,
            {
                "skills_evidenced": ["Python"],
                "support_skills_evidenced": ["helpdesk"],
                "warnings": [],
            },
        )

        self.assertEqual(result["skills_desired"], deterministic["skills_desired"])
        self.assertNotIn(
            "helpdesk", result["skills_known"]["desired_and_evidenced"]
        )
        self.assertIn(
            "helpdesk",
            result["skills_known"]["known_but_not_desired_for_matching"],
        )

    def test_contact_fills_only_missing_values(self) -> None:
        profile = base_profile()
        profile["identity"]["contact"]["email"] = "oficial@example.com"

        draft = build_deterministic_draft(
            profile,
            [document("novo@example.com https://linkedin.com/in/augusto-amado")],
        )

        contact = draft["identity"]["contact"]
        self.assertEqual(contact["email"], "oficial@example.com")
        self.assertEqual(contact["linkedin"], "https://linkedin.com/in/augusto-amado")

    def test_text_file_and_inline_text_are_collected(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "cv.txt"
            path.write_text("TypeScript", encoding="utf-8")

            documents = collect_documents([path], ["Python"])

        self.assertEqual(len(documents), 2)
        self.assertEqual(documents[0].content, "TypeScript")
        self.assertEqual(documents[1].name, "<inline-text-1>")

    @patch("engine.profile.import_profile.shutil.which", return_value=None)
    def test_pdf_without_pdftotext_has_actionable_error(self, _which) -> None:
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "cv.pdf"
            path.write_bytes(b"%PDF fake")

            with self.assertRaisesRegex(ProfileImportError, "--input caminho/cv.txt"):
                read_document(path)


if __name__ == "__main__":
    unittest.main()
