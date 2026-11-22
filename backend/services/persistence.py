"""Durable file-backed persistence for Oblivion's in-memory stores.

Atomic JSON writes to OBLIVION_DATA_DIR (default: backend/data). Disable with
OBLIVION_PERSISTENCE=false. Snapshots are periodic; the audit log is append-only
and immediate for high-value actions.
"""

import asyncio
import json
import logging
import os
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("oblivion.persistence")


class PersistenceService:
    def __init__(self, data_dir: Optional[str] = None):
        default = Path(__file__).resolve().parents[1] / "data"
        self.data_dir = Path(data_dir or os.environ.get("OBLIVION_DATA_DIR") or default).expanduser()
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.enabled = os.environ.get("OBLIVION_PERSISTENCE", "true").lower() != "false"
        self._lock = asyncio.Lock()

    def path(self, name: str) -> Path:
        return self.data_dir / f"{name}.json"

    def load(self, name: str, default: Any = None) -> Any:
        if not self.enabled:
            return default
        path = self.path(name)
        if not path.is_file():
            return default
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as exc:
            logger.warning("Failed to load snapshot %s: %s", name, exc)
            return default

    async def save(self, name: str, data: Any) -> None:
        if not self.enabled:
            return
        path = self.path(name)
        tmp = path.with_suffix(".tmp")
        async with self._lock:
            try:
                tmp.write_text(
                    json.dumps(data, default=str, indent=2, ensure_ascii=False),
                    encoding="utf-8",
                )
                tmp.replace(path)
            except (OSError, TypeError, ValueError) as exc:
                logger.warning("Failed to save snapshot %s: %s", name, exc)


persistence = PersistenceService()


def dump_models(items: dict) -> dict:
    """Serialize a dict of Pydantic models (or plain values) to JSON-safe data."""
    return {
        key: value.model_dump() if hasattr(value, "model_dump") else value
        for key, value in items.items()
    }
