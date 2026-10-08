"""General-terms DOCX → clause tree (node-per-marked-item rule).

The landlord's lease template (Üürileping.docx) carries the general terms as (usually) Word auto-numbered paragraphs:
level 0 = section heading (MÕISTED, LEPINGU ESE, …), level 1 = numbered point, level 2 = sub-point. Extraction is in
two steps: python-docx pulls the paragraphs with their numbering levels (deterministic), then the chat model turns them
into the tree — it copes with typed-in numbers, inconsistent levels and templates whose terms heading is phrased
differently. Numbers are never read from the text: the tree gets the numbers the renderer derives (1, 1.1, 1.2, 2 …).
In fake LLM mode the provider rebuilds the tree from the numbering levels alone (``tree_from_levels``).
"""

from __future__ import annotations

import io
import json
import re
import uuid
from dataclasses import dataclass
from typing import Any

import structlog
from docx import Document
from docx.oxml.ns import qn
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.prompts import general_terms as prompt
from app.agent.providers.base import chat_model
from app.domain.clauses import Node, render, write_tree
from app.domain.errors import ValidationFailed
from app.domain.events import Actor, emit
from app.infra.blobstore import blobstore, sha256
from app.models.core import Attachment, Template

log = structlog.get_logger()

GENERAL_TERMS_MARKER = "ÜLDTINGIMUSED"
_TYPED_NUMBER = re.compile(r"^(?:\d+(?:\.\d+)*\.?|[a-zA-Z]\)|[-–•])\s+")


@dataclass
class ParsedTerms:
    sections: list[Node]
    section_count: int
    point_count: int
    model: str | None = None
    usage: dict[str, int] | None = None


def _level(paragraph) -> int | None:
    pPr = paragraph._p.pPr
    if pPr is None or pPr.numPr is None:
        return None
    ilvl = pPr.numPr.find(qn("w:ilvl"))
    return int(ilvl.get(qn("w:val"))) if ilvl is not None else 0


def extract_paragraphs(data: bytes) -> list[dict[str, Any]]:
    """Non-empty paragraphs in order with Word's numbering level and style — the model's input."""
    try:
        doc = Document(io.BytesIO(data))
    except Exception as e:  # BadZipFile / PackageNotFoundError: a PDF, a .doc, an empty upload
        raise ValidationFailed("Fail ei ole Word-dokument (.docx)") from e
    out: list[dict[str, Any]] = []
    for p in doc.paragraphs:
        text = " ".join(p.text.split())
        if not text:
            continue
        style = p.style.name if p.style is not None else None
        out.append({"i": len(out), "text": text, "level": _level(p), "style": style})
    if not out:
        raise ValidationFailed("Dokument on tühi")
    return out


def tree_from_levels(paragraphs: list[dict[str, Any]]) -> list[Node]:
    """Rule-based tree from the numbering levels alone (the fake provider's path; no model involved)."""
    started = False
    sections: list[Node] = []
    stack: list[Node] = []  # current path: [section, point, subpoint]
    for p in paragraphs:
        text = p["text"]
        if not started:
            if GENERAL_TERMS_MARKER in text.upper():
                started = True
            continue
        lvl = p["level"]
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
    return sections


def _nodes(items: list[dict[str, Any]]) -> list[Node]:
    out: list[Node] = []
    for it in items:
        text = _TYPED_NUMBER.sub("", " ".join(str(it.get("text", "")).split()))
        if not text:
            continue
        out.append(Node(text=text, number_style="decimal", children=_nodes(it.get("subpoints") or [])))
    return out


def tree_from_model(data: dict[str, Any]) -> list[Node]:
    sections: list[Node] = []
    for s in data.get("sections") or []:
        heading = _TYPED_NUMBER.sub("", " ".join(str(s.get("heading", "")).split()))
        if not heading:
            continue
        sections.append(Node(text="", heading=heading.title() if heading.isupper() else heading, number_style="decimal",
                             children=_nodes(s.get("points") or [])))
    return sections


async def parse_general_terms(data: bytes) -> ParsedTerms:
    paragraphs = extract_paragraphs(data)
    payload = json.dumps({"paragraphs": paragraphs}, ensure_ascii=False)
    try:
        res = await chat_model().structured(system=prompt.SYSTEM, user=payload, schema=prompt.schema())
    except Exception as e:
        log.error("general_terms_model_failed", error=str(e)[:300])
        raise ValidationFailed("Üldtingimuste lugemine ebaõnnestus; proovi uuesti") from e
    sections = tree_from_model(res.data)
    if not sections or not any(s.children for s in sections):
        raise ValidationFailed("Dokumendist ei leitud üldtingimusi (nummerdatud jagusid pärast pealkirja ÜLDTINGIMUSED)")
    points = sum(_count(s.children) for s in sections)
    log.info("general_terms_parsed", model=res.model, sections=len(sections), points=points, prompt=prompt.PROMPT_VERSION)
    return ParsedTerms(sections=sections, section_count=len(sections), point_count=points, model=res.model, usage=res.usage)


def _count(nodes: list[Node]) -> int:
    return sum(1 + _count(n.children) for n in nodes)


async def ingest_general_terms_docx(
    session: AsyncSession, actor: Actor, *, company_id: uuid.UUID | None, name: str, filename: str, data: bytes
) -> Template:
    """Store the DOCX, parse it, write the clause tree, and version the template (old version archived)."""
    from sqlalchemy import select

    parsed = await parse_general_terms(data)
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
         {"version": tpl.version, "sections": parsed.section_count, "points": parsed.point_count, "nodes": len(rows),
          "supersedes": prev.id if prev else None, "model": parsed.model, "prompt": prompt.PROMPT_VERSION, "usage": parsed.usage})
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
