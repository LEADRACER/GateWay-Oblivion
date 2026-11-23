"""Embedded local persistence for GateWay:Oblivion.

SQLite in WAL mode: zero-configuration, ACID, single-file, no remote database.
Stores snapshots, canonical events and the hash-chained audit log in one DB.
Legacy JSON/JSONL files are imported automatically on first run.
"""

import hashlib
import json
import logging
import os
import shutil
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger("oblivion.local_db")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _checksum(payload: str) -> str:
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class LocalDB:
    SCHEMA_VERSION = 2

    def __init__(self, db_path: Optional[str] = None, legacy_dir: Optional[str] = None):
        base = Path(__file__).resolve().parents[1] / "data"
        db_path = Path(db_path or os.environ.get("OBLIVION_DB_PATH") or base / "oblivion.db").expanduser()
        if not db_path.is_absolute():
            db_path = base.parent / db_path
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        backup_dir = Path(os.environ.get("OBLIVION_BACKUP_DIR") or self.db_path.parent / "backups").expanduser()
        if not backup_dir.is_absolute():
            backup_dir = base.parent / backup_dir
        self.backup_dir = backup_dir
        self.backup_dir.mkdir(parents=True, exist_ok=True)
        self.legacy_dir = Path(legacy_dir or base)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.execute("PRAGMA busy_timeout=5000")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._init_schema()
        self._migrate_legacy()

    # ── schema ────────────────────────────────────────────────────

    def _init_schema(self) -> None:
        with self._conn:
            self._conn.executescript(f"""
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS snapshots (
                    name TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    checksum TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS events (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    source_tool TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    data TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_events_tool ON events(source_tool);
                CREATE INDEX IF NOT EXISTS idx_events_ts ON events(timestamp);
                CREATE TABLE IF NOT EXISTS audit (
                    seq INTEGER PRIMARY KEY,
                    timestamp TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    action TEXT NOT NULL,
                    data TEXT NOT NULL,
                    hash TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS engagement_entities (
                    kind TEXT NOT NULL,
                    id TEXT NOT NULL,
                    engagement_id TEXT NOT NULL,
                    state TEXT,
                    severity TEXT,
                    status TEXT,
                    data TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY (kind, id)
                );
                CREATE INDEX IF NOT EXISTS idx_eng_entities ON engagement_entities(engagement_id);
                CREATE INDEX IF NOT EXISTS idx_eng_kind ON engagement_entities(kind, state);
                CREATE TABLE IF NOT EXISTS engagement_events (
                    seq INTEGER PRIMARY KEY AUTOINCREMENT,
                    engagement_id TEXT NOT NULL,
                    event_id TEXT NOT NULL,
                    data TEXT NOT NULL,
                    timestamp TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_eng_events ON engagement_events(engagement_id);
            """)
            self._conn.execute(
                "INSERT OR REPLACE INTO meta(key, value) VALUES('schema_version', ?)",
                (str(self.SCHEMA_VERSION),),
            )

    def _migrate_legacy(self) -> None:
        """Import JSON snapshots and JSONL audit entries from a v5.1 install."""
        count = self._conn.execute("SELECT COUNT(*) FROM snapshots").fetchone()[0]
        if count == 0 and self.legacy_dir.is_dir():
            imported = 0
            for path in sorted(self.legacy_dir.glob("*.json")):
                if path.name.startswith("."):
                    continue
                try:
                    data = json.loads(path.read_text(encoding="utf-8"))
                except (OSError, ValueError):
                    continue
                self.save_snapshot(path.stem, data)
                imported += 1
            if imported:
                logger.info("Imported %d legacy JSON snapshots", imported)

        audit_count = self._conn.execute("SELECT COUNT(*) FROM audit").fetchone()[0]
        legacy_audit = self.legacy_dir / "audit.jsonl"
        if audit_count == 0 and legacy_audit.is_file():
            imported = 0
            try:
                for line in legacy_audit.read_text(encoding="utf-8").splitlines():
                    if not line.strip():
                        continue
                    entry = json.loads(line)
                    self.append_audit(entry)
                    imported += 1
            except (OSError, ValueError) as exc:
                logger.warning("Legacy audit migration failed: %s", exc)
            if imported:
                logger.info("Imported %d legacy audit entries", imported)

    # ── snapshots ─────────────────────────────────────────────────

    def save_snapshot(self, name: str, data: Any) -> None:
        payload = json.dumps(data, default=str, ensure_ascii=False, sort_keys=True)
        with self._lock, self._conn:
            self._conn.execute(
                """INSERT INTO snapshots(name, data, checksum, updated_at)
                   VALUES(?, ?, ?, ?)
                   ON CONFLICT(name) DO UPDATE SET
                     data=excluded.data, checksum=excluded.checksum,
                     updated_at=excluded.updated_at""",
                (name, payload, _checksum(payload), _now()),
            )

    def load_snapshot(self, name: str, default: Any = None) -> Any:
        row = self._conn.execute(
            "SELECT data, checksum FROM snapshots WHERE name = ?", (name,)
        ).fetchone()
        if not row:
            return default
        if _checksum(row["data"]) != row["checksum"]:
            logger.warning("Snapshot checksum mismatch: %s", name)
            return default
        try:
            return json.loads(row["data"])
        except ValueError:
            return default

    def list_snapshots(self) -> list:
        return [
            dict(row) for row in self._conn.execute(
                "SELECT name, updated_at, length(data) AS bytes FROM snapshots ORDER BY name"
            ).fetchall()
        ]

    # ── events ────────────────────────────────────────────────────

    def append_events(self, events: list) -> None:
        if not events:
            return
        rows = [
            (
                item.get("timestamp", _now()),
                item.get("source_tool", "unknown"),
                item.get("event_type", "info"),
                json.dumps(item, default=str, ensure_ascii=False),
            )
            for item in events
        ]
        with self._lock, self._conn:
            self._conn.executemany(
                "INSERT INTO events(timestamp, source_tool, event_type, data) VALUES(?, ?, ?, ?)",
                rows,
            )

    def load_events(self, limit: int = 500) -> list:
        rows = self._conn.execute(
            "SELECT data FROM events ORDER BY seq DESC LIMIT ?", (limit,)
        ).fetchall()
        out = []
        for row in reversed(rows):
            try:
                out.append(json.loads(row["data"]))
            except ValueError:
                continue
        return out

    # ── audit ─────────────────────────────────────────────────────

    def append_audit(self, entry: dict) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """INSERT OR REPLACE INTO audit(seq, timestamp, actor, action, data, hash)
                   VALUES(?, ?, ?, ?, ?, ?)""",
                (
                    int(entry.get("seq", 0)),
                    entry.get("timestamp", _now()),
                    entry.get("actor", "operator"),
                    entry.get("action", ""),
                    json.dumps(entry, default=str, ensure_ascii=False),
                    entry.get("hash", ""),
                ),
            )

    def load_audit(self, limit: int = 100, actor: Optional[str] = None, action: Optional[str] = None) -> list:
        query = "SELECT data FROM audit"
        clauses, params = [], []
        if actor:
            clauses.append("actor = ?")
            params.append(actor)
        if action:
            clauses.append("action LIKE ?")
            params.append(f"%{action}%")
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY seq DESC LIMIT ?"
        params.append(limit)
        out = []
        for row in self._conn.execute(query, params).fetchall():
            try:
                out.append(json.loads(row["data"]))
            except ValueError:
                continue
        return out

    def all_audit(self) -> list:
        rows = self._conn.execute("SELECT data FROM audit ORDER BY seq ASC").fetchall()
        out = []
        for row in rows:
            try:
                out.append(json.loads(row["data"]))
            except ValueError:
                continue
        return out

    def last_audit(self) -> Optional[dict]:
        row = self._conn.execute(
            "SELECT data FROM audit ORDER BY seq DESC LIMIT 1"
        ).fetchone()
        if not row:
            return None
        try:
            return json.loads(row["data"])
        except ValueError:
            return None

    # ── engagement entities ──────────────────────────────────────

    def upsert_entity(
        self,
        kind: str,
        entity_id: str,
        engagement_id: str,
        data: dict,
        state: str | None = None,
        severity: str | None = None,
        status: str | None = None,
    ) -> None:
        payload = json.dumps(data, default=str, ensure_ascii=False)
        now = _now()
        with self._lock, self._conn:
            self._conn.execute(
                """INSERT INTO engagement_entities
                   (kind, id, engagement_id, state, severity, status, data, created_at, updated_at)
                   VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(kind, id) DO UPDATE SET
                     state=excluded.state, severity=excluded.severity,
                     status=excluded.status, data=excluded.data, updated_at=excluded.updated_at""",
                (kind, entity_id, engagement_id, state, severity, status, payload, now, now),
            )

    def get_entity(self, kind: str, entity_id: str) -> dict | None:
        row = self._conn.execute(
            "SELECT data FROM engagement_entities WHERE kind = ? AND id = ?",
            (kind, entity_id),
        ).fetchone()
        if not row:
            return None
        try:
            return json.loads(row["data"])
        except ValueError:
            return None

    def list_entities(
        self,
        kind: str,
        engagement_id: str | None = None,
        limit: int = 200,
    ) -> list:
        query = "SELECT data FROM engagement_entities WHERE kind = ?"
        params: list = [kind]
        if engagement_id:
            query += " AND engagement_id = ?"
            params.append(engagement_id)
        query += " ORDER BY updated_at DESC LIMIT ?"
        params.append(limit)
        rows = self._conn.execute(query, params).fetchall()
        out = []
        for row in rows:
            try:
                out.append(json.loads(row["data"]))
            except ValueError:
                continue
        return out

    def delete_entity(self, kind: str, entity_id: str) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "DELETE FROM engagement_entities WHERE kind = ? AND id = ?",
                (kind, entity_id),
            )

    def append_engagement_event(self, engagement_id: str, event_id: str, data: dict) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """INSERT INTO engagement_events(engagement_id, event_id, data, timestamp)
                   VALUES(?, ?, ?, ?)""",
                (engagement_id, event_id, json.dumps(data, default=str), _now()),
            )

    def list_engagement_events(self, engagement_id: str, limit: int = 100) -> list:
        rows = self._conn.execute(
            """SELECT data FROM engagement_events WHERE engagement_id = ?
               ORDER BY seq DESC LIMIT ?""",
            (engagement_id, limit),
        ).fetchall()
        out = []
        for row in rows:
            try:
                out.append(json.loads(row["data"]))
            except ValueError:
                continue
        return out

    # ── maintenance ───────────────────────────────────────────────

    def integrity(self) -> dict:
        result = self._conn.execute("PRAGMA integrity_check").fetchone()[0]
        counts = {
            table: self._conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            for table in ("snapshots", "events", "audit", "engagement_entities", "engagement_events")
        }
        return {
            "integrity": result,
            "integrity_ok": result == "ok",
            "journal_mode": self._conn.execute("PRAGMA journal_mode").fetchone()[0],
            "db_path": str(self.db_path),
            "db_bytes": self.db_path.stat().st_size if self.db_path.exists() else 0,
            "counts": counts,
            "schema_version": self.SCHEMA_VERSION,
        }

    def backup(self, name: Optional[str] = None) -> dict:
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        target = self.backup_dir / (name or f"oblivion-{stamp}.db")
        with self._lock:
            source = sqlite3.connect(str(self.db_path))
            destination = sqlite3.connect(str(target))
            try:
                source.backup(destination)
            finally:
                destination.close()
                source.close()
        return {"path": str(target), "bytes": target.stat().st_size}

    def list_backups(self) -> list:
        return [
            {"name": p.name, "bytes": p.stat().st_size,
             "created_at": datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).isoformat()}
            for p in sorted(self.backup_dir.glob("*.db"), reverse=True)
        ]

    def vacuum(self) -> None:
        with self._lock:
            self._conn.execute("VACUUM")


local_db = LocalDB()
