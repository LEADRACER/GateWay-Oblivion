"""Unit tests for embedded SQLite persistence and tamper-evident audit."""

import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from services.audit_log import AuditLog
from services.local_db import LocalDB
from services.persistence import dump_models


class Dummy:
    def model_dump(self):
        return {"value": 1}


class TestPhase5(unittest.TestCase):
    def test_sqlite_snapshot_roundtrip_and_integrity(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            db = LocalDB(db_path=root / "test.db", legacy_dir=root / "legacy")
            db.save_snapshot("sample", dump_models({"a": Dummy()}))
            self.assertEqual(db.load_snapshot("sample"), {"a": {"value": 1}})
            self.assertIsNone(db.load_snapshot("missing"))
            self.assertTrue(db.integrity()["integrity_ok"])
            backup = db.backup()
            self.assertGreater(backup["bytes"], 0)
            self.assertEqual(len(db.list_backups()), 1)

    def test_audit_hash_chain_and_tamper_detection(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            db = LocalDB(db_path=root / "audit.db", legacy_dir=root / "legacy")
            audit = AuditLog()
            audit._db = db
            asyncio.run(audit.append(actor="analyst-1", action="tool.metasploit.version", side="red"))
            asyncio.run(audit.append(actor="analyst-2", action="pipeline.run", side="red"))
            self.assertEqual(audit.verify()["entries"], 2)
            self.assertTrue(audit.verify()["valid"])

            row = db._conn.execute("SELECT data FROM audit WHERE seq = 1").fetchone()
            entry = json.loads(row["data"])
            entry["result"] = {"tampered": True}
            db._conn.execute(
                "UPDATE audit SET data = ? WHERE seq = 1",
                (json.dumps(entry),),
            )
            db._conn.commit()
            result = audit.verify()
            self.assertFalse(result["valid"])
            self.assertEqual(result["broken_at"], 1)

    def test_legacy_json_migration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "targets.json").write_text('{"old-id": {"name": "legacy"}}', encoding="utf-8")
            db = LocalDB(db_path=root / "migrate.db", legacy_dir=root)
            self.assertEqual(db.load_snapshot("targets"), {"old-id": {"name": "legacy"}})


if __name__ == "__main__":
    unittest.main()
