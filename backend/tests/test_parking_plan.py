"""Parking schematic: boxes per register spot, VLM draft (fake model), rendered background, upload trigger."""


from httpx import AsyncClient
from sqlalchemy import text

from app.domain.parking_plan import draft_from_model, match_label
from tests.helpers import make_company, make_property, make_space


def _png(w: int = 400, h: int = 200) -> bytes:
    import fitz

    pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, w, h), False)
    pix.clear_with(255)
    return pix.tobytes("png")


async def _building(client: AsyncClient):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    s1 = await make_space(client, prop["id"], "Pind 1", 100)
    s2 = await make_space(client, prop["id"], "Pind 2", 80)
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/import", params={"dry_run": "false"}, json={"text": "1;Hoov;tavaline;Pind 1\n2;Hoov;elektriauto;\n3;;;\n"})
    assert r.status_code == 200 and r.json()["created"] == 3, r.text
    return prop, s1, s2


async def test_plan_save_roundtrip(client: AsyncClient, admin: dict):
    prop, s1, s2 = await _building(client)
    doc = (await client.get(f"/api/v1/assets/{prop['id']}/parking/plan")).json()
    assert doc["lots"] == [] and doc["draft"] is None and doc["plan_attachments"] == []
    assert [s["number"] for s in doc["spots"]] == ["1", "2", "3"] and all(s["geom"] is None for s in doc["spots"])
    by = {s["number"]: s for s in doc["spots"]}

    body = {"lots": [{"id": "p0", "name": "Hoov", "width": 60, "height": 40}, {"id": "p1", "name": "-1 korrus", "width": 30, "height": 20}],
            "spots": [{"id": by["1"]["id"], "geom": {"x": 5, "y": 5, "w": 2.5, "h": 5, "rot": 0, "lot": "p1"}},
                      {"id": by["2"]["id"], "geom": {"x": 7.5, "y": 5, "w": 2.5, "h": 5, "rot": 0}, "space_id": s2["id"], "set_space": True}],
            "new": [{"number": "4", "zone": "Hoov", "type": "ligipääsetav", "geom": {"x": 10, "y": 5, "w": 3.5, "h": 5, "rot": 90}, "space_id": s2["id"]}]}
    r = await client.put(f"/api/v1/assets/{prop['id']}/parking/plan", json=body)
    assert r.status_code == 200, r.text
    doc = r.json()
    assert [lot["name"] for lot in doc["lots"]] == ["Hoov", "-1 korrus"] and doc["lots"][0]["units"] == "m"
    by = {s["number"]: s for s in doc["spots"]}
    assert by["1"]["geom"]["x"] == 5 and by["1"]["geom"]["lot"] == "p1" and by["1"]["space_name"] == "Pind 1"
    assert by["2"]["geom"]["lot"] == "p0"  # no lot given → the first lot
    assert by["2"]["space_name"] == "Pind 2" and by["3"]["geom"] is None
    assert by["4"]["type"] == "ligipääsetav" and by["4"]["geom"]["rot"] == 90 and by["4"]["space_name"] == "Pind 2"
    assert (await client.get(f"/api/v1/assets/{s2['id']}")).json()["attributes"]["parking_spots"] == 2
    # the register sees the same rows; the plan is also visible on the asset's attributes
    assert len((await client.get(f"/api/v1/assets/{prop['id']}/parking")).json()) == 4
    assert (await client.get(f"/api/v1/assets/{prop['id']}")).json()["attributes"]["parking_lots"][0]["height"] == 40
    r = await client.put(f"/api/v1/assets/{prop['id']}/parking/plan", json={"spots": [{"id": by["3"]["id"], "geom": {"x": 1, "y": 1, "w": 2.5, "h": 5, "lot": "nope"}}]})
    assert r.status_code == 400 and "nope" in r.json()["detail"]

    # unplace one, detach its space; a duplicate number and a foreign space are refused
    r = await client.put(f"/api/v1/assets/{prop['id']}/parking/plan", json={"spots": [{"id": by["2"]["id"], "geom": None, "space_id": None, "set_space": True}]})
    assert r.status_code == 200, r.text
    by = {s["number"]: s for s in r.json()["spots"]}
    assert by["2"]["geom"] is None and by["2"]["space_id"] is None and by["1"]["geom"]["x"] == 5
    r = await client.put(f"/api/v1/assets/{prop['id']}/parking/plan", json={"new": [{"number": "1", "geom": {"x": 1, "y": 1, "w": 2.5, "h": 5}}]})
    assert r.status_code == 400 and "1" in r.json()["detail"]
    other = await make_property(client, (await make_company(client, "Teine OÜ"))["id"], "Teine maja")
    r = await client.put(f"/api/v1/assets/{prop['id']}/parking/plan", json={"spots": [{"id": by["1"]["id"], "geom": None, "space_id": other["id"], "set_space": True}]})
    assert r.status_code == 400
    r = await client.put(f"/api/v1/assets/{prop['id']}/parking/plan", json={"lots": [{"id": "x", "name": "X", "width": 0, "height": 10}]})
    assert r.status_code in (400, 422)
    # dropping a lot from the list unplaces its boxes
    r = await client.put(f"/api/v1/assets/{prop['id']}/parking/plan", json={"lots": [{"id": "p0", "name": "Hoov", "width": 60, "height": 40}]})
    assert r.status_code == 200, r.text
    by = {s["number"]: s for s in r.json()["spots"]}
    assert by["1"]["geom"] is None and by["4"]["geom"]["lot"] == "p0"
    ev = (await client.get("/api/v1/audit", params={"entity_type": "asset", "entity_id": prop["id"]})).json()
    assert any(e["action"] == "asset.parking_plan_updated" and e["payload"]["created"] == 1 for e in ev)


