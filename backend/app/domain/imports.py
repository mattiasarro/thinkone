"""Import of existing contracts: upload → (worker) proposal → operator review → commit (spec: import).

For ``origin=imported`` contracts the source document is the legal truth; the committed
structure is an index of it. Nothing enters the registry without operator confirmation.
"""

from __future__ import annotations

import json
import re
import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.clauses import Node, write_tree
from app.domain.errors import DomainError, NotFound, ValidationFailed
from app.domain.events import Actor, emit
from app.domain.search import index_entity
from app.infra.blobstore import blobstore, sha256
from app.infra.settings import get_settings
from app.ingest.extract import detect_format
from app.ingest.schema import Proposal
from app.models.contracts import Contract, ContractFact, ContractType, ImportJob, SourceDocument

ALLOWED_FORMATS = {"pdf", "docx", "asice"}
CATEGORY_TITLES = {"lease": "Üürileping", "maintenance": "Hooldusleping", "management": "Haldusleping", "insurance": "Kindlustusleping",
                   "security": "Valveleping", "employment": "Tööleping", "other": "Leping"}


# ---------------------------------------------------------------- upload ----------------------------------

async def create_import(session: AsyncSession, actor: Actor, *, filename: str, content_type: str | None, data: bytes) -> ImportJob:
    if len(data) > get_settings().upload_max_bytes:
        raise ValidationFailed("Fail on liiga suur")
    fmt = detect_format(filename, content_type, data)
    if fmt not in ALLOWED_FORMATS:
        raise ValidationFailed("Ainult PDF, DOCX või ASiC-E/BDOC konteiner")
    digest = sha256(data)
    doc = SourceDocument(account_id=actor.account_id, filename=filename, content_type=content_type or "application/octet-stream",
                         size=len(data), s3_key="", sha256=digest, format=fmt, role="original")
    session.add(doc)
    await session.flush()
    doc.s3_key = f"account/{actor.account_id}/source/{doc.id}/{_safe(filename)}"
    await blobstore().put(doc.s3_key, data, doc.content_type)
    if fmt == "asice":
        from app.ingest.container import unpack

        c = unpack(data)
        doc.container_signatures = [{"signer": s.signer, "personal_code": s.personal_code, "signing_time": s.signing_time, "files": s.signed_files} for s in c.signatures]
        doc.datafiles = [{"name": n, "size": len(b)} for n, b in c.datafiles]
    job = ImportJob(account_id=actor.account_id, source_document_id=doc.id, status="uploaded", created_by=actor.user_id)
    session.add(job)
    await session.flush()
    # same file already committed? → flag before spending a model call
    dup = (await session.execute(select(SourceDocument).where(SourceDocument.sha256 == digest, SourceDocument.id != doc.id,
                                                              SourceDocument.contract_id.is_not(None)))).scalars().first()
    if dup:
        job.duplicate_of_contract_id = dup.contract_id
    emit(session, actor, "source_document", doc.id, "source_document.uploaded", {"filename": filename, "format": fmt, "size": len(data), "sha256": digest})
    emit(session, actor, "import_job", job.id, "import.created", {"source_document_id": doc.id, "duplicate_of": job.duplicate_of_contract_id})
    from app.worker.tasks import enqueue_structuring

    await enqueue_structuring(session, job.id)
    return job


def _safe(name: str) -> str:
    return re.sub(r"[^\w.\-]+", "_", name)[:120] or "file"


async def find_duplicate(session: AsyncSession, job: ImportJob) -> uuid.UUID | None:
    if job.duplicate_of_contract_id:
        return job.duplicate_of_contract_id
    prop = job.proposal or {}
    number = (prop.get("contract") or {}).get("number")
    if number:
        c = (await session.execute(select(Contract).where(Contract.number == number, Contract.deleted_at.is_(None)))).scalars().first()
        if c:
            return c.id
    return None


# ---------------------------------------------------------------- review ----------------------------------

async def get_job(session: AsyncSession, job_id: uuid.UUID) -> ImportJob:
    job = await session.get(ImportJob, job_id)
    if not job:
        raise NotFound("Importi ei leitud")
    return job


async def list_jobs(session: AsyncSession) -> list[ImportJob]:
    return list((await session.execute(select(ImportJob).order_by(ImportJob.created_at.desc()))).scalars())


