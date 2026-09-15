from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import keydates as keydates_domain
from app.domain.errors import NotFound
from app.models.contracts import Contract, KeyDate
from app.models.core import Party

router = APIRouter(prefix="/key-dates", tags=["key-dates"])


class KeyDateContractOut(BaseModel):
    id: uuid.UUID
    number: str
    title: str
    type_code: str
    party_name: str | None = None


class KeyDateOut(BaseModel):
    id: uuid.UUID
    kind_code: str
    title: str
    due_date: date
    notify_days_before: int
    fired_at: datetime | None
    contract: KeyDateContractOut | None


class KeyDateKindOut(BaseModel):
    code: str
    name_et: str
    vertical: str | None
    default_notify_days: int
    notify_client: bool


class KeyDateIn(BaseModel):
    contract_id: uuid.UUID
    kind_code: str = Field(min_length=1, max_length=40)
    due_date: date
    title: str | None = Field(default=None, max_length=200)
    notify_days_before: int | None = Field(default=None, ge=0, le=730)


class KeyDatePatch(BaseModel):
    due_date: date | None = None
    title: str | None = Field(default=None, max_length=200)
    notify_days_before: int | None = Field(default=None, ge=0, le=730)


@router.get("", response_model=list[KeyDateOut])
async def list_key_dates(from_: date | None = Query(default=None, alias="from"), to: date | None = Query(default=None),
                         kind: str | None = Query(default=None), contract_id: uuid.UUID | None = Query(default=None),
                         session: AsyncSession = Depends(db)) -> list[KeyDateOut]:
    rows = await keydates_domain.calendar(session, start=from_, end=to, kind_code=kind, contract_id=contract_id)
    party_names = await _party_names(session, [c.party_id for _, c in rows if c and c.party_id])
    return [_out(kd, c, party_names) for kd, c in rows]


@router.get("/kinds", response_model=list[KeyDateKindOut])
async def list_kinds(p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[KeyDateKindOut]:
    return [KeyDateKindOut(code=k.code, name_et=k.name_et, vertical=k.vertical, default_notify_days=k.default_notify_days, notify_client=k.notify_client)
            for k in await keydates_domain.kinds(session, p.account_id)]


@router.post("", response_model=KeyDateOut, status_code=201)
async def create_key_date(body: KeyDateIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> KeyDateOut:
    contract = await session.get(Contract, body.contract_id)
    if not contract or contract.deleted_at:
        raise NotFound("Lepingut ei leitud")
    kd = await keydates_domain.add_key_date(session, p.actor, contract_id=body.contract_id, kind_code=body.kind_code, due_date=body.due_date,
                                            title=body.title, notify_days_before=body.notify_days_before)
    return _out(kd, contract, await _party_names(session, [contract.party_id] if contract.party_id else []))


@router.patch("/{key_date_id}", response_model=KeyDateOut)
async def patch_key_date(key_date_id: uuid.UUID, body: KeyDatePatch, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> KeyDateOut:
    kd = await keydates_domain.update_key_date(session, p.actor, key_date_id, due_date=body.due_date, notify_days_before=body.notify_days_before, title=body.title)
    contract = await session.get(Contract, kd.subject_id)
    return _out(kd, contract, await _party_names(session, [contract.party_id] if contract and contract.party_id else []))


@router.api_route("/{key_date_id}", methods=["DELETE"], status_code=204)
async def delete_key_date(key_date_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    await keydates_domain.delete_key_date(session, p.actor, key_date_id)
    return Response(status_code=204)


async def _party_names(session: AsyncSession, party_ids: list[uuid.UUID]) -> dict[uuid.UUID, str]:
    if not party_ids:
        return {}
    from sqlalchemy import select

    rows = (await session.execute(select(Party.id, Party.name).where(Party.id.in_(list(set(party_ids)))))).all()
    return {pid: name for pid, name in rows}


def _out(kd: KeyDate, c: Contract | None, party_names: dict[uuid.UUID, str]) -> KeyDateOut:
    contract = None
    if c is not None:
        contract = KeyDateContractOut(id=c.id, number=c.number, title=c.title, type_code=c.type_code,
                                      party_name=party_names.get(c.party_id) if c.party_id else None)
    return KeyDateOut(id=kd.id, kind_code=kd.kind_code, title=kd.title, due_date=kd.due_date, notify_days_before=kd.notify_days_before,
                      fired_at=kd.fired_at, contract=contract)
