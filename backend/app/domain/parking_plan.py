"""Parking schematic: each register spot may carry a box (``geom``, metres) on the building's plan frame.

The schematic is data, not a drawing: the editor and every viewer render the same JSON (frame + spots), so a lease
annex can highlight a tenant's spots without touching the uploaded plan. The uploaded ``parking_plan`` attachment is
only a background layer — and the input of the VLM draft, which proposes boxes the operator reviews in the editor
(``parking_plan_draft`` on the property; accepted boxes become spot ``geom`` and the draft is cleared).
"""

from __future__ import annotations

import json
import re
import statistics
import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompts import parking_plan as prompt
from app.agent.providers.base import chat_model
from app.domain import assets as assets_domain
from app.domain import attachments as attachments_domain
from app.domain import parking as parking_domain
from app.domain.errors import DomainError
from app.domain.events import Actor, emit
from app.infra.blobstore import blobstore
from app.models.core import Attachment
from app.models.registry import Asset
from app.verticals.real_estate import PARKING_TYPES, ParkingPlanFrame, SpotGeom

log = structlog.get_logger()

STANDARD_WIDTH_M = 2.5  # what the median detected spot width is assumed to be when the plan carries no scale
DEFAULT_M_PER_PX = 0.05
VLM_MAX_PX = 1568  # Anthropic's sweet spot for a single image
BACKGROUND_MAX_PX = 2400
TYPE_MAP = {"ev": "elektriauto", "disabled": "ligipääsetav", "standard": "tavaline"}


def _validate(model: type, data: Any, what: str) -> dict[str, Any]:
    try:
        return model.model_validate(data).model_dump(mode="json", exclude_none=True)
    except Exception as e:  # pydantic.ValidationError
        errs = getattr(e, "errors", lambda: [])()
        detail = "; ".join(f"{'.'.join(str(x) for x in err.get('loc', []))}: {err.get('msg')}" for err in errs) or str(e)
        raise DomainError(f"{what}: {detail}") from e


# ---- read --------------------------------------------------------------------------------------


async def plan_attachment(session: AsyncSession, property_id: uuid.UUID) -> Attachment | None:
    rows = await attachments_domain.list_attachments(session, subject_type="asset", subject_id=property_id, role="parking_plan")
    return rows[0] if rows else None


async def plan_document(session: AsyncSession, property_id: uuid.UUID) -> dict[str, Any]:
    """Frame + every register row (placed or not) + the pending draft, for the editor and the viewers."""
    prop = await assets_domain.get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Parkimisskeem on ainult hoonel")
    attrs = prop.attributes or {}
    spots = {s.id: s for s in await parking_domain.list_spots(session, prop.id)}
    rows = await parking_domain.spot_rows(session, prop.id)
    for r in rows:
        r["geom"] = (spots[r["id"]].attributes or {}).get("geom")
    att = await plan_attachment(session, prop.id)
    return {"property_id": prop.id, "frame": attrs.get("parking_plan"), "spots": rows, "draft": attrs.get("parking_plan_draft"),
            "plan_attachment": {"id": att.id, "filename": att.filename, "content_type": att.content_type} if att else None}


# ---- write -------------------------------------------------------------------------------------


