import io
import json
import uuid
import zipfile
from datetime import date, timedelta

from httpx import AsyncClient

from tests.helpers import make_company, make_contract, make_property, make_space


async def test_parking_register(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    s1 = await make_space(client, prop["id"], "Pind 1", 100, type="ladu")
    s2 = await make_space(client, prop["id"], "Pind 2", 80, type="büroo")
    r = await client.get("/api/v1/assets/parking/csv-template")
    assert r.status_code == 200 and r.text.startswith("nr;tsoon;tüüp;pind")

    text = "nr;tsoon;tüüp;pind\n1;Hoov;tavaline;Pind 1\n2;Hoov;elektriauto;Pind 1\n3;Hoov;reserv;\n10-12;P-1;ligipääsetav reserv;Pind 9\n"
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/import", params={"dry_run": "true"}, json={"text": text})
    assert r.status_code == 200, r.text
    res = r.json()
    assert res["dry_run"] is True and res["created"] == 3
    assert res["rows"][3]["ok"] is False and "Pind 9" in res["rows"][3]["errors"][0]
    assert res["rows"][3]["numbers"] == ["10", "11", "12"] and res["rows"][3]["type"] == "ligipääsetav" and res["rows"][3]["reserve"] is True
    ok = text.replace(";Pind 9", "")
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/import", params={"dry_run": "false"}, json={"text": ok})
    assert r.status_code == 200 and r.json()["created"] == 6, r.text
    # idempotent: same numbers again are skipped
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/import", params={"dry_run": "false"}, json={"text": ok})
    assert r.json()["created"] == 0 and r.json()["skipped"] == 6
    spots = (await client.get(f"/api/v1/assets/{prop['id']}/parking")).json()
    assert [s["number"] for s in spots] == ["1", "2", "3", "10", "11", "12"]
    by = {s["number"]: s for s in spots}
    assert by["1"]["space_name"] == "Pind 1" and by["2"]["type"] == "elektriauto" and by["3"]["status"] == "reserv" and by["3"]["reserve"] is True
    assert by["10"]["status"] == "reserv" and by["10"]["type"] == "ligipääsetav"
    assert (await client.get(f"/api/v1/assets/{prop['id']}")).json()["attributes"]["has_parking"] is True

    # bulk edit: out of service; assign numbers to a space (removes them from the other)
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/update", json={"ids": [by["3"]["id"]], "patch": {"out_of_service": True, "zone": "Taga"}})
    assert r.status_code == 200 and r.json()[0]["status"] == "kasutusest väljas" and r.json()[0]["zone"] == "Taga"
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/update", json={"ids": [by["3"]["id"]], "patch": {"type": "midagi"}})
    assert r.status_code == 400
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/assign", json={"space_id": s2["id"], "numbers": ["2", "10"]})
    assert r.status_code == 200, r.text
    by = {s["number"]: s for s in r.json()}
    assert by["2"]["space_name"] == "Pind 2" and by["10"]["space_name"] == "Pind 2" and by["1"]["space_name"] == "Pind 1"
    assert (await client.get(f"/api/v1/assets/{s2['id']}")).json()["attributes"]["parking_spots"] == 2
    assert (await client.get(f"/api/v1/assets/{s1['id']}")).json()["attributes"]["parking_spots"] == 1
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/assign", json={"space_id": s2["id"], "numbers": ["99"]})
    assert r.status_code == 400 and "99" in r.json()["detail"]
    ev = (await client.get("/api/v1/audit", params={"entity_type": "asset", "entity_id": s2["id"]})).json()
    assert any(e["action"] == "asset.parking_assigned" and e["payload"]["after"] == ["2", "10"] for e in ev)

    # occupancy: a lease on a spot → üüritud; a spot in a document cannot be deleted; the register never counts in the building occupancy
    cid = await make_contract(admin["account"]["id"], company_id=company["id"], start_date=date.today() - timedelta(days=1), end_date=date.today() + timedelta(days=30))
    r = await client.post("/api/v1/allocations", json={"contract_id": str(cid), "asset_id": by["1"]["id"], "kind": "exclusive"})
    assert r.status_code == 201, r.text
    by = {s["number"]: s for s in (await client.get(f"/api/v1/assets/{prop['id']}/parking")).json()}
    assert by["1"]["status"] == "üüritud" and by["1"]["contract"]["number"] == "LEP-2024-001"
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/delete", json={"ids": [by["1"]["id"]]})
    assert r.status_code == 409
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/delete", json={"ids": [by["11"]["id"], by["12"]["id"]]})
    assert r.status_code == 204
    assert len((await client.get(f"/api/v1/assets/{prop['id']}/parking")).json()) == 4
    p = (await client.get(f"/api/v1/assets/{prop['id']}")).json()
    assert p["occupancy"] == {"units": 2, "occupied": 0, "free": 2} and p["children_count"] == 2
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/has-parking", json={"has_parking": False})
    assert r.status_code == 409


async def test_plans_bulk_upload_matches_filenames(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    s8 = await make_space(client, prop["id"], "Pind 8", 100)
    b1 = await make_space(client, prop["id"], "Büroo 1", 30)
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    png = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w") as z:
        z.writestr("plaanid/T6B_B1.svg", "<svg xmlns='http://www.w3.org/2000/svg'/>")
        z.writestr("plaanid/koondplaan.pdf", pdf)
    files = [("files", ("T6B_Pind_08.pdf", pdf, "application/pdf")), ("files", ("T6B_Pind_08.png", png, "image/png")),
             ("files", ("plaanid.zip", zbuf.getvalue(), "application/zip")), ("files", ("notes.txt", b"x", "text/plain"))]
    r = await client.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "true"}, files=files)
    assert r.status_code == 200, r.text
    rows = {x["filename"]: x for x in r.json()}
    assert rows["T6B_Pind_08.pdf"]["target"] == "space" and rows["T6B_Pind_08.pdf"]["space_name"] == "Pind 8"
    assert rows["T6B_Pind_08.png"]["target"] == "skip" and "T6B_Pind_08.pdf" in rows["T6B_Pind_08.png"]["note"]  # PDF beats image
    assert rows["T6B_B1.svg"]["target"] == "space" and rows["T6B_B1.svg"]["space_id"] == b1["id"]
    assert rows["koondplaan.pdf"]["target"] == "overview"
    assert rows["notes.txt"]["target"] == "skip"
    assert all(x["attachment_id"] is None for x in r.json())

    # operator corrections: the whole-building plan is actually Pind 8's; the B1 svg is skipped
    mapping = json.dumps({"koondplaan.pdf": s8["id"], "T6B_B1.svg": "skip"})
    r = await client.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "false"}, files=files, data={"mapping": mapping})
    assert r.status_code == 200, r.text
    rows = {x["filename"]: x for x in r.json()}
    # two files now map to Pind 8 → both PDFs; the first keeps, the second is skipped
    kept = [x for x in rows.values() if x["target"] == "space" and x["space_id"] == s8["id"]]
    assert len(kept) == 1 and kept[0]["attachment_id"]
    detail = (await client.get(f"/api/v1/assets/{s8['id']}")).json()
    assert [a["role"] for a in detail["attachments"]] == ["floor_plan"]
    assert (await client.get(f"/api/v1/assets/{b1['id']}")).json()["attachments"] == []
    ev = (await client.get("/api/v1/audit", params={"entity_type": "asset", "entity_id": s8["id"]})).json()
    plan_ev = next(e for e in ev if e["action"] == "asset.plan_set")
    assert plan_ev["payload"]["before"] is None and plan_ev["payload"]["name"] == "Pind 8"
    # a second upload for the same space records the replacement
    r = await client.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "false"}, files=[("files", ("Pind 8 uus.pdf", pdf, "application/pdf"))])
    assert r.status_code == 200 and "asendab" in r.json()[0]["note"]
    assert len((await client.get(f"/api/v1/assets/{s8['id']}")).json()["attachments"]) == 2  # history kept, newest first


