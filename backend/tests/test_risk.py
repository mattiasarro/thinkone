"""Phase 3.3 — risk report: open-data scoring (fake source), ordering, history, agent card."""

from __future__ import annotations

from httpx import AsyncClient

from app.agent.providers.base import StreamEvent
from app.agent.providers.fake import script_turns
from app.domain.risk import score
from app.integrations.risk import RiskData


def test_scoring_rules():
    good = RiskData(registry_code="1", status="Registrisse kantud", registered_on="2015-01-01", debt=None,
                    quarters=[{"year": 2025 + i // 4, "q": i % 4 + 1, "turnover": 100000.0} for i in range(8)], as_of={"debt": "2026-10-13"})
    level, pts, sig = score(good, monthly_rent=1000)
    assert level == "MADAL" and pts == 0 and {s["source"] for s in sig} == {"Äriregister", "EMTA · maksuvõlg", "EMTA · käive", "Üür vs käive"}
    bad = RiskData(registry_code="2", status="Kustutatud", debt={"amount": 5000, "scheduled": 0})
    level, pts, _ = score(bad)
    assert level == "KÕRGE" and pts == 6
    young = RiskData(registry_code="3", status="Registrisse kantud", registered_on="2026-01-01", debt={"amount": 500, "scheduled": 500},
                     quarters=[{"year": 2025 + i // 4, "q": i % 4 + 1, "turnover": 100000.0} for i in range(8)])
    level, pts, sig = score(young, monthly_rent=1000)
    assert level == "KESKMINE" and pts == 2 and any("tasumisgraafikus" in s["text"] for s in sig) and any("aastakäibest" in s["text"] and s["level"] == "MADAL" for s in sig)


async def test_order_and_history(client: AsyncClient, admin: dict):
    r = await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "Võlglane OÜ", "registry_code": "12345679", "roles": ["tenant"]})
    pid = r.json()["id"]
    assert (await client.get(f"/api/v1/parties/{pid}/risk")).json() == []
    r = await client.post(f"/api/v1/parties/{pid}/risk")
    assert r.status_code == 201, r.text
    rep = r.json()
    assert rep["status"] == "ready" and rep["score"] == "KÕRGE" and any(s["source"] == "EMTA · maksuvõlg" and s["level"] == "KÕRGE" for s in rep["signals"])
    assert "Krediidiinfo" in rep["sources"]["unavailable"] and rep["summary"].startswith("KÕRGE")
    hist = (await client.get(f"/api/v1/parties/{pid}/risk")).json()
    assert len(hist) == 1 and (await client.get(f"/api/v1/parties/{pid}/risk/{rep['id']}")).json()["id"] == rep["id"]
    # a person has no report
    r = await client.post("/api/v1/parties", json={"kind": "person", "name": "Kati", "personal_code": "1", "roles": ["employee"]})
    assert (await client.post(f"/api/v1/parties/{r.json()['id']}/risk")).status_code == 400
    ev = (await client.get("/api/v1/audit", params={"entity_type": "party", "entity_id": pid})).json()
    assert {e["action"] for e in ev} >= {"risk_report.ordered", "risk_report.generated"}
    # agent: the tool reads the latest and offers a card; confirming orders a new one
    tid = (await client.post("/api/v1/agent/threads", json={})).json()["id"]
    script_turns([StreamEvent(type="tool_call", id="t1", name="order_risk_report", input={"party": "Võlglane"}), StreamEvent(type="done", stop_reason="tool_use", usage={}, model="fake")],
                 "Viimane raport on KÕRGE; uue tellimiseks kinnita kaardil.")
    m = (await client.post(f"/api/v1/agent/threads/{tid}/messages", params={"stream": "false"}, json={"text": "Telli riskiraport Võlglane OÜ kohta"})).json()
    card = next(c for c in m["cards"] if c["type"] == "confirm")
    assert card["action"] == "order_risk_report"
    r = await client.post(f"/api/v1/agent/threads/{tid}/messages/{m['id']}/cards/{card['id']}/confirm")
    assert r.status_code == 200 and len((await client.get(f"/api/v1/parties/{pid}/risk")).json()) == 2
