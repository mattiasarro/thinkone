"""Quotes (hinnapakkumine) — spec stage 04, demo v808 ``View.pakkumus``.

State machine: draft → sent → (client_proposal → sent)* → accepted → converted; terminal rejected | expired | cancelled.
Every send freezes a document version (invariant 3); the client works through a share link (no account).
"""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents import render
from app.domain import document_versions, pricing, share_links
from app.domain import messages as messages_domain
from app.domain.account import effective_settings, get_account
from app.domain.assets import children_of, get_asset, spots_of_space
from app.domain.attachments import list_attachments
from app.domain.errors import Conflict, DomainError, NotFound
from app.domain.events import Actor, emit
from app.domain.notify import notify, notify_account_users
from app.domain.parties import get_party
from app.domain.search import index_entity, remove_entity
from app.domain.seed import DEFAULT_ACCOUNT_SETTINGS
from app.infra.blobstore import blobstore
from app.models.core import Attachment, Company, Notification, Party, User
from app.models.quotes import Quote, QuoteSpace, QuoteSpecialTerm
from app.models.registry import Asset

STATUSES = {"draft", "sent", "client_proposal", "accepted", "converted", "rejected", "expired", "cancelled"}
OPEN = {"draft", "sent", "client_proposal", "accepted"}
EDITABLE = {"draft", "client_proposal"}
TERMINAL = {"rejected", "expired", "cancelled", "converted"}
TRANSITIONS: dict[str, set[str]] = {
    "draft": {"sent", "cancelled"},
    "sent": {"client_proposal", "accepted", "rejected", "expired", "cancelled"},
    "client_proposal": {"sent", "accepted", "rejected", "expired", "cancelled"},
    "accepted": {"converted", "cancelled"},
}
LETTER_KINDS = {"quote.sent", "quote.resent", "quote.reply", "quote.reminder", "quote.letter_resent"}
_UNSET = object()


def quote_link(quote_id: uuid.UUID) -> str:
    return f"/app/portfell/pakkumine/{quote_id}"


def quote_settings(settings: dict[str, Any]) -> dict[str, Any]:
    return {**DEFAULT_ACCOUNT_SETTINGS["quote"], **(settings.get("quote") or {})}


async def account_settings(session: AsyncSession, account_id: uuid.UUID) -> dict[str, Any]:
    return effective_settings(await get_account(session, account_id))


# ---------------------------------------------------------------- reads --------------------------------------------


async def get_quote(session: AsyncSession, quote_id: uuid.UUID) -> Quote:
    q = await session.get(Quote, quote_id)
    if not q or q.deleted_at:
        raise NotFound("Pakkumist ei leitud")
    return q


async def list_quotes(session: AsyncSession, *, view: str = "open", status: str | None = None, q: str | None = None,
                      party_id: uuid.UUID | None = None, property_id: uuid.UUID | None = None, space_id: uuid.UUID | None = None) -> list[tuple[Quote, Party, Asset]]:
    stmt = (select(Quote, Party, Asset).join(Party, Party.id == Quote.party_id).join(Asset, Asset.id == Quote.property_id)
            .where(Quote.deleted_at.is_(None)))
    if view == "open":
        stmt = stmt.where(Quote.status.in_(OPEN))
    elif view == "closed":
        stmt = stmt.where(Quote.status.in_(TERMINAL))
    if status:
        stmt = stmt.where(Quote.status == status)
    if party_id:
        stmt = stmt.where(Quote.party_id == party_id)
    if property_id:
        stmt = stmt.where(Quote.property_id == property_id)
    if space_id:
        stmt = stmt.where(Quote.id.in_(select(QuoteSpace.quote_id).where(QuoteSpace.space_id == space_id)))
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(Quote.number.ilike(like) | Party.name.ilike(like) | Asset.name.ilike(like))
    stmt = stmt.order_by(Quote.created_at.desc())
    return [(x, p, a) for x, p, a in (await session.execute(stmt)).all()]


async def spaces_of(session: AsyncSession, quote_id: uuid.UUID) -> list[tuple[QuoteSpace, Asset]]:
    stmt = select(QuoteSpace, Asset).join(Asset, Asset.id == QuoteSpace.space_id).where(QuoteSpace.quote_id == quote_id).order_by(QuoteSpace.ordinal)
    return [(qs, a) for qs, a in (await session.execute(stmt)).all()]


async def terms_of(session: AsyncSession, quote_id: uuid.UUID) -> list[QuoteSpecialTerm]:
    return list((await session.execute(select(QuoteSpecialTerm).where(QuoteSpecialTerm.quote_id == quote_id).order_by(QuoteSpecialTerm.ordinal, QuoteSpecialTerm.id))).scalars())


async def open_quote_space_ids(session: AsyncSession, space_ids: list[uuid.UUID]) -> set[uuid.UUID]:
    """Spaces that sit in an open quote → status „pakkumisel” (registry projection)."""
    if not space_ids:
        return set()
    stmt = select(QuoteSpace.space_id).join(Quote, Quote.id == QuoteSpace.quote_id).where(QuoteSpace.space_id.in_(space_ids), Quote.deleted_at.is_(None), Quote.status.in_(OPEN))
    return set((await session.execute(stmt)).scalars())


# ---------------------------------------------------------------- pricing helpers ----------------------------------


def _attr(a: Asset, key: str, default: Any = None) -> Any:
    return (a.attributes or {}).get(key, default)


def _et(v: float | None, frac: int = 2) -> str:
    return render.fmt_num(v, frac)


def _nat(number: Any) -> tuple[int, str]:
    """Natural sort for spot numbers: 9 before 10, „P-2” after „P-1”."""
    m = re.search(r"(\d+)", str(number or ""))
    return (int(m.group(1)) if m else 10**9, str(number or ""))


async def _default_spots(session: AsyncSession, prop: Asset, space: Asset) -> list[str]:
    spots = [s for s in await spots_of_space(session, prop.id, space.id) if not _attr(s, "out_of_service")]
    return [str(s.id) for s in sorted(spots, key=lambda s: _nat(_attr(s, "number")))]


async def general_terms_cap(session: AsyncSession, prop: Asset) -> dict[str, Any]:
    """The electrical cap in the building's general terms (demo ``ULD_ELEKTER_MAX``: ÜT 4.4, 63 A). Fallback 63 A."""
    from app.domain.clauses import rendered_tree

    tid = _attr(prop, "template_id")
    if tid:
        try:
            for r in await rendered_tree(session, template_id=uuid.UUID(str(tid))):
                low = (r.text or "").lower()
                if "voolutugev" in low or "amper" in low or "elektrivõimsus" in low:
                    m = re.search(r"(\d{2,3})\s*a\b", low)
                    if m:
                        return {"amps": float(m.group(1)), "clause_id": r.id, "number": r.display_number}
        except Exception:  # noqa: BLE001 — a malformed template must never block a quote
            pass
    return {"amps": 63.0, "clause_id": None, "number": "4.4"}


def _schedule_text(schedule: list[dict[str, Any]]) -> str:
    parts, start = [], 1
    for st in schedule:
        if st["until_month"] is None:
            parts.append(f"alates {start}. kuust {_et(st['price'])} €/m²")
        else:
            parts.append(f"{start}.–{st['until_month']}. kuu {_et(st['price'])} €/m²")
            start = st["until_month"] + 1
    return ", ".join(parts)


