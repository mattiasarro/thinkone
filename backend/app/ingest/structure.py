"""LLM structuring: text (with anchors) → validated Proposal. First consumer of the ChatModel seam."""

from __future__ import annotations

from datetime import date
from typing import Any

import structlog

from app.agent.prompts.import_structure import PROMPT_VERSION, SYSTEM
from app.agent.providers.base import StructuredResult, chat_model
from app.ingest.extract import Extraction
from app.ingest.schema import Proposal, proposal_json_schema

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
    result = await chat_model().structured(system=SYSTEM, user=user, schema=proposal_json_schema())
    prop = validate_and_anchor(result.data, ex)
    log.info("import_structured", model=result.model, prompt=PROMPT_VERSION, clauses=len(prop.clauses),
             params=len(prop.parameters), key_dates=len(prop.key_dates), uncertain=len(prop.uncertain()))
    return prop, result, PROMPT_VERSION


def today() -> date:
    return date.today()
