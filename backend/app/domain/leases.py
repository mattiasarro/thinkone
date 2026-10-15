"""Lease drafts (üürilepingu mustand) — spec stage 05, demo ``createLease`` / ``pohiTehing`` / ``buildPunktid``.

A platform-born lease is three clause containers: ``main`` (põhitingimused, generated from the deal ``terms``),
``general`` (üldtingimused, snapshotted from the building's template, locked) and ``annex:3`` (eritingimused,
overriding clauses by id). Facts are versioned rows (invariant 2); the document is a projection.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents import render
from app.domain import contract_parties, pricing
from app.domain import quotes as quotes_domain
from app.domain.account import effective_settings, get_account
from app.domain.assets import allocate, children_of, get_asset, list_allocations
from app.domain.attachments import list_attachments
from app.domain.clauses import Node, RenderedClause, load_rows, write_tree
from app.domain.clauses import render as render_tree
from app.domain.contracts import create_contract, get_contract, index_contract
from app.domain.errors import Conflict, DomainError, NotFound
from app.domain.events import Actor, emit
from app.domain.keydates import add_key_date, recurrences
from app.domain.parties import get_party
from app.domain.seed import DEFAULT_ACCOUNT_SETTINGS
from app.models.contracts import Clause, Contract, ContractFact, KeyDate
from app.models.core import Attachment, Company, Party, User
from app.models.quotes import Quote
from app.models.registry import Asset

DRAFT_STATUSES = {"draft", "sent", "negotiating", "ready_to_sign"}
EDITABLE_STATUSES = {"draft", "sent", "negotiating"}
PURPOSE_DEFAULT = "Üüripinda võib kasutada üksnes büroo-, lao- ja tootmispinnana."
LANDLORD_ROLES = ["Lepingulistes küsimustes", "Halduskorralduses", "Arveldustes"]
TENANT_ROLES = ["Lepingulistes küsimustes", "Tehnilistes küsimustes", "Arveldustes"]
FACT_LABELS = {"rent_monthly": "Üür kuus", "rent_per_m2": "Üür €/m²", "area_m2": "Üüripind", "deposit": "Tagatisraha", "deposit_months": "Tagatis (kuud)",
               "period_months": "Lepingu tähtaeg", "handover_date": "Üleandmispäev", "end_date": "Lepingu lõpp", "parking_spots": "Parkimiskohad",
               "indexation": "Indekseerimine", "electrical_a": "Elektrivõimsus", "vat_taxable": "Käibemaks"}


def _attr(a: Asset, key: str, default: Any = None) -> Any:
    return (a.attributes or {}).get(key, default)


def _et(v: Any, frac: int = 2) -> str:
    return render.fmt_num(v, frac)


def _m2(v: Any) -> str:
    return render.fmt_m2(v)


def add_months(d: date, months: int) -> date:
    y, m = d.year + (d.month - 1 + months) // 12, (d.month - 1 + months) % 12 + 1
    last = (date(y + (m == 12), (m % 12) + 1, 1) - timedelta(days=1)).day
    return date(y, m, min(d.day, last))


def end_of_term(handover: date, months: int) -> date:
    return add_months(handover, months) - timedelta(days=1)


def first_of_next_month(today: date | None = None) -> date:
    today = today or date.today()
    return add_months(date(today.year, today.month, 1), 1)


async def next_number(session: AsyncSession, prefix: str = "LEP") -> str:
    year = date.today().year
    rows = (await session.execute(select(Contract.number).where(Contract.number.like(f"{prefix}-{year}-%")))).scalars()
    n = max((int(r.rsplit("-", 1)[1]) for r in rows if r.rsplit("-", 1)[1].isdigit()), default=0) + 1
    return f"{prefix}-{year}-{n:03d}"


# ---------------------------------------------------------------- terms (the deal) ------------------------------


def default_terms(*, handover: date, months: int, spaces: list[dict[str, Any]], deposit_months: int, indexation: dict[str, Any],
                  representatives: dict[str, list[dict[str, str]]], purpose: str | None = None) -> dict[str, Any]:
    return {"handover": handover.isoformat(), "months": months, "spaces": spaces, "deposit_months": deposit_months, "purpose": purpose,
            "term_notes": None, "indexation": indexation, "representatives": representatives}


def default_indexation(settings: dict[str, Any], handover: date) -> dict[str, Any]:
    q = {**DEFAULT_ACCOUNT_SETTINGS["quote"], **(settings.get("quote") or {})}
    method = q.get("indexation_method") or "fixed_pct"
    nxt = add_months(handover, 12)
    return {"method": method, "rate": float(q.get("indexation_rate") or 3.0) if method == "fixed_pct" else None, "frequency_months": 12, "next_date": nxt.isoformat()}


def default_representatives(company: Company | None, party: Party, contact: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    me = {"name": "", "phone": company.phone or "" if company else "", "email": company.email or "" if company else ""}
    landlord = [{"role": r, **me} for r in LANDLORD_ROLES]
    first = {"role": TENANT_ROLES[0], "name": contact.get("name") or party.contact_name or "", "phone": contact.get("phone") or party.phone or "", "email": contact.get("email") or party.email or ""}
    tenant = [first] + [{"role": r, "name": "", "phone": "", "email": ""} for r in TENANT_ROLES[1:]]
    return {"landlord": landlord, "tenant": tenant}


def representatives_text(rows: list[dict[str, str]]) -> str:
    parts = [f"{r.get('role')}: {' · '.join(x for x in [r.get('name'), r.get('phone'), r.get('email')] if x)}" for r in rows if r.get("name") or r.get("email") or r.get("phone")]
    return "; ".join(parts) or "—"


async def _space_rows(session: AsyncSession, terms: dict[str, Any]) -> list[tuple[dict[str, Any], Asset]]:
    out = []
    for s in terms.get("spaces") or []:
        a = await get_asset(session, uuid.UUID(str(s["space_id"])))
        out.append((s, a))
    return out


async def deal(session: AsyncSession, c: Contract) -> dict[str, Any]:
    """The computed deal — what the main terms, facts, key dates and allocations render. Verticals plug in here."""
    if c.type_code == "employment":
        from app.domain import employment

        return await employment.deal(session, c)
    return await lease_deal(session, c)


async def lease_deal(session: AsyncSession, c: Contract) -> dict[str, Any]:
    """Real-estate lease: per-space lines, totals, dates, parking numbers."""
    terms = c.terms or {}
    settings = effective_settings(await get_account(session, c.account_id))
    handover = date.fromisoformat(terms["handover"])
    months = int(terms["months"])
    rows = await _space_rows(session, terms)
    prop = await get_asset(session, rows[0][1].parent_id) if rows else None
    spots = {str(s.id): s for s in await children_of(session, prop.id, "parking_spot")} if prop else {}
    lines, spaces = [], []
    for s, a in rows:
        area = float(_attr(a, "rentable_area_m2") or 0)
        price = float(s.get("price_per_m2") if s.get("price_per_m2") is not None else (_attr(a, "price_per_m2") or 0))
        schedule = pricing.normalise_schedule(s.get("schedule"), price)
        line = pricing.space_line(area=area, price=price, schedule=schedule, period_months=months)
        lines.append(line)
        spot_rows = [spots[i] for i in (s.get("parking_spot_ids") or []) if i in spots]
        spaces.append({"space_id": a.id, "name": a.name, "type": _attr(a, "type"), "area_m2": area, "price_per_m2": price, "schedule": schedule, "line": line,
                       "parking_numbers": [_attr(x, "number") for x in sorted(spot_rows, key=lambda x: quotes_domain._nat(_attr(x, "number")))],
                       "parking_count": len(spot_rows) if spot_rows or s.get("parking_spot_ids") is not None else (s.get("parking_count") or 0),
                       "electrical_a": s.get("electrical_a") if s.get("electrical_a") is not None else _attr(a, "electrical_capacity_a")})
    vat_taxable = bool(_attr(prop, "vat_taxable", True)) if prop else True
    totals = pricing.quote_totals(lines, vat_taxable=vat_taxable, rate=pricing.vat_rate(settings, handover), utility_winter=_attr(prop, "utility_cost_winter") if prop else None,
                                  utility_summer=_attr(prop, "utility_cost_summer") if prop else None)
    deposit_months = int(terms.get("deposit_months") or 0)
    end = end_of_term(handover, months)
    d = {"vertical": "lease", "terms": terms, "handover": handover, "start": handover, "months": months, "end": end, "spaces": spaces, "totals": totals,
         "deposit": pricing.deposit(totals["monthly_net"], deposit_months), "deposit_months": deposit_months, "property": prop, "settings": settings,
         "purpose": terms.get("purpose") or PURPOSE_DEFAULT, "term_notes": terms.get("term_notes") or "Puuduvad.", "indexation": terms.get("indexation") or {},
         "representatives": terms.get("representatives") or {"landlord": [], "tenant": []}, "uniform_price": len({s["line"]["price_per_m2"] for s in spaces}) <= 1}
    d["facts"] = facts_of(d)
    d["key_dates"] = {"start": handover, "end": end}
    if d["indexation"].get("method") and d["indexation"].get("next_date"):
        # every indexation of the term, not just the first: the calendar shows each one
        d["key_dates"]["indexation"] = recurrences(date.fromisoformat(d["indexation"]["next_date"]), until=end,
                                                   every_months=int(d["indexation"].get("frequency_months") or 12))
    allocs: list[tuple[uuid.UUID, str, int, date, date]] = [(sp["space_id"], "exclusive", 1, handover, end) for sp in spaces]
    if prop:
        reg = {str(x.id): x for x in spots.values()}
        for st in terms.get("spaces") or []:
            for sid in st.get("parking_spot_ids") or []:
                if sid in reg:
                    allocs.append((reg[sid].id, "exclusive", 1, handover, end))
    d["allocations"] = allocs
    d["title"] = f"Üürileping — {', '.join(sp['name'] for sp in spaces)}"
    return d


# ---------------------------------------------------------------- main terms (põhitingimused) ----------------------


def _period_text(months: int) -> str:
    return f"{months // 12} aastaks" if months % 12 == 0 else f"{months} kuuks"


def _indexation_text(ix: dict[str, Any]) -> str:
    if not ix or not ix.get("method"):
        return "Üüri ei indekseerita."
    nxt = render.fmt_date(ix.get("next_date"))
    freq = int(ix.get("frequency_months") or 12)
    every = "iga 12 kuu järel" if freq == 12 else f"iga {freq} kuu järel"
    if ix["method"] == "stat_cpi":
        return f"Üüri korrigeeritakse {every} Statistikaameti tarbijahinnaindeksi muutuse võrra; esimene indekseerimine {nxt}. Korraline indekseerimine ei nõua Lepingu muutmist."
    return f"Üüri korrigeeritakse {every} {_et(ix.get('rate'), 1).rstrip('0').rstrip(',')} % võrra; esimene indekseerimine {nxt}. Korraline indekseerimine ei nõua Lepingu muutmist."


def main_terms(d: dict[str, Any], company: Company | None, party: Party, contact: dict[str, Any]) -> list[Node]:
    """Sections 1–6 of the demo's ``pohiTehing`` — full sentences from the deal facts; fact_key marks the editable number."""
    prop: Asset = d["property"]
    address = _attr(prop, "address") or prop.name
    sp = d["spaces"]
    many = len(sp) > 1
    names = ", ".join(s["name"] for s in sp)
    handover, end = render.fmt_date(d["handover"]), render.fmt_date(d["end"])
    tot = d["totals"]
    landlord = " · ".join(x for x in [company.name if company else "", f"reg {company.registry_code}" if company and company.registry_code else "",
                                       f"KMKR {company.vat_number}" if company and company.vat_number else "", company.address if company else "",
                                       company.email if company else "", company.phone if company else ""] if x)
    tenant = " · ".join(x for x in [party.name, f"reg {party.registry_code}" if party.registry_code else "", f"KMKR {party.vat_number}" if party.vat_number else "",
                                     party.address or "", contact.get("email") or party.email or "", contact.get("phone") or party.phone or ""] if x)
    if many:
        p21 = (f"Lepingu esemeks on aadressil {address} asuvas hoones (Hoone) paiknevad {names} üldpinnaga kokku {_m2(tot['area_m2'])} (Üüripind): "
               + "; ".join(f"{s['name']} — {_m2(s['area_m2'])}{', ' + s['type'] if s['type'] else ''}" for s in sp)
               + ". Pindade asukohad ja piirid on näidatud Lepingu lisas nr 1 toodud plaanidel.")
    else:
        s0 = sp[0]
        p21 = (f"Lepingu esemeks on aadressil {address} asuvas hoones (Hoone) paiknev {s0['name']} üldpinnaga {_m2(s0['area_m2'])} (Üüripind)"
               f"{' — ' + s0['type'] + ' —' if s0['type'] else ''}, mille asukoht ja piirid on näidatud Lepingu lisas nr 1 toodud plaanil.")
    parking_total = sum(s["parking_count"] for s in sp)
    numbers = [n for s in sp for n in s["parking_numbers"]]
    if parking_total:
        p22 = (f"{parking_total} parkimiskohta" + (f" — kohad nr {', '.join(numbers)}, mille asukoht on näidatud Lepingu lisas nr 2" if numbers else "")
               + ". Parkimiskohtade kasutustasu sisaldub Üüris.")
    else:
        p22 = "Leping ei sisalda parkimiskohti."
    if many and not d["uniform_price"]:
        p31 = ("Üür pindade kaupa (EUR Üüripinna ühe ruutmeetri kohta kuus): "
               + "; ".join(f"{s['name']} — EUR {_et(s['line']['price_per_m2'])} × {_m2(s['area_m2'])} = {_et(s['line']['monthly_net'])} €" for s in sp)
               + f" — kokku {_et(tot['monthly_net'])} €/kuus (neto), millele lisandub käibemaks õigusaktides kehtestatud suuruses. Parkimiskohtade kasutustasu sisaldub Üüris.")
    else:
        p31 = (f"EUR {_et(sp[0]['line']['price_per_m2'])} Üüripinna ühe ruutmeetri kohta kuus — kokku {_et(tot['monthly_net'])} €/kuus (neto), "
               "millele lisandub käibemaks õigusaktides kehtestatud suuruses. Parkimiskohtade kasutustasu sisaldub Üüris.")
    if not tot["vat_taxable"]:
        p31 = p31.replace(", millele lisandub käibemaks õigusaktides kehtestatud suuruses", "; Üür ei ole käibemaksuga maksustatav")
    p41 = (f"Üürnik tasub Lepingu allkirjastamisel arve alusel tagatisraha {d['deposit_months']} kuu Üüri ulatuses — {_et(d['deposit'])} € (lisandub käibemaks)."
           if d["deposit_months"] else "Tagatisraha ei nõuta.")
    p51 = f"Leping on sõlmitud tähtajaliselt {_period_text(d['months'])} alates Üleandmispäevast: {handover} – {end} ({d['months']} kuud)."
    sec = lambda n, title, kids: Node(text="", heading=title, number_style="decimal", category="main", children=kids)  # noqa: E731
    cl = lambda title, text, key=None, note=None: Node(text=text, heading=title, number_style="decimal", category="main", extra={"fact_key": key, "origin_note": note})  # noqa: E731
    return [
        sec(1, "Pooled", [cl("Üürileandja", landlord, note="profiilist"), cl("Üürnik", tenant, note="osapoole kaardilt")]),
        sec(2, "Üüripind", [cl("Üüripind", p21, note="pinnakaardilt"), cl("Parkimiskohad", p22, "parking"),
                            cl("Üüripinna üleandmine", f"Üleandmispäev on {handover}. Üüripind antakse Üürniku valdusesse kahepoolse üleandmis-vastuvõtmisakti alusel.", "handover"),
                            cl("Kasutusotstarve", d["purpose"], "purpose")]),
        sec(3, "Üür", [cl("Üür", p31, "rent"),
                       cl("Kõrvalkulud", "Üürnik kohustub tasuma Üürileandja esitatud kommunaal-, haldus- ja lisateenuste arved Üldtingimustes sätestatud korras.", note="mallist"),
                       cl("Indekseerimine", _indexation_text(d["indexation"]), "indexation")]),
        sec(4, "Tagatis", [cl("Tagatise summa", p41, "deposit_months")]),
        sec(5, "Tähtaeg", [cl("Lepingu tähtaeg", p51, "months"), cl("Tähtaja erisused", d["term_notes"], "term_notes")]),
        sec(6, "Poolte esindajad", [cl("Üürileandja esindajad", representatives_text(d["representatives"].get("landlord") or []), "representatives.landlord"),
                                    cl("Üürniku esindajad", representatives_text(d["representatives"].get("tenant") or []), "representatives.tenant")]),
    ]