# ---------------------------------------------------------------- bundle (read model) ------------------------------


async def quote_bundle(session: AsyncSession, q: Quote, *, with_versions: bool = True) -> dict[str, Any]:
    settings = await account_settings(session, q.account_id)
    party = await get_party(session, q.party_id)
    prop = await get_asset(session, q.property_id)
    company = await session.get(Company, q.company_id) if q.company_id else None
    rows = await spaces_of(session, q.id)
    has_register = _attr(prop, "has_parking") is not False and bool(await children_of(session, prop.id, "parking_spot"))
    spots = {s.id: s for s in await children_of(session, prop.id, "parking_spot")} if has_register else {}
    plans = await list_attachments(session, subject_type="asset", subject_ids=[a.id for _, a in rows] + [prop.id])
    floor_plans: dict[uuid.UUID, Attachment] = {}
    for att in plans:  # newest first → first wins
        if att.role == "floor_plan" and att.subject_id not in floor_plans:
            floor_plans[att.subject_id] = att
    prop_plans = {att.role: att for att in reversed([a for a in plans if a.subject_id == prop.id and a.role in ("parking_plan", "site_plan", "overview_plan")])}
    spaces, lines = [], []
    for qs, a in rows:
        area = float(_attr(a, "rentable_area_m2") or 0)
        list_price = _attr(a, "price_per_m2")
        price = float(qs.price_per_m2 if qs.price_per_m2 is not None else (list_price or 0))
        schedule = pricing.normalise_schedule(qs.schedule, price)
        line = pricing.space_line(area=area, price=price, schedule=schedule, period_months=q.period_months)
        lines.append(line)
        parking: dict[str, Any] = {"mode": "register" if has_register else "count", "spots": [], "count": None}
        if has_register:
            ids = [uuid.UUID(str(x)) for x in (qs.parking_spot_ids or [])]
            parking["spots"] = [{"id": s.id, "number": _attr(s, "number"), "zone": _attr(s, "zone"), "type": _attr(s, "type")} for s in (spots.get(i) for i in ids) if s]
            parking["count"] = len(parking["spots"])
        else:
            parking["count"] = qs.parking_count if qs.parking_count is not None else _attr(a, "parking_spots")
        parts = _attr(a, "parts") or {}
        fp = floor_plans.get(a.id)
        spaces.append({
            "id": qs.id, "space_id": a.id, "name": a.name, "type": _attr(a, "type"), "area_m2": area,
            "parts": " · ".join(f"{k} {_et(v, 1).rstrip('0').rstrip(',')} m²" for k, v in parts.items() if v) or None,
            "list_price": list_price, "price_per_m2": price, "price_override": qs.price_per_m2, "schedule": schedule,
            "parking": parking, "electrical_a": qs.electrical_a if qs.electrical_a is not None else _attr(a, "electrical_capacity_a"),
            "electrical_override": qs.electrical_a, "electrical_space": _attr(a, "electrical_capacity_a"),
            "floor_plan": {"id": fp.id, "filename": fp.filename} if fp else None, "line": line,
        })
    totals = pricing.quote_totals(lines, vat_taxable=bool(_attr(prop, "vat_taxable", True)), rate=pricing.vat_rate(settings),
                                  utility_winter=_attr(prop, "utility_cost_winter"), utility_summer=_attr(prop, "utility_cost_summer"))
    terms = [{"id": t.id, "text": t.text, "overrides": t.overrides, "overrides_label": t.overrides_label, "auto_kind": t.auto_kind, "space_id": t.space_id}
             for t in await terms_of(session, q.id)]
    attachments = _attachments(spaces, prop_plans, await list_attachments(session, subject_type="quote", subject_id=q.id))
    out: dict[str, Any] = {
        "quote": q, "party": party, "property": prop, "company": company, "spaces": spaces, "totals": totals, "special_terms": terms,
        "attachments": attachments, "settings": settings, "has_register": has_register,
        "register_spots": [{"id": s.id, "number": _attr(s, "number"), "zone": _attr(s, "zone"), "type": _attr(s, "type"), "space_id": _attr(s, "space_id"),
                            "out_of_service": bool(_attr(s, "out_of_service")), "reserve": bool(_attr(s, "reserve"))}
                           for s in sorted(spots.values(), key=lambda s: _nat(_attr(s, "number")))],
    }
    if with_versions:
        out["versions"] = await document_versions.list_versions(session, "quote", q.id)
        out["messages"] = await messages_domain.list_for(session, "quote", q.id)
        out["letters"] = await letters_of(session, q.id)
        out["link"] = await share_links.current_link(session, "quote", q.id)
        out["reminder"] = reminder_suggestion(out)
        out["next_step"] = next_step(out)
        out["pending_changes"] = pending_changes(out)
    return out


def _attachments(spaces: list[dict[str, Any]], prop_plans: dict[str, Attachment], uploaded: list[Attachment]) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    for s in spaces:
        if s["floor_plan"]:
            items.append({"number": 1, "title": f"Pinnaplaan — {s['name']}", "attachment_id": s["floor_plan"]["id"], "kind": "floor_plan", "space_id": s["space_id"]})
    n = 2
    for role, title in (("parking_plan", "Parkimisskeem"), ("site_plan", "Asendiplaan"), ("overview_plan", "Koondplaan")):
        att = prop_plans.get(role)
        if att:
            items.append({"number": n, "title": title, "attachment_id": att.id, "kind": role, "space_id": None})
            n += 1
    n = max(n, 3)
    for att in sorted(uploaded, key=lambda a: a.created_at):
        items.append({"number": n, "title": att.filename, "attachment_id": att.id, "kind": "upload", "space_id": None})
        n += 1
    return items


async def letters_of(session: AsyncSession, quote_id: uuid.UUID) -> list[Notification]:
    stmt = (select(Notification).where(Notification.subject_type == "quote", Notification.subject_id == quote_id, Notification.recipient_email.is_not(None))
            .order_by(Notification.created_at))
    return list((await session.execute(stmt)).scalars())


def snapshot(bundle: dict[str, Any]) -> dict[str, Any]:
    """What the client sees — frozen on every send; compared to detect pending changes (demo ``offerSnap``)."""
    q: Quote = bundle["quote"]
    return {
        "number": q.number, "period_months": q.period_months, "valid_until": q.valid_until.isoformat(), "contact": q.contact,
        "commercial": (q.commercial or {}).get("text") or "", "features": q.features or [],
        "spaces": [{"space_id": str(s["space_id"]), "name": s["name"], "area_m2": s["area_m2"], "price_per_m2": s["price_per_m2"], "schedule": s["schedule"],
                    "parking": [p["number"] for p in s["parking"]["spots"]] if s["parking"]["mode"] == "register" else s["parking"]["count"],
                    "electrical_a": s["electrical_a"], "line": s["line"]} for s in bundle["spaces"]],
        "totals": bundle["totals"],
        "special_terms": [{"text": t["text"], "overrides_label": t["overrides_label"], "auto_kind": t["auto_kind"]} for t in bundle["special_terms"]],
        "attachments": [{"number": a["number"], "title": a["title"]} for a in bundle["attachments"]],
        "party": {"id": str(bundle["party"].id), "name": bundle["party"].name}, "property": {"id": str(bundle["property"].id), "name": bundle["property"].name},
    }


