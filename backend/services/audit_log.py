"""Tamper-evident append-only audit log (SHA-256 hash chain).

Every entry links to the previous entry's hash; /api/audit/verify replays the
chain to detect modification or deletion. Actor comes from the X-Operator header
(default: "operator"). Stored in OBLIVION_DATA_DIR/audit.jsonl.
"""

import asyncio
import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Optional

logger = logging.getLogger("oblivion.audit")


def _now() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()


class AuditLog:
    def __init__(self, path: Optional[str] = None):
        base = Path(__file__).resolve().parents[1] / "data"
        self.path = Path(path or os.environ.get("OBLIVION_AUDIT_LOG") or base / "audit.jsonl")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = asyncio.Lock()

    def _entries(self) -> list:
        if not self.path.is_file():
            return []
        entries = []
        try:
            for line in self.path.read_text(encoding="utf-8").splitlines():
                if line.strip():
                    entries.append(json.loads(line))
        except (OSError, ValueError) as exc:
            logger.warning("Audit log read failed: %s", exc)
        return entries

    def _last(self) -> dict:
        entries = self._entries()
        return entries[-1] if entries else {}

    async def append(
        self,
        *,
        actor: str,
        action: str,
        target: Optional[str] = None,
        side: Optional[str] = None,
        resource: Optional[str] = None,
        result: Optional[dict] = None,
        metadata: Optional[dict] = None,
    ) -> dict:
        previous = self._last()
        seq = int(previous.get("seq", 0)) + 1
        entry = {
            "seq": seq,
            "timestamp": _now(),
            "actor": actor or "operator",
            "action": action,
            "target": target,
            "side": side,
            "resource": resource,
            "result": result or {},
            "metadata": metadata or {},
            "prev_hash": previous.get("hash", "0" * 64),
        }
        payload = json.dumps(
            {k: v for k, v in entry.items() if k != "hash"},
            sort_keys=True, default=str,
        )
        entry["hash"] = hashlib.sha256(
            (entry["prev_hash"] + payload).encode("utf-8")
        ).hexdigest()
        async with self._lock:
            with self.path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry, default=str) + "\n")
        return entry

    def list(self, limit: int = 100, actor: Optional[str] = None, action: Optional[str] = None) -> list:
        entries = self._entries()
        if actor:
            entries = [e for e in entries if e.get("actor") == actor]
        if action:
            entries = [e for e in entries if action in str(e.get("action", ""))]
        return list(reversed(entries))[:limit]

    def verify(self) -> dict:
        entries = self._entries()
        prev_hash = "0" * 64
        for index, entry in enumerate(entries, start=1):
            if entry.get("prev_hash") != prev_hash:
                return {
                    "valid": False,
                    "entries": len(entries),
                    "broken_at": index,
                    "reason": "prev_hash mismatch",
                }
            payload = json.dumps(
                {k: v for k, v in entry.items() if k != "hash"},
                sort_keys=True, default=str,
            )
            expected = hashlib.sha256((prev_hash + payload).encode("utf-8")).hexdigest()
            if entry.get("hash") != expected:
                return {
                    "valid": False,
                    "entries": len(entries),
                    "broken_at": index,
                    "reason": "entry hash mismatch",
                }
            prev_hash = entry["hash"]
        return {"valid": True, "entries": len(entries), "broken_at": None, "reason": None}


audit_log = AuditLog()