def _flatten(nodes: list[Node]) -> list[Node]:
    out: list[Node] = []
    for n in nodes:
        out.append(n)
        out.extend(_flatten(n.children))
    return out


# ---------------------------------------------------------------- facts + key dates -------------------------------


def facts_of(d: dict[str, Any]) -> dict[str, dict[str, Any]]:
    tot = d["totals"]
    ix = d["indexation"]
    return {
        "rent_monthly": {"value": tot["monthly_net"], "unit": "€/kuus"}, "rent_per_m2": {"value": tot["avg_price_per_m2"], "unit": "€/m²"},
        "area_m2": {"value": tot["area_m2"], "unit": "m²"}, "deposit": {"value": d["deposit"], "unit": "€"}, "deposit_months": {"value": d["deposit_months"], "unit": "kuud"},
        "period_months": {"value": d["months"], "unit": "kuud"}, "handover_date": {"value": d["handover"].isoformat()}, "end_date": {"value": d["end"].isoformat()},
        "parking_spots": {"value": sum(s["parking_count"] for s in d["spaces"]), "text": ", ".join(n for s in d["spaces"] for n in s["parking_numbers"]) or None},
        "indexation": {"value": ix.get("method"), "text": _indexation_text(ix), "rate": ix.get("rate"), "next_date": ix.get("next_date")},
        "vat_taxable": {"value": tot["vat_taxable"]},
    }


