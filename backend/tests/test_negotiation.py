"""Phase 3 milestone 3.2 — negotiation: send V1 → client threads → one letter per round → „Kuidas lahendame?” → confirmation → all accepted."""

from __future__ import annotations

from httpx import AsyncClient

from tests.test_leases import _accepted_quote


async def _draft(client: AsyncClient) -> tuple[dict, dict]:
    ctx, q = await _accepted_quote(client, ["Pind 12"])
    d = (await client.post(f"/api/v1/leases/from-quote/{q['id']}", json={})).json()[0]
    return ctx, d


def _token(neg: dict) -> str:
    return neg["link"]["url"].rsplit("/portal/", 1)[1]


async def test_full_negotiation_loop(client: AsyncClient, admin: dict):
    ctx, d = await _draft(client)
    cid = d["id"]
    neg = (await client.get(f"/api/v1/leases/{cid}/negotiation")).json()
    assert neg["next_step"]["code"] == "send" and neg["turn"] == "operator" and neg["versions"] == []
    # operator comments a clause while drafting (own remark, unsent)
    rent = next(c for c in d["clauses"] if c["fact_key"] == "rent")
    r = await client.post(f"/api/v1/leases/{cid}/threads", json={"clause_id": rent["id"], "text": "Hind on kokku lepitud pakkumises."})
    assert r.status_code == 201 and r.json()["threads"][0]["unsent"] is True
    # send V1
    r = await client.post(f"/api/v1/leases/{cid}/send", json={"message": "Palun vaadake mustand üle."})
    assert r.status_code == 200, r.text
    neg = r.json()
    assert neg["turn"] == "client" and neg["versions"][0]["number"] == 1 and neg["versions"][0]["pdf_url"] and neg["link"]["email"] == "mari@example.com"
    assert neg["letters"][-1]["kind"] == "contract.sent" and neg["next_step"]["code"] == "waiting" and neg["rounds"] == [] or neg["rounds"][0]["nr"] == 1
    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert c["status"] == "sent"
    # operator cannot edit while it is the client's turn
    assert (await client.patch(f"/api/v1/leases/{cid}/terms", json={"months": 12})).status_code == 400
    assert (await client.post(f"/api/v1/leases/{cid}/round", json={})).status_code == 400
    token = _token(neg)
    anon = AsyncClient(transport=client._transport, base_url="http://test")

    # ---- client: sees the draft, opens two threads, sends one letter
    p = (await anon.get(f"/api/v1/portal/{token}")).json()
    # the operator's drafting remark went out with V1: visible, open, waiting for the client
    assert p["number"] == d["number"] and p["turn"] == "client" and p["can_comment"] and p["can_accept"] is False and [t["opened_by"] for t in p["threads"]] == ["operator"]
    r = await anon.post(f"/api/v1/portal/{token}/lease/threads/{p['threads'][0]['id']}/ok")  # „Sobib” closes it
    assert r.status_code == 200 and r.json()["threads"][0]["resolution_label"] == "Selgitatud" and r.json()["can_accept"] is True
    assert any(c["fact_key"] == "rent" for c in p["clauses"]) and "Põhitingimused" in (await anon.get(p["document_url"])).text  # the advertised URL must resolve
    purpose = next(c for c in p["clauses"] if c["fact_key"] == "purpose")
    deposit = next(c for c in p["clauses"] if c["fact_key"] == "deposit_months")
    r = await anon.post(f"/api/v1/portal/{token}/lease/threads", json={"clause_id": purpose["id"], "text": "Kas võime kasutada ka müügisaalina?"})
    assert r.status_code == 201, r.text
    r = await anon.post(f"/api/v1/portal/{token}/lease/threads", json={"clause_id": deposit["id"], "text": "", "wish": {"fact_key": "deposit_months", "value": 2, "label": "Tagatis (kuud)"}})
    assert r.status_code == 201, r.text
    p = r.json()
    assert len(p["threads"]) == 3 and p["unsent_count"] == 2 and p["can_send"] is True and p["can_accept"] is False
    assert "Soovin muuta" in p["threads"][2]["messages"][0]["body"]
    # the operator does not see unsent client threads yet
    neg = (await client.get(f"/api/v1/leases/{cid}/negotiation")).json()
    assert [t["opened_by"] for t in neg["threads"]] == ["operator"]
    r = await anon.post(f"/api/v1/portal/{token}/lease/send", json={"body": "Kaks küsimust."})
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["turn"] == "landlord" if False else p["turn"] == "operator" and p["can_comment"] is False and p["rounds"][-1]["side"] == "client"
    assert (await anon.post(f"/api/v1/portal/{token}/lease/threads", json={"clause_id": purpose["id"], "text": "veel"})).status_code == 400  # not the client's turn
    # operators were notified; contract is negotiating; next step = answer 2
    assert any(n["kind"] == "contract.client_round" for n in (await client.get("/api/v1/notifications")).json())
    neg = (await client.get(f"/api/v1/leases/{cid}/negotiation")).json()
    assert neg["turn"] == "operator" and neg["pending_count"] == 2 and neg["next_step"]["code"] == "answer" and neg["can_send"] is False
    assert (await client.get(f"/api/v1/contracts/{cid}")).json()["status"] == "negotiating"
    th = {t["clause_number"]: t for t in neg["threads"] if t["opened_by"] == "client"}
    # „Kuidas lahendame?”: explain the purpose question; propose a fact change for the deposit
    r = await client.post(f"/api/v1/leases/{cid}/threads/{th['2.4']['id']}/explain", json={"text": "Jah, müügisaal on lubatud — see on hõlmatud üldtingimustega."})
    assert r.status_code == 200 and next(t for t in r.json()["threads"] if t["id"] == th["2.4"]["id"])["resolution"] == "explained"
    r = await client.post(f"/api/v1/leases/{cid}/threads/{th['4.1']['id']}/propose", json={"kind": "fact", "fact_key": "deposit_months", "value": 2, "text": "Sobib, tagatis 2 kuud."})
    assert r.status_code == 200, r.text
    neg = r.json()
    t41 = next(t for t in neg["threads"] if t["id"] == th["4.1"]["id"])
    assert t41["status"] == "awaiting_confirmation" and t41["whose_turn"] == "client" and neg["pending_count"] == 0 and neg["can_send"] is True
    # the deal did not change yet (the client confirms first)
    assert (await client.get(f"/api/v1/leases/{cid}")).json()["deal"]["deposit_months"] == 3
    # send answers → round 3, turn back to the client; no new version (nothing changed in the document)
    r = await client.post(f"/api/v1/leases/{cid}/round", json={"body": "Vastused sees."})
    assert r.status_code == 200, r.text
    neg = r.json()
    assert neg["turn"] == "client" and neg["rounds"][-1]["nr"] == 3 and neg["rounds"][-1]["side"] == "operator" and len(neg["versions"]) == 1
    assert neg["letters"][-1]["kind"] == "contract.round"
    # ---- client confirms the deposit proposal → facts + clause text change; „Sobib” closes the explanation
    p = (await anon.get(f"/api/v1/portal/{token}")).json()
    assert p["turn"] == "client" and p["pending_count"] == 1 and p["can_accept"] is False
    pt = {t["clause_number"]: t for t in p["threads"]}
    assert pt["2.4"]["resolution_label"] == "Selgitatud" and pt["4.1"]["status"] == "awaiting_confirmation" and pt["3.1"]["resolution_label"] == "Selgitatud"
    r = await anon.post(f"/api/v1/portal/{token}/lease/threads/{pt['4.1']['id']}/decide", json={"accept": True})
    assert r.status_code == 200, r.text
    p = r.json()
    assert next(t for t in p["threads"] if t["clause_number"] == "4.1")["resolution_label"] == "Muudetud"
    assert "2 kuu Üüri" in next(c for c in p["clauses"] if c["fact_key"] == "deposit_months")["text"] and p["deposit"] == round(1216.0 * 2, 2)
    assert p["open_count"] == 0 and p["can_accept"] is True
    facts = {f["key"]: f["value"] for f in (await client.get(f"/api/v1/contracts/{cid}")).json()["facts"]}
    assert facts["deposit_months"] == 2 and facts["deposit"] == 2432.0
    # the operator's „Muudatused since V1” shows the wording change
    neg = (await client.get(f"/api/v1/leases/{cid}/negotiation")).json()
    assert any(ch["kind"] == "wording" and "4.1" in ch["label"] for ch in neg["changes_since_v1"])
    # ---- client accepts everything → ready_to_sign; operators notified; link still readable
    r = await anon.post(f"/api/v1/portal/{token}/lease/accept")
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "ready_to_sign" and r.json()["step_title"] == "Kõik punktid on aktsepteeritud"
    c = (await client.get(f"/api/v1/contracts/{cid}")).json()
    assert c["status"] == "ready_to_sign"
    assert any(n["kind"] == "contract.accepted" for n in (await client.get("/api/v1/notifications")).json())
    neg = (await client.get(f"/api/v1/leases/{cid}/negotiation")).json()
    assert neg["next_step"]["code"] == "sign"
    # chat both ways
    assert (await anon.post(f"/api/v1/portal/{token}/lease/messages", json={"text": "Millal allkirjastame?"})).status_code == 201
    r = await client.post(f"/api/v1/leases/{cid}/chat", json={"body": "Järgmisel nädalal."})
    assert r.status_code == 201 and [m["author_type"] for m in r.json()] == ["client", "operator"]
    th_list = (await client.get("/api/v1/messages/threads")).json()
    assert any(t["subject_type"] == "contract" and t["link"] == f"/app/portfell/leping/{cid}" for t in th_list)
    await anon.aclose()


