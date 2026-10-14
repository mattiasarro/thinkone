from __future__ import annotations

import uuid
from datetime import date, datetime
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
    companies: int = 0


@router.get("/health", response_model=HealthOut)
async def health(session: AsyncSession = Depends(db)) -> Any:
    return await portfolio.health_report(session)


@router.get("/summary", response_model=SummaryOut)
async def summary(session: AsyncSession = Depends(db)) -> Any:
    return await portfolio.summary(session)


class AttentionRow(BaseModel):
    kind: str
    tone: str
    title: str
    text: str
    link: str
    due: date | None = None
    step: str | None = None


class AttentionOut(BaseModel):
    rows: list[AttentionRow]
    automatic: int  # green rows that apply by themselves (indexation) — counted, not listed (demo „N rakendub ise”)


@router.get("/attention", response_model=AttentionOut)
async def attention_queue(session: AsyncSession = Depends(db)) -> AttentionOut:
    rows = await portfolio.attention(session)
    green = 0
    if rows and "_green" in rows[0]:
        green = rows[0]["_green"]
        rows = rows[1:]
    return AttentionOut(rows=[AttentionRow(**r) for r in rows], automatic=green)
