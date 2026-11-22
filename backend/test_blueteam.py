"""Unit tests for the blue-team telemetry adapter (no external services needed)."""

import asyncio
import json
import tempfile
import unittest
from pathlib import Path

from adapters.blueteam import BlueTeamAdapter


SIGMA_RULE = """title: Failed SSH Authentication
id: test-rule-001
level: high
detection:
  selection:
    event_type: ssh.failed
  condition: selection
"""


class TestBlueTeamAdapter(unittest.TestCase):
    def test_health_reports_all_subsystems(self):
        health = asyncio.run(BlueTeamAdapter().health())
        for key in ("wazuh", "suricata", "zeek", "sigma", "yara", "thehive", "misp"):
            self.assertIn(key, health["subsystems"])
        self.assertIn("wazuh_alerts", health["actions"])

    def test_sigma_rule_matching(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp, "rule.yml").write_text(SIGMA_RULE, encoding="utf-8")
            adapter = BlueTeamAdapter()
            adapter.sigma_dir = Path(tmp)
            result = asyncio.run(adapter.execute("sigma_match", {
                "events": [
                    {"event_type": "ssh.failed", "source_ip": "10.0.0.5"},
                    {"event_type": "ssh.success", "source_ip": "10.0.0.6"},
                ]
            }))
            self.assertEqual(result["rules_loaded"], 1)
            self.assertEqual(len(result["matches"]), 1)
            self.assertEqual(result["matches"][0]["id"], "test-rule-001")

    def test_suricata_eve_parsing(self):
        with tempfile.TemporaryDirectory() as tmp:
            eve = Path(tmp) / "eve.json"
            eve.write_text(
                json.dumps({"event_type": "alert", "timestamp": "2026-01-01T00:00:00Z",
                            "src_ip": "10.0.0.5", "dest_ip": "10.0.0.1",
                            "alert": {"signature": "ET SCAN", "severity": 1, "signature_id": 123}}) + "\n" +
                json.dumps({"event_type": "dns", "timestamp": "2026-01-01T00:00:01Z"}) + "\n",
                encoding="utf-8",
            )
            adapter = BlueTeamAdapter()
            adapter.suricata_path = eve
            result = asyncio.run(adapter.execute("suricata_alerts", {"limit": 10}))
            self.assertEqual(len(result["alerts"]), 1)
            self.assertEqual(result["alerts"][0]["title"], "ET SCAN")
            self.assertEqual(result["alerts"][0]["severity"], "high")

    def test_missing_config_raises_clear_error(self):
        adapter = BlueTeamAdapter()
        adapter.wazuh_url = ""
        with self.assertRaises(RuntimeError) as ctx:
            asyncio.run(adapter.execute("wazuh_alerts"))
        self.assertIn("Wazuh not configured", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
