"""Indexation: resolving an indexation key date is what changes the rent.

Applying one writes a new version of the rent facts (``reason="indexation"``, valid from the indexation date) on the same
versioned chain an amendment uses; skipping it writes nothing. A fixed-% rule proposes old × (1 + rate) from the rent in
force — compounding, so a skipped year compounds from the lower base; CPI (THI) needs the % from the operator. The operator
can always change the amount (landlords round, waive, negotiate): both the proposed and the applied amount are kept.

Imported contracts carry indexations from before the import: ``proposal`` lists every open one with the chain, ``apply``
takes the operator's row-by-row answer, ``set_current_rent`` takes only today's rent (the common case — people know the rent
from their invoices, not its history)."""

from __future__ import annotations

import re
import uuid
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.errors import DomainError, NotFound
from app.domain.events import Actor, emit
from app.models.contracts import Contract, ContractFact, KeyDate

# the amounts an indexation moves, primary first: the one the operator confirms; the others follow by the same factor
RENT_KEYS = ("rent_monthly", "rent_per_m2", "fee_monthly")
_CPI = re.compile(r"tarbijahinna|\bTHI\b|\bCPI\b|hinnaindeks", re.IGNORECASE)
_PCT = re.compile(r"(\d+(?:[.,]\d+)?)\s*%")


def parse_amount(v: Any) -> float | None:
    """"1 250,50" / "1.250,50" / "7.60" / 1250.5 → float; anything that is not one number → None."""
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, int | float):
        return float(v)
    s = re.sub(r"[^\d,.]", "", str(v))
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".") if s.rfind(",") > s.rfind(".") else s.replace(",", "")
    elif s.count(",") == 1:
        s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def _decimals(v: Any) -> int:
    m = re.search(r"[.,](\d+)\s*$", re.sub(r"[^\d,.]", "", str(v))) if not isinstance(v, int | float) else None
    return max(2, len(m.group(1))) if m else 2


def _round(x: float, places: int = 2) -> float:
    return float(Decimal(str(x)).quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP))


def _like(original: Any, x: float) -> Any:
    """The new value in the old one's shape: a number stays a number; an imported string keeps its decimal comma."""
    places = _decimals(original)
    if isinstance(original, int | float) and not isinstance(original, bool):
        return _round(x, places)
    out = f"{_round(x, places):.{places}f}"
    return out.replace(".", ",") if re.search(r"\d,\d", str(original or "")) else out


def rule(contract: Contract, titles: list[str] | None = None) -> dict[str, Any]:
    """{"method": fixed_pct | cpi | None, "rate": float | None, "text": str | None} from the indexation fact (a platform
    lease stores method + rate; an import has the verbatim value/text), else from the key dates' titles („Üüri tõus 3%”)."""
    ix = (contract.current_values or {}).get("indexation") or {}
    if isinstance(ix, dict):
        value, text, rate = ix.get("value"), ix.get("text"), ix.get("rate")
    else:
        value, text, rate = ix, None, None
    blob = " ".join(str(x) for x in (value, text) if x)
    if value == "cpi" or _CPI.search(blob):
        return {"method": "cpi", "rate": None, "text": text or blob or None}
    if isinstance(rate, int | float) and rate > 0:
        return {"method": "fixed_pct", "rate": float(rate), "text": text}
    m = _PCT.search(blob) or next((m for t in titles or [] if (m := _PCT.search(t or ""))), None)
    if m:
        return {"method": "fixed_pct", "rate": float(m.group(1).replace(",", ".")), "text": text or blob or None}
    return {"method": None, "rate": None, "text": text or blob or None}


async def _current_rent_facts(session: AsyncSession, contract_id: uuid.UUID) -> list[ContractFact]:
    """The open (valid_to NULL) version of every rent key that holds one number, primary first."""
    rows = (await session.execute(select(ContractFact).where(ContractFact.contract_id == contract_id, ContractFact.key.in_(RENT_KEYS),
                                                             ContractFact.valid_to.is_(None)).order_by(ContractFact.recorded_at))).scalars()
    by_key: dict[str, ContractFact] = {}
    for f in rows:
        if parse_amount((f.value or {}).get("value")) is not None:
            by_key[f.key] = f  # latest recorded wins if two are open
    return [by_key[k] for k in RENT_KEYS if k in by_key]


async def _indexations(session: AsyncSession, contract_id: uuid.UUID) -> list[KeyDate]:
    return list((await session.execute(select(KeyDate).where(KeyDate.subject_id == contract_id, KeyDate.kind_code == "indexation",
                                                             KeyDate.deleted_at.is_(None)).order_by(KeyDate.due_date))).scalars())


