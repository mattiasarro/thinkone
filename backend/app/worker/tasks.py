"""Task definitions. Enqueue helpers run *inside* the caller's DB transaction (outbox = queue table)."""

from __future__ import annotations

import uuid
from typing import Any

import structlog
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.worker.app import worker_app

log = structlog.get_logger()
app = worker_app()

# ---- enqueue (transactional): insert into procrastinate_jobs via the caller's session ----------


async def _enqueue(session: AsyncSession, task_name: str, args: dict[str, Any], queue: str = "default", lock: str | None = None) -> None:
    import json

    await session.execute(
        text(
            "INSERT INTO procrastinate_jobs (queue_name, task_name, lock, queueing_lock, args, status, priority) "
            "VALUES (:q, :t, :lock, :qlock, CAST(:args AS jsonb), 'todo', 0)"
        ),
        {"q": queue, "t": task_name, "lock": lock, "qlock": None, "args": json.dumps(args)},
    )


async def enqueue_email(session: AsyncSession, notification_id: uuid.UUID) -> None:
    await _enqueue(session, "app.worker.tasks.send_notification_email", {"notification_id": str(notification_id)}, queue="email")


async def enqueue_password_reset_email(session: AsyncSession, reset_id: uuid.UUID) -> None:
    # only the grant id travels through the queue; the worker derives the signed token when sending
    await _enqueue(session, "app.worker.tasks.send_password_reset_email", {"reset_id": str(reset_id)}, queue="email")


async def enqueue_structuring(session: AsyncSession, import_job_id: uuid.UUID) -> None:
    await _enqueue(session, "app.worker.tasks.structure_import", {"import_job_id": str(import_job_id)}, queue="import", lock=f"import:{import_job_id}")


# ---- tasks -------------------------------------------------------------------------------------


@app.task(name="app.worker.tasks.send_notification_email", queue="email", retry=3)
async def send_notification_email(notification_id: str) -> None:
    from app.domain import notify as notify_domain  # noqa: F401
    from app.domain.events import Actor
    from app.infra.db import tenant_session
    from app.infra.settings import get_settings
    from app.integrations.email import email_provider
    from app.models.core import Notification

    nid = uuid.UUID(notification_id)
    # look up the tenant first (RLS needs the account id)
    from app.infra.db import sessionmaker

    async with sessionmaker()() as s0:
        async with s0.begin():
            await s0.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            row = (await s0.execute(text("SELECT account_id FROM notification WHERE id = :id"), {"id": nid})).first()
    if not row:
        return
    account_id = row[0]
    async with tenant_session(account_id) as session:
        n = await session.get(Notification, nid)
        if not n or n.email_status != "queued" or not n.recipient_email:
            return
        base = get_settings().public_url.rstrip("/")
        link = f"{base}{n.link}" if n.link else base
        try:
            sent = await email_provider().send(to=n.recipient_email, subject=n.title, text=f"{n.body or n.title}\n\n{link}")
            n.email_status, n.email_message_id = "sent", sent.message_id
            Actor.system(account_id)
        except Exception as e:  # noqa: BLE001
            n.email_status, n.email_error = "bounced", str(e)[:500]
            log.warning("email_failed", notification=str(nid), error=str(e))
        from app.domain.events import emit

        emit(session, Actor.system(account_id), "notification", n.id, f"notification.email_{n.email_status}", {"message_id": n.email_message_id})


@app.task(name="app.worker.tasks.send_password_reset_email", queue="email", retry=3)
async def send_password_reset_email(reset_id: str) -> None:
    from app.domain.auth import password_reset_email
    from app.infra.db import sessionmaker
    from app.integrations.email import email_provider

    # user-level, not tenant-level: no notification row, no RLS scope
    async with sessionmaker()() as session:
        async with session.begin():
            msg = await password_reset_email(session, uuid.UUID(reset_id))
    if msg:
        await email_provider().send(**msg)


@app.task(name="app.worker.tasks.structure_import", queue="import", retry=1)
async def structure_import(import_job_id: str) -> None:
    from app.ingest.pipeline import run_structuring

    await run_structuring(uuid.UUID(import_job_id))


@app.periodic(cron="15 5 * * *")
@app.task(name="app.worker.tasks.scan_key_dates", queue="default")
async def scan_key_dates(timestamp: int) -> None:
    from app.domain.keydates import scan_and_notify_all

    await scan_and_notify_all()
