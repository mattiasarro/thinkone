"""Lease negotiation — spec stage 05, demo rounds (v707–722) and „Kuidas lahendame?” (v723 →).

Threads (``clause_thread``) hang on one clause; messages live in ``message`` (subject_type = clause_thread).
One round = one letter (``contract_round``): the side whose turn it is collects remarks/answers as drafts and
publishes them in one go; the waiting side sees the last published state and cannot edit.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents import render
from app.domain import document_versions, leases, share_links
from app.domain import messages as messages_domain
from app.domain.clauses import to_dicts
from app.domain.contracts import get_contract, index_contract
from app.domain.errors import Conflict, DomainError, NotFound
from app.domain.events import Actor, emit
from app.domain.notify import notify, notify_account_users
from app.domain.quotes import _valid_email, quote_settings
from app.models.contracts import Clause, ClauseThread, Contract, ContractRound
from app.models.core import Notification, User

RESOLUTIONS = {"changed", "special_term", "explained", "unchanged"}
LABELS = {"changed": "Muudetud", "special_term": "Eritingimus", "explained": "Selgitatud", "unchanged": "Jääb samaks"}


# ---------------------------------------------------------------- guards ---------------------------------------


def _turn(c: Contract) -> str | None:
    return (c.round or {}).get("side")


def _require_turn(c: Contract, side: str) -> None:
    if c.status == "draft":
        if side != "operator":
            raise DomainError("Mustand ei ole veel saadetud", code="not_sent")
        return
    if c.status not in ("sent", "negotiating"):
        raise DomainError("Leping ei ole läbirääkimistel", code="closed")
    if _turn(c) != side:
        raise DomainError("Praegu on teise poole kord — oota tema kirja" if side == "operator" else "Praegu on üürileandja kord", code="not_your_turn")


def _editable_by_operator(c: Contract) -> None:
    if c.status == "draft":
        return
    _require_turn(c, "operator")


# ---------------------------------------------------------------- reads ----------------------------------------


async def threads_of(session: AsyncSession, contract_id: uuid.UUID) -> list[ClauseThread]:
    return list((await session.execute(select(ClauseThread).where(ClauseThread.contract_id == contract_id).order_by(ClauseThread.created_at))).scalars())


async def rounds_of(session: AsyncSession, contract_id: uuid.UUID) -> list[ContractRound]:
    return list((await session.execute(select(ContractRound).where(ContractRound.contract_id == contract_id).order_by(ContractRound.nr))).scalars())


async def get_thread(session: AsyncSession, contract_id: uuid.UUID, thread_id: uuid.UUID) -> ClauseThread:
    t = await session.get(ClauseThread, thread_id)
    if not t or t.contract_id != contract_id:
        raise NotFound("Arutelu ei leitud")
    return t


def visible_to(t: ClauseThread, side: str) -> bool:
    """The other side sees a thread only once a letter published it (demo ``lepAruNahtav``)."""
    return t.round_nr is not None or t.opened_by == side


async def thread_view(session: AsyncSession, t: ClauseThread, *, side: str) -> dict[str, Any]:
    msgs = await messages_domain.list_for(session, "clause_thread", t.id)
    # the other side's drafts (not yet published by a letter) stay invisible — one round = one letter
    msgs = [m for m in msgs if m.meta.get("round_nr") is not None or m.author_type == side or m.author_type == "system"]
    return {"thread": t, "messages": msgs, "unsent": t.round_nr is None,
            "last_by": msgs[-1].author_type if msgs else t.opened_by,
            "whose_turn": _thread_turn(t, msgs)}


def _thread_turn(t: ClauseThread, msgs: list[Any]) -> str | None:
    if t.status == "resolved":
        return None
    if t.status == "awaiting_confirmation":
        return "client" if (t.proposal or {}).get("by") == "operator" else "operator"
    last = msgs[-1].author_type if msgs else t.opened_by
    return "operator" if last == "client" else "client"


async def state(session: AsyncSession, c: Contract, *, side: str = "operator") -> dict[str, Any]:
    ts = [t for t in await threads_of(session, c.id) if visible_to(t, side)]
    views = [await thread_view(session, t, side=side) for t in ts]
    open_ = [v for v in views if v["thread"].status != "resolved"]
    unsent = [v for v in views if v["unsent"] and v["thread"].opened_by == side]
    needs_me = [v for v in open_ if v["whose_turn"] == side]
    return {"threads": views, "open": open_, "unsent": unsent, "needs_me": needs_me,
            "rounds": await rounds_of(session, c.id), "versions": await document_versions.list_versions(session, "contract", c.id),
            "link": await share_links.current_link(session, "contract", c.id), "letters": await letters_of(session, c.id)}


async def letters_of(session: AsyncSession, contract_id: uuid.UUID) -> list[Notification]:
    stmt = (select(Notification).where(Notification.subject_type == "contract", Notification.subject_id == contract_id, Notification.recipient_email.is_not(None),
                                        Notification.kind.in_(["contract.sent", "contract.round", "contract.message", "contract.reminder"]))
            .order_by(Notification.created_at))
    return list((await session.execute(stmt)).scalars())


def next_step(c: Contract, st: dict[str, Any]) -> dict[str, Any] | None:
    """ONE next step (demo ``p7Samm``) for a platform lease."""
    if c.origin != "platform":
        return None
    open_n = len(st["open"])
    who, whom, whose = ("töötaja", "töötajale", "töötaja") if c.type_code == "employment" else ("üürnik", "üürnikule", "üürniku")
    if c.status == "draft":
        return {"side": "operator", "code": "send", "title": f"Saada {whom}", "text": f"Mustand V1 on valmis — vaata üle ja saada {whom} kommenteerimiseks.", "urgent": False}
    if c.status in ("sent", "negotiating"):
        if _turn(c) == "operator":
            n = len(st["needs_me"])
            return {"side": "operator", "code": "answer", "title": f"Vasta {whose} märkustele · {n}" if n else "Saada vastused",
                    "text": "Lahenda iga lahtine punkt (selgitan · muudan · Lisa 3) ja saada vastused ühe kirjaga." if n else f"Kõik punktid on vastatud — saada vastused {whom}.", "urgent": n > 0}
        return {"side": "client", "code": "waiting", "title": f"Ootab {whose} vastust", "text": f"{open_n} lahtist punkti · {who} vaatab lepingut." if open_n else f"{who.capitalize()} vaatab lepingu mustandit.", "urgent": False}
    if c.status == "ready_to_sign":
        return {"side": "operator", "code": "sign", "title": "Kõik punktid aktsepteeritud", "text": f"{who.capitalize()} aktsepteeris lepingu — allkirjastamine tuleb etapis 4.", "urgent": False}
    return None


# ---------------------------------------------------------------- sending & rounds -------------------------------


async def _sender_name(session: AsyncSession, actor: Actor, c: Contract) -> str:
    u = await session.get(User, actor.user_id) if actor.user_id else None
    return u.name if u else ""


def _snapshot(b: dict[str, Any]) -> dict[str, Any]:
    d = b["deal"]
    return {"number": b["contract"].number, "terms": b["contract"].terms, "contact": b["contract"].contact,
            "clauses": [{k: (str(v) if isinstance(v, uuid.UUID) else v) for k, v in x.items() if k in ("id", "number", "heading", "text", "container", "level", "locked", "status", "overrides_clause_id", "overrides_label", "fact_key")}
                        for x in to_dicts(b["clauses"]) if x["container"] != "annex:3" or x.get("status") == "accepted"],
            "totals": d["totals"], "handover": d["handover"].isoformat(), "end": d["end"].isoformat(), "deposit": d["deposit"],
            "annexes": [{"number": a["number"], "title": a["title"]} for a in b["annexes"]]}


async def _freeze(session: AsyncSession, actor: Actor, c: Contract, note: str | None) -> tuple[int, bool]:
    b = await leases.bundle(session, c)
    snap = _snapshot(b)
    last = await document_versions.latest(session, "contract", c.id)
    if last and document_versions.digest(snap) == last.snapshot_sha256:
        return last.number, False
    html = await leases.document_html(session, b, version=(last.number if last else 0) + 1, for_client=True)
    v = await document_versions.freeze(session, actor, subject_type="contract", subject_id=c.id, snapshot=snap, note=note, html=html)
    c.sent_version = v.number
    return v.number, True


async def send_draft(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, *, message: str | None = None, expected_version: int | None = None) -> dict[str, Any]:
    """Draft → sent: freeze V1 (the baseline every later „Muudatused · N” compares against), link the client, round 1 → client."""
    c = await get_contract(session, contract_id)
    if c.origin != "platform" or c.status != "draft":
        raise DomainError("Saata saab ainult platvormil koostatud mustandit", code="invalid_transition")
    if expected_version is not None and c.version != expected_version:
        raise Conflict()
    email = _valid_email((c.contact or {}).get("email"))
    settings = leases.effective_settings(await leases.get_account(session, c.account_id))
    days = quote_settings(settings)["contract_link_days"]
    version_no, _ = await _freeze(session, actor, c, message)
    link = await share_links.ensure_link(session, actor, subject_type="contract", subject_id=c.id, email=email, party_id=None, expires_at=share_links.expiry_in_days(days))
    b = await leases.bundle(session, c)
    name = (c.contact or {}).get("name") or (b["party"].name if b["party"] else "")
    sender = await _sender_name(session, actor, c)
    what = (f"töölepingu {c.number} mustandi (V{version_no}) — {b['deal']['position'].name}" if b["deal"]["vertical"] == "employment"
            else f"üürilepingu {c.number} mustandi (V{version_no}) — {b['deal']['property'].name if b['deal']['property'] else ''}, {', '.join(s['name'] for s in b['deal']['spaces'])}")
    body = (f"Tere, {name}!\n\nSaatsime Teile {what}. Vaadake lepingut lingi kaudu: iga punkt on klõpsatav ja kommenteeritav; "
            f"kui kõik sobib, aktsepteerige punktid.{chr(10) * 2 + message if message else ''}\n\nLugupidamisega\n{sender}")
    await notify(session, actor, kind="contract.sent", title=f"{'Töölepingu' if c.type_code == 'employment' else 'Üürilepingu'} {c.number} mustand", body=body, link=share_links.portal_path(share_links.token_for(link)),
                 recipient_email=email, subject_type="contract", subject_id=c.id)
    published = []
    for t in await threads_of(session, c.id):  # the operator's own remarks made while drafting go out with V1
        if t.round_nr is None and t.opened_by == "operator":
            t.round_nr = 1
            published.append(str(t.id))
            for m in await messages_domain.list_for(session, "clause_thread", t.id):
                if m.meta.get("round_nr") is None:
                    m.meta = {**m.meta, "round_nr": 1}
    session.add(ContractRound(account_id=actor.account_id, contract_id=c.id, nr=1, side="operator", body=message, version_no=version_no, thread_ids=published, created_by=actor.user_id))
    c.status, c.sent_at, c.round = "sent", datetime.now(UTC), {"nr": 2, "side": "client"}
    c.version += 1
    emit(session, actor, "contract", c.id, "contract.sent", {"version": version_no, "email": email, "link_days": days})
    await index_contract(session, c)
    return {"contract": c, "version": version_no, "link": link}


def _guard_send(st: dict[str, Any], side: str) -> None:
    pending = [v for v in st["open"] if v["whose_turn"] == side]
    if pending:
        what = "ettepanek või küsimus on otsustamata" if side == "client" else "punkt on vastamata"
        raise DomainError(f"{len(pending)} {what} — lahenda enne saatmist", code="pending")


async def send_round(session: AsyncSession, actor: Actor, c: Contract, *, side: str, body: str | None = None) -> ContractRound:
    """Publish this side's unsent remarks/answers as ONE letter; flip the turn (demo ``lepVoorSaada``)."""
    _require_turn(c, side)
    st = await state(session, c, side=side)  # own drafts visible, the other side's drafts not
    _guard_send(st, side)
    unsent = [v["thread"] for v in st["threads"] if v["thread"].round_nr is None and v["thread"].opened_by == side]
    unsent_msgs = []
    for v in st["threads"]:
        for m in v["messages"]:
            if m.meta.get("round_nr") is None and m.author_type == side:
                unsent_msgs.append(m)
    if not unsent and not unsent_msgs and not (body or "").strip() and side == "client":
        raise DomainError("Pole midagi saata — lisa märkus või aktsepteeri punktid", code="nothing_to_send")
    nr = int((c.round or {}).get("nr") or 1)
    version_no, changed = (await _freeze(session, actor, c, body)) if side == "operator" else (c.sent_version, False)
    for t in unsent:
        t.round_nr = nr
    for m in unsent_msgs:
        m.meta = {**m.meta, "round_nr": nr}
    r = ContractRound(account_id=actor.account_id, contract_id=c.id, nr=nr, side=side, body=(body or "").strip() or None, version_no=version_no if side == "operator" else None,
                      thread_ids=[str(t.id) for t in unsent], created_by=actor.user_id)
    session.add(r)
    await session.flush()
    c.round = {"nr": nr + 1, "side": "operator" if side == "client" else "client"}
    if c.status == "sent" and side == "client":
        c.status = "negotiating"
    c.version += 1
    emit(session, actor, "contract", c.id, "contract.round_sent", {"nr": nr, "side": side, "threads": len(unsent), "messages": len(unsent_msgs), "version": version_no, "changed": changed})
    b = await leases.bundle(session, c)
    if side == "operator":
        email = _valid_email((c.contact or {}).get("email"))
        link = await share_links.current_link(session, "contract", c.id)
        if link:
            sender = await _sender_name(session, actor, c)
            name = (c.contact or {}).get("name") or (b["party"].name if b["party"] else "")
            text = (f"Tere, {name}!\n\nVastasime Teie märkustele üürilepingu {c.number} kohta" + (f" (uus versioon V{version_no})" if changed else "") + "."
                    + (f"\n\n{body.strip()}" if body and body.strip() else "") + "\n\nVaadake vastuseid lingi kaudu.\n\nLugupidamisega\n" + sender)
            await notify(session, actor, kind="contract.round", title=f"Vastused — üürileping {c.number}", body=text, link=share_links.portal_path(share_links.token_for(link)),
                         recipient_email=email, subject_type="contract", subject_id=c.id)
    else:
        party = b["party"]
        await notify_account_users(session, actor, kind="contract.client_round", title=f"{party.name if party else 'Üürnik'} saatis märkused lepingule {c.number}",
                                   body=f"{len(unsent)} märkust · {(body or '').strip()[:300]}", link=f"/app/portfell/leping/{c.id}", subject_type="contract", subject_id=c.id)
    await index_contract(session, c)
    return r


