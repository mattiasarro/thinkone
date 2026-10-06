#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Riskiraporti PÄRIS andmed demo klientidele — avaandmetest faili demo/riskiandmed.js.

Käivita:  python tools/riskiandmed.py            (failid vahemälus kuni 20 h)
          python tools/riskiandmed.py --värske   (laeb kõik uuesti alla)

Registrikoodid loetakse failist demo/data.js (iga `registrikood: "NNNNNNNN"`), seega uue
kliendi lisamisel piisab skripti uuesti jooksutamisest. Sõltuvusi pole (ainult standardteek).

Allikad (kõik avaandmed, CC-litsents):
  Äriregister  · lihtandmed (nimi, staatus, esmakanne, aadress, KMKR)          — uueneb iga päev
  Äriregister  · majandusaasta aruannete üldandmed + põhinäitajad 2022–2025    — kord kuus
  EMTA         · maksuvõlglaste nimekiri                                        — iga päev
  EMTA         · tasutud maksud, käive ja töötajate arv kvartalite kaupa        — kord kvartalis
Avaandmetes EI OLE: maksehäired (Krediidiinfo, tasuline), täitemenetlused, tegelikud kasusaajad
(alates 10.07.2026), isikukoodid.
"""
import csv, io, json, os, re, sys, tempfile, time, urllib.request, zipfile

JUUR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_JS = os.path.join(JUUR, "demo", "data.js")
VALJUND = os.path.join(JUUR, "demo", "riskiandmed.js")
CACHE = os.path.join(tempfile.gettempdir(), "thinkone-avaandmed")
AR = "https://avaandmed.ariregister.rik.ee/sites/default/files/"
AASTAD = [2022, 2023, 2024, 2025]

# aruande elemendi nimi (XBRL) → meie võti; konsolideerimata näitaja on eelistatud
ELEMENDID = {
    "Revenue": "myygitulu", "TotalAnnualPeriodProfitLoss": "puhaskasum", "TotalProfitLoss": "arikasum",
    "Equity": "omakapital", "Assets": "varad", "CurrentAssets": "kaibevara",
    "CurrentLiabilities": "lyhikohustised", "NonCurrentLiabilities": "pikkkohustised",
    "CashAndCashEquivalents": "raha", "LaborExpense": "toojoukulu",
    "AverageNumberOfEmployeesInFullTimeEquivalentUnits": "tootajaid",
}


def lae(url, nimi, varske):
    os.makedirs(CACHE, exist_ok=True)
    tee = os.path.join(CACHE, nimi)
    if not varske and os.path.exists(tee) and time.time() - os.path.getmtime(tee) < 20 * 3600:
        return tee
    print("  laen", nimi, "…", flush=True)
    req = urllib.request.Request(url, headers={"User-Agent": "thinkone-demo/1.0"})
    with urllib.request.urlopen(req, timeout=600) as r, open(tee + ".osa", "wb") as f:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            f.write(b)
    os.replace(tee + ".osa", tee)
    return tee


def zip_csv(tee, eraldaja=";"):
    z = zipfile.ZipFile(tee)
    f = z.open(z.namelist()[0])
    return csv.reader(io.TextIOWrapper(f, encoding="utf-8-sig"), delimiter=eraldaja)


def arv(s):
    s = (s or "").strip().replace(",", ".")
    if not s:
        return None
    try:
        v = float(s)
        return int(v) if v == int(v) else round(v, 2)
    except ValueError:
        return None


def main():
    varske = any(a in ("--värske", "--varske", "--fresh") for a in sys.argv[1:])
    koodid = sorted(set(re.findall(r'registrikood:\s*"(\d{8})"', open(DATA_JS, encoding="utf-8-sig").read())))
    print(f"{len(koodid)} registrikoodi failist demo/data.js")
    K = set(koodid)
    out = {k: {"kood": k, "aruanded": [], "naitajad": {}, "kvartalid": [], "volg": None} for k in koodid}

    # 1) Äriregister · lihtandmed
    rd = zip_csv(lae(AR + "avaandmed/ettevotja_rekvisiidid__lihtandmed.csv.zip", "lihtandmed.zip", varske))
    h = next(rd)
    ix = {n: i for i, n in enumerate(h)}
    for r in rd:
        k = r[ix["ariregistri_kood"]]
        if k in K:
            out[k]["reg"] = {
                "nimi": r[ix["nimi"]], "vorm": r[ix["ettevotja_oiguslik_vorm"]], "kmkr": r[ix["kmkr_nr"]] or None,
                "staatus": r[ix["ettevotja_staatus"]], "staatusTekst": r[ix["ettevotja_staatus_tekstina"]],
                "esmakanne": r[ix["ettevotja_esmakande_kpv"]], "aadress": r[ix["ads_normaliseeritud_taisaadress"]],
                "indeks": r[ix["indeks_ettevotja_aadressis"]], "link": r[ix["teabesysteemi_link"]],
            }

    # 2) Äriregister · aruannete üldandmed (report_id ↔ registrikood) + põhinäitajad
    rd = zip_csv(lae(AR + "1.aruannete_yldandmed_kuni_31082026.zip", "aruannete_yldandmed.zip", varske))
    next(rd)
    rid = {}
    for r in rd:
        k, aasta = r[2], arv(r[5])
        if k in K and aasta in AASTAD:
            rid[r[0]] = (k, aasta)
            out[k]["aruanded"].append({
                "aasta": aasta, "periood": [r[7], r[8]], "esitatud": r[9], "auditeeritud": r[10] == "Jah",
                "kategooria": r[11], "otsus": r[14] or None, "jatkuvus": r[17] or None,
            })
    for aasta in AASTAD:
        rd = zip_csv(lae(AR + f"4.{aasta}_aruannete_elemendid_kuni_31082026.zip", f"elemendid_{aasta}.zip", varske))
        next(rd)
        for r in rd:
            if r[0] in rid and r[3] in ELEMENDID:
                k, a = rid[r[0]]
                out[k]["naitajad"].setdefault(str(a), {}).setdefault(ELEMENDID[r[3]], arv(r[4]))

    # 3) EMTA · maksuvõlg
    tee = lae("https://ncfailid.emta.ee/s/XKJLjtynFeYdGyC/download/maksuvolglaste_nimekiri.csv", "maksuvolg.csv", varske)
    volg_seis = None
    for r in csv.reader(open(tee, encoding="utf-8-sig"), delimiter=";"):
        if len(r) < 8 or not r[1].isdigit():
            continue
        volg_seis = volg_seis or r[0]
        if r[1] in K:
            out[r[1]]["volg"] = {"summa": arv(r[3]), "vaidlustatud": arv(r[4]), "graafikus": arv(r[5]),
                                 "graafikuLopp": r[6] or None, "vanim": r[7] or None}

    # 4) EMTA · tasutud maksud, käive, töötajad (kvartalid)
    kv_seis = None
    for url, nimi in (("https://ncfailid.emta.ee/s/bCszrta8THHA9xn/download/tasutud_maksud_varasemad_aastad.csv", "maksud_varasemad.csv"),
                      ("https://ncfailid.emta.ee/s/DFHQjB2Rsq3CK7p/download/tasutud_maksud_kaesolev_aasta.csv", "maksud_kaesolev.csv")):
        f = open(lae(url, nimi, varske), encoding="utf-8-sig")
        pea = f.readline()
        f.seek(0)
        rd = csv.reader(f, delimiter=";" if pea.count(";") > pea.count(",") else ",")
        next(rd)
        for r in rd:
            if len(r) < 23 or r[1] not in K:
                continue
            if nimi == "maksud_kaesolev.csv":
                kv_seis = r[0]
            out[r[1]]["tegevusala"] = r[5].strip().capitalize()
            for q in range(4):
                kaive = arv(r[15 + q])
                if kaive is None and arv(r[7 + q]) is None:
                    continue
                out[r[1]]["kvartalid"].append({"a": arv(r[6]), "kv": q + 1, "kaive": kaive, "riiklikud": arv(r[7 + q]),
                                               "toojoud": arv(r[11 + q]), "tootajaid": arv(r[19 + q])})

    for k in koodid:
        d = out[k]
        d["aruanded"].sort(key=lambda a: a["aasta"])
        d["kvartalid"].sort(key=lambda q: (q["a"], q["kv"]))
        if "reg" not in d:
            print("  ! registris pole:", k)
    leitud = {k: v for k, v in out.items() if "reg" in v}
    meta = {"koostatud": time.strftime("%d.%m.%Y"), "volgSeis": volg_seis, "kvartalidSeis": kv_seis,
            "aruandedSeis": "31.08.2026"}
    with open(VALJUND, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* GENEREERITUD — ära muuda käsitsi. Allikas: tools/riskiandmed.py (Äriregistri ja EMTA avaandmed).\n"
                "   Uuenda: python tools/riskiandmed.py */\n")
        f.write("const RISKIANDMED_META = " + json.dumps(meta, ensure_ascii=False) + ";\n")
        f.write("const RISKIANDMED = " + json.dumps(leitud, ensure_ascii=False, indent=1) + ";\n")
    print(f"kirjutatud {os.path.relpath(VALJUND, JUUR)} · {len(leitud)}/{len(koodid)} ettevõtet · {os.path.getsize(VALJUND) // 1024} KB")


if __name__ == "__main__":
    main()
