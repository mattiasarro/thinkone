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
from app.verticals.real_estate import PARKING_TYPES, ParkingLot, SpotGeom

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


def lots_of(attrs: dict[str, Any]) -> list[dict[str, Any]]:
    """The building's lots; a legacy single ``parking_plan`` frame reads as one lot called „Parkla”."""
    lots = attrs.get("parking_lots")
    if lots:
        return [dict(lot) for lot in lots]
    frame = attrs.get("parking_plan")
    return [{"id": "main", "name": "Parkla", **frame}] if frame else []


def _lot_name(filename: str) -> str:
    return re.sub(r"\.[^.]+$", "", filename.rsplit("/", 1)[-1]).replace("_", " ").strip() or "Parkla"


# ---- read --------------------------------------------------------------------------------------


async def plan_attachments(session: AsyncSession, property_id: uuid.UUID) -> list[Attachment]:
    return await attachments_domain.list_attachments(session, subject_type="asset", subject_id=property_id, role="parking_plan")


async def plan_attachment(session: AsyncSession, property_id: uuid.UUID) -> Attachment | None:
    rows = await plan_attachments(session, property_id)
    return rows[0] if rows else None


async def plan_document(session: AsyncSession, property_id: uuid.UUID) -> dict[str, Any]:
    """Frame + every register row (placed or not) + the pending draft, for the editor and the viewers."""
    prop = await assets_domain.get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Parkimisskeem on ainult hoonel")
    attrs = prop.attributes or {}
    spots = {s.id: s for s in await parking_domain.list_spots(session, prop.id)}
    lots = lots_of(attrs)
    first = lots[0]["id"] if lots else None
    rows = await parking_domain.spot_rows(session, prop.id)
    for r in rows:
        g = (spots[r["id"]].attributes or {}).get("geom")
        r["geom"] = {**g, "lot": g.get("lot") or first} if g else None
    atts = await plan_attachments(session, prop.id)
    return {"property_id": prop.id, "lots": lots, "spots": rows, "draft": attrs.get("parking_plan_draft"),
            "plan_attachments": [{"id": a.id, "filename": a.filename, "content_type": a.content_type} for a in atts]}


# ---- write -------------------------------------------------------------------------------------


async def save_plan(session: AsyncSession, actor: Actor, property_id: uuid.UUID, *, lots: list[dict[str, Any]] | None,
                    spots: list[dict[str, Any]], new: list[dict[str, Any]], clear_draft: bool = False) -> dict[str, Any]:
    """One save of the editor: the lots (None = unchanged), each existing spot's box (+ default space), new register
    rows drawn on the plan. ``geom: null`` unplaces a spot; a register row is never deleted here. A lot removed from
    the list unplaces the boxes on it."""
    prop = await assets_domain.get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Parkimisskeem on ainult hoonel")
    if lots is not None:
        lots = [_validate(ParkingLot, lot, "Parkla") for lot in lots]
        if len({lot["id"] for lot in lots}) != len(lots):
            raise DomainError("Parklate id-d peavad olema erinevad")
        for lot in lots:
            bg = lot.get("background")
            if bg:
                att = await attachments_domain.get_attachment(session, uuid.UUID(bg["attachment_id"]))
                if att.subject_type != "asset" or att.subject_id != prop.id:
                    raise DomainError("Taustaplaan peab olema selle hoone manus")
    current_lots = lots if lots is not None else lots_of(prop.attributes or {})
    lot_ids = [lot["id"] for lot in current_lots]

    def geom_of(data: Any) -> dict[str, Any] | None:
        if not data:
            return None
        g = _validate(SpotGeom, data, "Koha kast")
        g["lot"] = g.get("lot") or (lot_ids[0] if lot_ids else None)
        if g["lot"] not in lot_ids:
            raise DomainError(f"Parklat „{g['lot']}” pole")
        return g
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
        geom = geom_of(item.get("geom"))
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
        geom = geom_of(item.get("geom"))
        await assets_domain.create_asset(session, actor, type_code="parking_spot", name=f"P {number}", parent_id=prop.id, company_id=prop.company_id,
                                         attributes={"number": number, "zone": item.get("zone") or None, "type": t, "geom": geom, "space_id": want})
        existing.add(number)
        created += 1
    if lots is not None:  # boxes on a lot that no longer exists come off the plan
        for s in await parking_domain.list_spots(session, prop.id):
            g = (s.attributes or {}).get("geom")
            if g and (g.get("lot") or (lot_ids[0] if lot_ids else None)) not in lot_ids:
                await assets_domain.update_asset(session, actor, s.id, attributes={**s.attributes, "geom": None})
                unplaced += 1
    await parking_domain.sync_space_counts(session, actor, prop, before)
    prop = await assets_domain.get_asset(session, prop.id)
    patch: dict[str, Any] = {}
    if lots is not None:
        patch["parking_lots"] = lots
        patch["parking_plan"] = None  # the legacy single frame is superseded once lots are written
    if clear_draft and (prop.attributes or {}).get("parking_plan_draft"):
        patch["parking_plan_draft"] = None
    if created and prop.attributes.get("has_parking") is not True:
        patch["has_parking"] = True
    if patch:
        await assets_domain.update_asset(session, actor, prop.id, attributes={**(prop.attributes or {}), **patch})
    emit(session, actor, "asset", prop.id, "asset.parking_plan_updated", {"name": prop.name, "placed": placed, "unplaced": unplaced, "created": created,
                                                                           "lots": len(current_lots)})
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


