"""Deterministic stand-in: a rule-based structurer so the full import flow runs offline."""

from __future__ import annotations

from typing import Any

from app.agent.providers.base import StructuredResult


class FakeChatModel:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def structured(self, *, system: str, user: str, schema: dict[str, Any], max_tokens: int = 32000) -> StructuredResult:
        from app.ingest.heuristic import heuristic_structure

        self.calls.append({"system": system, "user": user})
        data = heuristic_structure(user)
        return StructuredResult(data=data, model="fake-heuristic", usage={"input_tokens": len(user) // 4, "output_tokens": 0})
