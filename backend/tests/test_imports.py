"""End-to-end import flow on the real sample contracts (fake model = rule-based structurer)."""

import json
import pathlib
import uuid

from httpx import AsyncClient

# the client's demo package ships the sample originals (demo/demo/lisad/importitud)
SAMPLES = pathlib.Path(__file__).resolve().parents[2] / "demo" / "demo" / "lisad" / "importitud"
LEASE_PDF = SAMPLES / "MARU_uurileping_P29.pdf"
MAINT_DOCX = SAMPLES / "Hooldusleping_H5-08.docx"
SCAN_LIKE_PDF = SAMPLES / "T6B_pind_29_plaan.pdf"  # a drawing: text layer too thin → treated as scan


async def _run_worker_inline(job_id: str):
    from app.ingest.pipeline import run_structuring

    await run_structuring(uuid.UUID(job_id))


async def _upload(client: AsyncClient, path: pathlib.Path, content_type: str) -> dict:
    r = await client.post("/api/v1/imports", files={"file": (path.name, path.read_bytes(), content_type)})
    assert r.status_code == 201, r.text
    return r.json()


async def test_import_lease_pdf_end_to_end(client: AsyncClient, admin: dict):
    job = await _upload(client, LEASE_PDF, "application/pdf")
    assert job["status"] == "uploaded" and job["source_document"]["format"] == "pdf"
    await _run_worker_inline(job["id"])
    r = await client.get(f"/api/v1/imports/{job['id']}")
    j = r.json()
    assert j["status"] == "review", j.get("error")
    assert j["source_document"]["page_count"] == 8 and j["source_document"]["has_text_layer"]
    prop = j["proposal"]
    assert prop["contract"]["category"] == "lease"
    assert any(p["registry_code"] == "10714568" for p in prop["parties"])
    assert any(p["key"] == "rent_per_m2" and p["value"] == "7.60" for p in prop["parameters"])
    assert len(prop["clauses"]) > 100
    assert j["text_pages"] and j["text_pages"][0]["page"] == 1 and j["source_url"]
    assert j["uncertain"]  # some fields need checking
    # operator edit: fix a value, then commit with all uncertain fields checked
    prop["parameters"][0]["value"] = "7.60"
    prop["contract"]["title"] = "Üürileping P_29 · AS Maru Ehitus"
    r = await client.patch(f"/api/v1/imports/{job['id']}", json={"reviewed": prop})
    assert r.status_code == 200 and r.json()["edits_count"] >= 1
    r = await client.post(f"/api/v1/imports/{job['id']}/commit", json={"checked": []})
    assert r.status_code == 422  # unchecked uncertain fields block commit
    # link to a company + property
    co = (await client.post("/api/v1/companies", json={"name": "Taevavärava OÜ", "registry_code": "16333502"})).json()
    prop_asset = (await client.post("/api/v1/assets", json={"type_code": "property", "name": "Hoone T6B", "company_id": co["id"],
                                                             "attributes": {"address": "Taevavärava tee 6b"}})).json()
    space = (await client.post("/api/v1/assets", json={"type_code": "space", "name": "P_29", "parent_id": prop_asset["id"],
                                                        "attributes": {"rentable_area_m2": 174.8, "price_per_m2": 7.6}})).json()
    # the space's default parking spots follow the lease at commit (demo v586); one spot is out of service and stays free
    r = await client.post(f"/api/v1/assets/{prop_asset['id']}/parking/import", params={"dry_run": "false"}, json={"text": "41;;;P_29\n42;;;P_29\n43;;;\n"})
    assert r.status_code == 200 and r.json()["created"] == 3
    spot42 = next(s for s in (await client.get(f"/api/v1/assets/{prop_asset['id']}/parking")).json() if s["number"] == "42")
    await client.post(f"/api/v1/assets/{prop_asset['id']}/parking/update", json={"ids": [spot42["id"]], "patch": {"out_of_service": True}})
    # one lease can cover several spaces of the building: commit with ``asset_ids`` (P_30 has no default spots)
    space2 = (await client.post("/api/v1/assets", json={"type_code": "space", "name": "P_30", "parent_id": prop_asset["id"],
                                                         "attributes": {"rentable_area_m2": 60, "price_per_m2": 7.6}})).json()
    r = await client.post(f"/api/v1/imports/{job['id']}/commit", json={"checked": j["uncertain"], "company_id": co["id"], "asset_ids": [space["id"], space2["id"]]})
    assert r.status_code == 200, r.text
    cid = r.json()["contract_id"]
    spots = {s["number"]: s for s in (await client.get(f"/api/v1/assets/{prop_asset['id']}/parking")).json()}
    assert spots["41"]["status"] == "üüritud" and spots["41"]["contract"]["id"] == cid and spots["42"]["status"] == "kasutusest väljas" and spots["43"]["status"] == "vaba"
    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert {a["asset"]["name"] for a in c["allocations"]} == {"P_29", "P_30", "P 41"}
    assert (await client.get(f"/api/v1/assets/{space2['id']}")).json()["status"] == "üüritud"
    assert c["origin"] == "imported" and c["category"] == "lease" and c["title"].startswith("Üürileping P_29")
    assert c["party"]["registry_code"] == "10714568"
    # default party set: the counterparty is the primary row with the lease's counterparty role
    assert [(x["role"], x["is_primary"], x["source"]) for x in c["parties"]] == [("tenant", True, "import")]
    assert c["parties"][0]["party"]["registry_code"] == "10714568"
    assert "tenant" in (await client.get(f"/api/v1/parties/{c['parties'][0]['party']['id']}")).json()["roles"]
    assert any(f["key"] == "rent_per_m2" for f in c["facts"])
    assert any(k["kind_code"] == "start" for k in c["key_dates"])
    assert len(c["clauses"]) > 100 and c["clauses"][0]["number"] == "1"
    assert next(a for a in c["allocations"] if a["asset"]["name"] == "P_29")["kind"] == "exclusive"
    assert c["source_documents"][0]["url"]
    # the space is now occupied (derived status)
    s = (await client.get(f"/api/v1/assets/{space['id']}")).json()
    assert s["status"] == "üüritud"
    # search + calendar + health see it
    assert any(h["entity_type"] == "contract" for h in (await client.get("/api/v1/search", params={"q": "Maru"})).json())
    kd = (await client.get("/api/v1/key-dates", params={"contract_id": cid})).json()
    assert kd and kd[0]["contract"]["id"] == cid
    health = (await client.get("/api/v1/portfolio/health")).json()
    assert health["totals"]["imported"] == 1
    events = (await client.get("/api/v1/audit", params={"entity_type": "contract", "entity_id": cid})).json()
    assert any(e["action"] == "contract.imported" for e in events)
    # re-importing the same file → duplicate flagged, commit updates the existing contract
    job2 = await _upload(client, LEASE_PDF, "application/pdf")
    assert job2["duplicate_of_contract_id"] == cid
    await _run_worker_inline(job2["id"])
    j2 = (await client.get(f"/api/v1/imports/{job2['id']}")).json()
    # … with an explicit party list: the proposal's tenant plus an existing party as guarantor
    guarantor = (await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "Garant OÜ", "registry_code": "11111111", "roles": []})).json()
    prop2 = j2["reviewed"] or j2["proposal"]
    tenant_idx = next(i for i, p in enumerate(prop2["parties"]) if p["registry_code"] == "10714568")
    r = await client.post(f"/api/v1/imports/{job2['id']}/commit", json={"checked": j2["uncertain"], "parties": [
        {"index": tenant_idx, "party_id": None, "role": "tenant", "is_primary": True, "include": True},
        {"index": None, "party_id": guarantor["id"], "role": "other", "is_primary": False, "include": True},
    ]})
    assert r.status_code == 200 and r.json()["contract_id"] == cid
    assert len((await client.get("/api/v1/contracts")).json()) == 1
    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert [(x["party"]["name"], x["role"], x["is_primary"]) for x in c["parties"]] == [(c["party"]["name"], "tenant", True), ("Garant OÜ", "other", False)]
    assert c["party"]["registry_code"] == "10714568"
    assert "other" in (await client.get(f"/api/v1/parties/{guarantor['id']}")).json()["roles"]
    # a third re-import with a different list replaces the rows instead of appending
    job3 = await _upload(client, LEASE_PDF, "application/pdf")
    await _run_worker_inline(job3["id"])
    j3 = (await client.get(f"/api/v1/imports/{job3['id']}")).json()
    r = await client.post(f"/api/v1/imports/{job3['id']}/commit", json={"checked": j3["uncertain"], "parties": [
        {"index": tenant_idx, "party_id": None, "role": "tenant", "is_primary": True, "include": True}]})
    assert r.status_code == 200
    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert [(x["role"], x["is_primary"]) for x in c["parties"]] == [("tenant", True)]
    assert len((await client.get("/api/v1/parties")).json()) == 2  # the guarantor party itself stays


