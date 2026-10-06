from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import Principal, current_principal, db
from app.domain import audit as audit_domain
from app.domain.account import get_account
from app.domain.contracts import get_contract
from app.domain.errors import DomainError

router = APIRouter(prefix="/audit", tags=["audit"])


class AuditEventOut(BaseModel):
    id: int
    ts: datetime
    actor_type: str
    actor_user_id: uuid.UUID | None
    actor_name: str | None
    on_behalf_of: uuid.UUID | None = None
    entity_type: str
    entity_id: uuid.UUID | None
    entity_label: str | None = None
    entity_link: str | None = None
    action: str
    payload: dict[str, Any]
    reason: str | None
    correlation_id: str | None = None


class AuditStatsOut(BaseModel):
    actor_type: dict[str, int]
    entity_type: dict[str, int]


@router.get("", response_model=list[AuditEventOut])
async def list_events(entity_type: str | None = Query(default=None), entity_id: uuid.UUID | None = Query(default=None),
                      actor_type: str | None = Query(default=None), q: str | None = Query(default=None, max_length=200),
                      limit: int = Query(default=100, ge=1, le=500), before: int | None = Query(default=None),
                      p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> list[AuditEventOut]:
    rows = await audit_domain.list_events(session, entity_type=entity_type, entity_id=entity_id, limit=limit, before=before,
                                          actor_type=actor_type, q=q, resolve=True)
    return [AuditEventOut(**r.__dict__) for r in rows]


@router.get("/stats", response_model=AuditStatsOut)
async def event_stats(p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> AuditStatsOut:
    return AuditStatsOut(**await audit_domain.stats(session))


@router.get("/export", response_class=Response, responses={200: {"content": {"application/zip": {}, "text/csv": {}, "application/x-ndjson": {}, "application/pdf": {}}}})
async def export_events(contract_id: uuid.UUID | None = Query(default=None), format: str = Query(default="zip", pattern="^(zip|csv|jsonl|pdf)$"),
                        entity_type: str | None = Query(default=None), actor_type: str | None = Query(default=None), q: str | None = Query(default=None, max_length=200),
                        p: Principal = Depends(current_principal), session: AsyncSession = Depends(db)) -> Response:
    """Per contract (``contract_id``): the "court folder" ZIP. Without it: the whole account log as CSV, JSONL or PDF."""
    if contract_id:
        contract = await get_contract(session, contract_id)
        events = await audit_domain.contract_events(session, contract_id)
        data = audit_domain.export_zip(events, contract=contract)
        return Response(content=data, media_type="application/zip",
                        headers={"Content-Disposition": f'attachment; filename="leping-{contract.number}-sundmused.zip"'})
    events = await audit_domain.all_events(session, entity_type=entity_type, actor_type=actor_type, q=q)
    stamp = datetime.now().strftime("%Y%m%d-%H%M")
    if format == "csv":
        return Response(content=audit_domain.export_csv(events), media_type="text/csv; charset=utf-8",
                        headers={"Content-Disposition": f'attachment; filename="sundmuslogi-{stamp}.csv"'})
    if format == "jsonl":
        return Response(content=audit_domain.export_jsonl(events), media_type="application/x-ndjson",
                        headers={"Content-Disposition": f'attachment; filename="sundmuslogi-{stamp}.jsonl"'})
    if format == "pdf":
        account = await get_account(session, p.account_id)
        return Response(content=audit_domain.export_pdf(events, account_name=account.name), media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="sundmuslogi-{stamp}.pdf"'})
    raise DomainError("Konto logi eksport: vali csv, jsonl või pdf")
