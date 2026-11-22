"""Unit tests for the ProjectDiscovery composite adapter (no tool installs needed)."""

import asyncio
import tempfile
import unittest
from pathlib import Path

from adapters.projectdiscovery import ProjectDiscoveryAdapter


class TestProjectDiscoveryAdapter(unittest.TestCase):
    def test_health_degrades_when_binaries_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = ProjectDiscoveryAdapter(bin_dir=tmp)
            health = asyncio.run(adapter.health())
            self.assertFalse(health["available"])
            self.assertFalse(any(health["binaries"].values()))
            self.assertIn("subdomains", health["actions"])

    def test_subdomains_parses_json_lines(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake = Path(tmp) / "subfinder"
            fake.write_text(
                '#!/bin/sh\n'
                'echo "noise"\n'
                "echo '{\"host\":\"a.example.com\"}'\n"
                "echo '{\"host\":\"b.example.com\"}'\n",
                encoding="utf-8",
            )
            fake.chmod(0o755)
            adapter = ProjectDiscoveryAdapter(bin_dir=tmp)
            result = asyncio.run(adapter.execute("subdomains", {"domain": "example.com"}))
            self.assertEqual(result["subdomains"], ["a.example.com", "b.example.com"])

    def test_missing_binary_raises_clear_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            adapter = ProjectDiscoveryAdapter(bin_dir=tmp)
            with self.assertRaises(RuntimeError) as ctx:
                asyncio.run(adapter.execute("nuclei_scan", {"target": "example.com"}))
            self.assertIn("nuclei not installed", str(ctx.exception))

    def test_action_inventory(self):
        adapter = ProjectDiscoveryAdapter(bin_dir="/nonexistent")
        for action in ("tools", "version", "subdomains", "http_probe", "crawl",
                       "nuclei_scan", "port_scan", "dns_resolve"):
            self.assertIn(action, adapter.get_actions())


if __name__ == "__main__":
    unittest.main()
