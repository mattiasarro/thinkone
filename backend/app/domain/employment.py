"""Employment contracts (tööleping) — the second contract type on the same engine (spec „Töölepingute vertikaal”).

Configuration + a thin code module: the position (ametikoht) is the unit, the contract is a quota allocation on it,
the key dates add probation and salary review, the main terms follow TLS §5 essentials. Negotiation, versions,
share links and acceptance are the engine's — nothing here redefines them.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.documents import render
from app.domain.account import effective_settings, get_account
from app.domain.assets import get_asset
from app.domain.attachments import list_attachments
from app.domain.clauses import Node
from app.domain.contracts import create_contract
from app.domain.errors import DomainError
from app.domain.events import Actor, emit
from app.domain.parties import get_party
from app.models.contracts import Contract
from app.models.core import Company, Party
from app.models.registry import Asset

FACT_LABELS = {"salary": "Brutotöötasu", "position": "Ametikoht", "start_date": "Tööle asumine", "end_date": "Lepingu lõpp", "probation_end": "Katseaja lõpp",
               "salary_review": "Palgaülevaatus", "working_time": "Tööaeg", "vacation_days": "Põhipuhkus", "place": "Töö tegemise koht"}
WORKING_TIME_DEFAULT = "täistööaeg, 40 tundi nädalas (8 tundi päevas, viiel päeval nädalas)"


def _et(v: Any, frac: int = 2) -> str:
    return render.fmt_num(v, frac)


def default_terms(*, start: date, position: Asset, salary: float, months: int | None, probation_months: int, working_time: str | None,
                  place: str | None, salary_review: date | None, vacation_days: int, pay_day: int) -> dict[str, Any]:
    from app.domain.leases import add_months

    return {"start": start.isoformat(), "months": months, "position_id": str(position.id), "salary": float(salary), "probation_months": probation_months,
            "working_time": working_time or WORKING_TIME_DEFAULT, "place": place, "vacation_days": vacation_days, "pay_day": pay_day,
            "salary_review": (salary_review or add_months(start, 12)).isoformat(), "term_notes": None}


async def deal(session: AsyncSession, c: Contract) -> dict[str, Any]:
    from app.domain.leases import add_months, end_of_term

    terms = c.terms or {}
    settings = effective_settings(await get_account(session, c.account_id))
    start = date.fromisoformat(terms["start"])
    months = int(terms["months"]) if terms.get("months") else None
    end = end_of_term(start, months) if months else None
    position = await get_asset(session, uuid.UUID(str(terms["position_id"])))
    department = await get_asset(session, position.parent_id) if position.parent_id else None
    probation_months = int(terms.get("probation_months") or 0)
    probation_end = add_months(start, probation_months) if probation_months else None
    review = date.fromisoformat(terms["salary_review"]) if terms.get("salary_review") else None
    pattrs = position.attributes or {}
    d: dict[str, Any] = {
        "vertical": "employment", "terms": terms, "start": start, "handover": start, "months": months, "end": end, "position": position, "department": department,
        "salary": float(terms.get("salary") or 0), "probation_months": probation_months, "probation_end": probation_end, "salary_review": review,
        "working_time": terms.get("working_time") or WORKING_TIME_DEFAULT, "place": terms.get("place"), "vacation_days": int(terms.get("vacation_days") or 28),
        "pay_day": int(terms.get("pay_day") or 10), "duties": pattrs.get("duties"), "requirements": pattrs.get("requirements"),
        "term_notes": terms.get("term_notes") or "Puuduvad.", "settings": settings, "spaces": [], "property": None,
        "totals": {"monthly_net": float(terms.get("salary") or 0), "area_m2": 0, "vat_taxable": False, "vat": 0.0, "monthly_gross": float(terms.get("salary") or 0),
                   "avg_price_per_m2": 0, "monthly_net_avg": float(terms.get("salary") or 0), "stepped": False, "utility_winter": None, "utility_summer": None, "vat_rate": 0.0},
        "deposit": 0.0, "deposit_months": 0, "purpose": "", "indexation": {}, "representatives": {"landlord": [], "tenant": []}, "uniform_price": True,
        "fact_labels": FACT_LABELS, "title": f"Tööleping — {position.name}",
    }
    d["facts"] = {
        "salary": {"value": d["salary"], "unit": "€/kuus"}, "position": {"value": position.name, "text": department.name if department else None},
        "start_date": {"value": start.isoformat()}, "end_date": {"value": end.isoformat() if end else None, "text": "tähtajatu" if not end else None},
        "probation_end": {"value": probation_end.isoformat() if probation_end else None}, "salary_review": {"value": review.isoformat() if review else None},
        "working_time": {"value": d["working_time"]}, "vacation_days": {"value": d["vacation_days"], "unit": "päeva"}, "place": {"value": d["place"]},
    }
    d["key_dates"] = {"start": start, "end": end, "probation": probation_end, "salary_review": review}
    d["allocations"] = [(position.id, "quota", 1, start, end)]
    return d


def main_terms(d: dict[str, Any], company: Company | None, party: Party, contact: dict[str, Any]) -> list[Node]:
    """TLS §5 essentials as sections: Pooled · Töö · Töötasu · Tööaeg ja puhkus · Tähtaeg."""
    pos: Asset = d["position"]
    start = render.fmt_date(d["start"])
    employer = " · ".join(x for x in [company.name if company else "", f"reg {company.registry_code}" if company and company.registry_code else "", company.address if company else "",
                                       company.email if company else "", company.phone if company else ""] if x)
    employee = " · ".join(x for x in [party.name, f"isikukood {party.personal_code}" if party.personal_code else "", party.address or "",
                                       contact.get("email") or party.email or "", contact.get("phone") or party.phone or ""] if x)
    duties = d["duties"] or "Tööülesanded on kirjeldatud ametijuhendis (Lisa 1)."
    place = d["place"] or (company.address if company and company.address else "Tööandja asukoht")
    if d["months"]:
        term = (f"Leping on sõlmitud tähtajaliselt {d['months']} kuuks alates {start} kuni {render.fmt_date(d['end'])}"
                " (tähtajalise lepingu alus: ajutise iseloomuga töö).")
    else:
        term = f"Leping on sõlmitud tähtajatult; Töötaja asub tööle {start}."
    probation = (f"Katseaeg on {d['probation_months']} kuud ja lõpeb {render.fmt_date(d['probation_end'])}." if d["probation_months"] else "Katseaega ei kohaldata.")
    sec = lambda title, kids: Node(text="", heading=title, number_style="decimal", category="main", children=kids)  # noqa: E731
    cl = lambda title, text, key=None, note=None: Node(text=text, heading=title, number_style="decimal", category="main", extra={"fact_key": key, "origin_note": note})  # noqa: E731
    return [
        sec("Pooled", [cl("Tööandja", employer, note="profiilist"), cl("Töötaja", employee, note="osapoole kaardilt")]),
        sec("Töö", [cl("Ametikoht", f"Töötaja asub tööle ametikohal {pos.name}{(' (' + d['department'].name + ')') if d['department'] else ''}.", note="ametikoha kaardilt"),
                    cl("Tööülesanded", duties, "duties"), cl("Töö tegemise koht", f"Töö tegemise koht on {place}.", "place")]),
        sec("Töötasu", [cl("Töötasu", f"Töötaja brutotöötasu on {_et(d['salary'])} eurot kuus. Töötasu makstakse üks kord kuus, hiljemalt järgneva kuu {d['pay_day']}. kuupäeval, "
                                      "Töötaja pangakontole.", "salary"),
                        cl("Palgaülevaatus", f"Pooled vaatavad töötasu üle {render.fmt_date(d['salary_review'])} ja seejärel kord aastas." if d["salary_review"] else "Palgaülevaatuse aega ei ole kokku lepitud.", "salary_review")]),
        sec("Tööaeg ja puhkus", [cl("Tööaeg", f"Töötaja tööaeg on {d['working_time']}.", "working_time"),
                                 cl("Puhkus", f"Töötaja põhipuhkus on {d['vacation_days']} kalendripäeva aastas.", "vacation_days")]),
        sec("Tähtaeg", [cl("Lepingu tähtaeg", term, "months"), cl("Katseaeg", probation, "probation_months"), cl("Tähtaja erisused", d["term_notes"], "term_notes")]),
    ]


async def annexes(session: AsyncSession, c: Contract, d: dict[str, Any]) -> list[dict[str, Any]]:
    """Lisa 1 ametijuhend (the position's attachment), Lisa 2 —, Lisa 3 eritingimused, 4+ uploads (spec: vertical config decides Lisa 1–2)."""
    pos: Asset = d["position"]
    job = next((a for a in await list_attachments(session, subject_type="asset", subject_id=pos.id) if a.role in ("generic", "annex")), None)
    items = [{"number": 1, "title": f"Ametijuhend — {pos.name}", "attachment_id": job.id if job else None, "kind": "job_description", "space_id": None, "missing": job is None},
             {"number": 3, "title": "Eritingimused", "attachment_id": None, "kind": "special_terms", "space_id": None, "missing": False}]
    n = 4
    for a in sorted(await list_attachments(session, subject_type="contract", subject_id=c.id, role="annex"), key=lambda a: a.created_at):
        items.append({"number": n, "title": a.filename, "attachment_id": a.id, "kind": "upload", "space_id": None, "missing": False})
        n += 1
    return items


async def create_draft(session: AsyncSession, actor: Actor, *, party_id: uuid.UUID, position_id: uuid.UUID, salary: float, start: date, months: int | None = None,
                       probation_months: int = 4, working_time: str | None = None, place: str | None = None, salary_review: date | None = None,
                       vacation_days: int = 28, pay_day: int = 10, company_id: uuid.UUID | None = None, contact: dict[str, Any] | None = None) -> Contract:
    from app.domain import leases
    from app.domain.registry import is_inactive

    party = await get_party(session, party_id)
    position = await get_asset(session, position_id)
    if position.type_code != "position":
        raise DomainError("Tööleping sõlmitakse ametikohale")
    if is_inactive(position):
        raise DomainError("Ametikoht ei ole aktiivne")
    if salary <= 0:
        raise DomainError("Töötasu peab olema suurem kui 0")
    if probation_months < 0 or probation_months > 4:
        raise DomainError("Katseaeg võib olla kuni 4 kuud")
    company = await session.get(Company, company_id or position.company_id) if (company_id or position.company_id) else None
    contact = contact or {"name": party.contact_name or party.name, "email": party.email or "", "phone": party.phone or ""}
    terms = default_terms(start=start, position=position, salary=salary, months=months, probation_months=probation_months, working_time=working_time, place=place,
                          salary_review=salary_review, vacation_days=vacation_days, pay_day=pay_day)
    c = await create_contract(session, actor, type_code="employment", title="Tööleping", number=await leases.next_number(session, "TL"), status="draft", origin="platform",
                              company_id=company.id if company else None, parties=[{"party_id": party.id, "role": "employee", "is_primary": True, "source": "manual"}],
                              category="employment", start_date=start, end_date=leases.end_of_term(start, months) if months else None)
    c.terms, c.contact, c.has_clause_tree = terms, contact, True
    await session.flush()
    template_id = await leases._resolve_template(session, c, None)
    if template_id:
        await leases._copy_general_terms(session, actor, c, template_id)
    else:
        emit(session, actor, "contract", c.id, "contract.no_general_terms", {"contract_type": "employment"})
    await leases.rebuild_main_terms(session, actor, c)
    emit(session, actor, "contract", c.id, "contract.draft_generated", {"number": c.number, "party_id": party.id, "party_name": party.name, "position_id": position.id,
                                                                         "position": position.name, "start": start, "months": months, "salary": salary, "template_id": template_id})
    return c


async def update_terms(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, patch: dict[str, Any], *, expected_version: int | None = None,
                       reason: str | None = None) -> Contract:
    from app.domain import leases
    from app.domain.contracts import get_contract
    from app.domain.errors import Conflict

    c = await get_contract(session, contract_id)
    leases._editable(c)
    if expected_version is not None and c.version != expected_version:
        raise Conflict()
    terms = dict(c.terms or {})
    changes: dict[str, Any] = {}
    for key in ("start", "months", "salary", "probation_months", "working_time", "place", "salary_review", "vacation_days", "pay_day", "term_notes"):
        if key in patch and patch[key] != terms.get(key):
            if key in ("start", "salary_review") and patch[key]:
                date.fromisoformat(str(patch[key]))
            if key == "salary" and float(patch[key]) <= 0:
                raise DomainError("Töötasu peab olema suurem kui 0")
            if key == "probation_months" and not (0 <= int(patch[key]) <= 4):
                raise DomainError("Katseaeg võib olla kuni 4 kuud")
            changes[key] = [terms.get(key), patch[key]]
            terms[key] = patch[key]
    if not changes:
        return c
    c.terms = terms
    c.version += 1
    emit(session, actor, "contract", c.id, "contract.terms_updated", changes, reason=reason)
    await leases.rebuild_main_terms(session, actor, c)
    return c
