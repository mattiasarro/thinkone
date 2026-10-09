"""Parking register (demo v551 → v668): spots are a SEPARATE unit type under the building, not a field of the space.

The register is the list of spots {number, zone, type, reserve, out_of_service}; a plan is an optional layer
(Phase 3+). Each spot may carry a ``space_id`` = the space whose default spot it is; a lease on that space
takes the space's spots by default. Occupancy is derived from allocations, never written by hand.
"""

from __future__ import annotations

import csv
import io
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import assets as assets_domain
from app.domain import registry
from app.domain.errors import Conflict, DomainError
from app.domain.events import Actor, emit
from app.models.registry import Asset
from app.verticals.real_estate import PARKING_TYPES, spot_sort_key

PARKING_TEMPLATE = "nr;tsoon;tüüp;pind\n1;Hoov;tavaline;Pind 1\n2;Hoov;tavaline;Pind 1\n3;Hoov;elektriauto;\n4;Hoov;reserv;\n10-20;P-1;tavaline;\n"


def parse_type(text: str) -> tuple[str, bool]:
    """„elektriauto” / „ligipääsetav” / „tavaline”; the word „reserv” anywhere sets the reserve flag."""
    t = (text or "").strip().lower()
    reserve = "reserv" in t or "üld" in t
    if any(k in t for k in ("elekt", "laad", "ev")):
        return "elektriauto", reserve
    if any(k in t for k in ("inva", "ligip")):
        return "ligipääsetav", reserve
    return "tavaline", reserve


@dataclass
class SpotRow:
    row: int
    ok: bool
    errors: list[str] = field(default_factory=list)
    numbers: list[str] = field(default_factory=list)
    zone: str | None = None
    type: str = "tavaline"
    reserve: bool = False
    space_name: str | None = None
    space_id: uuid.UUID | None = None


@dataclass
class SpotImportResult:
    rows: list[SpotRow]
    created: int = 0
    skipped: int = 0  # numbers already in the register
    dry_run: bool = True


def parse_parking_text(text: str) -> list[SpotRow]:
    """``nr;tsoon;tüüp;pind`` rows; nr may be a range (10-20). Header optional."""
    text = text.lstrip("﻿").replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln for ln in text.split("\n") if ln.strip()]
    if not lines:
        raise DomainError("Tabel on tühi")
    delim = max((";", "\t", ","), key=lambda d: lines[0].count(d))
    if lines[0].count(delim) == 0:
        delim = ";"
    reader = csv.reader(io.StringIO("\n".join(lines)), delimiter=delim)
    rows: list[SpotRow] = []
    for n, values in enumerate(reader, start=1):
        vals = [v.strip() for v in values] + [""] * 4
        if n == 1 and vals[0].lower() in ("nr", "number", "koht"):
            continue
        if not any(vals):
            continue
        item = SpotRow(row=n, ok=True)
        item.numbers = assets_domain.parse_numbers(vals[0])
        if not item.numbers:
            item.errors.append("number puudub")
        item.zone = vals[1] or None
        item.type, item.reserve = parse_type(vals[2])
        item.space_name = vals[3] or None
        item.ok = not item.errors
        rows.append(item)
    if not rows:
        raise DomainError("Tabelis pole ühtegi rida")
    return rows


async def list_spots(session: AsyncSession, property_id: uuid.UUID) -> list[Asset]:
    rows = await assets_domain.children_of(session, property_id, "parking_spot")
    return sorted(rows, key=lambda a: spot_sort_key((a.attributes or {}).get("number", "")))


