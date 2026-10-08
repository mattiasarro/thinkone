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


async def source_pages(job: ImportJob | None, doc: SourceDocument) -> list[dict[str, Any]] | None:
    if not doc.extracted_text_s3_key:
        return None
    return json.loads(await blobstore().get(doc.extracted_text_s3_key))


async def source_pdf_url(doc: SourceDocument) -> str | None:
    """Presigned URL of the PDF a browser can embed at ``#page=N``: the file itself, or for an ASiC-E/BDOC container the
    signed PDF datafile inside it (unpacked once and cached next to the container in object storage). None for DOCX."""
    store = blobstore()
    if doc.format == "pdf":
        return await store.presigned_url(doc.s3_key, doc.filename)
    if doc.format != "asice":
        return None
    key = f"{doc.s3_key}.main.pdf"
    if not await store.exists(key):
        from app.ingest.container import unpack

        main = unpack(await store.get(doc.s3_key)).main_document()
        if not main or not main[0].lower().endswith(".pdf"):
            return None
        await store.put(key, main[1], "application/pdf")
    return await store.presigned_url(key, doc.filename.rsplit(".", 1)[0] + ".pdf")


# ---------------------------------------------------------------- commit ----------------------------------

async def commit_import(
    session: AsyncSession, actor: Actor, job_id: uuid.UUID, *, company_id: uuid.UUID | None = None, asset_id: uuid.UUID | None = None,
    allocation_kind: str | None = None, category: str | None = None, checked: list[str] | None = None,
    parties: list[dict[str, Any]] | None = None, parking_numbers: list[str] | None = None,
) -> Contract:
    """``parties``: [{index: <position in prop.parties> | None, party_id: <existing> | None, role, is_primary, include}].
    ``None`` → the default set: every proposal party that is not our side, the counterparty primary."""
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

    party_items = await _resolve_parties(session, actor, prop, cat, parties)
    party = next((pt for it, pt in party_items if it["is_primary"]), None)

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
                            company_id=company_id, title=prop.contract.title, status="active", origin="imported", has_clause_tree=bool(prop.clauses))
        session.add(contract)
        await session.flush()
        action = "contract.imported"
    contract.company_id = company_id or contract.company_id
    from app.domain.contract_parties import add_party, replace_parties

    links = [{"party_id": pt.id, "role": it["role"], "is_primary": it["is_primary"], "valid_from": prop.contract.start_date} for it, pt in party_items]
    if action == "contract.import_updated":
        if links:
            await replace_parties(session, actor, contract.id, links, source="import")
    else:
        for ln in links:
            await add_party(session, actor, contract_id=contract.id, party_id=ln["party_id"], role=ln["role"], is_primary=ln["is_primary"],
                            valid_from=ln["valid_from"], source="import")
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
    parking_linked: list[str] = []
    if asset_id:
        from app.domain.assets import allocate, get_asset, spots_of_space
        from app.domain.parking import list_spots

        kind = allocation_kind or ("exclusive" if cat == "lease" else "coverage")
        await allocate(session, actor, contract_id=contract.id, asset_id=asset_id, kind=kind,
                       period_start=prop.contract.start_date, period_end=prop.contract.end_date)
        # a lease on a space takes the space's default parking spots (demo v586), or the numbers the operator picked
        asset = await get_asset(session, asset_id)
        if kind == "exclusive" and asset.type_code == "space" and asset.parent_id:
            if parking_numbers is not None:
                wanted = set(parking_numbers)
                spots = [s for s in await list_spots(session, asset.parent_id) if (s.attributes or {}).get("number") in wanted]
            else:
                spots = await spots_of_space(session, asset.parent_id, asset.id)
            for spot in spots:
                if (spot.attributes or {}).get("out_of_service"):
                    continue
                try:
                    await allocate(session, actor, contract_id=contract.id, asset_id=spot.id, kind="exclusive",
                                   period_start=prop.contract.start_date, period_end=prop.contract.end_date)
                    parking_linked.append(spot.attributes["number"])
                except DomainError:
                    continue  # already taken for the period — the operator sees the discrepancy on the register

    await index_entity(session, actor.account_id, "contract", contract.id, f"{contract.number} · {contract.title}",
                       _search_text(prop), f"/app/portfell/leping/{contract.id}", subtitle=party.name if party else None)
    job.status, job.committed_contract_id = "committed", contract.id
    emit(session, actor, "contract", contract.id, action,
         {"import_job_id": job.id, "source_document_id": doc.id, "category": cat,
          "parties": [{"party_id": ln["party_id"], "role": ln["role"], "is_primary": ln["is_primary"]} for ln in links], "asset_id": asset_id, "parking_spots": parking_linked or None, "clauses": len(prop.clauses), "parameters": len(prop.parameters), "key_dates": len(prop.key_dates),
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


OUR_SIDE_ROLES = {"landlord", "client", "insured", "employer"}


def _is_ours(prop: Proposal, p) -> bool:
    ours = (prop.contract.our_company_name or "").strip().lower()
    return p.role in OUR_SIDE_ROLES or (bool(ours) and p.name.strip().lower() == ours)


async def _resolve_parties(session: AsyncSession, actor: Actor, prop: Proposal, cat: str, items: list[dict[str, Any]] | None) -> list[tuple[dict[str, Any], Any]]:
    """→ [(item, Party)] with exactly one ``is_primary`` (or none when the list is empty)."""
    from app.domain.contract_parties import counterparty_role
    from app.domain.parties import add_role, find_or_create_party, get_party

    out: list[tuple[dict[str, Any], Any]] = []
    if items is None:
        cp = _counterparty(prop)
        for p in prop.parties:
            if _is_ours(prop, p):
                continue
            role = counterparty_role(cat) if p is cp else p.role  # the counterparty takes the category's role (supplier → maintainer on a maintenance contract)
            party = await find_or_create_party(session, actor, name=p.name, registry_code=p.registry_code, role=role, address=p.address, email=p.email)
            out.append(({"role": role, "is_primary": p is cp}, party))
        if not out and cp is not None:
            role = counterparty_role(cat)
            party = await find_or_create_party(session, actor, name=cp.name, registry_code=cp.registry_code, role=role, address=cp.address, email=cp.email)
            out.append(({"role": role, "is_primary": True}, party))
    else:
        for it in items:
            if not it.get("include", True):
                continue
            role = (it.get("role") or "").strip().lower()
            if it.get("party_id"):
                party = await get_party(session, uuid.UUID(str(it["party_id"])))
                role = role or counterparty_role(cat)
                await add_role(session, actor, party, role)
            else:
                idx = it.get("index")
                if idx is None or idx < 0 or idx >= len(prop.parties):
                    raise ValidationFailed("Osapoole viide ettepanekusse on vigane", errors=[{"loc": ["parties"], "msg": "index"}])
                src = prop.parties[idx]
                role = role or src.role
                party = await find_or_create_party(session, actor, name=src.name, registry_code=src.registry_code, role=role, address=src.address, email=src.email)
            out.append(({"role": role, "is_primary": bool(it.get("is_primary"))}, party))
    # the same party once (first wins); exactly one primary
    seen: set[uuid.UUID] = set()
    uniq: list[tuple[dict[str, Any], Any]] = []
    for it, pt in out:
        if pt.id in seen:
            continue
        seen.add(pt.id)
        uniq.append((it, pt))
    if uniq and not any(it["is_primary"] for it, _ in uniq):
        uniq[0][0]["is_primary"] = True
    first = True
    for it, _ in uniq:
        if it["is_primary"]:
            if not first:
                it["is_primary"] = False
            first = False
    return uniq


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
    from sqlalchemy import delete as sql_delete

    from app.models.contracts import Clause, KeyDate

    # one statement: the self-referential FK is checked at statement end, so parents and children go together
    await session.execute(sql_delete(Clause).where(Clause.contract_id == contract.id))
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
    from app.domain.contract_parties import add_party, counterparty_role

    role = counterparty_role(category)
    party = await find_or_create_party(session, actor, name=counterparty_name, registry_code=registry_code, role=role)
    type_code = "lease" if category == "lease" else "employment" if category == "employment" else "generic"
    ctype = (await session.execute(select(ContractType).where(ContractType.code == type_code))).scalar_one()
    contract = Contract(account_id=actor.account_id, number=await _next_number(session, category), contract_type_id=ctype.id, type_code=type_code,
                        category=category, company_id=company_id, title=title, origin="imported", has_clause_tree=False,
                        status="ended" if end_date and end_date < date.today() else "active", signed_at=signed_at, start_date=start_date,
                        end_date=end_date, notes=notes, source_document_id=doc.id)
    session.add(contract)
    await session.flush()
    doc.contract_id = contract.id
    await add_party(session, actor, contract_id=contract.id, party_id=party.id, role=role, is_primary=True, valid_from=start_date, source="import")
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
         {"source_document_id": doc.id, "category": category, "parties": [{"party_id": party.id, "role": role, "is_primary": True}],
          "key_dates": len(key_dates or []), "parameters": len(parameters or [])})
    return contract


async def register_amendment(
    session: AsyncSession, actor: Actor, contract_id: uuid.UUID, *, filename: str, content_type: str | None, data: bytes, note: str | None,
    parameters: list[dict[str, Any]] | None = None, key_dates: list[dict[str, Any]] | None = None, valid_from: date | None = None,
    end_date: date | None = None, new_party_id: uuid.UUID | None = None,
) -> SourceDocument:
    """Externally signed amendment on an imported contract: store the annex, write new fact versions + key dates.

    ``new_party_id`` is the tenant-change case: the current primary row closes the day before ``valid_from`` and the new
    party becomes primary with ``source=amendment``."""
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
        from app.domain.keydates import update_key_date
        from app.models.contracts import KeyDate

        changes.append({"key": "end_date", "old": contract.end_date, "new": end_date})
        contract.end_date = end_date
        # the contract's end key date follows the amendment instead of leaving two end dates in the calendar
        ends = (await session.execute(select(KeyDate).where(KeyDate.subject_id == contract.id, KeyDate.kind_code == "end", KeyDate.deleted_at.is_(None)))).scalars().all()
        if ends:
            for kd in ends:
                await update_key_date(session, actor, kd.id, due_date=end_date)
        else:
            await add_key_date(session, actor, contract_id=contract.id, kind_code="end", due_date=end_date, title=None,
                               provenance={"source_document_id": str(doc.id)})
    if new_party_id:
        from app.domain.contract_parties import change_primary_by_amendment, primary_parties

        old = (await primary_parties(session, [contract.id])).get(contract.id)
        cp = await change_primary_by_amendment(session, actor, contract.id, new_party_id=new_party_id, valid_from=vf)
        changes.append({"key": "party", "old": old.id if old else None, "new": cp.party_id})
    for kd in key_dates or []:
        await add_key_date(session, actor, contract_id=contract.id, kind_code=kd["kind"], due_date=date.fromisoformat(str(kd["date"])), title=kd.get("title"),
                           provenance={"source_document_id": str(doc.id)})
    contract.version += 1
    emit(session, actor, "contract", contract.id, "contract.external_amendment_registered",
         {"source_document_id": doc.id, "changes": changes, "key_dates": len(key_dates or []), "note": note}, reason=note)
    return doc
