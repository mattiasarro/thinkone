"""Phase 3 milestone 3.1 — the quote loop: draft → send (V1, share link, letter) → client proposal → resend → accept; expiry, reminders, bounces, RLS."""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from httpx import AsyncClient
from sqlalchemy import select, text

from app.domain import quotes as quotes_domain
from app.domain.events import Actor
from app.infra.db import tenant_session
from tests.helpers import make_company, make_property

CSV = ("nimi;tüüp;üüripind;ladu;kontor;olmeala;hind;elekter;parkimiskohad\n"
       "Pind 12;büroo;128;;118;10;9.5;25;12\n"
       "Pind 8;tootmine;410;370;30;10;6.9;63;9, 10, 11\n"
       "Pind 4;büroo;96;;86;10;9;25;4, 5\n")


async def _setup(client: AsyncClient) -> dict:
    co = await make_company(client)
    prop = await make_property(client, co["id"], name="Hoone T6B")
    await client.patch(f"/api/v1/assets/{prop['id']}", json={"attributes": {**prop["attributes"], "vat_taxable": True, "utility_cost_winter": 2.1, "utility_cost_summer": 1.4}})
    r = await client.post(f"/api/v1/assets/{prop['id']}/spaces/import", params={"dry_run": "false"}, json={"text": CSV})
    assert r.status_code == 200, r.text
    spaces = {s["name"]: s for s in (await client.get("/api/v1/assets", params={"type_code": "space", "parent_id": prop["id"]})).json()}
    r = await client.post("/api/v1/parties", json={"kind": "ee_company", "name": "Future Invest OÜ", "registry_code": "12345678", "contact_name": "Mari Maasikas",
                                                   "email": "mari@example.com", "phone": "+372 5555 555", "roles": ["tenant"]})
    assert r.status_code == 201, r.text
    return {"company": co, "property": prop, "spaces": spaces, "party": r.json()}


async def _create(client: AsyncClient, ctx: dict, names: list[str], **extra) -> dict:
    r = await client.post("/api/v1/quotes", json={"party_id": ctx["party"]["id"], "property_id": ctx["property"]["id"],
                                                 "space_ids": [ctx["spaces"][n]["id"] for n in names], **extra})
    assert r.status_code == 201, r.text
    return r.json()


async def _token_of(client: AsyncClient, quote_id: str) -> str:
    q = (await client.get(f"/api/v1/quotes/{quote_id}")).json()
    assert q["link"], "no live link"
    return q["link"]["url"].rsplit("/portal/", 1)[1]


async def test_create_draft_defaults(client: AsyncClient, admin: dict):
    ctx = await _setup(client)
    q = await _create(client, ctx, ["Pind 12", "Pind 8"])
    assert q["number"] == f"PAK-{date.today().year}-001" and q["status"] == "draft" and q["editable"] is True
    assert q["contact"] == {"name": "Mari Maasikas", "email": "mari@example.com", "phone": "+372 5555 555"}
    assert q["period_months"] == 60 and q["valid_until"] == (date.today() + timedelta(days=14)).isoformat()
    by = {s["name"]: s for s in q["spaces"]}
    assert by["Pind 12"]["price_per_m2"] == 9.5 and by["Pind 12"]["line"]["monthly_net"] == 1216.0
    assert by["Pind 12"]["parking"]["mode"] == "register" and [p["number"] for p in by["Pind 12"]["parking"]["spots"]] == ["12"]
    assert [p["number"] for p in by["Pind 8"]["parking"]["spots"]] == ["9", "10", "11"]
    assert q["totals"]["monthly_net"] == 1216.0 + 2829.0 and q["totals"]["vat_taxable"] is True and q["totals"]["vat"] == round(4045.0 * 0.24, 2)
    assert q["totals"]["utility_winter"] == round(538 * 2.1, 2)
    assert "Mari Maasikas" in q["commercial_text"] and "Pind 12, Pind 8" in q["commercial_text"]
    assert [a["number"] for a in q["attachments"]] == []  # no plans uploaded yet
    assert q["next_step"]["code"] == "send" and q["next_step"]["side"] == "operator"
    # the spaces now read „pakkumisel”
    sp = (await client.get(f"/api/v1/assets/{ctx['spaces']['Pind 12']['id']}")).json()
    assert sp["status"] == "pakkumisel"
    assert (await client.get(f"/api/v1/assets/{ctx['spaces']['Pind 4']['id']}")).json()["status"] == "vaba"
    # second quote numbers sequentially; omnibox finds it
    q2 = await _create(client, ctx, ["Pind 4"])
    assert q2["number"].endswith("-002")
    hits = (await client.get("/api/v1/search", params={"q": q2["number"]})).json()
    assert any(h["entity_type"] == "quote" and h["link"] == f"/app/portfell/pakkumine/{q2['id']}" for h in hits)
    lst = (await client.get("/api/v1/quotes")).json()
    assert [x["number"] for x in lst] == [q2["number"], q["number"]]


