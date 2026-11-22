"""
GateWay:Oblivion — Async Event Bus
==================================

Central normalized event bus. Every tool adapter (or internal service) emits
CanonicalEvents here; subscribers fan out to WebSocket clients, timeline
stores, audit logs and pipeline hooks.

Flow: tool execute/normalize -> event_bus.emit -> subscribers (WS, timeline, ...)
"""

import asyncio
import logging
from typing import Awaitable, Callable, List, Optional

try:
    from models.canonical import CanonicalEvent, canonical_event
except ImportError:
    from backend.models.canonical import CanonicalEvent, canonical_event

logger = logging.getLogger("oblivion.event_bus")


class EventBus:
    def __init__(self):
        self._subs: List[Callable[[CanonicalEvent], Awaitable[None]]] = []
        self._history: List[CanonicalEvent] = []
        self._max_history: int = 500

    def subscribe(self, cb) -> None:
        self._subs.append(cb)

    async def unsubscribe(self, cb) -> None:
        try:
            self._subs.remove(cb)
        except ValueError:
            pass

    async def publish(self, event: CanonicalEvent) -> None:
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]
        subscribers = list(self._subs)
        if subscribers:
            results = await asyncio.gather(
                *(cb(event) for cb in subscribers),
                return_exceptions=True,
            )
            for cb, result in zip(subscribers, results):
                if isinstance(result, Exception):
                    logger.warning("EventBus subscriber %s failed: %s", getattr(cb, "__name__", cb), result)

    async def emit(
        self,
        source_tool: str,
        event_type: str,
        payload: Optional[dict] = None,
        **kwargs,
    ) -> CanonicalEvent:
        event = canonical_event(source_tool, event_type, payload, **kwargs)
        await self.publish(event)
        return event

    def list_events(
        self,
        limit: int = 100,
        source_tool: Optional[str] = None,
        event_type: Optional[str] = None,
    ) -> list:
        events = list(self._history)
        if source_tool:
            events = [e for e in events if e.source_tool == source_tool]
        if event_type:
            events = [e for e in events if e.event_type == event_type]
        return sorted(events, key=lambda e: e.timestamp, reverse=True)[:limit]

    def dump(self) -> list:
        return [e.model_dump() for e in self._history]

    def restore(self, events: list) -> None:
        restored = []
        for item in events or []:
            try:
                restored.append(CanonicalEvent(**item))
            except Exception:  # noqa: BLE001
                continue
        self._history = restored[-self._max_history:]


event_bus = EventBus()
