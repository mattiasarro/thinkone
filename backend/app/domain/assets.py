"""Asset registry: containers + units, attribute validation via the vertical's schema, allocations, spaces CSV import."""

from __future__ import annotations

import csv
import io
import re
import uuid
from dataclasses import dataclass, field
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import registry
from app.domain.errors import Conflict, DomainError, NotFound
from app.domain.events import Actor, emit
from app.domain.search import index_entity, remove_entity
from app.models.contracts import Contract
from app.models.registry import Allocation, Asset, AssetType
from app.verticals import validate_attributes
from app.verticals.real_estate import SPACE_PART_KEYS, SPACE_PART_LABELS

ALLOCATION_KINDS = {"exclusive", "quota", "coverage"}
REQUIRES_COMPANY = {"property"}  # top-level real-estate containers belong to a landlord company


# ---- lookups -----------------------------------------------------------------------------------


async def asset_type_by_code(session: AsyncSession, code: str) -> AssetType:
    t = (await session.execute(select(AssetType).where(AssetType.code == code))).scalar_one_or_none()
    if not t:
        raise DomainError(f"Tundmatu vara liik: {code}")
    return t


async def get_asset(session: AsyncSession, asset_id: uuid.UUID) -> Asset:
    a = await session.get(Asset, asset_id)
    if not a or a.deleted_at:
        raise NotFound("Vara ei leitud")
    return a


async def list_assets(session: AsyncSession, *, type_code: str | None = None, parent_id: uuid.UUID | None = None,
                      company_id: uuid.UUID | None = None) -> list[Asset]:
    stmt = select(Asset).where(Asset.deleted_at.is_(None)).order_by(Asset.type_code, Asset.name)
    if type_code:
        stmt = stmt.where(Asset.type_code == type_code)
    if parent_id:
        stmt = stmt.where(Asset.parent_id == parent_id)
    if company_id:
        stmt = stmt.where(Asset.company_id == company_id)
    return list((await session.execute(stmt)).scalars())


async def children_of(session: AsyncSession, asset_id: uuid.UUID, type_code: str | None = None) -> list[Asset]:
    stmt = select(Asset).where(Asset.parent_id == asset_id, Asset.deleted_at.is_(None)).order_by(Asset.name)
    if type_code:
        stmt = stmt.where(Asset.type_code == type_code)
    return list((await session.execute(stmt)).scalars())


