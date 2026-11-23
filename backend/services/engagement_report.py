"""Engagement report generation and Obsidian export."""

import logging
from datetime import datetime, timezone

try:
    from services.engagement_service import EngagementService
    from services.audit_log import audit_log
    from services.obsidian_service import obsidian_service
except ImportError:
    from backend.services.engagement_service import EngagementService
    from backend.services.audit_log import audit_log
    from backend.services.obsidian_service import obsidian_service

logger = logging.getLogger("oblivion.engagement.report")

SEVERITY_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}


def _cell(value) -> str:
    return str(value or "—").replace("|", "\\|").replace("\n", " ")


class EngagementReportService:
    def __init__(self, engagement_service: EngagementService):
        self.engagement = engagement_service
        self.obsidian = obsidian_service

    def render(self, engagement_id: str, kind: str = "executive") -> str:
        if kind not in ("executive", "technical"):
            raise ValueError("kind must be 'executive' or 'technical'")
        service = self.engagement
        engagement = service.get_engagement(engagement_id)
        if not engagement:
            raise ValueError("Engagement not found")

        scope = service.get_scope(engagement_id)
        roe = service.get_roe(engagement_id)
        metrics = service.metrics(engagement_id)
        tasks = service.list_tasks(engagement_id)
        findings = sorted(
            service.list_findings(engagement_id),
            key=lambda f: SEVERITY_ORDER.get(f.severity, 9),
        )
        evidence = service.list_evidence(engagement_id)
        events = service.list_events(engagement_id, 20)
        audit = audit_log.verify()
        now = datetime.now(timezone.utc).isoformat()

        lines = [
            "---",
            f'title: "{engagement.name} — {kind.title()} Report"',
            "tags:",
            "  - oblivion",
            "  - engagement",
            f"  - {kind}",
            f"engagement: {engagement.code}",
            f"state: {engagement.state}",
            f"risk_score: {metrics['risk_score']}",
            f"generated_at: {now}",
            "---",
            "",
            f"# {engagement.code} — {engagement.name}",
            "",
            "> [!info] Report metadata",
            f"> Type: {kind} · Engagement: {engagement.code} ({engagement.engagement_type})",
            f"> Lead: {engagement.lead_operator} · Team: {', '.join(engagement.team) or '—'}",
            f"> Client: {engagement.client or 'Internal'} · Generated: {now}",
            "",
            "## Executive Summary" if kind == "executive" else "## Technical Summary",
            "",
            f"{engagement.objective or 'No objective recorded.'}",
            "",
            f"Progress: **{metrics['progress']}%** · Tasks: **{metrics['tasks_total']}** · "
            f"Findings: **{metrics['findings_total']}** · Risk score: **{metrics['risk_score']}**",
            "",
            f"> [!{'warning' if metrics['findings_by_severity'].get('critical') else 'note'}] Risk posture",
            f"> Critical: {metrics['findings_by_severity'].get('critical', 0)} · "
            f"High: {metrics['findings_by_severity'].get('high', 0)} · "
            f"Medium: {metrics['findings_by_severity'].get('medium', 0)} · "
            f"Low: {metrics['findings_by_severity'].get('low', 0)}",
            "",
            "## Scope & Authorization",
            "",
            "Include: " + (", ".join(scope.include) if scope else "—"),
            "",
            "Exclude: " + (", ".join(scope.exclude) if scope and scope.exclude else "—"),
            "",
            f"Allowed tools: {', '.join(scope.allowed_tools) if scope and scope.allowed_tools else 'all'}",
            f"",
            f"Allowed actions: {', '.join(scope.allowed_actions) if scope and scope.allowed_actions else 'all'}",
            "",
            f"> [!{'success' if roe and roe.signed else 'danger'}] Rules of Engagement",
            f"> Signed: {'yes' if roe and roe.signed else 'NO'} by {roe.authorized_by if roe else '—'}",
            f"> Stop conditions: {', '.join(roe.stop_conditions) if roe and roe.stop_conditions else 'none'}",
            "",
            "## Findings",
            "",
        ]

        if findings:
            lines += [
                "| Severity | Title | CVE | Status | Source |",
                "|---|---|---|---|---|",
            ]
            for finding in findings:
                lines.append(
                    f"| {_cell(finding.severity)} | {_cell(finding.title)} | "
                    f"{_cell(finding.cve_id)} | {_cell(finding.status)} | {_cell(finding.source_tool)} |"
                )
            lines.append("")
        else:
            lines += ["No findings recorded.", ""]

        if kind == "technical":
            lines += ["### Finding Details", ""]
            for finding in findings:
                lines += [
                    f"#### {finding.title}",
                    "",
                    f"- Severity: {finding.severity} · CVSS: {finding.cvss_score or '—'} · Status: {finding.status}",
                    f"- Task: {finding.task_id or '—'} · Discovered: {finding.discovered_at}",
                    f"- Remediation: {finding.remediation or '—'}",
                    "",
                ]
                if finding.raw:
                    lines += ["```json", __import__("json").dumps(finding.raw, indent=2)[:4000], "```", ""]

        lines += ["## Evidence", ""]
        if evidence:
            for item in evidence:
                lines.append(
                    f"- **{item.kind}** ({item.source_tool}) · SHA-256: `{item.sha256 or item.path_or_hash}`"
                )
        else:
            lines.append("No evidence captured.")
        lines.append("")

        lines += ["## Activity Timeline", ""]
        for event in events:
            if isinstance(event, dict):
                timestamp = event.get("timestamp", "")
                source_tool = event.get("source_tool", "")
                title = event.get("title") or event.get("event_type", "")
                event_type = event.get("event_type", "")
            else:
                timestamp = event.timestamp
                source_tool = event.source_tool
                title = event.title or event.event_type
                event_type = event.event_type
            lines.append(
                f"- `{timestamp}` · **{source_tool}** · {title} ({event_type})"
            )
        lines.append("")

        lines += ["## Task Status", ""]
        for status, count in metrics["task_status"].items():
            lines.append(f"- {status}: {count}")
        lines.append("")

        lines += [
            "## Audit Integrity",
            "",
            f"> [!{'success' if audit.get('valid') else 'danger'}] Hash chain verification",
            f"> Entries: {audit.get('entries', 0)} · Valid: {audit.get('valid')} · "
            f"Broken at: {audit.get('broken_at') or 'n/a'}",
            "",
            "## Remediation Roadmap",
            "",
        ]
        remediation = [f for f in findings if f.severity in ("critical", "high")]
        if remediation:
            for index, finding in enumerate(remediation, start=1):
                lines.append(f"{index}. **{finding.title}** — {finding.remediation or 'Define remediation plan'}")
        else:
            lines.append("No critical or high findings require immediate remediation.")
        lines += [
            "",
            "## Related",
            "",
            "- [[Oblivion Overview]]",
            "- [[Oblivion Pipeline Map]]",
            f"- [[{engagement.code}]]" if engagement.code else "",
            "",
        ]
        return "\n".join(line for line in lines if line is not None)

    def export(self, engagement_id: str, kind: str = "executive") -> dict:
        content = self.render(engagement_id, kind)
        engagement = self.engagement.get_engagement(engagement_id)
        note_path = f"Oblivion/Engagements/{engagement.code}-{kind}.md"
        try:
            result = self.obsidian.write_note(note_path, content, "overwrite")
            path = result["path"]
        except Exception as exc:  # noqa: BLE001
            logger.warning("Obsidian export failed for %s: %s", engagement_id, exc)
            path = note_path
        report = self.engagement.add_report(engagement_id, kind, path, content)
        return report.model_dump()