async def return_to_client(session: AsyncSession, actor: Actor, c: Contract) -> ContractRound:
    """Operator's turn with nothing to answer → hand the turn back (demo „Tagasta üürnikule”)."""
    return await send_round(session, actor, c, side="operator", body=None)


# ---------------------------------------------------------------- threads --------------------------------------


async def _clause(session: AsyncSession, c: Contract, clause_id: uuid.UUID) -> Clause:
    cl = await session.get(Clause, clause_id)
    if not cl or cl.contract_id != c.id:
        raise NotFound("Punkti ei leitud")
    return cl


async def open_thread(session: AsyncSession, actor: Actor, c: Contract, *, clause_id: uuid.UUID, side: str, text: str, wish: dict[str, Any] | None = None,
                      author_name: str | None = None) -> ClauseThread:
    if c.status == "draft" and side == "client":
        raise DomainError("Mustand ei ole saadetud")
    if c.status != "draft":
        _require_turn(c, side)
    cl = await _clause(session, c, clause_id)
    text = (text or "").strip()
    if not text and not wish:
        raise DomainError("Kirjuta märkus")
    existing = next((t for t in await threads_of(session, c.id) if t.clause_id == cl.id and t.status != "resolved"), None)
    if existing:
        await reply(session, actor, c, existing, side=side, text=text, author_name=author_name)
        if wish:
            existing.wish = wish
        return existing
    t = ClauseThread(account_id=actor.account_id, contract_id=c.id, clause_id=cl.id, opened_by=side, status="open", wish=wish)
    session.add(t)
    await session.flush()
    if wish and not text:
        text = f"Soovin muuta: {wish.get('label') or wish.get('fact_key')} → {wish.get('value')}"
    await messages_domain.post(session, actor, subject_type="clause_thread", subject_id=t.id, channel="negotiation", author_type=side, author_name=author_name, body=text,
                               meta={"contract_id": str(c.id), "clause_id": str(cl.id), "round_nr": None})
    emit(session, actor, "contract", c.id, "contract.thread_opened", {"thread_id": t.id, "clause_id": cl.id, "by": side, "excerpt": text[:200], "wish": wish})
    return t