def diff_snapshots(old: dict[str, Any], new: dict[str, Any]) -> list[dict[str, Any]]:
    """Field-level changes between two frozen versions (demo ``offerDiff``)."""
    out: list[dict[str, Any]] = []

    def add(key: str, label: str, before: Any, after: Any) -> None:
        if before != after:
            out.append({"key": key, "label": label, "before": before, "after": after})

    add("monthly_net", "Üür kuus (neto)", old["totals"].get("monthly_net"), new["totals"].get("monthly_net"))
    os_, ns_ = {s["space_id"]: s for s in old["spaces"]}, {s["space_id"]: s for s in new["spaces"]}
    for sid in ns_.keys() - os_.keys():
        out.append({"key": f"space:{sid}", "label": "Pind lisatud", "before": None, "after": ns_[sid]["name"]})
    for sid in os_.keys() - ns_.keys():
        out.append({"key": f"space:{sid}", "label": "Pind eemaldatud", "before": os_[sid]["name"], "after": None})
    for sid in os_.keys() & ns_.keys():
        o, n = os_[sid], ns_[sid]
        add(f"price:{sid}", f"{n['name']} · €/m²", o["price_per_m2"], n["price_per_m2"])
        add(f"schedule:{sid}", f"{n['name']} · astmeline üür", o.get("schedule"), n.get("schedule"))
        add(f"parking:{sid}", f"{n['name']} · parkimiskohad", o.get("parking"), n.get("parking"))
        add(f"electrical:{sid}", f"{n['name']} · elektrivõimsus", o.get("electrical_a"), n.get("electrical_a"))
    add("period_months", "Rendiperiood", old["period_months"], new["period_months"])
    add("valid_until", "Kehtib kuni", old["valid_until"], new["valid_until"])
    add("features", "Omadused", old.get("features"), new.get("features"))
    add("special_terms", "Eritingimused", [t["text"] for t in old["special_terms"] if not t.get("auto_kind")], [t["text"] for t in new["special_terms"] if not t.get("auto_kind")])
    add("attachments", "Lisad", [a["title"] for a in old["attachments"]], [a["title"] for a in new["attachments"]])
    add("commercial", "Pakkumise tekst", old.get("commercial"), new.get("commercial"))
    return out


def pending_changes(bundle: dict[str, Any]) -> list[dict[str, Any]]:
    versions = bundle.get("versions") or []
    if not versions:
        return []
    return diff_snapshots(versions[-1].snapshot, snapshot(bundle))


# ---------------------------------------------------------------- next step + reminders -----------------------------


def days_left(q: Quote, today: date | None = None) -> int:
    return (q.valid_until - (today or date.today())).days


def reminder_suggestion(bundle: dict[str, Any], today: date | None = None) -> dict[str, Any] | None:
    """Demo v5320: sent + (≤ 7 days left or ≥ N days of silence) → an editable reminder draft on the guide card."""
    q: Quote = bundle["quote"]
    today = today or date.today()
    if q.status != "sent" or (q.remind_snoozed_until and q.remind_snoozed_until >= today):
        return None
    qs = quote_settings(bundle["settings"])
    if q.reminded_at and (datetime.now(UTC) - q.reminded_at).days < qs["silence_days"]:
        return None  # just reminded — ask again only after another silence window
    last = max(x for x in [q.sent_at, q.last_client_at, q.reminded_at] if x) if any([q.sent_at, q.last_client_at, q.reminded_at]) else None
    silence = (datetime.now(UTC) - last).days if last else 0
    left = days_left(q, today)
    if left > 7 and silence < qs["silence_days"]:
        return None
    reason = "expiring" if left <= 7 else "silence"
    name = (q.contact or {}).get("name") or bundle["party"].name
    text = (f"Tere, {name}!\n\nTuletame meelde, et pakkumine {q.number} ({bundle['property'].name}) kehtib kuni {render.fmt_date(q.valid_until)}"
            f"{f' — veel {left} päeva' if left >= 0 else ''}. Vastake palun lingi kaudu või andke teada, kui soovite midagi arutada.\n\nLugupidamisega")
    return {"reason": reason, "days_left": left, "silence_days": silence, "text": text}


def delivery_state(bundle: dict[str, Any]) -> dict[str, Any] | None:
    letters: list[Notification] = bundle.get("letters") or []
    if not letters:
        return None
    last = letters[-1]
    return {"notification_id": last.id, "kind": last.kind, "status": last.email_status, "error": last.email_error, "to": last.recipient_email, "at": last.created_at}


def next_step(bundle: dict[str, Any], today: date | None = None) -> dict[str, Any] | None:
    """ONE next step per document (demo ``p7Samm``) — the guide card, the portfolio row and Avaleht read this."""
    q: Quote = bundle["quote"]
    today = today or date.today()
    left = days_left(q, today)
    delivery = delivery_state(bundle)
    if q.status == "draft":
        return {"side": "operator", "code": "send", "title": "Saada kliendile", "text": "Mustand on valmis — kinnita ja saada pakkumine kliendile.", "urgent": False}
    if q.status == "sent":
        if delivery and delivery["status"] == "bounced":
            return {"side": "operator", "code": "bounced", "title": "Kiri ei jõudnud kohale", "text": f"Aadress {delivery['to']} põrkas tagasi — paranda aadress ja saada uuesti.", "urgent": True}
        if bundle.get("reminder"):
            return {"side": "operator", "code": "remind", "title": "Meenuta kliendile", "text": f"Klient pole vastanud · kehtib veel {left} päeva.", "urgent": left <= 3}
        return {"side": "client", "code": "waiting", "title": "Ootab kliendi vastust", "text": f"Kehtib veel {left} päeva · kuni {render.fmt_date(q.valid_until)}.", "urgent": left <= 3}
    if q.status == "client_proposal":
        return {"side": "operator", "code": "answer", "title": "Vasta kliendi ettepanekule", "text": "Klient tegi muudatusettepaneku — muuda pakkumist või vasta ja saada uuesti.", "urgent": True}
    if q.status == "accepted":
        return {"side": "operator", "code": "convert", "title": "Koosta leping", "text": "Klient aktsepteeris pakkumise — koosta lepingu mustand(id).", "urgent": False}
    return None


# ---------------------------------------------------------------- commands -----------------------------------------


async def next_number(session: AsyncSession, prefix: str = "PAK") -> str:
    year = date.today().year
    rows = (await session.execute(select(Quote.number).where(Quote.number.like(f"{prefix}-{year}-%")))).scalars()
    n = max((int(r.rsplit("-", 1)[1]) for r in rows if r.rsplit("-", 1)[1].isdigit()), default=0) + 1
    return f"{prefix}-{year}-{n:03d}"


async def _check_space(session: AsyncSession, prop: Asset, space_id: uuid.UUID) -> Asset:
    from app.domain import registry

    a = await get_asset(session, space_id)
    if a.type_code != "space" or a.parent_id != prop.id:
        raise DomainError(f"„{a.name}” ei ole selle objekti üüripind")
    if registry.is_split_parent(a):
        raise DomainError(f"„{a.name}” on jagatud üksusteks — paku üksust")
    if registry.is_inactive(a):
        raise DomainError(f"„{a.name}” on mitteaktiivne üksus")
    return a


