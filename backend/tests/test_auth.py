import pytest
from httpx import AsyncClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from tests.conftest import new_email


async def test_register_login_me(client: AsyncClient):
    r = await client.post("/api/v1/auth/register", json={"account_name": "Acme", "email": "a@example.com", "name": "A", "password": "salasona123"})
    assert r.status_code == 201
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200 and me.json()["account"]["role"] == "admin"
    await client.post("/api/v1/auth/logout")
    assert (await client.get("/api/v1/auth/me")).status_code == 401
    r = await client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "wrong"})
    assert r.status_code == 401
    r = await client.post("/api/v1/auth/login", json={"email": "a@example.com", "password": "salasona123"})
    assert r.status_code == 200 and r.json()["account"]["name"] == "Acme"


async def test_invite_and_accept(client: AsyncClient, admin: dict):
    from app.integrations.email import email_provider

    email = new_email()
    r = await client.post("/api/v1/auth/invite", json={"email": email, "role": "operator"})
    assert r.status_code == 201, r.text
    sent = email_provider().sent  # type: ignore[attr-defined]
    # the email is sent by the worker; here we check the queued notification + the token via the DB
    from app.infra.db import sessionmaker

    async with sessionmaker()() as s:
        async with s.begin():
            await s.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            token = (await s.execute(text("SELECT invite_token FROM membership WHERE invited_email = :e"), {"e": email})).scalar_one()
            queued = (await s.execute(text("SELECT count(*) FROM notification WHERE recipient_email = :e AND email_status = 'queued'"), {"e": email})).scalar_one()
    assert token and queued == 1 and sent == []
    await client.post("/api/v1/auth/logout")
    r = await client.post("/api/v1/auth/invite/accept", json={"token": token, "name": "Uus", "password": "salasona123"})
    assert r.status_code == 200 and r.json()["account"]["role"] == "operator"
    members = await client.get("/api/v1/auth/members")
    assert members.status_code == 200 and len(members.json()) == 2


async def test_rls_isolates_accounts(client: AsyncClient, admin: dict):
    """Two accounts: rows written under one tenant are invisible under the other."""
    import uuid

    from sqlalchemy import select

    from app.infra.db import tenant_session
    from app.models.core import Party

    a1 = uuid.UUID(admin["account"]["id"])
    await client.post("/api/v1/auth/logout")
    r = await client.post("/api/v1/auth/register", json={"account_name": "Teine", "email": new_email(), "name": "B", "password": "salasona123"})
    a2 = uuid.UUID(r.json()["account"]["id"])
    async with tenant_session(a1) as s:
        s.add(Party(account_id=a1, kind="ee_company", name="Klient A", roles=["client"]))
    async with tenant_session(a2) as s:
        names = [p.name for p in (await s.execute(select(Party))).scalars()]
        assert names == []
        # cross-tenant write is rejected by the policy's WITH CHECK
        s.add(Party(account_id=a1, kind="ee_company", name="Sisse murdmine", roles=["client"]))
        with pytest.raises(DBAPIError):
            await s.flush()


async def _reset_jobs() -> list[dict]:
    from app.infra.db import sessionmaker

    async with sessionmaker()() as s:
        async with s.begin():
            rows = await s.execute(text("SELECT args FROM procrastinate_jobs WHERE task_name = 'app.worker.tasks.send_password_reset_email' ORDER BY id"))
            return [r[0] for r in rows]


async def _send_reset_email(reset_id: str) -> str:
    """Run the worker task and return the token from the emailed link."""
    from app.integrations.email import email_provider
    from app.worker.tasks import send_password_reset_email

    await send_password_reset_email(reset_id)
    mail = email_provider().sent[-1]  # type: ignore[attr-defined]
    return mail["text"].split("/reset-password/")[1].split()[0]


async def test_password_reset(client: AsyncClient, admin: dict):
    from app.integrations.email import email_provider

    r = await client.post("/api/v1/auth/password/forgot", json={"email": "Tarmo@Example.com"})
    assert r.status_code == 204
    jobs = await _reset_jobs()
    assert len(jobs) == 1 and set(jobs[0]) == {"reset_id"}  # nothing secret in the queue
    token = await _send_reset_email(jobs[0]["reset_id"])
    assert email_provider().sent[-1]["to"] == "tarmo@example.com"  # type: ignore[attr-defined]

    r = await client.post("/api/v1/auth/password/reset", json={"token": token, "password": "uus-parool-1"})
    assert r.status_code == 204
    assert (await client.get("/api/v1/auth/me")).status_code == 401  # every session of the user is revoked
    assert (await client.post("/api/v1/auth/login", json={"email": "tarmo@example.com", "password": "salasona123"})).status_code == 401
    assert (await client.post("/api/v1/auth/login", json={"email": "tarmo@example.com", "password": "uus-parool-1"})).status_code == 200

    r = await client.post("/api/v1/auth/password/reset", json={"token": token, "password": "kolmas-parool"})
    assert r.status_code == 404 and r.json()["code"] == "reset_invalid"  # single use


async def test_password_reset_request_reveals_nothing(client: AsyncClient, admin: dict):
    from app.integrations.email import email_provider

    # unknown email and a not-yet-onboarded invitee: same answer, nothing queued
    await client.post("/api/v1/auth/invite", json={"email": "kutsutud@example.com", "role": "operator"})
    for email in ("keegi@example.com", "kutsutud@example.com"):
        assert (await client.post("/api/v1/auth/password/forgot", json={"email": email})).status_code == 204
    assert await _reset_jobs() == []
    # a repeat request within the throttle window does not send a second email
    for _ in range(2):
        assert (await client.post("/api/v1/auth/password/forgot", json={"email": "tarmo@example.com"})).status_code == 204
    jobs = await _reset_jobs()
    assert len(jobs) == 1
    # a grant that was used before the worker got to it is not emailed
    token = await _send_reset_email(jobs[0]["reset_id"])
    await client.post("/api/v1/auth/password/reset", json={"token": token, "password": "uus-parool-1"})
    before = len(email_provider().sent)  # type: ignore[attr-defined]
    from app.worker.tasks import send_password_reset_email

    await send_password_reset_email(jobs[0]["reset_id"])
    assert len(email_provider().sent) == before  # type: ignore[attr-defined]


async def test_password_reset_rejects_bad_tokens(client: AsyncClient, admin: dict):
    import uuid

    from app.domain.auth import password_reset_token
    from app.infra.db import sessionmaker

    await client.post("/api/v1/auth/password/forgot", json={"email": "tarmo@example.com"})
    reset_id = (await _reset_jobs())[0]["reset_id"]
    token = password_reset_token(uuid.UUID(reset_id))
    for bad in ("garbage", password_reset_token(uuid.uuid4()), token[:-2] + "xx"):
        r = await client.post("/api/v1/auth/password/reset", json={"token": bad, "password": "uus-parool-1"})
        assert r.status_code == 404, bad
    r = await client.post("/api/v1/auth/password/reset", json={"token": token, "password": "lühike"})
    assert r.status_code == 422
    async with sessionmaker()() as s:
        async with s.begin():
            await s.execute(text("UPDATE password_reset SET expires_at = now() - interval '1 minute' WHERE id = :id"), {"id": reset_id})
    r = await client.post("/api/v1/auth/password/reset", json={"token": token, "password": "uus-parool-1"})
    assert r.status_code == 404
    assert (await client.post("/api/v1/auth/login", json={"email": "tarmo@example.com", "password": "salasona123"})).status_code == 200