async def reply(session: AsyncSession, actor: Actor, c: Contract, t: ClauseThread, *, side: str, text: str, author_name: str | None = None, kind: str | None = None) -> Any:
    if c.status != "draft":
        _require_turn(c, side)
    text = (text or "").strip()
    if not text:
        raise DomainError("Kirjuta vastus")
    if t.status == "resolved" and side == "client":
        t.status, t.resolution, t.resolved_at, t.round_nr = "open", None, None, None if t.opened_by == "client" else t.round_nr
        emit(session, actor, "contract", c.id, "contract.thread_reopened", {"thread_id": t.id})
    m = await messages_domain.post(session, actor, subject_type="clause_thread", subject_id=t.id, channel="negotiation", author_type=side, author_name=author_name, body=text,
                                   meta={"contract_id": str(c.id), "clause_id": str(t.clause_id), "round_nr": None, **({"kind": kind} if kind else {})})
    return m


async def _resolve(session: AsyncSession, actor: Actor, c: Contract, t: ClauseThread, resolution: str, payload: dict[str, Any] | None = None) -> None:
    assert resolution in RESOLUTIONS
    t.status, t.resolution, t.resolved_at, t.proposal = "resolved", resolution, datetime.now(UTC), t.proposal
    emit(session, actor, "contract", c.id, "contract.thread_resolved", {"thread_id": t.id, "clause_id": t.clause_id, "resolution": resolution, **(payload or {})})


