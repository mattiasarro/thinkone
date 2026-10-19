import pytest
from httpx import AsyncClient

from app.infra.settings import get_settings
from tests.conftest import new_email

BOSS = "boss@example.com"


@pytest.fixture(autouse=True)
def _superadmin(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "superadmin_emails", f"someone@example.com, {BOSS.upper()}")


async def _register(client: AsyncClient, account: str, email: str) -> dict:
    r = await client.post("/api/v1/auth/register", json={"account_name": account, "email": email, "name": account, "password": "salasona123"})
    assert r.status_code == 201, r.text
    return r.json()


async def test_regular_admin_is_not_superadmin(client: AsyncClient, admin: dict):
    other = (await _register(client, "Teine OÜ", new_email()))["account"]["id"]
    await client.post("/api/v1/auth/login", json={"email": "tarmo@example.com", "password": "salasona123"})
    me = (await client.get("/api/v1/auth/me")).json()
    assert me["superadmin"] is False
    assert (await client.get("/api/v1/superadmin/overview")).status_code == 403
    assert (await client.post(f"/api/v1/auth/switch/{other}")).status_code == 403


async def test_superadmin_sees_all_and_opens_any_account(client: AsyncClient, admin: dict):
    target = admin["account"]["id"]
    reg = await _register(client, "Boss OÜ", BOSS)
    own = reg["account"]["id"]
    assert reg["superadmin"] is True and (await client.get("/api/v1/auth/me")).json()["superadmin"] is True

    ov = (await client.get("/api/v1/superadmin/overview")).json()
    by_name = {a["name"]: a for a in ov["accounts"]}
    assert [m["email"] for m in by_name["Taevavärava OÜ"]["members"]] == ["tarmo@example.com"]
    assert {u["email"] for u in ov["users"]} >= {"tarmo@example.com", BOSS}

    r = await client.post(f"/api/v1/auth/switch/{target}")
    assert r.status_code == 200, r.text
    assert r.json()["account"] == {"id": target, "name": "Taevavärava OÜ", "role": "admin", "via_superadmin": True}
    me = (await client.get("/api/v1/auth/me")).json()
    assert me["account"]["id"] == target and {a["id"] for a in me["accounts"]} == {own, target}

    # acts as admin there, without becoming a member
    r = await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "AS Maru Ehitus", "registry_code": "10192710", "roles": ["client"]})
    assert r.status_code == 201, r.text
    assert [m["email"] for m in (await client.get("/api/v1/auth/members")).json()] == ["tarmo@example.com"]
    assert "account.superadmin_opened" in {e["action"] for e in (await client.get("/api/v1/audit")).json()}

    r = await client.post(f"/api/v1/auth/switch/{own}")
    assert r.status_code == 200 and [a["id"] for a in r.json()["accounts"]] == [own]


async def test_superadmin_deletes_account_with_everything_in_it(client: AsyncClient, admin: dict):
    from sqlalchemy import text

    from app.infra.blobstore import blobstore
    from app.infra.db import sessionmaker
    from app.models import Base
    from tests.helpers import make_company, make_contract, make_property, make_space

    target = admin["account"]["id"]
    co = await make_company(client)
    prop = await make_property(client, co["id"])
    await make_space(client, prop["id"])
    party = (await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "AS Maru Ehitus", "registry_code": "10192710", "roles": ["client"]})).json()
    await make_contract(target, parties=[(party["id"], "tenant")], company_id=co["id"])
    r = await client.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": prop["id"], "role": "generic"},
                          files={"file": ("plaan.pdf", b"%PDF-1.4 test", "application/pdf")})
    assert r.status_code == 201, r.text
    lone, shared = new_email(), new_email()  # members only here (deleted with the account) / also elsewhere (kept)
    await _register(client, "Muu OÜ", shared)
    await client.post("/api/v1/auth/login", json={"email": "tarmo@example.com", "password": "salasona123"})
    for e in (lone, shared):
        assert (await client.post("/api/v1/auth/invite", json={"email": e, "role": "operator"})).status_code == 201
    assert any(k.startswith(f"account/{target}/") for k in blobstore().data)  # type: ignore[attr-defined]

    own = (await _register(client, "Boss OÜ", BOSS))["account"]["id"]
    body = {"confirm_name": "Taevavärava OÜ"}
    assert (await client.post(f"/api/v1/superadmin/accounts/{own}/delete", json={"confirm_name": "Boss OÜ"})).status_code == 409
    assert (await client.post(f"/api/v1/superadmin/accounts/{target}/delete", json={"confirm_name": "Taevavarava"})).status_code == 422
    r = await client.post(f"/api/v1/superadmin/accounts/{target}/delete", json=body)
    assert r.status_code == 200, r.text
    assert r.json()["name"] == "Taevavärava OÜ" and r.json()["users"] == 2 and r.json()["files"] >= 1  # tarmo + lone

    async with sessionmaker()() as s:
        async with s.begin():
            await s.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            left = {t.name: (await s.execute(text(f'SELECT count(*) FROM "{t.name}" WHERE account_id = :a'), {"a": target})).scalar_one()
                    for t in Base.metadata.sorted_tables if "account_id" in t.c}
            emails = set((await s.execute(text('SELECT email FROM "user"'))).scalars())
    assert not any(left.values()), left
    assert "tarmo@example.com" not in emails and lone not in emails and {shared, BOSS} <= emails
    assert not any(k.startswith(f"account/{target}/") for k in blobstore().data)  # type: ignore[attr-defined]
    assert target not in {a["id"] for a in (await client.get("/api/v1/superadmin/overview")).json()["accounts"]}
    assert (await client.post(f"/api/v1/superadmin/accounts/{target}/delete", json=body)).status_code == 404

    # the freed address can register again
    await client.post("/api/v1/auth/logout")
    await _register(client, "Taevavärava OÜ", "tarmo@example.com")


async def test_regular_admin_cannot_delete_accounts(client: AsyncClient, admin: dict):
    other = await _register(client, "Teine OÜ", new_email())
    await client.post("/api/v1/auth/login", json={"email": "tarmo@example.com", "password": "salasona123"})
    r = await client.post(f"/api/v1/superadmin/accounts/{other['account']['id']}/delete", json={"confirm_name": "Teine OÜ"})
    assert r.status_code == 403
