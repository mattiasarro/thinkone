"""Risk data sources behind one seam (architecture §7: fan-out in the worker, raw payloads snapshotted).

Open data first (the demo's ``tools/riskiandmed.py``): e-Äriregister status/age, EMTA tax-debtor list and
quarterly taxes/turnover/employees. Paid sources (Krediidiinfo, Inforegister, Kohtutäitur) are declared here as
unavailable until credentials arrive — the report shows them as „liidestamata”, never as green.
"""

from __future__ import annotations

import csv
import io
import os
import tempfile
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx
import structlog

from app.infra.settings import get_settings

log = structlog.get_logger()

EMTA_DEBT = "https://ncfailid.emta.ee/s/XKJLjtynFeYdGyC/download/maksuvolglaste_nimekiri.csv"
EMTA_TAXES = [
    ("https://ncfailid.emta.ee/s/bCszrta8THHA9xn/download/tasutud_maksud_varasemad_aastad.csv", "maksud_varasemad.csv"),
    ("https://ncfailid.emta.ee/s/DFHQjB2Rsq3CK7p/download/tasutud_maksud_kaesolev_aasta.csv", "maksud_kaesolev.csv"),
]
CACHE_TTL = 20 * 3600


@dataclass
class RiskData:
    registry_code: str
    name: str | None = None
    status: str | None = None  # registry status text
    registered_on: str | None = None  # ISO
    legal_form: str | None = None
    debt: dict[str, Any] | None = None  # {amount, disputed, scheduled, oldest, as_of}
    quarters: list[dict[str, Any]] = field(default_factory=list)  # [{year, q, turnover, taxes, labour, employees}]
    activity: str | None = None
    unavailable: list[str] = field(default_factory=list)  # sources we could not reach / have no access to
    as_of: dict[str, str] = field(default_factory=dict)


class RiskSource(Protocol):
    async def fetch(self, registry_code: str) -> RiskData: ...


PAID_SOURCES = ["Krediidiinfo", "Inforegister", "Kohtutäitur"]


