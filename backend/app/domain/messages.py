"""CommunicationThread: messages on a quote or contract. The Suhtlus page renders them as one timeline per subject."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.events import Actor, emit
from app.models.quotes import Message

CHANNELS = {"negotiation", "chat"}
AUTHOR_TYPES = {"operator", "client", "system"}


async def post(session: AsyncSession, actor: Actor, *, subject_type: str, subject_id: uuid.UUID, channel: str, body: str,
               author_type: str, author_name: str | None = None, meta: dict[str, Any] | None = None) -> Message:
    assert channel in CHANNELS and author_type in AUTHOR_TYPES
    body = (body or "").strip()
    m = Message(account_id=actor.account_id, subject_type=subject_type, subject_id=subject_id, channel=channel, author_type=author_type,
                author_user_id=actor.user_id, author_name=author_name, body=body, meta=meta or {},
                read_by_operator_at=datetime.now(UTC) if author_type != "client" else None)
    session.add(m)
    await session.flush()
    emit(session, actor, "message", m.id, "message.posted",
         {"subject_type": subject_type, "subject_id": subject_id, "channel": channel, "author_type": author_type, "author_name": author_name,
          "excerpt": body[:200], **({"version": meta.get("version")} if meta and meta.get("version") else {})})
    return m


async def list_for(session: AsyncSession, subject_type: str, subject_id: uuid.UUID, channel: str | None = None) -> list[Message]:
    stmt = select(Message).where(Message.subject_type == subject_type, Message.subject_id == subject_id).order_by(Message.created_at, Message.id)
    if channel:
        stmt = stmt.where(Message.channel == channel)
    return list((await session.execute(stmt)).scalars())


async def last_for(session: AsyncSession, subject_type: str, subject_ids: list[uuid.UUID]) -> dict[uuid.UUID, Message]:
    if not subject_ids:
        return {}
    stmt = select(Message).where(Message.subject_type == subject_type, Message.subject_id.in_(subject_ids)).order_by(Message.created_at.desc(), Message.id.desc())
    out: dict[uuid.UUID, Message] = {}
    for m in (await session.execute(stmt)).scalars():
        out.setdefault(m.subject_id, m)
    return out


async def unread_counts(session: AsyncSession, subject_type: str, subject_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not subject_ids:
        return {}
    stmt = (select(Message.subject_id, func.count()).where(Message.subject_type == subject_type, Message.subject_id.in_(subject_ids),
                                                            Message.author_type == "client", Message.read_by_operator_at.is_(None))
            .group_by(Message.subject_id))
    return {sid: int(n) for sid, n in (await session.execute(stmt)).all()}


async def mark_read(session: AsyncSession, actor: Actor, subject_type: str, subject_id: uuid.UUID) -> int:
    rows = list((await session.execute(select(Message).where(Message.subject_type == subject_type, Message.subject_id == subject_id,
                                                              Message.author_type == "client", Message.read_by_operator_at.is_(None)))).scalars())
    now = datetime.now(UTC)
    for m in rows:
        m.read_by_operator_at = now
    return len(rows)


async def all_subjects(session: AsyncSession, subject_type: str | None = None) -> list[tuple[str, uuid.UUID, Message, int]]:
    """(subject_type, subject_id, last message, unread client messages) — newest first. The Suhtlus list."""
    stmt = select(Message).order_by(Message.created_at.desc(), Message.id.desc())
    if subject_type:
        stmt = stmt.where(Message.subject_type == subject_type)
    last: dict[tuple[str, uuid.UUID], Message] = {}
    unread: dict[tuple[str, uuid.UUID], int] = {}
    for m in (await session.execute(stmt)).scalars():
        key = (m.subject_type, m.subject_id)
        last.setdefault(key, m)
        if m.author_type == "client" and not m.read_by_operator_at:
            unread[key] = unread.get(key, 0) + 1
    return [(st, sid, m, unread.get((st, sid), 0)) for (st, sid), m in last.items()]
