"""Seed a running API with the demo portfolio: account, company, Hoone T6B + spaces, the two sample contracts.

Usage: uv run python scripts/seed_demo.py [http://localhost:8000]
Idempotent enough for dev: re-running registers a new account each time (use a fresh DB for a clean demo).
"""

from __future__ import annotations

import pathlib
import sys
import time

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
DEMO = pathlib.Path(__file__).resolve().parents[2] / "demo"
SAMPLES = DEMO / "demo" / "lisad" / "importitud"  # the client's demo package ships the sample originals

# name, type, rentable m², (ladu, kontor, olmeala) m², €/m², A, parking spot numbers — demo/demo/data.js (Hoone T6B)
SPACES = [
    ("Pind 1", "ladu", 214.5, (180, 24.5, 10), 7.5, 32, "1, 2"), ("Pind 2", "ladu", 174.8, (150, 14.8, 10), 7.6, 32, "3"),
    ("Pind 4", "büroo", 96.0, (0, 86, 10), 9.0, 25, "4, 5"), ("Pind 6", "ladu", 302.0, (260, 32, 10), 7.2, 40, "6, 7, 8"),
    ("Pind 8", "tootmine", 410.0, (370, 30, 10), 6.9, 63, "9, 10, 11"), ("Pind 12", "büroo", 128.0, (0, 118, 10), 9.5, 25, "12"),
    ("Pind 14", "ladu", 188.0, (160, 18, 10), 7.5, 32, "13, 14"), ("Pind 16", "ladu", 176.0, (150, 16, 10), 7.5, 32, "15"),
    ("Pind 18", "büroo", 88.0, (0, 78, 10), 9.0, 25, "16"), ("Pind 20", "ladu", 250.0, (220, 20, 10), 7.3, 40, "17, 18"),
    ("Pind 24", "tootmine", 330.0, (290, 30, 10), 7.0, 63, "19, 20"), ("Pind 29", "ladu", 174.8, (150, 14.8, 10), 7.6, 32, "21, 22"),
]


def main() -> None:
    c = httpx.Client(base_url=BASE, timeout=60)
    email = f"demo+{int(time.time())}@example.com"
    r = c.post("/api/v1/auth/register", json={"account_name": "Taevavärava OÜ", "email": email, "name": "Tarmo Sepp", "password": "demo-parool-123"})
    r.raise_for_status()
    print("account:", r.json()["account"]["name"], "login:", email, "/ demo-parool-123")
    co = c.post("/api/v1/companies", json={"name": "Taevavärava OÜ", "registry_code": "16333502", "address": "Valukoja 8/1, 11415 Tallinn", "vat_number": "EE102420203"}).json()
    ehr = c.get("/api/v1/integrations/ehr", params={"q": "Tuleviku tee 6b"}).json()
    attrs = {k: v for k, v in (ehr[0] if ehr else {}).items() if k in ("ehr_code", "address", "use_type", "footprint_m2", "net_area_m2", "floors", "build_year")}
    attrs.update({"vat_taxable": True, "utility_cost_winter": 2.1, "utility_cost_summer": 1.4, "utility_source": "manual"})
    prop = c.post("/api/v1/assets", json={"type_code": "property", "name": "Hoone T6B", "company_id": co["id"], "attributes": attrs}).json()
    csv = "nimi;tüüp;üüripind;ladu;kontor;olmeala;hind;elekter;parkimiskohad\n" + "\n".join(
        f"{n};{t};{a};{l or ''};{k or ''};{o or ''};{p};{e};{pk}" for n, t, a, (l, k, o), p, e, pk in SPACES)
    imp = c.post(f"/api/v1/assets/{prop['id']}/spaces/import", params={"dry_run": "false"}, json={"text": csv}).json()
    print("spaces:", imp.get("created"), "created;", imp.get("parking_created"), "parking spots")
    c.post(f"/api/v1/assets/{prop['id']}/parking/import", params={"dry_run": "false"}, json={"text": "23-26;Hoov;elektriauto;\n27-30;Hoov;reserv;\n"})
    spaces = {s["name"]: s for s in c.get("/api/v1/assets", params={"type_code": "space", "parent_id": prop["id"]}).json()}
    park = DEMO / "demo" / "lisad" / "T6B_parkimisskeem.pdf"
    if park.exists():
        c.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": prop["id"], "role": "parking_plan"},
               files={"file": (park.name, park.read_bytes(), "application/pdf")})
    wanted = {n.split()[1].zfill(2) for n, *_ in SPACES}  # only the seeded spaces' plans; the rest would become whole-building plans
    plans = [f for f in sorted((DEMO / "demo" / "lisad" / "pinnad").glob("T6B_Pind_*.pdf")) if f.stem.rsplit("_", 1)[1] in wanted]  # matched by filename
    if plans:
        r = c.post(f"/api/v1/assets/{prop['id']}/plans", params={"dry_run": "false"}, files=[("files", (f.name, f.read_bytes(), "application/pdf")) for f in plans])
        print("plans:", r.status_code, sum(1 for x in r.json() if x["target"] == "space") if r.status_code < 300 else r.text[:200])
    gt = DEMO / "testfailid" / "lepingud" / "Üürileping.docx"
    if gt.exists():
        r = c.post("/api/v1/templates/general-terms", data={"name": "Äriruumide üürilepingu üldtingimused", "company_id": co["id"]},
                   files={"file": (gt.name, gt.read_bytes(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")})
        print("general terms:", r.status_code, r.json().get("node_count") if r.status_code < 300 else r.text[:200])

    def import_file(path: pathlib.Path, ctype: str, asset_id: str | None):
        job = c.post("/api/v1/imports", files={"file": (path.name, path.read_bytes(), ctype)}).json()
        for _ in range(120):
            j = c.get(f"/api/v1/imports/{job['id']}").json()
            if j["status"] in ("review", "failed", "committed"):
                break
            time.sleep(2)
        if j["status"] != "review":
            print("import", path.name, "→", j["status"], j.get("error"))
            return
        r = c.post(f"/api/v1/imports/{job['id']}/commit", json={"checked": j["uncertain"], "company_id": co["id"], "asset_id": asset_id})
        print("import", path.name, "→", r.status_code, r.json())

    import_file(SAMPLES / "MARU_uurileping_P29.pdf", "application/pdf", spaces.get("Pind 29", {}).get("id"))
    import_file(SAMPLES / "Hooldusleping_H5-08.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", prop["id"])
    h = c.get("/api/v1/portfolio/health").json()
    print("health:", h["totals"], [(f["code"], f["count"]) for f in h["findings"]])


if __name__ == "__main__":
    main()
