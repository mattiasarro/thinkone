import io
import json
import uuid
import zipfile
from datetime import date, timedelta

from httpx import AsyncClient

from tests.helpers import make_company, make_contract, make_property, make_space


async def test_account_settings(client: AsyncClient, admin: dict):
    r = await client.get("/api/v1/account")
    assert r.status_code == 200
    a = r.json()
    assert a["name"] == "Taevavärava OÜ" and a["settings"]["notify_days"] == {"end": 90, "indexation": 30, "probation": 14, "salary_review": 30, "quote_expiry": 3}
    r = await client.patch("/api/v1/account", json={"name": "Taevavärav Kinnisvara OÜ", "settings": {"notify_days": {"end": 60}}})
    assert r.status_code == 200 and r.json()["name"] == "Taevavärav Kinnisvara OÜ"
    assert r.json()["settings"]["notify_days"]["end"] == 60 and r.json()["settings"]["notify_days"]["indexation"] == 30
    assert (await client.patch("/api/v1/account", json={"settings": {"notify_days": {"end": 9999}}})).status_code == 422
    ev = (await client.get("/api/v1/audit", params={"entity_type": "account"})).json()
    assert ev[0]["action"] == "account.updated" and ev[0]["actor_name"] == "Tarmo Sepp" and ev[0]["actor_type"] == "human"


async def test_audit_list_and_export(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    space = await make_space(client, prop["id"])
    cid = await make_contract(admin["account"]["id"], number="LEP-9", status="active")
    r = await client.post("/api/v1/allocations", json={"contract_id": str(cid), "asset_id": space["id"], "kind": "exclusive"})
    assert r.status_code == 201
    r = await client.post("/api/v1/key-dates", json={"contract_id": str(cid), "kind_code": "end", "due_date": "2027-01-31"})
    assert r.status_code == 201

    all_events = (await client.get("/api/v1/audit", params={"limit": 3})).json()
    assert len(all_events) == 3 and all_events[0]["id"] > all_events[1]["id"] > all_events[2]["id"]
    older = (await client.get("/api/v1/audit", params={"limit": 100, "before": all_events[2]["id"]})).json()
    assert older and all(e["id"] < all_events[2]["id"] for e in older)
    by_contract = (await client.get("/api/v1/audit", params={"entity_type": "contract", "entity_id": str(cid)})).json()
    assert [e["action"] for e in by_contract] == ["contract.created"] and by_contract[0]["actor_type"] == "human"

    r = await client.get("/api/v1/audit/export", params={"contract_id": str(cid)})
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"
    z = zipfile.ZipFile(io.BytesIO(r.content))
    assert set(z.namelist()) == {"events.jsonl", "events.csv", "manifest.json"}
    lines = [json.loads(ln) for ln in z.read("events.jsonl").decode().splitlines()]
    assert [e["action"] for e in lines] == ["contract.created", "allocation.created", "key_date.created"]
    csv_text = z.read("events.csv").decode()
    assert csv_text.startswith("id;ts;actor_type") and csv_text.count("\n") == 4
    assert json.loads(z.read("manifest.json"))["number"] == "LEP-9"
    assert (await client.get("/api/v1/audit/export", params={"contract_id": str(uuid.uuid4())})).status_code == 404


async def test_search(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"], name="Tuleviku tee 6b")
    p = (await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "Nordproff OÜ", "registry_code": "12888777", "roles": ["client"]})).json()
    cid = await make_contract(admin["account"]["id"], number="LEP-2023-029", title="Üürileping Nordproff", party_id=uuid.UUID(p["id"]))

    hits = (await client.get("/api/v1/search", params={"q": "nordproff"})).json()
    assert {(h["entity_type"], h["entity_id"]) for h in hits} == {("party", p["id"]), ("contract", str(cid))}
    assert next(h for h in hits if h["entity_type"] == "contract")["link"] == f"/app/portfell/leping/{cid}"
    hits = (await client.get("/api/v1/search", params={"q": "tuleviku"})).json()
    assert [h["entity_id"] for h in hits] == [prop["id"]] and hits[0]["link"] == f"/app/portfell/objekt/{prop['id']}"
    assert (await client.get("/api/v1/search", params={"q": "12888777"})).json()[0]["entity_type"] == "party"
    assert (await client.get("/api/v1/search", params={"q": ""})).json() == []
    assert len((await client.get("/api/v1/search", params={"q": "nordproff", "limit": 1})).json()) == 1


