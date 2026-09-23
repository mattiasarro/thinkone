"""Companies (Ettevõte / üürileandja): the account's own legal entities. Äriregister autofill on create."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import attachments as attachments_domain
from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.integrations.ariregister import ariregister
from app.models.core import Company

EDITABLE = ("name", "registry_code", "vat_number", "address", "email", "phone", "accent_color")
LOGO_MAX_BYTES = 1024 * 1024


async def list_companies(session: AsyncSession) -> list[Company]:
    stmt = select(Company).where(Company.deleted_at.is_(None)).order_by(Company.name)
    return list((await session.execute(stmt)).scalars())


async def get_company(session: AsyncSession, company_id: uuid.UUID) -> Company:
    c = await session.get(Company, company_id)
    if not c or c.deleted_at:
        raise NotFound("Ettevõtet ei leitud")
    return c


async def create_company(session: AsyncSession, actor: Actor, **fields: Any) -> Company:
    data = {k: _clean(fields.get(k)) for k in EDITABLE}
    payload = None
    if data["registry_code"] and (not data["name"] or not data["address"]):
        reg = ariregister()
        rec = await reg.detail(data["registry_code"])
        if rec is None:
            rec = next((m for m in await reg.lookup(data["registry_code"]) if m.registry_code == data["registry_code"]), None)
        if rec:
            data["name"] = data["name"] or rec.name
            data["address"] = data["address"] or rec.address
            data["vat_number"] = data["vat_number"] or rec.vat_number
            data["email"] = data["email"] or rec.email
            data["phone"] = data["phone"] or rec.phone
            payload = rec.raw or {"name": rec.name, "registry_code": rec.registry_code, "address": rec.address,
                                  "vat_number": rec.vat_number, "status": rec.status}
    if not data["name"]:
        raise DomainError("Ettevõtte nimi on kohustuslik" if not data["registry_code"] else "Registrikoodi järgi ettevõtet ei leitud; sisesta nimi käsitsi")
    c = Company(account_id=actor.account_id, registry_payload=payload, **data)
    session.add(c)
    await session.flush()
    emit(session, actor, "company", c.id, "company.created", {"name": c.name, "registry_code": c.registry_code, "autofilled": payload is not None})
    return c


async def update_company(session: AsyncSession, actor: Actor, company_id: uuid.UUID, **fields: Any) -> Company:
    c = await get_company(session, company_id)
    changes: dict[str, Any] = {}
    for k in EDITABLE:
        if k in fields and fields[k] is not None:
            v = _clean(fields[k])
            if k == "name" and not v:
                raise DomainError("Ettevõtte nimi ei tohi olla tühi")
            if v != getattr(c, k):
                changes[k] = [getattr(c, k), v]
                setattr(c, k, v)
    if changes:
        emit(session, actor, "company", c.id, "company.updated", changes)
        await _refresh_ts(session, c)
    return c


async def delete_company(session: AsyncSession, actor: Actor, company_id: uuid.UUID) -> None:
    c = await get_company(session, company_id)
    c.deleted_at = datetime.now(UTC)
    emit(session, actor, "company", c.id, "company.deleted", {"name": c.name})


async def set_logo(session: AsyncSession, actor: Actor, company_id: uuid.UUID, *, filename: str, content_type: str | None, data: bytes) -> Company:
    c = await get_company(session, company_id)
    att = await attachments_domain.store_file(
        session, actor, subject_type="company", subject_id=c.id, role="logo", filename=filename, content_type=content_type,
        data=data, max_bytes=LOGO_MAX_BYTES, allowed_types=attachments_domain.IMAGE_TYPES,
    )
    previous = c.logo_attachment_id
    c.logo_attachment_id = att.id
    emit(session, actor, "company", c.id, "company.logo_set", {"attachment_id": att.id, "previous": previous})
    await _refresh_ts(session, c)
    return c


async def _refresh_ts(session: AsyncSession, c: Company) -> None:
    """``updated_at`` is expired after an UPDATE flush; reload it so response models never lazy-load."""
    await session.flush()
    await session.refresh(c, attribute_names=["updated_at"])


def _clean(v: Any) -> str | None:
    if v is None:
        return None
    v = str(v).strip()
    return v or None
