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
   Seeme on kirjutatud ankru SEED_ANCHOR järgi; laadimisel nihutatakse LOO-kuupäevad (pakkumised, audit,
   impordi kinnitamine, pakkumise võtmekuupäev, seemne lepingud) ankrust tänasesse (shiftStoryDates).
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
  /* v487: riskipäringu kuupäev on loo-kuupäev (varem jäi 08.06 ja avaandmete seis 21.09 — raport paistis vananenud) */
  CLIENTS.forEach(c => { if (c.risk && c.risk.kuupaev) c.risk.kuupaev = shiftDates(c.risk.kuupaev, d); });
}

/* --- Mitu ettevõtet ühe konto all (spets etapp 01) --------------------------
   Aktiivne ettevõte valitakse külgribalt; valik püsib localStorage'is ja
   andmestik laetakse lehe taaslaadimisel vastava ettevõtte seemnest. */
const COMPANIES = [
  { id: "taeva", nimi: "Taevavärava OÜ", kontekst: "Hoone T6B · Haldus ja hooldus" },
  { id: "b11g",  nimi: "B11G OÜ",        kontekst: "Stock Office · Self Storage" },
  { id: "uus",   nimi: "Uus konto",      kontekst: "tühi konto · alusta seadistusest" },   /* v623-alusta */
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
    kontaktisik: "Varne Mälksoo",   /* v699: lepingulistes küsimustes (P 6.1 esimene rida) */
    allkirjastajad: [{ nimi: "Tarmo Sepp", roll: "juhatuse liige" }], esindus: "üksi",   /* v642 (kolleeg): e-äriregistri juhatus + esindusõigus */
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
  logo: "lisad/T6B_logo.png", /* pakkumise dokumendi päises — hoonepõhine bränd */
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
    pinnaplaan: "lisad/pinnad/T6B_koik_pinnad.pdf",   /* v549: kõik pinnad ühel plaanil (pindade-plaanid/) */
    parkimine: "lisad/T6B_parkimisskeem.pdf",
  },
  mallid: {
    uldtingimused: "Äriruumide üürilepingu üldtingimused v3.2 (lukus)",
    eritingimused: "Eritingimuste põhi v1.4",
    pakkumus: "Pakkumise põhi v2.0",
  },
};

/* Ettevõttel võib olla mitu objekti (Ettevõte → Objekt 1..n). OBJEKT = esimene/
   peamine hoone (tagasiühilduvus); OBJEKTID kannab kõiki aktiivse ettevõtte omi. */
const OBJEKTID = [OBJEKT];

/* täituvuse ajalugu (% üüripinnast, juuli 2025 – mai 2026) — jooksev kuu (juuni)
   EI OLE siin: see arvutub dashboardil hõivetest (staatus = projektsioon) */
const TAITUVUS_AJALUGU = [31, 31, 35, 35, 35, 38, 42, 42, 40, 38, 38];

/* --- Parkimiskohad (v551) — ERALDI ese, seotud hoonega -----------------------
   Kasutaja otsus: parkimiskohad muutuvad ajas ja neid ei seota püsivalt pinnaga — neid hallatakse
   objekti parkimisregistris ning pakkumus/leping määrab konkreetsed kohad plaanilt (Lisa 2 genereeritakse).
   Plaan = parkimisplaan.svg (juurkaust) sisseehitatuna (file:// peab töötama, fetch-i ei kasutata);
   kohad loetakse SVG-st (g.parking-space[data-number]); „Pind 19" silt → „Pind 20" (päris numeratsioon). */
