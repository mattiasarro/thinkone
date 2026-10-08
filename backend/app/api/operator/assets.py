from __future__ import annotations

import json
import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Query, Request, Response, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import assets as assets_domain
from app.domain import attachments as attachments_domain
from app.domain import parking as parking_domain
from app.domain import parking_plan as parking_plan_domain
from app.domain import plans as plans_domain
from app.domain import registry
from app.domain import spaces as spaces_domain
from app.domain.errors import DomainError
from app.models.contracts import Contract
from app.models.registry import Allocation, Asset

router = APIRouter(tags=["assets"])


class OccupancyOut(BaseModel):
    units: int
    occupied: int
    free: int


class AssetOut(BaseModel):
    id: uuid.UUID
    type_code: str
    kind: str
    vertical: str
    name: str
    company_id: uuid.UUID | None
    parent_id: uuid.UUID | None
    attributes: dict[str, Any]
    capacity: int
    status: str | None = None
    occupancy: OccupancyOut | None = None
    children_count: int | None = None
    created_at: datetime
    updated_at: datetime


class AttachmentSummaryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    role: str
    filename: str
    content_type: str
    size: int
    created_at: datetime


class AllocationContractOut(BaseModel):
    id: uuid.UUID
    number: str
    title: str
    status: str
    type_code: str
    party_name: str | None = None


class AllocationOut(BaseModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    asset_id: uuid.UUID
    kind: str
    quantity: int
    period_start: date | None
    period_end: date | None
    area_m2: float | None
    contract: AllocationContractOut


class AssetChildOut(AssetOut):
    attachments: list[AttachmentSummaryOut]  # e.g. a space's floor plan, shown on the parent property


class ParkingSpotOut(BaseModel):
    id: uuid.UUID
    number: str
    zone: str | None
    type: str
    reserve: bool
    out_of_service: bool
    status: str | None
    space_id: uuid.UUID | None
    space_name: str | None
    contract: dict[str, Any] | None


class AssetRefOut(BaseModel):
    id: uuid.UUID
    name: str
    type_code: str
    status: str | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)


class AssetDetailOut(AssetOut):
    children: list[AssetChildOut]
    attachments: list[AttachmentSummaryOut]
    allocations: list[AllocationOut]
    parent: AssetRefOut | None = None
    parking_spots: list[ParkingSpotOut] = []  # a space's default spots / a property's whole register
    split_parent: AssetRefOut | None = None
    split_units: list[AssetRefOut] = []
    delete_block_reason: str | None = None
    split_block_reason: str | None = None


class AssetIn(BaseModel):
    type_code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    company_id: uuid.UUID | None = None
    parent_id: uuid.UUID | None = None
    attributes: dict[str, Any] = Field(default_factory=dict)
    capacity: int | None = Field(default=None, ge=1)


class AssetPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    attributes: dict[str, Any] | None = None
    capacity: int | None = Field(default=None, ge=1)
    company_id: uuid.UUID | None = None


class AllocationIn(BaseModel):
    contract_id: uuid.UUID
    asset_id: uuid.UUID
    kind: str = Field(pattern="^(exclusive|quota|coverage)$")
    quantity: int = Field(default=1, ge=1)
    period_start: date | None = None
    period_end: date | None = None
    area_m2: float | None = Field(default=None, ge=0)


class ImportRowOut(BaseModel):
    row: int
    ok: bool
    errors: list[str]
    data: dict[str, Any]
    action: str | None
    asset_id: uuid.UUID | None


class ImportResultOut(BaseModel):
    rows: list[ImportRowOut]
    created: int
    updated: int
    dry_run: bool
    parking_created: int = 0


class SpacesImportIn(BaseModel):
    text: str = Field(min_length=1)


class ParkingRowOut(BaseModel):
    row: int
    ok: bool
    errors: list[str]
    numbers: list[str]
    zone: str | None
    type: str
    reserve: bool
    space_name: str | None
    space_id: uuid.UUID | None


