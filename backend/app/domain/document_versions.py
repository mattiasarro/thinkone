"""Invariant 3: every send-to-client freezes a snapshot and the rendered PDF, content-addressed in object storage."""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents import render
from app.domain.events import Actor, _jsonable, emit
from app.infra.blobstore import blobstore, sha256
from app.models.quotes import DocumentVersion


def digest(snapshot: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(_jsonable(snapshot), sort_keys=True, ensure_ascii=False).encode()).hexdigest()


async def latest(session: AsyncSession, subject_type: str, subject_id: uuid.UUID) -> DocumentVersion | None:
    stmt = (select(DocumentVersion).where(DocumentVersion.subject_type == subject_type, DocumentVersion.subject_id == subject_id)
            .order_by(DocumentVersion.number.desc()).limit(1))
    return (await session.execute(stmt)).scalar_one_or_none()


async def list_versions(session: AsyncSession, subject_type: str, subject_id: uuid.UUID) -> list[DocumentVersion]:
    stmt = select(DocumentVersion).where(DocumentVersion.subject_type == subject_type, DocumentVersion.subject_id == subject_id).order_by(DocumentVersion.number)
    return list((await session.execute(stmt)).scalars())


async def get_version(session: AsyncSession, subject_type: str, subject_id: uuid.UUID, number: int) -> DocumentVersion | None:
    stmt = select(DocumentVersion).where(DocumentVersion.subject_type == subject_type, DocumentVersion.subject_id == subject_id, DocumentVersion.number == number)
    return (await session.execute(stmt)).scalar_one_or_none()


async def freeze(session: AsyncSession, actor: Actor, *, subject_type: str, subject_id: uuid.UUID, snapshot: dict[str, Any],
                 note: str | None = None, html: str | None = None) -> DocumentVersion:
    prev = await latest(session, subject_type, subject_id)
    number = (prev.number if prev else 0) + 1
    snap = _jsonable(snapshot)
    pdf = render.render_pdf(html) if html else None
    key = pdf_sha = None
    if pdf:
        key = f"account/{actor.account_id}/{subject_type}/{subject_id}/v{number}/{subject_type}.pdf"
        await blobstore().put(key, pdf, "application/pdf")
        pdf_sha = sha256(pdf)
    v = DocumentVersion(account_id=actor.account_id, subject_type=subject_type, subject_id=subject_id, number=number, snapshot=snap,
                        snapshot_sha256=digest(snap), pdf_s3_key=key, pdf_sha256=pdf_sha, note=note, created_by=actor.user_id)
    session.add(v)
    await session.flush()
    emit(session, actor, subject_type, subject_id, f"{subject_type}.version_frozen",
         {"number": number, "version_id": v.id, "snapshot_sha256": v.snapshot_sha256, "pdf_sha256": pdf_sha, "note": note})
    return v


async def attach_pdf(session: AsyncSession, actor: Actor, v: DocumentVersion, html: str) -> bool:
    """Render the PDF later (worker) for a version frozen without one."""
    if v.pdf_s3_key:
        return True
    pdf = render.render_pdf(html)
    if not pdf:
        return False
    key = f"account/{actor.account_id}/{v.subject_type}/{v.subject_id}/v{v.number}/{v.subject_type}.pdf"
    await blobstore().put(key, pdf, "application/pdf")
    v.pdf_s3_key, v.pdf_sha256 = key, sha256(pdf)
    emit(session, actor, v.subject_type, v.subject_id, f"{v.subject_type}.version_pdf_rendered", {"number": v.number, "pdf_sha256": v.pdf_sha256})
    return True


async def pdf_url(v: DocumentVersion | None) -> str | None:
    if not v or not v.pdf_s3_key:
        return None
    return await blobstore().presigned_url(v.pdf_s3_key, filename=f"{v.subject_type}-v{v.number}.pdf")
