"""Key dates: creation from imports/contracts, calendar queries, daily scan → notifications."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import NotFound
from app.domain.events import Actor, emit
from app.models.contracts import Contract, KeyDate, KeyDateKind


async def kinds(session: AsyncSession, account_id: uuid.UUID) -> list[KeyDateKind]:
    rows = (await session.execute(select(KeyDateKind).where((KeyDateKind.account_id.is_(None)) | (KeyDateKind.account_id == account_id)))).scalars()
    return list(rows)


async def kind_by_code(session: AsyncSession, account_id: uuid.UUID, code: str) -> KeyDateKind:
    for k in await kinds(session, account_id):
        if k.code == code:
            return k
    raise NotFound(f"Tundmatu tähtaja liik: {code}")


async def add_key_date(session: AsyncSession, actor: Actor, *, contract_id: uuid.UUID, kind_code: str, due_date: date,
                       title: str | None = None, notify_days_before: int | None = None, provenance: dict | None = None) -> KeyDate:
    kind = await kind_by_code(session, actor.account_id, kind_code)
    from app.models.core import Account

    account = await session.get(Account, actor.account_id)
    default_days = ((account.settings or {}).get("notify_days") or {}).get(kind_code, kind.default_notify_days)
    kd = KeyDate(account_id=actor.account_id, subject_type="contract", subject_id=contract_id, kind_id=kind.id, kind_code=kind.code,
                 title=title or kind.name_et, due_date=due_date, notify_days_before=notify_days_before if notify_days_before is not None else default_days,
                 provenance=provenance)
    session.add(kd)
    await session.flush()
    emit(session, actor, "key_date", kd.id, "key_date.created", {"contract_id": contract_id, "kind": kind_code, "due_date": due_date})
    return kd


async def update_key_date(session: AsyncSession, actor: Actor, key_date_id: uuid.UUID, *, due_date: date | None = None,
                          notify_days_before: int | None = None, title: str | None = None) -> KeyDate:
    kd = await session.get(KeyDate, key_date_id)
    if not kd or kd.deleted_at:
        raise NotFound()
    changes = {}
    if due_date is not None and due_date != kd.due_date:
        changes["due_date"] = [kd.due_date, due_date]
        kd.due_date, kd.fired_at = due_date, None
    if notify_days_before is not None:
        changes["notify_days_before"] = [kd.notify_days_before, notify_days_before]
        kd.notify_days_before = notify_days_before
    if title is not None:
        kd.title = title
    emit(session, actor, "key_date", kd.id, "key_date.updated", changes)
    return kd


async def delete_key_date(session: AsyncSession, actor: Actor, key_date_id: uuid.UUID) -> None:
    kd = await session.get(KeyDate, key_date_id)
    if not kd or kd.deleted_at:
        raise NotFound()
    kd.deleted_at = datetime.now(UTC)
    emit(session, actor, "key_date", kd.id, "key_date.deleted")


async def calendar(session: AsyncSession, *, start: date | None = None, end: date | None = None, kind_code: str | None = None,
                   contract_id: uuid.UUID | None = None) -> list[tuple[KeyDate, Contract | None]]:
    stmt = select(KeyDate, Contract).outerjoin(Contract, Contract.id == KeyDate.subject_id).where(KeyDate.deleted_at.is_(None))
    if start:
        stmt = stmt.where(KeyDate.due_date >= start)
    if end:
        stmt = stmt.where(KeyDate.due_date <= end)
    if kind_code:
        stmt = stmt.where(KeyDate.kind_code == kind_code)
    if contract_id:
        stmt = stmt.where(KeyDate.subject_id == contract_id)
    stmt = stmt.order_by(KeyDate.due_date)
    return [(kd, c) for kd, c in (await session.execute(stmt)).all()]


async def scan_and_notify(session: AsyncSession, actor: Actor, today: date | None = None) -> int:
    """Fire notifications for key dates entering their notify window. Returns count fired."""
    from app.domain.notify import notify_account_users

    today = today or date.today()
    stmt = select(KeyDate, Contract).outerjoin(Contract, Contract.id == KeyDate.subject_id).where(
        KeyDate.deleted_at.is_(None), KeyDate.fired_at.is_(None), KeyDate.due_date >= today - timedelta(days=1))
    fired = 0
    for kd, c in (await session.execute(stmt)).all():
        if kd.due_date - timedelta(days=kd.notify_days_before) <= today:
            days = (kd.due_date - today).days
            title = f"{kd.title}: {c.title if c else ''} — {days} päeva" if days >= 0 else f"{kd.title}: {c.title if c else ''} — täna"
            await notify_account_users(session, actor, kind=f"key_date.{kd.kind_code}", title=title,
                                       body=f"Tähtaeg {kd.due_date.isoformat()} · {c.number if c else ''}",
                                       link=f"/app/kalender?contract={kd.subject_id}", subject_type="key_date", subject_id=kd.id)
            kd.fired_at = datetime.now(UTC)
            emit(session, actor, "key_date", kd.id, "key_date.notified", {"due_date": kd.due_date, "days": days})
            fired += 1
    return fired


async def scan_and_notify_all() -> None:
    from sqlalchemy import text

    from app.infra.db import sessionmaker, tenant_session
    from app.models.core import Account

    async with sessionmaker()() as s0:
        async with s0.begin():
            await s0.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            ids = [a.id for a in (await s0.execute(select(Account))).scalars()]
    for aid in ids:
        async with tenant_session(aid) as session:
            await scan_and_notify(session, Actor.system(aid))