async def proposal(session: AsyncSession, contract: Contract, today: date | None = None) -> dict[str, Any]:
    """What the catch-up card shows: the rule, the rent in force, and every open indexation that is due (oldest first) with
    the proposed chain. A step dated before the rent's current version (an amendment changed it later) is ``locked``: it
    can be marked done or skipped, but cannot change the rent any more."""
    today = today or date.today()
    kds = await _indexations(session, contract.id)
    r = rule(contract, [k.title for k in kds])
    facts = await _current_rent_facts(session, contract.id)
    primary = facts[0] if facts else None
    base = parse_amount((primary.value or {}).get("value")) if primary else None
    since = primary.valid_from if primary else None
    steps = []
    for kd in kds:
        if kd.resolution or kd.due_date > today:
            continue
        locked = bool(since and kd.due_date < since)
        proposed = None
        if base is not None and not locked and r["rate"] is not None:
            proposed = base = _round(base * (1 + r["rate"] / 100))
        steps.append({"key_date_id": kd.id, "due_date": kd.due_date, "title": kd.title, "locked": locked, "proposed": proposed})
    rent = None
    if primary:
        v = primary.value or {}
        rent = {"key": primary.key, "label": v.get("label") or primary.key, "unit": v.get("unit"), "value": parse_amount(v.get("value")),
                "valid_from": primary.valid_from, "reason": primary.reason}
    return {"rule": r, "rent": rent, "steps": steps,
            "applied": [{"key_date_id": k.id, "due_date": k.due_date, "resolution": k.resolution, "rent": (k.resolution_data or {}).get("rent")}
                        for k in kds if k.resolution]}


async def _write_version(session: AsyncSession, actor: Actor, contract: Contract, old: ContractFact, new_value: Any, valid_from: date,
                         provenance: dict[str, Any]) -> ContractFact:
    """One new fact version on the chain: the old one closes the day the new one starts (as ``apply_amendment`` does)."""
    v = dict(old.value or {})
    f = ContractFact(account_id=actor.account_id, contract_id=contract.id, key=old.key, reason="indexation", valid_from=valid_from,
                     value={"value": new_value, "unit": v.get("unit"), "label": v.get("label", old.key), "text": None}, provenance=provenance)
    session.add(f)
    await session.flush()
    old.valid_to, old.superseded_by = valid_from, f.id
    values = dict(contract.current_values or {})
    values[old.key] = {**(values.get(old.key) or {}), "value": new_value, "unit": v.get("unit"), "label": v.get("label", old.key)}
    contract.current_values = values
    return f


async def _anchor(session: AsyncSession, f: ContractFact) -> ContractFact:
    """The last version of this key that an indexation did not write (back along the superseded chain)."""
    cur = f
    while cur.reason == "indexation":
        prev = (await session.execute(select(ContractFact).where(ContractFact.superseded_by == cur.id))).scalars().first()
        if prev is None:
            break
        cur = prev
    return cur


async def _set_rent(session: AsyncSession, actor: Actor, contract: Contract, amount: float, valid_from: date, provenance: dict[str, Any]
                    ) -> tuple[list[uuid.UUID], dict[str, Any] | None]:
    """The primary rent becomes ``amount`` from ``valid_from``; the other rent keys follow by the same factor."""
    facts = await _current_rent_facts(session, contract.id)
    if not facts:
        return [], None
    primary = facts[0]
    if primary.valid_from and valid_from < primary.valid_from:
        raise DomainError(f"Üüri on hiljem muudetud ({primary.valid_from.strftime('%d.%m.%Y')}) — selle indekseerimise saab märkida ainult tehtuks või vahele jäetuks")
    old = parse_amount((primary.value or {}).get("value"))
    if not old or amount <= 0:
        raise DomainError("Üür peab olema positiivne summa")
    if _round(amount) == _round(old):
        return [], {"key": primary.key, "old": old, "new": old}
    factor = amount / old
    # the others follow from where the indexations started (not from last year's rounded value — no drift across a chain)
    pa = await _anchor(session, primary)
    pa_v = parse_amount((pa.value or {}).get("value"))
    ids = []
    for f in facts:
        cur = parse_amount((f.value or {}).get("value"))
        if f is primary:
            new = amount
        else:
            fa = await _anchor(session, f)
            fa_v = parse_amount((fa.value or {}).get("value"))
            same_start = fa.valid_from == pa.valid_from and pa_v and fa_v is not None
            new = fa_v * amount / pa_v if same_start else cur * factor  # type: ignore[operator]
        written = await _write_version(session, actor, contract, f, _like((f.value or {}).get("value"), new), valid_from, provenance)
        ids.append(written.id)
    return ids, {"key": primary.key, "old": old, "new": _round(amount), "pct": _round((factor - 1) * 100, 3)}


