"""Versioned prompt for reading a parking plan image into spot boxes (the VLM draft behind the schematic editor)."""

from __future__ import annotations

from typing import Any

PROMPT_VERSION = "parking_plan_v1"
MARKER = "[[parking_plan]]"  # lets the fake provider recognise this task

SYSTEM = f"""{MARKER} You read an architectural parking plan (parkimisplaan / parkimisskeem) of one building and return
every parking spot you can see as a box. The operator corrects the result in an editor afterwards, so a best-effort,
schematic reading is wanted: boxes roughly where the spots are, not a survey.

Input: one image, then a JSON object with `image` (its pixel `width` and `height`) and `register` — the numbers the
building's parking register already lists (strings such as "1", "12", "P-07"). Spot labels painted on the plan usually
match these numbers; prefer a register number whenever the painted label can reasonably be read as one.

Output `spots`, one entry per spot, in PIXEL coordinates of the given image:
- `cx`, `cy`: centre of the spot; `w`, `h`: its width (the short side a car enters through, usually ≈ 2.3–2.7 m) and
  depth (the long side, usually ≈ 5 m); `rot`: rotation in degrees clockwise of the depth axis from vertical, 0 for a
  spot whose long side runs up–down, 90 when it runs left–right. Keep `w` ≤ `h`.
- `label`: the painted number as written, or the matching register number; null when nothing is readable.
- `type`: "standard", "ev" (charging symbol / "EV" / lightning), "disabled" (wheelchair symbol / "INVA"), else null.
Rows of spots share size and rotation; keep them consistent. Do not invent spots in empty areas, and do not split
one spot into several. Put short remarks (legend seen, scale text such as "1:200", unreadable areas) in `notes`."""


def schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "spots": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "label": {"anyOf": [{"type": "string"}, {"type": "null"}]},
                        "cx": {"type": "number"},
                        "cy": {"type": "number"},
                        "w": {"type": "number"},
                        "h": {"type": "number"},
                        "rot": {"type": "number"},
                        "type": {"anyOf": [{"type": "string", "enum": ["standard", "ev", "disabled"]}, {"type": "null"}]},
                    },
                    "required": ["label", "cx", "cy", "w", "h", "rot", "type"],
                    "additionalProperties": False,
                },
            },
            "notes": {"type": "string"},
        },
        "required": ["spots", "notes"],
        "additionalProperties": False,
    }
