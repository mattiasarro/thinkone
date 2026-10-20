"""Key dates: creation from imports/contracts, calendar queries, daily scan → notifications."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.models.contracts import Contract, KeyDate, KeyDateKind


def add_months(d: date, months: int) -> date:
    """Calendar-month step that keeps the day where the target month allows it (31.01 + 1 → 28.02)."""
    import calendar

    y, m = divmod(d.month - 1 + months, 12)
    y, m = d.year + y, m + 1
    return d.replace(year=y, month=m, day=min(d.day, calendar.monthrange(y, m)[1]))


RECUR_HORIZON_MONTHS = 24  # how far ahead an open-ended series is kept filled (the daily scan extends it)
RECUR_CAP = 40


def recurrences(first: date, *, until: date | None, every_months: int = 12, today: date | None = None, cap: int = RECUR_CAP) -> list[date]:
    """Every occurrence of a recurring key date (indexation): ``first``, then every ``every_months`` up to ``until`` (the
    contract end). With no end known, up to the rolling horizon — ``extend_recurrences`` (daily scan) adds the rest as time
    passes. Capped so a bad term cannot flood the calendar."""
    limit = until if until is not None else add_months(today or date.today(), RECUR_HORIZON_MONTHS)
    out = [first]
    while len(out) < cap:
        nxt = add_months(out[-1], every_months)
        if nxt > limit:
            break
        out.append(nxt)
    return out


TERMINAL_STATUSES = {"ended", "cancelled", "early_terminated", "archived"}

_FIRST = re.compile(r"^(esimene|esmane|first)\s+", re.IGNORECASE)


def series_title(title: str) -> str:
    """A later occurrence of a series: „Esimene üüri tõus 3%” read from the contract is the first one only — the rest are
    „Üüri tõus 3%”."""
    rest = _FIRST.sub("", title or "").strip()
    return rest[:1].upper() + rest[1:] if rest else title


async def extend_recurrences(session: AsyncSession, actor: Actor, today: date | None = None) -> int:
    """Heartbeat for recurring series (indexation): on every live contract, keep occurrences generated up to the rolling
    horizon (or the contract end). A series is any (contract, kind) whose rows carry ``recurs_months`` in provenance; the
    latest row — deleted ones included, so an operator's deletion is not re-added — says where it has reached. Returns the
    number of key dates added."""
    today = today or date.today()
    horizon = add_months(today, RECUR_HORIZON_MONTHS)
    stmt = (select(KeyDate, Contract).join(Contract, Contract.id == KeyDate.subject_id)
            .where(KeyDate.provenance.has_key("recurs_months"), Contract.deleted_at.is_(None), Contract.status.not_in(TERMINAL_STATUSES))
            .order_by(KeyDate.due_date))
    series: dict[tuple[uuid.UUID, str], tuple[KeyDate, Contract]] = {}
    for kd, c in (await session.execute(stmt)).all():
        series[(kd.subject_id, kd.kind_code)] = (kd, c)  # ordered by due date → the last one wins
    added = 0
    for (contract_id, kind), (latest, c) in series.items():
        prov = latest.provenance or {}
        every = int(prov.get("recurs_months") or 12)
        if every < 1:
            continue
        limit = min(horizon, c.end_date) if c.end_date else horizon
        due, n = latest.due_date, 0
        while n < RECUR_CAP:
            due = add_months(due, every)
            if due > limit:
                break
            await add_key_date(session, actor, contract_id=contract_id, kind_code=kind, due_date=due, title=series_title(latest.title),
                               provenance={"recurs_months": every, "extended": True, **({"generated": True} if prov.get("generated") else {})})
            added += 1
            n += 1
    return added


# ---------------------------------------------------------------- what a date means once it has passed ---------------

BEHAVIOURS = ("milestone", "window", "task", "opens")
RESOLUTIONS = ("done", "skipped")


async def behaviours(session: AsyncSession, account_id: uuid.UUID) -> dict[str, str]:
    """kind code → milestone | window | task | opens (an account's own kind overrides the global one)."""
    out: dict[str, str] = {}
    for k in sorted(await kinds(session, account_id), key=lambda k: k.account_id is not None):
        out[k.code] = k.behaviour or "window"
    return out


def status_of(kd: KeyDate, behaviour: str, contract: Contract | None, today: date | None = None) -> str:
    """The one status every view shows (server-side, so the contract page, calendar, space and home agree):
    done / skipped — a task's outcome; upcoming — not yet due; past — a milestone that happened; lapsed — a deadline or
    option that went by (nothing left to do); open_since — a right that opened on the date and stays open (first
    possible termination: "võimalik alates") until the contract ends; overdue — a task nobody marked; unconfirmed — an indexation that fell before
    the contract was imported (we don't know whether it was applied — the catch-up asks once). A task from before the import
    other than indexation is just history (past)."""
    today = today or date.today()
    if kd.resolution:
        return kd.resolution
    if kd.due_date >= today:
        return "upcoming"
    if behaviour == "milestone":
        return "past"
    if behaviour == "opens":
        ended = contract is not None and (contract.status in TERMINAL_STATUSES or (contract.end_date is not None and contract.end_date < today))
        return "lapsed" if ended else "open_since"
    if behaviour != "task":
        return "lapsed"
    imported_on = contract.created_at.date() if contract is not None and contract.origin == "imported" and contract.created_at else None
    if imported_on and kd.due_date < imported_on:
        return "unconfirmed" if kd.kind_code == "indexation" else "past"
    return "overdue"


OPEN_STATUSES = {"overdue", "unconfirmed"}


async def resolve_key_date(session: AsyncSession, actor: Actor, key_date_id: uuid.UUID, resolution: str, *,
                           data: dict | None = None) -> KeyDate:
    """Mark a task done or skipped (an indexation that changes the rent goes through ``indexation.apply`` instead)."""
    if resolution not in RESOLUTIONS:
        raise DomainError("Tundmatu tulemus")
    kd = await session.get(KeyDate, key_date_id)
    if not kd or kd.deleted_at:
        raise NotFound()
    if (await behaviours(session, actor.account_id)).get(kd.kind_code) != "task":
        raise DomainError("Tehtuks saab märkida ainult tegevust nõudva tähtaja (nt indekseerimine, makse)")
    if kd.resolution:
        raise DomainError("See tähtaeg on juba lahendatud — ava see enne uuesti")
    kd.resolution, kd.resolved_at, kd.resolved_by, kd.resolution_data = resolution, datetime.now(UTC), actor.user_id, data
    emit(session, actor, "key_date", kd.id, f"key_date.{resolution}", {"contract_id": kd.subject_id, "kind": kd.kind_code, "due_date": kd.due_date,
                                                                        **({"data": data} if data else {})})
    return kd


async def reopen_key_date(session: AsyncSession, actor: Actor, key_date_id: uuid.UUID) -> KeyDate:
    """Undo a resolution. An indexation that wrote rent versions takes them back — only while they are still the current
    ones (a later change has to be undone first)."""
    from app.domain.indexation import revert_facts

    kd = await session.get(KeyDate, key_date_id)
    if not kd or kd.deleted_at:
        raise NotFound()
    if not kd.resolution:
        return kd
    fact_ids = [uuid.UUID(x) for x in (kd.resolution_data or {}).get("fact_ids") or []]
    if fact_ids:
        await revert_facts(session, actor, kd.subject_id, fact_ids)
    emit(session, actor, "key_date", kd.id, "key_date.reopened", {"contract_id": kd.subject_id, "was": kd.resolution, "data": kd.resolution_data})
    kd.resolution = kd.resolved_at = kd.resolved_by = kd.resolution_data = None
    return kd


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
    await extend_recurrences(session, actor, today)
    stmt = select(KeyDate, Contract).outerjoin(Contract, Contract.id == KeyDate.subject_id).where(
        KeyDate.deleted_at.is_(None), KeyDate.fired_at.is_(None), KeyDate.resolution.is_(None), KeyDate.due_date >= today - timedelta(days=1))
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
