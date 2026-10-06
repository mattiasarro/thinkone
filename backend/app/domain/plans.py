"""Bulk upload of floor plans (demo v797–801): many files (PDF · PNG · JPG · SVG · ZIP) → matched to spaces by
FILENAME → operator confirms the file → space rows → stored as ``floor_plan`` attachments on the spaces.

Matching rules (``plVaste``): „T6B_Pind_08.pdf” → Pind 8; „…_B1” / „Büroo 1” → Büroo 1; a file that matches
no space is the building's plan (site_plan). The same space in several files: PDF > SVG > image, the rest
are skipped. Every bound plan is one event: „Pind N: pinnaplaan vana → uus”.
"""

from __future__ import annotations

import io
import re
import uuid
import zipfile
from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain import assets as assets_domain
from app.domain import attachments as attachments_domain
from app.domain.errors import DomainError
from app.domain.events import Actor, emit
from app.models.registry import Asset

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
    target: str  # "space" | "property" | "skip"
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
    """Match each file to a space; ``mapping`` (filename → space id | "property" | "skip") overrides the guess."""
    prop = await assets_domain.get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Plaane saab siduda ainult hoone pindadega")
    spaces = [s for s in await assets_domain.children_of(session, prop.id, "space") if not (s.attributes or {}).get("split_into")]
    by_id = {str(s.id): s for s in spaces}
    rows: list[PlanRow] = []
    for f in expand_files(files):
        if f.content_type not in PREFERENCE:
            rows.append(PlanRow(f.filename, f.content_type, len(f.data), "skip", note="Lubatud on PDF, PNG, JPG, SVG või ZIP"))
            continue
        choice = (mapping or {}).get(f.filename)
        if choice == "skip":
            rows.append(PlanRow(f.filename, f.content_type, len(f.data), "skip", note="jäetakse välja"))
        elif choice == "property":
            rows.append(PlanRow(f.filename, f.content_type, len(f.data), "property", note="kogu hoone plaan"))
        elif choice and choice in by_id:
            s = by_id[choice]
            rows.append(PlanRow(f.filename, f.content_type, len(f.data), "space", s.id, s.name))
        else:
            s = match_filename(f.filename, spaces)
            if s:
                rows.append(PlanRow(f.filename, f.content_type, len(f.data), "space", s.id, s.name, note="failinime järgi"))
            else:
                rows.append(PlanRow(f.filename, f.content_type, len(f.data), "property", note="pinda ei tuvastatud — kogu hoone plaan"))
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
        role = "floor_plan" if r.target == "space" else "site_plan"
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
    return rows


def rows_out(rows: list[PlanRow]) -> list[dict[str, Any]]:
    return [{"filename": r.filename, "content_type": r.content_type, "size": r.size, "target": r.target, "space_id": r.space_id,
             "space_name": r.space_name, "note": r.note, "attachment_id": r.attachment_id} for r in rows]
