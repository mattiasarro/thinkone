"""Audit trail reads + exports: the per-contract "court folder" ZIP and the account-wide event log (CSV / JSONL / PDF).

The global event log (demo v790: „Sündmuslogi”) is the same ``domain_event`` table read with filters; every
row is resolved to a label + link so the UI can jump to the entity. Rows are never changed or deleted.
"""

from __future__ import annotations

import csv
import io
import json
import uuid
import zipfile
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import NotFound
from app.models.contracts import Contract, ImportJob, KeyDate
from app.models.core import DomainEvent, Party, User
from app.models.registry import Asset

ENTITY_WORDS = {"contract": "Leping", "asset": "Ese", "party": "Osapool", "import_job": "Import", "source_document": "Dokument", "key_date": "Tähtaeg",
                "allocation": "Hõive", "attachment": "Fail", "template": "Mall", "company": "Ettevõte", "account": "Konto", "membership": "Kasutaja",
                "notification": "Teavitus", "user": "Kasutaja", "contract_party": "Lepingu osapool"}


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
    on_behalf_of: uuid.UUID | None = None
    correlation_id: str | None = None
    entity_label: str | None = None
    entity_link: str | None = None


def _base_stmt(*, entity_type: str | None, entity_id: uuid.UUID | None, actor_type: str | None, q: str | None, entity_types: list[str] | None = None):
    stmt = select(DomainEvent, User.name).outerjoin(User, User.id == DomainEvent.actor_user_id)
    if entity_type:
        stmt = stmt.where(DomainEvent.entity_type == entity_type)
    if entity_types:
        stmt = stmt.where(DomainEvent.entity_type.in_(entity_types))
    if entity_id:
        stmt = stmt.where(DomainEvent.entity_id == entity_id)
    if actor_type:
        stmt = stmt.where(DomainEvent.actor_type == actor_type)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(DomainEvent.action.ilike(like), DomainEvent.entity_type.ilike(like), DomainEvent.payload.cast(_Text()).ilike(like),
                              DomainEvent.reason.ilike(like), User.name.ilike(like)))
    return stmt


def _Text():
    from sqlalchemy import Text

    return Text


async def list_events(session: AsyncSession, *, entity_type: str | None = None, entity_id: uuid.UUID | None = None,
                      limit: int = 100, before: int | None = None, actor_type: str | None = None, q: str | None = None,
                      resolve: bool = False) -> list[EventRow]:
    stmt = _base_stmt(entity_type=entity_type, entity_id=entity_id, actor_type=actor_type, q=q).order_by(DomainEvent.id.desc())
    if before:
        stmt = stmt.where(DomainEvent.id < before)
    rows = (await session.execute(stmt.limit(max(1, min(limit, 500))))).all()
    out = [_row(ev, name) for ev, name in rows]
    if resolve:
        await resolve_entities(session, out)
    return out


async def stats(session: AsyncSession) -> dict[str, dict[str, int]]:
    by_actor = dict((await session.execute(select(DomainEvent.actor_type, func.count()).group_by(DomainEvent.actor_type))).all())
    by_entity = dict((await session.execute(select(DomainEvent.entity_type, func.count()).group_by(DomainEvent.entity_type))).all())
    return {"actor_type": {k: int(v) for k, v in by_actor.items()}, "entity_type": {k: int(v) for k, v in by_entity.items()}}


async def all_events(session: AsyncSession, *, entity_type: str | None = None, actor_type: str | None = None, q: str | None = None,
                     limit: int = 20000) -> list[EventRow]:
    stmt = _base_stmt(entity_type=entity_type, entity_id=None, actor_type=actor_type, q=q).order_by(DomainEvent.id).limit(limit)
    out = [_row(ev, name) for ev, name in (await session.execute(stmt)).all()]
    await resolve_entities(session, out)
    return out


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