async def test_plans_matching_uses_one_model_call(client: AsyncClient, admin: dict):
    """The model sees the whole batch once; a full mapping (what the UI sends on confirm) needs no call at all."""
    from app.agent.providers.base import chat_model

    company = await make_company(client)
    prop = await make_property(client, company["id"])
    a101 = await make_space(client, prop["id"], "A-101", 100)
    await make_space(client, prop["id"], "LB-01", 40)
    pdf = b"%PDF-1.4\n%%EOF\n"
    fake = chat_model()
    before = len(fake.calls)
    files = [("files", ("a101_plaan.pdf", pdf, "application/pdf")), ("files", ("LB01.pdf", pdf, "application/pdf")), ("files", ("koond.pdf", pdf, "application/pdf"))]
    r = await client.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "true"}, files=files)
    assert r.status_code == 200, r.text
    assert len(fake.calls) == before + 1
    payload = json.loads(fake.calls[-1]["user"])
    assert [s["name"] for s in payload["spaces"]] == ["A-101", "LB-01"] and payload["files"] == ["a101_plaan.pdf", "LB01.pdf", "koond.pdf"]
    rows = {x["filename"]: x for x in r.json()}
    assert rows["koond.pdf"]["target"] == "overview"

    mapping = json.dumps({"a101_plaan.pdf": a101["id"], "LB01.pdf": "skip", "koond.pdf": "property"})
    r = await client.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "false"}, files=files, data={"mapping": mapping})
    assert r.status_code == 200, r.text
    assert len(fake.calls) == before + 1  # nothing left to guess
    rows = {x["filename"]: x for x in r.json()}
    assert rows["a101_plaan.pdf"]["target"] == "space" and rows["a101_plaan.pdf"]["attachment_id"]
    assert rows["LB01.pdf"]["target"] == "skip" and rows["koond.pdf"]["target"] == "property"