async def _write_facts(session: AsyncSession, actor: Actor, c: Contract, d: dict[str, Any]) -> None:
    """While drafting, the initial facts are rewritten in place (versioning starts at signing — invariant 2 is about the legal record)."""
    old = list((await session.execute(select(ContractFact).where(ContractFact.contract_id == c.id, ContractFact.reason == "initial"))).scalars())
    for f in old:
        await session.delete(f)
    values: dict[str, Any] = {}
    labels = {**FACT_LABELS, **d.get("fact_labels", {})}
    for key, v in d["facts"].items():
        session.add(ContractFact(account_id=actor.account_id, contract_id=c.id, key=key, reason="initial", valid_from=d["start"],
                                 value={"label": labels.get(key, key), **v}))
        values[key] = {"label": labels.get(key, key), **v}
    c.current_values = values
    c.start_date, c.end_date = d["start"], d["end"]
    await session.flush()


async def _sync_key_dates(session: AsyncSession, actor: Actor, c: Contract, d: dict[str, Any]) -> None:
    """Generated key dates follow the deal: one per kind, or a dated series (indexation). Operator-added rows are left alone."""
    rows = list((await session.execute(select(KeyDate).where(KeyDate.subject_id == c.id, KeyDate.deleted_at.is_(None)))).scalars())
    wanted: dict[str, list[date]] = {k: (v if isinstance(v, list) else [v]) for k, v in d["key_dates"].items() if v}
    by_kind: dict[str, list[KeyDate]] = {}
    for k in sorted((k for k in rows if (k.provenance or {}).get("generated")), key=lambda k: k.due_date):
        by_kind.setdefault(k.kind_code, []).append(k)
    for kind, dues in wanted.items():
        have = by_kind.get(kind, [])
        for kd, due in zip(have, dues, strict=False):
            if kd.due_date != due:
                kd.due_date = due
        for due in dues[len(have):]:
            await add_key_date(session, actor, contract_id=c.id, kind_code=kind, due_date=due, provenance={"generated": True})
        for kd in have[len(dues):]:
            kd.deleted_at = datetime.now(UTC)
    for kind, have in by_kind.items():
        if kind not in wanted:
            for kd in have:
                kd.deleted_at = datetime.now(UTC)


