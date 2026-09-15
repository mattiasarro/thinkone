from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import current_principal, db
from app.domain import audit as audit_domain
from app.domain.contracts import get_contract

router = APIRouter(prefix="/audit", tags=["audit"], dependencies=[Depends(current_principal)])


class AuditEventOut(BaseModel):
    id: int
    ts: datetime
    actor_type: str
    actor_user_id: uuid.UUID | None
    actor_name: str | None
    entity_type: str
    entity_id: uuid.UUID | None
    action: str
    payload: dict[str, Any]
    reason: str | None


@router.get("", response_model=list[AuditEventOut])
async def list_events(entity_type: str | None = Query(default=None), entity_id: uuid.UUID | None = Query(default=None),
                      limit: int = Query(default=100, ge=1, le=500), before: int | None = Query(default=None),
                      session: AsyncSession = Depends(db)) -> list[AuditEventOut]:
    rows = await audit_domain.list_events(session, entity_type=entity_type, entity_id=entity_id, limit=limit, before=before)
    return [AuditEventOut(**r.__dict__) for r in rows]


@router.get("/export", response_class=Response, responses={200: {"content": {"application/zip": {}}}})
async def export_contract(contract_id: uuid.UUID = Query(...), session: AsyncSession = Depends(db)) -> Response:
    """Minimal "court folder": the contract's event trail as JSONL + CSV in a ZIP (documents are added later)."""
    contract = await get_contract(session, contract_id)
    events = await audit_domain.contract_events(session, contract_id)
    data = audit_domain.export_zip(events, contract=contract)
    return Response(content=data, media_type="application/zip",
                    headers={"Content-Disposition": f'attachment; filename="leping-{contract.number}-sundmused.zip"'})
