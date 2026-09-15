from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, clear_session_cookie, current_principal, db, db_no_tenant, read_session_id, set_session_cookie
from app.domain import auth as auth_domain
from app.domain.errors import Forbidden
from app.models.core import Account, Membership

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    account_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=200)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AccountOut(BaseModel):
    id: uuid.UUID
    name: str
    role: str


class MeOut(BaseModel):
    user_id: uuid.UUID
    email: str
    name: str
    locale: str
    account: AccountOut
    accounts: list[AccountOut]


class InviteIn(BaseModel):
    email: EmailStr
    role: str = "operator"


class AcceptInviteIn(BaseModel):
    token: str
    name: str = ""
    password: str = Field(min_length=8, max_length=200)


class MemberOut(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    email: str
    name: str
    role: str
    status: str
    notification_prefs: dict


class MemberUpdateIn(BaseModel):
    role: str | None = None
    notification_prefs: dict | None = None


@router.post("/register", response_model=MeOut, status_code=201)
async def register(body: RegisterIn, response: Response, session: AsyncSession = Depends(db_no_tenant)) -> MeOut:
    user, account, m = await auth_domain.register_account(session, account_name=body.account_name, email=body.email, name=body.name, password=body.password)
    s = await auth_domain.create_session(session, user, account.id)
    set_session_cookie(response, s.id)
    acc = AccountOut(id=account.id, name=account.name, role=m.role)
    return MeOut(user_id=user.id, email=user.email, name=user.name, locale=user.locale, account=acc, accounts=[acc])


@router.post("/login", response_model=MeOut)
async def login(body: LoginIn, response: Response, session: AsyncSession = Depends(db_no_tenant)) -> MeOut:
    user = await auth_domain.authenticate(session, body.email, body.password)
    ms = await auth_domain.memberships_of(session, user.id)
    if not ms:
        raise Forbidden("Kasutajal pole ühtegi kontot")
    accounts = await _accounts(session, ms)
    s = await auth_domain.create_session(session, user, ms[0].account_id)
    set_session_cookie(response, s.id)
    return MeOut(user_id=user.id, email=user.email, name=user.name, locale=user.locale, account=accounts[0], accounts=accounts)


@router.post("/logout", status_code=204)
async def logout(response: Response, request_sid: uuid.UUID | None = Depends(read_session_id), session: AsyncSession = Depends(db_no_tenant)) -> Response:
    if request_sid:
        await auth_domain.revoke_session(session, request_sid)
    clear_session_cookie(response)
    return Response(status_code=204)


@router.get("/me", response_model=MeOut)
async def me(p: Principal = Depends(current_principal), session: AsyncSession = Depends(db_no_tenant)) -> MeOut:
    ms = await auth_domain.memberships_of(session, p.user.id)
    accounts = await _accounts(session, ms)
    current = next(a for a in accounts if a.id == p.account_id)
    return MeOut(user_id=p.user.id, email=p.user.email, name=p.user.name, locale=p.user.locale, account=current, accounts=accounts)


@router.post("/switch/{account_id}", response_model=MeOut)
async def switch_account(account_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db_no_tenant)) -> MeOut:
    ms = await auth_domain.memberships_of(session, p.user.id)
    if account_id not in {m.account_id for m in ms}:
        raise Forbidden()
    await auth_domain.switch_session_account(session, p.auth_session, account_id)
    accounts = await _accounts(session, ms)
    return MeOut(user_id=p.user.id, email=p.user.email, name=p.user.name, locale=p.user.locale,
                 account=next(a for a in accounts if a.id == account_id), accounts=accounts)


@router.post("/invite", response_model=MemberOut, status_code=201)
async def invite(body: InviteIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> MemberOut:
    m = await auth_domain.invite_user(session, p.actor, email=body.email, role=body.role)
    await session.refresh(m, attribute_names=["user"])
    return _member_out(m)


@router.post("/invite/accept", response_model=MeOut)
async def accept_invite(body: AcceptInviteIn, response: Response, session: AsyncSession = Depends(db_no_tenant)) -> MeOut:
    user, m = await auth_domain.accept_invite(session, token=body.token, name=body.name, password=body.password)
    ms = await auth_domain.memberships_of(session, user.id)
    accounts = await _accounts(session, ms)
    s = await auth_domain.create_session(session, user, m.account_id)
    set_session_cookie(response, s.id)
    return MeOut(user_id=user.id, email=user.email, name=user.name, locale=user.locale,
                 account=next(a for a in accounts if a.id == m.account_id), accounts=accounts)


@router.get("/members", response_model=list[MemberOut])
async def members(session: AsyncSession = Depends(db)) -> list[MemberOut]:
    return [_member_out(m) for m in await auth_domain.list_members(session)]


@router.patch("/members/{membership_id}", response_model=MemberOut)
async def update_member(membership_id: uuid.UUID, body: MemberUpdateIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> MemberOut:
    m = await auth_domain.update_member(session, p.actor, membership_id, role=body.role, notification_prefs=body.notification_prefs)
    return _member_out(m)


def _member_out(m: Membership) -> MemberOut:
    return MemberOut(id=m.id, user_id=m.user_id, email=m.user.email, name=m.user.name, role=m.role,
                     status="active" if m.accepted_at else "invited", notification_prefs=m.notification_prefs or {})


async def _accounts(session: AsyncSession, ms: list[Membership]) -> list[AccountOut]:
    ids = [m.account_id for m in ms]
    accounts = {a.id: a for a in (await session.execute(select(Account).where(Account.id.in_(ids)))).scalars()}
    return [AccountOut(id=m.account_id, name=accounts[m.account_id].name, role=m.role) for m in ms if m.account_id in accounts]