# „Kuidas lahendame?” — the operator's four options -----------------------------------------------


async def explain(session: AsyncSession, actor: Actor, c: Contract, t: ClauseThread, text: str) -> ClauseThread:
    _editable_by_operator(c)
    await reply(session, actor, c, t, side="operator", text=text, author_name=await _sender_name(session, actor, c), kind="explain")
    await _resolve(session, actor, c, t, "explained")
    return t


async def answer_only(session: AsyncSession, actor: Actor, c: Contract, t: ClauseThread, text: str) -> ClauseThread:
    _editable_by_operator(c)
    await reply(session, actor, c, t, side="operator", text=text, author_name=await _sender_name(session, actor, c))
    return t


async def propose(session: AsyncSession, actor: Actor, c: Contract, t: ClauseThread, *, kind: str, text: str | None = None, fact_key: str | None = None,
                  value: Any = None, wording: str | None = None, special_text: str | None = None, overrides_label: str | None = None, side: str = "operator",
                  author_name: str | None = None) -> ClauseThread:
    """A concrete change the other side confirms: a fact value, the clause's wording, or a Lisa 3 clause overriding it."""
    if side == "operator":
        _editable_by_operator(c)
    else:
        _require_turn(c, "client")
    if t.status == "resolved":
        raise DomainError("Arutelu on lahendatud — ava see uuesti vastusega")
    cl = await _clause(session, c, t.clause_id)
    proposal: dict[str, Any] = {"kind": kind, "by": side}
    if kind == "fact":
        if not fact_key:
            raise DomainError("Fakti võti puudub")
        if cl.fact_key and cl.fact_key != fact_key:
            raise DomainError("See punkt ei kanna seda fakti")
        proposal.update({"fact_key": fact_key, "value": value})
    elif kind == "wording":
        if not (wording or "").strip():
            raise DomainError("Uus sõnastus puudub")
        if cl.locked:
            raise DomainError("Üldtingimuse punkti ei sõnastata ümber — saada see Lisa 3-sse", code="locked")
        proposal.update({"text": wording.strip(), "before": (cl.text or {}).get("plain", "")})
    elif kind == "special_term":
        if not (special_text or "").strip():
            raise DomainError("Eritingimuse tekst puudub")
        sp = await leases.add_special_clause(session, actor, c, text=special_text.strip(), overrides=None, overrides_label=overrides_label, status="proposed", origin_note="läbirääkimisel")
        sp.overrides_clause_id = cl.id
        proposal.update({"special_clause_id": str(sp.id), "text": special_text.strip()})
    else:
        raise DomainError("Ettepaneku liik peab olema fact, wording või special_term")
    t.proposal, t.status = proposal, "awaiting_confirmation"
    await messages_domain.post(session, actor, subject_type="clause_thread", subject_id=t.id, channel="negotiation", author_type=side,
                               author_name=author_name or await _sender_name(session, actor, c), body=(text or "").strip() or _proposal_text(proposal),
                               meta={"contract_id": str(c.id), "clause_id": str(cl.id), "round_nr": None, "kind": "proposal", "proposal": proposal})
    emit(session, actor, "contract", c.id, "contract.proposal_made", {"thread_id": t.id, "clause_id": cl.id, "proposal": proposal})
    return t


