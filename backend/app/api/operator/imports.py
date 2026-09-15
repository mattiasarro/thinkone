from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import imports as imports_domain
from app.infra.blobstore import blobstore
from app.models.contracts import ImportJob, SourceDocument

router = APIRouter(prefix="/imports", tags=["imports"])


class SourceDocumentOut(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str
    size: int
    format: str
    page_count: int | None
    has_text_layer: bool
    container_signatures: list[dict[str, Any]] | None
    datafiles: list[dict[str, Any]] | None
    role: str
    created_at: datetime


class ImportJobOut(BaseModel):
    id: uuid.UUID
    status: str
    error: str | None
    source_document: SourceDocumentOut
    proposal: dict[str, Any] | None
    reviewed: dict[str, Any] | None
    prompt_version: str | None
    model: str | None
    usage: dict[str, Any] | None
    duplicate_of_contract_id: uuid.UUID | None
    committed_contract_id: uuid.UUID | None
    edits_count: int
    created_at: datetime
    updated_at: datetime
    uncertain: list[str] = []


class ImportJobDetailOut(ImportJobOut):
    source_url: str | None = None
    text_pages: list[dict[str, Any]] | None = None


class ReviewIn(BaseModel):
    reviewed: dict[str, Any]


class CommitIn(BaseModel):
    company_id: uuid.UUID | None = None
    asset_id: uuid.UUID | None = None
    allocation_kind: str | None = None
    party_id: uuid.UUID | None = None
    category: str | None = None
    checked: list[str] = []


class CommitOut(BaseModel):
    contract_id: uuid.UUID


async def _out(session: AsyncSession, job: ImportJob) -> ImportJobOut:
    await session.flush()
    await session.refresh(job)  # updated_at is expired after an UPDATE flush; load it eagerly (no lazy IO in async)
    doc = await session.get(SourceDocument, job.source_document_id)
    from app.ingest.schema import Proposal

    unc: list[str] = []
    src = job.reviewed or job.proposal
    if src:
        try:
            unc = Proposal.model_validate(src).uncertain()
        except Exception:  # noqa: BLE001
            unc = []
    return ImportJobOut(id=job.id, status=job.status, error=job.error, source_document=SourceDocumentOut.model_validate(doc, from_attributes=True),
                        proposal=job.proposal, reviewed=job.reviewed, prompt_version=job.prompt_version, model=job.model, usage=job.usage,
                        duplicate_of_contract_id=job.duplicate_of_contract_id, committed_contract_id=job.committed_contract_id,
                        edits_count=job.edits_count, created_at=job.created_at, updated_at=job.updated_at, uncertain=unc)


@router.post("", response_model=ImportJobOut, status_code=201)
async def upload(file: UploadFile = File(...), p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportJobOut:
    data = await file.read()
    job = await imports_domain.create_import(session, p.actor, filename=file.filename or "dokument", content_type=file.content_type, data=data)
    return await _out(session, job)


@router.get("", response_model=list[ImportJobOut])
async def list_jobs(session: AsyncSession = Depends(db)) -> list[ImportJobOut]:
    return [await _out(session, j) for j in await imports_domain.list_jobs(session)]


@router.get("/{job_id}", response_model=ImportJobDetailOut)
async def get_job(job_id: uuid.UUID, session: AsyncSession = Depends(db)) -> ImportJobDetailOut:
    job = await imports_domain.get_job(session, job_id)
    base = await _out(session, job)
    doc = await session.get(SourceDocument, job.source_document_id)
    url = await blobstore().presigned_url(doc.s3_key, doc.filename) if doc else None
    pages = await imports_domain.source_pages(job, doc) if doc else None
    return ImportJobDetailOut(**base.model_dump(), source_url=url, text_pages=pages)


@router.patch("/{job_id}", response_model=ImportJobOut)
async def save_review(job_id: uuid.UUID, body: ReviewIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportJobOut:
    return await _out(session, await imports_domain.save_review(session, p.actor, job_id, body.reviewed))


@router.post("/{job_id}/retry", response_model=ImportJobOut)
async def retry(job_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportJobOut:
    return await _out(session, await imports_domain.retry_job(session, p.actor, job_id))


@router.post("/{job_id}/commit", response_model=CommitOut)
async def commit(job_id: uuid.UUID, body: CommitIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> CommitOut:
    c = await imports_domain.commit_import(session, p.actor, job_id, company_id=body.company_id, asset_id=body.asset_id,
                                           allocation_kind=body.allocation_kind, party_id=body.party_id, category=body.category, checked=body.checked)
    return CommitOut(contract_id=c.id)


@router.post("/manual", response_model=CommitOut, status_code=201)
async def manual(
    file: UploadFile = File(...), title: str = Form(...), category: str = Form(...), counterparty_name: str = Form(...),
    registry_code: str | None = Form(None), signed_at: date | None = Form(None), start_date: date | None = Form(None), end_date: date | None = Form(None),
    key_dates: str = Form("[]"), parameters: str = Form("[]"), company_id: uuid.UUID | None = Form(None), asset_id: uuid.UUID | None = Form(None),
    notes: str | None = Form(None), p: Principal = Depends(current_principal), session: AsyncSession = Depends(db),
) -> CommitOut:
    data = await file.read()
    c = await imports_domain.manual_register(
        session, p.actor, filename=file.filename or "dokument", content_type=file.content_type, data=data, title=title, category=category,
        counterparty_name=counterparty_name, registry_code=registry_code or None, signed_at=signed_at, start_date=start_date, end_date=end_date,
        key_dates=json.loads(key_dates or "[]"), parameters=json.loads(parameters or "[]"), company_id=company_id, asset_id=asset_id, notes=notes,
    )
    return CommitOut(contract_id=c.id)