async def spot_rows(session: AsyncSession, property_id: uuid.UUID) -> list[dict[str, Any]]:
    """Register with derived status, the default space and the current contract (for the management page)."""
    spots = await list_spots(session, property_id)
    spaces = {str(s.id): s for s in await assets_domain.children_of(session, property_id, "space")}
    statuses = await registry.asset_statuses(session, spots)
    allocs = await assets_domain.list_allocations(session, asset_ids=[s.id for s in spots]) if spots else []
    current: dict[uuid.UUID, Any] = {}
    for al, c in allocs:
        if c.status == "active" and al.asset_id not in current:
            current[al.asset_id] = c
    out = []
    for s in spots:
        a = s.attributes or {}
        sp = spaces.get(a.get("space_id") or "")
        c = current.get(s.id)
        out.append({"id": s.id, "number": a.get("number"), "zone": a.get("zone"), "type": a.get("type", "tavaline"), "reserve": bool(a.get("reserve")),
                    "out_of_service": bool(a.get("out_of_service")), "status": statuses.get(s.id), "space_id": sp.id if sp else None,
                    "space_name": sp.name if sp else None,
                    "contract": {"id": c.id, "number": c.number, "title": c.title, "status": c.status} if c else None})
    return out


async def import_spots(session: AsyncSession, actor: Actor, property_id: uuid.UUID, text: str, *, dry_run: bool = True) -> SpotImportResult:
    prop = await assets_domain.get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Parkimiskohti saab lisada ainult hoonele")
    rows = parse_parking_text(text)
    existing = {(s.attributes or {}).get("number") for s in await list_spots(session, prop.id)}
    spaces = {s.name.lower(): s for s in await assets_domain.children_of(session, prop.id, "space")}
    result = SpotImportResult(rows=rows, dry_run=dry_run)
    seen: set[str] = set()
    for item in rows:
        if not item.ok:
            continue
        if item.space_name:
            sp = spaces.get(item.space_name.lower())
            if not sp:
                item.ok = False
                item.errors.append(f"pinda „{item.space_name}” selles hoones pole")
                continue
            if registry.is_inactive(sp):
                item.ok = False
                item.errors.append(f"„{sp.name}” on mitteaktiivne — parkimiskohta ei saa sellele anda")
                continue
            item.space_id = sp.id
        fresh = [n for n in item.numbers if n not in existing and n not in seen]
        result.skipped += len(item.numbers) - len(fresh)
        result.created += len(fresh)
        seen.update(fresh)
    if dry_run:
        return result
    before = _numbers_by_space(await list_spots(session, prop.id))
    created = 0
    for item in rows:
        if not item.ok:
            continue
        for n in item.numbers:
            if n in existing:
                continue
            existing.add(n)
            await assets_domain.create_asset(session, actor, type_code="parking_spot", name=f"P {n}", parent_id=prop.id, company_id=prop.company_id,
                                             attributes={"number": n, "zone": item.zone, "type": item.type, "reserve": item.reserve,
                                                         "space_id": str(item.space_id) if item.space_id else None})
            created += 1
    if prop.attributes.get("has_parking") is not True:
        prop.attributes = {**prop.attributes, "has_parking": True}
    await sync_space_counts(session, actor, prop, before)
    emit(session, actor, "asset", prop.id, "asset.parking_imported", {"name": prop.name, "created": created, "skipped": result.skipped, "rows": len(rows)})
    return result


async def set_has_parking(session: AsyncSession, actor: Actor, property_id: uuid.UUID, value: bool) -> Asset:
    prop = await assets_domain.get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Ainult hoonel")
    if not value and await list_spots(session, prop.id):
        raise Conflict("Hoonel on parkimiskohad registris — kustuta need enne")
    return await assets_domain.update_asset(session, actor, prop.id, attributes={"has_parking": value})


async def update_spots(session: AsyncSession, actor: Actor, property_id: uuid.UUID, spot_ids: list[uuid.UUID], patch: dict[str, Any]) -> list[Asset]:
    """Bulk edit of selected spots: type, zone, reserve, out_of_service, space_id (null = no space)."""
    allowed = {"type", "zone", "reserve", "out_of_service", "space_id"}
    bad = set(patch) - allowed
    if bad:
        raise DomainError(f"Tundmatu väli: {', '.join(sorted(bad))}")
    if "type" in patch and patch["type"] not in PARKING_TYPES:
        raise DomainError("Tüüp peab olema tavaline, elektriauto või ligipääsetav")
    all_spots = await list_spots(session, property_id)
    spots = {s.id: s for s in all_spots}
    before = _numbers_by_space(all_spots)
    out: list[Asset] = []
    for sid in spot_ids:
        s = spots.get(sid)
        if not s:
            raise DomainError("Koht ei kuulu sellele hoonele")
        attrs = {**(s.attributes or {}), **patch}
        if "space_id" in patch and not patch["space_id"]:
            attrs.pop("space_id", None)
            attrs["space_id"] = None  # update_asset drops None values → attribute removed
        out.append(await assets_domain.update_asset(session, actor, s.id, attributes=attrs))
    if "space_id" in patch:
        await sync_space_counts(session, actor, await assets_domain.get_asset(session, property_id), before)
    return out


