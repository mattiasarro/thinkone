"""AI conversations as domain data: threads, messages, validated citations, draft feedback, token metering + budgets."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.account import effective_settings, get_account
from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.models.agent import AgentCitation, AgentMessage, AgentThread, AiDraftFeedback, LlmUsage

DEFAULT_MONTHLY_BUDGET = 5_000_000  # tokens per account per month (input + output); graceful degradation beyond it


async def list_threads(session: AsyncSession, user_id: uuid.UUID | None = None, limit: int = 50) -> list[AgentThread]:
    stmt = select(AgentThread).where(AgentThread.deleted_at.is_(None)).order_by(AgentThread.last_message_at.desc().nulls_last(), AgentThread.created_at.desc()).limit(limit)
    if user_id:
        stmt = stmt.where(AgentThread.user_id == user_id)
    return list((await session.execute(stmt)).scalars())


async def get_thread(session: AsyncSession, thread_id: uuid.UUID) -> AgentThread:
    t = await session.get(AgentThread, thread_id)
    if not t or t.deleted_at:
        raise NotFound("Vestlust ei leitud")
    return t


async def create_thread(session: AsyncSession, actor: Actor, *, context_type: str | None = None, context_id: uuid.UUID | None = None,
                        context_label: str | None = None, origin_path: str | None = None, title: str = "") -> AgentThread:
    if context_type and context_type not in ("contract", "quote", "party", "asset", "portfolio"):
        raise DomainError("Tundmatu kontekst")
    t = AgentThread(account_id=actor.account_id, user_id=actor.user_id, title=title[:200], context_type=context_type, context_id=context_id,
                    context_label=context_label, origin_path=origin_path)
    session.add(t)
    await session.flush()
    emit(session, actor, "agent_thread", t.id, "agent_thread.created", {"context_type": context_type, "context_id": context_id})
    return t


async def delete_thread(session: AsyncSession, actor: Actor, thread_id: uuid.UUID) -> None:
    t = await get_thread(session, thread_id)
    t.deleted_at = datetime.now(UTC)
    emit(session, actor, "agent_thread", t.id, "agent_thread.deleted")


async def restore_thread(session: AsyncSession, actor: Actor, thread_id: uuid.UUID) -> AgentThread:
    t = await session.get(AgentThread, thread_id)
    if not t:
        raise NotFound("Vestlust ei leitud")
    t.deleted_at = None
    emit(session, actor, "agent_thread", t.id, "agent_thread.restored")
    return t


async def messages_of(session: AsyncSession, thread_id: uuid.UUID) -> list[AgentMessage]:
    return list((await session.execute(select(AgentMessage).where(AgentMessage.thread_id == thread_id).order_by(AgentMessage.created_at, AgentMessage.id))).scalars())


async def add_message(session: AsyncSession, actor: Actor, thread: AgentThread, *, role: str, text: str, steps: list[dict[str, Any]] | None = None,
                      cards: list[dict[str, Any]] | None = None, citations: list[dict[str, Any]] | None = None, prompt_version: str | None = None,
                      model: str | None = None, usage: dict[str, Any] | None = None, status: str = "done", error: str | None = None) -> AgentMessage:
    m = AgentMessage(account_id=actor.account_id, thread_id=thread.id, role=role, text=text, steps=steps or [], cards=cards or [], citations=citations or [],
                     prompt_version=prompt_version, model=model, usage=usage or {}, status=status, error=error, created_at=datetime.now(UTC))
    session.add(m)
    await session.flush()
    thread.last_message_at = datetime.now(UTC)
    if not thread.title and role == "user":
        thread.title = text.strip()[:80]
    for ct in citations or []:
        session.add(AgentCitation(account_id=actor.account_id, message_id=m.id, contract_id=uuid.UUID(str(ct["contract_id"])), clause_id=uuid.UUID(str(ct["clause_id"])), number=ct["number"]))
    if role == "assistant":
        emit(session, Actor(account_id=actor.account_id, actor_type="agent", user_id=None, on_behalf_of=actor.user_id, correlation_id=actor.correlation_id),
             "agent_thread", thread.id, "agent.answered", {"message_id": m.id, "tools": [s.get("tool") for s in (steps or [])], "cards": [c.get("type") for c in (cards or [])],
                                                         "citations": len(citations or []), "prompt_version": prompt_version, "model": model, "usage": usage, "status": status})
    return m


async def record_feedback(session: AsyncSession, actor: Actor, *, message_id: uuid.UUID | None, card_id: str | None, kind: str, fate: str,
                          draft_text: str | None, final_text: str | None) -> AiDraftFeedback:
    if fate not in ("used", "edited", "discarded"):
        raise DomainError("Tagasiside peab olema used, edited või discarded")
    f = AiDraftFeedback(account_id=actor.account_id, message_id=message_id, card_id=card_id, kind=kind, fate=fate, draft_text=draft_text, final_text=final_text, user_id=actor.user_id)
    session.add(f)
    await session.flush()
    emit(session, actor, "agent_thread", message_id, "ai_draft.feedback", {"kind": kind, "fate": fate, "card_id": card_id})
    return f


async def meter(session: AsyncSession, actor: Actor, *, purpose: str, model: str | None, usage: dict[str, Any]) -> None:
    """One row per account/user/purpose/day, counters summed (cheap daily roll-up)."""
    today = date.today()
    stmt = select(LlmUsage).where(LlmUsage.day == today, LlmUsage.purpose == purpose, LlmUsage.user_id == actor.user_id, LlmUsage.model == model)
    row = (await session.execute(stmt)).scalar_one_or_none()
    if not row:
        row = LlmUsage(account_id=actor.account_id, day=today, user_id=actor.user_id, purpose=purpose, model=model, runs=0,
                       input_tokens=0, output_tokens=0, cache_read_tokens=0, cache_write_tokens=0)
        session.add(row)
    row.input_tokens += int(usage.get("input_tokens") or 0)
    row.output_tokens += int(usage.get("output_tokens") or 0)
    row.cache_read_tokens += int(usage.get("cache_read_input_tokens") or 0)
    row.cache_write_tokens += int(usage.get("cache_creation_input_tokens") or 0)
    row.runs += 1
    await session.flush()


async def month_usage(session: AsyncSession, account_id: uuid.UUID) -> dict[str, Any]:
    first = date.today().replace(day=1)
    stmt = select(func.coalesce(func.sum(LlmUsage.input_tokens), 0), func.coalesce(func.sum(LlmUsage.output_tokens), 0), func.coalesce(func.sum(LlmUsage.runs), 0)).where(LlmUsage.day >= first)
    inp, out, runs = (await session.execute(stmt)).one()
    settings = effective_settings(await get_account(session, account_id))
    budget = int(((settings.get("ai") or {}).get("monthly_token_budget")) or DEFAULT_MONTHLY_BUDGET)
    total = int(inp) + int(out)
    return {"month": first.isoformat(), "input_tokens": int(inp), "output_tokens": int(out), "runs": int(runs), "total_tokens": total, "budget": budget,
            "remaining": max(0, budget - total), "exhausted": total >= budget}
