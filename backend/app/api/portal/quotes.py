"""What the client sees through a quote link: the sheet, the decision card, the thread. Human↔human chat only."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field

from app.api.portal.deps import PortalDep
from app.domain import document_versions
from app.domain import quotes as quotes_domain
from app.domain.errors import DomainError
from app.models.quotes import Quote

router = APIRouter()


class PortalSpace(BaseModel):
    name: str
    area_m2: float
    price_per_m2: float
    monthly_net: float
    parking: list[str] | int | None
    electrical_a: float | None


class PortalMessage(BaseModel):
    id: uuid.UUID
    channel: str
    author_type: str
    author_name: str | None
    body: str
    meta: dict[str, Any]
    created_at: datetime


class PortalContact(BaseModel):
    company: str | None
    email: str | None
    phone: str | None
    address: str | None
    logo_url: str | None


class PortalQuoteOut(BaseModel):
    id: uuid.UUID
    number: str
    status: str
    client_name: str
    party_name: str
    property_name: str
    property_address: str | None
    valid_until: date
    days_left: int
    period_months: int
    sent_version: int
    totals: dict[str, Any]
    spaces: list[PortalSpace]
    special_terms: list[str]
    attachments: list[dict[str, Any]]
    messages: list[PortalMessage]
    versions: list[dict[str, Any]]
    pdf_url: str | None
    document_url: str
    can_respond: bool  # accept / propose / reject
    can_extend: bool  # add to a pending proposal
    whose_turn: str  # client | landlord | none
    step_title: str
    step_text: str
    contact: PortalContact
    link_expires_at: datetime


class TextIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class ReasonIn(BaseModel):
    reason: str | None = Field(default=None, max_length=2000)


def _quote_of(link) -> uuid.UUID:
    if link.subject_type != "quote":
        raise HTTPException(404, "Link ei kehti")
    return link.subject_id


async def _out(session, link, q: Quote, token: str) -> PortalQuoteOut:
    from app.infra.blobstore import blobstore
    from app.models.core import Attachment

    b = await quotes_domain.quote_bundle(session, q)
    versions = b["versions"]
    last = versions[-1] if versions else None
    snap = last.snapshot if last else quotes_domain.snapshot(b)  # the client always sees the last SENT state (demo ``offerSentView``)
    company = b["company"]
    logo = None
    if company and company.logo_attachment_id:
        att = await session.get(Attachment, company.logo_attachment_id)
        if att:
            logo = await blobstore().presigned_url(att.s3_key, filename=att.filename)
    atts = []
    for a in b["attachments"]:
        att = await session.get(Attachment, a["attachment_id"])
        atts.append({"number": a["number"], "title": a["title"], "url": await blobstore().presigned_url(att.s3_key, filename=att.filename) if att else None})
    valid = q.valid_until >= date.today()
    open_ = q.status == "sent" and valid
    if open_:
        turn, title, text = "client", "Teie kord", f"Pakkumine kehtib kuni {q.valid_until.strftime('%d.%m.%Y')}. Aktsepteerige, tehke ettepanek või lükake tagasi."
    elif q.status == "client_proposal":
        turn, title, text = "landlord", "Ootame üürileandja vastust", "Teie ettepanek on saadetud — üürileandja vaatab selle üle."
    elif q.status == "accepted":
        turn, title, text = "landlord", "Pakkumine on aktsepteeritud", "Üürileandja koostab lepingu mustandi ja saadab Teile lingi."
    elif q.status == "converted":
        turn, title, text = "none", "Lepingu mustand on koostatud", "Jätkake lepingu lingi kaudu."
    elif q.status == "rejected":
        turn, title, text = "none", "Lükkasite pakkumise tagasi", ""
    elif q.status == "cancelled":
        turn, title, text = "none", "Pakkumine on tühistatud", ""
    else:
        turn, title, text = "none", "Pakkumine aegus", f"Kehtivus lõppes {q.valid_until.strftime('%d.%m.%Y')}. Uue pakkumise saamiseks võtke ühendust üürileandjaga."
    return PortalQuoteOut(
        id=q.id, number=q.number, status=q.status, client_name=(q.contact or {}).get("name") or b["party"].name, party_name=b["party"].name,
        property_name=b["property"].name, property_address=(b["property"].attributes or {}).get("address"), valid_until=q.valid_until,
        days_left=quotes_domain.days_left(q), period_months=snap["period_months"], sent_version=q.sent_version, totals=snap["totals"],
        spaces=[PortalSpace(name=s["name"], area_m2=s["area_m2"], price_per_m2=s["price_per_m2"], monthly_net=s["line"]["monthly_net"], parking=s["parking"], electrical_a=s["electrical_a"]) for s in snap["spaces"]],
        special_terms=[t["text"] for t in snap["special_terms"]], attachments=atts,
        messages=[PortalMessage.model_validate(m, from_attributes=True) for m in b["messages"]],
        versions=[{"number": v.number, "created_at": v.created_at, "note": v.note, "changes": quotes_domain.diff_snapshots(versions[i - 1].snapshot, v.snapshot) if i else []} for i, v in enumerate(versions)],
        pdf_url=await document_versions.pdf_url(last), document_url=f"/api/v1/portal/{token}/document.html", can_respond=open_,
        can_extend=q.status == "client_proposal" and valid, whose_turn=turn, step_title=title, step_text=text,
        contact=PortalContact(company=company.name if company else None, email=company.email if company else None, phone=company.phone if company else None,
                              address=(b["property"].attributes or {}).get("address"), logo_url=logo),
        link_expires_at=link.expires_at,
    )


@router.get("/{token}", response_model=PortalQuoteOut)
async def portal_home(token: str, dep=PortalDep) -> PortalQuoteOut:
    session, pr = dep
    q = await quotes_domain.get_quote(session, _quote_of(pr.link))
    return await _out(session, pr.link, q, token)


@router.get("/{token}/document.html", response_class=HTMLResponse)
async def portal_document(token: str, dep=PortalDep) -> HTMLResponse:
    session, pr = dep
    q = await quotes_domain.get_quote(session, _quote_of(pr.link))
    b = await quotes_domain.quote_bundle(session, q, with_versions=False)
    return HTMLResponse(await quotes_domain.document_html(session, b, version=q.sent_version or None))


async def _act(session, pr, fn, *args) -> PortalQuoteOut:
    q = await quotes_domain.get_quote(session, _quote_of(pr.link))
    try:
        await fn(session, pr.actor, q, *args)
    except DomainError as e:
        if e.code == "expired":
            # the expiry transition above must be kept even though the action failed
            await session.flush()
        raise
    return q


@router.post("/{token}/accept", response_model=PortalQuoteOut)
async def accept(token: str, dep=PortalDep) -> PortalQuoteOut:
    session, pr = dep
    q = await _act(session, pr, quotes_domain.client_accept)
    return await _out(session, pr.link, q, token)


@router.post("/{token}/propose", response_model=PortalQuoteOut)
async def propose(token: str, body: TextIn, dep=PortalDep) -> PortalQuoteOut:
    session, pr = dep
    q = await _act(session, pr, quotes_domain.client_propose, body.text)
    return await _out(session, pr.link, q, token)


@router.post("/{token}/reject", response_model=PortalQuoteOut)
async def reject(token: str, body: ReasonIn | None = None, dep=PortalDep) -> PortalQuoteOut:
    session, pr = dep
    q = await _act(session, pr, quotes_domain.client_reject, (body or ReasonIn()).reason)
    return await _out(session, pr.link, q, token)


@router.post("/{token}/messages", response_model=PortalQuoteOut, status_code=201)
async def message(token: str, body: TextIn, dep=PortalDep) -> PortalQuoteOut:
    session, pr = dep
    q = await _act(session, pr, quotes_domain.client_message, body.text)
    return await _out(session, pr.link, q, token)
