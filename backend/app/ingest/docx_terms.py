"""General-terms DOCX → clause tree (node-per-marked-item rule).

The landlord's lease template (Üürileping.docx) carries the general terms as Word
auto-numbered paragraphs: level 0 = section heading (MÕISTED, LEPINGU ESE, …),
level 1 = numbered point, level 2 = sub-point. Numbering is derived, never read from
the text — the tree gets the same numbers Word would show (1, 1.1, 1.2, 2, 2.1 …).
"""

from __future__ import annotations

import io
import uuid
from dataclasses import dataclass

from docx import Document
from docx.oxml.ns import qn
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.clauses import Node, render, write_tree
from app.domain.errors import ValidationFailed
from app.domain.events import Actor, emit
from app.infra.blobstore import blobstore, sha256
from app.models.core import Attachment, Template

GENERAL_TERMS_MARKER = "ÜLDTINGIMUSED"


@dataclass
class ParsedTerms:
    sections: list[Node]
    section_count: int
    point_count: int


def _level(paragraph) -> int | None:
    pPr = paragraph._p.pPr
    if pPr is None or pPr.numPr is None:
        return None
    ilvl = pPr.numPr.find(qn("w:ilvl"))
    return int(ilvl.get(qn("w:val"))) if ilvl is not None else 0


def parse_general_terms(data: bytes) -> ParsedTerms:
    doc = Document(io.BytesIO(data))
    started = False
    sections: list[Node] = []
    stack: list[Node] = []  # current path: [section, point, subpoint]
    for p in doc.paragraphs:
        text = " ".join(p.text.split())
        if not text:
            continue
        if not started:
            if GENERAL_TERMS_MARKER in text.upper():
                started = True
            continue
        lvl = _level(p)
        if lvl is None:
            # unnumbered paragraph inside the terms: continuation of the previous node
            if stack:
                stack[-1].text = (stack[-1].text + " " + text).strip()
            continue
        if lvl == 0:
            node = Node(text="", heading=text.title() if text.isupper() else text, number_style="decimal")
            sections.append(node)
            stack = [node]
        else:
            node = Node(text=text, number_style="decimal")
            while len(stack) > lvl:
                stack.pop()
            if not stack:
                continue
            stack[-1].children.append(node)
            stack.append(node)
    if not sections:
        raise ValidationFailed("Dokumendist ei leitud üldtingimusi (nummerdatud jagusid pärast pealkirja ÜLDTINGIMUSED)")
    points = sum(_count(s.children) for s in sections)
    return ParsedTerms(sections=sections, section_count=len(sections), point_count=points)


def _count(nodes: list[Node]) -> int:
    return sum(1 + _count(n.children) for n in nodes)


async def ingest_general_terms_docx(
    session: AsyncSession, actor: Actor, *, company_id: uuid.UUID | None, name: str, filename: str, data: bytes
) -> Template:
    """Store the DOCX, parse it, write the clause tree, and version the template (old version archived)."""
    from sqlalchemy import select

    parsed = parse_general_terms(data)
    prev = (await session.execute(select(Template).where(
        Template.kind == "general_terms", Template.is_current.is_(True), Template.deleted_at.is_(None),
        Template.company_id == company_id if company_id else Template.company_id.is_(None)))).scalars().first()
    tpl = Template(account_id=actor.account_id, company_id=company_id, kind="general_terms", name=name or filename,
                   version=(prev.version + 1) if prev else 1, supersedes_id=prev.id if prev else None, is_current=True,
                   body={"format": "clause_tree"}, node_count=parsed.section_count + parsed.point_count)
    session.add(tpl)
    await session.flush()
    key = f"account/{actor.account_id}/template/{tpl.id}/{uuid.uuid4().hex[:8]}-{filename}"
    await blobstore().put(key, data, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    att = Attachment(account_id=actor.account_id, subject_type="template", subject_id=tpl.id, role="generic", filename=filename,
                     content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document", size=len(data),
                     s3_key=key, sha256=sha256(data), uploaded_by=actor.user_id)
    session.add(att)
    await session.flush()
    tpl.source_attachment_id = att.id
    if prev:
        prev.is_current = False
    rows = await write_tree(session, actor, parsed.sections, template_id=tpl.id, source="template", locked=True)
    emit(session, actor, "template", tpl.id, "template.general_terms_ingested",
         {"version": tpl.version, "sections": parsed.section_count, "points": parsed.point_count, "nodes": len(rows), "supersedes": prev.id if prev else None})
    return tpl


def preview_numbers(parsed: ParsedTerms) -> list[str]:
    """Numbers the tree will carry, for tests/UI preview without persisting."""

    class _Fake:
        def __init__(self, n: Node, ordinal: int, parent_id, level):
            self.id = uuid.uuid4()
            self.parent_id = parent_id
            self.ordinal = ordinal
            self.number_style = n.number_style
            self.source_number = None
            self.heading = n.heading
            self.text = {"plain": n.text}
            self.locked = True
            self.category = "general"
            self.provenance = None

    rows = []

    def walk(nodes: list[Node], parent_id, level):
        for i, n in enumerate(nodes, start=1):
            f = _Fake(n, i, parent_id, level)
            rows.append(f)
            walk(n.children, f.id, level + 1)

    walk(parsed.sections, None, 0)
    return [r.number for r in render(rows)]  # type: ignore[arg-type]
