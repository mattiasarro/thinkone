"""Deterministic stand-in: a rule-based structurer so the full import flow runs offline."""

from __future__ import annotations

from typing import Any

from app.agent.providers.base import ImageInput, StructuredResult


class FakeChatModel:
    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []

    async def structured(self, *, system: str, user: str, schema: dict[str, Any], max_tokens: int = 32000,
                         images: list[ImageInput] | None = None) -> StructuredResult:
        from app.agent.prompts import general_terms, parking_plan, plan_match
        from app.ingest.heuristic import heuristic_structure

        self.calls.append({"system": system, "user": user, "images": len(images or [])})
        if system.startswith(plan_match.MARKER):
            data = fake_plan_match(user)
        elif system.startswith(parking_plan.MARKER):
            data = fake_parking_plan(user)
        elif system.startswith(general_terms.MARKER):
            data = fake_general_terms(user)
        else:
            data = heuristic_structure(user)
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


def fake_parking_plan(user: str) -> dict[str, Any]:
    """Parking-plan reading offline: lay the register's numbers out as one row of 2.5 × 5 m boxes along the top of the image."""
    import json

    payload = json.loads(user)
    numbers = payload.get("register") or []
    w, h = payload["image"]["width"], payload["image"]["height"]
    bw = max(10.0, min(60.0, w / max(len(numbers), 1) * 0.8)) if numbers else 40.0
    bh = bw * 2
    spots = [{"label": n, "cx": round(bw * 0.6 + i * bw * 1.2, 1), "cy": round(min(h, bh) * 0.6, 1), "w": bw, "h": bh, "rot": 0, "type": "standard"}
             for i, n in enumerate(numbers)]
    return {"spots": spots, "notes": "fake"}


def fake_general_terms(user: str) -> dict[str, Any]:
    """General terms offline: the rule-based tree from Word numbering levels, in the model's output shape."""
    import json

    from app.ingest.docx_terms import tree_from_levels

    def items(nodes, depth):
        return [{"text": n.text, **({"subpoints": items(n.children, depth + 1)} if depth < 2 else {})} for n in nodes]

    sections = tree_from_levels(json.loads(user)["paragraphs"])
    return {"sections": [{"heading": s.heading or "", "points": items(s.children, 0)} for s in sections]}