def draft_from_model(data: dict[str, Any], img_w: int, img_h: int, spots: list[Asset], attachment_id: uuid.UUID,
                     lot: dict[str, Any] | None = None) -> dict[str, Any]:
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
                    "type": TYPE_MAP.get(s.get("type") or "", None), "geom": {**geom.model_dump(mode="json", exclude_none=True), "lot": (lot or {}).get("id")}})
    width, height = round(img_w * m_per_px, 2), round(img_h * m_per_px, 2)
    lot = {**(lot or {"id": f"lot-{str(attachment_id)[:8]}", "name": "Parkla"}), "units": "m", "width": width, "height": height,
           "background": {"attachment_id": str(attachment_id), "x": 0, "y": 0, "w": width, "h": height, "opacity": 0.6}}
    for s in out:
        s["geom"]["lot"] = lot["id"]
    return {"status": "ready", "created_at": datetime.now(UTC).isoformat(), "lot": lot, "width": width, "height": height,
            "background": lot["background"], "spots": out, "matched": len(used), "notes": str(data.get("notes") or "")[:500]}


async def derive_draft(session: AsyncSession, actor: Actor, property_id: uuid.UUID, *, attachment_id: uuid.UUID | None = None,
                       lot_id: str | None = None) -> dict[str, Any]:
    """Read a parking plan with the model and store the proposal as ``parking_plan_draft`` for one lot: the lot given
    (its background when no attachment is named), else the lot already using that plan, else a new lot named after the file."""
    prop = await assets_domain.get_asset(session, property_id)
    lots = lots_of(prop.attributes or {})
    lot = next((x for x in lots if x["id"] == lot_id), None) if lot_id else None
    if lot_id and not lot:
        raise DomainError("Sellist parklat pole")
    if attachment_id is None and lot and lot.get("background"):
        attachment_id = uuid.UUID(lot["background"]["attachment_id"])
    att = await attachments_domain.get_attachment(session, attachment_id) if attachment_id else await plan_attachment(session, prop.id)
    if not att or att.subject_id != prop.id or att.role != "parking_plan":
        raise DomainError("Hoonel pole parkimisplaani — laadi see üles sammus „Plaanid”")
    if lot is None:
        lot = next((x for x in lots if (x.get("background") or {}).get("attachment_id") == str(att.id)), None)
    if lot is None:
        lot = {"id": f"lot-{str(att.id)[:8]}", "name": _lot_name(att.filename)}
    spots = await parking_domain.list_spots(session, prop.id)
    png, w, h = render_image(await blobstore().get(att.s3_key), att.content_type, VLM_MAX_PX)
    payload = {"image": {"width": w, "height": h}, "register": [(s.attributes or {}).get("number") for s in spots]}
    try:
        result = await chat_model().structured(system=prompt.SYSTEM, user=json.dumps(payload, ensure_ascii=False), schema=prompt.schema(),
                                               max_tokens=32000, images=[("image/png", png)])
        draft = draft_from_model(result.data, w, h, spots, att.id, lot)
        draft.update({"model": result.model, "prompt_version": prompt.PROMPT_VERSION, "attachment_id": str(att.id)})
    except Exception as e:  # noqa: BLE001 — the failure is shown in the editor, never raised to the uploader
        log.warning("parking_plan_derive_failed", property=str(prop.id), error=str(e)[:300])
        draft = {"status": "failed", "created_at": datetime.now(UTC).isoformat(), "error": str(e)[:300], "attachment_id": str(att.id), "spots": [],
                 "lot": {"id": lot["id"], "name": lot["name"]}}
    await assets_domain.update_asset(session, actor, prop.id, attributes={**(prop.attributes or {}), "parking_plan_draft": draft})
    emit(session, actor, "asset", prop.id, "asset.parking_plan_derived", {"name": prop.name, "status": draft["status"], "spots": len(draft["spots"]),
                                                                           "matched": draft.get("matched", 0), "model": draft.get("model")})
    return draft


async def discard_draft(session: AsyncSession, actor: Actor, property_id: uuid.UUID) -> None:
    prop = await assets_domain.get_asset(session, property_id)
    if (prop.attributes or {}).get("parking_plan_draft"):
        await assets_domain.update_asset(session, actor, prop.id, attributes={**prop.attributes, "parking_plan_draft": None})
