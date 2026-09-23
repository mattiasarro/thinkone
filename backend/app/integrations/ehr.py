"""EHR (ehitisregister) building autofill.

Live adapter: the public *Buildings Actual Data API* (``livekluster.ehr.ee/api/building``, no key needed):
  POST /v2/buildingSearch {"buildingLocation": …, "buildingType": ["H"]}  → candidate buildings
  GET  /v2/buildingData?ehr_code=…                                        → current data of one building
Raw payloads are kept (trimmed) so the property can carry them as ``attributes.ehr_payload``.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass, field
from typing import Any, Protocol

import httpx
import structlog

from app.infra.settings import get_settings

log = structlog.get_logger()


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
    BuildingRecord("121378008", "Harju maakond, Rae vald, Lehmja küla, Taevavärava tee 6b", "Muu laohoone · Büroohoone", 6852.5, 7765.8, 2, 2023),
    BuildingRecord("120000008", "Näidise 8, Tallinn", "Büroo- ja laohoone", 1200, 1800, 2, 2024),
]


class FakeEHR:
    async def lookup(self, query: str) -> list[BuildingRecord]:
        q = query.strip().lower()
        return [b for b in FAKE_BUILDINGS if q in b.address.lower() or q == b.ehr_code]


def _num(v: Any) -> float | None:
    try:
        return float(str(v).replace(",", ".")) if v not in (None, "") else None
    except ValueError:
        return None


def _int(v: Any) -> int | None:
    n = _num(v)
    return int(n) if n is not None else None


def normalize_address(q: str) -> list[str]:
    """Spellings to try, most specific first. The register matches street names in full form
    ("Betooni tänav 11g" hits, "Betooni 11g" / "Betooni tn 11g" do not)."""
    q = " ".join(q.split()).strip(" ,")
    q = re.sub(r",\s*(Tallinn|Tartu|Pärnu|Narva|Harju maakond|[A-ZÕÄÖÜ][a-zõäöü]+ (?:vald|linn|küla|alevik))\s*$", "", q)
    variants = [q]
    q2 = re.sub(r"\btn\b\.?", "tänav", q)
    if q2 != q:
        variants.append(q2)
    m = re.match(r"^(\S+)\s+(\d+\w*)$", q)
    if m and not re.search(r"\b(tänav|tee|maantee|mnt|puiestee|pst|põik|tn)\b", q):
        variants += [f"{m.group(1)} tänav {m.group(2)}", f"{m.group(1)} tee {m.group(2)}"]
    seen: list[str] = []
    for v in variants:
        if v not in seen:
            seen.append(v)
    return seen


def parse_detail(data: dict[str, Any], hit: dict[str, Any] | None = None) -> BuildingRecord:
    e = data.get("ehitis") or data
    pa = e.get("ehitisePohiandmed") or {}
    uses = [(k.get("kaosIdTxt"), _num(k.get("mitteeluruumidePind")) or _num(k.get("eluruumidePind")) or 0.0)
            for k in ((e.get("ehitiseKasutusotstarbed") or {}).get("kasutusotstarve") or []) if k.get("kaosIdTxt")]
    seen: dict[str, float] = {}
    for name, area in uses:
        seen[name] = max(seen.get(name, 0.0), area)
    use_type = " · ".join(sorted(seen, key=lambda n: -seen[n])) or ((hit or {}).get("purposeOfUse") or {}).get("value")
    addr = ((e.get("ehitiseAadressid") or {}).get("aadress") or [{}])[0]
    address = addr.get("taisaadress") or addr.get("lahiaadress") or ""
    if not address and hit:
        address = ((hit.get("geometry") or {}).get("properties") or {}).get("taisaadress") or (hit.get("buildingaddress") or [""])[0]
    code = str(addr.get("ehrKood") or (hit or {}).get("ehrCode") or ((e.get("ehitiseKujud") or {}).get("ruumikuju") or [{}])[0].get("ehrKood") or "")
    year = _int(str((hit or {}).get("firstUseDate") or "")[:4])
    return BuildingRecord(
        ehr_code=code, address=address, use_type=use_type or None,
        footprint_m2=_num(pa.get("ehitisalunePind")), net_area_m2=_num(pa.get("suletud_netopind")),
        floors=_int(pa.get("maxKorrusteArv")), build_year=year,
        raw={"pohiandmed": pa, "kasutusotstarbed": e.get("ehitiseKasutusotstarbed"), "aadressid": e.get("ehitiseAadressid"), "search_hit": hit},
    )


class LiveEHR:
    BASE = "https://livekluster.ehr.ee/api/building"
    MAX_DETAILS = 6

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.BASE, timeout=20, transport=self._transport)

    async def lookup(self, query: str) -> list[BuildingRecord]:
        """Best effort: any upstream failure degrades to "no results" (the operator enters data manually)."""
        q = query.strip()
        try:
            async with self._client() as c:
                if q.isdigit():
                    r = await c.get("/v2/buildingData", params={"ehr_code": q})
                    if r.status_code == 400:
                        return []
                    r.raise_for_status()
                    return [parse_detail(r.json())]
                hits: list[dict[str, Any]] = []
                for variant in normalize_address(q):
                    r = await c.post("/v2/buildingSearch", json={"buildingLocation": variant, "buildingType": ["H"]})
                    if r.status_code == 400:  # "Building Not Found!" is a 400 on this API
                        continue
                    r.raise_for_status()
                    hits = [h for h in r.json() if (h.get("buildingType") or {}).get("code") in ("H", None)]
                    if hits:
                        break
                hits = hits[: self.MAX_DETAILS]
                details = await asyncio.gather(*(c.get("/v2/buildingData", params={"ehr_code": h["ehrCode"]}) for h in hits), return_exceptions=True)
        except (httpx.HTTPError, ValueError) as e:
            log.warning("ehr_lookup_failed", query=q, error=str(e)[:200])
            return []
        out: list[BuildingRecord] = []
        for h, d in zip(hits, details, strict=True):
            if isinstance(d, httpx.Response) and d.status_code == 200:
                try:
                    out.append(parse_detail(d.json(), h))
                    continue
                except ValueError:
                    pass
            props = (h.get("geometry") or {}).get("properties") or {}
            out.append(BuildingRecord(ehr_code=str(h.get("ehrCode")), address=props.get("taisaadress") or (h.get("buildingaddress") or [""])[0] or query,
                                      use_type=(h.get("purposeOfUse") or {}).get("value"), footprint_m2=_num(h.get("underArea")),
                                      floors=_int(h.get("floorCount")), build_year=_int(str(h.get("firstUseDate") or "")[:4]), raw={"search_hit": h}))
        return out


def ehr() -> EHR:
    return LiveEHR() if get_settings().mode_for("ehr") == "live" else FakeEHR()