async def test_import_maintenance_docx_and_coverage(client: AsyncClient, admin: dict):
    job = await _upload(client, MAINT_DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    await _run_worker_inline(job["id"])
    j = (await client.get(f"/api/v1/imports/{job['id']}")).json()
    assert j["status"] == "review", j.get("error")
    assert j["proposal"]["contract"]["category"] == "maintenance"
    assert j["proposal"]["contract"]["number"] == "H5.08"
    assert any(p["name"].startswith("Caverion") for p in j["proposal"]["parties"])
    co = (await client.post("/api/v1/companies", json={"name": "Taevavärava OÜ"})).json()
    building = (await client.post("/api/v1/assets", json={"type_code": "property", "name": "Hoone T6B", "company_id": co["id"], "attributes": {}})).json()
    r = await client.post(f"/api/v1/imports/{job['id']}/commit", json={"checked": j["uncertain"], "asset_id": building["id"]})
    assert r.status_code == 200, r.text
    c = (await client.get(f"/api/v1/contracts/{r.json()['contract_id']}")).json()
    assert c["type_code"] == "generic" and c["allocations"][0]["kind"] == "coverage"
    assert c["party"]["name"].startswith("Caverion")
    assert [(x["role"], x["is_primary"]) for x in c["parties"]] == [("maintainer", True)]
    # health: open-ended contract without notice → info finding; missing annexes referenced (Lisa 1–5)
    health = (await client.get("/api/v1/portfolio/health")).json()
    codes = {f["code"] for f in health["findings"]}
    assert "missing_annex" in codes


async def test_scanned_pdf_fails_structuring_and_manual_registration(client: AsyncClient, admin: dict):
    job = await _upload(client, SCAN_LIKE_PDF, "application/pdf")
    await _run_worker_inline(job["id"])
    j = (await client.get(f"/api/v1/imports/{job['id']}")).json()
    assert j["status"] == "failed" and "tekstikiht" in j["error"]
    r = await client.post("/api/v1/imports/manual", files={"file": ("skann.pdf", SCAN_LIKE_PDF.read_bytes(), "application/pdf")},
                          data={"title": "Kindlustusleping (skann)", "category": "insurance", "counterparty_name": "If P&C Insurance AS",
                                "registry_code": "10100168", "start_date": "2026-01-01", "end_date": "2026-12-31",
                                "key_dates": json.dumps([{"kind": "end", "date": "2026-12-31", "title": "Poliisi lõpp"}]),
                                "parameters": json.dumps([{"key": "premium", "label": "Kindlustusmakse", "value": "1200", "unit": "EUR"}])})
    assert r.status_code == 201, r.text
    c = (await client.get(f"/api/v1/contracts/{r.json()['contract_id']}")).json()
    assert c["origin"] == "imported" and not c["has_clause_tree"] and c["clauses"] == [] and c["current_values"]["premium"]["value"] == "1200"
    assert c["party"]["registry_code"] == "10100168" and [(x["role"], x["is_primary"]) for x in c["parties"]] == [("insurer", True)]
    assert any(k["kind_code"] == "end" for k in c["key_dates"])
    # externally signed amendment: new fact version supersedes the old one
    r = await client.post(f"/api/v1/contracts/{c['id']}/amendments", files={"file": ("lisa1.pdf", b"%PDF-1.4 lisa", "application/pdf")},
                          data={"note": "Lisa 1 — makse muutus", "parameters": json.dumps([{"key": "premium", "label": "Kindlustusmakse", "value": "1300", "unit": "EUR"}]),
                                "key_dates": json.dumps([{"kind": "payment", "date": "2026-07-01", "title": "Uus makse"}]), "valid_from": "2026-07-01",
                                "end_date": "2027-06-30"})
    assert r.status_code == 201, r.text
    c2 = (await client.get(f"/api/v1/contracts/{c['id']}")).json()
    assert c2["current_values"]["premium"]["value"] == "1300"
    # the amended end date moves the existing end key date instead of adding a second one
    assert c2["end_date"] == "2027-06-30" and [k["due_date"] for k in c2["key_dates"] if k["kind_code"] == "end"] == ["2027-06-30"]
    prem = [f for f in c2["facts"] if f["key"] == "premium"]
    assert len(prem) == 2 and any(f["valid_to"] == "2026-07-01" for f in prem) and any(f["reason"] == "amendment" for f in prem)
    assert len(c2["source_documents"]) == 2
    # platform-born contracts are outside the external amendment path
    from app.domain.contracts import create_contract
    from app.domain.events import Actor
    from app.infra.db import tenant_session

    aid = uuid.UUID(admin["account"]["id"])
    async with tenant_session(aid) as s:
        pc = await create_contract(s, Actor(account_id=aid, user_id=uuid.UUID(admin["user_id"])), type_code="lease", title="Platvormi leping",
                                   number="LEP-2026-900", status="draft", origin="platform")
        pcid = pc.id
    r = await client.post(f"/api/v1/contracts/{pcid}/amendments", files={"file": ("x.pdf", b"%PDF-1.4", "application/pdf")}, data={"note": "x"})
    assert r.status_code == 400


async def test_asice_container_import(client: AsyncClient, admin: dict):
    from app.ingest.container import build_test_container

    data = build_test_container({"leping.pdf": LEASE_PDF.read_bytes(), "T6B_Pind_29_plaan.pdf": SCAN_LIKE_PDF.read_bytes()},
                                signer="Varne Mälksoo", code="37001010000", time="2023-11-25T12:00:00Z")
    r = await client.post("/api/v1/imports", files={"file": ("leping.asice", data, "application/vnd.etsi.asic-e+zip")})
    assert r.status_code == 201, r.text
    job = r.json()
    assert job["source_document"]["format"] == "asice"
    sig = job["source_document"]["container_signatures"][0]
    assert sig["signer"] == "Varne Mälksoo" and sig["signing_time"].startswith("2023-11-25")
    await _run_worker_inline(job["id"])
    j = (await client.get(f"/api/v1/imports/{job['id']}")).json()
    assert j["status"] == "review" and j["proposal"]["contract"]["category"] == "lease"
    # the review's document tabs: the signed lease first-class, the plan in the same container as a further tab
    assert [(f["name"], f["kind"], f["main"]) for f in j["files"]] == [("leping.pdf", "pdf", True), ("T6B_Pind_29_plaan.pdf", "pdf", False)]
    r = await client.get(f"/api/v1/imports/{job['id']}/files/0")
    assert r.status_code == 200 and r.headers["content-type"] == "application/pdf" and r.content == LEASE_PDF.read_bytes()
    assert (await client.get(f"/api/v1/imports/{job['id']}/files/5")).status_code == 404
    # the text says „allkirjastatud digitaalselt” and „tähtajaliselt 7 aastaks alates allkirjastamisest”: the dates come from
    # the container's signing time + the term, and land in the calendar as start/end key dates
    head = j["proposal"]["contract"]
    # (the only printed date is the handover „Hiljemalt 02.01.2024” — that is the start, not the signing)
    assert (head["signed_at"], head["start_date"], head["end_date"]) == ("2023-11-25", "2024-01-02", "2030-11-25")
    assert {(k["kind"], k["date"]) for k in j["proposal"]["key_dates"]} >= {("start", "2024-01-02"), ("end", "2030-11-25")}
    # an indexation date recurs every year of the term in the calendar, not only the first time
    prop = j["proposal"]
    prop["key_dates"].append({"kind": "indexation", "date": "2024-11-01", "title": "Indekseerimine", "confidence": 1.0, "note": None, "page": 1, "char_start": None, "char_end": None})
    assert (await client.patch(f"/api/v1/imports/{job['id']}", json={"reviewed": prop})).status_code == 200
    r = await client.post(f"/api/v1/imports/{job['id']}/commit", json={"checked": j["uncertain"]})
    assert r.status_code == 200, r.text
    c = (await client.get(f"/api/v1/contracts/{r.json()['contract_id']}")).json()
    assert (c["signed_at"], c["start_date"], c["end_date"]) == ("2023-11-25", "2024-01-02", "2030-11-25")
    assert [k["due_date"] for k in sorted(c["key_dates"], key=lambda k: k["due_date"]) if k["kind_code"] == "indexation"] == [f"{y}-11-01" for y in range(2024, 2031)]
    assert c["source_documents"][0]["container_signatures"][0]["personal_code"] == "37001010000"
    # provenance anchors open the signed PDF inside the container, plus the extracted text pages as fallback
    v = (await client.get(f"/api/v1/contracts/{c['id']}/source-documents/{c['source_documents'][0]['id']}/view")).json()
    assert v["format"] == "asice" and v["pdf_url"] and v["pdf_url"] != c["source_documents"][0]["url"]
    assert v["text_pages"] and v["text_pages"][0]["page"] == 1
    assert (await client.get(f"/api/v1/contracts/{c['id']}/source-documents/{uuid.uuid4()}/view")).status_code == 404


def test_proposal_schema_has_no_numeric_bounds():
    """Anthropic structured output refuses minimum/maximum on integer and number types (seen live 2026-10-06)."""
    import json

    from app.ingest.schema import proposal_json_schema

    text = json.dumps(proposal_json_schema())
    assert '"minimum"' not in text and '"maximum"' not in text and '"exclusiveMinimum"' not in text


ANNEX_PDF = SAMPLES / "MARU_uurileping_P29_lisa3.pdf"


async def test_import_desk_batch_toimik_and_bulk_confirm(client: AsyncClient, admin: dict):
    """Demo v622/v638: one drop = one import; the annex hangs under its lease, the toimik waits until every uncertain
    value is checked and the lease has its space, then „Kinnita valmis” writes the contract and the annex onto it."""
    batch = str(uuid.uuid4())
    jobs = []
    for path in (LEASE_PDF, ANNEX_PDF, MAINT_DOCX):
        ct = "application/pdf" if path.suffix == ".pdf" else "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        r = await client.post("/api/v1/imports", files={"file": (path.name, path.read_bytes(), ct)}, data={"batch_id": batch})
        assert r.status_code == 201, r.text
        assert r.json()["batch_id"] == batch
        jobs.append(r.json())
    # the same file twice in one import is refused
    r = await client.post("/api/v1/imports", files={"file": (LEASE_PDF.name, LEASE_PDF.read_bytes(), "application/pdf")}, data={"batch_id": batch})
    assert r.status_code in (400, 409, 422)
    d = (await client.get(f"/api/v1/imports/desk/{batch}")).json()
    assert d["batch"]["reading"] == 3 and d["batch"]["state"] == "reading"
    for j in jobs:
        await _run_worker_inline(j["id"])
    lease, annex, maint = jobs
    a = (await client.get(f"/api/v1/imports/{annex['id']}")).json()
    assert a["kind"] == "annex" and a["annex_number"] == "3"

    d = (await client.get(f"/api/v1/imports/desk/{batch}")).json()
    assert d["batch"]["files"] == 3 and d["batch"]["records"] == 2 and d["batch"]["children"] == 1
    t = next(x for x in d["toimikud"] if x["row"]["id"] == lease["id"])
    assert [c["id"] for c in t["children"]] == [annex["id"]] and t["children"][0]["kind"] == "annex"
    assert t["state"] == "ootab"  # uncertain values, no space yet
    assert any(b["id"] == batch for b in (await client.get("/api/v1/imports/desk")).json()["batches"])

    # the register: company + building + the space the file names (P29 → Pind 29)
    co = (await client.post("/api/v1/companies", json={"name": "Taevavärava OÜ", "registry_code": "16333502"})).json()
    b = (await client.post("/api/v1/assets", json={"type_code": "property", "name": "Hoone T6B", "company_id": co["id"], "attributes": {"address": "Taevavärava tee 6b"}})).json()
    sp = (await client.post("/api/v1/assets", json={"type_code": "space", "name": "Pind 29", "parent_id": b["id"], "attributes": {"rentable_area_m2": 174.8, "price_per_m2": 7.6}})).json()
    # check every uncertain value on the lease and the annex; leave the maintenance contract out
    for j in (lease, annex):
        unc = (await client.get(f"/api/v1/imports/{j['id']}")).json()["uncertain"]
        r = await client.patch(f"/api/v1/imports/{j['id']}/desk", json={"checked": unc})
        assert r.status_code == 200 and set(r.json()["checked"]) == set(unc)
    r = await client.post(f"/api/v1/imports/{maint['id']}/exclude", json={"reason": "juba registris"})
    assert r.status_code == 200 and r.json()["status"] == "excluded"

    d = (await client.get(f"/api/v1/imports/desk/{batch}")).json()
    t = next(x for x in d["toimikud"] if x["row"]["id"] == lease["id"])
    assert t["state"] == "valmis", t
    assert t["row"]["spaces"] == ["Pind 29"] and t["row"]["link_suggested"]
    assert d["ready"]["contracts"] == 1 and d["ready"]["children"] == 1
    assert next(x for x in d["toimikud"] if x["row"]["id"] == maint["id"])["state"] == "ei"

    r = await client.post(f"/api/v1/imports/batches/{batch}/commit-ready")
    assert r.status_code == 200, r.text
    assert r.json()["contracts"] == 1 and r.json()["children"] == 1
    lj = (await client.get(f"/api/v1/imports/{lease['id']}")).json()
    aj = (await client.get(f"/api/v1/imports/{annex['id']}")).json()
    assert lj["status"] == "committed" and aj["status"] == "committed"
    assert aj["committed_contract_id"] == lj["committed_contract_id"]  # the annex went onto the lease, not a contract of its own
    c = (await client.get(f"/api/v1/contracts/{lj['committed_contract_id']}")).json()
    assert c["version"] >= 2
    d = (await client.get(f"/api/v1/imports/desk/{batch}")).json()
    assert d["batch"]["committed"] == 1 and d["batch"]["state"] == "done"

    # left out → back → out again → removed from the import
    assert (await client.post(f"/api/v1/imports/{maint['id']}/restore")).json()["status"] == "review"
    await client.post(f"/api/v1/imports/{maint['id']}/exclude", json={})
    assert (await client.delete(f"/api/v1/imports/{maint['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/imports/{maint['id']}")).status_code == 404
