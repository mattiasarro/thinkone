import json
import pathlib
import re

from app.ingest.docx_terms import parse_general_terms, preview_numbers

DOCX = pathlib.Path("/Users/m/code/thinkone/demo/Üürileping/Üürileping.docx")
JS = pathlib.Path("/Users/m/code/thinkone/demo/demo/uldtingimused.js")


def _expected():
    raw = JS.read_text(encoding="utf-8")
    return json.JSONDecoder().raw_decode(raw[raw.index("["):])[0]


def test_docx_general_terms_match_reference_extraction():
    parsed = parse_general_terms(DOCX.read_bytes())
    expected = _expected()
    assert parsed.section_count == len(expected) == 18
    exp_refs = [p["ref"] for s in expected for p in s["punktid"]]
    numbers = preview_numbers(parsed)
    points = [n for n in numbers if "." in n]
    # The reference extraction flattened Word's third level (5.5.1 → "5.6"); the tree keeps the
    # marked sub-points as nested nodes, so counts and depth-first text order must agree.
    assert len(points) == len(exp_refs) == parsed.point_count == 114
    assert sum("." in n and n.count(".") == 2 for n in points) > 0  # third level exists in the source
    assert [n for n in points if n.count(".") == 1][:5] == ["1.1", "1.2", "2.1", "3.1", "3.2"]
    exp_texts = [re.sub(r"\s+", " ", p["tekst"]).strip() for s in expected for p in s["punktid"]]

    def flat(nodes):
        for n in nodes:
            yield n.text
            yield from flat(n.children)

    got_texts = [t for s in parsed.sections for t in flat(s.children)]
    mismatches = [i for i, (a, b) in enumerate(zip(exp_texts, got_texts, strict=True)) if a != b]
    assert len(mismatches) <= 3, mismatches[:5]


async def test_render_numbers_and_write_tree(client, admin):
    import uuid

    from app.domain.clauses import Node, rendered_tree, write_tree
    from app.domain.events import Actor
    from app.infra.db import tenant_session
    from app.models.core import Template

    aid = uuid.UUID(admin["account"]["id"])
    actor = Actor(account_id=aid, user_id=uuid.UUID(admin["user_id"]), role="admin")
    nodes = [Node(text="", heading="Mõisted", children=[Node(text="a"), Node(text="b", children=[Node(text="b-i", number_style="alpha")])]),
             Node(text="", heading="Ese", children=[Node(text="c")])]
    async with tenant_session(aid) as s:
        t = Template(account_id=aid, kind="general_terms", name="t", body={}, node_count=0)
        s.add(t)
        await s.flush()
        await write_tree(s, actor, nodes, template_id=t.id, locked=True)
        tid = t.id
    async with tenant_session(aid) as s:
        r = await rendered_tree(s, template_id=tid)
    assert [x.number for x in r] == ["1", "1.1", "1.2", "1.2.a", "2", "2.1"]
    assert all(x.locked for x in r)