class ParkingImportOut(BaseModel):
    rows: list[ParkingRowOut]
    created: int
    skipped: int
    dry_run: bool


class ParkingUpdateIn(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1)
    patch: dict[str, Any]


class ParkingAssignIn(BaseModel):
    space_id: uuid.UUID | None = None  # null → the numbers get no space
    numbers: list[str]


class ParkingDeleteIn(BaseModel):
    ids: list[uuid.UUID] = Field(min_length=1)


class HasParkingIn(BaseModel):
    has_parking: bool


class SpotGeomIn(BaseModel):
    x: float
    y: float
    w: float
    h: float
    rot: float = 0
    lot: str | None = None


class PlanSpotIn(BaseModel):
    id: uuid.UUID
    geom: SpotGeomIn | None = None
    space_id: uuid.UUID | None = None
    set_space: bool = False  # True → ``space_id`` is written (null detaches); False → the default space is left as is


class PlanNewSpotIn(BaseModel):
    number: str = Field(min_length=1, max_length=20)
    zone: str | None = None
    type: str = "tavaline"
    geom: SpotGeomIn
    space_id: uuid.UUID | None = None


class ParkingPlanIn(BaseModel):
    lots: list[dict[str, Any]] | None = None  # None = unchanged
    spots: list[PlanSpotIn] = Field(default_factory=list)
    new: list[PlanNewSpotIn] = Field(default_factory=list)
    clear_draft: bool = False


class PlanSpotOut(ParkingSpotOut):
    geom: SpotGeomIn | None = None


class PlanAttachmentOut(BaseModel):
    id: uuid.UUID
    filename: str
    content_type: str


class ParkingPlanOut(BaseModel):
    property_id: uuid.UUID
    lots: list[dict[str, Any]]
    spots: list[PlanSpotOut]
    draft: dict[str, Any] | None
    plan_attachments: list[PlanAttachmentOut]


class ParkingDeriveIn(BaseModel):
    attachment_id: uuid.UUID | None = None
    lot_id: str | None = None


class PlanRowOut(BaseModel):
    filename: str
    content_type: str
    size: int
    target: str
    space_id: uuid.UUID | None
    space_name: str | None
    note: str | None
    attachment_id: uuid.UUID | None


class SplitUnitIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    parts: dict[str, float]
    price_per_m2: float = Field(gt=0)
    parking_numbers: list[str] = Field(default_factory=list)


class SplitIn(BaseModel):
    units: list[SplitUnitIn] = Field(min_length=2)


# ---- assets ------------------------------------------------------------------------------------