async def save_plan(session: AsyncSession, actor: Actor, property_id: uuid.UUID, *, frame: dict[str, Any] | None,
                    spots: list[dict[str, Any]], new: list[dict[str, Any]], clear_draft: bool = False) -> dict[str, Any]:
    """One save of the editor: the frame, each existing spot's box (+ default space), new register rows drawn on the
    plan. ``geom: null`` unplaces a spot; a register row is never deleted here."""
    prop = await assets_domain.get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Parkimisskeem on ainult hoonel")
    if frame is not None:
        frame = _validate(ParkingPlanFrame, frame, "Skeemi raam")
        bg = frame.get("background")
        if bg:
            att = await attachments_domain.get_attachment(session, uuid.UUID(bg["attachment_id"]))
            if att.subject_type != "asset" or att.subject_id != prop.id:
                raise DomainError("Taustaplaan peab olema selle hoone manus")
    all_spots = {s.id: s for s in await parking_domain.list_spots(session, prop.id)}
    before = parking_domain._numbers_by_space(list(all_spots.values()))  # noqa: SLF001 — one count sync at the end
    spaces = {str(sp.id) for sp in await assets_domain.children_of(session, prop.id, "space")}
    placed = unplaced = 0
    for item in spots:
        sid = uuid.UUID(str(item["id"]))
        s = all_spots.get(sid)
        if not s:
            raise DomainError("Koht ei kuulu sellele hoonele")
        cur = s.attributes or {}
        patch_attrs = dict(cur)
        geom = _validate(SpotGeom, item["geom"], "Koha kast") if item.get("geom") else None
        if geom != cur.get("geom"):
            patch_attrs["geom"] = geom
            placed += geom is not None
            unplaced += geom is None
        if "space_id" in item:
            want = str(item["space_id"]) if item["space_id"] else None
            if want and want not in spaces:
                raise DomainError("Pind peab olema sama hoone pind")
            if want != cur.get("space_id"):
                patch_attrs["space_id"] = want
        if patch_attrs != cur:
            await assets_domain.update_asset(session, actor, s.id, attributes=patch_attrs)
    created = 0
    existing = {(s.attributes or {}).get("number") for s in all_spots.values()}
    for item in new:
        number = str(item.get("number") or "").strip()
        if not number:
            raise DomainError("Uuel kohal peab olema number")
        if number in existing:
            raise DomainError(f"Number {number} on juba registris")
        t = item.get("type") or "tavaline"
        if t not in PARKING_TYPES:
            raise DomainError("Tüüp peab olema tavaline, elektriauto või ligipääsetav")
        want = str(item["space_id"]) if item.get("space_id") else None
        if want and want not in spaces:
            raise DomainError("Pind peab olema sama hoone pind")
        geom = _validate(SpotGeom, item["geom"], "Koha kast") if item.get("geom") else None
        await assets_domain.create_asset(session, actor, type_code="parking_spot", name=f"P {number}", parent_id=prop.id, company_id=prop.company_id,
                                         attributes={"number": number, "zone": item.get("zone") or None, "type": t, "geom": geom, "space_id": want})
        existing.add(number)
        created += 1
    await parking_domain.sync_space_counts(session, actor, prop, before)
    prop = await assets_domain.get_asset(session, prop.id)
    patch: dict[str, Any] = {}
    if frame is not None:
        patch["parking_plan"] = frame
    if clear_draft and (prop.attributes or {}).get("parking_plan_draft"):
        patch["parking_plan_draft"] = None
    if created and prop.attributes.get("has_parking") is not True:
        patch["has_parking"] = True
    if patch:
        await assets_domain.update_asset(session, actor, prop.id, attributes={**(prop.attributes or {}), **patch})
    emit(session, actor, "asset", prop.id, "asset.parking_plan_updated", {"name": prop.name, "placed": placed, "unplaced": unplaced, "created": created,
                                                                           "frame": bool(frame)})
    return await plan_document(session, prop.id)


# ---- background (rendered once per attachment) ---------------------------------------------------


def render_image(data: bytes, content_type: str, max_px: int) -> tuple[bytes, int, int]:
    """PDF (first page), SVG, PNG or JPEG → PNG no larger than ``max_px`` on its long side. Returns (png, width, height)."""
    import fitz  # PyMuPDF

    kind = {"application/pdf": "pdf", "image/svg+xml": "svg", "image/png": "png", "image/jpeg": "jpg"}.get(content_type)
    if not kind:
        raise DomainError(f"Parkimisplaani tüüpi {content_type} ei saa pildiks teisendada")
    with fitz.open(stream=data, filetype=kind) as doc:
        page = doc[0]
        rect = page.rect
        zoom = min(max_px / max(rect.width, rect.height), 4.0) if max(rect.width, rect.height) else 1.0
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
        return pix.tobytes("png"), pix.width, pix.height


async def background_png(session: AsyncSession, property_id: uuid.UUID, attachment_id: uuid.UUID | None = None) -> bytes:
    att = await attachments_domain.get_attachment(session, attachment_id) if attachment_id else await plan_attachment(session, property_id)
    if not att or att.subject_id != property_id:
        raise DomainError("Hoonel pole parkimisplaani")
    store = blobstore()
    key = f"derived/parking-plan/{att.id}.png"
    if await store.exists(key):
        return await store.get(key)
    png, _, _ = render_image(await store.get(att.s3_key), att.content_type, BACKGROUND_MAX_PX)
    await store.put(key, png, "image/png")
    return png


# ---- VLM draft ---------------------------------------------------------------------------------


def _norm_label(s: str | None) -> str:
    return re.sub(r"[\s_\-.]+", "", (s or "").strip().upper())


def match_label(label: str | None, numbers: list[str]) -> str | None:
    """Painted label → register number: exact (ignoring case/separators), else the only number with the same digits."""
    if not label:
        return None
    key = _norm_label(label)
    if not key:
        return None
    by_key = {_norm_label(n): n for n in numbers}
    if key in by_key:
        return by_key[key]
    digits = "".join(ch for ch in key if ch.isdigit())
    if digits:
        hits = [n for n in numbers if "".join(ch for ch in n if ch.isdigit()) == digits.lstrip("0")]
        if len(hits) == 1:
            return hits[0]
    return None