async def save_review(session: AsyncSession, actor: Actor, job_id: uuid.UUID, reviewed: dict[str, Any]) -> ImportJob:
    job = await get_job(session, job_id)
    if job.status != "review":
        raise DomainError("Import ei ole ülevaatuse seisus")
    prop = Proposal.model_validate(reviewed)  # operator edits must stay schema-valid
    edits = _count_edits(job.proposal or {}, prop.model_dump(mode="json"))
    job.reviewed = prop.model_dump(mode="json")
    job.edits_count = edits
    emit(session, actor, "import_job", job.id, "import.reviewed", {"edits": edits})
    return job


def _count_edits(a: dict[str, Any], b: dict[str, Any]) -> int:
    def flat(d: Any, prefix: str = "") -> dict[str, Any]:
        out: dict[str, Any] = {}
        if isinstance(d, dict):
            for k, v in d.items():
                out.update(flat(v, f"{prefix}.{k}"))
        elif isinstance(d, list):
            for i, v in enumerate(d):
                out.update(flat(v, f"{prefix}[{i}]"))
        else:
            out[prefix] = d
        return out

    fa, fb = flat(a), flat(b)
    return sum(1 for k in set(fa) | set(fb) if fa.get(k) != fb.get(k))


async def retry_job(session: AsyncSession, actor: Actor, job_id: uuid.UUID) -> ImportJob:
    job = await get_job(session, job_id)
    if job.status not in ("failed",):
        raise DomainError("Uuesti saab käivitada ainult ebaõnnestunud importi")
    job.status, job.error = "uploaded", None
    emit(session, actor, "import_job", job.id, "import.retried")
    from app.worker.tasks import enqueue_structuring

    await enqueue_structuring(session, job.id)
    return job


async def source_pages(job: ImportJob, doc: SourceDocument) -> list[dict[str, Any]] | None:
    if not doc.extracted_text_s3_key:
        return None
    return json.loads(await blobstore().get(doc.extracted_text_s3_key))


# ---------------------------------------------------------------- commit ----------------------------------

