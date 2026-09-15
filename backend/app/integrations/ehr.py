"""EHR (ehitisregister) building autofill by code or address. Public API in live mode; fake otherwise."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx

from app.infra.settings import get_settings


@dataclass
class BuildingRecord:
    ehr_code: str
    address: str
    use_type: str | None = None
    footprint_m2: float | None = None
    net_area_m2: float | None = None
    floors: int | None = None
    build_year: int | None = None
    raw: dict[str, Any] = field(default_factory=dict)


class EHR(Protocol):
    async def lookup(self, query: str) -> list[BuildingRecord]: ...


FAKE_BUILDINGS = [
    BuildingRecord("120655847", "Betooni 11g, Lasnamäe linnaosa, Tallinn, Harju maakond", "Büroo- ja laohoone", 1480, 2612, 2, 2019),
    BuildingRecord("121290339", "Tuleviku tee 6b, Peetri alevik, Rae vald, Harju maakond", "Büroo- ja tootmishoone", 2160, 3818, 2, 2021),
    BuildingRecord("120000008", "Näidise 8, Tallinn", "Büroo- ja laohoone", 1200, 1800, 2, 2024),
]


class FakeEHR:
    async def lookup(self, query: str) -> list[BuildingRecord]:
        q = query.strip().lower()
        return [b for b in FAKE_BUILDINGS if q in b.address.lower() or q == b.ehr_code]


class LiveEHR:
    URL = "https://livekluster.ehr.ee/api/building/v2/buildingsData"

    async def lookup(self, query: str) -> list[BuildingRecord]:
        q = query.strip()
        params = {"ehr_code": q} if q.isdigit() else {"address": q}
        async with httpx.AsyncClient(timeout=20) as c:
            r = await c.get(self.URL, params=params)
            r.raise_for_status()
            rows = r.json() if isinstance(r.json(), list) else [r.json()]
        out = []
        for row in rows:
            out.append(BuildingRecord(
                ehr_code=str(row.get("ehr_code", "")), address=row.get("address", ""), use_type=row.get("use_type"),
                footprint_m2=row.get("building_area"), net_area_m2=row.get("closed_net_area"),
                floors=row.get("floors"), build_year=row.get("build_year"), raw=row,
            ))
        return out


def ehr() -> EHR:
    return LiveEHR() if get_settings().mode_for("ehr") == "live" else FakeEHR()
