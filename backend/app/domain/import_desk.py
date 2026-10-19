"""Import desk (demo v622/v638 „import lepingu kaupa” + „iga import on salvestatud partii”).

One drop of files = one batch. Inside a batch every file is a contract, an annex or a supporting document
(``app.ingest.kind``); annexes and documents hang under their contract — the operator's choice on the job, else the
desk's suggestion (same counterparty, the annex's base-contract number, the space the file names). A *toimik* is a
contract with its children; its state is what the desk sorts by:

* ``loen`` — still reading; ``viga`` — failed; ``ei`` — left out (with a reason); ``kinnitatud`` — in the registry;
* ``ootab`` — something to look at (an uncertain value not checked yet, no space for a lease, no contract for an annex);
* ``valmis`` — everything certain and linked: confirming takes the defaults, so the ready ones confirm in bulk.

Confirming a toimik writes the contract (``commit_import``), then each annex as an external amendment on it and each
document as a supporting original. Everything the desk shows is computed here so the bulk confirm and the screen agree.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, NotFound, ValidationFailed
from app.domain.events import Actor, emit
from app.ingest.kind import classify, norm_name, space_tokens
from app.ingest.schema import Proposal
from app.models.contracts import Contract, ImportJob, SourceDocument
from app.models.core import Company, Party
from app.models.registry import Asset

TZ = ZoneInfo("Europe/Tallinn")
READING = {"uploaded", "extracting", "structuring"}
LEASE_LIKE = {"lease"}


def _num(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(" ", "").replace(" ", "").replace(",", ".")
    import re

    m = re.search(r"-?\d+(?:\.\d+)?", s)
    return float(m.group(0)) if m else None


@dataclass
class Ctx:
    companies: list[Company]
    properties: list[Asset]
    spaces: list[Asset]
    party_codes: set[str]
    party_names: set[str]
    contracts: dict[uuid.UUID, Contract]


async def load_ctx(session: AsyncSession, committed_ids: set[uuid.UUID]) -> Ctx:
    companies = list((await session.execute(select(Company).where(Company.deleted_at.is_(None)))).scalars())
    assets = list((await session.execute(select(Asset).where(Asset.deleted_at.is_(None), Asset.type_code.in_(("property", "space"))))).scalars())
    parties = (await session.execute(select(Party.registry_code, Party.name).where(Party.deleted_at.is_(None)))).all()
    contracts = {c.id: c for c in (await session.execute(select(Contract).where(Contract.id.in_(committed_ids)))).scalars()} if committed_ids else {}
    return Ctx(companies=companies, properties=[a for a in assets if a.type_code == "property"], spaces=[a for a in assets if a.type_code == "space"],
               party_codes={r[0] for r in parties if r[0]}, party_names={norm_name(r[1]) for r in parties if r[1]}, contracts=contracts)


@dataclass
class Row:
    job: ImportJob
    doc: SourceDocument | None
    prop: Proposal | None
    kind: str
    annex_nr: str | None
    tokens: set[str]
    who: str  # normalized counterparty
    link: dict[str, Any] | None = None  # effective link (operator's or suggested) for a contract
    link_suggested: bool = False
    parent: tuple[str, uuid.UUID] | None = None  # ("job" | "contract", id), effective
    parent_suggested: bool = False
    open: list[str] = field(default_factory=list)
    state: str = "loen"
    children: list[Row] = field(default_factory=list)

    @property
    def category(self) -> str:
        return self.prop.contract.category if self.prop else "other"


def _prop(job: ImportJob) -> Proposal | None:
    src = job.reviewed or job.proposal
    if not src:
        return None
    try:
        return Proposal.model_validate(src)
    except Exception:  # noqa: BLE001
        return None


def _counterparty(prop: Proposal | None) -> str:
    if not prop:
        return ""
    from app.domain.imports import _counterparty as cp

    p = cp(prop)
    return (p.name if p else None) or prop.contract.counterparty_name or ""


def make_row(job: ImportJob, doc: SourceDocument | None) -> Row:
    prop = _prop(job)
    head = (job.reviewed or job.proposal or {}).get("contract") if (job.reviewed or job.proposal) else None
    kind, nr = classify(head, doc.filename if doc else "")
    hint = prop.asset_hint.name if prop and prop.asset_hint else None
    return Row(job=job, doc=doc, prop=prop, kind=kind, annex_nr=nr, tokens=space_tokens(doc.filename if doc else "", hint), who=norm_name(_counterparty(prop)))


# ---------------------------------------------------------------- linking ---------------------------------

def _area(prop: Proposal) -> float | None:
    if prop.asset_hint and prop.asset_hint.area_m2:
        return float(prop.asset_hint.area_m2)
    p = next((x for x in prop.parameters if x.key == "area_m2"), None)
    return _num(p.value) if p else None


def suggest_link(row: Row, ctx: Ctx) -> dict[str, Any] | None:
    """The review page's defaults (LinkSection), on the server: our company, and for a lease the spaces the file and the
    hint name („P_29”, „P26_P27”, „Büroo 1”) or — failing that — the one space of the stated area."""
    prop = row.prop
    if not prop:
        return None
    ours = norm_name(prop.contract.our_company_name)
    company = next((c for c in ctx.companies if ours and norm_name(c.name) == ours), None) or (ctx.companies[0] if len(ctx.companies) == 1 else None)
    out: dict[str, Any] = {"company_id": str(company.id) if company else None, "asset_id": None, "space_ids": [], "allocation_kind": "exclusive" if row.category in LEASE_LIKE else "coverage",
                           "parties": None, "parking_numbers": None}
    if row.category in LEASE_LIKE and ctx.spaces:
        by_key: dict[str, list[Asset]] = defaultdict(list)
        for s in ctx.spaces:
            for k in space_tokens(s.name):
                by_key[k].append(s)
        picked = [by_key[k][0] for k in sorted(row.tokens) if len(by_key.get(k, [])) == 1]
        if row.tokens and len(picked) == len(row.tokens) and len({s.parent_id for s in picked}) == 1:
            out.update(asset_id=str(picked[0].parent_id), space_ids=[str(s.id) for s in picked])
            return out
        area = _area(prop)
        if area:
            same = [s for s in ctx.spaces if (a := _num((s.attributes or {}).get("rentable_area_m2"))) is not None and abs(a - area) <= 0.15]
            if len(same) == 1:
                out.update(asset_id=str(same[0].parent_id), space_ids=[str(same[0].id)])
                return out
        return out if out["company_id"] else None
    hint = " ".join(filter(None, [prop.asset_hint.name, prop.asset_hint.address])).lower() if prop.asset_hint else ""
    prop_match = next((p for p in ctx.properties if hint and ((p.name and p.name.lower() in hint) or (str((p.attributes or {}).get("address") or "").lower() and str(p.attributes["address"]).lower() in hint))), None)
    if prop_match is None and len(ctx.properties) == 1 and row.category not in LEASE_LIKE:
        prop_match = ctx.properties[0]
    if prop_match:
        out["asset_id"] = str(prop_match.id)
    return out


def suggest_parent(row: Row, rows: list[Row]) -> tuple[str, uuid.UUID] | None:
    """An annex/document → the contract it belongs to: same counterparty; the base number when printed; then the space."""
    if row.kind == "contract" or not row.prop:
        return None
    base = [r for r in rows if r is not row and r.kind == "contract" and r.prop and r.job.status not in ("failed", "excluded")]
    cands = [r for r in base if row.who and r.who == row.who]
    if not cands and row.prop.parties:
        codes = {p.registry_code for p in row.prop.parties if p.registry_code}
        cands = [r for r in base if r.prop and codes & {p.registry_code for p in r.prop.parties if p.registry_code}]
    if row.prop.contract.parent_number:
        by_nr = [r for r in cands if r.prop and r.prop.contract.number and r.prop.contract.number.strip() == row.prop.contract.parent_number.strip()]
        if by_nr:
            cands = by_nr
    if len(cands) > 1 and row.prop.contract.parent_signed_at:
        by_date = [r for r in cands if r.prop and r.prop.contract.signed_at == row.prop.contract.parent_signed_at]
        if by_date:
            cands = by_date
    if len(cands) > 1 and row.tokens:
        by_space = [r for r in cands if r.tokens & row.tokens]
        if by_space:
            cands = by_space
    if len(cands) > 1:  # prefer the same batch
        same = [r for r in cands if r.job.batch_id == row.job.batch_id]
        if len(same) == 1:
            cands = same
    if len(cands) != 1:
        return None
    c = cands[0]
    if c.job.status in ("committed", "manual") and c.job.committed_contract_id:
        return ("contract", c.job.committed_contract_id) if c.job.batch_id != row.job.batch_id else ("job", c.job.id)
    return ("job", c.job.id)


def _link_ok(row: Row, ctx: Ctx) -> bool:
    if row.category not in LEASE_LIKE or not ctx.spaces:
        return True  # nothing to pick from — the lease is registered without a space
    lk = row.link or {}
    return bool(lk.get("space_ids") or lk.get("asset_id") or lk.get("none"))


def evaluate(rows: list[Row], ctx: Ctx) -> None:
    """Fill link / parent / open items / state on every row (all rows of the account, so cross-batch parents resolve)."""
    for r in rows:
        if r.kind == "contract":
            if r.job.link:
                r.link = r.job.link
            else:
                r.link, r.link_suggested = suggest_link(r, ctx), True
        else:
            if r.job.parent_job_id:
                r.parent = ("job", r.job.parent_job_id)
            elif r.job.parent_contract_id:
                r.parent = ("contract", r.job.parent_contract_id)
            else:
                r.parent, r.parent_suggested = suggest_parent(r, rows), True
    for r in rows:
        st = r.job.status
        r.open = []
        if st in READING:
            r.state = "loen"
        elif st == "failed":
            r.state = "viga"
        elif st == "excluded":
            r.state = "ei"
        elif st in ("committed", "manual"):
            r.state = "kinnitatud"
        else:
            unc = r.prop.uncertain() if r.prop else []
            checked = set(r.job.checked or [])
            r.open = [u for u in unc if u not in checked]
            if r.kind == "contract" and not _link_ok(r, ctx):
                r.open.append("link")
            if r.kind != "contract" and not r.parent:
                r.open.append("parent")
            if r.prop is None or not r.prop.contract.title:
                r.open.append("title")
            r.state = "ootab" if r.open else "valmis"


def toimikud(rows: list[Row]) -> list[Row]:
    """Roots with their children (annexes by number, then documents); a child whose parent is out stands on its own."""
    by_id = {r.job.id: r for r in rows}
    for r in rows:
        r.children = []
    roots: list[Row] = []
    for r in rows:
        p = by_id.get(r.parent[1]) if r.parent and r.parent[0] == "job" else None
        if p and p.job.batch_id == r.job.batch_id and r.state not in ("loen", "viga", "ei") and p.state != "ei" and p.kind == "contract":
            p.children.append(r)
        else:
            roots.append(r)
    for r in roots:
        r.children.sort(key=lambda c: (c.kind != "annex", int(c.annex_nr) if (c.annex_nr or "").isdigit() else 99, c.doc.filename if c.doc else ""))
    return roots


def toimik_state(root: Row) -> str:
    if root.state in ("loen", "viga", "ei", "kinnitatud"):
        return root.state
    allr = [root, *root.children]
    if any(c.state == "loen" for c in root.children):
        return "loen"
    if any(x.state == "ootab" for x in allr):
        return "ootab"
    return "valmis"


# ---------------------------------------------------------------- view ------------------------------------

def _space_names(link: dict[str, Any] | None, ctx: Ctx) -> tuple[list[str], float | None]:
    ids = {str(x) for x in (link or {}).get("space_ids") or []}
    sp = [s for s in ctx.spaces if str(s.id) in ids]
    area = sum(_num((s.attributes or {}).get("rentable_area_m2")) or 0 for s in sp) if sp else None
    return [s.name for s in sp], area


def _annex_heading(row: Row) -> str | None:
    import re

    if not row.prop:
        return None
    title = row.prop.contract.title or ""
    m = re.search(r"\(([^)]+)\)", title)
    parts = [p.strip() for p in re.split(r"[·|]", title) if p.strip()]
    keep = [p for p in parts if not re.search(r"\blisa\b|lisa\s*nr", p, re.I) and norm_name(p) != row.who and not space_tokens(p)]
    if keep:
        return keep[0]
    if m and not space_tokens(m.group(1)):
        return m.group(1).strip().capitalize()
    # proposals from before the v3 prompt: read what the annex does from its summary (demo „Lisa 3 · Eritingimused”)
    text = f"{row.prop.contract.summary or ''} {title}".lower()
    for keys, label in ((("eritingimus", "üldtingimuste p"), "Eritingimused"), (("parkimis",), "Parkimiskohad"), (("pikend",), "Pikendamine"),
                        (("lõpeta",), "Lõpetamine"), (("asendu", "üürniku vahetu", "asendab"), "Üürniku vahetus"), (("üürimäär", "üürihin", "üüri "), "Üür"),
                        (("kontaktisik",), "Kontaktisikud")):
        if any(k in text for k in keys):
            return label
    return None


def light(row: Row, ctx: Ctx, by_id: dict[uuid.UUID, Row]) -> dict[str, Any]:
    prop = row.prop
    c = prop.contract if prop else None
    params = {p.key: p for p in prop.parameters} if prop else {}
    names, area = _space_names(row.link, ctx) if row.kind == "contract" else ([], None)
    if area is None and prop:
        area = _area(prop)
    monthly = _num(params["rent_monthly"].value) if "rent_monthly" in params else None
    if monthly is None and "rent_per_m2" in params and area:
        rate = _num(params["rent_per_m2"].value)
        monthly = round(rate * area, 2) if rate else None
    parent = None
    if row.parent:
        kind, pid = row.parent
        if kind == "job" and pid in by_id:
            pr = by_id[pid]
            parent = {"kind": "job", "id": str(pid), "label": _counterparty(pr.prop) or (pr.doc.filename if pr.doc else ""),
                      "number": pr.prop.contract.number if pr.prop else None, "suggested": row.parent_suggested}
        else:
            ct = ctx.contracts.get(pid)
            parent = {"kind": "contract", "id": str(pid), "label": ct.title if ct else None, "number": ct.number if ct else None, "suggested": row.parent_suggested}
    committed = ctx.contracts.get(row.job.committed_contract_id) if row.job.committed_contract_id else None
    return {
        "id": str(row.job.id), "status": row.job.status, "state": row.state, "kind": row.kind, "annex_number": row.annex_nr,
        "filename": row.doc.filename if row.doc else "", "format": row.doc.format if row.doc else None,
        "title": c.title if c else None, "category": c.category if c else None, "counterparty": _counterparty(prop) or None,
        "heading": _annex_heading(row) if row.kind != "contract" else None,
        "number": c.number if c else None, "start_date": c.start_date.isoformat() if c and c.start_date else None,
        "end_date": c.end_date.isoformat() if c and c.end_date else None, "monthly": monthly, "area_m2": area, "spaces": names,
        "linked": bool((row.link or {}).get("space_ids") or (row.link or {}).get("asset_id")), "link_suggested": row.link_suggested,
        "changes": [{"label": p.label, "value": p.value, "unit": p.unit} for p in (prop.parameters if prop else [])][:3] if row.kind == "annex" else [],
        "open": len([o for o in row.open if o not in ("link", "parent")]), "needs_link": "link" in row.open, "needs_parent": "parent" in row.open,
        "parent": parent, "error": row.job.error, "excluded_reason": row.job.excluded_reason,
        "committed_contract_id": str(row.job.committed_contract_id) if row.job.committed_contract_id else None,
        "committed_number": committed.number if committed else None, "duplicate_of_contract_id": str(row.job.duplicate_of_contract_id) if row.job.duplicate_of_contract_id else None,
        "opened_at": row.job.opened_at.isoformat() if row.job.opened_at else None, "created_at": row.job.created_at.isoformat(),
    }


async def load(session: AsyncSession) -> tuple[list[Row], Ctx]:
    jobs = list((await session.execute(select(ImportJob).order_by(ImportJob.created_at))).scalars())
    docs = {d.id: d for d in (await session.execute(select(SourceDocument).where(SourceDocument.id.in_([j.source_document_id for j in jobs])))).scalars()} if jobs else {}
    rows = [make_row(j, docs.get(j.source_document_id)) for j in jobs]
    ids = {j.committed_contract_id for j in jobs if j.committed_contract_id} | {j.parent_contract_id for j in jobs if j.parent_contract_id}
    ctx = await load_ctx(session, ids)
    evaluate(rows, ctx)
    ids2 = {r.parent[1] for r in rows if r.parent and r.parent[0] == "contract"} - set(ctx.contracts)
    if ids2:
        ctx.contracts.update({c.id: c for c in (await session.execute(select(Contract).where(Contract.id.in_(ids2)))).scalars()})
    return rows, ctx


def _batch_meta(batch_id: uuid.UUID, rows: list[Row], roots: list[Row]) -> dict[str, Any]:
    first = min(r.job.created_at for r in rows)
    local = first.astimezone(TZ)
    states = [toimik_state(t) for t in roots]
    cnt = lambda *s: sum(1 for x in states if x in s)  # noqa: E731
    loen = sum(1 for r in rows if r.state == "loen")
    opened = max((r.job.opened_at for r in rows if r.job.opened_at), default=None)
    ootab, valmis = cnt("ootab"), cnt("valmis")
    return {"id": str(batch_id), "name": f"Import {local:%d.%m.%Y}", "date": local.date().isoformat(), "time": f"{local:%H:%M}", "created_at": first.isoformat(),
            "files": len(rows), "contracts": sum(1 for t in roots if t.kind == "contract"), "records": len(roots),
            "children": sum(len(t.children) for t in roots), "review": ootab, "ready": valmis, "committed": cnt("kinnitatud"),
            "excluded": cnt("ei", "viga"), "reading": loen, "opened_at": opened.isoformat() if opened else None,
            "state": "reading" if loen else "open" if ootab or valmis else "done"}


def ready_summary(roots: list[Row], ctx: Ctx) -> dict[str, int]:
    """„16 lepingut läheb registrisse · 16 lisa ja dokumenti · 24 tähtaega kalendrisse · 14 uut osapoolt”."""
    lep = lap = td = 0
    new: set[str] = set()
    for t in roots:
        if toimik_state(t) != "valmis":
            continue
        if t.kind == "contract":
            lep += 1
            td += len(t.prop.key_dates) if t.prop else 0
            from app.domain.imports import _counterparty as cp

            p = cp(t.prop) if t.prop else None
            if p and ((p.registry_code and p.registry_code not in ctx.party_codes) or (not p.registry_code and norm_name(p.name) not in ctx.party_names)):
                new.add(p.registry_code or norm_name(p.name))
        else:
            lap += 1
        lap += len(t.children)
    return {"contracts": lep, "children": lap, "key_dates": td, "new_parties": len(new)}


async def desk(session: AsyncSession, batch_id: uuid.UUID | None = None) -> dict[str, Any]:
    rows, ctx = await load(session)
    by_id = {r.job.id: r for r in rows}
    groups: dict[uuid.UUID, list[Row]] = defaultdict(list)
    for r in rows:
        groups[r.job.batch_id or r.job.id].append(r)
    roots_all = toimikud(rows)
    batches = []
    for bid, rs in groups.items():
        roots = [t for t in roots_all if (t.job.batch_id or t.job.id) == bid]
        batches.append(_batch_meta(bid, rs, roots))
    batches = sorted([b for b in batches if b["state"] != "done"], key=lambda b: b["created_at"], reverse=True) + sorted([b for b in batches if b["state"] == "done"], key=lambda b: b["created_at"], reverse=True)
    out: dict[str, Any] = {"batches": batches}
    if batch_id is not None:
        if batch_id not in groups:
            raise NotFound("Importi ei leitud")
        roots = [t for t in roots_all if (t.job.batch_id or t.job.id) == batch_id]
        out["batch"] = next(b for b in batches if b["id"] == str(batch_id))
        out["toimikud"] = [{"state": toimik_state(t), "open": len(t.open) + sum(len(c.open) for c in t.children), "row": light(t, ctx, by_id),
                            "children": [light(c, ctx, by_id) for c in t.children]} for t in roots]
        out["ready"] = ready_summary(roots, ctx)
    return out


# ---------------------------------------------------------------- commit ----------------------------------

async def _commit_child(session: AsyncSession, actor: Actor, row: Row, contract_id: uuid.UUID) -> None:
    job = row.job
    prop = row.prop
    if not prop:
        raise DomainError("Failil pole loetud andmeid")
    doc = row.doc
    assert doc
    contract = await session.get(Contract, contract_id)
    if not contract or contract.deleted_at:
        raise NotFound("Lepingut ei leitud")
    if row.kind == "annex":
        from app.domain.imports import apply_amendment

        params = [{"key": p.key, "label": p.label, "value": p.value, "unit": p.unit, "text": p.text} for p in prop.parameters]
        end = next((k.date for k in prop.key_dates if k.kind == "end"), None)
        kds = [{"kind": k.kind, "date": k.date.isoformat(), "title": k.title} for k in prop.key_dates if k.kind not in ("start", "end")]
        valid_from = prop.contract.start_date or prop.contract.signed_at or date.today()
        await apply_amendment(session, actor, contract, doc, parameters=params, key_dates=kds, valid_from=valid_from, end_date=end,
                              note=f"Lisa {row.annex_nr}" if row.annex_nr else prop.contract.title)
    else:
        doc.contract_id, doc.role = contract.id, "supporting"
        emit(session, actor, "contract", contract.id, "contract.document_attached", {"source_document_id": doc.id, "title": prop.contract.title, "import_job_id": job.id})
    job.status, job.committed_contract_id = "committed", contract.id
    emit(session, actor, "import_job", job.id, "import.committed", {"contract_id": contract.id, "kind": row.kind})


async def commit_toimik(session: AsyncSession, actor: Actor, job_id: uuid.UUID, *, explicit: dict[str, Any] | None = None, only_ready_children: bool = True) -> uuid.UUID:
    """Confirm one toimik. ``explicit`` = the review page's commit body for the root (else the job's saved link / the
    suggestion). Children follow their contract; a child still waiting for a look stays for later."""
    from app.domain.imports import commit_import

    rows, ctx = await load(session)
    by_id = {r.job.id: r for r in rows}
    roots = toimikud(rows)
    row = by_id.get(job_id)
    if not row:
        raise NotFound("Importi ei leitud")
    if row.state in ("kinnitatud", "ei", "viga", "loen"):
        raise DomainError("Seda faili ei saa praegu kinnitada")
    if row.kind != "contract":
        if not row.parent:
            raise ValidationFailed("Vali leping, mille juurde see kuulub", errors=[{"loc": ["parent"], "msg": "puudub"}])
        kind, pid = row.parent
        cid = pid if kind == "contract" else by_id[pid].job.committed_contract_id if pid in by_id else None
        if not cid:
            raise DomainError("Kinnita enne leping, mille juurde see kuulub — lisa kinnitub koos sellega")
        if row.open:
            raise ValidationFailed(f"{len(row.open)} kohta ootab kontrolli", errors=[{"loc": [o], "msg": "kontrollimata"} for o in row.open])
        await _commit_child(session, actor, row, cid)
        return cid
    if explicit is None:
        if row.open:
            raise ValidationFailed(f"{len(row.open)} kohta ootab kontrolli", errors=[{"loc": [o], "msg": "kontrollimata"} for o in row.open])
        lk = row.link or {}
        ids = [uuid.UUID(x) for x in lk.get("space_ids") or []]
        explicit = {"company_id": uuid.UUID(lk["company_id"]) if lk.get("company_id") else None,
                    "asset_ids": ids or ([uuid.UUID(lk["asset_id"])] if lk.get("asset_id") else None),
                    "allocation_kind": lk.get("allocation_kind") if (ids or lk.get("asset_id")) else None, "parties": lk.get("parties"),
                    "checked": list(row.job.checked or []), "parking_numbers": lk.get("parking_numbers") if ids else None, "category": None}
    contract = await commit_import(session, actor, job_id, **explicit)
    root = next((t for t in roots if t.job.id == job_id), row)
    for c in root.children:
        if c.state == "valmis" or (not only_ready_children and c.state == "ootab" and not c.open):
            await _commit_child(session, actor, c, contract.id)
    return contract.id


async def commit_ready(session: AsyncSession, actor: Actor, batch_id: uuid.UUID) -> dict[str, int]:
    rows, ctx = await load(session)
    roots = [t for t in toimikud(rows) if (t.job.batch_id or t.job.id) == batch_id and toimik_state(t) == "valmis"]
    summary = ready_summary(roots, ctx)
    # contracts first: an annex whose contract is in the registry from an earlier batch can go after
    for t in sorted(roots, key=lambda t: t.kind != "contract"):
        await commit_toimik(session, actor, t.job.id)
        await session.flush()
    emit(session, actor, "import_batch", batch_id, "import.batch_committed", summary)
    return summary

