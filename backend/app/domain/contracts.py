"""Contracts: creation helper (import pipeline + tests). The engine's lifecycle logic lands here later."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.domain.search import index_entity
from app.models.contracts import Contract, ContractType

STATUSES = {"draft", "sent", "negotiating", "ready_to_sign", "signing", "signed", "active", "ended", "cancelled", "early_terminated", "archived"}


def contract_link(contract_id: uuid.UUID) -> str:
    return f"/app/portfell/leping/{contract_id}"


async def contract_type_by_code(session: AsyncSession, code: str) -> ContractType:
    ct = (await session.execute(select(ContractType).where(ContractType.code == code))).scalar_one_or_none()
    if not ct:
        raise NotFound(f"Tundmatu lepingu liik: {code}")
    return ct


async def get_contract(session: AsyncSession, contract_id: uuid.UUID) -> Contract:
    c = await session.get(Contract, contract_id)
    if not c or c.deleted_at:
        raise NotFound("Lepingut ei leitud")
    return c


async def create_contract(
    session: AsyncSession,
    actor: Actor,
    *,
    type_code: str,
    title: str,
    number: str,
    status: str,
    origin: str,
    company_id: uuid.UUID | None = None,
    parties: list[dict[str, Any]] | None = None,
    category: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    notes: str | None = None,
) -> Contract:
    if origin not in ("platform", "imported"):
        raise DomainError("Lepingu päritolu peab olema platform või imported")
    if status not in STATUSES:
        raise DomainError(f"Tundmatu lepingu staatus: {status}")
    if start_date and end_date and end_date < start_date:
        raise DomainError("Lepingu lõpp ei saa olla enne algust")
    ct = await contract_type_by_code(session, type_code)
    c = Contract(
        account_id=actor.account_id, number=number.strip(), contract_type_id=ct.id, type_code=ct.code, category=category,
        company_id=company_id, title=title.strip(), status=status, origin=origin,
        start_date=start_date, end_date=end_date, notes=notes,
    )
    session.add(c)
    await session.flush()
    emit(session, actor, "contract", c.id, "contract.created",
         {"number": c.number, "type_code": c.type_code, "status": c.status, "origin": c.origin, "company_id": company_id,
          "parties": [{"party_id": it["party_id"], "role": it["role"], "is_primary": bool(it.get("is_primary"))} for it in (parties or [])]})
    if parties:
        from app.domain.contract_parties import add_party

        primary_idx = next((i for i, it in enumerate(parties) if it.get("is_primary")), 0)
        for i, it in enumerate(parties):
            await add_party(session, actor, contract_id=c.id, party_id=uuid.UUID(str(it["party_id"])), role=it["role"], is_primary=i == primary_idx,
                            valid_from=it.get("valid_from"), source=it.get("source") or ("import" if origin == "imported" else "manual"))
    await index_contract(session, c)
    return c


async def index_contract(session: AsyncSession, c: Contract) -> None:
    from app.domain.contract_parties import primary_parties

    primary = (await primary_parties(session, [c.id])).get(c.id)
    party_name = primary.name if primary else None
    subtitle = " · ".join(x for x in [c.number, party_name, c.status] if x)
    text = " ".join(x for x in [c.title, c.number, party_name, c.category, c.type_code, c.notes] if x)
    await index_entity(session, c.account_id, "contract", c.id, c.title, text, contract_link(c.id), subtitle=subtitle)
