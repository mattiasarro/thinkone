"""Versioned prompt for matching uploaded plan files to spaces. One call per upload batch."""

from __future__ import annotations

from typing import Any

PROMPT_VERSION = "plan_match_v1"
MARKER = "[[plan_match]]"  # lets the fake provider recognise this task

SYSTEM = f"""{MARKER} You match uploaded floor-plan files to the rental spaces (üüripinnad) of one building, by
filename only. The operator reviews your proposal, so it is a best-effort guess: match when the filename clearly
refers to a space, leave the rest unmatched rather than forcing a fit.

Input: a JSON object with `spaces` (each with an index `i`, its `name`, and optional `type` and `floor`) and
`files` (filenames, extensions included; ZIP contents are already listed as separate files).

How names relate:
- Space names are short codes: "Pind 8", "P8", "A-101", "LB-01", "Büroo 1", "B1", "T-01". Filenames carry the
  same code with prefixes/suffixes and different separators: "T6B_Pind_08.pdf" → Pind 8; "a101_plaan.png" → A-101;
  "LB01.svg" → LB-01; "Buroo-1.pdf" / "B1.pdf" → Büroo 1 or B1. Ignore case, leading zeros, dashes, underscores,
  spaces and Estonian/ASCII spelling differences (büroo/buroo, ü/u, õ/o, ä/a, ö/o).
- A number alone matches a space whose code is just that number (e.g. "08.pdf" → Pind 8) only when no other space
  shares the number; a letter+number code ("A101") must match the letters too.
- Files whose names describe the whole building, a floor or a site ("koondplaan", "korrus 1", "asendiplaan",
  "fassaad", "üldplaan") are unmatched (space = null), as are files you cannot place with confidence ≥ 0.6.
- The same space may appear in several files (PDF and PNG of one plan); match each file independently.

Output: `matches`, one entry per input file (same `file` string), with `space` = the index `i` of the chosen space
or null, and `confidence` in [0, 1]."""


def schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {
            "matches": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "file": {"type": "string"},
                        "space": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
                        "confidence": {"type": "number"},
                    },
                    "required": ["file", "space", "confidence"],
                    "additionalProperties": False,
                },
            }
        },
        "required": ["matches"],
        "additionalProperties": False,
    }
