"""Document kind in an import batch (demo v622: „import lepingu kaupa” — contract + its annexes + supporting documents).

The model states ``contract.document_kind``; this module is the rule-based fallback for proposals made before it did
(and for the fake provider), and the place where an annex's number and space token are read from title and file name."""

from __future__ import annotations

import re
from typing import Any

_ANNEX_RE = re.compile(r"(?:\b|_)(?:lisa|muudatus|lisakokkulepe|kokkulepe)(?:\b|_)|_LISA[_ ]?(?:NR)?\s*\d", re.I)
_ANNEX_NR_RE = re.compile(r"lisa[_ ]*(?:nr\.?[_ ]*)?(\d{1,2})\b", re.I)
_DOC_RE = re.compile(r"\b(?:akt|garantiikiri|volikiri|plaan|asendiplaan|pinnaplaan|kinnituskiri|teatis)\b", re.I)
_SPACE_RE = re.compile(r"(?<![A-Za-zÕÄÖÜõäöü])(?:Pind|P|Büroo|B)\s?0*(\d{1,3})(?!\d)", re.I)


def classify(head: dict[str, Any] | None, filename: str = "") -> tuple[str, str | None]:
    """→ (kind, annex_number). The model's own answer wins when present."""
    head = head or {}
    title = str(head.get("title") or "")
    kind = head.get("document_kind")
    nr = head.get("annex_number")
    text = f"{title} {filename}"
    if not kind:
        if _ANNEX_RE.search(title) or re.search(r"_LISA[_ ]?(?:NR)?[_ ]?\d", filename, re.I):
            kind = "annex"
        elif _DOC_RE.search(title):
            kind = "document"
        else:
            kind = "contract"
    if kind == "annex" and not nr:
        m = _ANNEX_NR_RE.search(text)
        nr = m.group(1) if m else None
    return kind, (str(nr) if nr else None)


def space_tokens(*texts: str | None) -> set[str]:
    """„P_24”, „Pind 24”, „P26_P27”, „B3”, „Büroo 1” → {"24"}, {"26", "27"}, {"B3"}, {"B1"} — the spaces a file name or hint names."""
    out: set[str] = set()
    for t in texts:
        flat = re.sub(r"[_\-.]+", " ", t or "")
        for m in _SPACE_RE.finditer(flat):
            word = flat[m.start():m.end()].lstrip()
            out.add(("B" if word[:1].upper() == "B" else "") + str(int(m.group(1))))
    return out


_FORMS = re.compile(r"\b(oü|as|mtü|sa|fie|tü|uü|osaühing|aktsiaselts|ltd|llc|gmbh|sia|uab|oy|ab)\b", re.I)


def norm_name(name: str | None) -> str:
    """Company names compare without legal form, punctuation and case: „AS MARU EHITUS” == „Maru Ehitus AS”."""
    s = _FORMS.sub(" ", (name or "").lower())
    s = re.sub(r"[^\wõäöüšž]+", " ", s)
    return " ".join(s.split())
