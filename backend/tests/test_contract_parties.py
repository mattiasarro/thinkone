"""Contract ↔ party links: many parties per contract, one primary, roles from the shared vocabulary."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.exc import DBAPIError

from tests.conftest import new_email
from tests.helpers import make_contract


async def _party(client: AsyncClient, name: str, roles: list[str] | None = None, **extra) -> dict:
    r = await client.post("/api/v1/parties", json={"kind": "ee_company", "name": name, "roles": roles or [], **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def test_two_tenants_primary_and_removal(client: AsyncClient, admin: dict):
    a = await _party(client, "Üürnik A OÜ", registry_code="10000001")
    b = await _party(client, "Üürnik B OÜ", registry_code="10000002")
    cid = await make_contract(admin["account"]["id"], number="LEP-2026-001", category="lease", parties=[(uuid.UUID(a["id"]), "tenant")])
    r = await client.post(f"/api/v1/contracts/{cid}/parties", json={"party_id": b["id"], "role": "tenant", "is_primary": False})
    assert r.status_code == 201, r.text
    cp_b = r.json()
    assert cp_b["party"]["name"] == "Üürnik B OÜ" and cp_b["role"] == "tenant" and cp_b["is_primary"] is False and cp_b["source"] == "manual"

    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert [(x["party"]["name"], x["is_primary"]) for x in c["parties"]] == [("Üürnik A OÜ", True), ("Üürnik B OÜ", False)]
    assert c["party"]["id"] == a["id"]  # ContractOut.party is the primary one
    assert (await client.get(f"/api/v1/contracts/{cid}/parties")).json() == c["parties"]
    assert next(x for x in (await client.get("/api/v1/contracts")).json() if x["id"] == str(cid))["party"]["name"] == "Üürnik A OÜ"
    assert (await client.get(f"/api/v1/parties/{b['id']}")).json()["roles"] == ["tenant"]  # linking adds the role to the party

    # removing the primary while another remains → 409
    cp_a = next(x for x in c["parties"] if x["is_primary"])
    r = await client.delete(f"/api/v1/contracts/{cid}/parties/{cp_a['id']}")
    assert r.status_code == 409
    # make B primary → A loses the flag; lists and omnibox follow
    r = await client.patch(f"/api/v1/contracts/{cid}/parties/{cp_b['id']}", json={"is_primary": True})
    assert r.status_code == 200 and r.json()["is_primary"] is True
    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert c["party"]["id"] == b["id"] and [(x["party"]["id"], x["is_primary"]) for x in c["parties"]] == [(b["id"], True), (a["id"], False)]
    hits = (await client.get("/api/v1/search", params={"q": "LEP-2026-001"})).json()
    assert "Üürnik B OÜ" in next(h for h in hits if h["entity_type"] == "contract")["subtitle"]
    # now A can go
    assert (await client.delete(f"/api/v1/contracts/{cid}/parties/{cp_a['id']}")).status_code == 204
    # role change on the remaining row
    r = await client.patch(f"/api/v1/contracts/{cid}/parties/{cp_b['id']}", json={"role": "other", "valid_from": "2026-01-01"})
    assert r.status_code == 200 and r.json()["role"] == "other" and r.json()["valid_from"] == "2026-01-01"
    # the last party may be removed; the health report then flags the contract
    assert (await client.delete(f"/api/v1/contracts/{cid}/parties/{cp_b['id']}")).status_code == 204
    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert c["parties"] == [] and c["party"] is None
    health = (await client.get("/api/v1/portfolio/health")).json()
    no_party = next(f for f in health["findings"] if f["code"] == "no_party")
    assert [i["contract_id"] for i in no_party["items"]] == [str(cid)]
    # adding to an empty contract makes the row primary automatically
    r = await client.post(f"/api/v1/contracts/{cid}/parties", json={"party_id": a["id"], "role": "tenant"})
    assert r.status_code == 201 and r.json()["is_primary"] is True

    events = (await client.get("/api/v1/audit", params={"entity_type": "contract_party"})).json()
    actions = {e["action"] for e in events}
    assert {"contract_party.added", "contract_party.primary_changed", "contract_party.removed", "contract_party.updated"} <= actions
    # the global log resolves the rows to the contract
    log = (await client.get("/api/v1/audit", params={"entity_type": "contract_party", "resolve": "true"})).json()
    row = next(e for e in log if e["action"] == "contract_party.added")
    assert row["entity_link"] == f"/app/portfell/leping/{cid}" and "Üürnik" in (row["entity_label"] or "")
    # contract audit folder includes the party events (payload.contract_id)
    folder = (await client.get("/api/v1/audit", params={"entity_type": "contract", "entity_id": str(cid)})).json()
    assert any(e["action"] == "contract.created" for e in folder)


async def test_validation_and_duplicates(client: AsyncClient, admin: dict):
    a = await _party(client, "Osapool OÜ")
    cid = await make_contract(admin["account"]["id"], number="LEP-2", category="lease")
    r = await client.post(f"/api/v1/contracts/{cid}/parties", json={"party_id": a["id"], "role": "üürnik"})
    assert r.status_code == 422
    assert (await client.post(f"/api/v1/contracts/{cid}/parties", json={"party_id": a["id"], "role": "tenant"})).status_code == 201
    r = await client.post(f"/api/v1/contracts/{cid}/parties", json={"party_id": a["id"], "role": "tenant"})
    assert r.status_code == 409
    # same party with another role is a separate link
    assert (await client.post(f"/api/v1/contracts/{cid}/parties", json={"party_id": a["id"], "role": "other"})).status_code == 201
    assert (await client.post(f"/api/v1/contracts/{cid}/parties", json={"party_id": str(uuid.uuid4()), "role": "tenant"})).status_code == 404
    assert (await client.post(f"/api/v1/contracts/{uuid.uuid4()}/parties", json={"party_id": a["id"], "role": "tenant"})).status_code == 404
    # a link id under the wrong contract is not found
    cp = (await client.get(f"/api/v1/contracts/{cid}/parties")).json()[0]
    other = await make_contract(admin["account"]["id"], number="LEP-3")
    assert (await client.delete(f"/api/v1/contracts/{other}/parties/{cp['id']}")).status_code == 404


async def test_contract_create_with_parties_and_amendment_tenant_change(client: AsyncClient, admin: dict):
    from datetime import date

    from app.domain.contract_parties import (
        change_primary_by_amendment,
        counterparty_role,
        list_for_contract,
        our_role,
    )
    from app.domain.events import Actor

    assert counterparty_role("lease") == "tenant" and our_role("lease") == "landlord"
    assert counterparty_role("maintenance") == "maintainer" and our_role("maintenance") == "client"
    assert counterparty_role("insurance") == "insurer" and our_role("insurance") == "insured"
    assert counterparty_role(None) == "supplier" and our_role("other") == "client"

    a = await _party(client, "Vana üürnik OÜ")
    b = await _party(client, "Uus üürnik OÜ")
    aid = uuid.UUID(admin["account"]["id"])
    cid = await make_contract(aid, number="LEP-4", category="lease", parties=[(uuid.UUID(a["id"]), "tenant")], start_date=date(2025, 1, 1))
    from app.infra.db import tenant_session

    async with tenant_session(aid) as s:
        cp = await change_primary_by_amendment(s, Actor(account_id=aid), cid, new_party_id=uuid.UUID(b["id"]), valid_from=date(2026, 3, 1))
        assert cp.source == "amendment" and cp.is_primary and cp.role == "tenant"
        rows = await list_for_contract(s, cid)
        assert [(p.name, cp_.is_primary, str(cp_.valid_to)) for cp_, p in rows] == [("Uus üürnik OÜ", True, "None"), ("Vana üürnik OÜ", False, "2026-02-28")]
    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert c["party"]["id"] == b["id"] and {x["source"] for x in c["parties"]} == {"amendment", "import"}


async def test_rls_isolates_contract_parties(client: AsyncClient, admin: dict):
    from app.infra.db import tenant_session
    from app.models.contracts import ContractParty

    a1 = uuid.UUID(admin["account"]["id"])
    a = await _party(client, "Üürnik OÜ")
    cid = await make_contract(a1, number="LEP-5", parties=[(uuid.UUID(a["id"]), "tenant")])
    await client.post("/api/v1/auth/logout")
    r = await client.post("/api/v1/auth/register", json={"account_name": "Teine", "email": new_email(), "name": "B", "password": "salasona123"})
    a2 = uuid.UUID(r.json()["account"]["id"])
    async with tenant_session(a2) as s:
        assert (await s.execute(select(ContractParty))).scalars().all() == []
        s.add(ContractParty(account_id=a1, contract_id=cid, party_id=uuid.UUID(a["id"]), role="other"))
        with pytest.raises(DBAPIError):
            await s.flush()
    assert (await client.get(f"/api/v1/contracts/{cid}/parties")).status_code == 404
