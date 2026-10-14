"""Agent tools = the service layer, minus consequences (architecture §6).

Read tools answer from the registry; draft tools NEVER mutate — they return a confirmation card the operator
confirms through the normal REST endpoint (``requires_confirmation`` is true for every draft tool in MVP).
Every tool runs inside the operator's tenant session, so RLS bounds what the agent can see.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.providers.base import ToolDef
from app.domain.events import Actor
from app.models.contracts import Contract
from app.models.core import Party
from app.models.registry import Asset


@dataclass
class ToolResult:
    content: str  # what the model reads (compact text / JSON)
    cards: list[dict[str, Any]] = field(default_factory=list)  # typed cards for the UI
    clauses: dict[str, dict[str, Any]] = field(default_factory=dict)  # clause_id → {number, contract_id, text} — citation vocabulary
    summary: str = ""  # one line for the „Töö käik” step list
    clarify: bool = False


@dataclass
class Tool:
    name: str
    description: str
    model: type[BaseModel]
    handler: Any
    requires_confirmation: bool = False
    summary: str = ""

    def definition(self) -> ToolDef:
        schema = self.model.model_json_schema()
        schema.pop("title", None)
        return ToolDef(name=self.name, description=self.description, input_schema=schema)


# ---------------------------------------------------------------- helpers ----------------------------------------


def _uuid(v: Any) -> uuid.UUID | None:
    try:
        return uuid.UUID(str(v))
    except (ValueError, TypeError):
        return None


async def _find_contract(session: AsyncSession, ref: str) -> list[Contract]:
    u = _uuid(ref)
    if u:
        c = await session.get(Contract, u)
        return [c] if c and not c.deleted_at else []
    like = f"%{ref.strip()}%"
    stmt = select(Contract).where(Contract.deleted_at.is_(None), (Contract.number.ilike(like)) | (Contract.title.ilike(like))).limit(8)
    return list((await session.execute(stmt)).scalars())


async def _find_parties(session: AsyncSession, ref: str) -> list[Party]:
    from app.domain.parties import list_parties

    u = _uuid(ref)
    if u:
        p = await session.get(Party, u)
        return [p] if p and not p.deleted_at else []
    return (await list_parties(session, q=ref))[:8]


async def _find_properties(session: AsyncSession, ref: str | None) -> list[Asset]:
    from app.domain.assets import list_assets

    props = await list_assets(session, type_code="property")
    if not ref:
        return props
    u = _uuid(ref)
    if u:
        return [p for p in props if p.id == u]
    r = ref.strip().lower()
    return [p for p in props if r in p.name.lower() or r in str((p.attributes or {}).get("address", "")).lower()]


def _pick_clause(rendered: list[Any], ref: str) -> Any | None:
    """By id first; by number the general terms win over main terms (an override targets the general clause far more often)."""
    ref = (ref or "").strip().lstrip("§").strip()
    by_id = next((r for r in rendered if str(r.id) == ref or str(r.id).startswith(ref) and len(ref) >= 8), None)
    if by_id:
        return by_id
    hits = [r for r in rendered if r.display_number == ref]
    return next((r for r in hits if r.container == "general"), hits[0] if hits else None)


def _num(v: Any) -> str:
    from app.documents.render import fmt_num

    return fmt_num(v)


# ---------------------------------------------------------------- read tools -------------------------------------


class SearchIn(BaseModel):
    query: str = Field(description="Vaba tekst: lepingu number, kliendi nimi, pind, punkti sõnastus")


async def search_portfolio(session: AsyncSession, actor: Actor, a: SearchIn) -> ToolResult:
    from app.domain.search import search

    hits = await search(session, a.query, limit=12)
    if not hits:
        return ToolResult(content="Vasteid ei leitud.", summary=f"otsing „{a.query}” · 0 vastet")
    lines = [f"- {h.entity_type} · {h.title}{' · ' + h.subtitle if h.subtitle else ''} · id={h.entity_id} · link={h.link}" for h in hits]
    return ToolResult(content="\n".join(lines), summary=f"otsing „{a.query}” · {len(hits)} vastet",
                      cards=[{"type": "links", "title": "Leitud", "items": [{"title": h.title, "subtitle": h.subtitle, "link": h.link, "entity_type": h.entity_type} for h in hits[:8]]}])


class PartyIn(BaseModel):
    query: str = Field(description="Nimi või registrikood")


async def search_parties(session: AsyncSession, actor: Actor, a: PartyIn) -> ToolResult:
    rows = await _find_parties(session, a.query)
    if not rows:
        return ToolResult(content="Osapoolt ei leitud.", summary=f"osapool „{a.query}” · 0")
    lines = [f"- {p.name} · {p.kind} · reg {p.registry_code or '—'} · rollid {', '.join(p.roles or [])} · id={p.id} · e-post {p.email or '—'}" for p in rows]
    return ToolResult(content="\n".join(lines), summary=f"osapool „{a.query}” · {len(rows)}")


class PropertyIn(BaseModel):
    property: str | None = Field(default=None, description="Hoone nimi, aadress või id; tühi = kõik hooned")


async def get_property(session: AsyncSession, actor: Actor, a: PropertyIn) -> ToolResult:
    from app.domain.assets import children_of
    from app.domain.registry import asset_statuses

    props = await _find_properties(session, a.property)
    if not props:
        return ToolResult(content="Hoonet ei leitud.", summary="hoone · 0")
    out, rows_cards = [], []
    for p in props[:3]:
        spaces = [s for s in await children_of(session, p.id, "space")]
        st = await asset_statuses(session, spaces)
        out.append(f"Hoone {p.name} · {(p.attributes or {}).get('address', '')} · id={p.id} · KM {'jah' if (p.attributes or {}).get('vat_taxable', True) else 'ei'}")
        for s in spaces:
            at = s.attributes or {}
            out.append(f"  - {s.name} · {at.get('type') or ''} · {_num(at.get('rentable_area_m2'))} m² · {_num(at.get('price_per_m2'))} €/m² · {st.get(s.id)} · id={s.id}")
            rows_cards.append({"Pind": s.name, "m²": at.get("rentable_area_m2"), "€/m²": at.get("price_per_m2"), "Seis": str(st.get(s.id)), "link": f"/app/portfell/pind/{s.id}"})
    return ToolResult(content="\n".join(out), summary=f"hoone {props[0].name} · {len(rows_cards)} pinda",
                      cards=[{"type": "table", "title": f"{props[0].name} — pinnad", "columns": ["Pind", "m²", "€/m²", "Seis"], "rows": rows_cards[:30]}] if len(props) == 1 else [])


class SpacesIn(BaseModel):
    property: str | None = Field(default=None, description="Hoone nimi või id")
    status: str | None = Field(default=None, description="vaba | üüritud | pakkumisel")


async def list_spaces(session: AsyncSession, actor: Actor, a: SpacesIn) -> ToolResult:
    from app.domain.assets import children_of
    from app.domain.registry import asset_statuses, is_lettable

    props = await _find_properties(session, a.property)
    lines, rows = [], []
    for p in props:
        spaces = [s for s in await children_of(session, p.id, "space") if is_lettable(s)]
        st = await asset_statuses(session, spaces)
        for s in spaces:
            status = str(st.get(s.id))
            if a.status and a.status.lower() != status:
                continue
            at = s.attributes or {}
            lines.append(f"- {p.name} / {s.name} · {_num(at.get('rentable_area_m2'))} m² · {_num(at.get('price_per_m2'))} €/m² · {status} · id={s.id}")
            rows.append({"Hoone": p.name, "Pind": s.name, "m²": at.get("rentable_area_m2"), "€/m²": at.get("price_per_m2"), "Seis": status, "link": f"/app/portfell/pind/{s.id}"})
    if not lines:
        return ToolResult(content="Pindu ei leitud.", summary="pinnad · 0")
    return ToolResult(content="\n".join(lines), summary=f"pinnad · {len(lines)}", cards=[{"type": "table", "title": "Pinnad", "columns": ["Hoone", "Pind", "m²", "€/m²", "Seis"], "rows": rows[:40]}])


class QuoteIn(BaseModel):
    quote: str | None = Field(default=None, description="Pakkumise number (PAK-…), id või kliendi nimi; tühi = kõik avatud pakkumised")


async def get_quote(session: AsyncSession, actor: Actor, a: QuoteIn) -> ToolResult:
    from app.domain import quotes as quotes_domain

    rows = await quotes_domain.list_quotes(session, view="all" if a.quote else "open", q=a.quote if a.quote and not _uuid(a.quote) else None)
    if a.quote and _uuid(a.quote):
        rows = [r for r in rows if r[0].id == _uuid(a.quote)]
    if not rows:
        return ToolResult(content="Pakkumisi ei leitud.", summary="pakkumine · 0")
    lines, cards = [], []
    for q, party, prop in rows[:10]:
        b = await quotes_domain.quote_bundle(session, q)
        ns = b["next_step"]
        lines.append(f"- {q.number} · {party.name} · {prop.name}: {', '.join(s['name'] for s in b['spaces'])} · {q.status} · üür {_num(b['totals']['monthly_net'])} €/kuus (neto) · "
                     f"kehtib kuni {q.valid_until.isoformat()} · järgmine samm: {ns['title'] if ns else '—'} · id={q.id} · link=/app/portfell/pakkumine/{q.id}")
        cards.append({"Pakkumine": q.number, "Klient": party.name, "Pind": ", ".join(s["name"] for s in b["spaces"]), "Üür kuus": b["totals"]["monthly_net"], "Seis": q.status, "link": f"/app/portfell/pakkumine/{q.id}"})
        if len(rows) == 1 and b["messages"]:
            lines.append("  Läbirääkimised: " + " | ".join(f"{m.author_type}: {m.body[:160]}" for m in b["messages"][-6:]))
    return ToolResult(content="\n".join(lines), summary=f"pakkumised · {len(rows)}",
                      cards=[{"type": "table", "title": "Pakkumised", "columns": ["Pakkumine", "Klient", "Pind", "Üür kuus", "Seis"], "rows": cards}] if len(rows) > 1 else [])


class ContractIn(BaseModel):
    contract: str = Field(description="Lepingu number (LEP-…), id, pealkiri või kliendi nimi")


async def get_contract(session: AsyncSession, actor: Actor, a: ContractIn) -> ToolResult:
    from app.domain import portfolio
    from app.domain.contract_parties import list_for_contract

    rows = await _find_contract(session, a.contract)
    if not rows:
        rows = [c for c, _ in await portfolio.list_contracts(session, view="all", q=a.contract)]
    if not rows:
        return ToolResult(content="Lepingut ei leitud.", summary=f"leping „{a.contract}” · 0")
    if len(rows) > 1:
        return ToolResult(content="Mitu vastet — täpsusta:\n" + "\n".join(f"- {c.number} · {c.title} · {c.status} · id={c.id}" for c in rows[:8]), summary=f"leping „{a.contract}” · {len(rows)} vastet", clarify=True)
    c = rows[0]
    b = await portfolio.contract_bundle(session, c)
    parties = ", ".join(f"{p.name} ({cp.role})" for cp, p in await list_for_contract(session, c.id))
    facts = "; ".join(f"{(f.value or {}).get('label') or f.key}: {(f.value or {}).get('value')} {(f.value or {}).get('unit') or ''}".strip() for f in b["facts"] if not f.valid_to)
    kds = "; ".join(f"{k.title} {k.due_date.isoformat()}" for k in b["key_dates"])
    assets = ", ".join(asset.name for _, asset in b["allocations"])
    txt = (f"{c.number} · {c.title} · liik {c.type_code}/{c.category} · {c.status} · päritolu {c.origin} · {c.start_date} – {c.end_date} · id={c.id} · link=/app/portfell/leping/{c.id}\n"
           f"Pooled: {parties}\nEsemed: {assets or '—'}\nFaktid: {facts or '—'}\nTähtajad: {kds or '—'}")
    return ToolResult(content=txt, summary=f"leping {c.number}", cards=[{"type": "links", "title": c.number, "items": [{"title": c.title, "subtitle": c.status, "link": f"/app/portfell/leping/{c.id}", "entity_type": "contract"}]}])


class LoadIn(BaseModel):
    contract: str = Field(description="Lepingu number või id — kogu lepingu tekst punktide ja id-dega (tsiteerimiseks)")


async def load_contract(session: AsyncSession, actor: Actor, a: LoadIn) -> ToolResult:
    from app.domain.clauses import rendered_tree

    rows = await _find_contract(session, a.contract)
    if len(rows) != 1:
        return ToolResult(content="Lepingut ei leitud või on mitu vastet — kasuta get_contract." if not rows else "Mitu vastet:\n" + "\n".join(f"- {c.number} · {c.title} · id={c.id}" for c in rows[:8]),
                          summary=f"load_contract „{a.contract}”", clarify=len(rows) > 1)
    c = rows[0]
    rendered = await rendered_tree(session, contract_id=c.id)
    clauses = {str(r.id): {"number": r.display_number, "contract_id": str(c.id), "text": r.text[:200], "container": r.container} for r in rendered}
    lines = [f"LEPING {c.number} · {c.title} · {c.status} · {c.origin} · {c.start_date} – {c.end_date}"]
    facts = "; ".join(f"{v.get('label') or k}: {v.get('value')} {v.get('unit') or ''}".strip() for k, v in (c.current_values or {}).items())
    if facts:
        lines.append(f"FAKTID: {facts}")
    for r in rendered:
        prefix = {"main": "PÕHI", "general": "ÜLD", "annex:3": "ERI"}.get(r.container, r.container.upper())
        head = f" {r.heading}" if r.heading else ""
        lines.append(f"{'  ' * r.level}[{prefix} §{r.display_number}|{r.id}]{head} {r.text}".rstrip())
    return ToolResult(content="\n".join(lines)[:120000], summary=f"laadisin lepingu {c.number} · {len(rendered)} punkti", clauses=clauses)


class KeyDatesIn(BaseModel):
    days_ahead: int = Field(default=365, ge=1, le=3650, description="Mitu päeva ette")
    kind: str | None = Field(default=None, description="end | start | indexation | probation | salary_review | notice | payment | other")
    year: int | None = Field(default=None, description="Ainult selle aasta tähtajad")


async def list_key_dates(session: AsyncSession, actor: Actor, a: KeyDatesIn) -> ToolResult:
    from app.domain.keydates import calendar

    start = date(a.year, 1, 1) if a.year else date.today()
    end = date(a.year, 12, 31) if a.year else date.today() + timedelta(days=a.days_ahead)
    rows = await calendar(session, start=start, end=end, kind_code=a.kind)
    if not rows:
        return ToolResult(content="Tähtaegu ei ole.", summary="tähtajad · 0")
    lines, table = [], []
    for kd, c in rows[:60]:
        lines.append(f"- {kd.due_date.isoformat()} · {kd.kind_code} · {kd.title} · {c.number if c else ''} {c.title if c else ''} · leping id={c.id if c else ''}")
        table.append({"Kuupäev": kd.due_date.isoformat(), "Liik": kd.kind_code, "Leping": f"{c.number} · {c.title}" if c else "—", "link": f"/app/portfell/leping/{c.id}" if c else "/app/kalender"})
    return ToolResult(content="\n".join(lines), summary=f"tähtajad · {len(rows)}", cards=[{"type": "table", "title": "Tähtajad", "columns": ["Kuupäev", "Liik", "Leping"], "rows": table}])


class AuditIn(BaseModel):
    contract: str | None = Field(default=None, description="Lepingu number/id — selle lepingu sündmused; tühi = viimased sündmused")
    limit: int = Field(default=30, ge=1, le=100)


async def get_audit_trail(session: AsyncSession, actor: Actor, a: AuditIn) -> ToolResult:
    from app.domain import audit as audit_domain

    if a.contract:
        rows = await _find_contract(session, a.contract)
        if len(rows) != 1:
            return ToolResult(content="Lepingut ei leitud.", summary="sündmuslogi")
        events = (await audit_domain.contract_events(session, rows[0].id))[-a.limit:]
    else:
        events = await audit_domain.list_events(session, limit=a.limit)
    lines = [f"- {e.ts:%d.%m.%Y %H:%M} · {e.actor_name or e.actor_type} · {e.action} · {str(e.payload)[:160]}" for e in events]
    return ToolResult(content="\n".join(lines) or "Sündmusi pole.", summary=f"sündmuslogi · {len(events)}")


class NegotiationIn(BaseModel):
    document: str = Field(description="Lepingu või pakkumise number/id")


async def summarize_negotiation(session: AsyncSession, actor: Actor, a: NegotiationIn) -> ToolResult:
    from app.domain import negotiation
    from app.domain import quotes as quotes_domain

    rows = await _find_contract(session, a.document)
    if len(rows) == 1 and rows[0].origin == "platform":
        c = rows[0]
        st = await negotiation.state(session, c, side="operator")
        lines = [f"Leping {c.number} · {c.status} · kord: {(c.round or {}).get('side') or '—'} · {len(st['open'])} lahtist punkti · {len(st['rounds'])} vooru"]
        for v in st["threads"]:
            t = v["thread"]
            lines.append(f"- punkt {t.clause_id} · {t.status}/{t.resolution or ''} · " + " | ".join(f"{m.author_type}: {m.body[:140]}" for m in v["messages"]))
        return ToolResult(content="\n".join(lines), summary=f"läbirääkimised {c.number}")
    qs = await quotes_domain.list_quotes(session, view="all", q=a.document if not _uuid(a.document) else None)
    if _uuid(a.document):
        qs = [r for r in qs if r[0].id == _uuid(a.document)]
    if len(qs) == 1:
        q, party, _ = qs[0]
        b = await quotes_domain.quote_bundle(session, q)
        lines = [f"Pakkumine {q.number} · {party.name} · {q.status} · V{q.sent_version}"]
        lines += [f"- {m.author_type} ({m.channel}): {m.body[:200]}" for m in b["messages"]]
        lines += [f"- versioon V{v.number}: {v.note or ''}" for v in b["versions"]]
        return ToolResult(content="\n".join(lines), summary=f"läbirääkimised {q.number}")
    return ToolResult(content="Dokumenti ei leitud.", summary="läbirääkimised · 0")


class EffectiveIn(BaseModel):
    contract: str = Field(description="Lepingu number või id")


async def get_effective_state(session: AsyncSession, actor: Actor, a: EffectiveIn) -> ToolResult:
    """üld + põhi + ülimuslikud eritingimused — iga väärtus oma allikapunktiga."""
    from app.domain.clauses import rendered_tree

    rows = await _find_contract(session, a.contract)
    if len(rows) != 1:
        return ToolResult(content="Lepingut ei leitud.", summary="kehtiv seis")
    c = rows[0]
    rendered = await rendered_tree(session, contract_id=c.id)
    by_id = {r.id: r for r in rendered}
    overrides = [(r, by_id.get(r.overrides_clause_id)) for r in rendered if r.container == "annex:3" and r.overrides_clause_id and (r.status in (None, "accepted"))]
    lines = [f"KEHTIV SEIS {c.number}"]
    for k, v in (c.current_values or {}).items():
        lines.append(f"- {v.get('label') or k}: {v.get('value')} {v.get('unit') or ''}".rstrip())
    for sp, target in overrides:
        lines.append(f"- Lisa 3 p {sp.number} [§{sp.number}|{sp.id}] kirjutab üle punkti {target.display_number if target else '?'} [§{target.display_number if target else '?'}|{target.id if target else ''}]: {sp.text[:200]}")
    clauses = {str(r.id): {"number": r.display_number, "contract_id": str(c.id), "text": r.text[:200], "container": r.container} for r in rendered}
    return ToolResult(content="\n".join(lines), summary=f"kehtiv seis {c.number}", clauses=clauses)


# ---------------------------------------------------------------- draft tools (confirmation cards) ------------------


class QuoteDraftIn(BaseModel):
    party: str = Field(description="Kliendi nimi või registrikood")
    property: str = Field(description="Hoone nimi või aadress")
    spaces: list[str] = Field(description="Pindade nimed, nt ['Pind 12']")
    period_months: int | None = Field(default=None, ge=1, le=600)


async def create_quote_draft(session: AsyncSession, actor: Actor, a: QuoteDraftIn) -> ToolResult:
    from app.domain.assets import children_of
    from app.domain.registry import asset_statuses

    parties = await _find_parties(session, a.party)
    props = await _find_properties(session, a.property)
    if len(parties) != 1 or len(props) != 1:
        opts = ([f"klient: {p.name} (reg {p.registry_code or '—'})" for p in parties[:5]] + [f"hoone: {p.name}" for p in props[:5]])
        what = "Klienti ei leitud — lisa osapool enne." if not parties else "Hoonet ei leitud." if not props else "Mitu vastet, täpsusta:\n" + "\n".join("- " + o for o in opts)
        return ToolResult(content=what, summary="pakkumise mustand · täpsustus", clarify=True)
    prop = props[0]
    spaces = await children_of(session, prop.id, "space")
    chosen, missing = [], []
    for name in a.spaces:
        n = name.strip().lower()
        hits = [s for s in spaces if s.name.lower() == n] or [s for s in spaces if n in s.name.lower()]
        if len(hits) == 1:
            chosen.append(hits[0])
        elif not hits:
            missing.append(name)
        else:
            return ToolResult(content=f"„{name}” sobib mitmele pinnale: {', '.join(h.name for h in hits)} — milline?", summary="pakkumise mustand · täpsustus", clarify=True)
    if missing or not chosen:
        return ToolResult(content=f"Pinda ei leitud: {', '.join(missing) or '—'}. Hoone {prop.name} pinnad: {', '.join(s.name for s in spaces)}", summary="pakkumise mustand · täpsustus", clarify=True)
    st = await asset_statuses(session, chosen)
    busy = [s.name for s in chosen if st.get(s.id) not in ("vaba", "pakkumisel")]
    if busy:
        return ToolResult(content=f"Pind {', '.join(busy)} ei ole vaba ({', '.join(str(st.get(s.id)) for s in chosen)}).", summary="pakkumise mustand · pind hõivatud", clarify=True)
    card = {"type": "confirm", "id": f"c-{uuid.uuid4().hex[:8]}", "action": "create_quote", "title": f"Pakkumine · {parties[0].name}",
            "text": f"{prop.name}: {', '.join(s.name for s in chosen)}" + (f" · {a.period_months} kuud" if a.period_months else ""),
            "args": {"party_id": str(parties[0].id), "property_id": str(prop.id), "space_ids": [str(s.id) for s in chosen], "period_months": a.period_months},
            "requires_confirmation": True}
    return ToolResult(content=f"Valmis kinnituskaart: pakkumise mustand kliendile {parties[0].name}, {prop.name} {', '.join(s.name for s in chosen)}. Operaator kinnitab.",
                      summary=f"pakkumise mustand · {parties[0].name}", cards=[card])


class LeaseDraftIn(BaseModel):
    party: str = Field(description="Kliendi nimi või registrikood")
    property: str = Field(description="Hoone nimi või aadress")
    spaces: list[str] = Field(description="Pindade nimed")
    months: int | None = Field(default=None, ge=1, le=600)
    handover: str | None = Field(default=None, description="Üleandmispäev ISO (yyyy-mm-dd)")


async def create_lease_draft(session: AsyncSession, actor: Actor, a: LeaseDraftIn) -> ToolResult:
    r = await create_quote_draft(session, actor, QuoteDraftIn(party=a.party, property=a.property, spaces=a.spaces, period_months=a.months))
    if r.clarify or not r.cards:
        return r
    card = r.cards[0]
    args = {"party_id": card["args"]["party_id"], "property_id": card["args"]["property_id"], "spaces": [{"space_id": s} for s in card["args"]["space_ids"]],
            "months": a.months or 60, "handover": a.handover}
    card.update({"action": "create_lease", "title": card["title"].replace("Pakkumine", "Üürilepingu mustand"), "args": args})
    return ToolResult(content=r.content.replace("pakkumise mustand", "üürilepingu mustand"), summary=r.summary.replace("pakkumise", "lepingu"), cards=[card])


class SpecialTermIn(BaseModel):
    document: str = Field(description="Lepingu või pakkumise number/id")
    wish: str = Field(description="Mida eritingimus peab ütlema (vabas vormis, nt kliendi soov)")
    clause: str | None = Field(default=None, description="Punkt, mille see üle kirjutab (nt 4.4 või punkti id)")


async def draft_special_term(session: AsyncSession, actor: Actor, a: SpecialTermIn) -> ToolResult:
    """The wording itself comes from the model (the tool collects the context); the card lets the operator insert it."""
    rows = await _find_contract(session, a.document)
    ctx = ""
    target = None
    if len(rows) == 1 and a.clause:
        from app.domain.clauses import rendered_tree

        target = _pick_clause(await rendered_tree(session, contract_id=rows[0].id), a.clause)
        if target:
            ctx = f"Üle kirjutatav punkt §{target.display_number} ({target.container}): {target.text}"
    card = {"type": "draft", "id": f"d-{uuid.uuid4().hex[:8]}", "kind": "special_term", "title": "Eritingimuse sõnastus",
            "document": {"contract_id": str(rows[0].id) if len(rows) == 1 else None, "clause_id": str(target.id) if target else None, "overrides_label": f"p {target.display_number}" if target else None},
            "text": None}  # the loop fills `text` from the model's reply
    return ToolResult(content=f"Koosta eritingimuse sõnastus (3. isik, „Üürnik”/„Üürileandja”, kindel kõneviis, üks lause või kaks) soovile: {a.wish}\n{ctx}\n"
                              "Kirjuta sõnastus vastuse lõppu eraldi reale kujul SÕNASTUS: <tekst>.", summary="eritingimuse sõnastus", cards=[card])


class CommercialIn(BaseModel):
    quote: str = Field(description="Pakkumise number või id")
    instructions: str | None = Field(default=None, description="Soovid tekstile (toon, rõhuasetus)")


async def draft_commercial_text(session: AsyncSession, actor: Actor, a: CommercialIn) -> ToolResult:
    from app.domain import quotes as quotes_domain

    qs = await quotes_domain.list_quotes(session, view="all", q=a.quote if not _uuid(a.quote) else None)
    if _uuid(a.quote):
        qs = [r for r in qs if r[0].id == _uuid(a.quote)]
    if len(qs) != 1:
        return ToolResult(content="Pakkumist ei leitud.", summary="pakkumise tekst", clarify=True)
    q, party, prop = qs[0]
    b = await quotes_domain.quote_bundle(session, q, with_versions=False)
    facts = await quotes_domain.merge_context(session, b)
    card = {"type": "draft", "id": f"d-{uuid.uuid4().hex[:8]}", "kind": "commercial_text", "title": f"Pakkumise {q.number} tekst", "document": {"quote_id": str(q.id)}, "text": None}
    return ToolResult(content="Koosta pakkumise kommertstekst (sõbralik, konkreetne, 4–7 lauset, Teie-vorm) nende faktidega: " + "; ".join(f"{k}={v}" for k, v in facts.items())
                              + (f"\nSoovid: {a.instructions}" if a.instructions else "") + "\nKirjuta tekst vastuse lõppu kujul SÕNASTUS: <tekst>.", summary=f"pakkumise {q.number} tekst", cards=[card])


class ExplainIn(BaseModel):
    contract: str = Field(description="Lepingu number või id")
    clause: str = Field(description="Punkti number (nt 5.2) või id")


async def explain_clause(session: AsyncSession, actor: Actor, a: ExplainIn) -> ToolResult:
    from app.domain.clauses import rendered_tree

    rows = await _find_contract(session, a.contract)
    if len(rows) != 1:
        return ToolResult(content="Lepingut ei leitud.", summary="punkti selgitus", clarify=True)
    rendered = await rendered_tree(session, contract_id=rows[0].id)
    hit = _pick_clause(rendered, a.clause)
    if not hit:
        return ToolResult(content=f"Punkti {a.clause} ei ole lepingus {rows[0].number}.", summary="punkti selgitus · ei leitud", clarify=True)
    siblings = [r for r in rendered if r.parent_id == hit.parent_id and r.container == hit.container]
    ctx = "\n".join(f"[§{r.display_number}|{r.id}] {r.text}" for r in siblings[:12])
    clauses = {str(r.id): {"number": r.display_number, "contract_id": str(rows[0].id), "text": r.text[:200], "container": r.container} for r in rendered}
    return ToolResult(content=f"Selgita lihtsas keeles punkti [§{hit.display_number}|{hit.id}]: {hit.text}\nKontekst (sama jagu):\n{ctx}", summary=f"punkt §{hit.display_number}", clauses=clauses)


class PartyFromRegistryIn(BaseModel):
    query: str = Field(description="Ettevõtte nimi või registrikood äriregistrist")


async def create_party_from_registry(session: AsyncSession, actor: Actor, a: PartyFromRegistryIn) -> ToolResult:
    from app.integrations.ariregister import ariregister

    hits = await ariregister().search(a.query)
    if not hits:
        return ToolResult(content="Äriregistrist ei leitud.", summary="äriregister · 0", clarify=True)
    if len(hits) > 1 and not any(h.registry_code == a.query.strip() for h in hits):
        return ToolResult(content="Mitu vastet:\n" + "\n".join(f"- {h.name} · reg {h.registry_code}" for h in hits[:6]), summary="äriregister · täpsustus", clarify=True)
    h = next((x for x in hits if x.registry_code == a.query.strip()), hits[0])
    card = {"type": "confirm", "id": f"c-{uuid.uuid4().hex[:8]}", "action": "create_party", "title": f"Osapool · {h.name}", "text": f"reg {h.registry_code} · {h.address or ''}",
            "args": {"kind": "ee_company", "name": h.name, "registry_code": h.registry_code, "address": h.address, "vat_number": getattr(h, "vat_number", None), "roles": ["tenant"]},
            "requires_confirmation": True}
    return ToolResult(content=f"Kinnituskaart: osapool {h.name} (reg {h.registry_code}).", summary=f"osapool äriregistrist · {h.name}", cards=[card])


# ---------------------------------------------------------------- registry ---------------------------------------

TOOLS: list[Tool] = [
    Tool("search_portfolio", "Otsi kogu portfellist (lepingud, pakkumised, osapooled, pinnad, punktide sõnastus). Esimene valik, kui ei tea, kus vastus on.", SearchIn, search_portfolio),
    Tool("search_parties", "Leia osapool nime või registrikoodi järgi.", PartyIn, search_parties),
    Tool("get_property", "Hoone andmed ja selle pinnad (m², €/m², seis).", PropertyIn, get_property),
    Tool("list_spaces", "Pinnad üle hoonete, soovi korral oleku järgi (vaba, üüritud, pakkumisel).", SpacesIn, list_spaces),
    Tool("get_quote", "Pakkumise seis, summad, järgmine samm ja läbirääkimiste lõim; ilma argumendita kõik avatud pakkumised.", QuoteIn, get_quote),
    Tool("get_contract", "Lepingu kokkuvõte: pooled, esemed, kehtivad faktid, tähtajad.", ContractIn, get_contract),
    Tool("load_contract", "Kogu lepingu tekst punktide numbrite ja id-dega — ühe lepingu sisuküsimusteks ja tsiteerimiseks.", LoadIn, load_contract),
    Tool("get_effective_state", "Mis tegelikult kehtib: faktid + eritingimused, mis kirjutavad üle üld-/põhipunkte (allikapunktidega).", EffectiveIn, get_effective_state),
    Tool("list_key_dates", "Tähtajad kalendrist: lõppemised, indekseerimised, katseajad, palgaülevaatused; aasta või päevade arv ette.", KeyDatesIn, list_key_dates),
    Tool("get_audit_trail", "Sündmuslogi (decision memory): kes mida millal tegi; lepingu kaupa või viimased.", AuditIn, get_audit_trail),
    Tool("summarize_negotiation", "Läbirääkimiste käik: arutelud, ettepanekud, vastused, versioonid.", NegotiationIn, summarize_negotiation),
    Tool("create_quote_draft", "Valmista ette pakkumise mustand (klient + hoone + pinnad). Loob kinnituskaardi; ei salvesta ise.", QuoteDraftIn, create_quote_draft, True),
    Tool("create_lease_draft", "Valmista ette üürilepingu mustand ilma pakkumiseta. Loob kinnituskaardi; ei salvesta ise.", LeaseDraftIn, create_lease_draft, True),
    Tool("draft_special_term", "Sõnasta eritingimus (Lisa 3) soovi põhjal; operaator lisab selle ise.", SpecialTermIn, draft_special_term, True),
    Tool("draft_commercial_text", "Sõnasta pakkumise kommertstekst pakkumise faktidest.", CommercialIn, draft_commercial_text, True),
    Tool("explain_clause", "Selgita lepingupunkti lihtsas keeles (tsiteerib punkti).", ExplainIn, explain_clause),
    Tool("create_party_from_registry", "Loo osapool äriregistri andmetest (kinnituskaart).", PartyFromRegistryIn, create_party_from_registry, True),
]
TOOL_BY_NAME = {t.name: t for t in TOOLS}