async def test_plans_model_answer_validation(client: AsyncClient, admin: dict):
    """The model's answer is best-effort: unknown files, bad indexes and low confidence fall back to unmatched; model errors to the rules."""
    from types import SimpleNamespace

    from app.agent.providers.base import StructuredResult, chat_model, set_chat_model
    from app.domain.plans import apply_matches, match_files

    spaces = [SimpleNamespace(id=uuid.uuid4(), name="A-101", attributes={}), SimpleNamespace(id=uuid.uuid4(), name="Pind 8", attributes={})]
    data = {"matches": [{"file": "a.pdf", "space": 1, "confidence": 0.95}, {"file": "b.pdf", "space": 2, "confidence": 0.3},
                        {"file": "c.pdf", "space": 7, "confidence": 1}, {"file": "ghost.pdf", "space": 1, "confidence": 1}, {"file": "d.pdf", "space": None, "confidence": 0}]}
    out = apply_matches(data, ["a.pdf", "b.pdf", "c.pdf", "d.pdf", "e.pdf"], spaces)  # type: ignore[arg-type]
    assert out["a.pdf"] is spaces[0] and out["b.pdf"] is None and out["c.pdf"] is None and out["d.pdf"] is None and out["e.pdf"] is None and "ghost.pdf" not in out

    class Broken:
        async def structured(self, **kw):
            raise RuntimeError("api down")

    class Garbage:
        async def structured(self, **kw):
            return StructuredResult(data={"matches": "nope"}, model="x")

    prev = chat_model()
    try:
        set_chat_model(Broken())
        out = await match_files(["T6B_Pind_08.pdf", "x.pdf"], spaces)  # type: ignore[arg-type]
        assert out["T6B_Pind_08.pdf"] is spaces[1] and out["x.pdf"] is None  # rule-based fallback
        set_chat_model(Garbage())
        out = await match_files(["T6B_Pind_08.pdf"], spaces)  # type: ignore[arg-type]
        assert out == {"T6B_Pind_08.pdf": None}
    finally:
        set_chat_model(prev)
    assert await match_files([], spaces) == {} and await match_files(["a.pdf"], []) == {"a.pdf": None}  # type: ignore[arg-type]


