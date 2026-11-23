"""Phase 7 — full HTTP integration test for the engagement lifecycle.

Runs against FastAPI TestClient with a temporary SQLite DB and a fake Obsidian
writer, so it never touches real data or external services.
"""

import os
import tempfile
import unittest

os.environ.setdefault("OBLIVION_DB_PATH", "/tmp/oblivion-e2e-placeholder.db")
os.environ.setdefault("NETVISION_URL", "http://127.0.0.1:9")
os.environ.setdefault("NETVISION_WS_URL", "ws://127.0.0.1:9/ws")
os.environ.setdefault("OBLIVION_SCOPE", "10.0.0.0/24")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
import services.audit_log as audit_mod  # noqa: E402
import services.engagement_service as eng_mod  # noqa: E402
import services.local_db as db_mod  # noqa: E402
import services.persistence as persistence_mod  # noqa: E402


class FakeObsidian:
    def __init__(self):
        self.writes = []

    def write_note(self, path, content, mode):
        self.writes.append((path, content))
        return {"path": path, "mode": mode, "bytes": len(content)}


class TestFullLifecycle(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory(prefix="oblivion-e2e-")
        root = cls.tmp.name
        cls.orig_persistence_db = persistence_mod.local_db
        cls.orig_audit_db = audit_mod.audit_log._db
        cls.orig_eng_db = eng_mod.engagement_service.db
        cls.orig_obsidian = main.engagement_report_service.obsidian
        cls.db = db_mod.LocalDB(
            db_path=os.path.join(root, "e2e.db"),
            legacy_dir=os.path.join(root, "legacy"),
        )
        # Point every singleton at the isolated store.
        persistence_mod.local_db = cls.db
        audit_mod.audit_log._db = cls.db
        eng_mod.engagement_service.db = cls.db
        cls.obsidian = FakeObsidian()
        main.engagement_report_service.obsidian = cls.obsidian

        cls.client = TestClient(main.app)
        cls.client.__enter__()

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        persistence_mod.local_db = cls.orig_persistence_db
        audit_mod.audit_log._db = cls.orig_audit_db
        eng_mod.engagement_service.db = cls.orig_eng_db
        main.engagement_report_service.obsidian = cls.orig_obsidian
        cls.db._conn.close()
        cls.tmp.cleanup()

    def test_full_engagement_lifecycle(self):
        client = self.client
        H = {"X-Operator": "e2e-lead", "Content-Type": "application/json"}

        # 1. create
        created = client.post("/api/engagements", headers=H, json={
            "name": "E2E Assessment", "objective": "validate full lifecycle",
            "engagement_type": "red",
        })
        self.assertEqual(created.status_code, 200, created.text)
        engagement = created.json()
        eid = engagement["id"]
        EH = {**H, "X-Engagement": eid}
        self.assertEqual(engagement["state"], "draft")

        # 2. scope + RoE + authorization
        self.assertEqual(client.put(f"/api/engagements/{eid}/scope", headers=EH, json={
            "include": ["10.0.0.0/24"],
            "exclude": ["10.0.0.9"],
            "allowed_tools": ["metasploit"],
            "allowed_actions": ["version", "sessions_list", "run_module"],
        }).status_code, 200)
        self.assertEqual(client.put(f"/api/engagements/{eid}/roe", headers=EH, json={
            "stop_conditions": ["operator request"],
        }).status_code, 200)
        self.assertEqual(client.post(f"/api/engagements/{eid}/roe/sign", headers=EH).status_code, 200)
        self.assertEqual(client.post(f"/api/engagements/{eid}/transition", headers=EH,
                                     json={"to": "authorized"}).status_code, 200)
        self.assertEqual(client.post(f"/api/engagements/{eid}/activate", headers=EH).status_code, 200)

        # 3. tasks + approval
        task = client.post(f"/api/engagements/{eid}/tasks", headers=EH, json={
            "title": "Exploit validation", "action": "run_module", "gate": True,
        }).json()
        self.assertEqual(client.post(
            f"/api/engagements/{eid}/tasks/{task['id']}/approve",
            headers=EH, json={"reason": "e2e approval"},
        ).status_code, 200)

        # 4. guarded tool execution
        allowed = client.post("/api/tools/metasploit/execute", headers=EH,
                              json={"action": "version", "params": {"target": "10.0.0.5"}})
        self.assertEqual(allowed.status_code, 200, allowed.text)
        denied = client.post("/api/tools/metasploit/execute", headers=EH,
                             json={"action": "version", "params": {"target": "192.168.1.5"}})
        self.assertEqual(denied.status_code, 403)
        self.assertIn("scope", denied.json()["detail"])

        # 5. scoped pipeline → tasks + events
        pipeline = client.post("/api/pipelines", headers=EH, json={
            "name": "E2E Pipeline",
            "steps": [{"name": "Version", "tool": "metasploit",
                       "action": "version", "params": {}}],
        }).json()
        run = client.post(f"/api/engagements/{eid}/pipelines/{pipeline['id']}/run",
                          headers=EH).json()
        self.assertEqual(run["status"], "completed", run)
        tasks = client.get(f"/api/engagements/{eid}/tasks", headers=EH).json()["tasks"]
        self.assertGreaterEqual(len(tasks), 2)
        events = client.get(f"/api/engagements/{eid}/events", headers=EH).json()["events"]
        self.assertGreaterEqual(len(events), 1)

        # 6. findings + evidence + metrics
        finding = client.post(f"/api/engagements/{eid}/findings", headers=EH, json={
            "title": "E2E finding", "severity": "critical", "cve_id": "CVE-2026-0001",
        }).json()
        self.assertEqual(client.patch(
            f"/api/engagements/{eid}/findings/{finding['id']}",
            headers=EH, json={"status": "confirmed"},
        ).status_code, 200)
        self.assertEqual(client.post(f"/api/engagements/{eid}/evidence", headers=EH, json={
            "finding_id": finding["id"], "kind": "output", "source_tool": "metasploit",
            "sha256": "e2e-hash", "path_or_hash": "hash",
        }).status_code, 200)
        metrics = client.get(f"/api/engagements/{eid}/metrics", headers=EH).json()
        self.assertGreater(metrics["findings_total"], 0)
        self.assertGreater(metrics["risk_score"], 0)
        self.assertGreater(metrics["progress"], 0)

        # 7. reports + Obsidian export
        for kind in ("executive", "technical"):
            report = client.post(f"/api/engagements/{eid}/report", headers=EH,
                                 json={"kind": kind}).json()
            self.assertIn("## Findings", report["content"])
            self.assertIn("Engagements/", report["path"])
        self.assertGreaterEqual(len(self.obsidian.writes), 2)
        download = client.get(f"/api/engagements/{eid}/report/download?kind=executive",
                              headers=EH)
        self.assertEqual(download.status_code, 200)
        self.assertIn("text/markdown", download.headers["content-type"])

        # 8. audit + persistence integrity
        verification = client.get("/api/audit/verify", headers=H).json()
        self.assertTrue(verification["valid"])
        self.assertGreater(verification["entries"], 5)
        stats = client.get("/api/persistence/stats", headers=H).json()
        self.assertTrue(stats["integrity_ok"])
        self.assertEqual(stats["schema_version"], 2)

        # 9. emergency abort blocks further action
        self.assertEqual(client.post(f"/api/engagements/{eid}/abort", headers=EH,
                                     json={"reason": "e2e abort"}).status_code, 200)
        blocked = client.post("/api/tools/metasploit/execute", headers=EH,
                              json={"action": "version", "params": {"target": "10.0.0.5"}})
        self.assertEqual(blocked.status_code, 403)
        self.assertIn("ABORTED", blocked.json()["detail"])


if __name__ == "__main__":
    unittest.main()
