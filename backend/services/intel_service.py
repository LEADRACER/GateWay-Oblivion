"""
GateWay:Oblivion — Intelligence & Reporting Service

Aggregates data from all Oblivion stores (targets, recon, vulns,
operations), generates reports, builds threat timelines, and
provides executive-summary endpoints.
"""

import uuid
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Optional
from dataclasses import dataclass, field

from pydantic import BaseModel, Field

try:
    from models.canonical import CanonicalEvent
except ImportError:
    from backend.models.canonical import CanonicalEvent

logger = logging.getLogger("oblivion.intel")


# ── Pydantic Models ─────────────────────────────────────────────────

class ReportCreate(BaseModel):
    title: str
    report_type: str = "executive"  # executive | technical | compliance | recon | operations
    scope: Optional[str] = None
    include_sections: list[str] = []

class Report(BaseModel):
    id: str
    title: str
    report_type: str
    scope: Optional[str] = None
    status: str = "draft"  # draft | finalized
    content: dict[str, Any] = {}
    summary: Optional[str] = None
    risk_score: Optional[float] = None
    generated_at: str
    created_at: str
    updated_at: str

class TimelineEvent(BaseModel):
    id: str
    timestamp: str
    event_type: str  # operation | vulnerability | scan | alert | target | recon | intel
    title: str
    description: Optional[str] = None
    severity: Optional[str] = None
    source: str
    related_id: Optional[str] = None


# Map a canonical tool action (e.g. "netvision.vulnerabilities" -> action
# "vulnerabilities") onto a UI-friendly timeline category.
def canonical_to_timeline(event: CanonicalEvent) -> TimelineEvent:
    etype = event.event_type or "info"
    action = etype.split(".", 1)[1].lower() if "." in etype else etype.lower()

    if "cve" in action or action.startswith(("vuln", "finding", "exploit")):
        category = "vulnerability"
    elif action.startswith(("scan", "trigger", "stop", "device", "service", "port", "topology", "host", "network", "probe", "recon")):
        category = "scan"
    elif action.startswith(("module", "modules", "recon", "search", "enum", "footprint", "subdom")):
        category = "recon"
    elif action.startswith(("session", "run", "version", "exec", "command", "init", "load", "extract", "report", "handler")):
        category = "operation"
    elif action.startswith(("weather", "flight", "satellite", "cctv", "cyclone", "military", "fire", "earthquake", "imagery", "situation", "geocode", "maritime", "naval", "space", "intel", "threat", "earth_", "quake_")):
        category = "intel"
    elif action.startswith(("target", "asset", "host", "ip", "domain", "email", "credential", "user", "org")):
        category = "target"
    else:
        category = "operation"

    description: Optional[str] = event.description
    if not description and event.payload:
        description = json.dumps(event.payload, default=str)[:300]

    return TimelineEvent(
        id=event.id,
        timestamp=event.timestamp,
        event_type=category,
        title=event.title or f"{event.source_tool} {action}",
        description=description,
        severity=event.severity or None,
        source=event.source_tool,
        related_id=event.target_ref,
    )


# ── Report Formats ──────────────────────────────────────────────────

REPORT_FORMATS = {
    "executive": {
        "label": "Executive Summary",
        "description": "High-level overview for management — risk score, critical findings, trends",
        "sections": ["overview", "risk_summary", "critical_findings", "trends", "recommendations"],
    },
    "technical": {
        "label": "Technical Report",
        "description": "Detailed breakdown for engineers — CVEs, affected systems, remediation",
        "sections": ["overview", "vulnerability_details", "affected_systems", "exploitability", "remediation"],
    },
    "compliance": {
        "label": "Compliance Report",
        "description": "Security posture mapped to standards — PCI-DSS, SOC2, HIPAA",
        "sections": ["overview", "control_mapping", "gaps", "remediation_plan"],
    },
    "recon": {
        "label": "Reconnaissance Report",
        "description": "Network reconnaissance findings — assets, ports, services, topology",
        "sections": ["overview", "asset_inventory", "service_map", "topology", "observations"],
    },
    "operations": {
        "label": "Operations Log",
        "description": "Complete log of all operations executed, results, timeline",
        "sections": ["overview", "operation_log", "success_rate", "timeline", "findings"],
    },
}


# ── Intel Store ──────────────────────────────────────────────────────

