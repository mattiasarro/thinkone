import uuid

from httpx import AsyncClient

from app.domain.events import Actor
from app.domain.parties import find_or_create_party
from app.infra.db import tenant_session
from tests.helpers import make_contract


async def test_party_crud_and_search(client: AsyncClient, admin: dict):
    r = await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "AS Maru Ehitus", "registry_code": "10192710", "roles": ["client"],
                                                   "email": "info@maru.ee", "contact_name": "Mari Maru"})
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["roles"] == ["client"] and p["kind"] == "ee_company"

    r = await client.post("/api/v1/parties", json={"kind": "person", "name": "Jaan Tamm", "personal_code": "38001010000", "roles": ["employee"]})
    assert r.status_code == 201

    assert len((await client.get("/api/v1/parties")).json()) == 2
    assert [x["name"] for x in (await client.get("/api/v1/parties", params={"q": "maru"})).json()] == ["AS Maru Ehitus"]
    assert [x["name"] for x in (await client.get("/api/v1/parties", params={"q": "1019"})).json()] == ["AS Maru Ehitus"]
    assert [x["name"] for x in (await client.get("/api/v1/parties", params={"role": "employee"})).json()] == ["Jaan Tamm"]

    r = await client.patch(f"/api/v1/parties/{p['id']}", json={"roles": ["client", "supplier"], "phone": "+372 600 0000"})
    assert r.status_code == 200 and r.json()["roles"] == ["client", "supplier"] and r.json()["phone"] == "+372 600 0000"

    r = await client.post("/api/v1/parties", json={"kind": "alien", "name": "X"})
    assert r.status_code == 422
    r = await client.post("/api/v1/parties", json={"kind": "person", "name": "X", "email": "not-an-email"})
    assert r.status_code == 400

    # omnibox sees the party
    hits = (await client.get("/api/v1/search", params={"q": "Maru"})).json()
    assert any(h["entity_type"] == "party" and h["link"] == f"/app/portfell/osapool/{p['id']}" for h in hits)

    r = await client.request("DELETE", f"/api/v1/parties/{p['id']}")
    assert r.status_code == 204
    assert (await client.get(f"/api/v1/parties/{p['id']}")).status_code == 404
    assert len((await client.get("/api/v1/parties")).json()) == 1
    assert not any(h["entity_type"] == "party" and h["entity_id"] == p["id"] for h in (await client.get("/api/v1/search", params={"q": "Maru"})).json())


async def test_party_contracts(client: AsyncClient, admin: dict):
    p = (await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "Nordproff OÜ", "roles": ["client"]})).json()
    cid = await make_contract(admin["account"]["id"], number="LEP-2023-029", title="Üürileping A-101", party_id=uuid.UUID(p["id"]))
    r = await client.get(f"/api/v1/parties/{p['id']}/contracts")
    assert r.status_code == 200
    assert [(c["id"], c["number"], c["status"], c["type_code"]) for c in r.json()] == [(str(cid), "LEP-2023-029", "active", "lease")]
    assert (await client.get(f"/api/v1/parties/{uuid.uuid4()}/contracts")).status_code == 404


async def test_find_or_create_party(client: AsyncClient, admin: dict):
    aid = uuid.UUID(admin["account"]["id"])
    actor = Actor(account_id=aid)
    async with tenant_session(aid) as s:
        a = await find_or_create_party(s, actor, "Caverion Eesti AS", "10059426", role="supplier")
        b = await find_or_create_party(s, actor, "CAVERION EESTI AS", None, role="client")  # name match, case-insensitive
        c = await find_or_create_party(s, actor, "Other Name", "10059426", role="supplier")  # registry code wins
        d = await find_or_create_party(s, actor, "Uus Klient OÜ", None, role="client")
        assert a.id == b.id == c.id and d.id != a.id
        assert b.roles == ["supplier", "client"]
        assert d.kind == "ee_company" and d.roles == ["client"]
    parties = (await client.get("/api/v1/parties")).json()
    assert sorted(p["name"] for p in parties) == ["Caverion Eesti AS", "Uus Klient OÜ"]
    ev = (await client.get("/api/v1/audit", params={"entity_type": "party", "entity_id": str(a.id)})).json()
    assert [e["action"] for e in ev] == ["party.updated", "party.created"]
