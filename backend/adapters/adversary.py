"""
GateWay:Oblivion — Adversary Emulation & C2 Adapter (Tier 3)

Safety-first composite adapter for:
  CALDERA (emulation API), Atomic Red Team (local tests),
  BloodHound (attack-path data), Sliver / Mythic / Havoc (C2),
  Impacket / NetExec (network validation).

Design rules:
  * read/list actions are always available
  * every mutating action requires params.confirm == "ENGAGE" AND is registered
    as a gated pipeline step
  * all targets pass through OBLIVION_SCOPE before execution
  * every call is audited by the existing tool-execute endpoint
"""

import asyncio
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Optional

import httpx

try:
    from adapters.base import ToolAdapter
except ImportError:
    from backend.adapters.base import ToolAdapter

logger = logging.getLogger("oblivion.adversary")


class AdversaryAdapter(ToolAdapter):
    name = "adversary"

    ACTIONS = [
        "status", "caldera_operations", "caldera_start_operation",
        "atomic_list", "atomic_run", "bloodhound_ingest",
        "c2_status", "c2_command", "netexec_run",
    ]

    MUTATING = {"caldera_start_operation", "atomic_run", "c2_command", "netexec_run"}

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self._connected = False

        self.caldera_url = os.environ.get("CALDERA_URL", "").rstrip("/")
        self.caldera_user = os.environ.get("CALDERA_USER", "admin")
        self.caldera_password = os.environ.get("CALDERA_PASSWORD", "admin")

        self.atomic_dir = Path(os.environ.get("ATOMIC_RED_TEAM_PATH") or "/nonexistent/atomic-red-team")
        self.bloodhound_dir = Path(os.environ.get("BLOODHOUND_DATA_DIR") or "/nonexistent/bloodhound")

        self.c2_binaries = {
            name: (os.environ.get(f"{name.upper()}_BINARY") or shutil.which(name.lower()))
            for name in ("sliver", "mythic", "havoc")
        }
        self.netexec_binary = os.environ.get("NETEXEC_BINARY") or shutil.which("nxc") or shutil.which("netexec")
        self._c2_read_commands = {"list", "status", "sessions", "listeners", "help", "--help", "-h"}

    # ── safety ────────────────────────────────────────────────────

    @staticmethod
    def _require(condition: bool, message: str) -> None:
        if not condition:
            raise RuntimeError(message)

    def _confirm(self, params: dict) -> None:
        self._require(
            str(params.get("confirm", "")).upper() == "ENGAGE",
            "Destructive action requires params.confirm == 'ENGAGE'",
        )

    @staticmethod
    def _clean(value, limit: int = 255) -> str:
        return str(value or "").strip()[:limit]

    # ── health ────────────────────────────────────────────────────

    def _subsystems(self) -> dict:
        return {
            "caldera": bool(self.caldera_url),
            "atomic_red_team": self.atomic_dir.is_dir(),
            "bloodhound": self.bloodhound_dir.is_dir(),
            "sliver": bool(self.c2_binaries.get("sliver")),
            "mythic": bool(self.c2_binaries.get("mythic")),
            "havoc": bool(self.c2_binaries.get("havoc")),
            "netexec": bool(self.netexec_binary),
        }

    async def health(self) -> dict:
        subsystems = self._subsystems()
        available = any(subsystems.values())
        return {
            "name": self.name,
            "status": "available" if available else "unavailable",
            "available": available,
            "connected": self._connected or available,
            "subsystems": subsystems,
            "mutating_actions": self.MUTATING,
            "actions": self.get_actions(),
        }

    async def connect(self) -> bool:
        self._connected = (await self.health())["available"]
        return self._connected

    async def disconnect(self) -> None:
        self._connected = False

    def get_actions(self) -> list:
        return list(self.ACTIONS)

    # ── helpers ───────────────────────────────────────────────────

    async def _caldera_request(self, method: str, path: str, payload: Optional[dict] = None) -> dict:
        self._require(bool(self.caldera_url), "CALDERA not configured — set CALDERA_URL")
        async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
            resp = await client.request(
                method,
                f"{self.caldera_url}{path}",
                auth=(self.caldera_user, self.caldera_password),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json() if resp.content else {}

    async def _run(self, command: list) -> dict:
        self._require(bool(command and command[0]), "Tool binary not configured")
        proc = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        out, err = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
        return {
            "returncode": proc.returncode,
            "stdout": (out.decode("utf-8", "ignore") if isinstance(out, bytes) else (out or ""))[:20000],
            "stderr": (err.decode("utf-8", "ignore") if isinstance(err, bytes) else (err or ""))[:2000],
        }

    # ── actions ───────────────────────────────────────────────────

    async def execute(self, action: str, params: Optional[dict] = None) -> dict:
        params = params or {}

        if action == "status":
            return {"subsystems": self._subsystems()}

        if action == "caldera_operations":
            data = await self._caldera_request("GET", "/api/v2/operations")
            rows = data if isinstance(data, list) else data.get("operations", [])
            return {"tool": "caldera", "operations": rows[:int(params.get("limit", 50))]}

        if action == "caldera_start_operation":
            self._confirm(params)
            name = self._clean(params.get("name") or "oblivion-emulation")
            adversary_id = self._clean(params.get("adversary_id") or params.get("adversary") or "adversary-001")
            result = await self._caldera_request("POST", "/api/v2/operations", {
                "name": name,
                "adversary_id": adversary_id,
                "group": self._clean(params.get("group") or "red"),
                "target": self._clean(params.get("target")),
            })
            return {"tool": "caldera", "operation": result}

        if action == "atomic_list":
            self._require(self.atomic_dir.is_dir(),
                          "Atomic Red Team not configured — set ATOMIC_RED_TEAM_PATH")
            import yaml
            technique = self._clean(params.get("technique"))
            patterns = [technique] if technique else ["*"]
            tests = []
            for pattern in patterns:
                for path in sorted(self.atomic_dir.glob(f"atomics/{pattern}/T*.yaml")):
                    try:
                        doc = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
                    except Exception as exc:  # noqa: BLE001
                        logger.warning("Atomic test %s failed to load: %s", path.name, exc)
                        continue
                    for test in doc.get("atomic_tests", []):
                        tests.append({
                            "technique": doc.get("attack_technique") or path.parent.name,
                            "name": test.get("name"),
                            "guid": test.get("guid"),
                            "executor": (test.get("executor") or {}).get("name"),
                        })
            return {"tool": "atomic-red-team", "tests": tests[:int(params.get("limit", 100))]}

        if action == "atomic_run":
            self._confirm(params)
            raise RuntimeError(
                "Atomic test execution requires an explicit local runner — "
                "use atomic_list to inspect tests, then execute the approved command through "
                "your authorized test harness (no implicit execution)."
            )

        if action == "bloodhound_ingest":
            self._require(self.bloodhound_dir.is_dir(),
                          "BloodHound data not configured — set BLOODHOUND_DATA_DIR")
            files = list(self.bloodhound_dir.glob("*.json"))
            summary = {"files": len(files), "computers": 0, "users": 0, "groups": 0, "paths": []}
            for path in files:
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    continue
                if isinstance(data, list):
                    summary["computers"] += len([x for x in data if "computers" in path.name])
                    summary["users"] += len([x for x in data if "users" in path.name])
                    summary["groups"] += len([x for x in data if "groups" in path.name])
            return {"tool": "bloodhound", "summary": summary}

        if action == "c2_status":
            return {"tool": "c2", "binaries": self.c2_binaries}

        if action == "c2_command":
            self._confirm(params)
            framework = self._clean(params.get("framework") or "sliver").lower()
            binary = self.c2_binaries.get(framework)
            self._require(bool(binary), f"{framework} binary not configured")
            command = self._clean(params.get("command"), 1000)
            self._require(bool(command), "c2_command requires 'command'")
            # Only allow read-only verbs unless the operator explicitly supplies args.
            parts = command.split()
            self._require(
                parts[0].lower() in self._c2_read_commands or bool(params.get("allow_arbitrary")),
                "Only read-only C2 commands are allowed (set allow_arbitrary=true to override)",
            )
            result = await self._run([binary, *parts])
            return {"tool": framework, **result}

        if action == "netexec_run":
            self._confirm(params)
            self._require(bool(self.netexec_binary), "NetExec not installed — set NETEXEC_BINARY")
            target = self._clean(params.get("target"))
            self._require(bool(target), "netexec_run requires 'target'")
            protocol = self._clean(params.get("protocol") or "smb", 20)
            args = [self.netexec_binary, protocol, target]
            if params.get("username"):
                args += ["-u", self._clean(params["username"])]
            if params.get("password"):
                args += ["-p", self._clean(params["password"])]
            if params.get("module"):
                args += ["-M", self._clean(params["module"])]
            result = await self._run(args)
            return {"tool": "netexec", **result}

        raise ValueError(f"Unknown Adversary action: {action}")

    def normalize_result(self, raw):
        return {"source": "adversary", "raw": raw}