async def test_edit_pricing_terms_and_auto_terms(client: AsyncClient, admin: dict):
    ctx = await _setup(client)
    q = await _create(client, ctx, ["Pind 12"])
    sid = ctx["spaces"]["Pind 12"]["id"]
    # price override + stepped rent → auto special term overriding the rent clause
    r = await client.patch(f"/api/v1/quotes/{q['id']}/spaces/{sid}", json={"price_per_m2": 9.0, "schedule": [{"until_month": 12, "price": 8.0}, {"until_month": None, "price": 9.0}]})
    assert r.status_code == 200, r.text
    q = r.json()
    s = q["spaces"][0]
    assert s["price_override"] == 9.0 and s["line"]["price_per_m2"] == 8.0 and s["line"]["stepped"] is True
    assert s["line"]["avg_price_per_m2"] == round((12 * 8 + 48 * 9) / 60, 4)
    auto = [t for t in q["special_terms"] if t["auto_kind"] == "stepped_rent"]
    assert len(auto) == 1 and "astmeline" in auto[0]["text"] and auto[0]["overrides"] == "main:rent"
    # electricity above the 63 A cap → second auto term; back under → gone
    q = (await client.patch(f"/api/v1/quotes/{q['id']}/spaces/{sid}", json={"electrical_a": 80})).json()
    el = [t for t in q["special_terms"] if t["auto_kind"] == "electricity"]
    assert len(el) == 1 and "80" in el[0]["text"] and "4.4" in el[0]["overrides_label"]
    q = (await client.patch(f"/api/v1/quotes/{q['id']}/spaces/{sid}", json={"electrical_a": 32})).json()
    assert not [t for t in q["special_terms"] if t["auto_kind"] == "electricity"]
    # auto terms cannot be edited by hand
    r = await client.patch(f"/api/v1/quotes/{q['id']}/terms/{auto[0]['id']}", json={"text": "x"})
    assert r.status_code == 400
    # manual terms
    q = (await client.post(f"/api/v1/quotes/{q['id']}/terms", json={"text": "Üürnik võib paigaldada oma sildi fassaadile."})).json()
    manual = [t for t in q["special_terms"] if not t["auto_kind"]]
    assert len(manual) == 1
    q = (await client.patch(f"/api/v1/quotes/{q['id']}/terms/{manual[0]['id']}", json={"text": "Üürnik võib paigaldada sildi."})).json()
    assert [t["text"] for t in q["special_terms"] if not t["auto_kind"]] == ["Üürnik võib paigaldada sildi."]
    q = (await client.delete(f"/api/v1/quotes/{q['id']}/terms/{manual[0]['id']}")).json()
    assert not [t for t in q["special_terms"] if not t["auto_kind"]]
    # clearing the schedule removes the auto term; price equal to the list price drops the override
    q = (await client.patch(f"/api/v1/quotes/{q['id']}/spaces/{sid}", json={"clear_schedule": True, "price_per_m2": 9.5})).json()
    assert q["special_terms"] == [] and q["spaces"][0]["price_override"] is None and q["totals"]["monthly_net"] == 1216.0
    # period, validity, features, contact, commercial text; version lock
    r = await client.patch(f"/api/v1/quotes/{q['id']}", json={"period_months": 36, "features": [{"label": "Põranda kandevõime", "value": "5 t/m²"}], "commercial_text": "Tere!", "expected_version": q["version"]})
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["period_months"] == 36 and q["features"] == [{"label": "Põranda kandevõime", "value": "5 t/m²"}] and q["commercial_text"] == "Tere!"
    assert (await client.patch(f"/api/v1/quotes/{q['id']}", json={"period_months": 12, "expected_version": q["version"] - 1})).status_code == 409
    assert (await client.patch(f"/api/v1/quotes/{q['id']}", json={"valid_until": "2020-01-01"})).status_code == 400
    # add / remove spaces; the last space cannot go
    q = (await client.post(f"/api/v1/quotes/{q['id']}/spaces/{ctx['spaces']['Pind 4']['id']}")).json()
    assert [s["name"] for s in q["spaces"]] == ["Pind 12", "Pind 4"]
    q = (await client.delete(f"/api/v1/quotes/{q['id']}/spaces/{sid}")).json()
    assert [s["name"] for s in q["spaces"]] == ["Pind 4"]
    assert (await client.delete(f"/api/v1/quotes/{q['id']}/spaces/{ctx['spaces']['Pind 4']['id']}")).status_code == 400
    # parking spots from the register: an unknown spot is refused
    r = await client.patch(f"/api/v1/quotes/{q['id']}/spaces/{ctx['spaces']['Pind 4']['id']}", json={"parking_spot_ids": [str(uuid.uuid4())]})
    assert r.status_code == 400
    spots = {s["number"]: s for s in q["register_spots"]}
    q = (await client.patch(f"/api/v1/quotes/{q['id']}/spaces/{ctx['spaces']['Pind 4']['id']}", json={"parking_spot_ids": [spots["4"]["id"], spots["12"]["id"]]})).json()
    assert [p["number"] for p in q["spaces"][0]["parking"]["spots"]] == ["4", "12"]
    # uploaded attachment numbers from 3
    r = await client.post(f"/api/v1/quotes/{q['id']}/attachments", files={"file": ("tutvustus.pdf", b"%PDF-1.4 fake", "application/pdf")})
    assert r.status_code == 201, r.text
    assert [(a["number"], a["title"]) for a in r.json()["attachments"]] == [(3, "tutvustus.pdf")]
    # the HTML sheet renders
    html = (await client.get(f"/api/v1/quotes/{q['id']}/document.html")).text
    assert "Pakkumine PAK-" in html and "Pind 4" in html and "Käibemaks 24" in html


