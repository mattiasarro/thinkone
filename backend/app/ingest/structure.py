"""LLM structuring: text (with anchors) → validated Proposal. First consumer of the ChatModel seam.

Two calls run in parallel over the same text: the facts (head, parties, parameters, key dates) on the main model at low
effort, and the clause transcription on a cheaper model. Output tokens set both the time and the cost of an import, and
the clause text is most of them, so the split roughly halves the wall time and cuts the price without a per-page merge.
"""

from __future__ import annotations

import asyncio
import re
from datetime import date, datetime, timedelta
from typing import Any

import structlog

from app.agent.prompts.import_structure import CLAUSES_SYSTEM, FACTS_SYSTEM, PROMPT_VERSION
from app.agent.providers.base import StructuredResult, chat_model
from app.ingest.extract import Extraction
from app.ingest.schema import DateCheck, Proposal, clauses_json_schema, facts_json_schema

log = structlog.get_logger()
MAX_INPUT_CHARS = 600_000  # ~150k tokens; contracts are far smaller — refuse rather than truncate


def build_user_message(ex: Extraction) -> str:
    if len(ex.text) > MAX_INPUT_CHARS:
        raise ValueError("Dokument on struktureerimiseks liiga pikk")
    return "".join(f"<<<PAGE {p.page}>>> [offset={p.char_start}]\n{p.text}" for p in ex.pages)


_MARKED_RE = re.compile(r"^\s*(?:\d{1,2}(?:\.\d{1,2}){0,3}\.?|[a-zõäöü]\)|[-–•])\s+\S", re.M)


def count_marked_items(text: str) -> int:
    """Lines that start like a clause (1., 1.1, a), dash): the yardstick for a complete transcription."""
    return len(_MARKED_RE.findall(text))


def build_clauses_user_message(ex: Extraction, n_items: int) -> str:
    # a cheaper model at modest effort tends to stop part-way through a long transcription; the count keeps it honest
    return build_user_message(ex) + f"\n\nThe text above contains about {n_items} marked items (numbered, lettered or dashed lines). Transcribe every one of them, to the end of the document."


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
    from app.infra.settings import get_settings

    s = get_settings()
    user = build_user_message(ex)
    n_items = count_marked_items(ex.text)
    model = chat_model()

    async def clause_call(effort: str, clause_model: str) -> StructuredResult:
        # 128K output: thinking + a long clause list (a 10-page lease is ~20-30K JSON tokens) must both fit
        return await model.structured(system=CLAUSES_SYSTEM, user=build_clauses_user_message(ex, n_items), schema=clauses_json_schema(),
                                      max_tokens=128000, effort=effort, model=clause_model)

    facts, clauses = await asyncio.gather(
        # the facts are a few KB of JSON; low effort keeps the thinking short
        model.structured(system=FACTS_SYSTEM, user=user, schema=facts_json_schema(), max_tokens=32000, effort=s.llm_facts_effort),
        clause_call(s.llm_clause_effort, s.llm_clause_model),
    )
    got = len(clauses.data.get("clauses") or [])
    if n_items >= 10 and got < n_items // 2:
        # the transcription stopped short (Sonnet 5.5 below high effort does this): once more, harder — at high effort,
        # and on the main model when the clause model already ran at high
        again = (s.llm_clause_model, "high") if s.llm_clause_effort != "high" else (s.llm_model, "high")
        log.warning("import_clauses_incomplete", model=clauses.model, effort=s.llm_clause_effort, got=got, expected=n_items, retry=again)
        retry = await clause_call(again[1], again[0])
        if len(retry.data.get("clauses") or []) > got:
            retry.usage = {k: clauses.usage.get(k, 0) + retry.usage.get(k, 0) for k in set(clauses.usage) | set(retry.usage)}
            clauses = retry
    result = merge_results(facts, clauses)
    prop = validate_and_anchor(result.data, ex)
    log.info("import_structured", model=result.model, prompt=PROMPT_VERSION, clauses=len(prop.clauses),
             params=len(prop.parameters), key_dates=len(prop.key_dates), uncertain=len(prop.uncertain()), usage=result.usage)
    return prop, result, PROMPT_VERSION


def merge_results(facts: StructuredResult, clauses: StructuredResult) -> StructuredResult:
    """One result for the job record: the facts JSON plus the clause list, usage summed, both model names kept."""
    data = {**facts.data, "clauses": clauses.data.get("clauses", [])}
    usage = {k: facts.usage.get(k, 0) + clauses.usage.get(k, 0) for k in sorted(set(facts.usage) | set(clauses.usage))}
    usage.update({f"facts_{k}": v for k, v in facts.usage.items()})  # per-call detail, flat so the job's usage stays str → int
    usage.update({f"clauses_{k}": v for k, v in clauses.usage.items()})
    model = facts.model if facts.model == clauses.model else f"{facts.model}+{clauses.model}"
    return StructuredResult(data=data, model=model, usage=usage, raw_text=None)


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

    Start/end key dates fold into the head first (``Proposal.fold_dates``): the head is the one place for them, and the
    commit makes the calendar's start/end entries from it. A date filled here is derived — flagged for a look. Returns the
    names of the fields it filled."""
    prop.fold_dates()
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
    for f in filled:
        if f in ("start_date", "end_date") and f not in prop.date_checks:
            prop.date_checks[f] = DateCheck(confidence=0.75, note="Tuletatud (allkirja aeg / tähtaeg) — kontrolli")
    return filled
