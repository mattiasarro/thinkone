"""Request dependencies: session cookie → user + account → tenant-scoped DB session + Actor."""

from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request, Response
from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.events import Actor
from app.infra.db import sessionmaker, set_tenant
from app.infra.settings import get_settings
from app.models.core import AuthSession, Membership, User

COOKIE = "thinkone_session"


def _serializer() -> URLSafeSerializer:
    return URLSafeSerializer(get_settings().secret_key, salt="session")


def set_session_cookie(response: Response, session_id: uuid.UUID) -> None:
    s = get_settings()
    response.set_cookie(COOKIE, _serializer().dumps(str(session_id)), httponly=True, samesite="lax",
                        secure=s.app_env == "prod", max_age=14 * 24 * 3600, path="/")


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(COOKIE, path="/")


def read_session_id(request: Request) -> uuid.UUID | None:
    raw = request.cookies.get(COOKIE)
    if not raw:
        return None
    try:
        return uuid.UUID(_serializer().loads(raw))
    except (BadSignature, ValueError):
        return None


@dataclass
class Principal:
    user: User
    account_id: uuid.UUID
    membership: Membership
    auth_session: AuthSession

    @property
    def actor(self) -> Actor:
        return Actor(account_id=self.account_id, user_id=self.user.id, role=self.membership.role)


async def db_no_tenant() -> AsyncIterator[AsyncSession]:
    """Unscoped session with the RLS bypass — ONLY for auth bootstrap (login, invite)."""
    async with sessionmaker()() as session:
        async with session.begin():
            await session.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            yield session


async def current_principal(request: Request, session: AsyncSession = Depends(db_no_tenant)) -> Principal:
    sid = read_session_id(request)
    if not sid:
        raise HTTPException(401, "Sisselogimine puudub")
    auth = await session.get(AuthSession, sid)
    from datetime import UTC, datetime

    if not auth or auth.revoked_at or auth.expires_at < datetime.now(UTC) or not auth.account_id:
        raise HTTPException(401, "Sessioon ei kehti")
    user = await session.get(User, auth.user_id)
    if not user or not user.is_active:
        raise HTTPException(401, "Kasutaja ei ole aktiivne")
    m = (await session.execute(select(Membership).where(Membership.user_id == user.id, Membership.account_id == auth.account_id,
                                                        Membership.accepted_at.is_not(None)))).scalar_one_or_none()
    if not m:
        raise HTTPException(403, "Kontole puudub ligipääs")
    return Principal(user=user, account_id=auth.account_id, membership=m, auth_session=auth)


async def db(principal: Principal = Depends(current_principal)) -> AsyncIterator[AsyncSession]:
    """Tenant-scoped transaction for the request. Commits on success."""
    async with sessionmaker()() as session:
        async with session.begin():
            await set_tenant(session, principal.account_id)
            yield session


def actor(principal: Principal = Depends(current_principal)) -> Actor:
    return principal.actor


def require_admin(principal: Principal = Depends(current_principal)) -> Principal:
    if principal.membership.role != "admin":
        raise HTTPException(403, "Ainult admin")
    return principal
