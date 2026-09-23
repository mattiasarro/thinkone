"""e-Äriregister company autofill.

Live mode has two backends, chosen by whether RIK credentials are configured:

* **RIK XML service** (``ariregxmlv6.rik.ee``, SOAP, username + password per request) — the contracted
  "Äriregistri XML-teenus". ``lihtandmed_v3`` searches by name or registry code (name, legal form, status,
  address); ``detailandmed_v4`` returns one company's card: VAT (KMKR) number, contact details, board
  members and representation rules, activities, capital. Every upstream failure degrades to "no results".
* **Public autocomplete** (``ariregister.rik.ee/est/api/autocomplete``, no credentials) — name/code/address only.

Fake mode returns a deterministic list for tests and demos.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Any, Protocol
from xml.sax.saxutils import escape

import httpx
import structlog

from app.infra.settings import get_settings

log = structlog.get_logger()


@dataclass
class Representative:
    name: str
    role: str  # e.g. "Juhatuse liige"
    role_code: str | None = None  # JUHL, PROK, E, N …
    since: str | None = None  # ISO date


@dataclass
class CompanyRecord:
    name: str
    registry_code: str
    address: str | None = None
    vat_number: str | None = None
    status: str | None = None
    legal_form: str | None = None
    email: str | None = None
    phone: str | None = None
    representatives: list[Representative] = field(default_factory=list)
    raw: dict[str, Any] | None = None


class Ariregister(Protocol):
    async def lookup(self, query: str) -> list[CompanyRecord]:
        """Search by name fragment or registry code."""
        ...

    async def detail(self, registry_code: str) -> CompanyRecord | None:
        """One company's full record (VAT, contacts, representatives) or None when unknown."""
        ...


FAKE_COMPANIES = [
    CompanyRecord("Taevavärava OÜ", "12345678", "Betooni 11g, Tallinn", "EE101234567", "Registrisse kantud", "Osaühing",
                  "info@taevavarav.ee", "+372 5551 2345", [Representative("Mari Maasikas", "Juhatuse liige", "JUHL", "2019-04-01")]),
    CompanyRecord("Future Invest OÜ", "14456789", "Tartu mnt 2, Tallinn", "EE102345678", "Registrisse kantud", "Osaühing"),
    CompanyRecord("AS Maru Ehitus", "10192710", "Peterburi tee 46, Tallinn", "EE100238215", "Registrisse kantud", "Aktsiaselts"),
    CompanyRecord("Caverion Eesti AS", "10059426", "Sõpruse pst 145, Tallinn", "EE100227994", "Registrisse kantud", "Aktsiaselts"),
    CompanyRecord("If P&C Insurance AS", "10100168", "Lõõtsa 8a, Tallinn", "EE100163648", "Registrisse kantud", "Aktsiaselts"),
    CompanyRecord("Nordproff OÜ", "12888777", "Pärnu mnt 139, Tallinn", None, "Registrisse kantud", "Osaühing"),
]


class FakeAriregister:
    async def lookup(self, query: str) -> list[CompanyRecord]:
        q = query.strip().lower()
        return [c for c in FAKE_COMPANIES if q in c.name.lower() or q == c.registry_code]

    async def detail(self, registry_code: str) -> CompanyRecord | None:
        return next((c for c in FAKE_COMPANIES if c.registry_code == registry_code.strip()), None)


class PublicAriregister:
    """Open autocomplete endpoint — basics only, used in live mode when no RIK credentials are set."""

    URL = "https://ariregister.rik.ee/est/api/autocomplete"

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._transport = transport

    async def lookup(self, query: str) -> list[CompanyRecord]:
        try:
            async with httpx.AsyncClient(timeout=15, transport=self._transport) as c:
                r = await c.get(self.URL, params={"q": query.strip()})
                r.raise_for_status()
                data = r.json().get("data", [])
        except (httpx.HTTPError, ValueError) as e:
            log.warning("ariregister_lookup_failed", backend="public", query=query, error=str(e)[:200])
            return []
        return [CompanyRecord(name=row.get("name", ""), registry_code=str(row.get("reg_code", "")),
                              address=row.get("legal_address"), status=row.get("status"), raw=row) for row in data]

    async def detail(self, registry_code: str) -> CompanyRecord | None:
        code = registry_code.strip()
        return next((r for r in await self.lookup(code) if r.registry_code == code), None)


# --- RIK XML service ---------------------------------------------------------------------------------

NS = "http://arireg.x-road.eu/producer/"
BOARD_ROLES = {"JUHL", "PROK", "E", "N", "ESIN", "LIKV", "PANKR", "TJ", "FIE"}  # who may act for the company


def _strip_ns(el: ET.Element) -> ET.Element:
    for e in el.iter():
        if "}" in e.tag:
            e.tag = e.tag.split("}", 1)[1]
    return el


