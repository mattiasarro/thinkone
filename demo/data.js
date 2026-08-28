/* ============================================================================
   ThinkOne — demokeskkonna näidisandmed (seemneandmed) · spetsifikatsioon v2
   Kaks sammast: esemeregister (hoone→pinnad · osakond→ametikohad) + lepingumootor.
   Vertikaalid: ärikinnisvara üürilepingud + töölepingud (sama mootor).
   Üürileandja/tööandja: Taevavärava OÜ · Hoone: T6B
   Kõik summad on neto (käibemaksuta), kui pole märgitud teisiti.
   ========================================================================== */

(function () { // IIFE: hoiab const-id lokaalsena (klassikalised <script>-id jagavad globaalset skoopi)
const VAT_RATE = 0.24; // Eesti standardmäär alates 01.07.2025

/* --- Mitu ettevõtet ühe konto all (spets etapp 01) --------------------------
   Aktiivne ettevõte valitakse külgribalt; valik püsib localStorage'is ja
   andmestik laetakse lehe taaslaadimisel vastava ettevõtte seemnest. */
const COMPANIES = [
  { id: "taeva", nimi: "Taevavärava OÜ", kontekst: "Hoone T6B · Haldus ja hooldus" },
  { id: "b11g",  nimi: "B11G OÜ",        kontekst: "Stock Office · Self Storage" },
];
let COMPANY_ID = "taeva";
try { const c = localStorage.getItem("thinkone_company"); if (COMPANIES.some(x => x.id === c)) COMPANY_ID = c; } catch (e) {}
function setCompany(id) {
  if (id === COMPANY_ID || !COMPANIES.some(x => x.id === id)) return;
  try { localStorage.setItem("thinkone_company", id); } catch (e) {}
  location.hash = "#/";
  location.reload();
}

/* --- Konto / Üürileandja (Ettevõte) -------------------------------------- */
const ACCOUNT = {
  name: "Taevavärava Kinnisvara",
  landlord: {
    nimi: "Taevavärava OÜ",
    registrikood: "16333502",
    kmkr: "EE102420203",
    aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald, Harju maakond, 75306",
    epost: "varne@futureinvest.info",
    mobiil: "+372 503 4135",
    asutatud: "05.10.2021",
    allikas: "e-äriregister",
    pank: "AS LHV Pank", iban: "EE267700771004561239",
    /* poolte esindajad rollide kaupa (originaalmalli p 6) */
    esindajad: { lepingulised: "varne@futureinvest.info", haldus: "haldus@futureinvest.info", arveldused: "arved@futureinvest.info" },
  },
};

/* --- Objekt: Hoone T6B (EHR baasandmed) ----------------------------------- */
const OBJEKT = {
  id: "obj-t6b",
  nimi: "Hoone T6B",
  logo: "lisad/T6B_logo.png", /* pakkumuse dokumendi päises — hoonepõhine bränd */
  ehr: {
    kood: "120542318",
    aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald",
    kasutusotstarve: "12521 — Büroo- ja laohoone",
    ehitisealunePind: 3215,
    suletudNetopind: 5840,
    korrusteArv: 2,
    ehitusaasta: 2019,
    allikas: "EHR ehitisregister",
  },
  korvalkulu: { talvine: 2.30, suvine: 1.45, allikas: "Moderan · viimase 12 kuu keskmine" },
  kaibemaksugaMaksustatud: true,
  lisa2: "Asendiplaan + parkimisskeem (T6B_asendiplaan.pdf)",
  failid: {
    pinnaplaan: "lisad/T6B_pinnaplaan.pdf",
    parkimine: "lisad/T6B_parkimisskeem.pdf",
  },
  mallid: {
    uldtingimused: "Äriruumide üürilepingu üldtingimused v3.2 (lukus)",
    eritingimused: "Eritingimuste põhi v1.4",
    pakkumus: "Pakkumuse põhi v2.0",
  },
};

/* Ettevõttel võib olla mitu objekti (Ettevõte → Objekt 1..n). OBJEKT = esimene/
   peamine hoone (tagasiühilduvus); OBJEKTID kannab kõiki aktiivse ettevõtte omi. */
const OBJEKTID = [OBJEKT];

/* täituvuse ajalugu (% üüripinnast, juuli 2025 – mai 2026) — jooksev kuu (juuni)
   EI OLE siin: see arvutub dashboardil hõivetest (staatus = projektsioon) */
const TAITUVUS_AJALUGU = [31, 31, 35, 35, 35, 38, 42, 42, 40, 38, 38];

/* --- Pinnad / üüripinnad --------------------------------------------------
   üüripind = netopindala + koefitsiendiga jaotatud üldkasutatav pind.
   hind on €/m² üüripinna kohta, kuus.
   jaotus = pinna osad (ladu/kontor/…) üüripinna m²-tes; osade summa = yyripind. */
const SPACES = [
  { id: "p1",  nr: 1,  nimi: "Pind 1",  tyyp: "Ladu + müügisaal", neto: 502.0, yyripind: 538.4, koef: 1.04, hind: 8.50, elekter: 63, parkimine: 6, plaan: "Lisa1_pind1.pdf", staatus: "Üüritud",        tenant: "Baltic Logistics OÜ",
    jaotus: [{ osa: "Ladu", m2: 420.0 }, { osa: "Müügisaal", m2: 118.4 }] },
  { id: "p2",  nr: 2,  nimi: "Pind 2",  tyyp: "Ladu",             neto: 172.0, yyripind: 184.2, koef: 1.05, hind: 7.80, elekter: 32, parkimine: 2, plaan: "Lisa1_pind2.pdf", staatus: "Vaba",           tenant: null },
  { id: "p3",  nr: 3,  nimi: "Pind 3",  tyyp: "Ladu",             neto: 180.1, yyripind: 192.5, koef: 1.04, hind: 7.80, elekter: 32, parkimine: 2, plaan: "Lisa1_pind3.pdf", staatus: "Pakkumusel",     tenant: "Roheline Ladu OÜ" },
  { id: "p4",  nr: 4,  nimi: "Pind 4",  tyyp: "Ladu + kontor",    neto: 333.5, yyripind: 357.2, koef: 1.05, hind: 8.20, elekter: 40, parkimine: 4, plaan: "Lisa1_pind4.pdf", staatus: "Lepingus",       tenant: "Nordproff OÜ",
    jaotus: [{ osa: "Ladu", m2: 268.4 }, { osa: "Kontor", m2: 88.8 }] },
  { id: "p5",  nr: 5,  nimi: "Pind 5",  tyyp: "Ladu + kontor",    neto: 340.2, yyripind: 364.0, koef: 1.05, hind: 8.20, elekter: 40, parkimine: 4, plaan: "Lisa1_pind5.pdf", staatus: "Reserveeritud",  tenant: "Mikrotehnika AS",
    jaotus: [{ osa: "Ladu", m2: 274.0 }, { osa: "Kontor", m2: 90.0 }] },
  { id: "p6",  nr: 6,  nimi: "Pind 6",  tyyp: "Ladu + kontor",    neto: 349.0, yyripind: 373.6, koef: 1.05, hind: 8.40, elekter: 40, parkimine: 4, plaan: "Lisa1_pind6.pdf", staatus: "Pakkumusel",     tenant: "Mikrotehnika AS",
    jaotus: [{ osa: "Ladu", m2: 281.6 }, { osa: "Kontor", m2: 92.0 }] },
  { id: "p7",  nr: 7,  nimi: "Pind 7",  tyyp: "Ladu + kontor",    neto: 333.4, yyripind: 357.0, koef: 1.05, hind: 8.30, elekter: 40, parkimine: 3, plaan: "Lisa1_pind7.pdf", staatus: "Üüritud",        tenant: "Estplast OÜ",
    jaotus: [{ osa: "Ladu", m2: 268.0 }, { osa: "Kontor", m2: 89.0 }] },
  { id: "p8",  nr: 8,  nimi: "Pind 8",  tyyp: "Ladu + kontor",    neto: 333.5, yyripind: 357.1, koef: 1.05, hind: 8.30, elekter: 40, parkimine: 3, plaan: "Lisa1_pind8.pdf", staatus: "Vaba",           tenant: null,
    jaotus: [{ osa: "Ladu", m2: 268.1 }, { osa: "Kontor", m2: 89.0 }] },
  { id: "p9",  nr: 9,  nimi: "Pind 9",  tyyp: "Ladu",             neto: 170.0, yyripind: 181.9, koef: 1.05, hind: 7.80, elekter: 32, parkimine: 2, plaan: "Lisa1_pind9.pdf", staatus: "Vaba",           tenant: null },
  { id: "p10", nr: 10, nimi: "Pind 10", tyyp: "Ladu",             neto: 101.6, yyripind: 108.7, koef: 1.07, hind: 8.00, elekter: 25, parkimine: 1, plaan: "Lisa1_pind10.pdf", staatus: "Üüritud",       tenant: "Käsitöö Koda OÜ" },
  { id: "p11", nr: 11, nimi: "Pind 11", tyyp: "Büroo",            neto: 94.7,  yyripind: 103.2, koef: 1.09, hind: 12.50, elekter: 20, parkimine: 2, plaan: "Lisa1_pind11.pdf", staatus: "Vaba",          tenant: null },
  { id: "p12", nr: 12, nimi: "Pind 12", tyyp: "Ladu + kontor",    neto: 297.0, yyripind: 318.0, koef: 1.07, hind: 8.60, elekter: 40, parkimine: 4, plaan: "Lisa1_pind12.pdf", staatus: "Vaba",          tenant: null,
    jaotus: [{ osa: "Ladu", m2: 234.0 }, { osa: "Kontor", m2: 84.0 }] },
];

/* --- Töölepingute vertikaal: osakond (konteiner) + ametikohad (üksused) -----
   Sama muster mis hoone→pinnad: atribuudiskeem tuleb vertikaalist.
   Hõive (mitu kohta täidetud) EI OLE käsitsi väli — arvutatakse TLEPINGUD-ist. */
const OSAKOND = { id: "os-haldus", nimi: "Haldus ja hooldus", ettevote: "Taevavärava OÜ" };

const AMETIKOHAD = [
  { id: "a1", nimi: "Objektihaldur",       kvoot: 1, tasu: 2400, katseaeg: "4 kuud",
    ylesanded: "Objekti igapäevane haldus, üürnikusuhtlus, lepingute täitmise jälgimine",
    ametijuhend: "Ametijuhend_objektihaldur.pdf" },
  { id: "a2", nimi: "Hooldustehnik",       kvoot: 2, tasu: 1900, katseaeg: "4 kuud",
    ylesanded: "Tehnosüsteemide hooldus, rikete kõrvaldamine, hooajatööd (sh libedustõrje)",
    ametijuhend: "Ametijuhend_hooldustehnik.pdf" },
  { id: "a3", nimi: "Müügi- ja rendijuht", kvoot: 1, tasu: 2800, katseaeg: "4 kuud",
    ylesanded: "Vabade pindade turundus, pakkumused ja läbirääkimised, kliendisuhted",
    ametijuhend: "Ametijuhend_rendijuht.pdf" },
];

/* --- Töölepingud (teine lepingutüüp SAMAL mootoril) ------------------------
   Sama klauslimudel: üld (lukus) / põhi (andmed) / eri (Lisa 3, kirjutab üle).
   Tööleping = hõive ametikoha peal; katseaeg ja palgaülevaatus = võtmekuupäevad. */
const TLEPINGUD = [
  {
    id: "TL-2026-002", isik: "Karl Mets", roll: "töötaja", ametikohtId: "a1",
    staatus: "Kehtiv", algus: "01.03.2026", tahtaeg: "Tähtajatu", allkirjastatud: "25.02.2026",
    katseaegLopp: "30.06.2026", palgaylevaatus: "01.03.2027",
    pohi: [
      { ref: "Pooled", vaartus: "Taevavärava OÜ (tööandja) ⋅ Karl Mets (töötaja)" },
      { ref: "Ametikoht", vaartus: "Objektihaldur · osakond Haldus ja hooldus" },
      { ref: "Tööülesanded", vaartus: "Ametijuhendi järgi (Lisa 1): objekti haldus, üürnikusuhtlus, lepingute täitmise jälgimine" },
      { ref: "Töötasu", vaartus: "2 400 € kuus (bruto) · makstakse kuu viimasel tööpäeval" },
      { ref: "Töö tegemise koht", vaartus: "Hoone T6B · Taevavärava tee 6b, Rae vald", muudetud: true },
      { ref: "Tööaeg", vaartus: "Täistööaeg · 40 tundi nädalas" },
      { ref: "Algus ja tähtaeg", vaartus: "01.03.2026 · tähtajatu" },
      { ref: "Katseaeg", vaartus: "4 kuud · kuni 30.06.2026 (läbitud)" },
      { ref: "Palgaülevaatus", vaartus: "Kord aastas · järgmine 01.03.2027" },
    ],
    eri: [
      { ref: "Lisa 3 · p1", tekst: "Töötajal on õigus teha kaugtööd kuni 2 päeva nädalas, kooskõlastades ajad vahetu juhiga.", kirjutabYle: "Põhi · Töö tegemise koht", staatus: "Aktsepteeritud" },
    ],
    lisad: [{ nr: 1, nimi: "Ametijuhend (objektihaldur)", fail: "— eseme manus —" }],
    allkirjad: [
      { pool: "Taevavärava OÜ", isik: "Margus Varne", meetod: "Smart-ID", aeg: "25.02.2026 10:12" },
      { pool: "Töötaja", isik: "Karl Mets", meetod: "Smart-ID", aeg: "25.02.2026 11:47" },
    ],
  },
  {
    id: "TL-2026-004", isik: "Marten Kivi", roll: "töötaja", ametikohtId: "a2",
    staatus: "Kehtiv", algus: "01.06.2026", tahtaeg: "Tähtajatu", allkirjastatud: "27.05.2026",
    katseaegLopp: "30.09.2026", palgaylevaatus: "01.06.2027",
    pohi: [
      { ref: "Pooled", vaartus: "Taevavärava OÜ (tööandja) ⋅ Marten Kivi (töötaja)" },
      { ref: "Ametikoht", vaartus: "Hooldustehnik · osakond Haldus ja hooldus (kvoot 2 kohta)" },
      { ref: "Tööülesanded", vaartus: "Ametijuhendi järgi (Lisa 1): tehnosüsteemide hooldus, rikete kõrvaldamine, hooajatööd" },
      { ref: "Töötasu", vaartus: "1 900 € kuus (bruto)" },
      { ref: "Töö tegemise koht", vaartus: "Hoone T6B · Taevavärava tee 6b, Rae vald" },
      { ref: "Tööaeg", vaartus: "Täistööaeg · 40 tundi nädalas" },
      { ref: "Algus ja tähtaeg", vaartus: "01.06.2026 · tähtajatu" },
      { ref: "Katseaeg", vaartus: "4 kuud · kuni 30.09.2026" },
    ],
    eri: [],
    lisad: [{ nr: 1, nimi: "Ametijuhend (hooldustehnik)", fail: "— eseme manus —" }],
    allkirjad: [
      { pool: "Taevavärava OÜ", isik: "Margus Varne", meetod: "Smart-ID", aeg: "27.05.2026 09:30" },
      { pool: "Töötaja", isik: "Marten Kivi", meetod: "Mobile-ID", aeg: "27.05.2026 13:02" },
    ],
  },
  {
    id: "TL-2026-005", isik: "Anna Kask", roll: "kandidaat", ametikohtId: "a3",
    staatus: "Saadetud", algus: "01.08.2026 (plaanitud)", tahtaeg: "Tähtajatu",
    allkirjastatud: null, katseaegLopp: "30.11.2026 (plaanitud)", palgaylevaatus: "01.08.2027",
    pohi: [
      { ref: "Pooled", vaartus: "Taevavärava OÜ (tööandja) ⋅ Anna Kask (kandidaat)" },
      { ref: "Ametikoht", vaartus: "Müügi- ja rendijuht · osakond Haldus ja hooldus" },
      { ref: "Tööülesanded", vaartus: "Ametijuhendi järgi (Lisa 1): vabade pindade turundus, pakkumused, läbirääkimised" },
      { ref: "Töötasu", vaartus: "2 800 € kuus (bruto) + tulemustasu kokkuleppel" },
      { ref: "Töö tegemise koht", vaartus: "Hoone T6B · Taevavärava tee 6b, Rae vald" },
      { ref: "Tööaeg", vaartus: "Täistööaeg · 40 tundi nädalas" },
      { ref: "Algus ja tähtaeg", vaartus: "01.08.2026 (plaanitud) · tähtajatu" },
      { ref: "Katseaeg", vaartus: "4 kuud · kuni 30.11.2026" },
    ],
    eri: [],
    lisad: [{ nr: 1, nimi: "Ametijuhend (müügi- ja rendijuht)", fail: "— eseme manus —" }],
    allkirjad: [],
  },
];

/* --- Töölepingu üldtingimused (mallist, lukus — näidispunktid) -------------- */
const TL_ULD = [
  { ref: "§1", pealkiri: "Üldsätted", tekst: "Töölepingule kohaldatakse töölepingu seadust ja muid Eesti Vabariigi õigusakte. Lepingus reguleerimata küsimustes lähtuvad pooled TLS-ist ja heast tavast." },
  { ref: "§3", pealkiri: "Konfidentsiaalsus", tekst: "Töötaja hoiab saladuses talle töö käigus teatavaks saanud ärisaladused, sh lepingutingimused, hinnastuse ja kliendiandmed — ka pärast lepingu lõppemist." },
  { ref: "§5", pealkiri: "Puhkus", tekst: "Töötaja põhipuhkus on 28 kalendripäeva aastas. Puhkuste ajakava koostatakse ja tehakse teatavaks TLS-is sätestatud korras." },
  { ref: "§7", pealkiri: "Lepingu lõppemine", tekst: "Leping lõpeb TLS-is sätestatud alustel ja korras. Ülesütlemisavaldus esitatakse kirjalikku taasesitamist võimaldavas vormis." },
];

/* --- Olemasolevate lepingute import ----------------------------------------
   Loetud (AI-toega) samasse klauslimudelisse. Õiguslik tõde = allkirjastatud
   lähtedokument; struktuur on selle indeks ja lähendus. Ei osale muudatuste
   voos (etapp 08); osaleb otsingus, Q&A-s, võtmekuupäevades ja aruandluses. */
const IMPORDITUD = [
  { id: "LEP-2025-014", liik: "Üürileping", pool: "Estplast OÜ", ese: "Pind 7 · Hoone T6B",
    punkte: 96, kinnitatud: "Tarmo Sepp · 12.05.2026", fail: "Uurileping_Estplast_2025 (originaal)",
    parameetrid: [["Periood", "01.01.2025 – 31.12.2029 (60 kuud)"], ["Üür", "2 892,00 €/kuus (neto)"],
      ["Indekseerimine", "Statistikaameti THI · iga 12 kuu"], ["Tagatisraha", "8 676,00 € (3 kuu üür)"]],
    tahtajad: ["01.07.2026 · indekseerimine", "31.12.2029 · lepingu lõpp"] },
  { id: "LEP-2024-022", liik: "Üürileping", pool: "Käsitöö Koda OÜ", ese: "Pind 10 · Hoone T6B",
    punkte: 88, kinnitatud: "Tarmo Sepp · 12.05.2026", fail: "Uurileping_KasitooKoda_2024 (originaal)",
    parameetrid: [["Periood", "01.08.2024 – 31.07.2027 (36 kuud)"], ["Üür", "869,60 €/kuus (neto)"],
      ["Indekseerimine", "Fikseeritud 3% · iga 12 kuu"], ["Tagatisraha", "1 739,20 € (2 kuu üür)"]],
    tahtajad: ["01.08.2026 · indekseerimine", "31.07.2027 · lepingu lõpp"] },
  { id: "HAL-2023-01", liik: "Haldusleping", pool: "Propert Haldus OÜ", ese: "Hoone T6B",
    punkte: 41, kinnitatud: "Tarmo Sepp · 14.05.2026", fail: "Haldusleping_2023 (originaal)",
    parameetrid: [["Tasu", "1 450,00 €/kuus (neto)"], ["Etteteatamine", "3 kuud"],
      ["Reageerimisaeg", "Avariitööd 4 h · muud tööd 48 h"]],
    tahtajad: ["31.12.2026 · automaatse pikenemise otsustuskoht"] },
  { id: "KIN-2026-07", liik: "Kindlustusleping", pool: "If P&C Insurance AS", ese: "Hoone T6B · varakindlustus",
    punkte: 37, kinnitatud: "Tarmo Sepp · 14.05.2026", fail: "Poliis_KIN-2026-07 (originaal)",
    parameetrid: [["Kindlustussumma", "4 200 000 €"], ["Preemia", "3 840 €/aastas"],
      ["Omavastutus", "1 000 € juhtumi kohta"]],
    tahtajad: ["31.01.2027 · poliisi lõpp"] },
];

/* --- Kliendid -------------------------------------------------------------- */
const CLIENTS = [
  { id: "c-future", nimi: "Future Invest OÜ", tyyp: "Eesti firma", registrikood: "14258963", kmkr: "EE101984774", aadress: "Pärnu mnt 141, Tallinn, 11314", kontakt: "Margus Varne", epost: "margus@futureinvest.info", tel: "+372 503 4135", risk: { skoor: "MADAL", kuupaev: "08.06.2026" } },
  { id: "c-baltic", nimi: "Baltic Logistics OÜ", tyyp: "Eesti firma", registrikood: "11457820", kmkr: "EE100774521", aadress: "Suur-Sõjamäe 10a, Tallinn, 11415", kontakt: "Tarmo Kask", epost: "tarmo@balticlog.ee", tel: "+372 511 2233", risk: { skoor: "MADAL", kuupaev: "14.01.2026" } },
  { id: "c-nord",   nimi: "Nordproff OÜ", tyyp: "Eesti firma", registrikood: "12998341", kmkr: "EE101552398", aadress: "Laki 25, Tallinn, 12915", kontakt: "Liis Tamm", epost: "liis@nordproff.ee", tel: "+372 522 9081", risk: { skoor: "KESKMINE", kuupaev: "02.03.2026" } },
  { id: "c-mikro",  nimi: "Mikrotehnika AS", tyyp: "Eesti firma", registrikood: "10334521", kmkr: "EE100221984", aadress: "Mustamäe tee 5, Tallinn, 10616", kontakt: "Andres Lepik", epost: "andres@mikrotehnika.ee", tel: "+372 5648 2913", risk: { skoor: "MADAL", kuupaev: "20.05.2026" } },
  { id: "c-rohe",   nimi: "Roheline Ladu OÜ", tyyp: "Eesti firma", registrikood: "16720145", kmkr: null, aadress: "Tehnika 12, Saku, 75501", kontakt: "Kati Org", epost: "kati@roheline.ee", tel: "+372 5390 1447", risk: { skoor: "KÕRGE", kuupaev: "27.05.2026" } },
];

/* --- Riskiraporti allikate näidis ----------------------------------------- */
const RISK_SOURCES = [
  { allikas: "Krediidiinfo", tulemus: "Reiting AA · maksehäireid ei tuvastatud", skoor: "MADAL" },
  { allikas: "Inforegister", tulemus: "Käive 2,4 M€ · 18 töötajat · kasum positiivne", skoor: "MADAL" },
  { allikas: "Kohtutäitur",  tulemus: "Avatud täitemenetlusi ei leitud", skoor: "MADAL" },
  { allikas: "Äriregister",  tulemus: "Staatus: registrisse kantud · esindusõigus korras", skoor: "MADAL" },
];

/* --- Hinnapakkumised ------------------------------------------------------- */
const OFFERS = [
  {
    id: "PAK-2026-014", clientId: "c-future", spaceIds: ["p12"], pikkusKuud: 60,
    staatus: "Mustand", kehtivKuni: "23.06.2026", loodud: "09.06.2026",
    looja: "AI-agent (operaatori korraldusel)",
    kommerts: "Future Invest OÜ-le pakume Hoone T6B kaasaegset ladu-kontorpinda (Pind 12) heas logistilises asukohas Tallinna ringtee vahetus läheduses. Pind sobib hästi e-kaubanduse laoks koos esindusliku kontoriosaga. Esimese 3 kuu üürile pakume 10% soodustust sissekolimisperioodiks.",
    eritingimused: [
      { id: "e1", tekst: "Üürivaba sisseseadeperiood 1 kuu alates üleandmispäevast.", kirjutabYle: "Põhi · Üür (p 3.1)" },
      { id: "e2", tekst: "Üürileandja paigaldab laoossa täiendava 3T sildkraana üürniku kulul, hooldus üürileandja korraldusel.", kirjutabYle: null },
    ],
  },
  {
    id: "PAK-2026-011", clientId: "c-mikro", spaceIds: ["p6"], pikkusKuud: 36,
    staatus: "Saadetud", kehtivKuni: "16.06.2026", loodud: "02.06.2026", looja: "Tarmo Sepp",
    kommerts: "Mikrotehnika AS-le pakume Pind 6 (Ladu + kontor) koos 4 parkimiskohaga.",
    eritingimused: [
      { id: "e1", tekst: "Indekseerimine fikseeritud 2,5%/aastas (tavapärase 3% asemel).", kirjutabYle: "Üld · p 5.2 (indekseerimine 3%)" },
    ],
  },
  {
    id: "PAK-2026-009", clientId: "c-rohe", spaceIds: ["p3"], pikkusKuud: 24,
    staatus: "Kliendi ettepanek", kehtivKuni: "12.06.2026", loodud: "26.05.2026", looja: "Tarmo Sepp",
    kommerts: "Roheline Ladu OÜ-le pakume Pind 3 (Ladu, 192,5 m²).",
    eritingimused: [],
    kliendiEttepanek: "Palume tagatisraha vähendada 3 kuu üürilt 1 kuu üürile ning lisada ostueesõigus naaberpinnale.",
  },
  {
    id: "PAK-2026-007", clientId: "c-nord", spaceIds: ["p4"], pikkusKuud: 60,
    staatus: "Aktsepteeritud", kehtivKuni: "20.05.2026", loodud: "06.05.2026", looja: "Tarmo Sepp",
    kommerts: "Nordproff OÜ-le pakume Pind 4.", eritingimused: [],
    seotudLeping: "LEP-2026-008",
  },
  {
    id: "PAK-2026-003", clientId: "c-baltic", spaceIds: ["p1"], pikkusKuud: 60,
    staatus: "Aktsepteeritud", kehtivKuni: "30.03.2026", loodud: "12.03.2026", looja: "Tarmo Sepp",
    kommerts: "Baltic Logistics OÜ-le pakume Pind 1.", eritingimused: [],
    seotudLeping: "LEP-2026-005",
  },
  {
    id: "PAK-2026-001", clientId: "c-rohe", spaceIds: ["p9"], pikkusKuud: 12,
    staatus: "Aegunud", kehtivKuni: "20.02.2026", loodud: "05.02.2026", looja: "Tarmo Sepp",
    kommerts: "Roheline Ladu OÜ-le pakume Pind 9.", eritingimused: [],
  },
];

/* --- Üldtingimuste punktid (mallist, lukus) -------------------------------- */
const ULD_CLAUSES = [
  { ref: "§1",  pealkiri: "Lepingu ese", tekst: "Üürileandja annab tähtajaliselt ja tasu eest Üürniku kasutusse Üüripinna ja parkimiskohad ning võimaldab Üürnikule tasu eest punktis 5.5 nimetatud teenuseid." },
  { ref: "§2",  pealkiri: "Lepingu tähtaeg. Üüripinna üleandmine", tekst: "Leping jõustub allkirjastamisel ning kehtib Põhitingimuste p 5.1 märgitud tähtajani. Tähtaja saabumisel Leping ei pikene ega muutu tähtajatuks." },
  { ref: "§5",  pealkiri: "Üür ja kõrvalkulud", tekst: "Üürnik maksab alates üleandmispäevast igakuist üüri Põhitingimuste p 3.1 sätestatud suuruses. Summale lisandub käibemaks. Üür tasutakse arvestuskuu 10. kuupäevaks." },
  { ref: "§6",  pealkiri: "Tagatis", tekst: "Üürnik tasub Lepingu allkirjastamisel tagatisraha Põhitingimuste p 4.1 toodud summas. Tagatisrahaga on tagatud kõik Üürniku rahalised kohustused." },
  { ref: "§7",  pealkiri: "Kindlustus", tekst: "Üürileandja kindlustab Hoone (v.a Üüripinna siseviimistlus ja Üürniku vara). Üürnik peab soovitavalt omama täielikku kindlustuskaitset oma vara suhtes." },
  { ref: "§9",  pealkiri: "Üüripinna kasutamine", tekst: "Üürnik kasutab Üüripinda heaperemehelikult ja sihtotstarbeliselt. Hoones on suitsetamine keelatud. Parkimine toimub ainult tähistatud parkimiskohtadel." },
  { ref: "§12", pealkiri: "Lepingu lõppemine", tekst: "Üürileandjal on õigus Leping erakorraliselt üles öelda mõjuval põhjusel (mh üür ≥14 päeva tasumata). Kummalgi Poolel on õigus Leping 1-aastase etteteatamisega üles öelda." },
  { ref: "§16", pealkiri: "Kohaldatav seadus ja vaidlused", tekst: "Leping allub Eesti Vabariigi õigusele. Vaidlused lahendatakse läbirääkimiste teel, kokkuleppe puudumisel Harju Maakohtus." },
];

/* --- Lepingud -------------------------------------------------------------- */
const LEASES = [
  {
    id: "LEP-2026-005", clientId: "c-baltic", spaceId: "p1", pakkumus: "PAK-2026-003",
    staatus: "Kehtiv", pikkusKuud: 60,
    algus: "01.04.2026", lopp: "31.03.2031", allkirjastatud: "28.03.2026",
    indeks: { meetod: "Fikseeritud %", maar: "3%", sagedus: "iga 12 kuu", jargmine: "01.04.2027" },
    /* põhitingimused originaalmalli struktuuris — sektsioonid + täislaused (vt app.js pohiTehing) */
    pohi: [
      { sec: "1. Pooled", ref: "P 1.1", pealkiri: "Üürileandja", vaartus: "Taevavärava OÜ · reg 16333502 · KMKR EE102420203 · Taevavärava tee 6b, Lehmja küla, Rae vald, 75306 · varne@futureinvest.info · +372 503 4135 · AS LHV Pank, EE267700771004561239" },
      { ref: "P 1.2", pealkiri: "Üürnik", vaartus: "Baltic Logistics OÜ · reg 11457820 · KMKR EE100774521 · Suur-Sõjamäe 10a, Tallinn, 11415 · tarmo@balticlog.ee · +372 511 2233" },
      { sec: "2. Üüripind", ref: "P 2.1", pealkiri: "Üüripind", vaartus: "Lepingu esemeks on aadressil Taevavärava tee 6b, Lehmja küla, Rae vald asuvas hoones (Hoone) paiknev Pind 1 üldpinnaga 538,4 m² (Üüripind) — Ladu + müügisaal —, mille asukoht ja piirid on näidatud Lepingu lisas nr 1 toodud plaanil." },
      { ref: "P 2.2", pealkiri: "Parkimiskohad", vaartus: "6 parkimiskohta. Parkimiskohtade kasutustasu sisaldub Üüris." },
      { ref: "P 2.3", pealkiri: "Üüripinna üleandmine", vaartus: "Üleandmispäev on 01.04.2026. Üüripind antakse Üürniku valdusesse kahepoolse üleandmis-vastuvõtmisakti alusel." },
      { ref: "P 2.4", pealkiri: "Kasutusotstarve", vaartus: "Üüripinda võib kasutada üksnes büroo-, lao- ja tootmispinnana." },
      { sec: "3. Üür", ref: "P 3.1", pealkiri: "Üür", vaartus: "EUR 8,50 Üüripinna ühe ruutmeetri kohta kuus — kokku 4 576,40 €/kuus (neto), millele lisandub käibemaks õigusaktides kehtestatud suuruses. Parkimiskohtade kasutustasu sisaldub Üüris." },
      { ref: "P 3.2", pealkiri: "Kõrvalkulud", vaartus: "Üürnik kohustub tasuma Üürileandja esitatud kommunaal-, haldus- ja lisateenuste arved Üldtingimustes sätestatud korras." },
      { sec: "4. Tagatis", ref: "P 4.1", pealkiri: "Tagatise summa", vaartus: "Üürnik tasub Lepingu allkirjastamisel arve alusel tagatisraha 3 kuu Üüri ulatuses — 13 729,20 € (lisandub käibemaks)." },
      { sec: "5. Tähtaeg", ref: "P 5.1", pealkiri: "Lepingu tähtaeg", vaartus: "Leping on sõlmitud tähtajaliselt 5 aastaks alates Üleandmispäevast: 01.04.2026 – 31.03.2031 (60 kuud)." },
      { ref: "P 5.2", pealkiri: "Tähtaja erisused", vaartus: "Puuduvad." },
      { sec: "6. Poolte esindajad", ref: "P 6.1", pealkiri: "Üürileandja esindajad", vaartus: "Lepingulistes küsimustes: varne@futureinvest.info · Halduskorralduses: haldus@futureinvest.info · Arveldustes: arved@futureinvest.info" },
      { ref: "P 6.2", pealkiri: "Üürniku esindajad", vaartus: "Lepingulistes, tehnilistes küsimustes ja arveldustes: Tarmo Kask · tarmo@balticlog.ee · +372 511 2233" },
    ],
    eri: [],
    lisad: [
      { nr: 1, nimi: "Pinnaplaan (Pind 1)", fail: "lisad/T6B_pinnaplaan.pdf" },
      { nr: 2, nimi: "Asendiplaan + parkimisskeem", fail: "lisad/T6B_parkimisskeem.pdf" },
    ],
    allkirjad: [
      { pool: "Taevavärava OÜ", isik: "Margus Varne", meetod: "SmartID", aeg: "28.03.2026 14:21" },
      { pool: "Baltic Logistics OÜ", isik: "Tarmo Kask", meetod: "Mobile-ID", aeg: "28.03.2026 16:05" },
    ],
  },
  {
    id: "LEP-2026-008", clientId: "c-nord", spaceId: "p4", pakkumus: "PAK-2026-007",
    staatus: "Saadetud", pikkusKuud: 60,
    algus: "01.07.2026", lopp: "30.06.2031", allkirjastatud: null, versioon: "Mustand V2",
    indeks: { meetod: "Statistikaameti indeks", maar: "THI (tarbijahinnaindeks)", sagedus: "iga 12 kuu", jargmine: "01.07.2027" },
    pohi: [
      { sec: "1. Pooled", ref: "P 1.1", pealkiri: "Üürileandja", vaartus: "Taevavärava OÜ · reg 16333502 · KMKR EE102420203 · Taevavärava tee 6b, Lehmja küla, Rae vald, 75306 · varne@futureinvest.info · +372 503 4135 · AS LHV Pank, EE267700771004561239" },
      { ref: "P 1.2", pealkiri: "Üürnik", vaartus: "Nordproff OÜ · reg 12998341 · KMKR EE101552398 · Laki 25, Tallinn, 12915 · liis@nordproff.ee · +372 522 9081" },
      { sec: "2. Üüripind", ref: "P 2.1", pealkiri: "Üüripind", vaartus: "Lepingu esemeks on aadressil Taevavärava tee 6b, Lehmja küla, Rae vald asuvas hoones (Hoone) paiknev Pind 4 üldpinnaga 357,2 m² (Üüripind) — Ladu + kontor —, mille asukoht ja piirid on näidatud Lepingu lisas nr 1 toodud plaanil." },
      { ref: "P 2.2", pealkiri: "Parkimiskohad", vaartus: "4 parkimiskohta. Parkimiskohtade kasutustasu sisaldub Üüris." },
      { ref: "P 2.3", pealkiri: "Üüripinna üleandmine", vaartus: "Üleandmispäev on 01.07.2026. Üüripind antakse Üürniku valdusesse kahepoolse üleandmis-vastuvõtmisakti alusel." },
      { ref: "P 2.4", pealkiri: "Kasutusotstarve", vaartus: "Üüripinda võib kasutada üksnes büroo-, lao- ja tootmispinnana." },
      { sec: "3. Üür", ref: "P 3.1", pealkiri: "Üür", vaartus: "EUR 8,20 Üüripinna ühe ruutmeetri kohta kuus — kokku 2 929,04 €/kuus (neto), millele lisandub käibemaks õigusaktides kehtestatud suuruses. Parkimiskohtade kasutustasu sisaldub Üüris.", muudetud: true },
      { ref: "P 3.2", pealkiri: "Kõrvalkulud", vaartus: "Üürnik kohustub tasuma Üürileandja esitatud kommunaal-, haldus- ja lisateenuste arved Üldtingimustes sätestatud korras." },
      { sec: "4. Tagatis", ref: "P 4.1", pealkiri: "Tagatise summa", vaartus: "Üürnik tasub Lepingu allkirjastamisel arve alusel tagatisraha 3 kuu Üüri ulatuses — 8 787,12 € (lisandub käibemaks)." },
      { sec: "5. Tähtaeg", ref: "P 5.1", pealkiri: "Lepingu tähtaeg", vaartus: "Leping on sõlmitud tähtajaliselt 5 aastaks alates Üleandmispäevast: 01.07.2026 – 30.06.2031 (60 kuud)." },
      { ref: "P 5.2", pealkiri: "Tähtaja erisused", vaartus: "Puuduvad." },
      { sec: "6. Poolte esindajad", ref: "P 6.1", pealkiri: "Üürileandja esindajad", vaartus: "Lepingulistes küsimustes: varne@futureinvest.info · Halduskorralduses: haldus@futureinvest.info · Arveldustes: arved@futureinvest.info" },
      { ref: "P 6.2", pealkiri: "Üürniku esindajad", vaartus: "Lepingulistes, tehnilistes küsimustes ja arveldustes: Liis Tamm · liis@nordproff.ee · +372 522 9081" },
    ],
    eri: [
      { ref: "Lisa 3 · p1", tekst: "Üürivaba sisseseadeperiood 2 kuud alates üleandmispäevast.", kirjutabYle: "§5 Üür ja kõrvalkulud", staatus: "Aktsepteeritud" },
      { ref: "Lisa 3 · p2", tekst: "Indekseerimismeetodiks lepitakse Statistikaameti tarbijahinnaindeks fikseeritud 3% asemel.", kirjutabYle: "Üld · p 5.2 (indekseerimine 3%)", staatus: "Aktsepteeritud" },
    ],
    kommentaarid: [
      { clauseRef: "P 3.1", autor: "Liis Tamm (üürnik)", aeg: "06.06.2026 11:12", tekst: "Kas üüri saaks siduda THI-ga fikseeritud % asemel? Soovime ennustatavust pikemas plaanis.", staatus: "Aktsepteeritud", vastus: "Aktsepteeritud — vormistatud Lisa 3 punktina, põhitingimus märgitud muudetuks." },
      { clauseRef: "§5", autor: "Liis Tamm (üürnik)", aeg: "06.06.2026 11:18", tekst: "Palume sisseseadeperioodiks 2 kuud 1 asemel — vajame ehituslubasid.", staatus: "Aktsepteeritud", vastus: "Aktsepteeritud — lisatud Lisa 3 punktina (ülimuslik §5 suhtes)." },
      { clauseRef: "P 4.1", autor: "Liis Tamm (üürnik)", aeg: "06.06.2026 11:25", tekst: "Kas tagatis saaks olla 2 kuu üür?", staatus: "Ootel", vastus: null,
        /* arutelu ei otsusta — punkt jääb Ootel, kuni operaator aktsepteerib/lükkab tagasi */
        arutelu: [
          { roll: "operaator", autor: "Tarmo Sepp", aeg: "07.06.2026 09:40", tekst: "Saame 2 kuud kaaluda, kui lisandub emaettevõtte garantii või tähtaeg pikeneb 6 aastale. Kumb variant teile sobiks?" },
          { roll: "klient", autor: "Liis Tamm (üürnik)", aeg: "07.06.2026 12:05", tekst: "Garantii on võimalik — saadan garantiikirja mustandi järgmise nädala alguseks." },
        ] },
    ],
    lisad: [
      { nr: 1, nimi: "Pinnaplaan (Pind 4)", fail: "lisad/T6B_pinnaplaan.pdf" },
      { nr: 2, nimi: "Asendiplaan + parkimisskeem", fail: "lisad/T6B_parkimisskeem.pdf" },
      { nr: 3, nimi: "Eritingimused", fail: "— genereeritud —" },
    ],
    allkirjad: [],
  },
];

/* --- Võtmekuupäevad -------------------------------------------------------- */
const KEY_DATES = [
  { kuupaev: "2026-06-16", tyyp: "Pakkumuse kehtivus", objekt: "PAK-2026-011 · Mikrotehnika AS", margis: "amber", info: "Pakkumus aegub 7 päeva pärast" },
  { kuupaev: "2026-07-01", tyyp: "Lepingu algus", objekt: "LEP-2026-008 · Nordproff OÜ", margis: "blue", info: "Üleandmispäev · Pind 4" },
  { kuupaev: "2026-07-01", tyyp: "Indekseerimine", objekt: "LEP-2025-014 · Estplast OÜ (imporditud)", margis: "accent", info: "Statistikaameti THI · automaatne, lisa ei teki" },
  { kuupaev: "2026-08-01", tyyp: "Indekseerimine", objekt: "LEP-2024-022 · Käsitöö Koda OÜ (imporditud)", margis: "accent", info: "Fikseeritud 3% · automaatne" },
  { kuupaev: "2026-09-30", tyyp: "Katseaja lõpp", objekt: "TL-2026-004 · Marten Kivi · Hooldustehnik", margis: "amber", info: "Töölepingute vertikaal · teavitus 14 päeva ette" },
  { kuupaev: "2027-01-31", tyyp: "Lepingu lõpp", objekt: "KIN-2026-07 · If P&C · kindlustus (imporditud)", margis: "grey", info: "Imporditud leping osaleb võtmekuupäevades · teavitus 90 päeva ette" },
  { kuupaev: "2027-03-01", tyyp: "Palgaülevaatus", objekt: "TL-2026-002 · Karl Mets · Objektihaldur", margis: "blue", info: "Kokku lepitud töölepingus · võtmekuupäev" },
  { kuupaev: "2027-04-01", tyyp: "Indekseerimine", objekt: "LEP-2026-005 · Baltic Logistics OÜ", margis: "accent", info: "Fikseeritud 3% · esimene indekseerimine" },
  { kuupaev: "2029-12-31", tyyp: "Lepingu lõpp", objekt: "LEP-2025-014 · Estplast OÜ (imporditud)", margis: "grey", info: "Tähtaja lõpp → automaatne üleminek · teavitus 90 päeva ette (operaator + klient)" },
];

/* --- Audit trail / otsuste mälu (näidis) ----------------------------------- */
const AUDIT = [
  { aeg: "09.06.2026 09:14", autor: "AI-agent", tegevus: "Pakkumuse mustand PAK-2026-014 loodud operaatori korraldusel (Future Invest OÜ · Pind 12)." },
  { aeg: "08.06.2026 16:40", autor: "Tarmo Sepp", tegevus: "Riskiraport tellitud: Future Invest OÜ → koondskoor MADAL." },
  { aeg: "06.06.2026 11:25", autor: "Liis Tamm (üürnik)", tegevus: "Kommentaar lisatud LEP-2026-008 punktile „Tagatisraha (p 4.1)\"." },
  { aeg: "06.06.2026 09:02", autor: "Tarmo Sepp", tegevus: "LEP-2026-008 mustand V2 saadetud üürnikule." },
  { aeg: "28.03.2026 16:05", autor: "Tarmo Kask (üürnik)", tegevus: "LEP-2026-005 allkirjastatud (Mobile-ID). Leping arhiveeritud." },
];

/* --- B11G OÜ — konto teine ettevõte ----------------------------------------
   Lugu: B11G OÜ lisati kontole hiljuti (e-äriregistri autotäide), Hoone B11G
   baasandmed tulid EHR-ist ja vana portfell imporditi (üürileping + hooldus-
   leping). Uusi pakkumusi/lepinguid pole platvormis veel sündinud — seetõttu
   on lepingumootori loendid tühjad ja pinnad valdavalt vabad. */
if (COMPANY_ID === "b11g") {
  ACCOUNT.landlord = {
    nimi: "B11G OÜ", registrikood: "14892077", kmkr: "EE102178443",
    aadress: "Betooni tn 11g, Lasnamäe linnaosa, Tallinn, Harju maakond, 11415",
    epost: "info@b11g.ee", mobiil: "+372 512 8890", asutatud: "12.03.2019",
    allikas: "e-äriregister",
    pank: "Swedbank AS", iban: "EE142200221092447763",
    esindajad: { lepingulised: "info@b11g.ee", haldus: "haldus@b11g.ee", arveldused: "arved@b11g.ee" },
  };
  /* kaks hoonet samal aadressil (Betooni 11g): Stock Office + Self Storage */
  Object.assign(OBJEKT, {
    id: "obj-b11g-so", nimi: "Stock Office",
    logo: "lisad/B11G_Stock-office_logo.svg",
    ehr: { kood: "121004572", aadress: "Betooni tn 11g, Lasnamäe linnaosa, Tallinn",
      kasutusotstarve: "12520 — Laohoone (stock-office)", ehitisealunePind: 1480, suletudNetopind: 1975,
      korrusteArv: 2, ehitusaasta: 2008, allikas: "EHR ehitisregister" },
    korvalkulu: { talvine: 1.95, suvine: 1.20, allikas: "käsitsi sisestatud · Moderani ajalugu puudub" },
    kaibemaksugaMaksustatud: true,
    lisa2: "Asendiplaan + parkimisskeem (lisamata)",
    failid: { pinnaplaan: null, parkimine: null },
    mallid: { uldtingimused: "Äriruumide üürilepingu üldtingimused v3.2 (lukus)",
      eritingimused: "Eritingimuste põhi v1.4", pakkumus: "Pakkumuse põhi v2.0" },
  });
  OBJEKTID.push({
    id: "obj-b11g-ss", nimi: "Self Storage",
    logo: "lisad/B11G_Self-storage_logo.svg",
    ehr: { kood: "121004573", aadress: "Betooni tn 11g, Lasnamäe linnaosa, Tallinn",
      kasutusotstarve: "12520 — Laohoone (laoboksid)", ehitisealunePind: 640, suletudNetopind: 1180,
      korrusteArv: 2, ehitusaasta: 2015, allikas: "EHR ehitisregister" },
    korvalkulu: { talvine: 1.10, suvine: 0.80, allikas: "käsitsi sisestatud" },
    kaibemaksugaMaksustatud: true,
    lisa2: "Asendiplaan + parkimisskeem (lisamata)",
    failid: { pinnaplaan: null, parkimine: null },
    mallid: { uldtingimused: "Laoboksi üürilepingu üldtingimused v1.0 (lukus)",
      eritingimused: "Eritingimuste põhi v1.4", pakkumus: "Pakkumuse põhi v2.0" },
  });
  SPACES.length = 0;
  SPACES.push(
    /* Stock Office */
    { id: "b1", nr: 1, nimi: "Pind 1", tyyp: "Ladu",          neto: 610.0, yyripind: 645.8, koef: 1.06, hind: 6.90,  elekter: 50, parkimine: 5, plaan: null, staatus: "Üüritud", tenant: "Viking Metall OÜ", objektId: "obj-b11g-so" },
    { id: "b2", nr: 2, nimi: "Pind 2", tyyp: "Ladu",          neto: 455.0, yyripind: 481.7, koef: 1.06, hind: 6.90,  elekter: 40, parkimine: 4, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-so" },
    { id: "b3", nr: 3, nimi: "Pind 3", tyyp: "Ladu + kontor", neto: 388.0, yyripind: 412.3, koef: 1.06, hind: 7.40,  elekter: 32, parkimine: 3, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-so",
      jaotus: [{ osa: "Ladu", m2: 330.3 }, { osa: "Kontor", m2: 82.0 }] },
    { id: "b4", nr: 4, nimi: "Pind 4", tyyp: "Büroo",         neto: 96.0,  yyripind: 104.5, koef: 1.09, hind: 10.50, elekter: 16, parkimine: 2, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-so" },
    /* Self Storage — laoboksid (näidis; päris majas kümneid) */
    { id: "s1", nr: 5,  nimi: "Boks 101", tyyp: "Laoboks", neto: 6.0,  yyripind: 6.0,  koef: 1.0, hind: 24.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Üüritud", tenant: "Eraisik · M. Laur", objektId: "obj-b11g-ss" },
    { id: "s2", nr: 6,  nimi: "Boks 108", tyyp: "Laoboks", neto: 9.0,  yyripind: 9.0,  koef: 1.0, hind: 22.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Üüritud", tenant: "Eraisik · K. Sepp", objektId: "obj-b11g-ss" },
    { id: "s3", nr: 7,  nimi: "Boks 112", tyyp: "Laoboks", neto: 12.0, yyripind: 12.0, koef: 1.0, hind: 20.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Üüritud", tenant: "Väikevedu OÜ", objektId: "obj-b11g-ss" },
    { id: "s4", nr: 8,  nimi: "Boks 204", tyyp: "Laoboks", neto: 6.0,  yyripind: 6.0,  koef: 1.0, hind: 24.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-ss" },
    { id: "s5", nr: 9,  nimi: "Boks 210", tyyp: "Laoboks", neto: 15.0, yyripind: 15.0, koef: 1.0, hind: 19.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-ss" },
    { id: "s6", nr: 10, nimi: "Boks 215", tyyp: "Laoboks", neto: 18.0, yyripind: 18.0, koef: 1.0, hind: 18.50, elekter: 0, parkimine: 0, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-ss" },
  );
  TAITUVUS_AJALUGU.length = 0;
  TAITUVUS_AJALUGU.push(46, 46, 44, 44, 44, 41, 41, 39, 39, 39, 39);
  Object.assign(OSAKOND, { id: "os-b11g", nimi: "Haldus", ettevote: "B11G OÜ" });
  AMETIKOHAD.length = 0;
  AMETIKOHAD.push({ id: "ba1", nimi: "Objektihaldur", kvoot: 1, tasu: 2200, katseaeg: "4 kuud",
    ylesanded: "Stock Office'i ja Self Storage'i igapäevane haldus, üürnikusuhtlus, hoolduspartneri töö jälgimine",
    ametijuhend: "Ametijuhend_objektihaldur.pdf" });
  TLEPINGUD.length = 0;
  OFFERS.length = 0;
  LEASES.length = 0;
  IMPORDITUD.length = 0;
  IMPORDITUD.push(
    { id: "LEP-2023-041", liik: "Üürileping", pool: "Viking Metall OÜ", ese: "Pind 1 · Stock Office",
      punkte: 72, kinnitatud: "Tarmo Sepp · 04.06.2026", fail: "Uurileping_VikingMetall_2023 (originaal)",
      parameetrid: [["Periood", "01.09.2023 – 31.08.2028 (60 kuud)"], ["Üür", "4 456,02 €/kuus (neto)"],
        ["Indekseerimine", "Fikseeritud 3% · iga 12 kuu"], ["Tagatisraha", "8 912,04 € (2 kuu üür)"]],
      tahtajad: ["01.09.2026 · indekseerimine", "31.08.2028 · lepingu lõpp"] },
    { id: "HOO-2024-06", liik: "Hooldusleping", pool: "Clanner Kinnisvarahooldus OÜ", ese: "Stock Office + Self Storage · Betooni 11g",
      punkte: 34, kinnitatud: "Tarmo Sepp · 04.06.2026", fail: "Hooldusleping_2024 (originaal)",
      parameetrid: [["Tasu", "780,00 €/kuus (neto)"], ["Etteteatamine", "2 kuud"],
        ["Reageerimisaeg", "Avariitööd 6 h · muud tööd 72 h"]],
      tahtajad: ["30.11.2026 · automaatse pikenemise otsustuskoht"] },
  );
  /* B11G kliendiregister — oma osapooled, mitte Taevavärava omad
     (muidu ei leia pakkumuse/lepingu wizard B11G üürnikke üldse) */
  CLIENTS.length = 0;
  CLIENTS.push(
    { id: "c-viking",   nimi: "Viking Metall OÜ", tyyp: "Eesti firma", registrikood: "12455871", kmkr: "EE101733420", aadress: "Betooni tn 11g, Tallinn, 11415", kontakt: "Argo Vessmann", epost: "argo@vikingmetall.ee", tel: "+372 509 4471", risk: { skoor: "MADAL", kuupaev: "04.06.2026" } },
    { id: "c-clanner",  nimi: "Clanner Kinnisvarahooldus OÜ", tyyp: "Eesti firma", registrikood: "14310522", kmkr: "EE102045188", aadress: "Peterburi tee 46, Tallinn, 11415", kontakt: "Marko Laane", epost: "info@clanner.ee", tel: "+372 5628 3350", risk: { skoor: "MADAL", kuupaev: "04.06.2026" } },
    { id: "c-vaikevedu", nimi: "Väikevedu OÜ", tyyp: "Eesti firma", registrikood: "16544209", kmkr: null, aadress: "Punane 56, Tallinn, 13619", kontakt: "Rain Talts", epost: "rain@vaikevedu.ee", tel: "+372 5341 7788", risk: { skoor: "KESKMINE", kuupaev: "04.06.2026" } },
  );
  KEY_DATES.length = 0;
  KEY_DATES.push(
    { kuupaev: "2026-09-01", tyyp: "Indekseerimine", objekt: "LEP-2023-041 · Viking Metall OÜ (imporditud)", margis: "accent", info: "Fikseeritud 3% · automaatne, lisa ei teki" },
    { kuupaev: "2026-11-30", tyyp: "Otsustuskoht", objekt: "HOO-2024-06 · Clanner Kinnisvarahooldus OÜ (imporditud)", margis: "amber", info: "Hoolduslepingu automaatne pikenemine — otsusta 2 kuud ette" },
    { kuupaev: "2028-08-31", tyyp: "Lepingu lõpp", objekt: "LEP-2023-041 · Viking Metall OÜ (imporditud)", margis: "grey", info: "Teavitus 90 päeva ette (operaator + klient)" },
  );
  AUDIT.length = 0;
  AUDIT.push(
    { aeg: "04.06.2026 15:20", autor: "Tarmo Sepp", tegevus: "Imporditud lepingu HOO-2024-06 struktuur kinnitatud (Hooldusleping · Clanner Kinnisvarahooldus OÜ)." },
    { aeg: "04.06.2026 14:47", autor: "AI-agent", tegevus: "Olemasolev üürileping LEP-2023-041 loetud klauslimudelisse (72 punkti) — operaator kinnitas struktuuri." },
    { aeg: "04.06.2026 14:31", autor: "Tarmo Sepp", tegevus: "Ettevõte B11G OÜ lisatud kontole (e-äriregistri autotäide) · Stock Office'i ja Self Storage'i EHR baasandmed laetud (Betooni 11g)." },
  );
}

/* --- Tuletatud arvutused --------------------------------------------------- */
function spaceById(id) { return SPACES.find(s => s.id === id); }
function clientById(id) { return CLIENTS.find(c => c.id === id); }
function offerById(id) { return OFFERS.find(o => o.id === id); }
function leaseById(id) { return LEASES.find(l => l.id === id); }

function ametikohtById(id) { return AMETIKOHAD.find(a => a.id === id); }
function tlepingById(id) { return TLEPINGUD.find(t => t.id === id); }
function impById(id) { return IMPORDITUD.find(x => x.id === id); }
/* hõive = projektsioon: mitu kohta on aktiivse töölepinguga täidetud */
function ametikohtHoive(a) { return TLEPINGUD.filter(t => t.ametikohtId === a.id && t.staatus === "Kehtiv").length; }

function objektById(id) { return OBJEKTID.find(o => o.id === id); }
/* pinna kodu-hoone; objektId puudumisel (nt vana salvestus) esimene/peamine hoone */
function objektOf(space) { return (space && space.objektId && objektById(space.objektId)) || OBJEKT; }

function rent(space) { return space.yyripind * space.hind; }
function spaceParts(space) { return (space.jaotus && space.jaotus.length) ? space.jaotus : [{ osa: space.tyyp, m2: space.yyripind }]; }
function kkWinter(space) { return space.yyripind * objektOf(space).korvalkulu.talvine; }
function kkSummer(space) { return space.yyripind * objektOf(space).korvalkulu.suvine; }

function eur(n, frac = 2) {
  return n.toLocaleString("et-EE", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}
function withVat(n) { return n * (1 + VAT_RATE); }

/* --- püsisalvestus (localStorage): sisendid elavad üle lehe sulgemise ------
   Võti on ettevõttepõhine — kummagi ettevõtte sisestused püsivad eraldi. */
const LS_KEY = COMPANY_ID === "taeva" ? "thinkone_demo_v1" : "thinkone_demo_v1_" + COMPANY_ID;
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ spaces: SPACES, offers: OFFERS, leases: LEASES, tlepingud: TLEPINGUD, audit: AUDIT }));
  } catch (e) { /* file:// piirangud vms — demo jätkab mälus */ }
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.spaces) { // varasem salvestus ei pruugi jaotust/objektId-d/uusi pindu sisaldada → täienda seemnest
      const seed = SPACES.slice();
      const seedById = new Map(seed.map(s => [s.id, s]));
      SPACES.length = 0;
      SPACES.push(...d.spaces.map(s => { const sd = seedById.get(s.id) || {};
        return { ...s, jaotus: s.jaotus || sd.jaotus, objektId: s.objektId || sd.objektId }; }));
      seed.forEach(s => { if (!SPACES.some(x => x.id === s.id)) SPACES.push(s); }); // seemnesse lisandunud pinnad
    }
    /* vana salvestus võib viidata kliendile/pinnale/ametikohale, mida praeguses
       seemnes enam pole (nt B11G sai oma kliendiregistri) → sellised read maha */
    if (d.offers) { OFFERS.length = 0; OFFERS.push(...d.offers.filter(o => clientById(o.clientId) && (o.spaceIds || [o.spaceId]).every(id => spaceById(id)))); }
    if (d.leases) { LEASES.length = 0; LEASES.push(...d.leases.filter(l => clientById(l.clientId) && spaceById(l.spaceId))); }
    if (d.tlepingud) { TLEPINGUD.length = 0; TLEPINGUD.push(...d.tlepingud.filter(t => ametikohtById(t.ametikohtId))); } // vanem salvestus: võti puudub → seeme jääb
    if (d.audit)  { AUDIT.length = 0;  AUDIT.push(...d.audit); }
    /* v192 migratsioon: allkirjastatud lepingu staatus „Arhiveeritud" → „Kehtiv" */
    LEASES.concat(TLEPINGUD).forEach(x => { if (x.staatus === "Arhiveeritud") x.staatus = "Kehtiv"; });
  } catch (e) { /* rikutud salvestus → kasuta seemneandmeid */ }
}
function reset() {
  try {
    ["thinkone_demo_v1", "thinkone_demo_v1_b11g", "thinkone_role", "thinkone_company"]
      .forEach(k => localStorage.removeItem(k));
  } catch (e) {}
  location.reload();
}
load();

window.DB = {
  COMPANIES, COMPANY_ID, setCompany,
  OBJEKTID, objektById, objektOf, TAITUVUS_AJALUGU,
  VAT_RATE, ACCOUNT, OBJEKT, SPACES, CLIENTS, RISK_SOURCES, OFFERS, LEASES,
  OSAKOND, AMETIKOHAD, TLEPINGUD, TL_ULD, IMPORDITUD,
  ULD_CLAUSES, KEY_DATES, AUDIT,
  spaceById, clientById, offerById, leaseById,
  ametikohtById, tlepingById, impById, ametikohtHoive,
  rent, spaceParts, kkWinter, kkSummer, eur, withVat,
  save, reset,
};
})();
