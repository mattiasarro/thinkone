"""Text extraction with page/char anchors. Text-layer PDF/DOCX only — NO OCR (spec: import scope)."""

from __future__ import annotations

import io
from dataclasses import dataclass, field

MIN_WORDS_PER_PAGE = 25  # fewer real words per page on average → image-only (or a drawing) → no text layer


@dataclass
class Page:
    page: int  # 1-based
    text: str
    char_start: int = 0  # offset of this page in the concatenated document text


@dataclass
class Extraction:
    format: str  # pdf | docx
    pages: list[Page] = field(default_factory=list)
    has_text_layer: bool = True

    @property
    def text(self) -> str:
        return "".join(p.text for p in self.pages)

    @property
    def page_count(self) -> int:
        return len(self.pages)

    def locate(self, char_start: int) -> int:
        """Page number for a document-level char offset."""
        page = 1
        for p in self.pages:
            if p.char_start <= char_start:
                page = p.page
            else:
                break
        return page


def detect_format(filename: str, content_type: str | None, data: bytes) -> str:
    name = (filename or "").lower()
    if data[:4] == b"%PDF" or name.endswith(".pdf"):
        return "pdf"
    if data[:2] == b"PK":
        if name.endswith((".asice", ".bdoc", ".sce")):
            return "asice"
        if name.endswith(".docx"):
            return "docx"
        # sniff: a zip with mimetype entry "application/vnd.etsi.asic-e+zip" is a container
        try:
            import zipfile

            with zipfile.ZipFile(io.BytesIO(data)) as z:
                names = z.namelist()
                if "mimetype" in names and b"asic-e" in z.read("mimetype"):
                    return "asice"
                if any(n.startswith("word/") for n in names):
                    return "docx"
        except Exception:
            pass
    return "other"


def extract_pdf(data: bytes) -> Extraction:
    import fitz  # PyMuPDF

    ex = Extraction(format="pdf")
    offset = 0
    with fitz.open(stream=data, filetype="pdf") as doc:
        for i, page in enumerate(doc, start=1):
            text = page.get_text("text")
            text = _normalize(text) + "\n"
            ex.pages.append(Page(page=i, text=text, char_start=offset))
            offset += len(text)
    ex.has_text_layer = _has_text_layer(ex)
    return ex


def extract_docx(data: bytes) -> Extraction:
    from docx import Document

    doc = Document(io.BytesIO(data))
    parts: list[str] = []
    for block in _iter_blocks(doc):
        if block:
            parts.append(_normalize(block))
    text = "\n".join(parts) + "\n"
    ex = Extraction(format="docx", pages=[Page(page=1, text=text, char_start=0)])
    ex.has_text_layer = _has_text_layer(ex)
    return ex


def _has_text_layer(ex: Extraction) -> bool:
    import re

    words = re.findall(r"[a-zõäöüšž]{4,}", ex.text)  # prose has lowercase words; drawings/scans do not
    return bool(ex.pages) and len(words) / max(len(ex.pages), 1) >= MIN_WORDS_PER_PAGE


def _iter_blocks(doc):
    """Paragraphs and table cells in document order (python-docx keeps them apart)."""
    from docx.oxml.ns import qn
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    body = doc.element.body
    for child in body.iterchildren():
        if child.tag == qn("w:p"):
            p = Paragraph(child, doc)
            num = _numbering_prefix(p)
            yield (num + p.text).strip()
        elif child.tag == qn("w:tbl"):
            t = Table(child, doc)
            for row in t.rows:
                cells = []
                for c in row.cells:
                    ct = " ".join(x.text.strip() for x in c.paragraphs if x.text.strip())
                    if ct and (not cells or cells[-1] != ct):
                        cells.append(ct)
                if cells:
                    yield " | ".join(cells)


_num_state: dict[str, list[int]] = {}


def _numbering_prefix(p) -> str:
    """Render Word auto-numbering as text so 'marked items' survive extraction (best effort)."""
    from docx.oxml.ns import qn

    pPr = p._p.pPr
    if pPr is None or pPr.numPr is None:
        return ""
    ilvl_el = pPr.numPr.find(qn("w:ilvl"))
    num_el = pPr.numPr.find(qn("w:numId"))
    if num_el is None:
        return ""
    ilvl = int(ilvl_el.get(qn("w:val"))) if ilvl_el is not None else 0
    key = num_el.get(qn("w:val"))
    counters = _num_state.setdefault(key, [0] * 9)
    counters[ilvl] += 1
    for j in range(ilvl + 1, 9):
        counters[j] = 0
    return ".".join(str(c) for c in counters[: ilvl + 1]) + ". "


def _normalize(text: str) -> str:
    text = text.replace("\r", "")
    text = text.replace("­", "")  # soft hyphen
    lines = [" ".join(line.split()) for line in text.split("\n")]
    return "\n".join(lines)


def extract(format: str, data: bytes) -> Extraction:
    _num_state.clear()
    if format == "pdf":
        return extract_pdf(data)
    if format == "docx":
        return extract_docx(data)
    raise ValueError(f"unsupported format: {format}")
