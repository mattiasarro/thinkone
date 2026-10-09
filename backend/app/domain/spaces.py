"""Space-level operations beyond CRUD: splitting a space into rental units and merging them back (demo v588, v639).

A rare special case, only as an explicit action: the parent space stays („Jagatud”, excluded from occupancy
and sums), the units are ordinary spaces of the same building carrying ``split_from``; their rentable areas
sum to the parent's. Each unit needs a main room part (olmeala alone is not a unit). Parking spots and
electrical capacity are divided between the units.

Merge is allowed while no unit is in a live contract (ended ones are history). The units are not deleted but
made inactive (``active: false`` — „mitteaktiivne”): their data, documents and log stay, they are not lettable
and not counted. A later split of the same parent reuses an inactive former unit whose name matches, so the
unit keeps its id and history.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import assets as assets_domain
from app.domain import registry
from app.domain.errors import Conflict, DomainError
from app.domain.events import Actor, emit
from app.models.registry import Asset
from app.verticals.real_estate import SPACE_PART_LABELS

MAIN_PARTS = ("ladu", "kontor", "myygisaal")


async def former_units(session: AsyncSession, s: Asset) -> list[Asset]:
    """Inactive units of an earlier split of ``s`` (same building, ``split_from`` = s), reusable by name on the next split."""
    if s.type_code != "space" or not s.parent_id:
        return []
    sid = str(s.id)
    return [u for u in await assets_domain.children_of(session, s.parent_id, "space")
            if registry.is_inactive(u) and (u.attributes or {}).get("split_from") == sid]


async def split_block_reason(session: AsyncSession, s: Asset) -> str | None:
    attrs = s.attributes or {}
    if s.type_code != "space":
        return "Jagada saab ainult pinda"
    if registry.is_inactive(s):
        return "Mitteaktiivset pinda ei jagata"
    if attrs.get("split_into"):
        return "Pind on juba jagatud"
    if attrs.get("split_from"):
        return "Üksust edasi ei jagata — ühenda enne tagasi"
    if (attrs.get("type") or "").lower() in ("laobokss", "laoboks"):
        return "Laoboksi ei jagata"
    parts = attrs.get("parts") or {}
    if sum(1 for k in parts if k in MAIN_PARTS and parts[k] > 0) < 2:
        return "Pinnal on üks ruumiosa — jagada saab pinda, kus on nt ladu ja kontor"
    if await registry.any_allocations(session, [s.id]):
        return "Jagada saab ainult pinda, millel pole lepingut"
    return None


async def split(session: AsyncSession, actor: Actor, space_id: uuid.UUID, units: list[dict[str, Any]]) -> list[Asset]:
    """``units``: [{name, parts: {ladu: 120, ...}, price_per_m2, parking_numbers: [...]}, ...] (2+ units)."""
    s = await assets_domain.get_asset(session, space_id)
    reason = await split_block_reason(session, s)
    if reason:
        raise Conflict(reason)
    if len(units) < 2:
        raise DomainError("Jagamiseks on vaja vähemalt kahte üksust")
    assert s.parent_id
    prop = await assets_domain.get_asset(session, s.parent_id)
    attrs = s.attributes or {}
    parent_parts: dict[str, float] = attrs.get("parts") or {}
    names = [str(u.get("name") or "").strip() for u in units]
    if any(not n for n in names):
        raise DomainError("Anna igale üksusele nimi")
    reusable = {u.name.lower(): u for u in await former_units(session, s)}
    siblings = {a.name.lower() for a in await assets_domain.children_of(session, prop.id, "space") if a.id != s.id and a.name.lower() not in reusable}
    if len({n.lower() for n in names}) < len(names) or any(n.lower() in siblings for n in names):
        raise DomainError("Üksuste nimed peavad olema erinevad ja majas uued")
    used: dict[str, float] = {}
    areas: list[float] = []
    for u, n in zip(units, names, strict=True):
        parts = {k: round(float(v), 2) for k, v in (u.get("parts") or {}).items() if v and float(v) > 0}
        bad = set(parts) - set(SPACE_PART_LABELS)
        if bad:
            raise DomainError(f"Tundmatu ruumiosa: {', '.join(sorted(bad))}")
        if not any(k in MAIN_PARTS for k in parts):
            raise DomainError(f"„{n}”: igal üksusel peab olema põhiruum (nt ladu või kontor) — olmealast üksi üksust ei tehta")
        for k, v in parts.items():
            used[k] = round(used.get(k, 0) + v, 2)
        area = round(sum(parts.values()), 2)
        if area <= 0:
            raise DomainError(f"„{n}”: üksusel peab olema vähemalt üks ruumiosa")
        price = u.get("price_per_m2")
        if price is None or float(price) <= 0:
            raise DomainError(f"„{n}”: hind peab olema positiivne arv")
        areas.append(area)
    for k, total in used.items():
        if abs(total - parent_parts.get(k, 0)) > 0.05:
            raise DomainError(f"{SPACE_PART_LABELS[k]}: üksused kokku {total:g} m², pinnal {parent_parts.get(k, 0):g} m² — need peavad klappima")
    if abs(sum(areas) - float(attrs["rentable_area_m2"])) > 0.05:
        raise DomainError(f"Üksuste üüripind kokku {sum(areas):g} m² peab võrduma pinna üüripinnaga {attrs['rentable_area_m2']:g} m²")
    from app.domain.parking import assign_numbers

    own_spots = {(x.attributes or {}).get("number") for x in await assets_domain.spots_of_space(session, prop.id, s.id)}
    claimed: set[str] = set()
    for u, n in zip(units, names, strict=True):
        for nr in u.get("parking_numbers") or []:
            if nr not in own_spots:
                raise DomainError(f"„{n}”: parkimiskoht {nr} ei ole selle pinna koht")
            if nr in claimed:
                raise DomainError(f"Parkimiskoht {nr} on antud kahele üksusele")
            claimed.add(nr)
    elec = float(attrs.get("electrical_capacity_a") or 0)
    total_area = sum(areas)
    created: list[Asset] = []
    elec_left = elec
    for i, (u, n) in enumerate(zip(units, names, strict=True)):
        parts = {k: round(float(v), 2) for k, v in (u.get("parts") or {}).items() if v and float(v) > 0}
        main = [k for k in parts if k in MAIN_PARTS]
        unit_type = " + ".join(SPACE_PART_LABELS[k].lower() for k in main) if main else attrs.get("type")
        if i < len(units) - 1:
            ea = round(elec * areas[i] / total_area) if elec else None
            if ea is not None:
                elec_left -= ea
        else:
            ea = round(elec_left) if elec else None
        new_attrs: dict[str, Any] = {"type": unit_type, "rentable_area_m2": areas[i], "parts": parts, "price_per_m2": float(u["price_per_m2"]),
                                     "electrical_capacity_a": ea, "floor": attrs.get("floor"), "split_from": str(s.id)}
        old = reusable.get(n.lower())
        if old:  # same unit as in an earlier split → reactivate it with the new figures, keeping its id, documents and log
            a = await assets_domain.update_asset(session, actor, old.id, name=n,
                                                 attributes={**new_attrs, "active": None, "parking_spots": None, "split_into": None})
            emit(session, actor, "asset", a.id, "asset.reactivated", {"type_code": "space", "name": a.name, "split_from": s.id})
        else:
            a = await assets_domain.create_asset(session, actor, type_code="space", name=n, parent_id=prop.id, company_id=prop.company_id,
                                                 attributes={k: v for k, v in new_attrs.items() if v is not None})
        nrs = list(u.get("parking_numbers") or [])
        if nrs:
            await assign_numbers(session, actor, prop, nrs, a)
        created.append(a)
    await assets_domain.update_asset(session, actor, s.id, attributes={"split_into": [str(a.id) for a in created], "parking_spots": 0})
    for x in await assets_domain.spots_of_space(session, prop.id, s.id):  # spots not given to a unit stay with the parent → release
        await assets_domain.update_asset(session, actor, x.id, attributes={**x.attributes, "space_id": None})
    emit(session, actor, "asset", s.id, "asset.split",
         {"type_code": "space", "name": s.name, "units": [{"id": a.id, "name": a.name, "rentable_area_m2": a.attributes.get("rentable_area_m2")} for a in created]})
    return created


async def merge(session: AsyncSession, actor: Actor, space_id: uuid.UUID) -> Asset:
    s = await assets_domain.get_asset(session, space_id)
    ids = (s.attributes or {}).get("split_into") or []
    if not ids:
        raise DomainError("Pind ei ole jagatud")
    units = [await assets_domain.get_asset(session, uuid.UUID(i)) for i in ids]
    refs = await registry.live_allocations(session, [u.id for u in units])
    if refs:
        busy = next(u for u in units if u.id in refs)
        raise Conflict(f"„{busy.name}” on lepingus — üksusi ei saa ühendada")
    assert s.parent_id
    prop = await assets_domain.get_asset(session, s.parent_id)
    from app.domain.parking import assign_numbers

    numbers: list[str] = []
    for u in units:
        numbers += [(x.attributes or {}).get("number") for x in await assets_domain.spots_of_space(session, prop.id, u.id)]
    for u in units:  # kept, not deleted: documents, log and the parent link stay; the unit can be reused by the next split
        await assets_domain.update_asset(session, actor, u.id, attributes={"active": False, "parking_spots": None})
        emit(session, actor, "asset", u.id, "asset.deactivated", {"type_code": "space", "name": u.name, "merged_into": s.id, "merged_into_name": s.name})
    await assets_domain.update_asset(session, actor, s.id, attributes={"split_into": None})
    s.attributes = {k: v for k, v in s.attributes.items() if k != "split_into"}
    if numbers:
        await assign_numbers(session, actor, prop, numbers, s)
    emit(session, actor, "asset", s.id, "asset.merged", {"type_code": "space", "name": s.name, "units": [u.name for u in units]})
    return s