async def sync_space_counts(session: AsyncSession, actor: Actor, prop: Asset, before: dict[str, list[str]]) -> None:
    """After register rows changed owner: write each affected space's ``parking_spots`` count + one event per space."""
    after = _numbers_by_space(await list_spots(session, prop.id))
    spaces = {str(sp.id): sp for sp in await assets_domain.children_of(session, prop.id, "space")}
    for sid in set(before) | set(after):
        sp = spaces.get(sid)
        if not sp:
            continue
        b, a = sorted(before.get(sid, []), key=spot_sort_key), sorted(after.get(sid, []), key=spot_sort_key)
        if b == a:
            continue
        await assets_domain.update_asset(session, actor, sp.id, attributes={"parking_spots": len(a)})
        emit(session, actor, "asset", sp.id, "asset.parking_assigned", {"type_code": "space", "name": sp.name, "property": prop.name, "before": b, "after": a})


def _numbers_by_space(spots: list[Asset]) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for s in spots:
        a = s.attributes or {}
        if a.get("space_id"):
            out.setdefault(a["space_id"], []).append(a.get("number"))
    return out


async def assign_numbers(session: AsyncSession, actor: Actor, prop: Asset, numbers: list[str], space: Asset | None, *, create_missing: bool = False) -> int:
    """Make exactly these numbers the space's default spots (removing them from other spaces of the building).

    Returns the number of register rows created when ``create_missing`` (CSV import = first entry of the register)."""
    if space is not None and registry.is_inactive(space):
        raise DomainError(f"„{space.name}” on mitteaktiivne — parkimiskohta ei saa sellele anda")
    all_spots = await list_spots(session, prop.id)
    before = _numbers_by_space(all_spots)
    spots = {(s.attributes or {}).get("number"): s for s in all_spots}
    missing = [n for n in numbers if n not in spots]
    if missing and not create_missing:
        raise DomainError(f"Parkimiskohad pole registris: {', '.join(missing)} — lisa need enne hoone parkimise halduses")
    created = 0
    for n in missing:
        s = await assets_domain.create_asset(session, actor, type_code="parking_spot", name=f"P {n}", parent_id=prop.id, company_id=prop.company_id,
                                             attributes={"number": n})
        spots[n] = s
        created += 1
    if created and prop.attributes.get("has_parking") is not True:
        prop.attributes = {**prop.attributes, "has_parking": True}
    sid = str(space.id) if space else None
    for n, s in spots.items():
        cur = (s.attributes or {}).get("space_id")
        if n in numbers and cur != sid:
            await assets_domain.update_asset(session, actor, s.id, attributes={**s.attributes, "space_id": sid})
        elif n not in numbers and sid and cur == sid:
            await assets_domain.update_asset(session, actor, s.id, attributes={**s.attributes, "space_id": None})
    await sync_space_counts(session, actor, prop, before)
    return created


async def delete_spots(session: AsyncSession, actor: Actor, property_id: uuid.UUID, spot_ids: list[uuid.UUID]) -> int:
    all_spots = await list_spots(session, property_id)
    spots = {s.id: s for s in all_spots}
    before = _numbers_by_space(all_spots)
    n = 0
    for sid in spot_ids:
        s = spots.get(sid)
        if not s:
            raise DomainError("Koht ei kuulu sellele hoonele")
        await assets_domain.delete_asset(session, actor, s.id)  # raises Conflict when a document references the spot
        n += 1
    await sync_space_counts(session, actor, await assets_domain.get_asset(session, property_id), before)
    return n
