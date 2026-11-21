"""
GateWay:Oblivion — Obsidian Vault Service (server-side)

Manages notes and JSON Canvas files inside an Obsidian vault without requiring
the desktop app. Notes follow Obsidian Flavored Markdown conventions
(frontmatter, wikilinks, callouts); canvases follow JSON Canvas Spec 1.0.

The vault path is configurable via OBSIDIAN_VAULT_PATH (default:
/home/dark00/Obsidian/Vault). All file access is confined to that vault root.
"""

import os
import re
import json
import uuid
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("oblivion.obsidian")

DEFAULT_VAULT = "/home/dark00/Obsidian/Vault"
NOTES_FOLDER = "Oblivion/Notes"
CANVASES_FOLDER = "Oblivion/Canvases"

CANVAS_NODE_TYPES = {"text", "file", "link", "group"}
CANVAS_SIDES = {"top", "right", "bottom", "left"}
CANVAS_ENDS = {"none", "arrow"}


class ObsidianVaultService:
    def __init__(self, vault_path: Optional[str] = None):
        self.vault_path = Path(
            vault_path or os.environ.get("OBSIDIAN_VAULT_PATH", DEFAULT_VAULT)
        ).expanduser().resolve()
        self.notes_dir = self.vault_path / NOTES_FOLDER
        self.canvases_dir = self.vault_path / CANVASES_FOLDER

    # ── Safety helpers ────────────────────────────────────────────

    def _resolve(self, relative: str) -> Path:
        """Resolve a vault-relative path, rejecting traversal outside the vault."""
        rel = (relative or "").strip().lstrip("/")
        if not rel:
            raise ValueError("Path must not be empty")
        target = (self.vault_path / rel).resolve()
        if target != self.vault_path and self.vault_path not in target.parents:
            raise ValueError(f"Path escapes vault root: {relative}")
        return target

    def _ensure_note_path(self, relative: str) -> Path:
        path = self._resolve(relative)
        if path.suffix.lower() != ".md":
            path = path.with_suffix(".md")
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    def _ensure_canvas_path(self, name: str) -> Path:
        clean = (name or "").strip().lstrip("/")
        if not clean:
            raise ValueError("Canvas name must not be empty")
        path = (self.canvases_dir / clean).resolve()
        if path != self.canvases_dir and self.canvases_dir not in path.parents:
            raise ValueError(f"Canvas path escapes canvas folder: {name}")
        if path.suffix.lower() != ".canvas":
            path = path.with_suffix(".canvas")
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    # ── Status ────────────────────────────────────────────────────

    def status(self) -> dict:
        exists = self.vault_path.is_dir()
        return {
            "vault_path": str(self.vault_path),
            "exists": exists,
            "writable": exists and os.access(self.vault_path, os.W_OK),
            "note_count": len(self.list_notes()) if exists else 0,
            "canvas_count": len(self.list_canvases()) if exists else 0,
            "notes_folder": NOTES_FOLDER,
            "canvases_folder": CANVASES_FOLDER,
            "rest_api_host": os.environ.get("OBSIDIAN_API_HOST", "https://localhost:27124"),
            "rest_api_configured": bool(os.environ.get("OBSIDIAN_API_KEY")),
        }

    # ── Notes management ──────────────────────────────────────────

    def list_notes(self, folder: Optional[str] = None) -> list:
        if not self.vault_path.is_dir():
            return []
        base = self._resolve(folder) if folder else self.vault_path
        if not base.is_dir():
            return []
        notes = []
        for path in sorted(base.rglob("*.md")):
            if ".obsidian" in path.parts:
                continue
            notes.append(str(path.relative_to(self.vault_path)))
        return notes

    def read_note(self, path: str) -> dict:
        target = self._ensure_note_path(path)
        if not target.is_file():
            raise FileNotFoundError(f"Note not found: {path}")
        return {"path": str(target.relative_to(self.vault_path)), "content": target.read_text(encoding="utf-8")}

    def write_note(self, path: str, content: str, mode: str = "overwrite") -> dict:
        target = self._ensure_note_path(path)
        if mode == "append" and target.exists():
            existing = target.read_text(encoding="utf-8")
            content = existing.rstrip() + "\n\n" + content.lstrip()
        target.write_text(content, encoding="utf-8")
        return {"path": str(target.relative_to(self.vault_path)), "mode": mode, "bytes": len(content.encode("utf-8"))}

    def delete_note(self, path: str) -> dict:
        target = self._ensure_note_path(path)
        if not target.is_file():
            raise FileNotFoundError(f"Note not found: {path}")
        target.unlink()
        return {"path": str(target.relative_to(self.vault_path)), "deleted": True}

    def search_notes(self, query: str, limit: int = 20) -> list:
        term = (query or "").lower()
        if not term:
            return []
        results = []
        for rel in self.list_notes():
            try:
                text = (self.vault_path / rel).read_text(encoding="utf-8")
            except OSError:
                continue
            if term in text.lower() or term in rel.lower():
                idx = text.lower().find(term)
                excerpt = text[max(0, idx - 80): idx + 160].replace("\n", " ").strip()
                results.append({"path": rel, "excerpt": excerpt})
                if len(results) >= limit:
                    break
        return results

    def export_report_note(self, report: dict) -> dict:
        """Render an Oblivion report as an Obsidian Flavored Markdown note."""
        title = report.get("title") or "Untitled Report"
        report_type = report.get("report_type") or "executive"
        slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:60] or "report"
        tags = ["oblivion", "report", report_type]
        frontmatter = [
            "---",
            f'title: "{title}"',
            f"tags:",
            *[f"  - {t}" for t in tags],
            f"aliases:",
            f"  - Oblivion {report_type.title()} — {title}",
            f'date: {(report.get("generated_at") or "")[:10]}',
            f"status: {report.get('status') or 'draft'}",
            f'source_tool: Oblivion',
        ]
        risk = report.get("risk_score")
        if risk is not None:
            frontmatter.append(f"risk_score: {risk}")
        frontmatter.append("---")

        lines = frontmatter + ["", f"# {title}", "", "> [!info] Report metadata"]
        lines.append(f"> Type: {report_type} · Status: {report.get('status') or 'draft'}")
        if risk is not None:
            lines.append(f"> Risk score: {risk}")
        if report.get("scope"):
            lines.append(f"> Scope: {report['scope']}")
        lines.append("")

        if report.get("summary"):
            lines += ["## Executive Summary", "", str(report["summary"]), ""]

        content = report.get("content") or {}
        if isinstance(content, dict):
            for section, body in content.items():
                lines += [f"## {str(section).replace('_', ' ').title()}", ""]
                if isinstance(body, list):
                    for item in body:
                        if isinstance(item, dict):
                            lines.append(f"- {item.get('cve') or item.get('cve_id') or item.get('title') or str(item)}")
                        else:
                            lines.append(f"- {item}")
                elif isinstance(body, dict):
                    for k, v in body.items():
                        lines.append(f"- **{k}**: {v}")
                else:
                    lines.append(str(body))
                lines.append("")

        lines += [
            "> [!warning] Operational context",
            "> Generated by [[Oblivion Overview]] — see [[Oblivion Pipeline Map]] for tool flow.",
            "",
            "## Related",
            "",
            "- [[Oblivion Overview]]",
            "- [[Oblivion Pipeline Map]]",
            "",
        ]
        return self.write_note(f"{NOTES_FOLDER}/{slug}.md", "\n".join(lines))

    # ── Canvas management (JSON Canvas Spec 1.0) ──────────────────

    @staticmethod
    def new_id(used: set) -> str:
        while True:
            value = uuid.uuid4().hex[:16]
            if value not in used:
                used.add(value)
                return value

    def list_canvases(self) -> list:
        if not self.vault_path.is_dir():
            return []
        base = self.canvases_dir if self.canvases_dir.is_dir() else self.vault_path
        return [
            str(p.relative_to(self.vault_path))
            for p in sorted(base.rglob("*.canvas"))
            if ".obsidian" not in p.parts
        ]

    def read_canvas(self, name: str) -> dict:
        target = self._ensure_canvas_path(name)
        if not target.is_file():
            raise FileNotFoundError(f"Canvas not found: {name}")
        return json.loads(target.read_text(encoding="utf-8"))

    def write_canvas(self, name: str, canvas: dict) -> dict:
        self.validate_canvas(canvas)
        target = self._ensure_canvas_path(name)
        target.write_text(json.dumps(canvas, indent=2, ensure_ascii=False), encoding="utf-8")
        return {"path": str(target.relative_to(self.vault_path)), "nodes": len(canvas.get("nodes", [])), "edges": len(canvas.get("edges", []))}

    @staticmethod
    def validate_canvas(canvas: dict) -> None:
        nodes = canvas.get("nodes", [])
        edges = canvas.get("edges", [])
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("Canvas must have nodes[] and edges[] arrays")
        ids = set()
        for node in nodes:
            nid = node.get("id")
            if not nid or nid in ids:
                raise ValueError(f"Duplicate or missing node id: {nid}")
            ids.add(nid)
            if node.get("type") not in CANVAS_NODE_TYPES:
                raise ValueError(f"Invalid node type: {node.get('type')}")
            for key in ("x", "y", "width", "height"):
                if not isinstance(node.get(key), int):
                    raise ValueError(f"Node {nid} missing integer '{key}'")
            if node["type"] == "text" and "text" not in node:
                raise ValueError(f"Text node {nid} missing 'text'")
            if node["type"] == "file" and "file" not in node:
                raise ValueError(f"File node {nid} missing 'file'")
            if node["type"] == "link" and "url" not in node:
                raise ValueError(f"Link node {nid} missing 'url'")
        for edge in edges:
            eid = edge.get("id")
            if not eid or eid in ids:
                raise ValueError(f"Duplicate or missing edge id: {eid}")
            ids.add(eid)
            if edge.get("fromNode") not in {n["id"] for n in nodes}:
                raise ValueError(f"Edge {eid} has dangling fromNode")
            if edge.get("toNode") not in {n["id"] for n in nodes}:
                raise ValueError(f"Edge {eid} has dangling toNode")
            for key in ("fromSide", "toSide"):
                if key in edge and edge[key] not in CANVAS_SIDES:
                    raise ValueError(f"Edge {eid} invalid {key}: {edge[key]}")
            for key in ("fromEnd", "toEnd"):
                if key in edge and edge[key] not in CANVAS_ENDS:
                    raise ValueError(f"Edge {eid} invalid {key}: {edge[key]}")

    def add_node(self, name: str, node: dict) -> dict:
        try:
            canvas = self.read_canvas(name)
        except FileNotFoundError:
            canvas = {"nodes": [], "edges": []}
        used = {n.get("id") for n in canvas["nodes"]} | {e.get("id") for e in canvas["edges"]}
        node = dict(node or {})
        node.setdefault("id", self.new_id(used))
        node.setdefault("type", "text")
        node.setdefault("x", 0)
        node.setdefault("y", 0)
        node.setdefault("width", 300)
        node.setdefault("height", 100)
        canvas.setdefault("nodes", []).append(node)
        self.write_canvas(name, canvas)
        return {"node": node, "path": str(self._ensure_canvas_path(name).relative_to(self.vault_path))}

    def add_edge(self, name: str, edge: dict) -> dict:
        canvas = self.read_canvas(name)
        used = {n.get("id") for n in canvas["nodes"]} | {e.get("id") for e in canvas["edges"]}
        edge = dict(edge or {})
        edge.setdefault("id", self.new_id(used))
        edge.setdefault("toEnd", "arrow")
        canvas.setdefault("edges", []).append(edge)
        self.write_canvas(name, canvas)
        return {"edge": edge}

    def generate_pipeline_canvas(self, pipelines: list, name: str = "Oblivion Pipeline Map.canvas") -> dict:
        """Generate a JSON Canvas visualization of Oblivion runbooks."""
        canvas = {"nodes": [], "edges": []}
        used: set = set()

        def nid() -> str:
            return self.new_id(used)

        title_id = nid()
        canvas["nodes"].append({
            "id": title_id,
            "type": "text",
            "x": 0,
            "y": 0,
            "width": 800,
            "height": 120,
            "text": "# GateWay:Oblivion — Pipeline Map\n\nMulti-tool orchestration: recon → scan → exploit → report. Generated from live runbooks.",
            "color": "5",
        })

        for p_idx, pipeline in enumerate(pipelines):
            steps = pipeline.get("steps", [])
            group_y = 180 + p_idx * 480
            group_id = nid()
            canvas["nodes"].append({
                "id": group_id,
                "type": "group",
                "x": 0,
                "y": group_y,
                "width": 940,
                "height": 420,
                "label": pipeline.get("name", "Pipeline"),
                "color": "4",
            })

            step_nodes = {}
            for s_idx, step in enumerate(steps):
                step_id = nid()
                step_nodes[step.get("id", str(s_idx))] = step_id
                gate = " · ⚠ HUMAN GATE" if step.get("gate") else ""
                canvas["nodes"].append({
                    "id": step_id,
                    "type": "text",
                    "x": 40 + (s_idx % 3) * 300,
                    "y": group_y + 60 + (s_idx // 3) * 140,
                    "width": 260,
                    "height": 110,
                    "text": f"## {step.get('name', 'Step')}\n\n`{step.get('tool')}::{step.get('action')}`{gate}",
                    "color": "2" if step.get("gate") else "6",
                })

            for step in steps:
                for dep in step.get("depends_on", []):
                    if dep in step_nodes and step.get("id") in step_nodes:
                        canvas["edges"].append({
                            "id": nid(),
                            "fromNode": step_nodes[dep],
                            "fromSide": "right",
                            "toNode": step_nodes[step["id"]],
                            "toSide": "left",
                            "toEnd": "arrow",
                            "label": "then",
                        })

        self.validate_canvas(canvas)
        result = self.write_canvas(name, canvas)
        note_rel = f"{NOTES_FOLDER}/Oblivion Overview.md"
        if not (self.vault_path / note_rel).exists():
            self.write_note(note_rel, self._overview_note())
        return result

    @staticmethod
    def _overview_note() -> str:
        return "\n".join([
            "---",
            'title: "Oblivion Overview"',
            "tags:",
            "  - oblivion",
            "  - overview",
            "aliases:",
            "  - GateWay:Oblivion",
            "---",
            "",
            "# GateWay:Oblivion",
            "",
            "Central security operations hub integrating NetVision, Metasploit, Recon-ng and God's Eye View.",
            "",
            "> [!info] Tool chain",
            "> Recon-ng / NetVision → event bus → pipeline orchestrator → Metasploit → reports.",
            "",
            "## Related",
            "",
            "- [[Oblivion Pipeline Map]]",
            "",
        ])


obsidian_service = ObsidianVaultService()
