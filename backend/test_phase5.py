"""Unit tests for Phase 5 persistence and tamper-evident audit."""

import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from services.audit_log import AuditLog
from services.persistence import PersistenceService, dump_models


class Dummy:
    def model_dump(self):
        return {"value": 1}


class TestPhase5(unittest.TestCase):
    def test_audit_hash_chain_and_tamper_detection(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "audit.jsonl"
            log = AuditLog(path=str(path))
            asyncio.run(log.append(actor="analyst-1", action="tool.metasploit.version", side="red"))
            asyncio.run(log.append(actor="analyst-2", action="pipeline.run", side="red"))
            self.assertEqual(log.verify()["entries"], 2)
            self.assertTrue(log.verify()["valid"])

            lines = path.read_text(encoding="utf-8").splitlines()
            first = json.loads(lines[0])
            first["result"] = {"tampered": True}
            lines[0] = json.dumps(first)
            path.write_text("\n".join(lines) + "\n", encoding="utf-8")
            result = log.verify()
            self.assertFalse(result["valid"])
            self.assertEqual(result["broken_at"], 1)

    def test_persistence_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = PersistenceService(data_dir=tmp)
            asyncio.run(store.save("sample", dump_models({"a": Dummy()})))
            self.assertEqual(store.load("sample"), {"a": {"value": 1}})
            self.assertIsNone(store.load("missing", default=None))


if __name__ == "__main__":
    unittest.main()