async def test_send_portal_loop(client: AsyncClient, admin: dict):
    from app.integrations.email import email_provider

    ctx = await _setup(client)
    q = await _create(client, ctx, ["Pind 12"])
    # no e-mail → refused
    await client.patch(f"/api/v1/quotes/{q['id']}", json={"contact": {"name": "Mari", "email": "", "phone": ""}})
    assert (await client.post(f"/api/v1/quotes/{q['id']}/send", json={})).status_code == 400
    await client.patch(f"/api/v1/quotes/{q['id']}", json={"contact": {"name": "Mari Maasikas", "email": "mari@example.com", "phone": ""}})
    r = await client.post(f"/api/v1/quotes/{q['id']}/send", json={"message": "Palun vaadake."})
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["status"] == "sent" and q["sent_version"] == 1 and q["editable"] is False and len(q["versions"]) == 1 and q["versions"][0]["pdf_url"]
    assert q["letters"][-1]["kind"] == "quote.sent" and q["letters"][-1]["to"] == "mari@example.com" and q["letters"][-1]["status"] == "queued"
    assert q["link"]["email"] == "mari@example.com" and "/portal/" in q["link"]["url"] and q["next_step"]["code"] == "waiting"
    assert q["pending_changes"] == []
    # editing a sent quote is refused
    assert (await client.patch(f"/api/v1/quotes/{q['id']}", json={"period_months": 12})).status_code == 400
    # the e-mail job is queued (the worker sends it)
    async with tenant_session(uuid.UUID(admin["account"]["id"])) as s:
        n = (await s.execute(text("SELECT count(*) FROM procrastinate_jobs WHERE task_name = 'app.worker.tasks.send_notification_email'"))).scalar_one()
        assert n >= 1
    # run the e-mail task inline → fake provider captured the letter with the portal link
    from app.models.core import Notification
    from app.worker.tasks import send_notification_email

    async with tenant_session(uuid.UUID(admin["account"]["id"])) as s:
        nid = (await s.execute(select(Notification.id).where(Notification.kind == "quote.sent"))).scalar_one()
    await send_notification_email(str(nid))
    sent = email_provider().sent  # type: ignore[attr-defined]
    assert sent and sent[-1]["to"] == "mari@example.com" and "/portal/" in sent[-1]["text"] and "Palun vaadake." in sent[-1]["text"]
    token = q["link"]["url"].rsplit("/portal/", 1)[1]

    # ---- client side, no account
    anon = AsyncClient(transport=client._transport, base_url="http://test")  # a separate client without the session cookie
    r = await anon.get(f"/api/v1/portal/{token}")
    assert r.status_code == 200, r.text
    p = r.json()
    assert p["number"] == q["number"] and p["can_respond"] is True and p["whose_turn"] == "client" and p["spaces"][0]["name"] == "Pind 12"
    assert p["totals"]["monthly_net"] == 1216.0 and p["pdf_url"]
    assert "Pakkumine" in (await anon.get(f"/api/v1/portal/{token}/document.html")).text
    assert (await anon.get(f"/api/v1/portal/{token}x")).status_code == 404
    # the open is logged, attributed to the link holder
    ev = (await client.get("/api/v1/audit", params={"entity_type": "quote", "entity_id": q["id"]})).json()
    opened = next(e for e in ev if e["action"] == "quote.link_opened")
    assert opened["actor_name"] == "link holder (mari@example.com)"
    assert (await client.get(f"/api/v1/quotes/{q['id']}")).json()["link"]["opened_at"]
    # client proposes a change
    r = await anon.post(f"/api/v1/portal/{token}/propose", json={"text": "Kas hind 9 €/m² oleks võimalik?"})
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "client_proposal" and r.json()["whose_turn"] == "landlord" and r.json()["can_respond"] is False
    q = (await client.get(f"/api/v1/quotes/{q['id']}")).json()
    assert q["status"] == "client_proposal" and q["editable"] is True and q["next_step"]["code"] == "answer"
    assert [m["author_type"] for m in q["messages"]] == ["operator", "client"] and q["messages"][-1]["meta"]["kind"] == "proposal"
    lst = (await client.get("/api/v1/quotes")).json()
    assert lst[0]["unread"] == 1
    # operators got an in-app notification
    notes = (await client.get("/api/v1/notifications")).json()
    assert any(n["kind"] == "quote.client_proposal" and n["link"] == f"/app/portfell/pakkumine/{q['id']}" for n in notes)
    # the client adds to the proposal while waiting
    r = await anon.post(f"/api/v1/portal/{token}/propose", json={"text": "Ja parkimiskoht 13 juurde."})
    assert r.status_code == 200 and r.json()["status"] == "client_proposal"
    # resend unchanged without a message → refused
    assert (await client.post(f"/api/v1/quotes/{q['id']}/send", json={})).status_code == 400
    # reply only → same version, letter kind reply
    r = await client.post(f"/api/v1/quotes/{q['id']}/send", json={"message": "Hinda ei saa muuta, aga lisame koha 13."})
    assert r.status_code == 200, r.text
    q = r.json()
    assert q["status"] == "sent" and q["sent_version"] == 1 and q["letters"][-1]["kind"] == "quote.reply"
    # client proposes again; operator changes the price → V2 with a diff
    await anon.post(f"/api/v1/portal/{token}/propose", json={"text": "Siis 9,20?"})
    q = (await client.get(f"/api/v1/quotes/{q['id']}")).json()
    q = (await client.patch(f"/api/v1/quotes/{q['id']}/spaces/{ctx['spaces']['Pind 12']['id']}", json={"price_per_m2": 9.2})).json()
    assert [c["key"] for c in q["pending_changes"]] == ["monthly_net", f"price:{ctx['spaces']['Pind 12']['id']}"]
    q = (await client.post(f"/api/v1/quotes/{q['id']}/send", json={"message": "Sobib, 9,20."})).json()
    assert q["sent_version"] == 2 and len(q["versions"]) == 2 and q["letters"][-1]["kind"] == "quote.resent"
    assert q["versions"][1]["changes"][0]["key"] == "monthly_net" and q["versions"][1]["changes"][0]["after"] == round(128 * 9.2, 2)
    assert q["messages"][-1]["meta"] == {"version": 2, "kind": "resent"}
    p = (await anon.get(f"/api/v1/portal/{token}")).json()
    assert p["sent_version"] == 2 and p["totals"]["monthly_net"] == round(128 * 9.2, 2) and p["versions"][1]["changes"]
    # free chat both ways
    r = await anon.post(f"/api/v1/portal/{token}/messages", json={"text": "Millal saaks pinda vaadata?"})
    assert r.status_code == 201
    r = await client.post(f"/api/v1/quotes/{q['id']}/messages", json={"body": "Homme kell 10 sobib."})
    assert r.status_code == 201 and r.json()["messages"][-1]["channel"] == "chat"
    assert (await client.post(f"/api/v1/quotes/{q['id']}/messages/read")).status_code == 204
    assert (await client.get("/api/v1/quotes")).json()[0]["unread"] == 0
    # accept
    r = await anon.post(f"/api/v1/portal/{token}/accept")
    assert r.status_code == 200 and r.json()["status"] == "accepted" and r.json()["can_respond"] is False
    q = (await client.get(f"/api/v1/quotes/{q['id']}")).json()
    assert q["status"] == "accepted" and q["accepted_at"] and q["next_step"]["code"] == "convert"
    assert (await anon.post(f"/api/v1/portal/{token}/accept")).status_code == 400
    assert any(n["kind"] == "quote.accepted" for n in (await client.get("/api/v1/notifications")).json())
    # the space is still „pakkumisel” until converted
    assert (await client.get(f"/api/v1/assets/{ctx['spaces']['Pind 12']['id']}")).json()["status"] == "pakkumisel"
    await anon.aclose()


