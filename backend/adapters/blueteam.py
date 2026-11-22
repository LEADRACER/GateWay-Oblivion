"""
GateWay:Oblivion — Blue-Team Telemetry Adapter
==============================================

Optional local/self-hosted defensive sources, one adapter:
  Wazuh (XDR/SIEM REST), Suricata EVE JSON, Zeek notice logs,
  Sigma rules, YARA scanner, TheHive cases, MISP IOC feeds.

Every subsystem is independently configured via environment variables; missing
configuration degrades to a clear error instead of breaking the build.
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

logger = logging.getLogger("oblivion.blueteam")


class BlueTeamAdapter(ToolAdapter):
    name = "blueteam"

    ACTIONS = [
        "status", "wazuh_alerts", "wazuh_agents", "suricata_alerts",
        "zeek_notices", "sigma_match", "yara_scan", "thehive_cases",
        "misp_iocs", "create_case",
    ]

    def __init__(self, timeout: float = 20.0):
        self.timeout = timeout
        self._connected = False
        backend = Path(__file__).resolve().parents[1]

        self.wazuh_url = os.environ.get("WAZUH_URL", "").rstrip("/")
        self.wazuh_user = os.environ.get("WAZUH_USER", "")
        self.wazuh_password = os.environ.get("WAZUH_PASSWORD", "")
        self.wazuh_verify = os.environ.get("WAZUH_VERIFY_SSL", "false").lower() == "true"

        self.suricata_path = Path(os.environ.get("SURICATA_EVE_PATH", "/var/log/suricata/eve.json"))
        self.zeek_dir = Path(os.environ.get("ZEEK_LOG_DIR", "/var/log/zeek"))
        self.sigma_dir = Path(os.environ.get("SIGMA_RULES_DIR", str(backend / "rules" / "sigma")))
        self.yara_rules_dir = Path(os.environ.get("YARA_RULES_DIR", str(backend / "rules" / "yara")))
        self.yara_binary = os.environ.get("YARA_BINARY") or shutil.which("yara")

        self.thehive_url = os.environ.get("THEHIVE_URL", "").rstrip("/")
        self.thehive_key = os.environ.get("THEHIVE_API_KEY", "")
        self.misp_url = os.environ.get("MISP_URL", "").rstrip("/")
        self.misp_key = os.environ.get("MISP_API_KEY", "")

    # ── health ────────────────────────────────────────────────────

    def _subsystems(self) -> dict:
        return {
            "wazuh": bool(self.wazuh_url and self.wazuh_user and self.wazuh_password),
            "suricata": self.suricata_path.is_file(),
            "zeek": (self.zeek_dir / "notice.log").is_file(),
            "sigma": self.sigma_dir.is_dir(),
            "yara": bool(self.yara_binary and self.yara_rules_dir.is_dir()),
            "thehive": bool(self.thehive_url and self.thehive_key),
            "misp": bool(self.misp_url and self.misp_key),
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

    @staticmethod
    def _require(condition: bool, message: str) -> None:
        if not condition:
            raise RuntimeError(message)

    @staticmethod
    def _clean(value, limit: int = 255) -> str:
        return str(value or "").strip()[:limit]

    async def _wazuh_token(self) -> str:
        self._require(
            bool(self.wazuh_url and self.wazuh_user and self.wazuh_password),
            "Wazuh not configured — set WAZUH_URL, WAZUH_USER, WAZUH_PASSWORD",
        )
        async with httpx.AsyncClient(verify=self.wazuh_verify, timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.wazuh_url}/security/user/authenticate",
                auth=(self.wazuh_user, self.wazuh_password),
            )
            resp.raise_for_status()
            return resp.json().get("data", {}).get("token", "")

    async def _wazuh_get(self, path: str, params: dict) -> dict:
        token = await self._wazuh_token()
        async with httpx.AsyncClient(verify=self.wazuh_verify, timeout=self.timeout) as client:
            resp = await client.get(
                f"{self.wazuh_url}{path}",
                headers={"Authorization": f"Bearer {token}"},
                params=params,
            )
            resp.raise_for_status()
            return resp.json().get("data", {})

    @staticmethod
    def _tail_json(path: Path, limit: int) -> list:
        lines = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        rows = []
        for line in lines[-limit * 4:]:
            line = line.strip()
            if not line.startswith("{"):
                continue
            try:
                rows.append(json.loads(line))
            except ValueError:
                continue
        return list(reversed(rows))[:limit]

    # ── actions ───────────────────────────────────────────────────

    async def execute(self, action: str, params: Optional[dict] = None) -> dict:
        params = params or {}

        if action == "status":
            return {"subsystems": self._subsystems()}

        if action == "wazuh_alerts":
            data = await self._wazuh_get("/alerts", {"limit": int(params.get("limit", 50))})
            alerts = []
            for item in data.get("alerts", []):
                source = item.get("_source", {})
                rule = source.get("rule", {})
                alerts.append({
                    "id": item.get("_id"),
                    "timestamp": source.get("@timestamp"),
                    "title": rule.get("description"),
                    "severity": rule.get("level"),
                    "source_ip": source.get("data", {}).get("src_ip"),
                    "dest_ip": source.get("data", {}).get("dst_ip"),
                    "rule_id": rule.get("id"),
                })
            return {"tool": "wazuh", "alerts": alerts}

        if action == "wazuh_agents":
            data = await self._wazuh_get("/agents", {"limit": int(params.get("limit", 50))})
            agents = data.get("affected_items", data.get("items", []))
            return {"tool": "wazuh", "agents": agents}

        if action == "suricata_alerts":
            self._require(self.suricata_path.is_file(),
                          "Suricata EVE log not found — set SURICATA_EVE_PATH")
            rows = await asyncio.to_thread(self._tail_json, self.suricata_path, int(params.get("limit", 50)))
            alerts = []
            for row in rows:
                alert = row.get("alert") or {}
                if row.get("event_type") not in (None, "alert"):
                    continue
                alerts.append({
                    "timestamp": row.get("timestamp"),
                    "title": alert.get("signature") or row.get("event_type"),
                    "severity": "high" if alert.get("severity", 3) <= 1 else "medium",
                    "signature_id": alert.get("signature_id"),
                    "source_ip": row.get("src_ip"),
                    "dest_ip": row.get("dest_ip"),
                })
            return {"tool": "suricata", "alerts": alerts}

        if action == "zeek_notices":
            notice = self.zeek_dir / "notice.log"
            self._require(notice.is_file(), "Zeek notice.log not found — set ZEEK_LOG_DIR")
            rows = []
            fields = []
            for line in notice.read_text(encoding="utf-8", errors="ignore").splitlines():
                if line.startswith("#fields"):
                    fields = line.split("\t")[1:]
                elif line and not line.startswith("#") and fields:
                    values = line.split("\t")
                    rows.append(dict(zip(fields, values)))
            notices = [{
                "timestamp": row.get("ts"),
                "title": row.get("msg") or row.get("note"),
                "severity": "warning",
                "source_ip": row.get("src"),
                "dest_ip": row.get("dst"),
                "note": row.get("note"),
            } for row in rows[-int(params.get("limit", 50)):]]
            return {"tool": "zeek", "notices": notices}

        if action == "sigma_match":
            self._require(self.sigma_dir.is_dir(),
                          "Sigma rules directory not found — set SIGMA_RULES_DIR")
            import yaml
            rules = []
            for path in sorted(self.sigma_dir.glob("*.y*ml")):
                try:
                    rules.append(yaml.safe_load(path.read_text(encoding="utf-8")) or {})
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Sigma rule %s failed to load: %s", path.name, exc)
            events = params.get("events") or []
            matches = []
            for rule in rules:
                selection = (rule.get("detection") or {}).get("selection") or {}
                if not isinstance(selection, dict):
                    continue
                for event in events:
                    if not isinstance(event, dict):
                        continue
                    if all(
                        event.get(field) == expected
                        or (isinstance(expected, list) and event.get(field) in expected)
                        for field, expected in selection.items()
                    ):
                        matches.append({
                            "title": rule.get("title"),
                            "id": rule.get("id"),
                            "level": rule.get("level", "medium"),
                            "event": event,
                        })
                        break
            return {"tool": "sigma", "rules_loaded": len(rules), "matches": matches}

        if action == "yara_scan":
            self._require(bool(self.yara_binary),
                          "YARA binary not found — set YARA_BINARY or install yara")
            rules = self._clean(params.get("rules") or self.yara_rules_dir, 500)
            target = self._clean(params.get("path"), 500)
            self._require(bool(target), "yara_scan requires 'path'")
            proc = await asyncio.create_subprocess_exec(
                self.yara_binary, "-r", rules, target,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            out, err = await asyncio.wait_for(proc.communicate(), timeout=self.timeout)
            text = out.decode("utf-8", "ignore") if isinstance(out, bytes) else (out or "")
            matches = []
            for line in text.splitlines():
                parts = line.strip().split()
                if len(parts) >= 2:
                    matches.append({"rule": parts[0], "file": parts[1]})
            return {"tool": "yara", "matches": matches, "raw": text[:5000]}

        if action == "thehive_cases":
            self._require(bool(self.thehive_url and self.thehive_key),
                          "TheHive not configured — set THEHIVE_URL and THEHIVE_API_KEY")
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                resp = await client.get(
                    f"{self.thehive_url}/api/v1/case",
                    headers={"Authorization": f"Bearer {self.thehive_key}"},
                    params={"limit": int(params.get("limit", 50))},
                )
                resp.raise_for_status()
                cases = resp.json()
            return {"tool": "thehive", "cases": cases if isinstance(cases, list) else []}

        if action == "create_case":
            self._require(bool(self.thehive_url and self.thehive_key),
                          "TheHive not configured — set THEHIVE_URL and THEHIVE_API_KEY")
            title = self._clean(params.get("title"))
            self._require(bool(title), "create_case requires 'title'")
            payload = {
                "title": title,
                "description": self._clean(params.get("description"), 2000),
                "severity": int(params.get("severity", 2)),
                "tags": params.get("tags") or ["oblivion"],
            }
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                resp = await client.post(
                    f"{self.thehive_url}/api/v1/case",
                    headers={"Authorization": f"Bearer {self.thehive_key}"},
                    json=payload,
                )
                resp.raise_for_status()
                return {"tool": "thehive", "case": resp.json()}

        if action == "misp_iocs":
            self._require(bool(self.misp_url and self.misp_key),
                          "MISP not configured — set MISP_URL and MISP_API_KEY")
            async with httpx.AsyncClient(timeout=self.timeout, verify=False) as client:
                resp = await client.post(
                    f"{self.misp_url}/attributes/restSearch",
                    headers={"Authorization": self.misp_key, "Content-Type": "application/json"},
                    json={"returnFormat": "json", "limit": int(params.get("limit", 50))},
                )
                resp.raise_for_status()
                data = resp.json().get("response", {}).get("Attribute", [])
            iocs = [{"type": item.get("type"), "value": item.get("value"),
                     "event_id": item.get("event_id")} for item in data]
            return {"tool": "misp", "iocs": iocs}

        raise ValueError(f"Unknown Blue-Team action: {action}")

    def normalize_result(self, raw):
        return {"source": "blueteam", "raw": raw}
