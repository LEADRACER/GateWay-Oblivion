"""
GateWay:Oblivion — Operations Service

Manages security operations: runbooks, execution tracking,
command execution, and operation logs.

Operation types:
  - scan:     Trigger a NetVision scan (target + profile)
  - command:  Execute a shell command (ping, nslookup, nmap, etc.)
  - runbook:  Multi-step sequence of operations
  - manual:   External operation tracking (pentest step, report, etc.)
"""

import uuid
import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Optional
from dataclasses import dataclass, field

from pydantic import BaseModel, Field

logger = logging.getLogger("oblivion.operations")


# ── Pydantic Models ─────────────────────────────────────────────────

class OperationBase(BaseModel):
    name: str
    operation_type: str = "manual"  # scan | command | runbook | manual
    target_id: Optional[str] = None
    target_ref: Optional[str] = None  # IP, hostname, or CIDR
    parameters: dict[str, Any] = {}

class OperationCreate(OperationBase):
    pass

class OperationLog(BaseModel):
    id: str
    timestamp: str
    level: str = "info"  # info | warn | error | debug | result
    message: str
    data: dict[str, Any] = {}

class Operation(OperationBase):
    id: str
    status: str = "pending"  # pending | running | completed | failed | cancelled
    progress: int = 0  # 0-100
    started_by: str = "operator"
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_seconds: Optional[float] = None
    result_summary: Optional[str] = None
    logs: list[OperationLog] = []
    created_at: str
    updated_at: str


# ── Runbook Definitions ────────────────────────────────────────────

@dataclass
class RunbookStep:
    name: str
    operation_type: str
    description: str
    parameters: dict[str, Any]
    timeout: int = 300

@dataclass
class Runbook:
    name: str
    description: str
    steps: list[RunbookStep]

RUNBOOKS: list[Runbook] = [
    Runbook(
        name="Quick Recon",
        description="Fast scan of a target — ping sweep, top ports, service detection",
        steps=[
            RunbookStep(name="Ping Sweep", operation_type="command",
                        description="Check if target is alive", parameters={"command": "ping", "count": 4}),
            RunbookStep(name="Port Scan", operation_type="scan",
                        description="Scan top 1000 ports", parameters={"profile": "quick"}),
            RunbookStep(name="Service Detection", operation_type="command",
                        description="Identify running services", parameters={"command": "nmap", "flags": "-sV"}),
        ],
    ),
    Runbook(
        name="Full Infrastructure Audit",
        description="Comprehensive audit — deep scan, OS detection, vulnerability check",
        steps=[
            RunbookStep(name="Deep Scan", operation_type="scan",
                        description="Full port range scan with OS detection",
                        parameters={"profile": "deep"}),
            RunbookStep(name="Vulnerability Sync", operation_type="scan",
                        description="Pull vulnerabilities from NetVision",
                        parameters={"profile": "vuln-scan"}),
            RunbookStep(name="Service Enumeration", operation_type="command",
                        description="Enumerate all services with versions",
                        parameters={"command": "nmap", "flags": "-sV -sC"}),
        ],
    ),
    Runbook(
        name="Compliance Check",
        description="Check security posture — open ports, weak services, common CVEs",
        steps=[
            RunbookStep(name="Port Audit", operation_type="command",
                        description="List all open ports", parameters={"command": "nmap", "flags": "-p-"}),
            RunbookStep(name="Service Audit", operation_type="command",
                        description="Check for weak services", parameters={"command": "nmap", "flags": "-sV --script vuln"}),
            RunbookStep(name="CVE Correlation", operation_type="command",
                        description="Cross-reference CVEs against asset inventory",
                        parameters={"command": "vuln-scan"}),
        ],
    ),
    Runbook(
        name="Emergency Response",
        description="Immediate actions for active incident — block, capture, analyze",
        steps=[
            RunbookStep(name="Packet Capture", operation_type="command",
                        description="Start live packet capture on target",
                        parameters={"command": "tcpdump", "count": 100}),
            RunbookStep(name="Connection Audit", operation_type="command",
                        description="List active connections", parameters={"command": "ss", "flags": "-tuln"}),
            RunbookStep(name="IOC Check", operation_type="command",
                        description="Check for known IOCs", parameters={"command": "ioc-scan"}),
        ],
    ),
]


# ── Operations Store ───────────────────────────────────────────────

