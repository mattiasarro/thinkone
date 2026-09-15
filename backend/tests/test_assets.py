import uuid
from datetime import date, timedelta

from httpx import AsyncClient

from tests.helpers import make_company, make_contract, make_property, make_space

CSV_OK = "nimi;tüüp;netopind;üüripind;koefitsient;hind;elekter;parkimiskohad\nA-101;büroo;120,5;132,55;1,10;9,50;25;2\nA-102;ladu;300;300;;6;;\n"


async def test_asset_hierarchy_and_validation(client: AsyncClient, admin: dict):
    company = await make_company(client)
    r = await client.post("/api/v1/assets", json={"type_code": "property", "name": "Ilma ettevõtteta"})
    assert r.status_code == 400 and "company_id" in r.json()["detail"]
    r = await client.post("/api/v1/assets", json={"type_code": "space", "name": "Orb", "attributes": {"rentable_area_m2": 10}})
    assert r.status_code == 400
    r = await client.post("/api/v1/assets", json={"type_code": "property", "name": "X", "company_id": company["id"], "attributes": {"floors": -1}})
    assert r.status_code == 422 and r.json()["errors"][0]["loc"] == ["floors"]

    prop = await make_property(client, company["id"])
    assert prop["kind"] == "container" and prop["children_count"] == 0 and prop["occupancy"] == {"units": 0, "occupied": 0, "free": 0}
    assert prop["attributes"]["vat_taxable"] is True

    r = await client.post("/api/v1/assets", json={"type_code": "space", "name": "A-1", "parent_id": prop["id"], "attributes": {"rentable_area_m2": 0}})
    assert r.status_code == 422
    space = await make_space(client, prop["id"], "A-1", 120, type="büroo", price_per_m2=9.5)
    assert space["status"] == "vaba" and space["company_id"] == company["id"] and space["capacity"] == 1

    # space under a department is refused (vertical mismatch)
    dept = (await client.post("/api/v1/assets", json={"type_code": "department", "name": "Müük"})).json()
    r = await client.post("/api/v1/assets", json={"type_code": "space", "name": "B", "parent_id": dept["id"], "attributes": {"rentable_area_m2": 5}})
    assert r.status_code == 400
    pos = (await client.post("/api/v1/assets", json={"type_code": "position", "name": "Müügijuht", "parent_id": dept["id"], "attributes": {"headcount": 3}})).json()
    assert pos["capacity"] == 3 and pos["status"] == "täitmata"

    r = await client.get("/api/v1/assets", params={"type_code": "space"})
    assert [a["id"] for a in r.json()] == [space["id"]]
    r = await client.get("/api/v1/assets", params={"parent_id": prop["id"]})
    assert len(r.json()) == 1
    r = await client.get("/api/v1/assets", params={"company_id": company["id"]})
    assert {a["type_code"] for a in r.json()} == {"property", "space"}

    r = await client.patch(f"/api/v1/assets/{space['id']}", json={"attributes": {"parking_spots": 2}, "name": "A-1b"})
    assert r.status_code == 200 and r.json()["attributes"]["parking_spots"] == 2 and r.json()["attributes"]["price_per_m2"] == 9.5

    detail = (await client.get(f"/api/v1/assets/{prop['id']}")).json()
    assert [c["name"] for c in detail["children"]] == ["A-1b"] and detail["children"][0]["status"] == "vaba"
    assert detail["attachments"] == [] and detail["allocations"] == [] and detail["children_count"] == 1

    hits = (await client.get("/api/v1/search", params={"q": "A-1b"})).json()
    assert any(h["entity_type"] == "asset" and h["link"] == f"/app/portfell/objekt/{prop['id']}?space={space['id']}" for h in hits)

    r = await client.request("DELETE", f"/api/v1/assets/{prop['id']}")
    assert r.status_code == 204
    assert (await client.get("/api/v1/assets", params={"company_id": company["id"]})).json() == []


