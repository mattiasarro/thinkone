"""e-Äriregister company autofill. Open-data JSON in live mode; deterministic fake otherwise."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol

import httpx

from app.infra.settings import get_settings


@dataclass
class CompanyRecord:
    name: str
    registry_code: str
    address: str | None = None
    vat_number: str | None = None
    status: str | None = None
    raw: dict[str, Any] | None = None


class Ariregister(Protocol):
    async def lookup(self, query: str) -> list[CompanyRecord]: ...


FAKE_COMPANIES = [
    CompanyRecord("Taevavärava OÜ", "12345678", "Betooni 11g, Tallinn", "EE101234567", "Registrisse kantud"),
    CompanyRecord("Future Invest OÜ", "14456789", "Tartu mnt 2, Tallinn", "EE102345678", "Registrisse kantud"),
    CompanyRecord("AS Maru Ehitus", "10192710", "Peterburi tee 46, Tallinn", "EE100238215", "Registrisse kantud"),
    CompanyRecord("Caverion Eesti AS", "10059426", "Sõpruse pst 145, Tallinn", "EE100227994", "Registrisse kantud"),
    CompanyRecord("If P&C Insurance AS", "10100168", "Lõõtsa 8a, Tallinn", "EE100163648", "Registrisse kantud"),
    CompanyRecord("Nordproff OÜ", "12888777", "Pärnu mnt 139, Tallinn", None, "Registrisse kantud"),
]


class FakeAriregister:
    async def lookup(self, query: str) -> list[CompanyRecord]:
        q = query.strip().lower()
        return [c for c in FAKE_COMPANIES if q in c.name.lower() or q == c.registry_code]


class LiveAriregister:
    URL = "https://ariregister.rik.ee/est/api/autocomplete"

    async def lookup(self, query: str) -> list[CompanyRecord]:
        import structlog

        try:
            async with httpx.AsyncClient(timeout=15) as c:
                r = await c.get(self.URL, params={"q": query.strip()})
                r.raise_for_status()
                data = r.json().get("data", [])
        except (httpx.HTTPError, ValueError) as e:
            structlog.get_logger().warning("ariregister_lookup_failed", query=query, error=str(e)[:200])
            return []
        out = []
        for row in data:
            out.append(CompanyRecord(name=row.get("name", ""), registry_code=str(row.get("reg_code", "")),
                                     address=row.get("legal_address"), status=row.get("status"), raw=row))
        return out


def ariregister() -> Ariregister:
    return LiveAriregister() if get_settings().mode_for("ariregister") == "live" else FakeAriregister()