async def _sync_allocations(session: AsyncSession, actor: Actor, c: Contract, d: dict[str, Any]) -> None:
    from app.domain.assets import delete_allocation

    existing = await list_allocations(session, contract_id=c.id)
    wanted: dict[uuid.UUID, tuple[str, int, date | None, date | None]] = {aid: (kind, qty, start, end) for aid, kind, qty, start, end in d["allocations"]}
    for al, _ in existing:
        w = wanted.get(al.asset_id)
        if not w or (al.kind, al.period_start, al.period_end) != (w[0], w[2], w[3]):
            await delete_allocation(session, actor, al.id)
        else:
            wanted.pop(al.asset_id)
    for asset_id, (kind, qty, start, end) in wanted.items():
        try:
            await allocate(session, actor, contract_id=c.id, asset_id=asset_id, kind=kind, quantity=qty, period_start=start, period_end=end)
        except Conflict:
            # a draft may target a space/spot that another draft also targets — the register shows the discrepancy; signing resolves it (Phase 4)
            emit(session, actor, "contract", c.id, "contract.allocation_conflict", {"asset_id": asset_id})


# ---------------------------------------------------------------- clause containers -------------------------------


async def _copy_general_terms(session: AsyncSession, actor: Actor, c: Contract, template_id: uuid.UUID) -> dict[uuid.UUID, uuid.UUID]:
    """Snapshot the template's clause tree into the contract (locked). Returns template clause id → contract clause id."""
    rows = await load_rows(session, template_id=template_id)
    by_parent: dict[uuid.UUID | None, list[Clause]] = {}
    for r in rows:
        by_parent.setdefault(r.parent_id, []).append(r)
    for lst in by_parent.values():
        lst.sort(key=lambda x: x.ordinal)
    ids: list[uuid.UUID] = []

    def build(parent: uuid.UUID | None) -> list[Node]:
        out = []
        for r in by_parent.get(parent, []):
            ids.append(r.id)
            out.append(Node(text=(r.text or {}).get("plain", ""), heading=r.heading, number_style=r.number_style, source_number=r.source_number,
                            category="general", children=build(r.id)))
        return out

    nodes = build(None)
    written = await write_tree(session, actor, nodes, contract_id=c.id, container="general", source="template", locked=True, source_template_id=template_id)
    return dict(zip(ids, [w.id for w in written], strict=False))


