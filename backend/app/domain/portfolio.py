"""Portfolio registry queries + the rule-based portfolio health report (Phase 2 exit demo)."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import NotFound
from app.domain.events import Actor, emit
from app.models.contracts import Clause, Contract, ContractFact, ImportJob, KeyDate, SourceDocument
from app.models.core import Attachment, Party
from app.models.registry import Allocation, Asset

TERMINAL = ("ended", "cancelled", "early_terminated", "rejected", "expired")


async def list_contracts(session: AsyncSession, *, status: str | None = None, type_code: str | None = None, category: str | None = None,
                         q: str | None = None, view: str = "active", party_id: uuid.UUID | None = None, company_id: uuid.UUID | None = None) -> list[tuple[Contract, Party | None]]:
    stmt = select(Contract, Party).outerjoin(Party, Party.id == Contract.party_id).where(Contract.deleted_at.is_(None))
    if view == "active":
        stmt = stmt.where(Contract.status.not_in(TERMINAL))
    elif view == "archive":
        stmt = stmt.where(Contract.status.in_(TERMINAL))
    if status:
        stmt = stmt.where(Contract.status == status)
    if type_code:
        stmt = stmt.where(Contract.type_code == type_code)
    if category:
        stmt = stmt.where(Contract.category == category)
    if party_id:
        stmt = stmt.where(Contract.party_id == party_id)
    if company_id:
        stmt = stmt.where(Contract.company_id == company_id)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Contract.number.ilike(like), Contract.title.ilike(like), Party.name.ilike(like)))
    stmt = stmt.order_by(Contract.end_date.nulls_last(), Contract.created_at.desc())
    return [(c, p) for c, p in (await session.execute(stmt)).all()]


async def next_key_dates(session: AsyncSession, contract_ids: list[uuid.UUID]) -> dict[uuid.UUID, KeyDate]:
    if not contract_ids:
        return {}
    today = date.today()
    rows = (await session.execute(select(KeyDate).where(KeyDate.subject_id.in_(contract_ids), KeyDate.deleted_at.is_(None), KeyDate.due_date >= today)
                                  .order_by(KeyDate.due_date))).scalars()
    out: dict[uuid.UUID, KeyDate] = {}
    for kd in rows:
        out.setdefault(kd.subject_id, kd)
    return out


async def get_contract(session: AsyncSession, contract_id: uuid.UUID) -> Contract:
    c = await session.get(Contract, contract_id)
    if not c or c.deleted_at:
        raise NotFound("Lepingut ei leitud")
    return c


async def contract_bundle(session: AsyncSession, contract: Contract) -> dict[str, Any]:
    from app.domain.clauses import rendered_tree, to_dicts

    party = await session.get(Party, contract.party_id) if contract.party_id else None
    facts = list((await session.execute(select(ContractFact).where(ContractFact.contract_id == contract.id).order_by(ContractFact.key, ContractFact.recorded_at))).scalars())
    key_dates = list((await session.execute(select(KeyDate).where(KeyDate.subject_id == contract.id, KeyDate.deleted_at.is_(None)).order_by(KeyDate.due_date))).scalars())
    allocs = (await session.execute(select(Allocation, Asset).join(Asset, Asset.id == Allocation.asset_id).where(Allocation.contract_id == contract.id, Allocation.deleted_at.is_(None)))).all()
    docs = list((await session.execute(select(SourceDocument).where(SourceDocument.contract_id == contract.id).order_by(SourceDocument.created_at))).scalars())
    atts = list((await session.execute(select(Attachment).where(Attachment.subject_type == "contract", Attachment.subject_id == contract.id, Attachment.deleted_at.is_(None)))).scalars())
    clauses = to_dicts(await rendered_tree(session, contract_id=contract.id)) if contract.has_clause_tree else []
    return {"contract": contract, "party": party, "facts": facts, "key_dates": key_dates, "allocations": allocs, "source_documents": docs,
            "attachments": atts, "clauses": clauses}


async def update_contract(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, *, expected_version: int | None = None, **fields: Any) -> Contract:
    from app.domain.errors import Conflict

    c = await get_contract(session, contract_id)
    if expected_version is not None and c.version != expected_version:
        raise Conflict()
    changes = {}
    for k, v in fields.items():
        if v is not None and getattr(c, k) != v:
            changes[k] = [getattr(c, k), v]
            setattr(c, k, v)
    if changes:
        c.version += 1
        emit(session, actor, "contract", c.id, "contract.updated", changes)
    return c


async def soft_delete_contract(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, reason: str | None = None) -> None:
    c = await get_contract(session, contract_id)
    c.deleted_at = datetime.now(UTC)
    from app.domain.search import remove_entity

    await remove_entity(session, "contract", c.id)
    emit(session, actor, "contract", c.id, "contract.deleted", reason=reason)


# ---------------------------------------------------------------- summary + health ------------------------

async def summary(session: AsyncSession) -> dict[str, Any]:
    by_status = dict((await session.execute(select(Contract.status, func.count()).where(Contract.deleted_at.is_(None)).group_by(Contract.status))).all())
    props = (await session.execute(select(func.count()).select_from(Asset).where(Asset.type_code == "property", Asset.deleted_at.is_(None)))).scalar_one()
    spaces = list((await session.execute(select(Asset).where(Asset.type_code == "space", Asset.deleted_at.is_(None)))).scalars())
    occupied = 0
    if spaces:
        today = date.today()
        occ = (await session.execute(
            select(Allocation.asset_id).join(Contract, Contract.id == Allocation.contract_id)
            .where(Allocation.asset_id.in_([s.id for s in spaces]), Allocation.deleted_at.is_(None), Contract.status == "active",
                   or_(Allocation.period_start.is_(None), Allocation.period_start <= today), or_(Allocation.period_end.is_(None), Allocation.period_end >= today))
        )).scalars()
        occupied = len(set(occ))
    in30 = (await session.execute(select(func.count()).select_from(KeyDate).where(KeyDate.deleted_at.is_(None), KeyDate.due_date >= date.today(),
                                                                                   KeyDate.due_date <= date.today() + timedelta(days=30)))).scalar_one()
    open_imports = (await session.execute(select(func.count()).select_from(ImportJob).where(ImportJob.status.in_(["uploaded", "extracting", "structuring", "review", "failed"])))).scalar_one()
    return {"contracts_by_status": by_status, "assets": {"properties": props, "spaces": len(spaces), "occupied": occupied, "free": len(spaces) - occupied},
            "key_dates_next_30": in30, "open_imports": open_imports}


LISA_RE = re.compile(r"\b[Ll]isa\w*\s+(?:nr\.?\s*)?(\d{1,2})\b")


async def health_report(session: AsyncSession) -> dict[str, Any]:
    """Deterministic rules over the registry — „X lepingut sees · 3 lõpevad 6 kuu jooksul · …"."""
    today = date.today()
    rows = await list_contracts(session, view="active")
    contracts = [c for c, _ in rows]
    parties = {c.id: p for c, p in rows}
    ids = [c.id for c in contracts]
    findings: list[dict[str, Any]] = []

    def finding(code: str, severity: str, title: str, items: list[dict[str, Any]]) -> None:
        if items:
            findings.append({"code": code, "severity": severity, "title": title, "count": len(items), "items": items})

    def item(c: Contract, detail: str) -> dict[str, Any]:
        return {"contract_id": c.id, "number": c.number, "title": c.title, "detail": detail}

    # 1. ending within 6 months
    finding("ending_6m", "warning", "Lõpevad 6 kuu jooksul",
            [item(c, f"lõpeb {c.end_date.isoformat()}") for c in contracts if c.end_date and today <= c.end_date <= today + timedelta(days=183)])
    # 2. already past end date but still active
    finding("past_end", "error", "Tähtaeg möödas, leping aktiivne",
            [item(c, f"lõppes {c.end_date.isoformat()}") for c in contracts if c.end_date and c.end_date < today])
    # 3. open-ended without a notice period on record
    finding("open_ended_no_notice", "info", "Tähtajatu ilma etteteatamiseta registris",
            [item(c, "lõppkuupäev ja etteteatamistähtaeg puuduvad") for c in contracts if not c.end_date and "notice_period" not in (c.current_values or {})])
    # 4. leases without indexation
    finding("lease_no_indexation", "warning", "Üürilepingul pole indekseerimist kokku lepitud",
            [item(c, "indexation puudub") for c in contracts if c.category == "lease" and "indexation" not in (c.current_values or {})])
    # 5. imported without a linked asset
    linked = set((await session.execute(select(Allocation.contract_id).where(Allocation.contract_id.in_(ids), Allocation.deleted_at.is_(None)))).scalars()) if ids else set()
    finding("no_asset", "warning", "Ese registris sidumata", [item(c, "seo hoone või pinnaga") for c in contracts if c.id not in linked])
    # 6. counterparty without registry code
    finding("party_no_code", "info", "Osapoolel puudub registrikood",
            [item(c, parties[c.id].name) for c in contracts if parties.get(c.id) and not parties[c.id].registry_code and parties[c.id].kind != "person"])
    finding("no_party", "warning", "Osapool sidumata", [item(c, "osapool puudub") for c in contracts if not c.party_id])
    # 7. referenced annexes missing: clause text mentions "Lisa N" but no annex/attachment/source datafile covers it
    if ids:
        clause_rows = (await session.execute(select(Clause.contract_id, Clause.text).where(Clause.contract_id.in_(ids)))).all()
        refs: dict[uuid.UUID, set[int]] = {}
        for cid, text in clause_rows:
            for m in LISA_RE.finditer((text or {}).get("plain", "")):
                refs.setdefault(cid, set()).add(int(m.group(1)))
        docs = (await session.execute(select(SourceDocument).where(SourceDocument.contract_id.in_(ids)))).scalars()
        have: dict[uuid.UUID, int] = {}
        for d in docs:
            have[d.contract_id] = have.get(d.contract_id, 0) + (len(d.datafiles or []) if d.datafiles else 1) - 1
        atts = (await session.execute(select(Attachment.subject_id, func.count()).where(Attachment.subject_type == "contract", Attachment.subject_id.in_(ids), Attachment.deleted_at.is_(None)).group_by(Attachment.subject_id))).all()
        for sid, n in atts:
            have[sid] = have.get(sid, 0) + n
        missing = []
        for c in contracts:
            r = refs.get(c.id)
            if r and max(r) > have.get(c.id, 0):
                missing.append(item(c, f"viidatud Lisa {', '.join(str(x) for x in sorted(r))} · lisatud faile: {have.get(c.id, 0)}"))
        finding("missing_annex", "warning", "Viidatud lisa puudub", missing)
    # 8. no key dates at all
    with_kd = set((await session.execute(select(KeyDate.subject_id).where(KeyDate.subject_id.in_(ids), KeyDate.deleted_at.is_(None)))).scalars()) if ids else set()
    finding("no_key_dates", "info", "Võtmekuupäevad puuduvad", [item(c, "lisa vähemalt lõpp- või etteteatamistähtaeg") for c in contracts if c.id not in with_kd])
    # 9. imports waiting for review
    jobs = list((await session.execute(select(ImportJob).where(ImportJob.status.in_(["review", "failed"])))).scalars())
    if jobs:
        findings.append({"code": "imports_pending", "severity": "info", "title": "Impordid ootavad ülevaatust", "count": len(jobs),
                         "items": [{"contract_id": None, "number": None, "title": f"Import {str(j.id)[:8]}", "detail": j.status, "import_job_id": j.id} for j in jobs]})

    order = {"error": 0, "warning": 1, "info": 2}
    findings.sort(key=lambda f: (order[f["severity"]], -f["count"]))
    return {"generated_at": datetime.now(UTC), "totals": {"contracts": len(contracts), "active": sum(c.status == "active" for c in contracts),
                                                        "imported": sum(c.origin == "imported" for c in contracts), "platform": sum(c.origin == "platform" for c in contracts),
                                                        "ending_6m": next((f["count"] for f in findings if f["code"] == "ending_6m"), 0)},
            "findings": findings}
