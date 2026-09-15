/* Genereerib demo/klauslid.js imporditud lepingute tekstist.
   Sisend: pdf.js tekstiväljavõtted (tools/pdftext.html — kopeeri ajutiselt demo/ alla, ava
   http://localhost:8471/_pdftext.html?f=lisad/importitud/<fail>.pdf ja salvesta #out sisu txt-failina).
   Kasutus: node tools/gen-klauslid.js <txt-kaust>  (vaikimisi ./tools/txt) */
const fs = require("fs");
const path = require("path");
const T = path.resolve(process.argv[2] || path.join(__dirname, "txt")) + path.sep;
const OUT = path.join(__dirname, "..", "demo", "klauslid.js");
const read = f => fs.readFileSync(T + f, "utf8").split("\n").map(l => l.replace(/\s+$/, ""));
const norm = t => t.replace(/\s+/g, " ").replace(/ - /g, "-").replace(/(\w)- (\w)/g, "$1$2").trim();
const CL = /^(\d+\.\d+(?:\.\d+)?)\.?\s+(.*)$/;      // 3.7. tekst · 9.12 tekst · 5.5.1. tekst
const SEC = /^(\d+)\.?\s+([A-ZÄÖÜÕŠŽ][A-ZÄÖÜÕŠŽ .,\-\/]{1,})$/;   // 3. LEPINGU TÄHTAEG …  · 3 HOOLDAJA KOHUSTUSED
const PAGE = /^<<<PAGE (\d+)>>>$/;

function parse(lines, opts) {
  const out = []; let page = 1, osa = opts.osa0, jagu = "", pealkiri = "", cur = null, inTOC = opts.tocUntil ? true : false, annex = null;
  const flush = () => { if (cur) { cur.tekst = norm(cur.tekst); if (cur.tekst) out.push(cur); } cur = null; };
  for (let raw of lines) {
    const l = raw.trim(); if (!l) continue;
    const pm = l.match(PAGE); if (pm) { page = +pm[1] + 1; continue; }
    if (inTOC) { if (l.startsWith(opts.tocUntil)) inTOC = false; else continue; }
    if (opts.skip.some(re => re.test(l))) continue;
    const sw = opts.osaSwitch && opts.osaSwitch(l); if (sw) { flush(); osa = sw; jagu = ""; pealkiri = ""; annex = null; continue; }
    const am = opts.annex && l.match(opts.annex);
    if (am) { flush(); annex = { nr: "Lisa " + am[1], osa: "Lisa " + am[1], jagu: "Lisa " + am[1], pealkiri: norm(am[2]), tekst: "", lk: page }; cur = annex; continue; }
    if (annex) { cur.tekst += " " + l; continue; }   /* lisa = üks tekstiplokk */
    const sm = l.match(SEC);
    if (sm && !CL.test(l)) { flush(); jagu = sm[1]; pealkiri = norm(sm[2]).replace(/\.+\s*\d+$/, ""); continue; }
    const cm = l.match(CL);
    if (cm && (cm[1].split(".")[0] === jagu || !jagu)) { flush(); cur = { nr: cm[1], osa, jagu, pealkiri, tekst: cm[2], lk: page }; continue; }
    if (cur) cur.tekst += " " + l;
  }
  flush(); return out;
}

/* ---- MARU üürileping: lk 1 põhitingimused (PT), lk 2–8 üldtingimused (ÜT) ---- */
const maru = parse(read("MARU_uurileping_P29.v2.txt"), {
  osa0: "PT",
  skip: [/^ÄRIRUUMIDE ÜÜRILEPING PIND/, /^_29_T6B_MARU EHITUS/, /^\d+$/, /^ÄRIRUUMIDE ÜÜRILEPINGU PÕHITINGIMUSED$/],
  osaSwitch: l => l === "ÄRIRUUMIDE ÜÜRILEPINGU ÜLDTINGIMUSED" ? "ÜT" : null,
});
/* Lisa 3: kokkulepped ÜT punktide muutmiseks — käsitsi seosed (parseri asemel: tekst on ebaregulaarne) */
const lisa3 = [
  { nr: "3.2.2", osa: "L3", jagu: "3", pealkiri: "LEPINGU TÄHTAEG. ÜÜRIPINNA ÜLEANDMINE", lk: 1, viis: "lisatud", sihtNr: "3.2",
    tekst: "Lepinguperiood 7 a, rentnikul õigus lepingut pikendada samadel tingimustel viie aasta järel veel 5 aastaks, kui rentnik on lepingut korrektselt täitnud." },
  { nr: "5.2", osa: "L3", jagu: "5", pealkiri: "ÜÜR JA KÕRVALKULUD", lk: 1, viis: "asendatud", sihtNr: "5.2",
    tekst: "Pooled on kokku leppinud, et 12. kuu möödumisel Üleandmise päevast ning sellele järgnevalt iga 12. kuu möödumisel suureneb Üüripinna Üür automaatselt, ilma Poolte täiendava kirjaliku kokkuleppeta. Üürihinna suurenemise/indekseerimise aluseks on THI, avaldatuna Statistikaameti kodulehel, muutus võrreldes eelmise aastaga. Esimene indekseerimine toimub 01.01.2025." },
  { nr: "6.3", osa: "L3", jagu: "6", pealkiri: "TAGATIS", lk: 1, viis: "asendatud", sihtNr: "6.3",
    tekst: "Pooled on kokku leppinud, et Tagatis korrigeeritakse 02.01.2029 aastal, vastavalt p 5.2 järgi kehtivale üürihinnale." },
  { nr: "12.5", osa: "L3", jagu: "12", pealkiri: "LEPINGU LÕPPEMINE JA ÜLESÜTLEMINE", lk: 1, viis: "kehtetu", sihtNr: "12.5",
    tekst: "Pooled lepivad kokku muuta Üldtingimuste punkt 12.5 kehtetuks — mõjuva põhjuseta ülesütlemise õigus on välistatud." },
  { nr: "8.2", osa: "L3", jagu: "8", pealkiri: "REKLAAM", lk: 1, viis: "asendatud", sihtNr: "8.2",
    tekst: "Üürileandja ja Üürnik on kokku leppinud, et Üürnik võib omal soovil alates lepingu sõlmimisest esitada Hoone välifassaadile reklaamlahenduse paigaldamiseks ettevõtte logo pdf formaadis või mõnes muus vektorformaadis. Reklaamlahenduse teostab Üürileandja poolt valitud ja kõige soodsama pakkumise teinud reklaamiagentuur, kes tutvustab Üürnikule võimalusi reklaamlahenduse asukoha, kujunduse ja suuruse osas, mis on eelnevalt kooskõlastatud Üürileandjaga. Reklaamlahenduse valmistamise ja paigaldamise kulud tasub Üürnik ja Üürnikul ei ole õigus nõuda Lepingu lõppedes eelnimetatuga seotud kulutuste hüvitamist, kuid reklaamlahendus on Üürniku omand ja Üürnikul on lepingu lõppedes õigus reklaamlahendus kaasa võtta. Eraldi tasu Üürileandja eelnimetatud reklaamlahenduse eksponeerimise eest Üürnikult ei nõua, kuid Üürnik on kohustatud tasuma reklaamlahenduse hooldus- ja korrashoiukulud." },
];
/* seosed ÜT punktide peale: muudetud = { lisa, viis, tekst, nr } */
for (const l of lisa3) {
  const t = maru.find(c => c.osa === "ÜT" && c.nr === l.sihtNr);
  if (!t) { console.error("sihtpunkt puudub", l.sihtNr); process.exit(1); }
  t.muudetud = { lisa: "Lisa 3", viis: l.viis, nr: l.nr, tekst: l.tekst };
}

