"""Tests for engagement ↔ pipeline integration (guard, tasks, approvals, findings)."""

import asyncio
import tempfile
import unittest
from pathlib import Path

import services.pipeline_service as pm
from models.engagement import CanonicalTask
from services.engagement_service import EngagementError, EngagementService
from services.local_db import LocalDB
from services.pipeline_service import Pipeline, PipelineService, PipelineStep


class FakeAdapter:
    async def execute(self, action, params=None):
        return {
            "action": action,
            "findings": [{"title": f"Finding from {action}", "severity": "high"}],
        }


class TestEngagementPipeline(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = LocalDB(
            db_path=Path(self.tmp.name) / "p.db",
            legacy_dir=Path(self.tmp.name) / "legacy",
        )
        self.service = EngagementService(self.db)
        self.saved_hooks = (
            pm.engagement_guard, pm.on_step_start,
            pm.on_step_complete, pm.engagement_approval_check,
        )
        self.saved_adapter = pm.get_adapter

        pm.engagement_guard = lambda eid, tool, action, params, target: self.service.guard(
            eid, tool, action, target, "pipeline"
        )
        pm.on_step_start = lambda run, step: self.service.add_task(run.engagement_id, {
            "title": step.name, "tool": step.tool, "action": step.action,
            "params": step.params, "gate": step.gate, "pipeline_run_id": run.id,
        }).id
        pm.on_step_complete = lambda run, step, result: (
            self.service.update_task(run.engagement_id, step.task_id, {"status": "done"}),
            [self.service.add_finding(run.engagement_id, {
                "title": row.get("title", "Finding"),
                "severity": row.get("severity", "info"),
                "source_tool": step.tool,
                "task_id": step.task_id,
            }) for row in (result.get("findings") or [])[:20]],
        )
        pm.engagement_approval_check = lambda eid, action, target: self.service.has_approval(
            eid, action, target
        )
        pm.get_adapter = lambda name: FakeAdapter()

        self.engagement = self.service.create_engagement({"name": "Pipeline Test"}, "lead")
        self.service.set_scope(self.engagement.id, {
            "include": ["10.0.0.0/24"],
            "allowed_tools": ["reconng", "metasploit"],
            "allowed_actions": ["module_search", "run_module"],
        })
        self.service.set_roe(self.engagement.id, {})
        self.service.sign_roe(self.engagement.id, "lead")
        self.service.transition(self.engagement.id, "authorized", "lead")
        self.service.transition(self.engagement.id, "active", "lead")

    def tearDown(self):
        (pm.engagement_guard, pm.on_step_start,
         pm.on_step_complete, pm.engagement_approval_check) = self.saved_hooks
        pm.get_adapter = self.saved_adapter
        self.db._conn.close()
        self.tmp.cleanup()

    def test_gated_pipeline_links_tasks_and_findings(self):
        pipelines = PipelineService()
        pipelines.register(Pipeline(
            name="Test Chain",
            steps=[
                PipelineStep(id="s1", name="Search", tool="reconng", action="module_search", params={}),
                PipelineStep(id="s2", name="Exploit", tool="metasploit", action="run_module",
                             params={}, gate=True, depends_on=["s1"]),
            ],
        ))
        pipeline = pipelines.list_pipelines()[0]
        run = pipelines.create_run(pipeline.id, engagement_id=self.engagement.id)
        asyncio.run(pipelines.run(run.id))

        self.assertEqual(run.status, "gated")
        self.assertEqual(run.gated_reason, "engagement-approval")
        self.assertEqual(run.required_approval_action, "run_module")
        self.assertEqual(run.step_results["s1"]["action"], "module_search")
        self.assertEqual(len(self.service.list_tasks(self.engagement.id)), 1)
        self.assertEqual(len(self.service.list_findings(self.engagement.id)), 1)
        self.assertEqual(self.service.list_findings(self.engagement.id)[0].severity, "high")

        self.service.record_approval(self.engagement.id, "run_module", "", "lead")
        asyncio.run(pipelines.run(run.id))
        self.assertEqual(run.status, "completed")
        self.assertEqual(len(self.service.list_tasks(self.engagement.id)), 2)
        self.assertTrue(all(t.status == "done" for t in self.service.list_tasks(self.engagement.id)))

    def test_guard_blocks_unauthorized_pipeline_step(self):
        self.service.set_scope(self.engagement.id, {
            "include": ["10.0.0.0/24"],
            "allowed_tools": ["reconng"],
            "allowed_actions": ["module_search"],
        })
        pipelines = PipelineService()
        pipelines.register(Pipeline(
            name="Blocked Chain",
            steps=[PipelineStep(id="s1", name="Bad", tool="metasploit", action="run_module", params={})],
        ))
        run = pipelines.create_run(pipelines.list_pipelines()[0].id,
                                   engagement_id=self.engagement.id)
        asyncio.run(pipelines.run(run.id))
        self.assertEqual(run.status, "failed")
        self.assertIn("not authorized", run.step_results.get("s1", {}).get("error", "")
                      or run.error or "not authorized")


if __name__ == "__main__":
    unittest.main()
