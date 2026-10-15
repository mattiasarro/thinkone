"""Daily key-date scan → notifications (in-app + queued email) and the health report's date rules."""

import uuid
from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy import select, text


async def test_scan_fires_once_and_health_flags_dates(client: AsyncClient, admin: dict):
    from app.domain.contracts import create_contract
    from app.domain.events import Actor
    from app.domain.keydates import add_key_date, scan_and_notify
    from app.domain.portfolio import health_report
    from app.infra.db import tenant_session
    from app.models.core import Notification

    aid = uuid.UUID(admin["account"]["id"])
    actor = Actor(account_id=aid, user_id=uuid.UUID(admin["user_id"]), role="admin")
    today = date.today()
    async with tenant_session(aid) as s:
        soon = await create_contract(s, actor, type_code="generic", title="Lõpeb varsti", number="HOO-2026-001", status="active", origin="imported",
                                     category="maintenance", start_date=today - timedelta(days=300), end_date=today + timedelta(days=60))
        await create_contract(s, actor, type_code="generic", title="Juba läbi", number="HOO-2026-002", status="active", origin="imported",
                                     category="maintenance", end_date=today - timedelta(days=3))
        far = await create_contract(s, actor, type_code="lease", title="Kaugel", number="LEP-2026-003", status="active", origin="imported",
                                    category="lease", end_date=today + timedelta(days=400))
        await add_key_date(s, actor, contract_id=soon.id, kind_code="end", due_date=soon.end_date)  # default notify 90 days → in window
        await add_key_date(s, actor, contract_id=far.id, kind_code="end", due_date=far.end_date)  # not yet
        soon_id, far_id = soon.id, far.id
    async with tenant_session(aid) as s:
        fired = await scan_and_notify(s, Actor.system(aid), today=today)
        assert fired == 1
        fired_again = await scan_and_notify(s, Actor.system(aid), today=today)
        assert fired_again == 0  # fired_at prevents repeats
        rows = list((await s.execute(select(Notification).where(Notification.kind == "key_date.end"))).scalars())
        assert len(rows) == 1 and rows[0].user_id == actor.user_id and rows[0].email_status == "queued"
        assert str(soon_id) in (rows[0].link or "")
        queued = (await s.execute(text("select count(*) from procrastinate_jobs where task_name = 'app.worker.tasks.send_notification_email'"))).scalar_one()
        assert queued >= 1
        report = await health_report(s)
        codes = {f["code"]: f for f in report["findings"]}
        assert codes["ending_6m"]["count"] == 1 and codes["ending_6m"]["items"][0]["number"] == "HOO-2026-001"
        assert codes["past_end"]["count"] == 1 and codes["past_end"]["severity"] == "error"
        assert "lease_no_indexation" in codes and codes["lease_no_indexation"]["items"][0]["number"] == "LEP-2026-003"
        assert codes["no_key_dates"]["count"] == 1  # only 'late' has none
        assert report["totals"]["contracts"] == 3
    # the inbox endpoint shows it
    inbox = (await client.get("/api/v1/notifications")).json()
    assert any(n["kind"] == "key_date.end" for n in inbox)
    assert str(far_id)  # silence unused


async def test_recurring_series_extend_on_the_daily_scan(client: AsyncClient, admin: dict):
    """An open-ended indexation series is kept filled to the rolling horizon by the scan; the contract end bounds it;
    an operator's deletion is not re-added; ended contracts are left alone."""
    from app.domain.contracts import create_contract
    from app.domain.events import Actor
    from app.domain.keydates import (
        RECUR_HORIZON_MONTHS,
        add_key_date,
        add_months,
        delete_key_date,
        extend_recurrences,
        scan_and_notify,
    )
    from app.infra.db import tenant_session
    from app.models.contracts import KeyDate

    aid = uuid.UUID(admin["account"]["id"])
    actor = Actor(account_id=aid, user_id=uuid.UUID(admin["user_id"]), role="admin")
    today = date.today()
    first = today - timedelta(days=100)
    async with tenant_session(aid) as s:
        open_ended = await create_contract(s, actor, type_code="lease", title="Tähtajatu", number="LEP-2026-010", status="active", origin="imported", category="lease")
        bounded = await create_contract(s, actor, type_code="lease", title="Tähtajaline", number="LEP-2026-011", status="active", origin="imported",
                                        category="lease", end_date=add_months(first, 15))
        over = await create_contract(s, actor, type_code="lease", title="Lõppenud", number="LEP-2026-012", status="ended", origin="imported", category="lease")
        for c in (open_ended, bounded, over):
            await add_key_date(s, actor, contract_id=c.id, kind_code="indexation", due_date=first, title="Indekseerimine", provenance={"recurs_months": 12})
        await add_key_date(s, actor, contract_id=open_ended.id, kind_code="end", due_date=today + timedelta(days=900))  # not a series: untouched
        ids = (open_ended.id, bounded.id, over.id)

    async def dues(s, cid):
        return sorted(k.due_date for k in (await s.execute(select(KeyDate).where(KeyDate.subject_id == cid, KeyDate.kind_code == "indexation", KeyDate.deleted_at.is_(None)))).scalars())

    async with tenant_session(aid) as s:
        added = await extend_recurrences(s, Actor.system(aid), today=today)
        assert added == 3  # open-ended: +12m, +24m (≤ horizon); bounded: +12m only (15-month term); ended: none
        assert await dues(s, ids[0]) == [first, add_months(first, 12), add_months(first, 24)]
        assert add_months(first, 24) <= add_months(today, RECUR_HORIZON_MONTHS) < add_months(first, 36)
        assert await dues(s, ids[1]) == [first, add_months(first, 12)]
        assert await dues(s, ids[2]) == [first]
        assert await extend_recurrences(s, Actor.system(aid), today=today) == 0  # idempotent
        # the operator removes the last occurrence: the scan does not put it back
        last = next(k for k in (await s.execute(select(KeyDate).where(KeyDate.subject_id == ids[0], KeyDate.due_date == add_months(first, 24)))).scalars())
        await delete_key_date(s, actor, last.id)
        assert await extend_recurrences(s, Actor.system(aid), today=today) == 0
        # a year later the horizon has moved: the next occurrence appears (via the daily scan entry point)
        await scan_and_notify(s, Actor.system(aid), today=add_months(today, 12))
        assert await dues(s, ids[0]) == [first, add_months(first, 12), add_months(first, 36)]
