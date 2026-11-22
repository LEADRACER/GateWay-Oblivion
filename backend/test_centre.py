"""Unit tests for unified centre event classification."""

import unittest

from services.centre_service import CentreService, classify_side


class FakeEvent:
    def __init__(self, tool: str, etype: str):
        self.source_tool = tool
        self.event_type = etype


class TestCentreClassification(unittest.TestCase):
    def test_red_events(self):
        self.assertEqual(classify_side(FakeEvent("metasploit", "metasploit.run_module")), "red")
        self.assertEqual(classify_side(FakeEvent("reconng", "reconng.module_search")), "red")
        self.assertEqual(classify_side(FakeEvent("system", "pipeline.executed")), "red")

    def test_blue_events(self):
        self.assertEqual(classify_side(FakeEvent("godseye", "godseye.weather")), "blue")
        self.assertEqual(classify_side(FakeEvent("netvision", "netvision.health.alert")), "blue")
        self.assertEqual(classify_side(FakeEvent("system", "tool.offline")), "blue")

    def test_scope_guardrails(self):
        import os
        os.environ["OBLIVION_SCOPE"] = "10.0.0.0/24"
        service = CentreService()
        self.assertTrue(service.scope_status()["enforced"])
        self.assertTrue(service.target_allowed("10.0.0.5"))
        self.assertFalse(service.target_allowed("192.168.1.5"))
        del os.environ["OBLIVION_SCOPE"]


if __name__ == "__main__":
    unittest.main()
