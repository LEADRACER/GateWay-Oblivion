"""
GateWay:Oblivion — NetVision WebSocket Bridge

Connects to NetVision's live WebSocket using the `websockets` library,
subscribes to scan/health/vuln events, and relays them to Oblivion's
own WebSocket clients via the local connection manager.
"""

import asyncio
import json
import logging
from typing import Optional

import websockets

logger = logging.getLogger("oblivion.ws_bridge")


class NetVisionWSBridge:
    """Maintains a persistent WebSocket connection to NetVision."""

    def __init__(self, url: str = "ws://localhost:8000/ws"):
        self.url = url
        self._task: Optional[asyncio.Task] = None
        self._listeners: list = []
        self._connected = False
        self._last_event: Optional[dict] = None

    @property
    def is_connected(self) -> bool:
        return self._connected

    @property
    def last_event(self) -> Optional[dict]:
        return self._last_event

    def add_listener(self, ws):
        self._listeners.append(ws)

    def remove_listener(self, ws):
        if ws in self._listeners:
            self._listeners.remove(ws)

    async def _forward_to_listeners(self, message: dict):
        dead = []
        for listener in self._listeners:
            try:
                await listener.send_json(message)
            except Exception:
                dead.append(listener)
        for d in dead:
            self.remove_listener(d)

    async def connect(self):
        if self._task and not self._task.done():
            return
        self._task = asyncio.create_task(self._run())

    async def _run(self):
        reconnect_delay = 1
        while True:
            try:
                async with websockets.connect(self.url) as ws:
                    self._connected = True
                    reconnect_delay = 1
                    logger.info("Connected to NetVision WebSocket at %s", self.url)

                    async for raw in ws:
                        try:
                            data = json.loads(raw)
                            self._last_event = data
                            await self._forward_to_listeners(data)
                        except json.JSONDecodeError:
                            pass

            except Exception as e:
                logger.warning(
                    "NetVision WS disconnected: %s (reconnect in %ds)",
                    e, reconnect_delay,
                )

            self._connected = False
            await asyncio.sleep(reconnect_delay)
            reconnect_delay = min(reconnect_delay * 2, 60)

    async def disconnect(self):
        if self._task:
            self._task.cancel()
            self._task = None
        self._connected = False
        self._listeners.clear()
