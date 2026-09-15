from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import attachments as attachments_domain

router = APIRouter(prefix="/attachments", tags=["attachments"])


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    subject_type: str
    subject_id: uuid.UUID
    role: str
    filename: str
    content_type: str
    size: int
    sha256: str
    uploaded_by: uuid.UUID | None
    created_at: datetime


class AttachmentUrlOut(BaseModel):
    url: str


@router.post("", response_model=AttachmentOut, status_code=201)
async def upload_attachment(
    subject_type: str = Form(...),
    subject_id: uuid.UUID = Form(...),
    role: str = Form(default="generic"),
    file: UploadFile = File(...),
    p: Principal = Depends(current_principal),
    session: AsyncSession = Depends(db),
) -> AttachmentOut:
    data = await file.read()
    att = await attachments_domain.store_file(session, p.actor, subject_type=subject_type, subject_id=subject_id, role=role,
                                              filename=file.filename or "fail", content_type=file.content_type, data=data)
    return AttachmentOut.model_validate(att)


@router.get("", response_model=list[AttachmentOut])
async def list_attachments(subject_type: str | None = Query(default=None), subject_id: uuid.UUID | None = Query(default=None),
                           role: str | None = Query(default=None), session: AsyncSession = Depends(db)) -> list[AttachmentOut]:
    rows = await attachments_domain.list_attachments(session, subject_type=subject_type, subject_id=subject_id, role=role)
    return [AttachmentOut.model_validate(a) for a in rows]


@router.get("/{attachment_id}", response_model=AttachmentOut)
async def get_attachment(attachment_id: uuid.UUID, session: AsyncSession = Depends(db)) -> AttachmentOut:
    return AttachmentOut.model_validate(await attachments_domain.get_attachment(session, attachment_id))


@router.get("/{attachment_id}/url", response_model=AttachmentUrlOut)
async def attachment_url(attachment_id: uuid.UUID, session: AsyncSession = Depends(db)) -> AttachmentUrlOut:
    return AttachmentUrlOut(url=await attachments_domain.download_url(session, attachment_id))


@router.api_route("/{attachment_id}", methods=["DELETE"], status_code=204)
async def delete_attachment(attachment_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    await attachments_domain.delete_attachment(session, p.actor, attachment_id)
    return Response(status_code=204)
