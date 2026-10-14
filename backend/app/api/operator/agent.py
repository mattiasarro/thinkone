"""Operator chat (Phase 3.3): threads, SSE streaming turns, confirmation cards executed under the operator's session, feedback, usage."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import agent as agent_domain
from app.domain.errors import DomainError, NotFound
from app.infra.db import tenant_session

router = APIRouter(prefix="/agent", tags=["agent"])


class ThreadOut(BaseModel):
    id: uuid.UUID
    title: str
    context_type: str | None
    context_id: uuid.UUID | None
    context_label: str | None
    origin_path: str | None
    last_message_at: datetime | None
    created_at: datetime


class MessageOut(BaseModel):
    id: uuid.UUID
    role: str
    text: str
    steps: list[dict[str, Any]]
    cards: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    status: str
    model: str | None
    created_at: datetime


class ThreadDetailOut(ThreadOut):
    messages: list[MessageOut]


class ThreadIn(BaseModel):
    context_type: str | None = None
    context_id: uuid.UUID | None = None
    context_label: str | None = None
    origin_path: str | None = None
    title: str = ""


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=8000)


class FeedbackIn(BaseModel):
    message_id: uuid.UUID | None = None
    card_id: str | None = None
    kind: str
    fate: str
    draft_text: str | None = None
    final_text: str | None = None


class ConfirmOut(BaseModel):
    action: str
    link: str
    title: str


def _thread(t) -> ThreadOut:
    return ThreadOut.model_validate(t, from_attributes=True)


@router.get("/threads", response_model=list[ThreadOut])
async def list_threads(p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[ThreadOut]:
    return [_thread(t) for t in await agent_domain.list_threads(session, user_id=p.user.id)]


@router.post("/threads", response_model=ThreadDetailOut, status_code=201)
async def create_thread(body: ThreadIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ThreadDetailOut:
    label = body.context_label
    if body.context_type and body.context_id and not label:
        label = await _label(session, body.context_type, body.context_id)
    t = await agent_domain.create_thread(session, p.actor, context_type=body.context_type, context_id=body.context_id, context_label=label, origin_path=body.origin_path, title=body.title)
    return ThreadDetailOut(**_thread(t).model_dump(), messages=[])


async def _label(session: AsyncSession, context_type: str, context_id: uuid.UUID) -> str | None:
    from app.models.contracts import Contract
    from app.models.core import Party
    from app.models.quotes import Quote
    from app.models.registry import Asset

    model = {"contract": Contract, "quote": Quote, "party": Party, "asset": Asset}.get(context_type)
    row = await session.get(model, context_id) if model else None
    if not row:
        return None
    return getattr(row, "number", None) or getattr(row, "name", None) or getattr(row, "title", None)


@router.get("/threads/{thread_id}", response_model=ThreadDetailOut)
async def get_thread(thread_id: uuid.UUID, session: AsyncSession = Depends(db)) -> ThreadDetailOut:
    t = await agent_domain.get_thread(session, thread_id)
    return ThreadDetailOut(**_thread(t).model_dump(), messages=[MessageOut.model_validate(m, from_attributes=True) for m in await agent_domain.messages_of(session, t.id)])


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_thread(thread_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> None:
    await agent_domain.delete_thread(session, p.actor, thread_id)


@router.post("/threads/{thread_id}/restore", response_model=ThreadOut)
async def restore_thread(thread_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ThreadOut:
    return _thread(await agent_domain.restore_thread(session, p.actor, thread_id))


@router.post("/threads/{thread_id}/messages")
async def post_message(thread_id: uuid.UUID, body: MessageIn, stream: bool = Query(default=True), p: Principal = Depends(current_principal)):
    """Run a turn. ``stream=true`` → text/event-stream (step · delta · card · done); ``stream=false`` → the final message JSON."""
    from app.agent.loop import run_turn, stream_turn

    if not stream:
        async with tenant_session(p.account_id) as session:
            t = await agent_domain.get_thread(session, thread_id)
            m = await run_turn(session, p.actor, t, body.text)
            return MessageOut.model_validate(m, from_attributes=True)

    async def gen():
        async with tenant_session(p.account_id) as session:
            t = await agent_domain.get_thread(session, thread_id)
            async for frame in stream_turn(session, p.actor, t, body.text):
                yield frame

    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/threads/{thread_id}/messages/{message_id}/cards/{card_id}/confirm", response_model=ConfirmOut)
async def confirm_card(thread_id: uuid.UUID, message_id: uuid.UUID, card_id: str, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ConfirmOut:
    """The consequential step happens HERE, under the operator's session — the agent only proposed it."""
    from app.models.agent import AgentMessage

    m = await session.get(AgentMessage, message_id)
    if not m or m.thread_id != thread_id:
        raise NotFound("Sõnumit ei leitud")
    card = next((c for c in m.cards if c.get("id") == card_id), None)
    if not card or card.get("type") != "confirm":
        raise NotFound("Kinnituskaarti ei leitud")
    if card.get("confirmed_at"):
        return ConfirmOut(action=card["action"], link=card.get("result_link", ""), title=card.get("title", ""))
    args = card.get("args") or {}
    actor = p.actor
    if card["action"] == "create_quote":
        from app.domain import quotes as quotes_domain

        q = await quotes_domain.create_quote(session, actor, party_id=uuid.UUID(args["party_id"]), property_id=uuid.UUID(args["property_id"]),
                                             space_ids=[uuid.UUID(x) for x in args["space_ids"]], period_months=args.get("period_months"))
        link, title = f"/app/portfell/pakkumine/{q.id}", q.number
    elif card["action"] == "create_lease":
        from datetime import date

        from app.domain import leases

        c = await leases.create_draft(session, actor, party_id=uuid.UUID(args["party_id"]), property_id=uuid.UUID(args["property_id"]), spaces=list(args["spaces"]),
                                      company_id=None, months=int(args.get("months") or 60), handover=date.fromisoformat(args["handover"]) if args.get("handover") else None)
        link, title = f"/app/portfell/leping/{c.id}", c.number
    elif card["action"] == "create_party":
        from app.domain.parties import create_party

        party = await create_party(session, actor, kind=args["kind"], name=args["name"], roles=args.get("roles"), registry_code=args.get("registry_code"),
                                   address=args.get("address"), vat_number=args.get("vat_number"))
        link, title = f"/app/portfell/osapool/{party.id}", party.name
    else:
        raise DomainError("Tundmatu toiming")
    cards = [dict(c) for c in m.cards]
    for c in cards:
        if c.get("id") == card_id:
            c["confirmed_at"] = datetime.now().isoformat()
            c["result_link"] = link
    m.cards = cards
    await agent_domain.record_feedback(session, actor, message_id=m.id, card_id=card_id, kind=card["action"], fate="used", draft_text=card.get("text"), final_text=None)
    return ConfirmOut(action=card["action"], link=link, title=title)


@router.post("/feedback", status_code=201)
async def feedback(body: FeedbackIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> dict[str, Any]:
    f = await agent_domain.record_feedback(session, p.actor, message_id=body.message_id, card_id=body.card_id, kind=body.kind, fate=body.fate,
                                           draft_text=body.draft_text, final_text=body.final_text)
    return {"id": f.id}


@router.get("/usage")
async def usage(p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> dict[str, Any]:
    return await agent_domain.month_usage(session, p.account_id)
