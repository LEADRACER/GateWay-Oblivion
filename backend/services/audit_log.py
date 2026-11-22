"""Tamper-evident append-only audit log stored in the embedded SQLite DB.

Every entry links to the previous entry's hash; /api/audit/verify replays the
chain to detect modification or deletion. Actor comes from the X-Operator header
(default: "operator"). Legacy audit.jsonl is imported automatically on first run.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from services.local_db import local_db

logger = logging.getLogger("oblivion.audit")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class AuditLog:
    def __init__(self, path: Optional[str] = None):
        # `path` is accepted for compatibility; storage is now SQLite.
        self.path = local_db.db_path.parent / "audit.jsonl"
        self._db = local_db

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
        previous = self._db.last_audit() or {}
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
        self._db.append_audit(entry)
        return entry

    def list(self, limit: int = 100, actor: Optional[str] = None, action: Optional[str] = None) -> list:
        return self._db.load_audit(limit=limit, actor=actor, action=action)

    def verify(self) -> dict:
        entries = self._db.all_audit()
        prev_hash = "0" * 64
        for index, entry in enumerate(entries, start=1):
            if entry.get("prev_hash") != prev_hash:
                return {"valid": False, "entries": len(entries),
                        "broken_at": index, "reason": "prev_hash mismatch"}
            payload = json.dumps(
                {k: v for k, v in entry.items() if k != "hash"},
                sort_keys=True, default=str,
            )
            expected = hashlib.sha256((prev_hash + payload).encode("utf-8")).hexdigest()
            if entry.get("hash") != expected:
                return {"valid": False, "entries": len(entries),
                        "broken_at": index, "reason": "entry hash mismatch"}
            prev_hash = entry["hash"]
        return {"valid": True, "entries": len(entries), "broken_at": None, "reason": None}


audit_log = AuditLog()
