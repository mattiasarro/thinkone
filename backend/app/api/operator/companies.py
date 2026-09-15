from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import companies as companies_domain

router = APIRouter(prefix="/companies", tags=["companies"])


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    registry_code: str | None
    vat_number: str | None
    address: str | None
    email: str | None
    phone: str | None
    accent_color: str | None
    logo_attachment_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime


class CompanyIn(BaseModel):
    name: str | None = Field(default=None, max_length=300)
    registry_code: str | None = Field(default=None, max_length=40)
    vat_number: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=500)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=60)
    accent_color: str | None = Field(default=None, max_length=16)


class CompanyPatch(CompanyIn):
    pass


@router.get("", response_model=list[CompanyOut])
async def list_companies(session: AsyncSession = Depends(db)) -> list[CompanyOut]:
    return [CompanyOut.model_validate(c) for c in await companies_domain.list_companies(session)]


@router.post("", response_model=CompanyOut, status_code=201)
async def create_company(body: CompanyIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> CompanyOut:
    c = await companies_domain.create_company(session, p.actor, **body.model_dump())
    return CompanyOut.model_validate(c)


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(company_id: uuid.UUID, session: AsyncSession = Depends(db)) -> CompanyOut:
    return CompanyOut.model_validate(await companies_domain.get_company(session, company_id))


@router.patch("/{company_id}", response_model=CompanyOut)
async def patch_company(company_id: uuid.UUID, body: CompanyPatch, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> CompanyOut:
    c = await companies_domain.update_company(session, p.actor, company_id, **body.model_dump(exclude_none=True))
    return CompanyOut.model_validate(c)


@router.api_route("/{company_id}", methods=["DELETE"], status_code=204)
async def delete_company(company_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    await companies_domain.delete_company(session, p.actor, company_id)
    return Response(status_code=204)


@router.post("/{company_id}/logo", response_model=CompanyOut)
async def upload_logo(company_id: uuid.UUID, file: UploadFile = File(...), p: Principal = Depends(current_principal),
                      session: AsyncSession = Depends(db)) -> CompanyOut:
    data = await file.read()
    c = await companies_domain.set_logo(session, p.actor, company_id, filename=file.filename or "logo", content_type=file.content_type, data=data)
    return CompanyOut.model_validate(c)