async def test_wording_and_special_term_proposals_and_guards(client: AsyncClient, admin: dict):
    ctx, d = await _draft(client)
    cid = d["id"]
    neg = (await client.post(f"/api/v1/leases/{cid}/send", json={})).json()
    token = _token(neg)
    anon = AsyncClient(transport=client._transport, base_url="http://test")
    p = (await anon.get(f"/api/v1/portal/{token}")).json()
    general = next(c for c in p["clauses"] if c["container"] == "general" and c["level"] > 0)
    purpose = next(c for c in p["clauses"] if c["fact_key"] == "purpose")
    await anon.post(f"/api/v1/portal/{token}/lease/threads", json={"clause_id": general["id"], "text": "See punkt ei sobi meile."})
    await anon.post(f"/api/v1/portal/{token}/lease/threads", json={"clause_id": purpose["id"], "text": "Palun sõnastage laiemalt."})
    # client cannot send while a thread awaits nothing? (it can — all are own remarks); cannot accept with open threads
    assert (await anon.post(f"/api/v1/portal/{token}/lease/accept")).status_code == 400
    await anon.post(f"/api/v1/portal/{token}/lease/send", json={})
    neg = (await client.get(f"/api/v1/leases/{cid}/negotiation")).json()
    th = {t["clause_id"]: t for t in neg["threads"]}
    # a locked general clause cannot be re-worded → it goes to Lisa 3 as a proposed special term
    r = await client.post(f"/api/v1/leases/{cid}/threads/{th[general['id']]['id']}/propose", json={"kind": "wording", "wording": "x"})
    assert r.status_code == 400
    r = await client.post(f"/api/v1/leases/{cid}/threads/{th[general['id']]['id']}/propose",
                          json={"kind": "special_term", "special_text": "Erandina üldtingimuste punktist kehtib poolte vahel kokkulepe X.", "text": "Lisame erandi Lisa 3-sse."})
    assert r.status_code == 200, r.text
    sp = [c for c in (await client.get(f"/api/v1/leases/{cid}")).json()["clauses"] if c["container"] == "annex:3"]
    assert sp[-1]["status"] == "proposed" and sp[-1]["overrides_clause_id"] == general["id"]
    # wording proposal on the main clause
    r = await client.post(f"/api/v1/leases/{cid}/threads/{th[purpose['id']]['id']}/propose", json={"kind": "wording", "wording": "Üüripinda võib kasutada büroo-, lao-, tootmis- ja müügipinnana."})
    assert r.status_code == 200, r.text
    # operator cannot send before…? both answered → can send
    neg = (await client.post(f"/api/v1/leases/{cid}/round", json={})).json()
    assert neg["turn"] == "client"
    p = (await anon.get(f"/api/v1/portal/{token}")).json()
    assert p["pending_count"] == 2 and p["can_send"] is False
    pt = {t["clause_id"]: t for t in p["threads"]}
    # the proposed special clause is visible to the client while pending
    assert any(c["container"] == "annex:3" for c in p["clauses"])
    # client declines the special term (the proposed clause disappears) and accepts the wording
    r = await anon.post(f"/api/v1/portal/{token}/lease/threads/{pt[general['id']]['id']}/decide", json={"accept": False, "text": "Pigem jätame nii, nagu on."})
    assert r.status_code == 200 and next(t for t in r.json()["threads"] if t["clause_id"] == general["id"])["status"] == "open"
    assert not [c for c in r.json()["clauses"] if c["container"] == "annex:3"]
    r = await anon.post(f"/api/v1/portal/{token}/lease/threads/{pt[purpose['id']]['id']}/decide", json={"accept": True})
    assert "müügipinnana" in next(c for c in r.json()["clauses"] if c["fact_key"] == "purpose")["text"]
    p = (await anon.post(f"/api/v1/portal/{token}/lease/send", json={"body": "Üks jääb lahtiseks."})).json()
    assert p["turn"] == "operator"
    # operator closes the remaining thread as „Jääb samaks”, returns the turn; the client accepts all → ready_to_sign
    neg = (await client.get(f"/api/v1/leases/{cid}/negotiation")).json()
    open_t = next(t for t in neg["threads"] if t["status"] != "resolved")
    neg = (await client.post(f"/api/v1/leases/{cid}/threads/{open_t['id']}/unchanged")).json()
    assert next(t for t in neg["threads"] if t["id"] == open_t["id"])["resolution_label"] == "Jääb samaks"
    neg = (await client.post(f"/api/v1/leases/{cid}/round", json={})).json()
    assert len(neg["versions"]) == 2  # the wording change made a new frozen version
    assert any(ch["kind"] == "wording" for ch in neg["versions"][1]["changes"])
    r = await anon.post(f"/api/v1/portal/{token}/lease/accept")
    assert r.status_code == 200 and r.json()["status"] == "ready_to_sign"
    # cancel frees the space
    r = await client.post(f"/api/v1/leases/{cid}/cancel", json={"body": "Klient loobus"})
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert (await anon.get(f"/api/v1/portal/{token}")).status_code == 404
    assert (await client.get(f"/api/v1/assets/{ctx['spaces']['Pind 12']['id']}")).json()["status"] == "vaba"
    await anon.aclose()


