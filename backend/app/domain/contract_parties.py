"""Contract ↔ party links: a contract has any number of parties, each with a role in THAT contract.

Exactly one row per contract is primary — the one single-party views (lists, calendar, allocations,
omnibox subtitle) show. Rows are links, not records: removal is a hard delete.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import delete as sql_delete
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import Conflict, DomainError, NotFound, ValidationFailed
from app.domain.events import Actor, emit
from app.domain.parties import PARTY_ROLES, add_role, get_party
from app.models.contracts import Contract, ContractParty
from app.models.core import Party

SOURCES = {"import", "manual", "amendment"}

# category → (counterparty role, our company's role)
_CATEGORY_ROLES: dict[str, tuple[str, str]] = {
    "lease": ("tenant", "landlord"),
    "employment": ("employee", "employer"),
    "insurance": ("insurer", "insured"),
    "maintenance": ("maintainer", "client"),
    "management": ("manager", "client"),
    "security": ("security", "client"),
    "other": ("supplier", "client"),
}


def counterparty_role(category: str | None) -> str:
    return _CATEGORY_ROLES.get(category or "other", _CATEGORY_ROLES["other"])[0]


def our_role(category: str | None) -> str:
    return _CATEGORY_ROLES.get(category or "other", _CATEGORY_ROLES["other"])[1]


def _order():
    return (ContractParty.is_primary.desc(), ContractParty.role, Party.name)


async def list_for_contract(session: AsyncSession, contract_id: uuid.UUID) -> list[tuple[ContractParty, Party]]:
    stmt = select(ContractParty, Party).join(Party, Party.id == ContractParty.party_id).where(ContractParty.contract_id == contract_id).order_by(*_order())
    return [(cp, p) for cp, p in (await session.execute(stmt)).all()]


async def list_for_contracts(session: AsyncSession, contract_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[tuple[ContractParty, Party]]]:
    if not contract_ids:
        return {}
    stmt = (select(ContractParty, Party).join(Party, Party.id == ContractParty.party_id)
            .where(ContractParty.contract_id.in_(list(set(contract_ids)))).order_by(ContractParty.contract_id, *_order()))
    out: dict[uuid.UUID, list[tuple[ContractParty, Party]]] = {}
    for cp, p in (await session.execute(stmt)).all():
        out.setdefault(cp.contract_id, []).append((cp, p))
    return out


async def primary_parties(session: AsyncSession, contract_ids: list[uuid.UUID]) -> dict[uuid.UUID, Party]:
    if not contract_ids:
        return {}
    stmt = (select(ContractParty.contract_id, Party).join(Party, Party.id == ContractParty.party_id)
            .where(ContractParty.contract_id.in_(list(set(contract_ids))), ContractParty.is_primary))
    return {cid: p for cid, p in (await session.execute(stmt)).all()}


async def get_link(session: AsyncSession, contract_party_id: uuid.UUID) -> ContractParty:
    cp = await session.get(ContractParty, contract_party_id)
    if not cp:
        raise NotFound("Lepingu osapoolt ei leitud")
    return cp


def _check_role(role: str) -> str:
    role = (role or "").strip().lower()
    if role not in PARTY_ROLES:
        raise ValidationFailed(f"Tundmatu roll: {role}", errors=[{"loc": ["role"], "msg": "tundmatu roll"}])
    return role


async def _contract(session: AsyncSession, contract_id: uuid.UUID) -> Contract:
    c = await session.get(Contract, contract_id)
    if not c or c.deleted_at:
        raise NotFound("Lepingut ei leitud")
    return c


def _payload(cp: ContractParty, c: Contract, p: Party, **extra: Any) -> dict[str, Any]:
    return {"contract_id": c.id, "contract_number": c.number, "party_id": p.id, "party_name": p.name, "role": cp.role, "is_primary": cp.is_primary, **extra}


async def _clear_primary(session: AsyncSession, actor: Actor, c: Contract, *, keep: uuid.UUID | None = None) -> ContractParty | None:
    rows = (await session.execute(select(ContractParty).where(ContractParty.contract_id == c.id, ContractParty.is_primary))).scalars().all()
    previous = None
    for r in rows:
        if r.id != keep:
            r.is_primary = False
            previous = r
    await session.flush()
    return previous


async def add_party(
    session: AsyncSession, actor: Actor, *, contract_id: uuid.UUID, party_id: uuid.UUID, role: str, is_primary: bool = False,
    valid_from: date | None = None, source: str = "manual",
) -> ContractParty:
    role = _check_role(role)
    if source not in SOURCES:
        raise DomainError("Osapoole seose allikas peab olema import, manual või amendment")
    c = await _contract(session, contract_id)
    p = await get_party(session, party_id)
    dup = (await session.execute(select(ContractParty).where(ContractParty.contract_id == c.id, ContractParty.party_id == p.id, ContractParty.role == role))).scalar_one_or_none()
    if dup:
        raise Conflict("See osapool on lepingul selle rolliga juba olemas")
    has_any = (await session.execute(select(ContractParty.id).where(ContractParty.contract_id == c.id).limit(1))).first() is not None
    is_primary = is_primary or not has_any
    previous = await _clear_primary(session, actor, c) if is_primary else None
    cp = ContractParty(account_id=actor.account_id, contract_id=c.id, party_id=p.id, role=role, is_primary=is_primary, valid_from=valid_from, source=source)
    session.add(cp)
    await session.flush()
    await add_role(session, actor, p, role)
    emit(session, actor, "contract_party", cp.id, "contract_party.added", _payload(cp, c, p, source=source, valid_from=valid_from))
    if previous is not None:
        prev_party = await session.get(Party, previous.party_id)
        emit(session, actor, "contract_party", cp.id, "contract_party.primary_changed",
             _payload(cp, c, p, previous_party_id=previous.party_id, previous_party_name=prev_party.name if prev_party else None))
    await _reindex(session, c)
    return cp


async def update_party(session: AsyncSession, actor: Actor, contract_party_id: uuid.UUID, *, role: str | None = None,
                       valid_from: date | None = None, valid_to: date | None = None) -> ContractParty:
    cp = await get_link(session, contract_party_id)
    c = await _contract(session, cp.contract_id)
    p = await get_party(session, cp.party_id)
    changes: dict[str, Any] = {}
    if role is not None:
        role = _check_role(role)
        if role != cp.role:
            dup = (await session.execute(select(ContractParty).where(ContractParty.contract_id == c.id, ContractParty.party_id == p.id, ContractParty.role == role,
                                                                      ContractParty.id != cp.id))).scalar_one_or_none()
            if dup:
                raise Conflict("See osapool on lepingul selle rolliga juba olemas")
            changes["role"] = [cp.role, role]
            cp.role = role
            await add_role(session, actor, p, role)
    for k, v in (("valid_from", valid_from), ("valid_to", valid_to)):
        if v is not None and getattr(cp, k) != v:
            changes[k] = [getattr(cp, k), v]
            setattr(cp, k, v)
    if cp.valid_from and cp.valid_to and cp.valid_to < cp.valid_from:
        raise DomainError("Osapoole kehtivuse lõpp ei saa olla enne algust")
    if changes:
        await session.flush()
        await session.refresh(cp, attribute_names=["updated_at"])
        emit(session, actor, "contract_party", cp.id, "contract_party.updated", _payload(cp, c, p, changes=changes))
    return cp


async def set_primary(session: AsyncSession, actor: Actor, contract_party_id: uuid.UUID) -> ContractParty:
    cp = await get_link(session, contract_party_id)
    c = await _contract(session, cp.contract_id)
    p = await get_party(session, cp.party_id)
    if cp.is_primary:
        return cp
    previous = await _clear_primary(session, actor, c, keep=cp.id)
    cp.is_primary = True
    await session.flush()
    await session.refresh(cp, attribute_names=["updated_at"])
    prev_party = await session.get(Party, previous.party_id) if previous else None
    emit(session, actor, "contract_party", cp.id, "contract_party.primary_changed",
         _payload(cp, c, p, previous_party_id=previous.party_id if previous else None, previous_party_name=prev_party.name if prev_party else None))
    await _reindex(session, c)
    return cp


async def remove_party(session: AsyncSession, actor: Actor, contract_party_id: uuid.UUID) -> None:
    cp = await get_link(session, contract_party_id)
    c = await _contract(session, cp.contract_id)
    p = await session.get(Party, cp.party_id)
    others = (await session.execute(select(ContractParty.id).where(ContractParty.contract_id == c.id, ContractParty.id != cp.id).limit(1))).first()
    if cp.is_primary and others:
        raise Conflict("Peamist osapoolt ei saa eemaldada — määra enne teine peamiseks")
    payload = {"contract_id": c.id, "contract_number": c.number, "party_id": cp.party_id, "party_name": p.name if p else None, "role": cp.role, "is_primary": cp.is_primary}
    await session.execute(sql_delete(ContractParty).where(ContractParty.id == cp.id))
    emit(session, actor, "contract_party", cp.id, "contract_party.removed", payload)
    await _reindex(session, c)


async def replace_parties(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, items: list[dict[str, Any]], source: str = "manual") -> list[ContractParty]:
    """Make the contract's party set equal to ``items`` ([{party_id, role, is_primary, valid_from}]): add, update roles, remove the rest."""
    c = await _contract(session, contract_id)
    wanted: dict[uuid.UUID, dict[str, Any]] = {}
    for it in items:
        pid = uuid.UUID(str(it["party_id"]))
        wanted[pid] = {"role": _check_role(it["role"]), "is_primary": bool(it.get("is_primary")), "valid_from": it.get("valid_from")}
    if wanted and not any(w["is_primary"] for w in wanted.values()):
        next(iter(wanted.values()))["is_primary"] = True
    if sum(1 for w in wanted.values() if w["is_primary"]) > 1:
        raise DomainError("Täpselt üks osapool peab olema peamine")
    current = {cp.party_id: cp for cp in (await session.execute(select(ContractParty).where(ContractParty.contract_id == c.id))).scalars()}
    # 1. drop rows that are gone (clear their primary flag first so the partial unique index never sees two)
    for pid, cp in list(current.items()):
        if pid not in wanted:
            p = await session.get(Party, pid)
            payload = {"contract_id": c.id, "contract_number": c.number, "party_id": pid, "party_name": p.name if p else None, "role": cp.role, "is_primary": cp.is_primary}
            await session.execute(sql_delete(ContractParty).where(ContractParty.id == cp.id))
            emit(session, actor, "contract_party", cp.id, "contract_party.removed", payload)
            del current[pid]
    # 2. nobody is primary while we rewrite
    for cp in current.values():
        cp.is_primary = False
    await session.flush()
    out: list[ContractParty] = []
    for pid, w in wanted.items():
        cp = current.get(pid)
        if cp is None:
            p = await get_party(session, pid)
            cp = ContractParty(account_id=actor.account_id, contract_id=c.id, party_id=p.id, role=w["role"], is_primary=False, valid_from=w["valid_from"], source=source)
            session.add(cp)
            await session.flush()
            await add_role(session, actor, p, w["role"])
            emit(session, actor, "contract_party", cp.id, "contract_party.added", _payload(cp, c, p, source=source, valid_from=w["valid_from"]))
        elif cp.role != w["role"]:
            p = await get_party(session, pid)
            changes = {"role": [cp.role, w["role"]]}
            cp.role = w["role"]
            await add_role(session, actor, p, w["role"])
            emit(session, actor, "contract_party", cp.id, "contract_party.updated", _payload(cp, c, p, changes=changes))
        out.append(cp)
    await session.flush()
    for cp, (pid, w) in zip(out, wanted.items(), strict=True):
        if w["is_primary"]:
            cp.is_primary = True
            p = await get_party(session, pid)
            emit(session, actor, "contract_party", cp.id, "contract_party.primary_changed", _payload(cp, c, p))
    await session.flush()
    await _reindex(session, c)
    return out


async def change_primary_by_amendment(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, *, new_party_id: uuid.UUID, valid_from: date,
                                      role: str | None = None) -> ContractParty:
    """Tenant change: close the current primary row the day before and add the new party as primary (source=amendment)."""
    from datetime import timedelta

    c = await _contract(session, contract_id)
    current = (await session.execute(select(ContractParty).where(ContractParty.contract_id == c.id, ContractParty.is_primary))).scalar_one_or_none()
    role = _check_role(role) if role else (current.role if current else counterparty_role(c.category))
    if current is not None:
        current.valid_to = valid_from - timedelta(days=1)
        current.is_primary = False
        await session.flush()
    cp = await add_party(session, actor, contract_id=c.id, party_id=new_party_id, role=role, is_primary=True, valid_from=valid_from, source="amendment")
    return cp


async def _reindex(session: AsyncSession, c: Contract) -> None:
    from app.domain.contracts import index_contract

    await index_contract(session, c)


__all__ = ["add_party", "update_party", "set_primary", "remove_party", "replace_parties", "list_for_contract", "list_for_contracts", "primary_parties",
           "counterparty_role", "our_role", "change_primary_by_amendment"]
