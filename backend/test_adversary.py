"""Unit tests for the Tier 3 adversary adapter — guardrails first."""

import asyncio
import tempfile
import unittest
from pathlib import Path

from adapters.adversary import AdversaryAdapter


class TestAdversaryAdapter(unittest.TestCase):
    def test_health_reports_mutating_actions(self):
        health = asyncio.run(AdversaryAdapter().health())
        for key in ("caldera", "atomic_red_team", "bloodhound", "sliver",
                    "mythic", "havoc", "netexec"):
            self.assertIn(key, health["subsystems"])
        self.assertIn("netexec_run", health["mutating_actions"])

    def test_mutating_actions_require_confirm(self):
        adapter = AdversaryAdapter()
        adapter.caldera_url = "http://localhost:8888"
        with self.assertRaises(RuntimeError) as ctx:
            asyncio.run(adapter.execute("caldera_start_operation", {"name": "test"}))
        self.assertIn("ENGAGE", str(ctx.exception))

    def test_c2_command_blocks_arbitrary_verbs(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "sliver"
            fake.write_text('#!/bin/sh\necho "sessions"\n', encoding="utf-8")
            fake.chmod(0o755)
            adapter = AdversaryAdapter()
            adapter.c2_binaries["sliver"] = str(fake)
            with self.assertRaises(RuntimeError) as ctx:
                asyncio.run(adapter.execute("c2_command", {
                    "framework": "sliver", "command": "generate implant",
                    "confirm": "ENGAGE",
                }))
            self.assertIn("read-only", str(ctx.exception))
            result = asyncio.run(adapter.execute("c2_command", {
                "framework": "sliver", "command": "sessions", "confirm": "ENGAGE",
            }))
            self.assertIn("sessions", result["stdout"])

    def test_atomic_list_parses_yaml(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            test_dir = root / "atomics" / "T1059"
            test_dir.mkdir(parents=True)
            (test_dir / "T1059-001.yaml").write_text(
                "attack_technique: T1059\n"
                "display_name: Command and Scripting Interpreter\n"
                "atomic_tests:\n"
                "  - name: Echo test\n"
                "    guid: abc-123\n"
                "    executor:\n"
                "      name: sh\n",
                encoding="utf-8",
            )
            adapter = AdversaryAdapter()
            adapter.atomic_dir = root
            result = asyncio.run(adapter.execute("atomic_list", {"technique": "T1059"}))
            self.assertEqual(len(result["tests"]), 1)
            self.assertEqual(result["tests"][0]["name"], "Echo test")


if __name__ == "__main__":
    unittest.main()
