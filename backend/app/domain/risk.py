"""Risk report — spec stage 04 p 2: informational, never blocking. Rule-based score over real signals (demo ``riskHinne``)."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.documents.render import fmt_num
from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.domain.parties import get_party
from app.integrations.risk import RiskData, risk_source
from app.models.risk import RiskReport

LEVEL_POINTS = {"KÕRGE": 3, "KESKMINE": 1, "MADAL": 0}


def _eurk(v: float | None) -> str:
    if v is None:
        return "—"
    return f"{fmt_num(v / 1000, 0)} k€" if abs(v) >= 10000 else f"{fmt_num(v, 0)} €"


def score(data: RiskData, *, monthly_rent: float | None = None, today: date | None = None) -> tuple[str, int, list[dict[str, Any]]]:
    """Signals from the available sources; each signal cites its source. Missing sources are listed, not scored."""
    today = today or date.today()
    S: list[dict[str, Any]] = []

    def add(source: str, level: str, text: str) -> None:
        S.append({"source": source, "level": level, "text": text})

    status = (data.status or "").lower()
    if data.status and not any(w in status for w in ("kantud", "registered", "aktiivne", "active")):
        add("Äriregister", "KÕRGE", f"Staatus: {data.status}")
    elif data.registered_on:
        try:
            reg = date.fromisoformat(data.registered_on[:10])
            years = (today - reg).days / 365.25
            add("Äriregister", "KESKMINE" if years < 2 else "MADAL",
                f"Registrisse kantud {reg.strftime('%d.%m.%Y')} · {'alla aasta' if years < 1 else f'{int(years)} a'} tegutsenud{' — noor ettevõte' if years < 2 else ''}")
        except ValueError:
            add("Äriregister", "MADAL", f"Staatus: {data.status or 'registrisse kantud'}")
    elif data.status:
        add("Äriregister", "MADAL", f"Staatus: {data.status}")
    if "EMTA · maksuvõlg" not in data.unavailable:
        if data.debt and (data.debt.get("amount") or 0) > 0:
            amt = float(data.debt.get("amount") or 0)
            scheduled = float(data.debt.get("scheduled") or 0) >= amt - 0.5
            add("EMTA · maksuvõlg", "KESKMINE" if scheduled else "KÕRGE",
                f"Maksuvõlg {fmt_num(amt)} €{' — tasumisgraafikus' if scheduled else ''}{' · vanim nõue ' + str(data.debt.get('oldest')) if data.debt.get('oldest') else ''}")
        else:
            add("EMTA · maksuvõlg", "MADAL", f"Maksuvõlga ei ole{' (seis ' + data.as_of['debt'] + ')' if data.as_of.get('debt') else ''}")
    kv = [q for q in data.quarters if q.get("turnover") is not None]
    last4, prev4 = kv[-4:], kv[-8:-4]
    turnover12 = None
    if len(last4) == 4:
        turnover12 = sum(q["turnover"] for q in last4)
        if len(prev4) == 4 and sum(q["turnover"] for q in prev4) >= 20000:
            m = turnover12 / sum(q["turnover"] for q in prev4) - 1
            add("EMTA · käive", "KESKMINE" if m < -0.3 else "MADAL", f"Viimase 4 kvartali käive {_eurk(turnover12)} · {'+' if m >= 0 else '−'}{fmt_num(abs(m) * 100, 0)} % võrreldes eelmise 4 kvartaliga")
        else:
            add("EMTA · käive", "MADAL", f"Viimase 4 kvartali käive {_eurk(turnover12)}")
    if monthly_rent and turnover12 and turnover12 > 0:
        share = monthly_rent * 12 / turnover12
        add("Üür vs käive", "KESKMINE" if share > 0.15 else "MADAL", f"Pakutav üür {fmt_num(monthly_rent, 0)} €/kuu on {'alla 1' if share < 0.01 else fmt_num(share * 100, 0)} % aastakäibest")
    points = sum(LEVEL_POINTS.get(s["level"], 0) for s in S)
    level = "KÕRGE" if points >= 3 else "KESKMINE" if points >= 1 else "MADAL"
    return level, points, S


async def latest(session: AsyncSession, party_id: uuid.UUID) -> RiskReport | None:
    return (await session.execute(select(RiskReport).where(RiskReport.party_id == party_id).order_by(RiskReport.created_at.desc()).limit(1))).scalar_one_or_none()


async def history(session: AsyncSession, party_id: uuid.UUID) -> list[RiskReport]:
    return list((await session.execute(select(RiskReport).where(RiskReport.party_id == party_id).order_by(RiskReport.created_at.desc()))).scalars())


async def get_report(session: AsyncSession, report_id: uuid.UUID) -> RiskReport:
    r = await session.get(RiskReport, report_id)
    if not r:
        raise NotFound("Riskiraportit ei leitud")
    return r


async def order(session: AsyncSession, actor: Actor, party_id: uuid.UUID, *, inline: bool | None = None) -> RiskReport:
    """Queue a report (worker fan-out). In fake mode (tests, dev without credentials) it is generated inline."""
    from app.infra.settings import get_settings

    party = await get_party(session, party_id)
    if party.kind == "person" or not party.registry_code:
        raise DomainError("Riskiraport käib ettevõtte kohta — osapoolel puudub registrikood")
    r = RiskReport(account_id=actor.account_id, party_id=party.id, status="queued", requested_by=actor.user_id, created_at=datetime.now(UTC))
    session.add(r)
    await session.flush()
    emit(session, actor, "party", party.id, "risk_report.ordered", {"report_id": r.id, "registry_code": party.registry_code})
    if inline if inline is not None else get_settings().mode_for("risk") != "live":
        await generate(session, actor, r.id)
    else:
        from app.worker.tasks import enqueue_risk_report

        await enqueue_risk_report(session, actor.account_id, r.id)
    return r


async def _monthly_rent(session: AsyncSession, party_id: uuid.UUID) -> float | None:
    from app.domain import quotes as quotes_domain

    best = None
    for q, _, _ in await quotes_domain.list_quotes(session, view="all", party_id=party_id):
        v = (q.totals or {}).get("monthly_net")
        if v:
            best = max(best or 0, float(v))
    return best


async def generate(session: AsyncSession, actor: Actor, report_id: uuid.UUID) -> RiskReport:
    r = await get_report(session, report_id)
    party = await get_party(session, r.party_id)
    try:
        data = await risk_source().fetch(party.registry_code or "")
        level, points, signals = score(data, monthly_rent=await _monthly_rent(session, party.id))
        r.status, r.score, r.points, r.signals = "ready", level, points, signals
        r.sources = {"registry_code": data.registry_code, "name": data.name, "status": data.status, "registered_on": data.registered_on, "legal_form": data.legal_form,
                     "debt": data.debt, "quarters": data.quarters[-8:], "activity": data.activity, "unavailable": data.unavailable, "as_of": data.as_of}
        r.summary = f"{level} · {points} punkti · {sum(1 for s in signals if s['level'] != 'MADAL')} tähelepanekut · liidestamata: {', '.join(data.unavailable) or '—'}"
        r.generated_at = datetime.now(UTC)
        emit(session, actor, "party", party.id, "risk_report.generated", {"report_id": r.id, "score": level, "points": points, "signals": len(signals), "unavailable": data.unavailable})
    except Exception as e:  # noqa: BLE001
        r.status, r.error = "failed", str(e)[:500]
        emit(session, actor, "party", party.id, "risk_report.failed", {"report_id": r.id, "error": r.error})
    return r
