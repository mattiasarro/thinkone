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
        late = await create_contract(s, actor, type_code="generic", title="Juba läbi", number="HOO-2026-002", status="active", origin="imported",
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