async def test_plan_upload_queues_derivation_and_draft(client: AsyncClient, admin: dict):
    prop, s1, s2 = await _building(client)
    r = await client.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "false"}, files=[("files", ("parkimisskeem.png", _png(), "image/png"))])
    assert r.status_code == 200 and r.json()[0]["target"] == "parking", r.text
    from app.infra.db import sessionmaker

    async with sessionmaker()() as s:
        async with s.begin():
            await s.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            rows = (await s.execute(text("SELECT args FROM procrastinate_jobs WHERE task_name = 'app.worker.tasks.derive_parking_plan'"))).all()
    assert len(rows) == 1 and rows[0][0]["property_id"] == prop["id"] and rows[0][0]["attachment_id"]

    # the background renders to PNG (cached in the blobstore); the inline derive uses the fake model → one row of boxes
    r = await client.get(f"/api/v1/assets/{prop['id']}/parking/plan/background")
    assert r.status_code == 200 and r.headers["content-type"] == "image/png" and r.content[:8] == b"\x89PNG\r\n\x1a\n"
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/plan/derive")
    assert r.status_code == 200, r.text
    doc = r.json()
    d = doc["draft"]
    assert d["status"] == "ready" and d["matched"] == 3 and len(d["spots"]) == 3 and d["model"] == "fake-heuristic"
    assert d["background"]["attachment_id"] == doc["plan_attachments"][0]["id"] and d["width"] > 0
    assert d["lot"]["name"] == "parkimisskeem" and d["lot"]["id"].startswith("lot-") and all(s["geom"]["lot"] == d["lot"]["id"] for s in d["spots"])
    assert {s["number"] for s in d["spots"]} == {"1", "2", "3"} and all(s["spot_id"] for s in d["spots"])
    assert abs(d["spots"][0]["geom"]["w"] - 2.5) < 0.01  # the median width is the standard spot
    assert (await client.get(f"/api/v1/assets/{prop['id']}")).json()["attributes"]["parking_plan_draft"]["status"] == "ready"

    # accepting = saving the boxes with clear_draft; discarding = DELETE
    by = {s["number"]: s for s in doc["spots"]}
    body = {"lots": [d["lot"]], "spots": [{"id": by[s["number"]]["id"], "geom": s["geom"]} for s in d["spots"]], "clear_draft": True}
    r = await client.put(f"/api/v1/assets/{prop['id']}/parking/plan", json=body)
    assert r.status_code == 200 and r.json()["draft"] is None and all(s["geom"] for s in r.json()["spots"]), r.text
    assert r.json()["lots"][0]["background"]["attachment_id"] == doc["plan_attachments"][0]["id"]
    # deriving again targets the lot that already uses this plan; an explicit lot works too; an unknown lot is refused
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/plan/derive")
    assert r.json()["draft"]["status"] == "ready" and r.json()["draft"]["lot"]["id"] == d["lot"]["id"]
    r = await client.post(f"/api/v1/assets/{prop['id']}/parking/plan/derive", json={"lot_id": d["lot"]["id"]})
    assert r.status_code == 200 and r.json()["draft"]["lot"]["id"] == d["lot"]["id"]
    assert (await client.post(f"/api/v1/assets/{prop['id']}/parking/plan/derive", json={"lot_id": "zzz"})).status_code == 400
    r = await client.delete(f"/api/v1/assets/{prop['id']}/parking/plan/draft")
    assert r.status_code == 204
    assert (await client.get(f"/api/v1/assets/{prop['id']}/parking/plan")).json()["draft"] is None

    # no plan uploaded → derive and background are refused
    bare = await make_property(client, (await make_company(client, "Kolmas OÜ"))["id"], "Kolmas")
    assert (await client.post(f"/api/v1/assets/{bare['id']}/parking/plan/derive")).status_code == 400
    assert (await client.get(f"/api/v1/assets/{bare['id']}/parking/plan/background")).status_code == 400