/* ---- Caverion hooldusleping: lk 3–9 põhitekst, lk 10–18 lisad 1–5 ---- */
const cav = parse(read("Hooldusleping_H5-08.v2.txt"), {
  osa0: "HL", tocUntil: "Käesoleva teenuste osutamise Lepingu",
  skip: [/^Hooldusleping H5\.08$/, /^Tehnosüsteemide hooldusleping$/, /^\d+$/, /^HOOLDUS LEPING Nr/, /^Taevavärava 6b$/, /^149524_v4$/, /^i \(i\)$/],
  annex: /^LISA (\d) – (.+)$/,
});
/* sissejuhatus (pooled) eraldi punktina */
const cavIntro = read("Hooldusleping_H5-08.v2.txt");
const i0 = cavIntro.findIndex(l => l.startsWith("Käesoleva teenuste osutamise Lepingu"));
const introTxt = norm(cavIntro.slice(i0, cavIntro.findIndex((l, i) => i > i0 && /^1 LEPINGU DOKUMENDID/.test(l))).join(" "));
cav.unshift({ nr: "0", osa: "HL", jagu: "0", pealkiri: "POOLED", tekst: introTxt, lk: 3 });

const stats = arr => `${arr.length} punkti, ${arr.reduce((s, c) => s + c.tekst.length, 0)} tähemärki`;
console.log("MARU:", stats(maru), "| PT:", maru.filter(c => c.osa === "PT").length, "ÜT:", maru.filter(c => c.osa === "ÜT").length, "| jaod:", [...new Set(maru.filter(c => c.osa === "ÜT").map(c => c.jagu))].join(","));
console.log("CAV:", stats(cav), "| jaod:", [...new Set(cav.map(c => c.jagu))].join(","));

const js = `/* ThinkOne demo — imporditud lepingute KLAUSLIKIHT (genereeritud pdf.js väljavõttest, v363).
   Iga punkt: nr, osa (PT põhitingimused · ÜT üldtingimused · L3 Lisa 3 · HL hooldusleping · Lisa N),
   jagu + pealkiri, tekst, lk (originaal-PDF-i lehekülg). ÜT punktil võib olla \`muudetud\` = Lisa 3
   kokkulepe { lisa, viis: lisatud|asendatud|kehtetu, nr, tekst } → kehtiv tingimus.
   Kasutus: View.imporditud „Kogu leping punktide kaupa", agendi klausliotsing, omnibox. */
const KLAUSLID = {
  "LEP-2023-029": { fail: "lisad/importitud/MARU_uurileping_P29.pdf", lisa3fail: "lisad/importitud/MARU_uurileping_P29_lisa3.pdf",
    osad: { PT: "Põhitingimused", "ÜT": "Üldtingimused", L3: "Lisa 3 · Eritingimused" },
    punktid: ${JSON.stringify(maru.concat(lisa3.map(l => ({ nr: l.nr, osa: l.osa, jagu: l.jagu, pealkiri: l.pealkiri, tekst: l.tekst, lk: l.lk, muudab: l.sihtNr, viis: l.viis }))), null, 1)} },
  "HOO-2023-H508": { fail: "lisad/importitud/Hooldusleping_H5-08.pdf",
    osad: { HL: "Hooldusleping", "Lisa 1": "Lisa 1", "Lisa 2": "Lisa 2", "Lisa 3": "Lisa 3", "Lisa 4": "Lisa 4", "Lisa 5": "Lisa 5" },
    punktid: ${JSON.stringify(cav, null, 1)} },
};
`;
fs.writeFileSync(OUT, js.replace(/\n/g, "\r\n"), "utf8");
console.log("written", OUT, (js.length / 1024).toFixed(1) + " KB");