async def commit_import(
    session: AsyncSession, actor: Actor, job_id: uuid.UUID, *, company_id: uuid.UUID | None = None, asset_id: uuid.UUID | None = None,
    allocation_kind: str | None = None, party_id: uuid.UUID | None = None, category: str | None = None, checked: list[str] | None = None,
) -> Contract:
    job = await get_job(session, job_id)
    if job.status != "review":
        raise DomainError("Import ei ole ülevaatuse seisus")
    prop = Proposal.model_validate(job.reviewed or job.proposal or {})
    pending = [u for u in prop.uncertain() if u not in set(checked or [])]
    if pending:
        raise ValidationFailed(f"{len(pending)} välja ootab kontrolli", errors=[{"loc": [p], "msg": "kontrollimata"} for p in pending])
    cat = category or prop.contract.category
    doc = await session.get(SourceDocument, job.source_document_id)
    assert doc

    from app.domain.parties import find_or_create_party

    party = None
    if party_id:
        from app.models.core import Party

        party = await session.get(Party, party_id)
        if not party:
            raise NotFound("Osapoolt ei leitud")
    else:
        cp = _counterparty(prop)
        if cp:
            party = await find_or_create_party(session, actor, name=cp.name, registry_code=cp.registry_code, role=_party_role(cat, cp.role),
                                               address=cp.address, email=cp.email)

    type_code = "lease" if cat == "lease" else "employment" if cat == "employment" else "generic"
    ctype = (await session.execute(select(ContractType).where(ContractType.code == type_code))).scalar_one()
    number = prop.contract.number or await _next_number(session, cat)

    if job.duplicate_of_contract_id:
        contract = await session.get(Contract, job.duplicate_of_contract_id)
        if not contract:
            raise NotFound("Dubleeritavat lepingut ei leitud")
        await _clear_structure(session, contract)
        contract.version += 1
        action = "contract.import_updated"
    else:
        contract = Contract(account_id=actor.account_id, number=number, contract_type_id=ctype.id, type_code=type_code, category=cat,
                            company_id=company_id, party_id=party.id if party else None, title=prop.contract.title, status="active",
                            origin="imported", has_clause_tree=bool(prop.clauses))
        session.add(contract)
        await session.flush()
        action = "contract.imported"
    contract.company_id = company_id or contract.company_id
    contract.party_id = party.id if party else contract.party_id
    contract.title, contract.category, contract.status = prop.contract.title, cat, _status_for(prop)
    contract.signed_at, contract.start_date, contract.end_date = prop.contract.signed_at, prop.contract.start_date, prop.contract.end_date
    contract.notes = prop.contract.summary
    contract.has_clause_tree = bool(prop.clauses)
    contract.source_document_id = doc.id
    doc.contract_id = contract.id

    # facts (invariant 2) + current-value projection
    values: dict[str, Any] = {}
    for p in prop.parameters:
        f = ContractFact(account_id=actor.account_id, contract_id=contract.id, key=p.key, reason="import",
                         value={"value": p.value, "unit": p.unit, "text": p.text, "label": p.label},
                         valid_from=prop.contract.start_date, provenance={"page": p.page, "char_start": p.char_start, "char_end": p.char_end,
                                                                          "confidence": p.confidence, "source_number": p.source_number})
        session.add(f)
        values[p.key] = {"value": p.value, "unit": p.unit, "label": p.label}
    contract.current_values = values

    # clauses: keep the source numbering verbatim, nest by level
    if prop.clauses:
        await write_tree(session, actor, _nest(prop.clauses), contract_id=contract.id, source="imported", locked=False)

    # key dates
    from app.domain.keydates import add_key_date

    for kd in prop.key_dates:
        await add_key_date(session, actor, contract_id=contract.id, kind_code=kd.kind, due_date=kd.date, title=kd.title,
                           provenance={"page": kd.page, "char_start": kd.char_start, "confidence": kd.confidence, "import_job_id": str(job.id)})

    # allocation (linking): exclusive for a lease on a space, coverage for a whole-building service contract
    if asset_id:
        from app.domain.assets import allocate

        kind = allocation_kind or ("exclusive" if cat == "lease" else "coverage")
        await allocate(session, actor, contract_id=contract.id, asset_id=asset_id, kind=kind,
                       period_start=prop.contract.start_date, period_end=prop.contract.end_date)

    await index_entity(session, actor.account_id, "contract", contract.id, f"{contract.number} · {contract.title}",
                       _search_text(prop), f"/app/portfell/leping/{contract.id}", subtitle=party.name if party else None)
    job.status, job.committed_contract_id = "committed", contract.id
    emit(session, actor, "contract", contract.id, action,
         {"import_job_id": job.id, "source_document_id": doc.id, "category": cat, "party_id": party.id if party else None,
          "asset_id": asset_id, "clauses": len(prop.clauses), "parameters": len(prop.parameters), "key_dates": len(prop.key_dates),
          "edits": job.edits_count, "prompt_version": job.prompt_version, "model": job.model})
    emit(session, actor, "import_job", job.id, "import.committed", {"contract_id": contract.id})
    return contract


def _counterparty(prop: Proposal):
    ours = {"landlord", "client", "insured", "employer"}
    for p in prop.parties:
        if p.role not in ours and p.role != "other":
            return p
    if prop.contract.counterparty_name:
        for p in prop.parties:
            if p.name == prop.contract.counterparty_name:
                return p
    others = [p for p in prop.parties if p.role == "other"]
    return others[-1] if len(prop.parties) > 1 and others else None


def _party_role(category: str, role: str) -> str:
    if category == "lease":
        return "client"
    if category == "employment":
        return "employee"
    return "supplier"


def _status_for(prop: Proposal) -> str:
    if prop.contract.end_date and prop.contract.end_date < date.today():
        return "ended"
    return "active"


async def _next_number(session: AsyncSession, category: str) -> str:
    prefix = {"lease": "LEP", "maintenance": "HOO", "management": "HAL", "insurance": "KIN", "security": "VAL", "employment": "TL"}.get(category, "IMP")
    year = date.today().year
    rows = (await session.execute(select(Contract.number).where(Contract.number.like(f"{prefix}-{year}-%")))).scalars()
    n = max([int(r.rsplit("-", 1)[1]) for r in rows if r.rsplit("-", 1)[1].isdigit()] + [0]) + 1
    return f"{prefix}-{year}-{n:03d}"


