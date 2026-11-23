"""Engagement lifecycle service — CRUD, state machines, guardrails and metrics.

All data is stored in the embedded SQLite DB. Every API mutation is audited by
the caller (main.py); this service contains only domain logic and persistence.
"""

import ipaddress
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

try:
    from models.engagement import (
        ENGAGEMENT_STATES, TRANSITIONS, TASK_STATES, FINDING_STATES,
        CanonicalEngagement, CanonicalScope, CanonicalRoE, CanonicalTask,
        CanonicalFinding, CanonicalEvidence, CanonicalApproval, CanonicalReport,
    )
except ImportError:
    from backend.models.engagement import (
        ENGAGEMENT_STATES, TRANSITIONS, TASK_STATES, FINDING_STATES,
        CanonicalEngagement, CanonicalScope, CanonicalRoE, CanonicalTask,
        CanonicalFinding, CanonicalEvidence, CanonicalApproval, CanonicalReport,
    )
from services.local_db import local_db

logger = logging.getLogger("oblivion.engagement")

ENTITY_CLASSES = {
    "engagement": CanonicalEngagement,
    "scope": CanonicalScope,
    "roe": CanonicalRoE,
    "task": CanonicalTask,
    "finding": CanonicalFinding,
    "evidence": CanonicalEvidence,
    "approval": CanonicalApproval,
    "report": CanonicalReport,
}

DESTRUCTIVE_ACTIONS = {
    "run_module", "trigger_scan", "sonar_scan", "nuclei_scan", "port_scan",
    "c2_command", "netexec_run", "caldera_start_operation", "atomic_run",
    "create_case", "capture_start", "full_scan",
}


class EngagementError(Exception):
    def __init__(self, message: str, code: int = 403):
        super().__init__(message)
        self.code = code


