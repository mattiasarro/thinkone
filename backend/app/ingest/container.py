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
    subject = _first(r"<[^>]*X509SubjectName>([^<]+)<", text)
    signer, code = None, None
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
