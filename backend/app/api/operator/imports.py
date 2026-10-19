from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from typing import Any
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
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
    batch_id: uuid.UUID | None = None
    kind: str = "contract"
    annex_number: str | None = None
    parent_job_id: uuid.UUID | None = None
    parent_contract_id: uuid.UUID | None = None
    link: dict[str, Any] | None = None
    checked: list[str] = []
    excluded_reason: str | None = None


class ImportJobDetailOut(ImportJobOut):
    source_url: str | None = None
    text_pages: list[dict[str, Any]] | None = None
    files: list[dict[str, Any]] = []  # the review's document tabs (GET /imports/{id}/files/{index})


class ReviewIn(BaseModel):
    reviewed: dict[str, Any]


class CommitPartyIn(BaseModel):
    index: int | None = None  # position in the proposal's parties (create/find from it) …
    party_id: uuid.UUID | None = None  # … or an existing party
    role: str
    is_primary: bool = False
    include: bool = True


class CommitIn(BaseModel):
    company_id: uuid.UUID | None = None
    asset_id: uuid.UUID | None = None  # legacy single target …
    asset_ids: list[uuid.UUID] | None = None  # … or several (e.g. two spaces of one building)
    allocation_kind: str | None = None
    parties: list[CommitPartyIn] | None = None  # None → the default set (every non-our-side proposal party, counterparty primary)
    category: str | None = None
    checked: list[str] = []
    parking_numbers: list[str] | None = None  # lease on a space: which register spots the contract takes (default: the space's own)


class CommitOut(BaseModel):
    contract_id: uuid.UUID


class DeskStateIn(BaseModel):
    """Only the fields sent are changed (``null`` clears a link or a parent)."""

    checked: list[str] | None = None
    link: dict[str, Any] | None = None
    parent_job_id: uuid.UUID | None = None
    parent_contract_id: uuid.UUID | None = None


class ExcludeIn(BaseModel):
    reason: str | None = None


class ReadyOut(BaseModel):
    contracts: int
    children: int
    key_dates: int
    new_parties: int


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
    from app.ingest.kind import classify

    kind, nr = classify((src or {}).get("contract") if src else None, doc.filename if doc else "")
    return ImportJobOut(id=job.id, status=job.status, error=job.error, source_document=SourceDocumentOut.model_validate(doc, from_attributes=True),
                        proposal=job.proposal, reviewed=job.reviewed, prompt_version=job.prompt_version, model=job.model, usage=job.usage,
                        duplicate_of_contract_id=job.duplicate_of_contract_id, committed_contract_id=job.committed_contract_id,
                        edits_count=job.edits_count, created_at=job.created_at, updated_at=job.updated_at, uncertain=unc,
                        batch_id=job.batch_id, kind=kind, annex_number=nr, parent_job_id=job.parent_job_id, parent_contract_id=job.parent_contract_id,
                        link=job.link, checked=list(job.checked or []), excluded_reason=job.excluded_reason)


@router.post("", response_model=ImportJobOut, status_code=201)
async def upload(file: UploadFile = File(...), batch_id: uuid.UUID | None = Form(None), p: Principal = Depends(current_principal),
                 session: AsyncSession = Depends(db)) -> ImportJobOut:
    data = await file.read()
    job = await imports_domain.create_import(session, p.actor, filename=file.filename or "dokument", content_type=file.content_type, data=data, batch_id=batch_id)
    return await _out(session, job)


@router.get("", response_model=list[ImportJobOut])
async def list_jobs(session: AsyncSession = Depends(db)) -> list[ImportJobOut]:
    return [await _out(session, j) for j in await imports_domain.list_jobs(session)]


@router.get("/desk")
async def desk_overview(session: AsyncSession = Depends(db)) -> dict[str, Any]:
    """Every import (batch) with its counts — the „Lepingute import” list."""
    from app.domain.import_desk import desk

    return await desk(session)


@router.get("/desk/{batch_id}")
async def desk_batch(batch_id: uuid.UUID, session: AsyncSession = Depends(db)) -> dict[str, Any]:
    """One import: summary, toimikud (contract + its annexes and documents) with their state, and what „Kinnita valmis” would do."""
    from app.domain.import_desk import desk

    return await desk(session, batch_id)


