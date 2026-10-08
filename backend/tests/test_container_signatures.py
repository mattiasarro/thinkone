"""ASiC-E signer extraction from the signing certificate (real containers carry no X509SubjectName)."""

import base64
import datetime as dt
import io
import zipfile

from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import NameOID

from app.ingest.container import unpack


def _cert(attrs: list[tuple[x509.ObjectIdentifier, str]]) -> str:
    key = ec.generate_private_key(ec.SECP256R1())
    name = x509.Name([x509.NameAttribute(oid, val) for oid, val in attrs])
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(key.public_key()).serial_number(1)
            .not_valid_before(dt.datetime(2024, 1, 1)).not_valid_after(dt.datetime(2030, 1, 1)).sign(key, hashes.SHA256()))
    return base64.b64encode(cert.public_bytes(__import__("cryptography.hazmat.primitives.serialization", fromlist=["Encoding"]).Encoding.DER)).decode()


def _container(cert_b64: str, when: str = "2026-10-08T11:55:34Z") -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("mimetype", "application/vnd.etsi.asic-e+zip")
        z.writestr("leping.pdf", b"%PDF-1.4 x")
        z.writestr("META-INF/signatures0.xml", f"""<?xml version="1.0"?><asic:XAdESSignatures xmlns:asic="http://uri.etsi.org/02918/v1.2.1#" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
<ds:Signature Id="S0"><ds:SignedInfo><ds:Reference URI="leping.pdf"/><ds:Reference URI="#S0-SignedProperties" Type="http://uri.etsi.org/01903#SignedProperties"/></ds:SignedInfo>
<ds:KeyInfo><ds:X509Data><ds:X509Certificate>{cert_b64}</ds:X509Certificate></ds:X509Data></ds:KeyInfo>
<ds:Object><xades:QualifyingProperties><xades:SignedProperties Id="S0-SignedProperties"><xades:SignedSignatureProperties><xades:SigningTime>{when}</xades:SigningTime></xades:SignedSignatureProperties></xades:SignedProperties></xades:QualifyingProperties></ds:Object></ds:Signature></asic:XAdESSignatures>""")
    return buf.getvalue()


def test_person_signature_from_certificate():
    cert = _cert([(NameOID.COUNTRY_NAME, "EE"), (NameOID.COMMON_NAME, "MAASIKAS,MARI,48001010000"), (NameOID.SURNAME, "MAASIKAS"),
                  (NameOID.GIVEN_NAME, "MARI"), (NameOID.SERIAL_NUMBER, "PNOEE-48001010000")])
    c = unpack(_container(cert))
    assert [(s.signer, s.personal_code, s.signing_time, s.signed_files) for s in c.signatures] == [("Mari Maasikas", "48001010000", "2026-10-08T11:55:34Z", ["leping.pdf"])]


def test_eseal_signature_from_certificate():
    cert = _cert([(NameOID.COUNTRY_NAME, "EE"), (NameOID.ORGANIZATION_NAME, "Näidise Kinnisvara OÜ"), (NameOID.COMMON_NAME, "Näidise Kinnisvara OÜ"),
                  (x509.ObjectIdentifier("2.5.4.97"), "NTREE-12345678")])
    c = unpack(_container(cert))
    assert (c.signatures[0].signer, c.signatures[0].personal_code) == ("Näidise Kinnisvara OÜ", "12345678")


def test_unreadable_certificate_does_not_break_unpack():
    c = unpack(_container("bm90IGEgY2VydA=="))
    assert c.signatures[0].signer is None and c.signatures[0].signing_time == "2026-10-08T11:55:34Z"
