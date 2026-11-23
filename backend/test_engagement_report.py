"""Tests for engagement report rendering and export."""

import tempfile
import unittest
from pathlib import Path

from services.engagement_report import EngagementReportService
from services.engagement_service import EngagementService
from services.local_db import LocalDB


class FakeObsidian:
    def __init__(self):
        self.writes = []

    def write_note(self, path, content, mode):
        self.writes.append((path, content, mode))
        return {"path": path, "mode": mode, "bytes": len(content)}


class TestEngagementReport(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = LocalDB(
            db_path=Path(self.tmp.name) / "r.db",
            legacy_dir=Path(self.tmp.name) / "legacy",
        )
        self.service = EngagementService(self.db)
        self.engagement = self.service.create_engagement({
            "name": "Report Test", "objective": "Validate report generation",
        }, "lead")
        self.service.set_scope(self.engagement.id, {
            "include": ["10.0.0.0/24"], "exclude": ["10.0.0.9"],
        })
        self.service.set_roe(self.engagement.id, {
            "stop_conditions": ["operator request"],
        })
        self.service.sign_roe(self.engagement.id, "lead")
        self.service.add_finding(self.engagement.id, {
            "title": "Critical issue", "severity": "critical", "cve_id": "CVE-2026-0001",
        })
        self.service.add_evidence(self.engagement.id, {
            "kind": "output", "source_tool": "metasploit", "sha256": "abc123",
        })
        self.reports = EngagementReportService(self.service)
        self.reports.obsidian = FakeObsidian()

    def tearDown(self):
        self.db._conn.close()
        self.tmp.cleanup()

    def test_executive_report_contains_required_sections(self):
        content = self.reports.render(self.engagement.id, "executive")
        self.assertTrue(content.startswith("---"))
        self.assertIn(self.engagement.code, content)
        self.assertIn("## Executive Summary", content)
        self.assertIn("## Scope & Authorization", content)
        self.assertIn("## Findings", content)
        self.assertIn("CVE-2026-0001", content)
        self.assertIn("## Evidence", content)
        self.assertIn("abc123", content)
        self.assertIn("## Audit Integrity", content)
        self.assertIn("[[Oblivion Overview]]", content)

    def test_technical_report_includes_raw_details(self):
        content = self.reports.render(self.engagement.id, "technical")
        self.assertIn("## Technical Summary", content)
        self.assertIn("### Finding Details", content)

    def test_export_writes_note_and_persists_report(self):
        report = self.reports.export(self.engagement.id, "executive")
        self.assertEqual(report["kind"], "executive")
        self.assertIn("Engagements/", report["path"])
        self.assertIn("## Findings", report["content"])
        self.assertEqual(len(self.service.list_reports(self.engagement.id)), 1)


if __name__ == "__main__":
    unittest.main()
