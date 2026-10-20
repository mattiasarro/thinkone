"""Key dates once they have passed (milestone / window / task) and indexation: resolving one is what changes the rent."""

import uuid
from datetime import UTC, date, datetime, timedelta

from httpx import AsyncClient

from app.domain.indexation import _like, parse_amount, rule
from app.models.contracts import Contract


def test_amounts_keep_their_shape():
    assert parse_amount("1 250,50") == 1250.5
    assert parse_amount("1.250,50") == 1250.5
    assert parse_amount("7.60") == 7.6
    assert parse_amount("1,250.50") == 1250.5
    assert parse_amount(980) == 980.0
    assert parse_amount("7.60–8.00") is None and parse_amount("") is None and parse_amount(None) is None
    assert _like("1000,00", 1030) == "1030,00"
    assert _like("7.60", 7.828) == "7.83"
    assert _like("7,625", 7.85375) == "7,854"
    assert _like(1000.0, 1030.004) == 1030.0


def test_rule_reads_the_contract():
    def c(ix):
        return Contract(current_values={"indexation": ix} if ix is not None else {})
    assert rule(c({"value": "fixed_pct", "rate": 3.0})) == {"method": "fixed_pct", "rate": 3.0, "text": None}
    assert rule(c({"value": "3%", "text": "Üüri tõstetakse igal aastal 3% võrra."}))["rate"] == 3.0
    assert rule(c({"value": "THI", "text": "Üüri korrigeeritakse tarbijahinnaindeksi muutuse võrra, kuid mitte alla 2%"}))["method"] == "cpi"
    assert rule(c(None), ["Esimene üüri tõus 2,5%"]) == {"method": "fixed_pct", "rate": 2.5, "text": None}
    assert rule(c(None))["method"] is None


async def _lease(admin: dict, *, start: date, imported_days_ago: int = 0, rent: str = "1000,00", per_m2: str | None = "10,00",
                 indexation: dict | None = None, ix_dates: list[date] | None = None) -> uuid.UUID:
    from app.domain.contracts import create_contract
    from app.domain.events import Actor
    from app.domain.keydates import add_key_date
    from app.infra.db import tenant_session
    from app.models.contracts import ContractFact

    aid = uuid.UUID(admin["account"]["id"])
    actor = Actor(account_id=aid, user_id=uuid.UUID(admin["user_id"]), role="admin")
    async with tenant_session(aid) as s:
        c = await create_contract(s, actor, type_code="lease", title="Laopind", number="LEP-2024-007", status="active", origin="imported",
                                  category="lease", start_date=start, end_date=start + timedelta(days=5 * 365))
        c.created_at = datetime.now(UTC) - timedelta(days=imported_days_ago)
        values = {}
        facts = {"rent_monthly": {"value": rent, "unit": "EUR", "label": "Üür kuus"},
                 **({"rent_per_m2": {"value": per_m2, "unit": "EUR/m²", "label": "Üür m²"}} if per_m2 else {}),
                 "indexation": indexation or {"value": "3%", "text": "Üüri tõstetakse igal aastal 3% võrra.", "label": "Indekseerimine"}}
        for key, v in facts.items():
            s.add(ContractFact(account_id=aid, contract_id=c.id, key=key, reason="import", valid_from=start, value=v))
            values[key] = v
        c.current_values = values
        for i, due in enumerate(ix_dates or []):
            await add_key_date(s, actor, contract_id=c.id, kind_code="indexation", due_date=due, title="Esimene üüri tõus 3%" if i == 0 else "Üüri tõus 3%",
                               provenance={"recurs_months": 12})
        return c.id


