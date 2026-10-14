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
from app.domain import leases as leases_domain
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
    handover: date
    end: date
    months: int
    deposit: float
    deposit_months: int
    purpose: str
    term_notes: str
    indexation: dict[str, Any]
    representatives: dict[str, list[dict[str, str]]]
    totals: dict[str, Any]
    spaces: list[DealSpaceOut]
    property: dict[str, Any] | None


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
        deal=DealOut(handover=d["handover"], end=d["end"], months=d["months"], deposit=d["deposit"], deposit_months=d["deposit_months"], purpose=d["purpose"],
                     term_notes=d["term_notes"], indexation=d["indexation"], representatives=d["representatives"], totals=d["totals"],
                     spaces=[DealSpaceOut(**s) for s in d["spaces"]],
                     property={"id": prop.id, "name": prop.name, "attributes": {k: v for k, v in (prop.attributes or {}).items() if k in ("address", "vat_taxable", "has_parking")}} if prop else None),
        clauses=[ClauseOut(**{k: v for k, v in x.items() if k in ClauseOut.model_fields}) for x in to_dicts(b["clauses"])],
        annexes=[AnnexOut(**a) for a in b["annexes"]], editable=c.status in leases_domain.EDITABLE_STATUSES, round=c.round, sent_at=c.sent_at, accepted_at=c.accepted_at,
        link=f"/app/portfell/leping/{c.id}",
    )


async def _platform(session: AsyncSession, contract_id: uuid.UUID) -> Contract:
    c = await get_contract(session, contract_id)
    if c.origin != "platform" or c.type_code != "lease":
        raise DomainError("See ei ole platvormil koostatud üürileping", code="not_platform")
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
    return HTMLResponse(await leases_domain.document_html(session, await leases_domain.bundle(session, c), version=c.sent_version or None))


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