async def test_reject_cancel_expire(client: AsyncClient, admin: dict):
    ctx = await _setup(client)
    anon = AsyncClient(transport=client._transport, base_url="http://test")
    # reject
    q = await _create(client, ctx, ["Pind 12"])
    q = (await client.post(f"/api/v1/quotes/{q['id']}/send", json={})).json()
    token = await _token_of(client, q["id"])
    r = await anon.post(f"/api/v1/portal/{token}/reject", json={"reason": "Leidsime teise pinna."})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    assert (await anon.get(f"/api/v1/portal/{token}")).status_code == 404  # the grant is revoked
    q = (await client.get(f"/api/v1/quotes/{q['id']}")).json()
    assert q["status"] == "rejected" and q["close_reason"] == "Leidsime teise pinna." and q["next_step"] is None and q["link"] is None
    assert (await client.get(f"/api/v1/assets/{ctx['spaces']['Pind 12']['id']}")).json()["status"] == "vaba"
    assert [x["number"] for x in (await client.get("/api/v1/quotes", params={"view": "closed"})).json()] == [q["number"]]
    # cancel
    q2 = await _create(client, ctx, ["Pind 8"])
    q2 = (await client.post(f"/api/v1/quotes/{q2['id']}/send", json={})).json()
    token2 = await _token_of(client, q2["id"])
    q2 = (await client.post(f"/api/v1/quotes/{q2['id']}/cancel", json={"reason": "Pind läks teisele"})).json()
    assert q2["status"] == "cancelled" and (await anon.get(f"/api/v1/portal/{token2}")).status_code == 404
    # expiry via the cron rule (a quote sent today with validity 0 days expires tomorrow)
    q3 = await _create(client, ctx, ["Pind 4"], validity_days=0)
    q3 = (await client.post(f"/api/v1/quotes/{q3['id']}/send", json={})).json()
    token3 = await _token_of(client, q3["id"])
    aid = uuid.UUID(admin["account"]["id"])
    async with tenant_session(aid) as s:
        assert await quotes_domain.expire_due(s, Actor.system(aid), today=date.today()) == 0
        assert await quotes_domain.expire_due(s, Actor.system(aid), today=date.today() + timedelta(days=1)) == 1
    q3 = (await client.get(f"/api/v1/quotes/{q3['id']}")).json()
    assert q3["status"] == "expired" and q3["next_step"] is None
    p = (await anon.get(f"/api/v1/portal/{token3}")).json()  # the link itself lives to the end of the validity day
    assert p["status"] == "expired" and p["can_respond"] is False
    assert (await anon.post(f"/api/v1/portal/{token3}/accept")).status_code == 400
    assert any(n["kind"] == "quote.expired" for n in (await client.get("/api/v1/notifications")).json())
    # a draft can be deleted; a sent one not
    q4 = await _create(client, ctx, ["Pind 12"])
    assert (await client.delete(f"/api/v1/quotes/{q4['id']}")).status_code == 204
    assert (await client.delete(f"/api/v1/quotes/{q2['id']}")).status_code == 400
    await anon.aclose()


