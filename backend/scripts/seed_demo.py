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
SAMPLES = DEMO / "importitud"

SPACES = [  # from demo/demo/data.js (Hoone T6B, real m²)
    ("Pind 1", "ladu", 214.5, 7.5), ("Pind 2", "ladu", 174.8, 7.6), ("Pind 4", "büroo", 96.0, 9.0), ("Pind 6", "ladu", 302.0, 7.2),
    ("Pind 8", "tootmine", 410.0, 6.9), ("Pind 12", "büroo", 128.0, 9.5), ("Pind 14", "ladu", 188.0, 7.5), ("Pind 16", "ladu", 176.0, 7.5),
    ("Pind 18", "büroo", 88.0, 9.0), ("Pind 20", "ladu", 250.0, 7.3), ("Pind 24", "tootmine", 330.0, 7.0), ("Pind 29", "ladu", 174.8, 7.6),
]


def main() -> None:
    c = httpx.Client(base_url=BASE, timeout=60)
    email = f"demo+{int(time.time())}@thinkone.local"
    r = c.post("/api/v1/auth/register", json={"account_name": "Taevavärava OÜ", "email": email, "name": "Tarmo Sepp", "password": "demo-parool-123"})
    r.raise_for_status()
    print("account:", r.json()["account"]["name"], "login:", email, "/ demo-parool-123")
    co = c.post("/api/v1/companies", json={"name": "Taevavärava OÜ", "registry_code": "16333502", "address": "Valukoja 8/1, 11415 Tallinn", "vat_number": "EE102420203"}).json()
    ehr = c.get("/api/v1/integrations/ehr", params={"q": "Tuleviku tee 6b"}).json()
    attrs = {k: v for k, v in (ehr[0] if ehr else {}).items() if k in ("ehr_code", "address", "use_type", "footprint_m2", "net_area_m2", "floors", "build_year")}
    attrs.update({"vat_taxable": True, "utility_cost_winter": 2.1, "utility_cost_summer": 1.4, "utility_source": "manual"})
    prop = c.post("/api/v1/assets", json={"type_code": "property", "name": "Hoone T6B", "company_id": co["id"], "attributes": attrs}).json()
    csv = "nimi;tüüp;üüripind;hind\n" + "\n".join(f"{n};{t};{a};{p}" for n, t, a, p in SPACES)
    imp = c.post(f"/api/v1/assets/{prop['id']}/spaces/import", params={"dry_run": "false"}, json={"text": csv}).json()
    print("spaces:", imp.get("created"), "created")
    spaces = {s["name"]: s for s in c.get("/api/v1/assets", params={"type_code": "space", "parent_id": prop["id"]}).json()}
    for plan in ("T6B_pinnaplaan.pdf", "T6B_parkimisskeem.pdf"):
        f = DEMO / "demo" / "lisad" / plan
        if f.exists():
            c.post("/api/v1/attachments", data={"subject_type": "asset", "subject_id": prop["id"], "role": "site_plan" if "parkimis" in plan else "floor_plan"},
                   files={"file": (plan, f.read_bytes(), "application/pdf")})
    gt = DEMO / "Üürileping" / "Üürileping.docx"
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

    import_file(SAMPLES / "üürileping-maru ehitus" / "Üürileping P_29 MARU Ehitus.pdf", "application/pdf", spaces.get("Pind 29", {}).get("id"))
    import_file(SAMPLES / "hooldus" / "HOOLDUSLEPING Nr H5.08 (003) draft vm 230530.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", prop["id"])
    h = c.get("/api/v1/portfolio/health").json()
    print("health:", h["totals"], [(f["code"], f["count"]) for f in h["findings"]])


if __name__ == "__main__":
    main()