@router.post("/batches/{batch_id}/commit-ready", response_model=ReadyOut)
async def commit_ready(batch_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ReadyOut:
    from app.domain.import_desk import commit_ready as run

    return ReadyOut(**await run(session, p.actor, batch_id))


@router.get("/{job_id}", response_model=ImportJobDetailOut)
async def get_job(job_id: uuid.UUID, session: AsyncSession = Depends(db)) -> ImportJobDetailOut:
    job = await imports_domain.get_job(session, job_id)
    base = await _out(session, job)
    doc = await session.get(SourceDocument, job.source_document_id)
    url = await blobstore().presigned_url(doc.s3_key, doc.filename) if doc else None
    pages = await imports_domain.source_pages(job, doc) if doc else None
    files = imports_domain.source_files(doc) if doc else []
    return ImportJobDetailOut(**base.model_dump(), source_url=url, text_pages=pages, files=files)


@router.get("/{job_id}/files/{index}")
async def source_file(job_id: uuid.UUID, index: int, session: AsyncSession = Depends(db)) -> Response:
    """One file of the source, same-origin for the review's PDF viewer (pdf.js reads the bytes; a container's datafile
    is unpacked on the fly — the container itself stays the untouched original)."""
    job = await imports_domain.get_job(session, job_id)
    doc = await session.get(SourceDocument, job.source_document_id)
    if not doc:
        from app.domain.errors import NotFound

        raise NotFound("Faili ei leitud")
    name, data, media = await imports_domain.source_file(doc, index)
    return Response(content=data, media_type=media, headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(name)}", "Cache-Control": "private, max-age=600"})


@router.patch("/{job_id}", response_model=ImportJobOut)
async def save_review(job_id: uuid.UUID, body: ReviewIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportJobOut:
    return await _out(session, await imports_domain.save_review(session, p.actor, job_id, body.reviewed))


@router.patch("/{job_id}/desk", response_model=ImportJobOut)
async def save_desk_state(job_id: uuid.UUID, body: DeskStateIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportJobOut:
    sent = body.model_fields_set
    kw: dict[str, Any] = {"checked": body.checked}
    if "link" in sent:
        kw["link"] = body.link
    if "parent_job_id" in sent or "parent_contract_id" in sent:
        kw["parent_job_id"], kw["parent_contract_id"] = body.parent_job_id, body.parent_contract_id
    return await _out(session, await imports_domain.save_desk_state(session, p.actor, job_id, **kw))


@router.post("/{job_id}/opened", status_code=204)
async def opened(job_id: uuid.UUID, session: AsyncSession = Depends(db)) -> None:
    """„Jätka ülevaatust” returns to the file opened last."""
    from datetime import UTC

    job = await imports_domain.get_job(session, job_id)
    job.opened_at = datetime.now(UTC)


@router.post("/{job_id}/exclude", response_model=ImportJobOut)
async def exclude(job_id: uuid.UUID, body: ExcludeIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportJobOut:
    return await _out(session, await imports_domain.exclude_job(session, p.actor, job_id, body.reason))


@router.post("/{job_id}/restore", response_model=ImportJobOut)
async def restore(job_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportJobOut:
    return await _out(session, await imports_domain.restore_job(session, p.actor, job_id))


@router.delete("/{job_id}", status_code=204)
async def remove(job_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> None:
    await imports_domain.remove_job(session, p.actor, job_id)


@router.post("/{job_id}/retry", response_model=ImportJobOut)
async def retry(job_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportJobOut:
    return await _out(session, await imports_domain.retry_job(session, p.actor, job_id))


@router.post("/{job_id}/commit", response_model=CommitOut)
async def commit(job_id: uuid.UUID, body: CommitIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> CommitOut:
    from app.domain.import_desk import commit_toimik

    # a contract commits with the review's choices, then its ready annexes and documents; an annex/document on its own
    # goes onto the contract it belongs to (the body's link fields do not apply to it)
    explicit = {"company_id": body.company_id, "asset_id": body.asset_id, "asset_ids": body.asset_ids, "allocation_kind": body.allocation_kind,
                "category": body.category, "checked": body.checked, "parking_numbers": body.parking_numbers,
                "parties": [x.model_dump() for x in body.parties] if body.parties is not None else None}
    job = await imports_domain.get_job(session, job_id)
    if body.checked:
        job.checked = sorted(set(job.checked or []) | set(body.checked))
    cid = await commit_toimik(session, p.actor, job_id, explicit=explicit)
    return CommitOut(contract_id=cid)


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
