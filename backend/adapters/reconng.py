"""
GateWay:Oblivion — Recon-ng Tool Adapter
========================================

Bridges Oblivion's command surface to the Recon-ng framework.

Transport: headless subprocess execution via `recon-ng -w <workspace> -r -`
(the `-r -` reads console commands from stdin) with each command list executed
in a fresh process against the configured workspace.

Actions:
  - module_search -> run a recon-ng module search (params: query) via `modules search <query>`
  - show          -> query workspace entities (params: entity -> hosts|services|vulns|contacts|credentials) via `show <entity>`
"""

import asyncio
import shutil
import logging
from typing import Optional

try:
    from adapters.base import ToolAdapter
except ImportError:
    from backend.adapters.base import ToolAdapter

logger = logging.getLogger("oblivion.reconng")


class ReconNgAdapter(ToolAdapter):
    name = "reconng"

    def __init__(
        self,
        workspace: str = "default",
        reconng_path: Optional[str] = None,
        timeout: float = 600.0,
    ):
        self.workspace = workspace
        self.reconng_path = reconng_path
        self.timeout = timeout
        self._connected = False

    # ── internals ──────────────────────────────────────────────────

    def _binary(self) -> Optional[str]:
        candidate = self.reconng_path or shutil.which("recon-ng") or "recon-ng"
        return candidate if shutil.which(candidate) else None

    # ── ToolAdapter interface ──────────────────────────────────────

    async def health(self) -> dict:
        return {
            "name": self.name,
            "status": "available" if self._binary() else "unavailable",
            "available": bool(self._binary()),
            "workspace": self.workspace,
            "connected": self._connected,
        }

    async def connect(self) -> bool:
        ok = bool(self._binary())
        self._connected = ok
        return ok

    async def disconnect(self) -> None:
        self._connected = False

    # ── internals: headless execution ──────────────────────────────

    async def _run(self, commands: list) -> dict:
        binary = self._binary()
        if not binary:
            raise RuntimeError(
                "Recon-ng not found: recon-ng is not installed or not on PATH"
            )
        input_text = "\n".join(str(c) for c in commands if str(c).strip()) + "\nexit\n"
        proc = await asyncio.create_subprocess_exec(
            binary,
            "-w",
            self.workspace,
            "--no-version",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(input=input_text.encode()), timeout=self.timeout)
        out_s = out.decode() if isinstance(out, bytes) else (out or "")
        err_s = err.decode() if isinstance(err, bytes) else (err or "")
        raw = (out_s or "").strip() or (err_s or "").strip()
        return {
            "raw": raw,
            "returncode": proc.returncode,
            "commands": [str(c) for c in commands if str(c).strip()],
            "workspace": self.workspace,
        }

    # ── actions ────────────────────────────────────────────────────

    async def execute(self, action: str, params: Optional[dict] = None) -> dict:
        params = params or {}

        if action == "module_search":
            query = params.get("query") or ""
            return await self._run([f"modules search {query}".strip()])

        if action == "show":
            entity = params.get("entity") or "hosts"
            return await self._run([f"show {entity}".strip()])

        raise ValueError(f"Unknown Recon-ng action: {action}")

    # ── capabilities ──────────────────────────────────────────────

    def get_actions(self) -> list:
        return ["module_search", "show"]

    def normalize_result(self, raw: Any) -> dict:
        return {"source": self.name, "raw": raw}