async def _resolve_template(session: AsyncSession, c: Contract, prop: Asset | None) -> uuid.UUID | None:
    from app.domain.templates import current_template

    tid = _attr(prop, "template_id") if prop else None
    if tid:
        return uuid.UUID(str(tid))
    t = await current_template(session, kind="general_terms", company_id=c.company_id, contract_type_code=c.type_code)
    if not t:
        t = await current_template(session, kind="general_terms", company_id=None, contract_type_code=c.type_code)
    return t.id if t else None


async def main_clause_by_key(session: AsyncSession, contract_id: uuid.UUID, fact_key: str) -> Clause | None:
    return (await session.execute(select(Clause).where(Clause.contract_id == contract_id, Clause.container == "main", Clause.fact_key == fact_key))).scalar_one_or_none()


async def _general_clause_by_number(session: AsyncSession, contract_id: uuid.UUID, number: str) -> Clause | None:
    for r in render_tree(await load_rows(session, contract_id=contract_id, container="general")):
        if r.display_number == number:
            return await session.get(Clause, r.id)
    return None


async def add_special_clause(session: AsyncSession, actor: Actor, c: Contract, *, text: str, overrides: str | None = None, overrides_label: str | None = None,
                             status: str = "drafting", origin_note: str | None = None, template_map: dict[uuid.UUID, uuid.UUID] | None = None) -> Clause:
    """A Lisa 3 clause. ``overrides``: "main:<fact_key>" | "general:<template clause id | number>" | None."""
    target: Clause | None = None
    if overrides:
        kind, _, ref = overrides.partition(":")
        if kind == "main":
            target = await main_clause_by_key(session, c.id, ref)
        elif kind == "general":
            try:
                tid = uuid.UUID(ref)
                cid = (template_map or {}).get(tid)
                target = await session.get(Clause, cid) if cid else None
                if not target:
                    t = (await session.execute(select(Clause).where(Clause.contract_id == c.id, Clause.container == "general", Clause.source_template_id.is_not(None)))).scalars()
                    target = next((x for x in t if x.id == tid), None)
            except ValueError:
                target = await _general_clause_by_number(session, c.id, ref)
    existing = await load_rows(session, contract_id=c.id, container="annex:3")
    ordinal = max((r.ordinal for r in existing if r.parent_id is None), default=0) + 1
    row = Clause(account_id=actor.account_id, contract_id=c.id, parent_id=None, container="annex:3", ordinal=ordinal, number_style="decimal",
                 category="special", text={"plain": text}, original_text=text, locked=False, source="negotiated", status=status, origin_note=origin_note,
                 overrides_clause_id=target.id if target else None, overrides_label=overrides_label if not target else None)
    session.add(row)
    await session.flush()
    emit(session, actor, "contract", c.id, "contract.special_clause_added", {"clause_id": row.id, "text": text[:300], "overrides_clause_id": target.id if target else None,
                                                                           "overrides_label": overrides_label, "status": status, "origin": origin_note})
    return row


