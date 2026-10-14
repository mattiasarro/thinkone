"""Platform lease drafts (Phase 3.2): generation from a quote or from scratch, deal terms, clause wording, Lisa 3."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import document_versions as dv
from app.domain import leases as leases_domain
from app.domain import negotiation, share_links
from app.domain.clauses import to_dicts
from app.domain.contracts import get_contract
from app.domain.errors import DomainError
from app.models.contracts import Contract

router = APIRouter(prefix="/leases", tags=["leases"])


class SpaceTermsIn(BaseModel):
    space_id: uuid.UUID
    price_per_m2: float | None = None
    schedule: list[dict[str, Any]] | None = None
    parking_spot_ids: list[uuid.UUID] | None = None
    parking_count: int | None = None
    electrical_a: float | None = None


class LeaseCreateIn(BaseModel):
    party_id: uuid.UUID
    property_id: uuid.UUID
    spaces: list[SpaceTermsIn] = Field(min_length=1)
    company_id: uuid.UUID | None = None
    months: int = Field(default=60, ge=1, le=600)
    handover: date | None = None
    deposit_months: int | None = Field(default=None, ge=0, le=24)
    purpose: str | None = None


class ConvertIn(BaseModel):
    mode: str = Field(default="separate", pattern="^(separate|shared)$")
    handover: date | None = None


class TermsPatchIn(BaseModel):
    expected_version: int | None = None
    handover: date | None = None
    months: int | None = Field(default=None, ge=1, le=600)
    deposit_months: int | None = Field(default=None, ge=0, le=24)
    purpose: str | None = None
    term_notes: str | None = None
    indexation: dict[str, Any] | None = None
    representatives: dict[str, list[dict[str, str]]] | None = None
    spaces: list[dict[str, Any]] | None = None
    reason: str | None = None


class ContactIn(BaseModel):
    name: str = ""
    email: str = ""
    phone: str = ""


class ClauseTextIn(BaseModel):
    text: str = Field(min_length=1)
    reason: str | None = None
    allow_locked: bool = False


class SpecialIn(BaseModel):
    text: str = Field(min_length=1)
    overrides: str | None = None  # "main:<fact_key>" | "general:<clause id or number>"
    overrides_label: str | None = None
    status: str = Field(default="accepted", pattern="^(drafting|accepted)$")


class ClauseOut(BaseModel):
    id: uuid.UUID
    number: str
    heading: str | None
    text: str
    level: int
    locked: bool
    category: str
    container: str
    parent_id: uuid.UUID | None
    fact_key: str | None = None
    status: str | None = None
    origin_note: str | None = None
    overrides_clause_id: uuid.UUID | None = None
    overrides_label: str | None = None
    changed: bool = False
    provenance: dict[str, Any] | None = None


class AnnexOut(BaseModel):
    number: int
    title: str
    attachment_id: uuid.UUID | None
    kind: str
    space_id: uuid.UUID | None
    missing: bool


class DealSpaceOut(BaseModel):
    space_id: uuid.UUID
    name: str
    type: str | None
    area_m2: float
    price_per_m2: float
    schedule: list[dict[str, Any]] | None
    parking_numbers: list[str]
    parking_count: int
    electrical_a: float | None
    line: dict[str, Any]


class DealOut(BaseModel):
    vertical: str = "lease"
    handover: date
    end: date | None
    months: int | None
    deposit: float
    deposit_months: int
    purpose: str
    term_notes: str
    indexation: dict[str, Any]
    representatives: dict[str, list[dict[str, str]]]
    totals: dict[str, Any]
    spaces: list[DealSpaceOut]
    property: dict[str, Any] | None
    employment: dict[str, Any] | None = None  # position, department, salary, probation_end, salary_review, working_time, vacation_days, place, pay_day


class LeaseDraftOut(BaseModel):
    id: uuid.UUID
    number: str
    title: str
    status: str
    version: int
    sent_version: int
    quote_id: uuid.UUID | None
    party: dict[str, Any] | None
    company_id: uuid.UUID | None
    contact: ContactIn
    terms: dict[str, Any]
    deal: DealOut
    clauses: list[ClauseOut]
    annexes: list[AnnexOut]
    editable: bool
    round: dict[str, Any] | None
    sent_at: datetime | None
    accepted_at: datetime | None
    link: str


async def _out(session: AsyncSession, c: Contract) -> LeaseDraftOut:
    b = await leases_domain.bundle(session, c)
    d = b["deal"]
    party = b["party"]
    prop = d["property"]
    return LeaseDraftOut(
        id=c.id, number=c.number, title=c.title, status=c.status, version=c.version, sent_version=c.sent_version, quote_id=c.quote_id,
        party={"id": party.id, "name": party.name, "registry_code": party.registry_code} if party else None, company_id=c.company_id,
        contact=ContactIn(**{k: (c.contact or {}).get(k, "") or "" for k in ("name", "email", "phone")}), terms=c.terms or {},
        deal=DealOut(vertical=d["vertical"], handover=d["handover"], end=d["end"], months=d["months"], deposit=d["deposit"], deposit_months=d["deposit_months"], purpose=d["purpose"],
                     term_notes=d["term_notes"], indexation=d["indexation"], representatives=d["representatives"], totals=d["totals"],
                     spaces=[DealSpaceOut(**s) for s in d["spaces"]],
                     property={"id": prop.id, "name": prop.name, "attributes": {k: v for k, v in (prop.attributes or {}).items() if k in ("address", "vat_taxable", "has_parking")}} if prop else None,
                     employment={"position": {"id": d["position"].id, "name": d["position"].name}, "department": {"id": d["department"].id, "name": d["department"].name} if d["department"] else None,
                                 "salary": d["salary"], "probation_months": d["probation_months"], "probation_end": d["probation_end"], "salary_review": d["salary_review"],
                                 "working_time": d["working_time"], "vacation_days": d["vacation_days"], "place": d["place"], "pay_day": d["pay_day"]} if d["vertical"] == "employment" else None),
        clauses=[ClauseOut(**{k: v for k, v in x.items() if k in ClauseOut.model_fields}) for x in to_dicts(b["clauses"])],
        annexes=[AnnexOut(**a) for a in b["annexes"]], editable=c.status in leases_domain.EDITABLE_STATUSES, round=c.round, sent_at=c.sent_at, accepted_at=c.accepted_at,
        link=f"/app/portfell/leping/{c.id}",
    )


async def _platform(session: AsyncSession, contract_id: uuid.UUID) -> Contract:
    c = await get_contract(session, contract_id)
    if c.origin != "platform" or c.type_code not in ("lease", "employment"):
        raise DomainError("See ei ole platvormil koostatud leping", code="not_platform")
    return c


@router.post("", response_model=LeaseDraftOut, status_code=201)
async def create_lease(body: LeaseCreateIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    spaces = [{**s.model_dump(exclude={"space_id", "parking_spot_ids"}), "space_id": str(s.space_id), "parking_spot_ids": [str(x) for x in s.parking_spot_ids] if s.parking_spot_ids is not None else None} for s in body.spaces]
    c = await leases_domain.create_draft(session, p.actor, party_id=body.party_id, property_id=body.property_id, spaces=spaces, company_id=body.company_id,
                                         months=body.months, handover=body.handover, deposit_months=body.deposit_months, purpose=body.purpose)
    return await _out(session, c)


@router.post("/from-quote/{quote_id}", response_model=list[LeaseDraftOut], status_code=201)
async def convert_quote(quote_id: uuid.UUID, body: ConvertIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[LeaseDraftOut]:
    body = body or ConvertIn()
    drafts = await leases_domain.convert_quote(session, p.actor, quote_id, mode=body.mode, handover=body.handover)
    return [await _out(session, c) for c in drafts]


@router.get("/{contract_id}", response_model=LeaseDraftOut)
async def get_lease(contract_id: uuid.UUID, session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    return await _out(session, await _platform(session, contract_id))


@router.get("/{contract_id}/document.html", response_class=HTMLResponse)
async def lease_html(contract_id: uuid.UUID, session: AsyncSession = Depends(db)) -> HTMLResponse:
    c = await _platform(session, contract_id)
    return HTMLResponse(await leases_domain.document_html(session, await leases_domain.bundle(session, c), version=c.sent_version or None, interactive=True))


@router.patch("/{contract_id}/terms", response_model=LeaseDraftOut)
async def patch_terms(contract_id: uuid.UUID, body: TermsPatchIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    await _platform(session, contract_id)
    patch = body.model_dump(exclude={"expected_version", "reason"}, exclude_none=True)
    if "handover" in patch:
        patch["handover"] = patch["handover"].isoformat()
    if "spaces" in patch:
        for s in patch["spaces"]:
            s["space_id"] = str(s["space_id"])
            if s.get("parking_spot_ids") is not None:
                s["parking_spot_ids"] = [str(x) for x in s["parking_spot_ids"]]
    c = await leases_domain.update_terms(session, p.actor, contract_id, patch, expected_version=body.expected_version, reason=body.reason)
    return await _out(session, c)


@router.patch("/{contract_id}/contact", response_model=LeaseDraftOut)
async def patch_contact(contract_id: uuid.UUID, body: ContactIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    await _platform(session, contract_id)
    return await _out(session, await leases_domain.update_contact(session, p.actor, contract_id, body.model_dump()))


@router.patch("/{contract_id}/clauses/{clause_id}", response_model=LeaseDraftOut)
async def patch_clause(contract_id: uuid.UUID, clause_id: uuid.UUID, body: ClauseTextIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    c = await _platform(session, contract_id)
    await leases_domain.edit_clause_text(session, p.actor, c.id, clause_id, body.text, reason=body.reason, allow_locked=body.allow_locked)
    return await _out(session, c)


@router.post("/{contract_id}/special", response_model=LeaseDraftOut, status_code=201)
async def add_special(contract_id: uuid.UUID, body: SpecialIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    c = await _platform(session, contract_id)
    leases_domain._editable(c)
    await leases_domain.add_special_clause(session, p.actor, c, text=body.text, overrides=body.overrides, overrides_label=body.overrides_label, status=body.status, origin_note="operaator")
    c.version += 1
    return await _out(session, c)


@router.delete("/{contract_id}/special/{clause_id}", response_model=LeaseDraftOut)
async def remove_special(contract_id: uuid.UUID, clause_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    c = await _platform(session, contract_id)
    await leases_domain.remove_special_clause(session, p.actor, c.id, clause_id)
    return await _out(session, c)


# ---------------------------------------------------------------- negotiation (3.2) --------------------------------



class ThreadMessageOut(BaseModel):
    id: uuid.UUID
    author_type: str
    author_name: str | None
    body: str
    meta: dict[str, Any]
    created_at: datetime


class ThreadOut(BaseModel):
    id: uuid.UUID
    clause_id: uuid.UUID
    clause_number: str | None = None
    clause_heading: str | None = None
    opened_by: str
    status: str
    resolution: str | None
    resolution_label: str | None
    proposal: dict[str, Any] | None
    wish: dict[str, Any] | None
    round_nr: int | None
    unsent: bool
    whose_turn: str | None
    created_at: datetime
    resolved_at: datetime | None
    messages: list[ThreadMessageOut]


class RoundOut(BaseModel):
    nr: int
    side: str
    body: str | None
    version_no: int | None
    thread_ids: list[str]
    created_at: datetime


class LeaseVersionOut(BaseModel):
    number: int
    created_at: datetime
    note: str | None
    pdf_url: str | None
    changes: list[dict[str, Any]] = []


class NegotiationOut(BaseModel):
    threads: list[ThreadOut]
    rounds: list[RoundOut]
    versions: list[LeaseVersionOut]
    changes_since_v1: list[dict[str, Any]]
    link: dict[str, Any] | None
    letters: list[dict[str, Any]]
    next_step: dict[str, Any] | None
    turn: str | None
    can_send: bool
    pending_count: int
    unsent_count: int


class SendDraftIn(BaseModel):
    message: str | None = None
    expected_version: int | None = None


class RoundIn(BaseModel):
    body: str | None = None


class ThreadOpenIn(BaseModel):
    clause_id: uuid.UUID
    text: str = ""


class TextOnlyIn(BaseModel):
    text: str = Field(min_length=1)


class ProposeIn(BaseModel):
    kind: str = Field(pattern="^(fact|wording|special_term)$")
    text: str | None = None
    fact_key: str | None = None
    value: Any = None
    wording: str | None = None
    special_text: str | None = None
    overrides_label: str | None = None


class DecideIn(BaseModel):
    accept: bool
    text: str | None = None


async def _thread_out(session: AsyncSession, view: dict[str, Any], numbers: dict[uuid.UUID, tuple[str, str | None]]) -> ThreadOut:
    t = view["thread"]
    num, head = numbers.get(t.clause_id, (None, None))
    return ThreadOut(id=t.id, clause_id=t.clause_id, clause_number=num, clause_heading=head, opened_by=t.opened_by, status=t.status, resolution=t.resolution,
                     resolution_label=negotiation.fmt_label(t.resolution), proposal=t.proposal, wish=t.wish, round_nr=t.round_nr, unsent=view["unsent"],
                     whose_turn=view["whose_turn"], created_at=t.created_at, resolved_at=t.resolved_at,
                     messages=[ThreadMessageOut.model_validate(m, from_attributes=True) for m in view["messages"]])


async def _negotiation(session: AsyncSession, c: Contract) -> NegotiationOut:
    st = await negotiation.state(session, c, side="operator")
    b = await leases_domain.bundle(session, c)
    numbers = {r.id: (r.display_number, r.heading) for r in b["clauses"]}
    versions, prev = [], None
    for v in st["versions"]:
        versions.append(LeaseVersionOut(number=v.number, created_at=v.created_at, note=v.note, pdf_url=await dv.pdf_url(v),
                                        changes=negotiation.diff_versions(prev.snapshot, v.snapshot) if prev else []))
        prev = v
    v1 = st["versions"][0] if st["versions"] else None
    since = negotiation.diff_versions(v1.snapshot, negotiation._snapshot(b)) if v1 else []
    link = st["link"]
    turn = (c.round or {}).get("side") if c.status in ("sent", "negotiating") else ("operator" if c.status == "draft" else None)
    pending = [v for v in st["open"] if v["whose_turn"] == "operator"]
    return NegotiationOut(
        threads=[await _thread_out(session, v, numbers) for v in st["threads"]],
        rounds=[RoundOut(nr=r.nr, side=r.side, body=r.body, version_no=r.version_no, thread_ids=r.thread_ids, created_at=r.created_at) for r in st["rounds"]],
        versions=versions, changes_since_v1=since,
        link={"email": link.email, "expires_at": link.expires_at, "opened_at": link.opened_at, "url": share_links.portal_url(share_links.token_for(link))} if link and share_links.is_live(link) else None,
        letters=[{"id": n.id, "kind": n.kind, "title": n.title, "to": n.recipient_email, "status": n.email_status, "error": n.email_error, "created_at": n.created_at} for n in st["letters"]],
        next_step=negotiation.next_step(c, st), turn=turn, can_send=turn == "operator" and not pending and c.status != "draft", pending_count=len(pending), unsent_count=len(st["unsent"]),
    )


@router.get("/{contract_id}/negotiation", response_model=NegotiationOut)
async def get_negotiation(contract_id: uuid.UUID, session: AsyncSession = Depends(db)) -> NegotiationOut:
    return await _negotiation(session, await _platform(session, contract_id))


@router.post("/{contract_id}/send", response_model=NegotiationOut)
async def send_draft(contract_id: uuid.UUID, body: SendDraftIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NegotiationOut:
    body = body or SendDraftIn()
    r = await negotiation.send_draft(session, p.actor, contract_id, message=body.message, expected_version=body.expected_version)
    return await _negotiation(session, r["contract"])


@router.post("/{contract_id}/round", response_model=NegotiationOut)
async def send_round(contract_id: uuid.UUID, body: RoundIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NegotiationOut:
    c = await _platform(session, contract_id)
    await negotiation.send_round(session, p.actor, c, side="operator", body=(body or RoundIn()).body)
    return await _negotiation(session, c)


@router.post("/{contract_id}/cancel", response_model=LeaseDraftOut)
async def cancel_lease(contract_id: uuid.UUID, body: RoundIn | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    return await _out(session, await negotiation.cancel(session, p.actor, contract_id, (body or RoundIn()).body))


@router.post("/{contract_id}/threads", response_model=NegotiationOut, status_code=201)
async def open_thread(contract_id: uuid.UUID, body: ThreadOpenIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NegotiationOut:
    c = await _platform(session, contract_id)
    await negotiation.open_thread(session, p.actor, c, clause_id=body.clause_id, side="operator", text=body.text, author_name=await negotiation._sender_name(session, p.actor, c))
    return await _negotiation(session, c)


@router.post("/{contract_id}/threads/{thread_id}/explain", response_model=NegotiationOut)
async def explain(contract_id: uuid.UUID, thread_id: uuid.UUID, body: TextOnlyIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NegotiationOut:
    c = await _platform(session, contract_id)
    await negotiation.explain(session, p.actor, c, await negotiation.get_thread(session, c.id, thread_id), body.text)
    return await _negotiation(session, c)


@router.post("/{contract_id}/threads/{thread_id}/answer", response_model=NegotiationOut)
async def answer(contract_id: uuid.UUID, thread_id: uuid.UUID, body: TextOnlyIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NegotiationOut:
    c = await _platform(session, contract_id)
    await negotiation.answer_only(session, p.actor, c, await negotiation.get_thread(session, c.id, thread_id), body.text)
    return await _negotiation(session, c)


@router.post("/{contract_id}/threads/{thread_id}/propose", response_model=NegotiationOut)
async def propose(contract_id: uuid.UUID, thread_id: uuid.UUID, body: ProposeIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NegotiationOut:
    c = await _platform(session, contract_id)
    await negotiation.propose(session, p.actor, c, await negotiation.get_thread(session, c.id, thread_id), kind=body.kind, text=body.text, fact_key=body.fact_key,
                              value=body.value, wording=body.wording, special_text=body.special_text, overrides_label=body.overrides_label, side="operator")
    return await _negotiation(session, c)


@router.post("/{contract_id}/threads/{thread_id}/decide", response_model=NegotiationOut)
async def decide(contract_id: uuid.UUID, thread_id: uuid.UUID, body: DecideIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NegotiationOut:
    c = await _platform(session, contract_id)
    await negotiation.decide(session, p.actor, c, await negotiation.get_thread(session, c.id, thread_id), side="operator", accept=body.accept, text=body.text,
                             author_name=await negotiation._sender_name(session, p.actor, c))
    return await _negotiation(session, c)


@router.post("/{contract_id}/threads/{thread_id}/unchanged", response_model=NegotiationOut)
async def unchanged(contract_id: uuid.UUID, thread_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> NegotiationOut:
    c = await _platform(session, contract_id)
    await negotiation.mark_ok(session, p.actor, c, await negotiation.get_thread(session, c.id, thread_id), side="operator", author_name=await negotiation._sender_name(session, p.actor, c))
    return await _negotiation(session, c)


@router.get("/{contract_id}/versions/{number}/document.html", response_class=HTMLResponse)
async def version_html(contract_id: uuid.UUID, number: int, session: AsyncSession = Depends(db)) -> HTMLResponse:
    c = await _platform(session, contract_id)
    v = await dv.get_version(session, "contract", c.id, number)
    if not v:
        from app.domain.errors import NotFound

        raise NotFound("Versiooni ei leitud")
    from app.infra.blobstore import blobstore

    if v.pdf_s3_key:
        return HTMLResponse(f'<meta http-equiv="refresh" content="0;url={await blobstore().presigned_url(v.pdf_s3_key)}">')
    return HTMLResponse(await leases_domain.document_html(session, await leases_domain.bundle(session, c), version=v.number))


class ChatIn(BaseModel):
    body: str = Field(min_length=1)


class EmploymentCreateIn(BaseModel):
    party_id: uuid.UUID
    position_id: uuid.UUID
    salary: float = Field(gt=0)
    start: date
    months: int | None = Field(default=None, ge=1, le=600)
    probation_months: int = Field(default=4, ge=0, le=4)
    working_time: str | None = None
    place: str | None = None
    salary_review: date | None = None
    vacation_days: int = Field(default=28, ge=0, le=60)
    pay_day: int = Field(default=10, ge=1, le=28)
    company_id: uuid.UUID | None = None


class EmploymentTermsPatchIn(BaseModel):
    expected_version: int | None = None
    start: date | None = None
    months: int | None = Field(default=None, ge=1, le=600)
    salary: float | None = Field(default=None, gt=0)
    probation_months: int | None = Field(default=None, ge=0, le=4)
    working_time: str | None = None
    place: str | None = None
    salary_review: date | None = None
    vacation_days: int | None = Field(default=None, ge=0, le=60)
    pay_day: int | None = Field(default=None, ge=1, le=28)
    term_notes: str | None = None
    reason: str | None = None


@router.post("/employment", response_model=LeaseDraftOut, status_code=201)
async def create_employment(body: EmploymentCreateIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    """Tööleping draft on a position — the second contract type on the same engine (spec: vertical = config + thin module)."""
    from app.domain import employment

    c = await employment.create_draft(session, p.actor, party_id=body.party_id, position_id=body.position_id, salary=body.salary, start=body.start, months=body.months,
                                      probation_months=body.probation_months, working_time=body.working_time, place=body.place, salary_review=body.salary_review,
                                      vacation_days=body.vacation_days, pay_day=body.pay_day, company_id=body.company_id)
    return await _out(session, c)


@router.patch("/{contract_id}/employment-terms", response_model=LeaseDraftOut)
async def patch_employment_terms(contract_id: uuid.UUID, body: EmploymentTermsPatchIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> LeaseDraftOut:
    from app.domain import employment

    c = await _platform(session, contract_id)
    if c.type_code != "employment":
        raise DomainError("See ei ole tööleping")
    patch = body.model_dump(exclude={"expected_version", "reason"}, exclude_none=True)
    for k in ("start", "salary_review"):
        if k in patch:
            patch[k] = patch[k].isoformat()
    c = await employment.update_terms(session, p.actor, contract_id, patch, expected_version=body.expected_version, reason=body.reason)
    return await _out(session, c)


@router.get("/{contract_id}/chat")
async def chat_list(contract_id: uuid.UUID, session: AsyncSession = Depends(db)) -> list[dict[str, Any]]:
    from app.domain import messages as messages_domain

    c = await _platform(session, contract_id)
    return [{"id": m.id, "author_type": m.author_type, "author_name": m.author_name, "body": m.body, "created_at": m.created_at, "channel": m.channel, "meta": m.meta}
            for m in await messages_domain.list_for(session, "contract", c.id, channel="chat")]


@router.post("/{contract_id}/chat", status_code=201)
async def chat_post(contract_id: uuid.UUID, body: ChatIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[dict[str, Any]]:
    from app.domain import messages as messages_domain
    from app.domain.notify import notify

    c = await _platform(session, contract_id)
    sender = await negotiation._sender_name(session, p.actor, c)
    await messages_domain.post(session, p.actor, subject_type="contract", subject_id=c.id, channel="chat", author_type="operator", author_name=sender, body=body.body)
    link = await share_links.current_link(session, "contract", c.id)
    email = (c.contact or {}).get("email")
    if link and email and share_links.is_live(link):
        await notify(session, p.actor, kind="contract.message", title=f"Uus sõnum lepingu {c.number} kohta", body=f"{sender}:\n\n{body.body}",
                     link=share_links.portal_path(share_links.token_for(link)), recipient_email=email, subject_type="contract", subject_id=c.id)
    return await chat_list(contract_id, session)


@router.post("/{contract_id}/chat/read", status_code=204)
async def chat_read(contract_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> None:
    from app.domain import messages as messages_domain

    await _platform(session, contract_id)
    await messages_domain.mark_read(session, p.actor, "contract", contract_id)