class EngagementService:
    def __init__(self, db=None):
        self.db = db or local_db

    # ── generic persistence helpers ──────────────────────────────

    @staticmethod
    def _id(prefix: str) -> str:
        return f"{prefix}-{uuid.uuid4().hex[:12]}"

    def _save(self, kind: str, model) -> dict:
        data = model.model_dump()
        engagement_id = data.get("engagement_id") or data.get("id")
        self.db.upsert_entity(
            kind, model.id, engagement_id, data,
            state=data.get("state"),
            severity=data.get("severity"),
            status=data.get("status"),
        )
        return data

    def _get(self, kind: str, entity_id: str):
        data = self.db.get_entity(kind, entity_id)
        return ENTITY_CLASSES[kind](**data) if data else None

    def _list(self, kind: str, engagement_id: Optional[str] = None, limit: int = 200) -> list:
        return [ENTITY_CLASSES[kind](**data) for data in
                self.db.list_entities(kind, engagement_id, limit)]

    # ── engagements ──────────────────────────────────────────────

    def create_engagement(self, data: dict, actor: str) -> CanonicalEngagement:
        now = datetime.now(timezone.utc)
        count = len(self._list("engagement"))
        code = data.get("code") or f"ENG-{now.year}-{count + 1:03d}"
        engagement = CanonicalEngagement(
            id=self._id("eng"),
            code=code,
            name=data.get("name") or f"Engagement {code}",
            objective=data.get("objective", ""),
            engagement_type=data.get("engagement_type", "red"),
            priority=data.get("priority", "medium"),
            lead_operator=data.get("lead_operator") or actor,
            team=data.get("team") or [actor],
            client=data.get("client"),
            start_at=data.get("start_at"),
            end_at=data.get("end_at"),
        )
        self._save("engagement", engagement)
        return engagement

    def get_engagement(self, engagement_id: str) -> Optional[CanonicalEngagement]:
        return self._get("engagement", engagement_id)

    def list_engagements(self, state: Optional[str] = None,
                         engagement_type: Optional[str] = None,
                         lead: Optional[str] = None) -> list:
        rows = self._list("engagement")
        if state:
            rows = [r for r in rows if r.state == state]
        if engagement_type:
            rows = [r for r in rows if r.engagement_type == engagement_type]
        if lead:
            rows = [r for r in rows if r.lead_operator == lead]
        return sorted(rows, key=lambda r: r.updated_at, reverse=True)

    def update_engagement(self, engagement_id: str, data: dict) -> CanonicalEngagement:
        engagement = self.get_engagement(engagement_id)
        if not engagement:
            raise EngagementError("Engagement not found", 404)
        for field in ("name", "objective", "priority", "client", "start_at", "end_at", "team"):
            if field in data:
                setattr(engagement, field, data[field])
        engagement.updated_at = datetime.now(timezone.utc).isoformat()
        self._save("engagement", engagement)
        return engagement

    def transition(self, engagement_id: str, to: str, actor: str,
                   reason: str = "") -> CanonicalEngagement:
        engagement = self.get_engagement(engagement_id)
        if not engagement:
            raise EngagementError("Engagement not found", 404)
        if to not in ENGAGEMENT_STATES:
            raise EngagementError(f"Invalid state: {to}", 400)
        if to not in TRANSITIONS.get(engagement.state, set()):
            raise EngagementError(
                f"Cannot transition {engagement.state} → {to}", 409
            )
        if to == "authorized":
            roe = self.get_roe(engagement_id)
            scope = self.get_scope(engagement_id)
            if not roe or not roe.signed:
                raise EngagementError("A signed Rules of Engagement is required")
            if not scope or not scope.include:
                raise EngagementError("An explicit include scope is required")
        if to == "active" and not engagement.team:
            raise EngagementError("At least one operator must be assigned")
        if to in ("aborted", "cancelled") and not reason:
            raise EngagementError("A reason is required for abort/cancel", 400)

        engagement.state = to
        engagement.updated_at = datetime.now(timezone.utc).isoformat()
        self._save("engagement", engagement)
        logger.info("Engagement %s transitioned %s → %s by %s", engagement.code,
                    engagement.state, to, actor)
        return engagement

    def abort(self, engagement_id: str, actor: str, reason: str) -> CanonicalEngagement:
        return self.transition(engagement_id, "aborted", actor, reason)

    def require_active(self, engagement_id: str, actor: str = "operator") -> CanonicalEngagement:
        """Lightweight state check for pipeline runs (no tool/action scope)."""
        engagement = self.get_engagement(engagement_id)
        if not engagement:
            raise EngagementError("Engagement not found", 404)
        if engagement.state != "active":
            raise EngagementError(
                f"Engagement is {engagement.state.upper()} — must be ACTIVE", 409
            )
        return engagement

    def record_approval(self, engagement_id: str, action: str, target: str,
                        actor: str, reason: str = "", decision: str = "approved") -> CanonicalApproval:
        """Approval for a gated pipeline step (not tied to a specific task)."""
        approval = CanonicalApproval(
            id=self._id("appr"),
            engagement_id=engagement_id,
            requested_by="pipeline",
            approved_by=actor,
            action=action,
            target=str(target or ""),
            reason=reason,
            decision=decision,
        )
        self._save("approval", approval)
        return approval

    def has_approval(self, engagement_id: str, action: str, target: str = "") -> bool:
        return any(
            a.get("decision") == "approved"
            and a.get("action") == action
            and (not a.get("target") or a.get("target") == str(target))
            for a in self.db.list_entities("approval", engagement_id)
        )

    # ── scope & RoE ──────────────────────────────────────────────

    def set_scope(self, engagement_id: str, data: dict) -> CanonicalScope:
        existing = self.get_scope(engagement_id)
        scope = existing or CanonicalScope(
            id=self._id("scope"), engagement_id=engagement_id
        )
        for field in ("include", "exclude", "allowed_tools", "allowed_actions",
                      "forbidden_actions", "time_windows", "max_rate", "data_handling"):
            if field in data:
                setattr(scope, field, data[field])
        scope.updated_at = datetime.now(timezone.utc).isoformat()
        self._save("scope", scope)
        engagement = self.get_engagement(engagement_id)
        if engagement:
            engagement.scope_id = scope.id
            self._save("engagement", engagement)
        return scope

    def get_scope(self, engagement_id: str) -> Optional[CanonicalScope]:
        rows = self._list("scope", engagement_id, limit=1)
        return rows[0] if rows else None

    def set_roe(self, engagement_id: str, data: dict) -> CanonicalRoE:
        existing = self.get_roe(engagement_id)
        roe = existing or CanonicalRoE(id=self._id("roe"), engagement_id=engagement_id)
        for field in ("authorized_by", "document_ref", "emergency_contacts",
                      "stop_conditions", "legal_notes", "version"):
            if field in data:
                setattr(roe, field, data[field])
        roe.signed = bool(data.get("signed", roe.signed))
        self._save("roe", roe)
        engagement = self.get_engagement(engagement_id)
        if engagement:
            engagement.roe_id = roe.id
            self._save("engagement", engagement)
        return roe

    def get_roe(self, engagement_id: str) -> Optional[CanonicalRoE]:
        rows = self._list("roe", engagement_id, limit=1)
        return rows[0] if rows else None

    def sign_roe(self, engagement_id: str, actor: str) -> CanonicalRoE:
        roe = self.get_roe(engagement_id)
        if not roe:
            raise EngagementError("RoE not found — create it first", 404)
        roe.signed = True
        roe.authorized_by = actor
        roe.authorized_at = datetime.now(timezone.utc).isoformat()
        self._save("roe", roe)
        return roe

    # ── tasks ────────────────────────────────────────────────────

    def add_task(self, engagement_id: str, data: dict) -> CanonicalTask:
        task = CanonicalTask(
            id=self._id("task"),
            engagement_id=engagement_id,
            title=data.get("title") or "Untitled task",
            technique=data.get("technique"),
            tool=data.get("tool"),
            action=data.get("action"),
            params=data.get("params") or {},
            depends_on=data.get("depends_on") or [],
            gate=bool(data.get("gate", False)),
            owner=data.get("owner"),
            status=data.get("status", "planned"),
        )
        self._save("task", task)
        return task

    def update_task(self, engagement_id: str, task_id: str, data: dict) -> CanonicalTask:
        task = self._get("task", task_id)
        if not task or task.engagement_id != engagement_id:
            raise EngagementError("Task not found", 404)
        if "status" in data:
            if data["status"] not in TASK_STATES:
                raise EngagementError("Invalid task status", 400)
            if task.gate and data["status"] in ("executing", "done"):
                approvals = self.db.list_entities("approval", engagement_id)
                approved = any(
                    a.get("action") == (task.action or "") and a.get("decision") == "approved"
                    for a in approvals
                )
                if not approved:
                    raise EngagementError("Gated task requires approval")
        for field in ("title", "status", "owner", "params", "pipeline_run_id"):
            if field in data:
                setattr(task, field, data[field])
        task.updated_at = datetime.now(timezone.utc).isoformat()
        self._save("task", task)
        return task

    def list_tasks(self, engagement_id: str) -> list:
        return self._list("task", engagement_id)

    def approve_task(self, engagement_id: str, task_id: str, actor: str,
                     decision: str = "approved", reason: str = "") -> CanonicalApproval:
        task = self._get("task", task_id)
        if not task or task.engagement_id != engagement_id:
            raise EngagementError("Task not found", 404)
        approval = CanonicalApproval(
            id=self._id("appr"),
            engagement_id=engagement_id,
            requested_by=task.owner or "operator",
            approved_by=actor,
            action=task.action or task.title,
            target=str(task.params.get("target") or ""),
            reason=reason,
            decision=decision,
        )
        self._save("approval", approval)
        return approval

    # ── findings & evidence ──────────────────────────────────────

    def add_finding(self, engagement_id: str, data: dict) -> CanonicalFinding:
        finding = CanonicalFinding(
            id=self._id("find"),
            engagement_id=engagement_id,
            title=data.get("title") or "Untitled finding",
            task_id=data.get("task_id"),
            severity=data.get("severity", "info"),
            cvss_score=data.get("cvss_score"),
            cve_id=data.get("cve_id"),
            source_tool=data.get("source_tool", "unknown"),
            raw=data.get("raw") or {},
            remediation=data.get("remediation"),
        )
        self._save("finding", finding)
        engagement = self.get_engagement(engagement_id)
        if engagement:
            engagement.findings_count = len(self.list_findings(engagement_id))
            engagement.risk_score = self._risk_score(engagement_id)
            self._save("engagement", engagement)
        return finding

    def update_finding_status(self, engagement_id: str, finding_id: str,
                              status: str, owner: str = "") -> CanonicalFinding:
        finding = self._get("finding", finding_id)
        if not finding or finding.engagement_id != engagement_id:
            raise EngagementError("Finding not found", 404)
        if status not in FINDING_STATES:
            raise EngagementError("Invalid finding status", 400)
        finding.status = status
        if owner:
            finding.owner = owner
        self._save("finding", finding)
        return finding

    def list_findings(self, engagement_id: str, severity: str | None = None) -> list:
        rows = self._list("finding", engagement_id)
        if severity:
            rows = [r for r in rows if r.severity == severity]
        return rows

    def add_evidence(self, engagement_id: str, data: dict) -> CanonicalEvidence:
        evidence = CanonicalEvidence(
            id=self._id("ev"),
            engagement_id=engagement_id,
            finding_id=data.get("finding_id"),
            kind=data.get("kind", "output"),
            source_tool=data.get("source_tool", "unknown"),
            sha256=data.get("sha256", ""),
            path_or_hash=data.get("path_or_hash", ""),
            captured_by=data.get("captured_by", "operator"),
            metadata=data.get("metadata") or {},
        )
        self._save("evidence", evidence)
        return evidence

    def list_evidence(self, engagement_id: str) -> list:
        return self._list("evidence", engagement_id)

    def add_report(self, engagement_id: str, kind: str, path: str,
                   content: str = "") -> CanonicalReport:
        report = CanonicalReport(
            id=self._id("rep"), engagement_id=engagement_id,
            kind=kind, path=path, content=content,
        )
        self._save("report", report)
        return report

    def list_reports(self, engagement_id: str, kind: str | None = None) -> list:
        rows = self._list("report", engagement_id)
        if kind:
            rows = [row for row in rows if row.kind == kind]
        return rows

    # ── guard ────────────────────────────────────────────────────

    @staticmethod
    def _target_allowed(target: str, include: list, exclude: list) -> bool:
        target = (target or "").strip()
        if not target:
            return True

        def matches(value: str, pattern: str) -> bool:
            try:
                net = ipaddress.ip_network(pattern, strict=False)
                try:
                    return ipaddress.ip_address(value) in net
                except ValueError:
                    try:
                        return ipaddress.ip_network(value, strict=False).subnet_of(net)
                    except ValueError:
                        return False
            except ValueError:
                return value == pattern or value.endswith("." + pattern)

        if any(matches(target, item) for item in exclude):
            return False
        return any(matches(target, item) for item in include)

    @staticmethod
    def _time_allowed(windows: list[dict]) -> bool:
        if not windows:
            return True
        now = datetime.now(timezone.utc)
        for window in windows:
            if window.get("start") and window.get("end"):
                try:
                    start = datetime.fromisoformat(window["start"])
                    end = datetime.fromisoformat(window["end"])
                    if start.tzinfo is None:
                        start = start.replace(tzinfo=timezone.utc)
                    if end.tzinfo is None:
                        end = end.replace(tzinfo=timezone.utc)
                    if start <= now <= end:
                        return True
                except ValueError:
                    continue
            elif "start_hour" in window and "end_hour" in window:
                start, end = int(window["start_hour"]), int(window["end_hour"])
                if start <= now.hour < end:
                    return True
        return False

    def guard(self, engagement_id: str, tool: str, action: str,
              target: Optional[str], actor: str) -> CanonicalEngagement:
        engagement = self.get_engagement(engagement_id)
        if not engagement:
            raise EngagementError("Engagement not found", 404)
        if engagement.state == "aborted":
            raise EngagementError("Engagement was ABORTED — all actions blocked")
        if engagement.state != "active":
            raise EngagementError(
                f"Engagement is {engagement.state.upper()} — must be ACTIVE", 409
            )

        scope = self.get_scope(engagement_id)
        if not scope or not scope.include:
            raise EngagementError("No engagement scope defined")
        if target and not self._target_allowed(str(target), scope.include, scope.exclude):
            raise EngagementError("Target is outside engagement scope")

        roe = self.get_roe(engagement_id)
        if not roe or not roe.signed:
            raise EngagementError("Signed Rules of Engagement required")
        if not self._time_allowed(scope.time_windows):
            raise EngagementError("Current time is outside authorized window")

        if scope.allowed_tools and tool not in scope.allowed_tools:
            raise EngagementError(f"Tool '{tool}' not authorized for this engagement")
        if scope.allowed_actions and action not in scope.allowed_actions:
            raise EngagementError(f"Action '{action}' not authorized for this engagement")
        if action in scope.forbidden_actions:
            raise EngagementError(f"Action '{action}' is explicitly forbidden")

        if action in DESTRUCTIVE_ACTIONS:
            approvals = self.db.list_entities("approval", engagement_id)
            approved = any(
                a.get("decision") == "approved"
                and a.get("action") == action
                and (not a.get("target") or a.get("target") == str(target))
                for a in approvals
            )
            if not approved:
                raise EngagementError(
                    f"Action '{action}' requires explicit engagement approval"
                )
        return engagement

    # ── events & metrics ─────────────────────────────────────────

    def record_event(self, event) -> None:
        engagement_id = getattr(event, "engagement_id", None)
        if not engagement_id:
            return
        self.db.append_engagement_event(
            engagement_id, event.id, event.model_dump()
        )

    def list_events(self, engagement_id: str, limit: int = 100) -> list:
        return self.db.list_engagement_events(engagement_id, limit)

    def _risk_score(self, engagement_id: str) -> float:
        weights = {"critical": 10, "high": 6, "medium": 3, "low": 1, "info": 0}
        findings = self.db.list_entities("finding", engagement_id)
        return min(100.0, sum(weights.get(f.get("severity", "info"), 0) for f in findings))

    def refresh_progress(self, engagement_id: str) -> None:
        engagement = self.get_engagement(engagement_id)
        if not engagement:
            return
        tasks = self.list_tasks(engagement_id)
        done = sum(1 for task in tasks if task.status == "done")
        engagement.progress = round(done / len(tasks) * 100, 1) if tasks else 0.0
        engagement.updated_at = datetime.now(timezone.utc).isoformat()
        self._save("engagement", engagement)

    def metrics(self, engagement_id: str) -> dict:
        engagement = self.get_engagement(engagement_id)
        if not engagement:
            raise EngagementError("Engagement not found", 404)
        tasks = self.list_tasks(engagement_id)
        findings = self.list_findings(engagement_id)
        done = sum(1 for t in tasks if t.status == "done")
        severity = {level: sum(1 for f in findings if f.severity == level)
                    for level in ("critical", "high", "medium", "low", "info")}
        status = {level: sum(1 for t in tasks if t.status == level)
                  for level in TASK_STATES}
        return {
            "engagement_id": engagement_id,
            "code": engagement.code,
            "state": engagement.state,
            "progress": round(done / len(tasks) * 100, 1) if tasks else 0.0,
            "tasks_total": len(tasks),
            "task_status": status,
            "findings_total": len(findings),
            "findings_by_severity": severity,
            "risk_score": self._risk_score(engagement_id),
            "evidence_count": len(self.list_evidence(engagement_id)),
            "events_count": len(self.list_events(engagement_id, 500)),
        }


engagement_service = EngagementService()