async def rebuild_main_terms(session: AsyncSession, actor: Actor, c: Contract) -> dict[str, Any]:
    """Regenerate the main terms from ``terms`` (demo ``rebuildPohi``): unchanged wording follows; operator-edited wording is kept and flagged."""
    d = await deal(session, c)
    company = await session.get(Company, c.company_id) if c.company_id else None
    party = (await contract_parties.primary_parties(session, [c.id])).get(c.id)
    if not party:
        raise DomainError("Lepingul puudub vastaspool")
    if d["vertical"] == "employment":
        from app.domain import employment

        nodes = employment.main_terms(d, company, party, c.contact or {})
    else:
        nodes = main_terms(d, company, party, c.contact or {})
    rows = await load_rows(session, contract_id=c.id, container="main")
    if not rows:
        await write_tree(session, actor, nodes, contract_id=c.id, container="main", source="generated", locked=False)
    else:
        by_key = {r.fact_key: r for r in rows if r.fact_key}
        by_heading = {(r.heading, r.parent_id is not None): r for r in rows}
        flagged = []
        for n in _flatten(nodes):
            if not n.text:
                continue
            r = by_key.get(n.extra.get("fact_key")) if n.extra.get("fact_key") else by_heading.get((n.heading, True))
            if not r:
                continue
            current = (r.text or {}).get("plain", "")
            if r.original_text is None or current == r.original_text:
                r.text = {"plain": n.text}
            elif n.text != r.original_text:
                r.provenance = {**(r.provenance or {}), "check": True}
                flagged.append(r.heading)
            r.original_text = n.text
        if flagged:
            emit(session, actor, "contract", c.id, "contract.wording_check", {"clauses": flagged})
    await _write_facts(session, actor, c, d)
    await _sync_key_dates(session, actor, c, d)
    await _sync_allocations(session, actor, c, d)
    c.title = d["title"]
    await index_contract(session, c)
    return d


# ---------------------------------------------------------------- creation ---------------------------------------


async def create_draft(session: AsyncSession, actor: Actor, *, party_id: uuid.UUID, property_id: uuid.UUID, spaces: list[dict[str, Any]],
                       company_id: uuid.UUID | None, months: int, handover: date | None = None, contact: dict[str, Any] | None = None,
                       deposit_months: int | None = None, special_terms: list[dict[str, Any]] | None = None, quote: Quote | None = None,
                       purpose: str | None = None) -> Contract:
    """The draft factory the wizard and the quote conversion share (demo ``createLease``)."""
    if not spaces:
        raise DomainError("Lepingul peab olema vähemalt üks pind")
    settings = effective_settings(await get_account(session, actor.account_id))
    qs = {**DEFAULT_ACCOUNT_SETTINGS["quote"], **(settings.get("quote") or {})}
    party = await get_party(session, party_id)
    prop = await get_asset(session, property_id)
    company = await session.get(Company, company_id or prop.company_id) if (company_id or prop.company_id) else None
    handover = handover or first_of_next_month()
    contact = contact or {"name": party.contact_name or "", "email": party.email or "", "phone": party.phone or ""}
    for s in spaces:
        a = await quotes_domain._check_space(session, prop, uuid.UUID(str(s["space_id"])))
        s["space_id"] = str(a.id)
        if s.get("parking_spot_ids") is None and s.get("parking_count") is None and _attr(prop, "has_parking") is not False:
            s["parking_spot_ids"] = await quotes_domain._default_spots(session, prop, a)
    terms = default_terms(handover=handover, months=months, spaces=spaces, deposit_months=deposit_months if deposit_months is not None else qs["deposit_months"],
                          indexation=default_indexation(settings, handover), representatives=default_representatives(company, party, contact), purpose=purpose)
    c = await create_contract(session, actor, type_code="lease", title="Üürileping", number=await next_number(session), status="draft", origin="platform",
                              company_id=company.id if company else None, parties=[{"party_id": party.id, "role": "tenant", "is_primary": True, "source": "manual"}],
                              category="lease", start_date=handover, end_date=end_of_term(handover, months))
    c.terms, c.contact, c.quote_id, c.has_clause_tree = terms, contact, quote.id if quote else None, True
    await session.flush()
    template_id = await _resolve_template(session, c, prop)
    tmap: dict[uuid.UUID, uuid.UUID] = {}
    if template_id:
        tmap = await _copy_general_terms(session, actor, c, template_id)
    else:
        emit(session, actor, "contract", c.id, "contract.no_general_terms", {"property_id": prop.id})
    await rebuild_main_terms(session, actor, c)
    for t in special_terms or []:
        await add_special_clause(session, actor, c, text=t["text"], overrides=t.get("overrides"), overrides_label=t.get("overrides_label"), status="accepted",
                                 origin_note="pakkumisest" if quote else "operaator", template_map=tmap)
    emit(session, actor, "contract", c.id, "contract.draft_generated",
         {"number": c.number, "quote_id": quote.id if quote else None, "quote_number": quote.number if quote else None, "party_id": party.id, "party_name": party.name,
          "spaces": [s["space_id"] for s in spaces], "handover": handover, "months": months, "template_id": template_id, "special_terms": len(special_terms or [])})
    return c