async def _clear_structure(session: AsyncSession, contract: Contract) -> None:
    from app.models.contracts import Clause, KeyDate

    for c in (await session.execute(select(Clause).where(Clause.contract_id == contract.id).order_by(Clause.ordinal.desc()))).scalars():
        await session.delete(c)
    for f in (await session.execute(select(ContractFact).where(ContractFact.contract_id == contract.id))).scalars():
        f.valid_to = date.today()
    for kd in (await session.execute(select(KeyDate).where(KeyDate.subject_id == contract.id, KeyDate.deleted_at.is_(None)))).scalars():
        kd.deleted_at = datetime.now(UTC)
    await session.flush()


def _nest(clauses) -> list[Node]:
    roots: list[Node] = []
    stack: list[tuple[int, Node]] = []
    for c in clauses:
        node = Node(text=c.text, heading=c.heading, source_number=c.number, number_style="decimal",
                    provenance={"page": c.page, "char_start": c.char_start, "char_end": c.char_end})
        while stack and stack[-1][0] >= c.level:
            stack.pop()
        if stack:
            stack[-1][1].children.append(node)
        else:
            roots.append(node)
        stack.append((c.level, node))
    return roots


def _search_text(prop: Proposal) -> str:
    parts = [prop.contract.summary or "", prop.contract.counterparty_name or ""]
    parts += [f"{p.label} {p.value or ''} {p.text}" for p in prop.parameters]
    parts += [f"{c.number} {c.heading or ''} {c.text}" for c in prop.clauses]
    return "\n".join(parts)


# ---------------------------------------------------------------- manual + amendments ---------------------

async def manual_register(
    session: AsyncSession, actor: Actor, *, filename: str, content_type: str | None, data: bytes, title: str, category: str,
    counterparty_name: str, registry_code: str | None = None, signed_at: date | None = None, start_date: date | None = None,
    end_date: date | None = None, key_dates: list[dict[str, Any]] | None = None, parameters: list[dict[str, Any]] | None = None,
    company_id: uuid.UUID | None = None, asset_id: uuid.UUID | None = None, notes: str | None = None,
) -> Contract:
    """Clause-less ``origin=imported`` record for a scanned document (no OCR). Joins calendar, search, reporting."""
    from app.domain.keydates import add_key_date
    from app.domain.parties import find_or_create_party

    fmt = detect_format(filename, content_type, data)
    doc = SourceDocument(account_id=actor.account_id, filename=filename, content_type=content_type or "application/octet-stream",
                         size=len(data), s3_key="", sha256=sha256(data), format=fmt if fmt in ALLOWED_FORMATS else "other",
                         has_text_layer=False, role="original")
    session.add(doc)
    await session.flush()
    doc.s3_key = f"account/{actor.account_id}/source/{doc.id}/{_safe(filename)}"
    await blobstore().put(doc.s3_key, data, doc.content_type)
    party = await find_or_create_party(session, actor, name=counterparty_name, registry_code=registry_code, role=_party_role(category, "other"))
    type_code = "lease" if category == "lease" else "employment" if category == "employment" else "generic"
    ctype = (await session.execute(select(ContractType).where(ContractType.code == type_code))).scalar_one()
    contract = Contract(account_id=actor.account_id, number=await _next_number(session, category), contract_type_id=ctype.id, type_code=type_code,
                        category=category, company_id=company_id, party_id=party.id, title=title, origin="imported", has_clause_tree=False,
                        status="ended" if end_date and end_date < date.today() else "active", signed_at=signed_at, start_date=start_date,
                        end_date=end_date, notes=notes, source_document_id=doc.id)
    session.add(contract)
    await session.flush()
    doc.contract_id = contract.id
    values = {}
    for p in parameters or []:
        session.add(ContractFact(account_id=actor.account_id, contract_id=contract.id, key=p["key"], reason="import",
                                 value={"value": p.get("value"), "unit": p.get("unit"), "text": p.get("text"), "label": p.get("label", p["key"])},
                                 valid_from=start_date, provenance={"manual": True}))
        values[p["key"]] = {"value": p.get("value"), "unit": p.get("unit"), "label": p.get("label", p["key"])}
    contract.current_values = values
    for kd in key_dates or []:
        await add_key_date(session, actor, contract_id=contract.id, kind_code=kd["kind"], due_date=date.fromisoformat(str(kd["date"])), title=kd.get("title"),
                           provenance={"manual": True})
    if asset_id:
        from app.domain.assets import allocate

        await allocate(session, actor, contract_id=contract.id, asset_id=asset_id, kind="exclusive" if category == "lease" else "coverage",
                       period_start=start_date, period_end=end_date)
    await index_entity(session, actor.account_id, "contract", contract.id, f"{contract.number} · {title}", f"{counterparty_name} {notes or ''}",
                       f"/app/portfell/leping/{contract.id}", subtitle=counterparty_name)
    emit(session, actor, "contract", contract.id, "contract.registered_manually",
         {"source_document_id": doc.id, "category": category, "party_id": party.id, "key_dates": len(key_dates or []), "parameters": len(parameters or [])})
    return contract