@router.get("/assets/spaces/csv-template", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
async def spaces_csv_template(p: Principal = Depends(current_principal)) -> Response:
    return Response(content=assets_domain.csv_template(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="pinnad-mall.csv"'})


@router.get("/assets/parking/csv-template", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
async def parking_csv_template(p: Principal = Depends(current_principal)) -> Response:
    return Response(content=parking_domain.PARKING_TEMPLATE, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="parkimiskohad-mall.csv"'})


@router.get("/assets", response_model=list[AssetOut])
async def list_assets(type_code: str | None = Query(default=None), parent_id: uuid.UUID | None = Query(default=None),
                      company_id: uuid.UUID | None = Query(default=None), session: AsyncSession = Depends(db)) -> list[AssetOut]:
    rows = await assets_domain.list_assets(session, type_code=type_code, parent_id=parent_id, company_id=company_id)
    return await _outs(session, rows)


@router.post("/assets", response_model=AssetOut, status_code=201)
async def create_asset(body: AssetIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AssetOut:
    a = await assets_domain.create_asset(session, p.actor, type_code=body.type_code, name=body.name, attributes=body.attributes,
                                         company_id=body.company_id, parent_id=body.parent_id, capacity=body.capacity)
    return (await _outs(session, [a]))[0]


@router.get("/assets/{asset_id}", response_model=AssetDetailOut)
async def get_asset(asset_id: uuid.UUID, session: AsyncSession = Depends(db)) -> AssetDetailOut:
    a = await assets_domain.get_asset(session, asset_id)
    base = (await _outs(session, [a]))[0]
    kids = [c for c in await assets_domain.children_of(session, a.id) if c.type_code not in registry.AUXILIARY_UNITS]
    children = await _outs(session, kids)
    child_atts: dict[uuid.UUID, list[AttachmentSummaryOut]] = {c.id: [] for c in children}
    for x in await attachments_domain.list_attachments(session, subject_type="asset", subject_ids=list(child_atts)):
        child_atts[x.subject_id].append(AttachmentSummaryOut.model_validate(x))
    atts = await attachments_domain.list_attachments(session, subject_type="asset", subject_id=a.id)
    allocs = await assets_domain.list_allocations(session, asset_id=a.id)
    parent = await session.get(Asset, a.parent_id) if a.parent_id else None
    spots: list[ParkingSpotOut] = []
    split_parent = None
    split_units: list[AssetRefOut] = []
    delete_reason = await assets_domain.delete_block_reason(session, a)
    split_reason = None
    if a.type_code == "space" and a.parent_id:
        rows = await parking_domain.spot_rows(session, a.parent_id)
        spots = [ParkingSpotOut(**r) for r in rows if r["space_id"] == a.id]
        attrs = a.attributes or {}
        if attrs.get("split_from"):
            sp = await session.get(Asset, uuid.UUID(attrs["split_from"]))
            if sp:
                split_parent = AssetRefOut(id=sp.id, name=sp.name, type_code=sp.type_code)
        if attrs.get("split_into"):
            units = [await session.get(Asset, uuid.UUID(i)) for i in attrs["split_into"]]
            units = [u for u in units if u and not u.deleted_at]
            st = await registry.asset_statuses(session, units) if units else {}
            split_units = [AssetRefOut(id=u.id, name=u.name, type_code=u.type_code, status=st.get(u.id) if isinstance(st.get(u.id), str) else None,
                                       attributes=u.attributes or {}) for u in units]
        split_reason = await spaces_domain.split_block_reason(session, a)
    elif a.type_code == "property":
        spots = [ParkingSpotOut(**r) for r in await parking_domain.spot_rows(session, a.id)]
    return AssetDetailOut(**base.model_dump(), children=[AssetChildOut(**c.model_dump(), attachments=child_atts[c.id]) for c in children],
                          attachments=[AttachmentSummaryOut.model_validate(x) for x in atts],
                          allocations=[await _alloc_out(session, al, c) for al, c in allocs],
                          parent=AssetRefOut(id=parent.id, name=parent.name, type_code=parent.type_code, attributes=parent.attributes or {}) if parent else None,
                          parking_spots=spots, split_parent=split_parent, split_units=split_units,
                          delete_block_reason=delete_reason, split_block_reason=split_reason)


@router.patch("/assets/{asset_id}", response_model=AssetOut)
async def patch_asset(asset_id: uuid.UUID, body: AssetPatch, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AssetOut:
    a = await assets_domain.update_asset(session, p.actor, asset_id, name=body.name, attributes=body.attributes, capacity=body.capacity, company_id=body.company_id)
    return (await _outs(session, [a]))[0]


@router.api_route("/assets/{asset_id}", methods=["DELETE"], status_code=204)
async def delete_asset(asset_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    await assets_domain.delete_asset(session, p.actor, asset_id)
    return Response(status_code=204)


@router.post("/assets/{property_id}/spaces/import", response_model=ImportResultOut)
async def import_spaces(property_id: uuid.UUID, request: Request, dry_run: bool = Query(default=True),
                        p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ImportResultOut:
    """CSV/TSV upload (multipart ``file``) or pasted text (JSON ``{"text": ...}``, e.g. from Excel)."""
    text = await _import_text(request)
    res = await assets_domain.import_spaces(session, p.actor, property_id, text, dry_run=dry_run)
    return ImportResultOut(rows=[ImportRowOut(**r.__dict__) for r in res.rows], created=res.created, updated=res.updated, dry_run=res.dry_run,
                           parking_created=res.parking_created)


# ---- space split / merge ------------------------------------------------------------------------


@router.post("/assets/{space_id}/split", response_model=list[AssetOut], status_code=201)
async def split_space(space_id: uuid.UUID, body: SplitIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[AssetOut]:
    units = await spaces_domain.split(session, p.actor, space_id, [u.model_dump() for u in body.units])
    return await _outs(session, units)


@router.post("/assets/{space_id}/merge", response_model=AssetOut)
async def merge_space(space_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AssetOut:
    a = await spaces_domain.merge(session, p.actor, space_id)
    return (await _outs(session, [a]))[0]


# ---- parking register ----------------------------------------------------------------------------


@router.get("/assets/{property_id}/parking", response_model=list[ParkingSpotOut])
async def list_parking(property_id: uuid.UUID, session: AsyncSession = Depends(db)) -> list[ParkingSpotOut]:
    await assets_domain.get_asset(session, property_id)
    return [ParkingSpotOut(**r) for r in await parking_domain.spot_rows(session, property_id)]


@router.post("/assets/{property_id}/parking/import", response_model=ParkingImportOut)
async def import_parking(property_id: uuid.UUID, request: Request, dry_run: bool = Query(default=True),
                         p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ParkingImportOut:
    """``nr;tsoon;tüüp;pind`` rows (file or pasted text); nr may be a range such as 10-20."""
    text = await _import_text(request)
    res = await parking_domain.import_spots(session, p.actor, property_id, text, dry_run=dry_run)
    return ParkingImportOut(rows=[ParkingRowOut(**r.__dict__) for r in res.rows], created=res.created, skipped=res.skipped, dry_run=res.dry_run)


@router.post("/assets/{property_id}/parking/update", response_model=list[ParkingSpotOut])
async def update_parking(property_id: uuid.UUID, body: ParkingUpdateIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[ParkingSpotOut]:
    await parking_domain.update_spots(session, p.actor, property_id, body.ids, body.patch)
    ids = set(body.ids)
    return [ParkingSpotOut(**r) for r in await parking_domain.spot_rows(session, property_id) if r["id"] in ids]


@router.post("/assets/{property_id}/parking/assign", response_model=list[ParkingSpotOut])
async def assign_parking(property_id: uuid.UUID, body: ParkingAssignIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[ParkingSpotOut]:
    """Make ``numbers`` exactly the space's default spots (or detach them when space_id is null)."""
    prop = await assets_domain.get_asset(session, property_id)
    space = await assets_domain.get_asset(session, body.space_id) if body.space_id else None
    if space and space.parent_id != prop.id:
        raise DomainError("Pind peab olema sama hoone pind")
    if space:
        await parking_domain.assign_numbers(session, p.actor, prop, body.numbers, space)
    else:
        spots = [s for s in await parking_domain.list_spots(session, prop.id) if (s.attributes or {}).get("number") in set(body.numbers)]
        await parking_domain.update_spots(session, p.actor, prop.id, [s.id for s in spots], {"space_id": None})
    return [ParkingSpotOut(**r) for r in await parking_domain.spot_rows(session, property_id)]


@router.post("/assets/{property_id}/parking/delete", status_code=204)
async def delete_parking(property_id: uuid.UUID, body: ParkingDeleteIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    await parking_domain.delete_spots(session, p.actor, property_id, body.ids)
    return Response(status_code=204)


@router.post("/assets/{property_id}/parking/has-parking", response_model=AssetOut)
async def set_has_parking(property_id: uuid.UUID, body: HasParkingIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AssetOut:
    a = await parking_domain.set_has_parking(session, p.actor, property_id, body.has_parking)
    return (await _outs(session, [a]))[0]


# ---- parking schematic (boxes per register spot) -----------------------------------------------


@router.get("/assets/{property_id}/parking/plan", response_model=ParkingPlanOut)
async def get_parking_plan(property_id: uuid.UUID, session: AsyncSession = Depends(db)) -> ParkingPlanOut:
    return ParkingPlanOut(**await parking_plan_domain.plan_document(session, property_id))


@router.put("/assets/{property_id}/parking/plan", response_model=ParkingPlanOut)
async def save_parking_plan(property_id: uuid.UUID, body: ParkingPlanIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> ParkingPlanOut:
    """One save of the editor: lots + boxes of existing spots (+ default space when ``set_space``) + new register rows."""
    spots = []
    for it in body.spots:
        d: dict[str, Any] = {"id": it.id, "geom": it.geom.model_dump(exclude_none=True) if it.geom else None}
        if it.set_space:
            d["space_id"] = it.space_id
        spots.append(d)
    new = [{**n.model_dump(exclude={"geom"}), "geom": n.geom.model_dump(exclude_none=True)} for n in body.new]
    doc = await parking_plan_domain.save_plan(session, p.actor, property_id, lots=body.lots, spots=spots, new=new, clear_draft=body.clear_draft)
    return ParkingPlanOut(**doc)


@router.get("/assets/{property_id}/parking/plan/background", response_class=Response, responses={200: {"content": {"image/png": {}}}})
async def parking_plan_background(property_id: uuid.UUID, attachment_id: uuid.UUID | None = Query(default=None), session: AsyncSession = Depends(db)) -> Response:
    """The uploaded parking plan (PDF/SVG/PNG/JPG) rendered to one PNG for the editor's background layer."""
    png = await parking_plan_domain.background_png(session, property_id, attachment_id)
    return Response(content=png, media_type="image/png", headers={"Cache-Control": "private, max-age=3600"})


@router.post("/assets/{property_id}/parking/plan/derive", response_model=ParkingPlanOut)
async def derive_parking_plan(property_id: uuid.UUID, body: ParkingDeriveIn | None = None, p: Principal = Depends(current_principal),
                              session: AsyncSession = Depends(db)) -> ParkingPlanOut:
    """Read a parking plan with the model now (the upload also queues this in the worker) → ``draft`` for one lot."""
    body = body or ParkingDeriveIn()
    await parking_plan_domain.derive_draft(session, p.actor, property_id, attachment_id=body.attachment_id, lot_id=body.lot_id)
    return ParkingPlanOut(**await parking_plan_domain.plan_document(session, property_id))


@router.delete("/assets/{property_id}/parking/plan/draft", status_code=204)
async def discard_parking_plan_draft(property_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    await parking_plan_domain.discard_draft(session, p.actor, property_id)
    return Response(status_code=204)


# ---- plans (bulk floor-plan upload) ---------------------------------------------------------------


@router.post("/assets/{property_id}/plans", response_model=list[PlanRowOut])
async def upload_plans(property_id: uuid.UUID, files: list[UploadFile] = File(...), mapping: str | None = Form(default=None),
                       dry_run: bool = Query(default=True), p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[PlanRowOut]:
    """Many plan files (PDF · PNG · JPG · SVG · ZIP) → matched to spaces by filename. ``mapping`` is a JSON object
    {filename: space_id | "property" | "skip"} with the operator's corrections; dry_run returns the proposal only."""
    payload = [plans_domain.PlanFile(f.filename or "fail", f.content_type or "", await f.read()) for f in files]
    try:
        m = json.loads(mapping) if mapping else None
    except json.JSONDecodeError as e:
        raise DomainError("mapping peab olema JSON-objekt") from e
    if m is not None and not isinstance(m, dict):
        raise DomainError("mapping peab olema JSON-objekt")
    rows = await (plans_domain.propose(session, property_id, payload, m) if dry_run else plans_domain.commit(session, p.actor, property_id, payload, m))
    return [PlanRowOut(**r) for r in plans_domain.rows_out(rows)]


# ---- allocations -------------------------------------------------------------------------------


@router.get("/assets/{asset_id}/allocations", response_model=list[AllocationOut])
async def asset_allocations(asset_id: uuid.UUID, session: AsyncSession = Depends(db)) -> list[AllocationOut]:
    await assets_domain.get_asset(session, asset_id)
    return [await _alloc_out(session, al, c) for al, c in await assets_domain.list_allocations(session, asset_id=asset_id)]


@router.post("/allocations", response_model=AllocationOut, status_code=201)
async def create_allocation(body: AllocationIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AllocationOut:
    al = await assets_domain.allocate(session, p.actor, contract_id=body.contract_id, asset_id=body.asset_id, kind=body.kind, quantity=body.quantity,
                                      period_start=body.period_start, period_end=body.period_end, area_m2=body.area_m2)
    c = await session.get(Contract, al.contract_id)
    assert c
    return await _alloc_out(session, al, c)


@router.api_route("/allocations/{allocation_id}", methods=["DELETE"], status_code=204)
async def delete_allocation(allocation_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    await assets_domain.delete_allocation(session, p.actor, allocation_id)
    return Response(status_code=204)


# ---- helpers -----------------------------------------------------------------------------------


async def _outs(session: AsyncSession, rows: list[Asset]) -> list[AssetOut]:
    if not rows:
        return []
    statuses = await registry.asset_statuses(session, rows)
    counts = await assets_domain.children_counts(session, [a.id for a in rows if a.asset_type.kind != "unit"])
    out: list[AssetOut] = []
    for a in rows:
        st = statuses.get(a.id)
        is_unit = a.asset_type.kind == "unit"
        out.append(AssetOut(
            id=a.id, type_code=a.type_code, kind=a.asset_type.kind, vertical=a.asset_type.vertical, name=a.name, company_id=a.company_id,
            parent_id=a.parent_id, attributes=a.attributes or {}, capacity=a.capacity,
            status=st if is_unit and isinstance(st, str) else None,
            occupancy=OccupancyOut(units=st.units, occupied=st.occupied, free=st.free) if isinstance(st, registry.Occupancy) else None,
            children_count=None if is_unit else counts.get(a.id, 0), created_at=a.created_at, updated_at=a.updated_at,
        ))
    return out


async def _alloc_out(session: AsyncSession, al: Allocation, c: Contract) -> AllocationOut:
    party_name = None
    if c.party_id:
        from app.models.core import Party

        party = await session.get(Party, c.party_id)
        party_name = party.name if party else None
    return AllocationOut(id=al.id, contract_id=al.contract_id, asset_id=al.asset_id, kind=al.kind, quantity=al.quantity, period_start=al.period_start,
                         period_end=al.period_end, area_m2=float(al.area_m2) if al.area_m2 is not None else None,
                         contract=AllocationContractOut(id=c.id, number=c.number, title=c.title, status=c.status, type_code=c.type_code, party_name=party_name))


async def _import_text(request: Request) -> str:
    ct = (request.headers.get("content-type") or "").lower()
    if ct.startswith("multipart/form-data"):
        form = await request.form()
        upload = form.get("file")
        if upload is None or isinstance(upload, str):
            raise DomainError("Fail puudub (multipart väli „file”)")
        raw = await upload.read()
        for enc in ("utf-8-sig", "utf-8", "cp1257", "latin-1"):
            try:
                return raw.decode(enc)
            except UnicodeDecodeError:
                continue
        raise DomainError("Faili kodeeringut ei õnnestunud tuvastada")
    try:
        body = await request.json()
    except Exception as e:
        raise DomainError("Oodati JSON-keha {\"text\": ...} või multipart faili") from e
    parsed = SpacesImportIn.model_validate(body)
    return parsed.text
