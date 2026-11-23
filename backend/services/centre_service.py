"""
GateWay:Oblivion — Unified Red / Blue Operations Centre

Aggregates offensive (red), defensive (blue) and shared operational signals from
the event bus, pipeline orchestrator, vulnerability store and connected tools
into one authoritative command-centre view.
"""

import ipaddress
import logging
import os
from typing import Optional

from services.event_bus import event_bus
from services.pipeline_service import pipeline_service
from adapters import get_adapter

logger = logging.getLogger("oblivion.centre")

RED_TOOLS = {"metasploit", "reconng", "projectdiscovery", "adversary"}
BLUE_TOOLS = {"godseye", "system", "obsidian", "osint", "blueteam"}
BLUE_MARKERS = ("alert", "anomal", "capture", "rogue", "health.alert", "threat", "intel", "detection")


def classify_side(event) -> str:
    """Classify a canonical event as red, blue or shared."""
    tool = (event.source_tool or "").lower()
    etype = (event.event_type or "").lower()
    if tool in RED_TOOLS or "exploit" in etype or "run_module" in etype or "pipeline" in etype:
        return "red"
    if any(marker in etype for marker in BLUE_MARKERS):
        return "blue"
    if tool in BLUE_TOOLS:
        return "blue"
    if tool == "netvision":
        return "blue" if any(marker in etype for marker in ("alert", "anomal", "capture", "rogue")) else "red"
    return "shared"