class FakeRiskSource:
    """Deterministic from the registry code: last digit 9 → tax debt; 8 → young company; 7 → deleted."""

    async def fetch(self, registry_code: str) -> RiskData:
        last = registry_code[-1] if registry_code else "0"
        d = RiskData(registry_code=registry_code, name=f"Ettevõte {registry_code}", status="Registrisse kantud", registered_on="2015-03-02", legal_form="OÜ",
                     unavailable=PAID_SOURCES + ["Majandusaasta aruanded"], as_of={"debt": "2026-10-13", "quarters": "2026-Q3"})
        if last == "8":
            d.registered_on = "2025-06-15"
        if last == "7":
            d.status = "Kustutatud"
        if last == "9":
            d.debt = {"amount": 12400.0, "disputed": 0.0, "scheduled": 0.0, "oldest": "2026-02-10"}
        base = 120000.0 if last != "6" else 20000.0
        d.quarters = [{"year": 2025 + (i // 4), "q": i % 4 + 1, "turnover": base * (1 + i * 0.02), "taxes": base * 0.1, "labour": base * 0.2, "employees": 12} for i in range(8)]
        d.activity = "Hulgikaubandus"
        return d


class OpenDataRiskSource:
    """Live: äriregister (status, legal form) via the configured adapter + EMTA open-data CSVs cached on disk."""

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self.transport = transport

    async def fetch(self, registry_code: str) -> RiskData:
        from app.integrations.ariregister import ariregister

        d = RiskData(registry_code=registry_code, unavailable=list(PAID_SOURCES) + ["Majandusaasta aruanded"])
        try:
            rec = await ariregister().detail(registry_code) or next(iter(await ariregister().lookup(registry_code)), None)
            if rec:
                d.name, d.status, d.legal_form = rec.name, rec.status, rec.legal_form
                raw = rec.raw or {}
                d.registered_on = raw.get("registered_on") or raw.get("esmakande_kpv") or None
        except Exception as e:  # noqa: BLE001
            log.warning("risk_ariregister_failed", error=str(e)[:200])
            d.unavailable.append("Äriregister")
        try:
            d.debt, d.as_of["debt"] = await self._debt(registry_code)
        except Exception as e:  # noqa: BLE001
            log.warning("risk_emta_debt_failed", error=str(e)[:200])
            d.unavailable.append("EMTA · maksuvõlg")
        try:
            d.quarters, d.activity, d.as_of["quarters"] = await self._quarters(registry_code)
        except Exception as e:  # noqa: BLE001
            log.warning("risk_emta_taxes_failed", error=str(e)[:200])
            d.unavailable.append("EMTA · käive")
        return d

    async def _download(self, url: str, name: str) -> str:
        cache = os.path.join(tempfile.gettempdir(), "thinkone-avaandmed")
        os.makedirs(cache, exist_ok=True)
        path = os.path.join(cache, name)
        if os.path.exists(path) and time.time() - os.path.getmtime(path) < CACHE_TTL:
            return path
        async with httpx.AsyncClient(timeout=300, transport=self.transport, headers={"User-Agent": "thinkone/1.0"}) as c:
            r = await c.get(url, follow_redirects=True)
            r.raise_for_status()
            with open(path + ".part", "wb") as f:
                f.write(r.content)
        os.replace(path + ".part", path)
        return path

    @staticmethod
    def _num(s: str | None) -> float | None:
        s = (s or "").strip().replace(",", ".")
        try:
            return float(s) if s else None
        except ValueError:
            return None

    async def _debt(self, code: str) -> tuple[dict[str, Any] | None, str | None]:
        path = await self._download(EMTA_DEBT, "maksuvolg.csv")
        as_of = None
        with open(path, encoding="utf-8-sig") as f:
            for r in csv.reader(f, delimiter=";"):
                if len(r) < 8 or not r[1].isdigit():
                    continue
                as_of = as_of or r[0]
                if r[1] == code:
                    return {"amount": self._num(r[3]), "disputed": self._num(r[4]), "scheduled": self._num(r[5]), "schedule_end": r[6] or None, "oldest": r[7] or None}, as_of
        return None, as_of

    async def _quarters(self, code: str) -> tuple[list[dict[str, Any]], str | None, str | None]:
        out: list[dict[str, Any]] = []
        activity = as_of = None
        for url, name in EMTA_TAXES:
            path = await self._download(url, name)
            with open(path, encoding="utf-8-sig") as f:
                head = f.readline()
                f.seek(0)
                rd = csv.reader(f, delimiter=";" if head.count(";") > head.count(",") else ",")
                next(rd, None)
                for r in rd:
                    if len(r) < 23 or r[1] != code:
                        continue
                    as_of = r[0] if name == "maksud_kaesolev.csv" else as_of
                    activity = (r[5] or "").strip().capitalize() or activity
                    year = int(self._num(r[6]) or 0)
                    for q in range(4):
                        turnover, taxes = self._num(r[15 + q]), self._num(r[7 + q])
                        if turnover is None and taxes is None:
                            continue
                        out.append({"year": year, "q": q + 1, "turnover": turnover, "taxes": taxes, "labour": self._num(r[11 + q]), "employees": self._num(r[19 + q])})
        out.sort(key=lambda x: (x["year"], x["q"]))
        return out, activity, as_of


def parse_csv_text(text: str) -> list[list[str]]:
    return list(csv.reader(io.StringIO(text), delimiter=";"))


_source: RiskSource | None = None


def risk_source() -> RiskSource:
    global _source
    if _source is None:
        s = get_settings()
        _source = OpenDataRiskSource() if s.mode_for("risk") == "live" else FakeRiskSource()
    return _source


def set_risk_source(src: RiskSource | None) -> None:
    global _source
    _source = src