async def test_derived_status_from_allocations(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    s1 = await make_space(client, prop["id"], "A-101", 100)
    s2 = await make_space(client, prop["id"], "A-102", 80)
    today = date.today()
    active = await make_contract(admin["account"]["id"], number="LEP-1", status="active", start_date=today - timedelta(days=30), end_date=today + timedelta(days=300))
    ended = await make_contract(admin["account"]["id"], number="LEP-0", status="ended", start_date=today - timedelta(days=700), end_date=today - timedelta(days=10))

    r = await client.post("/api/v1/allocations", json={"contract_id": str(active), "asset_id": s1["id"], "kind": "exclusive"})
    assert r.status_code == 201, r.text
    alloc = r.json()
    assert alloc["period_start"] == (today - timedelta(days=30)).isoformat() and alloc["contract"]["number"] == "LEP-1"
    r = await client.post("/api/v1/allocations", json={"contract_id": str(ended), "asset_id": s2["id"], "kind": "exclusive"})
    assert r.status_code == 201

    spaces = {a["name"]: a for a in (await client.get("/api/v1/assets", params={"parent_id": prop["id"]})).json()}
    assert spaces["A-101"]["status"] == "üüritud" and spaces["A-102"]["status"] == "vaba"
    prop_now = (await client.get(f"/api/v1/assets/{prop['id']}")).json()
    assert prop_now["occupancy"] == {"units": 2, "occupied": 1, "free": 1}
    assert len(prop_now["allocations"]) == 0 and len((await client.get(f"/api/v1/assets/{s1['id']}/allocations")).json()) == 1

    # overlapping exclusive on an occupied unit → 409; a later, non-overlapping period is fine
    other = await make_contract(admin["account"]["id"], number="LEP-2", status="draft")
    r = await client.post("/api/v1/allocations", json={"contract_id": str(other), "asset_id": s1["id"], "kind": "exclusive"})
    assert r.status_code == 409 and "hõivatud" in r.json()["detail"]
    r = await client.post("/api/v1/allocations", json={"contract_id": str(other), "asset_id": s1["id"], "kind": "exclusive",
                                                       "period_start": (today + timedelta(days=301)).isoformat()})
    assert r.status_code == 201
    # coverage on the container is allowed; exclusive on a container is not
    r = await client.post("/api/v1/allocations", json={"contract_id": str(other), "asset_id": prop["id"], "kind": "exclusive"})
    assert r.status_code == 400
    r = await client.post("/api/v1/allocations", json={"contract_id": str(other), "asset_id": prop["id"], "kind": "coverage"})
    assert r.status_code == 201

    # deleting an asset with an active allocation is refused; removing the allocation frees it
    assert (await client.request("DELETE", f"/api/v1/assets/{s1['id']}")).status_code == 409
    assert (await client.request("DELETE", f"/api/v1/allocations/{alloc['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/assets/{s1['id']}")).json()["status"] == "vaba"
    assert (await client.request("DELETE", f"/api/v1/assets/{s1['id']}")).status_code == 204

    # quota: position with capacity 2
    dept = (await client.post("/api/v1/assets", json={"type_code": "department", "name": "Ladu"})).json()
    pos = (await client.post("/api/v1/assets", json={"type_code": "position", "name": "Laotöötaja", "parent_id": dept["id"], "capacity": 2})).json()
    emp = await make_contract(admin["account"]["id"], number="TL-1", status="active", type_code="employment")
    r = await client.post("/api/v1/allocations", json={"contract_id": str(emp), "asset_id": pos["id"], "kind": "quota", "quantity": 1})
    assert r.status_code == 201
    assert (await client.get(f"/api/v1/assets/{pos['id']}")).json()["status"] == "osaliselt"
    emp2 = await make_contract(admin["account"]["id"], number="TL-2", status="active", type_code="employment")
    await client.post("/api/v1/allocations", json={"contract_id": str(emp2), "asset_id": pos["id"], "kind": "quota", "quantity": 1})
    assert (await client.get(f"/api/v1/assets/{pos['id']}")).json()["status"] == "täidetud"
    assert (await client.get(f"/api/v1/assets/{dept['id']}")).json()["occupancy"] == {"units": 1, "occupied": 1, "free": 0}


async def test_spaces_csv_import(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    await make_space(client, prop["id"], "A-102", 250, type="ladu")

    r = await client.get("/api/v1/assets/spaces/csv-template")
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv") and r.text.startswith("nimi;tüüp;netopind;üüripind")

    # dry run: nothing written, actions reported
    r = await client.post(f"/api/v1/assets/{prop['id']}/spaces/import", params={"dry_run": "true"}, files={"file": ("pinnad.csv", CSV_OK.encode("utf-8"), "text/csv")})
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["dry_run"] is True and res["created"] == 1 and res["updated"] == 1
    assert [(x["row"], x["ok"], x["action"]) for x in res["rows"]] == [(2, True, "create"), (3, True, "update")]
    assert res["rows"][0]["data"] == {"name": "A-101", "type": "büroo", "net_area_m2": 120.5, "rentable_area_m2": 132.55, "coefficient": 1.1,
                                      "price_per_m2": 9.5, "electrical_capacity_kw": 25.0, "parking_spots": 2}
    assert len((await client.get("/api/v1/assets", params={"parent_id": prop["id"]})).json()) == 1

    # commit via pasted text (tab-delimited, English headers)
    tsv = "name\trentable_area_m2\tprice_per_m2\nA-101\t132,55\t9,50\nA-102\t250\t6\n"
    r = await client.post(f"/api/v1/assets/{prop['id']}/spaces/import", params={"dry_run": "false"}, json={"text": tsv})
    assert r.status_code == 200, r.text
    assert r.json()["created"] == 1 and r.json()["updated"] == 1 and r.json()["dry_run"] is False
    spaces = {a["name"]: a for a in (await client.get("/api/v1/assets", params={"parent_id": prop["id"]})).json()}
    assert set(spaces) == {"A-101", "A-102"}
    assert spaces["A-102"]["attributes"]["type"] == "ladu" and spaces["A-102"]["attributes"]["price_per_m2"] == 6  # merge keeps existing attrs
    assert spaces["A-101"]["attributes"]["rentable_area_m2"] == 132.55
    ev = (await client.get("/api/v1/audit", params={"entity_type": "asset", "entity_id": prop["id"]})).json()
    assert ev[0]["action"] == "asset.spaces_imported" and ev[0]["payload"]["created"] == 1

    # row errors: missing rentable area, non-numeric, duplicate name, negative value; good rows still counted
    bad = "nimi,üüripind,parkimine\nB-1,,1\nB-2,abc,1\nB-3,50,-1\nB-4,40,\nb-4,41,\n"
    r = await client.post(f"/api/v1/assets/{prop['id']}/spaces/import", params={"dry_run": "true"}, json={"text": bad})
    assert r.status_code == 200, r.text
    rows = {x["row"]: x for x in r.json()["rows"]}
    assert rows[2]["ok"] is False and "üüripind puudub" in rows[2]["errors"]
    assert rows[3]["ok"] is False and "ei ole arv" in rows[3]["errors"][0]
    assert rows[4]["ok"] is False and rows[4]["errors"][0].startswith("parking_spots")
    assert rows[5]["ok"] is True and rows[6]["ok"] is False and "kordub" in rows[6]["errors"][0]
    assert r.json()["created"] == 1

    r = await client.post(f"/api/v1/assets/{prop['id']}/spaces/import", json={"text": "nimi;hind\nA;1\n"})
    assert r.status_code == 400 and "üüripind" in r.json()["detail"]
    r = await client.post(f"/api/v1/assets/{uuid.uuid4()}/spaces/import", json={"text": CSV_OK})
    assert r.status_code == 404
    space_id = spaces["A-101"]["id"]
    r = await client.post(f"/api/v1/assets/{space_id}/spaces/import", json={"text": CSV_OK})
    assert r.status_code == 400