async def children_counts(session: AsyncSession, asset_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    """Direct lettable children (spaces/positions), excluding register rows such as parking spots."""
    if not asset_ids:
        return {}
    stmt = (select(Asset.parent_id, func.count()).where(Asset.parent_id.in_(asset_ids), Asset.deleted_at.is_(None),
                                                        Asset.type_code.not_in(list(registry.AUXILIARY_UNITS))).group_by(Asset.parent_id))
    return {pid: n for pid, n in (await session.execute(stmt)).all()}


def asset_link(asset: Asset) -> str:
    if asset.type_code == "space":
        return f"/app/portfell/pind/{asset.id}"
    if asset.type_code == "parking_spot" and asset.parent_id:
        return f"/app/portfell/objekt/{asset.parent_id}/parkimine"
    if asset.asset_type.kind == "unit" and asset.parent_id:
        return f"/app/portfell/objekt/{asset.parent_id}?space={asset.id}"
    return f"/app/portfell/objekt/{asset.id}"


# ---- commands ----------------------------------------------------------------------------------


async def create_asset(session: AsyncSession, actor: Actor, *, type_code: str, name: str, attributes: dict[str, Any] | None = None,
                       company_id: uuid.UUID | None = None, parent_id: uuid.UUID | None = None, capacity: int | None = None) -> Asset:
    t = await asset_type_by_code(session, type_code)
    name = (name or "").strip()
    if not name:
        raise DomainError("Vara nimi on kohustuslik")
    parent = await _check_parent(session, t, parent_id)
    if t.code in REQUIRES_COMPANY and not company_id:
        raise DomainError("Objekt peab kuuluma ettevõttele (company_id)")
    if company_id is None and parent is not None:
        company_id = parent.company_id
    attrs = validate_attributes(t.schema_ref, attributes or {})
    if t.code == "parking_spot":
        assert parent is not None
        await _check_spot_number(session, parent.id, attrs["number"])
        if attrs.get("space_id"):
            await _check_space_of(session, parent.id, attrs["space_id"])
    if capacity is None:
        capacity = int(attrs.get("headcount") or 1) if t.kind == "unit" else 1
    if capacity < 1:
        raise DomainError("Maht (capacity) peab olema vähemalt 1")
    a = Asset(account_id=actor.account_id, asset_type_id=t.id, type_code=t.code, company_id=company_id, parent_id=parent_id,
              name=name, attributes=attrs, capacity=capacity)
    session.add(a)
    await session.flush()
    await session.refresh(a, attribute_names=["asset_type"])
    emit(session, actor, "asset", a.id, "asset.created", {"type_code": t.code, "name": name, "parent_id": parent_id, "company_id": company_id,
                                                          "parent_name": parent.name if parent else None, **_log_attrs(t.code, attrs)})
    if t.code != "parking_spot":
        await _index(session, a)
    return a


async def update_asset(session: AsyncSession, actor: Actor, asset_id: uuid.UUID, *, name: str | None = None,
                       attributes: dict[str, Any] | None = None, capacity: int | None = None, company_id: uuid.UUID | None = None) -> Asset:
    a = await get_asset(session, asset_id)
    changes: dict[str, Any] = {}
    if name is not None:
        name = name.strip()
        if not name:
            raise DomainError("Vara nimi ei tohi olla tühi")
        if name != a.name:
            changes["name"] = [a.name, name]
            a.name = name
    if attributes is not None:
        merged = {**(a.attributes or {}), **attributes}
        merged = {k: v for k, v in merged.items() if v is not None}
        if a.type_code == "space" and "parts" in attributes and not attributes.get("parts"):
            merged.pop("parts", None)
        new_attrs = validate_attributes(a.asset_type.schema_ref, merged)
        if a.type_code == "parking_spot" and a.parent_id:
            if new_attrs["number"] != (a.attributes or {}).get("number"):
                await _check_spot_number(session, a.parent_id, new_attrs["number"], exclude_id=a.id)
            if new_attrs.get("space_id") and new_attrs.get("space_id") != (a.attributes or {}).get("space_id"):
                await _check_space_of(session, a.parent_id, new_attrs["space_id"])
        if new_attrs != a.attributes:
            changes["attributes"] = {k: [a.attributes.get(k), new_attrs.get(k)] for k in set(a.attributes) | set(new_attrs) if a.attributes.get(k) != new_attrs.get(k)}
            a.attributes = new_attrs
    if capacity is not None:
        if capacity < 1:
            raise DomainError("Maht (capacity) peab olema vähemalt 1")
        if capacity != a.capacity:
            changes["capacity"] = [a.capacity, capacity]
            a.capacity = capacity
    if company_id is not None and company_id != a.company_id:
        changes["company_id"] = [a.company_id, company_id]
        a.company_id = company_id
    if changes:
        emit(session, actor, "asset", a.id, "asset.updated", {"type_code": a.type_code, "name": a.name, **changes})
        if a.type_code != "parking_spot":
            await _index(session, a)
        await _refresh_ts(session, a)
    return a


async def delete_block_reason(session: AsyncSession, a: Asset) -> str | None:
    """Why an asset cannot be deleted (demo v794): any document — live or archived — that referenced it keeps it."""
    attrs = a.attributes or {}
    if a.type_code == "space":
        if attrs.get("split_into"):
            return "Pind on jagatud üksusteks — ühenda üksused enne tagasi."
        if attrs.get("split_from") and not registry.is_inactive(a):
            return "See on jagatud pinna üksus — ühenda üksused ema-pinna lehel."
    kids = await children_of(session, a.id)
    ids = [a.id] + [k.id for k in kids]
    refs = await registry.any_allocations(session, ids)
    if refs:
        rows = (await session.execute(
            select(Contract.number, Contract.status).join(Allocation, Allocation.contract_id == Contract.id)
            .where(Allocation.asset_id.in_(ids), Allocation.deleted_at.is_(None)).limit(1))).first()
        number, status = rows if rows else ("?", "")
        if a.type_code == "parking_spot":
            return f"Koht on lepingus {number} — dokumendi ajalugu viitab sellele."
        archived = status in registry.ENDED_STATUSES
        what = "Pind" if a.type_code == "space" else "Vara"
        return f"{what} on lepingus {number}{' (arhiivis)' if archived else ''} — dokumendi ajalugu viitab sellele."
    return None


async def delete_asset(session: AsyncSession, actor: Actor, asset_id: uuid.UUID) -> None:
    a = await get_asset(session, asset_id)
    reason = await delete_block_reason(session, a)
    if reason:
        raise Conflict(reason)
    kids = await children_of(session, a.id)
    now = datetime.now(UTC)
    released: list[str] = []
    if a.type_code == "space" and a.parent_id:
        # the space's default parking spots stay in the register without a space
        for spot in await spots_of_space(session, a.parent_id, a.id):
            spot.attributes = {**spot.attributes, "space_id": None}
            spot.attributes.pop("space_id", None)
            released.append(spot.attributes["number"])
    for k in kids:
        k.deleted_at = now
        emit(session, actor, "asset", k.id, "asset.deleted", {"type_code": k.type_code, "name": k.name, "cascade_from": a.id})
        await remove_entity(session, "asset", k.id)
    a.deleted_at = now
    emit(session, actor, "asset", a.id, "asset.deleted", {"type_code": a.type_code, "name": a.name, "parent_id": a.parent_id, "children": len(kids),
                                                          **_log_attrs(a.type_code, a.attributes or {}), "parking_released": released or None})
    await remove_entity(session, "asset", a.id)


# ---- allocations -------------------------------------------------------------------------------


async def list_allocations(session: AsyncSession, *, asset_id: uuid.UUID | None = None, contract_id: uuid.UUID | None = None,
                           asset_ids: list[uuid.UUID] | None = None) -> list[tuple[Allocation, Contract]]:
    stmt = select(Allocation, Contract).join(Contract, Contract.id == Allocation.contract_id).where(Allocation.deleted_at.is_(None))
    if asset_id:
        stmt = stmt.where(Allocation.asset_id == asset_id)
    if asset_ids is not None:
        stmt = stmt.where(Allocation.asset_id.in_(asset_ids))
    if contract_id:
        stmt = stmt.where(Allocation.contract_id == contract_id)
    stmt = stmt.order_by(Allocation.period_start.desc().nulls_last(), Allocation.created_at.desc())
    return [(al, c) for al, c in (await session.execute(stmt)).all()]


async def allocate(session: AsyncSession, actor: Actor, *, contract_id: uuid.UUID, asset_id: uuid.UUID, kind: str, quantity: int = 1,
                   period_start: date | None = None, period_end: date | None = None, area_m2: float | None = None) -> Allocation:
    """Bind a contract to an asset. Exclusive on an already-exclusively-allocated unit for an overlapping period → Conflict."""
    if kind not in ALLOCATION_KINDS:
        raise DomainError("Seose liik peab olema exclusive, quota või coverage")
    a = await get_asset(session, asset_id)
    c = await session.get(Contract, contract_id)
    if not c or c.deleted_at:
        raise NotFound("Lepingut ei leitud")
    if period_start and period_end and period_end < period_start:
        raise DomainError("Perioodi lõpp ei saa olla enne algust")
    if quantity < 1:
        raise DomainError("Kogus peab olema vähemalt 1")
    if kind in ("exclusive", "quota") and a.asset_type.kind != "unit":
        raise DomainError("Ainu- ja kvoodiseos saab olla ainult üksusel (pind, ametikoht); konteinerile sobib coverage")
    if registry.is_split_parent(a):
        raise DomainError("Jagatud pinda ei saa siduda — seo üksus")
    if registry.is_inactive(a):
        raise DomainError("Mitteaktiivset pinda ei saa siduda — see on ühendatud tagasi ema-pinnaks")
    if period_start is None and period_end is None:
        period_start, period_end = c.start_date, c.end_date
    if kind == "exclusive" and await registry.has_overlapping_exclusive(session, a.id, period_start, period_end):
        raise Conflict(f"„{a.name}” on samal perioodil juba teise lepinguga hõivatud")
    al = Allocation(account_id=actor.account_id, contract_id=c.id, asset_id=a.id, kind=kind, quantity=quantity if kind == "quota" else 1,
                    period_start=period_start, period_end=period_end, area_m2=area_m2)
    session.add(al)
    await session.flush()
    emit(session, actor, "allocation", al.id, "allocation.created",
         {"contract_id": c.id, "contract_number": c.number, "asset_id": a.id, "asset_name": a.name, "type_code": a.type_code, "kind": kind,
          "quantity": al.quantity, "period_start": period_start, "period_end": period_end})
    return al


async def delete_allocation(session: AsyncSession, actor: Actor, allocation_id: uuid.UUID) -> None:
    al = await session.get(Allocation, allocation_id)
    if not al or al.deleted_at:
        raise NotFound("Seost ei leitud")
    al.deleted_at = datetime.now(UTC)
    emit(session, actor, "allocation", al.id, "allocation.deleted", {"contract_id": al.contract_id, "asset_id": al.asset_id})


# ---- parking helpers shared with the register module ---------------------------------------------


async def spots_of_space(session: AsyncSession, property_id: uuid.UUID, space_id: uuid.UUID) -> list[Asset]:
    rows = await children_of(session, property_id, "parking_spot")
    sid = str(space_id)
    return [r for r in rows if (r.attributes or {}).get("space_id") == sid]


# ---- spaces CSV import -------------------------------------------------------------------------

COLUMN_ALIASES = {
    "nimi": "name", "name": "name", "pind": "name", "ruum": "name",
    "tüüp": "type", "tuup": "type", "type": "type", "liik": "type",
    "üüripind": "rentable_area_m2", "uuripind": "rentable_area_m2", "rentable_area_m2": "rentable_area_m2", "pindala": "rentable_area_m2",
    "ladu": "part:ladu", "kontor": "part:kontor", "büroo": "part:kontor", "buroo": "part:kontor", "müügisaal": "part:myygisaal", "muugisaal": "part:myygisaal",
    "olmeala": "part:olmeala", "ühisala": "part:yhisala", "uhisala": "part:yhisala",
    "hind": "price_per_m2", "price_per_m2": "price_per_m2", "hind_m2": "price_per_m2",
    "elekter": "electrical_capacity_a", "elektrivõimsus": "electrical_capacity_a", "electrical_capacity_a": "electrical_capacity_a", "electrical_capacity_kw": "electrical_capacity_a",
    "parkimiskohad": "parking_numbers", "parkimine": "parking_numbers", "parking": "parking_numbers",
    "parkimiskohtade_arv": "parking_spots", "parkimiskohti": "parking_spots", "parking_spots": "parking_spots",
    "korrus": "floor", "floor": "floor",
    # tolerated legacy columns (spec v2 template); values are kept but not shown
    "netopind": "net_area_m2", "net_area_m2": "net_area_m2", "koefitsient": "coefficient", "coefficient": "coefficient",
    "staatus": None, "olek": None, "status": None,
}
NUMERIC = {"rentable_area_m2", "price_per_m2", "electrical_capacity_a", "net_area_m2", "coefficient"}
INTEGER = {"parking_spots"}
CSV_TEMPLATE_HEADER = ["nimi", "tüüp", "üüripind", "ladu", "kontor", "müügisaal", "olmeala", "ühisala", "hind", "elekter", "parkimiskohad", "korrus"]
CSV_TEMPLATE_EXAMPLE = ["Pind 1", "ladu", "262,5", "220", "30", "", "12,5", "", "7,60", "32", "1, 2", "1"]


@dataclass
class ImportRow:
    row: int
    ok: bool
    errors: list[str] = field(default_factory=list)
    data: dict[str, Any] = field(default_factory=dict)
    action: str | None = None  # create | update
    asset_id: uuid.UUID | None = None


@dataclass
class ImportResult:
    rows: list[ImportRow]
    created: int = 0
    updated: int = 0
    dry_run: bool = True
    parking_created: int = 0


def csv_template() -> str:
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", lineterminator="\n")
    w.writerow(CSV_TEMPLATE_HEADER)
    w.writerow(CSV_TEMPLATE_EXAMPLE)
    return out.getvalue()


def parse_numbers(text: str) -> list[str]:
    """„1-20, 25” → [1..20, 25]; non-numeric tokens (P-12) are kept verbatim."""
    out: list[str] = []
    for tok in re.split(r"[,;\s]+", str(text or "").strip()):
        if not tok:
            continue
        m = re.match(r"^(\d+)\s*[-–]\s*(\d+)$", tok)
        if m:
            a, b = int(m.group(1)), int(m.group(2))
            if b >= a and b - a < 2000:
                out.extend(str(i) for i in range(a, b + 1))
            continue
        out.append(tok)
    seen: set[str] = set()
    return [n for n in out if not (n in seen or seen.add(n))]  # type: ignore[func-returns-value]


def parse_spaces_text(text: str) -> list[ImportRow]:
    """Header row + data rows (; , or tab delimited; Estonian or English headers; decimal commas)."""
    text = text.lstrip("﻿").replace("\r\n", "\n").replace("\r", "\n")
    lines = [ln for ln in text.split("\n") if ln.strip()]
    if not lines:
        raise DomainError("Fail on tühi")
    delimiter = _sniff_delimiter(lines[0])
    reader = csv.reader(io.StringIO("\n".join(lines)), delimiter=delimiter)
    raw_header = next(reader)
    header: list[str | None] = []
    for h in raw_header:
        key = h.strip().strip('"').lower()
        header.append(COLUMN_ALIASES.get(key) or COLUMN_ALIASES.get(key.replace(" ", "_")) or COLUMN_ALIASES.get(key.replace(", m²", "").replace(" m²", "")))
    if "name" not in header:
        raise DomainError("Päisest puudub veerg „nimi”")
    if "rentable_area_m2" not in header:
        raise DomainError("Päisest puudub veerg „üüripind”")
    rows: list[ImportRow] = []
    for n, values in enumerate(reader, start=2):
        if not any(v.strip() for v in values):
            continue
        item = ImportRow(row=n, ok=True)
        parts: dict[str, float] = {}
        for col, raw in zip(header, values, strict=False):
            if col is None:
                continue
            val = raw.strip()
            if val == "":
                continue
            if col.startswith("part:"):
                num = _num(val)
                if num is None:
                    item.errors.append(f"„{val}” ei ole arv ({SPACE_PART_LABELS[col[5:]]})")
                elif num > 0:
                    parts[col[5:]] = num
                continue
            if col == "parking_numbers":
                item.data[col] = parse_numbers(val)
                continue
            if col in NUMERIC or col in INTEGER:
                num = _num(val)
                if num is None:
                    item.errors.append(f"„{val}” ei ole arv ({_header_word(col)})")
                    continue
                item.data[col] = int(num) if col in INTEGER else num
            else:
                item.data[col] = val
        if parts:
            item.data["parts"] = parts
        name = item.data.get("name")
        if not name:
            item.errors.append("nimi puudub")
        if "rentable_area_m2" not in item.data and not any("üüripind" in e for e in item.errors):
            item.errors.append("üüripind puudub")
        item.ok = not item.errors
        rows.append(item)
    if not rows:
        raise DomainError("Failis pole ühtegi andmerida")
    return rows


async def import_spaces(session: AsyncSession, actor: Actor, property_id: uuid.UUID, text: str, *, dry_run: bool = True) -> ImportResult:
    prop = await get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Pindu saab importida ainult objekti (hoone) alla")
    space_type = await asset_type_by_code(session, "space")
    rows = parse_spaces_text(text)
    existing = {a.name.lower(): a for a in await children_of(session, prop.id, "space")}
    seen: dict[str, int] = {}
    numbers_seen: dict[str, str] = {}
    result = ImportResult(rows=rows, dry_run=dry_run)
    for item in rows:
        if not item.ok:
            continue
        name = str(item.data["name"]).strip()
        key = name.lower()
        if key in seen:
            item.ok = False
            item.errors.append(f"nimi „{name}” kordub real {seen[key]}")
            continue
        seen[key] = item.row
        for nr in item.data.get("parking_numbers") or []:
            if nr in numbers_seen and numbers_seen[nr] != name:
                item.ok = False
                item.errors.append(f"parkimiskoht {nr} on juba pinnal „{numbers_seen[nr]}”")
            numbers_seen[nr] = name
        if not item.ok:
            continue
        attrs = {k: v for k, v in item.data.items() if k not in ("name", "parking_numbers")}
        if "parking_numbers" in item.data:
            attrs["parking_spots"] = len(item.data["parking_numbers"])
        try:
            attrs = validate_attributes(space_type.schema_ref, attrs)
        except DomainError as e:
            item.ok = False
            item.errors.extend(_attr_errors(e))
            continue
        item.data = {"name": name, **attrs, **({"parking_numbers": item.data["parking_numbers"]} if "parking_numbers" in item.data else {})}
        target = existing.get(key)
        item.action = "update" if target else "create"
        if target:
            item.asset_id = target.id
            result.updated += 1
        else:
            result.created += 1
    if dry_run:
        return result
    from app.domain.parking import assign_numbers

    for item in rows:
        if not item.ok:
            continue
        attrs = {k: v for k, v in item.data.items() if k not in ("name", "parking_numbers")}
        if item.action == "update":
            a = await update_asset(session, actor, item.asset_id, attributes=attrs)  # type: ignore[arg-type]
        else:
            a = await create_asset(session, actor, type_code="space", name=item.data["name"], attributes=attrs, parent_id=prop.id, company_id=prop.company_id)
            item.asset_id = a.id
        numbers = item.data.get("parking_numbers")
        if numbers:
            result.parking_created += await assign_numbers(session, actor, prop, numbers, a, create_missing=True)
    emit(session, actor, "asset", prop.id, "asset.spaces_imported",
         {"name": prop.name, "created": result.created, "updated": result.updated, "rejected": sum(1 for r in rows if not r.ok), "rows": len(rows),
          "parking_created": result.parking_created})
    return result


# ---- helpers -----------------------------------------------------------------------------------


def _num(val: str) -> float | None:
    try:
        return float(val.replace(" ", "").replace(" ", "").replace(",", "."))
    except ValueError:
        return None


def _log_attrs(type_code: str, attrs: dict[str, Any]) -> dict[str, Any]:
    """The attribute values worth a line in the event log (demo v793: every entry/change of a space is logged)."""
    if type_code == "space":
        keys = ("type", "rentable_area_m2", "price_per_m2", "electrical_capacity_a", "parking_spots", "parts")
    elif type_code == "parking_spot":
        keys = ("number", "zone", "type", "reserve", "out_of_service", "space_id")
    elif type_code == "property":
        keys = ("address", "ehr_code", "utility_cost_winter", "utility_cost_summer", "vat_taxable")
    else:
        return {}
    return {k: attrs.get(k) for k in keys if attrs.get(k) is not None}


async def _refresh_ts(session: AsyncSession, a: Asset) -> None:
    """``updated_at`` is expired after an UPDATE flush; reload it so response models never lazy-load."""
    await session.flush()
    await session.refresh(a, attribute_names=["updated_at"])


async def _check_parent(session: AsyncSession, t: AssetType, parent_id: uuid.UUID | None) -> Asset | None:
    if t.kind == "unit":
        if not parent_id:
            raise DomainError(f"{t.name_et} peab kuuluma konteineri alla (parent_id)")
        parent = await get_asset(session, parent_id)
        if parent.asset_type.kind != "container" or parent.asset_type.vertical != t.vertical:
            raise DomainError(f"{t.name_et} ei saa kuuluda „{parent.asset_type.name_et}” alla")
        return parent
    if parent_id:
        parent = await get_asset(session, parent_id)
        if parent.asset_type.kind != "container":
            raise DomainError("Ülemvara peab olema konteiner")
        return parent
    return None


async def _check_spot_number(session: AsyncSession, property_id: uuid.UUID, number: str, exclude_id: uuid.UUID | None = None) -> None:
    for s in await children_of(session, property_id, "parking_spot"):
        if s.id != exclude_id and (s.attributes or {}).get("number") == number:
            raise Conflict(f"Parkimiskoht nr {number} on registris juba olemas")


async def _check_space_of(session: AsyncSession, property_id: uuid.UUID, space_id: str) -> Asset:
    try:
        sid = uuid.UUID(str(space_id))
    except ValueError as e:
        raise DomainError("Vigane pinna id") from e
    sp = await session.get(Asset, sid)
    if not sp or sp.deleted_at or sp.type_code != "space" or sp.parent_id != property_id:
        raise DomainError("Pind peab olema sama hoone pind")
    if registry.is_inactive(sp):
        raise DomainError(f"„{sp.name}” on mitteaktiivne — parkimiskohta ei saa sellele anda")
    return sp


async def _index(session: AsyncSession, a: Asset) -> None:
    attrs = a.attributes or {}
    parent_name = None
    if a.parent_id:
        parent = await session.get(Asset, a.parent_id)
        parent_name = parent.name if parent else None
    bits = [a.asset_type.name_et, parent_name, attrs.get("address"), attrs.get("type")]
    if attrs.get("rentable_area_m2"):
        bits.append(f"{attrs['rentable_area_m2']} m²")
    subtitle = " · ".join(str(x) for x in bits if x)
    text = " ".join(str(x) for x in [a.name, a.type_code, parent_name, attrs.get("address"), attrs.get("ehr_code"), attrs.get("type"), attrs.get("use_type")] if x)
    await index_entity(session, a.account_id, "asset", a.id, a.name, text, asset_link(a), subtitle=subtitle)


def _sniff_delimiter(header_line: str) -> str:
    counts = {d: header_line.count(d) for d in (";", "\t", ",")}
    best = max(counts, key=counts.get)  # type: ignore[arg-type]
    return best if counts[best] > 0 else ";"


def _header_word(col: str) -> str:
    for k, v in COLUMN_ALIASES.items():
        if v == col:
            return k
    return col


_PYDANTIC_ET = [
    (re.compile(r"^Input should be greater than or equal to (\S+)$"), r"peab olema vähemalt \1"),
    (re.compile(r"^Input should be greater than (\S+)$"), r"peab olema suurem kui \1"),
    (re.compile(r"^Input should be less than or equal to (\S+)$"), r"ei tohi olla suurem kui \1"),
    (re.compile(r"^Input should be less than (\S+)$"), r"peab olema väiksem kui \1"),
    (re.compile(r"^Input should be a valid (number|integer|decimal).*$"), "ei ole arv"),
    (re.compile(r"^Input should be a valid string$"), "peab olema tekst"),
    (re.compile(r"^Field required$"), "puudub"),
    (re.compile(r"^Value error, (.*)$"), r"\1"),
]


def _attr_errors(e: DomainError) -> list[str]:
    """Row-level messages for the import preview: Estonian column name + translated pydantic message."""
    errs = getattr(e, "errors", None) or []
    if not errs:
        return [e.message]
    out: list[str] = []
    for err in errs:
        loc = [str(x) for x in err.get("loc", [])]
        field_name = ".".join(loc) or "väärtus"
        if loc and loc[0] in COLUMN_ALIASES.values():
            field_name = _header_word(loc[0]) if len(loc) == 1 else f"{_header_word(loc[0])}.{'.'.join(loc[1:])}"
        elif loc and loc[0] == "parts" and len(loc) > 1:
            field_name = SPACE_PART_LABELS.get(loc[1], loc[1])
        msg = str(err.get("msg") or "vigane väärtus")
        for rx, repl in _PYDANTIC_ET:
            if rx.match(msg):
                msg = rx.sub(repl, msg)
                break
        out.append(f"{field_name} {msg}" if msg[:1].islower() else f"{field_name}: {msg}")
    return out


__all__ = ["SPACE_PART_KEYS"]
