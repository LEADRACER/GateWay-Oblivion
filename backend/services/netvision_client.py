"""
GateWay:Oblivion — NetVision API Client

HTTP client that connects to NetVision's API, authenticates, and
fetches scan results, devices, vulnerabilities, and topology data.
"""

import json
import time
import logging
from typing import Optional
from urllib.parse import urljoin

import httpx

logger = logging.getLogger("oblivion.netvision")


class NetVisionClient:
    """Asynchronous HTTP client for NetVision API."""

    def __init__(
        self,
        base_url: str = "http://localhost:8000",
        username: str = "admin",
        password: str = "netvision",
        timeout: float = 30.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.timeout = timeout
        self._token: Optional[str] = None
        self._token_expires: float = 0.0
        self._client = httpx.AsyncClient(timeout=timeout)

    # ── Auth ─────────────────────────────────────────────────────

    async def _ensure_token(self) -> str:
        if self._token and time.time() < self._token_expires:
            return self._token
        try:
            resp = await self._client.post(
                urljoin(self.base_url, "/auth/token"),
                json={
                    "username": self.username,
                    "password": self.password,
                },
                headers={"Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                data = resp.json()
                self._token = data.get("access_token", "")
                expires_in = data.get("expires_in", 3600)
                self._token_expires = time.time() + expires_in - 60  # 1min buffer
                logger.info("Authenticated with NetVision API")
                return self._token
            else:
                logger.warning("NetVision auth failed: %s", resp.text)
                return ""
        except Exception as e:
            logger.warning("NetVision auth error: %s", e)
            return ""

    async def _headers(self) -> dict:
        token = await self._ensure_token()
        h = {"Content-Type": "application/json"}
        if token:
            h["Authorization"] = f"Bearer {token}"
        return h

    async def _get(self, path: str, params: dict = None) -> dict:
        headers = await self._headers()
        url = urljoin(self.base_url, path)
        try:
            resp = await self._client.get(url, headers=headers, params=params)
            if resp.status_code == 200:
                return resp.json()
            logger.warning("NetVision GET %s: %d %s", path, resp.status_code, resp.text[:200])
            return {}
        except Exception as e:
            logger.warning("NetVision GET %s error: %s", path, e)
            return {}

    async def _post(self, path: str, data: dict = None, params: dict = None) -> dict:
        headers = await self._headers()
        url = urljoin(self.base_url, path)
        try:
            resp = await self._client.post(url, headers=headers, json=data, params=params)
            if resp.status_code in (200, 201):
                return resp.json()
            logger.warning("NetVision POST %s: %d %s", path, resp.status_code, resp.text[:200])
            return {}
        except Exception as e:
            logger.warning("NetVision POST %s error: %s", path, e)
            return {}

    async def close(self):
        await self._client.aclose()

    # ── Health & Status ──────────────────────────────────────────

    async def health(self) -> dict:
        """NetVision health check."""
        return await self._get("/health")

    async def scan_status(self) -> dict:
        """Current scan status (is_scanning, active_task, queue_depth)."""
        return await self._get("/health/scan")

    # ── Devices ──────────────────────────────────────────────────

    async def devices(self) -> list[dict]:
        """All discovered devices with health data."""
        data = await self._get("/devices")
        return data.get("devices", [])

    # ── Scan Management ──────────────────────────────────────────

    async def trigger_scan(self, target: str = None, profile: str = "quick") -> dict:
        """Trigger a scan via NetVision."""
        params = {"profile": profile}
        if target:
            params["target"] = target
        # NetVision's /scan reads query parameters (JSON body is ignored).
        return await self._post("/scan", params=params)

    async def stop_scan(self) -> dict:
        """Stop the active scan."""
        return await self._post("/scan/stop")

    async def sonar_scan(
        self,
        target: Optional[str] = None,
        mode: str = "sonar",
        duration: int = 10,
    ) -> dict:
        """Run NetVision's modular multi-sensor sonar discovery."""
        return await self._post("/api/discovery/scan", {
            "target": target, "mode": mode, "duration": duration,
        })

    async def sonar_sensors(self) -> dict:
        """List available sonar sensors and their capabilities."""
        return await self._get("/api/discovery/sensors")

    async def scan_history(self, limit: int = 20) -> list[dict]:
        """Recent scan history."""
        data = await self._get("/scan/history", {"limit": limit})
        return data if isinstance(data, list) else []

    async def scan_diff(self, scan_id: int) -> dict:
        """Diff results between two scans."""
        return await self._get(f"/scan/diff/{scan_id}")

    async def scan_queue(self) -> dict:
        """Scan queue status."""
        return await self._get("/scan/queue")

    # ── Vulnerabilities ──────────────────────────────────────────

    async def vulnerabilities(self) -> list[dict]:
        """All discovered vulnerabilities with CVE details."""
        data = await self._get("/vulnerabilities")
        return data if isinstance(data, list) else data.get("vulnerabilities", [])

    # ── Topology ─────────────────────────────────────────────────

    async def topology(self) -> dict:
        """Network topology graph data."""
        return await self._get("/topology")

    async def correlation(self) -> dict:
        """Network correlation summary (vendors, OS, ports)."""
        return await self._get("/correlation")

    # ── Capture ──────────────────────────────────────────────────

    async def capture_status(self) -> dict:
        """Packet capture streaming status."""
        return await self._get("/capture/streaming-status")

    async def top_talkers(self) -> list[dict]:
        """Network top talkers by traffic volume."""
        data = await self._get("/capture/top-talkers")
        return data if isinstance(data, list) else data.get("top_talkers", [])

    # ── Aggregated Recon Status ──────────────────────────────────

    async def recon_summary(self) -> dict:
        """Aggregated status for Oblivion's recon dashboard."""
        scan_st = await self.scan_status()
        devs = await self.devices()
        vulns = await self.vulnerabilities()

        total_ports = 0
        port_counts: dict[str, int] = {}
        for d in devs:
            for p in d.get("ports", []):
                total_ports += 1
                svc = p.get("service_name", p.get("service", "unknown"))
                port_counts[svc] = port_counts.get(svc, 0) + 1

        return {
            "is_scanning": scan_st.get("is_scanning", False),
            "active_task": scan_st.get("active_task"),
            "queue_depth": scan_st.get("queue_depth", 0),
            "devices_found": scan_st.get("devices_found", len(devs)),
            "total_devices": len(devs),
            "total_ports": total_ports,
            "total_vulnerabilities": len(vulns),
            "services": port_counts,
            "critical_vulns": sum(1 for v in vulns if v.get("severity") == "critical"),
            "high_vulns": sum(1 for v in vulns if v.get("severity") == "high"),
            "health_up": sum(1 for d in devs if d.get("health", {}).get("status") == "up"),
            "health_down": sum(1 for d in devs if d.get("health", {}).get("status") == "down"),
            "last_scan": scan_st.get("last_scan"),
        }
