"""Unit tests for the OSINT composite adapter (no tool installs needed)."""

import asyncio
import tempfile
import unittest
from pathlib import Path

from adapters.osint import OSINTAdapter


class TestOSINTAdapter(unittest.TestCase):
    def test_health_degrades_when_binaries_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            health = asyncio.run(OSINTAdapter(bin_dir=tmp).health())
            self.assertFalse(health["available"])
            self.assertFalse(any(health["binaries"].values()))
            self.assertIn("username_search", health["actions"])

    def test_maigret_ndjson_parsing(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "maigret"
            fake.write_text(
                '#!/bin/sh\n'
                "echo '{\"site\":\"GitHub\",\"url\":\"https://github.com/test\",\"status\":\"claimed\"}'\n"
                "echo '{\"site\":\"Twitter\",\"url\":\"https://twitter.com/test\",\"status\":\"claimed\"}'\n",
                encoding="utf-8",
            )
            fake.chmod(0o755)
            adapter = OSINTAdapter(bin_dir=tmp)
            result = asyncio.run(adapter.execute(
                "username_search", {"username": "test", "tool": "maigret"}
            ))
            accounts = result["results"]["maigret"]["accounts"]
            self.assertEqual(len(accounts), 2)
            self.assertEqual(accounts[0]["site"], "GitHub")

    def test_json_lines_helper(self):
        parsed = OSINTAdapter._json_from(
            '{"name":"a.example.com","type":"subdomain"}\n'
            'noise\n'
            '{"name":"b.example.com","type":"subdomain"}'
        )
        self.assertEqual(len(parsed), 2)

    def test_missing_binary_raises_clear_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = OSINTAdapter(bin_dir=tmp)
            with self.assertRaises(RuntimeError) as ctx:
                asyncio.run(adapter.execute("domain_harvest", {"domain": "example.com"}))
            self.assertIn("theHarvester not installed", str(ctx.exception))

    def test_action_inventory(self):
        adapter = OSINTAdapter(bin_dir="/nonexistent")
        for action in ("tools", "version", "username_search", "domain_harvest",
                       "attack_surface", "spiderfoot_scan"):
            self.assertIn(action, adapter.get_actions())


if __name__ == "__main__":
    unittest.main()
