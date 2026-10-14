"""Phase 3.3 — AI foundation: threads, a tool-using turn offline, validated citations, confirmation cards, budget, feedback, SSE."""

from __future__ import annotations

from httpx import AsyncClient

from app.agent.providers.base import StreamEvent
from app.agent.providers.fake import script_turns
from tests.test_leases import _accepted_quote


async def test_tool_turn_and_confirmation_card(client: AsyncClient, admin: dict):
    ctx, q = await _accepted_quote(client, ["Pind 12"])
    script_turns()  # rule-based fake: search → answer
    r = await client.post("/api/v1/agent/threads", json={"origin_path": "/app"})
    assert r.status_code == 201, r.text
    tid = r.json()["id"]
    r = await client.post(f"/api/v1/agent/threads/{tid}/messages", params={"stream": "false"}, json={"text": "Future Invest"})
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["role"] == "assistant" and m["status"] == "done" and m["steps"][0]["tool"] == "search_portfolio" and "Leidsin" in m["text"]
    assert m["cards"] and m["cards"][0]["type"] == "links"
    th = (await client.get(f"/api/v1/agent/threads/{tid}")).json()
    assert [x["role"] for x in th["messages"]] == ["user", "assistant"] and th["title"] == "Future Invest"
    assert (await client.get("/api/v1/agent/threads")).json()[0]["id"] == tid
    # a scripted turn: the model asks for a quote draft → confirmation card (nothing is created yet)
    script_turns(
        [StreamEvent(type="tool_call", id="t1", name="create_quote_draft", input={"party": "Future Invest", "property": "Hoone T6B", "spaces": ["Pind 4"]}),
         StreamEvent(type="done", stop_reason="tool_use", usage={"input_tokens": 30, "output_tokens": 10}, model="fake-scripted")],
        "Valmistasin ette pakkumise mustandi — kinnita kaardil.",
    )
    m = (await client.post(f"/api/v1/agent/threads/{tid}/messages", params={"stream": "false"}, json={"text": "Loo pakkumine Future Investile, T6B pind 4"})).json()
    card = next(c for c in m["cards"] if c["type"] == "confirm")
    assert card["action"] == "create_quote" and card["requires_confirmation"] is True and "Pind 4" in card["text"]
    before = len((await client.get("/api/v1/quotes", params={"view": "all"})).json())
    r = await client.post(f"/api/v1/agent/threads/{tid}/messages/{m['id']}/cards/{card['id']}/confirm")
    assert r.status_code == 200, r.text
    assert r.json()["action"] == "create_quote" and r.json()["link"].startswith("/app/portfell/pakkumine/")
    assert len((await client.get("/api/v1/quotes", params={"view": "all"})).json()) == before + 1
    # the agent's events are attributed as agent-on-behalf-of; the quote creation is the human's
    ev = (await client.get("/api/v1/audit", params={"actor_type": "agent"})).json()
    assert any(e["action"] == "agent.answered" for e in ev)
    # confirming twice is idempotent
    assert (await client.post(f"/api/v1/agent/threads/{tid}/messages/{m['id']}/cards/{card['id']}/confirm")).json()["link"] == r.json()["link"]
    # feedback + usage
    assert (await client.post("/api/v1/agent/feedback", json={"message_id": m["id"], "kind": "special_term", "fate": "edited", "draft_text": "a", "final_text": "b"})).status_code == 201
    u = (await client.get("/api/v1/agent/usage")).json()
    assert u["runs"] >= 2 and u["total_tokens"] > 0 and u["exhausted"] is False
    # delete + restore
    assert (await client.delete(f"/api/v1/agent/threads/{tid}")).status_code == 204
    assert (await client.get("/api/v1/agent/threads")).json() == []
    assert (await client.post(f"/api/v1/agent/threads/{tid}/restore")).status_code == 200


