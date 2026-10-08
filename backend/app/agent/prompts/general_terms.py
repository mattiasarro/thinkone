"""Versioned prompt for reading a general-terms (üldtingimused) document into a clause tree."""

from __future__ import annotations

from typing import Any

PROMPT_VERSION = "general_terms_v1"
MARKER = "[[general_terms]]"  # lets the fake provider recognise this task

SYSTEM = f"""{MARKER} You read a landlord's lease template (Üürileping / üldtingimused) and return its GENERAL TERMS as a
clause tree. The template usually starts with the specific contract part (parties, the space, rent); the general terms
follow, typically after a heading such as "ÜLDTINGIMUSED" or "ÜÜRILEPINGU ÜLDTINGIMUSED". Only the general terms are
wanted: skip everything before them and skip signature blocks, annex lists and page furniture after them.

Input: a JSON object with `paragraphs` — the document's non-empty paragraphs in order. Each has `i` (index), `text`,
`level` (Word's automatic numbering level when the paragraph is auto-numbered: 0 = section, 1 = point, 2 = sub-point;
null when not auto-numbered) and `style` (the Word paragraph style name). The numbering level is a strong hint but is
not always present: numbers may be typed into the text ("5.5.1 ...") or the levels may be inconsistent. Use the
levels, typed numbers, headings and the meaning of the text together to recover the intended structure.

Output `sections`: one entry per section (MÕISTED, LEPINGU ESE, ÜÜR …), in document order, each with
- `heading`: the section title as written, with the typed number removed ("1. MÕISTED" → "MÕISTED"),
- `points`: the numbered points of the section, in order; each has `text` (the point's full text with its typed
  number removed, unnumbered continuation paragraphs appended with a space) and `subpoints` — the sub-points nested
  under it, same shape, each with its own `subpoints` (third level) which are leaves.
Rules: every marked item (numbered, lettered or dashed) becomes exactly one node; never merge two items, never split
one, never drop one, never invent one. Keep the Estonian text verbatim apart from collapsing whitespace and removing
the typed number. Do not include the numbers themselves — they are derived from the tree."""


def schema() -> dict[str, Any]:
    leaf = {
        "type": "object",
        "properties": {"text": {"type": "string"}},
        "required": ["text"],
        "additionalProperties": False,
    }
    subpoint = {
        "type": "object",
        "properties": {"text": {"type": "string"}, "subpoints": {"type": "array", "items": leaf}},
        "required": ["text", "subpoints"],
        "additionalProperties": False,
    }
    point = {
        "type": "object",
        "properties": {"text": {"type": "string"}, "subpoints": {"type": "array", "items": subpoint}},
        "required": ["text", "subpoints"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {"heading": {"type": "string"}, "points": {"type": "array", "items": point}},
                    "required": ["heading", "points"],
                    "additionalProperties": False,
                },
            },
        },
        "required": ["sections"],
        "additionalProperties": False,
    }
