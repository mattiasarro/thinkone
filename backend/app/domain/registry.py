"""Derived asset status (vaba/üüritud, täidetud/täitmata) — a projection over active allocations, never stored."""

from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import date

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contracts import Contract
from app.models.registry import Allocation, Asset

# per-vertical vocabulary; the engine only knows free | partial | occupied
STATUS_WORDS = {
    "real_estate": {"free": "vaba", "partial": "osaliselt", "occupied": "üüritud"},
    "employment": {"free": "täitmata", "partial": "osaliselt", "occupied": "täidetud"},
}
DEFAULT_WORDS = {"free": "vaba", "partial": "osaliselt", "occupied": "hõivatud"}
# parking register statuses (demo v663): out of service › rented › reserve › free; the EV type is shown separately
SPOT_STATUS = {"out": "kasutusest väljas", "occupied": "üüritud", "reserve": "reserv", "free": "vaba"}
SPLIT_STATUS = "jagatud"
INACTIVE_STATUS = "mitteaktiivne"
# contract statuses after which an allocation is history only (the asset is free to be merged, deleted-guarded, …)
ENDED_STATUSES = ("ended", "cancelled", "early_terminated", "archived")
# unit types that do not count towards a container's occupancy (the register's own units, not lettable space)
AUXILIARY_UNITS = {"parking_spot"}


@dataclass
class Occupancy:
    units: int
    occupied: int
    free: int


def status_word(vertical: str, level: str) -> str:
    return STATUS_WORDS.get(vertical, DEFAULT_WORDS)[level]


def is_split_parent(asset: Asset) -> bool:
    return asset.type_code == "space" and bool((asset.attributes or {}).get("split_into"))


def is_inactive(asset: Asset) -> bool:
    """A space merged back into its parent: kept with its history and log, but not lettable and not counted."""
    return asset.type_code == "space" and (asset.attributes or {}).get("active") is False


def is_lettable(asset: Asset) -> bool:
    return not is_split_parent(asset) and not is_inactive(asset)


def active_allocations_stmt(asset_ids: list[uuid.UUID], today: date):
    """Allocations on the given assets whose contract is active and whose period covers ``today``."""
    return (
        select(Allocation)
        .join(Contract, Contract.id == Allocation.contract_id)
        .where(
            Allocation.asset_id.in_(asset_ids),
            Allocation.deleted_at.is_(None),
            Contract.deleted_at.is_(None),
            Contract.status == "active",
            or_(Allocation.period_start.is_(None), Allocation.period_start <= today),
            or_(Allocation.period_end.is_(None), Allocation.period_end >= today),
        )
    )


def unit_level(asset: Asset, allocations: list[Allocation]) -> str:
    if any(a.kind == "exclusive" for a in allocations):
        return "occupied"
    quota = sum(a.quantity or 0 for a in allocations if a.kind == "quota")
    if quota <= 0:
        return "free"
    return "occupied" if quota >= (asset.capacity or 1) else "partial"


def unit_status(asset: Asset, level: str) -> str:
    if asset.type_code == "parking_spot":
        attrs = asset.attributes or {}
        if attrs.get("out_of_service"):
            return SPOT_STATUS["out"]
        if level != "free":
            return SPOT_STATUS["occupied"]
        if attrs.get("reserve"):
            return SPOT_STATUS["reserve"]
        return SPOT_STATUS["free"]
    if is_inactive(asset):
        return INACTIVE_STATUS
    if is_split_parent(asset):
        return SPLIT_STATUS
    return status_word(asset.asset_type.vertical, level)


async def asset_statuses(session: AsyncSession, assets: list[Asset], today: date | None = None) -> dict[uuid.UUID, str | Occupancy]:
    """Batch: units → status word; containers → Occupancy over their direct lettable unit children."""
    today = today or date.today()
    result: dict[uuid.UUID, str | Occupancy] = {}
    units = [a for a in assets if a.asset_type.kind == "unit"]
    containers = [a for a in assets if a.asset_type.kind != "unit"]
    children: dict[uuid.UUID, list[Asset]] = defaultdict(list)
    if containers:
        stmt = select(Asset).where(Asset.parent_id.in_([c.id for c in containers]), Asset.deleted_at.is_(None))
        for child in (await session.execute(stmt)).scalars():
            if child.asset_type.kind == "unit" and child.type_code not in AUXILIARY_UNITS and is_lettable(child):
                children[child.parent_id].append(child)
    all_units = {u.id: u for u in units}
    for kids in children.values():
        for k in kids:
            all_units[k.id] = k
    by_asset: dict[uuid.UUID, list[Allocation]] = defaultdict(list)
    if all_units:
        for alloc in (await session.execute(active_allocations_stmt(list(all_units), today))).scalars():
            by_asset[alloc.asset_id].append(alloc)
    levels = {uid: unit_level(u, by_asset.get(uid, [])) for uid, u in all_units.items()}
    for u in units:
        result[u.id] = unit_status(u, levels[u.id])
    for c in containers:
        kids = children.get(c.id, [])
        occupied = sum(1 for k in kids if levels[k.id] != "free")
        result[c.id] = Occupancy(units=len(kids), occupied=occupied, free=len(kids) - occupied)
    return result


async def asset_status(session: AsyncSession, asset: Asset, today: date | None = None) -> str | Occupancy:
    return (await asset_statuses(session, [asset], today))[asset.id]


async def has_overlapping_exclusive(session: AsyncSession, asset_id: uuid.UUID, period_start: date | None, period_end: date | None,
                                    exclude_id: uuid.UUID | None = None) -> bool:
    """Any live exclusive allocation on the asset (contract not ended/cancelled) whose period overlaps the given one."""
    stmt = (
        select(Allocation.id)
        .join(Contract, Contract.id == Allocation.contract_id)
        .where(
            Allocation.asset_id == asset_id, Allocation.kind == "exclusive", Allocation.deleted_at.is_(None),
            Contract.deleted_at.is_(None), Contract.status.not_in(list(ENDED_STATUSES)),
        )
    )
    if period_start is not None:
        stmt = stmt.where(or_(Allocation.period_end.is_(None), Allocation.period_end >= period_start))
    if period_end is not None:
        stmt = stmt.where(or_(Allocation.period_start.is_(None), Allocation.period_start <= period_end))
    if exclude_id is not None:
        stmt = stmt.where(and_(Allocation.id != exclude_id))
    return (await session.execute(stmt.limit(1))).first() is not None


async def any_allocations(session: AsyncSession, asset_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Count of allocations (live or historical) per asset — a document that ever referenced the asset keeps it."""
    if not asset_ids:
        return {}
    from sqlalchemy import func

    stmt = select(Allocation.asset_id, func.count()).where(Allocation.asset_id.in_(asset_ids), Allocation.deleted_at.is_(None)).group_by(Allocation.asset_id)
    return {aid: n for aid, n in (await session.execute(stmt)).all()}


async def live_allocations(session: AsyncSession, asset_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Count of allocations per asset whose contract has not ended (draft, signed, active, …) — the asset is still committed."""
    if not asset_ids:
        return {}
    from sqlalchemy import func

    stmt = (select(Allocation.asset_id, func.count()).join(Contract, Contract.id == Allocation.contract_id)
            .where(Allocation.asset_id.in_(asset_ids), Allocation.deleted_at.is_(None), Contract.deleted_at.is_(None),
                   Contract.status.not_in(list(ENDED_STATUSES))).group_by(Allocation.asset_id))
    return {aid: n for aid, n in (await session.execute(stmt)).all()}
