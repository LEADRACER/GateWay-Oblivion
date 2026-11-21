"""
GateWay:Oblivion — Autonomic Resilience Engine
==============================================

Self-managing primitives that make the backend self-monitoring,
self-protecting and self-healing without operator intervention:

  TTLCache       — bounded, single-flight result cache for expensive reads
  CircuitBreaker — fail-fast protection against repeatedly failing tools
  HealthMonitor  — background probes, adaptive intervals, auto-reconnect,
                   transition events (tool.online / tool.offline / tool.recovered)
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable, Optional

logger = logging.getLogger("oblivion.autonomy")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class CircuitOpen(Exception):
    """Raised when a tool's breaker is open and the call was rejected."""


# ── TTL cache ───────────────────────────────────────────────────────

class TTLCache:
    """Small in-memory TTL cache with single-flight de-duplication."""

    def __init__(self, ttl: float = 30.0, max_entries: int = 256):
        self.default_ttl = ttl
        self.max_entries = max_entries
        self._entries: dict[str, tuple[float, Any]] = {}
        self._inflight: dict[str, asyncio.Future] = {}
        self._hits = 0
        self._misses = 0

    @staticmethod
    def make_key(*parts: Any) -> str:
        return json.dumps(parts, sort_keys=True, default=str)

    async def get_or_create(
        self,
        key: str,
        factory: Callable[[], Awaitable[Any]],
        ttl: Optional[float] = None,
    ) -> tuple[Any, bool]:
        """Return (value, from_cache). Concurrent callers share one computation."""
        now = time.monotonic()
        entry = self._entries.get(key)
        if entry and entry[0] > now:
            self._hits += 1
            return entry[1], True
        self._misses += 1

        inflight = self._inflight.get(key)
        if inflight is not None:
            self._misses -= 1
            self._hits += 1
            return await asyncio.shield(inflight), True

        future: asyncio.Future = asyncio.get_running_loop().create_future()
        self._inflight[key] = future
        try:
            value = await factory()
            if len(self._entries) >= self.max_entries:
                oldest = min(self._entries, key=lambda k: self._entries[k][0])
                self._entries.pop(oldest, None)
            self._entries[key] = (time.monotonic() + (ttl or self.default_ttl), value)
            if not future.done():
                future.set_result(value)
            return value, False
        except Exception as exc:  # noqa: BLE001
            if not future.done():
                future.set_exception(exc)
                future.exception()  # mark retrieved if nobody else awaits
            raise
        finally:
            self._inflight.pop(key, None)

    def invalidate(self, prefix: Optional[str] = None) -> int:
        if prefix is None:
            count = len(self._entries)
            self._entries.clear()
            return count
        keys = [k for k in self._entries if k.startswith(prefix)]
        for k in keys:
            self._entries.pop(k, None)
        return len(keys)

    def stats(self) -> dict:
        total = self._hits + self._misses
        return {
            "entries": len(self._entries),
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(self._hits / total * 100, 1) if total else 0.0,
        }


# ── Circuit breaker ────────────────────────────────────────────────