def _proposal_text(p: dict[str, Any]) -> str:
    if p["kind"] == "fact":
        return f"Muudan: {p['fact_key']} → {p['value']}"
    if p["kind"] == "wording":
        return f"Uus sõnastus: {p['text']}"
    return f"Eritingimus Lisa 3-sse: {p['text']}"


async def _apply(session: AsyncSession, actor: Actor, c: Contract, t: ClauseThread) -> str:
    p = t.proposal or {}
    cl = await _clause(session, c, t.clause_id)
    if p["kind"] == "fact":
        await _apply_fact(session, actor, c, p["fact_key"], p["value"])
        return "changed"
    if p["kind"] == "wording":
        before = (cl.text or {}).get("plain", "")
        cl.text = {"plain": p["text"]}
        emit(session, actor, "clause", cl.id, "clause.text_changed", {"contract_id": c.id, "contract_number": c.number, "before": before, "after": p["text"], "via": "negotiation", "thread_id": t.id})
        return "changed"
    sp = await session.get(Clause, uuid.UUID(p["special_clause_id"]))
    if sp:
        sp.status = "accepted"
    return "special_term"


async def _apply_fact(session: AsyncSession, actor: Actor, c: Contract, fact_key: str, value: Any) -> None:
    patch: dict[str, Any]
    if c.type_code == "employment":
        from app.domain import employment

        if fact_key not in ("salary", "months", "probation_months", "start", "working_time", "place", "salary_review", "vacation_days", "term_notes"):
            raise DomainError(f"Fakti {fact_key} ei saa läbirääkimisel muuta")
        saved = c.round
        c.round = None
        try:
            await employment.update_terms(session, actor, c.id, {fact_key: value}, reason="läbirääkimine")
        finally:
            c.round = saved
        return
    if fact_key == "rent":
        patch = {"spaces": [{"space_id": s["space_id"], "price_per_m2": float(value)} for s in (c.terms or {}).get("spaces") or []]}
    elif fact_key == "parking":
        patch = {"spaces": [{"space_id": s["space_id"], "parking_spot_ids": [str(x) for x in value]} for s in (c.terms or {}).get("spaces") or []][:1]} if isinstance(value, list) \
            else {"spaces": [{"space_id": s["space_id"], "parking_count": int(value)} for s in (c.terms or {}).get("spaces") or []][:1]}
    elif fact_key == "handover":
        patch = {"handover": str(value)}
    elif fact_key == "months":
        patch = {"months": int(value)}
    elif fact_key == "deposit_months":
        patch = {"deposit_months": int(value)}
    elif fact_key == "purpose":
        patch = {"purpose": str(value)}
    elif fact_key == "term_notes":
        patch = {"term_notes": str(value)}
    elif fact_key == "indexation":
        patch = {"indexation": value}
    else:
        raise DomainError(f"Fakti {fact_key} ei saa läbirääkimisel muuta")
    saved = c.round
    c.round = None  # update_terms checks the editable status only; the turn was checked by the caller
    try:
        await leases.update_terms(session, actor, c.id, patch, reason="läbirääkimine")
    finally:
        c.round = saved


