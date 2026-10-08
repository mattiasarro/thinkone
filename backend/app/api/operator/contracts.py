from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import contract_parties, portfolio
from app.domain import imports as imports_domain
from app.infra.blobstore import blobstore

router = APIRouter(prefix="/contracts", tags=["contracts"])


class PartyRef(BaseModel):
    id: uuid.UUID
    name: str
    registry_code: str | None = None


class KeyDateRef(BaseModel):
    kind_code: str
    due_date: date


class ContractOut(BaseModel):
    id: uuid.UUID
    number: str
    title: str
    status: str
    origin: str
    type_code: str
    category: str | None
    party: PartyRef | None
    company_id: uuid.UUID | None
    start_date: date | None
    end_date: date | None
    signed_at: date | None
    current_values: dict[str, Any]
    has_clause_tree: bool
    version: int
    created_at: datetime
    key_dates_next: KeyDateRef | None = None


class FactOut(BaseModel):
    id: uuid.UUID
    key: str
    label: str | None
    value: str | None
    unit: str | None
    text: str | None
    valid_from: date | None
    valid_to: date | None
    reason: str
    recorded_at: datetime
    provenance: dict[str, Any] | None


class KeyDateOut(BaseModel):
    id: uuid.UUID
    kind_code: str
    title: str
    due_date: date
    notify_days_before: int
    fired_at: datetime | None
    provenance: dict[str, Any] | None


class SourceViewOut(BaseModel):
    """What the contract page needs to show the signed original at a provenance anchor."""
    id: uuid.UUID
    filename: str
    format: str
    page_count: int | None
    pdf_url: str | None  # the PDF itself, or the PDF datafile inside an ASiC-E container
    text_pages: list[dict[str, Any]] | None  # extracted text per page — fallback when there is no PDF to embed


class AllocationOut(BaseModel):
    id: uuid.UUID
    kind: str
    quantity: int
    period_start: date | None
    period_end: date | None
    asset: dict[str, Any]


