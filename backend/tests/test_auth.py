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
