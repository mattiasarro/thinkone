"""Templates: special_terms_base | quote_base (markdown body) — versioned; general_terms come via ingest."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.models.core import Template

TEXT_KINDS = {"special_terms_base", "quote_base"}
KINDS = TEXT_KINDS | {"general_terms"}


async def list_templates(session: AsyncSession, company_id: uuid.UUID | None = None, kind: str | None = None,
                         include_history: bool = True) -> list[Template]:
    stmt = select(Template).where(Template.deleted_at.is_(None)).order_by(Template.kind, Template.name, Template.version.desc())
    if company_id:
        stmt = stmt.where(Template.company_id == company_id)
    if kind:
        stmt = stmt.where(Template.kind == kind)
    if not include_history:
        stmt = stmt.where(Template.is_current.is_(True))
    return list((await session.execute(stmt)).scalars())


async def get_template(session: AsyncSession, template_id: uuid.UUID) -> Template:
    t = await session.get(Template, template_id)
    if not t or t.deleted_at:
        raise NotFound("Malli ei leitud")
    return t


async def current_template(session: AsyncSession, *, kind: str, company_id: uuid.UUID | None, contract_type_code: str = "lease") -> Template | None:
    stmt = select(Template).where(Template.kind == kind, Template.is_current.is_(True), Template.deleted_at.is_(None),
                                  Template.contract_type_code == contract_type_code)
    stmt = stmt.where(Template.company_id == company_id) if company_id else stmt.where(Template.company_id.is_(None))
    return (await session.execute(stmt.limit(1))).scalar_one_or_none()


async def create_template(session: AsyncSession, actor: Actor, *, kind: str, name: str, body: dict[str, Any],
                          company_id: uuid.UUID | None = None, contract_type_code: str = "lease") -> Template:
    """Version 1, or a new version superseding the current template of the same kind + company."""
    if kind not in TEXT_KINDS:
        raise DomainError("Malli liik peab olema special_terms_base või quote_base (üldtingimused imporditakse DOCX-ist)")
    name = (name or "").strip()
    if not name:
        raise DomainError("Malli nimi on kohustuslik")
    text = body.get("text") if isinstance(body, dict) else None
    if not isinstance(text, str) or not text.strip():
        raise DomainError("Malli sisu (body.text) on kohustuslik")
    return await new_version(session, actor, kind=kind, name=name, body={"text": text}, company_id=company_id,
                             contract_type_code=contract_type_code, node_count=0)


async def new_version(session: AsyncSession, actor: Actor, *, kind: str, name: str, body: dict[str, Any], company_id: uuid.UUID | None,
                      contract_type_code: str = "lease", node_count: int = 0, source_attachment_id: uuid.UUID | None = None) -> Template:
    """Shared by text templates and the general-terms ingest: supersede the current version, if any."""
    if kind not in KINDS:
        raise DomainError(f"Tundmatu malli liik: {kind}")
    prev = await current_template(session, kind=kind, company_id=company_id, contract_type_code=contract_type_code)
    version = 1
    if prev:
        prev.is_current = False
        version = prev.version + 1
    t = Template(
        account_id=actor.account_id, company_id=company_id, contract_type_code=contract_type_code, kind=kind, name=name,
        version=version, supersedes_id=prev.id if prev else None, is_current=True, body=body, node_count=node_count,
        source_attachment_id=source_attachment_id,
    )
    session.add(t)
    await session.flush()
    emit(session, actor, "template", t.id, "template.created",
         {"kind": kind, "name": name, "version": version, "supersedes_id": prev.id if prev else None, "company_id": company_id, "node_count": node_count})
    if prev:
        emit(session, actor, "template", prev.id, "template.superseded", {"by": t.id, "version": version})
    return t