class CircuitBreaker:
    """Fail-fast guard that recovers automatically after a cooldown."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        cooldown: float = 30.0,
        success_threshold: int = 2,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.cooldown = cooldown
        self.success_threshold = success_threshold
        self.state = "closed"  # closed | open | half-open
        self.failures = 0
        self.successes = 0
        self.opened_at: float = 0.0
        self.last_error: Optional[str] = None
        self.rejections = 0
        self._lock = asyncio.Lock()

    async def call(self, func: Callable[..., Awaitable[Any]], *args, **kwargs) -> Any:
        async with self._lock:
            self._guard()
        try:
            result = await func(*args, **kwargs)
        except CircuitOpen:
            raise
        except Exception as exc:  # noqa: BLE001
            async with self._lock:
                self._record_failure(exc)
            raise
        async with self._lock:
            self._record_success()
        return result

    def _guard(self) -> None:
        if self.state != "open":
            return
        if time.monotonic() - self.opened_at >= self.cooldown:
            self.state = "half-open"
            self.successes = 0
            return
        self.rejections += 1
        raise CircuitOpen(
            f"Circuit open for '{self.name}' — retry after "
            f"{max(0, int(self.cooldown - (time.monotonic() - self.opened_at)))}s"
        )

    def _record_failure(self, exc: Exception) -> None:
        self.failures += 1
        self.last_error = str(exc)
        if self.state == "half-open" or self.failures >= self.failure_threshold:
            self.state = "open"
            self.opened_at = time.monotonic()

    def _record_success(self) -> None:
        if self.state == "half-open":
            self.successes += 1
            if self.successes >= self.success_threshold:
                self.state = "closed"
                self.failures = 0
                self.successes = 0
                self.last_error = None
            return
        self.failures = 0
        self.last_error = None

    def force_open(self) -> None:
        self.state = "open"
        self.opened_at = time.monotonic()

    def reset(self) -> None:
        self.state = "closed"
        self.failures = 0
        self.successes = 0
        self.opened_at = 0.0
        self.last_error = None

    def snapshot(self) -> dict:
        remaining = max(0, self.cooldown - (time.monotonic() - self.opened_at)) if self.state == "open" else 0
        return {
            "state": self.state,
            "failures": self.failures,
            "rejections": self.rejections,
            "last_error": self.last_error,
            "retry_after_seconds": round(remaining, 1),
        }


# ── Health monitor ─────────────────────────────────────────────────

class HealthMonitor:
    """Background autonomic controller for the whole tool fleet."""

    def __init__(self, registry, interval: float = 30.0, max_interval: float = 300.0):
        self.registry = registry
        self.interval = interval
        self.max_interval = max_interval
        self._states: dict[str, dict] = {}
        self._breakers: dict[str, CircuitBreaker] = {}
        self._task: Optional[asyncio.Task] = None
        self._lock = asyncio.Lock()
        self.checks = 0
        self.recoveries = 0

    def breaker(self, name: str) -> CircuitBreaker:
        if name not in self._breakers:
            self._breakers[name] = CircuitBreaker(name)
        return self._breakers[name]

    async def start(self) -> None:
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._loop())
        logger.info("Autonomic health monitor started (interval=%ss)", self.interval)

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _loop(self) -> None:
        while True:
            try:
                await self.check_all(force=True)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Health monitor check failed: %s", exc)
            await asyncio.sleep(self.next_interval())

    def next_interval(self) -> float:
        """Self-optimizing: probe failing tools more often, healthy ones less."""
        failing = [s for s in self._states.values() if s["state"] != "online"]
        if not failing:
            return min(self.interval * 2, self.max_interval)
        worst = max(s["failures"] for s in failing)
        return min(self.interval * (2 ** min(worst, 3)), self.max_interval)

    async def check_all(self, force: bool = True) -> dict:
        results = await self.registry.health_all(force=force)
        for name, result in results.items():
            await self._process(name, result)
        self.checks += 1
        return self.snapshot()

    async def _process(self, name: str, result: dict) -> None:
        available = bool(result.get("available", result.get("status") == "available"))
        async with self._lock:
            state = self._states.setdefault(
                name,
                {"state": "unknown", "failures": 0, "last_check": None, "last_error": None, "available": False},
            )
            previous = state["state"]
            state["last_check"] = _now()
            state["available"] = available
            state["last_error"] = result.get("error")
            if available:
                state["failures"] = 0
                state["state"] = "online"
            else:
                state["failures"] += 1
                state["state"] = "offline" if state["failures"] < 3 else "degraded"
                if state["failures"] >= 3:
                    self.breaker(name).force_open()

        if previous != state["state"]:
            await self._emit_transition(name, state)

    async def recover(self, name: str) -> dict:
        """Self-healing: attempt to reconnect a degraded/offline tool."""
        adapter = self.registry.get(name)
        if adapter is None:
            return {"tool": name, "recovered": False, "error": "Unknown tool"}
        try:
            ok = bool(await adapter.connect())
        except Exception as exc:  # noqa: BLE001
            ok = False
            error = str(exc)
        else:
            error = None
        if ok:
            self.recoveries += 1
            self.breaker(name).reset()
            async with self._lock:
                state = self._states.setdefault(name, {})
                state.update(state="online", failures=0, last_error=None, available=True, last_check=_now())
            await self._emit_transition(name, state, forced="recovered")
        return {"tool": name, "recovered": ok, "error": error}

    async def _emit_transition(self, name: str, state: dict, forced: Optional[str] = None) -> None:
        try:
            from services.event_bus import event_bus
        except ImportError:
            from backend.services.event_bus import event_bus
        event_type = f"tool.{forced}" if forced else f"tool.{state['state']}"
        await event_bus.emit(
            source_tool="system",
            event_type=event_type,
            payload={"tool": name, "state": state["state"], "failures": state["failures"]},
            severity="warning" if state["state"] != "online" else "info",
            title=f"{name} {event_type.split('.')[-1]}",
        )

    def snapshot(self) -> dict:
        tools = {}
        for name, state in self._states.items():
            tools[name] = {**state, "breaker": self.breaker(name).snapshot()}
        return {
            "generated_at": _now(),
            "running": bool(self._task and not self._task.done()),
            "checks": self.checks,
            "recoveries": self.recoveries,
            "next_interval_seconds": round(self.next_interval(), 1),
            "tools": tools,
        }