class OperationsStore:
    def __init__(self):
        self._operations: dict[str, Operation] = {}
        self._seed_data()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _seed_data(self):
        now = self._now()
        ops = [
            Operation(
                id=str(uuid.uuid4()),
                name="DMZ Host Scan",
                operation_type="scan",
                target_ref="10.0.0.50",
                parameters={"profile": "quick"},
                status="completed",
                progress=100,
                started_at=datetime.fromtimestamp(datetime.fromisoformat(now).timestamp() - 86400).isoformat(),
                completed_at=now,
                duration_seconds=245.3,
                result_summary="Discovered 3 devices, 14 open ports, 2 vulnerabilities",
                logs=[
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="info",
                                 message="Scan initialized"),
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="info",
                                 message="Scanning 10.0.0.0/24..."),
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="result",
                                 message="14 open ports found across 3 devices"),
                ],
                created_at=now, updated_at=now,
            ),
            Operation(
                id=str(uuid.uuid4()),
                name="Infrastructure Check — Q3",
                operation_type="runbook",
                target_ref="10.0.1.0/24",
                parameters={"runbook": "Full Infrastructure Audit"},
                status="running",
                progress=45,
                started_at=datetime.fromtimestamp(datetime.fromisoformat(now).timestamp() - 3600).isoformat(),
                result_summary="Phase 2/3 complete — running service enumeration",
                logs=[
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="info",
                                 message="Runbook started: Full Infrastructure Audit"),
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="info",
                                 message="Step 1: Deep Scan completed (32 devices)"),
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="info",
                                 message="Step 2: Vulnerability Sync in progress (45%)"),
                ],
                created_at=now, updated_at=now,
            ),
            Operation(
                id=str(uuid.uuid4()),
                name="CVE-2024-21626 — Investigation",
                operation_type="manual",
                target_ref="10.0.1.10",
                parameters={"cve": "CVE-2024-21626", "related_target": "Web Server Alpha"},
                status="completed",
                progress=100,
                completed_at=now,
                duration_seconds=7200,
                result_summary="Confirmed: runc version 1.1.11 on host. Patched to 1.1.12.",
                logs=[
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="info",
                                 message="Investigation started"),
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="info",
                                 message="runc version check: 1.1.11 (vulnerable)"),
                    OperationLog(id=str(uuid.uuid4()), timestamp=now, level="result",
                                 message="Updated runc to 1.1.12. Host reboot scheduled."),
                ],
                created_at=now, updated_at=now,
            ),
        ]
        for op in ops:
            self._operations[op.id] = op

    def list_operations(
        self,
        operation_type: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 50,
    ) -> list[Operation]:
        results = list(self._operations.values())
        if operation_type:
            results = [o for o in results if o.operation_type == operation_type]
        if status:
            results = [o for o in results if o.status == status]
        if search:
            q = search.lower()
            results = [o for o in results if q in o.name.lower() or (o.target_ref and q in o.target_ref)]
        return sorted(results, key=lambda o: o.created_at, reverse=True)[:limit]

    def get_operation(self, op_id: str) -> Optional[Operation]:
        return self._operations.get(op_id)

    def create_operation(self, data: OperationCreate) -> Operation:
        now = self._now()
        op = Operation(
            id=str(uuid.uuid4()),
            **data.model_dump(),
            started_at=now if data.operation_type != "manual" else None,
            created_at=now,
            updated_at=now,
        )
        self._operations[op.id] = op
        return op

    def add_log(self, op_id: str, level: str, message: str, data: dict = None) -> Optional[Operation]:
        op = self._operations.get(op_id)
        if not op:
            return None
        log = OperationLog(
            id=str(uuid.uuid4()),
            timestamp=self._now(),
            level=level,
            message=message,
            data=data or {},
        )
        op.logs.append(log)
        op.updated_at = self._now()
        return op

    def update_status(self, op_id: str, status: str, progress: int = None,
                      result_summary: str = None) -> Optional[Operation]:
        op = self._operations.get(op_id)
        if not op:
            return None
        op.status = status
        op.progress = progress if progress is not None else op.progress
        if result_summary is not None:
            op.result_summary = result_summary
        if status == "completed" or status == "failed":
            op.completed_at = self._now()
            if op.started_at:
                try:
                    start = datetime.fromisoformat(op.started_at)
                    end = datetime.fromisoformat(op.completed_at)
                    op.duration_seconds = (end - start).total_seconds()
                except (ValueError, TypeError):
                    pass
        op.updated_at = self._now()
        return op

    def cancel_operation(self, op_id: str) -> Optional[Operation]:
        return self.update_status(op_id, "cancelled", result_summary="Cancelled by operator")

    def delete_operation(self, op_id: str) -> bool:
        if op_id not in self._operations:
            return False
        del self._operations[op_id]
        return True

    def get_logs(self, op_id: str) -> list[OperationLog]:
        op = self._operations.get(op_id)
        if not op:
            return []
        return op.logs

    def stats(self) -> dict:
        ops = list(self._operations.values())
        return {
            "total": len(ops),
            "running": sum(1 for o in ops if o.status == "running"),
            "pending": sum(1 for o in ops if o.status == "pending"),
            "completed": sum(1 for o in ops if o.status == "completed"),
            "failed": sum(1 for o in ops if o.status == "failed"),
            "cancelled": sum(1 for o in ops if o.status == "cancelled"),
            "by_type": {
                "scan": sum(1 for o in ops if o.operation_type == "scan"),
                "command": sum(1 for o in ops if o.operation_type == "command"),
                "runbook": sum(1 for o in ops if o.operation_type == "runbook"),
                "manual": sum(1 for o in ops if o.operation_type == "manual"),
            },
            "recent_completed": sum(
                1 for o in ops if o.status == "completed" and o.completed_at
            ),
        }