async def resolve_entities(session: AsyncSession, rows: list[EventRow]) -> None:
    """Fill ``entity_label`` / ``entity_link`` in batches (contracts, assets, parties, imports, key dates)."""
    ids: dict[str, set[uuid.UUID]] = {}
    for r in rows:
        if r.entity_id:
            ids.setdefault(r.entity_type, set()).add(r.entity_id)
    labels: dict[tuple[str, uuid.UUID], tuple[str, str | None]] = {}
    if ids.get("contract"):
        for c in (await session.execute(select(Contract).where(Contract.id.in_(ids["contract"])))).scalars():
            labels[("contract", c.id)] = (f"{c.number} · {c.title}", f"/app/portfell/leping/{c.id}")
    if ids.get("asset"):
        for a in (await session.execute(select(Asset).where(Asset.id.in_(ids["asset"])))).scalars():
            if a.type_code == "space":
                link = f"/app/portfell/pind/{a.id}"
            elif a.type_code == "parking_spot":
                link = f"/app/portfell/objekt/{a.parent_id}/parkimine" if a.parent_id else None
            elif a.asset_type.kind == "container":
                link = f"/app/portfell/objekt/{a.id}"
            else:
                link = f"/app/portfell/objekt/{a.parent_id}" if a.parent_id else None
            labels[("asset", a.id)] = (a.name, None if a.deleted_at else link)
    if ids.get("party"):
        for p in (await session.execute(select(Party).where(Party.id.in_(ids["party"])))).scalars():
            labels[("party", p.id)] = (p.name, f"/app/portfell/osapool/{p.id}")
    if ids.get("import_job"):
        for j in (await session.execute(select(ImportJob).where(ImportJob.id.in_(ids["import_job"])))).scalars():
            title = ((j.reviewed or j.proposal or {}).get("contract") or {}).get("title")
            labels[("import_job", j.id)] = (title or "Import", f"/app/portfell/import/{j.id}")
    if ids.get("key_date"):
        for kd in (await session.execute(select(KeyDate).where(KeyDate.id.in_(ids["key_date"])))).scalars():
            labels[("key_date", kd.id)] = (kd.title, f"/app/portfell/leping/{kd.subject_id}" if kd.subject_type == "contract" else "/app/kalender")
    for r in rows:
        if r.entity_id and (r.entity_type, r.entity_id) in labels:
            r.entity_label, r.entity_link = labels[(r.entity_type, r.entity_id)]
        elif r.entity_type == "allocation" and r.payload.get("contract_id"):
            r.entity_label = r.payload.get("asset_name") or r.payload.get("contract_number")
            r.entity_link = f"/app/portfell/leping/{r.payload['contract_id']}"
        elif r.entity_type == "contract_party" and r.payload.get("contract_id"):
            r.entity_label = " · ".join(x for x in [r.payload.get("party_name"), r.payload.get("role")] if x) or r.payload.get("contract_number")
            r.entity_link = f"/app/portfell/leping/{r.payload['contract_id']}"
        elif r.entity_type == "attachment" and r.payload.get("subject_id"):
            r.entity_label = r.payload.get("filename")
        elif r.entity_type in ("company", "membership", "account", "template"):
            r.entity_link = "/app/seaded"
        elif r.entity_type == "asset" and r.payload.get("name"):
            r.entity_label = r.payload.get("name")