async def decide(session: AsyncSession, actor: Actor, c: Contract, t: ClauseThread, *, side: str, accept: bool, text: str | None = None,
                 author_name: str | None = None) -> ClauseThread:
    """The other side confirms („Kinnitan uue sõnastuse”) or declines („Ei sobi — vastan arutellu”) a proposal."""
    _require_turn(c, side)
    if t.status != "awaiting_confirmation" or (t.proposal or {}).get("by") == side:
        raise DomainError("Selles arutelus pole Teile kinnitamiseks ettepanekut")
    if accept:
        resolution = await _apply(session, actor, c, t)
        await messages_domain.post(session, actor, subject_type="clause_thread", subject_id=t.id, channel="negotiation", author_type=side, author_name=author_name,
                                   body=(text or "").strip() or "Kinnitan ettepaneku.", meta={"contract_id": str(c.id), "clause_id": str(t.clause_id), "round_nr": None, "kind": "accept"})
        await _resolve(session, actor, c, t, resolution, {"by": side})
    else:
        p = t.proposal or {}
        if p.get("kind") == "special_term" and p.get("special_clause_id"):
            sp = await session.get(Clause, uuid.UUID(p["special_clause_id"]))
            if sp and sp.status == "proposed":
                await session.delete(sp)
        t.status, t.proposal = "open", None
        await messages_domain.post(session, actor, subject_type="clause_thread", subject_id=t.id, channel="negotiation", author_type=side, author_name=author_name,
                                   body=(text or "").strip() or "Ei sobi — vastan arutellu.", meta={"contract_id": str(c.id), "clause_id": str(t.clause_id), "round_nr": None, "kind": "decline"})
        emit(session, actor, "contract", c.id, "contract.proposal_declined", {"thread_id": t.id, "by": side})
    return t