def draft_from_model(data: dict[str, Any], img_w: int, img_h: int, spots: list[Asset], attachment_id: uuid.UUID) -> dict[str, Any]:
    """Pixels → metres (median spot width = 2.5 m), labels → register rows; the frame covers the whole image."""
    items = [s for s in (data.get("spots") or []) if isinstance(s, dict)]
    widths = [min(float(s.get("w") or 0), float(s.get("h") or 0)) for s in items]
    widths = [w for w in widths if w > 0]
    m_per_px = STANDARD_WIDTH_M / statistics.median(widths) if widths else DEFAULT_M_PER_PX
    numbers = [(s.attributes or {}).get("number", "") for s in spots]
    by_number = {(s.attributes or {}).get("number"): s for s in spots}
    out: list[dict[str, Any]] = []
    used: set[str] = set()
    for s in items:
        try:
            w, h = float(s["w"]) * m_per_px, float(s["h"]) * m_per_px
            geom = SpotGeom(x=round(float(s["cx"]) * m_per_px, 2), y=round(float(s["cy"]) * m_per_px, 2),
                            w=round(min(w, h), 2), h=round(max(w, h), 2), rot=round(float(s.get("rot") or 0) % 360, 1))
        except Exception:  # noqa: BLE001 — a malformed box is dropped, not fatal
            continue
        number = match_label(s.get("label"), numbers)
        if number in used:
            number = None  # two boxes claim one number: keep the first, leave the other unbound
        if number:
            used.add(number)
        out.append({"spot_id": str(by_number[number].id) if number else None, "number": number, "label": s.get("label"),
                    "type": TYPE_MAP.get(s.get("type") or "", None), "geom": geom.model_dump(mode="json")})
    width, height = round(img_w * m_per_px, 2), round(img_h * m_per_px, 2)
    return {"status": "ready", "created_at": datetime.now(UTC).isoformat(), "width": width, "height": height,
            "background": {"attachment_id": str(attachment_id), "x": 0, "y": 0, "w": width, "h": height, "opacity": 0.6},
            "spots": out, "matched": len(used), "notes": str(data.get("notes") or "")[:500]}


async def derive_draft(session: AsyncSession, actor: Actor, property_id: uuid.UUID) -> dict[str, Any]:
    """Read the uploaded parking plan with the model and store the proposal as ``parking_plan_draft``."""
    prop = await assets_domain.get_asset(session, property_id)
    att = await plan_attachment(session, prop.id)
    if not att:
        raise DomainError("Hoonel pole parkimisplaani — laadi see üles sammus „Plaanid”")
    spots = await parking_domain.list_spots(session, prop.id)
    png, w, h = render_image(await blobstore().get(att.s3_key), att.content_type, VLM_MAX_PX)
    payload = {"image": {"width": w, "height": h}, "register": [(s.attributes or {}).get("number") for s in spots]}
    try:
        result = await chat_model().structured(system=prompt.SYSTEM, user=json.dumps(payload, ensure_ascii=False), schema=prompt.schema(),
                                               max_tokens=32000, images=[("image/png", png)])
        draft = draft_from_model(result.data, w, h, spots, att.id)
        draft.update({"model": result.model, "prompt_version": prompt.PROMPT_VERSION, "attachment_id": str(att.id)})
    except Exception as e:  # noqa: BLE001 — the failure is shown in the editor, never raised to the uploader
        log.warning("parking_plan_derive_failed", property=str(prop.id), error=str(e)[:300])
        draft = {"status": "failed", "created_at": datetime.now(UTC).isoformat(), "error": str(e)[:300], "attachment_id": str(att.id), "spots": []}
    await assets_domain.update_asset(session, actor, prop.id, attributes={**(prop.attributes or {}), "parking_plan_draft": draft})
    emit(session, actor, "asset", prop.id, "asset.parking_plan_derived", {"name": prop.name, "status": draft["status"], "spots": len(draft["spots"]),
                                                                           "matched": draft.get("matched", 0), "model": draft.get("model")})
    return draft


async def discard_draft(session: AsyncSession, actor: Actor, property_id: uuid.UUID) -> None:
    prop = await assets_domain.get_asset(session, property_id)
    if (prop.attributes or {}).get("parking_plan_draft"):
        await assets_domain.update_asset(session, actor, prop.id, attributes={**prop.attributes, "parking_plan_draft": None})
