"""Attachments: polymorphic file references → blob store key + sha256. Bytes never live in Postgres."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.infra.blobstore import blobstore, sha256
from app.infra.settings import get_settings
from app.models.core import Attachment

SUBJECT_TYPES = {"asset", "company", "contract", "template"}
ROLES = {"floor_plan", "site_plan", "logo", "generic", "annex"}

# canonical content type by extension; used to normalise browser-supplied types
EXTENSION_TYPES = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".asice": "application/vnd.etsi.asic-e+zip",
    ".bdoc": "application/vnd.etsi.asic-e+zip",
    ".sce": "application/vnd.etsi.asic-e+zip",
}
ALLOWED_TYPES = set(EXTENSION_TYPES.values())
IMAGE_TYPES = {"image/png", "image/jpeg"}


def resolve_content_type(filename: str, content_type: str | None) -> str:
    """Trust the extension when the client sends a generic type (octet-stream, empty, x-zip)."""
    ext = ("." + filename.rsplit(".", 1)[1].lower()) if "." in filename else ""
    ct = (content_type or "").split(";")[0].strip().lower()
    if ct in ALLOWED_TYPES:
        if ct == "application/vnd.etsi.asic-e+zip" or ext in EXTENSION_TYPES:
            return EXTENSION_TYPES.get(ext, ct)
        return ct
    if ct == "image/jpg":
        return "image/jpeg"
    if ext in EXTENSION_TYPES and ct in ("", "application/octet-stream", "application/zip", "application/x-zip-compressed"):
        return EXTENSION_TYPES[ext]
    raise DomainError(f"Failitüüp ei ole lubatud: {ct or ext or 'tundmatu'} (lubatud: PDF, PNG, JPEG, DOCX, ASiC-E)", code="unsupported_type")


def safe_filename(filename: str) -> str:
    name = filename.rsplit("/", 1)[-1].rsplit("\\", 1)[-1].strip() or "fail"
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name)[:120]


async def store_file(
    session: AsyncSession,
    actor: Actor,
    *,
    subject_type: str,
    subject_id: uuid.UUID,
    role: str,
    filename: str,
    content_type: str | None,
    data: bytes,
    max_bytes: int | None = None,
    allowed_types: set[str] | None = None,
) -> Attachment:
    """Validate, store bytes in the blob store, and register the attachment row (+ event)."""
    if subject_type not in SUBJECT_TYPES:
        raise DomainError(f"Tundmatu manuse subjekt: {subject_type}")
    if role not in ROLES:
        raise DomainError(f"Tundmatu manuse roll: {role}")
    if not data:
        raise DomainError("Fail on tühi")
    limit = max_bytes or get_settings().upload_max_bytes
    if len(data) > limit:
        raise DomainError(f"Fail on liiga suur (max {limit // (1024 * 1024)} MB)", code="too_large", status_code=413)
    ct = resolve_content_type(filename, content_type)
    if allowed_types and ct not in allowed_types:
        raise DomainError("Failitüüp ei ole selles kohas lubatud", code="unsupported_type")
    fname = safe_filename(filename)
    key = f"account/{actor.account_id}/{subject_type}/{subject_id}/{uuid.uuid4()}-{fname}"
    await blobstore().put(key, data, ct)
    att = Attachment(
        account_id=actor.account_id, subject_type=subject_type, subject_id=subject_id, role=role, filename=fname,
        content_type=ct, size=len(data), s3_key=key, sha256=sha256(data), uploaded_by=actor.user_id,
    )
    session.add(att)
    await session.flush()
    emit(session, actor, "attachment", att.id, "attachment.created",
         {"subject_type": subject_type, "subject_id": subject_id, "role": role, "filename": fname, "size": len(data), "sha256": att.sha256})
    return att


async def list_attachments(session: AsyncSession, subject_type: str | None = None, subject_id: uuid.UUID | None = None,
                           role: str | None = None) -> list[Attachment]:
    stmt = select(Attachment).where(Attachment.deleted_at.is_(None)).order_by(Attachment.created_at.desc())
    if subject_type:
        stmt = stmt.where(Attachment.subject_type == subject_type)
    if subject_id:
        stmt = stmt.where(Attachment.subject_id == subject_id)
    if role:
        stmt = stmt.where(Attachment.role == role)
    return list((await session.execute(stmt)).scalars())


async def get_attachment(session: AsyncSession, attachment_id: uuid.UUID) -> Attachment:
    att = await session.get(Attachment, attachment_id)
    if not att or att.deleted_at:
        raise NotFound("Manust ei leitud")
    return att


async def download_url(session: AsyncSession, attachment_id: uuid.UUID) -> str:
    att = await get_attachment(session, attachment_id)
    return await blobstore().presigned_url(att.s3_key, filename=att.filename)


async def delete_attachment(session: AsyncSession, actor: Actor, attachment_id: uuid.UUID) -> None:
    att = await get_attachment(session, attachment_id)
    att.deleted_at = datetime.now(UTC)
    emit(session, actor, "attachment", att.id, "attachment.deleted", {"subject_type": att.subject_type, "subject_id": att.subject_id})