# ── Execution Engine ───────────────────────────────────────────────

class OperationExecutor:
    """Simulates operation execution. In production, this dispatches
    to NetVision (scans), shell commands, or runbook orchestrators."""

    def __init__(self, store: OperationsStore, netvision_client=None, ws_manager=None):
        self.store = store
        self.nv_client = netvision_client
        self.ws_manager = ws_manager

    async def execute_scan(self, op_id: str, params: dict, target_ref: str):
        """Execute a scan operation -> dispatches to NetVision."""
        self.store.add_log(op_id, "info", f"Scan dispatch: {target_ref}")
        self.store.update_status(op_id, "running", progress=10)

        if self.nv_client and target_ref:
            try:
                await self.nv_client.trigger_scan(
                    target=target_ref,
                    profile=params.get("profile", "quick"),
                )
                self.store.add_log(op_id, "info", f"Scan triggered on NetVision: {target_ref}")
                self.store.update_status(op_id, "running", progress=50)
            except Exception as e:
                self.store.add_log(op_id, "error", f"NetVision scan failed: {e}")
                self.store.update_status(op_id, "failed", result_summary=str(e))
                return

        # Simulate scan progress
        for i in range(3):
            await asyncio.sleep(1)
            progress = 50 + (i + 1) * 15
            self.store.update_status(op_id, "running", progress=min(progress, 95))
            self.store.add_log(op_id, "info", f"Scan progress: {min(progress, 95)}%")

        self.store.add_log(op_id, "result", f"Scan completed for {target_ref}")
        self.store.update_status(op_id, "completed", progress=100,
                                 result_summary=f"Scan finished: {target_ref}")

    async def execute_command(self, op_id: str, params: dict, target_ref: Optional[str] = None):
        """Execute a command operation."""
        cmd = params.get("command", "ping")
        self.store.add_log(op_id, "info", f"Executing command: {cmd}")

        if target_ref and cmd == "ping":
            self.store.update_status(op_id, "running", progress=30)
            try:
                proc = await asyncio.create_subprocess_exec(
                    "ping", "-c", str(params.get("count", 4)), "-W", "2", target_ref,
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
                output = stdout.decode() if stdout else stderr.decode() if stderr else "No output"
                self.store.add_log(op_id, "result", f"Command output:\n{output[:2000]}")
                self.store.update_status(op_id, "completed", progress=100,
                                         result_summary=f"ping {target_ref}: exit {proc.returncode}")
            except asyncio.TimeoutError:
                self.store.add_log(op_id, "error", "Command timed out")
                self.store.update_status(op_id, "failed", result_summary="Timeout")
            except Exception as e:
                self.store.add_log(op_id, "error", f"Command failed: {e}")
                self.store.update_status(op_id, "failed", result_summary=str(e))
        else:
            # Simulate for other commands
            await asyncio.sleep(2)
            self.store.add_log(op_id, "result", f"Command '{cmd}' completed (simulated)")
            self.store.update_status(op_id, "completed", progress=100,
                                     result_summary=f"Simulated: {cmd}")


# ── Singleton ──────────────────────────────────────────────────────

ops_store = OperationsStore()
ops_executor = OperationExecutor(ops_store)
