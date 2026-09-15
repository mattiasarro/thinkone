"""Asset registry: containers + units, attribute validation via the vertical's schema, allocations, spaces CSV import."""

from __future__ import annotations

import csv
import io
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


async def children_of(session: AsyncSession, asset_id: uuid.UUID) -> list[Asset]:
    stmt = select(Asset).where(Asset.parent_id == asset_id, Asset.deleted_at.is_(None)).order_by(Asset.name)
    return list((await session.execute(stmt)).scalars())


async def children_counts(session: AsyncSession, asset_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not asset_ids:
        return {}
    stmt = select(Asset.parent_id, func.count()).where(Asset.parent_id.in_(asset_ids), Asset.deleted_at.is_(None)).group_by(Asset.parent_id)
    return {pid: n for pid, n in (await session.execute(stmt)).all()}


def asset_link(asset: Asset) -> str:
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
    if capacity is None:
        capacity = int(attrs.get("headcount") or 1) if t.kind == "unit" else 1
    if capacity < 1:
        raise DomainError("Maht (capacity) peab olema vähemalt 1")
    a = Asset(account_id=actor.account_id, asset_type_id=t.id, type_code=t.code, company_id=company_id, parent_id=parent_id,
              name=name, attributes=attrs, capacity=capacity)
    session.add(a)
    await session.flush()
    await session.refresh(a, attribute_names=["asset_type"])
    emit(session, actor, "asset", a.id, "asset.created", {"type_code": t.code, "name": name, "parent_id": parent_id, "company_id": company_id})
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
        new_attrs = validate_attributes(a.asset_type.schema_ref, merged)
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
        emit(session, actor, "asset", a.id, "asset.updated", changes)
        await _index(session, a)
        await _refresh_ts(session, a)
    return a


async def delete_asset(session: AsyncSession, actor: Actor, asset_id: uuid.UUID) -> None:
    a = await get_asset(session, asset_id)
    kids = await children_of(session, a.id)
    ids = [a.id] + [k.id for k in kids]
    active = (await session.execute(registry.active_allocations_stmt(ids, date.today()).limit(1))).first()
    if active:
        raise Conflict("Varal on kehtiv leping — enne kustutamist lõpeta leping või eemalda seos")
    now = datetime.now(UTC)
    for k in kids:
        k.deleted_at = now
        emit(session, actor, "asset", k.id, "asset.deleted", {"name": k.name, "cascade_from": a.id})
        await remove_entity(session, "asset", k.id)
    a.deleted_at = now
    emit(session, actor, "asset", a.id, "asset.deleted", {"name": a.name, "type_code": a.type_code, "children": len(kids)})
    await remove_entity(session, "asset", a.id)


# ---- allocations -------------------------------------------------------------------------------


async def list_allocations(session: AsyncSession, *, asset_id: uuid.UUID | None = None, contract_id: uuid.UUID | None = None) -> list[tuple[Allocation, Contract]]:
    stmt = select(Allocation, Contract).join(Contract, Contract.id == Allocation.contract_id).where(Allocation.deleted_at.is_(None))
    if asset_id:
        stmt = stmt.where(Allocation.asset_id == asset_id)
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
    if kind == "exclusive" and await registry.has_overlapping_exclusive(session, a.id, period_start, period_end):
        raise Conflict(f"„{a.name}” on samal perioodil juba teise lepinguga hõivatud")
    if period_start is None and period_end is None:
        period_start, period_end = c.start_date, c.end_date
    al = Allocation(account_id=actor.account_id, contract_id=c.id, asset_id=a.id, kind=kind, quantity=quantity if kind == "quota" else 1,
                    period_start=period_start, period_end=period_end, area_m2=area_m2)
    session.add(al)
    await session.flush()
    emit(session, actor, "allocation", al.id, "allocation.created",
         {"contract_id": c.id, "asset_id": a.id, "kind": kind, "quantity": al.quantity, "period_start": period_start, "period_end": period_end})
    return al


async def delete_allocation(session: AsyncSession, actor: Actor, allocation_id: uuid.UUID) -> None:
    al = await session.get(Allocation, allocation_id)
    if not al or al.deleted_at:
        raise NotFound("Seost ei leitud")
    al.deleted_at = datetime.now(UTC)
    emit(session, actor, "allocation", al.id, "allocation.deleted", {"contract_id": al.contract_id, "asset_id": al.asset_id})


# ---- spaces CSV import -------------------------------------------------------------------------

COLUMN_ALIASES = {
    "nimi": "name", "name": "name", "pind": "name", "ruum": "name",
    "tüüp": "type", "tuup": "type", "type": "type", "liik": "type",
    "netopind": "net_area_m2", "net_area_m2": "net_area_m2",
    "üüripind": "rentable_area_m2", "uuripind": "rentable_area_m2", "rentable_area_m2": "rentable_area_m2",
    "koefitsient": "coefficient", "coefficient": "coefficient",
    "hind": "price_per_m2", "price_per_m2": "price_per_m2", "hind_m2": "price_per_m2",
    "elekter": "electrical_capacity_kw", "electrical_capacity_kw": "electrical_capacity_kw",
    "parkimine": "parking_spots", "parkimiskohad": "parking_spots", "parking_spots": "parking_spots",
    "korrus": "floor", "floor": "floor",
}
NUMERIC = {"net_area_m2", "rentable_area_m2", "coefficient", "price_per_m2", "electrical_capacity_kw"}
INTEGER = {"parking_spots"}
CSV_TEMPLATE_HEADER = ["nimi", "tüüp", "netopind", "üüripind", "koefitsient", "hind", "elekter", "parkimiskohad", "korrus"]
CSV_TEMPLATE_EXAMPLE = ["A-101", "büroo", "120,5", "132,55", "1,10", "9,50", "25", "2", "1"]


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


def csv_template() -> str:
    out = io.StringIO()
    w = csv.writer(out, delimiter=";", lineterminator="\n")
    w.writerow(CSV_TEMPLATE_HEADER)
    w.writerow(CSV_TEMPLATE_EXAMPLE)
    return out.getvalue()


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
        header.append(COLUMN_ALIASES.get(key) or COLUMN_ALIASES.get(key.replace(" ", "_")))
    if "name" not in header:
        raise DomainError("Päisest puudub veerg „nimi”")
    if "rentable_area_m2" not in header:
        raise DomainError("Päisest puudub veerg „üüripind”")
    rows: list[ImportRow] = []
    for n, values in enumerate(reader, start=2):
        if not any(v.strip() for v in values):
            continue
        item = ImportRow(row=n, ok=True)
        for col, raw in zip(header, values, strict=False):
            if col is None:
                continue
            val = raw.strip()
            if val == "":
                continue
            if col in NUMERIC or col in INTEGER:
                try:
                    num = float(val.replace(" ", "").replace(" ", "").replace(",", "."))
                except ValueError:
                    item.errors.append(f"„{raw.strip()}” ei ole arv ({_header_word(col)})")
                    continue
                item.data[col] = int(num) if col in INTEGER else num
            else:
                item.data[col] = val
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
    existing = {a.name.lower(): a for a in await children_of(session, prop.id) if a.type_code == "space"}
    seen: dict[str, int] = {}
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
        attrs = {k: v for k, v in item.data.items() if k != "name"}
        try:
            attrs = validate_attributes(space_type.schema_ref, attrs)
        except DomainError as e:
            item.ok = False
            item.errors.extend(_attr_errors(e))
            continue
        item.data = {"name": name, **attrs}
        target = existing.get(key)
        item.action = "update" if target else "create"
        if target:
            item.asset_id = target.id
            result.updated += 1
        else:
            result.created += 1
    if dry_run:
        return result
    for item in rows:
        if not item.ok:
            continue
        attrs = {k: v for k, v in item.data.items() if k != "name"}
        if item.action == "update":
            a = await update_asset(session, actor, item.asset_id, attributes=attrs)  # type: ignore[arg-type]
        else:
            a = await create_asset(session, actor, type_code="space", name=item.data["name"], attributes=attrs, parent_id=prop.id, company_id=prop.company_id)
            item.asset_id = a.id
    emit(session, actor, "asset", prop.id, "asset.spaces_imported",
         {"created": result.created, "updated": result.updated, "rejected": sum(1 for r in rows if not r.ok), "rows": len(rows)})
    return result


# ---- helpers -----------------------------------------------------------------------------------


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


def _attr_errors(e: DomainError) -> list[str]:
    errs = getattr(e, "errors", None) or []
    if not errs:
        return [e.message]
    return [f"{'.'.join(str(x) for x in err.get('loc', [])) or 'väärtus'}: {err.get('msg')}" for err in errs]
