from __future__ import annotations

import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import parties as parties_domain
from app.ingest.schema import PartyRole

router = APIRouter(prefix="/parties", tags=["parties"])


class PartyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    kind: str
    name: str
    registry_code: str | None
    personal_code: str | None
    vat_number: str | None
    address: str | None
    contact_name: str | None
    email: str | None
    phone: str | None
    roles: list[str]
    created_at: datetime
    updated_at: datetime


class PartyIn(BaseModel):
    kind: str = Field(pattern="^(ee_company|foreign_company|person)$")
    name: str = Field(min_length=1, max_length=300)
    registry_code: str | None = Field(default=None, max_length=40)
    personal_code: str | None = Field(default=None, max_length=40)
    vat_number: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=500)
    contact_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=60)
    roles: list[PartyRole] = Field(default_factory=list)


class PartyPatch(BaseModel):
    kind: str | None = Field(default=None, pattern="^(ee_company|foreign_company|person)$")
    name: str | None = Field(default=None, min_length=1, max_length=300)
    registry_code: str | None = Field(default=None, max_length=40)
    personal_code: str | None = Field(default=None, max_length=40)
    vat_number: str | None = Field(default=None, max_length=40)
    address: str | None = Field(default=None, max_length=500)
    contact_name: str | None = Field(default=None, max_length=200)
    email: str | None = Field(default=None, max_length=320)
    phone: str | None = Field(default=None, max_length=60)
    roles: list[PartyRole] | None = None


class PartyContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    number: str
    title: str
    status: str
    type_code: str
    category: str | None
    start_date: date | None
    end_date: date | None
    role: str | None = None  # the party's role in that contract (primary row's role when it holds several)


@router.get("", response_model=list[PartyOut])
async def list_parties(q: str | None = Query(default=None, max_length=200), role: str | None = Query(default=None, max_length=30),
                       session: AsyncSession = Depends(db)) -> list[PartyOut]:
    return [PartyOut.model_validate(x) for x in await parties_domain.list_parties(session, q=q, role=role)]


@router.post("", response_model=PartyOut, status_code=201)
async def create_party(body: PartyIn, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> PartyOut:
    return PartyOut.model_validate(await parties_domain.create_party(session, p.actor, **body.model_dump()))


@router.get("/{party_id}", response_model=PartyOut)
async def get_party(party_id: uuid.UUID, session: AsyncSession = Depends(db)) -> PartyOut:
    return PartyOut.model_validate(await parties_domain.get_party(session, party_id))


@router.patch("/{party_id}", response_model=PartyOut)
async def patch_party(party_id: uuid.UUID, body: PartyPatch, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> PartyOut:
    return PartyOut.model_validate(await parties_domain.update_party(session, p.actor, party_id, **body.model_dump(exclude_none=True)))


@router.api_route("/{party_id}", methods=["DELETE"], status_code=204)
async def delete_party(party_id: uuid.UUID, p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    await parties_domain.delete_party(session, p.actor, party_id)
    return Response(status_code=204)


@router.get("/{party_id}/contracts", response_model=list[PartyContractOut])
async def party_contracts(party_id: uuid.UUID, session: AsyncSession = Depends(db)) -> list[PartyContractOut]:
    from app.domain.contract_parties import list_for_contracts

    await parties_domain.get_party(session, party_id)
    rows = await parties_domain.contracts_of(session, party_id)
    links = await list_for_contracts(session, [c.id for c in rows])
    out = []
    for c in rows:
        mine = [cp for cp, p in links.get(c.id, []) if p.id == party_id]
        role = next((cp.role for cp in mine if cp.is_primary), mine[0].role if mine else None)
        out.append(PartyContractOut(id=c.id, number=c.number, title=c.title, status=c.status, type_code=c.type_code, category=c.category,
                                    start_date=c.start_date, end_date=c.end_date, role=role))
    return out
