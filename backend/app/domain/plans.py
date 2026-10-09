"""Bulk upload of floor plans (demo v797–801): many files (PDF · PNG · JPG · SVG · ZIP) → matched to spaces by
FILENAME → operator confirms the file → space rows → stored as ``floor_plan`` attachments on the spaces.

Matching (``plVaste``): one model call per batch gets the space list and the filenames and returns a best-effort
pairing („T6B_Pind_08.pdf” → Pind 8; „a101_plaan.png” → A-101), leaving unclear files unmatched; the rule-based
``match_filename`` is the fallback when the model is unavailable. A file that matches no space is the building's
plan: „asendi”/„site” in the name → site plan (site_plan), „park” → parking plan (parking_plan), anything else → floor/building
overview (overview_plan, koondplaan). The operator can override every target. The same space in several files: PDF > SVG > image, the rest are skipped. Every bound plan is one
event: „Pind N: pinnaplaan vana → uus”.
"""

from __future__ import annotations

import io
import json
import re
import uuid
import zipfile
from dataclasses import dataclass
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompts import plan_match
from app.agent.providers.base import chat_model
from app.domain import assets as assets_domain
from app.domain import attachments as attachments_domain
from app.domain import registry
from app.domain.errors import DomainError
from app.domain.events import Actor, emit
from app.models.registry import Asset

log = structlog.get_logger()
PLAN_TYPES = {".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml"}
PREFERENCE = {"application/pdf": 0, "image/svg+xml": 1, "image/png": 2, "image/jpeg": 2}
MAX_FILES = 200


def _key(prefix: str | None, value: str) -> str:
    v = value.upper()
    v = re.sub(r"^0+(?=\d)", "", v)
    if prefix and re.match(r"^(büroo|buroo|boks|box|b)$", prefix, re.I) and re.match(r"^\d", v):
        return "B" + v
    return v


def space_key(name: str) -> str:
    m = re.match(r"^(pind|boks|büroo|buroo|ladu|p)?\s*([A-Z]?\d{1,3}[A-Z]?)$", (name or "").strip(), re.I)
    return _key(m.group(1), m.group(2)) if m else (name or "").strip().upper()


def match_filename(filename: str, spaces: list[Asset]) -> Asset | None:
    """Rule-based match (prefix + code). The fallback when the model is unavailable, and what the fake provider uses."""
    base = re.sub(r"\.[^.]+$", "", filename.rsplit("/", 1)[-1])
    base = re.sub(r"[_\-.]+", " ", base)
    m = re.search(r"(pind|p|unit|space|boks|box|büroo|buroo)\s*0*([A-Z]?\d{1,3}[A-Z]?)\b", base, re.I) or re.search(r"\b()(B\d{1,2})\b", base, re.I)
    if not m:
        return None
    key = _key(m.group(1), m.group(2))
    for s in spaces:
        if space_key(s.name) == key:
            return s
    return None


MIN_CONFIDENCE = 0.6
PARKING_RE = re.compile(r"park", re.I)  # „parkimisskeem.pdf”, „T6B_parkimine.png”, „parking_plan.svg”
SITE_RE = re.compile(r"asendi|site", re.I)  # „asendiplaan.pdf”, „T6B_site_plan.png”
BUILDING_TARGETS = {"property": ("site_plan", "asendiplaan"), "overview": ("overview_plan", "koondplaan"), "parking": ("parking_plan", "parkimisskeem")}


async def match_files(filenames: list[str], spaces: list[Asset]) -> dict[str, Asset | None]:
    """One model call for the whole batch: filename → space (or None). Falls back to the rules on any failure."""
    names = list(dict.fromkeys(filenames))
    if not names or not spaces:
        return dict.fromkeys(names)
    def describe(i: int, s: Asset) -> dict[str, Any]:
        attrs = s.attributes or {}
        return {"i": i, "name": s.name, **{k: attrs[k] for k in ("type", "floor") if attrs.get(k)}}

    payload = {"spaces": [describe(i, s) for i, s in enumerate(spaces, start=1)], "files": names}
    try:
        result = await chat_model().structured(system=plan_match.SYSTEM, user=json.dumps(payload, ensure_ascii=False), schema=plan_match.schema(), max_tokens=16000)
        out = apply_matches(result.data, names, spaces)
        log.info("plan_match", model=result.model, prompt=plan_match.PROMPT_VERSION, files=len(names), matched=sum(1 for v in out.values() if v))
        return out
    except Exception as e:  # noqa: BLE001 — a matching failure must never block the upload
        log.warning("plan_match_fallback", error=str(e)[:300])
        return {n: match_filename(n, spaces) for n in names}


