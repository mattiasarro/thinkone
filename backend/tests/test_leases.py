"""Phase 3 milestone 3.2 — lease drafts: quote → N drafts, main terms from the deal, general terms snapshot, Lisa 3, facts, key dates."""

from __future__ import annotations

import pathlib
from datetime import date

from httpx import AsyncClient

from app.domain.leases import add_months, end_of_term, first_of_next_month
from tests.test_quotes import _create, _setup, _token_of

GT = pathlib.Path(__file__).resolve().parents[2] / "data" / "mallid" / "uldtingimused_naidis.docx"


async def _accepted_quote(client: AsyncClient, names: list[str], **edits) -> tuple[dict, dict]:
    ctx = await _setup(client)
    r = await client.post("/api/v1/templates/general-terms", data={"name": "Üldtingimused", "company_id": ctx["company"]["id"]},
                          files={"file": (GT.name, GT.read_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
    assert r.status_code == 201, r.text
    ctx["template"] = r.json()
    q = await _create(client, ctx, names)
    sid = ctx["spaces"][names[0]]["id"]
    if edits:
        q = (await client.patch(f"/api/v1/quotes/{q['id']}/spaces/{sid}", json=edits)).json()
    q = (await client.post(f"/api/v1/quotes/{q['id']}/send", json={})).json()
    anon = AsyncClient(transport=client._transport, base_url="http://test")
    r = await anon.post(f"/api/v1/portal/{await _token_of(client, q['id'])}/accept")
    assert r.status_code == 200, r.text
    await anon.aclose()
    return ctx, (await client.get(f"/api/v1/quotes/{q['id']}")).json()


def test_date_helpers():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert end_of_term(date(2026, 11, 1), 60) == date(2031, 10, 31)
    assert first_of_next_month(date(2026, 12, 15)) == date(2027, 1, 1)


async def test_convert_quote_to_draft(client: AsyncClient, admin: dict):
    ctx, q = await _accepted_quote(client, ["Pind 12"], schedule=[{"until_month": 12, "price": 8.0}, {"until_month": None, "price": 9.5}], electrical_a=80)
    r = await client.post(f"/api/v1/leases/from-quote/{q['id']}", json={"mode": "separate"})
    assert r.status_code == 201, r.text
    drafts = r.json()
    assert len(drafts) == 1
    d = drafts[0]
    assert d["number"] == f"LEP-{date.today().year}-001" and d["status"] == "draft" and d["editable"] is True and d["quote_id"] == q["id"]
    assert d["party"]["name"] == "Future Invest OÜ" and d["contact"]["email"] == "mari@example.com"
    deal = d["deal"]
    assert deal["handover"] == first_of_next_month().isoformat() and deal["months"] == 60 and deal["deposit_months"] == 3
    assert deal["spaces"][0]["name"] == "Pind 12" and deal["spaces"][0]["parking_numbers"] == ["12"] and deal["spaces"][0]["line"]["stepped"] is True
    assert deal["totals"]["monthly_net"] == 128 * 8.0 and deal["deposit"] == round(128 * 8.0 * 3, 2)
    assert deal["indexation"]["method"] == "fixed_pct" and deal["indexation"]["next_date"] == add_months(date.fromisoformat(deal["handover"]), 12).isoformat()
    # clause containers
    main = [c for c in d["clauses"] if c["container"] == "main"]
    general = [c for c in d["clauses"] if c["container"] == "general"]
    special = [c for c in d["clauses"] if c["container"] == "annex:3"]
    assert [c["number"] for c in main if c["level"] == 0] == ["1", "2", "3", "4", "5", "6"]
    rent = next(c for c in main if c["fact_key"] == "rent")
    assert rent["number"] == "3.1" and "EUR 8,00" in rent["text"] and "1 024,00 €/kuus" in rent["text"] and rent["locked"] is False
    assert "Pind 12" in next(c for c in main if c["number"] == "2.1")["text"] and "kohad nr 12" in next(c for c in main if c["fact_key"] == "parking")["text"]
    assert "Mari Maasikas" in next(c for c in main if c["fact_key"] == "representatives.tenant")["text"]
    assert len(general) == ctx["template"]["node_count"] and all(c["locked"] for c in general)
    assert [c["number"] for c in general][:3] == ["1", "1.1", "1.2"]
    # Lisa 3: the stepped-rent term overrides the rent clause by id, the electricity term the general clause by number (fallback label)
    assert len(special) == 2 and all(s["status"] == "accepted" and s["origin_note"] == "pakkumisest" for s in special)
    stepped = next(s for s in special if "astmeline" in s["text"])
    assert stepped["overrides_clause_id"] == rent["id"] and stepped["number"] == "1"
    el = next(s for s in special if "elektrivõimsus" in s["text"])
    assert el["overrides_clause_id"] or el["overrides_label"] == "Üld · p 4.4"
    # annexes
    assert [(a["number"], a["kind"], a["missing"]) for a in d["annexes"]] == [(1, "floor_plan", True), (2, "parking_plan", True), (3, "special_terms", False)]
    # the contract page sees facts, key dates, allocations
    c = (await client.get(f"/api/v1/contracts/{d['id']}")).json()
    assert c["origin"] == "platform" and c["status"] == "draft" and c["party"]["name"] == "Future Invest OÜ"
    facts = {f["key"]: f for f in c["facts"]}
    assert facts["rent_monthly"]["value"] == 1024.0 and facts["deposit"]["value"] == 3072.0 and facts["period_months"]["value"] == 60
    assert {k["kind_code"] for k in c["key_dates"]} == {"start", "end", "indexation"}
    # one indexation per year of the term (first = next_date, then yearly until the end)
    idx = sorted(k["due_date"] for k in c["key_dates"] if k["kind_code"] == "indexation")
    assert len(idx) >= 2 and idx[-1] <= c["end_date"] and idx[1][:4] == str(int(idx[0][:4]) + 1) and idx[1][4:] == idx[0][4:]
    assert {a["asset"]["name"] for a in c["allocations"]} == {"Pind 12", "P 12"}
    assert c["start_date"] == deal["handover"] and c["end_date"] == deal["end"]
    # the quote is converted; the space is „lepingus” (draft) — still not free
    q2 = (await client.get(f"/api/v1/quotes/{q['id']}")).json()
    assert q2["status"] == "converted" and q2["conversion"] == {"mode": "separate", "contract_ids": [d["id"]]}
    assert (await client.post(f"/api/v1/leases/from-quote/{q['id']}", json={})).status_code == 400
    html = (await client.get(f"/api/v1/leases/{d['id']}/document.html")).text
    assert "Üürileping nr LEP-" in html and "Põhitingimused" in html and "Lisa 3 — Eritingimused" in html and "Üldtingimused" in html


async def test_terms_update_regenerates_and_keeps_edits(client: AsyncClient, admin: dict):
    ctx, q = await _accepted_quote(client, ["Pind 12"])
    d = (await client.post(f"/api/v1/leases/from-quote/{q['id']}", json={})).json()[0]
    # edit the purpose clause wording by hand, then change the deal → unchanged clauses follow, the edited one is kept and flagged
    purpose = next(c for c in d["clauses"] if c["fact_key"] == "purpose")
    r = await client.patch(f"/api/v1/leases/{d['id']}/clauses/{purpose['id']}", json={"text": "Üüripinda kasutatakse laona."})
    assert r.status_code == 200, r.text
    d = r.json()
    assert next(c for c in d["clauses"] if c["fact_key"] == "purpose")["changed"] is True
    r = await client.patch(f"/api/v1/leases/{d['id']}/terms", json={"months": 36, "deposit_months": 2, "handover": "2027-01-01", "purpose": "Büroo",
                                                                   "spaces": [{"space_id": ctx["spaces"]["Pind 12"]["id"], "price_per_m2": 10}], "expected_version": d["version"]})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["deal"]["months"] == 36 and d["deal"]["end"] == "2029-12-31" and d["deal"]["totals"]["monthly_net"] == 1280.0 and d["deal"]["deposit"] == 2560.0
    rent = next(c for c in d["clauses"] if c["fact_key"] == "rent")
    assert "EUR 10,00" in rent["text"] and "1 280,00" in rent["text"]
    assert "3 aastaks" in next(c for c in d["clauses"] if c["fact_key"] == "months")["text"]
    purpose = next(c for c in d["clauses"] if c["fact_key"] == "purpose")
    assert purpose["text"] == "Üüripinda kasutatakse laona." and purpose["provenance"].get("check") is True
    c = (await client.get(f"/api/v1/contracts/{d['id']}")).json()
    assert {f["key"]: f["value"] for f in c["facts"]}["rent_monthly"] == 1280.0
    assert next(k for k in c["key_dates"] if k["kind_code"] == "end")["due_date"] == "2029-12-31"
    # version lock
    assert (await client.patch(f"/api/v1/leases/{d['id']}/terms", json={"months": 12, "expected_version": d["version"] - 1})).status_code == 409
    # locked general clause refuses a direct edit; Lisa 3 override instead
    gen = next(c for c in d["clauses"] if c["container"] == "general" and c["level"] > 0)
    assert (await client.patch(f"/api/v1/leases/{d['id']}/clauses/{gen['id']}", json={"text": "x"})).status_code == 400
    r = await client.post(f"/api/v1/leases/{d['id']}/special", json={"text": "Erandina on etteteatamistähtaeg 30 päeva.", "overrides": f"general:{gen['id']}"})
    assert r.status_code == 201, r.text
    sp = [c for c in r.json()["clauses"] if c["container"] == "annex:3"]
    assert sp[-1]["overrides_clause_id"] == gen["id"] and sp[-1]["status"] == "accepted"
    html = (await client.get(f"/api/v1/leases/{d['id']}/document.html")).text
    assert "muudetud: Lisa 3" in html
    r = await client.delete(f"/api/v1/leases/{d['id']}/special/{sp[-1]['id']}")
    assert r.status_code == 200 and not [c for c in r.json()["clauses"] if c["container"] == "annex:3"]
    # representatives + contact
    reps = d["terms"]["representatives"]
    reps["landlord"][0]["name"] = "Tarmo Sepp"
    r = await client.patch(f"/api/v1/leases/{d['id']}/terms", json={"representatives": reps})
    assert "Tarmo Sepp" in next(c for c in r.json()["clauses"] if c["fact_key"] == "representatives.landlord")["text"]
    r = await client.patch(f"/api/v1/leases/{d['id']}/contact", json={"name": "Mari", "email": "mari@example.com", "phone": ""})
    assert r.json()["contact"]["name"] == "Mari"


async def test_shared_and_from_scratch(client: AsyncClient, admin: dict):
    ctx, q = await _accepted_quote(client, ["Pind 12", "Pind 4"])
    drafts = (await client.post(f"/api/v1/leases/from-quote/{q['id']}", json={"mode": "shared"})).json()
    assert len(drafts) == 1 and [s["name"] for s in drafts[0]["deal"]["spaces"]] == ["Pind 12", "Pind 4"]
    p21 = next(c for c in drafts[0]["clauses"] if c["number"] == "2.1" and c["container"] == "main")
    assert "Pind 12, Pind 4" in p21["text"] and "224" in p21["text"]
    rent = next(c for c in drafts[0]["clauses"] if c["fact_key"] == "rent")
    assert "pindade kaupa" in rent["text"]  # different list prices → per-space rows
    assert {a["asset"]["name"] for a in (await client.get(f"/api/v1/contracts/{drafts[0]['id']}")).json()["allocations"]} == {"Pind 12", "Pind 4", "P 12", "P 4", "P 5"}
    # from scratch (wizard): the same factory
    r = await client.post("/api/v1/leases", json={"party_id": ctx["party"]["id"], "property_id": ctx["property"]["id"], "months": 24, "handover": "2027-03-01",
                                                "spaces": [{"space_id": ctx["spaces"]["Pind 8"]["id"], "price_per_m2": 7.0}]})
    assert r.status_code == 201, r.text
    d = r.json()
    assert d["quote_id"] is None and d["deal"]["handover"] == "2027-03-01" and d["deal"]["end"] == "2029-02-28" and d["deal"]["totals"]["monthly_net"] == 2870.0
    assert d["number"].endswith("-002")
    # another account cannot read it
    other = AsyncClient(transport=client._transport, base_url="http://test")
    await other.post("/api/v1/auth/register", json={"account_name": "Teine OÜ", "email": "teine2@example.com", "name": "Teine", "password": "salasona123"})
    assert (await other.get(f"/api/v1/leases/{d['id']}")).status_code == 404
    await other.aclose()


async def test_signed_platform_lease_indexes_numeric_rent(client: AsyncClient, admin: dict):
    """A platform lease keeps rent as numbers; once signed, resolving its indexation writes numeric rent versions."""
    import uuid
    from datetime import timedelta

    from sqlalchemy import select

    from app.infra.db import tenant_session
    from app.models.contracts import Contract, ContractFact, KeyDate

    _, q = await _accepted_quote(client, ["Pind 12"])
    d = (await client.post(f"/api/v1/leases/from-quote/{q['id']}", json={"mode": "separate"})).json()[0]
    rate = d["deal"]["indexation"]["rate"]
    today = date.today()
    async with tenant_session(uuid.UUID(admin["account"]["id"])) as s:
        c = await s.get(Contract, uuid.UUID(d["id"]))
        assert c
        c.status = "active"
        for f in (await s.execute(select(ContractFact).where(ContractFact.contract_id == c.id))).scalars():
            f.valid_from = today - timedelta(days=375)
        first = (await s.execute(select(KeyDate).where(KeyDate.subject_id == c.id, KeyDate.kind_code == "indexation").order_by(KeyDate.due_date))).scalars().first()
        assert first
        first.due_date = today - timedelta(days=10)
    p = (await client.get(f"/api/v1/contracts/{d['id']}/indexation")).json()
    assert p["rule"] == {"method": "fixed_pct", "rate": rate, "text": p["rule"]["text"]} and p["rent"]["key"] == "rent_monthly"
    old = p["rent"]["value"]
    assert len(p["steps"]) == 1 and p["steps"][0]["proposed"] == round(old * (1 + rate / 100), 2)
    r = await client.post(f"/api/v1/contracts/{d['id']}/indexation", json={"steps": [{"key_date_id": p["steps"][0]["key_date_id"], "applied": True}]})
    assert r.status_code == 200, r.text
    c = (await client.get(f"/api/v1/contracts/{d['id']}")).json()
    rent = c["current_values"]["rent_monthly"]["value"]
    assert isinstance(rent, float) and rent == round(old * (1 + rate / 100), 2)
    assert isinstance(c["current_values"]["rent_per_m2"]["value"], float)
    assert next(k for k in c["key_dates"] if k["due_date"] == (today - timedelta(days=10)).isoformat())["status"] == "done"