async def convert_quote(session: AsyncSession, actor: Actor, quote_id: uuid.UUID, *, mode: str = "separate", handover: date | None = None) -> list[Contract]:
    """Accepted quote → N drafts (one per space, the default) or one shared draft (demo v649; same building only)."""
    q = await quotes_domain.get_quote(session, quote_id)
    if q.status != "accepted":
        raise DomainError("Lepinguks saab teisendada ainult aktsepteeritud pakkumise", code="invalid_transition")
    if mode not in ("separate", "shared"):
        raise DomainError("Lepingu kuju peab olema separate või shared")
    b = await quotes_domain.quote_bundle(session, q, with_versions=False)
    def space_terms(s: dict[str, Any]) -> dict[str, Any]:
        return {"space_id": str(s["space_id"]), "price_per_m2": s["price_per_m2"], "schedule": s["schedule"],
                "parking_spot_ids": [str(p["id"]) for p in s["parking"]["spots"]] if s["parking"]["mode"] == "register" else None,
                "parking_count": s["parking"]["count"] if s["parking"]["mode"] != "register" else None, "electrical_a": s["electrical_override"]}
    def terms_for(space_ids: set[uuid.UUID]) -> list[dict[str, Any]]:
        return [{"text": t["text"], "overrides": t["overrides"], "overrides_label": t["overrides_label"]}
                for t in b["special_terms"] if t["space_id"] is None or t["space_id"] in space_ids]
    groups = [[s for s in b["spaces"]]] if mode == "shared" else [[s] for s in b["spaces"]]
    drafts: list[Contract] = []
    for group in groups:
        c = await create_draft(session, actor, party_id=q.party_id, property_id=q.property_id, spaces=[space_terms(s) for s in group], company_id=q.company_id,
                               months=q.period_months, handover=handover, contact=dict(q.contact or {}), special_terms=terms_for({s["space_id"] for s in group}), quote=q)
        drafts.append(c)
    q.conversion = {"mode": mode, "contract_ids": [str(c.id) for c in drafts]}
    quotes_domain._transition(session, actor, q, "converted", {"mode": mode, "contracts": [c.number for c in drafts]})
    await quotes_domain._index(session, q, b)
    return drafts


# ---------------------------------------------------------------- editing the deal --------------------------------


def _editable(c: Contract) -> None:
    if c.origin != "platform" or c.type_code not in ("lease", "employment"):
        raise DomainError("Imporditud lepingut ei koostata platvormil")
    if c.status not in EDITABLE_STATUSES:
        raise DomainError("Lepingu tingimusi saab muuta mustandina või läbirääkimistel", code="not_editable")
    if c.status != "draft" and (c.round or {}).get("side") not in (None, "operator"):
        raise DomainError("Praegu on üürniku kord — oota tema kirja", code="not_your_turn")


async def update_terms(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, patch: dict[str, Any], *, expected_version: int | None = None,
                       reason: str | None = None) -> Contract:
    """Change deal facts (handover, months, prices, deposit, purpose, parking, electrical, indexation, representatives) and regenerate."""
    c = await get_contract(session, contract_id)
    _editable(c)
    if expected_version is not None and c.version != expected_version:
        raise Conflict()
    terms = dict(c.terms or {})
    changes: dict[str, Any] = {}
    for key in ("handover", "months", "deposit_months", "purpose", "term_notes"):
        if key in patch and patch[key] != terms.get(key):
            if key == "handover":
                date.fromisoformat(str(patch[key]))
            if key == "months" and (int(patch[key]) < 1 or int(patch[key]) > 600):
                raise DomainError("Tähtaeg peab olema 1–600 kuud")
            changes[key] = [terms.get(key), patch[key]]
            terms[key] = patch[key]
    if "indexation" in patch and patch["indexation"] != terms.get("indexation"):
        ix = patch["indexation"] or {}
        if ix.get("method") not in (None, "fixed_pct", "stat_cpi"):
            raise DomainError("Indekseerimise meetod peab olema fixed_pct või stat_cpi")
        changes["indexation"] = [terms.get("indexation"), ix]
        terms["indexation"] = ix
    if "representatives" in patch and patch["representatives"] != terms.get("representatives"):
        changes["representatives"] = [terms.get("representatives"), patch["representatives"]]
        terms["representatives"] = patch["representatives"]
    if "spaces" in patch:
        by_id = {s["space_id"]: s for s in terms.get("spaces") or []}
        for s in patch["spaces"]:
            cur = by_id.get(str(s["space_id"]))
            if not cur:
                raise NotFound("Pind pole lepingus")
            for key in ("price_per_m2", "schedule", "parking_spot_ids", "parking_count", "electrical_a"):
                if key in s and s[key] != cur.get(key):
                    changes[f"{key}:{s['space_id']}"] = [cur.get(key), s[key]]
                    cur[key] = s[key]
    if not changes:
        return c
    c.terms = terms
    c.version += 1
    emit(session, actor, "contract", c.id, "contract.terms_updated", changes, reason=reason)
    await rebuild_main_terms(session, actor, c)
    return c


async def update_contact(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, contact: dict[str, Any]) -> Contract:
    c = await get_contract(session, contract_id)
    _editable(c)
    new = {k: (contact.get(k) or "").strip() for k in ("name", "email", "phone")}
    if new != (c.contact or {}):
        emit(session, actor, "contract", c.id, "contract.contact_updated", {"before": c.contact, "after": new})
        c.contact = new
        c.version += 1
    return c


