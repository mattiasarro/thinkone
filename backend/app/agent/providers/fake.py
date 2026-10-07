"""Deterministic stand-in: a rule-based structurer so the full import flow runs offline."""

from __future__ import annotations

from typing import Any

from app.agent.providers.base import StructuredResult


class FakeChatModel:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def structured(self, *, system: str, user: str, schema: dict[str, Any], max_tokens: int = 32000) -> StructuredResult:
        from app.agent.prompts.plan_match import MARKER
        from app.ingest.heuristic import heuristic_structure

        self.calls.append({"system": system, "user": user})
        data = fake_plan_match(user) if system.startswith(MARKER) else heuristic_structure(user)
        return StructuredResult(data=data, model="fake-heuristic", usage={"input_tokens": len(user) // 4, "output_tokens": 0})


def fake_plan_match(user: str) -> dict[str, Any]:
    """Plan matching offline: the rule-based matcher over the same payload the model gets."""
    import json
    from types import SimpleNamespace

    from app.domain.plans import match_filename

    payload = json.loads(user)
    spaces = [SimpleNamespace(i=s["i"], name=s["name"]) for s in payload["spaces"]]
    matches = []
    for f in payload["files"]:
        hit = match_filename(f, spaces)  # type: ignore[arg-type] — only .name is read
        matches.append({"file": f, "space": hit.i if hit else None, "confidence": 0.9 if hit else 0.0})
    return {"matches": matches}
