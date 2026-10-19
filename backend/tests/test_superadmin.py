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
    own = (await _register(client, "Boss OÜ", BOSS))["account"]["id"]
    assert (await client.get("/api/v1/auth/me")).json()["superadmin"] is True

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