async def test_reminder_bounce_and_resend(client: AsyncClient, admin: dict):
    ctx = await _setup(client)
    q = await _create(client, ctx, ["Pind 12"], validity_days=5)
    q = (await client.post(f"/api/v1/quotes/{q['id']}/send", json={})).json()
    # ≤ 7 days left → reminder suggested with an editable draft
    assert q["reminder"] and q["reminder"]["reason"] == "expiring" and q["number"] in q["reminder"]["text"] and q["next_step"]["code"] == "remind"
    q = (await client.post(f"/api/v1/quotes/{q['id']}/snooze", json={"days": 3})).json()
    assert q["reminder"] is None and q["next_step"]["code"] == "waiting"
    q = (await client.post(f"/api/v1/quotes/{q['id']}/remind", json={"text": "Tere! Kas pakkumine sobib?"})).json()
    assert q["letters"][-1]["kind"] == "quote.reminder" and q["reminder"] is None
    # bounce → next step, fix the address, resend; the old link dies with the old address
    old_token = await _token_of(client, q["id"])
    letter_id = q["letters"][-1]["id"]
    from app.domain.notify import record_email_status
    from app.models.core import Notification

    aid = uuid.UUID(admin["account"]["id"])
    async with tenant_session(aid) as s:
        n = await s.get(Notification, uuid.UUID(letter_id))
        n.email_message_id = "msg-1"
        await s.flush()
        await record_email_status(s, Actor.system(aid), message_id="msg-1", status="bounced", error="Invalid address")
    q = (await client.get(f"/api/v1/quotes/{q['id']}")).json()
    assert q["delivery"]["status"] == "bounced" and q["next_step"]["code"] == "bounced"
    q = (await client.post(f"/api/v1/quotes/{q['id']}/resend-letter", json={"email": "mari.maasikas@example.com"})).json()
    assert q["contact"]["email"] == "mari.maasikas@example.com" and q["letters"][-1]["status"] == "queued" and q["letters"][-1]["kind"] == "quote.reminder"
    assert q["link"]["email"] == "mari.maasikas@example.com" and q["next_step"]["code"] in ("waiting", "remind")
    anon = AsyncClient(transport=client._transport, base_url="http://test")
    assert (await anon.get(f"/api/v1/portal/{old_token}")).status_code == 404
    assert (await anon.get(f"/api/v1/portal/{await _token_of(client, q['id'])}")).status_code == 200
    await anon.aclose()


