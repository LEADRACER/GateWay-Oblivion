"""
GateWay:Oblivion — ProjectDiscovery Composite Adapter
=====================================================

One adapter for the ProjectDiscovery recon/vuln toolchain. Each tool is optional:
health reports which binaries are available and actions fail clearly when a
binary is missing, so the existing build keeps working unchanged.

Tools: subfinder, httpx, katana, nuclei, naabu, dnsx
"""

import asyncio
import json
import logging
import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional

try:
    from adapters.base import ToolAdapter
except ImportError:
    from backend.adapters.base import ToolAdapter

logger = logging.getLogger("oblivion.projectdiscovery")


class ProjectDiscoveryAdapter(ToolAdapter):
    name = "projectdiscovery"

    BINARIES = ("subfinder", "httpx", "katana", "nuclei", "naabu", "dnsx")

    ACTIONS = [
        "tools", "version", "subdomains", "http_probe", "crawl",
        "nuclei_scan", "port_scan", "dns_resolve",
    ]

    def __init__(self, bin_dir: Optional[str] = None, timeout: float = 120.0):
        default = Path(__file__).resolve().parents[1] / "tools" / "bin"
        self.bin_dir = bin_dir or os.environ.get("PROJECTDISCOVERY_BIN_DIR") or str(default)
        self.timeout = timeout
        self._connected = False

    # ── binary detection ──────────────────────────────────────────

    def _binary(self, name: str) -> Optional[str]:
        local = Path(self.bin_dir) / name
        if local.is_file() and os.access(local, os.X_OK):
            return str(local)
        return shutil.which(name)

    async def health(self) -> dict:
        binaries = {tool: bool(self._binary(tool)) for tool in self.BINARIES}
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
    def _parse_json_lines(text: str) -> list:
        rows = []
        for line in (text or "").splitlines():
            line = line.strip()
            if not line or not line.startswith("{"):
                continue
            try:
                rows.append(json.loads(line))
            except ValueError:
                continue
        return rows

    async def _run(self, binary: str, args: list) -> dict:
        path = self._binary(binary)
        if not path:
            raise RuntimeError(
                f"{binary} not installed — set PROJECTDISCOVERY_BIN_DIR or add it to PATH"
            )
        proc = await asyncio.create_subprocess_exec(
            path, *args,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
        stdout = out.decode("utf-8", "ignore") if isinstance(out, bytes) else (out or "")
        stderr = err.decode("utf-8", "ignore") if isinstance(err, bytes) else (err or "")
        parsed = self._parse_json_lines(stdout)
        return {
            "tool": binary,
            "returncode": proc.returncode,
            "parsed": parsed,
            "raw": stdout[:20000],
            "stderr": stderr[:2000],
        }

    @staticmethod
    def _clean(value) -> str:
        return str(value or "").strip()[:255]

    # ── actions ───────────────────────────────────────────────────

    async def execute(self, action: str, params: Optional[dict] = None) -> dict:
        params = params or {}

        if action == "tools":
            return {"binaries": {b: self._binary(b) for b in self.BINARIES}}

        if action == "version":
            versions = {}
            for name in self.BINARIES:
                path = self._binary(name)
                if not path:
                    versions[name] = None
                    continue
                try:
                    proc = await asyncio.create_subprocess_exec(
                        path, "-version",
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.STDOUT,
                    )
                    out, _ = await asyncio.wait_for(proc.communicate(), timeout=15)
                    versions[name] = (out.decode("utf-8", "ignore") or "").strip().splitlines()[0][:200]
                except Exception as exc:  # noqa: BLE001
                    versions[name] = f"error: {exc}"
            return {"versions": versions}

        if action == "subdomains":
            domain = self._clean(params.get("domain") or params.get("target"))
            if not domain:
                raise ValueError("subdomains requires 'domain'")
            result = await self._run("subfinder", ["-d", domain, "-json", "-silent"])
            hosts = []
            for row in result["parsed"]:
                host = row.get("host") or row.get("domain")
                if host and host not in hosts:
                    hosts.append(host)
            return {"tool": "subfinder", "domain": domain, "subdomains": hosts, "raw": result["raw"]}

        if action == "http_probe":
            urls = params.get("urls") or []
            target = self._clean(params.get("target") or params.get("url"))
            if not urls and not target:
                raise ValueError("http_probe requires 'target' or 'urls'")
            args = ["-json", "-silent"]
            temp_path = None
            if urls:
                with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False, encoding="utf-8") as handle:
                    for url in urls[:1000]:
                        handle.write(self._clean(url) + "\n")
                    temp_path = handle.name
                args += ["-l", temp_path]
            else:
                args += ["-u", target]
            try:
                result = await self._run("httpx", args)
            finally:
                if temp_path:
                    Path(temp_path).unlink(missing_ok=True)
            probes = [{
                "url": row.get("url"),
                "status": row.get("status_code"),
                "title": row.get("title"),
                "tech": row.get("tech") or [],
            } for row in result["parsed"]]
            return {"tool": "httpx", "probes": probes, "raw": result["raw"]}

        if action == "crawl":
            url = self._clean(params.get("url") or params.get("target"))
            if not url:
                raise ValueError("crawl requires 'url'")
            args = ["-u", url, "-json", "-silent"]
            if params.get("depth"):
                args += ["-depth", str(int(params["depth"]))]
            result = await self._run("katana", args)
            found = []
            for row in result["parsed"]:
                endpoint = row.get("request", {}).get("endpoint") if isinstance(row.get("request"), dict) else None
                value = endpoint or row.get("url") or row.get("endpoint")
                if value and value not in found:
                    found.append(value)
            return {"tool": "katana", "url": url, "urls": found, "raw": result["raw"]}

        if action == "nuclei_scan":
            target = self._clean(params.get("target") or params.get("url"))
            if not target:
                raise ValueError("nuclei_scan requires 'target'")
            args = ["-u", target, "-json", "-silent"]
            if params.get("templates"):
                args += ["-t", self._clean(params["templates"])]
            if params.get("severity"):
                args += ["-severity", self._clean(params["severity"])]
            result = await self._run("nuclei", args)
            findings = [{
                "template": row.get("template-id"),
                "severity": (row.get("info") or {}).get("severity"),
                "matched_at": row.get("matched-at") or row.get("host"),
                "name": (row.get("info") or {}).get("name"),
            } for row in result["parsed"]]
            return {"tool": "nuclei", "target": target, "findings": findings, "raw": result["raw"]}

        if action == "port_scan":
            target = self._clean(params.get("target") or params.get("host"))
            if not target:
                raise ValueError("port_scan requires 'target'")
            args = ["-host", target, "-json", "-silent"]
            result = await self._run("naabu", args)
            ports = []
            for row in result["parsed"]:
                port = row.get("port")
                if port:
                    ports.append({"ip": row.get("ip") or target, "port": int(port)})
            return {"tool": "naabu", "target": target, "ports": ports, "raw": result["raw"]}

        if action == "dns_resolve":
            domain = self._clean(params.get("domain") or params.get("target"))
            if not domain:
                raise ValueError("dns_resolve requires 'domain'")
            result = await self._run("dnsx", ["-d", domain, "-json", "-silent"])
            records = [row for row in result["parsed"] if row]
            return {"tool": "dnsx", "domain": domain, "records": records, "raw": result["raw"]}

        raise ValueError(f"Unknown ProjectDiscovery action: {action}")

    def normalize_result(self, raw):
        return {"source": "projectdiscovery", "raw": raw}
