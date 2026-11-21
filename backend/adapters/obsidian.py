"""
GateWay:Oblivion — Obsidian Tool Adapter
=======================================

Exposes server-side Obsidian vault operations through Oblivion's unified tool
surface. Backed by ObsidianVaultService (direct vault file management — no
desktop app or REST API plugin required).

Actions:
  status, notes_list, note_read, note_create, note_update, note_append,
  note_delete, note_search, report_export,
  canvases_list, canvas_read, canvas_create, canvas_add_node, canvas_add_edge,
  canvas_generate
"""

import logging
from typing import Optional

try:
    from adapters.base import ToolAdapter
    from services.obsidian_service import ObsidianVaultService
except ImportError:
    from backend.adapters.base import ToolAdapter
    from backend.services.obsidian_service import ObsidianVaultService

logger = logging.getLogger("oblivion.obsidian_adapter")


class ObsidianAdapter(ToolAdapter):
    name = "obsidian"

    ACTIONS = [
        "status",
        "notes_list", "note_read", "note_create", "note_update", "note_append",
        "note_delete", "note_search", "report_export",
        "canvases_list", "canvas_read", "canvas_create",
        "canvas_add_node", "canvas_add_edge", "canvas_generate",
    ]

    def __init__(self, vault_path: Optional[str] = None):
        self.service = ObsidianVaultService(vault_path)
        self._connected = False

    async def health(self) -> dict:
        status = self.service.status()
        available = status["exists"] and status["writable"]
        return {
            "name": self.name,
            "status": "available" if available else "unavailable",
            "available": available,
            "connected": self._connected or available,
            "vault_path": status["vault_path"],
            "note_count": status["note_count"],
            "canvas_count": status["canvas_count"],
        }

    async def connect(self) -> bool:
        status = self.service.status()
        self._connected = status["exists"] and status["writable"]
        return self._connected

    async def disconnect(self) -> None:
        self._connected = False

    async def execute(self, action: str, params: Optional[dict] = None) -> dict:
        p = params or {}
        s = self.service

        if action == "status":
            return s.status()
        if action == "notes_list":
            return {"notes": s.list_notes(p.get("folder"))}
        if action == "note_read":
            return s.read_note(p.get("path", ""))
        if action == "note_create":
            return s.write_note(p.get("path", ""), p.get("content", ""), "overwrite")
        if action == "note_update":
            return s.write_note(p.get("path", ""), p.get("content", ""), "overwrite")
        if action == "note_append":
            return s.write_note(p.get("path", ""), p.get("content", ""), "append")
        if action == "note_delete":
            return s.delete_note(p.get("path", ""))
        if action == "note_search":
            return {"results": s.search_notes(p.get("query", ""), int(p.get("limit", 20)))}
        if action == "report_export":
            return s.export_report_note(p.get("report") or {})

        if action == "canvases_list":
            return {"canvases": s.list_canvases()}
        if action == "canvas_read":
            return s.read_canvas(p.get("name", ""))
        if action == "canvas_create":
            return s.write_canvas(p.get("name", ""), p.get("canvas") or {"nodes": [], "edges": []})
        if action == "canvas_add_node":
            return s.add_node(p.get("name", ""), p.get("node") or {})
        if action == "canvas_add_edge":
            return s.add_edge(p.get("name", ""), p.get("edge") or {})
        if action == "canvas_generate":
            return s.generate_pipeline_canvas(
                p.get("pipelines") or [],
                p.get("name") or "Oblivion Pipeline Map.canvas",
            )

        raise ValueError(f"Unknown Obsidian action: {action}")

    def get_actions(self) -> list:
        return list(self.ACTIONS)
