"""Unit tests for engagement lifecycle, guardrails and persistence."""

import tempfile
import unittest
from pathlib import Path

from services.engagement_service import EngagementError, EngagementService
from services.local_db import LocalDB


class TestEngagementModel(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = LocalDB(
            db_path=Path(self.tmp.name) / "eng.db",
            legacy_dir=Path(self.tmp.name) / "legacy",
        )
        self.service = EngagementService(self.db)

    def tearDown(self):
        self.db._conn.close()
        self.tmp.cleanup()

    def _authorized(self):
        engagement = self.service.create_engagement({
            "name": "Test Engagement", "objective": "validate guardrails"
        }, "lead")
        self.service.set_scope(engagement.id, {
            "include": ["10.0.0.0/24"],
            "exclude": ["10.0.0.9"],
            "allowed_tools": ["metasploit"],
            "allowed_actions": ["version", "run_module"],
        })
        self.service.set_roe(engagement.id, {"stop_conditions": ["operator request"]})
        self.service.sign_roe(engagement.id, "lead")
        self.service.transition(engagement.id, "authorized", "lead")
        self.service.transition(engagement.id, "active", "lead")
        return engagement

    def test_state_machine_requires_signed_roe_and_scope(self):
        engagement = self.service.create_engagement({"name": "Draft"}, "lead")
        self.assertEqual(engagement.state, "draft")
        with self.assertRaises(EngagementError):
            self.service.transition(engagement.id, "authorized", "lead")

        self.service.set_scope(engagement.id, {"include": ["10.0.0.0/24"]})
        self.service.set_roe(engagement.id, {})
        with self.assertRaises(EngagementError):
            self.service.transition(engagement.id, "authorized", "lead")
        self.service.sign_roe(engagement.id, "lead")
        self.service.transition(engagement.id, "authorized", "lead")
        self.assertEqual(self.service.get_engagement(engagement.id).state, "authorized")

    def test_guard_enforces_scope_and_approval(self):
        engagement = self._authorized()
        self.service.guard(engagement.id, "metasploit", "version", "10.0.0.5", "op")
        with self.assertRaises(EngagementError) as ctx:
            self.service.guard(engagement.id, "metasploit", "version", "192.168.1.5", "op")
        self.assertIn("scope", str(ctx.exception))
        with self.assertRaises(EngagementError):
            self.service.guard(engagement.id, "metasploit", "version", "10.0.0.9", "op")
        with self.assertRaises(EngagementError):
            self.service.guard(engagement.id, "reconng", "version", "10.0.0.5", "op")
        with self.assertRaises(EngagementError) as approved:
            self.service.guard(engagement.id, "metasploit", "run_module", "10.0.0.5", "op")
        self.assertIn("approval", str(approved.exception))

        task = self.service.add_task(engagement.id, {
            "title": "Exploit", "action": "run_module", "gate": True,
        })
        self.service.approve_task(engagement.id, task.id, "lead")
        self.service.guard(engagement.id, "metasploit", "run_module", "10.0.0.5", "op")

    def test_abort_blocks_everything(self):
        engagement = self._authorized()
        self.service.transition(engagement.id, "paused", "lead")
        self.service.abort(engagement.id, "lead", "stop condition triggered")
        with self.assertRaises(EngagementError) as ctx:
            self.service.guard(engagement.id, "metasploit", "version", "10.0.0.5", "op")
        self.assertIn("ABORTED", str(ctx.exception))

    def test_findings_metrics_and_persistence(self):
        engagement = self._authorized()
        task = self.service.add_task(engagement.id, {"title": "Scan"})
        self.service.update_task(engagement.id, task.id, {"status": "done"})
        finding = self.service.add_finding(engagement.id, {
            "title": "Critical issue", "severity": "critical", "task_id": task.id
        })
        self.service.update_finding_status(engagement.id, finding.id, "confirmed", "lead")
        evidence = self.service.add_evidence(engagement.id, {
            "finding_id": finding.id, "kind": "output", "sha256": "abc123",
            "path_or_hash": "hash", "source_tool": "metasploit",
        })
        metrics = self.service.metrics(engagement.id)
        self.assertEqual(metrics["progress"], 100.0)
        self.assertEqual(metrics["findings_by_severity"]["critical"], 1)
        self.assertEqual(metrics["evidence_count"], 1)
        self.assertGreater(metrics["risk_score"], 0)

        reloaded = EngagementService(self.db)
        self.assertEqual(reloaded.get_engagement(engagement.id).state, "active")
        self.assertEqual(len(reloaded.list_findings(engagement.id)), 1)


if __name__ == "__main__":
    unittest.main()
