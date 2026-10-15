"""LLM structuring: text (with anchors) → validated Proposal. First consumer of the ChatModel seam."""

from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from typing import Any

import structlog

from app.agent.prompts.import_structure import PROMPT_VERSION, SYSTEM
from app.agent.providers.base import StructuredResult, chat_model
from app.ingest.extract import Extraction
from app.ingest.schema import KeyDateProposal, Proposal, proposal_json_schema

log = structlog.get_logger()
MAX_INPUT_CHARS = 600_000  # ~150k tokens; contracts are far smaller — refuse rather than truncate


def build_user_message(ex: Extraction) -> str:
    if len(ex.text) > MAX_INPUT_CHARS:
        raise ValueError("Dokument on struktureerimiseks liiga pikk")
    return "".join(f"<<<PAGE {p.page}>>> [offset={p.char_start}]\n{p.text}" for p in ex.pages)


def validate_and_anchor(data: dict[str, Any], ex: Extraction) -> Proposal:
    """Schema validation + anchor sanity: offsets inside the text, page consistent with offset."""
    prop = Proposal.model_validate(data)
    n = len(ex.text)
    for coll in (prop.parameters, prop.key_dates, prop.clauses, prop.parties):
        for item in coll:
            if item.char_start is not None and (item.char_start < 0 or item.char_start > n):
                item.char_start, item.char_end = None, None
            if item.char_end is not None and item.char_start is not None and item.char_end < item.char_start:
                item.char_end = item.char_start
            if item.char_start is not None:
                item.page = ex.locate(item.char_start)
            elif item.page is not None and (item.page < 1 or item.page > max(ex.page_count, 1)):
                item.page = None
    # dates: drop impossible ones
    for kd in list(prop.key_dates):
        if kd.date.year < 1990 or kd.date.year > 2100:
            prop.key_dates.remove(kd)
    if prop.contract.end_date and prop.contract.start_date and prop.contract.end_date < prop.contract.start_date:
        prop.contract.end_date = None
    return prop


async def structure(ex: Extraction) -> tuple[Proposal, StructuredResult, str]:
    user = build_user_message(ex)
    # 128K output: thinking + a long clause list (a 10-page lease is ~40-60K JSON tokens) must both fit
    result = await chat_model().structured(system=SYSTEM, user=user, schema=proposal_json_schema(), max_tokens=128000)
    prop = validate_and_anchor(result.data, ex)
    log.info("import_structured", model=result.model, prompt=PROMPT_VERSION, clauses=len(prop.clauses),
             params=len(prop.parameters), key_dates=len(prop.key_dates), uncertain=len(prop.uncertain()))
    return prop, result, PROMPT_VERSION


def today() -> date:
    return date.today()


# ---------------------------------------------------------------- derived dates ---------------------------------

_TERM_RE = re.compile(r"(\d{1,3})\s*(aasta|a\b|kuu|k\b|päev|p\b)", re.I)
_DATE_RE = re.compile(r"\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b|\b(\d{4})-(\d{2})-(\d{2})\b")


def _parse_date(v: str | None) -> date | None:
    m = _DATE_RE.search(v or "")
    if not m:
        return None
    try:
        return date(int(m.group(3)), int(m.group(2)), int(m.group(1))) if m.group(1) else date(int(m.group(4)), int(m.group(5)), int(m.group(6)))
    except ValueError:
        return None


def _term_end(start: date, value: str | None, unit: str | None, text: str | None) -> date | None:
    """„7 aastat” / value "7" + unit "aastat" / „84 kuud” / „tähtajaliselt 7 aastaks” → the day the term runs out."""
    from app.domain.keydates import add_months

    m = _TERM_RE.search(f"{value or ''} {unit or ''}") or _TERM_RE.search(text or "")
    if not m:
        return None
    n, u = int(m.group(1)), m.group(2).lower()
    if n <= 0:
        return None
    if u.startswith("a"):
        return add_months(start, 12 * n) if n <= 99 else None
    if u.startswith("k"):
        return add_months(start, n)
    return start + timedelta(days=n)


def derive_dates(prop: Proposal, signing_times: list[str] | None = None) -> list[str]:
    """Fill the contract dates the text does not state outright but the import can still pin down (demo: „allkirjastatud
    digitaalselt” + „tähtajaliselt 7 aastaks alates allkirjastamisest”):

    * signed_at ← the container's latest signature time (the contract is concluded when the last party signs);
    * start_date ← the proposed start key date, a handover_date parameter, else signed_at (a lease „jõustub allkirjastamisel”);
    * end_date ← the proposed end key date, else start + the ``term`` parameter.

    Start/end key dates are added for the calendar when they are missing. Returns the names of the fields it filled."""
    c, filled = prop.contract, []
    if c.signed_at is None:
        times = sorted(t for t in (signing_times or []) if t)
        if times:
            try:
                c.signed_at = datetime.fromisoformat(times[-1].replace("Z", "+00:00")).date()
                filled.append("signed_at")
            except ValueError:
                pass
    kd_by_kind = {k.kind: k for k in prop.key_dates}
    params = {p.key: p for p in prop.parameters}
    if c.start_date is None:
        hand = params.get("handover_date")
        c.start_date = kd_by_kind["start"].date if "start" in kd_by_kind else (_parse_date(hand.value) or _parse_date(hand.text)) if hand else None
        if c.start_date is None and c.signed_at is not None:
            c.start_date = c.signed_at
        if c.start_date is not None:
            filled.append("start_date")
    if c.end_date is None:
        if "end" in kd_by_kind:
            c.end_date = kd_by_kind["end"].date
        elif "term" in params:
            term = params["term"]
            # „alates allkirjastamisest” counts from the signature, otherwise from the start
            base = c.signed_at if (c.signed_at and "allkirjastamis" in (term.text or "").lower()) else (c.start_date or c.signed_at)
            if base:
                c.end_date = _term_end(base, term.value, term.unit, term.text)
        if c.end_date is not None:
            filled.append("end_date")
    if c.end_date and c.start_date and c.end_date < c.start_date:
        c.end_date = None
        filled = [f for f in filled if f != "end_date"]
    for kind, due, title in (("start", c.start_date, "Lepingu algus"), ("end", c.end_date, "Lepingu lõpp")):
        if due and kind not in kd_by_kind:
            prop.key_dates.append(KeyDateProposal(kind=kind, date=due, title=title, confidence=0.75, note="Tuletatud (allkirja aeg / tähtaeg) — kontrolli"))
    return filled