def apply_matches(data: dict[str, Any], filenames: list[str], spaces: list[Asset]) -> dict[str, Asset | None]:
    """Validate the model's answer: known files only, indexes in range, confident matches only; missing files → None."""
    out: dict[str, Asset | None] = dict.fromkeys(filenames)
    for m in data.get("matches") or []:
        if not isinstance(m, dict) or m.get("file") not in out:
            continue
        idx, conf = m.get("space"), m.get("confidence")
        if not isinstance(idx, int) or isinstance(idx, bool) or idx < 1 or idx > len(spaces):
            continue
        if isinstance(conf, (int, float)) and conf < MIN_CONFIDENCE:
            continue
        out[m["file"]] = spaces[idx - 1]
    return out


@dataclass
class PlanFile:
    filename: str
    content_type: str
    data: bytes


@dataclass
class PlanRow:
    filename: str
    content_type: str
    size: int
    target: str  # "space" | "property" (site plan) | "overview" (koondplaan) | "parking" | "skip"
    space_id: uuid.UUID | None = None
    space_name: str | None = None
    note: str | None = None  # why skipped / what it replaces
    attachment_id: uuid.UUID | None = None


def expand_files(files: list[PlanFile]) -> list[PlanFile]:
    """Unpack ZIPs (one level), drop unsupported types, cap the count."""
    out: list[PlanFile] = []
    for f in files:
        name = f.filename.rsplit("/", 1)[-1]
        ext = ("." + name.rsplit(".", 1)[1].lower()) if "." in name else ""
        if ext == ".zip" or f.content_type in ("application/zip", "application/x-zip-compressed"):
            try:
                with zipfile.ZipFile(io.BytesIO(f.data)) as z:
                    for info in z.infolist():
                        if info.is_dir() or info.file_size == 0 or info.filename.startswith("__MACOSX"):
                            continue
                        inner = info.filename.rsplit("/", 1)[-1]
                        iext = ("." + inner.rsplit(".", 1)[1].lower()) if "." in inner else ""
                        if iext in PLAN_TYPES:
                            out.append(PlanFile(inner, PLAN_TYPES[iext], z.read(info)))
            except zipfile.BadZipFile as e:
                raise DomainError(f"„{name}” ei ole korrektne ZIP-fail") from e
            continue
        if ext in PLAN_TYPES:
            out.append(PlanFile(name, PLAN_TYPES[ext], f.data))
        else:
            out.append(PlanFile(name, f.content_type or "application/octet-stream", f.data))
    if len(out) > MAX_FILES:
        raise DomainError(f"Korraga kuni {MAX_FILES} faili")
    return out


