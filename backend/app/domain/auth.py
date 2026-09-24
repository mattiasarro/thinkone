"""Operators/admins: email + password (argon2), server-side sessions, invites, memberships, password resets."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime, timedelta

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from itsdangerous import BadSignature, URLSafeSerializer
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, Forbidden, NotFound
from app.domain.events import Actor, emit
from app.infra.settings import get_settings
from app.models.core import Account, AuthSession, Membership, PasswordReset, User

_ph = PasswordHasher()
SESSION_TTL = timedelta(days=14)
RESET_TTL = timedelta(hours=1)
RESET_THROTTLE = timedelta(minutes=1)  # one reset email per user per minute


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(hash_: str | None, pw: str) -> bool:
    if not hash_:
        return False
    try:
        return _ph.verify(hash_, pw)
    except VerifyMismatchError:
        return False


async def register_account(session: AsyncSession, *, account_name: str, email: str, name: str, password: str) -> tuple[User, Account, Membership]:
    """First-run: create account + admin user + membership. Runs without a tenant scope."""
    email = email.strip().lower()
    if len(password) < 8:
        raise DomainError("Parool peab olema vähemalt 8 märki", code="weak_password")
    if (await session.execute(select(User).where(User.email == email))).scalar_one_or_none():
        raise DomainError("Selle e-postiga kasutaja on juba olemas", code="email_taken", status_code=409)
    account = Account(name=account_name.strip())
    user = User(email=email, name=name.strip(), password_hash=hash_password(password))
    session.add_all([account, user])
    await session.flush()
    from app.infra.db import set_tenant

    await set_tenant(session, account.id)
    m = Membership(account_id=account.id, user_id=user.id, role="admin", accepted_at=datetime.now(UTC))
    session.add(m)
    await session.flush()
    actor = Actor(account_id=account.id, user_id=user.id, role="admin")
    emit(session, actor, "account", account.id, "account.created", {"name": account.name})
    emit(session, actor, "membership", m.id, "membership.created", {"user_id": user.id, "role": "admin"})
    from app.domain.seed import seed_account_defaults

    await seed_account_defaults(session, actor)
    return user, account, m


async def authenticate(session: AsyncSession, email: str, password: str) -> User:
    user = (await session.execute(select(User).where(User.email == email.strip().lower()))).scalar_one_or_none()
    if not user or not user.is_active or not verify_password(user.password_hash, password):
        raise DomainError("Vale e-post või parool", code="invalid_credentials", status_code=401)
    return user


async def memberships_of(session: AsyncSession, user_id: uuid.UUID) -> list[Membership]:
    # membership is RLS-protected; the auth flow runs with a bypass policy for lookups by user_id
    rows = (await session.execute(select(Membership).where(Membership.user_id == user_id, Membership.accepted_at.is_not(None)))).scalars()
    return list(rows)


async def create_session(session: AsyncSession, user: User, account_id: uuid.UUID | None) -> AuthSession:
    s = AuthSession(user_id=user.id, account_id=account_id, expires_at=datetime.now(UTC) + SESSION_TTL)
    session.add(s)
    await session.flush()
    return s


async def load_session(session: AsyncSession, session_id: uuid.UUID) -> AuthSession | None:
    s = await session.get(AuthSession, session_id)
    if not s or s.revoked_at or s.expires_at < datetime.now(UTC):
        return None
    return s


async def switch_session_account(session: AsyncSession, auth: AuthSession, account_id: uuid.UUID) -> None:
    auth.account_id = account_id
    session.add(auth)


async def revoke_session(session: AsyncSession, session_id: uuid.UUID) -> None:
    s = await session.get(AuthSession, session_id)
    if s:
        s.revoked_at = datetime.now(UTC)


def _reset_serializer() -> URLSafeSerializer:
    return URLSafeSerializer(get_settings().secret_key, salt="password-reset")


def password_reset_token(reset_id: uuid.UUID) -> str:
    return _reset_serializer().dumps(str(reset_id))


async def request_password_reset(session: AsyncSession, email: str) -> PasswordReset | None:
    """Create a reset grant and queue its email. Unknown, inactive and not-yet-onboarded (invited)
    users are a silent no-op, as is a repeat request within RESET_THROTTLE — the caller must answer
    identically either way so the endpoint cannot be used to enumerate accounts."""
    user = (await session.execute(select(User).where(User.email == email.strip().lower()))).scalar_one_or_none()
    if not user or not user.is_active or not user.password_hash:
        return None
    now = datetime.now(UTC)
    recent = await session.execute(select(PasswordReset.id).where(
        PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None), PasswordReset.created_at > now - RESET_THROTTLE))
    if recent.first():
        return None
    r = PasswordReset(user_id=user.id, expires_at=now + RESET_TTL)
    session.add(r)
    await session.flush()
    from app.worker.tasks import enqueue_password_reset_email

    await enqueue_password_reset_email(session, r.id)
    return r


async def _live_reset(session: AsyncSession, reset_id: uuid.UUID) -> tuple[PasswordReset, User] | None:
    r = await session.get(PasswordReset, reset_id, with_for_update=True)
    if not r or r.used_at or r.expires_at < datetime.now(UTC):
        return None
    user = await session.get(User, r.user_id)
    if not user or not user.is_active:
        return None
    return r, user


async def password_reset_email(session: AsyncSession, reset_id: uuid.UUID) -> dict | None:
    """The message for a queued reset, or None if the grant is no longer usable (don't send)."""
    live = await _live_reset(session, reset_id)
    if not live:
        return None
    _, user = live
    link = f"{get_settings().public_url.rstrip('/')}/reset-password/{password_reset_token(reset_id)}"
    minutes = int(RESET_TTL.total_seconds() // 60)
    text = (
        f"Tere, {user.name}!\n\n"
        "Keegi (loodetavasti sina) palus ThinkOne'i parooli lähtestada. Uue parooli seadmiseks ava allolev link — "
        f"see kehtib {minutes} minutit ja töötab ühe korra.\n\n{link}\n\n"
        "Kui sa parooli lähtestamist ei palunud, jäta see kiri tähelepanuta — sinu parool jääb samaks."
    )
    return {"to": user.email, "subject": "ThinkOne parooli lähtestamine", "text": text}


async def reset_password(session: AsyncSession, *, token: str, password: str) -> User:
    """Set a new password from a reset link; burns every open link and signs out every session of the user."""
    try:
        reset_id = uuid.UUID(_reset_serializer().loads(token))
    except (BadSignature, ValueError):
        reset_id = None
    live = await _live_reset(session, reset_id) if reset_id else None
    if not live:
        raise DomainError("Parooli lähtestamise link on aegunud või vigane", code="reset_invalid", status_code=404)
    if len(password) < 8:
        raise DomainError("Parool peab olema vähemalt 8 märki", code="weak_password")
    _, user = live
    now = datetime.now(UTC)
    user.password_hash = hash_password(password)
    await session.execute(update(PasswordReset).where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None)).values(used_at=now))
    await session.execute(update(AuthSession).where(AuthSession.user_id == user.id, AuthSession.revoked_at.is_(None)).values(revoked_at=now))
    return user