async def test_a_passed_date_means_what_its_kind_says(client: AsyncClient, admin: dict):
    """Start → past (history), notice → lapsed, an indexation before the import → unconfirmed, one after → overdue, a payment
    before the import → past; nothing but an undone task is ever red."""
    from app.domain.events import Actor
    from app.domain.keydates import add_key_date
    from app.infra.db import tenant_session

    today = date.today()
    aid = uuid.UUID(admin["account"]["id"])
    actor = Actor(account_id=aid, user_id=uuid.UUID(admin["user_id"]), role="admin")
    cid = await _lease(admin, start=today - timedelta(days=800), imported_days_ago=60,
                       ix_dates=[today - timedelta(days=435), today - timedelta(days=30), today + timedelta(days=335)])
    async with tenant_session(aid) as s:
        await add_key_date(s, actor, contract_id=cid, kind_code="start", due_date=today - timedelta(days=800))
        await add_key_date(s, actor, contract_id=cid, kind_code="notice", due_date=today - timedelta(days=435))
        await add_key_date(s, actor, contract_id=cid, kind_code="payment", due_date=today - timedelta(days=90))
    detail = (await client.get(f"/api/v1/contracts/{cid}")).json()
    got = sorted((k["kind_code"], k["due_date"], k["status"], k["behaviour"]) for k in detail["key_dates"])
    by = {(k, d): st for k, d, st, _ in got}
    iso = lambda n: (today + timedelta(days=n)).isoformat()  # noqa: E731
    assert by[("start", iso(-800))] == "past"
    assert by[("notice", iso(-435))] == "lapsed"
    assert by[("payment", iso(-90))] == "past"
    assert by[("indexation", iso(-435))] == "unconfirmed"
    assert by[("indexation", iso(-30))] == "overdue"
    assert by[("indexation", iso(335))] == "upcoming"
    cal = (await client.get("/api/v1/key-dates", params={"contract_id": str(cid)})).json()
    assert {k["status"] for k in cal} == {"past", "lapsed", "unconfirmed", "overdue", "upcoming"}
    # only a task can be resolved
    notice = next(k for k in cal if k["kind_code"] == "notice")
    assert (await client.post(f"/api/v1/key-dates/{notice['id']}/resolve", json={"resolution": "done"})).status_code >= 400
    pay = next(k for k in cal if k["kind_code"] == "payment")
    r = await client.post(f"/api/v1/key-dates/{pay['id']}/resolve", json={"resolution": "done"})
    assert r.status_code == 200 and r.json()["status"] == "done" and r.json()["resolved_at"]
    r = await client.post(f"/api/v1/key-dates/{pay['id']}/reopen")
    assert r.json()["status"] == "past" and r.json()["resolution"] is None
    # home: the open indexations are one row for the contract
    att = (await client.get("/api/v1/portfolio/attention")).json()
    rows = att["rows"] if isinstance(att, dict) else att
    ix_rows = [r for r in rows if r.get("step") == "indexation"]
    assert len(ix_rows) == 1 and ix_rows[0]["tone"] == "red" and "2 indekseerimist" in ix_rows[0]["text"]


async def test_indexation_chain_writes_rent_versions_and_undoes(client: AsyncClient, admin: dict):
    today = date.today()
    d1, d2 = today - timedelta(days=400), today - timedelta(days=35)
    cid = await _lease(admin, start=today - timedelta(days=765), ix_dates=[d1, d2, today + timedelta(days=330)])
    p = (await client.get(f"/api/v1/contracts/{cid}/indexation")).json()
    assert p["rule"]["method"] == "fixed_pct" and p["rule"]["rate"] == 3.0
    assert p["rent"]["key"] == "rent_monthly" and p["rent"]["value"] == 1000.0
    assert [s["proposed"] for s in p["steps"]] == [1030.0, 1060.9]  # compounding; the future one is not asked yet
    s1, s2 = p["steps"]
    # first applied as proposed, second skipped
    r = await client.post(f"/api/v1/contracts/{cid}/indexation", json={"steps": [{"key_date_id": s2["key_date_id"], "applied": False},
                                                                                {"key_date_id": s1["key_date_id"], "applied": True}]})
    assert r.status_code == 200, r.text
    assert r.json()["steps"] == [] and r.json()["rent"]["value"] == 1030.0
    detail = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert detail["current_values"]["rent_monthly"]["value"] == "1030,00"
    assert detail["current_values"]["rent_per_m2"]["value"] == "10,30"  # follows by the same factor
    rent_versions = sorted((f for f in detail["facts"] if f["key"] == "rent_monthly"), key=lambda f: f["recorded_at"])
    assert [(f["value"], f["reason"], f["valid_from"], f["valid_to"]) for f in rent_versions] == [
        ("1000,00", "import", (today - timedelta(days=765)).isoformat(), d1.isoformat()), ("1030,00", "indexation", d1.isoformat(), None)]
    st = {k["due_date"]: (k["status"], k["resolution_data"]) for k in detail["key_dates"]}
    assert st[d1.isoformat()][0] == "done" and st[d1.isoformat()][1]["rent"]["new"] == 1030.0
    assert st[d2.isoformat()] == ("skipped", None)
    # resolving it again is refused
    again = await client.post(f"/api/v1/contracts/{cid}/indexation", json={"steps": [{"key_date_id": s1["key_date_id"], "applied": True}]})
    assert again.status_code >= 400
    # undo the first: the rent goes back
    r = await client.post(f"/api/v1/key-dates/{s1['key_date_id']}/reopen")
    assert r.status_code == 200 and r.json()["status"] == "unconfirmed"  # imported today: before the import
    detail = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert detail["current_values"]["rent_monthly"]["value"] == "1000,00" and detail["current_values"]["rent_per_m2"]["value"] == "10,00"
    assert [f["valid_to"] for f in detail["facts"] if f["key"] == "rent_monthly"] == [None]
    # an amount of my own (rounded by the landlord) on the reopened one, then the skipped one reopened and applied with CPI-style %
    r = await client.post(f"/api/v1/contracts/{cid}/indexation", json={"steps": [{"key_date_id": s1["key_date_id"], "applied": True, "amount": 1025}]})
    assert r.json()["rent"]["value"] == 1025.0
    await client.post(f"/api/v1/key-dates/{s2['key_date_id']}/reopen")
    r = await client.post(f"/api/v1/contracts/{cid}/indexation", json={"steps": [{"key_date_id": s2["key_date_id"], "applied": True, "pct": 4}]})
    assert r.json()["rent"]["value"] == 1066.0
    # the earlier one cannot be undone while the later version stands
    assert (await client.post(f"/api/v1/key-dates/{s1['key_date_id']}/reopen")).status_code >= 400