class SourceDocOut(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    role: str
    format: str
    has_text_layer: bool
    page_count: int | None
    container_signatures: list[dict[str, Any]] | None
    url: str | None
    created_at: datetime


class AttachmentOut(BaseModel):
    id: uuid.UUID
    role: str
    filename: str
    content_type: str
    size: int
    created_at: datetime


class ContractPartyOut(BaseModel):
    id: uuid.UUID
    party: PartyRef
    role: str
    is_primary: bool
    valid_from: date | None
    valid_to: date | None
    source: str


class ContractPartyIn(BaseModel):
    party_id: uuid.UUID
    role: str
    is_primary: bool = False
    valid_from: date | None = None


class ContractPartyPatch(BaseModel):
    role: str | None = None
    is_primary: bool | None = None
    valid_from: date | None = None
    valid_to: date | None = None


class ContractDetailOut(ContractOut):
    notes: str | None
    parties: list[ContractPartyOut] = []
    facts: list[FactOut]
    key_dates: list[KeyDateOut]
    allocations: list[AllocationOut]
    source_documents: list[SourceDocOut]
    attachments: list[AttachmentOut]
    clauses: list[dict[str, Any]]


class ContractPatchIn(BaseModel):
    title: str | None = None
    notes: str | None = None
    category: str | None = None
    company_id: uuid.UUID | None = None
    status: str | None = None
    end_date: date | None = None
    expected_version: int | None = None


def _out(c, p, kd=None) -> ContractOut:
    return ContractOut(id=c.id, number=c.number, title=c.title, status=c.status, origin=c.origin, type_code=c.type_code, category=c.category,
                       party=PartyRef(id=p.id, name=p.name, registry_code=p.registry_code) if p else None, company_id=c.company_id,
                       start_date=c.start_date, end_date=c.end_date, signed_at=c.signed_at, current_values=c.current_values or {},
                       has_clause_tree=c.has_clause_tree, version=c.version, created_at=c.created_at,
                       key_dates_next=KeyDateRef(kind_code=kd.kind_code, due_date=kd.due_date) if kd else None)


def _cp_out(cp, p) -> ContractPartyOut:
    return ContractPartyOut(id=cp.id, party=PartyRef(id=p.id, name=p.name, registry_code=p.registry_code), role=cp.role, is_primary=cp.is_primary,
                            valid_from=cp.valid_from, valid_to=cp.valid_to, source=cp.source)


@router.get("", response_model=list[ContractOut])
async def list_contracts(status: str | None = None, type_code: str | None = None, category: str | None = None, q: str | None = None,
                         view: str = "active", party_id: uuid.UUID | None = None, company_id: uuid.UUID | None = None,
                         session: AsyncSession = Depends(db)) -> list[ContractOut]:
    rows = await portfolio.list_contracts(session, status=status, type_code=type_code, category=category, q=q, view=view, party_id=party_id, company_id=company_id)
    nxt = await portfolio.next_key_dates(session, [c.id for c, _ in rows])
    return [_out(c, p, nxt.get(c.id)) for c, p in rows]


@router.get("/{contract_id}", response_model=ContractDetailOut)
async def get_contract(contract_id: uuid.UUID, session: AsyncSession = Depends(db)) -> ContractDetailOut:
    c = await portfolio.get_contract(session, contract_id)
    b = await portfolio.contract_bundle(session, c)
    nxt = await portfolio.next_key_dates(session, [c.id])
    base = _out(c, b["party"], nxt.get(c.id))
    docs = []
    for d in b["source_documents"]:
        docs.append(SourceDocOut(id=d.id, filename=d.filename, content_type=d.content_type, role=d.role, format=d.format, has_text_layer=d.has_text_layer,
                                 page_count=d.page_count, container_signatures=d.container_signatures, url=await blobstore().presigned_url(d.s3_key, d.filename),
                                 created_at=d.created_at))
    return ContractDetailOut(
        **base.model_dump(), notes=c.notes, parties=[_cp_out(cp, p) for cp, p in b["parties"]],
        facts=[FactOut(id=f.id, key=f.key, label=(f.value or {}).get("label"), value=(f.value or {}).get("value"), unit=(f.value or {}).get("unit"),
                       text=(f.value or {}).get("text"), valid_from=f.valid_from, valid_to=f.valid_to, reason=f.reason, recorded_at=f.recorded_at,
                       provenance=f.provenance) for f in b["facts"]],
        key_dates=[KeyDateOut.model_validate(k, from_attributes=True) for k in b["key_dates"]],
        allocations=[AllocationOut(id=a.id, kind=a.kind, quantity=a.quantity, period_start=a.period_start, period_end=a.period_end,
                                   asset={"id": asset.id, "name": asset.name, "type_code": asset.type_code, "parent_id": asset.parent_id}) for a, asset in b["allocations"]],
        source_documents=docs,
        attachments=[AttachmentOut.model_validate(a, from_attributes=True) for a in b["attachments"]],
        clauses=b["clauses"],
    )


@router.patch("/{contract_id}", response_model=ContractOut)
async def patch_contract(contract_id: uuid.UUID, body: ContractPatchIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ContractOut:
    fields = body.model_dump(exclude={"expected_version"}, exclude_none=True)
    c = await portfolio.update_contract(session, p.actor, contract_id, expected_version=body.expected_version, **fields)
    b = await portfolio.contract_bundle(session, c)
    return _out(c, b["party"])


@router.delete("/{contract_id}", status_code=204)
async def delete_contract(contract_id: uuid.UUID, reason: str | None = None, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> None:
    await portfolio.soft_delete_contract(session, p.actor, contract_id, reason)


@router.get("/{contract_id}/source-documents/{doc_id}/view", response_model=SourceViewOut)
async def source_view(contract_id: uuid.UUID, doc_id: uuid.UUID, session: AsyncSession = Depends(db)) -> SourceViewOut:
    c = await portfolio.get_contract(session, contract_id)
    doc = await portfolio.get_source_document(session, c, doc_id)
    pdf_url = await imports_domain.source_pdf_url(doc)
    pages = await imports_domain.source_pages(None, doc)
    return SourceViewOut(id=doc.id, filename=doc.filename, format=doc.format, page_count=doc.page_count, pdf_url=pdf_url, text_pages=pages)


@router.get("/{contract_id}/parties", response_model=list[ContractPartyOut])
async def list_parties(contract_id: uuid.UUID, session: AsyncSession = Depends(db)) -> list[ContractPartyOut]:
    await portfolio.get_contract(session, contract_id)
    return [_cp_out(cp, p) for cp, p in await contract_parties.list_for_contract(session, contract_id)]


@router.post("/{contract_id}/parties", response_model=ContractPartyOut, status_code=201)
async def add_party(contract_id: uuid.UUID, body: ContractPartyIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ContractPartyOut:
    cp = await contract_parties.add_party(session, p.actor, contract_id=contract_id, party_id=body.party_id, role=body.role, is_primary=body.is_primary,
                                          valid_from=body.valid_from, source="manual")
    return await _cp_fetch(session, cp.id)


@router.patch("/{contract_id}/parties/{cp_id}", response_model=ContractPartyOut)
async def patch_party(contract_id: uuid.UUID, cp_id: uuid.UUID, body: ContractPartyPatch, p: Principal = Depends(current_principal),
                      session: AsyncSession = Depends(db)) -> ContractPartyOut:
    cp = await contract_parties.get_link(session, cp_id)
    if cp.contract_id != contract_id:
        from app.domain.errors import NotFound

        raise NotFound("Lepingu osapoolt ei leitud")
    if body.role is not None or body.valid_from is not None or body.valid_to is not None:
        await contract_parties.update_party(session, p.actor, cp_id, role=body.role, valid_from=body.valid_from, valid_to=body.valid_to)
    if body.is_primary:
        await contract_parties.set_primary(session, p.actor, cp_id)
    return await _cp_fetch(session, cp_id)


@router.delete("/{contract_id}/parties/{cp_id}", status_code=204)
async def remove_party(contract_id: uuid.UUID, cp_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> None:
    cp = await contract_parties.get_link(session, cp_id)
    if cp.contract_id != contract_id:
        from app.domain.errors import NotFound

        raise NotFound("Lepingu osapoolt ei leitud")
    await contract_parties.remove_party(session, p.actor, cp_id)


async def _cp_fetch(session: AsyncSession, cp_id: uuid.UUID) -> ContractPartyOut:
    from app.domain.parties import get_party

    cp = await contract_parties.get_link(session, cp_id)
    await session.flush()
    await session.refresh(cp)
    return _cp_out(cp, await get_party(session, cp.party_id))


@router.post("/{contract_id}/amendments", response_model=SourceDocOut, status_code=201)
async def register_amendment(
    contract_id: uuid.UUID, file: UploadFile = File(...), note: str | None = Form(None), parameters: str = Form("[]"), key_dates: str = Form("[]"),
    valid_from: date | None = Form(None), end_date: date | None = Form(None), new_party_id: uuid.UUID | None = Form(None),
    p: Principal = Depends(current_principal), session: AsyncSession = Depends(db),
) -> SourceDocOut:
    data = await file.read()
    d = await imports_domain.register_amendment(session, p.actor, contract_id, filename=file.filename or "lisa", content_type=file.content_type, data=data,
                                                note=note, parameters=json.loads(parameters or "[]"), key_dates=json.loads(key_dates or "[]"),
                                                valid_from=valid_from, end_date=end_date, new_party_id=new_party_id)
    return SourceDocOut(id=d.id, filename=d.filename, content_type=d.content_type, role=d.role, format=d.format, has_text_layer=d.has_text_layer,
                        page_count=d.page_count, container_signatures=d.container_signatures, url=await blobstore().presigned_url(d.s3_key, d.filename),
                        created_at=d.created_at)