async def register_amendment(
    session: AsyncSession, actor: Actor, contract_id: uuid.UUID, *, filename: str, content_type: str | None, data: bytes, note: str | None,
    parameters: list[dict[str, Any]] | None = None, key_dates: list[dict[str, Any]] | None = None, valid_from: date | None = None,
    end_date: date | None = None,
) -> SourceDocument:
    """Externally signed amendment on an imported contract: store the annex, write new fact versions + key dates."""
    from app.domain.keydates import add_key_date

    contract = await session.get(Contract, contract_id)
    if not contract or contract.deleted_at:
        raise NotFound("Lepingut ei leitud")
    if contract.origin != "imported":
        raise DomainError("Välise muudatuse saab registreerida ainult imporditud lepingule; platvormi lepingud muudetakse lisaga (etapp 08)")
    fmt = detect_format(filename, content_type, data)
    doc = SourceDocument(account_id=actor.account_id, contract_id=contract.id, filename=filename, content_type=content_type or "application/octet-stream",
                         size=len(data), s3_key="", sha256=sha256(data), format=fmt if fmt in ALLOWED_FORMATS else "other", role="amendment")
    session.add(doc)
    await session.flush()
    doc.s3_key = f"account/{actor.account_id}/source/{doc.id}/{_safe(filename)}"
    await blobstore().put(doc.s3_key, data, doc.content_type)
    if fmt == "asice":
        from app.ingest.container import unpack

        doc.container_signatures = [{"signer": s.signer, "personal_code": s.personal_code, "signing_time": s.signing_time} for s in unpack(data).signatures]
    vf = valid_from or date.today()
    values = dict(contract.current_values or {})
    changes = []
    for p in parameters or []:
        old = (await session.execute(select(ContractFact).where(ContractFact.contract_id == contract.id, ContractFact.key == p["key"],
                                                                 ContractFact.valid_to.is_(None)))).scalars().all()
        f = ContractFact(account_id=actor.account_id, contract_id=contract.id, key=p["key"], reason="amendment", valid_from=vf,
                         value={"value": p.get("value"), "unit": p.get("unit"), "text": p.get("text"), "label": p.get("label", p["key"])},
                         provenance={"source_document_id": str(doc.id)})
        session.add(f)
        await session.flush()
        for o in old:
            o.valid_to, o.superseded_by = vf, f.id
        values[p["key"]] = {"value": p.get("value"), "unit": p.get("unit"), "label": p.get("label", p["key"])}
        changes.append({"key": p["key"], "old": [o.value.get("value") for o in old], "new": p.get("value")})
    contract.current_values = values
    if end_date:
        changes.append({"key": "end_date", "old": contract.end_date, "new": end_date})
        contract.end_date = end_date
    for kd in key_dates or []:
        await add_key_date(session, actor, contract_id=contract.id, kind_code=kd["kind"], due_date=date.fromisoformat(str(kd["date"])), title=kd.get("title"),
                           provenance={"source_document_id": str(doc.id)})
    contract.version += 1
    emit(session, actor, "contract", contract.id, "contract.external_amendment_registered",
         {"source_document_id": doc.id, "changes": changes, "key_dates": len(key_dates or []), "note": note}, reason=note)
    return doc