async def create_quote(session: AsyncSession, actor: Actor, *, party_id: uuid.UUID, property_id: uuid.UUID, space_ids: list[uuid.UUID],
                       company_id: uuid.UUID | None = None, period_months: int | None = None, validity_days: int | None = None,
                       contact: dict[str, Any] | None = None) -> Quote:
    if not space_ids:
        raise DomainError("Vali vähemalt üks pind")
    settings = await account_settings(session, actor.account_id)
    qs_defaults = quote_settings(settings)
    party = await get_party(session, party_id)
    prop = await get_asset(session, property_id)
    if prop.type_code != "property":
        raise DomainError("Pakkumine käib hoone pindade kohta")
    spaces = [await _check_space(session, prop, sid) for sid in dict.fromkeys(space_ids)]
    q = Quote(
        account_id=actor.account_id, number=await next_number(session), company_id=company_id or prop.company_id, property_id=prop.id, party_id=party.id,
        status="draft", valid_until=date.today() + timedelta(days=validity_days if validity_days is not None else qs_defaults["validity_days"]),
        period_months=period_months or qs_defaults["period_months"],
        contact=contact or {"name": party.contact_name or "", "email": party.email or "", "phone": party.phone or ""},
        commercial={"text": ""}, features=[], totals={}, created_by=actor.user_id,
    )
    session.add(q)
    await session.flush()
    has_register = _attr(prop, "has_parking") is not False and bool(await children_of(session, prop.id, "parking_spot"))
    for i, a in enumerate(spaces, start=1):
        row = QuoteSpace(account_id=actor.account_id, quote_id=q.id, space_id=a.id, ordinal=i)
        if has_register:
            row.parking_spot_ids = await _default_spots(session, prop, a)
        session.add(row)
    await session.flush()
    emit(session, actor, "quote", q.id, "quote.created",
         {"number": q.number, "party_id": party.id, "party_name": party.name, "property_id": prop.id, "property_name": prop.name,
          "spaces": [{"id": a.id, "name": a.name} for a in spaces], "valid_until": q.valid_until, "period_months": q.period_months})
    for a in spaces:
        emit(session, actor, "asset", a.id, "asset.quoted", {"quote_id": q.id, "quote_number": q.number})
    await refresh(session, actor, q)
    bundle = await quote_bundle(session, q, with_versions=False)
    q.commercial = {"text": await default_commercial_text(session, bundle)}
    return q


async def default_commercial_text(session: AsyncSession, bundle: dict[str, Any]) -> str:
    """The company's ``quote_base`` template merged with the quote's facts, or a built-in Estonian default."""
    from app.domain.templates import current_template

    q: Quote = bundle["quote"]
    tpl = await current_template(session, kind="quote_base", company_id=q.company_id)
    if not tpl:
        tpl = await current_template(session, kind="quote_base", company_id=None)
    text = (tpl.body or {}).get("text") if tpl else None
    if not text:
        text = ("Tere, {{kontakt.nimi}}!\n\nTäname huvi eest. Pakume Teile üürile pinna {{pind.nimi}} hoones {{objekt.nimi}}, {{objekt.aadress}}.\n\n"
                "Üüripind {{pind.yyripind}} m² · üür {{hind}} €/m² kuus ({{yyr_kuus}} € kuus + km) · kõrvalkulud talvel {{korvalkulu_talv}} €/m², suvel {{korvalkulu_suvi}} €/m².\n"
                "Parkimiskohad: {{parkimiskohad}}. Elektrivõimsus: {{elekter}} A.\n\n"
                "Pakkumine kehtib kuni {{kehtib_kuni}}. Pakkumise aktsepteerimisel koostame üürilepingu, mille üldtingimused on Teile lingilt tutvumiseks avatud.")
    return merge_fields(text, await merge_context(session, bundle))


async def merge_context(session: AsyncSession, bundle: dict[str, Any]) -> dict[str, str]:
    q: Quote = bundle["quote"]
    prop: Asset = bundle["property"]
    sp = bundle["spaces"]
    totals = bundle["totals"]
    parking = ", ".join(p["number"] for s in sp for p in s["parking"]["spots"]) or str(sum(s["parking"]["count"] or 0 for s in sp) or "—")
    sender = await session.get(User, q.created_by) if q.created_by else None
    company: Company | None = bundle["company"]
    return {
        "kontakt.nimi": (q.contact or {}).get("name") or bundle["party"].name, "klient.nimi": bundle["party"].name,
        "pind.nimi": ", ".join(s["name"] for s in sp), "objekt.nimi": prop.name, "objekt.aadress": _attr(prop, "address") or "",
        "pind.yyripind": _et(totals["area_m2"], 1).rstrip("0").rstrip(","), "hind": _et(totals["avg_price_per_m2"]), "yyr_kuus": _et(totals["monthly_net"]),
        "korvalkulu_talv": _et(_attr(prop, "utility_cost_winter")) if _attr(prop, "utility_cost_winter") is not None else "—",
        "korvalkulu_suvi": _et(_attr(prop, "utility_cost_summer")) if _attr(prop, "utility_cost_summer") is not None else "—",
        "parkimiskohad": parking, "elekter": ", ".join(_et(s["electrical_a"], 0) for s in sp if s["electrical_a"]) or "—",
        "kehtib_kuni": render.fmt_date(q.valid_until), "rendiperiood": str(q.period_months), "saatja.nimi": sender.name if sender else (company.name if company else ""),
        "ettevote.nimi": company.name if company else "", "pakkumine.nr": q.number,
    }


def merge_fields(text: str, ctx: dict[str, str]) -> str:
    return re.sub(r"\{\{\s*([\w.]+)\s*\}\}", lambda m: ctx.get(m.group(1), ""), text)


async def refresh(session: AsyncSession, actor: Actor, q: Quote) -> dict[str, Any]:
    """Recompute totals and the generated special terms after any change; returns the bundle."""
    bundle = await quote_bundle(session, q, with_versions=False)
    q.totals = bundle["totals"]
    await _sync_auto_terms(session, actor, q, bundle)
    bundle["special_terms"] = [{"id": t.id, "text": t.text, "overrides": t.overrides, "overrides_label": t.overrides_label, "auto_kind": t.auto_kind, "space_id": t.space_id}
                               for t in await terms_of(session, q.id)]
    await _index(session, q, bundle)
    return bundle


