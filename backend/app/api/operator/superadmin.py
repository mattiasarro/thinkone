"""Superadmin: every account and user across tenants (read-only). Opening an account goes through POST /auth/switch."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, db_no_tenant, require_superadmin
from app.models.core import Account, AuthSession, Membership, User

router = APIRouter(prefix="/superadmin", tags=["superadmin"])


class SuperMemberOut(BaseModel):
    user_id: uuid.UUID
    email: str
    name: str
    role: str
    status: str  # active | invited


class SuperAccountOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime
    members: list[SuperMemberOut]


class SuperUserOut(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    is_active: bool
    created_at: datetime
    last_login_at: datetime | None
    accounts: int


class OverviewOut(BaseModel):
    accounts: list[SuperAccountOut]
    users: list[SuperUserOut]


@router.get("/overview", response_model=OverviewOut)
async def overview(_: Principal = Depends(require_superadmin), session: AsyncSession = Depends(db_no_tenant)) -> OverviewOut:
    accounts = list((await session.execute(select(Account).order_by(Account.created_at.desc()))).scalars())
    members = list((await session.execute(select(Membership).order_by(Membership.created_at))).scalars())
    users = list((await session.execute(select(User).order_by(User.created_at.desc()))).scalars())
    last_login = dict((await session.execute(select(AuthSession.user_id, func.max(AuthSession.created_at)).group_by(AuthSession.user_id))).all())
    by_account: dict[uuid.UUID, list[SuperMemberOut]] = {}
    count: dict[uuid.UUID, int] = {}
    for m in members:
        by_account.setdefault(m.account_id, []).append(SuperMemberOut(user_id=m.user_id, email=m.user.email, name=m.user.name, role=m.role,
                                                                      status="active" if m.accepted_at else "invited"))
        count[m.user_id] = count.get(m.user_id, 0) + 1
    return OverviewOut(
        accounts=[SuperAccountOut(id=a.id, name=a.name, created_at=a.created_at, members=by_account.get(a.id, [])) for a in accounts],
        users=[SuperUserOut(id=u.id, email=u.email, name=u.name, is_active=u.is_active, created_at=u.created_at,
                            last_login_at=last_login.get(u.id), accounts=count.get(u.id, 0)) for u in users],
    )