def _t(el: ET.Element | None, tag: str) -> str | None:
    if el is None:
        return None
    v = el.findtext(tag)
    v = (v or "").strip()
    return v or None


def _date(v: str | None) -> str | None:
    """'2018-03-14Z' → '2018-03-14'; '12.12.2000' → '2000-12-12'."""
    if not v:
        return None
    v = v.rstrip("Z")
    if "." in v and len(v) == 10:
        d, m, y = v.split(".")
        return f"{y}-{m}-{d}"
    return v


def _children(el: ET.Element | None, path: str) -> list[ET.Element]:
    return [] if el is None else el.findall(f"{path}/item")


def soap_envelope(operation: str, fields: dict[str, Any]) -> str:
    body = "".join(f"<ar:{k}>{escape(str(v).lower() if isinstance(v, bool) else str(v))}</ar:{k}>" for k, v in fields.items() if v is not None)
    return (
        '<?xml version="1.0" encoding="UTF-8"?>'
        f'<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="{NS}">'
        f"<soapenv:Body><ar:{operation}><ar:keha>{body}</ar:keha></ar:{operation}></soapenv:Body></soapenv:Envelope>"
    )


def parse_simple(xml_text: str) -> list[CompanyRecord]:
    """``lihtandmed_v3Response`` → records (name search or code lookup)."""
    root = _strip_ns(ET.fromstring(xml_text))
    out: list[CompanyRecord] = []
    for item in root.findall(".//keha/ettevotjad/item"):
        addr = item.find("evaadressid")
        street = _t(addr, "asukoht_ettevotja_aadressis")
        area = _t(addr, "asukoha_ehak_tekstina")
        address = _t(addr, "aadress_ads__ads_normaliseeritud_taisaadress") or ", ".join(p for p in (street, area) if p) or None
        code = _t(item, "ariregistri_kood") or ""
        out.append(CompanyRecord(
            name=_t(item, "evnimi") or "", registry_code=code, address=address, status=_t(item, "staatus_tekstina"),
            legal_form=_t(item, "oiguslik_vorm_tekstina"),
            raw={"source": "rik_xml", "registry_code": code, "name": _t(item, "evnimi"), "legal_form_code": _t(item, "oiguslik_vorm"),
                 "status_code": _t(item, "staatus"), "region": _t(item, "piirkond_tekstina"), "first_registered": _date(_t(item, "esmakande_aeg")),
                 "deleted_at": _date(_t(item, "registrist_kustutamise_aeg")), "address": {"street": street, "area": area, "postal_code": _t(addr, "indeks_ettevotja_aadressis"),
                 "full": _t(addr, "aadress_ads__ads_normaliseeritud_taisaadress"), "ads_oid": _t(addr, "aadress_ads__ads_oid")}},
        ))
    return out


def parse_detail(xml_text: str) -> CompanyRecord | None:
    """``detailandmed_v4Response`` (yandmed + iandmed) → one enriched record."""
    root = _strip_ns(ET.fromstring(xml_text))
    item = root.find(".//keha/ettevotjad/item")
    if item is None:
        return None
    y = item.find("yldandmed")
    persons = item.find("isikuandmed")
    code = _t(item, "ariregistri_kood") or ""

    addresses = []
    for a in _children(y, "aadressid"):
        if _t(a, "lopp_kpv"):
            continue
        addresses.append({"street": _t(a, "tanav_maja_korter"), "area": _t(a, "ehak_nimetus"), "postal_code": _t(a, "postiindeks"),
                          "full": _t(a, "aadress_ads__ads_normaliseeritud_taisaadress"), "ads_oid": _t(a, "aadress_ads__ads_oid"),
                          "country": _t(a, "riik"), "since": _date(_t(a, "algus_kpv"))})
    address = None
    if addresses:
        a0 = addresses[0]
        address = a0["full"] or ", ".join(p for p in (a0["street"], a0["area"]) if p) or None

    contacts = [{"kind": _t(s, "liik"), "value": _t(s, "sisu")} for s in _children(y, "sidevahendid") if not _t(s, "lopp_kpv") and _t(s, "sisu")]
    email = next((c["value"] for c in contacts if c["kind"] == "EMAIL"), None)
    phone = next((c["value"] for c in contacts if c["kind"] in ("TEL", "MOB")), None)

    reps: list[Representative] = []
    # board/procurators are on the register card; supervisory-board members are "off-card" persons
    for p in _children(persons, "kaardile_kantud_isikud") + _children(persons, "kaardivalised_isikud"):
        role = _t(p, "isiku_roll")
        if role not in BOARD_ROLES or _t(p, "lopp_kpv"):
            continue
        name = " ".join(x for x in (_t(p, "eesnimi"), _t(p, "nimi_arinimi")) if x)
        if name:
            reps.append(Representative(name=name, role=_t(p, "isiku_roll_tekstina") or role, role_code=role, since=_date(_t(p, "algus_kpv"))))
    rules = [_t(r, "sisu") for r in _children(persons, "esindusoiguse_normaalregulatsioonid") if _t(r, "sisu")]
    rules += [_t(r, "sisu") for r in _children(persons, "esindusoiguse_eritingimused") if _t(r, "sisu")]

    activities = [{"emtak": _t(a, "emtak_kood"), "name": _t(a, "emtak_tekstina"), "nace": _t(a, "nace_kood"), "primary": _t(a, "on_pohitegevusala") == "true"}
                  for a in _children(y, "teatatud_tegevusalad") if not _t(a, "lopp_kpv")]
    capital = next(({"amount": _t(k, "kapitali_suurus"), "currency": _t(k, "kapitali_valuuta")} for k in _children(y, "kapitalid") if not _t(k, "lopp_kpv")), None)
    report = next(iter(_children(y, "info_majandusaasta_aruannetest")), None)

    return CompanyRecord(
        name=_t(item, "nimi") or "", registry_code=code, address=address, vat_number=_t(item, "kmkr_number"),
        status=_t(y, "staatus_tekstina"), legal_form=_t(y, "oiguslik_vorm_tekstina"), email=email, phone=phone, representatives=reps,
        raw={"source": "rik_xml", "registry_code": code, "name": _t(item, "nimi"), "vat_number": _t(item, "kmkr_number"),
             "legal_form_code": _t(y, "oiguslik_vorm"), "legal_form": _t(y, "oiguslik_vorm_tekstina"), "status_code": _t(y, "staatus"),
             "status": _t(y, "staatus_tekstina"), "first_registered": _date(_t(y, "esmaregistreerimise_kpv")), "region": _t(y, "piirkond_tekstina"),
             "addresses": addresses, "contacts": contacts, "representatives": [r.__dict__ for r in reps], "representation_rules": rules,
             "activities": activities, "capital": capital,
             "employees": (int(_t(report, "tootajate_arv") or 0) or None) if report is not None else None,
             "last_report_period_end": _date(_t(report, "majandusaasta_perioodi_lopp_kpv")) if report is not None else None},
    )


