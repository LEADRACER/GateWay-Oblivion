"""
GateWay:Oblivion — Metasploit Tool Adapter
==========================================

Bridges Oblivion's command surface to the Metasploit Framework.

Transports:
  - Preferred: native RPC (Metasploit msf-server listens on 127.0.0.1:55553).
  - Fallback: headless msfconsole execution via `msfconsole -q -n -x <script>`.

The adapter normalizes every execution through `normalize_result()` so the
event bus / pipeline layers only ever consume canonical-shaped payloads.

Actions:
  - version        -> framework version (msfconsole -V)
  - search         -> module search (params: query, type)
  - module_info   -> module info (params: module)
  - sessions_list -> active sessions (params: none)
  - run_module    -> launch module with options (params: module, options, run_command)
"""

import asyncio
import re
import shutil
import socket
import logging
from typing import Any, Optional
from urllib.parse import urlparse

try:
    from adapters.base import ToolAdapter
except ImportError:
    from backend.adapters.base import ToolAdapter

logger = logging.getLogger("oblivion.metasploit")


class MetasploitAdapter(ToolAdapter):
    name = "metasploit"

    def __init__(
        self,
        rpc_url: str = "http://127.0.0.1:55553",
        rpc_username: str = "msf",
        rpc_password: str = "",
        msfconsole_path: Optional[str] = None,
        timeout: float = 180.0,
    ):
        self.rpc_url = rpc_url
        self.rpc_username = rpc_username
        self.rpc_password = rpc_password
        self.msfconsole_path = msfconsole_path
        self.timeout = timeout
        self._connected = False

    # ── internals ──────────────────────────────────────────────────

    def _binary(self) -> Optional[str]:
        candidate = self.msfconsole_path or shutil.which("msfconsole") or "msfconsole"
        return candidate if shutil.which(candidate) else None

    def _rpc_address(self) -> tuple:
        parsed = urlparse(self.rpc_url or "http://127.0.0.1:55553")
        return (parsed.hostname or "127.0.0.1", int(parsed.port or 55553))

    def _rpc_reachable(self) -> bool:
        host, port = self._rpc_address()
        try:
            with socket.create_connection((host, port), timeout=3.0):
                return True
            return False
        except OSError:
            return False

    # ── ToolAdapter interface ──────────────────────────────────────

    async def health(self) -> dict:
        binary = self._binary()
        return {
            "name": self.name,
            "status": "available" if binary else "unavailable",
            "available": bool(binary),
            "rpc_reachable": self._rpc_reachable(),
            "rpc_url": self.rpc_url,
            "connected": self._connected,
        }

    async def connect(self) -> bool:
        ok = bool(self._binary()) and self._rpc_reachable()
        self._connected = ok
        return ok

    async def disconnect(self) -> None:
        self._connected = False

    # ── internals: headless script execution ───────────────────────

    async def _execute_script(self, action: str, commands: list) -> dict:
        binary = self._binary()
        if not binary:
            raise RuntimeError(
                "Metasploit console not found: msfconsole is not installed or not on PATH"
            )
        script = "; ".join(str(c) for c in commands if str(c).strip())
        proc = await asyncio.create_subprocess_exec(
            binary,
            "-q",
            "-n",
            "-x",
            script,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
        out_s = out.decode() if isinstance(out, bytes) else (out or "")
        err_s = err.decode() if isinstance(err, bytes) else (err or "")
        raw = (out_s or "").strip() or (err_s or "").strip()
        return {
            "raw": raw,
            "returncode": proc.returncode,
            "commands": [str(c) for c in commands if str(c).strip()],
            "action": action,
        }

    async def _version(self) -> dict:
        binary = self._binary()
        if not binary:
            raise RuntimeError("Metasploit console not found: msfconsole is not installed or not on PATH")
        proc = await asyncio.create_subprocess_exec(
            binary,
            "-q",
            "-n",
            "-V",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
        out_s = out.decode() if isinstance(out, bytes) else (out or "")
        err_s = err.decode() if isinstance(err, bytes) else (err or "")
        raw = (out_s or "").strip() or (err_s or "").strip()
        version = None
        match = re.search(r"Framework Version:\s*([0-9][0-9A-Za-z.\-]*)", raw)
        if match:
            version = match.group(1)
        return {"raw": raw, "returncode": proc.returncode, "version": version, "action": "version"}

    # ── actions ────────────────────────────────────────────────────

    async def execute(self, action: str, params: Optional[dict] = None) -> dict:
        params = params or {}

        if action == "version":
            return await self._version()

        if action == "search":
            module_type = params.get("type") or "exploit"
            query = params.get("query") or ""
            return await self._execute_script("search", [f"search {module_type} {query}".strip()])

        if action == "module_info":
            module = params.get("module") or ""
            return await self._execute_script("module_info", [f"info {module}".strip()])

        if action == "sessions_list":
            return await self._execute_script("sessions_list", ["sessions -l"])

        if action == "run_module":
            module = params.get("module") or ""
            options = params.get("options") or {}
            commands: list = [f"use {module}".strip()] if module else []
            commands += [
                f"set {k} {v}".strip()
                for k, v in (options or {}).items()
                if v is not None and str(v) != ""
            ]
            commands.append(str(params.get("run_command") or "exploit"))
            return await self._execute_script("run_module", ["; ".join(commands)])

        raise ValueError(f"Unknown Metasploit action: {action}")

    # ── capabilities ──────────────────────────────────────────────

    def get_actions(self) -> list:
        return ["version", "search", "module_info", "sessions_list", "run_module"]

    def normalize_result(self, raw: Any) -> dict:
        return {"source": self.name, "raw": raw}