async def mark_ok(session: AsyncSession, actor: Actor, c: Contract, t: ClauseThread, *, side: str, author_name: str | None = None) -> ClauseThread:
    """Client's „Sobib” on an answer: closes the thread as explained; operator's „Jääb samaks” closes it unchanged."""
    _require_turn(c, side)
    if t.status == "resolved":
        return t
    if t.status == "awaiting_confirmation":
        raise DomainError("Otsusta ettepanek enne")
    await messages_domain.post(session, actor, subject_type="clause_thread", subject_id=t.id, channel="negotiation", author_type=side, author_name=author_name,
                               body="Sobib." if side == "client" else "Jääb samaks.", meta={"contract_id": str(c.id), "clause_id": str(t.clause_id), "round_nr": None, "kind": "ok"})
    await _resolve(session, actor, c, t, "explained" if side == "client" else "unchanged", {"by": side})
    return t


# ---------------------------------------------------------------- acceptance ------------------------------------


async def accept_all(session: AsyncSession, actor: Actor, c: Contract, *, author_name: str | None = None) -> Contract:
    """Client with nothing open: every clause accepted → ready_to_sign (demo „Aktsepteerin kõik punktid”; signing is Phase 4)."""
    _require_turn(c, "client")
    st = await state(session, c, side="client")
    if st["open"]:
        raise DomainError(f"{len(st['open'])} punkti on veel lahtine — otsustage need enne", code="pending")
    c.status, c.accepted_at, c.round = "ready_to_sign", datetime.now(UTC), None
    c.version += 1
    emit(session, actor, "contract", c.id, "contract.accepted_by_client", {"version": c.sent_version, "by": author_name})
    await notify_account_users(session, actor, kind="contract.accepted", title=f"Üürnik aktsepteeris lepingu {c.number}", body="Kõik punktid on aktsepteeritud — leping on allkirjastamiseks valmis.",
                               link=f"/app/portfell/leping/{c.id}", subject_type="contract", subject_id=c.id)
    await index_contract(session, c)
    return c


