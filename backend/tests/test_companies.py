from httpx import AsyncClient


async def test_company_crud(client: AsyncClient, admin: dict):
    r = await client.post("/api/v1/companies", json={"name": "Taevavärava OÜ", "registry_code": "12345678", "email": "info@taevavarav.ee"})
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["name"] == "Taevavärava OÜ" and c["registry_code"] == "12345678" and c["logo_attachment_id"] is None

    r = await client.get("/api/v1/companies")
    assert r.status_code == 200 and [x["id"] for x in r.json()] == [c["id"]]

    r = await client.patch(f"/api/v1/companies/{c['id']}", json={"accent_color": "#0055aa", "phone": "+372 555 1234"})
    assert r.status_code == 200 and r.json()["accent_color"] == "#0055aa" and r.json()["phone"] == "+372 555 1234"

    r = await client.patch(f"/api/v1/companies/{c['id']}", json={"name": "   "})
    assert r.status_code == 400 and "tühi" in r.json()["detail"]

    r = await client.request("DELETE", f"/api/v1/companies/{c['id']}")
    assert r.status_code == 204
    assert (await client.get("/api/v1/companies")).json() == []
    assert (await client.get(f"/api/v1/companies/{c['id']}")).status_code == 404

    ev = await client.get("/api/v1/audit", params={"entity_type": "company", "entity_id": c["id"]})
    assert [e["action"] for e in ev.json()] == ["company.deleted", "company.updated", "company.created"]


async def test_company_autofill_from_ariregister(client: AsyncClient, admin: dict):
    r = await client.post("/api/v1/companies", json={"registry_code": "14456789"})
    assert r.status_code == 201, r.text
    c = r.json()
    assert c["name"] == "Future Invest OÜ" and c["address"] == "Tartu mnt 2, Tallinn" and c["vat_number"] == "EE102345678"

    r = await client.post("/api/v1/companies", json={"registry_code": "00000000"})
    assert r.status_code == 400 and "ei leitud" in r.json()["detail"]

    r = await client.post("/api/v1/companies", json={})
    assert r.status_code == 400


async def test_company_logo_upload(client: AsyncClient, admin: dict):
    c = (await client.post("/api/v1/companies", json={"name": "Logo OÜ"})).json()
    png = b"\x89PNG\r\n\x1a\n" + b"0" * 100
    r = await client.post(f"/api/v1/companies/{c['id']}/logo", files={"file": ("logo.png", png, "image/png")})
    assert r.status_code == 200, r.text
    att_id = r.json()["logo_attachment_id"]
    assert att_id
    r = await client.get("/api/v1/attachments", params={"subject_type": "company", "subject_id": c["id"]})
    assert r.status_code == 200 and r.json()[0]["id"] == att_id and r.json()[0]["role"] == "logo"
    r = await client.get(f"/api/v1/attachments/{att_id}/url")
    assert r.status_code == 200 and r.json()["url"].startswith("memory://account/")

    r = await client.post(f"/api/v1/companies/{c['id']}/logo", files={"file": ("logo.pdf", b"%PDF-1.4", "application/pdf")})
    assert r.status_code == 400
    r = await client.post(f"/api/v1/companies/{c['id']}/logo", files={"file": ("big.png", b"0" * (1024 * 1024 + 1), "image/png")})
    assert r.status_code == 413


async def test_integration_lookups(client: AsyncClient, admin: dict):
    r = await client.get("/api/v1/integrations/ariregister", params={"q": "maru"})
    assert r.status_code == 200 and r.json()[0]["registry_code"] == "10192710"
    r = await client.get("/api/v1/integrations/ehr", params={"q": "betooni"})
    assert r.status_code == 200 and r.json()[0]["ehr_code"] == "120655847" and r.json()[0]["net_area_m2"] == 2612
    await client.post("/api/v1/auth/logout")
    assert (await client.get("/api/v1/integrations/ehr", params={"q": "betooni"})).status_code == 401