class IntelStore:
    def __init__(self):
        self._reports: dict[str, Report] = {}
        self._seed_data()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _seed_data(self):
        now = self._now()
        past = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
        two_days = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

        self._reports = {
            "report-seed-001": Report(
                id="report-seed-001",
                title="Q4 Security Assessment — Executive Summary",
                report_type="executive",
                scope="10.0.0.0/16 infrastructure",
                status="finalized",
                summary="Critical risk score of 8.2 identified across 47 vulnerabilities. "
                        "3 critical CVEs require immediate attention: CVE-2024-21626 (runc), "
                        "CVE-2024-3094 (xz backdoor), and CVE-2024-1708 (ScreenConnect). "
                        "14 hosts exposed to the internet. Recommended: patch registry within 72 hours.",
                risk_score=8.2,
                generated_at=two_days,
                content={
                    "overview": "Assessment of 10.0.0.0/16 completed. 47 vulns found across 32 hosts.",
                    "risk_summary": {"critical": 3, "high": 11, "medium": 18, "low": 15},
                    "critical_findings": [
                        {"cve": "CVE-2024-21626", "title": "runc container escape", "host": "10.0.1.10"},
                        {"cve": "CVE-2024-3094", "title": "xz/liblzma backdoor", "host": "10.0.2.5"},
                        {"cve": "CVE-2024-1708", "title": "ScreenConnect auth bypass", "host": "10.0.3.8"},
                    ],
                    "recommendations": [
                        "Patch runc to v1.1.12 on all container hosts",
                        "Update xz to v5.6.1+ across all systems",
                        "Isolate ScreenConnect servers until patched",
                    ],
                },
                created_at=past, updated_at=two_days,
            ),
            "report-seed-002": Report(
                id="report-seed-002",
                title="DMZ Reconnaissance — Technical Report",
                report_type="technical",
                scope="10.0.0.0/24",
                status="finalized",
                summary="14 hosts discovered in DMZ. 43 open ports. 12 vulnerabilities identified. "
                        "3 hosts running outdated SSH versions. Apache 2.4.41 found on 2 hosts with known CVEs.",
                risk_score=6.8,
                generated_at=past,
                content={
                    "overview": "DMZ scan completed. 14 live hosts.",
                    "vulnerability_details": [
                        {"cve": "CVE-2023-39425", "title": "Apache mod_proxy SSRF", "hosts": ["10.0.0.5", "10.0.0.12"]},
                        {"cve": "CVE-2024-6387", "title": "regreSSHion", "hosts": ["10.0.0.8"]},
                    ],
                    "affected_systems": [
                        {"host": "10.0.0.5", "os": "Ubuntu 22.04", "ports": [80, 443, 22, 3306]},
                        {"host": "10.0.0.8", "os": "Debian 11", "ports": [22, 8080]},
                    ],
                },
                created_at=past, updated_at=past,
            ),
        }

    # ── Report Operations ─────────────────────────────────────────

    def list_reports(self, report_type: Optional[str] = None, limit: int = 20) -> list[Report]:
        results = list(self._reports.values())
        if report_type:
            results = [r for r in results if r.report_type == report_type]
        return sorted(results, key=lambda r: r.created_at, reverse=True)[:limit]

    def get_report(self, report_id: str) -> Optional[Report]:
        return self._reports.get(report_id)

    def get_report_content(self, report_id: str) -> Optional[dict]:
        report = self._reports.get(report_id)
        if not report:
            return None
        return report.content

    def delete_report(self, report_id: str) -> bool:
        if report_id not in self._reports:
            return False
        del self._reports[report_id]
        return True

    # ── Dynamic Report Generation ─────────────────────────────────

    def generate_report(self, data: ReportCreate, vuln_store=None, ops_store=None) -> Report:
        now = self._now()
        report_id = str(uuid.uuid4())

        # Gather data from other stores
        vuln_stats = {}
        vuln_list = []
        if vuln_store:
            vuln_stats = vuln_store.stats() if hasattr(vuln_store, 'stats') else {}
            vuln_list = vuln_store.list_vulnerabilities(limit=50) if hasattr(vuln_store, 'list_vulnerabilities') else []

        ops_stats = {}
        ops_list = []
        if ops_store:
            ops_stats = ops_store.stats() if hasattr(ops_store, 'stats') else {}
            ops_list = ops_store.list_operations(limit=20) if hasattr(ops_store, 'list_operations') else []

        # Build content based on report type
        content = self._build_report_content(data.report_type, vuln_stats, vuln_list, ops_stats, ops_list)

        total_vulns = vuln_stats.get("by_severity", {}).get("total", 0) if isinstance(vuln_stats.get("by_severity"), dict) else 0
        risk_score = self._calculate_risk_score(vuln_stats, vuln_list)

        report = Report(
            id=report_id,
            title=data.title,
            report_type=data.report_type,
            scope=data.scope,
            content=content,
            risk_score=risk_score,
            summary=self._generate_summary(data.report_type, content, risk_score, total_vulns),
            generated_at=now,
            created_at=now,
            updated_at=now,
        )

        self._reports[report_id] = report
        return report

    def _build_report_content(self, report_type: str,
                              vuln_stats: dict, vuln_list: list,
                              ops_stats: dict, ops_list: list) -> dict:
        base = {
            "generated_at": self._now(),
            "report_type": report_type,
            "total_vulnerabilities": len(vuln_list),
            "total_operations": ops_stats.get("total", 0),
        }

        if report_type == "executive":
            by_severity = vuln_stats.get("by_severity", {})
            if isinstance(by_severity, dict):
                total = by_severity.get("total", 0)
            else:
                total = 0
            return {
                **base,
                "overview": f"Assessment completed. {len(vuln_list)} vulnerabilities found.",
                "risk_summary": {
                    "critical": vuln_stats.get("critical", 0),
                    "high": vuln_stats.get("high", 0),
                    "medium": vuln_stats.get("medium", 0),
                    "low": vuln_stats.get("low", 0),
                } if isinstance(vuln_stats.get("critical"), (int, float)) else {},
                "critical_findings": [
                    {"cve": v.cve_id, "title": v.title, "severity": v.severity}
                    for v in vuln_list[:5] if hasattr(v, 'severity') and v.severity in ("critical", "high")
                ],
                "recommendations": [
                    "Patch all critical and high-severity vulnerabilities within the defined SLA",
                    "Review and restrict exposed services",
                    "Implement network segmentation for high-value assets",
                ],
            }

        elif report_type == "technical":
            return {
                **base,
                "overview": f"Technical assessment: {len(vuln_list)} CVEs analyzed.",
                "vulnerability_details": [
                    {
                        "cve": v.cve_id if hasattr(v, 'cve_id') else "",
                        "title": v.title if hasattr(v, 'title') else "",
                        "severity": v.severity if hasattr(v, 'severity') else "",
                        "cvss": v.cvss_score if hasattr(v, 'cvss_score') else 0,
                        "exploitability": v.exploitability if hasattr(v, 'exploitability') else "unknown",
                    }
                    for v in vuln_list[:15]
                ],
                "affected_systems": list(set(
                    v.affected_device for v in vuln_list if hasattr(v, 'affected_device')
                ))[:20],
            }

        elif report_type == "operations":
            return {
                **base,
                "overview": f"Operations log: {ops_stats.get('total', 0)} total, "
                            f"{ops_stats.get('completed', 0)} completed, "
                            f"{ops_stats.get('failed', 0)} failed.",
                "operation_log": [
                    {
                        "name": o.name if hasattr(o, 'name') else "",
                        "type": o.operation_type if hasattr(o, 'operation_type') else "",
                        "status": o.status if hasattr(o, 'status') else "",
                        "result": o.result_summary if hasattr(o, 'result_summary') else "",
                    }
                    for o in ops_list[:20]
                ],
                "success_rate": round(
                    (ops_stats.get("completed", 0) / max(ops_stats.get("total", 1), 1)) * 100, 1
                ),
            }

        else:
            return {
                **base,
                "overview": f"Report generated. {len(vuln_list)} vulns, {ops_stats.get('total', 0)} operations.",
                "findings": f"Based on current data across all intelligence sources.",
            }

    def _calculate_risk_score(self, vuln_stats: dict, vuln_list: list) -> float:
        """Calculate a risk score 0-10 based on vulnerability data."""
        critical = vuln_stats.get("critical", 0)
        high = vuln_stats.get("high", 0)
        has_exploits = sum(1 for v in vuln_list if hasattr(v, 'has_exploit') and v.has_exploit)

        score = 0.0
        score += min(critical * 1.5, 5.0)
        score += min(high * 0.8, 3.0)
        score += min(has_exploits * 0.5, 2.0)
        return round(min(score, 10.0), 1)

    def _generate_summary(self, report_type: str, content: dict,
                          risk_score: float, total_vulns: int) -> str:
        parts = []
        if total_vulns:
            parts.append(f"Assessment identified {total_vulns} vulnerabilities")
        if risk_score:
            parts.append(f"with a risk score of {risk_score}/10")
        risk = content.get("risk_summary", {})
        if isinstance(risk, dict):
            crit = risk.get("critical", 0)
            high = risk.get("high", 0)
            if crit or high:
                parts.append(f"({crit} critical, {high} high severity)")
        return ". ".join(parts) + "."

    # ── Intelligence Functions ────────────────────────────────────

    def build_summary(self, vuln_store=None, ops_store=None,
                      target_store=None, netvision_status: Optional[dict] = None) -> dict:
        vuln_stats = {}
        if vuln_store:
            vuln_stats = vuln_store.stats() if hasattr(vuln_store, 'stats') else {}
            # If vuln_store.stats() returns the whole dict with critical/high keys
            if not isinstance(vuln_stats, dict):
                vuln_stats = {}

        ops_stats = {}
        if ops_store:
            ops_stats = ops_store.stats() if hasattr(ops_store, 'stats') else {}
            if not isinstance(ops_stats, dict):
                ops_stats = {}

        v_by_severity = vuln_stats.get("by_severity", {})
        if isinstance(v_by_severity, dict):
            critical = v_by_severity.get("critical", 0)
            high = v_by_severity.get("high", 0)
            medium = v_by_severity.get("medium", 0)
            low = v_by_severity.get("low", 0)
        else:
            critical = vuln_stats.get("critical", 0)
            high = vuln_stats.get("high", 0)
            medium = vuln_stats.get("medium", 0)
            low = vuln_stats.get("low", 0)

        return {
            "total_vulnerabilities": len(vuln_store._vulnerabilities) if vuln_store and hasattr(vuln_store, '_vulnerabilities') else 0,
            "severity_breakdown": {"critical": critical, "high": high, "medium": medium, "low": low},
            "critical_exploits": vuln_stats.get("critical_exploits", 0),
            "operations_total": ops_stats.get("total", 0),
            "operations_running": ops_stats.get("running", 0),
            "operations_completed": ops_stats.get("completed", 0),
            "operations_success_rate": round(
                (ops_stats.get("completed", 0) / max(ops_stats.get("total", 1), 1)) * 100, 1
            ),
            "risk_score": self._calculate_risk_score(vuln_stats, []) if vuln_stats else 0,
            "netvision_status": netvision_status or {"reachable": False},
            "report_count": len(self._reports),
        }

    def build_timeline(self, hours: int = 48) -> list[TimelineEvent]:
        """Build a timeline of recent security events.

        Prefers live normalized events from the unified event bus; falls back
        to seed events when no real activity has been recorded yet.
        """
        live_events = self._live_timeline_events(hours)
        if live_events:
            return live_events

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=hours)
        events: list[TimelineEvent] = []

        # Use seed events for demo if no real data
        seed_events = [
            TimelineEvent(
                id=str(uuid.uuid4()),
                timestamp=(now - timedelta(hours=46)).isoformat(),
                event_type="vulnerability", title="CVE-2024-21626 detected on 10.0.1.10",
                severity="critical", source="vuln_service",
            ),
            TimelineEvent(
                id=str(uuid.uuid4()),
                timestamp=(now - timedelta(hours=24)).isoformat(),
                event_type="operation", title="Infrastructure Check — Q3 completed",
                severity=None, source="ops_service",
                description="Full audit completed: 32 devices discovered, 14 vulnerabilities found",
            ),
            TimelineEvent(
                id=str(uuid.uuid4()),
                timestamp=(now - timedelta(hours=12)).isoformat(),
                event_type="scan", title="DMZ Host Scan triggered on 10.0.0.0/24",
                severity=None, source="recon",
            ),
            TimelineEvent(
                id=str(uuid.uuid4()),
                timestamp=(now - timedelta(hours=4)).isoformat(),
                event_type="alert", title="High outbound connections from 10.0.2.5",
                severity="high", source="netvision",
            ),
            TimelineEvent(
                id=str(uuid.uuid4()),
                timestamp=(now - timedelta(hours=1)).isoformat(),
                event_type="vulnerability", title="CVE-2024-6387 (regreSSHion) confirmed exploitable",
                severity="high", source="vuln_service",
                description="Exploit PoC available for OpenSSH < 4.4p1 on 10.0.0.8",
            ),
        ]
        events.extend(seed_events)
        return sorted(events, key=lambda e: e.timestamp, reverse=True)

    def _live_timeline_events(self, hours: int = 48) -> list[TimelineEvent]:
        """Pull recent normalized events from the unified event bus."""
        try:
            from services.event_bus import event_bus
        except ImportError:
            from backend.services.event_bus import event_bus

        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=hours)
        timeline_events: list[TimelineEvent] = []

        for ev in event_bus.list_events(limit=500):
            try:
                ts = datetime.fromisoformat(ev.timestamp)
            except (ValueError, TypeError):
                continue
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts < cutoff:
                continue
            timeline_events.append(canonical_to_timeline(ev))

        return sorted(timeline_events, key=lambda e: e.timestamp, reverse=True)

    def build_threat_feed(self) -> list[dict]:
        """Aggregate threats from all sources into a unified feed."""
        now = datetime.now(timezone.utc)
        return [
            {
                "id": "threat-001", "type": "vulnerability", "title": "CVE-2024-21626 — runc escape",
                "severity": "critical", "source": "NVD", "affected": "10.0.1.10, 10.0.1.11",
                "timestamp": (now - timedelta(days=2)).isoformat(),
                "status": "active",
            },
            {
                "id": "threat-002", "type": "vulnerability", "title": "CVE-2024-3094 — xz backdoor",
                "severity": "critical", "source": "CISA KEV", "affected": "10.0.2.5",
                "timestamp": (now - timedelta(days=3)).isoformat(),
                "status": "active",
            },
            {
                "id": "threat-003", "type": "vulnerability", "title": "CVE-2024-1708 — ScreenConnect auth bypass",
                "severity": "critical", "source": "Exploit-DB", "affected": "10.0.3.8",
                "timestamp": (now - timedelta(days=1)).isoformat(),
                "status": "active",
            },
            {
                "id": "threat-004", "type": "exposure", "title": "OpenSSH < 4.4p1 — regreSSHion",
                "severity": "high", "source": "NetVision", "affected": "10.0.0.8",
                "timestamp": now.isoformat(),
                "status": "confirmed",
            },
            {
                "id": "threat-005", "type": "exposure", "title": "Apache 2.4.41 on DMZ hosts",
                "severity": "medium", "source": "NetVision", "affected": "10.0.0.5, 10.0.0.12",
                "timestamp": (now - timedelta(hours=6)).isoformat(),
                "status": "active",
            },
            {
                "id": "threat-006", "type": "indicator", "title": "Suspicious outbound traffic pattern",
                "severity": "high", "source": "NetVision Capture",
                "affected": "10.0.2.5 → external",
                "timestamp": (now - timedelta(hours=2)).isoformat(),
                "status": "investigating",
            },
        ]

    def export_data(self, format: str = "json",
                    vuln_store=None, op_store=None, target_store=None) -> dict:
        """Export all Oblivion data in requested format."""
        data = {
            "exported_at": self._now(),
            "format": format,
            "reports": {
                "total": len(self._reports),
                "reports": [{"id": r.id, "title": r.title, "type": r.report_type,
                              "risk_score": r.risk_score, "created": r.created_at}
                             for r in self._reports.values()],
            },
        }

        if vuln_store and hasattr(vuln_store, '_vulnerabilities'):
            data["vulnerabilities"] = {
                "total": len(vuln_store._vulnerabilities),
                "by_severity": vuln_store.stats() if hasattr(vuln_store, 'stats') else {},
            }

        if op_store and hasattr(op_store, '_operations'):
            data["operations"] = {
                "total": len(op_store._operations),
                "stats": op_store.stats() if hasattr(op_store, 'stats') else {},
            }

        return data


# ── Singleton ──────────────────────────────────────────────────────

intel_store = IntelStore()