async def test_contract_context_citations_and_clarify(client: AsyncClient, admin: dict):
    ctx, q = await _accepted_quote(client, ["Pind 12"])
    d = (await client.post(f"/api/v1/leases/from-quote/{q['id']}", json={})).json()[0]
    rent = next(c for c in d["clauses"] if c["fact_key"] == "rent")
    other = next(c for c in d["clauses"] if c["container"] == "general" and c["level"] > 0)
    r = await client.post("/api/v1/agent/threads", json={"context_type": "contract", "context_id": d["id"], "origin_path": f"/app/portfell/leping/{d['id']}"})
    assert r.status_code == 201 and r.json()["context_label"] == d["number"]
    tid = r.json()["id"]
    # a valid citation survives; a hallucinated one is stripped and logged as a step
    script_turns(f"Üür on kokku lepitud punktis [§{rent['number']}|{rent['id']}] ja üldtingimuste [§{other['number']}|{other['id']}]; vt ka [§9.9|00000000-0000-0000-0000-000000000000].")
    m = (await client.post(f"/api/v1/agent/threads/{tid}/messages", params={"stream": "false"}, json={"text": "Kus on üür kokku lepitud?"})).json()
    assert m["steps"][0]["tool"] == "load_contract" and m["steps"][0].get("auto") is True
    assert [c["clause_id"] for c in m["citations"]] == [rent["id"], other["id"]]
    assert "§9.9" in m["text"] and "00000000" not in m["text"]
    assert any(s["tool"] == "citations" for s in m["steps"])
    # clarification: ambiguous spaces → clarify card, no confirm card
    script_turns(
        [StreamEvent(type="tool_call", id="t1", name="create_quote_draft", input={"party": "Future Invest", "property": "Hoone T6B", "spaces": ["Pind"]}),
         StreamEvent(type="done", stop_reason="tool_use", usage={"input_tokens": 3, "output_tokens": 3}, model="fake")],
        "Millist pinda mõtlesid?",
    )
    m = (await client.post(f"/api/v1/agent/threads/{tid}/messages", params={"stream": "false"}, json={"text": "Loo pakkumine"})).json()
    assert any(c["type"] == "clarify" for c in m["cards"]) and not any(c["type"] == "confirm" for c in m["cards"])
    # draft card text from the SÕNASTUS line
    script_turns(
        [StreamEvent(type="tool_call", id="t2", name="draft_special_term", input={"document": d["number"], "wish": "üürnik võib paigaldada sildi", "clause": other["number"]}),
         StreamEvent(type="done", stop_reason="tool_use", usage={}, model="fake")],
        "Siin on sõnastus.\nSÕNASTUS: Üürnikul on õigus paigaldada hoone fassaadile oma silt Üürileandja eelneval kirjalikul nõusolekul.",
    )
    m = (await client.post(f"/api/v1/agent/threads/{tid}/messages", params={"stream": "false"}, json={"text": "Sõnasta eritingimus sildi kohta"})).json()
    card = next(c for c in m["cards"] if c["type"] == "draft")
    assert card["kind"] == "special_term" and card["text"].startswith("Üürnikul on õigus") and card["document"]["clause_id"] == other["id"]
    assert "SÕNASTUS" not in m["text"]


async def test_sse_stream_and_budget(client: AsyncClient, admin: dict):
    await _accepted_quote(client, ["Pind 12"])
    tid = (await client.post("/api/v1/agent/threads", json={})).json()["id"]
    script_turns("Tere! ")
    async with client.stream("POST", f"/api/v1/agent/threads/{tid}/messages", json={"text": "Tere"}) as r:
        assert r.status_code == 200 and r.headers["content-type"].startswith("text/event-stream")
        body = (await r.aread()).decode()
    assert "event: delta" in body and "event: done" in body and '"status": "done"' in body
    # budget: a tiny budget → graceful degradation
    r = await client.patch("/api/v1/account", json={"settings": {"ai": {"monthly_token_budget": 1}}})
    assert r.status_code == 200, r.text
    script_turns("ei tohiks jõuda siia")
    m = (await client.post(f"/api/v1/agent/threads/{tid}/messages", params={"stream": "false"}, json={"text": "Veel"})).json()
    assert m["status"] == "budget" and "eelarve" in m["text"]
