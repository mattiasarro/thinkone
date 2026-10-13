"""Share links — accountless client access to exactly one quote or contract draft (architecture §8).

The token is the link's id signed with SECRET_KEY (nothing secret is stored); ``token_hash`` lets
us look the row up and revoke it. Validity follows the document: a quote link expires with the quote.
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, time, timedelta

from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import NotFound
from app.domain.events import Actor, emit
from app.infra.settings import get_settings
from app.models.quotes import ShareLink


def _serializer() -> URLSafeSerializer:
    return URLSafeSerializer(get_settings().secret_key, salt="share-link")


def token_for(link: ShareLink) -> str:
    return _serializer().dumps(str(link.id))


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def portal_path(token: str) -> str:
    return f"/portal/{token}"


def portal_url(token: str) -> str:
    return f"{get_settings().public_url.rstrip('/')}{portal_path(token)}"


def end_of_day(d) -> datetime:
    return datetime.combine(d, time(23, 59, 59), tzinfo=UTC)


async def current_link(session: AsyncSession, subject_type: str, subject_id: uuid.UUID) -> ShareLink | None:
    stmt = (select(ShareLink).where(ShareLink.subject_type == subject_type, ShareLink.subject_id == subject_id, ShareLink.revoked_at.is_(None))
            .order_by(ShareLink.created_at.desc()).limit(1))
    return (await session.execute(stmt)).scalar_one_or_none()


async def ensure_link(session: AsyncSession, actor: Actor, *, subject_type: str, subject_id: uuid.UUID, email: str, party_id: uuid.UUID | None,
                      expires_at: datetime) -> ShareLink:
    """Reuse the live link for this subject (extending its validity and e-mail), or create one."""
    link = await current_link(session, subject_type, subject_id)
    if link and link.email.lower() == email.lower():
        changed = {}
        if link.expires_at != expires_at:
            changed["expires_at"] = [link.expires_at, expires_at]
            link.expires_at = expires_at
        if changed:
            emit(session, actor, "share_link", link.id, "share_link.extended", {"subject_type": subject_type, "subject_id": subject_id, **changed})
        return link
    if link:  # the contact e-mail changed: the old grant stops working
        link.revoked_at = datetime.now(UTC)
        emit(session, actor, "share_link", link.id, "share_link.revoked", {"subject_type": subject_type, "subject_id": subject_id, "reason": "email_changed"})
    link = ShareLink(account_id=actor.account_id, subject_type=subject_type, subject_id=subject_id, token_hash="", email=email, party_id=party_id,
                     expires_at=expires_at)
    session.add(link)
    await session.flush()
    link.token_hash = _hash(token_for(link))
    emit(session, actor, "share_link", link.id, "share_link.created", {"subject_type": subject_type, "subject_id": subject_id, "email": email, "expires_at": expires_at})
    return link


async def revoke(session: AsyncSession, actor: Actor, link: ShareLink, reason: str | None = None) -> None:
    if not link.revoked_at:
        link.revoked_at = datetime.now(UTC)
        emit(session, actor, "share_link", link.id, "share_link.revoked", {"subject_type": link.subject_type, "subject_id": link.subject_id, "reason": reason})


def link_id_from_token(token: str) -> uuid.UUID | None:
    try:
        return uuid.UUID(_serializer().loads(token))
    except (BadSignature, ValueError):
        return None


def is_live(link: ShareLink, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return not link.revoked_at and link.expires_at >= now


async def get_live_link(session: AsyncSession, token: str) -> ShareLink:
    """Resolve a token inside a session that already carries the link's tenant (or the RLS bypass)."""
    lid = link_id_from_token(token)
    link = await session.get(ShareLink, lid) if lid else None
    if not link or link.token_hash != _hash(token) or not is_live(link):
        raise NotFound("Link ei kehti")
    return link


async def touch(session: AsyncSession, actor: Actor, link: ShareLink) -> None:
    """Record the first open (demo „Avas lingi”) and the last use."""
    now = datetime.now(UTC)
    if not link.opened_at:
        link.opened_at = now
        emit(session, actor, link.subject_type, link.subject_id, f"{link.subject_type}.link_opened", {"share_link_id": link.id, "email": link.email})
    link.last_used_at = now


def expiry_for_quote(valid_until) -> datetime:
    return end_of_day(valid_until)


def expiry_in_days(days: int) -> datetime:
    return end_of_day((datetime.now(UTC) + timedelta(days=days)).date())