async def _sync_auto_terms(session: AsyncSession, actor: Actor, q: Quote, bundle: dict[str, Any]) -> None:
    cap = await general_terms_cap(session, bundle["property"])
    wanted: dict[tuple[str, uuid.UUID], dict[str, Any]] = {}
    for s in bundle["spaces"]:
        if s["schedule"]:
            wanted[("stepped_rent", s["space_id"])] = {
                "text": f"Üüripinna {s['name']} üür on astmeline: {_schedule_text(s['schedule'])} (erandina põhitingimuste üüri punktist).",
                "overrides": "main:rent", "overrides_label": "Põhi · Üür (p 3.1)"}
        if s["electrical_a"] and float(s["electrical_a"]) > cap["amps"]:
            ref = f"general:{cap['clause_id']}" if cap["clause_id"] else f"general:{cap['number']}"
            wanted[("electricity", s["space_id"])] = {
                "text": f"Erandina üldtingimuste punktist {cap['number']} on üüripinna {s['name']} elektrivõimsus {_et(s['electrical_a'], 0)} A.",
                "overrides": ref, "overrides_label": f"Üld · p {cap['number']}"}
    existing = {(t.auto_kind, t.space_id): t for t in await terms_of(session, q.id) if t.auto_kind}
    changed = False
    for key, t in existing.items():
        if key not in wanted:
            await session.delete(t)
            changed = True
    max_ord = max((t.ordinal for t in await terms_of(session, q.id)), default=0)
    for key, spec in wanted.items():
        t = existing.get(key)
        if t:
            if (t.text, t.overrides, t.overrides_label) != (spec["text"], spec["overrides"], spec["overrides_label"]):
                t.text, t.overrides, t.overrides_label = spec["text"], spec["overrides"], spec["overrides_label"]
                changed = True
        else:
            max_ord += 1
            session.add(QuoteSpecialTerm(account_id=actor.account_id, quote_id=q.id, ordinal=max_ord, text=spec["text"], overrides=spec["overrides"],
                                         overrides_label=spec["overrides_label"], auto_kind=key[0], space_id=key[1]))
            changed = True
    if changed:
        await session.flush()
        emit(session, actor, "quote", q.id, "quote.auto_terms_synced", {"terms": [{"kind": k[0], "space_id": k[1], "text": v["text"]} for k, v in wanted.items()]})


async def _index(session: AsyncSession, q: Quote, bundle: dict[str, Any]) -> None:
    party, prop = bundle["party"], bundle["property"]
    title = f"{q.number} · {party.name}"
    text = " ".join([q.number, party.name, prop.name, *(s["name"] for s in bundle["spaces"]), (q.commercial or {}).get("text") or ""])
    await index_entity(session, q.account_id, "quote", q.id, title, text, quote_link(q.id), subtitle=f"{prop.name} · {q.status}")


def _editable(q: Quote) -> None:
    if q.status not in EDITABLE:
        raise DomainError("Pakkumist saab muuta ainult mustandina või kliendi ettepaneku ajal", code="not_editable")


def _lock(q: Quote, expected_version: int | None) -> None:
    if expected_version is not None and q.version != expected_version:
        raise Conflict()


def _bump(session: AsyncSession, actor: Actor, q: Quote, action: str, payload: dict[str, Any]) -> None:
    q.version += 1
    emit(session, actor, "quote", q.id, action, payload)


async def update_quote(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, *, expected_version: int | None = None, period_months: int | None = None,
                       valid_until: date | None = None, contact: dict[str, Any] | None = None, commercial_text: str | None = None,
                       features: list[dict[str, Any]] | None = None, company_id: uuid.UUID | None = None) -> Quote:
    q = await get_quote(session, quote_id)
    _editable(q)
    _lock(q, expected_version)
    changes: dict[str, Any] = {}
    if period_months is not None and period_months != q.period_months:
        if period_months < 1 or period_months > 600:
            raise DomainError("Rendiperiood peab olema 1–600 kuud")
        changes["period_months"] = [q.period_months, period_months]
        q.period_months = period_months
    if valid_until is not None and valid_until != q.valid_until:
        if valid_until < date.today():
            raise DomainError("Kehtivuse lõpp ei saa olla minevikus")
        changes["valid_until"] = [q.valid_until, valid_until]
        q.valid_until = valid_until
    if contact is not None:
        if q.status != "draft" and contact != q.contact:
            raise DomainError("Kontaktisikut saab muuta ainult mustandis")
        new = {"name": (contact.get("name") or "").strip(), "email": (contact.get("email") or "").strip(), "phone": (contact.get("phone") or "").strip()}
        if new != q.contact:
            changes["contact"] = [q.contact, new]
            q.contact = new
    if commercial_text is not None and commercial_text != (q.commercial or {}).get("text"):
        changes["commercial"] = [(q.commercial or {}).get("text"), commercial_text]
        q.commercial = {"text": commercial_text}
    if features is not None:
        clean = [{"label": str(f.get("label", "")).strip(), "value": str(f.get("value", "")).strip()} for f in features if str(f.get("label", "")).strip()]
        if clean != q.features:
            changes["features"] = [q.features, clean]
            q.features = clean
    if company_id is not None and company_id != q.company_id:
        changes["company_id"] = [q.company_id, company_id]
        q.company_id = company_id
    if changes:
        _bump(session, actor, q, "quote.updated", changes)
        await refresh(session, actor, q)
    return q


async def add_space(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, space_id: uuid.UUID, *, expected_version: int | None = None) -> Quote:
    q = await get_quote(session, quote_id)
    _editable(q)
    _lock(q, expected_version)
    prop = await get_asset(session, q.property_id)
    a = await _check_space(session, prop, space_id)
    if any(qs.space_id == a.id for qs, _ in await spaces_of(session, q.id)):
        raise DomainError(f"„{a.name}” on juba pakkumises")
    ordinal = max((qs.ordinal for qs, _ in await spaces_of(session, q.id)), default=0) + 1
    row = QuoteSpace(account_id=actor.account_id, quote_id=q.id, space_id=a.id, ordinal=ordinal)
    if _attr(prop, "has_parking") is not False and await children_of(session, prop.id, "parking_spot"):
        row.parking_spot_ids = await _default_spots(session, prop, a)
    session.add(row)
    await session.flush()
    _bump(session, actor, q, "quote.space_added", {"space_id": a.id, "space_name": a.name})
    emit(session, actor, "asset", a.id, "asset.quoted", {"quote_id": q.id, "quote_number": q.number})
    await refresh(session, actor, q)
    return q


async def remove_space(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, space_id: uuid.UUID, *, expected_version: int | None = None) -> Quote:
    q = await get_quote(session, quote_id)
    _editable(q)
    _lock(q, expected_version)
    rows = await spaces_of(session, q.id)
    if len(rows) <= 1:
        raise DomainError("Pakkumises peab olema vähemalt üks pind")
    row = next(((qs, a) for qs, a in rows if qs.space_id == space_id), None)
    if not row:
        raise NotFound("Pinda pole pakkumises")
    qs, a = row
    await session.delete(qs)
    for t in await terms_of(session, q.id):
        if t.auto_kind and t.space_id == a.id:
            await session.delete(t)
    await session.flush()
    _bump(session, actor, q, "quote.space_removed", {"space_id": a.id, "space_name": a.name})
    await refresh(session, actor, q)
    return q


