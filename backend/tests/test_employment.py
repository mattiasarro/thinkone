"""Phase 3.2 — the employment vertical on the same engine: position → draft → candidate link → negotiation → accepted."""

from __future__ import annotations

import pathlib

from httpx import AsyncClient

from tests.helpers import make_company

GT = pathlib.Path(__file__).resolve().parents[2] / "data" / "mallid" / "uldtingimused_laoboksid.docx"


async def test_employment_draft_and_negotiation(client: AsyncClient, admin: dict):
    co = await make_company(client, "Tööandja OÜ")
    r = await client.post("/api/v1/assets", json={"type_code": "department", "name": "Haldus", "company_id": co["id"], "attributes": {}})
    assert r.status_code == 201, r.text
    dep = r.json()
    r = await client.post("/api/v1/assets", json={"type_code": "position", "name": "Objektihaldur", "parent_id": dep["id"], "capacity": 1,
                                                  "attributes": {"duties": "Hoone haldus, üürnike suhtlus, hooldustööde korraldamine.", "salary": 2500, "headcount": 1}})
    assert r.status_code == 201, r.text
    pos = r.json()
    r = await client.post("/api/v1/parties", json={"kind": "person", "name": "Kati Karu", "personal_code": "48001010000", "email": "kati@example.com", "roles": ["employee"]})
    emp = r.json()
    r = await client.post("/api/v1/templates/general-terms", data={"name": "Töölepingu üldtingimused", "company_id": co["id"], "contract_type_code": "employment"},
                          files={"file": (GT.name, GT.read_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert r.status_code == 201, r.text
    assert r.json()["contract_type_code"] == "employment"
    r = await client.post("/api/v1/leases/employment", json={"party_id": emp["id"], "position_id": pos["id"], "salary": 2600, "start": "2027-01-04", "probation_months": 4, "company_id": co["id"]})
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["number"].startswith("TL-") and d["deal"]["vertical"] == "employment" and d["deal"]["end"] is None and d["deal"]["employment"]["salary"] == 2600.0
    assert d["deal"]["employment"]["probation_end"] == "2027-05-04" and d["deal"]["employment"]["salary_review"] == "2028-01-04"
    main = [c for c in d["clauses"] if c["container"] == "main"]
    assert [c["heading"] for c in main if c["level"] == 0] == ["Pooled", "Töö", "Töötasu", "Tööaeg ja puhkus", "Tähtaeg"]
    salary = next(c for c in main if c["fact_key"] == "salary")
    assert "2 600,00 eurot kuus" in salary["text"]
    assert "Objektihaldur" in next(c for c in main if c["number"] == "2.1")["text"] and "Hoone haldus" in next(c for c in main if c["fact_key"] == "duties")["text"]
    assert "tähtajatult" in next(c for c in main if c["fact_key"] == "months")["text"] and "04.05.2027" in next(c for c in main if c["fact_key"] == "probation_months")["text"]
    assert [c for c in d["clauses"] if c["container"] == "general"] and all(c["locked"] for c in d["clauses"] if c["container"] == "general")
    assert [(a["number"], a["kind"]) for a in d["annexes"]][:2] == [(1, "job_description"), (3, "special_terms")]
    c = (await client.get(f"/api/v1/contracts/{d['id']}")).json()
    assert c["type_code"] == "employment" and c["category"] == "employment" and c["party"]["name"] == "Kati Karu"
    facts = {f["key"]: f for f in c["facts"]}
    assert facts["salary"]["value"] == 2600.0 and facts["probation_end"]["value"] == "2027-05-04" and facts["end_date"]["text"] == "tähtajatu"
    assert {k["kind_code"] for k in c["key_dates"]} == {"start", "probation", "salary_review"}
    assert [(a["asset"]["name"], a["kind"]) for a in c["allocations"]] == [("Objektihaldur", "quota")]
    assert "Tööleping nr TL-" in (await client.get(f"/api/v1/leases/{d['id']}/document.html")).text
    # terms change regenerates
    r = await client.patch(f"/api/v1/leases/{d['id']}/employment-terms", json={"salary": 2800, "months": 12, "expected_version": d["version"]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["deal"]["end"] == "2028-01-03" and "2 800,00" in next(c for c in d["clauses"] if c["fact_key"] == "salary")["text"]
    assert "tähtajaliselt 12 kuuks" in next(c for c in d["clauses"] if c["fact_key"] == "months")["text"]
    assert {k["kind_code"] for k in (await client.get(f"/api/v1/contracts/{d['id']}")).json()["key_dates"]} == {"start", "end", "probation", "salary_review"}
    # send to the candidate; the candidate proposes a salary; the employer offers 2 900; the candidate confirms and accepts all
    neg = (await client.post(f"/api/v1/leases/{d['id']}/send", json={})).json()
    assert neg["letters"][-1]["title"].startswith("Töölepingu") and neg["turn"] == "client"
    token = neg["link"]["url"].rsplit("/portal/", 1)[1]
    anon = AsyncClient(transport=client._transport, base_url="http://test")
    p = (await anon.get(f"/api/v1/portal/{token}")).json()
    assert p["kind"] == "employment" and p["employment"]["position"] == "Objektihaldur" and p["end"] == "2028-01-03" and p["space_names"] == []
    sal = next(c for c in p["clauses"] if c["fact_key"] == "salary")
    p = (await anon.post(f"/api/v1/portal/{token}/lease/threads", json={"clause_id": sal["id"], "text": "", "wish": {"fact_key": "salary", "value": 3000, "label": "Brutotöötasu"}})).json()
    p = (await anon.post(f"/api/v1/portal/{token}/lease/send", json={})).json()
    assert p["turn"] == "operator"
    neg = (await client.get(f"/api/v1/leases/{d['id']}/negotiation")).json()
    tid = neg["threads"][0]["id"]
    assert neg["threads"][0]["wish"]["value"] == 3000
    neg = (await client.post(f"/api/v1/leases/{d['id']}/threads/{tid}/propose", json={"kind": "fact", "fact_key": "salary", "value": 2900, "text": "Pakume 2 900."})).json()
    neg = (await client.post(f"/api/v1/leases/{d['id']}/round", json={})).json()
    p = (await anon.post(f"/api/v1/portal/{token}/lease/threads/{tid}/decide", json={"accept": True})).json()
    assert "2 900,00" in next(c for c in p["clauses"] if c["fact_key"] == "salary")["text"] and p["can_accept"] is True
    p = (await anon.post(f"/api/v1/portal/{token}/lease/accept")).json()
    assert p["status"] == "ready_to_sign"
    assert {f["key"]: f["value"] for f in (await client.get(f"/api/v1/contracts/{d['id']}")).json()["facts"]}["salary"] == 2900.0
    await anon.aclose()
