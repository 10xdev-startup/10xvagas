from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from engine.experiment.compare_rankings import compare, load_human_ranking


class CompareRankingsTest(unittest.TestCase):
    def test_identical_rankings_pass_with_full_overlap(self) -> None:
        ids = [f"JOB-{index:02}" for index in range(1, 31)]
        system_document = {
            "evaluation": {"top_k": 10, "minimum_overlap": 6, "rbo_p": 0.9},
            "ranking": [{"id": job_id} for job_id in ids],
        }
        report = compare(ids, system_document)
        self.assertTrue(report["passed"])
        self.assertEqual(report["overlap"], 10)
        self.assertEqual(report["rank_biased_overlap"], 1.0)

    def test_comparison_reports_below_target(self) -> None:
        system_ids = [f"JOB-{index:02}" for index in range(1, 31)]
        human_ids = system_ids[10:20] + system_ids[:10] + system_ids[20:]
        system_document = {
            "evaluation": {"top_k": 10, "minimum_overlap": 6, "rbo_p": 0.9},
            "ranking": [{"id": job_id} for job_id in system_ids],
        }
        report = compare(human_ids, system_document)
        self.assertFalse(report["passed"])
        self.assertEqual(report["overlap"], 0)

    def test_blank_human_rank_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ranking.csv"
            with path.open("w", encoding="utf-8", newline="") as file:
                writer = csv.DictWriter(file, fieldnames=["rank", "id"])
                writer.writeheader()
                writer.writerow({"rank": "", "id": "JOB-01"})
            with self.assertRaisesRegex(ValueError, "Preencha o rank"):
                load_human_ranking(path)

    def test_duplicate_rank_is_rejected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "ranking.csv"
            with path.open("w", encoding="utf-8", newline="") as file:
                writer = csv.DictWriter(file, fieldnames=["rank", "id"])
                writer.writeheader()
                writer.writerow({"rank": "1", "id": "JOB-01"})
                writer.writerow({"rank": "1", "id": "JOB-02"})
            with self.assertRaisesRegex(ValueError, "exatamente uma vez"):
                load_human_ranking(path)


if __name__ == "__main__":
    unittest.main()
