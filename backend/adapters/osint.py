"""
GateWay:Oblivion — OSINT Composite Adapter
==========================================

Optional local OSINT tools, one adapter, graceful degradation:
  sherlock    — username → social accounts
  maigret     — username dossier across thousands of sites
  theHarvester — emails, subdomains, hosts for a domain
  amass       — passive attack-surface / subdomain mapping
  spiderfoot  — multi-module OSINT automation (CLI, -o json)

Binaries are located via OSINT_BIN_DIR or PATH. SpiderFoot can also be pointed
at its sf.py via SPIDERFOOT_PATH. Nothing here is required for existing tools.
"""

import asyncio
import json
import logging
import os
import shutil
import sys
import tempfile
from pathlib import Path
from typing import Optional

try:
    from adapters.base import ToolAdapter
except ImportError:
    from backend.adapters.base import ToolAdapter

logger = logging.getLogger("oblivion.osint")


class OSINTAdapter(ToolAdapter):
    name = "osint"

    BINARIES = ("sherlock", "maigret", "theHarvester", "amass", "spiderfoot")
    ACTIONS = [
        "tools", "version", "username_search", "domain_harvest",
        "attack_surface", "spiderfoot_scan",
    ]

    def __init__(self, bin_dir: Optional[str] = None, timeout: float = 180.0):
        default = Path(__file__).resolve().parents[1] / "tools" / "bin"
        self.bin_dir = bin_dir or os.environ.get("OSINT_BIN_DIR") or str(default)
        self.timeout = timeout
        self._connected = False

    # ── binary detection ──────────────────────────────────────────

    def _binary(self, name: str) -> Optional[str]:
        local = Path(self.bin_dir) / name
        if local.is_file() and os.access(local, os.X_OK):
            return str(local)
        return shutil.which(name)

    def _spiderfoot_command(self) -> Optional[list]:
        """SpiderFoot OSS is often run as `python sf.py`, not a standalone bin."""
        configured = os.environ.get("SPIDERFOOT_PATH")
        if configured and Path(configured).is_file():
            return [sys.executable, configured]
        local = Path(self.bin_dir) / "spiderfoot" / "sf.py"
        if local.is_file():
            return [sys.executable, str(local)]
        binary = self._binary("spiderfoot")
        return [binary] if binary else None

    async def health(self) -> dict:
        binaries = {name: bool(self._binary(name)) for name in self.BINARIES}
        binaries["spiderfoot"] = binaries["spiderfoot"] or self._spiderfoot_command() is not None
        available = any(binaries.values())
        return {
            "name": self.name,
            "status": "available" if available else "unavailable",
            "available": available,
            "connected": self._connected or available,
            "bin_dir": self.bin_dir,
            "binaries": binaries,
            "actions": self.get_actions(),
        }

    async def connect(self) -> bool:
        status = await self.health()
        self._connected = status["available"]
        return self._connected

    async def disconnect(self) -> None:
        self._connected = False

    def get_actions(self) -> list:
        return list(self.ACTIONS)

    # ── process helper ────────────────────────────────────────────

    @staticmethod
    def _clean(value, limit: int = 255) -> str:
        return str(value or "").strip()[:limit]

    async def _run(self, command: list, output_file: Optional[str] = None) -> dict:
        if not command or not command[0]:
            raise RuntimeError("OSINT tool not installed — set OSINT_BIN_DIR or SPIDERFOOT_PATH")
        proc = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
        stdout = out.decode("utf-8", "ignore") if isinstance(out, bytes) else (out or "")
        stderr = err.decode("utf-8", "ignore") if isinstance(err, bytes) else (err or "")
        file_content = ""
        if output_file and Path(output_file).is_file():
            try:
                file_content = Path(output_file).read_text(encoding="utf-8", errors="ignore")
            except OSError:
                file_content = ""
        return {
            "returncode": proc.returncode,
            "stdout": stdout[:30000],
            "stderr": stderr[:2000],
            "file_content": file_content[:50000],
        }

    @staticmethod
    def _json_from(text: str):
        text = (text or "").strip()
        if not text:
            return None
        try:
            return json.loads(text)
        except ValueError:
            pass
        rows = []
        for line in text.splitlines():
            line = line.strip()
            if line.startswith("{"):
                try:
                    rows.append(json.loads(line))
                except ValueError:
                    continue
        return rows or None

    # ── actions ───────────────────────────────────────────────────

    async def execute(self, action: str, params: Optional[dict] = None) -> dict:
        params = params or {}

        if action == "tools":
            status = await self.health()
            return {"binaries": status["binaries"], "bin_dir": self.bin_dir}

        if action == "version":
            versions = {}
            for name in self.BINARIES:
                command = self._spiderfoot_command() if name == "spiderfoot" else (
                    [self._binary(name)] if self._binary(name) else None
                )
                if not command:
                    versions[name] = None
                    continue
                try:
                    flag = "-V" if name == "spiderfoot" else "-v"
                    proc = await asyncio.create_subprocess_exec(
                        *command, flag,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.STDOUT,
                    )
                    out, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
                    versions[name] = (out.decode("utf-8", "ignore") or "").strip().splitlines()[0][:200]
                except Exception as exc:  # noqa: BLE001
                    versions[name] = f"error: {exc}"
            return {"versions": versions}

        if action == "username_search":
            username = self._clean(params.get("username") or params.get("target"))
            if not username:
                raise ValueError("username_search requires 'username'")
            tool = self._clean(params.get("tool", "sherlock")).lower()
            tools = [tool] if tool in ("sherlock", "maigret") else ["sherlock", "maigret"]
            if not any(self._binary(name) for name in tools):
                raise RuntimeError(
                    f"{'/'.join(tools)} not installed — set OSINT_BIN_DIR or add to PATH"
                )
            results = {}
            for selected in tools:
                if selected == "sherlock":
                    binary = self._binary("sherlock")
                    if not binary:
                        results[selected] = {"error": "sherlock not installed"}
                        continue
                    with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as handle:
                        output_path = handle.name
                    try:
                        run = await self._run([
                            binary, username, "-o", output_path,
                            "--timeout", str(int(params.get("timeout", 15))),
                            "--no-color",
                        ], output_file=output_path)
                        urls = [
                            line.strip() for line in run["file_content"].splitlines()
                            if line.strip().startswith(("http://", "https://"))
                        ]
                        results[selected] = {"accounts": [{"url": url} for url in urls],
                                             "raw": run["stdout"][:4000]}
                    finally:
                        Path(output_path).unlink(missing_ok=True)
                else:
                    binary = self._binary("maigret")
                    if not binary:
                        results[selected] = {"error": "maigret not installed"}
                        continue
                    run = await self._run([binary, username, "--json", "ndjson"])
                    parsed = self._json_from(run["stdout"]) or []
                    accounts = []
                    for row in parsed if isinstance(parsed, list) else []:
                        if isinstance(row, dict) and row.get("url"):
                            accounts.append({
                                "url": row.get("url"),
                                "site": row.get("site") or row.get("name"),
                                "status": row.get("status"),
                            })
                    results[selected] = {"accounts": accounts, "raw": run["stdout"][:4000]}
            return {"tool": "osint", "username": username, "results": results}

        if action == "domain_harvest":
            domain = self._clean(params.get("domain") or params.get("target"))
            if not domain:
                raise ValueError("domain_harvest requires 'domain'")
            binary = self._binary("theHarvester")
            if not binary:
                raise RuntimeError("theHarvester not installed — set OSINT_BIN_DIR or add to PATH")
            sources = self._clean(params.get("sources") or params.get("source") or "all")
            with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
                output_path = handle.name
            try:
                run = await self._run([
                    binary, "-d", domain, "-b", sources, "-f", output_path,
                ], output_file=output_path)
            finally:
                Path(output_path).unlink(missing_ok=True)
            parsed = self._json_from(run["file_content"]) or {}
            emails, hosts, subdomains = [], [], []
            if isinstance(parsed, dict):
                for key in ("emails", "hosts", "domains"):
                    values = parsed.get(key) or []
                    if isinstance(values, list):
                        for value in values:
                            if key == "emails":
                                emails.append(value if isinstance(value, str) else value.get("email", ""))
                            elif key == "hosts":
                                hosts.append(value if isinstance(value, str) else value.get("host", ""))
                            else:
                                subdomains.append(value if isinstance(value, str) else value.get("domain", ""))
            return {
                "tool": "theHarvester", "domain": domain, "sources": sources,
                "emails": [x for x in emails if x], "hosts": [x for x in hosts if x],
                "subdomains": [x for x in subdomains if x], "raw": run["stdout"][:4000],
            }

        if action == "attack_surface":
            domain = self._clean(params.get("domain") or params.get("target"))
            if not domain:
                raise ValueError("attack_surface requires 'domain'")
            binary = self._binary("amass")
            if not binary:
                raise RuntimeError("amass not installed — set OSINT_BIN_DIR or add to PATH")
            with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as handle:
                output_path = handle.name
            command = [binary, "enum"]
            if params.get("active") is True:
                command += ["-active"]
            else:
                command += ["-passive"]
            command += ["-d", domain, "-json", output_path]
            try:
                run = await self._run(command, output_file=output_path)
            finally:
                Path(output_path).unlink(missing_ok=True)
            rows = self._json_from(run["file_content"]) or []
            assets = []
            for row in rows if isinstance(rows, list) else []:
                if isinstance(row, dict):
                    assets.append({
                        "name": row.get("name"),
                        "type": row.get("type"),
                        "source": row.get("source"),
                    })
            return {"tool": "amass", "domain": domain, "assets": assets, "raw": run["stdout"][:4000]}

        if action == "spiderfoot_scan":
            target = self._clean(params.get("target") or params.get("domain"))
            if not target:
                raise ValueError("spiderfoot_scan requires 'target'")
            command = self._spiderfoot_command()
            if not command:
                raise RuntimeError("SpiderFoot not installed — set SPIDERFOOT_PATH")
            args = ["-s", target, "-o", "json", "-q"]
            if params.get("modules"):
                args += ["-m", self._clean(params["modules"])]
            elif params.get("use_case"):
                args += ["-u", self._clean(params["use_case"], 20)]
            else:
                args += ["-u", "passive"]
            run = await self._run(command + args)
            rows = self._json_from(run["stdout"]) or []
            events = []
            for row in rows if isinstance(rows, list) else []:
                if isinstance(row, dict):
                    events.append({
                        "type": row.get("type"),
                        "data": row.get("data"),
                        "module": row.get("module"),
                        "source": row.get("source"),
                    })
            return {"tool": "spiderfoot", "target": target, "events": events,
                    "raw": run["stdout"][:5000]}

        raise ValueError(f"Unknown OSINT action: {action}")

    def normalize_result(self, raw):
        return {"source": "osint", "raw": raw}