async def propose(session: AsyncSession, property_id: uuid.UUID, files: list[PlanFile], mapping: dict[str, str] | None = None) -> list[PlanRow]:
    """Match each file to a space; ``mapping`` (filename → space id | "property" | "overview" | "parking" | "skip") overrides the guess."""
    prop = await assets_domain.get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Plaane saab siduda ainult hoone pindadega")
    spaces = [s for s in await assets_domain.children_of(session, prop.id, "space") if registry.is_lettable(s)]
    by_id = {str(s.id): s for s in spaces}
    expanded = expand_files(files)
    # one model call for every file the operator has not placed yet
    unplaced = [f.filename for f in expanded if f.content_type in PREFERENCE and (mapping or {}).get(f.filename) not in ("skip", *BUILDING_TARGETS, *by_id)]
    guessed = await match_files(unplaced, spaces)
    rows: list[PlanRow] = []
    for f in expanded:
        if f.content_type not in PREFERENCE:
            rows.append(PlanRow(f.filename, f.content_type, len(f.data), "skip", note="Lubatud on PDF, PNG, JPG, SVG või ZIP"))
            continue
        choice = (mapping or {}).get(f.filename)
        if choice == "skip":
            rows.append(PlanRow(f.filename, f.content_type, len(f.data), "skip", note="jäetakse välja"))
        elif choice in BUILDING_TARGETS:
            rows.append(PlanRow(f.filename, f.content_type, len(f.data), choice, note=BUILDING_TARGETS[choice][1]))
        elif choice and choice in by_id:
            s = by_id[choice]
            rows.append(PlanRow(f.filename, f.content_type, len(f.data), "space", s.id, s.name))
        else:
            s = guessed.get(f.filename)
            if s:
                rows.append(PlanRow(f.filename, f.content_type, len(f.data), "space", s.id, s.name, note="failinime järgi"))
            elif PARKING_RE.search(f.filename):
                rows.append(PlanRow(f.filename, f.content_type, len(f.data), "parking", note="failinime järgi — parkimisskeem"))
            elif SITE_RE.search(f.filename):
                rows.append(PlanRow(f.filename, f.content_type, len(f.data), "property", note="failinime järgi — asendiplaan"))
            else:
                rows.append(PlanRow(f.filename, f.content_type, len(f.data), "overview", note="pinda ei tuvastatud — koondplaan"))
    # same space from several files → keep the best format, skip the rest
    best: dict[uuid.UUID, PlanRow] = {}
    for r in rows:
        if r.target != "space" or not r.space_id:
            continue
        cur = best.get(r.space_id)
        if cur is None or PREFERENCE[r.content_type] < PREFERENCE[cur.content_type]:
            if cur is not None:
                cur.target, cur.note = "skip", f"sama pind mitmes failis — kasutatakse „{r.filename}”"
            best[r.space_id] = r
        else:
            r.target, r.note = "skip", f"sama pind mitmes failis — kasutatakse „{cur.filename}”"
    return rows


async def commit(session: AsyncSession, actor: Actor, property_id: uuid.UUID, files: list[PlanFile], mapping: dict[str, str] | None = None) -> list[PlanRow]:
    rows = await propose(session, property_id, files, mapping)
    prop = await assets_domain.get_asset(session, property_id)
    expanded = {f.filename: f for f in expand_files(files)}
    for r in rows:
        if r.target == "skip":
            continue
        f = expanded[r.filename]
        subject_id = r.space_id if r.target == "space" else prop.id
        role = "floor_plan" if r.target == "space" else BUILDING_TARGETS[r.target][0]
        previous = await attachments_domain.list_attachments(session, subject_type="asset", subject_id=subject_id, role=role)
        att = await attachments_domain.store_file(session, actor, subject_type="asset", subject_id=subject_id, role=role, filename=f.filename,
                                                  content_type=f.content_type, data=f.data)
        r.attachment_id = att.id
        label = r.space_name if r.target == "space" else prop.name
        emit(session, actor, "asset", subject_id, "asset.plan_set",
             {"type_code": "space" if r.target == "space" else "property", "name": label, "role": role,
              "before": previous[0].filename if previous else None, "after": f.filename, "attachment_id": att.id})
        if previous:
            r.note = f"asendab „{previous[0].filename}”"
        if role == "parking_plan":
            from app.worker.tasks import (
                enqueue_parking_plan_derivation,  # the VLM reads the plan in the worker → editor draft
            )

            await enqueue_parking_plan_derivation(session, actor.account_id, prop.id, att.id)
    return rows


def rows_out(rows: list[PlanRow]) -> list[dict[str, Any]]:
    return [{"filename": r.filename, "content_type": r.content_type, "size": r.size, "target": r.target, "space_id": r.space_id,
             "space_name": r.space_name, "note": r.note, "attachment_id": r.attachment_id} for r in rows]
