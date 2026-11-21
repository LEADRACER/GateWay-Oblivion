"""
GateWay:Oblivion — Tool Adapter Registry
========================================

Owns the live instances of every tool adapter and aggregates health checks.
"""

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

    def register(self, adapter: ToolAdapter) -> ToolAdapter:
        self.adapters[adapter.name] = adapter
        return adapter

    def get(self, name: str) -> Optional[ToolAdapter]:
        return self.adapters.get(name)

    def list(self) -> list:
        return list(self.adapters.keys())

    async def health_all(self) -> dict:
        results = {}
        for name, adapter in self.adapters.items():
            try:
                results[name] = await adapter.health()
            except Exception as e:  # noqa: BLE001
                results[name] = {"name": name, "status": "error", "error": str(e)}
        return results


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
