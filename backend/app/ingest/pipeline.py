"""Worker entry: extraction → structuring → review. Status transitions are event-logged."""

from __future__ import annotations

import uuid

import structlog
from sqlalchemy import text

from app.domain.events import Actor, emit
from app.infra.blobstore import blobstore
from app.infra.db import sessionmaker, tenant_session
from app.ingest.extract import extract
from app.ingest.structure import structure
from app.models.contracts import ImportJob, SourceDocument

log = structlog.get_logger()


async def _account_of_job(job_id: uuid.UUID) -> uuid.UUID | None:
    async with sessionmaker()() as s0:
        async with s0.begin():
            await s0.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            row = (await s0.execute(text("SELECT account_id FROM import_job WHERE id = :id"), {"id": job_id})).first()
    return row[0] if row else None


async def run_structuring(job_id: uuid.UUID) -> None:
    account_id = await _account_of_job(job_id)
    if not account_id:
        log.warning("import_job_missing", job=str(job_id))
        return
    actor = Actor.system(account_id, correlation_id=f"import:{job_id.hex[:12]}")

    # 1. extraction (own transaction so the UI sees 'structuring' while the model runs)
    async with tenant_session(account_id) as session:
        job = await session.get(ImportJob, job_id)
        doc = await session.get(SourceDocument, job.source_document_id) if job else None
        if not job or not doc or job.status not in ("uploaded", "failed"):
            return
        job.status, job.error = "extracting", None
        emit(session, actor, "import_job", job.id, "import.extracting")
        try:
            data = await blobstore().get(doc.s3_key)
            fmt = doc.format
            if fmt == "asice":
                from app.ingest.container import unpack

                main = unpack(data).main_document()
                if not main:
                    raise ValueError("Konteineris ei ole dokumenti")
                from app.ingest.extract import detect_format

                fmt = detect_format(main[0], None, main[1])
                data = main[1]
            ex = extract(fmt, data)
            doc.page_count, doc.has_text_layer = ex.page_count, ex.has_text_layer
            if not ex.has_text_layer:
                job.status, job.error = "failed", "Dokumendil puudub tekstikiht (skaneeritud) — struktuurituvastus ei ole võimalik. Registreeri võtmeandmed käsitsi."
                emit(session, actor, "import_job", job.id, "import.failed", {"error": job.error})
                return
            key = f"{doc.s3_key}.pages.json"
            import json

            await blobstore().put(key, json.dumps([{"page": p.page, "text": p.text, "char_start": p.char_start} for p in ex.pages]).encode(), "application/json")
            doc.extracted_text_s3_key = key
            job.status = "structuring"
            emit(session, actor, "import_job", job.id, "import.structuring", {"pages": ex.page_count, "chars": len(ex.text)})
        except Exception as e:  # noqa: BLE001
            job.status, job.error = "failed", f"Teksti lugemine ebaõnnestus: {e}"[:500]
            emit(session, actor, "import_job", job.id, "import.failed", {"error": job.error})
            log.exception("import_extract_failed", job=str(job_id))
            return

    # 2. structuring (LLM) — outside any DB transaction
    try:
        prop, result, prompt_version = await structure(ex)
    except Exception as e:  # noqa: BLE001
        async with tenant_session(account_id) as session:
            job = await session.get(ImportJob, job_id)
            job.status, job.error = "failed", f"Struktureerimine ebaõnnestus: {e}"[:500]
            emit(session, actor, "import_job", job.id, "import.failed", {"error": job.error})
        log.exception("import_structure_failed", job=str(job_id))
        return

    # 3. proposal → review
    async with tenant_session(account_id) as session:
        job = await session.get(ImportJob, job_id)
        from app.domain.imports import find_duplicate

        job.proposal = prop.model_dump(mode="json")
        job.reviewed = None
        job.prompt_version, job.model, job.usage = prompt_version, result.model, result.usage
        job.duplicate_of_contract_id = await find_duplicate(session, job)
        job.status = "review"
        emit(session, actor, "import_job", job.id, "import.proposed",
             {"model": result.model, "prompt_version": prompt_version, "usage": result.usage, "clauses": len(prop.clauses),
              "parameters": len(prop.parameters), "key_dates": len(prop.key_dates), "uncertain": prop.uncertain(),
              "duplicate_of": job.duplicate_of_contract_id})
