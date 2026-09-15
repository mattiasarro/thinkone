from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db, db_no_tenant
from app.domain import notify as notify_domain
from app.domain.events import Actor
from app.infra.settings import get_settings
from app.models.core import Notification

router = APIRouter(tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    title: str
    body: str | None
    link: str | None
    created_at: datetime
    read_at: datetime | None
    email_status: str


@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(p: Principal = Depends(current_principal), session: AsyncSession = Depends(db), limit: int = 50) -> list[NotificationOut]:
    rows = (await session.execute(select(Notification).where(Notification.user_id == p.user.id).order_by(Notification.created_at.desc()).limit(limit))).scalars()
    return [NotificationOut.model_validate(r, from_attributes=True) for r in rows]


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
async def mark_read(notification_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NotificationOut:
    n = await notify_domain.mark_read(session, p.actor, notification_id)
    if not n:
        raise HTTPException(404)
    return NotificationOut.model_validate(n, from_attributes=True)


@router.post("/webhooks/postmark", status_code=204, include_in_schema=False)
async def postmark_webhook(request: Request, session: AsyncSession = Depends(db_no_tenant), x_webhook_secret: str | None = Header(default=None)):
    """Delivery / bounce / spam-complaint webhooks → notification.email_status."""
    s = get_settings()
    if s.postmark_webhook_secret and x_webhook_secret != s.postmark_webhook_secret:
        raise HTTPException(401)
    body = await request.json()
    mid = body.get("MessageID")
    rt = (body.get("RecordType") or "").lower()
    status = {"delivery": "delivered", "bounce": "bounced", "spamcomplaint": "complaint"}.get(rt)
    if not mid or not status:
        return
    n = (await session.execute(select(Notification).where(Notification.email_message_id == mid))).scalar_one_or_none()
    if n:
        await notify_domain.record_email_status(session, Actor.system(n.account_id), message_id=mid, status=status, error=body.get("Description"))