async def test_split_and_merge_space(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    sp = await make_space(client, prop["id"], "Pind 5", 300, type="ladu", parts={"ladu": 250, "kontor": 40, "olmeala": 10}, price_per_m2=8, electrical_capacity_a=63)
    await client.post(f"/api/v1/assets/{prop['id']}/parking/import", params={"dry_run": "false"}, json={"text": "1;;;Pind 5\n2;;;Pind 5\n3;;;Pind 5\n"})
    detail = (await client.get(f"/api/v1/assets/{sp['id']}")).json()
    assert detail["split_block_reason"] is None
    bad = {"units": [{"name": "Pind 5A", "parts": {"ladu": 250}, "price_per_m2": 8}, {"name": "Pind 5B", "parts": {"olmeala": 10, "kontor": 30}, "price_per_m2": 9}]}
    r = await client.post(f"/api/v1/assets/{sp['id']}/split", json=bad)
    assert r.status_code == 400 and "Kontor" in r.json()["detail"]
    good = {"units": [{"name": "Pind 5A", "parts": {"ladu": 250, "olmeala": 5}, "price_per_m2": 8, "parking_numbers": ["1", "2"]},
                      {"name": "Pind 5B", "parts": {"kontor": 40, "olmeala": 5}, "price_per_m2": 9, "parking_numbers": ["3"]}]}
    r = await client.post(f"/api/v1/assets/{sp['id']}/split", json=good)
    assert r.status_code == 201, r.text
    units = r.json()
    assert [u["name"] for u in units] == ["Pind 5A", "Pind 5B"]
    assert units[0]["attributes"]["rentable_area_m2"] == 255 and units[1]["attributes"]["rentable_area_m2"] == 45
    assert units[0]["attributes"]["electrical_capacity_a"] + units[1]["attributes"]["electrical_capacity_a"] == 63
    assert units[0]["attributes"]["type"] == "ladu" and units[1]["attributes"]["type"] == "kontor"
    parent = (await client.get(f"/api/v1/assets/{sp['id']}")).json()
    assert parent["status"] == "jagatud" and [u["name"] for u in parent["split_units"]] == ["Pind 5A", "Pind 5B"]
    assert parent["delete_block_reason"] and "ühenda" in parent["delete_block_reason"]
    assert (await client.get(f"/api/v1/assets/{units[1]['id']}")).json()["split_parent"]["name"] == "Pind 5"
    p = (await client.get(f"/api/v1/assets/{prop['id']}")).json()
    assert p["occupancy"]["units"] == 2  # the split parent no longer counts
    by = {s["number"]: s["space_name"] for s in (await client.get(f"/api/v1/assets/{prop['id']}/parking")).json()}
    assert by == {"1": "Pind 5A", "2": "Pind 5A", "3": "Pind 5B"}
    r = await client.post("/api/v1/assets", json={"type_code": "space", "name": "X", "parent_id": prop["id"], "attributes": {"rentable_area_m2": 1}})
    cid = await make_contract(admin["account"]["id"], company_id=company["id"])
    r = await client.post("/api/v1/allocations", json={"contract_id": str(cid), "asset_id": sp["id"], "kind": "exclusive"})
    assert r.status_code == 400  # jagatud pinda ei seota
    r = await client.post("/api/v1/allocations", json={"contract_id": str(cid), "asset_id": units[0]["id"], "kind": "exclusive"})
    assert r.status_code == 201
    r = await client.post(f"/api/v1/assets/{sp['id']}/merge")
    assert r.status_code == 409 and "Pind 5A" in r.json()["detail"]
    r = await client.request("DELETE", f"/api/v1/allocations/{r.status_code and (await client.get(f'/api/v1/assets/{units[0]['id']}/allocations')).json()[0]['id']}")
    assert r.status_code == 204
    r = await client.post(f"/api/v1/assets/{sp['id']}/merge")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "vaba" and "split_into" not in r.json()["attributes"]
    names = [a["name"] for a in (await client.get("/api/v1/assets", params={"parent_id": prop["id"], "type_code": "space"})).json()]
    assert names == ["Pind 5", "X"]
    by = {s["number"]: s["space_name"] for s in (await client.get(f"/api/v1/assets/{prop['id']}/parking")).json()}
    assert by == {"1": "Pind 5", "2": "Pind 5", "3": "Pind 5"}


async def test_delete_guard_keeps_documented_spaces(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    sp = await make_space(client, prop["id"], "Pind 1", 100)
    cid = await make_contract(admin["account"]["id"], company_id=company["id"], status="ended", start_date=date(2020, 1, 1), end_date=date(2021, 1, 1))
    r = await client.post("/api/v1/allocations", json={"contract_id": str(cid), "asset_id": sp["id"], "kind": "exclusive"})
    assert r.status_code == 201
    assert sp["status"] == "vaba"
    detail = (await client.get(f"/api/v1/assets/{sp['id']}")).json()
    assert "arhiivis" in detail["delete_block_reason"]
    r = await client.request("DELETE", f"/api/v1/assets/{sp['id']}")
    assert r.status_code == 409
    r = await client.request("DELETE", f"/api/v1/assets/{prop['id']}")
    assert r.status_code == 409


async def test_plans_parking_target(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    await make_space(client, prop["id"], "Pind 8", 100)
    pdf = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
    files = [("files", ("T6B_parkimine.pdf", pdf, "application/pdf")), ("files", ("koond.pdf", pdf, "application/pdf")), ("files", ("asendiplaan.pdf", pdf, "application/pdf"))]
    r = await client.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "true"}, files=files)
    assert r.status_code == 200, r.text
    rows = {x["filename"]: x for x in r.json()}
    assert rows["T6B_parkimine.pdf"]["target"] == "parking"
    assert rows["koond.pdf"]["target"] == "overview" and rows["asendiplaan.pdf"]["target"] == "property"
    mapping = json.dumps({"T6B_parkimine.pdf": "parking", "koond.pdf": "overview", "asendiplaan.pdf": "property"})
    r = await client.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "false"}, files=files, data={"mapping": mapping})
    assert r.status_code == 200, r.text
    detail = (await client.get(f"/api/v1/assets/{prop['id']}")).json()
    assert sorted(a["role"] for a in detail["attachments"]) == ["overview_plan", "parking_plan", "site_plan"]
