"""Shared test helpers: direct domain calls under a tenant session (things the API does not expose yet)."""

from __future__ import annotations

import uuid
from datetime import date

from app.domain.contracts import create_contract
from app.domain.events import Actor
from app.infra.db import tenant_session


async def make_contract(account_id: str | uuid.UUID, *, number: str = "LEP-2024-001", title: str = "Üürileping", status: str = "active",
                        type_code: str = "lease", party_id: uuid.UUID | None = None, company_id: uuid.UUID | None = None,
                        start_date: date | None = None, end_date: date | None = None, category: str | None = None) -> uuid.UUID:
    aid = uuid.UUID(str(account_id))
    async with tenant_session(aid) as s:
        c = await create_contract(s, Actor(account_id=aid), type_code=type_code, title=title, number=number, status=status, origin="imported",
                                  party_id=party_id, company_id=company_id, start_date=start_date, end_date=end_date, category=category)
        return c.id


async def make_company(client, name: str = "Taevavärava OÜ") -> dict:
    r = await client.post("/api/v1/companies", json={"name": name})
    assert r.status_code == 201, r.text
    return r.json()


async def make_property(client, company_id: str, name: str = "Betooni 11g") -> dict:
    r = await client.post("/api/v1/assets", json={"type_code": "property", "name": name, "company_id": company_id,
                                                  "attributes": {"address": "Betooni 11g, Tallinn", "ehr_code": "120655847"}})
    assert r.status_code == 201, r.text
    return r.json()


async def make_space(client, property_id: str, name: str = "A-101", rentable: float = 100.0, **attrs) -> dict:
    r = await client.post("/api/v1/assets", json={"type_code": "space", "name": name, "parent_id": property_id,
                                                  "attributes": {"rentable_area_m2": rentable, **attrs}})
    assert r.status_code == 201, r.text
    return r.json()