async def invite_user(session: AsyncSession, actor: Actor, *, email: str, role: str) -> Membership:
    if actor.role != "admin":
        raise Forbidden("Ainult admin saab kasutajaid kutsuda")
    if role not in ("admin", "operator"):
        raise DomainError("Roll peab olema admin või operator")
    email = email.strip().lower()
    user = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        user = User(email=email, name=email.split("@")[0], password_hash=None)
        session.add(user)
        await session.flush()
    existing = (await session.execute(select(Membership).where(Membership.user_id == user.id, Membership.account_id == actor.account_id))).scalar_one_or_none()
    if existing:
        raise DomainError("Kasutaja on juba kontol", code="already_member", status_code=409)
    m = Membership(account_id=actor.account_id, user_id=user.id, role=role, invited_email=email, invite_token=secrets.token_urlsafe(32))
    session.add(m)
    await session.flush()
    emit(session, actor, "membership", m.id, "membership.invited", {"email": email, "role": role})
    from app.domain.notify import notify

    await notify(session, actor, kind="invite", title="Kutse ThinkOne kontole", body=f"Sind kutsuti kontole rolliga {role}.",
                 recipient_email=email, link=f"/invite/{m.invite_token}")
    return m


async def accept_invite(session: AsyncSession, *, token: str, name: str, password: str) -> tuple[User, Membership]:
    m = (await session.execute(select(Membership).where(Membership.invite_token == token))).scalar_one_or_none()
    if not m or m.accepted_at:
        raise NotFound("Kutse ei kehti")
    if len(password) < 8:
        raise DomainError("Parool peab olema vähemalt 8 märki", code="weak_password")
    user = await session.get(User, m.user_id)
    assert user
    if not user.password_hash:
        user.name = name.strip() or user.name
        user.password_hash = hash_password(password)
    m.accepted_at = datetime.now(UTC)
    m.invite_token = None
    actor = Actor(account_id=m.account_id, user_id=user.id, role=m.role)
    emit(session, actor, "membership", m.id, "membership.accepted", {"user_id": user.id})
    return user, m


async def list_members(session: AsyncSession) -> list[Membership]:
    return list((await session.execute(select(Membership).order_by(Membership.created_at))).scalars())


async def update_member(session: AsyncSession, actor: Actor, membership_id: uuid.UUID, *, role: str | None = None, notification_prefs: dict | None = None) -> Membership:
    m = await session.get(Membership, membership_id)
    if not m:
        raise NotFound()
    if role is not None:
        if actor.role != "admin":
            raise Forbidden()
        m.role = role
    if notification_prefs is not None:
        m.notification_prefs = notification_prefs
    emit(session, actor, "membership", m.id, "membership.updated", {"role": role, "prefs": notification_prefs is not None})
    return m
