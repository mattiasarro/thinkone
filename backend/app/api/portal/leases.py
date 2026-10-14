"""The client's lease draft: A4 document with clickable clauses, threads, rounds, acceptance. Human↔human only."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from app.api.portal.deps import PortalDep
from app.domain import document_versions, leases, negotiation
from app.domain import messages as messages_domain
from app.domain.clauses import to_dicts
from app.models.contracts import Contract

router = APIRouter()


class PortalLeaseOut(BaseModel):
    id: uuid.UUID
    number: str
    status: str
    client_name: str
    party_name: str
    landlord_name: str | None
    property_name: str | None
    space_names: list[str]
    handover: date
    end: date
    months: int
    totals: dict[str, Any]
    deposit: float
    sent_version: int
    document_url: str
    pdf_url: str | None
    clauses: list[dict[str, Any]]
    threads: list[dict[str, Any]]
    rounds: list[dict[str, Any]]
    versions: list[dict[str, Any]]
    chat: list[dict[str, Any]]
    turn: str | None
    can_comment: bool
    can_send: bool
    can_accept: bool
    pending_count: int
    unsent_count: int
    open_count: int
    step_title: str
    step_text: str
    contact: dict[str, Any]
    link_expires_at: datetime
    fact_keys: dict[str, str]


class ThreadOpenIn(BaseModel):
    clause_id: uuid.UUID
    text: str = ""
    wish: dict[str, Any] | None = None


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class DecideIn(BaseModel):
    accept: bool
    text: str | None = None


class RoundIn(BaseModel):
    body: str | None = None


FACT_LABELS = {"rent": "Üür €/m²", "parking": "Parkimiskohad", "handover": "Üleandmispäev", "deposit_months": "Tagatis (kuud)", "months": "Lepingu tähtaeg", "purpose": "Kasutusotstarve"}


def _contract_of(link) -> uuid.UUID:
    if link.subject_type != "contract":
        raise HTTPException(404, "Link ei kehti")
    return link.subject_id


async def _out(session, link, c: Contract, token: str) -> PortalLeaseOut:
    b = await leases.bundle(session, c)
    d = b["deal"]
    st = await negotiation.state(session, c, side="client")
    versions = st["versions"]
    last = versions[-1] if versions else None
    turn = (c.round or {}).get("side") if c.status in ("sent", "negotiating") else None
    pending = [v for v in st["open"] if v["whose_turn"] == "client"]
    numbers = {r.id: (r.display_number, r.heading) for r in b["clauses"]}
    if c.status in ("sent", "negotiating") and turn == "client":
        title = "Teie kord" if st["open"] else "Teie kord — vaadake leping üle"
        text = ("Otsustage ettepanekud ja saatke märkused ühe kirjaga." if pending else
                "Klõpsake punktil, et küsida või teha ettepanek; kui kõik sobib, aktsepteerige kõik punktid.")
    elif c.status in ("sent", "negotiating"):
        title, text = "Ootame üürileandja vastust", "Teie märkused on saadetud — üürileandja vaatab need üle."
    elif c.status == "ready_to_sign":
        title, text = "Kõik punktid on aktsepteeritud", "Leping on allkirjastamiseks valmis — üürileandja saadab allkirjastamise kutse."
    elif c.status == "cancelled":
        title, text = "Leping on tühistatud", ""
    else:
        title, text = "Leping", ""
    clauses = [x for x in to_dicts(b["clauses"]) if x["container"] != "annex:3" or x.get("status") == "accepted" or any(
        (t["thread"].proposal or {}).get("special_clause_id") == str(x["id"]) for t in st["threads"])]
    company = b["company"]
    return PortalLeaseOut(
        id=c.id, number=c.number, status=c.status, client_name=(c.contact or {}).get("name") or (b["party"].name if b["party"] else ""), party_name=b["party"].name if b["party"] else "",
        landlord_name=company.name if company else None, property_name=d["property"].name if d["property"] else None, space_names=[s["name"] for s in d["spaces"]],
        handover=d["handover"], end=d["end"], months=d["months"], totals=d["totals"], deposit=d["deposit"], sent_version=c.sent_version,
        document_url=f"/api/v1/portal/{token}/document.html", pdf_url=await document_versions.pdf_url(last),
        clauses=[{k: v for k, v in x.items() if k in ("id", "number", "heading", "text", "container", "level", "locked", "status", "overrides_clause_id", "overrides_label", "fact_key")} for x in clauses],
        threads=[{"id": v["thread"].id, "clause_id": v["thread"].clause_id, "clause_number": numbers.get(v["thread"].clause_id, (None, None))[0],
                  "clause_heading": numbers.get(v["thread"].clause_id, (None, None))[1], "opened_by": v["thread"].opened_by, "status": v["thread"].status,
                  "resolution": v["thread"].resolution, "resolution_label": negotiation.fmt_label(v["thread"].resolution), "proposal": v["thread"].proposal,
                  "wish": v["thread"].wish, "unsent": v["unsent"], "whose_turn": v["whose_turn"], "created_at": v["thread"].created_at,
                  "messages": [{"id": m.id, "author_type": m.author_type, "author_name": m.author_name, "body": m.body, "meta": m.meta, "created_at": m.created_at} for m in v["messages"]]}
                 for v in st["threads"]],
        rounds=[{"nr": r.nr, "side": r.side, "body": r.body, "version_no": r.version_no, "created_at": r.created_at} for r in st["rounds"]],
        versions=[{"number": v.number, "created_at": v.created_at, "note": v.note, "changes": negotiation.diff_versions(versions[i - 1].snapshot, v.snapshot) if i else []} for i, v in enumerate(versions)],
        chat=[{"id": m.id, "author_type": m.author_type, "author_name": m.author_name, "body": m.body, "created_at": m.created_at} for m in await messages_domain.list_for(session, "contract", c.id, channel="chat")],
        turn=turn, can_comment=turn == "client", can_send=turn == "client" and not pending and bool(st["unsent"] or any(m.meta.get("round_nr") is None and m.author_type == "client" for v in st["threads"] for m in v["messages"])),
        can_accept=turn == "client" and not st["open"], pending_count=len(pending), unsent_count=len(st["unsent"]), open_count=len(st["open"]),
        step_title=title, step_text=text,
        contact={"company": company.name if company else None, "email": company.email if company else None, "phone": company.phone if company else None,
                 "address": (d["property"].attributes or {}).get("address") if d["property"] else None},
        link_expires_at=link.expires_at, fact_keys=FACT_LABELS,
    )


async def lease_home(session, link, token: str) -> PortalLeaseOut:
    c = await leases.get_contract(session, _contract_of(link))
    return await _out(session, link, c, token)


@router.get("/{token}/lease/document.html", response_class=HTMLResponse)
async def lease_document(token: str, dep=PortalDep) -> HTMLResponse:
    session, pr = dep
    c = await leases.get_contract(session, _contract_of(pr.link))
    return HTMLResponse(await leases.document_html(session, await leases.bundle(session, c), version=c.sent_version or None, for_client=True, interactive=True))


async def _client_name(session, c: Contract) -> str | None:
    from app.domain import contract_parties

    party = (await contract_parties.primary_parties(session, [c.id])).get(c.id)
    return (c.contact or {}).get("name") or (party.name if party else None)


@router.post("/{token}/lease/threads", response_model=PortalLeaseOut, status_code=201)
async def open_thread(token: str, body: ThreadOpenIn, dep=PortalDep) -> PortalLeaseOut:
    session, pr = dep
    c = await leases.get_contract(session, _contract_of(pr.link))
    await negotiation.open_thread(session, pr.actor, c, clause_id=body.clause_id, side="client", text=body.text, wish=body.wish, author_name=await _client_name(session, c))
    return await _out(session, pr.link, c, token)


@router.post("/{token}/lease/threads/{thread_id}/reply", response_model=PortalLeaseOut)
async def reply(token: str, thread_id: uuid.UUID, body: TextIn, dep=PortalDep) -> PortalLeaseOut:
    session, pr = dep
    c = await leases.get_contract(session, _contract_of(pr.link))
    await negotiation.reply(session, pr.actor, c, await negotiation.get_thread(session, c.id, thread_id), side="client", text=body.text, author_name=await _client_name(session, c))
    return await _out(session, pr.link, c, token)


@router.post("/{token}/lease/threads/{thread_id}/decide", response_model=PortalLeaseOut)
async def decide(token: str, thread_id: uuid.UUID, body: DecideIn, dep=PortalDep) -> PortalLeaseOut:
    session, pr = dep
    c = await leases.get_contract(session, _contract_of(pr.link))
    await negotiation.decide(session, pr.actor, c, await negotiation.get_thread(session, c.id, thread_id), side="client", accept=body.accept, text=body.text, author_name=await _client_name(session, c))
    return await _out(session, pr.link, c, token)


@router.post("/{token}/lease/threads/{thread_id}/ok", response_model=PortalLeaseOut)
async def ok(token: str, thread_id: uuid.UUID, dep=PortalDep) -> PortalLeaseOut:
    session, pr = dep
    c = await leases.get_contract(session, _contract_of(pr.link))
    await negotiation.mark_ok(session, pr.actor, c, await negotiation.get_thread(session, c.id, thread_id), side="client", author_name=await _client_name(session, c))
    return await _out(session, pr.link, c, token)


@router.post("/{token}/lease/send", response_model=PortalLeaseOut)
async def send_round(token: str, body: RoundIn | None = None, dep=PortalDep) -> PortalLeaseOut:
    session, pr = dep
    c = await leases.get_contract(session, _contract_of(pr.link))
    await negotiation.send_round(session, pr.actor, c, side="client", body=(body or RoundIn()).body)
    return await _out(session, pr.link, c, token)


@router.post("/{token}/lease/accept", response_model=PortalLeaseOut)
async def accept_all(token: str, dep=PortalDep) -> PortalLeaseOut:
    session, pr = dep
    c = await leases.get_contract(session, _contract_of(pr.link))
    await negotiation.accept_all(session, pr.actor, c, author_name=await _client_name(session, c))
    return await _out(session, pr.link, c, token)


@router.post("/{token}/lease/messages", response_model=PortalLeaseOut, status_code=201)
async def chat(token: str, body: TextIn, dep=PortalDep) -> PortalLeaseOut:
    session, pr = dep
    c = await leases.get_contract(session, _contract_of(pr.link))
    from app.domain.notify import notify_account_users

    await messages_domain.post(session, pr.actor, subject_type="contract", subject_id=c.id, channel="chat", author_type="client", author_name=await _client_name(session, c), body=body.text)
    await notify_account_users(session, pr.actor, kind="contract.client_message", title=f"Üürnik kirjutas lepingu {c.number} kohta", body=body.text[:500],
                               link=f"/app/portfell/leping/{c.id}", subject_type="contract", subject_id=c.id)
    return await _out(session, pr.link, c, token)
