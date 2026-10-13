"""Rent, stepped rent, VAT presentation (spec „Hinnastus ja käibemaks”). Pure functions; money is net."""

from __future__ import annotations

from datetime import date
from typing import Any


def vat_rate(settings: dict[str, Any], on: date | None = None) -> float:
    """The standard rate in force on ``on`` — a dated config value, never a hard-coded number."""
    on = on or date.today()
    rates = sorted((settings.get("vat_rates") or [{"from": "1900-01-01", "rate": 0.24}]), key=lambda r: r["from"])
    current = rates[0]["rate"]
    for r in rates:
        if date.fromisoformat(r["from"]) <= on:
            current = r["rate"]
    return float(current)


def normalise_schedule(schedule: list[dict[str, Any]] | None, base_price: float | None) -> list[dict[str, Any]] | None:
    """Sorted steps; the last step is open-ended (until_month None). Empty/one-step schedules collapse to None."""
    if not schedule:
        return None
    steps = []
    for s in schedule:
        price = s.get("price")
        if price is None:
            continue
        um = s.get("until_month")
        steps.append({"until_month": int(um) if um not in (None, "") else None, "price": float(price)})
    if not steps:
        return None
    closed = sorted((s for s in steps if s["until_month"] is not None), key=lambda s: s["until_month"])
    open_steps = [s for s in steps if s["until_month"] is None]
    tail = open_steps[-1] if open_steps else {"until_month": None, "price": float(base_price or closed[-1]["price"])}
    result = closed + [tail]
    if len(result) == 1:
        return None
    return result


def weighted_price(schedule: list[dict[str, Any]] | None, price: float, period_months: int) -> float:
    """Average €/m² over the lease period (demo ``offerTotals``: the Kokkuvõte uses the weighted average)."""
    if not schedule or period_months <= 0:
        return price
    total, prev = 0.0, 0
    for step in schedule:
        end = period_months if step["until_month"] is None else min(step["until_month"], period_months)
        if end > prev:
            total += (end - prev) * step["price"]
            prev = end
        if prev >= period_months:
            break
    if prev < period_months:
        total += (period_months - prev) * schedule[-1]["price"]
    return total / period_months


def first_price(schedule: list[dict[str, Any]] | None, price: float) -> float:
    return schedule[0]["price"] if schedule else price


def space_line(*, area: float, price: float, schedule: list[dict[str, Any]] | None, period_months: int) -> dict[str, Any]:
    p0 = first_price(schedule, price)
    avg = weighted_price(schedule, price, period_months)
    return {"area_m2": area, "price_per_m2": p0, "avg_price_per_m2": round(avg, 4), "monthly_net": round(area * p0, 2),
            "monthly_net_avg": round(area * avg, 2), "stepped": bool(schedule)}


def quote_totals(lines: list[dict[str, Any]], *, vat_taxable: bool, rate: float, utility_winter: float | None, utility_summer: float | None) -> dict[str, Any]:
    area = round(sum(line["area_m2"] for line in lines), 2)
    net = round(sum(line["monthly_net"] for line in lines), 2)
    net_avg = round(sum(line["monthly_net_avg"] for line in lines), 2)
    vat = round(net * rate, 2) if vat_taxable else 0.0
    return {
        "area_m2": area, "monthly_net": net, "monthly_net_avg": net_avg, "avg_price_per_m2": round(net / area, 2) if area else 0.0,
        "vat_taxable": vat_taxable, "vat_rate": rate if vat_taxable else 0.0, "vat": vat, "monthly_gross": round(net + vat, 2),
        "utility_winter": round(area * utility_winter, 2) if utility_winter is not None else None,
        "utility_summer": round(area * utility_summer, 2) if utility_summer is not None else None,
        "stepped": any(line["stepped"] for line in lines),
    }


def deposit(monthly_net: float, months: int) -> float:
    return round(monthly_net * months, 2)
