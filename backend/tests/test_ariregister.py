"""RIK XML service adapter against recorded (scrubbed) responses of ariregxmlv6.rik.ee — no network."""

import pathlib

import httpx

from app.integrations.ariregister import RikAriregister, parse_detail, parse_simple, soap_envelope

FIX = pathlib.Path(__file__).parent / "fixtures"
LIHT = (FIX / "ariregister_lihtandmed.xml").read_text()
DET = (FIX / "ariregister_detailandmed.xml").read_text()
FAULT = ('<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><SOAP-ENV:Fault>'
         "<faultcode>SOAP-ENV:Client</faultcode><faultstring>Vale kasutajanimi või parool</faultstring></SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>")
EMPTY = ('<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body xmlns:ns1="http://arireg.x-road.eu/producer/">'
         "<ns1:lihtandmed_v3Response><ns1:keha><ns1:ettevotjad></ns1:ettevotjad><ns1:leitud_ettevotjate_arv>0</ns1:leitud_ettevotjate_arv></ns1:keha>"
         "</ns1:lihtandmed_v3Response></SOAP-ENV:Body></SOAP-ENV:Envelope>")


def _transport(calls: list, *, fault: bool = False, down: bool = False):
    def handler(request: httpx.Request) -> httpx.Response:
        body = request.content.decode()
        calls.append(body)
        if down:
            raise httpx.ConnectError("boom")
        if fault:
            return httpx.Response(500, text=FAULT, headers={"content-type": "text/xml"})
        if "<ar:lihtandmed_v3>" in body:
            return httpx.Response(200, text=LIHT if "maru" in body.lower() or "10714568" in body else EMPTY, headers={"content-type": "text/xml"})
        if "<ar:detailandmed_v4>" in body:
            return httpx.Response(200, text=DET, headers={"content-type": "text/xml"})
        return httpx.Response(404)

    return httpx.MockTransport(handler)


def test_soap_envelope_escapes_and_lowercases_booleans():
    env = soap_envelope("lihtandmed_v3", {"ariregister_parool": "a<b&c", "evnimi": "Maru & Co", "yandmed": True, "keel": None})
    assert "<ar:ariregister_parool>a&lt;b&amp;c</ar:ariregister_parool>" in env
    assert "<ar:yandmed>true</ar:yandmed>" in env and "keel" not in env
    assert env.startswith('<?xml version="1.0"') and "<ar:keha>" in env


def test_parse_simple_maps_company_basics():
    rows = parse_simple(LIHT)
    assert len(rows) == 1
    r = rows[0]
    assert r.name == "AS MARU EHITUS" and r.registry_code == "10714568" and r.legal_form == "Aktsiaselts"
    assert r.address == "Harju maakond, Tallinn, Kesklinna linnaosa, Järvevana tee 5" and r.status == "Registrisse kantud"
    assert r.vat_number is None and r.email is None
    assert r.raw["first_registered"] == "2000-12-12" and r.raw["address"]["postal_code"] == "10112" and r.raw["source"] == "rik_xml"


def test_parse_detail_maps_vat_contacts_and_board():
    r = parse_detail(DET)
    assert r is not None
    assert r.name == "AS MARU EHITUS" and r.registry_code == "10714568" and r.vat_number == "EE100659856"
    assert r.email == "ehitus@maru.ee" and r.phone == "+372 6575850" and r.legal_form == "Aktsiaselts"
    assert r.address == "Harju maakond, Tallinn, Kesklinna linnaosa, Järvevana tee 5"
    roles = {(p.name, p.role_code) for p in r.representatives}
    assert ("Andres Jakobi", "JUHL") in roles and ("Margo Dengo", "JUHL") in roles
    assert ("Andres Piiber", "E") in roles and ("Aivar Alavere", "N") in roles  # supervisory board comes from the off-card list
    assert not any(p.role_code in ("S", "A", "D", "ARP") for p in r.representatives)  # shareholders/founders/auditors are not representatives
    assert r.raw["representation_rules"] == ["Aktsiaseltsi võib kõikide tehingute tegemisel esindada iga juhatuse liige."]
    assert r.raw["activities"][0] == {"emtak": "41001", "name": "Elamute ja mitteeluhoonete ehitus", "nace": "41.00", "primary": True}
    assert r.raw["capital"] == {"amount": "64000.0", "currency": "EUR"} and r.raw["employees"] == 47
    assert "isikukood" not in str(r.raw)  # personal codes are never persisted


async def test_lookup_sends_credentials_in_body_and_parses():
    calls: list = []
    reg = RikAriregister("user", "pw", transport=_transport(calls))
    rows = await reg.lookup("  maru   ehitus ")
    assert [r.registry_code for r in rows] == ["10714568"]
    assert "<ar:ariregister_kasutajanimi>user</ar:ariregister_kasutajanimi><ar:ariregister_parool>pw</ar:ariregister_parool>" in calls[0]
    assert "<ar:evnimi>maru ehitus</ar:evnimi><ar:evarv>10</ar:evarv>" in calls[0] and "<ar:lihtandmed_v3>" in calls[0]

    rows = await reg.lookup("10714568")
    assert "<ar:ariregistri_kood>10714568</ar:ariregistri_kood>" in calls[1] and "evnimi" not in calls[1] and len(rows) == 1
    assert await reg.lookup("olematu") == []


async def test_detail_requests_general_and_person_data_only():
    calls: list = []
    reg = RikAriregister("user", "pw", transport=_transport(calls))
    r = await reg.detail("10714568")
    assert r is not None and r.vat_number == "EE100659856" and len(r.representatives) == 6
    assert "<ar:detailandmed_v4>" in calls[0] and "<ar:yandmed>true</ar:yandmed><ar:iandmed>true</ar:iandmed><ar:kandmed>false</ar:kandmed>" in calls[0]
    assert "<ar:ainult_kehtivad>true</ar:ainult_kehtivad>" in calls[0]
    assert await reg.detail("not-a-code") is None and len(calls) == 1


async def test_fault_and_outage_degrade_to_no_results():
    calls: list = []
    bad = RikAriregister("user", "wrong", transport=_transport(calls, fault=True))
    assert await bad.lookup("maru") == [] and await bad.detail("10714568") is None
    down = RikAriregister("user", "pw", transport=_transport(calls, down=True))
    assert await down.lookup("maru") == [] and await down.detail("10714568") is None
