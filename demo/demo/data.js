/* ============================================================================
   ThinkOne — demokeskkonna näidisandmed (seemneandmed) · spetsifikatsioon v2
   Kaks sammast: esemeregister (hoone→pinnad · osakond→ametikohad) + lepingumootor.
   Vertikaalid: ärikinnisvara üürilepingud + töölepingud (sama mootor).
   Üürileandja/tööandja: Taevavärava OÜ · Hoone: T6B
   Kõik summad on neto (käibemaksuta), kui pole märgitud teisiti.
   ========================================================================== */

(function () { // IIFE: hoiab const-id lokaalsena (klassikalised <script>-id jagavad globaalset skoopi)
const VAT_RATE = 0.24; // Eesti standardmäär alates 01.07.2025

/* --- DEMO AEG (v408): „täna" on PÄRIS tänane kuupäev, mitte fikseeritud 10.06.2026. -----------------
   Seeme on kirjutatud ankru SEED_ANCHOR järgi; laadimisel nihutatakse LOO-kuupäevad (pakkumused, audit,
   impordi kinnitamine, pakkumuse võtmekuupäev, seemne lepingud) ankrust tänasesse (shiftStoryDates).
   PÄRIS imporditud lepingute kuupäevad (sõlmitud 2023, tähtajad 2027–2030, THI) jäävad paika.
   Salvestatud seis (localStorage) ei nihku enam — demo elab edasi päris ajas; „Lähtesta demo" seemendab
   tänasest uuesti. Uued kirjed: loodud = TODAY_EE (kuupäev), aeg = NOW_EE() (kuupäev + kellaaeg). */
const SEED_ANCHOR = new Date(2026, 5, 10);
const DEMO_TODAY = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); })();
const SEED_SHIFT_DAYS = Math.round((DEMO_TODAY - SEED_ANCHOR) / 86400000);
const pad2 = (n) => String(n).padStart(2, "0");
function fmtEE(d) { return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`; }
function fmtISO(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
const TODAY_EE = fmtEE(DEMO_TODAY);
function NOW_EE() { const n = new Date(); return `${fmtEE(n)} ${pad2(n.getHours())}:${pad2(n.getMinutes())}`; }
/* nihutab stringis KÕIK dd.mm.yyyy ja yyyy-mm-dd kuupäevad N päeva (kellaaeg jääb) */
function shiftDates(str, days) {
  if (!days || typeof str !== "string") return str;
  return str.replace(/\b(\d{2})\.(\d{2})\.(\d{4})\b/g, (m, d, mo, y) => fmtEE(new Date(+y, +mo - 1, +d + days)))
            .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m, y, mo, d) => fmtISO(new Date(+y, +mo - 1, +d + days)));
}
function shiftDeep(v, days) {
  if (typeof v === "string") return shiftDates(v, days);
  if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = shiftDeep(v[i], days); return v; }
  if (v && typeof v === "object") { for (const k of Object.keys(v)) v[k] = shiftDeep(v[k], days); return v; }
  return v;
}
function shiftStoryDates() {
  const d = SEED_SHIFT_DAYS; if (!d) return;
  OFFERS.forEach(o => shiftDeep(o, d));
  LEASES.forEach(l => shiftDeep(l, d));
  TLEPINGUD.forEach(t => shiftDeep(t, d));
  AUDIT.forEach(a => shiftDeep(a, d));
  KEY_DATES.forEach(k => { if (!/imporditud/i.test(k.objekt || "")) shiftDeep(k, d); });
  IMPORDITUD.forEach(x => { if (x.kinnitatud) x.kinnitatud = shiftDates(x.kinnitatud, d); }); /* ainult impordi kinnitamise päev */
}

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
  { id: "p1",  nr: 1,  nimi: "Pind 1",  tyyp: "Ladu + müügisaal", neto: 502.0, yyripind: 538.4, koef: 1.04, hind: 8.50, elekter: 63, parkimine: 6, plaan: "Lisa1_pind1.pdf", staatus: "Pakkumusel",     tenant: "Baltic Logistics OÜ",
    jaotus: [{ osa: "Ladu", m2: 420.0 }, { osa: "Müügisaal", m2: 118.4 }] },
  { id: "p2",  nr: 2,  nimi: "Pind 2",  tyyp: "Ladu",             neto: 172.0, yyripind: 184.2, koef: 1.05, hind: 7.80, elekter: 32, parkimine: 2, plaan: "Lisa1_pind2.pdf", staatus: "Vaba",           tenant: null },
  { id: "p3",  nr: 3,  nimi: "Pind 3",  tyyp: "Ladu",             neto: 180.1, yyripind: 192.5, koef: 1.04, hind: 7.80, elekter: 32, parkimine: 2, plaan: "Lisa1_pind3.pdf", staatus: "Pakkumusel",     tenant: "Roheline Ladu OÜ" },
  { id: "p4",  nr: 4,  nimi: "Pind 4",  tyyp: "Ladu + kontor",    neto: 333.5, yyripind: 357.2, koef: 1.05, hind: 8.20, elekter: 40, parkimine: 4, plaan: "Lisa1_pind4.pdf", staatus: "Pakkumusel",     tenant: "Nordproff OÜ",
    jaotus: [{ osa: "Ladu", m2: 268.4 }, { osa: "Kontor", m2: 88.8 }] },
  { id: "p5",  nr: 5,  nimi: "Pind 5",  tyyp: "Ladu + kontor",    neto: 340.2, yyripind: 364.0, koef: 1.05, hind: 8.20, elekter: 40, parkimine: 4, plaan: "Lisa1_pind5.pdf", staatus: "Reserveeritud",  tenant: "Mikrotehnika AS",
    jaotus: [{ osa: "Ladu", m2: 274.0 }, { osa: "Kontor", m2: 90.0 }] },
  { id: "p6",  nr: 6,  nimi: "Pind 6",  tyyp: "Ladu + kontor",    neto: 349.0, yyripind: 373.6, koef: 1.05, hind: 8.40, elekter: 40, parkimine: 4, plaan: "Lisa1_pind6.pdf", staatus: "Pakkumusel",     tenant: "Mikrotehnika AS",
    jaotus: [{ osa: "Ladu", m2: 281.6 }, { osa: "Kontor", m2: 92.0 }] },
  { id: "p7",  nr: 7,  nimi: "Pind 7",  tyyp: "Ladu + kontor",    neto: 333.4, yyripind: 357.0, koef: 1.05, hind: 8.30, elekter: 40, parkimine: 3, plaan: "Lisa1_pind7.pdf", staatus: "Vaba",           tenant: null,
    jaotus: [{ osa: "Ladu", m2: 268.0 }, { osa: "Kontor", m2: 89.0 }] },
  { id: "p8",  nr: 8,  nimi: "Pind 8",  tyyp: "Ladu + kontor",    neto: 333.5, yyripind: 357.1, koef: 1.05, hind: 8.30, elekter: 40, parkimine: 3, plaan: "Lisa1_pind8.pdf", staatus: "Vaba",           tenant: null,
    jaotus: [{ osa: "Ladu", m2: 268.1 }, { osa: "Kontor", m2: 89.0 }] },
  { id: "p9",  nr: 9,  nimi: "Pind 9",  tyyp: "Ladu",             neto: 170.0, yyripind: 181.9, koef: 1.05, hind: 7.80, elekter: 32, parkimine: 2, plaan: "Lisa1_pind9.pdf", staatus: "Vaba",           tenant: null },
  { id: "p10", nr: 10, nimi: "Pind 10", tyyp: "Ladu",             neto: 101.6, yyripind: 108.7, koef: 1.07, hind: 8.00, elekter: 25, parkimine: 1, plaan: "Lisa1_pind10.pdf", staatus: "Vaba",          tenant: null },
  { id: "p11", nr: 11, nimi: "Pind 11", tyyp: "Büroo",            neto: 94.7,  yyripind: 103.2, koef: 1.09, hind: 12.50, elekter: 20, parkimine: 2, plaan: "Lisa1_pind11.pdf", staatus: "Vaba",          tenant: null },
  { id: "p12", nr: 12, nimi: "Pind 12", tyyp: "Ladu + kontor",    neto: 297.0, yyripind: 318.0, koef: 1.07, hind: 8.60, elekter: 40, parkimine: 4, plaan: "Lisa1_pind12.pdf", staatus: "Vaba",          tenant: null,
    jaotus: [{ osa: "Ladu", m2: 234.0 }, { osa: "Kontor", m2: 84.0 }] },
  /* PÄRIS pind imporditud üürilepingust (LEP-2023-029, AS Maru Ehitus): 174,8 m², 7,60 €/m², 63 A, 2 kohta */
  { id: "p29", nr: 29, nimi: "Pind 29", tyyp: "Ladu / tootmine",  neto: 166.5, yyripind: 174.8, koef: 1.05, hind: 7.60, elekter: 63, parkimine: 2, plaan: "T6B_pind_29_plaan.pdf", staatus: "Üüritud",       tenant: "AS Maru Ehitus" },
];

/* --- Töölepingute vertikaal: osakond (konteiner) + ametikohad (üksused) -----
   Sama muster mis hoone→pinnad: atribuudiskeem tuleb vertikaalist.
   Hõive (mitu kohta täidetud) EI OLE käsitsi väli — arvutatakse TLEPINGUD-ist. */
const OSAKOND = { id: "os-haldus", nimi: "Haldus ja hooldus", ettevote: "Taevavärava OÜ" };

/* MVP 1. etapp: töölepingute vertikaal on VÄLJAS — seemned tühjad, mudel ja
   mootor (helperid, View.tooleping, wizardi haru) jäävad koodi uinuma.
   Varasemad seemned (3 ametikohta + 3 töölepingut) on git-ajaloos (v=292 seis). */
const AMETIKOHAD = [];

/* --- Töölepingud (teine lepingutüüp SAMAL mootoril) ------------------------
   Sama klauslimudel: üld (lukus) / põhi (andmed) / eri (Lisa 3, kirjutab üle).
   Tööleping = hõive ametikoha peal; katseaeg ja palgaülevaatus = võtmekuupäevad. */
const TLEPINGUD = [];

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
/* Imporditud lepingud — PÄRIS dokumendid kaustast importitud/ (v361): faktid loetud lepingutest
   endist, failid demo/lisad/importitud/ all avatavad. Parameetrite VÕTMED loeb kood:
   „Periood" = „dd.mm.yyyy – dd.mm.yyyy (…)" (portfelli rida), „Üür"/„Tasu" = AINULT kuusumma
   (impKuutasu parsib arvu), „Tagatisraha" = „summa (…)", „Indekseerimine" THI → kalendri indekseerimisloogika. */
const IMPORDITUD = [
  { id: "LEP-2023-029", liik: "Üürileping", pool: "AS Maru Ehitus", ese: "Pind 29 · Hoone T6B",
    punkte: 112, kinnitatud: "Tarmo Sepp · 12.05.2026", fail: "Üürileping P_29 MARU Ehitus.pdf",
    solmitud: "25.11.2023", allkirjad: "Varne Mälksoo (üürileandja) · Andres Jakobi (üürnik) · digitaalselt",
    /* parameetrid = põhitingimused (kood loeb võtmeid Periood/Üür/Tagatisraha/Indekseerimine);
       Lisa 3 kokkulepped elavad eraldi `lisad[].punktid` all — vaates omaette plokk */
    parameetrid: [
      ["Periood", "25.11.2023 – 25.11.2030 (7 aastat)"],
      ["Üleandmine", "Hiljemalt 02.01.2024"],
      ["Üüripind", "174,8 m²"],
      ["Kasutusotstarve", "Ladu- või tootmispind"],
      ["Üürihind", "7,60 €/m² + km"],
      ["Üür", "1 328,48 €/kuus (neto)"],
      ["Parkimine", "2 kohta · nr 65 ja 101 · sisaldub üüris"],
      ["Tagatisraha", "3 985,44 € (3 kuu üür + km)"],
      ["Indekseerimine", "Statistikaameti THI · iga 12 kuu · esimene 01.01.2025"],
      ["Maksetähtaeg", "Kuu 10. kuupäevaks"],
      ["Kõrvalkulud", "Arvestite ja üürileandja arvete järgi"],
      ["Elekter", "63 A · 220/360 V"]],
    lisad: [
      { nr: 1, nimi: "Üüripinna plaan", sisu: "P_29 asukoht ja piirid hoones", fail: "lisad/importitud/T6B_pind_29_plaan.pdf" },
      { nr: 2, nimi: "Parkimiskohtade plaan", sisu: "Kohad nr 65 ja 101", fail: "lisad/importitud/P29_parkimine.pdf" },
      { nr: 3, nimi: "Eritingimused", fail: "lisad/importitud/MARU_uurileping_P29_lisa3.pdf", allkirjastatud: "25.11.2023",
        punktid: [
          { muudab: "ÜT p 3.2 → uus 3.2.2", pealkiri: "Pikendusõigus", tekst: "Lepinguperiood 7 aastat. Üürnikul on õigus pikendada lepingut 5 aasta järel samadel tingimustel veel 5 aastaks, kui ta on lepingut korrektselt täitnud." },
          { muudab: "ÜT p 5.2", pealkiri: "Indekseerimine THI järgi", tekst: "Üür tõuseb iga 12 kuu möödumisel üleandmisest automaatselt Statistikaameti THI aastamuutuse võrra (üldtingimuste fikseeritud 3 % asemel). Esimene indekseerimine 01.01.2025." },
          { muudab: "ÜT p 6.3", pealkiri: "Tagatise korrigeerimine", tekst: "Tagatis viiakse 02.01.2029 vastavusse selleks hetkeks indekseeritud üüriga." },
          { muudab: "ÜT p 12.5 kehtetu", pealkiri: "Ülesütlemine ilma põhjuseta välistatud", tekst: "Kummalgi poolel ei ole õigust lepingut mõjuva põhjuseta 1-aastase etteteatamisega üles öelda." },
          { muudab: "ÜT p 8.2", pealkiri: "Reklaam fassaadil", tekst: "Üürnik võib paigaldada hoone välisfassaadile oma logo. Teostab üürileandja valitud agentuur, kulud kannab üürnik; reklaam jääb üürniku omandiks, hooldus üürniku kulul." }] }],
    tahtajad: ["01.01.2027 · indekseerimine (THI)", "25.11.2028 · pikendusõiguse otsustuskoht (5 a täitub)",
      "02.01.2029 · tagatise korrigeerimine", "25.11.2030 · lepingu lõpp"],
    failid: [
      { nimi: "Üürileping P_29 · põhitingimused + üldtingimused", fail: "lisad/importitud/MARU_uurileping_P29.pdf", silt: "8 lk · allkirjastatud" },
      { nimi: "Lisa 1 · Üüripinna plaan (P_29)", fail: "lisad/importitud/T6B_pind_29_plaan.pdf", silt: "PDF" },
      { nimi: "Lisa 2 · Parkimiskohtade plaan (kohad 65, 101)", fail: "lisad/importitud/P29_parkimine.pdf", silt: "PDF" },
      { nimi: "Lisa 3 · Eritingimused", fail: "lisad/importitud/MARU_uurileping_P29_lisa3.pdf", silt: "1 lk · allkirjastatud" }],
    kontaktid: [
      { pool: "Üürileandja · Taevavärava OÜ", read: ["Varne Mälksoo · lepingulised küsimused · +372 503 4135 · varne@futureinvest.info",
        "Marek Andres (Newsec) · halduskorraldus · +372 524 0998", "Kristi Mõtte · arveldused · +372 5647 3887"] },
      { pool: "Üürnik · AS Maru Ehitus", read: ["Andres Jakobi · lepingulised küsimused · +372 657 5850 · ehitus@maru.ee",
        "Erko Alto · tehnilised küsimused · 533 456 686", "Arved: arved-ehitus@maru.ee"] }] },
  { id: "HOO-2023-H508", liik: "Hooldusleping", pool: "Caverion Eesti AS", ese: "Hoone T6B · tehnosüsteemid",
    punkte: 78, kinnitatud: "Tarmo Sepp · 14.05.2026", fail: "HOOLDUSLEPING Nr H5.08.docx",
    solmitud: "01.06.2023", allkirjad: "Varne Mälksoo (tellija) · Mart Kivi (Caverion, juhatuse liige) · digitaalselt",
    parameetrid: [
      ["Periood", "01.06.2023 – tähtajatu"],
      ["Tasu", "1 104,00 €/kuus (neto)"],
      ["Etteteatamine", "2 kuud · kumbki pool"],
      ["Reageerimisaeg", "24/7 avarii · kuni 4 h"],
      ["Arveldus", "Arve kuu 5. kuupäeval"],
      ["Viivis", "0,01 % päevas"],
      ["Hinnad", "Ülevaatus 1× kalendriaastas"],
      ["Garantii", "Remont-/asendustööd 2 aastat"],
      ["Vastutus", "Kuni ühe aasta tasu ulatuses"]],
    lisad: [
      { nr: 1, nimi: "Objektid, töövõtu piirid ja maksumused", sisu: "Taevavärava tee 6b tehnosüsteemid · 1 104 €/kuus: ventilatsioon (33 seadet), tuletõkkeklapid, vesi ja kanalisatsioon, gaasikatlad (4) + gaasipaigaldise järelevaataja, õhkküte, kliimaseadmed (24 süsteemi), ATS, evakuatsiooni- ja tuletõkkeuksed, tuletõkkesektsioonid, valve ja läbipääs, suitsueemaldus, elektripaigaldise käit, evakuatsioonivalgustus, tehnikajuhi ja käidujuhi teenus" },
      { nr: 2, nimi: "Hooldustööde spetsifikatsioonid", sisu: "Korraliste hooldustööde mahud süsteemide kaupa" },
      { nr: 3, nimi: "Avarii ja lisatööde väljakutsete kord", sisu: "24/7 väljakutse +372 5346 0000 · reageerimine kuni 4 h" },
      { nr: 4, nimi: "Hooldus-, lisatööde ja väljakutsete hinnakiri", sisu: "Caverioni hinnakiri −25 % · tunnihind + väljasõit · varuosad kuni 300 € ilma kooskõlastuseta" },
      { nr: 5, nimi: "Poolte kontaktisikud", sisu: "Alger Jõras (tehnikajuht) · Varne Mälksoo · Maili Kivirähk" }],
    tahtajad: ["01.06.2027 · lepinguaasta täitub · hindade ülevaatus", "Tähtajatu · ülesütlemine 2 kuu etteteatamisega"],
    failid: [
      { nimi: "Hooldusleping H5.08 · leping + Lisad 1–5", fail: "lisad/importitud/Hooldusleping_H5-08.pdf", silt: "18 lk · PDF (docx-ist)" },
      { nimi: "Originaal · Word (docx)", fail: "lisad/importitud/Hooldusleping_H5-08.docx", silt: "docx · laadi alla", download: true }],
    kontaktid: [
      { pool: "Hooldaja · Caverion Eesti AS", read: ["Alger Jõras · tehnikajuht · +372 5691 0682 · alger.joras@caverion.com",
        "Väljakutsed 24/7 · +372 5346 0000 · hooldus@caverion.com"] },
      { pool: "Tellija · Taevavärava OÜ", read: ["Varne Mälksoo · lepingulised küsimused · varne@futureinvest.info",
        "Maili Kivirähk · kontaktisik · kinnitab vahe- ja remondiarved", "Arved: arved@futureinvest.info"] }] },
];

/* --- Kliendid -------------------------------------------------------------- */
const CLIENTS = [
  { id: "c-future", nimi: "Future Invest OÜ", tyyp: "Eesti firma", registrikood: "14258963", kmkr: "EE101984774", aadress: "Pärnu mnt 141, Tallinn, 11314", kontakt: "Margus Varne", epost: "margus@futureinvest.info", tel: "+372 503 4135", risk: { skoor: "MADAL", kuupaev: "08.06.2026" } },
  { id: "c-baltic", nimi: "Baltic Logistics OÜ", tyyp: "Eesti firma", registrikood: "11457820", kmkr: "EE100774521", aadress: "Suur-Sõjamäe 10a, Tallinn, 11415", kontakt: "Tarmo Kask", epost: "tarmo@balticlog.ee", tel: "+372 511 2233", risk: { skoor: "MADAL", kuupaev: "14.01.2026" } },
  { id: "c-nord",   nimi: "Nordproff OÜ", tyyp: "Eesti firma", registrikood: "12998341", kmkr: "EE101552398", aadress: "Laki 25, Tallinn, 12915", kontakt: "Liis Tamm", epost: "liis@nordproff.ee", tel: "+372 522 9081", risk: { skoor: "KESKMINE", kuupaev: "02.03.2026" } },
  { id: "c-mikro",  nimi: "Mikrotehnika AS", tyyp: "Eesti firma", registrikood: "10334521", kmkr: "EE100221984", aadress: "Mustamäe tee 5, Tallinn, 10616", kontakt: "Andres Lepik", epost: "andres@mikrotehnika.ee", tel: "+372 5648 2913", risk: { skoor: "MADAL", kuupaev: "20.05.2026" } },
  { id: "c-maru",   nimi: "AS Maru Ehitus", tyyp: "Eesti firma", registrikood: "10714568", kmkr: "EE100659856", aadress: "Järvevana tee 5, Tallinn, 10112", kontakt: "Andres Jakobi", epost: "ehitus@maru.ee", tel: "+372 657 5850", risk: { skoor: "MADAL", kuupaev: "12.05.2026" } },
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
    kommerts: "Nordproff OÜ-le pakume Pind 4.", eritingimused: [
      { id: "e1", tekst: "Üürivaba sisseseadeperiood 2 kuud alates üleandmispäevast.", kirjutabYle: "§5 Üür ja kõrvalkulud" },
    ],
  },
  {
    id: "PAK-2026-003", clientId: "c-baltic", spaceIds: ["p1"], pikkusKuud: 60,
    staatus: "Aktsepteeritud", kehtivKuni: "30.06.2026", loodud: "12.05.2026", looja: "Tarmo Sepp",
    kommerts: "Baltic Logistics OÜ-le pakume Pind 1.", eritingimused: [],
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
/* MVP demo algab PUHTA lepinguportfelliga: platvormis loodud üürilepinguid pole —
   need sünnivad demo käigus pakkumustest (2 aktsepteeritud pakkumust on teisendamiseks
   valmis) või wizardist. Varasemad seemned (LEP-2026-005 Kehtiv + LEP-2026-008
   läbirääkimistel) on git-ajaloos (v=294 seis). Imporditud portfell (IMPORDITUD) jääb. */
const LEASES = [];

/* --- Võtmekuupäevad -------------------------------------------------------- */
const KEY_DATES = [
  { kuupaev: "2026-06-16", tyyp: "Pakkumuse kehtivus", objekt: "PAK-2026-011 · Mikrotehnika AS", margis: "amber", info: "Pakkumus aegub 7 päeva pärast" },
  { kuupaev: "2027-01-01", tyyp: "Indekseerimine", objekt: "LEP-2023-029 · AS Maru Ehitus (imporditud)", margis: "accent", info: "Statistikaameti THI, eelmise aasta muutus · automaatne, lisa ei teki (Lisa 3 p 5.2)" },
  { kuupaev: "2027-06-01", tyyp: "Hindade ülevaatus", objekt: "HOO-2023-H508 · Caverion Eesti AS (imporditud)", margis: "amber", info: "Hooldustasu vaadatakse üle 1× kalendriaastas (p 9.12) · 1 104 €/kuus" },
  { kuupaev: "2028-11-25", tyyp: "Pikendusõigus", objekt: "LEP-2023-029 · AS Maru Ehitus (imporditud)", margis: "amber", info: "5 aastat täitub → üürnikul õigus pikendada 5 aastaks samadel tingimustel (Lisa 3)" },
  { kuupaev: "2029-01-02", tyyp: "Tagatise korrigeerimine", objekt: "LEP-2023-029 · AS Maru Ehitus (imporditud)", margis: "grey", info: "Tagatis viiakse vastavusse indekseeritud üüriga (Lisa 3, ÜT 6.3)" },
  { kuupaev: "2030-11-25", tyyp: "Lepingu lõpp", objekt: "LEP-2023-029 · AS Maru Ehitus (imporditud)", margis: "grey", info: "7-aastane tähtaeg · ei pikene automaatselt (ÜT 3.2) · teavitus 90 päeva ette" },
];

/* --- Audit trail / otsuste mälu (näidis) ----------------------------------- */
const AUDIT = [
  { aeg: "09.06.2026 09:14", autor: "AI-agent", tegevus: "Pakkumuse mustand PAK-2026-014 loodud operaatori korraldusel (Future Invest OÜ · Pind 12)." },
  { aeg: "08.06.2026 16:40", autor: "Tarmo Sepp", tegevus: "Riskiraport tellitud: Future Invest OÜ → koondskoor MADAL." },
  { aeg: "12.05.2026 10:10", autor: "Tarmo Sepp", tegevus: "Pakkumus PAK-2026-003 (Baltic Logistics OÜ · Pind 1) aktsepteeritud — valmis lepinguks teisendamiseks." },
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
    /* objekti oma täituvuse ajalugu (11 kuud) — Ülevaate objekti-skoobi graafik;
       ettevõtte koond (TAITUVUS_AJALUGU) on m²-kaalult sisuliselt sama kõver */
    taituvusAjalugu: [45, 45, 43, 43, 43, 40, 40, 39, 39, 39, 39],
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
    taituvusAjalugu: [55, 55, 50, 50, 50, 45, 45, 41, 41, 41, 41],
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
function kkWinter(space) { const k = objektOf(space).korvalkulu.talvine; return k == null ? NaN : space.yyripind * k; }
function kkSummer(space) { const k = objektOf(space).korvalkulu.suvine; return k == null ? NaN : space.yyripind * k; }

function eur(n, frac = 2) {
  if (n == null || !Number.isFinite(n)) return "määramata";
  return n.toLocaleString("et-EE", { minimumFractionDigits: frac, maximumFractionDigits: frac });
}
function withVat(n) { return n * (1 + VAT_RATE); }

/* --- püsisalvestus (localStorage): sisendid elavad üle lehe sulgemise ------
   Võti on ettevõttepõhine — kummagi ettevõtte sisestused püsivad eraldi. */
const LS_KEY = COMPANY_ID === "taeva" ? "thinkone_demo_v1" : "thinkone_demo_v1_" + COMPANY_ID;
/* imporditud lepingu tähtajad („dd.mm.yyyy · tekst“) → võtmekuupäevad (kalender, avaleht, ülevaade) — v431 */
function impKeyDates(x) {
  return (x.tahtajad || []).map(td => { const d = td.slice(0, 10), t = td.slice(13); if (!/^\d\d\.\d\d\.\d{4}$/.test(d)) return null;
    const q = t.toLowerCase();
    const tyyp = /piken|otsustus/.test(q) ? "Pikendusõigus" : /indeks/.test(q) ? "Indekseerimine" : /makse/.test(q) ? "Maksetähtaeg" : /ülevaat/.test(q) ? "Hindade ülevaatus" : /lõpp/.test(q) ? "Lepingu lõpp" : "Tähtaeg";
    const margis = tyyp === "Lepingu lõpp" ? "grey" : tyyp === "Indekseerimine" ? "accent" : "amber";
    const p = d.split(".");
    return { kuupaev: `${p[2]}-${p[1]}-${p[0]}`, tyyp, objekt: `${x.id} · ${x.pool} (imporditud)`, margis, info: t.charAt(0).toUpperCase() + t.slice(1) }; }).filter(Boolean);
}
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ objects: OBJEKTID, spaces: SPACES, offers: OFFERS, leases: LEASES, tlepingud: TLEPINGUD, audit: AUDIT,
      imports: IMPORDITUD.filter(x => x.lisatud) })); /* v431: impordi kaudu lisatud lepingud (seeme jääb koodist) */
    return true;
  } catch (e) { return false; }
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (Array.isArray(d.objects)) {
      d.objects.filter(o => o && o.id && o.ehr && o.korvalkulu && o.mallid).forEach(o => {
        const existing = OBJEKTID.find(x => x.id === o.id);
        if (existing) Object.assign(existing, o); else OBJEKTID.push(o);
      });
    }
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
    if (Array.isArray(d.imports)) { d.imports.forEach(x => { if (x && x.id && !IMPORDITUD.some(y => y.id === x.id)) { IMPORDITUD.push(x); KEY_DATES.push(...impKeyDates(x)); } });
      KEY_DATES.sort((a, b) => a.kuupaev.localeCompare(b.kuupaev)); }
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
shiftStoryDates(); /* v408: seeme ankrust tänasesse — enne salvestatud seisu laadimist */
load();

window.DB = {
  COMPANIES, COMPANY_ID, setCompany,
  OBJEKTID, objektById, objektOf, TAITUVUS_AJALUGU,
  VAT_RATE, ACCOUNT, OBJEKT, SPACES, CLIENTS, RISK_SOURCES, OFFERS, LEASES,
  OSAKOND, AMETIKOHAD, TLEPINGUD, TL_ULD, IMPORDITUD,
  ULD_CLAUSES, KEY_DATES, AUDIT, impKeyDates,
  DEMO_TODAY, TODAY_EE, NOW_EE, fmtEE, fmtISO, SEED_ANCHOR, SEED_SHIFT_DAYS,
  spaceById, clientById, offerById, leaseById,
  ametikohtById, tlepingById, impById, ametikohtHoive,
  rent, spaceParts, kkWinter, kkSummer, eur, withVat,
  save, reset,
};
})();