async def update_space(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, space_id: uuid.UUID, *, expected_version: int | None = None,
                       price_per_m2: Any = _UNSET, schedule: Any = _UNSET, parking_spot_ids: Any = _UNSET, parking_count: Any = _UNSET,
                       electrical_a: Any = _UNSET) -> Quote:
    q = await get_quote(session, quote_id)
    _editable(q)
    _lock(q, expected_version)
    row = next(((qs, a) for qs, a in await spaces_of(session, q.id) if qs.space_id == space_id), None)
    if not row:
        raise NotFound("Pinda pole pakkumises")
    qs, a = row
    changes: dict[str, Any] = {}
    if price_per_m2 is not _UNSET:
        v = None if price_per_m2 is None else float(price_per_m2)
        if v is not None and v < 0:
            raise DomainError("Hind ei saa olla negatiivne")
        if v is not None and _attr(a, "price_per_m2") is not None and abs(v - float(_attr(a, "price_per_m2"))) < 1e-9:
            v = None  # equal to the list price → no override (demo)
        if v != qs.price_per_m2:
            changes["price_per_m2"] = [qs.price_per_m2, v]
            qs.price_per_m2 = v
    if schedule is not _UNSET:
        base = qs.price_per_m2 if qs.price_per_m2 is not None else _attr(a, "price_per_m2")
        norm = pricing.normalise_schedule(schedule, base)
        if norm != qs.schedule:
            changes["schedule"] = [qs.schedule, norm]
            qs.schedule = norm
    if parking_spot_ids is not _UNSET:
        prop = await get_asset(session, q.property_id)
        spots = {str(s.id): s for s in await children_of(session, prop.id, "parking_spot")}
        ids = []
        for x in parking_spot_ids or []:
            s = spots.get(str(x))
            if not s:
                raise DomainError("Parkimiskoht ei kuulu sellele hoonele")
            if _attr(s, "out_of_service"):
                raise DomainError(f"Koht {_attr(s, 'number')} on kasutusest väljas")
            ids.append(str(s.id))
        if ids != (qs.parking_spot_ids or []):
            changes["parking_spots"] = [[_attr(spots[i], "number") for i in (qs.parking_spot_ids or []) if i in spots], [_attr(spots[i], "number") for i in ids]]
            qs.parking_spot_ids = ids
    if parking_count is not _UNSET:
        v = None if parking_count is None else int(parking_count)
        if v is not None and v < 0:
            raise DomainError("Parkimiskohtade arv ei saa olla negatiivne")
        if v != qs.parking_count:
            changes["parking_count"] = [qs.parking_count, v]
            qs.parking_count = v
    if electrical_a is not _UNSET:
        v = None if electrical_a is None else float(electrical_a)
        if v is not None and v < 0:
            raise DomainError("Elektrivõimsus ei saa olla negatiivne")
        if v is not None and _attr(a, "electrical_capacity_a") is not None and abs(v - float(_attr(a, "electrical_capacity_a"))) < 1e-9:
            v = None
        if v != qs.electrical_a:
            changes["electrical_a"] = [qs.electrical_a, v]
            qs.electrical_a = v
    if changes:
        _bump(session, actor, q, "quote.space_updated", {"space_id": a.id, "space_name": a.name, **changes})
        await refresh(session, actor, q)
    return q


async def add_special_term(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, text: str, *, expected_version: int | None = None) -> QuoteSpecialTerm:
    q = await get_quote(session, quote_id)
    _editable(q)
    _lock(q, expected_version)
    text = (text or "").strip()
    if not text:
        raise DomainError("Eritingimuse tekst on kohustuslik")
    ordinal = max((t.ordinal for t in await terms_of(session, q.id)), default=0) + 1
    t = QuoteSpecialTerm(account_id=actor.account_id, quote_id=q.id, ordinal=ordinal, text=text)
    session.add(t)
    await session.flush()
    _bump(session, actor, q, "quote.term_added", {"term_id": t.id, "text": text})
    await refresh(session, actor, q)
    return t


async def update_special_term(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, term_id: uuid.UUID, text: str, *, expected_version: int | None = None) -> QuoteSpecialTerm:
    q = await get_quote(session, quote_id)
    _editable(q)
    _lock(q, expected_version)
    t = await session.get(QuoteSpecialTerm, term_id)
    if not t or t.quote_id != q.id:
        raise NotFound("Eritingimust ei leitud")
    if t.auto_kind:
        raise DomainError("Automaatset eritingimust ei muudeta käsitsi — muuda hinda või elektrivõimsust")
    text = (text or "").strip()
    if not text:
        raise DomainError("Eritingimuse tekst on kohustuslik")
    if text != t.text:
        _bump(session, actor, q, "quote.term_updated", {"term_id": t.id, "before": t.text, "after": text})
        t.text = text
        await refresh(session, actor, q)
    return t


async def remove_special_term(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, term_id: uuid.UUID, *, expected_version: int | None = None) -> None:
    q = await get_quote(session, quote_id)
    _editable(q)
    _lock(q, expected_version)
    t = await session.get(QuoteSpecialTerm, term_id)
    if not t or t.quote_id != q.id:
        raise NotFound("Eritingimust ei leitud")
    if t.auto_kind:
        raise DomainError("Automaatset eritingimust ei eemaldata käsitsi — muuda hinda või elektrivõimsust")
    await session.delete(t)
    await session.flush()
    _bump(session, actor, q, "quote.term_removed", {"term_id": t.id, "text": t.text})
    await refresh(session, actor, q)


# ---------------------------------------------------------------- rendering ----------------------------------------


async def document_html(session: AsyncSession, bundle: dict[str, Any], *, version: int | None = None, snapshot_data: dict[str, Any] | None = None) -> str:
    """The quote sheet (demo ``offerSheetHTML``) — same HTML for the PDF, the operator preview and the portal."""
    q: Quote = bundle["quote"]
    company: Company | None = bundle["company"]
    logo = None
    if company and company.logo_attachment_id:
        att = await session.get(Attachment, company.logo_attachment_id)
        if att:
            try:
                import base64

                logo = f"data:{att.content_type};base64,{base64.b64encode(await blobstore().get(att.s3_key)).decode()}"
            except Exception:  # noqa: BLE001
                logo = None
    sender = await session.get(User, q.created_by) if q.created_by else None
    return render.render_html(
        "quote.html", title=f"Pakkumine {q.number}", footer=f"{company.name if company else ''} · Pakkumine {q.number}", accent=company.accent_color if company else None,
        q=q, party=bundle["party"], property=bundle["property"], company=company, spaces=bundle["spaces"], totals=bundle["totals"],
        special_terms=bundle["special_terms"], attachments=bundle["attachments"], logo_data_uri=logo, sender_name=sender.name if sender else None,
        version=version,
    )


# ---------------------------------------------------------------- lifecycle ----------------------------------------


def _transition(session: AsyncSession, actor: Actor, q: Quote, to: str, payload: dict[str, Any] | None = None, reason: str | None = None) -> None:
    allowed = TRANSITIONS.get(q.status, set())
    if to not in allowed:
        raise DomainError(f"Pakkumist olekus {q.status} ei saa viia olekusse {to}", code="invalid_transition")
    frm = q.status
    q.status = to
    q.version += 1
    if to in TERMINAL:
        q.closed_at = datetime.now(UTC)
        q.close_reason = reason
    emit(session, actor, "quote", q.id, f"quote.{to}", {"from": frm, **(payload or {})}, reason=reason)


async def _sender_name(session: AsyncSession, actor: Actor, bundle: dict[str, Any]) -> str:
    u = await session.get(User, actor.user_id) if actor.user_id else None
    return u.name if u else (bundle["company"].name if bundle["company"] else "")


def _valid_email(email: str | None) -> str:
    email = (email or "").strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise DomainError("Kontakti e-posti aadress on puudu või vigane — lisa see kliendi blokis", code="no_email")
    return email


