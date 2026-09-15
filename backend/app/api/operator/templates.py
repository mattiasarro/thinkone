from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import templates as templates_domain

router = APIRouter(prefix="/templates", tags=["templates"])


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    company_id: uuid.UUID | None
    contract_type_code: str
    kind: str
    name: str
    version: int
    supersedes_id: uuid.UUID | None
    is_current: bool
    source_attachment_id: uuid.UUID | None
    node_count: int
    created_at: datetime


class TemplateDetailOut(TemplateOut):
    body: dict[str, Any]


class TemplateBodyIn(BaseModel):
    text: str = Field(min_length=1)


class TemplateIn(BaseModel):
    kind: str = Field(pattern="^(special_terms_base|quote_base)$")
    name: str = Field(min_length=1, max_length=200)
    company_id: uuid.UUID | None = None
    contract_type_code: str = "lease"
    body: TemplateBodyIn


@router.get("", response_model=list[TemplateOut])
async def list_templates(company_id: uuid.UUID | None = Query(default=None), kind: str | None = Query(default=None),
                         include_history: bool = Query(default=True), session: AsyncSession = Depends(db)) -> list[TemplateOut]:
    rows = await templates_domain.list_templates(session, company_id=company_id, kind=kind, include_history=include_history)
    return [TemplateOut.model_validate(t) for t in rows]


@router.post("", response_model=TemplateDetailOut, status_code=201)
async def create_template(body: TemplateIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> TemplateDetailOut:
    t = await templates_domain.create_template(session, p.actor, kind=body.kind, name=body.name, body=body.body.model_dump(),
                                               company_id=body.company_id, contract_type_code=body.contract_type_code)
    return TemplateDetailOut.model_validate(t)


@router.post("/general-terms", response_model=TemplateDetailOut, status_code=201)
async def import_general_terms(
    name: str = Form(..., min_length=1, max_length=200),
    company_id: uuid.UUID | None = Form(default=None),
    file: UploadFile = File(...),
    p: Principal = Depends(current_principal),
    session: AsyncSession = Depends(db),
) -> TemplateDetailOut:
    """Ingest a general-terms DOCX into a clause-tree template (node per marked item)."""
    from app.ingest.docx_terms import ingest_general_terms_docx

    data = await file.read()
    t = await ingest_general_terms_docx(session, p.actor, company_id=company_id, name=name, filename=file.filename or "uldtingimused.docx", data=data)
    return TemplateDetailOut.model_validate(t)


@router.get("/{template_id}", response_model=TemplateDetailOut)
async def get_template(template_id: uuid.UUID, session: AsyncSession = Depends(db)) -> TemplateDetailOut:
    return TemplateDetailOut.model_validate(await templates_domain.get_template(session, template_id))