async def edit_clause_text(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, clause_id: uuid.UUID, text: str, *, reason: str | None = None,
                           allow_locked: bool = False) -> Clause:
    """Operator wording edit (demo ✎): main/special directly; a locked general clause only with an explicit unlock (diff trail kept)."""
    c = await get_contract(session, contract_id)
    _editable(c)
    cl = await session.get(Clause, clause_id)
    if not cl or cl.contract_id != c.id:
        raise NotFound("Punkti ei leitud")
    if cl.locked and not allow_locked:
        raise DomainError("Üldtingimuse punkt on lukus — kirjuta see üle eritingimusega (Lisa 3)", code="locked")
    text = (text or "").strip()
    if not text:
        raise DomainError("Punkti tekst ei tohi olla tühi")
    before = (cl.text or {}).get("plain", "")
    if before == text:
        return cl
    cl.text = {"plain": text}
    if cl.locked:
        cl.locked = False
        cl.provenance = {**(cl.provenance or {}), "unlocked": True}
    c.version += 1
    emit(session, actor, "clause", cl.id, "clause.text_changed", {"contract_id": c.id, "contract_number": c.number, "before": before, "after": text, "container": cl.container}, reason=reason)
    return cl


async def remove_special_clause(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, clause_id: uuid.UUID) -> None:
    c = await get_contract(session, contract_id)
    _editable(c)
    cl = await session.get(Clause, clause_id)
    if not cl or cl.contract_id != c.id or cl.container != "annex:3":
        raise NotFound("Eritingimust ei leitud")
    await session.delete(cl)
    await session.flush()
    c.version += 1
    emit(session, actor, "contract", c.id, "contract.special_clause_removed", {"clause_id": clause_id, "text": (cl.text or {}).get("plain", "")[:300]})


# ---------------------------------------------------------------- read model + rendering ----------------------------


async def bundle(session: AsyncSession, c: Contract) -> dict[str, Any]:
    d = await deal(session, c)
    rendered = render_tree(await load_rows(session, contract_id=c.id))
    company = await session.get(Company, c.company_id) if c.company_id else None
    party = (await contract_parties.primary_parties(session, [c.id])).get(c.id)
    atts = await annexes(session, c, d)
    return {"contract": c, "deal": d, "clauses": rendered, "company": company, "party": party, "annexes": atts,
            "main": [r for r in rendered if r.container == "main"], "general": [r for r in rendered if r.container == "general"],
            "special": [r for r in rendered if r.container == "annex:3"]}


async def annexes(session: AsyncSession, c: Contract, d: dict[str, Any]) -> list[dict[str, Any]]:
    """Lisa 1 floor plans (per space), Lisa 2 parking/site plan, Lisa 3 special terms, 4+ uploads — assembled from the registry (spec 02)."""
    if d["vertical"] == "employment":
        from app.domain import employment

        return await employment.annexes(session, c, d)
    items: list[dict[str, Any]] = []
    prop = d["property"]
    plans = await list_attachments(session, subject_type="asset", subject_ids=[s["space_id"] for s in d["spaces"]] + ([prop.id] if prop else []))
    seen: set[uuid.UUID] = set()
    for s in d["spaces"]:
        fp = next((a for a in plans if a.subject_id == s["space_id"] and a.role == "floor_plan"), None)
        items.append({"number": 1, "title": f"Pinnaplaan — {s['name']}", "attachment_id": fp.id if fp else None, "kind": "floor_plan", "space_id": s["space_id"], "missing": fp is None})
    if prop:
        park = next((a for a in plans if a.subject_id == prop.id and a.role == "parking_plan"), None) or next((a for a in plans if a.subject_id == prop.id and a.role == "site_plan"), None)
        items.append({"number": 2, "title": "Parkimiskohad ja asendiplaan", "attachment_id": park.id if park else None, "kind": "parking_plan", "space_id": None, "missing": park is None})
    items.append({"number": 3, "title": "Eritingimused", "attachment_id": None, "kind": "special_terms", "space_id": None, "missing": False})
    n = 4
    for a in sorted(await list_attachments(session, subject_type="contract", subject_id=c.id, role="annex"), key=lambda a: a.created_at):
        if a.id in seen:
            continue
        items.append({"number": n, "title": a.filename, "attachment_id": a.id, "kind": "upload", "space_id": None, "missing": False})
        n += 1
    return items


async def document_html(session: AsyncSession, b: dict[str, Any], *, version: int | None = None, for_client: bool = False, interactive: bool = False) -> str:
    c: Contract = b["contract"]
    company: Company | None = b["company"]
    logo = None
    if company and company.logo_attachment_id:
        att = await session.get(Attachment, company.logo_attachment_id)
        if att:
            try:
                import base64

                from app.infra.blobstore import blobstore

                logo = f"data:{att.content_type};base64,{base64.b64encode(await blobstore().get(att.s3_key)).decode()}"
            except Exception:  # noqa: BLE001
                logo = None
    by_id = {r.id: r for r in b["clauses"]}
    overridden: dict[uuid.UUID, RenderedClause] = {}
    for r in b["special"]:
        if r.overrides_clause_id and r.status == "accepted":
            overridden[r.overrides_clause_id] = r
    return render.render_html(
        "lease.html", title=f"{'Tööleping' if c.type_code == 'employment' else 'Üürileping'} {c.number}", footer=f"{company.name if company else ''} · {c.number}",
        accent=company.accent_color if company else None, kind=c.type_code,
        c=c, deal=b["deal"], company=company, party=b["party"], main=b["main"], general=b["general"], special=b["special"], annexes=b["annexes"],
        logo_data_uri=logo, version=version, overridden=overridden, by_id=by_id, for_client=for_client, interactive=interactive,
        sender_name=(await session.get(User, c.created_by)).name if getattr(c, "created_by", None) else None,
    )
