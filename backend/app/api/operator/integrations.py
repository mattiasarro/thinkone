"""Thin lookups over external registries (äriregister, EHR) — fakes in tests/dev."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.api.deps import current_principal
from app.integrations.ariregister import CompanyRecord, ariregister
from app.integrations.ehr import ehr

router = APIRouter(prefix="/integrations", tags=["integrations"], dependencies=[Depends(current_principal)])


class RepresentativeOut(BaseModel):
    name: str
    role: str
    role_code: str | None = None
    since: str | None = None


class CompanyLookupOut(BaseModel):
    name: str
    registry_code: str
    address: str | None = None
    vat_number: str | None = None
    status: str | None = None
    legal_form: str | None = None
    email: str | None = None
    phone: str | None = None
    representatives: list[RepresentativeOut] = []


class BuildingLookupOut(BaseModel):
    ehr_code: str
    address: str
    use_type: str | None = None
    footprint_m2: float | None = None
    net_area_m2: float | None = None
    floors: int | None = None
    build_year: int | None = None
    ehr_payload: dict | None = None


@router.get("/ariregister", response_model=list[CompanyLookupOut])
async def lookup_ariregister(q: str = Query(min_length=2, max_length=100)) -> list[CompanyLookupOut]:
    return [_company_out(r) for r in await ariregister().lookup(q)]


@router.get("/ariregister/{registry_code}", response_model=CompanyLookupOut)
async def ariregister_detail(registry_code: str) -> CompanyLookupOut:
    """Full card of one company (VAT number, contacts, board) — the RIK XML service in live mode."""
    rec = await ariregister().detail(registry_code)
    if rec is None:
        raise HTTPException(404, "Registrikoodi järgi ettevõtet ei leitud")
    return _company_out(rec)


def _company_out(r: CompanyRecord) -> CompanyLookupOut:
    return CompanyLookupOut(name=r.name, registry_code=r.registry_code, address=r.address, vat_number=r.vat_number, status=r.status,
                            legal_form=r.legal_form, email=r.email, phone=r.phone,
                            representatives=[RepresentativeOut(name=p.name, role=p.role, role_code=p.role_code, since=p.since) for p in r.representatives])


@router.get("/ehr", response_model=list[BuildingLookupOut])
async def lookup_ehr(q: str = Query(min_length=2, max_length=200)) -> list[BuildingLookupOut]:
    rows = await ehr().lookup(q)
    return [BuildingLookupOut(ehr_code=r.ehr_code, address=r.address, use_type=r.use_type, footprint_m2=r.footprint_m2,
                              net_area_m2=r.net_area_m2, floors=r.floors, build_year=r.build_year, ehr_payload=r.raw or None) for r in rows]
