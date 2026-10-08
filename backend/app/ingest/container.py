"""ASiC-E / BDOC containers: unpack datafiles, read XAdES signature metadata (signers, times).

The container itself is stored unaltered as the legal original; the text-layer rule is
applied to the datafiles inside.
"""

from __future__ import annotations

import io
import re
import zipfile
from dataclasses import dataclass, field


@dataclass
class Signature:
    signer: str | None
    personal_code: str | None
    signing_time: str | None
    signed_files: list[str] = field(default_factory=list)


@dataclass
class Container:
    datafiles: list[tuple[str, bytes]]
    signatures: list[Signature]
    mimetype: str | None

    def main_document(self) -> tuple[str, bytes] | None:
        """Prefer PDF, then DOCX, then the largest datafile."""
        for ext in (".pdf", ".docx"):
            for name, data in self.datafiles:
                if name.lower().endswith(ext):
                    return name, data
        return max(self.datafiles, key=lambda x: len(x[1])) if self.datafiles else None


def unpack(data: bytes) -> Container:
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        names = z.namelist()
        mimetype = z.read("mimetype").decode("ascii", "ignore").strip() if "mimetype" in names else None
        datafiles = [(n, z.read(n)) for n in names if not n.startswith("META-INF/") and n != "mimetype" and not n.endswith("/")]
        sigs = [_parse_signature(z.read(n)) for n in names if n.startswith("META-INF/") and n.lower().endswith(".xml") and "signature" in n.lower()]
    return Container(datafiles=datafiles, signatures=[s for s in sigs if s], mimetype=mimetype)


def _parse_signature(xml: bytes) -> Signature | None:
    text = xml.decode("utf-8", "ignore")
    time = _first(r"<[^>]*SigningTime>([^<]+)<", text)
    # Real containers (DigiDoc, Smart-ID, Mobiil-ID, e-seals) carry the signer only inside the signing certificate;
    # X509SubjectName is rare, so decode the first certificate under KeyInfo first.
    signer, code = _signer_from_certificate(text)
    subject = None if signer else _first(r"<[^>]*X509SubjectName>([^<]+)<", text)
    if subject:
        # typical: "SERIALNUMBER=PNOEE-38001085718,GIVENNAME=..,SURNAME=..,CN=\"SURNAME,GIVENNAME,38001085718\",C=EE"
        cn = _first(r"CN=\"?([^\",]+(?:,[^\",]+)*)\"?", subject)
        signer = cn.replace("\\,", ",") if cn else subject
        code = _first(r"PNOEE-(\d{11})", subject) or _first(r"(\d{11})", subject)
        given, sur = _first(r"GIVENNAME=([^,]+)", subject), _first(r"SURNAME=([^,]+)", subject)
        if given and sur:
            signer = f"{given.title()} {sur.title()}"
    files = re.findall(r'<[^>]*Reference[^>]*URI="([^"#][^"]*)"', text)
    files = [f for f in files if not f.startswith("#")]
    return Signature(signer=signer, personal_code=code, signing_time=time, signed_files=files)


def _signer_from_certificate(text: str) -> tuple[str | None, str | None]:
    """Signer name + Estonian personal code (or an e-seal's organisation + registry code) from the signing certificate."""
    key_info = _first(r"<[^>]*KeyInfo[^>]*>(.*?)</[^>]*KeyInfo>", text) if "KeyInfo" in text else None
    b64 = _first(r"<[^>]*X509Certificate>([^<]+)<", key_info or text)
    if not b64:
        return None, None
    try:
        import base64

        from cryptography import x509
        from cryptography.x509.oid import NameOID

        cert = x509.load_der_x509_certificate(base64.b64decode("".join(b64.split())))
        subj = cert.subject

        def attr(oid) -> str | None:
            vals = subj.get_attributes_for_oid(oid)
            return str(vals[0].value).strip() if vals else None

        given, sur, cn = attr(NameOID.GIVEN_NAME), attr(NameOID.SURNAME), attr(NameOID.COMMON_NAME)
        serial = attr(NameOID.SERIAL_NUMBER) or ""
        code = _first(r"PNO[A-Z]{2}-(\d{11})", serial) or _first(r"^(\d{11})$", serial)
        if given and sur:
            return f"{given.title()} {sur.title()}", code
        if cn:
            parts = [p.strip() for p in cn.split(",")]
            if len(parts) >= 2 and not code:
                code = _first(r"(\d{11})", cn)
            if len(parts) >= 2:
                return f"{parts[1].title()} {parts[0].title()}", code  # "SURNAME,GIVENNAME,CODE"
            org = attr(NameOID.ORGANIZATION_NAME)
            org_id = _first(r"NTR[A-Z]{2}-(\d+)", serial) or _first(r"NTR[A-Z]{2}-(\d+)", attr(x509.ObjectIdentifier("2.5.4.97")) or "")
            return (org or cn), (org_id or code)
        return None, code
    except Exception:  # noqa: BLE001 — a signature we cannot read must not break the import
        return None, None


def _first(pattern: str, text: str) -> str | None:
    m = re.search(pattern, text)
    return m.group(1).strip() if m else None


def build_test_container(files: dict[str, bytes], signer: str = "Mari Maasikas", code: str = "48001010000", time: str = "2023-11-25T10:00:00Z") -> bytes:
    """Minimal ASiC-E for tests (unsigned, but with XAdES-shaped metadata)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("mimetype", "application/vnd.etsi.asic-e+zip", compress_type=zipfile.ZIP_STORED)
        for n, d in files.items():
            z.writestr(n, d)
        refs = "".join(f'<ds:Reference URI="{n}"/>' for n in files)
        sur, given = signer.split()[-1].upper(), signer.split()[0].upper()
        z.writestr("META-INF/signatures0.xml", f"""<?xml version="1.0"?><asic:XAdESSignatures><ds:Signature><ds:SignedInfo>{refs}</ds:SignedInfo>
<ds:KeyInfo><ds:X509Data><ds:X509SubjectName>SERIALNUMBER=PNOEE-{code},GIVENNAME={given},SURNAME={sur},CN="{sur},{given},{code}",C=EE</ds:X509SubjectName></ds:X509Data></ds:KeyInfo>
<xades:QualifyingProperties><xades:SignedProperties><xades:SignedSignatureProperties><xades:SigningTime>{time}</xades:SigningTime></xades:SignedSignatureProperties></xades:SignedProperties></xades:QualifyingProperties></ds:Signature></asic:XAdESSignatures>""")
    return buf.getvalue()