async def test_key_dates(client: AsyncClient, admin: dict):
    p = (await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "Nordproff OÜ", "roles": ["client"]})).json()
    today = date.today()
    cid = await make_contract(admin["account"]["id"], number="LEP-1", party_id=uuid.UUID(p["id"]), end_date=today + timedelta(days=200))
    other = await make_contract(admin["account"]["id"], number="TL-1", type_code="employment")

    kinds = (await client.get("/api/v1/key-dates/kinds")).json()
    assert {k["code"] for k in kinds} >= {"start", "end", "indexation", "probation", "salary_review"}
    assert next(k for k in kinds if k["code"] == "end")["default_notify_days"] == 90

    r = await client.post("/api/v1/key-dates", json={"contract_id": str(cid), "kind_code": "end", "due_date": (today + timedelta(days=200)).isoformat()})
    assert r.status_code == 201, r.text
    kd = r.json()
    assert kd["title"] == "Lepingu lõpp" and kd["notify_days_before"] == 90 and kd["fired_at"] is None
    assert kd["contract"] == {"id": str(cid), "number": "LEP-1", "title": "Üürileping", "type_code": "lease", "party_name": "Nordproff OÜ"}
    r = await client.post("/api/v1/key-dates", json={"contract_id": str(cid), "kind_code": "indexation", "due_date": (today + timedelta(days=20)).isoformat(), "notify_days_before": 5, "title": "CPI indekseerimine"})
    assert r.status_code == 201 and r.json()["notify_days_before"] == 5 and r.json()["title"] == "CPI indekseerimine"
    r = await client.post("/api/v1/key-dates", json={"contract_id": str(other), "kind_code": "probation", "due_date": (today + timedelta(days=100)).isoformat()})
    assert r.status_code == 201 and r.json()["contract"]["party_name"] is None
    assert (await client.post("/api/v1/key-dates", json={"contract_id": str(cid), "kind_code": "nope", "due_date": "2027-01-01"})).status_code == 404
    assert (await client.post("/api/v1/key-dates", json={"contract_id": str(uuid.uuid4()), "kind_code": "end", "due_date": "2027-01-01"})).status_code == 404

    rows = (await client.get("/api/v1/key-dates")).json()
    assert [x["kind_code"] for x in rows] == ["indexation", "probation", "end"]  # ordered by due date
    rows = (await client.get("/api/v1/key-dates", params={"from": (today + timedelta(days=50)).isoformat(), "to": (today + timedelta(days=150)).isoformat()})).json()
    assert [x["kind_code"] for x in rows] == ["probation"]
    assert [x["kind_code"] for x in (await client.get("/api/v1/key-dates", params={"kind": "end"})).json()] == ["end"]
    assert len((await client.get("/api/v1/key-dates", params={"contract_id": str(cid)})).json()) == 2

    r = await client.patch(f"/api/v1/key-dates/{kd['id']}", json={"due_date": (today + timedelta(days=210)).isoformat(), "notify_days_before": 30})
    assert r.status_code == 200 and r.json()["due_date"] == (today + timedelta(days=210)).isoformat() and r.json()["notify_days_before"] == 30
    assert (await client.request("DELETE", f"/api/v1/key-dates/{kd['id']}")).status_code == 204
    assert (await client.request("DELETE", f"/api/v1/key-dates/{kd['id']}")).status_code == 404
    assert len((await client.get("/api/v1/key-dates")).json()) == 2
