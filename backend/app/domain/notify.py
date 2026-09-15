"""Single ``notify()`` in the domain layer → in-app row + email job (architecture §8)."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.events import Actor, emit
from app.models.core import Membership, Notification, User


async def notify(
    session: AsyncSession,
    actor: Actor,
    *,
    kind: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    user_ids: list[uuid.UUID] | None = None,
    recipient_email: str | None = None,
    subject_type: str | None = None,
    subject_id: uuid.UUID | None = None,
    send_email: bool = True,
) -> list[Notification]:
    """Create inbox rows (and enqueue emails) for the given users, or for an external email."""
    rows: list[Notification] = []
    targets: list[tuple[uuid.UUID | None, str | None]] = []
    if user_ids:
        users = (await session.execute(select(User).where(User.id.in_(user_ids)))).scalars()
        targets += [(u.id, u.email) for u in users]
    if recipient_email:
        targets.append((None, recipient_email))
    for uid, email in targets:
        n = Notification(
            account_id=actor.account_id, user_id=uid, recipient_email=email, kind=kind, title=title, body=body,
            link=link, subject_type=subject_type, subject_id=subject_id,
            email_status="queued" if (send_email and email) else "none",
        )
        session.add(n)
        rows.append(n)
    await session.flush()
    for n in rows:
        emit(session, actor, "notification", n.id, "notification.created", {"kind": kind, "user_id": n.user_id, "email": n.recipient_email})
        if n.email_status == "queued":
            from app.worker.tasks import enqueue_email

            await enqueue_email(session, n.id)
    return rows


async def notify_account_users(session: AsyncSession, actor: Actor, **kw) -> list[Notification]:
    ids = [m.user_id for m in (await session.execute(select(Membership).where(Membership.accepted_at.is_not(None)))).scalars()]
    return await notify(session, actor, user_ids=ids, **kw)


async def mark_read(session: AsyncSession, actor: Actor, notification_id: uuid.UUID) -> Notification | None:
    from datetime import UTC, datetime

    n = await session.get(Notification, notification_id)
    if n and n.user_id == actor.user_id and not n.read_at:
        n.read_at = datetime.now(UTC)
        emit(session, actor, "notification", n.id, "notification.read")
    return n


async def record_email_status(session: AsyncSession, actor: Actor, *, message_id: str, status: str, error: str | None = None) -> Notification | None:
    n = (await session.execute(select(Notification).where(Notification.email_message_id == message_id))).scalar_one_or_none()
    if n:
        n.email_status = status
        n.email_error = error
        emit(session, actor, "notification", n.id, f"notification.email_{status}", {"error": error})
    return n
