"""
Tool adapter base interface.
"""
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Optional


class ToolAdapter(ABC):
    name: str = "base"

    @abstractmethod
    async def health(self) -> dict: ...

    @abstractmethod
    async def connect(self) -> bool: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def execute(self, action: str, params: Optional[dict] = None) -> dict: ...

    async def stream_events(self) -> AsyncIterator[dict]:
        if False:
            yield {}
        return

    def normalize_result(self, raw: Any) -> dict:
        return {"source": self.name, "raw": raw}

    def get_actions(self) -> list[str]:
        """Action names this adapter supports. Override per concrete adapter."""
        return []
