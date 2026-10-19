"""Superadmin: every account and user across tenants, and deleting an account. Opening one goes through POST /auth/switch."""

from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, db_no_tenant, require_superadmin
from app.domain import superadmin as superadmin_domain
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


class DeleteAccountIn(BaseModel):
    confirm_name: str  # must repeat the account's name


class DeletedAccountOut(BaseModel):
    name: str
    rows: int
    users: int
    files: int


@router.post("/accounts/{account_id}/delete", response_model=DeletedAccountOut)
async def delete_account(account_id: uuid.UUID, body: DeleteAccountIn, p: Principal = Depends(require_superadmin),
                         session: AsyncSession = Depends(db_no_tenant)) -> DeletedAccountOut:
    account = await session.get(Account, account_id)
    if account is None:
        raise HTTPException(404, "Kontot ei leitud")
    if account_id == p.account_id:
        raise HTTPException(409, "Avatud kontot ei saa kustutada — ava enne mõni teine konto")
    if body.confirm_name.strip() != account.name.strip():
        raise HTTPException(422, "Kinnituseks sisesta konto nimi täpselt")
    d = await superadmin_domain.delete_account(account_id, by_user_id=p.user.id)
    return DeletedAccountOut(name=d.name, rows=d.rows, users=d.users, files=d.files)