async def test_only_the_current_rent(client: AsyncClient, admin: dict):
    """„Tean ainult praegust üüri”: every due indexation is done, one version from the latest of them."""
    today = date.today()
    d1, d2 = today - timedelta(days=400), today - timedelta(days=35)
    cid = await _lease(admin, start=today - timedelta(days=765), per_m2=None, ix_dates=[d1, d2])
    r = await client.post(f"/api/v1/contracts/{cid}/indexation", json={"current_rent": 1060})
    assert r.status_code == 200, r.text
    assert r.json()["steps"] == [] and r.json()["rent"]["value"] == 1060.0 and r.json()["rent"]["valid_from"] == d2.isoformat()
    detail = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert {k["status"] for k in detail["key_dates"]} == {"done"}
    assert sorted((f["value"], f["valid_from"]) for f in detail["facts"] if f["key"] == "rent_monthly")[-1] == ("1060,00", d2.isoformat())
    carrier = next(k for k in detail["key_dates"] if k["due_date"] == d2.isoformat())
    assert carrier["resolution_data"]["fact_ids"]
    await client.post(f"/api/v1/key-dates/{carrier['id']}/reopen")
    detail = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert detail["current_values"]["rent_monthly"]["value"] == "1000,00"


async def test_a_cpi_rule_needs_the_percentage(client: AsyncClient, admin: dict):
    today = date.today()
    cid = await _lease(admin, start=today - timedelta(days=400), indexation={"value": "THI", "text": "tarbijahinnaindeksi muutuse võrra"},
                       ix_dates=[today - timedelta(days=35)])
    p = (await client.get(f"/api/v1/contracts/{cid}/indexation")).json()
    assert p["rule"]["method"] == "cpi" and p["steps"][0]["proposed"] is None
    kid = p["steps"][0]["key_date_id"]
    r = await client.post(f"/api/v1/contracts/{cid}/indexation", json={"steps": [{"key_date_id": kid, "applied": True}]})
    assert r.status_code >= 400 and "protsent" in r.json()["detail"]
    r = await client.post(f"/api/v1/contracts/{cid}/indexation", json={"steps": [{"key_date_id": kid, "applied": True, "pct": 5.2}]})
    assert r.json()["rent"]["value"] == 1052.0


async def test_series_titles_drop_esimene(client: AsyncClient, admin: dict):
    from app.domain.keydates import series_title

    assert series_title("Esimene üüri tõus 3%") == "Üüri tõus 3%"
    assert series_title("Indekseerimine") == "Indekseerimine"
    assert series_title("Esimene") == "Esimene"
