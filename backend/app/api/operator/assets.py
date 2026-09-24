from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import assets as assets_domain
from app.domain import attachments as attachments_domain
from app.domain import registry
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


class AssetDetailOut(AssetOut):
    children: list[AssetChildOut]
    attachments: list[AttachmentSummaryOut]
    allocations: list[AllocationOut]


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


class SpacesImportIn(BaseModel):
    text: str = Field(min_length=1)


# ---- assets ------------------------------------------------------------------------------------


@router.get("/assets/spaces/csv-template", response_class=Response, responses={200: {"content": {"text/csv": {}}}})
async def spaces_csv_template(p: Principal = Depends(current_principal)) -> Response:
    return Response(content=assets_domain.csv_template(), media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="pinnad-mall.csv"'})


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
    children = await _outs(session, await assets_domain.children_of(session, a.id))
    child_atts: dict[uuid.UUID, list[AttachmentSummaryOut]] = {c.id: [] for c in children}
    for x in await attachments_domain.list_attachments(session, subject_type="asset", subject_ids=list(child_atts)):
        child_atts[x.subject_id].append(AttachmentSummaryOut.model_validate(x))
    atts = await attachments_domain.list_attachments(session, subject_type="asset", subject_id=a.id)
    allocs = await assets_domain.list_allocations(session, asset_id=a.id)
    return AssetDetailOut(**base.model_dump(), children=[AssetChildOut(**c.model_dump(), attachments=child_atts[c.id]) for c in children],
                          attachments=[AttachmentSummaryOut.model_validate(x) for x in atts],
                          allocations=[_alloc_out(al, c) for al, c in allocs])


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
    return ImportResultOut(rows=[ImportRowOut(**r.__dict__) for r in res.rows], created=res.created, updated=res.updated, dry_run=res.dry_run)


# ---- allocations -------------------------------------------------------------------------------


@router.get("/assets/{asset_id}/allocations", response_model=list[AllocationOut])
async def asset_allocations(asset_id: uuid.UUID, session: AsyncSession = Depends(db)) -> list[AllocationOut]:
    await assets_domain.get_asset(session, asset_id)
    return [_alloc_out(al, c) for al, c in await assets_domain.list_allocations(session, asset_id=asset_id)]


@router.post("/allocations", response_model=AllocationOut, status_code=201)
async def create_allocation(body: AllocationIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AllocationOut:
    al = await assets_domain.allocate(session, p.actor, contract_id=body.contract_id, asset_id=body.asset_id, kind=body.kind, quantity=body.quantity,
                                      period_start=body.period_start, period_end=body.period_end, area_m2=body.area_m2)
    c = await session.get(Contract, al.contract_id)
    assert c
    return _alloc_out(al, c)


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


def _alloc_out(al: Allocation, c: Contract) -> AllocationOut:
    return AllocationOut(id=al.id, contract_id=al.contract_id, asset_id=al.asset_id, kind=al.kind, quantity=al.quantity, period_start=al.period_start,
                         period_end=al.period_end, area_m2=float(al.area_m2) if al.area_m2 is not None else None,
                         contract=AllocationContractOut(id=c.id, number=c.number, title=c.title, status=c.status, type_code=c.type_code))


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
