"""
GateWay:Oblivion — God's Eye View Tool Adapter
=============================================

Bridges Oblivion's command surface to the God's Eye View intelligence
platform (https://godseyeview.ai / local repo: /home/dark00/Projects/gods-eye-view).

Transport: HTTP against a running God's Eye View server instance
(default base_url: http://localhost:4173 — the address its MCP server and tools
use as the API base).

Actions map to God's Eye View data endpoints under `/api/<endpoint>`:
  situation_brief, weather, weather_map, flights, aircraft, satellites, cctv,
  cyclones, launches, military, fires, earthquakes, imagery, ...
"""

import httpx
import logging
from typing import Optional

try:
    from adapters.base import ToolAdapter
except ImportError:
    from backend.adapters.base import ToolAdapter

logger = logging.getLogger("oblivion.godseye")


class GodsEyeAdapter(ToolAdapter):
    name = "godseye"

    ACTION_ENDPOINTS = {
        "situation_brief": "situation-brief",
        "weather": "weather",
        "weather_map": "weather-map",
        "flights": "flights",
        "aircraft": "aircraft",
        "satellites": "satellites",
        "cctv": "cctv",
        "cyclones": "cyclones",
        "launches": "launches",
        "military": "military",
        "fires": "fires",
        "earthquakes": "earthquakes",
        "imagery": "imagery",
    }

    def __init__(self, base_url: str = "http://localhost:4173", timeout: float = 30.0):
        self.base_url = (base_url or "http://localhost:4173").rstrip("/")
        self.timeout = timeout
        self._connected = False
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        """Reuse a pooled HTTP client instead of creating one per request."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            )
        return self._client

    # ── ToolAdapter interface ──────────────────────────────────────

    async def _reachable(self) -> bool:
        try:
            resp = await self._get_client().get(self.base_url)
            return resp.status_code < 500
        except Exception:
            return False

    async def health(self) -> dict:
        reachable = await self._reachable()
        return {
            "name": self.name,
            "status": "available" if reachable else "unavailable",
            "available": reachable,
            "base_url": self.base_url,
            "connected": self._connected,
        }

    async def connect(self) -> bool:
        ok = await self._reachable()
        self._connected = ok
        return ok

    async def disconnect(self) -> None:
        self._connected = False
        if self._client is not None and not self._client.is_closed:
            await self._client.aclose()
        self._client = None

    # ── actions ────────────────────────────────────────────────────

    async def execute(self, action: str, params: Optional[dict] = None) -> dict:
        params = params or {}
        endpoint = self.ACTION_ENDPOINTS.get(action)
        if not endpoint:
            raise ValueError(f"Unknown God's Eye View action: {action}")
        url = f"{self.base_url}/api/{endpoint}"
        resp = await self._get_client().get(url, params=params)
        try:
            data = resp.json()
        except Exception:
            data = {"raw": resp.text}
        return {
            "action": action,
            "endpoint": endpoint,
            "status_code": resp.status_code,
            "data": data,
        }

    # ── capabilities ──────────────────────────────────────────────

    def get_actions(self) -> list:
        return list(self.ACTION_ENDPOINTS.keys())

    def normalize_result(self, raw: Any) -> dict:
        return {"source": self.name, "raw": raw}
