from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import db
from app.domain import portfolio

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class FindingItem(BaseModel):
    contract_id: uuid.UUID | None
    number: str | None
    title: str
    detail: str
    import_job_id: uuid.UUID | None = None


class Finding(BaseModel):
    code: str
    severity: str
    title: str
    count: int
    items: list[FindingItem]


class HealthOut(BaseModel):
    generated_at: datetime
    totals: dict[str, int]
    findings: list[Finding]


class SummaryOut(BaseModel):
    contracts_by_status: dict[str, int]
    assets: dict[str, int]
    key_dates_next_30: int
    open_imports: int


@router.get("/health", response_model=HealthOut)
async def health(session: AsyncSession = Depends(db)) -> Any:
    return await portfolio.health_report(session)


@router.get("/summary", response_model=SummaryOut)
async def summary(session: AsyncSession = Depends(db)) -> Any:
    return await portfolio.summary(session)
