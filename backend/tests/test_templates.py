import pytest
from httpx import AsyncClient

from tests.helpers import make_company


async def test_template_versioning(client: AsyncClient, admin: dict):
    company = await make_company(client)
    r = await client.post("/api/v1/templates", json={"kind": "special_terms_base", "name": "Eritingimused", "company_id": company["id"], "body": {"text": "# v1"}})
    assert r.status_code == 201, r.text
    v1 = r.json()
    assert v1["version"] == 1 and v1["is_current"] and v1["body"] == {"text": "# v1"} and v1["supersedes_id"] is None

    r = await client.post("/api/v1/templates", json={"kind": "special_terms_base", "name": "Eritingimused", "company_id": company["id"], "body": {"text": "# v2"}})
    v2 = r.json()
    assert v2["version"] == 2 and v2["supersedes_id"] == v1["id"] and v2["is_current"]

    # a different company (or account-wide) template of the same kind is its own lineage
    r = await client.post("/api/v1/templates", json={"kind": "quote_base", "name": "Pakkumise alus", "body": {"text": "Tere"}})
    assert r.status_code == 201 and r.json()["version"] == 1 and r.json()["company_id"] is None

    rows = (await client.get("/api/v1/templates", params={"company_id": company["id"]})).json()
    assert [(t["version"], t["is_current"]) for t in rows] == [(2, True), (1, False)]
    rows = (await client.get("/api/v1/templates", params={"company_id": company["id"], "include_history": "false"})).json()
    assert [t["id"] for t in rows] == [v2["id"]]
    assert len((await client.get("/api/v1/templates")).json()) == 3

    old = (await client.get(f"/api/v1/templates/{v1['id']}")).json()
    assert old["is_current"] is False and old["body"]["text"] == "# v1"

    r = await client.post("/api/v1/templates", json={"kind": "general_terms", "name": "Üld", "body": {"text": "x"}})
    assert r.status_code == 422
    r = await client.post("/api/v1/templates", json={"kind": "quote_base", "name": "Tühi", "body": {"text": "   "}})
    assert r.status_code == 400

    ev = (await client.get("/api/v1/audit", params={"entity_type": "template"})).json()
    assert {e["action"] for e in ev} == {"template.created", "template.superseded"}


async def test_general_terms_docx_import(client: AsyncClient, admin: dict):
    pytest.importorskip("app.ingest.docx_terms")
    docx = pytest.importorskip("docx")
    import io

    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn

    def numbered(doc, text: str, ilvl: int) -> None:
        """Word auto-numbered paragraph (the ingester derives numbers from ``numPr``, never from the text)."""
        p = doc.add_paragraph(text)
        num_pr = OxmlElement("w:numPr")
        for tag, val in (("w:ilvl", str(ilvl)), ("w:numId", "1")):
            el = OxmlElement(tag)
            el.set(qn("w:val"), val)
            num_pr.append(el)
        p._p.get_or_add_pPr().append(num_pr)

    d = docx.Document()
    d.add_paragraph("ÜÜRILEPINGU ÜLDTINGIMUSED")
    numbered(d, "ÜLDSÄTTED", 0)
    numbered(d, "Üürileandja annab pinna kasutusse.", 1)
    numbered(d, "Üürnik tasub üüri.", 1)
    numbered(d, "ÜÜR", 0)
    numbered(d, "Üür tasutakse igakuiselt.", 1)
    buf = io.BytesIO()
    d.save(buf)
    r = await client.post("/api/v1/templates/general-terms", data={"name": "Üldtingimused T6B"}, files={"file": ("yld.docx", buf.getvalue(), "application/octet-stream")})
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["kind"] == "general_terms" and t["version"] == 1 and t["node_count"] >= 5 and t["is_current"]
    assert (await client.get(f"/api/v1/templates/{t['id']}")).status_code == 200