async def test_attention_queue_and_clause_search(client: AsyncClient, admin: dict):
    ctx, d = await _draft(client)
    att = (await client.get("/api/v1/portfolio/attention")).json()
    assert any(r["kind"] == "contract" and r["step"] == "send" and r["link"] == f"/app/portfell/leping/{d['id']}" for r in att["rows"])
    # the omnibox finds platform clause wording
    hits = (await client.get("/api/v1/search", params={"q": "Üleandmispäev"})).json()
    assert any(h["entity_type"] == "contract" and h["entity_id"] == d["id"] for h in hits)
    neg = (await client.post(f"/api/v1/leases/{d['id']}/send", json={})).json()
    att = (await client.get("/api/v1/portfolio/attention")).json()
    assert not any(r["kind"] == "contract" for r in att["rows"])  # the client's turn → not the operator's step
    token = _token(neg)
    anon = AsyncClient(transport=client._transport, base_url="http://test")
    p = (await anon.get(f"/api/v1/portal/{token}")).json()
    await anon.post(f"/api/v1/portal/{token}/lease/threads", json={"clause_id": next(c for c in p["clauses"] if c["fact_key"] == "rent")["id"], "text": "Liiga kallis."})
    await anon.post(f"/api/v1/portal/{token}/lease/send", json={})
    att = (await client.get("/api/v1/portfolio/attention")).json()
    assert any(r["kind"] == "contract" and r["step"] == "answer" and r["tone"] == "red" for r in att["rows"])
    await anon.aclose()
