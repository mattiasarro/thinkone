"""Operator quote endpoints — stage 04. The portal (client) side lives in app/api/portal."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Query, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import attachments as attachments_domain
from app.domain import document_versions, share_links
from app.domain import messages as messages_domain
from app.domain import quotes as quotes_domain
from app.domain.attachments import ALLOWED_TYPES
from app.infra.blobstore import blobstore
from app.models.quotes import Quote

router = APIRouter(prefix="/quotes", tags=["quotes"])


# ---------------------------------------------------------------- schemas ------------------------------------------


class Ref(BaseModel):
    id: uuid.UUID
    name: str


class PartyRef(Ref):
    registry_code: str | None = None
    email: str | None = None


class Contact(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""


class Feature(BaseModel):
    label: str
    value: str = ""


class SpotOut(BaseModel):
    id: uuid.UUID
    number: str | None
    zone: str | None = None
    type: str | None = None
    space_id: str | None = None
    out_of_service: bool = False
    reserve: bool = False


class ParkingOut(BaseModel):
    mode: str
    spots: list[SpotOut]
    count: int | None


class LineOut(BaseModel):
    area_m2: float
    price_per_m2: float
    avg_price_per_m2: float
    monthly_net: float
    monthly_net_avg: float
    stepped: bool


class SpaceOut(BaseModel):
    id: uuid.UUID
    space_id: uuid.UUID
    name: str
    type: str | None
    area_m2: float
    parts: str | None
    list_price: float | None
    price_per_m2: float
    price_override: float | None
    schedule: list[dict[str, Any]] | None
    parking: ParkingOut
    electrical_a: float | None
    electrical_override: float | None
    electrical_space: float | None
    floor_plan: dict[str, Any] | None
    line: LineOut


class TermOut(BaseModel):
    id: uuid.UUID
    text: str
    overrides: str | None
    overrides_label: str | None
    auto_kind: str | None
    space_id: uuid.UUID | None


class AttachmentItemOut(BaseModel):
    number: int
    title: str
    attachment_id: uuid.UUID
    kind: str
    space_id: uuid.UUID | None
    url: str | None = None


class VersionOut(BaseModel):
    id: uuid.UUID
    number: int
    created_at: datetime
    note: str | None
    pdf_url: str | None
    changes: list[dict[str, Any]] = []


class MessageOut(BaseModel):
    id: uuid.UUID
    channel: str
    author_type: str
    author_name: str | None
    body: str
    meta: dict[str, Any]
    created_at: datetime


class LetterOut(BaseModel):
    id: uuid.UUID
    kind: str
    title: str
    to: str | None
    status: str
    error: str | None
    created_at: datetime


class NextStepOut(BaseModel):
    side: str
    code: str
    title: str
    text: str
    urgent: bool = False


class LinkOut(BaseModel):
    email: str
    expires_at: datetime
    opened_at: datetime | None
    url: str


class QuoteOut(BaseModel):
    id: uuid.UUID
    number: str
    status: str
    party: PartyRef
    property: Ref
    company_id: uuid.UUID | None
    valid_until: date
    period_months: int
    totals: dict[str, Any]
    version: int
    sent_version: int
    sent_at: datetime | None
    accepted_at: datetime | None
    created_at: datetime
    space_names: list[str] = []
    next_step: NextStepOut | None = None
    unread: int = 0


class QuoteDetailOut(QuoteOut):
    contact: Contact
    commercial_text: str
    features: list[Feature]
    spaces: list[SpaceOut]
    special_terms: list[TermOut]
    attachments: list[AttachmentItemOut]
    versions: list[VersionOut]
    messages: list[MessageOut]
    letters: list[LetterOut]
    link: LinkOut | None
    pending_changes: list[dict[str, Any]]
    reminder: dict[str, Any] | None
    delivery: dict[str, Any] | None
    editable: bool
    has_register: bool
    register_spots: list[SpotOut]
    conversion: dict[str, Any] | None
    close_reason: str | None
    property_attributes: dict[str, Any]
    pdf_available: bool


class QuoteCreateIn(BaseModel):
    party_id: uuid.UUID
    property_id: uuid.UUID
    space_ids: list[uuid.UUID] = Field(min_length=1)
    company_id: uuid.UUID | None = None
    period_months: int | None = Field(default=None, ge=1, le=600)
    validity_days: int | None = Field(default=None, ge=0, le=365)


class QuotePatchIn(BaseModel):
    expected_version: int | None = None
    period_months: int | None = Field(default=None, ge=1, le=600)
    valid_until: date | None = None
    contact: Contact | None = None
    commercial_text: str | None = None
    features: list[Feature] | None = None
    company_id: uuid.UUID | None = None


class SpacePatchIn(BaseModel):
    expected_version: int | None = None
    price_per_m2: float | None = None
    clear_price: bool = False
    schedule: list[dict[str, Any]] | None = None
    clear_schedule: bool = False
    parking_spot_ids: list[uuid.UUID] | None = None
    parking_count: int | None = None
    clear_parking_count: bool = False
    electrical_a: float | None = None
    clear_electrical: bool = False


class TermIn(BaseModel):
    text: str
    expected_version: int | None = None


class SendIn(BaseModel):
    message: str | None = None
    expected_version: int | None = None


class MessageIn(BaseModel):
    body: str = Field(min_length=1)
    channel: str = "chat"


class ReasonIn(BaseModel):
    reason: str | None = None


class RemindIn(BaseModel):
    text: str | None = None


class SnoozeIn(BaseModel):
    days: int = Field(default=3, ge=1, le=60)


class ResendIn(BaseModel):
    email: str | None = None


# ---------------------------------------------------------------- serializers --------------------------------------


def _summary(q: Quote, party, prop, *, space_names: list[str] | None = None, next_step: dict[str, Any] | None = None, unread: int = 0) -> QuoteOut:
    return QuoteOut(id=q.id, number=q.number, status=q.status, party=PartyRef(id=party.id, name=party.name, registry_code=party.registry_code, email=party.email),
                    property=Ref(id=prop.id, name=prop.name), company_id=q.company_id, valid_until=q.valid_until, period_months=q.period_months,
                    totals=q.totals or {}, version=q.version, sent_version=q.sent_version, sent_at=q.sent_at, accepted_at=q.accepted_at, created_at=q.created_at,
                    space_names=space_names or [], next_step=NextStepOut(**next_step) if next_step else None, unread=unread)


async def _detail(session: AsyncSession, q: Quote) -> QuoteDetailOut:
    b = await quotes_domain.quote_bundle(session, q)
    base = _summary(q, b["party"], b["property"], space_names=[s["name"] for s in b["spaces"]], next_step=b["next_step"])
    versions: list[VersionOut] = []
    prev = None
    for v in b["versions"]:
        versions.append(VersionOut(id=v.id, number=v.number, created_at=v.created_at, note=v.note, pdf_url=await document_versions.pdf_url(v),
                                   changes=quotes_domain.diff_snapshots(prev.snapshot, v.snapshot) if prev else []))
        prev = v
    atts = []
    for a in b["attachments"]:
        att = await attachments_domain.get_attachment(session, a["attachment_id"])
        atts.append(AttachmentItemOut(**a, url=await blobstore().presigned_url(att.s3_key, filename=att.filename)))
    link = b["link"]
    return QuoteDetailOut(
        **base.model_dump(), contact=Contact(**{k: (q.contact or {}).get(k, "") or "" for k in ("name", "email", "phone")}),
        commercial_text=(q.commercial or {}).get("text") or "", features=[Feature(**f) for f in (q.features or [])],
        spaces=[SpaceOut(**{**s, "parking": ParkingOut(**s["parking"]), "line": LineOut(**s["line"])}) for s in b["spaces"]],
        special_terms=[TermOut(**t) for t in b["special_terms"]], attachments=atts, versions=versions,
        messages=[MessageOut.model_validate(m, from_attributes=True) for m in b["messages"]],
        letters=[LetterOut(id=n.id, kind=n.kind, title=n.title, to=n.recipient_email, status=n.email_status, error=n.email_error, created_at=n.created_at) for n in b["letters"]],
        link=LinkOut(email=link.email, expires_at=link.expires_at, opened_at=link.opened_at, url=share_links.portal_url(share_links.token_for(link))) if link and share_links.is_live(link) else None,
        pending_changes=b["pending_changes"], reminder=b["reminder"], delivery=quotes_domain.delivery_state(b), editable=q.status in quotes_domain.EDITABLE,
        has_register=b["has_register"], register_spots=[SpotOut(**s) for s in b["register_spots"]], conversion=q.conversion, close_reason=q.close_reason,
        property_attributes={k: v for k, v in (b["property"].attributes or {}).items() if k in ("address", "vat_taxable", "utility_cost_winter", "utility_cost_summer", "utility_source", "has_parking")},
        pdf_available=bool(b["versions"] and b["versions"][-1].pdf_s3_key),
    )


# ---------------------------------------------------------------- routes -------------------------------------------


@router.get("", response_model=list[QuoteOut])
async def list_quotes(view: str = Query(default="open", pattern="^(open|closed|all)$"), status: str | None = None, q: str | None = None,
                      party_id: uuid.UUID | None = None, property_id: uuid.UUID | None = None, space_id: uuid.UUID | None = None,
                      session: AsyncSession = Depends(db)) -> list[QuoteOut]:
    rows = await quotes_domain.list_quotes(session, view=view, status=status, q=q, party_id=party_id, property_id=property_id, space_id=space_id)
    ids = [x.id for x, _, _ in rows]
    unread = await messages_domain.unread_counts(session, "quote", ids)
    out = []
    for x, party, prop in rows:
        b = await quotes_domain.quote_bundle(session, x)
        out.append(_summary(x, party, prop, space_names=[s["name"] for s in b["spaces"]], next_step=b["next_step"], unread=unread.get(x.id, 0)))
    return out


@router.post("", response_model=QuoteDetailOut, status_code=201)
async def create_quote(body: QuoteCreateIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    q = await quotes_domain.create_quote(session, p.actor, party_id=body.party_id, property_id=body.property_id, space_ids=body.space_ids,
                                         company_id=body.company_id, period_months=body.period_months, validity_days=body.validity_days)
    return await _detail(session, q)


@router.get("/{quote_id}", response_model=QuoteDetailOut)
async def get_quote(quote_id: uuid.UUID, session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    return await _detail(session, await quotes_domain.get_quote(session, quote_id))


@router.patch("/{quote_id}", response_model=QuoteDetailOut)
async def patch_quote(quote_id: uuid.UUID, body: QuotePatchIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    q = await quotes_domain.update_quote(session, p.actor, quote_id, expected_version=body.expected_version, period_months=body.period_months,
                                         valid_until=body.valid_until, contact=body.contact.model_dump() if body.contact else None,
                                         commercial_text=body.commercial_text, features=[f.model_dump() for f in body.features] if body.features is not None else None,
                                         company_id=body.company_id)
    return await _detail(session, q)


@router.delete("/{quote_id}", status_code=204)
async def delete_quote(quote_id: uuid.UUID, reason: str | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> None:
    await quotes_domain.soft_delete(session, p.actor, quote_id, reason)


@router.get("/{quote_id}/document.html", response_class=HTMLResponse)
async def document_html(quote_id: uuid.UUID, version: int | None = None, session: AsyncSession = Depends(db)) -> HTMLResponse:
    q = await quotes_domain.get_quote(session, quote_id)
    b = await quotes_domain.quote_bundle(session, q, with_versions=False)
    return HTMLResponse(await quotes_domain.document_html(session, b, version=version or (q.sent_version or None)))


@router.post("/{quote_id}/spaces/{space_id}", response_model=QuoteDetailOut)
async def add_space(quote_id: uuid.UUID, space_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    return await _detail(session, await quotes_domain.add_space(session, p.actor, quote_id, space_id))


@router.delete("/{quote_id}/spaces/{space_id}", response_model=QuoteDetailOut)
async def remove_space(quote_id: uuid.UUID, space_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    return await _detail(session, await quotes_domain.remove_space(session, p.actor, quote_id, space_id))


@router.patch("/{quote_id}/spaces/{space_id}", response_model=QuoteDetailOut)
async def patch_space(quote_id: uuid.UUID, space_id: uuid.UUID, body: SpacePatchIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    kw: dict[str, Any] = {}
    if body.clear_price:
        kw["price_per_m2"] = None
    elif body.price_per_m2 is not None:
        kw["price_per_m2"] = body.price_per_m2
    if body.clear_schedule:
        kw["schedule"] = None
    elif body.schedule is not None:
        kw["schedule"] = body.schedule
    if body.parking_spot_ids is not None:
        kw["parking_spot_ids"] = [str(x) for x in body.parking_spot_ids]
    if body.clear_parking_count:
        kw["parking_count"] = None
    elif body.parking_count is not None:
        kw["parking_count"] = body.parking_count
    if body.clear_electrical:
        kw["electrical_a"] = None
    elif body.electrical_a is not None:
        kw["electrical_a"] = body.electrical_a
    q = await quotes_domain.update_space(session, p.actor, quote_id, space_id, expected_version=body.expected_version, **kw)
    return await _detail(session, q)


@router.post("/{quote_id}/terms", response_model=QuoteDetailOut, status_code=201)
async def add_term(quote_id: uuid.UUID, body: TermIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    await quotes_domain.add_special_term(session, p.actor, quote_id, body.text, expected_version=body.expected_version)
    return await _detail(session, await quotes_domain.get_quote(session, quote_id))


@router.patch("/{quote_id}/terms/{term_id}", response_model=QuoteDetailOut)
async def update_term(quote_id: uuid.UUID, term_id: uuid.UUID, body: TermIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    await quotes_domain.update_special_term(session, p.actor, quote_id, term_id, body.text, expected_version=body.expected_version)
    return await _detail(session, await quotes_domain.get_quote(session, quote_id))


@router.delete("/{quote_id}/terms/{term_id}", response_model=QuoteDetailOut)
async def remove_term(quote_id: uuid.UUID, term_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    await quotes_domain.remove_special_term(session, p.actor, quote_id, term_id)
    return await _detail(session, await quotes_domain.get_quote(session, quote_id))


@router.post("/{quote_id}/attachments", response_model=QuoteDetailOut, status_code=201)
async def upload_attachment(quote_id: uuid.UUID, file: UploadFile = File(...), p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    q = await quotes_domain.get_quote(session, quote_id)
    if q.status not in quotes_domain.EDITABLE:
        from app.domain.errors import DomainError

        raise DomainError("Lisasid saab lisada mustandis või kliendi ettepaneku ajal")
    data = await file.read()
    await attachments_domain.store_file(session, p.actor, subject_type="quote", subject_id=q.id, role="annex", filename=file.filename or "lisa",
                                        content_type=file.content_type, data=data, allowed_types=ALLOWED_TYPES)
    await quotes_domain.refresh(session, p.actor, q)
    return await _detail(session, q)


@router.delete("/{quote_id}/attachments/{attachment_id}", response_model=QuoteDetailOut)
async def delete_attachment(quote_id: uuid.UUID, attachment_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    q = await quotes_domain.get_quote(session, quote_id)
    att = await attachments_domain.get_attachment(session, attachment_id)
    if att.subject_type != "quote" or att.subject_id != q.id:
        from app.domain.errors import NotFound

        raise NotFound("Manust ei leitud")
    await attachments_domain.delete_attachment(session, p.actor, attachment_id)
    await quotes_domain.refresh(session, p.actor, q)
    return await _detail(session, q)


@router.post("/{quote_id}/send", response_model=QuoteDetailOut)
async def send_quote(quote_id: uuid.UUID, body: SendIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    body = body or SendIn()
    r = await quotes_domain.send(session, p.actor, quote_id, message=body.message, expected_version=body.expected_version)
    return await _detail(session, r["quote"])


@router.post("/{quote_id}/cancel", response_model=QuoteDetailOut)
async def cancel_quote(quote_id: uuid.UUID, body: ReasonIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    return await _detail(session, await quotes_domain.cancel(session, p.actor, quote_id, (body or ReasonIn()).reason))


@router.post("/{quote_id}/remind", response_model=QuoteDetailOut)
async def remind(quote_id: uuid.UUID, body: RemindIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    await quotes_domain.remind(session, p.actor, quote_id, (body or RemindIn()).text)
    return await _detail(session, await quotes_domain.get_quote(session, quote_id))


@router.post("/{quote_id}/snooze", response_model=QuoteDetailOut)
async def snooze(quote_id: uuid.UUID, body: SnoozeIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    return await _detail(session, await quotes_domain.snooze(session, p.actor, quote_id, (body or SnoozeIn()).days))


@router.post("/{quote_id}/resend-letter", response_model=QuoteDetailOut)
async def resend_letter(quote_id: uuid.UUID, body: ResendIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    await quotes_domain.resend_letter(session, p.actor, quote_id, email=(body or ResendIn()).email)
    return await _detail(session, await quotes_domain.get_quote(session, quote_id))


@router.post("/{quote_id}/messages", response_model=QuoteDetailOut, status_code=201)
async def post_message(quote_id: uuid.UUID, body: MessageIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> QuoteDetailOut:
    await quotes_domain.post_operator_message(session, p.actor, quote_id, body.body, channel=body.channel if body.channel in messages_domain.CHANNELS else "chat")
    return await _detail(session, await quotes_domain.get_quote(session, quote_id))


@router.post("/{quote_id}/messages/read", status_code=204)
async def mark_messages_read(quote_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> None:
    await quotes_domain.get_quote(session, quote_id)
    await messages_domain.mark_read(session, p.actor, "quote", quote_id)


@router.get("/{quote_id}/versions/{number}/document.html", response_class=HTMLResponse)
async def version_html(quote_id: uuid.UUID, number: int, session: AsyncSession = Depends(db)) -> HTMLResponse:
    """A frozen version, rendered from its snapshot (what the client saw)."""
    q = await quotes_domain.get_quote(session, quote_id)
    v = await document_versions.get_version(session, "quote", q.id, number)
    if not v:
        from app.domain.errors import NotFound

        raise NotFound("Versiooni ei leitud")
    b = await quotes_domain.quote_bundle(session, q, with_versions=False)
    return HTMLResponse(await quotes_domain.document_html(session, b, version=v.number))
