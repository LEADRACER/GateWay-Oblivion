from .base import ToolAdapter
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from services.netvision_client import NetVisionClient
    from services.netvision_metrics import NetVisionMetricsCollector
except ImportError:
    from backend.services.netvision_client import NetVisionClient
    from backend.services.netvision_metrics import NetVisionMetricsCollector


class NetVisionAdapter(ToolAdapter):
    name = "netvision"

    # Every controllable NetVision surface exposed through Oblivion's tool bus.
    ACTION_METHODS = {
        "scan_status": "scan_status",
        "scan_queue": "scan_queue",
        "scan_history": "scan_history",
        "scan_diff": "scan_diff",
        "scan_schedules": "scan_schedules",
        "create_scan_schedule": "create_scan_schedule",
        "delete_scan_schedule": "delete_scan_schedule",
        "toggle_scan_schedule": "toggle_scan_schedule",
        "sonar_sensors": "sonar_sensors",
        "sonar_status": "discovery_status",
        "sonar_results": "discovery_results",
        "discovery_results": "discovery_results",
        "bettercap_status": "bettercap_status",
        "bettercap_start": "bettercap_start",
        "bettercap_stop": "bettercap_stop",
        "bettercap_hosts": "bettercap_hosts",
        "bettercap_events": "bettercap_events",
        "devices": "devices",
        "vulnerabilities": "vulnerabilities",
        "topology": "topology",
        "correlation": "correlation",
        "recon_summary": "recon_summary",
        "health": "health",
        "health_ready": "health_ready",
        "health_live": "health_live",
        "health_history": "health_history",
        "audit_log": "audit_log",
        "config": "config",
        "capture_status": "capture_status",
        "capture_start": "capture_start",
        "capture_stop": "capture_stop",
        "capture_analysis_summary": "capture_analysis_summary",
        "capture_anomalies": "capture_anomalies",
        "rogue_scan": "rogue_scan",
        "rogue_events": "rogue_events",
        "top_talkers": "top_talkers",
        "probe": "probe",
        "correlate_vulns": "correlate_vulns",
    }

    def __init__(self, base_url="http://localhost:8000", username="admin", password="netvision"):
        self._base_url = base_url
        self.client = NetVisionClient(base_url, username, password)
        self.metrics = NetVisionMetricsCollector(self.client)

    async def health(self) -> dict:
        h = await self.client.health()
        status = h.get("status") if isinstance(h, dict) else None
        if not h or not status:
            status = "unavailable"
        # NetVision reports "ok"; Oblivion's tool registry/UI expect "available".
        if status in ("ok", "ready", "healthy", "alive"):
            status = "available"
        out: dict = dict(h) if isinstance(h, dict) else {}
        out.setdefault("name", self.name)
        out["status"] = status
        out["available"] = status == "available"
        out["connected"] = False
        out["base_url"] = getattr(self.client, "base_url", None) or self._base_url
        # Surface native control capabilities in tool health.
        out["capabilities"] = self.get_actions()
        return out

    async def connect(self) -> bool:
        h = await self.health()
        ok = bool(h) and h.get("status") not in (None, "", "unavailable", "error", "offline")
        self._connected = ok
        return ok

    async def disconnect(self) -> None:
        await self.client.close()

    def get_actions(self) -> list:
        return [
            "trigger_scan", "stop_scan", "sonar_scan", "metrics",
            *self.ACTION_METHODS.keys(),
        ]

    async def execute(self, action: str, params=None) -> dict:
        params = params or {}
        if action == "trigger_scan":
            target = params.get("target")
            profile = params.get("profile", "discovery")
            profile = {"quick": "discovery", "security": "vuln"}.get(profile, profile)
            return await self.client.trigger_scan(target, profile)
        if action == "stop_scan":
            return await self.client.stop_scan()
        if action == "sonar_scan":
            return await self.client.sonar_scan(
                target=params.get("target"),
                mode=params.get("mode", "sonar"),
                duration=int(params.get("duration", 10)),
            )
        if action == "metrics":
            return await self.metrics.snapshot(raw=bool(params.get("raw", False)))
        if action in self.ACTION_METHODS:
            method = getattr(self.client, self.ACTION_METHODS[action])
            # Pass only parameters the target method actually accepts.
            import inspect
            accepted = inspect.signature(method).parameters
            kwargs = {k: v for k, v in params.items() if k in accepted}
            return await method(**kwargs)
        raise ValueError(f"Unknown NetVision action: {action}")

    def normalize_result(self, raw):
        return {"source": "netvision", "raw": raw}
