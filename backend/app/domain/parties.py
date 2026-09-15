"""Parties (Klient / Osapool): one table for every counterparty; roles as data."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.domain.search import index_entity, remove_entity
from app.models.contracts import Contract
from app.models.core import Party

KINDS = {"ee_company", "foreign_company", "person"}
EDITABLE = ("kind", "name", "registry_code", "personal_code", "vat_number", "address", "contact_name", "email", "phone", "roles")


def party_link(party_id: uuid.UUID) -> str:
    return f"/app/portfell/osapool/{party_id}"


async def list_parties(session: AsyncSession, q: str | None = None, role: str | None = None) -> list[Party]:
    stmt = select(Party).where(Party.deleted_at.is_(None)).order_by(Party.name)
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        stmt = stmt.where(or_(Party.name.ilike(pattern), Party.registry_code.ilike(pattern)))
    if role:
        stmt = stmt.where(Party.roles.any(role))
    return list((await session.execute(stmt)).scalars())


async def get_party(session: AsyncSession, party_id: uuid.UUID) -> Party:
    p = await session.get(Party, party_id)
    if not p or p.deleted_at:
        raise NotFound("Osapoolt ei leitud")
    return p


async def create_party(session: AsyncSession, actor: Actor, *, kind: str, name: str, roles: list[str] | None = None, **fields: Any) -> Party:
    data = _validate(kind=kind, name=name, roles=roles, **fields)
    p = Party(account_id=actor.account_id, **data)
    session.add(p)
    await session.flush()
    emit(session, actor, "party", p.id, "party.created", {"name": p.name, "kind": p.kind, "registry_code": p.registry_code, "roles": p.roles})
    await _index(session, p)
    return p


async def update_party(session: AsyncSession, actor: Actor, party_id: uuid.UUID, **fields: Any) -> Party:
    p = await get_party(session, party_id)
    given = {k: v for k, v in fields.items() if k in EDITABLE and v is not None}
    if not given:
        return p
    merged = {k: getattr(p, k) for k in EDITABLE}
    merged.update(given)
    data = _validate(**merged)
    changes: dict[str, Any] = {}
    for k, v in data.items():
        if v != getattr(p, k):
            changes[k] = [getattr(p, k), v]
            setattr(p, k, v)
    if changes:
        emit(session, actor, "party", p.id, "party.updated", changes)
        await _index(session, p)
        await _refresh_ts(session, p)
    return p


async def delete_party(session: AsyncSession, actor: Actor, party_id: uuid.UUID) -> None:
    p = await get_party(session, party_id)
    p.deleted_at = datetime.now(UTC)
    emit(session, actor, "party", p.id, "party.deleted", {"name": p.name})
    await remove_entity(session, "party", p.id)


async def contracts_of(session: AsyncSession, party_id: uuid.UUID) -> list[Contract]:
    stmt = select(Contract).where(Contract.party_id == party_id, Contract.deleted_at.is_(None)).order_by(Contract.start_date.desc().nulls_last(), Contract.number)
    return list((await session.execute(stmt)).scalars())


async def find_or_create_party(
    session: AsyncSession,
    actor: Actor,
    name: str,
    registry_code: str | None = None,
    role: str = "client",
    *,
    kind: str | None = None,
    **fields: Any,
) -> Party:
    """Match by registry code, else by exact name (case-insensitive); add the role when missing.

    Used by the import pipeline — never creates duplicates for the same counterparty.
    """
    name = (name or "").strip()
    registry_code = (registry_code or "").strip() or None
    if not name and not registry_code:
        raise DomainError("Osapoole nimi on kohustuslik")
    p: Party | None = None
    if registry_code:
        p = (await session.execute(select(Party).where(Party.registry_code == registry_code, Party.deleted_at.is_(None)).limit(1))).scalar_one_or_none()
    if p is None and name:
        p = (await session.execute(select(Party).where(func.lower(Party.name) == name.lower(), Party.deleted_at.is_(None)).limit(1))).scalar_one_or_none()
    if p is None:
        if kind is None:
            kind = "person" if fields.get("personal_code") else "ee_company"
        return await create_party(session, actor, kind=kind, name=name or registry_code, registry_code=registry_code, roles=[role], **fields)
    changes: dict[str, Any] = {}
    if role and role not in (p.roles or []):
        changes["roles"] = [list(p.roles or []), list(p.roles or []) + [role]]
        p.roles = list(p.roles or []) + [role]
    if registry_code and not p.registry_code:
        changes["registry_code"] = [None, registry_code]
        p.registry_code = registry_code
    for k in ("personal_code", "vat_number", "address", "contact_name", "email", "phone"):
        v = fields.get(k)
        if v and not getattr(p, k):
            changes[k] = [None, v]
            setattr(p, k, v)
    if changes:
        emit(session, actor, "party", p.id, "party.updated", changes)
        await _index(session, p)
        await _refresh_ts(session, p)
    return p


def _validate(*, kind: str, name: str, roles: list[str] | None, **fields: Any) -> dict[str, Any]:
    if kind not in KINDS:
        raise DomainError("Osapoole liik peab olema ee_company, foreign_company või person")
    name = (name or "").strip()
    if not name:
        raise DomainError("Osapoole nimi on kohustuslik")
    clean_roles: list[str] = []
    for r in roles or []:
        r = (r or "").strip().lower()
        if r and r not in clean_roles:
            clean_roles.append(r)
    data: dict[str, Any] = {"kind": kind, "name": name, "roles": clean_roles}
    for k in ("registry_code", "personal_code", "vat_number", "address", "contact_name", "email", "phone"):
        v = fields.get(k)
        data[k] = (str(v).strip() or None) if v is not None else None
    if data["email"] and "@" not in data["email"]:
        raise DomainError("E-posti aadress ei ole korrektne")
    return data


async def _refresh_ts(session: AsyncSession, p: Party) -> None:
    """``updated_at`` is expired after an UPDATE flush; reload it so response models never lazy-load."""
    await session.flush()
    await session.refresh(p, attribute_names=["updated_at"])


async def _index(session: AsyncSession, p: Party) -> None:
    subtitle = " · ".join(x for x in [p.registry_code or p.personal_code, ", ".join(p.roles or [])] if x)
    text = " ".join(x for x in [p.name, p.registry_code, p.personal_code, p.vat_number, p.address, p.contact_name, p.email, p.phone] if x)
    await index_entity(session, p.account_id, "party", p.id, p.name, text, party_link(p.id), subtitle=subtitle or None)
