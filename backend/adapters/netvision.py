from .base import ToolAdapter
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
try:
    from services.netvision_client import NetVisionClient
except ImportError:
    from backend.services.netvision_client import NetVisionClient


class NetVisionAdapter(ToolAdapter):
    name = "netvision"

    def __init__(self, base_url="http://localhost:8000", username="admin", password="netvision"):
        self.client = NetVisionClient(base_url, username, password)

    async def health(self) -> dict:
        h = await self.client.health()
        status = h.get("status") if isinstance(h, dict) else None
        if not h or not status:
            status = "unavailable"
        out: dict = dict(h) if isinstance(h, dict) else {}
        out.setdefault("name", self.name)
        out.setdefault("status", status)
        out["available"] = status != "unavailable"
        out["connected"] = False
        out["base_url"] = getattr(self.client, "base_url", None) or self.base_url
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
            "trigger_scan",
            "stop_scan",
            "sonar_scan",
            "sonar_sensors",
            "devices",
            "vulnerabilities",
            "topology",
            "correlation",
            "recon_summary",
        ]

    async def execute(self, action: str, params=None) -> dict:
        params = params or {}
        if action == "trigger_scan":
            return await self.client.trigger_scan(params.get("target"), params.get("profile", "quick"))
        if action == "stop_scan":
            return await self.client.stop_scan()
        if action == "sonar_scan":
            return await self.client.sonar_scan(
                target=params.get("target"),
                mode=params.get("mode", "sonar"),
                duration=int(params.get("duration", 10)),
            )
        if action == "sonar_sensors":
            return await self.client.sonar_sensors()
        if action == "devices":
            return {"devices": await self.client.devices()}
        if action == "vulnerabilities":
            return {"vulnerabilities": await self.client.vulnerabilities()}
        if action == "topology":
            return await self.client.topology()
        if action == "recon_summary":
            return await self.client.recon_summary()
        raise ValueError(f"Unknown action: {action}")

    def normalize_result(self, raw):
        return {"source": "netvision", "raw": raw}