async def apply(session: AsyncSession, actor: Actor, contract: Contract, steps: list[dict[str, Any]]) -> list[KeyDate]:
    """The operator's answer, row by row (oldest first): ``{"key_date_id", "applied": bool, "amount"?: float, "pct"?: float}``.
    Applied with no amount → the rule's proposal from the rent in force (an error when the rule has no rate, e.g. CPI).
    Applied on a contract with no rent amount, or on a locked step → done without changing the rent."""
    kds = {k.id: k for k in await _indexations(session, contract.id)}
    r = rule(contract, [k.title for k in kds.values()])
    ordered = []
    for s in steps:
        kd = kds.get(uuid.UUID(str(s["key_date_id"])))
        if kd is None:
            raise NotFound("Indekseerimise tähtaega ei leitud sellel lepingul")
        if kd.resolution:
            raise DomainError(f"Indekseerimine {kd.due_date.strftime('%d.%m.%Y')} on juba kinnitatud")
        ordered.append((kd, s))
    ordered.sort(key=lambda x: x[0].due_date)
    now = datetime.now(UTC)
    out = []
    for kd, s in ordered:
        if not s.get("applied"):
            kd.resolution, kd.resolution_data = "skipped", None
        else:
            facts = await _current_rent_facts(session, contract.id)
            primary = facts[0] if facts else None
            locked = bool(primary and primary.valid_from and kd.due_date < primary.valid_from)
            data: dict[str, Any] = {}
            if primary and not locked:
                old = parse_amount((primary.value or {}).get("value")) or 0.0
                pct = s.get("pct") if s.get("pct") is not None else r["rate"]
                proposed = _round(old * (1 + pct / 100)) if pct is not None else None
                amount = s.get("amount") if s.get("amount") is not None else proposed
                if amount is None:
                    raise DomainError(f"Sisesta indekseerimise {kd.due_date.strftime('%d.%m.%Y')} uus üür või protsent")
                ids, rent = await _set_rent(session, actor, contract, float(amount), kd.due_date,
                                            {"key_date_id": str(kd.id), "rule": r["method"], "rate": pct, "proposed": proposed})
                data = {"fact_ids": [str(i) for i in ids], "rent": {**(rent or {}), "proposed": proposed}}
            kd.resolution, kd.resolution_data = "done", data or None
        kd.resolved_at, kd.resolved_by = now, actor.user_id
        emit(session, actor, "key_date", kd.id, f"key_date.{kd.resolution}", {"contract_id": contract.id, "kind": "indexation", "due_date": kd.due_date,
                                                                             **({"data": kd.resolution_data} if kd.resolution_data else {})})
        out.append(kd)
    await session.flush()
    return out


async def set_current_rent(session: AsyncSession, actor: Actor, contract: Contract, amount: float, today: date | None = None) -> list[KeyDate]:
    """„Tean ainult praegust üüri”: every open indexation that is due is marked done; when the rent differs, ONE new version
    starts from the latest of them (no year-by-year detail). The latest one carries the version, so undoing it takes it back."""
    today = today or date.today()
    due = [k for k in await _indexations(session, contract.id) if not k.resolution and k.due_date <= today]
    facts = await _current_rent_facts(session, contract.id)
    if not facts:
        raise DomainError("Lepingul pole registris üüri summat, mida muuta")
    since = facts[0].valid_from
    when = max([k.due_date for k in due if not since or k.due_date >= since] or [today])
    ids, rent = await _set_rent(session, actor, contract, float(amount), when,
                                {"mode": "current_rent", "key_date_ids": [str(k.id) for k in due]})
    now = datetime.now(UTC)
    carrier = next((k for k in reversed(due) if k.due_date == when), None)
    for k in due:
        k.resolution, k.resolved_at, k.resolved_by = "done", now, actor.user_id
        k.resolution_data = {"mode": "current_rent", **({"fact_ids": [str(i) for i in ids], "rent": rent} if k is carrier else {})}
        emit(session, actor, "key_date", k.id, "key_date.done", {"contract_id": contract.id, "kind": "indexation", "due_date": k.due_date, "mode": "current_rent"})
    if not carrier and ids:  # no indexation was due (or all before an amendment): the change is still recorded
        emit(session, actor, "contract", contract.id, "contract.rent_set", {"rent": rent, "valid_from": when})
    await session.flush()
    return due


async def revert_facts(session: AsyncSession, actor: Actor, contract_id: uuid.UUID, fact_ids: list[uuid.UUID]) -> None:
    """Take back the versions an indexation wrote: the previous version opens again. Only while they are still current."""
    contract = await session.get(Contract, contract_id)
    if contract is None:
        raise NotFound()
    facts = [f for f in (await session.execute(select(ContractFact).where(ContractFact.id.in_(fact_ids)))).scalars()]
    if any(f.valid_to is not None for f in facts):
        raise DomainError("Üüri on pärast seda uuesti muudetud — ava enne hilisem indekseerimine või muudatus")
    values = dict(contract.current_values or {})
    for f in facts:
        prev = (await session.execute(select(ContractFact).where(ContractFact.superseded_by == f.id))).scalars().first()
        if prev is not None:
            prev.valid_to, prev.superseded_by = None, None
            pv = prev.value or {}
            values[f.key] = {**(values.get(f.key) or {}), "value": pv.get("value"), "unit": pv.get("unit"), "label": pv.get("label", f.key)}
        await session.delete(f)
    contract.current_values = values
    emit(session, actor, "contract", contract_id, "contract.indexation_reverted", {"fact_ids": [str(i) for i in fact_ids]})
    await session.flush()
