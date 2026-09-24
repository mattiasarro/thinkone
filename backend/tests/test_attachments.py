import hashlib
import uuid

from httpx import AsyncClient

from app.domain.attachments import resolve_content_type
from app.infra.blobstore import blobstore
from tests.helpers import make_company, make_property, make_space


async def test_attachment_upload_list_url_delete(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    pdf = b"%PDF-1.4 plaan"
    r = await client.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": prop["id"], "role": "site_plan"},
                          files={"file": ("Asendi plaan (v2).pdf", pdf, "application/pdf")})
    assert r.status_code == 201, r.text
    att = r.json()
    assert att["filename"] == "Asendi_plaan_v2_.pdf" and att["size"] == len(pdf) and att["sha256"] == hashlib.sha256(pdf).hexdigest()
    assert att["uploaded_by"] == admin["user_id"] and att["role"] == "site_plan"
    key = f"account/{admin['account']['id']}/asset/{prop['id']}/"
    assert (await client.get(f"/api/v1/attachments/{att['id']}/url")).json()["url"].startswith("memory://" + key)
    stored = [k for k in blobstore().data if k.startswith(key)]  # type: ignore[attr-defined]
    assert len(stored) == 1 and await blobstore().get(stored[0]) == pdf

    # octet-stream with a known extension is accepted (browsers do this for .asice)
    r = await client.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": prop["id"], "role": "generic"},
                          files={"file": ("leping.asice", b"PK\x03\x04", "application/octet-stream")})
    assert r.status_code == 201 and r.json()["content_type"] == "application/vnd.etsi.asic-e+zip"

    r = await client.get("/api/v1/attachments", params={"subject_type": "asset", "subject_id": prop["id"]})
    assert {a["id"] for a in r.json()} == {att["id"], r.json()[0]["id"], r.json()[1]["id"]} and len(r.json()) == 2
    detail = (await client.get(f"/api/v1/assets/{prop['id']}")).json()
    assert {a["role"] for a in detail["attachments"]} == {"site_plan", "generic"}

    assert (await client.request("DELETE", f"/api/v1/attachments/{att['id']}")).status_code == 204
    assert (await client.get(f"/api/v1/attachments/{att['id']}")).status_code == 404
    assert len((await client.get("/api/v1/attachments", params={"subject_type": "asset", "subject_id": prop["id"]})).json()) == 1


async def test_property_detail_includes_space_floor_plans(client: AsyncClient, admin: dict):
    company = await make_company(client)
    prop = await make_property(client, company["id"])
    a101 = await make_space(client, prop["id"], "A-101")
    await make_space(client, prop["id"], "A-102")
    r = await client.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": a101["id"], "role": "floor_plan"},
                          files={"file": ("pinnaplaan_A-101.pdf", b"%PDF-1.4 pind", "application/pdf")})
    assert r.status_code == 201, r.text
    detail = (await client.get(f"/api/v1/assets/{prop['id']}")).json()
    assert detail["attachments"] == []
    by_name = {c["name"]: c["attachments"] for c in detail["children"]}
    assert [(x["role"], x["filename"]) for x in by_name["A-101"]] == [("floor_plan", "pinnaplaan_A-101.pdf")]
    assert by_name["A-101"][0]["created_at"] and by_name["A-102"] == []

    assert (await client.request("DELETE", f"/api/v1/attachments/{r.json()['id']}")).status_code == 204
    detail = (await client.get(f"/api/v1/assets/{prop['id']}")).json()
    assert all(c["attachments"] == [] for c in detail["children"])


async def test_attachment_validation(client: AsyncClient, admin: dict):
    sid = str(uuid.uuid4())
    r = await client.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": sid, "role": "generic"},
                          files={"file": ("virus.exe", b"MZ", "application/x-msdownload")})
    assert r.status_code == 400 and r.json()["code"] == "unsupported_type"
    r = await client.post("/api/v1/attachments", data={"subject_type": "invoice", "subject_id": sid, "role": "generic"},
                          files={"file": ("a.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 400
    r = await client.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": sid, "role": "selfie"},
                          files={"file": ("a.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 400
    r = await client.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": sid, "role": "generic"},
                          files={"file": ("empty.pdf", b"", "application/pdf")})
    assert r.status_code == 400
    from app.infra.settings import get_settings

    big = b"0" * (get_settings().upload_max_bytes + 1)
    r = await client.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": sid, "role": "generic"},
                          files={"file": ("big.pdf", big, "application/pdf")})
    assert r.status_code == 413


def test_resolve_content_type():
    assert resolve_content_type("a.PDF", "application/pdf") == "application/pdf"
    assert resolve_content_type("a.docx", "application/octet-stream") == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    assert resolve_content_type("a.bdoc", "application/zip") == "application/vnd.etsi.asic-e+zip"
    assert resolve_content_type("a.jpg", "image/jpg") == "image/jpeg"
    import pytest

    from app.domain.errors import DomainError

    with pytest.raises(DomainError):
        resolve_content_type("a.txt", "text/plain")
    with pytest.raises(DomainError):
        resolve_content_type("a.zip", "application/zip")