async def test_rls_and_events(client: AsyncClient, admin: dict):
    ctx = await _setup(client)
    q = await _create(client, ctx, ["Pind 12"])
    # another account cannot see it
    other = AsyncClient(transport=client._transport, base_url="http://test")
    r = await other.post("/api/v1/auth/register", json={"account_name": "Teine OÜ", "email": "teine@example.com", "name": "Teine", "password": "salasona123"})
    assert r.status_code == 201
    assert (await other.get(f"/api/v1/quotes/{q['id']}")).status_code == 404
    assert (await other.get("/api/v1/quotes")).json() == []
    await other.aclose()
    events = (await client.get("/api/v1/audit", params={"entity_type": "quote", "entity_id": q["id"], "resolve": "true"})).json()
    assert {e["action"] for e in events} >= {"quote.created"}
    assert events[-1]["entity_label"].startswith(q["number"]) and events[-1]["entity_link"] == f"/app/portfell/pakkumine/{q['id']}"


async def test_threads_and_quote_settings(client: AsyncClient, admin: dict):
    ctx = await _setup(client)
    r = await client.patch("/api/v1/account", json={"settings": {"quote": {"validity_days": 21, "period_months": 36}}})
    assert r.status_code == 200, r.text
    assert r.json()["settings"]["quote"]["validity_days"] == 21 and r.json()["settings"]["quote"]["deposit_months"] == 3
    q = await _create(client, ctx, ["Pind 12"])
    assert q["valid_until"] == (date.today() + timedelta(days=21)).isoformat() and q["period_months"] == 36
    q = (await client.post(f"/api/v1/quotes/{q['id']}/send", json={"message": "Palun vaadake."})).json()
    token = await _token_of(client, q["id"])
    anon = AsyncClient(transport=client._transport, base_url="http://test")
    await anon.post(f"/api/v1/portal/{token}/messages", json={"text": "Tere, küsimus."})
    await anon.aclose()
    th = (await client.get("/api/v1/messages/threads")).json()
    assert len(th) == 1 and th[0]["unread"] == 1 and th[0]["last_body"] == "Tere, küsimus." and th[0]["link"] == f"/app/portfell/pakkumine/{q['id']}"
    assert len((await client.get("/api/v1/messages/threads", params={"unanswered": "true"})).json()) == 1
    assert (await client.get("/api/v1/messages/threads", params={"q": "zzz"})).json() == []