async def letter(session: AsyncSession, actor: Actor, bundle: dict[str, Any], *, kind: str, message: str | None, version: int | None) -> tuple[str, str]:
    q: Quote = bundle["quote"]
    name = (q.contact or {}).get("name") or bundle["party"].name
    prop = bundle["property"].name
    spaces = ", ".join(s["name"] for s in bundle["spaces"])
    sender = await _sender_name(session, actor, bundle)
    until = render.fmt_date(q.valid_until)
    sig = f"\n\nLugupidamisega\n{sender}" + (f"\n{bundle['company'].name}" if bundle["company"] else "")
    if kind == "quote.sent":
        return (f"Pakkumine {q.number} — {prop}, {spaces}",
                f"Tere, {name}!\n\nSaatsime Teile pakkumise {q.number} ({prop}, {spaces}). Pakkumine kehtib kuni {until}.\n"
                f"Vaadake pakkumist ja vastake lingi kaudu — kontot pole vaja luua." + (f"\n\n{message}" if message else "") + sig)
    if kind == "quote.resent":
        return (f"Uuendatud pakkumine {q.number} (V{version}) — {prop}",
                f"Tere, {name}!\n\nUuendasime pakkumist {q.number} Teie ettepaneku põhjal (versioon V{version})." + (f"\n\n{message}" if message else "") +
                f"\n\nPakkumine kehtib kuni {until}. Vaadake muudatusi ja vastake lingi kaudu." + sig)
    if kind == "quote.reply":
        return (f"Vastus Teie ettepanekule — pakkumine {q.number}",
                f"Tere, {name}!\n\n{message}\n\nPakkumine {q.number} kehtib kuni {until}. Vastake palun lingi kaudu." + sig)
    if kind == "quote.reminder":
        return (f"Meeldetuletus: pakkumine {q.number} kehtib kuni {until}", (message or "") + sig)
    raise DomainError(f"Tundmatu kirja liik: {kind}")


async def send(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, *, message: str | None = None, expected_version: int | None = None) -> dict[str, Any]:
    """Draft → sent (V1) or client_proposal → sent (new version only when something changed; reply-only keeps the version)."""
    q = await get_quote(session, quote_id)
    if q.status not in ("draft", "client_proposal"):
        raise DomainError("Saata saab mustandit või vastust kliendi ettepanekule", code="invalid_transition")
    _lock(q, expected_version)
    if q.valid_until < date.today():
        raise DomainError("Kehtivuse lõpp on minevikus — pikenda kehtivust enne saatmist")
    message = (message or "").strip() or None
    bundle = await refresh(session, actor, q)
    bundle["versions"] = await document_versions.list_versions(session, "quote", q.id)
    email = _valid_email((q.contact or {}).get("email"))
    snap = snapshot(bundle)
    last = bundle["versions"][-1] if bundle["versions"] else None
    changed = last is None or document_versions.digest(snap) != last.snapshot_sha256
    if q.status == "client_proposal" and not changed and not message:
        raise DomainError("Pakkumine ei ole muutunud — lisa vastus või muuda pakkumist", code="unchanged")
    version_no = last.number if last else 0
    if changed:
        v = await document_versions.freeze(session, actor, subject_type="quote", subject_id=q.id, snapshot=snap, note=message,
                                           html=await document_html(session, bundle, version=version_no + 1))
        version_no = v.number
        q.sent_version = v.number
    kind = "quote.sent" if last is None else ("quote.resent" if changed else "quote.reply")
    link = await share_links.ensure_link(session, actor, subject_type="quote", subject_id=q.id, email=email, party_id=q.party_id,
                                         expires_at=share_links.expiry_for_quote(q.valid_until))
    subject, body = await letter(session, actor, bundle, kind=kind, message=message, version=version_no)
    await notify(session, actor, kind=kind, title=subject, body=body, link=share_links.portal_path(share_links.token_for(link)),
                 recipient_email=email, subject_type="quote", subject_id=q.id)
    sender = await _sender_name(session, actor, bundle)
    if message or kind == "quote.resent":
        await messages_domain.post(session, actor, subject_type="quote", subject_id=q.id, channel="negotiation", author_type="operator", author_name=sender,
                                   body=message or f"Saatsin uuendatud pakkumise (V{version_no}).", meta={"version": version_no, "kind": kind.split(".")[1]})
    first = q.sent_at is None
    _transition(session, actor, q, "sent", {"version": version_no, "kind": kind, "email": email, "changed": changed})
    if first:
        q.sent_at = datetime.now(UTC)
    q.remind_snoozed_until = None
    await _index(session, q, bundle)
    return {"quote": q, "version": version_no, "kind": kind, "link": link}


async def cancel(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, reason: str | None = None) -> Quote:
    q = await get_quote(session, quote_id)
    _transition(session, actor, q, "cancelled", reason=reason)
    link = await share_links.current_link(session, "quote", q.id)
    if link:
        await share_links.revoke(session, actor, link, "cancelled")
    await _index(session, q, await quote_bundle(session, q, with_versions=False))
    return q


async def expire_due(session: AsyncSession, actor: Actor, today: date | None = None) -> int:
    """Daily cron: sent/client_proposal quotes past their validity → expired (the demo only displayed it)."""
    today = today or date.today()
    rows = list((await session.execute(select(Quote).where(Quote.deleted_at.is_(None), Quote.status.in_(["sent", "client_proposal"]), Quote.valid_until < today))).scalars())
    for q in rows:
        _transition(session, actor, q, "expired", {"valid_until": q.valid_until}, reason="kehtivusaeg möödus")
        await notify_account_users(session, actor, kind="quote.expired", title=f"Pakkumine {q.number} aegus", body=f"Kehtivus lõppes {render.fmt_date(q.valid_until)} — klient ei vastanud.",
                                   link=quote_link(q.id), subject_type="quote", subject_id=q.id)
        await _index(session, q, await quote_bundle(session, q, with_versions=False))
    return len(rows)


async def expire_due_all() -> None:
    from sqlalchemy import text

    from app.infra.db import sessionmaker, tenant_session
    from app.models.core import Account

    async with sessionmaker()() as s0:
        async with s0.begin():
            await s0.execute(text("SELECT set_config('app.bypass_rls', 'on', true)"))
            ids = [a.id for a in (await s0.execute(select(Account))).scalars()]
    for aid in ids:
        async with tenant_session(aid) as session:
            await expire_due(session, Actor.system(aid))


async def remind(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, text: str | None = None) -> Notification:
    q = await get_quote(session, quote_id)
    if q.status != "sent":
        raise DomainError("Meeldetuletust saab saata saadetud pakkumisele")
    bundle = await quote_bundle(session, q)
    email = _valid_email((q.contact or {}).get("email"))
    suggestion = reminder_suggestion(bundle) or {"text": ""}
    body_text = (text or "").strip() or suggestion["text"]
    link = await share_links.ensure_link(session, actor, subject_type="quote", subject_id=q.id, email=email, party_id=q.party_id,
                                         expires_at=share_links.expiry_for_quote(q.valid_until))
    subject, body = await letter(session, actor, bundle, kind="quote.reminder", message=body_text, version=None)
    rows = await notify(session, actor, kind="quote.reminder", title=subject, body=body, link=share_links.portal_path(share_links.token_for(link)),
                        recipient_email=email, subject_type="quote", subject_id=q.id)
    q.reminded_at = datetime.now(UTC)
    q.remind_snoozed_until = None
    emit(session, actor, "quote", q.id, "quote.reminded", {"email": email})
    return rows[0]


async def snooze(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, days: int = 3) -> Quote:
    q = await get_quote(session, quote_id)
    q.remind_snoozed_until = date.today() + timedelta(days=max(1, days))
    emit(session, actor, "quote", q.id, "quote.reminder_snoozed", {"until": q.remind_snoozed_until})
    return q