def test_draft_from_model_matching_and_scale():
    import uuid
    from types import SimpleNamespace

    spots = [SimpleNamespace(id=uuid.uuid4(), attributes={"number": n}) for n in ("1", "2", "12", "P-07")]
    assert match_label("P 07", [s.attributes["number"] for s in spots]) == "P-07"
    assert match_label("012", [s.attributes["number"] for s in spots]) == "12"
    assert match_label("x", [s.attributes["number"] for s in spots]) is None
    data = {"spots": [{"label": "1", "cx": 100, "cy": 100, "w": 50, "h": 100, "rot": 0, "type": "ev"},
                      {"label": "1", "cx": 160, "cy": 100, "w": 50, "h": 100, "rot": 0, "type": None},  # duplicate claim → unbound
                      {"label": "12", "cx": 220, "cy": 100, "w": 100, "h": 50, "rot": 90, "type": "disabled"},
                      {"label": None, "cx": "bad", "cy": 1, "w": 1, "h": 1, "rot": 0, "type": None}], "notes": "1:200"}
    d = draft_from_model(data, 1000, 500, spots, uuid.uuid4())  # type: ignore[arg-type]
    assert len(d["spots"]) == 3 and d["matched"] == 2
    assert d["spots"][0]["number"] == "1" and d["spots"][0]["type"] == "elektriauto" and d["spots"][0]["geom"]["w"] == 2.5 and d["spots"][0]["geom"]["h"] == 5
    assert d["spots"][1]["number"] is None and d["spots"][1]["spot_id"] is None
    assert d["spots"][2]["number"] == "12" and d["spots"][2]["geom"]["w"] == 2.5 and d["spots"][2]["geom"]["rot"] == 90
    assert d["width"] == 50 and d["height"] == 25 and d["notes"] == "1:200"
    assert d["lot"]["width"] == 50 and d["spots"][0]["geom"]["lot"] == d["lot"]["id"]


def test_legacy_single_frame_reads_as_one_lot():
    from app.domain.parking_plan import lots_of

    assert lots_of({}) == []
    assert lots_of({"parking_plan": {"width": 10, "height": 5}}) == [{"id": "main", "name": "Parkla", "width": 10, "height": 5}]
    assert lots_of({"parking_plan": {"width": 10, "height": 5}, "parking_lots": [{"id": "a", "name": "A", "width": 1, "height": 1}]})[0]["id"] == "a"
