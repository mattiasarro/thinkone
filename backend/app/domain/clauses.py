"""Clause tree: nodes with derived numbering (architecture §2 "Clause structure, numbering & references").

Identity is ``clause.id``; the displayed number is a pure function of the committed tree
(walk ``parent_id`` to the container root, applying each level's ``number_style``).
For imported contracts the source document's own numbering is kept verbatim in
``source_number`` and shown instead of the derived number.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.events import Actor, emit
from app.models.contracts import Clause


@dataclass
class Node:
    """Input shape for writing a tree. ``children`` nest; ``text`` is plain text."""

    text: str
    heading: str | None = None
    number_style: str = "decimal"
    source_number: str | None = None
    category: str = "general"
    provenance: dict[str, Any] | None = None
    children: list[Node] = field(default_factory=list)
    # Phase 3 draft fields: fact_key (main clause ↔ deal fact), status (special clauses), origin_note, overrides_label, template_clause_id
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class RenderedClause:
    id: uuid.UUID
    number: str
    source_number: str | None
    heading: str | None
    text: str
    level: int
    locked: bool
    category: str
    parent_id: uuid.UUID | None
    provenance: dict[str, Any] | None = None
    container: str = "body"
    fact_key: str | None = None
    status: str | None = None
    origin_note: str | None = None
    overrides_clause_id: uuid.UUID | None = None
    overrides_label: str | None = None
    original_text: str | None = None

    @property
    def display_number(self) -> str:
        return self.source_number or self.number

    @property
    def changed(self) -> bool:
        return self.original_text is not None and self.original_text != self.text


def _label(style: str, ordinal: int) -> str:
    if style == "alpha":
        return chr(ord("a") + (ordinal - 1) % 26)
    if style == "roman":
        vals = [(10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
        n, out = ordinal, ""
        for v, s in vals:
            while n >= v:
                out += s
                n -= v
        return out
    if style in ("dash", "none"):
        return ""
    return str(ordinal)


async def write_tree(
    session: AsyncSession,
    actor: Actor,
    nodes: list[Node],
    *,
    contract_id: uuid.UUID | None = None,
    template_id: uuid.UUID | None = None,
    container: str = "body",
    source: str = "template",
    locked: bool = False,
    source_template_id: uuid.UUID | None = None,
) -> list[Clause]:
    """Persist a nested node list as clause rows. Nodes are created only here (authoring boundary)."""
    assert (contract_id is None) != (template_id is None), "exactly one owner"
    rows: list[Clause] = []

    async def _write(items: list[Node], parent: Clause | None) -> None:
        for i, n in enumerate(items, start=1):
            c = Clause(
                account_id=actor.account_id, contract_id=contract_id, template_id=template_id,
                parent_id=parent.id if parent else None, container=container, ordinal=i,
                number_style=n.number_style, category=n.category, heading=n.heading,
                text={"plain": n.text}, locked=locked, source=source, source_number=n.source_number,
                source_template_id=source_template_id, provenance=n.provenance,
                original_text=n.text if contract_id else None, fact_key=n.extra.get("fact_key"), status=n.extra.get("status"),
                origin_note=n.extra.get("origin_note"), overrides_label=n.extra.get("overrides_label"),
            )
            session.add(c)
            await session.flush()
            rows.append(c)
            if n.children:
                await _write(n.children, c)

    await _write(nodes, None)
    owner_type, owner_id = ("contract", contract_id) if contract_id else ("template", template_id)
    emit(session, actor, owner_type, owner_id, "clauses.written", {"count": len(rows), "container": container, "source": source})
    return rows


async def load_rows(session: AsyncSession, *, contract_id: uuid.UUID | None = None, template_id: uuid.UUID | None = None,
                    container: str | None = None) -> list[Clause]:
    stmt = select(Clause)
    stmt = stmt.where(Clause.contract_id == contract_id) if contract_id else stmt.where(Clause.template_id == template_id)
    if container:
        stmt = stmt.where(Clause.container == container)
    stmt = stmt.order_by(Clause.container, Clause.ordinal)
    return list((await session.execute(stmt)).scalars())


def render(rows: list[Clause]) -> list[RenderedClause]:
    """Depth-first flat list with derived numbers — the ONE numbering function (three renderers share it)."""
    by_parent: dict[uuid.UUID | None, list[Clause]] = {}
    for r in rows:
        by_parent.setdefault(r.parent_id, []).append(r)
    # roots are numbered per container (main · general · annex:N), in document order; children by ordinal
    for key, lst in by_parent.items():
        lst.sort(key=(lambda c: (container_order(c.container), c.ordinal)) if key is None else (lambda c: c.ordinal))
    out: list[RenderedClause] = []

    def walk(parent_id: uuid.UUID | None, prefix: str, level: int) -> None:
        for c in by_parent.get(parent_id, []):
            label = _label(c.number_style, c.ordinal)
            number = f"{prefix}.{label}" if prefix and label else (label or prefix)
            out.append(RenderedClause(
                id=c.id, number=number, source_number=c.source_number, heading=c.heading,
                text=(c.text or {}).get("plain", ""), level=level, locked=c.locked, category=c.category,
                parent_id=c.parent_id, provenance=c.provenance, container=c.container, fact_key=c.fact_key, status=c.status,
                origin_note=c.origin_note, overrides_clause_id=c.overrides_clause_id, overrides_label=c.overrides_label, original_text=c.original_text,
            ))
            walk(c.id, number if label else prefix, level + 1)

    walk(None, "", 0)
    return out


CONTAINER_ORDER = {"main": 0, "body": 1, "general": 2}


def container_order(container: str) -> tuple[int, int]:
    if container.startswith("annex:"):
        return (3, int(container.split(":", 1)[1] or 0))
    return (CONTAINER_ORDER.get(container, 1), 0)


def render_markdown(rendered: list[RenderedClause]) -> str:
    """LLM-context view: stable numbers + id anchors per node (architecture §6 Contract Q&A)."""
    lines = []
    for r in rendered:
        indent = "  " * r.level
        head = f" {r.heading}" if r.heading else ""
        lines.append(f"{indent}§{r.display_number}{head} [{r.id}] {r.text}".rstrip())
    return "\n".join(lines)


def to_dicts(rendered: list[RenderedClause]) -> list[dict[str, Any]]:
    return [
        {"id": r.id, "number": r.display_number, "derived_number": r.number, "source_number": r.source_number,
         "heading": r.heading, "text": r.text, "level": r.level, "locked": r.locked, "category": r.category,
         "parent_id": r.parent_id, "provenance": r.provenance, "container": r.container, "fact_key": r.fact_key, "status": r.status,
         "origin_note": r.origin_note, "overrides_clause_id": r.overrides_clause_id, "overrides_label": r.overrides_label,
         "changed": r.changed}
        for r in rendered
    ]


async def rendered_tree(session: AsyncSession, *, contract_id: uuid.UUID | None = None, template_id: uuid.UUID | None = None) -> list[RenderedClause]:
    return render(await load_rows(session, contract_id=contract_id, template_id=template_id))
