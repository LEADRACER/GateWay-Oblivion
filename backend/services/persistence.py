"""Durable persistence facade backed by the embedded SQLite store.

Public API is unchanged from the v5.1 JSON implementation; legacy JSON files are
imported into SQLite automatically by LocalDB on first startup.
"""

import logging
import os
from pathlib import Path
from typing import Any, Optional

from services.local_db import local_db

logger = logging.getLogger("oblivion.persistence")


class PersistenceService:
    def __init__(self, data_dir: Optional[str] = None):
        self.enabled = os.environ.get("OBLIVION_PERSISTENCE", "true").lower() != "false"
        self.data_dir = Path(data_dir) if data_dir else local_db.db_path.parent

    @property
    def path(self):
        return local_db.db_path

    def load(self, name: str, default: Any = None) -> Any:
        if not self.enabled:
            return default
        return local_db.load_snapshot(name, default)

    async def save(self, name: str, data: Any) -> None:
        if not self.enabled:
            return
        local_db.save_snapshot(name, data)


persistence = PersistenceService()


def dump_models(items: dict) -> dict:
    """Serialize a dict of Pydantic models (or plain values) to JSON-safe data."""
    return {
        key: value.model_dump() if hasattr(value, "model_dump") else value
        for key, value in items.items()
    }