class CentreService:
    def __init__(self):
        self._scope = [
            value.strip()
            for value in os.environ.get("OBLIVION_SCOPE", "").split(",")
            if value.strip()
        ]

    # ── scope guardrails ─────────────────────────────────────────

    def scope_status(self) -> dict:
        networks = []
        for entry in self._scope:
            try:
                networks.append(str(ipaddress.ip_network(entry, strict=False)))
            except ValueError:
                logger.warning("Invalid OBLIVION_SCOPE entry: %s", entry)
        return {
            "enforced": bool(networks),
            "allowlist": networks,
            "description": (
                "Offensive targets must be within the configured scope allowlist"
                if networks else "No allowlist configured — advisory mode only"
            ),
        }

    def target_allowed(self, target: Optional[str]) -> bool:
        if not self._scope or not target:
            return True
        try:
            addr = ipaddress.ip_address(target.strip())
        except ValueError:
            try:
                net = ipaddress.ip_network(target.strip(), strict=False)
            except ValueError:
                return False
            return any(net.subnet_of(ipaddress.ip_network(s)) for s in self._scope)
        return any(addr in ipaddress.ip_network(s) for s in self._scope)

    # ── detections ───────────────────────────────────────────────

    async def detections(self, limit: int = 40) -> list:
        items = []
        for event in event_bus.list_events(limit=300):
            if classify_side(event) != "blue":
                continue
            if event.severity not in ("warning", "high", "critical"):
                continue
            items.append({
                "id": event.id,
                "title": event.title or event.event_type,
                "severity": event.severity,
                "source": event.source_tool,
                "event_type": event.event_type,
                "timestamp": event.timestamp,
                "detail": str(event.payload.get("event") or event.event_type),
            })

        adapter = get_adapter("netvision")
        if adapter:
            for action, label in (("capture_anomalies", "Capture Anomaly"), ("audit_log", "Audit Event")):
                try:
                    result = await adapter.execute(action)
                    rows = result if isinstance(result, list) else []
                    for row in rows[:5]:
                        items.append({
                            "id": f"{label}-{row.get('id', len(items))}",
                            "title": str(row.get("description") or row.get("type") or row.get("path") or label),
                            "severity": "warning" if label == "Capture Anomaly" else "info",
                            "source": "netvision",
                            "event_type": action,
                            "timestamp": str(row.get("timestamp") or ""),
                            "detail": label,
                        })
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Centre detection source %s unavailable: %s", action, exc)

        blue_adapter = get_adapter("blueteam")
        if blue_adapter:
            for action, key, source in (
                ("wazuh_alerts", "alerts", "wazuh"),
                ("suricata_alerts", "alerts", "suricata"),
                ("zeek_notices", "notices", "zeek"),
            ):
                try:
                    result = await blue_adapter.execute(action)
                    rows = result.get(key, []) if isinstance(result, dict) else []
                    for row in rows[:10]:
                        severity = str(row.get("severity", "warning")).lower()
                        if severity.isdigit():
                            severity = "high" if int(severity) >= 10 else "medium"
                        items.append({
                            "id": f"{source}-{row.get('id') or row.get('title') or len(items)}",
                            "title": str(row.get("title") or "Detection"),
                            "severity": severity,
                            "source": source,
                            "event_type": action,
                            "timestamp": str(row.get("timestamp") or ""),
                            "detail": str(row.get("source_ip") or row.get("rule_id") or source),
                        })
                except Exception as exc:  # noqa: BLE001
                    logger.debug("Centre blue source %s unavailable: %s", action, exc)

        return sorted(items, key=lambda d: d.get("timestamp", ""), reverse=True)[:limit]

    # ── unified overview ─────────────────────────────────────────

    async def overview(self, vuln_store, ops_store) -> dict:
        vulns = vuln_store.stats()
        ops = ops_store.stats()
        pipelines = pipeline_service.list_pipelines()
        runs = pipeline_service.list_runs(limit=50)
        gated = [r for r in runs if r.status == "gated"]

        tools = {}
        try:
            from adapters import registry
            tools = await registry.health_all()
        except Exception as exc:  # noqa: BLE001
            logger.debug("Tool health unavailable: %s", exc)

        detections = await self.detections()
        events = event_bus.list_events(limit=300)

        sev = vulns.get("by_severity", {})
        critical = sev.get("critical", 0)
        high = sev.get("high", 0)
        mitigations = vulns.get("by_status", {}).get("patched", 0) + vulns.get("by_status", {}).get("mitigated", 0)
        posture = max(0, min(100, round(100 - (critical * 6 + high * 2) + mitigations * 1.5)))

        red = {
            "tools_ready": [name for name in ("metasploit", "reconng", "netvision", "godseye", "projectdiscovery")
                            if (tools.get(name) or {}).get("available")],
            "pipelines_total": len(pipelines),
            "pipelines_running": sum(1 for r in runs if r.status == "running"),
            "runs_total": len(runs),
            "gated_runs": len(gated),
            "gated_run_ids": [r.id for r in gated],
            "attack_surface": sum(1 for e in events if e.event_type.startswith("netvision.discovery")),
            "exploits_available": vulns.get("exploits_available", 0),
            "last_run": runs[0].model_dump() if runs else None,
        }

        blue = {
            "detections_total": len(detections),
            "critical_detections": sum(1 for d in detections if d["severity"] in ("critical", "high")),
            "posture_score": posture,
            "critical_vulns": critical,
            "high_vulns": high,
            "operations_success_rate": round(
                (ops.get("completed", 0) / max(ops.get("total", 1), 1)) * 100, 1
            ),
            "capture_available": bool((tools.get("netvision") or {}).get("available")),
            "blue_sources": dict((tools.get("blueteam") or {}).get("subsystems", {})),
        }

        return {
            "generated_at": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc
            ).isoformat(),
            "mode": "unified",
            "scope": self.scope_status(),
            "red": red,
            "blue": blue,
            "shared": {
                "events_total": len(events),
                "red_events": sum(1 for e in events if classify_side(e) == "red"),
                "blue_events": sum(1 for e in events if classify_side(e) == "blue"),
                "tools_total": len(tools),
                "tools_online": sum(1 for t in tools.values() if t.get("available")),
            },
        }

    async def timeline(self, side: str = "all", limit: int = 60) -> list:
        events = event_bus.list_events(limit=max(limit * 3, 200))
        out = []
        for event in events:
            event_side = classify_side(event)
            if side != "all" and event_side != side:
                continue
            out.append({
                "id": event.id,
                "timestamp": event.timestamp,
                "side": event_side,
                "source": event.source_tool,
                "event_type": event.event_type,
                "title": event.title or event.event_type,
                "severity": event.severity,
                "target_ref": event.target_ref,
                "payload": event.payload,
            })
            if len(out) >= limit:
                break
        return out

    def metrics(self, hours: int = 24, buckets: int = 12) -> dict:
        """Time-bucketed event activity + severity distribution for charts."""
        from datetime import datetime, timedelta, timezone

        now = datetime.now(timezone.utc)
        start = now - timedelta(hours=hours)
        width = max(1, int(hours * 60 / buckets))
        series = []
        cursor = start
        for _ in range(buckets):
            end = cursor + timedelta(minutes=width)
            series.append({
                "label": cursor.strftime("%H:%M"),
                "start": cursor.isoformat(),
                "red": 0, "blue": 0, "shared": 0,
                "critical": 0, "high": 0, "warning": 0, "info": 0,
            })
            cursor = end

        severity_counts = {"critical": 0, "high": 0, "warning": 0, "info": 0}
        side_counts = {"red": 0, "blue": 0, "shared": 0}
        for event in event_bus.list_events(limit=500):
            try:
                ts = datetime.fromisoformat(event.timestamp)
            except (ValueError, TypeError):
                continue
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            index = int((ts - start).total_seconds() / (width * 60))
            side = classify_side(event)
            side_counts[side] = side_counts.get(side, 0) + 1
            sev = (event.severity or "info").lower()
            if sev not in severity_counts:
                sev = "info"
            severity_counts[sev] += 1
            if 0 <= index < len(series):
                series[index][side] += 1
                series[index][sev] += 1

        return {
            "series": series,
            "severity": [{"name": key, "value": value} for key, value in severity_counts.items()],
            "sides": [{"name": key, "value": value} for key, value in side_counts.items()],
            "hours": hours,
        }

    async def assets(self, limit: int = 100) -> dict:
        """Attack-surface inventory from NetVision devices + sonar discovery events."""
        hosts: dict[str, dict] = {}
        adapter = get_adapter("netvision")
        if adapter:
            try:
                devices = await adapter.execute("devices")
                for device in devices.get("devices", []):
                    ip = device.get("ip")
                    if not ip:
                        continue
                    hosts[ip] = {
                        "ip": ip,
                        "mac": device.get("mac"),
                        "vendor": device.get("vendor"),
                        "hostname": device.get("hostname"),
                        "os": device.get("os"),
                        "ports": len(device.get("ports", [])),
                        "health": (device.get("health") or {}).get("status"),
                        "source": "netvision",
                    }
            except Exception as exc:  # noqa: BLE001
                logger.debug("Asset inventory from NetVision unavailable: %s", exc)

        for event in event_bus.list_events(limit=300):
            if not event.event_type.startswith("netvision.discovery"):
                continue
            payload = event.payload or {}
            data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
            ip = data.get("ip")
            if not ip or ip in hosts:
                continue
            hosts[ip] = {
                "ip": ip,
                "mac": data.get("mac"),
                "vendor": data.get("vendor"),
                "hostname": data.get("hostname"),
                "os": None,
                "ports": 0,
                "health": None,
                "source": "sonar",
            }
        rows = list(hosts.values())[:limit]
        by_vendor: dict[str, int] = {}
        for host in rows:
            key = host.get("vendor") or "Unknown"
            by_vendor[key] = by_vendor.get(key, 0) + 1
        return {
            "hosts": rows,
            "total": len(rows),
            "by_vendor": [{"name": key, "value": value} for key, value in
                          sorted(by_vendor.items(), key=lambda kv: -kv[1])],
        }


centre_service = CentreService()