async def resend_letter(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, *, email: str | None = None) -> Notification:
    """After a bounce: fix the address (optional) and send the last letter again (demo ``p4Uuesti``)."""
    q = await get_quote(session, quote_id)
    if q.status not in ("sent", "client_proposal", "accepted"):
        raise DomainError("Kirja saab uuesti saata saadetud pakkumisel")
    letters = await letters_of(session, q.id)
    if not letters:
        raise DomainError("Pakkumisel pole veel ühtegi kirja")
    last = letters[-1]
    if email:
        email = _valid_email(email)
        if email != (q.contact or {}).get("email"):
            emit(session, actor, "quote", q.id, "quote.updated", {"contact.email": [(q.contact or {}).get("email"), email]})
            q.contact = {**(q.contact or {}), "email": email}
    email = _valid_email((q.contact or {}).get("email"))
    link = await share_links.ensure_link(session, actor, subject_type="quote", subject_id=q.id, email=email, party_id=q.party_id,
                                         expires_at=share_links.expiry_for_quote(q.valid_until))
    rows = await notify(session, actor, kind=last.kind, title=last.title, body=last.body, link=share_links.portal_path(share_links.token_for(link)),
                        recipient_email=email, subject_type="quote", subject_id=q.id)
    emit(session, actor, "quote", q.id, "quote.letter_resent", {"email": email, "kind": last.kind, "previous": last.id})
    return rows[0]


async def post_operator_message(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, body: str, *, channel: str = "chat") -> Any:
    q = await get_quote(session, quote_id)
    bundle = await quote_bundle(session, q, with_versions=False)
    sender = await _sender_name(session, actor, bundle)
    m = await messages_domain.post(session, actor, subject_type="quote", subject_id=q.id, channel=channel, author_type="operator", author_name=sender, body=body)
    link = await share_links.current_link(session, "quote", q.id)
    email = (q.contact or {}).get("email")
    if link and email and q.status in ("sent", "client_proposal", "accepted"):
        await notify(session, actor, kind="quote.message", title=f"Uus sõnum pakkumise {q.number} kohta", body=f"{sender}:\n\n{body}",
                     link=share_links.portal_path(share_links.token_for(link)), recipient_email=email, subject_type="quote", subject_id=q.id)
    return m


# ---------------------------------------------------------------- client side (share link) ---------------------------


def _client_name(q: Quote, party: Party) -> str:
    return (q.contact or {}).get("name") or party.name


async def _operators_notice(session: AsyncSession, actor: Actor, q: Quote, kind: str, title: str, body: str | None) -> None:
    await notify_account_users(session, actor, kind=kind, title=title, body=body, link=quote_link(q.id), subject_type="quote", subject_id=q.id)


async def _ensure_open_for_client(session: AsyncSession, actor: Actor, q: Quote) -> None:
    if q.status in ("sent", "client_proposal") and q.valid_until < date.today():
        _transition(session, actor, q, "expired", {"valid_until": q.valid_until}, reason="kehtivusaeg möödus")
        raise DomainError("Pakkumine on aegunud", code="expired")
    if q.status not in ("sent", "client_proposal"):
        raise DomainError("Pakkumine ei ole enam vastamiseks avatud", code="closed")


async def client_propose(session: AsyncSession, actor: Actor, q: Quote, text: str) -> Any:
    await _ensure_open_for_client(session, actor, q)
    text = (text or "").strip()
    if not text:
        raise DomainError("Kirjuta ettepanek")
    party = await get_party(session, q.party_id)
    m = await messages_domain.post(session, actor, subject_type="quote", subject_id=q.id, channel="negotiation", author_type="client",
                                   author_name=_client_name(q, party), body=text, meta={"kind": "proposal", "version": q.sent_version})
    q.last_client_at = datetime.now(UTC)
    if q.status == "sent":
        _transition(session, actor, q, "client_proposal", {"excerpt": text[:200]})
    else:
        emit(session, actor, "quote", q.id, "quote.proposal_extended", {"excerpt": text[:200]})
    await _operators_notice(session, actor, q, "quote.client_proposal", f"{party.name} tegi ettepaneku pakkumisele {q.number}", text[:500])
    await _index(session, q, await quote_bundle(session, q, with_versions=False))
    return m


async def client_message(session: AsyncSession, actor: Actor, q: Quote, text: str) -> Any:
    text = (text or "").strip()
    if not text:
        raise DomainError("Kirjuta sõnum")
    if q.status in TERMINAL:
        raise DomainError("Pakkumine on suletud", code="closed")
    party = await get_party(session, q.party_id)
    m = await messages_domain.post(session, actor, subject_type="quote", subject_id=q.id, channel="chat", author_type="client", author_name=_client_name(q, party), body=text)
    q.last_client_at = datetime.now(UTC)
    await _operators_notice(session, actor, q, "quote.client_message", f"{party.name} kirjutas pakkumise {q.number} kohta", text[:500])
    return m


async def client_accept(session: AsyncSession, actor: Actor, q: Quote) -> Quote:
    await _ensure_open_for_client(session, actor, q)
    party = await get_party(session, q.party_id)
    q.accepted_at = datetime.now(UTC)
    q.last_client_at = q.accepted_at
    _transition(session, actor, q, "accepted", {"version": q.sent_version})
    await messages_domain.post(session, actor, subject_type="quote", subject_id=q.id, channel="negotiation", author_type="client", author_name=_client_name(q, party),
                               body=f"Aktsepteerin pakkumise (V{q.sent_version}).", meta={"kind": "accept", "version": q.sent_version})
    await _operators_notice(session, actor, q, "quote.accepted", f"{party.name} aktsepteeris pakkumise {q.number}", "Koosta lepingu mustand(id).")
    await _index(session, q, await quote_bundle(session, q, with_versions=False))
    return q


async def client_reject(session: AsyncSession, actor: Actor, q: Quote, reason: str | None = None) -> Quote:
    await _ensure_open_for_client(session, actor, q)
    party = await get_party(session, q.party_id)
    q.last_client_at = datetime.now(UTC)
    _transition(session, actor, q, "rejected", {"version": q.sent_version}, reason=(reason or "").strip() or None)
    await messages_domain.post(session, actor, subject_type="quote", subject_id=q.id, channel="negotiation", author_type="client", author_name=_client_name(q, party),
                               body=f"Lükkan pakkumise tagasi.{(' ' + reason.strip()) if reason and reason.strip() else ''}", meta={"kind": "reject", "version": q.sent_version})
    link = await share_links.current_link(session, "quote", q.id)
    if link:
        await share_links.revoke(session, actor, link, "rejected")
    await _operators_notice(session, actor, q, "quote.rejected", f"{party.name} lükkas pakkumise {q.number} tagasi", (reason or "").strip() or None)
    await _index(session, q, await quote_bundle(session, q, with_versions=False))
    return q


async def soft_delete(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, reason: str | None = None) -> None:
    q = await get_quote(session, quote_id)
    if q.status != "draft":
        raise DomainError("Kustutada saab ainult mustandit — saadetud pakkumine tühistatakse")
    q.deleted_at = datetime.now(UTC)
    await remove_entity(session, "quote", q.id)
    emit(session, actor, "quote", q.id, "quote.deleted", reason=reason)