const PARK_SVGS = { "obj-t6b": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="60 100 1100 690" role="img" aria-labelledby="plan-title plan-description"> <title id="plan-title">Taevavärava tee 6b — parkimisplaan</title> <desc id="plan-description">Asendiplaani P_29_parkimine.pdf põhjal koostatud minimalistlik plaan. 115 eraldi nummerdatud parkimiskohta; kohad 1 ja 2 on ligipääsetavad. Hoone kolmel küljel on 30 algplaani noolte järgi märgitud tõste-sissesõiduust. Nummerdus järgib kohtade tähiseid 1–115, mitte algplaani üldmärget P114. Pinnad 1–30 on nummerdatud alt paremalt päripäeva. Värvid järgivad t6b.ee kollast ja halli kujundust. Tegemist on lihtsustatud ülevaateplaaniga.</desc> <metadata>Source: P_29_parkimine.pdf; parking identifiers: parking-001 through parking-115; source orientation preserved; source building and asphalt vector contours retained.</metadata> <defs> <pattern id="access-stripes" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><path d="M0 0V3" stroke="#888b8d" stroke-width="0.5"/></pattern> <g id="accessible-symbol" fill="none" stroke="currentColor" stroke-width="0.85" stroke-linecap="round" stroke-linejoin="round"> <circle cx="0.8" cy="-4.3" r="1" fill="currentColor" stroke="none"/> <path d="M0.4-2.4V1H3.2L4.7 4M0.4-.4H3M-1.3-.5A3 3 0 1 0 2.5 3.5"/> </g> </defs> <style> text {font-family:Arial,Helvetica,sans-serif} .parking-area {fill:#fafafa;stroke:#888b8d;stroke-width:.55;stroke-linejoin:round} .accessible .parking-area {fill:#fff4cf} .parking-space:hover .parking-area {fill:#fcca29} .parking-number {fill:#212322;font-size:6.2px;font-weight:600;text-anchor:middle;dominant-baseline:central;pointer-events:none} .door-mark {stroke:#212322;fill:none;stroke-width:.9;stroke-linecap:butt;stroke-linejoin:miter} .unit-label {fill:#fcca29;font-size:8px;font-weight:600;text-anchor:middle;dominant-baseline:central} </style> <rect x="60" y="100" width="1100" height="690" fill="#ffffff"/> <path d="M101 155H141" stroke="#fcca29" stroke-width="3"/> <g id="heading" fill="#212322"> <text x="101" y="129" font-size="17" font-weight="600">Taevavärava tee 6b</text> <text x="101" y="145" font-size="8.5" fill="#737678" letter-spacing="1.4">PARKIMISPLAAN</text> <text x="1129" y="136" font-size="9" text-anchor="end" fill="#737678">115 parkimiskohta</text> </g> <g id="asphalt" fill="#D9D8D6" stroke="#b7b8b7" stroke-width=".7" stroke-linejoin="round"> <polygon id="asphalt-1" points="111.480,173.880 111.480,204.480 101.400,204.480 101.880,683.281 111.960,683.281 112.079,714.001 1056.600,712.921 1056.600,665.400 1097.640,665.400 1097.160,616.200 1062.599,616.321 1062.240,270.481 1093.680,270.360 1093.200,221.280 1087.080,221.280 1037.040,221.400 1037.040,172.921 111.480,173.880"/> <polygon id="asphalt-3" points="1128.361,586.800 1126.680,592.321 1124.280,597.480 1121.160,602.160 1117.321,606.360 1112.880,609.961 1107.961,612.841 1102.680,614.880 1097.161,616.200 1097.640,665.281 1103.160,666.841 1108.321,669.001 1113.001,672.000 1117.321,675.600 1121.040,679.801 1124.161,684.600 1126.439,689.640 1128.000,695.040 1128.840,700.680 1129.201,581.280 1128.361,586.800"/> <polygon id="asphalt-4" points="1127.160,191.760 1125.360,197.520 1122.719,202.920 1119.240,207.840 1115.040,212.040 1110.120,215.640 1104.840,218.400 1099.080,220.320 1093.080,221.280 1093.680,270.360 1099.439,271.320 1105.080,273.120 1110.361,275.760 1115.160,279.240 1119.361,283.440 1122.840,288.120 1125.599,293.400 1127.519,299.040 1128.480,304.800 1128.120,185.760 1127.160,191.760"/> </g> <g id="parking-spaces"> <g id="space-001" class="parking-space accessible" data-number="1" aria-label="Parkimiskoht 1 — ligipääsetav"> <title>Parkimiskoht 1 — ligipääsetav</title> <polygon id="parking-001" class="parking-area" data-number="1" points="1034.520,682.343 1056.600,682.320 1056.600,712.980 1034.520,713.003"/> <path d="M1035.320 682.843h5.7v29.6h-5.7Z" fill="url(#access-stripes)" pointer-events="none"/> <use href="#accessible-symbol" transform="translate(1048.560 704.032)" color="#343635" pointer-events="none"/> <text class="parking-number" x="1048.560" y="691.332">1</text> </g> <g id="space-002" class="parking-space accessible" data-number="2" aria-label="Parkimiskoht 2 — ligipääsetav"> <title>Parkimiskoht 2 — ligipääsetav</title> <polygon id="parking-002" class="parking-area" data-number="2" points="1012.440,682.366 1034.520,682.343 1034.520,713.003 1012.440,713.026"/> <path d="M1013.240 682.866h5.7v29.6h-5.7Z" fill="url(#access-stripes)" pointer-events="none"/> <use href="#accessible-symbol" transform="translate(1026.480 704.055)" color="#343635" pointer-events="none"/> <text class="parking-number" x="1026.480" y="691.355">2</text> </g> <g id="space-003" class="parking-space" data-number="3" aria-label="Parkimiskoht 3"> <title>Parkimiskoht 3</title> <polygon id="parking-003" class="parking-area" data-number="3" points="996.480,682.383 1012.440,682.366 1012.440,713.026 996.480,713.043"/> <text class="parking-number" x="1004.460" y="697.705">3</text> </g> <g id="space-004" class="parking-space" data-number="4" aria-label="Parkimiskoht 4"> <title>Parkimiskoht 4</title> <polygon id="parking-004" class="parking-area" data-number="4" points="980.520,682.399 996.480,682.383 996.480,713.043 980.520,713.059"/> <text class="parking-number" x="988.500" y="697.721">4</text> </g> <g id="space-005" class="parking-space" data-number="5" aria-label="Parkimiskoht 5"> <title>Parkimiskoht 5</title> <polygon id="parking-005" class="parking-area" data-number="5" points="964.560,682.416 980.520,682.399 980.520,713.059 964.560,713.076"/> <text class="parking-number" x="972.540" y="697.738">5</text> </g> <g id="space-006" class="parking-space" data-number="6" aria-label="Parkimiskoht 6"> <title>Parkimiskoht 6</title> <polygon id="parking-006" class="parking-area" data-number="6" points="948.600,682.433 964.560,682.416 964.560,713.076 948.600,713.093"/> <text class="parking-number" x="956.580" y="697.754">6</text> </g> <g id="space-007" class="parking-space" data-number="7" aria-label="Parkimiskoht 7"> <title>Parkimiskoht 7</title> <polygon id="parking-007" class="parking-area" data-number="7" points="932.640,682.449 948.600,682.433 948.600,713.093 932.640,713.109"/> <text class="parking-number" x="940.620" y="697.771">7</text> </g> <g id="space-008" class="parking-space" data-number="8" aria-label="Parkimiskoht 8"> <title>Parkimiskoht 8</title> <polygon id="parking-008" class="parking-area" data-number="8" points="916.680,682.466 932.640,682.449 932.640,713.109 916.680,713.126"/> <text class="parking-number" x="924.660" y="697.788">8</text> </g> <g id="space-009" class="parking-space" data-number="9" aria-label="Parkimiskoht 9"> <title>Parkimiskoht 9</title> <polygon id="parking-009" class="parking-area" data-number="9" points="900.720,682.483 916.680,682.466 916.680,713.126 900.720,713.143"/> <text class="parking-number" x="908.700" y="697.804">9</text> </g> <g id="space-010" class="parking-space" data-number="10" aria-label="Parkimiskoht 10"> <title>Parkimiskoht 10</title> <polygon id="parking-010" class="parking-area" data-number="10" points="884.760,682.499 900.720,682.483 900.720,713.143 884.760,713.159"/> <text class="parking-number" x="892.740" y="697.821">10</text> </g> <g id="space-011" class="parking-space" data-number="11" aria-label="Parkimiskoht 11"> <title>Parkimiskoht 11</title> <polygon id="parking-011" class="parking-area" data-number="11" points="868.800,682.516 884.760,682.499 884.760,713.159 868.800,713.176"/> <text class="parking-number" x="876.780" y="697.837">11</text> </g> <g id="space-012" class="parking-space" data-number="12" aria-label="Parkimiskoht 12"> <title>Parkimiskoht 12</title> <polygon id="parking-012" class="parking-area" data-number="12" points="852.840,682.532 868.800,682.516 868.800,713.176 852.840,713.192"/> <text class="parking-number" x="860.820" y="697.854">12</text> </g> <g id="space-013" class="parking-space" data-number="13" aria-label="Parkimiskoht 13"> <title>Parkimiskoht 13</title> <polygon id="parking-013" class="parking-area" data-number="13" points="836.880,682.549 852.840,682.532 852.840,713.192 836.880,713.209"/> <text class="parking-number" x="844.860" y="697.871">13</text> </g> <g id="space-014" class="parking-space" data-number="14" aria-label="Parkimiskoht 14"> <title>Parkimiskoht 14</title> <polygon id="parking-014" class="parking-area" data-number="14" points="820.920,682.566 836.880,682.549 836.880,713.209 820.920,713.226"/> <text class="parking-number" x="828.900" y="697.887">14</text> </g> <g id="space-015" class="parking-space" data-number="15" aria-label="Parkimiskoht 15"> <title>Parkimiskoht 15</title> <polygon id="parking-015" class="parking-area" data-number="15" points="804.960,682.582 820.920,682.566 820.920,713.226 804.960,713.242"/> <text class="parking-number" x="812.940" y="697.904">15</text> </g> <g id="space-016" class="parking-space" data-number="16" aria-label="Parkimiskoht 16"> <title>Parkimiskoht 16</title> <polygon id="parking-016" class="parking-area" data-number="16" points="789.000,682.599 804.960,682.582 804.960,713.242 789.000,713.259"/> <text class="parking-number" x="796.980" y="697.921">16</text> </g> <g id="space-017" class="parking-space" data-number="17" aria-label="Parkimiskoht 17"> <title>Parkimiskoht 17</title> <polygon id="parking-017" class="parking-area" data-number="17" points="773.040,682.615 789.000,682.599 789.000,713.259 773.040,713.275"/> <text class="parking-number" x="781.020" y="697.937">17</text> </g> <g id="space-018" class="parking-space" data-number="18" aria-label="Parkimiskoht 18"> <title>Parkimiskoht 18</title> <polygon id="parking-018" class="parking-area" data-number="18" points="757.080,682.632 773.040,682.615 773.040,713.275 757.080,713.292"/> <text class="parking-number" x="765.060" y="697.954">18</text> </g> <g id="space-019" class="parking-space" data-number="19" aria-label="Parkimiskoht 19"> <title>Parkimiskoht 19</title> <polygon id="parking-019" class="parking-area" data-number="19" points="741.120,682.649 757.080,682.632 757.080,713.292 741.120,713.309"/> <text class="parking-number" x="749.100" y="697.970">19</text> </g> <g id="space-020" class="parking-space" data-number="20" aria-label="Parkimiskoht 20"> <title>Parkimiskoht 20</title> <polygon id="parking-020" class="parking-area" data-number="20" points="725.160,682.665 741.120,682.649 741.120,713.309 725.160,713.325"/> <text class="parking-number" x="733.140" y="697.987">20</text> </g> <g id="space-021" class="parking-space" data-number="21" aria-label="Parkimiskoht 21"> <title>Parkimiskoht 21</title> <polygon id="parking-021" class="parking-area" data-number="21" points="709.200,682.682 725.160,682.665 725.160,713.325 709.200,713.342"/> <text class="parking-number" x="717.180" y="698.004">21</text> </g> <g id="space-022" class="parking-space" data-number="22" aria-label="Parkimiskoht 22"> <title>Parkimiskoht 22</title> <polygon id="parking-022" class="parking-area" data-number="22" points="693.240,682.698 709.200,682.682 709.200,713.342 693.240,713.358"/> <text class="parking-number" x="701.220" y="698.020">22</text> </g> <g id="space-023" class="parking-space" data-number="23" aria-label="Parkimiskoht 23"> <title>Parkimiskoht 23</title> <polygon id="parking-023" class="parking-area" data-number="23" points="677.280,682.715 693.240,682.698 693.240,713.358 677.280,713.375"/> <text class="parking-number" x="685.260" y="698.037">23</text> </g> <g id="space-024" class="parking-space" data-number="24" aria-label="Parkimiskoht 24"> <title>Parkimiskoht 24</title> <polygon id="parking-024" class="parking-area" data-number="24" points="661.320,682.732 677.280,682.715 677.280,713.375 661.320,713.392"/> <text class="parking-number" x="669.300" y="698.053">24</text> </g> <g id="space-025" class="parking-space" data-number="25" aria-label="Parkimiskoht 25"> <title>Parkimiskoht 25</title> <polygon id="parking-025" class="parking-area" data-number="25" points="645.360,682.748 661.320,682.732 661.320,713.392 645.360,713.408"/> <text class="parking-number" x="653.340" y="698.070">25</text> </g> <g id="space-026" class="parking-space" data-number="26" aria-label="Parkimiskoht 26"> <title>Parkimiskoht 26</title> <polygon id="parking-026" class="parking-area" data-number="26" points="629.400,682.765 645.360,682.748 645.360,713.408 629.400,713.425"/> <text class="parking-number" x="637.380" y="698.087">26</text> </g> <g id="space-027" class="parking-space" data-number="27" aria-label="Parkimiskoht 27"> <title>Parkimiskoht 27</title> <polygon id="parking-027" class="parking-area" data-number="27" points="613.440,682.782 629.400,682.765 629.400,713.425 613.440,713.442"/> <text class="parking-number" x="621.420" y="698.103">27</text> </g> <g id="space-028" class="parking-space" data-number="28" aria-label="Parkimiskoht 28"> <title>Parkimiskoht 28</title> <polygon id="parking-028" class="parking-area" data-number="28" points="597.480,682.798 613.440,682.782 613.440,713.442 597.480,713.458"/> <text class="parking-number" x="605.460" y="698.120">28</text> </g> <g id="space-029" class="parking-space" data-number="29" aria-label="Parkimiskoht 29"> <title>Parkimiskoht 29</title> <polygon id="parking-029" class="parking-area" data-number="29" points="581.520,682.815 597.480,682.798 597.480,713.458 581.520,713.475"/> <text class="parking-number" x="589.500" y="698.136">29</text> </g> <g id="space-030" class="parking-space" data-number="30" aria-label="Parkimiskoht 30"> <title>Parkimiskoht 30</title> <polygon id="parking-030" class="parking-area" data-number="30" points="565.560,682.831 581.520,682.815 581.520,713.475 565.560,713.491"/> <text class="parking-number" x="573.540" y="698.153">30</text> </g> <g id="space-031" class="parking-space" data-number="31" aria-label="Parkimiskoht 31"> <title>Parkimiskoht 31</title> <polygon id="parking-031" class="parking-area" data-number="31" points="549.600,682.848 565.560,682.831 565.560,713.491 549.600,713.508"/> <text class="parking-number" x="557.580" y="698.170">31</text> </g> <g id="space-032" class="parking-space" data-number="32" aria-label="Parkimiskoht 32"> <title>Parkimiskoht 32</title> <polygon id="parking-032" class="parking-area" data-number="32" points="533.640,682.865 549.600,682.848 549.600,713.508 533.640,713.525"/> <text class="parking-number" x="541.620" y="698.186">32</text> </g> <g id="space-033" class="parking-space" data-number="33" aria-label="Parkimiskoht 33"> <title>Parkimiskoht 33</title> <polygon id="parking-033" class="parking-area" data-number="33" points="517.680,682.881 533.640,682.865 533.640,713.525 517.680,713.541"/> <text class="parking-number" x="525.660" y="698.203">33</text> </g> <g id="space-034" class="parking-space" data-number="34" aria-label="Parkimiskoht 34"> <title>Parkimiskoht 34</title> <polygon id="parking-034" class="parking-area" data-number="34" points="501.720,682.898 517.680,682.881 517.680,713.541 501.720,713.558"/> <text class="parking-number" x="509.700" y="698.220">34</text> </g> <g id="space-035" class="parking-space" data-number="35" aria-label="Parkimiskoht 35"> <title>Parkimiskoht 35</title> <polygon id="parking-035" class="parking-area" data-number="35" points="485.760,682.914 501.720,682.898 501.720,713.558 485.760,713.574"/> <text class="parking-number" x="493.740" y="698.236">35</text> </g> <g id="space-036" class="parking-space" data-number="36" aria-label="Parkimiskoht 36"> <title>Parkimiskoht 36</title> <polygon id="parking-036" class="parking-area" data-number="36" points="469.800,682.931 485.760,682.914 485.760,713.574 469.800,713.591"/> <text class="parking-number" x="477.780" y="698.253">36</text> </g> <g id="space-037" class="parking-space" data-number="37" aria-label="Parkimiskoht 37"> <title>Parkimiskoht 37</title> <polygon id="parking-037" class="parking-area" data-number="37" points="453.840,682.948 469.800,682.931 469.800,713.591 453.840,713.608"/> <text class="parking-number" x="461.820" y="698.269">37</text> </g> <g id="space-038" class="parking-space" data-number="38" aria-label="Parkimiskoht 38"> <title>Parkimiskoht 38</title> <polygon id="parking-038" class="parking-area" data-number="38" points="437.880,682.964 453.840,682.948 453.840,713.608 437.880,713.624"/> <text class="parking-number" x="445.860" y="698.286">38</text> </g> <g id="space-039" class="parking-space" data-number="39" aria-label="Parkimiskoht 39"> <title>Parkimiskoht 39</title> <polygon id="parking-039" class="parking-area" data-number="39" points="421.920,682.981 437.880,682.964 437.880,713.624 421.920,713.641"/> <text class="parking-number" x="429.900" y="698.303">39</text> </g> <g id="space-040" class="parking-space" data-number="40" aria-label="Parkimiskoht 40"> <title>Parkimiskoht 40</title> <polygon id="parking-040" class="parking-area" data-number="40" points="405.960,682.998 421.920,682.981 421.920,713.641 405.960,713.658"/> <text class="parking-number" x="413.940" y="698.319">40</text> </g> <g id="space-041" class="parking-space" data-number="41" aria-label="Parkimiskoht 41"> <title>Parkimiskoht 41</title> <polygon id="parking-041" class="parking-area" data-number="41" points="390.000,683.014 405.960,682.998 405.960,713.658 390.000,713.674"/> <text class="parking-number" x="397.980" y="698.336">41</text> </g> <g id="space-042" class="parking-space" data-number="42" aria-label="Parkimiskoht 42"> <title>Parkimiskoht 42</title> <polygon id="parking-042" class="parking-area" data-number="42" points="374.040,683.031 390.000,683.014 390.000,713.674 374.040,713.691"/> <text class="parking-number" x="382.020" y="698.352">42</text> </g> <g id="space-043" class="parking-space" data-number="43" aria-label="Parkimiskoht 43"> <title>Parkimiskoht 43</title> <polygon id="parking-043" class="parking-area" data-number="43" points="358.080,683.047 374.040,683.031 374.040,713.691 358.080,713.707"/> <text class="parking-number" x="366.060" y="698.369">43</text> </g> <g id="space-044" class="parking-space" data-number="44" aria-label="Parkimiskoht 44"> <title>Parkimiskoht 44</title> <polygon id="parking-044" class="parking-area" data-number="44" points="342.120,683.064 358.080,683.047 358.080,713.707 342.120,713.724"/> <text class="parking-number" x="350.100" y="698.386">44</text> </g> <g id="space-045" class="parking-space" data-number="45" aria-label="Parkimiskoht 45"> <title>Parkimiskoht 45</title> <polygon id="parking-045" class="parking-area" data-number="45" points="326.160,683.081 342.120,683.064 342.120,713.724 326.160,713.741"/> <text class="parking-number" x="334.140" y="698.402">45</text> </g> <g id="space-046" class="parking-space" data-number="46" aria-label="Parkimiskoht 46"> <title>Parkimiskoht 46</title> <polygon id="parking-046" class="parking-area" data-number="46" points="310.200,683.097 326.160,683.081 326.160,713.741 310.200,713.757"/> <text class="parking-number" x="318.180" y="698.419">46</text> </g> <g id="space-047" class="parking-space" data-number="47" aria-label="Parkimiskoht 47"> <title>Parkimiskoht 47</title> <polygon id="parking-047" class="parking-area" data-number="47" points="294.240,683.114 310.200,683.097 310.200,713.757 294.240,713.774"/> <text class="parking-number" x="302.220" y="698.436">47</text> </g> <g id="space-048" class="parking-space" data-number="48" aria-label="Parkimiskoht 48"> <title>Parkimiskoht 48</title> <polygon id="parking-048" class="parking-area" data-number="48" points="278.280,683.130 294.240,683.114 294.240,713.774 278.280,713.790"/> <text class="parking-number" x="286.260" y="698.452">48</text> </g> <g id="space-049" class="parking-space" data-number="49" aria-label="Parkimiskoht 49"> <title>Parkimiskoht 49</title> <polygon id="parking-049" class="parking-area" data-number="49" points="262.320,683.147 278.280,683.130 278.280,713.790 262.320,713.807"/> <text class="parking-number" x="270.300" y="698.469">49</text> </g> <g id="space-050" class="parking-space" data-number="50" aria-label="Parkimiskoht 50"> <title>Parkimiskoht 50</title> <polygon id="parking-050" class="parking-area" data-number="50" points="246.360,683.164 262.320,683.147 262.320,713.807 246.360,713.824"/> <text class="parking-number" x="254.340" y="698.485">50</text> </g> <g id="space-051" class="parking-space" data-number="51" aria-label="Parkimiskoht 51"> <title>Parkimiskoht 51</title> <polygon id="parking-051" class="parking-area" data-number="51" points="230.400,683.180 246.360,683.164 246.360,713.824 230.400,713.840"/> <text class="parking-number" x="238.380" y="698.502">51</text> </g> <g id="space-052" class="parking-space" data-number="52" aria-label="Parkimiskoht 52"> <title>Parkimiskoht 52</title> <polygon id="parking-052" class="parking-area" data-number="52" points="214.440,683.197 230.400,683.180 230.400,713.840 214.440,713.857"/> <text class="parking-number" x="222.420" y="698.519">52</text> </g> <g id="space-053" class="parking-space" data-number="53" aria-label="Parkimiskoht 53"> <title>Parkimiskoht 53</title> <polygon id="parking-053" class="parking-area" data-number="53" points="198.480,683.214 214.440,683.197 214.440,713.857 198.480,713.874"/> <text class="parking-number" x="206.460" y="698.535">53</text> </g> <g id="space-054" class="parking-space" data-number="54" aria-label="Parkimiskoht 54"> <title>Parkimiskoht 54</title> <polygon id="parking-054" class="parking-area" data-number="54" points="182.520,683.230 198.480,683.214 198.480,713.874 182.520,713.890"/> <text class="parking-number" x="190.500" y="698.552">54</text> </g> <g id="space-055" class="parking-space" data-number="55" aria-label="Parkimiskoht 55"> <title>Parkimiskoht 55</title> <polygon id="parking-055" class="parking-area" data-number="55" points="166.560,683.247 182.520,683.230 182.520,713.890 166.560,713.907"/> <text class="parking-number" x="174.540" y="698.568">55</text> </g> <g id="space-056" class="parking-space" data-number="56" aria-label="Parkimiskoht 56"> <title>Parkimiskoht 56</title> <polygon id="parking-056" class="parking-area" data-number="56" points="150.600,683.263 166.560,683.247 166.560,713.907 150.600,713.923"/> <text class="parking-number" x="158.580" y="698.585">56</text> </g> <g id="space-057" class="parking-space" data-number="57" aria-label="Parkimiskoht 57"> <title>Parkimiskoht 57</title> <polygon id="parking-057" class="parking-area" data-number="57" points="134.640,683.280 150.600,683.263 150.600,713.923 134.640,713.940"/> <text class="parking-number" x="142.620" y="698.602">57</text> </g> <g id="space-058" class="parking-space" data-number="58" aria-label="Parkimiskoht 58"> <title>Parkimiskoht 58</title> <polygon id="parking-058" class="parking-area" data-number="58" points="111.480,173.880 127.440,173.863 127.440,204.523 111.480,204.540"/> <text class="parking-number" x="119.460" y="189.202">58</text> </g> <g id="space-059" class="parking-space" data-number="59" aria-label="Parkimiskoht 59"> <title>Parkimiskoht 59</title> <polygon id="parking-059" class="parking-area" data-number="59" points="127.440,173.863 143.400,173.847 143.400,204.507 127.440,204.523"/> <text class="parking-number" x="135.420" y="189.185">59</text> </g> <g id="space-060" class="parking-space" data-number="60" aria-label="Parkimiskoht 60"> <title>Parkimiskoht 60</title> <polygon id="parking-060" class="parking-area" data-number="60" points="143.400,173.847 159.360,173.830 159.360,204.490 143.400,204.507"/> <text class="parking-number" x="151.380" y="189.169">60</text> </g> <g id="space-061" class="parking-space" data-number="61" aria-label="Parkimiskoht 61"> <title>Parkimiskoht 61</title> <polygon id="parking-061" class="parking-area" data-number="61" points="159.360,173.830 175.320,173.814 175.320,204.474 159.360,204.490"/> <text class="parking-number" x="167.340" y="189.152">61</text> </g> <g id="space-062" class="parking-space" data-number="62" aria-label="Parkimiskoht 62"> <title>Parkimiskoht 62</title> <polygon id="parking-062" class="parking-area" data-number="62" points="175.320,173.814 191.280,173.797 191.280,204.457 175.320,204.474"/> <text class="parking-number" x="183.300" y="189.136">62</text> </g> <g id="space-063" class="parking-space" data-number="63" aria-label="Parkimiskoht 63"> <title>Parkimiskoht 63</title> <polygon id="parking-063" class="parking-area" data-number="63" points="191.280,173.797 207.240,173.781 207.240,204.441 191.280,204.457"/> <text class="parking-number" x="199.260" y="189.119">63</text> </g> <g id="space-064" class="parking-space" data-number="64" aria-label="Parkimiskoht 64"> <title>Parkimiskoht 64</title> <polygon id="parking-064" class="parking-area" data-number="64" points="207.240,173.781 223.200,173.764 223.200,204.424 207.240,204.441"/> <text class="parking-number" x="215.220" y="189.102">64</text> </g> <g id="space-065" class="parking-space" data-number="65" aria-label="Parkimiskoht 65"> <title>Parkimiskoht 65</title> <polygon id="parking-065" class="parking-area" data-number="65" points="223.200,173.764 239.160,173.748 239.160,204.408 223.200,204.424"/> <text class="parking-number" x="231.180" y="189.086">65</text> </g> <g id="space-066" class="parking-space" data-number="66" aria-label="Parkimiskoht 66"> <title>Parkimiskoht 66</title> <polygon id="parking-066" class="parking-area" data-number="66" points="239.160,173.748 255.120,173.731 255.120,204.391 239.160,204.408"/> <text class="parking-number" x="247.140" y="189.069">66</text> </g> <g id="space-067" class="parking-space" data-number="67" aria-label="Parkimiskoht 67"> <title>Parkimiskoht 67</title> <polygon id="parking-067" class="parking-area" data-number="67" points="255.120,173.731 271.080,173.714 271.080,204.374 255.120,204.391"/> <text class="parking-number" x="263.100" y="189.053">67</text> </g> <g id="space-068" class="parking-space" data-number="68" aria-label="Parkimiskoht 68"> <title>Parkimiskoht 68</title> <polygon id="parking-068" class="parking-area" data-number="68" points="271.080,173.714 287.040,173.698 287.040,204.358 271.080,204.374"/> <text class="parking-number" x="279.060" y="189.036">68</text> </g> <g id="space-069" class="parking-space" data-number="69" aria-label="Parkimiskoht 69"> <title>Parkimiskoht 69</title> <polygon id="parking-069" class="parking-area" data-number="69" points="287.040,173.698 303.000,173.681 303.000,204.341 287.040,204.358"/> <text class="parking-number" x="295.020" y="189.020">69</text> </g> <g id="space-070" class="parking-space" data-number="70" aria-label="Parkimiskoht 70"> <title>Parkimiskoht 70</title> <polygon id="parking-070" class="parking-area" data-number="70" points="303.000,173.681 318.960,173.665 318.960,204.325 303.000,204.341"/> <text class="parking-number" x="310.980" y="189.003">70</text> </g> <g id="space-071" class="parking-space" data-number="71" aria-label="Parkimiskoht 71"> <title>Parkimiskoht 71</title> <polygon id="parking-071" class="parking-area" data-number="71" points="318.960,173.665 334.920,173.648 334.920,204.308 318.960,204.325"/> <text class="parking-number" x="326.940" y="188.987">71</text> </g> <g id="space-072" class="parking-space" data-number="72" aria-label="Parkimiskoht 72"> <title>Parkimiskoht 72</title> <polygon id="parking-072" class="parking-area" data-number="72" points="334.920,173.648 350.880,173.632 350.880,204.292 334.920,204.308"/> <text class="parking-number" x="342.900" y="188.970">72</text> </g> <g id="space-073" class="parking-space" data-number="73" aria-label="Parkimiskoht 73"> <title>Parkimiskoht 73</title> <polygon id="parking-073" class="parking-area" data-number="73" points="350.880,173.632 366.840,173.615 366.840,204.275 350.880,204.292"/> <text class="parking-number" x="358.860" y="188.953">73</text> </g> <g id="space-074" class="parking-space" data-number="74" aria-label="Parkimiskoht 74"> <title>Parkimiskoht 74</title> <polygon id="parking-074" class="parking-area" data-number="74" points="366.840,173.615 382.800,173.599 382.800,204.259 366.840,204.275"/> <text class="parking-number" x="374.820" y="188.937">74</text> </g> <g id="space-075" class="parking-space" data-number="75" aria-label="Parkimiskoht 75"> <title>Parkimiskoht 75</title> <polygon id="parking-075" class="parking-area" data-number="75" points="382.800,173.599 398.760,173.582 398.760,204.242 382.800,204.259"/> <text class="parking-number" x="390.780" y="188.920">75</text> </g> <g id="space-076" class="parking-space" data-number="76" aria-label="Parkimiskoht 76"> <title>Parkimiskoht 76</title> <polygon id="parking-076" class="parking-area" data-number="76" points="398.760,173.582 414.720,173.566 414.720,204.226 398.760,204.242"/> <text class="parking-number" x="406.740" y="188.904">76</text> </g> <g id="space-077" class="parking-space" data-number="77" aria-label="Parkimiskoht 77"> <title>Parkimiskoht 77</title> <polygon id="parking-077" class="parking-area" data-number="77" points="414.720,173.566 430.680,173.549 430.680,204.209 414.720,204.226"/> <text class="parking-number" x="422.700" y="188.887">77</text> </g> <g id="space-078" class="parking-space" data-number="78" aria-label="Parkimiskoht 78"> <title>Parkimiskoht 78</title> <polygon id="parking-078" class="parking-area" data-number="78" points="430.680,173.549 446.640,173.532 446.640,204.192 430.680,204.209"/> <text class="parking-number" x="438.660" y="188.871">78</text> </g> <g id="space-079" class="parking-space" data-number="79" aria-label="Parkimiskoht 79"> <title>Parkimiskoht 79</title> <polygon id="parking-079" class="parking-area" data-number="79" points="446.640,173.532 462.600,173.516 462.600,204.176 446.640,204.192"/> <text class="parking-number" x="454.620" y="188.854">79</text> </g> <g id="space-080" class="parking-space" data-number="80" aria-label="Parkimiskoht 80"> <title>Parkimiskoht 80</title> <polygon id="parking-080" class="parking-area" data-number="80" points="462.600,173.516 478.560,173.499 478.560,204.159 462.600,204.176"/> <text class="parking-number" x="470.580" y="188.838">80</text> </g> <g id="space-081" class="parking-space" data-number="81" aria-label="Parkimiskoht 81"> <title>Parkimiskoht 81</title> <polygon id="parking-081" class="parking-area" data-number="81" points="478.560,173.499 494.520,173.483 494.520,204.143 478.560,204.159"/> <text class="parking-number" x="486.540" y="188.821">81</text> </g> <g id="space-082" class="parking-space" data-number="82" aria-label="Parkimiskoht 82"> <title>Parkimiskoht 82</title> <polygon id="parking-082" class="parking-area" data-number="82" points="494.520,173.483 510.480,173.466 510.480,204.126 494.520,204.143"/> <text class="parking-number" x="502.500" y="188.805">82</text> </g> <g id="space-083" class="parking-space" data-number="83" aria-label="Parkimiskoht 83"> <title>Parkimiskoht 83</title> <polygon id="parking-083" class="parking-area" data-number="83" points="510.480,173.466 526.440,173.450 526.440,204.110 510.480,204.126"/> <text class="parking-number" x="518.460" y="188.788">83</text> </g> <g id="space-084" class="parking-space" data-number="84" aria-label="Parkimiskoht 84"> <title>Parkimiskoht 84</title> <polygon id="parking-084" class="parking-area" data-number="84" points="526.440,173.450 542.400,173.433 542.400,204.093 526.440,204.110"/> <text class="parking-number" x="534.420" y="188.771">84</text> </g> <g id="space-085" class="parking-space" data-number="85" aria-label="Parkimiskoht 85"> <title>Parkimiskoht 85</title> <polygon id="parking-085" class="parking-area" data-number="85" points="542.400,173.433 558.360,173.417 558.360,204.077 542.400,204.093"/> <text class="parking-number" x="550.380" y="188.755">85</text> </g> <g id="space-086" class="parking-space" data-number="86" aria-label="Parkimiskoht 86"> <title>Parkimiskoht 86</title> <polygon id="parking-086" class="parking-area" data-number="86" points="558.360,173.417 574.320,173.400 574.320,204.060 558.360,204.077"/> <text class="parking-number" x="566.340" y="188.738">86</text> </g> <g id="space-087" class="parking-space" data-number="87" aria-label="Parkimiskoht 87"> <title>Parkimiskoht 87</title> <polygon id="parking-087" class="parking-area" data-number="87" points="574.320,173.400 590.280,173.383 590.280,204.043 574.320,204.060"/> <text class="parking-number" x="582.300" y="188.722">87</text> </g> <g id="space-088" class="parking-space" data-number="88" aria-label="Parkimiskoht 88"> <title>Parkimiskoht 88</title> <polygon id="parking-088" class="parking-area" data-number="88" points="590.280,173.383 606.240,173.367 606.240,204.027 590.280,204.043"/> <text class="parking-number" x="598.260" y="188.705">88</text> </g> <g id="space-089" class="parking-space" data-number="89" aria-label="Parkimiskoht 89"> <title>Parkimiskoht 89</title> <polygon id="parking-089" class="parking-area" data-number="89" points="606.240,173.367 622.200,173.350 622.200,204.010 606.240,204.027"/> <text class="parking-number" x="614.220" y="188.689">89</text> </g> <g id="space-090" class="parking-space" data-number="90" aria-label="Parkimiskoht 90"> <title>Parkimiskoht 90</title> <polygon id="parking-090" class="parking-area" data-number="90" points="622.200,173.350 638.160,173.334 638.160,203.994 622.200,204.010"/> <text class="parking-number" x="630.180" y="188.672">90</text> </g> <g id="space-091" class="parking-space" data-number="91" aria-label="Parkimiskoht 91"> <title>Parkimiskoht 91</title> <polygon id="parking-091" class="parking-area" data-number="91" points="638.160,173.334 654.120,173.317 654.120,203.977 638.160,203.994"/> <text class="parking-number" x="646.140" y="188.656">91</text> </g> <g id="space-092" class="parking-space" data-number="92" aria-label="Parkimiskoht 92"> <title>Parkimiskoht 92</title> <polygon id="parking-092" class="parking-area" data-number="92" points="654.120,173.317 670.080,173.301 670.080,203.961 654.120,203.977"/> <text class="parking-number" x="662.100" y="188.639">92</text> </g> <g id="space-093" class="parking-space" data-number="93" aria-label="Parkimiskoht 93"> <title>Parkimiskoht 93</title> <polygon id="parking-093" class="parking-area" data-number="93" points="670.080,173.301 686.040,173.284 686.040,203.944 670.080,203.961"/> <text class="parking-number" x="678.060" y="188.622">93</text> </g> <g id="space-094" class="parking-space" data-number="94" aria-label="Parkimiskoht 94"> <title>Parkimiskoht 94</title> <polygon id="parking-094" class="parking-area" data-number="94" points="686.040,173.284 702.000,173.268 702.000,203.928 686.040,203.944"/> <text class="parking-number" x="694.020" y="188.606">94</text> </g> <g id="space-095" class="parking-space" data-number="95" aria-label="Parkimiskoht 95"> <title>Parkimiskoht 95</title> <polygon id="parking-095" class="parking-area" data-number="95" points="702.000,173.268 717.960,173.251 717.960,203.911 702.000,203.928"/> <text class="parking-number" x="709.980" y="188.589">95</text> </g> <g id="space-096" class="parking-space" data-number="96" aria-label="Parkimiskoht 96"> <title>Parkimiskoht 96</title> <polygon id="parking-096" class="parking-area" data-number="96" points="717.960,173.251 733.920,173.235 733.920,203.895 717.960,203.911"/> <text class="parking-number" x="725.940" y="188.573">96</text> </g> <g id="space-097" class="parking-space" data-number="97" aria-label="Parkimiskoht 97"> <title>Parkimiskoht 97</title> <polygon id="parking-097" class="parking-area" data-number="97" points="733.920,173.235 749.880,173.218 749.880,203.878 733.920,203.895"/> <text class="parking-number" x="741.900" y="188.556">97</text> </g> <g id="space-098" class="parking-space" data-number="98" aria-label="Parkimiskoht 98"> <title>Parkimiskoht 98</title> <polygon id="parking-098" class="parking-area" data-number="98" points="749.880,173.218 765.840,173.201 765.840,203.861 749.880,203.878"/> <text class="parking-number" x="757.860" y="188.540">98</text> </g> <g id="space-099" class="parking-space" data-number="99" aria-label="Parkimiskoht 99"> <title>Parkimiskoht 99</title> <polygon id="parking-099" class="parking-area" data-number="99" points="765.840,173.201 781.800,173.185 781.800,203.845 765.840,203.861"/> <text class="parking-number" x="773.820" y="188.523">99</text> </g> <g id="space-100" class="parking-space" data-number="100" aria-label="Parkimiskoht 100"> <title>Parkimiskoht 100</title> <polygon id="parking-100" class="parking-area" data-number="100" points="781.800,173.185 797.760,173.168 797.760,203.828 781.800,203.845"/> <text class="parking-number" x="789.780" y="188.507">100</text> </g> <g id="space-101" class="parking-space" data-number="101" aria-label="Parkimiskoht 101"> <title>Parkimiskoht 101</title> <polygon id="parking-101" class="parking-area" data-number="101" points="797.760,173.168 813.720,173.152 813.720,203.812 797.760,203.828"/> <text class="parking-number" x="805.740" y="188.490">101</text> </g> <g id="space-102" class="parking-space" data-number="102" aria-label="Parkimiskoht 102"> <title>Parkimiskoht 102</title> <polygon id="parking-102" class="parking-area" data-number="102" points="813.720,173.152 829.680,173.135 829.680,203.795 813.720,203.812"/> <text class="parking-number" x="821.700" y="188.474">102</text> </g> <g id="space-103" class="parking-space" data-number="103" aria-label="Parkimiskoht 103"> <title>Parkimiskoht 103</title> <polygon id="parking-103" class="parking-area" data-number="103" points="829.680,173.135 845.640,173.119 845.640,203.779 829.680,203.795"/> <text class="parking-number" x="837.660" y="188.457">103</text> </g> <g id="space-104" class="parking-space" data-number="104" aria-label="Parkimiskoht 104"> <title>Parkimiskoht 104</title> <polygon id="parking-104" class="parking-area" data-number="104" points="845.640,173.119 861.600,173.102 861.600,203.762 845.640,203.779"/> <text class="parking-number" x="853.620" y="188.440">104</text> </g> <g id="space-105" class="parking-space" data-number="105" aria-label="Parkimiskoht 105"> <title>Parkimiskoht 105</title> <polygon id="parking-105" class="parking-area" data-number="105" points="861.600,173.102 877.560,173.086 877.560,203.746 861.600,203.762"/> <text class="parking-number" x="869.580" y="188.424">105</text> </g> <g id="space-106" class="parking-space" data-number="106" aria-label="Parkimiskoht 106"> <title>Parkimiskoht 106</title> <polygon id="parking-106" class="parking-area" data-number="106" points="877.560,173.086 893.520,173.069 893.520,203.729 877.560,203.746"/> <text class="parking-number" x="885.540" y="188.407">106</text> </g> <g id="space-107" class="parking-space" data-number="107" aria-label="Parkimiskoht 107"> <title>Parkimiskoht 107</title> <polygon id="parking-107" class="parking-area" data-number="107" points="893.520,173.069 909.480,173.052 909.480,203.712 893.520,203.729"/> <text class="parking-number" x="901.500" y="188.391">107</text> </g> <g id="space-108" class="parking-space" data-number="108" aria-label="Parkimiskoht 108"> <title>Parkimiskoht 108</title> <polygon id="parking-108" class="parking-area" data-number="108" points="909.480,173.052 925.440,173.036 925.440,203.696 909.480,203.712"/> <text class="parking-number" x="917.460" y="188.374">108</text> </g> <g id="space-109" class="parking-space" data-number="109" aria-label="Parkimiskoht 109"> <title>Parkimiskoht 109</title> <polygon id="parking-109" class="parking-area" data-number="109" points="925.440,173.036 941.400,173.019 941.400,203.679 925.440,203.696"/> <text class="parking-number" x="933.420" y="188.358">109</text> </g> <g id="space-110" class="parking-space" data-number="110" aria-label="Parkimiskoht 110"> <title>Parkimiskoht 110</title> <polygon id="parking-110" class="parking-area" data-number="110" points="941.400,173.019 957.360,173.003 957.360,203.663 941.400,203.679"/> <text class="parking-number" x="949.380" y="188.341">110</text> </g> <g id="space-111" class="parking-space" data-number="111" aria-label="Parkimiskoht 111"> <title>Parkimiskoht 111</title> <polygon id="parking-111" class="parking-area" data-number="111" points="957.360,173.003 973.320,172.986 973.320,203.646 957.360,203.663"/> <text class="parking-number" x="965.340" y="188.325">111</text> </g> <g id="space-112" class="parking-space" data-number="112" aria-label="Parkimiskoht 112"> <title>Parkimiskoht 112</title> <polygon id="parking-112" class="parking-area" data-number="112" points="973.320,172.986 989.280,172.970 989.280,203.630 973.320,203.646"/> <text class="parking-number" x="981.300" y="188.308">112</text> </g> <g id="space-113" class="parking-space" data-number="113" aria-label="Parkimiskoht 113"> <title>Parkimiskoht 113</title> <polygon id="parking-113" class="parking-area" data-number="113" points="989.280,172.970 1005.240,172.953 1005.240,203.613 989.280,203.630"/> <text class="parking-number" x="997.260" y="188.291">113</text> </g> <g id="space-114" class="parking-space" data-number="114" aria-label="Parkimiskoht 114"> <title>Parkimiskoht 114</title> <polygon id="parking-114" class="parking-area" data-number="114" points="1005.240,172.953 1021.200,172.937 1021.200,203.597 1005.240,203.613"/> <text class="parking-number" x="1013.220" y="188.275">114</text> </g> <g id="space-115" class="parking-space" data-number="115" aria-label="Parkimiskoht 115"> <title>Parkimiskoht 115</title> <polygon id="parking-115" class="parking-area" data-number="115" points="1021.200,172.937 1037.040,172.920 1037.040,203.580 1021.200,203.597"/> <text class="parking-number" x="1029.120" y="188.258">115</text> </g> </g> <g id="building"><title>Hoone</title><polygon id="building-outline" points="729.240,289.800 729.240,295.680 603.360,295.800 603.360,289.921 582.000,289.921 582.000,295.800 456.000,296.041 456.000,290.040 434.639,290.160 434.639,296.041 156.600,296.280 156.960,591.359 434.999,591.121 434.999,597.001 456.360,597.001 456.360,591.121 582.240,591.000 582.240,596.880 603.599,596.760 603.599,590.881 729.599,590.760 729.599,596.640 750.960,596.640 750.960,590.760 980.880,590.520 980.880,590.640 1029.120,590.640 1028.999,454.920 1028.880,430.920 1028.759,295.200 980.519,295.321 980.519,295.440 750.600,295.680 750.600,289.800 729.240,289.800" fill="#343635" stroke="#212322" stroke-width="1.2" stroke-linejoin="round"/> <image id="t6b-logo" x="544" y="400" width="96" height="64" preserveAspectRatio="xMidYMid meet" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAASwAAADICAYAAABS39xVAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAACvhJREFUeNrs3U+InOUdB/Cx2lq6Sym0mEsPzcZLWwy9deNFiwoFD1lRL4kgCqZFiSKF4iFJUfcgheIhVEw8BMF4NTkIBQ305KaHQlmxvTRrLz3EHlrIrkWktfMdd9q0jWYzeZ933vd5Px8YAjnM7Lwz73d+z/8bRi3652+//L3xP18bAczgppZf78Xx406XHZjFF1wCQGABCCxAYAEILACBBQgsAIEFILAAgQUgsAAEFiCwAAQWgMACBBaAwAIQWIDAAhBYAAILEFgAAgtAYAECC0BgAWy7YfetS5+09WLf/tbHo69+5RNXHSpx/50fju6/48PWXu+mNt/cH/70RZ8wVGT5ux9pEgIILEBgAQgsAIEFCCwAgQUgsACBBSCwAIEFILAABBYgsAAEFoDAAgQWgMACEFiAwAIQWAACCxBYAAILQGABAgtAYAEILEBgAQgsAIEFCCwAgQUgsACBBSCwAAQWILAABBYgsAAEFoDAAgbnprZf8P47Phx985Z/uPI7cP69m0e/+f2X5v533Ld//2hhcbHY86+trY0ubGxc13Pcc/fdo127dvX2s15fXx9tjK/B5taWL36nAuvOv4++/52PXPkdmndg/eTppydhUMpbb7993WE1Day9t93W3w/6wIHJPwmt9XffHb1x9uzo4sWLboB5Bxb90UZY/eLFF13oyywtLU0eK+OqNsH12unTk3/5lD4s5hJWJ06eFFZXkYrx5y+8MPksFhcWXBCBxTzCKkGVJg87b+6+eupUv5u8Aou+hlWaglybhXGFlWqr5GcjsBBWwqpXn5HAwo0grISWwKIPN8DW1tboicOHhVWBz2zP0pLAQlg1GVY/feaZRuZZ8f+OHTkyuNFDgSWshFVPZWb/ysqKwEJYCat+eOjAgV4vSRJYzDWsspxEWLUraz0FFsLqGmUdXDrYhVW7hjRiKLCEVWNhlcrKbgPty6TS2/ftE1gIK2HVD/uWlwUWwkpY9cNQ1hm2vr3MgWe/3tprPfXgpdGTD1xq+O//Ric21etCWGXjvcxgrzWsfnjvvY08T+ZKZcuYfA5pui0UmDs1lJFCFZbKaiaZuf7s6qrKagdyjbKnVcL98cOHi+1vNYQqS2AJq5nCyl5Ws5lO+7BUSWAhrHoj13DD9A+BJayEVV+8fPKkiyCwhFUJtjRuXvqyVFkCS1gVaL7Y0riMd86fb+y5tgYwACKwhNVVw0oHcTlNHuU1hCVRAktYCasKDKVp6VzCHnvo4MGiW8RMJjouL48uvP/+v6uBPJyT15ymJnxeEFh0WcLkoe3TgkvIbOzpRMR9V1hYOw2u6cMpxbO5vaE1gGsN9oUJLBoPqzQF510Z3JPHdoWXJkk6kNOEFF47v4ZLDezLnmr4nbU1gUX35OCBeYfVlUyPWE/Vl4rrzNmzg7mJZtXU5zikEVyB1SOL24dpdl2aknmk0nrt9dd13H9GWDWx9i/V1ZkzZwZz3YwS9sixo0eLrPQv2eTJjfnS8eOOWb/sR6fJkd1UV0NagK7C6omMCPb1pk9TMZVhmomvnT49yB0eEt7pYF/Zv7+xkcH0G+Z6DonA6smXveSIYFtys2ZnzOdWV3sxDP+rN9/s7N+WpuAQl0ppEvZAFzvZryd8fzluIg71qPWmZOH0EA/7EFgdlx0qa+z/SQinmcu1G/IKBIHVcT967LFq31uauTVVj8KqPH1YHZZmU+17dec9pj/G3lCfL1NE+tL3J7AGqoaO9p1IZ3xuRPO1rmzIo6sCqyfSbzWUk1AiTcMM0zs1+j8S4Jl4a6mTwOpFU2lojh05MjnqfsiVxMZ2pZl1mYJKYPVCZkPPI7Bys+QmmW4ns+uWWyZVXlujlJP5ZgcPDrY/a7rzxcLi4uTaCyyB1QtX2s6l5E2SX/Qcivp5lU2mV9xz113F/7b0Z2W5yRBv1ukazInt/st8Lqm2rvb5CCzm+sVto5pKJbPTzfiy80Ie0/WBJf/GPH/O7uPTH688tg4dmgR5FjoPObjMw+qg2wtXMamoZj2BeHoQ6ImCzbahDTjsRBa9Z9T41VOnin8/BBY7lv2uSu7IkImHTaxBy699ybVsQ5nSMUtwZXDiZ+PHYo927hBYlWpiB8rPkvk8Tc51Knmw6pCriJ02FbMDxtBCS2B1TKmmUJp/JUbfElpnCux4mUpCaF39x21ooSWwOqZUZ3bJPqfMwi5xiKdN/4TW/zJK2DElvnipgkrOIM+oVfq0mu53mndgNXmcWcn3srS9z/+zq6sCi/Z/MZvWxhFQCcWmA6tkf95OND21Ik3czDMrEV7p08rz137whyZh5do6AirTHUqcPrxnzqHVpHwOJaeEpMqqvWkosCrX5mLiEidCL1R4A5aaEpJrtbKyIrDorzaXuFg6cm1N6LUCle994yZnzVWWwKo9sD74wEXoqJdfeaVIlbWv4ukgAqtye3bvdhE6XP2WqLJq3ppIYFUuW5W0JVuicG2mW/k0KaOQtTYLBVbl2vzylhiur71Ju1FoUGSpotFVgdVhJUba2ujTyJKiEsuKat8Xq1RVunfvXoFFP39x2+jTKLG7Qonw7lxgFVo7qklIK0rMm/qvnSwL3XQlQnEIgbVveVmTUGD111qhWeklZ0GXOgx1rfJlJjYqFFi9l8mXJW7U3BjHjh4tElZFOttzGEbFR37lx8Op1wKrCu8UWqycYGmy0spzleofe+vcuarDKlvCqK4EVhWybKPU6FgC5npvltxw2aK3ZGd+radA50cj1790H1Ot/X+2l+monPhbqsmQm+Wl48dnOoUlIfXjQ4eKLkouGdjXGi5NNslz7dra42trc1Ng0W6VlakCpZoN01NYslg2255kz6z19fUrhldusuy1lBGt0s2YbIdzoiMHqaYS6qta+/8EVodlC5LSN83C9inT0+ZdAmP6ZZ+e/NxqZXn6tF0fGgj9WpuE+rA6LF+6Egc8XC3ApvO22g6rvN83Wn6/VX5vxpVyrQRWx+Wkm42Kh/cvrwqee/55H3gT3QkVj7AKrB7ItrpbFTeT8t7yHjUFr18GK2re111g9cDm9g1da2ilirwwgCqyDRldrpnA6onc0DWGVgYWap1zNY/qqvZrKbCE1tyagc+trgqrhsO/dgKrh6H18COP9LojPpVAgrf2M/TabgoOYXcLgdVD6dN6/PDh1qc8NCELu58Y/+36rJqTKjXz14bAxNEeS2d1qpQs4en6Qto0AdNkUVU1H1ZDaAqqsCqRZsDDjz46aRJ0tW8rlWCascJKWKmwmEiTIAuZc/Jv1gd24cTkSVNlHKS178s+D1lvOcRVAQKrIunbmgZX1gaujIOr7abiZGj93LnO7LhQY0V9YsDz1gRWpcGVX9889iwtTcKr5E4LCabcSNnxQbOvXFDlx2gII4ECa8DyS3xh/IucDvoEVhY1J8SyJ9asezNlSkWeN//mBjLiV0aub3afVa0OJLDOv3dz48/557/c2NvrMWmu5XHZ/2X30OnulwmyK50UPV39n0NNu3rj5KauofpISG1ubg6+kvosN+y+dekTlwGYxVMPXho9+cCl1l7PtAagNwQWILAABBYgsAAEFoDAAgQWgMACEFiAwAIQWAACCxBYAAILQGABAgtgnuzpDszs4l9v/Nv4n9+19Xq2SAaux6/f/+PGDzQJAQQWILAABBaAwAIEFoDAAgQWgMACEFiAwAIQWAACCxBYAAILQGABAgtAYAEILEBgAQgsAIEFCCwAgQUgsIBq/EuAAQBd/bb0Yg2plwAAAABJRU5ErkJggg=="><title>T6B · Taevavärava</title></image> <text x="592" y="484" text-anchor="middle" fill="#D9D8D6" font-size="9">Taevavärava tee 6b</text></g> <g id="vehicle-doors"> <g id="unit-01" data-unit="1" data-side="bottom" aria-label="Pind 1, tõste-sissesõiduuks"><title>Pind 1 — tõste-sissesõiduuks</title><path id="door-01" class="door-mark" transform="translate(925.020 592.573) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="925.020" y="573.573">Pind 1</text></g> <g id="unit-02" data-unit="2" data-side="bottom" aria-label="Pind 2, tõste-sissesõiduuks"><title>Pind 2 — tõste-sissesõiduuks</title><path id="door-02" class="door-mark" transform="translate(883.320 592.615) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="883.320" y="573.615">Pind 2</text></g> <g id="unit-03" data-unit="3" data-side="bottom" aria-label="Pind 3, tõste-sissesõiduuks"><title>Pind 3 — tõste-sissesõiduuks</title><path id="door-03" class="door-mark" transform="translate(837.180 592.663) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="837.180" y="573.663">Pind 3</text></g> <g id="unit-04" data-unit="4" data-side="bottom" aria-label="Pind 4, tõste-sissesõiduuks"><title>Pind 4 — tõste-sissesõiduuks</title><path id="door-04" class="door-mark" transform="translate(795.900 592.705) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="795.900" y="573.705">Pind 4</text></g> <g id="unit-05" data-unit="5" data-side="bottom" aria-label="Pind 5, tõste-sissesõiduuks"><title>Pind 5 — tõste-sissesõiduuks</title><path id="door-05" class="door-mark" transform="translate(685.440 592.818) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="685.440" y="573.818">Pind 5</text></g> <g id="unit-06" data-unit="6" data-side="bottom" aria-label="Pind 6, tõste-sissesõiduuks"><title>Pind 6 — tõste-sissesõiduuks</title><path id="door-06" class="door-mark" transform="translate(648.600 592.856) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="648.600" y="573.856">Pind 6</text></g> <g id="unit-07" data-unit="7" data-side="bottom" aria-label="Pind 7, tõste-sissesõiduuks"><title>Pind 7 — tõste-sissesõiduuks</title><path id="door-07" class="door-mark" transform="translate(538.140 592.969) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="538.140" y="573.969">Pind 7</text></g> <g id="unit-08" data-unit="8" data-side="bottom" aria-label="Pind 8, tõste-sissesõiduuks"><title>Pind 8 — tõste-sissesõiduuks</title><path id="door-08" class="door-mark" transform="translate(501.300 593.007) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="501.300" y="574.007">Pind 8</text></g> <g id="unit-09" data-unit="9" data-side="bottom" aria-label="Pind 9, tõste-sissesõiduuks"><title>Pind 9 — tõste-sissesõiduuks</title><path id="door-09" class="door-mark" transform="translate(390.840 593.120) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="390.840" y="574.120">Pind 9</text></g> <g id="unit-10" data-unit="10" data-side="bottom" aria-label="Pind 10, tõste-sissesõiduuks"><title>Pind 10 — tõste-sissesõiduuks</title><path id="door-10" class="door-mark" transform="translate(349.320 593.163) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="349.320" y="574.163">Pind 10</text></g> <g id="unit-11" data-unit="11" data-side="bottom" aria-label="Pind 11, tõste-sissesõiduuks"><title>Pind 11 — tõste-sissesõiduuks</title><path id="door-11" class="door-mark" transform="translate(303.180 593.210) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="303.180" y="574.210">Pind 11</text></g> <g id="unit-12" data-unit="12" data-side="bottom" aria-label="Pind 12, tõste-sissesõiduuks"><title>Pind 12 — tõste-sissesõiduuks</title><path id="door-12" class="door-mark" transform="translate(257.040 593.257) rotate(180)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="257.040" y="574.257">Pind 12</text></g> <g id="unit-13" data-unit="13" data-side="left" aria-label="Pind 13, tõste-sissesõiduuks"><title>Pind 13 — tõste-sissesõiduuks</title><path id="door-13" class="door-mark" transform="translate(156.928 565.440) rotate(-90)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" style="text-anchor:start" x="174.928" y="565.440">Pind 13</text></g> <g id="unit-14" data-unit="14" data-side="left" aria-label="Pind 14, tõste-sissesõiduuks"><title>Pind 14 — tõste-sissesõiduuks</title><path id="door-14" class="door-mark" transform="translate(156.868 516.120) rotate(-90)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" style="text-anchor:start" x="174.868" y="516.120">Pind 14</text></g> <g id="unit-15" data-unit="15" data-side="left" aria-label="Pind 15, tõste-sissesõiduuks"><title>Pind 15 — tõste-sissesõiduuks</title><path id="door-15" class="door-mark" transform="translate(156.809 467.940) rotate(-90)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" style="text-anchor:start" x="174.809" y="467.940">Pind 15</text></g> <g id="unit-16" data-unit="16" data-side="left" aria-label="Pind 16, tõste-sissesõiduuks"><title>Pind 16 — tõste-sissesõiduuks</title><path id="door-16" class="door-mark" transform="translate(156.751 419.760) rotate(-90)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" style="text-anchor:start" x="174.751" y="419.760">Pind 16</text></g> <g id="unit-17" data-unit="17" data-side="left" aria-label="Pind 17, tõste-sissesõiduuks"><title>Pind 17 — tõste-sissesõiduuks</title><path id="door-17" class="door-mark" transform="translate(156.692 371.580) rotate(-90)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" style="text-anchor:start" x="174.692" y="371.580">Pind 17</text></g> <g id="unit-18" data-unit="18" data-side="left" aria-label="Pind 18, tõste-sissesõiduuks"><title>Pind 18 — tõste-sissesõiduuks</title><path id="door-18" class="door-mark" transform="translate(156.632 322.260) rotate(-90)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" style="text-anchor:start" x="174.632" y="322.260">Pind 18</text></g> <g id="unit-19" data-unit="20" data-side="top" aria-label="Pind 20, tõste-sissesõiduuks"><title>Pind 20 — tõste-sissesõiduuks</title><path id="door-19" class="door-mark" transform="translate(256.680 294.177) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="256.680" y="314.177">Pind 20</text></g> <g id="unit-20" data-unit="20" data-side="top" aria-label="Pind 20, tõste-sissesõiduuks"><title>Pind 20 — tõste-sissesõiduuks</title><path id="door-20" class="door-mark" transform="translate(302.820 294.130) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="302.820" y="314.130">Pind 20</text></g> <g id="unit-21" data-unit="21" data-side="top" aria-label="Pind 21, tõste-sissesõiduuks"><title>Pind 21 — tõste-sissesõiduuks</title><path id="door-21" class="door-mark" transform="translate(348.960 294.083) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="348.960" y="314.083">Pind 21</text></g> <g id="unit-22" data-unit="22" data-side="top" aria-label="Pind 22, tõste-sissesõiduuks"><title>Pind 22 — tõste-sissesõiduuks</title><path id="door-22" class="door-mark" transform="translate(390.480 294.040) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="390.480" y="314.040">Pind 22</text></g> <g id="unit-23" data-unit="23" data-side="top" aria-label="Pind 23, tõste-sissesõiduuks"><title>Pind 23 — tõste-sissesõiduuks</title><path id="door-23" class="door-mark" transform="translate(500.940 293.927) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="500.940" y="313.927">Pind 23</text></g> <g id="unit-24" data-unit="24" data-side="top" aria-label="Pind 24, tõste-sissesõiduuks"><title>Pind 24 — tõste-sissesõiduuks</title><path id="door-24" class="door-mark" transform="translate(537.780 293.889) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="537.780" y="313.889">Pind 24</text></g> <g id="unit-25" data-unit="25" data-side="top" aria-label="Pind 25, tõste-sissesõiduuks"><title>Pind 25 — tõste-sissesõiduuks</title><path id="door-25" class="door-mark" transform="translate(648.240 293.776) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="648.240" y="313.776">Pind 25</text></g> <g id="unit-26" data-unit="26" data-side="top" aria-label="Pind 26, tõste-sissesõiduuks"><title>Pind 26 — tõste-sissesõiduuks</title><path id="door-26" class="door-mark" transform="translate(685.080 293.738) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="685.080" y="313.738">Pind 26</text></g> <g id="unit-27" data-unit="27" data-side="top" aria-label="Pind 27, tõste-sissesõiduuks"><title>Pind 27 — tõste-sissesõiduuks</title><path id="door-27" class="door-mark" transform="translate(795.540 293.625) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="795.540" y="313.625">Pind 27</text></g> <g id="unit-28" data-unit="28" data-side="top" aria-label="Pind 28, tõste-sissesõiduuks"><title>Pind 28 — tõste-sissesõiduuks</title><path id="door-28" class="door-mark" transform="translate(836.820 293.583) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="836.820" y="313.583">Pind 28</text></g> <g id="unit-29" data-unit="29" data-side="top" aria-label="Pind 29, tõste-sissesõiduuks"><title>Pind 29 — tõste-sissesõiduuks</title><path id="door-29" class="door-mark" transform="translate(882.960 293.535) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="882.960" y="313.535">Pind 29</text></g> <g id="unit-30" data-unit="30" data-side="top" aria-label="Pind 30, tõste-sissesõiduuks"><title>Pind 30 — tõste-sissesõiduuks</title><path id="door-30" class="door-mark" transform="translate(924.660 293.493) rotate(0)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/><text class="unit-label" x="924.660" y="313.493">Pind 30</text></g> </g> <g id="legend" font-size="8" fill="#737678"> <rect x="101" y="744" width="11" height="8" rx="1" fill="#D9D8D6"/> <text x="118" y="751">Asfalt</text> <rect x="169" y="744" width="7" height="11" fill="#fafafa" stroke="#888b8d" stroke-width=".6"/> <text x="183" y="752">Parkimiskoht</text> <path class="door-mark" transform="translate(283 755) scale(.7)" d="M-6.5-13.5 0-7 6.5-13.5V-6.5L0 0-6.5-6.5Z"/> <text x="296" y="752">Tõste-sissesõiduuks</text> <use href="#accessible-symbol" transform="translate(425 750)" color="#343635"/> <text x="437" y="752">Ligipääsetav koht</text> <text x="1129" y="752" text-anchor="end" font-size="7">Alus: P_29_parkimine.pdf · Lihtsustatud plaan</text> </g> </svg>` };
/* registri muudatused (koht kasutusest väljas, märkus) — salvestatakse: { "obj-t6b:65": { blokk, markus } } */
const PARK_MUUD = {};
/* v660: parkimisregister hoone kaupa { objId: [{ nr, tsoon, tyyp, uld }] } — plaaniga hoonel vaikimisi plaanist (app.js parkReg) */
const PARK_REG = {};
/* v586: maja parkimiskohtade VAIKEJAOTUS (t6b-parkimine.xlsx): iga pinna kohad on SPACES[].parkKohad (pakkumine ja leping
   võtavad need vaikimisi, ümber saab määrata plaanilt); üldkasutatavad rühmad siin — neid üürnikule ei määrata */
const PARK_ERI = { "obj-t6b": { elekter: [31, 32, 84, 85], inva: [1, 2], reserv: [49, 62, 63] } };

/* --- Pinnad / üüripinnad --------------------------------------------------
   PÄRIS pinnad t6b.ee kodulehelt (loetud 23.09.2026): 29 pinda (Pind 1–18, 20–30; Pind 19 puudub)
   + 5 bürood (B1–B5), kokku 7775,3 m². Kogupind = üüripind.
   jaotus = kodulehe osad (ladu/kontor/müügisaal/olmeala/ühisala), summa = yyripind.
   hind = kodulehe hinnaastmed (S <120 m² 10 € · M 120–200 8 € · L 200–400 7,5 € · XL 400+ 7 € · bürood 10 €),
   Pind 29 = päris lepingu 7,60 €. elekter = hinnang pinna suuruse järgi (kodulehel pole).
   Staatus: kodulehel „Hõivatud" → Üüritud (üürnikku ei avalikustata → tenant null). Päris vabad on 2, 4, 5, 6, 22 —
   demo pakkumised elavad nendel (2 ONRY · 4 Killa · 5 Maatrans · 6 MR Safe · 22 Future Invest mustand).
   vabanes = kodulehe „vabaneb" kuupäev (4, 5, 6) — täituvuse ajalugu loeb pinna selle kuupäevani hõivatuks.
   plaanFail (v549) = pinna oma plaan (valitud pind kollasena) — lisad/pinnad/, tehtud pindade-plaanid/*.svg-st; sama nime .png = eelvaade. */
const SPACES_SEED = "t6b-2026-09-25c";   /* v602: pinna olek tuleb dokumentidest — lepinguta pind on Vaba, import märgib Üüritud */
/* v595: demo lood on pindadel 2, 4, 5, 6, 22 — ainsad, millele päris üürilepingut pole (Üürileping/) */
const SPACES = [
  { id: "p1", nr: 1, plaanFail: "lisad/pinnad/T6B_Pind_01.pdf", nimi: "Pind 1", tyyp: "Ladu + müügisaal", yyripind: 509.6, hind: 7.00, elekter: 63, parkimine: 6, parkKohad: [6, 7, 8, 9, 45, 46], plaan: "T6B_Pind_1.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 238.3 }, { osa: "Müügisaal", m2: 168.5 }, { osa: "Olmeala", m2: 28.5 }, { osa: "Ühisala", m2: 74.3 }] },
  { id: "p2", nr: 2, plaanFail: "lisad/pinnad/T6B_Pind_02.pdf", nimi: "Pind 2", tyyp: "Ladu", yyripind: 174.8, hind: 8.00, elekter: 32, parkimine: 2, parkKohad: [15, 47], plaan: "T6B_Pind_2.pdf", staatus: "Pakkumisel", tenant: "Osaühing ONRY",
    jaotus: [{ osa: "Ladu", m2: 170.9 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.7 }] },
  { id: "p3", nr: 3, plaanFail: "lisad/pinnad/T6B_Pind_03.pdf", nimi: "Pind 3", tyyp: "Ladu", yyripind: 182.4, hind: 8.00, elekter: 32, parkimine: 2, parkKohad: [16, 48], plaan: "T6B_Pind_3.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 178.5 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.7 }] },
  { id: "p4", nr: 4, plaanFail: "lisad/pinnad/T6B_Pind_04.pdf", nimi: "Pind 4", tyyp: "Ladu + kontor", yyripind: 339.8, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [17, 18, 19, 20], plaan: "T6B_Pind_4.pdf", staatus: "Pakkumisel", tenant: "Killa Distribution OÜ", vabanes: "31.05.2026",
    jaotus: [{ osa: "Ladu", m2: 248.0 }, { osa: "Kontor", m2: 58.6 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.0 }] },
  { id: "p5", nr: 5, plaanFail: "lisad/pinnad/T6B_Pind_05.pdf", nimi: "Pind 5", tyyp: "Ladu + kontor", yyripind: 346.5, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [21, 22, 23, 24], plaan: "T6B_Pind_5.pdf", staatus: "Pakkumisel", tenant: "Osaühing Maatrans", vabanes: "31.05.2026",
    jaotus: [{ osa: "Ladu", m2: 254.1 }, { osa: "Kontor", m2: 59.2 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.0 }] },
  { id: "p6", nr: 6, plaanFail: "lisad/pinnad/T6B_Pind_06.pdf", nimi: "Pind 6", tyyp: "Ladu + kontor", yyripind: 355.2, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [25, 26, 27, 28], plaan: "T6B_Pind_6.pdf", staatus: "Pakkumisel", tenant: "MR Safe OÜ", vabanes: "31.05.2026",
    jaotus: [{ osa: "Ladu", m2: 262.7 }, { osa: "Kontor", m2: 59.2 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.1 }] },
  { id: "p7", nr: 7, plaanFail: "lisad/pinnad/T6B_Pind_07.pdf", nimi: "Pind 7", tyyp: "Ladu + kontor", yyripind: 339.6, hind: 7.50, elekter: 40, parkimine: 3, parkKohad: [29, 30, 33], plaan: "T6B_Pind_7.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 247.2 }, { osa: "Kontor", m2: 59.2 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.0 }] },
  { id: "p8", nr: 8, plaanFail: "lisad/pinnad/T6B_Pind_08.pdf", nimi: "Pind 8", tyyp: "Ladu + kontor", yyripind: 355.2, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [34, 35, 36, 37], plaan: "T6B_Pind_8.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 262.7 }, { osa: "Kontor", m2: 59.2 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.1 }] },
  { id: "p9", nr: 9, plaanFail: "lisad/pinnad/T6B_Pind_09.pdf", nimi: "Pind 9", tyyp: "Ladu + kontor", yyripind: 339.7, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [38, 39, 40, 41], plaan: "T6B_Pind_9.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 247.9 }, { osa: "Kontor", m2: 58.6 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.0 }] },
  { id: "p10", nr: 10, plaanFail: "lisad/pinnad/T6B_Pind_10.pdf", nimi: "Pind 10", tyyp: "Ladu", yyripind: 173.7, hind: 8.00, elekter: 32, parkimine: 2, parkKohad: [50, 51], plaan: "T6B_Pind_10.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 169.8 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.7 }] },
  { id: "p11", nr: 11, plaanFail: "lisad/pinnad/T6B_Pind_11.pdf", nimi: "Pind 11", tyyp: "Ladu", yyripind: 174.8, hind: 8.00, elekter: 32, parkimine: 2, parkKohad: [52, 53], plaan: "T6B_Pind_11.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 170.9 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.7 }] },
  { id: "p12", nr: 12, plaanFail: "lisad/pinnad/T6B_Pind_12.pdf", nimi: "Pind 12", tyyp: "Ladu", yyripind: 177.8, hind: 8.00, elekter: 32, parkimine: 2, parkKohad: [54, 55], plaan: "T6B_Pind_12.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 173.8 }, { osa: "Olmeala", m2: 3.3 }, { osa: "Ühisala", m2: 0.7 }] },
  { id: "p13", nr: 13, plaanFail: "lisad/pinnad/T6B_Pind_13.pdf", nimi: "Pind 13", tyyp: "Ladu", yyripind: 64.5, hind: 10.00, elekter: 25, parkimine: 1, parkKohad: [56], plaan: "T6B_Pind_13.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 60.5 }, { osa: "Olmeala", m2: 3.7 }, { osa: "Ühisala", m2: 0.3 }] },
  { id: "p14", nr: 14, plaanFail: "lisad/pinnad/T6B_Pind_14.pdf", nimi: "Pind 14", tyyp: "Ladu", yyripind: 105.2, hind: 10.00, elekter: 25, parkimine: 1, parkKohad: [57], plaan: "T6B_Pind_14.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 101.6 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.4 }] },
  { id: "p15", nr: 15, plaanFail: "lisad/pinnad/T6B_Pind_15.pdf", nimi: "Pind 15", tyyp: "Ladu", yyripind: 105.2, hind: 10.00, elekter: 25, parkimine: 1, parkKohad: [58], plaan: "T6B_Pind_15.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 101.6 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.4 }] },
  { id: "p16", nr: 16, plaanFail: "lisad/pinnad/T6B_Pind_16.pdf", nimi: "Pind 16", tyyp: "Ladu", yyripind: 105.2, hind: 10.00, elekter: 25, parkimine: 1, parkKohad: [59], plaan: "T6B_Pind_16.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 101.6 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.4 }] },
  { id: "p17", nr: 17, plaanFail: "lisad/pinnad/T6B_Pind_17.pdf", nimi: "Pind 17", tyyp: "Ladu", yyripind: 105.2, hind: 10.00, elekter: 25, parkimine: 1, parkKohad: [60], plaan: "T6B_Pind_17.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 101.6 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.4 }] },
  { id: "p18", nr: 18, plaanFail: "lisad/pinnad/T6B_Pind_18.pdf", nimi: "Pind 18", tyyp: "Ladu", yyripind: 74.0, hind: 10.00, elekter: 25, parkimine: 1, parkKohad: [61], plaan: "T6B_Pind_18.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 70.5 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.3 }] },
  { id: "p20", nr: 20, plaanFail: "lisad/pinnad/T6B_Pind_20.pdf", nimi: "Pind 20", tyyp: "Ladu", yyripind: 355.6, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [66, 67, 68, 69], plaan: "T6B_Pind_20.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 347.7 }, { osa: "Olmeala", m2: 6.5 }, { osa: "Ühisala", m2: 1.4 }] },
  { id: "p21", nr: 21, plaanFail: "lisad/pinnad/T6B_Pind_21.pdf", nimi: "Pind 21", tyyp: "Ladu", yyripind: 173.7, hind: 8.00, elekter: 32, parkimine: 2, parkKohad: [73, 74], plaan: "T6B_Pind_21.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 169.8 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.7 }] },
  { id: "p22", nr: 22, plaanFail: "lisad/pinnad/T6B_Pind_22.pdf", nimi: "Pind 22", tyyp: "Ladu + kontor", yyripind: 339.7, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [75, 76, 77, 78], plaan: "T6B_Pind_22.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 247.9 }, { osa: "Kontor", m2: 58.6 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.0 }] },
  { id: "p23", nr: 23, plaanFail: "lisad/pinnad/T6B_Pind_23.pdf", nimi: "Pind 23", tyyp: "Ladu + kontor", yyripind: 355.2, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [79, 80, 81, 82], plaan: "T6B_Pind_23.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 262.7 }, { osa: "Kontor", m2: 59.2 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.1 }] },
  { id: "p24", nr: 24, plaanFail: "lisad/pinnad/T6B_Pind_24.pdf", nimi: "Pind 24", tyyp: "Ladu + kontor", yyripind: 317.5, hind: 7.50, elekter: 40, parkimine: 3, parkKohad: [83, 86, 87], plaan: "T6B_Pind_24.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 225.2 }, { osa: "Kontor", m2: 59.2 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 17.9 }] },
  { id: "p25", nr: 25, plaanFail: "lisad/pinnad/T6B_Pind_25.pdf", nimi: "Pind 25", tyyp: "Ladu + kontor", yyripind: 355.2, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [88, 89, 90, 91], plaan: "T6B_Pind_25.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 262.7 }, { osa: "Kontor", m2: 59.2 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.1 }] },
  { id: "p26", nr: 26, plaanFail: "lisad/pinnad/T6B_Pind_26.pdf", nimi: "Pind 26", tyyp: "Ladu + kontor", yyripind: 346.5, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [92, 93, 94, 95], plaan: "T6B_Pind_26.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 254.1 }, { osa: "Kontor", m2: 59.2 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.0 }] },
  { id: "p27", nr: 27, plaanFail: "lisad/pinnad/T6B_Pind_27.pdf", nimi: "Pind 27", tyyp: "Ladu + kontor", yyripind: 339.8, hind: 7.50, elekter: 40, parkimine: 4, parkKohad: [96, 97, 98, 99], plaan: "T6B_Pind_27.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 248.0 }, { osa: "Kontor", m2: 58.6 }, { osa: "Olmeala", m2: 15.2 }, { osa: "Ühisala", m2: 18.0 }] },
  { id: "p28", nr: 28, plaanFail: "lisad/pinnad/T6B_Pind_28.pdf", nimi: "Pind 28", tyyp: "Ladu", yyripind: 182.4, hind: 8.00, elekter: 32, parkimine: 2, parkKohad: [64, 100], plaan: "T6B_Pind_28.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 178.5 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.7 }] },
  { id: "p29", nr: 29, plaanFail: "lisad/pinnad/T6B_Pind_29.pdf", nimi: "Pind 29", tyyp: "Ladu / tootmine", yyripind: 174.8, hind: 7.60, elekter: 63, parkimine: 2, parkKohad: [65, 101], plaan: "T6B_pind_29_plaan.pdf", staatus: "Üüritud", tenant: "AS Maru Ehitus",
    jaotus: [{ osa: "Ladu", m2: 170.9 }, { osa: "Olmeala", m2: 3.2 }, { osa: "Ühisala", m2: 0.7 }] },
  { id: "p30", nr: 30, plaanFail: "lisad/pinnad/T6B_Pind_30.pdf", nimi: "Pind 30", tyyp: "Ladu + müügisaal", yyripind: 509.6, hind: 7.00, elekter: 63, parkimine: 6, parkKohad: [107, 108, 109, 110, 111, 112], plaan: "T6B_Pind_30.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Ladu", m2: 238.3 }, { osa: "Müügisaal", m2: 168.5 }, { osa: "Olmeala", m2: 28.5 }, { osa: "Ühisala", m2: 74.3 }] },
  { id: "bu1", nr: "B1", plaanFail: "lisad/pinnad/T6B_Pind_B1.pdf", nimi: "Büroo 1", tyyp: "Büroo", yyripind: 54.3, hind: 10.00, elekter: 16, parkimine: 4, parkKohad: [72, 113, 114, 115], plaan: "T6B_Buroo_1.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Kontor", m2: 46.4 }, { osa: "Ühisala", m2: 7.9 }] },
  { id: "bu2", nr: "B2", plaanFail: "lisad/pinnad/T6B_Pind_B2.pdf", nimi: "Büroo 2", tyyp: "Büroo", yyripind: 63.2, hind: 10.00, elekter: 16, parkimine: 5, parkKohad: [71, 103, 104, 105, 106], plaan: "T6B_Buroo_2.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Kontor", m2: 54.0 }, { osa: "Ühisala", m2: 9.2 }] },
  { id: "bu3", nr: "B3", plaanFail: "lisad/pinnad/T6B_Pind_B3.pdf", nimi: "Büroo 3", tyyp: "Büroo", yyripind: 30.4, hind: 10.00, elekter: 16, parkimine: 2, parkKohad: [70, 102], plaan: "T6B_Buroo_3.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Kontor", m2: 26.0 }, { osa: "Ühisala", m2: 4.4 }] },
  { id: "bu4", nr: "B4", plaanFail: "lisad/pinnad/T6B_Pind_B4.pdf", nimi: "Büroo 4", tyyp: "Büroo", yyripind: 94.7, hind: 10.00, elekter: 16, parkimine: 7, parkKohad: [10, 11, 12, 13, 14, 43, 44], plaan: "T6B_Buroo_4.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Kontor", m2: 80.9 }, { osa: "Ühisala", m2: 13.8 }] },
  { id: "bu5", nr: "B5", plaanFail: "lisad/pinnad/T6B_Pind_B5.pdf", nimi: "Büroo 5", tyyp: "Büroo", yyripind: 54.3, hind: 10.00, elekter: 16, parkimine: 4, parkKohad: [3, 4, 5, 42], plaan: "T6B_Buroo_5.pdf", staatus: "Vaba", tenant: null,
    jaotus: [{ osa: "Kontor", m2: 46.4 }, { osa: "Ühisala", m2: 7.9 }] },
];

/* v623: seadistusvoo 3. samm — EHR-i näidishoone T6B pinnad tabelina (päris seemnest; olek Vaba — import märgib üüritud) */
const PINNAD_NAIDIS = (() => {
  const n = (v) => v == null || v === "" ? "" : String(v).replace(".", ","), osa = (s, t) => ((s.jaotus || []).find(p => p.osa === t) || {}).m2;
  const read = SPACES.filter(s => !s.jagatud).map(s => [s.nimi, s.tyyp, n(s.yyripind), n(osa(s, "Ladu")), n(osa(s, "Kontor")), n(osa(s, "Müügisaal")), n(osa(s, "Olmeala")), n(osa(s, "Ühisala")),
    Number(s.hind).toFixed(2).replace(".", ","), s.elekter || "", (s.parkKohad || []).join(", "), "Vaba"].join(";"));
  return { "120542318": ["nimi;tüüp;üüripind;ladu;kontor;müügisaal;olmeala;ühisala;hind;elekter;parkimiskohad;staatus"].concat(read).join("\n") };
})();

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
  { id: "LEP-2023-029", liik: "Üürileping", pool: "AS Maru Ehitus", ese: "Pind 29 · Hoone T6B", pindIds: ["p29"],   /* v805 audit 1: seos ID järgi */
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
  { id: "c-future", nimi: "Future Invest OÜ", tyyp: "Eesti firma", registrikood: "11676835", kmkr: "EE101356640", aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald, 75306", kontakt: "Margus Varne", epost: "margus@futureinvest.example", tel: "+372 5871 4402", risk: { skoor: "MADAL", kuupaev: "08.06.2026" } },
  { id: "c-baltic", nimi: "Osaühing Maatrans", tyyp: "Eesti firma", registrikood: "11303382", kmkr: "EE101090786", aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald, 75306", kontakt: "Tarmo Kask", epost: "tarmo@maatrans.example", tel: "+372 511 2233", risk: { skoor: "MADAL", kuupaev: "14.01.2026" },
    /* v642 (kolleeg): ühine esindusõigus — allkirjastavad mõlemad juhatuse liikmed */
    allkirjastajad: [{ nimi: "Tarmo Kask", roll: "juhatuse liige", epost: "tarmo@maatrans.example" }, { nimi: "Merike Laan", roll: "juhatuse liige", epost: "merike@maatrans.example" }], esindus: "ühine" },
  { id: "c-nord",   nimi: "Killa Distribution OÜ", tyyp: "Eesti firma", registrikood: "16471902", kmkr: "EE102483088", aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald, 75306", kontakt: "Liis Tamm", epost: "liis@killa.example", tel: "+372 522 9081", risk: { skoor: "KESKMINE", kuupaev: "02.03.2026" } },
  { id: "c-mikro",  nimi: "MR Safe OÜ", tyyp: "Eesti firma", registrikood: "10165653", kmkr: "EE100091090", aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald, 75306", kontakt: "Andres Lepik", epost: "andres@mrsafe.example", tel: "+372 5648 2913", risk: { skoor: "MADAL", kuupaev: "20.05.2026" } },
  { id: "c-maru",   nimi: "AS Maru Ehitus", tyyp: "Eesti firma", registrikood: "10714568", kmkr: "EE100659856", aadress: "Järvevana tee 5, Tallinn, 10112", kontakt: "Andres Jakobi", epost: "ehitus@maru.ee", tel: "+372 657 5850", risk: { skoor: "MADAL", kuupaev: "12.05.2026" } },
  { id: "c-rohe",   nimi: "Osaühing ONRY", tyyp: "Eesti firma", registrikood: "10221015", kmkr: "EE100200807", aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald, 75306", kontakt: "Kati Org", epost: "kati@onry.example", tel: "+372 5390 1447", risk: { skoor: "KÕRGE", kuupaev: "27.05.2026" } },
];

/* --- Hinnapakkumised ------------------------------------------------------- */
const OFFERS = [
  {
    id: "PAK-2026-014", clientId: "c-future", spaceIds: ["p22"], pikkusKuud: 60,
    staatus: "Mustand", kehtivKuni: "23.06.2026", loodud: "09.06.2026",
    looja: "AI-agent (operaatori korraldusel)",
    kommerts: "Future Invest OÜ-le pakume Hoone T6B kaasaegset ladu-kontorpinda (Pind 22) heas logistilises asukohas Tallinna ringtee vahetus läheduses. Pind sobib hästi e-kaubanduse laoks koos esindusliku kontoriosaga. Esimese 3 kuu üürile pakume 10% soodustust sissekolimisperioodiks.",
    eritingimused: [
      { id: "e1", tekst: "Üürivaba sisseseadeperiood 1 kuu alates üleandmispäevast.", kirjutabYle: "Põhi · Üür (p 3.1)" },
      { id: "e2", tekst: "Üürileandja paigaldab laoossa täiendava 3T sildkraana üürniku kulul, hooldus üürileandja korraldusel.", kirjutabYle: null },
    ],
  },
  {
    id: "PAK-2026-011", clientId: "c-mikro", spaceIds: ["p6"], pikkusKuud: 36,
    staatus: "Saadetud", kehtivKuni: "16.06.2026", loodud: "02.06.2026", looja: "Tarmo Sepp",
    kommerts: "MR Safe OÜ-le pakume Pind 6 (Ladu + kontor) koos 4 parkimiskohaga.",
    eritingimused: [
      { id: "e1", tekst: "Indekseerimine fikseeritud 2,5%/aastas (tavapärase 3% asemel).", kirjutabYle: "Üld · p 5.2 (indekseerimine 3%)" },
    ],
  },
  {
    id: "PAK-2026-009", clientId: "c-rohe", spaceIds: ["p2"], pikkusKuud: 24,
    staatus: "Kliendi ettepanek", kehtivKuni: "12.06.2026", loodud: "26.05.2026", looja: "Tarmo Sepp",
    kommerts: "Osaühingule ONRY pakume Pind 2 (Ladu, 174,8 m²).",
    eritingimused: [],
    kliendiEttepanek: "Palume tagatisraha vähendada 3 kuu üürilt 1 kuu üürile ning lisada ostueesõigus naaberpinnale.",
  },
  {
    id: "PAK-2026-007", clientId: "c-nord", spaceIds: ["p4"], pikkusKuud: 60,
    staatus: "Aktsepteeritud", kehtivKuni: "20.05.2026", loodud: "06.05.2026", looja: "Tarmo Sepp",
    kommerts: "Killa Distribution OÜ-le pakume Pind 4.", eritingimused: [
      { id: "e1", tekst: "Üürivaba sisseseadeperiood 2 kuud alates üleandmispäevast.", kirjutabYle: "§5 Üür ja kõrvalkulud" },
    ],
  },
  {
    id: "PAK-2026-003", clientId: "c-baltic", spaceIds: ["p5"], pikkusKuud: 60,
    staatus: "Aktsepteeritud", kehtivKuni: "30.06.2026", loodud: "12.05.2026", looja: "Tarmo Sepp",
    kommerts: "Osaühingule Maatrans pakume Pind 5 (Ladu + kontor).", eritingimused: [],
  },
  {
    id: "PAK-2026-001", clientId: "c-rohe", spaceIds: ["p9"], pikkusKuud: 12,
    staatus: "Aegunud", kehtivKuni: "20.02.2026", loodud: "05.02.2026", looja: "Tarmo Sepp",
    kommerts: "Osaühingule ONRY pakume Pind 9.", eritingimused: [],
  },
];

/* --- Lepingud -------------------------------------------------------------- */
/* v576: esmakäivitusel lisab app.js (seedKehtivLeping) ÜHE kehtiva lepingu Killa Distribution OÜ pakkumisest —
   auditi järgi ei tohi demo alata tühja majaga. Allpool ajalooline märkus.
   MVP demo algab PUHTA lepinguportfelliga: platvormis loodud üürilepinguid pole —
   need sünnivad demo käigus pakkumistest (2 aktsepteeritud pakkumist on teisendamiseks
   valmis) või wizardist. Varasemad seemned (LEP-2026-005 Kehtiv + LEP-2026-008
   läbirääkimistel) on git-ajaloos (v=294 seis). Imporditud portfell (IMPORDITUD) jääb. */
const LEASES = [];

/* --- Võtmekuupäevad -------------------------------------------------------- */
const KEY_DATES = [
  { kuupaev: "2026-06-16", tyyp: "Pakkumise kehtivus", objekt: "PAK-2026-011 · MR Safe OÜ", margis: "amber", info: "Pakkumine aegub" },
  { kuupaev: "2027-01-01", tyyp: "Indekseerimine", objekt: "LEP-2023-029 · AS Maru Ehitus (imporditud)", margis: "accent", info: "Statistikaameti THI, eelmise aasta muutus · automaatne, lisa ei teki (Lisa 3 p 5.2)" },
  { kuupaev: "2027-06-01", tyyp: "Hindade ülevaatus", objekt: "HOO-2023-H508 · Caverion Eesti AS (imporditud)", margis: "amber", info: "Hooldustasu vaadatakse üle 1× kalendriaastas (p 9.12) · 1 104 €/kuus" },
  { kuupaev: "2028-11-25", tyyp: "Pikendusõigus", objekt: "LEP-2023-029 · AS Maru Ehitus (imporditud)", margis: "amber", info: "5 aastat täitub → üürnikul õigus pikendada 5 aastaks samadel tingimustel (Lisa 3)" },
  { kuupaev: "2029-01-02", tyyp: "Tagatise korrigeerimine", objekt: "LEP-2023-029 · AS Maru Ehitus (imporditud)", margis: "grey", info: "Tagatis viiakse vastavusse indekseeritud üüriga (Lisa 3, ÜT 6.3)" },
  { kuupaev: "2030-11-25", tyyp: "Lepingu lõpp", objekt: "LEP-2023-029 · AS Maru Ehitus (imporditud)", margis: "grey", info: "7-aastane tähtaeg · ei pikene automaatselt (ÜT 3.2) · teavitus 90 päeva ette" },
];

/* --- Audit trail / otsuste mälu (näidis) ----------------------------------- */
const AUDIT = [
  { aeg: "09.06.2026 09:14", autor: "AI-agent", tegevus: "Pakkumise mustand PAK-2026-014 loodud operaatori korraldusel (Future Invest OÜ · Pind 22)." },
  { aeg: "08.06.2026 16:40", autor: "Tarmo Sepp", tegevus: "Riskiraport tellitud: Future Invest OÜ (e-äriregister · EMTA avaandmed)." },
  { aeg: "12.05.2026 10:10", autor: "Tarmo Sepp", tegevus: "Pakkumine PAK-2026-003 (Osaühing Maatrans · Pind 5) aktsepteeritud — valmis lepinguks teisendamiseks." },
];

/* --- B11G OÜ — konto teine ettevõte ----------------------------------------
   Lugu: B11G OÜ lisati kontole hiljuti (e-äriregistri autotäide), Hoone B11G
   baasandmed tulid EHR-ist ja vana portfell imporditi (üürileping + hooldus-
   leping). Uusi pakkumusi/lepinguid pole platvormis veel sündinud — seetõttu
   on lepingumootori loendid tühjad ja pinnad valdavalt vabad. */
if (COMPANY_ID === "b11g") {
  ACCOUNT.landlord = {
    nimi: "B11G OÜ", registrikood: "16614862", kmkr: "EE102559310",
    aadress: "Betooni tn 11g, Lasnamäe linnaosa, Tallinn, Harju maakond, 11415",
    epost: "info@b11g.ee", mobiil: "+372 512 8890", asutatud: "16.11.2022",
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
      eritingimused: "Eritingimuste põhi v1.4", pakkumus: "Pakkumise põhi v2.0" },
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
      eritingimused: "Eritingimuste põhi v1.4", pakkumus: "Pakkumise põhi v2.0" },
    taituvusAjalugu: [55, 55, 50, 50, 50, 45, 45, 41, 41, 41, 41],
  });
  SPACES.length = 0;
  SPACES.push(
    /* Stock Office */
    { id: "b1", nr: 1, nimi: "Pind 1", tyyp: "Ladu",          yyripind: 645.8, hind: 6.90,  elekter: 50, parkimine: 5, plaan: null, staatus: "Üüritud", tenant: "Titancompany OÜ", objektId: "obj-b11g-so" },
    { id: "b2", nr: 2, nimi: "Pind 2", tyyp: "Ladu",          yyripind: 481.7, hind: 6.90,  elekter: 40, parkimine: 4, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-so" },
    { id: "b3", nr: 3, nimi: "Pind 3", tyyp: "Ladu + kontor", yyripind: 412.3, hind: 7.40,  elekter: 32, parkimine: 3, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-so",
      jaotus: [{ osa: "Ladu", m2: 330.3 }, { osa: "Kontor", m2: 82.0 }] },
    { id: "b4", nr: 4, nimi: "Pind 4", tyyp: "Büroo",          yyripind: 104.5, hind: 10.50, elekter: 16, parkimine: 2, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-so" },
    /* Self Storage — laoboksid (näidis; päris majas kümneid) */
    { id: "s1", nr: 5,  nimi: "Boks 101", tyyp: "Laoboks",  yyripind: 6.0,  hind: 24.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Üüritud", tenant: "Eraisik · M. Laur", objektId: "obj-b11g-ss" },
    { id: "s2", nr: 6,  nimi: "Boks 108", tyyp: "Laoboks",  yyripind: 9.0,  hind: 22.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Üüritud", tenant: "Eraisik · K. Sepp", objektId: "obj-b11g-ss" },
    { id: "s3", nr: 7,  nimi: "Boks 112", tyyp: "Laoboks", yyripind: 12.0, hind: 20.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Üüritud", tenant: "RK Väikevedu OÜ", objektId: "obj-b11g-ss" },
    { id: "s4", nr: 8,  nimi: "Boks 204", tyyp: "Laoboks",  yyripind: 6.0,  hind: 24.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-ss" },
    { id: "s5", nr: 9,  nimi: "Boks 210", tyyp: "Laoboks", yyripind: 15.0, hind: 19.00, elekter: 0, parkimine: 0, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-ss" },
    { id: "s6", nr: 10, nimi: "Boks 215", tyyp: "Laoboks", yyripind: 18.0, hind: 18.50, elekter: 0, parkimine: 0, plaan: null, staatus: "Vaba", tenant: null, objektId: "obj-b11g-ss" },
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
    { id: "LEP-2023-041", liik: "Üürileping", pool: "Titancompany OÜ", ese: "Pind 1 · Stock Office", pindIds: ["b1"],
      punkte: 72, kinnitatud: "Tarmo Sepp · 04.06.2026", fail: "Uurileping_Titancompany_2023 (originaal)",
      parameetrid: [["Periood", "01.09.2023 – 31.08.2028 (60 kuud)"], ["Üür", "4 456,02 €/kuus (neto)"],
        ["Indekseerimine", "Fikseeritud 3% · iga 12 kuu"], ["Tagatisraha", "8 912,04 € (2 kuu üür)"]],
      tahtajad: ["01.09.2026 · indekseerimine", "31.08.2028 · lepingu lõpp"] },
    { id: "HOO-2024-06", liik: "Hooldusleping", pool: "C.D.R OÜ", ese: "Stock Office + Self Storage · Betooni 11g",
      punkte: 34, kinnitatud: "Tarmo Sepp · 04.06.2026", fail: "Hooldusleping_2024 (originaal)",
      parameetrid: [["Tasu", "780,00 €/kuus (neto)"], ["Etteteatamine", "2 kuud"],
        ["Reageerimisaeg", "Avariitööd 6 h · muud tööd 72 h"]],
      tahtajad: ["30.11.2026 · automaatse pikenemise otsustuskoht"] },
  );
  /* B11G kliendiregister — oma osapooled, mitte Taevavärava omad
     (muidu ei leia pakkumuse/lepingu wizard B11G üürnikke üldse) */
  CLIENTS.length = 0;
  CLIENTS.push(
    { id: "c-viking",   nimi: "Titancompany OÜ", tyyp: "Eesti firma", registrikood: "16562154", kmkr: "EE102616868", aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald, 75306", kontakt: "Argo Vessmann", epost: "argo@titancompany.example", tel: "+372 509 4471", risk: { skoor: "MADAL", kuupaev: "04.06.2026" } },
    { id: "c-clanner",  nimi: "C.D.R OÜ", tyyp: "Eesti firma", registrikood: "14848515", kmkr: "EE102213339", aadress: "Taevavärava tee 6b, Lehmja küla, Rae vald, 75306", kontakt: "Marko Laane", epost: "info@cdr.example", tel: "+372 5628 3350", risk: { skoor: "MADAL", kuupaev: "04.06.2026" } },
    { id: "c-vaikevedu", nimi: "RK Väikevedu OÜ", tyyp: "Eesti firma", registrikood: "16980822", kmkr: "EE102735464", aadress: "Ehituse tn 2-3, Jüri alevik, Rae vald, 75301", kontakt: "Rain Talts", epost: "rain@rkvaikevedu.example", tel: "+372 5341 7788", risk: { skoor: "KESKMINE", kuupaev: "04.06.2026" } },
  );
  KEY_DATES.length = 0;
  KEY_DATES.push(
    { kuupaev: "2026-09-01", tyyp: "Indekseerimine", objekt: "LEP-2023-041 · Titancompany OÜ (imporditud)", margis: "accent", info: "Fikseeritud 3% · automaatne, lisa ei teki" },
    { kuupaev: "2026-11-30", tyyp: "Otsustuskoht", objekt: "HOO-2024-06 · C.D.R OÜ (imporditud)", margis: "amber", info: "Hoolduslepingu automaatne pikenemine — otsusta 2 kuud ette" },
    { kuupaev: "2028-08-31", tyyp: "Lepingu lõpp", objekt: "LEP-2023-041 · Titancompany OÜ (imporditud)", margis: "grey", info: "Teavitus 90 päeva ette (operaator + klient)" },
  );
  AUDIT.length = 0;
  AUDIT.push(
    { aeg: "04.06.2026 15:20", autor: "Tarmo Sepp", tegevus: "Imporditud lepingu HOO-2024-06 struktuur kinnitatud (Hooldusleping · C.D.R OÜ)." },
    { aeg: "04.06.2026 14:47", autor: "AI-agent", tegevus: "Olemasolev üürileping LEP-2023-041 loetud klauslimudelisse (72 punkti) — operaator kinnitas struktuuri." },
    { aeg: "04.06.2026 14:31", autor: "Tarmo Sepp", tegevus: "Ettevõte B11G OÜ lisatud kontole (e-äriregistri autotäide) · Stock Office'i ja Self Storage'i EHR baasandmed laetud (Betooni 11g)." },
  );
}

/* --- Uus konto (v623) — tühi konto seadistusvoo jaoks ---------------------
   Kõik algab #/alusta teekonnast: ettevõte äriregistrist → objekt EHR-ist → pinnad tabelist → päris lepingute import.
   OBJEKT on siin ainult kohatäide (objektOf-i tagavara); esimene kinnitatud hoone saab OBJEKT-iks endaks. */
if (COMPANY_ID === "uus") {
  ACCOUNT.name = "Uus konto";
  ACCOUNT.landlord = { nimi: "Uus konto", registrikood: "", kmkr: "", aadress: "", epost: "", mobiil: "", asutatud: "", allikas: "—", pank: "", iban: "",
    esindajad: { lepingulised: "", haldus: "", arveldused: "" } };
  Object.assign(OBJEKT, {
    id: "obj-none", nimi: "—", logo: null,
    ehr: { kood: "", aadress: "", kasutusotstarve: "", ehitisealunePind: null, suletudNetopind: null, korrusteArv: null, ehitusaasta: null, allikas: "—" },
    korvalkulu: { talvine: null, suvine: null, allikas: "—" }, kaibemaksugaMaksustatud: true, lisa2: "", failid: { pinnaplaan: null, parkimine: null },
  });
  OBJEKTID.length = 0;
  SPACES.length = 0;
  TAITUVUS_AJALUGU.length = 0;
  Object.assign(OSAKOND, { id: "os-uus", nimi: "Haldus", ettevote: "Uus konto" });
  AMETIKOHAD.length = 0; TLEPINGUD.length = 0; OFFERS.length = 0; LEASES.length = 0; IMPORDITUD.length = 0; CLIENTS.length = 0; KEY_DATES.length = 0; AUDIT.length = 0;
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
  /* v567 (kasutaja): tuhandeeraldaja tühikuga ALATI — ka 4-kohalistel (et-EE jätab vaikimisi 1328 ilma);
     sisetühik on murdumatu, et arv ei poolituks reavahetusel */
  const s = n.toLocaleString("et-EE", { minimumFractionDigits: frac, maximumFractionDigits: frac, useGrouping: false });
  return s.replace(/\d+/, (m) => m.replace(/\B(?=(\d{3})+(?!\d))/g, " "));
}
function withVat(n) { return n * (1 + VAT_RATE); }

/* --- püsisalvestus (localStorage): sisendid elavad üle lehe sulgemise ------
   Võti on ettevõttepõhine — kummagi ettevõtte sisestused püsivad eraldi. */
/* v595: lepingute import — failide järjekord (loetud väljad, otsused; originaalid brauseri IndexedDB-s „thinkone_import") */
const IMPORT_FAILID = [];
const LS_KEY = COMPANY_ID === "taeva" ? "thinkone_demo_v1" : "thinkone_demo_v1_" + COMPANY_ID;
/* v805 (audit 6): MÄLU DIEET — üldtingimuste punkt, mille tekst on sama mis mall (ULD_FULL), salvestatakse viitena (_u):
   lepingu punktid, v1 ja versioonide tekstid ning vooru hetktõmmis (pub). Laadimisel taastatakse mallist. Mallist erinev
   (läbiräägitud) tekst salvestub alati täielikult. Üks leping ~300K → paarkümmend K märki. */
const ULD_TX = (() => { const m = {}; (typeof ULD_FULL !== "undefined" ? ULD_FULL : []).forEach(s => (s.punktid || []).forEach(p => { m[p.ref] = p.tekst; })); return m; })();
const uldRef = (k) => String(k).startsWith("uld:") ? String(k).slice(4) : null;
function lepKompakt(l) {
  if (!l || typeof l !== "object") return l;
  const x = { ...l };
  if (Array.isArray(l.punktid)) x.punktid = l.punktid.map(p => p && p.osa === "uld" && ULD_TX[p.ref] != null && p.tekst === ULD_TX[p.ref] && (p.algne == null || p.algne === p.tekst)
    ? (({ tekst, algne, ...r }) => ({ ...r, _u: 1 }))(p) : p);
  const kT = (T) => { if (!T || typeof T !== "object") return T; const o = { _u: 1 }; Object.keys(T).forEach(k => { const r = uldRef(k); if (!(r && ULD_TX[r] === T[k])) o[k] = T[k]; }); return o; };
  if (l.v1 && l.v1.tekst) x.v1 = { ...l.v1, tekst: kT(l.v1.tekst) };
  if (Array.isArray(l.versioonid)) x.versioonid = l.versioonid.map(v => v && v.tekst ? { ...v, tekst: kT(v.tekst) } : v);
  if (typeof l.pub === "string") { try { x.pub = JSON.stringify(lepKompakt(JSON.parse(l.pub))); } catch (e) { /* jääb nagu on */ } }
  return x;
}
function lepTaasta(l) {
  if (!l || typeof l !== "object") return l;
  const ids = [];
  (l.punktid || []).forEach(p => { if (p && p._u) { delete p._u; p.tekst = p.algne = ULD_TX[p.ref] != null ? ULD_TX[p.ref] : ""; } if (p && p.osa === "uld") ids.push(p.id); });
  const tT = (T) => { if (!T || !T._u) return; delete T._u; ids.forEach(id => { const r = uldRef(id); if (!(id in T) && r && ULD_TX[r] != null) T[id] = ULD_TX[r]; }); };
  if (l.v1) tT(l.v1.tekst);
  (Array.isArray(l.versioonid) ? l.versioonid : []).forEach(v => v && tT(v.tekst));
  if (typeof l.pub === "string" && l.pub.includes('"_u"')) { try { l.pub = JSON.stringify(lepTaasta(JSON.parse(l.pub))); } catch (e) { /* jääb */ } }
  return l;
}
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ objects: OBJEKTID, spacesSeed: typeof SPACES_SEED === "undefined" ? null : SPACES_SEED, spaces: SPACES, offers: OFFERS, leases: LEASES.map(lepKompakt), tlepingud: TLEPINGUD, audit: AUDIT, keyDates: KEY_DATES, parkMuud: PARK_MUUD, parkReg: PARK_REG,
      imported: IMPORDITUD.filter(x => x.imp), impClients: CLIENTS.filter(c => c.impUus), importFailid: IMPORT_FAILID,
      landlord: COMPANY_ID === "uus" ? ACCOUNT.landlord : undefined }));
    return true;
  } catch (e) { return false; }
}
/* v576: esmakäivitus (salvestust pole) — app.js lisab siis seemnesse ühe kehtiva lepingu (audit 6: „demo algseis on tühi maja") */
let FRESH = false;
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) { FRESH = true; return; }
    const d = JSON.parse(raw);
    if (COMPANY_ID === "uus" && d.landlord && typeof d.landlord === "object") Object.assign(ACCOUNT.landlord, d.landlord);
    if (Array.isArray(d.objects)) {
      d.objects.filter(o => o && o.id && o.ehr && o.korvalkulu && o.mallid).forEach(o => {
        const existing = OBJEKTID.find(x => x.id === o.id);
        if (existing) Object.assign(existing, o);
        else if (COMPANY_ID === "uus" && !OBJEKTID.length) { Object.assign(OBJEKT, o); OBJEKTID.push(OBJEKT); }   /* v623: esimene hoone = OBJEKT */
        else OBJEKTID.push(o);
      });
      /* v549: vana üldplaan → kõigi pindade plaan (pindade-plaanid/) */
      OBJEKTID.forEach(o => { if (o.failid && o.failid.pinnaplaan === "lisad/T6B_pinnaplaan.pdf") o.failid.pinnaplaan = "lisad/pinnad/T6B_koik_pinnad.pdf"; });
    }
    /* v522: pinnaseeme vahetus (päris t6b.ee pinnad) — vana salvestatud pinnastik jääb kõrvale, kehtib uus seeme */
    const seedVer = typeof SPACES_SEED === "undefined" ? null : SPACES_SEED;
    /* v595: loo-pakkumused on taas pindadel 2, 4, 5, 6, 22 (päris lepingud katavad pinnad 9, 11, 23, 26, 27) — v592–594 ajal
       salvestatud pakkumused/leping kolivad tagasi (pinna kohad kolivad, kui olid vaikejaotus) */
    if (/^t6b-2026-09-25[bc]$/.test(seedVer)) {
      const LUGU = { "PAK-2026-009": ["p11", "p2"], "PAK-2026-007": ["p27", "p4"], "PAK-2026-003": ["p26", "p5"], "PAK-2026-011": ["p23", "p6"], "PAK-2026-014": ["p9", "p22"] };
      const kohad = (id) => ((SPACES.find(x => x.id === id) || {}).parkKohad || []);
      const mvPark = (arr, [v, u]) => { if (!Array.isArray(arr)) return arr;
        const a = arr.slice().sort((x, y) => x - y), k = kohad(v);
        return a.length === k.length && a.every((x, i) => x === k[i]) ? kohad(u).slice() : arr; };
      const mvKeys = (o, [v, u]) => { if (!o || typeof o !== "object" || !(v in o)) return o; const r = { ...o }; r[u] = r[v]; delete r[v]; return r; };
      (d.offers || []).forEach(o => { const m = LUGU[o.id]; if (!m || (o.spaceIds || [])[0] !== m[0]) return;
        if (o.parkKohad) o.parkKohad = mvPark(o.parkKohad, m);
        o.spaceIds = o.spaceIds.map(id => id === m[0] ? m[1] : id);
        ["hinnad", "graafik", "parkimine"].forEach(k => { if (o[k]) o[k] = mvKeys(o[k], m); }); });
      (d.leases || []).forEach(l => { const m = LUGU[l.pakkumus]; if (!m || l.spaceId !== m[0]) return;
        if (l.tehing && l.tehing.parkKohad) l.tehing.parkKohad = mvPark(l.tehing.parkKohad, m); l.spaceId = m[1]; });
    }
    if (d.spaces && seedVer && d.spacesSeed !== seedVer) delete d.spaces;
    if (d.spaces) { // varasem salvestus ei pruugi jaotust/objektId-d/uusi pindu sisaldada → täienda seemnest
      const seed = SPACES.slice();
      const seedById = new Map(seed.map(s => [s.id, s]));
      SPACES.length = 0;
      SPACES.push(...d.spaces.map(s => { const sd = seedById.get(s.id) || {};
        return { ...s, jaotus: s.jaotus || sd.jaotus, objektId: s.objektId || sd.objektId, plaanFail: s.plaanFail || sd.plaanFail,
          parkKohad: s.parkKohad || sd.parkKohad, parkimine: s.parkKohad ? s.parkimine : (sd.parkKohad ? sd.parkimine : s.parkimine) }; }));
      seed.forEach(s => { if (!SPACES.some(x => x.id === s.id)) SPACES.push(s); }); // seemnesse lisandunud pinnad
    }
    /* vana salvestus võib viidata kliendile/pinnale/ametikohale, mida praeguses
       seemnes enam pole (nt B11G sai oma kliendiregistri) → sellised read maha */
    /* v595: impordiga lisandunud osapooled ja kinnitatud lepingud (seemne omad tulevad koodist) + impordi järjekord */
    if (Array.isArray(d.impClients)) d.impClients.forEach(c => { if (c && c.id && !CLIENTS.some(x => x.id === c.id)) CLIENTS.push(c); });
    if (Array.isArray(d.imported)) d.imported.forEach(x => { if (x && x.id && !IMPORDITUD.some(y => y.id === x.id)) IMPORDITUD.push(x); });
    if (Array.isArray(d.importFailid)) IMPORT_FAILID.push(...d.importFailid.filter(f => f && f.id));
    /* v602: imporditud lepingu pinnad on üüritud ka siis, kui pinnastik tuli seemnest (seemne vahetus) */
    IMPORDITUD.forEach(x => (x.pindIds || []).forEach(id => { const sp = spaceById(id); if (sp && sp.staatus === "Vaba") { sp.staatus = "Üüritud"; sp.tenant = x.pool; } }));
    if (d.offers) { OFFERS.length = 0; OFFERS.push(...d.offers.filter(o => clientById(o.clientId) && (o.spaceIds || [o.spaceId]).every(id => spaceById(id)))); }
    if (d.leases) { LEASES.length = 0; LEASES.push(...d.leases.filter(l => clientById(l.clientId) && spaceById(l.spaceId)).map(lepTaasta)); }   /* v805: mälu dieet */
    if (d.tlepingud) { TLEPINGUD.length = 0; TLEPINGUD.push(...d.tlepingud.filter(t => ametikohtById(t.ametikohtId))); } // vanem salvestus: võti puudub → seeme jääb
    if (d.audit)  { AUDIT.length = 0;  AUDIT.push(...d.audit); }
    /* võtmekuupäevad (lõpetamise „Lepingu lõpp", arhiveerimisel eemaldatud) — vanem salvestus: võti puudub → seeme jääb */
    if (Array.isArray(d.keyDates)) { KEY_DATES.length = 0; KEY_DATES.push(...d.keyDates); }
    /* v551: parkimisregistri muudatused (kasutusest väljas, märkus) */
    if (d.parkMuud && typeof d.parkMuud === "object") Object.assign(PARK_MUUD, d.parkMuud);
    if (d.parkReg && typeof d.parkReg === "object") Object.assign(PARK_REG, d.parkReg);
    /* v192 migratsioon: allkirjastatud lepingu staatus „Arhiveeritud" → „Kehtiv" */
    LEASES.concat(TLEPINGUD).forEach(x => { if (x.staatus === "Arhiveeritud") x.staatus = "Kehtiv"; });
  } catch (e) { /* rikutud salvestus → kasuta seemneandmeid */ }
}
function reset() {
  try {
    /* andmed (iga ettevõtte võti) + roll, ettevõte, vihjed, seaded (kutsed jm), loetud teavitused.
       Teema, külgriba ja portfelli vaaterežiim on kasutaja eelistused — need jäävad. */
    COMPANIES.map(c => c.id === "taeva" ? "thinkone_demo_v1" : "thinkone_demo_v1_" + c.id)
      .concat(["thinkone_role", "thinkone_company", "thinkone_tips", "thinkone_seaded", "thinkone_notif_read", "thinkone_loetud"])
      .forEach(k => localStorage.removeItem(k));
    indexedDB.deleteDatabase("thinkone_import");   /* v595: imporditud originaalid */
  } catch (e) {}
  location.reload();
}
shiftStoryDates(); /* v408: seeme ankrust tänasesse — enne salvestatud seisu laadimist */
load();

window.DB = {
  COMPANIES, COMPANY_ID, setCompany, PINNAD_NAIDIS,
  OBJEKTID, objektById, objektOf, TAITUVUS_AJALUGU, PARK_SVGS, PARK_MUUD, PARK_ERI, PARK_REG, FRESH,
  VAT_RATE, ACCOUNT, OBJEKT, SPACES, CLIENTS, OFFERS, LEASES,
  OSAKOND, AMETIKOHAD, TLEPINGUD, TL_ULD, IMPORDITUD, IMPORT_FAILID,
  KEY_DATES, AUDIT,
  DEMO_TODAY, TODAY_EE, NOW_EE, fmtEE, fmtISO, SEED_ANCHOR, SEED_SHIFT_DAYS,
  spaceById, clientById, offerById, leaseById,
  ametikohtById, tlepingById, impById, ametikohtHoive,
  rent, spaceParts, kkWinter, kkSummer, eur, withVat,
  save, reset,
};
})();
