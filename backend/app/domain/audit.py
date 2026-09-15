"""Audit trail reads + the minimal "court folder" export (events as JSONL + CSV in a ZIP)."""

from __future__ import annotations

import csv
import io
import json
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import NotFound
from app.models.contracts import Contract
from app.models.core import DomainEvent, User


@dataclass
class EventRow:
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


async def list_events(session: AsyncSession, *, entity_type: str | None = None, entity_id: uuid.UUID | None = None,
                      limit: int = 100, before: int | None = None) -> list[EventRow]:
    stmt = select(DomainEvent, User.name).outerjoin(User, User.id == DomainEvent.actor_user_id).order_by(DomainEvent.id.desc())
    if entity_type:
        stmt = stmt.where(DomainEvent.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(DomainEvent.entity_id == entity_id)
    if before:
        stmt = stmt.where(DomainEvent.id < before)
    rows = (await session.execute(stmt.limit(max(1, min(limit, 500))))).all()
    return [_row(ev, name) for ev, name in rows]


async def contract_events(session: AsyncSession, contract_id: uuid.UUID) -> list[EventRow]:
    """Every event about the contract itself or carrying its id in the payload (allocations, key dates, facts)."""
    c = await session.get(Contract, contract_id)
    if not c:
        raise NotFound("Lepingut ei leitud")
    stmt = (
        select(DomainEvent, User.name)
        .outerjoin(User, User.id == DomainEvent.actor_user_id)
        .where(or_((DomainEvent.entity_type == "contract") & (DomainEvent.entity_id == contract_id),
                   DomainEvent.payload["contract_id"].astext == str(contract_id)))
        .order_by(DomainEvent.id)
    )
    return [_row(ev, name) for ev, name in (await session.execute(stmt)).all()]


def export_zip(events: list[EventRow], *, contract: Contract | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("events.jsonl", "\n".join(json.dumps(_jsonable(e), ensure_ascii=False) for e in events) + ("\n" if events else ""))
        out = io.StringIO()
        w = csv.writer(out, delimiter=";")
        w.writerow(["id", "ts", "actor_type", "actor_user_id", "actor_name", "entity_type", "entity_id", "action", "reason", "payload"])
        for e in events:
            w.writerow([e.id, e.ts.isoformat(), e.actor_type, e.actor_user_id or "", e.actor_name or "", e.entity_type, e.entity_id or "",
                        e.action, e.reason or "", json.dumps(e.payload, ensure_ascii=False)])
        z.writestr("events.csv", out.getvalue())
        if contract is not None:
            meta = {"contract_id": str(contract.id), "number": contract.number, "title": contract.title, "status": contract.status,
                    "type_code": contract.type_code, "exported_at": datetime.now().isoformat(), "event_count": len(events)}
            z.writestr("manifest.json", json.dumps(meta, ensure_ascii=False, indent=2))
    return buf.getvalue()


def _row(ev: DomainEvent, actor_name: str | None) -> EventRow:
    return EventRow(id=ev.id, ts=ev.ts, actor_type=ev.actor_type, actor_user_id=ev.actor_user_id, actor_name=actor_name,
                    entity_type=ev.entity_type, entity_id=ev.entity_id, action=ev.action, payload=ev.payload or {}, reason=ev.reason)


def _jsonable(e: EventRow) -> dict[str, Any]:
    return {"id": e.id, "ts": e.ts.isoformat(), "actor_type": e.actor_type, "actor_user_id": str(e.actor_user_id) if e.actor_user_id else None,
            "actor_name": e.actor_name, "entity_type": e.entity_type, "entity_id": str(e.entity_id) if e.entity_id else None,
            "action": e.action, "payload": e.payload, "reason": e.reason}
