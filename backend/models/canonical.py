"""
GateWay:Oblivion — Canonical Data Model

Unified entities shared by every tool adapter, the event bus, pipelines and
reports. Tool outputs are normalized into these shapes so the dashboard and
orchestrator never depend on raw tool formats.

Every canonical entity carries provenance fields:
  - source_tool: which tool produced the data (netvision | metasploit | reconng | godseye | nvd | ...)
  - external_id: stable id assigned by the source tool
  - confidence: 0..1 confidence in the normalized value
"""

from pydantic import BaseModel, Field
from typing import Any, Optional
from datetime import datetime, timezone
import uuid


class CanonicalEvent(BaseModel):
    """Normalized cross-tool event flowing through the event bus."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    source_tool: str = "unknown"
    source_event_id: Optional[str] = None
    event_type: str = "info"
    severity: str = "info"
    title: Optional[str] = None
    description: Optional[str] = None
    payload: dict = Field(default_factory=dict)
    correlation_id: Optional[str] = None
    target_ref: Optional[str] = None


class CanonicalTarget(BaseModel):
    id: str
    name: str
    ip: Optional[str] = None
    source: str = "unknown"
    source_tool: str = "unknown"
    external_id: Optional[str] = None
    status: str = "active"
    tags: list = Field(default_factory=list)
    campaign_id: Optional[str] = None


class CanonicalFinding(BaseModel):
    id: str
    title: str
    severity: str = "info"
    source_tool: str
    raw: Any = None
    exploit_available: bool = False
    cvss_score: Optional[float] = None


class CanonicalHost(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    ip: Optional[str] = None
    mac: Optional[str] = None
    vendor: Optional[str] = None
    os: Optional[str] = None
    source_tool: str = "unknown"
    external_id: Optional[str] = None
    confidence: float = 0.0


class CanonicalService(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    host_id: Optional[str] = None
    ip: Optional[str] = None
    port: Optional[int] = None
    protocol: str = "tcp"
    service: Optional[str] = None
    version: Optional[str] = None
    source_tool: str = "unknown"
    external_id: Optional[str] = None
    confidence: float = 0.0


class CanonicalVulnerability(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    cve_id: Optional[str] = None
    title: Optional[str] = None
    severity: str = "info"
    cvss_score: Optional[float] = None
    affected_host: Optional[str] = None
    source_tool: str = "unknown"
    external_id: Optional[str] = None
    exploit_available: bool = False
    remediation: Optional[str] = None
    confidence: float = 0.0


class CanonicalCredential(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_tool: str = "unknown"
    kind: Optional[str] = None
    host: Optional[str] = None
    credential_ref: Optional[str] = None
    confidence: float = 0.0


class CanonicalSession(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_tool: str = "unknown"
    msf_session_id: Optional[str] = None
    exploit_module: Optional[str] = None
    target: Optional[str] = None
    state: str = "active"
    confidence: float = 0.0


class CanonicalArtifact(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    source_tool: str = "unknown"
    kind: str = "loot"
    name: Optional[str] = None
    size: Optional[int] = None
    sha256: Optional[str] = None
    path: Optional[str] = None
    confidence: float = 0.0


def canonical_event(
    source_tool: str,
    event_type: str,
    payload: Optional[dict] = None,
    **kwargs,
) -> CanonicalEvent:
    """Build a normalized CanonicalEvent, merging kwargs into the payload."""
    data: dict = dict(payload or {})
    clean: dict = {}
    for key, value in kwargs.items():
        if value is not None:
            clean[key] = value
            data[key] = value
    return CanonicalEvent(
        source_tool=source_tool,
        event_type=event_type,
        payload=data,
        **clean,  # type: ignore[arg-type]
    )