async def cancel(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, reason: str | None = None) -> Contract:
    c = await get_contract(session, contract_id)
    if c.origin != "platform" or c.status not in ("draft", "sent", "negotiating", "ready_to_sign"):
        raise DomainError("Tühistada saab allkirjastamata platvormi lepingut", code="invalid_transition")
    frm = c.status
    c.status, c.round = "cancelled", None
    c.version += 1
    emit(session, actor, "contract", c.id, "contract.cancelled", {"from": frm}, reason=reason)
    link = await share_links.current_link(session, "contract", c.id)
    if link:
        await share_links.revoke(session, actor, link, "cancelled")
    from app.domain.assets import delete_allocation, list_allocations

    for al, _ in await list_allocations(session, contract_id=c.id):
        await delete_allocation(session, actor, al.id)
    await index_contract(session, c)
    return c


def diff_versions(old: dict[str, Any], new: dict[str, Any]) -> list[dict[str, Any]]:
    """Word-level-ish changes between two frozen lease versions: clause wording, facts, Lisa 3 entries (demo „Muudatused · N”)."""
    out: list[dict[str, Any]] = []
    oc = {c["id"]: c for c in old.get("clauses", [])}
    nc = {c["id"]: c for c in new.get("clauses", [])}
    for cid, c in nc.items():
        o = oc.get(cid)
        if not o:
            out.append({"key": f"clause:{cid}", "label": f"{'Lisa 3 p ' if c['container'] == 'annex:3' else 'p '}{c['number']}", "kind": "added", "before": None, "after": c["text"], "clause_id": cid})
        elif o["text"] != c["text"]:
            out.append({"key": f"clause:{cid}", "label": f"p {c['number']}{' · ' + c['heading'] if c.get('heading') else ''}", "kind": "wording", "before": o["text"], "after": c["text"], "clause_id": cid})
    for cid, o in oc.items():
        if cid not in nc:
            out.append({"key": f"clause:{cid}", "label": f"p {o['number']}", "kind": "removed", "before": o["text"], "after": None, "clause_id": cid})
    for key, label in (("handover", "Üleandmispäev"), ("end", "Lepingu lõpp"), ("deposit", "Tagatisraha")):
        if old.get(key) != new.get(key):
            out.append({"key": key, "label": label, "kind": "fact", "before": old.get(key), "after": new.get(key)})
    if (old.get("totals") or {}).get("monthly_net") != (new.get("totals") or {}).get("monthly_net"):
        out.append({"key": "rent_monthly", "label": "Üür kuus", "kind": "fact", "before": (old.get("totals") or {}).get("monthly_net"), "after": (new.get("totals") or {}).get("monthly_net")})
    return out


def fmt_label(resolution: str | None) -> str | None:
    return LABELS.get(resolution or "", None)


def date_text(d) -> str:
    return render.fmt_date(d)
