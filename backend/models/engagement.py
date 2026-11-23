"""Engagement data model — first-class red/purple team assessments."""

from datetime import datetime, timezone
from typing import Optional

from pydantic import BaseModel, Field

try:
    from models.canonical import CanonicalEvent
except ImportError:
    from backend.models.canonical import CanonicalEvent


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


ENGAGEMENT_STATES = (
    "draft", "authorized", "active", "paused", "completed", "archived", "cancelled", "aborted"
)
FINDING_STATES = ("new", "triaged", "confirmed", "remediated", "accepted-risk", "closed")
TASK_STATES = ("planned", "ready", "executing", "blocked", "done", "skipped")

TRANSITIONS = {
    "draft": {"authorized", "cancelled"},
    "authorized": {"active", "cancelled"},
    "active": {"paused", "completed", "aborted"},
    "paused": {"active", "aborted", "cancelled"},
    "completed": {"archived"},
    "archived": set(),
    "cancelled": set(),
    "aborted": set(),
}


class CanonicalScope(BaseModel):
    id: str
    engagement_id: str
    include: list[str] = Field(default_factory=list)
    exclude: list[str] = Field(default_factory=list)
    allowed_tools: list[str] = Field(default_factory=list)
    allowed_actions: list[str] = Field(default_factory=list)
    forbidden_actions: list[str] = Field(default_factory=list)
    time_windows: list[dict] = Field(default_factory=list)
    max_rate: Optional[int] = None
    data_handling: str = "internal"
    updated_at: str = Field(default_factory=_now)


class CanonicalRoE(BaseModel):
    id: str
    engagement_id: str
    version: int = 1
    authorized_by: str = ""
    authorized_at: str = Field(default_factory=_now)
    document_ref: Optional[str] = None
    emergency_contacts: list[dict] = Field(default_factory=list)
    stop_conditions: list[str] = Field(default_factory=list)
    legal_notes: Optional[str] = None
    signed: bool = False


class CanonicalEngagement(BaseModel):
    id: str
    code: str
    name: str
    objective: str = ""
    engagement_type: str = "red"
    state: str = "draft"
    priority: str = "medium"
    lead_operator: str = "operator"
    team: list[str] = Field(default_factory=list)
    client: Optional[str] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    scope_id: Optional[str] = None
    roe_id: Optional[str] = None
    risk_score: float = 0.0
    findings_count: int = 0
    progress: float = 0.0
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class CanonicalTask(BaseModel):
    id: str
    engagement_id: str
    title: str
    technique: Optional[str] = None
    tool: Optional[str] = None
    action: Optional[str] = None
    params: dict = Field(default_factory=dict)
    depends_on: list[str] = Field(default_factory=list)
    status: str = "planned"
    gate: bool = False
    owner: Optional[str] = None
    pipeline_run_id: Optional[str] = None
    created_at: str = Field(default_factory=_now)
    updated_at: str = Field(default_factory=_now)


class CanonicalFinding(BaseModel):
    id: str
    engagement_id: str
    title: str
    task_id: Optional[str] = None
    severity: str = "info"
    cvss_score: Optional[float] = None
    cve_id: Optional[str] = None
    status: str = "new"
    owner: Optional[str] = None
    evidence_ids: list[str] = Field(default_factory=list)
    remediation: Optional[str] = None
    source_tool: str = "unknown"
    raw: dict = Field(default_factory=dict)
    discovered_at: str = Field(default_factory=_now)


class CanonicalEvidence(BaseModel):
    id: str
    engagement_id: str
    finding_id: Optional[str] = None
    kind: str = "output"
    source_tool: str = "unknown"
    sha256: str = ""
    path_or_hash: str = ""
    captured_at: str = Field(default_factory=_now)
    captured_by: str = "operator"
    metadata: dict = Field(default_factory=dict)


class CanonicalApproval(BaseModel):
    id: str
    engagement_id: str
    requested_by: str
    approved_by: str
    action: str
    target: str
    reason: str = ""
    decision: str = "approved"
    decided_at: str = Field(default_factory=_now)


class CanonicalReport(BaseModel):
    id: str
    engagement_id: str
    kind: str = "executive"
    path: str = ""
    generated_at: str = Field(default_factory=_now)


ENTITIES = {
    "engagement": CanonicalEngagement,
    "scope": CanonicalScope,
    "roe": CanonicalRoE,
    "task": CanonicalTask,
    "finding": CanonicalFinding,
    "evidence": CanonicalEvidence,
    "approval": CanonicalApproval,
    "report": CanonicalReport,
}