class RikAriregister:
    """Authenticated RIK XML service. Credentials travel in the request body (``ariregister_kasutajanimi`` /
    ``ariregister_parool``), as the service specifies; both are redacted from logs."""

    def __init__(self, user: str, password: str, url: str = "https://ariregxmlv6.rik.ee/", transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._user, self._password, self._url, self._transport = user, password, url, transport

    async def _call(self, operation: str, fields: dict[str, Any]) -> str | None:
        env = soap_envelope(operation, {"ariregister_kasutajanimi": self._user, "ariregister_parool": self._password, **fields})
        try:
            async with httpx.AsyncClient(timeout=30, transport=self._transport) as c:
                r = await c.post(self._url, content=env.encode("utf-8"), headers={"Content-Type": "text/xml; charset=utf-8", "SOAPAction": '""'})
            if r.status_code >= 400 or b"faultstring>" in r.content:
                fault = ET.fromstring(r.text).findtext(".//faultstring") if b"faultstring" in r.content else None
                log.warning("ariregister_fault", operation=operation, status=r.status_code, fault=(fault or r.text)[:200])
                return None
            return r.text
        except (httpx.HTTPError, ET.ParseError) as e:
            log.warning("ariregister_lookup_failed", backend="rik", operation=operation, error=str(e)[:200])
            return None

    async def lookup(self, query: str) -> list[CompanyRecord]:
        q = " ".join(query.split())
        fields: dict[str, Any] = {"ariregistri_kood": q} if q.isdigit() else {"evnimi": q, "evarv": 10}
        xml_text = await self._call("lihtandmed_v3", {**fields, "keel": "est"})
        if xml_text is None:
            return []
        try:
            return parse_simple(xml_text)
        except ET.ParseError as e:
            log.warning("ariregister_parse_failed", operation="lihtandmed_v3", error=str(e)[:200])
            return []

    async def detail(self, registry_code: str) -> CompanyRecord | None:
        code = registry_code.strip()
        if not code.isdigit():
            return None
        xml_text = await self._call("detailandmed_v4", {"ariregistri_kood": code, "yandmed": True, "iandmed": True, "kandmed": False,
                                                        "dandmed": False, "maarused": False, "ainult_kehtivad": True, "keel": "est"})
        if xml_text is None:
            return None
        try:
            return parse_detail(xml_text)
        except ET.ParseError as e:
            log.warning("ariregister_parse_failed", operation="detailandmed_v4", error=str(e)[:200])
            return None


def ariregister() -> Ariregister:
    s = get_settings()
    if s.mode_for("ariregister") != "live":
        return FakeAriregister()
    if s.ariregister_user and s.ariregister_password:
        return RikAriregister(s.ariregister_user, s.ariregister_password, s.ariregister_url)
    return PublicAriregister()
