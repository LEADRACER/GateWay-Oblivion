"""
GateWay:Oblivion — Pipeline Orchestrator

DAG-based pipeline runner that chains tool adapters together:
    tool step -> adapter execute -> normalize -> event bus -> next steps

Runbooks (pipelines) bundled with Oblivion:
  - Full Recon        : Recon-ng modules -> NetVision scan -> Vuln sync
  - Exploit Chain     : NetVision vulns -> Metasploit module -> (gated) run
  - OSINT Enrichment  : God's Eye View live intel feeds
  - Web Vuln Sweep    : Recon-ng web modules -> NetVision deep scan -> vulns
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, Field

from services.event_bus import event_bus
from adapters import get_adapter

logger = logging.getLogger("oblivion.pipeline")


# ── Pydantic Models ─────────────────────────────────────────────────

class PipelineStepBase(BaseModel):
    id: str
    name: str
    tool: str
    action: str
    params: dict = Field(default_factory=dict)
    depends_on: list = Field(default_factory=list)
    condition: Optional[str] = None
    gate: bool = False


class PipelineStep(PipelineStepBase):
    status: str = "pending"
    result: Optional[dict] = None
    error: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None


class PipelineBase(BaseModel):
    name: str
    description: str = ""
    steps: list[PipelineStep] = Field(default_factory=list)


class Pipeline(PipelineBase):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PipelineRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pipeline_id: str
    pipeline_name: str
    status: str = "pending"  # pending | running | completed | failed | cancelled | gated
    current_step: Optional[str] = None
    step_results: dict = Field(default_factory=dict)
    logs: list = Field(default_factory=list)
    approved: bool = False
    target_ref: Optional[str] = None
    correlation_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    error: Optional[str] = None


# ── Helpers ──────────────────────────────────────────────────────────

def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _order_steps(steps: list[PipelineStep]) -> list[PipelineStep]:
    """Topologically order steps by depends_on (stable for linear chains)."""
    by_id = {s.id: s for s in steps}
    ordered: list[PipelineStep] = []
    placed: set = set()

    def visit(step: PipelineStep, trail: list[str]) -> bool:
        if step.id in placed:
            return True
        if any(d not in by_id or d in trail for d in step.depends_on):
            return False  # dependency not satisfied (or cyclic) -> skip subtree
        placed.add(step.id)
        ordered.append(step)
        for dep_id in step.depends_on:
            visit(by_id[dep_id], trail + [step.id])
        return True

    for step in steps:
        visit(step, [])
    return ordered


def _resolve_condition(condition: str, result: dict) -> bool:
    """Resolve a simple condition: dotted key path into the step result payload."""
    value: Any = result
    for part in condition.split("."):
        if isinstance(value, dict):
            value = value.get(part)
        else:
            return False
    return bool(value)


# ── Service ──────────────────────────────────────────────────────────

class PipelineService:
    def __init__(self):
        self.pipelines: dict[str, Pipeline] = {}
        self.runs: dict[str, PipelineRun] = {}

    # ── CRUD ────────────────────────────────────────────────────────

    def register(self, pipeline: Pipeline) -> Pipeline:
        self.pipelines[pipeline.id] = pipeline
        return pipeline

    def get_pipeline(self, pipeline_id: str) -> Optional[Pipeline]:
        return self.pipelines.get(pipeline_id)

    def list_pipelines(self) -> list[Pipeline]:
        return sorted(self.pipelines.values(), key=lambda p: p.created_at, reverse=True)

    def create_run(
        self,
        pipeline_id: str,
        target_ref: Optional[str] = None,
        correlation_id: Optional[str] = None,
        approved: bool = False,
    ) -> Optional[PipelineRun]:
        pipeline = self.pipelines.get(pipeline_id)
        if not pipeline:
            return None
        run = PipelineRun(
            pipeline_id=pipeline_id,
            pipeline_name=pipeline.name,
            approved=approved,
            target_ref=target_ref,
            correlation_id=correlation_id,
        )
        self.runs[run.id] = run
        return run

    def get_run(self, run_id: str) -> Optional[PipelineRun]:
        return self.runs.get(run_id)

    def list_runs(self, pipeline_id: Optional[str] = None, status: Optional[str] = None, limit: int = 50) -> list:
        runs = list(self.runs.values())
        if pipeline_id:
            runs = [r for r in runs if r.pipeline_id == pipeline_id]
        if status:
            runs = [r for r in runs if r.status == status]
        return sorted(runs, key=lambda r: r.created_at, reverse=True)[:limit]

    # ── Execution ───────────────────────────────────────────────────

    async def run(self, run_id: str) -> Optional[PipelineRun]:
        run = self.runs.get(run_id)
        if not run:
            return None
        if run.status in ("completed", "failed", "cancelled"):
            return run

        pipeline = self.pipelines.get(run.pipeline_id)
        if not pipeline:
            run.status = "failed"
            run.error = f"Pipeline not found: {run.pipeline_id}"
            return run

        if run.status == "gated" and run.approved:
            run.status = "running"

        if run.status != "running":
            run.status = "running"
        run.started_at = _now()

        ordered = _order_steps(pipeline.steps)
        logger.info("Pipeline %s run %s starting — %d steps", pipeline.name, run.id, len(ordered))

        for step in ordered:
            if run.status in ("cancelled", "failed"):
                break
            if step.gate and not run.approved:
                run.status = "gated"
                run.current_step = step.id
                run.completed_at = _now()
                break

            run.current_step = step.id
            step.status = "running"
            step.started_at = _now()
            run.logs.append({"step_id": step.id, "level": "info", "message": f"Running {step.tool}::{step.action}"})

            adapter = get_adapter(step.tool)
            if adapter is None:
                step.status = "failed"
                step.error = f"Unknown tool: {step.tool}"
                run.status = "failed"
                run.error = f"Unknown tool: {step.tool}"
                break

            try:
                result = await adapter.execute(step.action, step.params)
                step.status = "completed"
                step.result = result
                step.completed_at = _now()
                run.step_results[step.id] = result

                await event_bus.emit(
                    source_tool=step.tool,
                    event_type=f"{step.tool}.{step.action}",
                    payload={"action": step.action, "params": step.params, "result": result, "pipeline": pipeline.name, "run_id": run.id},
                    severity="info",
                    title=f"{pipeline.name} — {step.name}",
                    target_ref=run.target_ref,
                    correlation_id=run.correlation_id,
                )

                if step.condition:
                    ok = _resolve_condition(step.condition, result if isinstance(result, dict) else {})
                    if not ok:
                        run.logs.append({"step_id": step.id, "level": "info", "message": f"Condition '{step.condition}' not met — skipping downstream steps"})
                        run.status = "completed"
                        run.completed_at = _now()
                        return run

            except Exception as e:  # noqa: BLE001
                step.status = "failed"
                step.error = str(e)
                run.status = "failed"
                run.error = f"Step {step.id} failed: {e}"
                run.logs.append({"step_id": step.id, "level": "error", "message": f"Step failed: {e}"})
                break

        if run.status == "running":
            run.status = "completed"
        run.completed_at = _now()
        return run

    # ── Run control ──────────────────────────────────────────────────

    def cancel(self, run_id: str) -> Optional[PipelineRun]:
        run = self.runs.get(run_id)
        if not run:
            return None
        run.status = "cancelled"
        run.completed_at = _now()
        return run

    def approve(self, run_id: str) -> Optional[PipelineRun]:
        run = self.runs.get(run_id)
        if not run:
            return None
        run.approved = True
        if run.status == "gated":
            run.status = "pending"
        return run


# ── Built-in Runbooks ───────────────────────────────────────────────

def register_builtin_pipelines(service: PipelineService) -> None:
    service.register(
        Pipeline(
            name="Full Recon",
            description="Recon-ng module search -> NetVision scan -> vulnerability sync",
            steps=[
                PipelineStep(id="s1", name="Recon Module Search", tool="reconng", action="module_search", params={"query": "dns"}),
                PipelineStep(id="s2", name="NetVision Scan", tool="netvision", action="trigger_scan", params={"target": "10.0.0.0/24", "profile": "quick"}, depends_on=["s1"]),
                PipelineStep(id="s3", name="Vuln Sync", tool="netvision", action="vulnerabilities", params={}, depends_on=["s2"]),
            ],
        )
    )
    service.register(
        Pipeline(
            name="Exploit Chain",
            description="Harvest NetVision vulnerabilities -> search Metasploit module -> gated exploit run",
            steps=[
                PipelineStep(id="s1", name="Harvest Vulns", tool="netvision", action="vulnerabilities", params={"device": "10.0.0.0/24"}),
                PipelineStep(id="s2", name="Metasploit Module Search", tool="metasploit", action="search", params={"query": "exploit", "type": "exploit"}, depends_on=["s1"]),
                PipelineStep(id="s3", name="Exploit Run", tool="metasploit", action="run_module", params={"module": "exploit/multi/handler", "options": {}}, gate=True, depends_on=["s2"]),
            ],
        )
    )
    service.register(
        Pipeline(
            name="OSINT Enrichment",
            description="God's Eye View live intel feeds for target area",
            steps=[
                PipelineStep(id="s1", name="Weather Brief", tool="godseye", action="weather", params={"area": "target"}),
                PipelineStep(id="s2", name="Flights Track", tool="godseye", action="flights", params={"area": "target"}, depends_on=["s1"]),
            ],
        )
    )


pipeline_service = PipelineService()
register_builtin_pipelines(pipeline_service)
