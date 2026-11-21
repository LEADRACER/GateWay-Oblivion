"""
GateWay:Oblivion — Tool Adapter Registry
========================================

Owns the live instances of every tool adapter and aggregates health checks.
"""

import asyncio
import time
from typing import Optional

try:
    from adapters.base import ToolAdapter
    from adapters.netvision import NetVisionAdapter
    from adapters.metasploit import MetasploitAdapter
    from adapters.reconng import ReconNgAdapter
    from adapters.godseye import GodsEyeAdapter
    from adapters.obsidian import ObsidianAdapter
except ImportError:
    from backend.adapters.base import ToolAdapter
    from backend.adapters.netvision import NetVisionAdapter
    from backend.adapters.metasploit import MetasploitAdapter
    from backend.adapters.reconng import ReconNgAdapter
    from backend.adapters.godseye import GodsEyeAdapter
    from backend.adapters.obsidian import ObsidianAdapter


class AdapterRegistry:
    def __init__(self):
        self.adapters: dict = {}
        self._last_health: dict = {}
        self._last_health_ts: float = 0.0

    def register(self, adapter: ToolAdapter) -> ToolAdapter:
        self.adapters[adapter.name] = adapter
        return adapter

    def get(self, name: str) -> Optional[ToolAdapter]:
        return self.adapters.get(name)

    def list(self) -> list:
        return list(self.adapters.keys())

    async def health_all(self, force: bool = False, ttl: float = 15.0) -> dict:
        """Probe every adapter concurrently; reuse a short-lived cached snapshot."""
        if not force and self._last_health and (time.monotonic() - self._last_health_ts) < ttl:
            return dict(self._last_health)

        async def probe(name: str, adapter: ToolAdapter):
            try:
                return name, await adapter.health()
            except Exception as exc:  # noqa: BLE001
                return name, {
                    "name": name,
                    "status": "error",
                    "available": False,
                    "error": str(exc),
                }

        pairs = await asyncio.gather(
            *(probe(name, adapter) for name, adapter in self.adapters.items())
        )
        self._last_health = dict(pairs)
        self._last_health_ts = time.monotonic()
        return dict(self._last_health)


registry = AdapterRegistry()


def register_default_adapters() -> dict:
    registry.register(NetVisionAdapter())
    registry.register(MetasploitAdapter())
    registry.register(ReconNgAdapter())
    registry.register(GodsEyeAdapter())
    registry.register(ObsidianAdapter())
    return registry.adapters


def get_adapter(name: str) -> Optional[ToolAdapter]:
    return registry.get(name)


def get_tool_names() -> list:
    return list(registry.adapters.keys())
