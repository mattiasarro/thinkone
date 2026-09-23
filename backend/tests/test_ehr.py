"""Live EHR adapter against recorded responses of livekluster.ehr.ee (no network)."""

import json
import pathlib

import httpx

from app.integrations.ehr import LiveEHR, normalize_address, parse_detail

FIX = json.loads((pathlib.Path(__file__).parent / "fixtures" / "ehr_t6b.json").read_text())


def _transport(calls: list):
    def handler(request: httpx.Request) -> httpx.Response:
        calls.append((request.method, request.url.path, dict(request.url.params), request.content))
        if request.url.path.endswith("/v2/buildingSearch"):
            body = json.loads(request.content)
            if "Taevavärava" in body["buildingLocation"]:
                return httpx.Response(200, json=FIX["search"])
            return httpx.Response(400, json={"message": "Building Not Found!"})
        if request.url.path.endswith("/v2/buildingData"):
            code = request.url.params.get("ehr_code")
            if code == "121378008":
                return httpx.Response(200, json=FIX["detail_121378008"])
            return httpx.Response(400, json={"message": "Building Not Found!"})
        return httpx.Response(404)

    return httpx.MockTransport(handler)


def test_normalize_address_variants():
    assert normalize_address("Betooni 11g, Tallinn")[:2] == ["Betooni 11g", "Betooni tänav 11g"]
    assert normalize_address("Betooni tn 11g") == ["Betooni tn 11g", "Betooni tänav 11g"]
    assert normalize_address("Taevavärava tee 6b") == ["Taevavärava tee 6b"]


def test_parse_detail_maps_register_fields():
    hit = next(h for h in FIX["search"] if h["ehrCode"] == "121378008")
    r = parse_detail(FIX["detail_121378008"], hit)
    assert r.ehr_code == "121378008"
    assert r.address == "Harju maakond, Rae vald, Lehmja küla, Taevavärava tee 6b"
    assert r.footprint_m2 == 6852.5 and r.net_area_m2 == 7765.8 and r.floors == 2 and r.build_year == 2023
    assert r.use_type.startswith("Muu laohoone") and "Büroohoone" in r.use_type
    assert r.raw["pohiandmed"]["suletud_netopind"] == "7765.8"


async def test_lookup_by_address_filters_structures_and_fetches_details():
    calls: list = []
    rows = await LiveEHR(transport=_transport(calls)).lookup("Taevavärava tee 6b")
    # 9 hits in the register, 1 is a building (H) → one record, enriched from the detail call
    assert [r.ehr_code for r in rows] == ["121378008"]
    assert rows[0].net_area_m2 == 7765.8 and rows[0].build_year == 2023
    assert [c[1] for c in calls] == ["/api/building/v2/buildingSearch", "/api/building/v2/buildingData"]


async def test_lookup_by_code_and_not_found_and_outage():
    calls: list = []
    rows = await LiveEHR(transport=_transport(calls)).lookup("121378008")
    assert len(rows) == 1 and rows[0].floors == 2
    assert await LiveEHR(transport=_transport(calls)).lookup("Olematu 1") == []
    assert await LiveEHR(transport=_transport(calls)).lookup("999") == []

    def down(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("down")

    assert await LiveEHR(transport=httpx.MockTransport(down)).lookup("Taevavärava tee 6b") == []