def export_zip(events: list[EventRow], *, contract: Contract | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("events.jsonl", export_jsonl(events))
        z.writestr("events.csv", export_csv(events))
        if contract is not None:
            meta = {"contract_id": str(contract.id), "number": contract.number, "title": contract.title, "status": contract.status,
                    "type_code": contract.type_code, "exported_at": datetime.now().isoformat(), "event_count": len(events)}
            z.writestr("manifest.json", json.dumps(meta, ensure_ascii=False, indent=2))
    return buf.getvalue()


def export_jsonl(events: list[EventRow]) -> str:
    return "\n".join(json.dumps(_jsonable(e), ensure_ascii=False) for e in events) + ("\n" if events else "")


def export_csv(events: list[EventRow]) -> str:
    out = io.StringIO()
    w = csv.writer(out, delimiter=";")
    w.writerow(["id", "ts", "actor_type", "actor_user_id", "actor_name", "on_behalf_of", "entity_type", "entity_id", "entity_label", "action", "reason",
                "correlation_id", "payload"])
    for e in events:
        w.writerow([e.id, e.ts.isoformat(), e.actor_type, e.actor_user_id or "", e.actor_name or "", e.on_behalf_of or "", e.entity_type, e.entity_id or "",
                    e.entity_label or "", e.action, e.reason or "", e.correlation_id or "", json.dumps(e.payload, ensure_ascii=False)])
    return out.getvalue()


def export_pdf(events: list[EventRow], *, account_name: str) -> bytes:
    """A plain, paginated listing (PyMuPDF) — the printable form of the same log."""
    import fitz  # PyMuPDF

    doc = fitz.open()
    width, height = 595, 842  # A4 points
    margin, line_h, top = 40, 11, 60
    page = None
    y = height
    n_pages = 0

    def new_page():
        nonlocal page, y, n_pages
        page = doc.new_page(width=width, height=height)
        n_pages += 1
        page.insert_text((margin, 30), f"Sündmuslogi · {account_name}", fontsize=12, fontname="helv")
        page.insert_text((margin, 44), f"Eksporditud {datetime.now():%d.%m.%Y %H:%M} · {len(events)} kirjet · lk {n_pages}", fontsize=8, fontname="helv", color=(0.4, 0.4, 0.4))
        y = top

    new_page()
    for e in events:
        head = f"E-{e.id:05d}  {e.ts:%d.%m.%Y %H:%M}  {e.actor_type}  {e.actor_name or '—'}  ·  {ENTITY_WORDS.get(e.entity_type, e.entity_type)}  {e.entity_label or e.entity_id or ''}"
        body = f"{e.action}  {_short_payload(e.payload)}"
        for text, size, color in ((head, 8, (0, 0, 0)), (body, 7.5, (0.3, 0.3, 0.3))):
            for chunk in _wrap(text, 120):
                if y > height - margin:
                    new_page()
                page.insert_text((margin, y), chunk, fontsize=size, fontname="helv", color=color)  # type: ignore[union-attr]
                y += line_h
        y += 3
    return doc.tobytes()


def _short_payload(payload: dict[str, Any], limit: int = 400) -> str:
    s = json.dumps(payload, ensure_ascii=False) if payload else ""
    return s if len(s) <= limit else s[: limit - 1] + "…"


def _wrap(text: str, n: int) -> list[str]:
    return [text[i:i + n] for i in range(0, max(len(text), 1), n)]


def _row(ev: DomainEvent, actor_name: str | None) -> EventRow:
    return EventRow(id=ev.id, ts=ev.ts, actor_type=ev.actor_type, actor_user_id=ev.actor_user_id, actor_name=actor_name,
                    entity_type=ev.entity_type, entity_id=ev.entity_id, action=ev.action, payload=ev.payload or {}, reason=ev.reason,
                    on_behalf_of=ev.on_behalf_of, correlation_id=ev.correlation_id)


def _jsonable(e: EventRow) -> dict[str, Any]:
    return {"id": e.id, "ts": e.ts.isoformat(), "actor_type": e.actor_type, "actor_user_id": str(e.actor_user_id) if e.actor_user_id else None,
            "actor_name": e.actor_name, "on_behalf_of": str(e.on_behalf_of) if e.on_behalf_of else None, "entity_type": e.entity_type,
            "entity_id": str(e.entity_id) if e.entity_id else None, "entity_label": e.entity_label, "action": e.action, "payload": e.payload,
            "reason": e.reason, "correlation_id": e.correlation_id}
