/* ============================================================================
   ThinkOne — demorakenduse loogika (hash-router SPA, raamistikuvaba)
   ========================================================================== */
const DB = window.DB;
const { OBJEKT, OBJEKTID, objektOf, ACCOUNT, SPACES, CLIENTS, OFFERS, LEASES, ULD_CLAUSES, KEY_DATES,
        AUDIT, RISK_SOURCES, VAT_RATE, eur, withVat, rent, spaceParts, kkWinter, kkSummer,
        OSAKOND, AMETIKOHAD, TLEPINGUD, TL_ULD, IMPORDITUD, ametikohtHoive,
        DEMO_TODAY, TODAY_EE, NOW_EE, fmtEE, fmtISO, SEED_SHIFT_DAYS } = DB; /* v408: aeg data.js-ist */
/* mitme hoone abistajad: hoonete nimed komplekti kohta + kas ettevõttel on >1 hoonet */
const multiObj = () => OBJEKTID.length > 1;
const hoonedOf = (spaces) => [...new Set(spaces.map(s => objektOf(s).nimi))].join(" + ");

/* --- lepinguliik → vertikaal (konfiguratsioon; spets: „vertikaal = konfiguratsioon + õhuke koodmoodul")
   Ülevaate plokid ja Portfelli tüübikiibid tulenevad siit — uus lepingutüüp on üks rida,
   mitte uus vaade. Tundmatu liik paistab Portfellis ainult „Kõik" all. */
const LIIGID = {
  "Üürileping": "kinnisvara", "Tööleping": "personal",
  "Haldusleping": "teenused", "Hooldusleping": "teenused", "Kindlustusleping": "teenused",
  "Valveleping": "teenused", "Teenusleping": "teenused",
  "Laenuleping": "finants",
};
const VERTIKAALID = {
  kinnisvara: { t: "Üürilepingud" }, teenused: { t: "Teenuslepingud" },
  personal: { t: "Töölepingud" }, finants: { t: "Laenulepingud" },
};
/* imporditud lepingu kodu-objektid: objektId (string|massiiv) või tekstivaste esemest;
   tühi = ettevõttetasemel leping (paistab ainult kogu-portfelli skoobis) */
function impObjektid(x) {
  const ids = [].concat(x.objektId || []).filter(id => DB.objektById(id));
  if (ids.length) return ids;
  return OBJEKTID.filter(o => (x.ese || "").includes(o.nimi)).map(o => o.id);
}
/* imporditud lepingu kuutasu: Üür / Tasu / Preemia; aastasumma → /12 */
function impKuutasu(x) {
  const p = (x.parameetrid || []).find(p => ["Üür", "Tasu", "Preemia"].includes(p[0]));
  if (!p) return null;
  const raw = String(p[1]);
  const n = parseFloat(raw.replace(/[^\d,\.]/g, "").replace(",", ".")) || null;
  return n == null ? null : /aastas/.test(raw) ? n / 12 : n;
}
/* imporditud lepingu lähim tulevane tähtaeg: { kuupaev dd.mm.yyyy, tekst, paev } */
function impJargmine(x) {
  return (x.tahtajad || []).map(t => ({ kuupaev: t.slice(0, 10), tekst: t.slice(13), paev: daysUntil(t.slice(0, 10)) }))
    .filter(t => t.paev >= 0).sort((a, b) => a.paev - b.paev)[0] || null;
}
/* --- KLAUSLIKIHT (klauslid.js): kogu lepingu tekst punktide kaupa ---------------------------
   Vaates on see kokkukeeratud plokk; agent ja omnibox otsivad siit. Kehtiv tekst = Lisa 3 muudetud
   sõnastus, kui see on (`muudetud`), muidu originaal. Viide = leping · osa · punkt · lehekülg. */
let IMP_FOCUS = null;   /* "ÜT|5.2" → View.imporditud.init avab ploki ja kerib punktile */
const klauslidOf = (id) => (typeof KLAUSLID !== "undefined" && KLAUSLID[id]) ? KLAUSLID[id] : null;
const klKey = (p) => p.osa + "|" + p.nr;
function klKehtiv(p) { return p.muudetud ? (p.muudetud.viis === "kehtetu" ? "" : p.muudetud.tekst) : p.tekst; }
function klOsaLbl(p) { return p.osa === "ÜT" ? "ÜT p " : p.osa === "PT" ? "PT p " : p.osa === "L3" ? "Lisa 3 p " : p.osa === "HL" ? "p " : ""; }
function klViide(id, p) { return `${id} · ${klOsaLbl(p)}${p.nr} · lk ${p.lk}`; }
function klFail(id, p) { const k = klauslidOf(id); return p.osa === "L3" && k.lisa3fail ? k.lisa3fail : k.fail; }
const KL_STOP = new Set(["kas","mis","mida","kuidas","millal","kes","kui","palju","on","ja","või","ning","ei","see","selle","sellel","lepingu","leping","lepingus","lepingut","võib","peab","tohib","saab","oma","kohta","järgi","mille","milline","millised","siis","aga","ka","seda","need","mida","meil","meie","siin","olema","olla"]);
/* lihtne tüvestus: eesti sõna muutub lõpust — võrdle eesliidet */
function klTokens(q) { return [...new Set(q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length >= 3 && !KL_STOP.has(w)).map(w => w.length >= 8 ? w.slice(0, 6) : w.length >= 5 ? w.slice(0, 4) : w))]; }
function klOtsi(q, max = 3) {
  const toks = klTokens(q); if (!toks.length) return { hits: [], total: 0, toks };
  const ql = q.toLowerCase();
  const biasHOO = /caverion|hooldus|hooldaja|avarii|väljakutse|tehnosüsteem/.test(ql) ? .6 : 0;
  const biasLEP = /maru|üüri|üürnik|üürileandja|pind|tagatis|parkimis/.test(ql) ? .6 : 0;
  const hits = [], ids = Object.keys(typeof KLAUSLID !== "undefined" ? KLAUSLID : {});
  let total = 0;
  ids.forEach(id => { const k = klauslidOf(id); if (!k) return;
    k.punktid.forEach(p => { total++;
      const txt = ((klKehtiv(p) || p.tekst) + " " + p.pealkiri).toLowerCase();
      let sc = toks.filter(t => txt.includes(t)).length; if (!sc) return;
      sc += id === "HOO-2023-H508" ? biasHOO : biasLEP;
      if (/^Lisa/.test(p.nr)) sc -= .3;   /* lisad on pikad plokid — eelista täpseid punkte */
      hits.push({ id, p, sc }); }); });
  hits.sort((a, b) => b.sc - a.sc || a.p.tekst.length - b.p.tekst.length);
  return { hits: hits.slice(0, max), total, toks, all: hits.length };
}
/* tsitaat: lühike punkt tervikuna; pikk plokk (lisa) → otsisõnadega lause(d) + naaber, ellipsitega */
function klTsitaat(p, toks = [], n = 340) {
  const t = klKehtiv(p) || p.tekst; if (t.length <= n) return t;
  const parts = t.split(/(?<=[.;!?])s+(?=[A-ZÄÖÜÕŠŽ•d(])|s(?=•)/).filter(Boolean);
  const score = x => toks.filter(k => x.toLowerCase().includes(k)).length;
  let best = 0, bi = 0; parts.forEach((x, i) => { const sc = score(x); if (sc > best) { best = sc; bi = i; } });
  let out = parts[bi] || t.slice(0, n), j = bi + 1;
  if (out.length > n) {   /* lause ise on pikk (lisade tabelitekst) → aken esimese (pikima) otsisõna ümber */
    const lo = out.toLowerCase(); const ks = [...toks].sort((x, y) => y.length - x.length); let at = -1;
    for (const k of ks) { at = lo.indexOf(k); if (at >= 0) break; }
    let st = Math.max(0, (at < 0 ? 0 : at) - Math.round(n * .4)); st = st > 0 ? out.indexOf(" ", st) + 1 : 0;
    let en = Math.min(out.length, st + n); en = en < out.length ? out.lastIndexOf(" ", en) : en;
    return (bi > 0 || st > 0 ? "… " : "") + out.slice(st, en).trim() + (en < out.length || j < parts.length ? " …" : "");
  }
  while (j < parts.length && (out + " " + parts[j]).length <= n) { out += " " + parts[j]; j++; }
  return (bi > 0 ? "… " : "") + out + (j < parts.length ? " …" : "");
}
/* agendi vastus klauslitest: tsitaat + viide + originaal õigelt lehelt */
function klauslVastus(q) {
  const r = klOtsi(q, 3);
  if (!r.hits.length) return { ...r, html: `<div>Ei leidnud lepingutest sellele vastet. Otsisin ${r.total} punktist (AS Maru Ehitus üürileping, Caverion hooldusleping). Proovi teise sõnaga, näiteks „allüür", „viivis", „reageerimisaeg".</div>` };
  const muud = r.hits.filter(h => h.p.muudetud).length;
  const html = `<div class="kl-ans">
    ${r.hits.map(h => { const x = DB.impById(h.id); const kehtetu = h.p.muudetud && h.p.muudetud.viis === "kehtetu"; return `
    <div class="kl-hit">
      <div class="kl-ref"><span class="chg">${klViide(h.id, h.p)}</span><span class="muted" style="font-size:14px">${x ? x.pool : ""} · ${h.p.pealkiri.toLowerCase()}</span>
        ${h.p.muudetud ? `<span class="chg alt">${kehtetu ? "kehtetu" : "kehtiv sõnastus"} · ${h.p.muudetud.lisa}</span>` : ""}</div>
      <div class="kl-q">${kehtetu ? `Punkt on ${h.p.muudetud.lisa}-ga kehtetuks tunnistatud. Algne: „${klTsitaat({ tekst: h.p.tekst }, r.toks)}"` : `„${klTsitaat(h.p, r.toks)}"`}</div>
      <div class="kl-b"><button class="btn btn-ghost btn-sm" onclick="openPdf('${klFail(h.id, h.p)}','${h.id} · ${klOsaLbl(h.p)}${h.p.nr}',${h.p.lk})">${I.eye} Originaal · lk ${h.p.lk}</button>
        <a class="btn btn-ghost btn-sm" href="#/imp/${h.id}" onclick="IMP_FOCUS='${klKey(h.p)}'">Ava leping</a></div>
    </div>`; }).join("")}
    <div class="muted" style="font-size:12px;margin-top:8px">Otsisin ${r.total} punktist kahes lepingus · ${r.all} vastet · vastus tsiteerib kehtivat sõnastust (Lisa 3 muudatused arvesse võetud).</div>
  </div>`;
  return { ...r, muud, html };
}
window.klFocus = (key) => { IMP_FOCUS = key; };

/* objekti täituvuse ajalugu graafikuks: oma seeria või ettevõtte koond */
function objektAjalugu(o) { return (o && o.taituvusAjalugu) || DB.TAITUVUS_AJALUGU; }

/* --- ikoonid (inline SVG, stroke) ----------------------------------------- */
const I = {
  grid:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
  building:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M17 21V9h2a2 2 0 0 1 2 2v10"/><path d="M8 7h2M8 11h2M8 15h2"/></svg>`,
  offer:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>`,
  lease:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M16 3H7a2 2 0 0 0-2 2v15l3-2 3 2 3-2 3 2V5a2 2 0 0 0-2-2z"/><path d="M9 8h6M9 12h6"/></svg>`,
  edit:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>`,
  risk:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M12 8v4M12 16h.01"/></svg>`,
  cal:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>`,
  audit:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></svg>`,
  spark:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z"/><path d="M19 14l.7 2.1L22 17l-2.3.8L19 20l-.7-2.2L16 17l2.3-.9z"/></svg>`,
  arrow:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
  /* ThinkOne logomärk — agendi avatar vestluses ja sisendi märk (sama mis omni-mark) */
  mark:   `<svg viewBox="0 0 93 116" fill="currentColor" aria-hidden="true"><path d="M0,33.06v47.14h31.79v-29.6L7.67,31.96h51.52V.17h-26.31c-.55,0-1.1.55-1.64.55L.55,31.42c0,.55-.55,1.1-.55,1.64Z"/><path d="M92.63,82.94v-47.14h-32.34v30.15l24.12,18.09h-50.97v31.79h26.31c.55,0,1.1-.55,1.64-.55l30.69-30.69s.55-1.1.55-1.64Z"/></svg>`,
  eye:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  /* 3D-stiilis PDF-ikoon (paberileht + punane silt) — pakkumuse lisade read */
  pdf3d:  `<svg class="pdf3d" viewBox="0 0 56 64" aria-hidden="true"><path d="M14 6h22l14 14v36a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6z" fill="#B4B2A9"/><path d="M12 3h22l14 14v36a6 6 0 0 1-6 6H12a6 6 0 0 1-6-6V9a6 6 0 0 1 6-6z" fill="#F1EFE8"/><path d="M34 3v10a4 4 0 0 0 4 4h10z" fill="#D3D1C7"/><rect x="12" y="38" width="24" height="4" rx="2" fill="#B4B2A9"/><rect x="12" y="46" width="18" height="4" rx="2" fill="#B4B2A9"/><rect x="12" y="54" width="12" height="4" rx="2" fill="#B4B2A9"/><rect x="2" y="20" width="36" height="16" rx="4" fill="#A32D2D"/><rect x="2" y="18" width="36" height="16" rx="4" fill="#E24B4A"/><rect x="5" y="20" width="30" height="2" rx="1" fill="#F09595"/><text x="20" y="30.5" text-anchor="middle" font-size="11" font-weight="600" fill="#FCEBEB" font-family="Inter, system-ui, sans-serif" letter-spacing=".06em">PDF</text></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>`,
  lock:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  check:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12l4.5 4.5L19 6"/></svg>`,
  x:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  file:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`,
  user:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/></svg>`,
  pin:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 21s7-5.7 7-11a7 7 0 1 0-14 0c0 5.3 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>`,
  car:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13M5 13h14v4H5zM7 17v2M17 17v2"/></svg>`,
  bolt:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>`,
  info:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/></svg>`,
  send:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/></svg>`,
  back:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>`,
  warn:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 3L2 20h20z"/><path d="M12 10v4M12 17h.01"/></svg>`,
  chevD:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9l6 6 6-6"/></svg>`,
  enter:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="9 10 4 15 9 20"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/></svg>`,
  plus:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>`,
  bell:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`,
  clip:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 12.3l-8.2 8.2a6 6 0 0 1-8.5-8.5L12.6 3.7a4 4 0 0 1 5.7 5.7l-8.3 8.3a2 2 0 0 1-2.9-2.9l7.8-7.7"/></svg>`,
  chat:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M8 9h8M8 12.5h5"/></svg>`,
  mic:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
  up:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
  trend:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>`,
  hourglass: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M6 3h12M6 21h12M8 3v4l4 5 4-5V3M8 21v-4l4-5 4 5v4"/></svg>`,
  rows:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8.5 6h12M8.5 12h12M8.5 18h12M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>`,
  euro:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M17.5 6.8A6.5 6.5 0 1 0 17.5 17.2"/><path d="M4.5 10.4h8M4.5 13.6h8"/></svg>`,
  flag:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 21V4"/><path d="M5 4h12l-2.6 4L17 12H5"/></svg>`,
  trash:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v6M14 11v6"/></svg>`,
  /* Kasutaja lisatud brändimärgid; meetodi nimi on kõrval tekstina. */
  smartid: `<img src="lisad/smart-id.png" alt="" width="22" height="22" aria-hidden="true">`,
  mobiilid: `<img src="lisad/mobileid.webp" alt="" width="22" height="22" aria-hidden="true">`,
};

/* võtmekuupäeva tüüp → ikoon + värv (siniste täppide asemel loetav märk) */
const KD_ICON = {
  "Pakkumuse kehtivus": { ic: "offer",     cls: "amber" },
  "Lepingu algus":      { ic: "lease",     cls: "blue" },
  "Indekseerimine":     { ic: "trend",     cls: "accent" },
  "Katseaja lõpp":      { ic: "hourglass", cls: "green" },
  "Palgaülevaatus":     { ic: "euro",      cls: "green" },
  "Lepingu lõpp":       { ic: "flag",      cls: "grey" },
  "Otsustuskoht":       { ic: "warn",      cls: "amber" },
};
const kdIcon = (tyyp) => { const k = KD_ICON[tyyp] || { ic: "cal", cls: "grey" }; return { ic: I[k.ic], cls: k.cls }; };

/* --- demo "tänane" kuupäev (deterministlik, sobitub seemneandmetega) ------- */
/* DEMO_TODAY, TODAY_EE, NOW_EE, fmtEE, fmtISO elavad data.js-is (v408: päris tänane kuupäev + seemne nihe) */
function parseEE(s) { const p = String(s).split(" ")[0].split("."); return new Date(+p[2], +p[1]-1, +p[0]); } /* talub „dd.mm.yyyy hh:mm" */
function daysUntil(eeDate) { return Math.ceil((parseEE(eeDate) - DEMO_TODAY) / 86400000); }

/* --- roll: operaator vs üürnik (kliendiportaal) ----------------------------- */
let ROLE = { role: "op", clientId: null };
try { const r = localStorage.getItem("thinkone_role"); if (r) ROLE = JSON.parse(r); } catch (e) {}
const isClient = () => ROLE.role === "client";
const roleClient = () => DB.clientById(ROLE.clientId) || CLIENTS[2];
let LAST_CLIENT = (ROLE.role === "client" && ROLE.clientId) ? ROLE.clientId : "c-nord";

/* hash (valikuline): jää samale dokumendile, nt pakkumusele rolli vahetades */
function setRole(role, clientId, hash) {
  ROLE = { role, clientId: clientId || null };
  if (role === "client" && clientId) LAST_CLIENT = clientId;
  try { localStorage.setItem("thinkone_role", JSON.stringify(ROLE)); } catch (e) {}
  renderShell();
  location.hash = hash || (role === "client" ? "#/portaal" : "#/");
  router(); // ka siis, kui hash ei muutunud
}
window.setRole = setRole;

/* hüpikmenüüd (.drop) sulguvad väljaspoole klõpsates; AI-sahtel samuti */
document.addEventListener("click", e => {
  document.querySelectorAll(".drop.open").forEach(d => { if (!e.target.closest(".pop-wrap") && !e.target.closest(".omni-wrap") && !e.target.closest(".combo")) d.classList.remove("open"); });
  const cm = document.getElementById("co-menu");
  if (cm && cm.classList.contains("open") && !e.target.closest(".sb-context")) cm.classList.remove("open");
  const pm = document.getElementById("preset-menu");
  if (pm && pm.classList.contains("open") && !e.target.closest(".preset-wrap")) pm.classList.remove("open");
  /* „+ Uus" nupu pluss järgib menüü seisu — väljapoole klõps või menüüvalik sulgeb menüü, pluss pöörab tagasi */
  const lb = document.getElementById("loo-btn"), lp = document.getElementById("loo-pop");
  if (lb && lp) lb.classList.toggle("open", lp.classList.contains("open"));
});

/* kliendile nähtavad dokumendid: mustand/tühistatud on ainult operaatori omad */
const clientSeesOffer = (o) => !["Mustand", "Tühistatud"].includes(o.staatus);
const clientSeesLease = (l) => l.staatus !== "Mustand V1";

/* külgriba sisu rolli järgi (kontekst, kasutaja, lülitusnupp) */
function renderShell() {
  const ctxEl = document.getElementById("sb-context");
  const userEl = document.getElementById("sb-user");
  const swEl = document.getElementById("role-switch");
  if (!ctxEl) return;
  if (isClient()) {
    const c = roleClient();
    const init = c.kontakt.split(" ").map(x => x[0]).join("").slice(0,2).toUpperCase();
    ctxEl.innerHTML = `<div class="lbl">Üürnik · kliendiportaal</div>
      <div class="org">${c.nimi}</div><div class="obj">${OBJEKT.nimi} · ${ACCOUNT.landlord.nimi}</div>`;
    userEl.innerHTML = `<div class="av">${init}</div>
      <div><div class="nm">${c.kontakt}</div><div class="rl">Üürniku esindaja</div></div>`;
    swEl.innerHTML = `${I.eye}<span>Tagasi operaatoriks</span>`; swEl.classList.add("client");
  } else {
    /* ettevõttevahetaja: dropdown külgriba ülaosas (ilma kirjeldusteta) */
    const active = DB.COMPANIES.find(c => c.id === DB.COMPANY_ID);
    ctxEl.innerHTML = `<div class="lbl">Ettevõte</div>
      <button class="co-btn" onclick="toggleCoMenu()" title="Vaheta aktiivset ettevõtet">
        <div class="org">${active.nimi}</div>
        <span class="chev">${I.chevD}</span>
      </button>
      <div class="co-menu" id="co-menu">
        ${DB.COMPANIES.map(c => `
        <button class="co-item ${c.id === DB.COMPANY_ID ? "active" : ""}" onclick="toggleCoMenu();DB.setCompany('${c.id}')">
          <div class="org">${c.nimi}</div>
          ${c.id === DB.COMPANY_ID ? `<span class="tick">${I.check}</span>` : ""}
        </button>`).join("")}
      </div>`;
    userEl.innerHTML = `<div class="av"><img src="lisad/tarmo-sepp.webp" alt="Tarmo Sepp"></div>
      <div><div class="nm">Tarmo Sepp</div><div class="rl">Operaator · Admin</div></div>`;
    swEl.innerHTML = `${I.eye}<span>Vaata üürnikuna</span>`; swEl.classList.remove("client");
  }
  renderUserMenu();
}
window.toggleCoMenu = () => { const m = document.getElementById("co-menu"); if (m) m.classList.toggle("open"); };

/* kasutajamenüü: profiil · ettevõtte vahetus (kui mitu) · lähtesta · logi välja */
function renderUserMenu() {
  const up = document.getElementById("user-pop"); if (!up) return;
  up.innerHTML = `
    <button class="up-item" onclick="toast('Profiil ja konto seaded — demos illustratiivne')">${I.user.replace('<svg','<svg class="ic"')}<span>Profiil</span></button>
    <button class="up-item" onclick="if(confirm('Lähtesta demo algseisu? Kõik sisestatud andmed kustuvad.')) DB.reset()">${I.warn.replace('<svg','<svg class="ic"')}<span>Lähtesta demo</span></button>
    <button class="up-item" onclick="toast('Väljalogimine — demos illustratiivne')">${I.back.replace('<svg','<svg class="ic"')}<span>Logi välja</span></button>`;
}

/* --- staatuse → pill stiil ------------------------------------------------- */
/* ÜKS olekukaart (kasutab ka kujundusgalerii): olek → semantika.
   success = kehtiv/lõpetatud hästi · warning = ootab tähelepanu/kinnitust (sh Ootel, Lahendamisel — tegevus MINU laual)
   error = viga/lõppolek halvasti · info = informatiivne edenemisolek · neutral = mustand/lõppenud/kategooria */
const STATUS = {
  // pinnad
  "Vaba": "success", "Üüritud": "neutral", "Lepingus": "info", "Reserveeritud": "warning", "Pakkumusel": "info",
  // pakkumus
  "Mustand": "neutral", "Saadetud": "info", "Kliendi ettepanek": "warning", "Aktsepteeritud": "success",
  "Lepinguks teisendatud": "success",
  "Tagasi lükatud": "error", "Aegunud": "neutral", "Tühistatud": "error",
  // leping
  "Kehtiv": "success", "Allkirjastatud": "success", "Allkirjastamisel": "warning", "Lõppenud": "neutral",
  "Mustand V1": "neutral",
  // risk
  "MADAL": "success", "KESKMINE": "warning", "KÕRGE": "error",
  // kommentaar / kliendi tegevus ootab operaatori otsust
  "Ootel": "warning",
  // lõim käib: viimane sõna on öeldud, otsust veel pole
  "Arutelul": "warning",
  // operaatori ettepanek (uus sõnastus või selgitus) ootab üürniku kinnitust
  "Ootab kinnitust": "warning",
  // küsimus sai vastuse, muudatust ei sündinud — neutraalne informatiivne lõpp
  "Selgitatud": "info",
  // üürnik kinnitas operaatori ettepaneku — kommentaari lõppolek (kuvanimi; sisemine väärtus on Aktsepteeritud)
  "Kinnitatud": "success",
  // punktil on lahtine kommentaar (Ootel või Ootab kinnitust) — dokumendirea kuvanimi
  "Lahendamisel": "warning",
  // muudatusring (kehtiva lepingu muudatus → uus lisa)
  "Koostamisel": "neutral", "Kinnitamisel": "warning", "Jõustunud": "success", "Teavitatud": "warning",
  // eritingimus mustandis: operaatori ettepanek (klient pole veel näinud)
  "Ettepanek": "info", "Sõnastamisel": "warning",
  // ametikoht (hõive projektsioon) + import
  "Täidetud": "neutral", "Täitmata": "neutral", "Osaline hõive": "warning", "Pakkumisel": "info", "Imporditud": "neutral",
};
/* legacy värvinimed (kutsed pill(x, "green") jne) → semantika */
const PILL_KIND = { green: "success", amber: "warning", red: "error", blue: "info", teal: "info", grey: "neutral", ink: "neutral", accent: "primary" };
/* staatuseikon: edenemisring (dashed mustand → veerand/pool/kolmveerand → täis-linnuke; X/kriips lõppolekud) */
const PILL_SHAPE = {
  "Mustand": "dashed", "Mustand V1": "dashed", "Täitmata": "dashed", "Koostamisel": "dashed",
  "Kinnitamisel": "half", "Jõustunud": "full",
  "Vaba": "empty", "Imporditud": "empty",
  "Saadetud": "quarter", "Pakkumusel": "quarter", "Pakkumisel": "quarter",
  "Kliendi ettepanek": "half", "Ootel": "half", "Reserveeritud": "half", "Osaline hõive": "half", "KESKMINE": "half",
  "Arutelul": "quarter",
  "Ootab kinnitust": "three", "Lahendamisel": "half",
  "Lepingus": "three", "Aktsepteeritud": "three", "Allkirjastamisel": "three", "Lepinguks teisendatud": "full",
  "Kehtiv": "full", "Allkirjastatud": "full", "Üüritud": "full", "Täidetud": "full", "MADAL": "full", "Selgitatud": "full", "Kinnitatud": "full",
  "Tagasi lükatud": "x", "Tühistatud": "x", "KÕRGE": "bang",
  "Aegunud": "minus", "Lõppenud": "minus",
};
function stIcon(shape) {
  const ring = `<circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" stroke-width="1.3"/>`;
  const disc = `<circle cx="8" cy="8" r="6.6" fill="currentColor"/>`;
  const inner = {
    dashed:  `<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-dasharray="2.4 2.3" stroke-linecap="round"/>`,
    empty:   `<circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" stroke-width="1.7"/>`,
    quarter: ring + `<path d="M8 8 V3.4 A4.6 4.6 0 0 1 12.6 8 Z" fill="currentColor"/>`,
    half:    ring + `<path d="M8 3.4 A4.6 4.6 0 0 1 8 12.6 Z" fill="currentColor"/>`,
    three:   ring + `<path d="M8 8 V3.4 A4.6 4.6 0 1 1 3.4 8 Z" fill="currentColor"/>`,
    full:    disc + `<path d="M5.2 8.3l1.9 1.9 3.7-4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    x:       disc + `<path d="M5.9 5.9l4.2 4.2M10.1 5.9l-4.2 4.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
    minus:   disc + `<path d="M5.3 8h5.4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
    bang:    disc + `<path d="M8 4.6v4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.3" r="1" fill="#fff"/>`,
  }[shape];
  return `<svg viewBox="0 0 16 16">${inner}</svg>`;
}
/* Badge: semantiline paar (värv + pehme taust) + edenemisikoon; olekute nimed ja ikoonid säilivad */
/* avatar-initsiaalid: helesinine ring + koobalt (viide) */
const initials = (name) => String(name || "").replace(/\b(OÜ|AS|MTÜ|SA|FIE)\b/g, "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";
const avatar = (name, cls = "") => `<span class="av-i ${cls}" aria-hidden="true">${initials(name)}</span>`;
const pill = (txt, kind) => {
  const shape = PILL_SHAPE[txt];
  const ic = shape ? `<span class="st">${stIcon(shape)}</span>` : `<i class="dot"></i>`;
  const sem = (kind && (PILL_KIND[kind] || kind)) || STATUS[txt] || "neutral";
  return `<span class="pill ${sem}">${ic}${txt}</span>`;
};

/* --- olekuredel (mini-progress dashboardi ridadel) -------------------------- */
const OFFER_LADDER = { "Mustand": 0, "Saadetud": 1, "Kliendi ettepanek": 1, "Aktsepteeritud": 2 };
const LEASE_LADDER = { "Mustand V1": 0, "Saadetud": 1, "Kõik aktsepteeritud": 2, "Allkirjastamisel": 3, "Kehtiv": 4 };
function ladder(nSteps, idx, label, tone) {
  if (idx == null) return pill(label); // lõppolekud (Aegunud jms) jäävad pilliks
  const dots = Array.from({ length: nSteps }, (_, i) =>
    `<i class="${i < idx ? "done" : i === idx ? "cur" + (tone === "amber" ? " amb" : "") : ""}"></i>`
  ).join("<b></b>");
  return `<div class="ladder-wrap"><div class="ladder">${dots}</div><div class="llbl">${label}</div></div>`;
}
const offerLadder = (st) => ladder(3, OFFER_LADDER[st], st, st === "Kliendi ettepanek" ? "amber" : null);
const leaseLadder = (st) => ladder(5, LEASE_LADDER[st], st);

/* --- üldtingimuste täistekst (genereeritud Üürileping.docx-ist) ------------ */
const ULD_FULL = window.ULD_FULL || [];

/* --- Põhitingimused = tehingufaktid + malli laused -------------------------
   Faktid elavad lepingu `tehing` objektis (algus ISO, kuud, hind €/m²,
   tagatisKuud, parkimine, otstarve, erisused). Laused genereeritakse faktidest;
   mustandis on faktid OTSE lausetes muudetavad (inline-väljad) ja tuletatud
   väärtused (kuusüür, tagatissumma, periood) kirjutavad end ise uueks. */
const FACT_LABELS = { algus: "Üleandmispäev", kuud: "Lepingu tähtaeg", hind: "Üür (€/m² kuus)",
  tagatisKuud: "Tagatis", parkimine: "Parkimiskohad", otstarve: "Kasutusotstarve",
  erisused: "Tähtaja erisused", kuusYyr: "Kuusüür", tagatis: "Tagatisraha", periood: "Periood",
  kuudN: "Kestus", m2: "Üldpind" };
/* fakti muutus → millised tuletatud väärtused sähvatavad uuenemisest */
const FACT_DERIVED = { hind: ["kuusYyr", "tagatis"], tagatisKuud: ["tagatis"],
  algus: ["periood"], kuud: ["periood", "kuudN"] };
/* põhitingimuse ref → tehingufakt (otsemuutmine läbirääkimistel; muudatusring kehtival) */
const FACT_OF_REF = { "P 2.2": "parkimine", "P 2.3": "algus", "P 2.4": "otstarve",
  "P 3.1": "hind", "P 4.1": "tagatisKuud", "P 5.1": "kuud", "P 5.2": "erisused" };
/* punktid, mille sisu tuleb registrist/mallist, mitte tehingust — allika-märgis */
const POHI_SRC = { "P 1.1": "profiilist", "P 1.2": "kliendiregistrist", "P 2.1": "pinnakaardilt",
  "P 3.2": "mallist", "P 6.1": "profiilist", "P 6.2": "kliendikaardilt" };
let FACT_FLASH = null; /* {id, keys} — pärast fakti muutust sähvatavad seotud väärtused */

function addKuudISO(iso, kuud) {
  const p = iso.split("-").map(Number);
  const d = new Date(p[0], p[1] - 1 + kuud, p[2]); d.setDate(d.getDate() - 1);
  return d;
}
function eeToISO(ee) { const p = String(ee).split("."); return `${p[2]}-${p[1]}-${p[0]}`; }

/* Põhitingimused originaalmalli (Üürileping.docx) struktuuris: nummerdatud sektsioonid,
   täislaused tehingufaktidest. Refid "P x.y" — prefiks hoiab lahus üldtingimuste x.y refidest
   (muidu põrkuks nt põhi 5.2 ja üld 5.2 kommentaarid).
   a = { cl, ct, sp, facts, edit } · mk(key, txt, muudetav?) mähib faktid vaates. */
function pohiTehing(a, mk) {
  const L = ACCOUNT.landlord, E = L.esindajad || {};
  const f = a.facts, sp = a.sp;
  const kt = a.ct || {};
  const kNimi = kt.nimi || a.cl.kontakt, kEpost = kt.epost || a.cl.epost, kTel = kt.tel || a.cl.tel || "";
  const algusEE = isoToEE(f.algus), loppEE = fmtEE(addKuudISO(f.algus, f.kuud));
  const kuusYyr = sp.yyripind * f.hind, tagatis = kuusYyr * f.tagatisKuud;
  const m = mk || ((k, t) => t);            /* tuletatud väärtus (arvutub ise) */
  const e = mk ? (k, t) => mk(k, t, true) : m; /* muudetav tehingufakt */
  const aastadTxt = f.kuud % 12 === 0 ? `${f.kuud / 12} aastaks` : `${f.kuud} kuuks`;
  return [
    { sec: "1. Pooled", ref: "P 1.1", pealkiri: "Üürileandja", vaartus: `${L.nimi} · reg ${L.registrikood} · KMKR ${L.kmkr} · ${L.aadress} · ${L.epost} · ${L.mobiil}${L.pank ? ` · ${L.pank}, ${L.iban}` : ""}` },
    { ref: "P 1.2", pealkiri: "Üürnik", vaartus: `${a.cl.nimi} · reg ${a.cl.registrikood}${a.cl.kmkr ? ` · KMKR ${a.cl.kmkr}` : ""} · ${a.cl.aadress} · ${kEpost}${kTel ? ` · ${kTel}` : ""}` },
    { sec: "2. Üüripind", ref: "P 2.1", pealkiri: "Üüripind", vaartus: `Lepingu esemeks on aadressil ${objektOf(sp).ehr.aadress} asuvas hoones (Hoone) paiknev ${sp.nimi} üldpinnaga ${m("m2", eur(sp.yyripind, 1) + " m²")} (Üüripind) — ${sp.tyyp} —, mille asukoht ja piirid on näidatud Lepingu lisas nr 1 toodud plaanil.` },
    { ref: "P 2.2", pealkiri: "Parkimiskohad", vaartus: (a.edit || f.parkimine > 0) ? `${e("parkimine", f.parkimine)} parkimiskohta. Parkimiskohtade kasutustasu sisaldub Üüris.` : "Leping ei sisalda parkimiskohti." },
    { ref: "P 2.3", pealkiri: "Üüripinna üleandmine", vaartus: `Üleandmispäev on ${e("algus", algusEE)}. Üüripind antakse Üürniku valdusesse kahepoolse üleandmis-vastuvõtmisakti alusel.` },
    { ref: "P 2.4", pealkiri: "Kasutusotstarve", vaartus: e("otstarve", f.otstarve || "Üüripinda võib kasutada üksnes büroo-, lao- ja tootmispinnana.") },
    { sec: "3. Üür", ref: "P 3.1", pealkiri: "Üür", vaartus: `EUR ${e("hind", eur(f.hind))} Üüripinna ühe ruutmeetri kohta kuus — kokku ${m("kuusYyr", eur(kuusYyr) + " €/kuus")} (neto), millele lisandub käibemaks õigusaktides kehtestatud suuruses. Parkimiskohtade kasutustasu sisaldub Üüris.` },
    { ref: "P 3.2", pealkiri: "Kõrvalkulud", vaartus: "Üürnik kohustub tasuma Üürileandja esitatud kommunaal-, haldus- ja lisateenuste arved Üldtingimustes sätestatud korras." },
    { sec: "4. Tagatis", ref: "P 4.1", pealkiri: "Tagatise summa", vaartus: `Üürnik tasub Lepingu allkirjastamisel arve alusel tagatisraha ${e("tagatisKuud", f.tagatisKuud + " kuu")} Üüri ulatuses — ${m("tagatis", eur(tagatis) + " €")} (lisandub käibemaks).` },
    { sec: "5. Tähtaeg", ref: "P 5.1", pealkiri: "Lepingu tähtaeg", vaartus: `Leping on sõlmitud tähtajaliselt ${e("kuud", aastadTxt)} alates Üleandmispäevast: ${m("periood", `${algusEE} – ${loppEE}`)} (${m("kuudN", f.kuud + " kuud")}).` },
    { ref: "P 5.2", pealkiri: "Tähtaja erisused", vaartus: e("erisused", f.erisused || "Puuduvad.") },
    { sec: "6. Poolte esindajad", ref: "P 6.1", pealkiri: "Üürileandja esindajad", vaartus: `Lepingulistes küsimustes: ${E.lepingulised || L.epost} · Halduskorralduses: ${E.haldus || L.epost} · Arveldustes: ${E.arveldused || L.epost}` },
    { ref: "P 6.2", pealkiri: "Üürniku esindajad", vaartus: `Lepingulistes, tehnilistes küsimustes ja arveldustes: ${kNimi} · ${kEpost}${kTel ? ` · ${kTel}` : ""}` },
  ];
}

/* enne v170 loodud mustand localStorage'is — faktid tuletatakse olemasolevast */
function ensureTehing(l) {
  if (l.tehing) return l.tehing;
  const sp = DB.spaceById(l.spaceId);
  const g = (ref) => { const r = (l.pohi || []).find(x => x.ref === ref); return r ? r.vaartus : ""; };
  const hM = g("P 3.1").match(/EUR\s+([\d\s ]+,\d+|\d+(?:[.,]\d+)?)/);
  const hind = hM ? parseFloat(hM[1].replace(/[\s ]/g, "").replace(",", ".")) : sp.hind;
  l.tehing = { algus: eeToISO(l.algus), kuud: l.pikkusKuud, hind, tagatisKuud: 3,
    parkimine: sp.parkimine, otstarve: g("P 2.4") || null, erisused: g("P 5.2") || null };
  return l.tehing;
}

/* fakt muutus → laused, lepingu kuupäevad ja indekseerimise tähtpäev uuenevad */
function rebuildPohi(l) {
  const f = l.tehing, sp = DB.spaceById(l.spaceId), cl = DB.clientById(l.clientId);
  const old = l.pohi || [];
  l.pohi = pohiTehing({ cl, ct: l.kontakt || null, sp, facts: f });
  l.pohi.forEach(p => { const o = old.find(x => x.ref === p.ref); if (o && o.muudetud) { p.muudetud = o.muudetud; if (o.otse) p.otse = o.otse; if (o.muudatusLisa) p.muudatusLisa = o.muudatusLisa; } });
  l.algus = isoToEE(f.algus);
  l.lopp = fmtEE(addKuudISO(f.algus, f.kuud));
  l.pikkusKuud = f.kuud;
  const ind = addYearsISO(f.algus, 1); ind.setDate(ind.getDate() + 1);
  l.indeks.jargmine = fmtEE(ind);
}

/* Pooled ja esindajad (P 1.x, P 6.x) struktuurselt: registriandmed võtmeplaatidena.
   Ainult vaate kuju — salvestatav l.pohi jääb tekstiks (sheet + kommentaarid). */
function pooledKV(ref, cl, kontakt, editRep) {
  const L = ACCOUNT.landlord, E = L.esindajad || {};
  const kt = kontakt || {};
  const kNimi = kt.nimi || cl.kontakt, kEpost = kt.epost || cl.epost, kTel = kt.tel || cl.tel || "";
  const c = (lbl, val, mono) => val ? `<div class="pkv-c"><span>${lbl}</span><b${mono ? ' class="mono"' : ""}>${val}</b></div>` : "";
  if (ref === "P 1.1") return `<div class="pkv-nimi">${L.nimi}</div><div class="pkv">
    ${c("Registrikood", L.registrikood, 1)}${c("KMKR", L.kmkr, 1)}${c("Aadress", L.aadress)}
    ${c("E-post", L.epost)}${c("Telefon", L.mobiil, 1)}${L.pank ? c("Pank · IBAN", `${L.pank} · ${L.iban}`, 1) : ""}</div>`;
  if (ref === "P 1.2") return `<div class="pkv-nimi">${cl.nimi}</div><div class="pkv">
    ${c("Registrikood", cl.registrikood, 1)}${cl.kmkr ? c("KMKR", cl.kmkr, 1) : ""}${c("Aadress", cl.aadress)}
    ${c("Kontaktisik", kNimi)}${c("E-post", kEpost)}${kTel ? c("Telefon", kTel, 1) : ""}</div>`;
  if (ref === "P 6.1") return `<div class="pkv">
    ${c("Lepingulised küsimused", E.lepingulised || L.epost)}${c("Halduskorraldus", E.haldus || L.epost)}${c("Arveldused", E.arveldused || L.epost)}</div>`;
  if (ref === "P 6.2") {
    /* üürnik muudab OMA esindaja andmeid otse plaatidel — salvestub lepingu
       kontaktina (l.kontakt), mitte kliendiregistrisse */
    if (editRep) { const esc = (s) => String(s || "").replace(/"/g, "&quot;");
      const inp = (lbl, k, v) => `<div class="pkv-c"><span>${lbl}</span><input class="rep-in" data-k="${k}" value="${esc(v)}" aria-label="${lbl}"></div>`;
      return `<div class="pkv">${inp("Esindaja", "nimi", kNimi)}${inp("E-post", "epost", kEpost)}${inp("Telefon", "tel", kTel)}</div>
      <div class="pkv-note">lepingulistes, tehnilistes küsimustes ja arveldustes · teie andmed, muudatus salvestub kohe</div>`; }
    return `<div class="pkv">
    ${c("Esindaja", kNimi)}${c("E-post", kEpost)}${kTel ? c("Telefon", kTel, 1) : ""}</div>
    <div class="pkv-note">lepingulistes, tehnilistes küsimustes ja arveldustes</div>`;
  }
  return null;
}

/* lahtine kommentaar = punkt pole lõplikult lahendatud: kas ootab operaatori
   otsust (Ootel) või üürniku kinnitust operaatori ettepanekule (Ootab kinnitust) */
const cmtOpen = (c) => c.staatus === "Ootel" || c.staatus === "Ootab kinnitust";
/* kelle käes on pall lahtisel punktil: VIIMANE SÕNA otsustab. Üürniku sõna järel
   ootab punkt üürileandja vastust (üürnik ei kirjuta juurde); kui üürileandja
   küsis arutelus viimasena, on kord üürnikul. */
const cmtOotabOp = (c) => {
  if (!c || c.staatus !== "Ootel") return false;
  const aru = c.arutelu || [];
  return !aru.length || aru[aru.length - 1].roll === "klient";
};
/* kommentaari staatuse KUVANIMI: sisemine „Aktsepteeritud" näidatakse „Kinnitatud" */
const cmtPill = (s) => s === "Aktsepteeritud" ? "Kinnitatud" : s;
/* --- lõime osapooled: kumb räägib, peab olema näha ilma nime lugemata ---------
   Üürnik = hall kaart + hele märk (sissetulev hääl); üürileandja = valge kaart +
   tume märk (dokumendi enda hääl). Staatusevärvid jäävad AINULT staatusele. */
const thTenant = (roll, autor) => roll === "klient" || /\(üürnik\)/i.test(autor || "");
const thSkin = (roll, autor) => thTenant(roll, autor) ? "th-tenant" : "th-lessor";
const thHead = (roll, autor, aeg) => {
  const t = thTenant(roll, autor);
  const nimi = String(autor || "").replace(/\s*\(üürnik\)\s*$/i, "").replace(/^Operaator\s*·\s*/i, "");
  return `<div class="th-head">
    <span class="th-av ${t ? "tenant" : "lessor"}">${t ? I.user : I.building}</span>
    <span class="th-id"><b>${nimi}</b><small>${t ? "Üürnik" : "Üürileandja"}${isClient() === t ? " · sina" : ""}</small></span>
    <span class="when">${aeg}</span></div>`;
};

/* AI-sõnastaja (demo simulatsioon): loeb üürniku ettepanekut JA lõime arutelu
   ning pakub juriidilise sõnastuse — operaator kinnitab enne avaldamist */
function aiSonasta(e) {
  const ky = e.kirjutabYle || "";
  if (/4\.1/.test(ky)) return "Erandina Põhitingimuste punktist 4.1 on tagatisraha suuruseks 2 (kahe) kuu Üür, tingimusel et Üürnik esitab Üürileandjale emaettevõtte garantiikirja hiljemalt Üleandmispäevaks. Garantiikirja tähtaegsel esitamata jätmisel kohaldub tagatisraha 3 (kolme) kuu Üüri ulatuses.";
  const base = (e.algne || e.tekst || "").replace(/\s+/g, " ").trim().replace(/[?.!]+$/, "");
  const siht = ky.replace(/^Üld · |^Põhi · /, "").split(" (")[0];
  return `Pooled on kokku leppinud: ${base.charAt(0).toLowerCase() + base.slice(1)}. Käesolev eritingimus on ülimuslik${siht ? ` ${siht}` : ""} suhtes ning jõustub Lepingu allkirjastamisega.`;
}

/* mustandi vaade: fakt renderdub lauses sisendina (muudetav) või esiletõstuna (tuletatud) */
function factMark(facts) {
  const kuudOpts = [...new Set([12, 24, 36, 60, 120, facts.kuud])].sort((x, y) => x - y);
  const tagOpts = [...new Set([1, 2, 3, 6, facts.tagatisKuud])].sort((x, y) => x - y);
  return (k, txt, muudetav) => {
    if (!muudetav) return `<span class="fact" data-f="${k}">${txt}</span>`;
    if (k === "algus") return `<input class="fact-in" data-f="algus" type="date" value="${facts.algus}" aria-label="${FACT_LABELS.algus}">`;
    if (k === "hind") return `<input class="fact-in" data-f="hind" type="number" step="0.05" min="0.5" value="${facts.hind}" style="width:5.6em" aria-label="${FACT_LABELS.hind}">`;
    if (k === "parkimine") return `<input class="fact-in" data-f="parkimine" type="number" step="1" min="0" value="${facts.parkimine}" style="width:4em" aria-label="${FACT_LABELS.parkimine}">`;
    if (k === "kuud") return `<select class="fact-in" data-f="kuud" aria-label="${FACT_LABELS.kuud}">${kuudOpts.map(v => `<option value="${v}" ${v === facts.kuud ? "selected" : ""}>${v % 12 === 0 ? (v / 12) + " aastaks" : v + " kuuks"}</option>`).join("")}</select>`;
    if (k === "tagatisKuud") return `<select class="fact-in" data-f="tagatisKuud" aria-label="${FACT_LABELS.tagatisKuud}">${tagOpts.map(v => `<option value="${v}" ${v === facts.tagatisKuud ? "selected" : ""}>${v} kuu</option>`).join("")}</select>`;
    /* otstarve, erisused — vaba tekst täisreana */
    return `<input class="fact-in wide" data-f="${k}" type="text" value="${String(txt).replace(/"/g, "&quot;")}" aria-label="${FACT_LABELS[k] || k}">`;
  };
}

/* --- PDF-vaatur ------------------------------------------------------------ */
let PDF_OPENER = null;
function openPdf(src, title, page) {
  PDF_OPENER = document.activeElement;
  if (!src || !/\.pdf$/i.test(src)) { toast("Sellel lisal pole faili — dokument genereeritakse süsteemis"); return; }
  document.getElementById("pdftitle").textContent = (title || src.split("/").pop()) + (page ? ` · lk ${page}` : "");
  const fr = document.getElementById("pdfframe"), ht = document.getElementById("pdfhtml");
  fr.style.display = ""; fr.src = src + (page ? "#page=" + page : "");   /* Chrome'i PDF-vaatur avab õigelt leheküljelt */
  if (ht) { ht.style.display = "none"; ht.innerHTML = ""; }
  const op = document.getElementById("pdfopen"); op.style.display = ""; op.href = src;
  document.getElementById("pdfmodal").classList.add("open");
}
/* Muudatuskokkulepe Lisa N (muudatusring) — sama modaal, HTML-eelvaade */
function openLisaN(leaseId, nr) {
  const l = DB.leaseById(leaseId); if (!l) return;
  const r = (l.muudatused || []).find(m => m.nr === nr); if (!r) return;
  document.getElementById("pdftitle").textContent = `Lisa ${r.nr} · Eritingimused (muudatus) · ${l.id}`;
  const fr = document.getElementById("pdfframe"), ht = document.getElementById("pdfhtml");
  fr.style.display = "none"; fr.src = "about:blank";
  document.getElementById("pdfopen").style.display = "none";
  ht.style.display = "block"; ht.innerHTML = annexSheetHTML(l, r).replace("sheet-embed a4-src", "");
  document.getElementById("pdfmodal").classList.add("open");
}
/* Lisa 3 on genereeritud dokument (mitte fail) — sama modaal, HTML-eelvaade */
function openLisa3(leaseId) {
  const l = DB.leaseById(leaseId); if (!l) return;
  if (!l.eri.filter(e => !e.sonastamisel).length) { toast("Kinnitatud eritingimusi veel pole — Lisa 3 genereeritakse nende kinnitamisel"); return; }
  document.getElementById("pdftitle").textContent = `Lisa 3 · Eritingimused · ${l.id}`;
  const fr = document.getElementById("pdfframe"), ht = document.getElementById("pdfhtml");
  fr.style.display = "none"; fr.src = "about:blank";
  document.getElementById("pdfopen").style.display = "none";
  ht.style.display = "block"; ht.innerHTML = lisa3SheetHTML(l).replace("sheet-embed a4-src", "");
  document.getElementById("pdfmodal").classList.add("open");
}
function closePdf() {
  if (PDF_OPENER && PDF_OPENER.isConnected && document.getElementById("pdfmodal")?.classList.contains("open")) { try { PDF_OPENER.focus(); } catch (e) {} }
  PDF_OPENER = null;
  document.getElementById("pdfmodal").classList.remove("open");
  const fr = document.getElementById("pdfframe"); fr.src = "about:blank"; fr.style.display = "";
  document.getElementById("pdfopen").style.display = "";
  const ht = document.getElementById("pdfhtml"); if (ht) { ht.style.display = "none"; ht.innerHTML = ""; }
}
window.openPdf = openPdf; window.closePdf = closePdf; window.openLisa3 = openLisa3; window.openLisaN = openLisaN;

/* --- offer / lease arvutusi ------------------------------------------------
   Hind pinna kohta pakkumuses, kolm taset:
   1) hinnakirja hind (sp.hind)
   2) erihind (o.hinnad[spaceId] — üks number)
   3) hinnagraafik (o.graafik[spaceId] — astmeline üür: [{kuniKuu, hind}, …, {kuniKuu:null, hind}])
   Põhihind = viimase astme hind; sellest arvestatakse tagatis ja indekseerimine. */
function offerPriceRows(offer, sp) {
  const g = offer.graafik && offer.graafik[sp.id];
  if (g && g.length) return g;
  const h = (offer.hinnad && offer.hinnad[sp.id] != null) ? offer.hinnad[sp.id] : sp.hind;
  return [{ kuniKuu: null, hind: h }];
}
function offerPrice(offer, sp) { const r = offerPriceRows(offer, sp); return r[r.length - 1].hind; }
function pricePeriods(offer, sp) {
  let from = 1;
  return offerPriceRows(offer, sp).map(p => { const seg = { from, to: p.kuniKuu, hind: p.hind, rent: sp.yyripind * p.hind }; from = (p.kuniKuu || 0) + 1; return seg; });
}
function perLabel(from, to) { return to == null ? `alates ${from}. kuust` : `${from}.–${to}. kuu`; }
function offerTotals(offer) {
  const spaces = offer.spaceIds.map(DB.spaceById);
  const rows = spaces.map(sp => { const periods = pricePeriods(offer, sp); const base = periods[periods.length - 1];
    return { sp, periods, hind: base.hind, rent: base.rent, astmeline: periods.length > 1 }; });
  const rentSum = rows.reduce((s, r) => s + r.rent, 0); // põhihindade järgi
  const astmeline = rows.some(r => r.astmeline);
  let segments = null, avgM2 = 0, avgSum = 0;
  if (astmeline) {
    /* ühisperioodid: kõigi pindade astmepiirid koos, summa segmendi kaupa */
    const bounds = [...new Set(rows.flatMap(r => r.periods.map(p => p.to).filter(x => x != null)))].sort((a, b) => a - b);
    let from = 1;
    segments = [...bounds, null].map(end => {
      const sum = rows.reduce((s, r) => s + r.periods.find(x => x.to == null || x.to >= from).rent, 0);
      const seg = { from, to: end, sum }; from = (end || 0) + 1; return seg;
    });
    const kuud = offer.pikkusKuud || 0;
    let tot = 0;
    segments.forEach(sg => { const b = Math.min(sg.to || kuud, kuud); if (b >= sg.from) tot += sg.sum * (b - sg.from + 1); });
    avgSum = kuud ? tot / kuud : 0;
    const m2tot = spaces.reduce((s, sp) => s + sp.yyripind, 0);
    avgM2 = m2tot ? avgSum / m2tot : 0;
  }
  const kkWin = spaces.reduce((s, sp) => s + kkWinter(sp), 0);
  const kkSum = spaces.reduce((s, sp) => s + kkSummer(sp), 0);
  return { spaces, rows, rentSum, astmeline, segments, avgM2, avgSum, kuud: offer.pikkusKuud,
           kkWin, kkSum, parking: spaces.reduce((s, sp) => s + sp.parkimine, 0) };
}
/* pakkumuse kontaktisik: pakkumusele salvestatu või vaikimisi kliendi andmed */
function offerContact(o, cl) { return o.kontakt || { nimi: cl.kontakt, epost: cl.epost, tel: cl.tel || "" }; }

/* hinnagraafik → automaatne eritingimus (voolab lepingu Lisa 3-e, kirjutab üle p 3.1) */
function syncGraafikEri(o) {
  o.eritingimused = (o.eritingimused || []).filter(e => !e.autoGraafik);
  o.spaceIds.map(DB.spaceById).forEach(sp => {
    const periods = pricePeriods(o, sp);
    if (periods.length < 2) return;
    const tekst = `Astmeline üür (${sp.nimi}): ` +
      periods.map(p => `${perLabel(p.from, p.to)} ${eur(p.hind)} €/m² (${eur(p.rent)} €/kuus)`).join("; ") +
      `. Tagatisraha arvestatakse põhihinnast ${eur(periods[periods.length - 1].hind)} €/m²; indekseerimine rakendub pärast viimase astme jõustumist.`;
    o.eritingimused.push({ id: "eg-" + sp.id, tekst, kirjutabYle: "Põhi · Üür (p 3.1)", autoGraafik: true });
  });
}

/* ==========================================================================
   VAATED
   ======================================================================== */
const View = {};

/* ---------- Dashboard (minimaalne: AI-agent fookuses, kõik muu peidus) ------ */

/* „Vajab tegevust täna" — prioriseeritud tegutsemisvajaduse, mitte staatuse järgi */
function buildActs() {
  const acts = []; /* ty: off = pakkumus (sinine) · lease = üürileping (petrooleum) · tl = tööleping (roheline) */
  OFFERS.forEach(o => { const cl = DB.clientById(o.clientId);
    if (o.staatus === "Kliendi ettepanek") acts.push({ pri: 0, ty: "off", href: `#/pakkumus/${o.id}`, ic: I.edit, t: `${cl.nimi} — ettepanek ootab vastust`, s: `${o.id} · pakkumus`, pill: ["vasta","ink"] });
    else if (o.staatus === "Saadetud") { const d = daysUntil(o.kehtivKuni);
      if (d >= 0 && d <= 7) acts.push({ pri: 1, ty: "off", href: `#/pakkumus/${o.id}`, ic: I.offer, t: `${cl.nimi} — pakkumus aegumas`, s: `${o.id} · kehtib kuni ${o.kehtivKuni}`, pill: [d + " päeva","grey"] }); }
    else if (o.staatus === "Mustand") acts.push({ pri: 2, ty: "off", href: `#/pakkumus/${o.id}`, ic: I.offer, t: `${cl.nimi} — mustand valmis saatmiseks`, s: `${o.id} · pakkumus`, pill: ["mustand","grey"] });
  });
  LEASES.forEach(l => { const cl = DB.clientById(l.clientId);
    const cn = (l.kommentaarid||[]).filter(c => c.staatus === "Ootel").length;
    /* kehtival lepingul on lahtine kommentaar muudatusettepanek */
    if (cn) acts.push({ pri: 0, ty: "lease", href: `#/leping/${l.id}`, ic: I.lease,
      t: `${cl.nimi} — ${cn} ${l.staatus === "Kehtiv" ? (cn > 1 ? "muudatusettepanekut" : "muudatusettepanek") : (cn > 1 ? "kommentaari" : "kommentaar")} ootab otsust`,
      s: `${l.id} · üürileping`, pill: ["vasta","ink"] });
    if (l.lopetamine && l.lopetamine.staatus === "Teavitatud") acts.push({ pri: 0, ty: "lease", href: `#/leping/${l.id}`, ic: I.warn,
      t: `${cl.nimi} — lõpetamisteade ootab teadmiseks võtmist`, s: `${l.id} · lõpeb ${l.lopetamine.loppKuupaev}`, pill: ["vasta","ink"] });
  });
  TLEPINGUD.filter(t => t.staatus === "Saadetud").forEach(t => { const a = DB.ametikohtById(t.ametikohtId);
    acts.push({ pri: 3, ty: "tl", href: `#/tooleping/${t.id}`, ic: I.user, t: `${t.isik} — tööpakkumine kandidaadil`, s: `${t.id} · ${a.nimi}`, pill: ["ootel","grey"] });
  });
  return acts.sort((a,b) => a.pri - b.pri);
}

/* täituvuse joongraafik kuude lõikes (Ülevaade; viimane punkt = hõivetest) — loeb skoobist:
   kogu portfell või üks objekt (oma ajaloo-seeria) */
function taituvusCard(sc) {
  const occ = sc.spaces.filter(s => ["Üüritud","Lepingus"].includes(s.staatus));
  const m2All = sc.spaces.reduce((s,x) => s + x.yyripind, 0);
  const m2Occ = occ.reduce((s,x) => s + x.yyripind, 0);
  const pct = m2All ? Math.round(m2Occ / m2All * 100) : 0;
  const rentOcc = occ.reduce((s,x) => s + rent(x), 0);
  /* v408: 12 kuud kuni TÄNASE kuuni — sildid tuletatakse DEMO_TODAY-st (demo jälgib päris aega) */
  const KUU_L = ["jaan","veeb","märts","apr","mai","juuni","juuli","aug","sep","okt","nov","dets"];
  const KUU_F = ["Jaanuar","Veebruar","Märts","Aprill","Mai","Juuni","Juuli","August","September","Oktoober","November","Detsember"];
  const kuud = Array.from({ length: 12 }, (_, i) => new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth() - 11 + i, 1));
  const KUUD_LBL = kuud.map(d => KUU_L[d.getMonth()]);
  const KUUD_FULL = kuud.map((d, i) => `${KUU_F[d.getMonth()]} ${d.getFullYear()}${i === 11 ? " · praegu" : ""}`);
  const series = [...objektAjalugu(sc.objekt), pct];
  const skoopNimi = sc.objekt ? sc.objekt.nimi : !multiObj() ? OBJEKT.nimi
    : OBJEKTID.length > OBJ_CARD_MAX ? `Kogu portfell · ${OBJEKTID.length} objekti` : OBJEKTID.map(o=>o.nimi).join(" · ");
  const pinnadHref = sc.objekt ? "#/objekt/" + sc.objekt.id : (multiObj() ? "#/register" : "#/objekt");
  const n = series.length;
  const lo = Math.max(0, Math.min(...series) - 6), hi = Math.min(100, Math.max(...series) + 6);
  const X = i => ((i + 0.5) / n) * 100;
  const Y = v => 100 - ((v - lo) / ((hi - lo) || 1)) * 100;
  /* v388: sujuv kõver — Catmull-Rom → cubic bezier (pinge 1/6), ala sama kõvera alla; viewBox on
     preserveAspectRatio=none, seega arvutame viewBox-ruumis, joon ise ei venita (non-scaling-stroke) */
  const P = series.map((v,i) => [X(i), Y(v)]);
  const f2 = (x) => x.toFixed(2);
  let curve = `M${f2(P[0][0])},${f2(P[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2, t = 1 / 6;
    curve += ` C${f2(p1[0] + (p2[0] - p0[0]) * t)},${f2(p1[1] + (p2[1] - p0[1]) * t)} ${f2(p2[0] - (p3[0] - p1[0]) * t)},${f2(p2[1] - (p3[1] - p1[1]) * t)} ${f2(p2[0])},${f2(p2[1])}`;
  }
  const areaPath = `${curve} L${f2(P[n-1][0])},100 L${f2(P[0][0])},100 Z`;
  const gridTicks = [];
  for (let gt = Math.ceil(lo / 10) * 10; gt <= Math.floor(hi / 10) * 10; gt += 10) gridTicks.push(gt);
  return `
  <div class="card hero reveal" style="margin-bottom:20px">
    <div class="between" style="align-items:flex-start">
      <div><h2 style="font-size:24px">Täituvus</h2>
        <div class="muted" style="font-size:14px;margin-top:4px;max-width:360px">Üüripindade kasutus ja igakuine üüritulu.</div></div>
      <span class="tag">${skoopNimi} · ${sc.spaces.length} ${sc.spaces.length && sc.spaces.every(s => s.tyyp === "Laoboks") ? "boksi" : "pinda"}</span>
    </div>
    <div class="hero-body">
      <div>
        <div class="hero-big">${pct}<small>%</small></div>
        ${(() => { const h = objektAjalugu(sc.objekt); const prev = h[h.length - 1]; if (prev == null) return "";
          const d = pct - prev; if (!d) return `<div class="delta flat">± 0 pp · eelmise kuuga</div>`;
          return `<div class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${Math.abs(d)} pp ${d > 0 ? I.trend || "↗" : "↘"} <span>eelmise kuuga</span></div>`; })()}
        <div class="muted" style="font-size:14px;margin-top:8px">üüripinnast hõives<br>(${eur(m2Occ,0)} / ${eur(m2All,0)} m²)</div>
        <div class="divline"></div>
        <div class="mono" style="font-size:16px;font-weight:600">${eur(rentOcc,0)} € <span class="muted" style="font-weight:400;font-size:12px">üüritulu / kuus</span></div>
      </div>
      <div style="min-width:0">
        <div class="lchart">
          ${gridTicks.map(gt => `<div class="gline" style="top:${Y(gt).toFixed(1)}%"><span class="mono">${gt}%</span></div>`).join("")}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="lgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="rgba(27,128,104,.26)"/><stop offset=".6" stop-color="rgba(27,128,104,.10)"/><stop offset="1" stop-color="rgba(27,128,104,.02)"/></linearGradient></defs>
            <path d="${areaPath}" fill="url(#lgrad)"/>
            <path d="${curve}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
          </svg>
          ${series.map((v,i) => `<i class="pt ${i===n-1?'now':''}" style="left:${X(i).toFixed(2)}%;top:${Y(v).toFixed(2)}%" title="${KUUD_FULL[i]} · täituvus ${v}%"></i>`).join("")}
          <span class="hbubble lb-now mono" style="left:${X(n-1).toFixed(2)}%;top:${Y(pct).toFixed(2)}%">${pct}% praegu</span>
        </div>
        <div class="lmonths mono">${KUUD_LBL.map((m,i) => `<span class="${i===n-1?'now':''}" title="${KUUD_FULL[i]} · ${series[i]}%">${m}</span>`).join("")}</div>
      </div>
    </div>
    <div class="hlegend muted">
      <span><i class="ln"></i>Täituvus % üüripinnast · kuude lõikes</span>
      <span>jooksev kuu arvutub hõivetest</span>
      <a class="overline" href="${pinnadHref}" style="margin-left:auto">Pinnad →</a>
    </div>
  </div>`;
}

/* agendi eelseadistused (komposeri rippmenüü) — sama agent, erinev töörežiim */
const AGENT_PRESETS = [
  { id: "kiire",   t: "Kiire vastus",     s: "Lühike vastus või toiming otse registrist",            ph: "Küsi, otsi või anna korraldus — agent aitab…" },
  { id: "analyys", t: "Põhjalik analüüs", s: "Sügavam Q&A kogu portfelli üle (sh imporditud)",       ph: "Küsi analüüsi — rahavoog, tähtajad, riskid…" },
  { id: "gen",     t: "Lepingugeneraator", s: "Kirjelda vabas vormis — agent koostab mustandi",      ph: "Kirjelda, mis lepingut vajad — agent koostab mustandi…" },
];
let AGENT_PRESET = "kiire";

View.dashboard = () => {
  const acts = buildActs(); /* 4 põhitegevust elavad nüüd ülaribal (.top-qa, index.html) */
  return `
  <div class="view dash-min">
    <div class="dm-center">
      <div class="dm-hi reveal">Tere, Tarmo.</div>
      <h1 class="dm-q reveal">Millega saan täna aidata?</h1>

      <!-- AI-komposer: sisend üleval, all vasakul logo + agendi eelseadistus, paremal manused/mikrofon/saada -->
      <div class="composer reveal">
        <input id="dash-ask" aria-label="Küsi või anna agendile ülesanne" placeholder="${AGENT_PRESETS[0].ph}" autocomplete="off"/>
        <div class="comp-row">
          <span class="comp-mark" title="ThinkOne agent"><svg viewBox="0 0 93 116" aria-hidden="true">
            <path d="M0,33.06v47.14h31.79v-29.6L7.67,31.96h51.52V.17h-26.31c-.55,0-1.1.55-1.64.55L.55,31.42c0,.55-.55,1.1-.55,1.64Z"/>
            <path d="M92.63,82.94v-47.14h-32.34v30.15l24.12,18.09h-50.97v31.79h26.31c.55,0,1.1-.55,1.64-.55l30.69-30.69s.55-1.1.55-1.64Z"/>
          </svg></span>
          <div class="preset-wrap">
            <button class="preset-btn" id="preset-btn"><span id="preset-lbl">${AGENT_PRESETS[0].t}</span>${I.chevD}</button>
            <div class="preset-menu" id="preset-menu">
              ${AGENT_PRESETS.map(p => `<button class="preset-item" data-preset="${p.id}">
                <span class="t">${p.t}${p.id === "kiire" ? ` <span style="width:13px;color:var(--accent-deep);display:inline-flex" class="pk-tick">${I.check}</span>` : ""}</span>
                <span class="s">${p.s}</span>
              </button>`).join("")}
            </div>
          </div>
          <div style="flex:1"></div>
          <button class="comp-ic" title="Lisa manus (nt vana leping importi)" onclick="toast('Manuse lisamine — nt olemasolev leping impordiks. Demos illustratiivne.')">${I.clip}</button>
          <button class="comp-ic" title="Häälsisend" onclick="toast('Häälsisend — demos illustratiivne.')">${I.mic}</button>
          <button class="comp-send" id="dash-go" title="Saada (Enter)">${I.up}</button>
        </div>
      </div>

      <!-- kiirtegevused VAIKSETE viipadena komposeri all — kaardibänd võistles heroga -->
      <div class="dm-chips reveal">
        ${DB.COMPANY_ID === "b11g" ? `
        <a class="dm-chip" href="#/register" onclick="toast('Seadistus: pinnaplaanid ja Moderani kõrvalkulu on veel lisamata (3/5 tehtud)')">${I.building}Jätka seadistust <span class="mono" style="color:var(--accent-deep)">3/5</span></a>` : `
        <a class="dm-chip" href="#/pakkumus-uus">${I.offer}Loo pakkumine</a>`}
        <a class="dm-chip" href="#" id="qc-ask">${I.spark}Küsi portfelli kohta</a>
        <a class="dm-chip" href="#/risk">${I.risk}Riskiraport</a>
        <a class="dm-chip" href="#/import">${I.file}Impordi leping</a>
      </div>

      <!-- chati all: TEAVITUSVIRNAD (beui notification-stack) — kokkuvoldituna
           kaardipakk (esimene ees, järgmised piiluvad tagant), hover laotab lahti -->
      <div class="dm-stacks reveal">
        <!-- v407: „Vajab tegevust" on vaikimisi LAHTI — pooleliolevad pakkumused ja lahtised kommentaarid peavad
             avalehel kohe silma torkama (kokkuvoldituna paistis ainult esimene) -->
        <div class="ns-slot"><div class="nstack exp" id="ns-attn">
          <div class="ns-head">${I.bell.replace('<svg','<svg class="hic"')}<span class="ns-lbl">Vajab tegevust</span><span class="ns-badge">${acts.length}</span><button class="ns-toggle" aria-expanded="true" aria-controls="ns-attn-items">Näita vähem</button></div>
          <div class="ns-items" id="ns-attn-items">
            ${acts.length ? acts.map(a => `
            <div class="ns-item" onclick="location.hash='${a.href}'">
              <span class="icotile t-${a.ty}">${a.ic}</span>
              <div style="flex:1;min-width:0"><div class="t">${a.t}</div><div class="s mono">${a.s}</div></div>
              ${pill(a.pill[0], a.pill[1])}
            </div>`).join("") : `
            <div class="ns-item" style="cursor:default"><span style="width:16px;color:var(--green);display:flex">${I.check}</span><div class="t">Kõik tehtud — midagi ei oota otsust.</div></div>`}
          </div>
        </div></div>
        <div class="ns-slot"><div class="nstack" id="ns-kd">
          <div class="ns-head">${I.cal.replace('<svg','<svg class="hic"')}<span class="ns-lbl">Võtmekuupäevad</span><span class="ns-badge">${KEY_DATES.length}</span><a class="ns-link" href="#/kalender">Kalender →</a></div>
          <div class="ns-items">
            ${KEY_DATES.slice(0,6).map(k => { const ki = kdIcon(k.tyyp); return `
            <div class="ns-item" title="${k.info}" onclick="location.hash='#/kalender'">
              <span class="kd-ic ${ki.cls}">${ki.ic}</span>
              <div style="flex:1;min-width:0"><div class="t">${k.tyyp}</div><div class="s">${k.objekt}</div></div>
              <span class="kd-date mono">${fmtShort(k.kuupaev)}</span>
            </div>`; }).join("")}
          </div>
        </div></div>
      </div>
    </div>
  </div>`;
};

/* TEAVITUSVIRNA paigutus: kokkuvoldituna esimene kaart ees, järgmised piiluvad
   tagant (nihe alla + kitsam clip — beui STACK_PEEK); laotatuna täisloend.
   Sama transform/height mehaanika mis toast-virnal. */
function nsLayout(stack) {
  const items = [...stack.querySelectorAll(".ns-item")];
  const wrap = stack.querySelector(".ns-items");
  if (!items.length || !wrap) return;
  const exp = stack.classList.contains("exp");
  const toggle = stack.querySelector(".ns-toggle");
  if (toggle) { toggle.setAttribute("aria-expanded", String(exp)); toggle.textContent = exp ? "Näita vähem" : "Näita kõiki"; }
  /* v423: LOEND, mitte kaardipakk — kokkuvolditult kolm esimest rida, laotult kõik; read on eraldusjoontega */
  const SHOW = 3;
  let y = 0;
  items.forEach((el, i) => {
    const vis = exp || i < SHOW;
    el.inert = !vis;
    el.style.zIndex = "";
    el.style.clipPath = "";
    el.style.transform = `translateY(${vis ? y : y}px)`;
    el.style.opacity = vis ? "1" : "0";
    el.style.pointerEvents = vis ? "" : "none";
    if (vis) y += el.offsetHeight;
  });
  wrap.style.height = y + "px";
  if (toggle) toggle.hidden = items.length <= SHOW;
  const slot = stack.parentElement;
  if (slot && slot.classList.contains("ns-slot")) {
    /* mõõda ÜKS kord esimesest (animatsioonivabast) kokkuvolditud seisust —
       hilisem mõõtmine tabaks poolelioleva kõrguse-animatsiooni ja slot hüpleks */
    if (!exp && !slot.dataset.h) slot.dataset.h = String(stack.offsetHeight);
    if (slot.dataset.h) slot.style.height = slot.dataset.h + "px";
  }
}
window.addEventListener("keydown", (e) => { if (e.key === "Escape")
  document.querySelectorAll(".nstack.exp").forEach(st => { st.classList.remove("exp"); nsLayout(st); }); });

View.dashboard.init = () => {
  const inp = document.getElementById("dash-ask");
  const go = document.getElementById("dash-go");
  if (go) go.onclick = () => runAgentPanel(inp ? inp.value : "");
  if (inp) { inp.addEventListener("keydown", e => { if (e.key === "Enter") runAgentPanel(inp.value); }); }
  /* kiirkaart „Küsi portfelli kohta" fokuseerib sisendi */
  const qc = document.getElementById("qc-ask");
  if (qc) qc.onclick = (e) => { if (e && e.preventDefault) e.preventDefault(); if (inp && inp.focus) inp.focus(); };
  /* Tegevused avanevad teadlikul klõpsul, mitte kursori möödumisel. */
  document.querySelectorAll(".nstack").forEach(st => {
    const lay = () => nsLayout(st);
    const toggle = st.querySelector(".ns-toggle");
    if (toggle) toggle.onclick = () => { st.classList.toggle("exp"); lay(); };
    lay(); requestAnimationFrame(lay); /* kohe (slot saab kõrguse enne painti) + kontrollmõõt */
  });
  /* eelseadistuste rippmenüü: valik uuendab silti, linnukest ja kohatäidet */
  const pb = document.getElementById("preset-btn"), pm = document.getElementById("preset-menu");
  if (pb && pm) {
    pb.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); pm.classList.toggle("open"); };
    pm.querySelectorAll("[data-preset]").forEach(it => it.onclick = () => {
      AGENT_PRESET = it.dataset.preset;
      const p = AGENT_PRESETS.find(x => x.id === AGENT_PRESET);
      const lbl = document.getElementById("preset-lbl");
      if (lbl && p) lbl.textContent = p.t;
      if (inp && p) inp.placeholder = p.ph;
      pm.querySelectorAll(".pk-tick").forEach(x => x.remove());
      const tEl = it.querySelector(".t");
      if (tEl) tEl.innerHTML += ` <span style="width:13px;color:var(--accent-deep);display:inline-flex" class="pk-tick">${I.check}</span>`;
      pm.classList.remove("open");
      if (inp && inp.focus) inp.focus();
    });
  }
};

/* AI-paneel: libiseb paremalt igal lehel; ülal kontekstikiip („Vaatad: …") */
function agentCtx() {
  const h = location.hash || "#/";
  let m;
  if ((m = h.match(/^#\/leping\/(.+)/))) { const l = DB.leaseById(m[1]); if (l) { const c = DB.clientById(l.clientId); return `leping ${l.id} · ${c ? c.nimi : ""}`; } }
  if ((m = h.match(/^#\/tooleping\/(.+)/))) { const t = DB.tlepingById(m[1]); if (t) return `tööleping ${t.id} · ${t.isik}`; }
  if ((m = h.match(/^#\/pakkumus(?:-doc)?\/(.+)/))) { const o = DB.offerById(m[1]); if (o) { const c = DB.clientById(o.clientId); return `pakkumus ${o.id} · ${c ? c.nimi : ""}`; } }
  if ((m = h.match(/^#\/imp\/(.+)/))) { const x = DB.impById(m[1]); if (x) return `imporditud leping ${x.id} · ${x.pool}`; }
  if ((m = h.match(/^#\/risk\/(.+)/))) { const c = DB.clientById(m[1]); if (c) return `riskiraport · ${c.nimi}`; }
  if (h.startsWith("#/objekt")) return `esemeregister · ${multiObj() ? "hooned" : OBJEKT.nimi}`;
  const route = (typeof ROUTES !== "undefined") && ROUTES.find(r => r.re.test(h));
  return route ? route.crumb.toLowerCase() : "avaleht";
}
/* ---------- AI-vestlus: lõim KESKEL (nagu Claude), sisend all kleepuvalt ----------
   Korraldus → mock-tööplaan: sammud (lugevad tööriistad käivituvad ise) → muutev toiming
   küsib LUBA (Luba / Luba selles vestluses alati / Keela) → vastus. Lõim elab mälus
   (AGENT.msgs, lõpp-HTML re-renderiks), lehe värskendus alustab tühjalt. */
const AGENT = { msgs: [], allowAll: false, busy: false, pending: null, wait: null };
const agentPopOpen = () => false;   /* vana paremalt libisev paneel on kadunud — viited jäävad ohutuks */
function closeAgentPop() {}
const escHtml = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const chatScroll = () => requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));

/* sisend all: Enter saadab */
function wireAgentInput(focus) {
  const f = document.getElementById("agent-follow");
  if (!f) return;
  f.addEventListener("keydown", e => { if (e.key === "Enter" && f.value.trim()) runAgentPanel(f.value); });
  if (focus) f.focus();
}

/* iga sisend (avalehe komposer, ülariba omnibox, ⌘J) jõuab siia */
function runAgentPanel(cmd) {
  cmd = (cmd || "").trim();
  if (!/^#\/agent$/.test(location.hash)) { AGENT.pending = cmd || null; location.hash = "#/agent"; return; }
  if (cmd) agentRun(cmd);
}
function agentSuggest() { runAgentPanel(""); }

/* korraldus → tööplaan (mock): sammud + luba küsiv toiming + vastus */
function agentPlan(cmd) {
  const q = cmd.toLowerCase();
  const matchClient = CLIENTS.find(c => q.includes(c.nimi.toLowerCase().split(" ")[0]));
  const matchSpace = SPACES.find(sp => new RegExp("pind\\s*" + sp.nr + "(?!\\d)").test(q));
  const agSpace = matchSpace || SPACES.find(sp => sp.staatus === "Vaba") || SPACES[0];
  const cl = matchClient || CLIENTS[0];
  const ob = objektOf(agSpace);
  const step = (t, tool, det, ms) => ({ t, tool, det, ms });
  if (q.includes("riskiraport") || q.includes("riski")) return {
    steps: [ step("Analüüsin korraldust", null, `Ettevõte: ${cl.nimi} · toiming: riskiraport`, 700),
             step("Päring äriregistrist", "ariregister.otsi", `${cl.nimi} · reg ${cl.registrikood} · registrisse kantud · KMKR kehtiv`, 1100),
             step("Kontrollin maksuvõlgu", "emta.maksuvolg", "Maksuvõlg puudub · deklaratsioonid esitatud", 900),
             step("Otsin kohtulahendeid ja maksehäireid", "krediidiinfo.otsi", "0 kohtulahendit · 1 lõpetatud maksehäire (2023)", 1000) ],
    ask: { tool: "koosta_riskiraport", what: `${cl.nimi} · etapp 04`, why: "Koostab riskiraporti mustandi ja seob kliendikaardiga. Kellelegi ei saadeta." },
    doing: "Koostan riskiraporti", answer: agentAnswer(cmd) };
  /* vabas vormis küsimus lepingu SISU kohta → klauslikiht (tsitaat + viide) */
  const canned = ["kindlustus", "haldusleping", "seisus", "indekseer", "katsea", "palga"].some(k => q.includes(k));
  const questionLike = /\?/.test(q) || /^(kas|mis|mida|millal|kuidas|kes|kui|palju|kelle|mille|millis)\b/.test(q);
  if (!canned && questionLike) {
    const r = klauslVastus(cmd);
    return {
      steps: [ step("Analüüsin küsimust", null, `Otsisõnad: ${r.toks.join(", ") || "—"}`, 600),
               step("Otsin lepingute tekstist", "klauslid.otsi", `${r.total} punkti läbi (MARU üürileping, Caverion hooldusleping) · ${r.all || 0} vastet`, 1000),
               step("Kontrollin lisade muudatusi", "lisad.kehtiv", r.muud ? `${r.muud} vastet on Lisa 3-ga muudetud — tsiteerin kehtivat sõnastust` : "Vasted ei ole lisadega muudetud", 700) ],
      ask: null, answer: r.html };
  }
  const isQA = canned || q.includes("import");
  if (isQA) return {
    steps: [ step("Analüüsin küsimust", null, "Tuvastan olemid ja ajaraami", 600),
             step("Otsin lepinguid", "lepingud.otsi", `${IMPORDITUD.length + LEASES.length + TLEPINGUD.length} lepingut skoobis · ${DB.COMPANY_ID === "b11g" ? "Betooni 11g" : "Hoone T6B"}`, 900),
             step("Loen tähtaegu ja tingimusi", "lepingud.loe", "Võtmekuupäevad · indekseerimine · kehtivus", 800) ],
    ask: null, answer: agentAnswer(cmd) };
  return {
    steps: [ step("Analüüsin korraldust", null, `Klient: ${cl.nimi} · Pind: ${agSpace.nimi} · toiming: pakkumus`, 700),
             step("Otsin vabu pindu", "pinnad.otsi", `${SPACES.filter(sp => sp.staatus === "Vaba").length} vaba pinda · sobivaim ${agSpace.nimi} (${eur(agSpace.yyripind, 1)} m², ${ob.nimi})`, 1000),
             step("Päring ettevõtte kohta", "ariregister.otsi", `${cl.nimi} · reg ${cl.registrikood} · KMKR kehtiv · risk madal`, 1100),
             step("Loen hinnakirja ja kõrvalkulusid", "hinnakiri.loe", `${eur(agSpace.hind)} €/m² · kõrvalkulud talv ${eur(ob.korvalkulu.talvine)} / suvi ${eur(ob.korvalkulu.suvine)} €/m²`, 800) ],
    ask: { tool: "koosta_pakkumus", what: `${cl.nimi} · ${agSpace.nimi} · 60 kuud · ${eur(agSpace.hind)} €/m²`, why: "Loob pakkumuse mustandi (staatus Mustand). Kliendile ei saadeta — saatmine nõuab eraldi kinnitust." },
    doing: "Koostan pakkumuse mustandi", answer: agentAnswer(cmd) };
}

/* vestlusvaade */
const AGENT_SUGG = ["Loo pakkumine Future Invest OÜ-le, pind 12", "Mis seisus on hoone kindlustus?", "Koosta Roheline Ladu OÜ riskiraport", "Millal on järgmine indekseerimine?"];
function agentIntro() {
  return `<div class="chat-intro">
    <div class="cm-av big">${I.mark}</div>
    <h2>Mida agent oskab</h2>
    <p>Kirjuta vabas vormis korraldus või küsimus. Agent tuvastab olemid, otsib portfellist ja registritest ning näitab töö käiku sammhaaval. Lugevad tööriistad käivituvad ise; muutvad sammud (mustandi loomine, saatmine) küsivad enne luba.</p>
    <div class="chat-sugg">${AGENT_SUGG.map(t => `<button class="btn btn-ghost btn-sm" onclick="askAgent('${t.replace(/'/g, "\\'")}')">${t}</button>`).join("")}</div>
  </div>`;
}
View.agent = () => `
  <div class="view chat">
    <div class="chat-thread" id="chat-thread">${AGENT.msgs.length ? AGENT.msgs.map(m => m.html).join("") : agentIntro()}</div>
    <div class="chat-dock"><div class="chat-dock-in">
      ${agentFoot(AGENT.msgs.length ? "Jätka vestlust…" : "Küsi, otsi või anna korraldus — agent aitab…")}
      <div class="chat-hint">Lugevad tööriistad käivituvad ise · muutvad sammud küsivad luba · Enter saadab</div>
    </div></div>
  </div>`;
View.agent.init = () => {
  wireAgentInput(true);
  if (AGENT.pending) { const c = AGENT.pending; AGENT.pending = null; setTimeout(() => agentRun(c), 80); }
  else if (AGENT.msgs.length) chatScroll();
};

function agentRun(cmd) {
  if (AGENT.busy) return;
  const thread = document.getElementById("chat-thread"); if (!thread) return;
  if (!AGENT.msgs.length) thread.innerHTML = "";
  const uid = "m" + Date.now();
  const userHtml = `<div class="cm user"><div class="cm-b">${escHtml(cmd)}</div></div>`;
  AGENT.msgs.push({ role: "user", html: userHtml });
  thread.insertAdjacentHTML("beforeend", userHtml);
  const plan = agentPlan(cmd);
  const aiMsg = { role: "ai", html: "" }; AGENT.msgs.push(aiMsg);
  thread.insertAdjacentHTML("beforeend", `<div class="cm ai" id="${uid}"><div class="cm-av">${I.mark}</div><div class="cm-body">
    <details class="proc" open id="${uid}-proc"><summary><span class="proc-t">Töötan…</span><span class="proc-n"></span></summary><div class="proc-steps" id="${uid}-steps"></div></details>
    <div id="${uid}-tail"></div></div></div>`);
  AGENT.busy = true;
  const f = document.getElementById("agent-follow"); if (f) { f.value = ""; f.placeholder = "Jätka vestlust…"; }
  chatScroll();
  const t0 = Date.now(); let i = 0;
  const stepsEl = () => document.getElementById(uid + "-steps");
  const settle = (se) => { const p = se.querySelector(".step.run"); if (p) { p.classList.replace("run", "done"); p.querySelector("i").innerHTML = I.check; const d = p.querySelector(".step-det"); if (d) d.hidden = false; } };
  const save = () => { const node = document.getElementById(uid); if (node) aiMsg.html = node.outerHTML; };
  const answer = (txt) => {
    const tail = document.getElementById(uid + "-tail"); if (!tail) { AGENT.busy = false; return; }
    tail.insertAdjacentHTML("beforeend", `<div class="cm-text">${txt || plan.answer}</div>`);
    const proc = document.getElementById(uid + "-proc"); if (proc) proc.open = false;
    AGENT.busy = false; save(); chatScroll();
    const f2 = document.getElementById("agent-follow"); if (f2) f2.focus();
  };
  const doAction = (always) => {
    const tail = document.getElementById(uid + "-tail"), se = stepsEl(); if (!tail || !se) { AGENT.busy = false; return; }
    tail.innerHTML = `<div class="ta-done">${I.check} Lubatud · <code>${plan.ask.tool}</code>${always ? " · edaspidi selles vestluses küsimata" : ""}</div>`;
    se.insertAdjacentHTML("beforeend", `<div class="step run"><i><span class="spin"></span></i><div><b>${plan.doing}</b><code>${plan.ask.tool}</code><div class="step-det" hidden>Valmis · mustand salvestatud</div></div></div>`);
    const pn = document.querySelector("#" + uid + "-proc .proc-n"); if (pn) pn.textContent = `${plan.steps.length + 1} sammu`;
    chatScroll();
    setTimeout(() => { const se2 = stepsEl(); if (se2) settle(se2); answer(); }, 1100);
  };
  const askTool = () => {
    const tail = document.getElementById(uid + "-tail"); if (!tail) { AGENT.busy = false; return; }
    tail.innerHTML = `<div class="tool-ask">
      <div class="ta-h">${I.shield} Agent küsib luba</div>
      <div class="ta-t"><code>${plan.ask.tool}</code>${plan.ask.what}</div>
      <div class="ta-s">${plan.ask.why}</div>
      <div class="ta-b"><button class="btn btn-primary btn-sm" onclick="agentDecide('${uid}',1)">${I.check} Luba</button>
        <button class="btn btn-ghost btn-sm" onclick="agentDecide('${uid}',2)">Luba selles vestluses alati</button>
        <button class="btn btn-text btn-destructive" onclick="agentDecide('${uid}',0)">Keela</button></div></div>`;
    AGENT.wait = { uid, plan, answer, doAction };
    chatScroll();
  };
  const finish = () => {
    const secs = ((Date.now() - t0) / 1000).toFixed(1).replace(".", ",");
    const pt = document.querySelector("#" + uid + "-proc .proc-t"), pn = document.querySelector("#" + uid + "-proc .proc-n");
    if (pt) pt.textContent = "Töö käik"; if (pn) pn.textContent = `${plan.steps.length} sammu · ${secs} s`;
    if (!plan.ask) answer(); else if (AGENT.allowAll) doAction(true); else askTool();
  };
  const next = () => {
    const se = stepsEl(); if (!se) { AGENT.busy = false; return; }   /* vaade vahetati — jäta pooleli */
    settle(se);
    if (i < plan.steps.length) {
      const st = plan.steps[i++];
      se.insertAdjacentHTML("beforeend", `<div class="step run"><i><span class="spin"></span></i><div><b>${st.t}</b>${st.tool ? `<code>${st.tool}</code><span class="auto">lugemine · luba ei vaja</span>` : ""}<div class="step-det" hidden>${st.det}</div></div></div>`);
      chatScroll(); setTimeout(next, st.ms);
    } else finish();
  };
  next();
}
window.agentDecide = (uid, d) => {
  const w = AGENT.wait; if (!w || w.uid !== uid) return; AGENT.wait = null;
  if (d === 0) {
    const tail = document.getElementById(uid + "-tail");
    if (tail) tail.innerHTML = `<div class="ta-done no"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg> Keelatud · <code>${w.plan.ask.tool}</code></div>`;
    w.answer("<div>Selge, jätan selle tegemata. Kui soovid, ütle, mida muuta — näiteks teine pind, periood või hind.</div>");
    return;
  }
  if (d === 2) AGENT.allowAll = true;
  w.doAction(d === 2);
};

function agentAnswer(cmd) {
  const q = cmd.toLowerCase();
  // Q&A üle KÕIGI vertikaalide — töölepingud (katseaeg / palgaülevaatus); MVP-s vertikaal väljas
  if (TLEPINGUD.length && (q.includes("katsea") || q.includes("palgaülevaatus") || q.includes("palgaylevaatus"))) {
    return `
      <div class="overline" style="margin-bottom:12px">Vastus</div>
      <div style="font-size:14px;line-height:1.65">
        Sel kuul (juuni 2026) ei lõpe ühtegi katseaega. Järgmine: <b>Marten Kivi</b> (Hooldustehnik,
        <span class="mono">TL-2026-004</span>) — katseaeg lõpeb <b>30.09.2026</b>, teavitus 14 päeva ette.<br><br>
        Järgmine palgaülevaatus: <b>Karl Mets</b> (Objektihaldur) — 01.03.2027, kokku lepitud töölepingus.
      </div>
      <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap">
        <a class="btn btn-primary btn-sm" href="#/tooleping/TL-2026-004">${I.arrow} Ava tööleping</a>
        <a class="btn btn-ghost btn-sm" href="#/kalender">${I.cal} Võtmekuupäevad</a>
      </div>`;
  }
  // Q&A — imporditud lepingud (olemasolev portfell)
  if (q.includes("kindlustus") || q.includes("haldusleping") || q.includes("import")) {
    if (DB.COMPANY_ID === "b11g") {
      return `
      <div class="overline" style="margin-bottom:12px">Vastus</div>
      <div style="font-size:14px;line-height:1.65">
        Betooni 11g hoonete (Stock Office · Self Storage) kohta <b>kindlustuslepingut registris ei ole</b>. Imporditud on kaks lepingut:
        üürileping <span class="mono">LEP-2023-041</span> (Viking Metall OÜ) ja hooldusleping
        <span class="mono">HOO-2024-06</span> (Clanner Kinnisvarahooldus OÜ).<br><br>
        <span class="muted" style="font-size:14px">Soovitus: lisa varakindlustuse poliis impordi kaudu,
        siis jõuab selle lõpptähtaeg võtmekuupäevade kalendrisse.</span>
      </div>
      <div style="margin-top:16px"><a class="btn btn-primary btn-sm" href="#/imp/HOO-2024-06">${I.arrow} Ava imporditud leping</a></div>`;
    }
    return `
      <div class="overline" style="margin-bottom:12px">Vastus</div>
      <div style="font-size:14px;line-height:1.65">
        Hoone T6B kohta <b>kindlustuslepingut registris ei ole</b>. Imporditud on kaks lepingut: üürileping
        <span class="mono">LEP-2023-029</span> (AS Maru Ehitus, Pind 29) ja tehnosüsteemide hooldusleping
        <span class="mono">HOO-2023-H508</span> (Caverion Eesti AS, 1 104 €/kuus, tähtajatu, 2 kuu etteteatamine).<br><br>
        <span class="muted" style="font-size:14px">Üürilepingu ÜT p 7 järgi kindlustab hoone Üürileandja ja kulu jaguneb kõrvalkuludes —
        soovitus: lisa varakindlustuse poliis impordi kaudu, siis jõuab selle lõpptähtaeg võtmekuupäevade kalendrisse.</span>
      </div>
      <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn-primary btn-sm" href="#/imp/HOO-2023-H508">${I.arrow} Ava hooldusleping</a><a class="btn btn-ghost btn-sm" href="#/imp/LEP-2023-029">Ava üürileping</a></div>`;
  }
  // Q&A — seis / indekseerimine
  if (q.includes("seisus") || q.includes("indekseer") || q.includes("millal")) {
    return `
      <div class="overline" style="margin-bottom:12px">Vastus</div>
      <div style="font-size:14px;line-height:1.65">
        <b>Future Invest OÜ:</b> aktiivne pakkumus <span class="mono">PAK-2026-014</span> (Pind 12, mustand, kehtib 23.06.2026). Allkirjastatud lepinguid veel ei ole.<br><br>
        Järgmine indekseerimine portfellis: <b>01.01.2027</b> — LEP-2023-029 (AS Maru Ehitus, Pind 29), Statistikaameti THI eelmise aasta muutus, <i>automaatne, lisa ei teki</i> (Lisa 3 p 5.2).
      </div>
      <div style="margin-top:16px"><a class="btn btn-ghost btn-sm" href="#/kalender">${I.cal} Ava võtmekuupäevad</a></div>`;
  }
  // Toiming — riskiraport
  if (q.includes("riskiraport") || q.includes("riski")) {
    return agentEntities([
      { ic: I.user, lbl: "Ettevõte", val: "Roheline Ladu OÜ" },
      { ic: I.shield, lbl: "Toiming", val: "Riskiraport (etapp 04)" },
    ]) + `<div style="margin-top:16px"><a class="btn btn-primary btn-sm" href="#/risk/c-rohe">${I.risk} Ava riskiraport →</a></div>`;
  }
  // Toiming — pakkumus
  const matchClient = CLIENTS.find(c => q.includes(c.nimi.toLowerCase().split(" ")[0]));
  const matchSpace = SPACES.find(s => new RegExp("pind\\s*" + s.nr + "(?!\\d)").test(q));
  const agSpace = matchSpace || SPACES.find(s => s.staatus === "Vaba") || SPACES[0];
  return agentEntities([
    { ic: I.user, lbl: "Klient", val: (matchClient||CLIENTS[0]).nimi },
    { ic: I.building, lbl: "Objekt", val: objektOf(agSpace).nimi },
    { ic: I.pin, lbl: "Pind", val: agSpace.nimi },
    { ic: I.offer, lbl: "Toiming", val: "Loo pakkumus (etapp 04)" },
  ]) + `
    <div class="muted" style="margin-top:12px;font-size:14px">Mustand on koostatud õigete m²-de ja hindadega. Saatmine nõuab operaatori kinnitust.</div>
    <div style="margin-top:16px;display:flex;gap:12px;flex-wrap:wrap">
      <a class="btn btn-primary btn-sm" href="#/pakkumus/PAK-2026-014">${I.arrow} Ava pakkumuse mustand</a>
      <a class="btn btn-ghost btn-sm" href="#/pakkumus-uus">Ava koostamise vaade</a>
    </div>`;
}
/* paneeli jalus: suur kutsuv sisend + saada-nupp */
function agentFoot(placeholder) {
  return `<div class="ag-input">
    <span class="spk">${I.mark}</span>
    <input id="agent-follow" placeholder="${placeholder}" autocomplete="off"/>
    <button class="ag-send" onclick="sendAgentPrompt()" title="Saada (Enter)">${I.enter}</button></div>`;
}
window.sendAgentPrompt = () => { const f = document.getElementById("agent-follow"); if (f && f.value.trim()) runAgentPanel(f.value); };

function agentEntities(items) {
  return `<div class="flex ent-head" style="gap:8px;margin-bottom:4px"><span class="spark" style="width:18px;color:var(--accent-deep)">${I.spark}</span>
      <span class="overline">Tuvastatud olemid</span></div>
    <div class="entity-row">${items.map(e => `<div class="entity">${e.ic.replace('<svg','<svg class="ic"')}<span class="lbl">${e.lbl}</span><span class="val">${e.val}</span></div>`).join("")}</div>`;
}

/* ---------- Esemeregister (kaks sammast ühendab hõive) --------------------- */
View.register = () => {
  const kvoot = AMETIKOHAD.reduce((s,a) => s + a.kvoot, 0);
  const taidetud = AMETIKOHAD.reduce((s,a) => s + ametikohtHoive(a), 0);

  /* iga hoone on eraldi konteiner — üksused ja hõive arvutatakse hoone kaupa */
  const hooneCard = (o) => {
    const sp = SPACES.filter(s => objektOf(s).id === o.id);
    const hoivatud = sp.filter(s => ["Üüritud","Lepingus"].includes(s.staatus)).length;
    const vabad = sp.filter(s => s.staatus === "Vaba").length;
    const m2 = sp.reduce((s,x) => s + x.yyripind, 0);
    const boksid = sp.length && sp.every(s => s.tyyp === "Laoboks");
    return `<div class="card pad">
      <div class="between" style="align-items:flex-start">
        <div><div class="overline">Hoone</div>
          <div style="font-weight:700;font-size:20px;margin-top:4px">${o.nimi}</div>
          <div class="muted" style="font-size:14px;margin-top:2px">${o.ehr.aadress}</div></div>
        <span class="tag lime">Ärikinnisvara</span>
      </div>
      <div class="divline"></div>
      <dl class="kv">
        <dt>Üksused</dt><dd>${sp.length} ${boksid ? "laoboksi" : "üüripinda"} · ${eur(m2,0)} m²</dd>
        <dt>Hõive</dt><dd>${hoivatud} üüritud/lepingus · ${vabad} vaba <span class="muted" style="font-size:12px">(projektsioon)</span></dd>
        <dt>Atribuudiskeem</dt><dd class="muted" style="font-size:14px">${boksid ? "m² · hind €/m² · korrus — oma mall (laoboksi üldtingimused)" : "m² · hind €/m² · elektrivõimsus · parkimine · Lisa 1 plaan"}</dd>
      </dl>
      <a class="btn btn-primary btn-sm" style="margin-top:16px" href="#/objekt/${o.id}">Ava ${boksid ? "boksid" : "pinnad"} ${I.arrow}</a>
    </div>`;
  };

  const akRow = (a) => {
    const h = ametikohtHoive(a);
    const tl = TLEPINGUD.find(t => t.ametikohtId === a.id && t.staatus === "Kehtiv");
    const pakkumine = TLEPINGUD.find(t => t.ametikohtId === a.id && t.staatus !== "Kehtiv");
    const olek = h >= a.kvoot ? "Täidetud" : pakkumine ? "Pakkumisel" : h > 0 ? "Osaline hõive" : "Täitmata";
    const link = tl ? `#/tooleping/${tl.id}` : pakkumine ? `#/tooleping/${pakkumine.id}` : null;
    return `<tr class="${link?'clickable':''}" ${link?`onclick="location.hash='${link}'"`:""}>
      <td><div style="font-weight:600">${a.nimi}</div><div class="muted" style="font-size:12px">${a.ylesanded}</div></td>
      <td class="r mono">${eur(a.tasu,0)} €</td>
      <td class="mono">${a.katseaeg}</td>
      <td class="r mono"><b>${h}</b> / ${a.kvoot}</td>
      <td>${pill(olek)}${tl?`<div class="muted" style="font-size:12px;margin-top:3px">${tl.isik}</div>`:pakkumine?`<div class="muted" style="font-size:12px;margin-top:3px">${pakkumine.isik} (kandidaat)</div>`:""}</td>
    </tr>`; };

  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Esemeregister</h1></div>
      <a class="btn btn-ghost btn-sm" href="#/portfell">${I.back} Portfell</a>
    </div>

    <div class="grid g2 reveal" style="gap:20px;align-items:stretch">
      ${OBJEKTID.map(hooneCard).join("")}

      ${!AMETIKOHAD.length ? "" : `
      <div class="card pad">
        <div class="between" style="align-items:flex-start">
          <div><div class="overline">Osakond</div>
            <div style="font-weight:700;font-size:20px;margin-top:4px">${OSAKOND.nimi}</div>
            <div class="muted" style="font-size:14px;margin-top:2px">${OSAKOND.ettevote}</div></div>
          <span class="tag lav">Töölepingud</span>
        </div>
        <div class="divline"></div>
        <dl class="kv">
          <dt>Üksused</dt><dd>${AMETIKOHAD.length} ametikohta · kvoot ${kvoot} kohta</dd>
          <dt>Hõive</dt><dd>${taidetud} / ${kvoot} täidetud <span class="muted" style="font-size:12px">(headcount = kvoothõive)</span></dd>
          <dt>Atribuudiskeem</dt><dd class="muted" style="font-size:14px">ülesanded · töötasu · katseaeg · ametijuhend manusena</dd>
        </dl>
      </div>`}
    </div>

    ${!AMETIKOHAD.length ? "" : `
    <div class="sec-h reveal" style="margin-top:32px"><h2>Ametikohad</h2><span class="meta">osakond ${OSAKOND.nimi}</span></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Ametikoht</th><th class="r">Töötasu (bruto)</th><th>Katseaeg</th><th class="r">Hõive</th><th>Olek</th></tr></thead>
        <tbody>${AMETIKOHAD.map(akRow).join("")}</tbody>
      </table>
    </div>`}

  </div>`;
};

/* ---------- Objekt (hoone kaupa; ettevõttel võib olla mitu hoonet) ---------- */
View.objekt = (oid) => {
  const obj = (oid && DB.objektById(oid)) || OBJEKT;
  const spaces = SPACES.filter(s => objektOf(s).id === obj.id);
  const e = obj.ehr, k = obj.korvalkulu;
  const boksid = spaces.length && spaces.every(s => s.tyyp === "Laoboks");
  const pf = (obj.failid && obj.failid.pinnaplaan) || "";
  const kf = (obj.failid && obj.failid.parkimine) || "";
  return `
  <div class="view">
    <a class="btn btn-ghost btn-sm reveal" href="#/register" style="margin-bottom:20px">${I.back} Esemeregister</a>
    ${multiObj() ? `
    <div class="qa reveal" style="margin-bottom:20px">
      ${OBJEKTID.map(o => `<a href="#/objekt/${o.id}" class="${o.id===obj.id?'qa-new':''}"><span class="qi">${I.building}</span>${o.nimi}</a>`).join("")}
    </div>`:""}
    <div class="obj-next"><span class="muted">${spaces.length ? `${spaces.length} pinda objekti küljes` : "Pindu pole veel lisatud"}</span><button class="btn btn-primary" onclick="${spaces.length ? `objOffer('${obj.id}')` : `objEdit('${obj.id}',2)`}">${spaces.length ? "Loo pakkumus" : "Lisa esimene pind"} ${I.arrow}</button></div>
    <div class="card obj-hero reveal">
      <div class="band">
        <div class="flex" style="justify-content:space-between;align-items:flex-start">
          <div>
            <div class="overline" style="color:var(--faint)">Objekt · ärikinnisvara${multiObj() ? ` · ${ACCOUNT.landlord.nimi}` : ""}</div>
            <h1 style="margin-top:8px">${obj.nimi}</h1>
            <div class="addr">${e.aadress}</div>
          </div>
          <div style="text-align:right">
            ${obj.kaibemaksugaMaksustatud ? pill("KM-kohustus: JAH","accent") : pill("KM-kohustus: EI","grey")}
            <div class="mono" style="color:var(--muted);font-size:12px;margin-top:8px">EHR ${e.kood}</div>
            <button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="objEdit('${obj.id}')">${I.edit} Muuda</button>
          </div>
        </div>
      </div>
      <div class="ehr-grid">
        ${[
          ["Kasutusotstarve", e.kasutusotstarve, ""],
          ["Ehitisealune pind", (e.ehitisealunePind == null ? "—" : e.ehitisealunePind.toLocaleString("et-EE")), "m²"],
          ["Suletud netopind", (e.suletudNetopind == null ? "—" : e.suletudNetopind.toLocaleString("et-EE")), "m²"],
          ["Korruseid", e.korrusteArv ?? "—", ""],
          ["Ehitusaasta", e.ehitusaasta ?? "—", ""],
          [boksid ? "Bokse kokku" : "Parkimiskohti kokku", boksid ? spaces.length : spaces.reduce((s,x)=>s+x.parkimine,0), ""],
        ].map(([l,v,u]) => `<div class="ehr-cell"><div class="l">${l}</div><div class="v mono">${v}${u?` <span class="u">${u}</span>`:""}</div></div>`).join("")}
      </div>
    </div>

    <div class="grid g2 reveal" style="gap:16px;margin-top:16px">
      <div class="card pad">
        <div class="between" style="margin-bottom:12px"><div class="overline">Kõrvalkulu</div>
          <button class="steplink" onclick="toast('Moderan: viimase 12 kuu keskmine uuendatud')">Uuenda</button></div>
        <dl class="kv">
          <dt>Talvine (okt–märts)</dt><dd class="mono">${eur(k.talvine)} €/m²</dd>
          <dt>Suvine (apr–sept)</dt><dd class="mono">${eur(k.suvine)} €/m²</dd>
          <dt>Allikas</dt><dd style="font-size:14px">${k.allikas}</dd>
        </dl>
      </div>
      <div class="card pad">
        <div class="overline" style="margin-bottom:8px">Mallid · versioneeritud</div>
        ${[obj.mallid.uldtingimused, obj.mallid.eritingimused, obj.mallid.pakkumus].map(m => {
          const lukus = /\(lukus\)/.test(m);
          const ver = (m.match(/v[\d.]+/) || [""])[0];
          const nimi = m.replace(/\s*\(lukus\)/, "").replace(/\s*v[\d.]+/, "");
          return `
        <button class="mall-row" onclick="toast('Mall avatud versioonihaldusega — külmub allkirjaga. Demos illustratiivne.')" title="Ava mall">
          <span class="kd-ic grey">${lukus ? I.lock : I.file}</span>
          <div class="t">${nimi}</div>
          <span class="tag mono">${ver}${lukus ? " · lukus" : ""}</span>
          <span class="chev">${I.arrow}</span>
        </button>`; }).join("")}
      </div>
    </div>

    <div class="sec-h reveal" style="margin-top:32px"><h2>${boksid ? "Laoboksid" : "Üüripinnad"}</h2><span class="meta">${spaces.length} ${boksid ? "boksi" : "pinda"}</span>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="openPdf('${pf}','Lisa 1 · pinnaplaan')">${I.pin} Pinnaplaan</button>
        <button class="btn btn-ghost btn-sm" onclick="openPdf('${kf}','Lisa 2 · asendiplaan + parkimisskeem')">${I.car} Parkimisskeem</button>
        <button class="btn btn-ghost btn-sm" onclick="objEdit('${obj.id}',2);OBJ_DRAFT.importing=true">${I.file} Impordi pinnad</button>
        <button class="btn btn-primary btn-sm" onclick="objAdd('${obj.id}')">${I.plus} Lisa pind</button>
      </div>
    </div>
    <div class="pf-views reveal" id="sp-filter" data-glide="sp-filter" style="margin-bottom:16px">
      <button class="pf-view" data-spf="leping">Lepingus</button>
      <button class="pf-view" data-spf="vaba">Vabad</button>
      <button class="pf-view on" data-spf="">Kõik</button>
    </div>
    <div class="sp-cards reveal">
      ${spaces.map(s => { const lease = LEASES.find(l => l.spaceId === s.id);
        const impL = !lease && s.tenant ? IMPORDITUD.find(x => x.pool === s.tenant) : null;
        const tHref = lease ? "#/leping/" + lease.id : impL ? "#/imp/" + impL.id : null;
        const sf = s.staatus === "Vaba" ? "vaba" : (s.staatus === "Üüritud" || s.staatus === "Lepingus") ? "leping" : "";
        return `
      <div class="card sp-card" data-sprow="${s.id}" data-spf="${sf}">
        <div class="between" style="align-items:flex-start">
          <div><div class="mono" style="font-weight:650;font-size:16px">${s.nimi}</div>
            <div class="muted" style="font-size:12px;margin-top:2px">${s.tyyp}${!boksid && s.parkimine ? ` · ${s.parkimine} parkimiskohta` : ""}</div></div>
          ${pill(s.staatus)}
        </div>
        <div class="sp-nums">
          <div><div class="l">Üüripind</div><div class="v mono">${eur(s.yyripind,1)} <span class="u">m²</span></div></div>
          <div><div class="l">Hind</div><div class="v mono">${eur(s.hind)} <span class="u">€/m²</span></div></div>
          <div><div class="l">Üür kuus</div><div class="v mono">${eur(rent(s))} <span class="u">€</span></div></div>
        </div>
        <div class="sp-foot">
          ${s.tenant
            ? (tHref ? `<a class="steplink" onclick="event.stopPropagation()" href="${tHref}" title="Ava leping">${s.tenant} →</a>`
                     : `<span class="muted" style="font-size:12px">${s.tenant}</span>`)
            : `<span class="muted" style="font-size:12px">${s.neto == null ? "" : `Netopind ${eur(s.neto,1)} m²`}${s.koef == null ? "" : ` · koef ${s.koef}`}</span>`}
        </div>
      </div>`; }).join("")}
    </div>
    <div class="muted reveal" id="sp-tyhi" style="display:none;padding:24px;text-align:center;font-size:14px">Selle filtriga pindu pole.</div>
  </div>`;
};

/* pinna paneel: andmed · plaanid · hõive ajalugu (kes üüris, millal, mis hinnaga) */
function openSpacePanel(sid) {
  const s = DB.spaceById(sid); if (!s) return;
  const o = objektOf(s);
  const head = document.getElementById("side-head"), body = document.getElementById("side-body"), foot = document.getElementById("side-foot");
  const lease = LEASES.find(l => l.spaceId === s.id);
  const impL = !lease && s.tenant ? IMPORDITUD.find(x => x.pool === s.tenant) : null;
  const hist = [];
  if (lease) { const cl = DB.clientById(lease.clientId);
    hist.push({ kes: cl.nimi, millal: `${lease.algus} – ${lease.lopp}`, hind: `${eur(s.hind)} €/m²`, href: "#/leping/" + lease.id, olek: lease.staatus }); }
  else if (impL) { const per = ((impL.parameetrid.find(p => p[0] === "Periood") || [])[1] || "—").replace(/\s*\(.*\)/, "");
    hist.push({ kes: impL.pool, millal: per, hind: `${eur(s.hind)} €/m²`, href: "#/imp/" + impL.id, olek: "Kehtiv" }); }
  else if (s.tenant) hist.push({ kes: s.tenant, millal: "jooksev hõive", hind: `${eur(s.hind)} €/m²`, href: null, olek: s.staatus });
  head.innerHTML = `<div class="overline">Pind · ${o.nimi}</div>
    <div style="font-weight:700;font-size:16px;margin-top:4px">${s.nimi} · ${s.tyyp}</div>
    <div style="margin-top:8px">${pill(s.staatus)}</div>`;
  body.innerHTML = `
    <dl class="kv">
      <dt>Netopind</dt><dd class="mono">${eur(s.neto,1)} m²</dd>
      <dt>Üüripind (koef ${s.koef})</dt><dd class="mono">${eur(s.yyripind,1)} m²</dd>
      <dt>Hinnakiri</dt><dd class="mono">${eur(s.hind)} €/m² · ${eur(rent(s))} €/kuu</dd>
      ${s.elekter ? `<dt>Elektrivõimsus</dt><dd class="mono">${s.elekter} A</dd>` : ""}
      ${s.parkimine ? `<dt>Parkimiskohti</dt><dd class="mono">${s.parkimine}</dd>` : ""}
    </dl>
    <div class="divline"></div>
    <div class="overline" style="margin-bottom:8px">Plaanid</div>
    <button class="att ${(s.plaanFail || o.failid.pinnaplaan) ? "" : "nofile"}" onclick="openPdf('${(s.plaanFail || o.failid.pinnaplaan) || ""}','Lisa 1 · pinnaplaan · ${s.nimi}')">
      ${I.file.replace('<svg','<svg class="fic"')}<div style="flex:1"><b>Lisa 1</b> · Pinnaplaan</div><span class="tag">${(s.plaanFail || o.failid.pinnaplaan) ? "PDF · vaata" : "lisamata"}</span></button>
    <div class="divline"></div>
    <div class="overline" style="margin-bottom:8px">Hõive ajalugu</div>
    ${hist.length ? hist.map(h => `
    <div class="kd-item" ${h.href ? `style="cursor:pointer" onclick="closeSide();location.hash='${h.href}'"` : ""}>
      <span class="kd-ic green">${I.user}</span>
      <div style="flex:1;min-width:0"><div class="t" style="font-size:14px">${h.kes}</div><div class="s">${h.millal} · ${h.hind}</div></div>
      ${pill(h.olek)}
    </div>`).join("") : `<div class="muted" style="font-size:14px">Pind on vaba — ajalugu koguneb hõivetest.</div>`}`;
  foot.innerHTML = `<button class="btn btn-ghost" style="width:100%;justify-content:center" onclick="closeSide()">Sulge</button>`;
  document.getElementById("side").classList.add("open");
  document.getElementById("scrim").classList.add("open");
}
View.objekt.init = () => {
  document.querySelectorAll("[data-sprow]").forEach(c => c.onclick = () => openSpacePanel(c.dataset.sprow));
  /* pinnafilter: Lepingus | Vabad | Kõik (Pakkumusel/Reserveeritud ainult „Kõik" all) */
  const apply = () => {
    const on = document.querySelector("#sp-filter .pf-view.on");
    const f = on && on.dataset ? on.dataset.spf : "";
    let any = false;
    document.querySelectorAll(".sp-card[data-sprow]").forEach(c => {
      const hit = !f || c.dataset.spf === f;
      c.style.display = hit ? "" : "none"; if (hit) any = true;
    });
    const e = document.getElementById("sp-tyhi"); if (e) e.style.display = any ? "none" : "";
  };
  document.querySelectorAll("#sp-filter .pf-view").forEach(b => b.onclick = () => {
    document.querySelectorAll("#sp-filter .pf-view").forEach(x => x.classList.remove("on"));
    b.classList.add("on"); apply();
  });
};

/* ---------- Pakkumiste loend (valikuline faasifilter pipeline'ist) ---------- */
const OFFER_FILTERS = {
  pooleli: { t: "Pooleli", st: ["Mustand", "Saadetud", "Kliendi ettepanek"] },
  mustand: { t: "Mustandid", st: ["Mustand"] },
  saadetud: { t: "Ootab klienti", st: ["Saadetud"] },
  labiraakimisel: { t: "Ootab minu vastust", st: ["Kliendi ettepanek"] },
  lopetatud: { t: "Lõpetatud", st: ["Aktsepteeritud", "Lepinguks teisendatud", "Aegunud", "Tagasi lükatud", "Tühistatud"] },
  aktsepteeritud: { t: "Aktsepteeritud", st: ["Aktsepteeritud", "Lepinguks teisendatud"] },
};
/* pakkumuste loend on JAGATUD: #/pakkumised leht (külgriba „Pakkumised") ja Portfelli sakk „Pakkumused"
   (v407) renderdavad sama filtririba + tabelit; `base` = filtrilinkide hash-eesliide. */
const offerFilterKey = (f) => OFFER_FILTERS[f] ? f : "pooleli";
function offerFiltersHTML(f, base) {
  const filterKey = offerFilterKey(f);
  const filters = ["pooleli", "mustand", "saadetud", "labiraakimisel", "lopetatud"];
  if (filterKey === "aktsepteeritud") filters.push(filterKey);
  return `
    <nav class="offer-filters reveal" aria-label="Pakkumiste olek">
      ${filters.map(key => { const filter = OFFER_FILTERS[key]; const count = OFFERS.filter(o => filter.st.includes(o.staatus)).length;
        return `<a class="pf-view ${key === filterKey ? 'on' : ''}" href="${base}${key === 'pooleli' ? '' : '/' + key}" ${key === filterKey ? 'aria-current="page"' : ''}>${filter.t}<span class="offer-filter-count">${count}</span></a>`;
      }).join('')}
    </nav>`;
}
function offerTableHTML(f) {
  const filterKey = offerFilterKey(f);
  const flt = OFFER_FILTERS[filterKey];
  const rows = OFFERS.filter(o => flt.st.includes(o.staatus));
  const priority = { "Kliendi ettepanek": 0, "Mustand": 1, "Saadetud": 2 };
  if (filterKey === "pooleli") rows.sort((a, b) => priority[a.staatus] - priority[b.staatus]);
  /* pooleli-vaates ütleb olekulahter ka JÄRGMISE SAMMU — mida minult oodatakse (v407) */
  const next = (o) => filterKey !== "pooleli" ? "" :
    o.staatus === "Kliendi ettepanek" ? `<div class="offer-next accent">vasta kliendile</div>` :
    o.staatus === "Mustand" ? `<div class="offer-next">saada kliendile</div>` :
    (d => d < 0 ? `<div class="offer-next">tähtaeg möödas</div>` : `<div class="offer-next">ootab klienti · ${d} p</div>`)(daysUntil(o.kehtivKuni));
  return `
    <div class="card reveal offer-table" role="region" aria-label="${flt.t} pakkumised" tabindex="0">
      <table class="tbl">
        <thead><tr><th>Tunnus</th><th>Klient</th><th>Pind</th><th>Pikkus</th><th>Kehtib kuni</th><th class="r">Üür / kuus</th><th>Olek</th></tr></thead>
        <tbody>
        ${rows.length ? rows.map(o => { const cl = DB.clientById(o.clientId); const t = offerTotals(o);
          return `<tr class="clickable" data-pfrow-k onclick="location.hash='#/pakkumus/${o.id}'">
            <td><a class="id offer-link" href="#/pakkumus/${o.id}">${o.id}</a></td>
            <td><div class="ent">${avatar(cl.nimi)}<div class="ent-tx"><b>${cl.nimi}</b><small>${cl.kontakt || ""}</small></div></div></td>
            <td>${t.spaces.map(s=>`${s.nimi} <span class="muted">· ${eur(s.yyripind,1)} m²</span>`).join("<br>")}</td>
            <td>${o.pikkusKuud} kuud</td>
            <td class="num">${o.kehtivKuni}</td>
            <td class="r num"><b>${eur(t.rentSum)} €</b></td>
            <td>${pill(o.staatus)}${next(o)}</td></tr>`; }).join("") : `<tr><td colspan="7" class="offer-empty">${filterKey === 'labiraakimisel' ? 'Ükski pakkumus ei oota praegu sinu vastust.' : filterKey === 'pooleli' ? 'Pooleliolevaid pakkumisi pole. Uue pakkumise saad luua ülal oleva nupuga.' : 'Selles olekus pakkumisi praegu pole.'}</td></tr>`}
        </tbody>
      </table>
    </div>`;
}
View.pakkumised = (f) => `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Pakkumised</h1></div>
      <a class="btn btn-primary" href="#/pakkumus-uus">${I.offer} Uus pakkumine</a>
    </div>
    ${offerFiltersHTML(f, "#/pakkumised")}
    ${offerTableHTML(f)}
  </div>`;

/* ---------- Pakkumuse detail ---------------------------------------------- */
/* pakkumuse läbirääkimised elavad DOKUMENDI PEAL: lõim + kirjutaja on dokumendiveeru ülaosas
   ja pakkumus jääb all nähtavaks (sama muster kui lepingu punktikommentaarid — kirjutades
   näed, mille üle räägid). Režiimivahetust („Vaata pakkumust"/„Ava läbirääkimised") ega
   modaali enam pole. */

View.pakkumus = (id) => {
  const o = DB.offerById(id); if (!o) return notFound("Pakkumust ei leitud");
  if (isClient() && !clientSeesOffer(o)) return notFound("See pakkumus ei ole veel teile saadetud");
  const cl = DB.clientById(o.clientId); const t = offerTotals(o);
  const vat = OBJEKT.kaibemaksugaMaksustatud;
  const canEditPrice = !isClient() && ["Mustand","Kliendi ettepanek"].includes(o.staatus);
  const editCt = !isClient() && o.staatus === "Mustand";
  const ct = offerContact(o, cl);
  const seotud = o.lepingud || (o.seotudLeping ? [o.seotudLeping] : []); /* sellest pakkumusest sündinud lepingud */
  const states = ["Mustand","Saadetud","Aktsepteeritud","Lepinguks"];
  const sIdx = seotud.length ? 3 : ({ "Mustand":0,"Saadetud":1,"Kliendi ettepanek":1,"Tagasi lükatud":1,"Aegunud":1,"Tühistatud":1,"Aktsepteeritud":2,"Lepinguks teisendatud":3 }[o.staatus] ?? 0);
  /* kliendi rada on lühem — mustand pole tema maailmas olemas */
  const clSteps = ["Saadetud", "Aktsepteeritud", "Leping"];
  const clIdx = (seotud.length || o.staatus === "Lepinguks teisendatud") ? 2 : o.staatus === "Aktsepteeritud" ? 1 : 0;
  /* lõppolek (rada ei jõua lõpuni) — kuvatakse hetkesammu sildina punase märgiga (v379: päise pilli enam pole) */
  const endSt = ["Tagasi lükatud", "Aegunud", "Tühistatud"].includes(o.staatus) ? o.staatus : null;
  /* redigeerimisel saab pindu lisada: vabad pinnad, mis pole veel pakkumuses */
  const availSpaces = SPACES.filter(s => s.staatus === "Vaba" && !o.spaceIds.includes(s.id));
  /* läbirääkimiste logi — mõlemale poolele nähtav ajalugu, püsib läbi voorude */
  const nego = o.labiraakimised || [];
  const ettepanekul = o.staatus === "Kliendi ettepanek";
  const negoAll = (o.kliendiEttepanek && !nego.some(m => m.tekst === o.kliendiEttepanek)
    ? [{ roll: "klient", autor: (ct.nimi || cl.kontakt) + " (üürnik)", aeg: o.loodud, tekst: o.kliendiEttepanek }] : []).concat(nego);
  const negoThread = negoAll.map((m, mi) => `<div class="cmt th-card ${mi ? "th-step " : ""}${thSkin(m.roll, m.autor)}">
                ${thHead(m.roll, m.autor, m.aeg)}
                <div class="body">${m.tekst}</div></div>`).join("");
  /* väljaspool ettepaneku seisu jääb läbirääkimiste JÄLG alles — vaikne voldik MÕLEMA veeru kohal
     (sama keel kui lepingu „Läbirääkimiste ajalugu") */
  const negoHist = nego.length && !ettepanekul ? `
        <details class="cmt-hist nego-hist reveal">
          <summary>
            <span class="nh-ic">${I.chat}</span>
            <span class="nh-t">Läbirääkimiste ajalugu</span>
            <span class="nh-sub">${negoAll.length} ${negoAll.length === 1 ? "sõnum" : "sõnumit"} · viimati <span class="mono">${negoAll[negoAll.length - 1].aeg.split(" ")[0]}</span></span>
            <span class="chev">${I.arrow}</span>
          </summary>
          <div class="thread nego-thread">${negoThread}</div>
        </details>` : "";
  /* läbirääkimiste paneel DOKUMENDI KOHAL (endise modaali ja režiimivahetuse asemel):
     — kliendi ettepaneku seisus alati lahti: lõim + vastus/täiendus, pakkumus jääb alla nähtavaks
       (operaator kohendab hindu/tingimusi sealsamas all);
     — üürnikul saadetud pakkumusel peidus, „Alusta läbirääkimisi" avab selle paigal. */
  const negoPanel = ettepanekul ? `
        <div class="doc nego-panel reveal" id="nego-panel">
          <div class="doc-head"><div><div class="doc-title">Läbirääkimised</div>
            <div class="doc-sub">${isClient() ? "Teie ettepanek ja üürileandja vastused — uuendatud pakkumus tuleb samale lingile" : "Kliendi ettepanek ja teie vastused — kohenda pakkumust all dokumendis ja saada uuesti"}</div></div>
            ${pill("Kliendi ettepanek")}</div>
          <div class="nego-body">
            <div class="thread nego-thread">
              ${negoThread}
              ${isClient() ? `<div class="th-wait" style="margin-top:12px">${I.hourglass}<div><b>Ootab üürileandja vastust</b> — uuendatud pakkumus tuleb samale lingile.</div></div>` : ""}
            </div>
            ${isClient() ? `
            <div class="nego-compose">
              <textarea id="cl-nego-more" rows="2" class="ce-in" placeholder="Täiendage ettepanekut…"></textarea>
              <div class="wrap-actions" style="margin-top:8px;justify-content:flex-end"><button class="btn btn-primary btn-sm" id="cl-nego-add">${I.enter} Saada</button></div>
            </div>` : `
            <div class="nego-compose">
              <textarea id="op-reply" rows="3" class="ce-in" placeholder="Vastus kliendile — nt mida muutsite ja miks…"></textarea>
              <div class="wrap-actions" style="margin-top:12px">
                <button class="btn btn-primary btn-sm" id="resend-offer">Saada uuesti<span class="bic">${I.arrow}</span></button>
                <button class="btn btn-ghost btn-sm" id="cancel-offer">Tühista pakkumus</button>
              </div>
              <div class="muted" style="font-size:12px;margin-top:8px">Hindu, pindu ja tingimusi muudad all pakkumuse dokumendis — vastus ja uuendatud sisu jõuavad kliendini samal lingil.</div>
            </div>`}
          </div>
        </div>` : isClient() && o.staatus === "Saadetud" ? `
        <div class="doc nego-panel reveal" id="nego-panel" hidden>
          <div class="doc-head"><div><div class="doc-title">Läbirääkimised</div>
            <div class="doc-sub">Kirjeldage vabas vormis, mida sooviksite muuta — pakkumus jääb all nähtavaks</div></div>
            <button class="nego-x" id="nego-close" title="Sulge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
          <div class="nego-body">
            <div class="nego-compose" style="margin-top:2px">
              <textarea id="cl-propose-text" rows="4" class="ce-in" placeholder="Nt üürihind, periood, parkimiskohad…"></textarea>
              <div class="muted" style="font-size:12px;margin-top:8px">Pakkumus jääb kehtima ja link samaks — üürileandja vastab siinsamas ning saadab vajadusel uuendatud pakkumuse.</div>
              <div class="wrap-actions" style="margin-top:12px">
                <button class="btn btn-primary btn-sm" id="cl-propose-send">Saada ettepanek<span class="bic">${I.arrow}</span></button>
                <button class="btn btn-ghost btn-sm" id="nego-cancel">Loobu</button>
              </div>
            </div>
          </div>
        </div>` : "";
  /* uus eritingimus lisandub alati täiendava punktina — „kirjutab üle" seosed
     tekivad läbirääkimistel süsteemi kaudu, käsitsi valikut siin pole */

  return `
  <div class="view">
    <!-- v378: eraldi lehepäist (overline + kliendi nimi H1 + metarida) POLE — nimi kordus kliendiplokis
         (operaator) ja dokumendi „Saaja" plokis (üürnik). Ülemine rida: tagasi-nupp vasakul;
         ainult „Eelvaade · prindi / PDF" paremal (v379: olekupill + „id · loodud · kehtib kuni" meta maas — kordas
         rada ja dokumenti ning ajas vaate segaseks; olek elab rajal ja dokumendis, lõppolekud külgkaardil). -->
    <div class="between reveal" style="margin-bottom:20px;gap:12px;flex-wrap:wrap">
      <a class="btn btn-ghost btn-sm" href="${isClient()?'#/portaal':'#/pakkumised'}">${I.back} ${isClient()?'Minu dokumendid':'Pakkumised'}</a>
      <a class="btn btn-ghost btn-sm" href="#/pakkumus-doc/${o.id}">${I.file} Eelvaade · prindi / PDF</a>
    </div>

    ${isClient() ? `
    <!-- kliendi minimalistlik olekurada: peenike rööbas, hetkeseis pulseeriva punktiga -->
    <div class="cl-track reveal">
      ${clSteps.map((st,i) => `${i?`<span class="ct-rail ${i<=clIdx?'done':''}"></span>`:""}
        <span class="ct-step ${i<clIdx?'done':i===clIdx?'current':''}${i===clIdx && endSt ? ' end' : ''}"><i></i><span>${i===clIdx && endSt ? endSt : st}</span></span>`).join("")}
    </div>` : `
    <!-- operaatori olekurada — sama minimalistlik keel; kliendi ettepanek värvib hetkesammu kollaseks -->
    <div class="cl-track reveal">
      ${states.map((st,i) => `${i?`<span class="ct-rail ${i<=sIdx?'done':''}"></span>`:""}
        <span class="ct-step ${i<sIdx?'done':i===sIdx?'current':''}${i===sIdx && o.staatus==="Kliendi ettepanek" ? ' amber':''}${i===sIdx && endSt ? ' end' : ''}"><i></i><span>${i===sIdx && (o.staatus==="Kliendi ettepanek" || endSt) ? o.staatus : st}</span></span>`).join("")}
    </div>`}

    <!-- sama paigutuskeel kui lepingul: lai dokument + 300px kleepuv külg (mõlemad rollid);
         ajalugu-kaart (v387: taas veerus, külg joondub sellega) + kliendiplokk + läbirääkimiste paneel dokumendi KOHAL samas veerus -->
    <div class="cl-layout">
      <div>
        ${negoHist}
        <!-- operaatori kliendiplokk (mustandis kontaktivorm, hiljem identiteediriba) elab
             DOKUMENDI LAIUSES — mitte külgveeru alla ulatuvana; see ONGI kliendi nimi sel lehel (v378: lehepäist pole) -->
        ${isClient() ? "" : editCt ? `
        <!-- MUSTANDIS: kontaktisiku andmed muudetavad väljadena — dokumendi laiuses kahe reana:
             klient + risk ülal, kolm välja all ühel real -->
        <div class="card pad reveal" style="margin-bottom:20px">
          <div class="between" style="align-items:center;gap:16px;flex-wrap:wrap">
            <div style="min-width:0">
              <div class="overline">Klient</div>
              <div style="font-weight:700;font-size:16px;margin-top:4px">${cl.nimi}</div>
              <div class="muted mono" style="font-size:14px;margin-top:3px">${cl.registrikood} · KMKR ${cl.kmkr||"—"}</div>
            </div>
            <div class="cl-risk">
              ${pill(cl.risk.skoor)}
              <a class="btn btn-ghost btn-sm" href="#/risk/${cl.id}">${I.risk} Riskiraport</a>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">
            <div class="field" style="margin:0"><label>Kontaktisik · nimi</label><input id="ct-nimi" value="${ct.nimi||""}" placeholder="Ees- ja perekonnanimi"/></div>
            <div class="field" style="margin:0"><label>E-post</label><input id="ct-epost" type="email" value="${ct.epost||""}" placeholder="nimi@ettevote.ee"/></div>
            <div class="field" style="margin:0"><label>Telefon</label><input id="ct-tel" value="${ct.tel||""}" placeholder="+372 …"/></div>
          </div>
          <div class="muted" style="font-size:12px;margin-top:12px">Kontaktisik on eeltäidetud kliendikaardilt — pakkumus ja teavitused saadetakse sellele kontaktile.</div>
        </div>` : `
        <!-- SAADETUD/OTSUSTATUD: kliendikaart KAHE reana (v385) — ülal monogramm · nimi+reg · paremal risk +
             Riskiraport; all juuspeene joone järel kontaktisik ühe reana (sama märgikeel mis lõimes).
             Ei murdu ega jäta riski orvuks teisele reale nagu endine ühe-joone identiteediriba. -->
        <div class="card pad reveal" style="margin-bottom:20px">
          <div class="cl-top">
            <span class="cl-mono">${cl.nimi.split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase()}</span>
            <div style="min-width:0">
              <div class="cl-name">${cl.nimi}</div>
              <div class="muted mono" style="font-size:12px;margin-top:2px">reg ${cl.registrikood} · KMKR ${cl.kmkr||"—"}</div>
            </div>
            <div class="cl-risk">
              ${pill(cl.risk.skoor)}
              <a class="btn btn-ghost btn-sm" href="#/risk/${cl.id}">${I.risk} Riskiraport</a>
            </div>
          </div>
          <div class="cl-contact">
            <span class="th-av tenant">${I.user}</span>
            <span class="overline">Kontaktisik</span>
            <b>${ct.nimi||"—"}</b>
            <span class="muted">${ct.epost||"—"}${ct.tel ? ` · <span class="mono">${ct.tel}</span>` : ""}</span>
          </div>
        </div>`}
        ${negoPanel}
        ${isClient() ? `
        <!-- üürnik näeb pakkumust dokumendina (sisu vasakus ääres); otsus elab kõrvalpaanil -->
        <div class="reveal">${offerSheetHTML(o, "sheet-embed")}</div>
        <!-- lisad avatuna dokumendi all — nagu dokumendi jätkulehed -->
        <!-- lisad elavad kõrvalpaanil otsuse all (klõps avab eelvaatemodaali) -->
        ` : !canEditPrice ? `
        <!-- saadetud/otsustatud olekus näeb operaator sedasama dokumenti, mida klient -->
        <div class="reveal">${offerSheetHTML(o, "sheet-embed")}</div>
        ` : `
        <!-- (a) vabas vormis kommertssisu — mustandis muudetav -->
        <div class="doc reveal" style="margin-bottom:20px">
          <div class="doc-head"><div><div class="doc-title">Pakkumuse sisu</div>${canEditPrice?`<div class="doc-sub">Muudetav enne saatmist</div>`:""}</div></div>
          ${canEditPrice ? `
          <div style="padding:20px 24px 16px">
            <!-- vabatekst näeb välja nagu dokumendilõik — serv ilmub alles hoveril/fookusel -->
            <textarea id="kom-in" class="prose-in">${o.kommerts}</textarea>
            <div class="muted" style="font-size:12px;margin-top:8px">Salvestub automaatselt · vabatekst on läbirääkimiseks, lepingusse voolab ainult eritingimuste sektsioon.</div>
          </div>` : `
          <div style="padding:24px 24px;font-size:14px;line-height:1.65;color:var(--ink-2)">${o.kommerts}</div>`}
        </div>

        <!-- üüripinnad: osade jaotus + selge m² × €/m² -->
        <div class="doc reveal" style="margin-bottom:20px">
          <div class="doc-head"><div><div class="doc-title">Üüripinnad</div><div class="doc-sub">Hind €/m² kuus</div></div></div>
          <table class="tbl">
            <thead><tr><th>Pind</th><th>Osa</th><th class="r">m²</th><th class="r">€/m²</th><th class="r">Üür / kuus</th></tr></thead>
            <tbody>
              ${t.rows.map(r => { const sp = r.sp; const parts = spaceParts(sp); const spf = (sp.plaanFail || objektOf(sp).failid.pinnaplaan) || "";
                const partRows = parts.map((p,i) => `<tr>
                  <td>${i===0?`<a class="mono" style="font-weight:700;cursor:pointer;border-bottom:1px dashed var(--line-strong)" onclick="openPdf('${spf}','Lisa 1 · pinnaplaan · ${sp.nimi}')" title="Ava pinnaplaan">${sp.nimi}</a>${canEditPrice && o.spaceIds.length>1?` <button class="rmstep rm-sp" data-sp="${sp.id}" title="Eemalda pind pakkumusest">×</button>`:""}`:""}</td>
                  <td>${p.osa}</td>
                  <td class="r mono">${eur(p.m2,1)}</td>
                  <td class="r mono">${i!==0?"":r.astmeline?`<span class="muted" style="font-size:12px">astmeline ↓</span>`:(canEditPrice
                    ? `<input class="price-in" id="pi-${sp.id}" value="${eur(r.hind)}" inputmode="decimal" aria-label="Üürihind €/m²">`
                    : eur(r.hind))}</td>
                  <td class="r mono" id="rent-${sp.id}">${i!==0||r.astmeline?"":`<b>${eur(r.rent)} €</b>`}</td>
                </tr>`).join("") + (parts.length>1?`<tr>
                  <td></td><td class="muted" style="font-size:14px">kokku</td>
                  <td class="r mono" style="font-size:14px;color:var(--muted)">${eur(sp.yyripind,1)}</td><td></td><td></td>
                </tr>`:"") + (canEditPrice && !r.astmeline ? `<tr>
                  <td></td><td colspan="4" style="padding-top:0;padding-bottom:12px">
                    <button class="steplink" id="add-step-${sp.id}">+ hinnaperiood</button>
                    <span class="muted" id="pl-${sp.id}" style="font-size:12px;margin-left:12px">${r.hind!==sp.hind?`hinnakiri ${eur(sp.hind)}`:""}</span></td>
                </tr>` : "");
                const stepRows = !r.astmeline ? "" : r.periods.map((p,i) => { const last = i===r.periods.length-1;
                  return `<tr>
                    <td></td>
                    <td class="mono" style="font-size:14px">${canEditPrice && !last
                      ? `${p.from}.&ndash; <input class="price-in mo" id="mo-${sp.id}-${i}" value="${p.to}" inputmode="numeric" aria-label="Kuni kuuni"> kuu`
                      : perLabel(p.from,p.to)}</td>
                    <td></td>
                    <td class="r mono">${canEditPrice
                      ? `<input class="price-in" id="pi-${sp.id}-${i}" value="${eur(p.hind)}" inputmode="decimal" aria-label="Üürihind €/m²">${!last?` <button class="rmstep" id="rm-${sp.id}-${i}" title="Eemalda aste">×</button>`:""}`
                      : eur(p.hind)}</td>
                    <td class="r mono"><b>${eur(p.rent)} €</b></td>
                  </tr>`; }).join("") + (canEditPrice?`<tr><td></td><td colspan="4" style="padding-top:4px">
                    <button class="steplink" id="add2-${sp.id}">+ veel aste</button>
                    <span class="muted" style="font-size:12px;margin-left:12px">põhihind = viimane aste · hinnakiri ${eur(sp.hind)} €/m²</span></td></tr>`:"");
                return partRows + stepRows; }).join("")}
            </tbody>
          </table>
          ${canEditPrice && availSpaces.length ? `
          <div style="padding:4px 24px 4px">
            <button class="steplink" id="add-sp-toggle">+ Lisa pind</button>
            <div id="add-sp-list" data-hglide style="display:none;margin-top:8px">
              ${availSpaces.map(s => `<button class="att" data-addsp="${s.id}">
                ${I.building.replace('<svg','<svg class="fic"')}
                <div style="flex:1;text-align:left"><b class="mono">${s.nimi}</b> · ${s.tyyp}
                  <div class="muted" style="font-size:12px">${objektOf(s).nimi} · ${eur(s.yyripind,1)} m² · ${eur(s.hind)} €/m²</div></div>
                <span class="tag">lisa</span></button>`).join("")}
            </div>
          </div>`:""}
          <div class="muted" style="padding:12px 24px 16px;font-size:14px">Kõrvalkulud (küte, vesi, haldus jm): talvine ~${eur(objektOf(t.spaces[0]).korvalkulu.talvine)} €/m², suvine ~${eur(objektOf(t.spaces[0]).korvalkulu.suvine)} €/m² — informatiivne, tasutakse tegeliku tarbimise järgi ega sisaldu pakkumuse summas.</div>
        </div>

        <!-- (b) eritingimused — mustandis lisatavad ja muudetavad -->
        <div class="doc reveal">
          <div class="doc-head"><div><div class="doc-title">Eritingimused</div>${canEditPrice?`<div class="doc-sub">Muudetav enne saatmist</div>`:""}</div>
            <span class="tag">${o.eritingimused.length} punkti</span></div>
          <div class="clause-group">
            ${o.eritingimused.length ? o.eritingimused.map((e,i) => `
              <div class="clause flag">
                <div class="ref">Eri · p${i+1}</div>
                <div class="body">
                  ${canEditPrice && !e.autoGraafik ? `
                  <textarea class="eri-in eri-txt" data-eid="${e.id}" aria-label="Eritingimuse sõnastus">${e.tekst}</textarea>
                  ${e.kirjutabYle ? `<div class="overwrite">${I.arrow} kirjutab üle: ${e.kirjutabYle}</div>` : ""}` : `
                  <div class="txt" style="color:var(--ink)">${e.tekst}</div>
                  ${e.kirjutabYle?`<div class="overwrite">${I.arrow} kirjutab üle: ${e.kirjutabYle}</div>`:""}
                  ${e.autoGraafik?`<div class="muted" style="font-size:12px;margin-top:4px">Genereeritud hinnagraafikust — uueneb hinna muutmisel automaatselt.</div>`:""}`}
                </div>
                <div>${canEditPrice && !e.autoGraafik ? `<button class="rmstep eri-rm" data-eid="${e.id}" title="Eemalda eritingimus">×</button>` : ""}</div>
              </div>`).join("") : (canEditPrice ? "" : `<div class="empty" style="padding:32px"><div>Eritingimusi pole veel lisatud.</div></div>`)}
            ${canEditPrice ? `
            <!-- sama vaikne keel kui „+ Lisa pind": steplink avab kompaktse kirjutaja -->
            <div style="padding:2px 0 8px">
              <button class="steplink" id="eri-add-toggle">+ Lisa eritingimus</button>
              <div class="eri-add" id="eri-add-box" style="display:none;margin:12px 0 0">
                <textarea id="eri-new" class="eri-in" placeholder="Sõnasta eritingimus… nt „Üürivaba sisseseadeperiood 1 kuu alates üleandmispäevast.&quot;"></textarea>
                <div class="eri-tools">
                  <button class="btn btn-primary btn-sm" id="eri-add-btn">${I.plus} Lisa punkt</button>
                  <span class="muted" style="font-size:12px">täiendav tingimus · jõuab lepingu Lisa 3-e</span>
                </div>
              </div>
            </div>`:""}
          </div>
        </div>`}
      </div>

      <!-- külgveerg: operaatoril töölaud, kliendil otsusepaan — mõlemal kleepuv -->
      <div class="cl-side">
        ${isClient() && clientSeesOffer(o) ? `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:8px">Teie otsus · ${o.id}</div>
          <div class="cd-sum">${eur(t.rentSum,0)} € <small>/ kuu (neto)</small></div>
          <div class="muted" style="font-size:12px;margin:4px 0 16px">Link kehtib kuni <b>${o.kehtivKuni}</b> · kontot pole vaja</div>
          ${o.staatus === "Saadetud" ? `
          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-bottom:8px" id="cl-accept">${I.check} Aktsepteerin pakkumuse</button>
          <div id="cl-konto-area" style="display:none;margin-bottom:8px;padding:12px;background:var(--surface-soft);border-radius:8px">
            <div class="overline" style="margin-bottom:8px">Kontoloome · kinnitage andmed</div>
            <div class="muted" style="font-size:12px;margin-bottom:12px">Aktsepteerimisel luuakse ${cl.nimi} kliendikonto — sealt näete lepinguid, tähtaegu ja vestlust.</div>
            <div class="field" style="margin:0 0 8px"><label>Ettevõte</label><input value="${cl.nimi} · reg ${cl.registrikood}" disabled></div>
            <div class="field" style="margin:0 0 8px"><label>Esindaja nimi</label><input id="ka-nimi" value="${ct.nimi||cl.kontakt}"></div>
            <div class="field" style="margin:0 0 8px"><label>Isikukood (allkirjastamiseks)</label><input id="ka-ik" placeholder="38xxxxxxxxx" inputmode="numeric"></div>
            <div class="field" style="margin:0 0 8px"><label>E-post</label><input id="ka-epost" type="email" value="${ct.epost||cl.epost}"></div>
            <div class="field" style="margin:0 0 12px"><label>Telefon</label><input id="ka-tel" value="${ct.tel||""}" placeholder="+372 …"></div>
            <button class="btn btn-primary btn-sm" style="width:100%;justify-content:center" id="cl-konto-go">${I.check} Loo konto ja aktsepteeri</button>
          </div>
          <button class="btn btn-ghost" style="width:100%;justify-content:center;margin-bottom:8px" id="cl-propose">${I.chat} Alusta läbirääkimisi</button>
          <!-- keeldumine on lahutatud joonega — et seda ei vajutataks ekslikult läbirääkimiste asemel -->
          <div style="border-top:1px solid var(--line);margin:12px 0 8px"></div>
          <button class="btn btn-text btn-destructive" style="width:100%" id="cl-decline">${I.x} Lükkan pakkumuse tagasi</button>` :
          o.staatus === "Kliendi ettepanek" ? `
          <div class="note">${I.info}<div>Teie ettepanek on üürileandjal ülevaatamisel — uuendatud pakkumus tuleb samale lingile.</div></div>` :
          ["Aktsepteeritud","Lepinguks teisendatud"].includes(o.staatus) ? `
          <div class="note" style="background:var(--green-soft);color:var(--green-ink)">${I.check.replace('stroke-width="2.2"','stroke-width="1.8"')}<div>Aktsepteeritud — ${seotud.length ? "leping on koostatud." : "üürileandja koostab lepingu mustandi."}</div></div>
          ${seotud.length ? `<a class="btn btn-primary" style="width:100%;justify-content:center;margin-top:12px" href="#/leping/${seotud[0]}">${I.lease} Ava leping</a>` : ""}` : `
          <div class="note accent">${I.warn}<div>Pakkumuse link on aegunud — küsige üürileandjalt uus pakkumus.</div></div>`}
        </div>` : ""}
        ${isClient() && clientSeesOffer(o) ? `
        <!-- lisad otsuse all — klõps avab eelvaatemodaali (varem iframe'idena dokumendi all) -->
        ${lisadCard(t, "reveal", "margin-top:18px")}` : ""}
        <!-- TEGEVUS on veerus esimene — kleepuva külje ülaosas alati nähtav -->
        ${!isClient() && o.staatus==="Mustand" ? `
        <div class="card pad reveal">
          <button class="btn btn-primary" style="width:100%;justify-content:center" id="send-offer">Kinnita ja saada ${I.arrow.replace('<svg','<svg class="arr"')}</button>
          <div class="muted" style="font-size:12px;margin-top:8px;text-align:center">Klient saab lingi e-postile · kehtib ${o.kehtivKuni}-ni</div>
        </div>`:""}
        <!-- (kliendi ettepaneku vastamine elab dokumendi kohal läbirääkimiste paneelis) -->
        <!-- (kliendi otsus elab kleepuval tegevusribal vaate lõpus) -->
        ${!isClient() && o.staatus==="Saadetud" ? `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:12px">Ootab kliendi otsust</div>
          <div class="muted" style="font-size:14px;margin-bottom:12px">Jagamislink on saadetud e-postile <span class="mono">${ct.epost||cl.epost}</span> ja kehtib kuni ${o.kehtivKuni}. Klient toimetab ilma kontota — konto luuakse aktsepteerimisel (küsitakse isiku-/ettevõtteandmed). Demo korras saad läbirääkimise ise läbi mängida:</div>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center" id="view-as-client">Ava kliendilink (${ct.nimi||cl.kontakt}) →</button>
        </div>`:""}
        <!-- (kliendi olekuinfo elab otsuseribal) -->
        ${!isClient() && o.staatus==="Aktsepteeritud" && !seotud.length ? `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:8px">Aktsepteeritud</div>
          <div class="muted" style="font-size:14px;margin-bottom:12px">Pakkumus voolab lepingu malli: ${o.spaceIds.length > 1 ? `${o.spaceIds.length} pinda → ${o.spaceIds.length} lepingu mustandit (üks pinna kohta)` : "tekib lepingu mustand"} — üldtingimused mallist (lukus), põhitingimused tehinguandmetest, eritingimused kopeeritakse Lisa 3-e.</div>
          <button class="btn btn-primary" style="width:100%;justify-content:center" id="to-lease">${I.lease} Loo lepingu mustand${o.spaceIds.length > 1 ? "id" : ""} →</button>
        </div>`:""}
        ${isClient() ? "" : `<div style="margin-top:20px">${priceCard(t, vat, "reveal")}</div>`}

        ${isClient() ? "" : lisadCard(t, "reveal", "margin-top:18px")}
        ${seotud.length ? `
        <div class="card pad reveal" style="margin-top:20px">
          <div class="overline" style="margin-bottom:12px">Lepingud sellest pakkumusest</div>
          <div data-hglide>
          ${seotud.map(lid => { const ll = DB.leaseById(lid); return `
          <button class="att" onclick="location.hash='#/leping/${lid}'">
            ${I.lease.replace('<svg','<svg class="fic"')}
            <div style="flex:1;text-align:left"><b>${lid}</b>${ll ? `<div class="muted" style="font-size:12px">${(DB.spaceById(ll.spaceId)||{}).nimi || ""}</div>` : ""}</div>
            ${ll ? pill(ll.staatus) : ""}
          </button>`; }).join("")}
          </div>
        </div>`:""}
      </div>
    </div>


  </div>`;
};
/* ---------- Pakkumuse dokument (eelvaade · prindi / salvesta PDF) ----------
   Leht on jagatud: täisvaade (prindi/PDF) + üürniku pakkumusvaate sisseehitatud eelvaade */
function offerSheetHTML(o, cls) {
  const cl = DB.clientById(o.clientId), ct = offerContact(o, cl), t = offerTotals(o);
  const vat = OBJEKT.kaibemaksugaMaksustatud, L = ACCOUNT.landlord;
  const m2 = t.spaces.reduce((s, x) => s + x.yyripind, 0);

  const rowsHtml = t.rows.map(r => { const sp = r.sp;
    /* pinna kirjeldusrida: jaotus + elektrivõimsus pinna lõikes (laoboksidel võimsust pole) */
    const partTxt = spaceParts(sp).map(p => `${p.osa} ${eur(p.m2,1)} m²`).join(" + ")
      + (sp.elekter ? ` · elektrivõimsus ${sp.elekter} A` : "");
    if (!r.astmeline) return `<tr>
      <td><b>${sp.nimi}</b><div class="sh-sub">${partTxt}</div></td>
      <td class="r mono">${eur(sp.yyripind,1)}</td>
      <td class="r mono">${eur(r.hind)}</td>
      <td class="r mono"><b>${eur(r.rent)} €</b></td></tr>`;
    return `<tr>
      <td><b>${sp.nimi}</b><div class="sh-sub">${partTxt}</div></td>
      <td class="r mono">${eur(sp.yyripind,1)}</td>
      <td class="r sh-sub" colspan="2">astmeline üür:</td></tr>` +
      r.periods.map(p => `<tr>
        <td class="sh-sub" style="padding-left:20px">${perLabel(p.from,p.to)}</td><td></td>
        <td class="r mono">${eur(p.hind)}</td>
        <td class="r mono"><b>${eur(p.rent)} €</b></td></tr>`).join("");
  }).join("");

  const totHtml = t.astmeline
    ? t.segments.map(sg => `<tr class="tot"><td colspan="3">Üür kokku ${perLabel(sg.from,sg.to)} (neto)</td><td class="r mono"><b>${eur(sg.sum)} €</b></td></tr>`).join("") +
      (vat ? `<tr><td colspan="3" class="sh-sub">Käibemaks ${VAT_RATE*100}% lisandub · bruto vastavalt ${t.segments.map(sg => eur(withVat(sg.sum)) + " €").join(" / ")}</td><td></td></tr>` : "") +
      `<tr><td colspan="3" class="sh-sub">Kaalutud keskmine ${t.kuud} kuu peale</td><td class="r mono">${eur(t.avgM2)} €/m² · ${eur(t.avgSum)} €/kuus</td></tr>`
    : `<tr class="tot"><td colspan="3">Üür kokku (neto) · ${eur(m2,1)} m²</td><td class="r mono"><b>${eur(t.rentSum)} €</b></td></tr>` +
      (vat ? `<tr><td colspan="3">Käibemaks (${VAT_RATE*100}%)</td><td class="r mono">${eur(t.rentSum*VAT_RATE)} €</td></tr>
      <tr class="tot"><td colspan="3">Üür kokku (bruto)</td><td class="r mono"><b>${eur(withVat(t.rentSum))} €</b></td></tr>` : "");

  return `
    <div class="sheet ${cls || ""}">
      <div class="sh-head">
        <div>
          ${(obj0 => obj0.logo ? `<img class="sh-logo" src="${obj0.logo}" alt="${obj0.nimi}">` : "")(objektOf(t.spaces[0]))}
          <div class="sh-brand">${L.nimi}</div>
          <div class="sh-sub">${L.aadress}<br>Reg ${L.registrikood} · KMKR ${L.kmkr}<br>${L.epost} · ${L.mobiil}</div>
        </div>
        <div style="text-align:right">
          <div class="sh-title">Hinnapakkumine</div>
          <div class="sh-sub mono">${o.id}<br>Kuupäev: ${o.loodud}<br>Kehtib kuni: <b>${o.kehtivKuni}</b><br>Rendiperiood: <b>${o.pikkusKuud} kuud</b></div>
        </div>
      </div>

      <div class="sh-to">
        <div class="sh-lbl">Saaja</div>
        <b>${cl.nimi}</b> · reg ${cl.registrikood}${cl.kmkr?` · KMKR ${cl.kmkr}`:""}<br>
        ${ct.nimi||"—"}${ct.epost?` · ${ct.epost}`:""}${ct.tel?` · ${ct.tel}`:""}
      </div>

      <p class="sh-intro">${o.kommerts}</p>

      <div class="sh-lbl">Üüripinnad ja hinnastus · ${hoonedOf(t.spaces)} · ${objektOf(t.spaces[0]).ehr.aadress}</div>
      <table class="sh-tbl">
        <thead><tr><th>Pind</th><th class="r">Üüripind m²</th><th class="r">€/m² kuus</th><th class="r">Üür € / kuus</th></tr></thead>
        <tbody>${rowsHtml}${totHtml}</tbody>
      </table>
      <div class="sh-sub" style="margin-top:8px">Pakkumus sisaldab ${t.parking} parkimiskohta; elektrivõimsus kokku ${t.spaces.reduce((s,x)=>s+x.elekter,0)} A. Üüripind = netopind × üldpinna koefitsient.</div>
      <div class="sh-sub" style="margin-top:4px">Kõrvalkulud (küte, vesi, haldus jm) tasutakse tegeliku tarbimise järgi ega sisaldu pakkumuse summas — viiteväärtus: talvine ~${eur(objektOf(t.spaces[0]).korvalkulu.talvine)} €/m², suvine ~${eur(objektOf(t.spaces[0]).korvalkulu.suvine)} €/m² (${objektOf(t.spaces[0]).korvalkulu.allikas}).</div>

      <div class="sh-lbl" style="margin-top:24px">Eritingimused</div>
      ${o.eritingimused.length
        ? `<ol class="sh-ol">${o.eritingimused.map(e => `<li>${e.tekst}${e.kirjutabYle?` <span class="sh-sub">(kirjutab üle: ${e.kirjutabYle})</span>`:""}</li>`).join("")}</ol>`
        : `<div class="sh-sub">Eritingimusi ei ole — kohalduvad üürileandja standardtingimused.</div>`}

      <div class="sh-lbl" style="margin-top:20px">Lisad</div>
      <div class="sh-sub">${t.spaces.map(sp => `Lisa 1 · Pinnaplaan (${sp.nimi})`).join("; ")}; Lisa 2 · Asendiplaan + parkimisskeem. Lepingu sõlmimisel kohalduvad äriruumide üürilepingu üldtingimused (mall, v3.2).</div>

      <div class="sh-foot">
        <div>Koostas: ${o.looja} · ${L.nimi}<br><span class="sh-sub">${L.epost} · ${L.mobiil}</span></div>
        <div style="text-align:right" class="sh-sub">Pakkumus ei ole siduv enne kirjalikku kinnitust.<br>Koostatud ThinkOne platvormil · ${TODAY_EE}</div>
      </div>
    </div>`;
}

View.pakkumusDoc = (id) => {
  const o = DB.offerById(id); if (!o) return notFound("Pakkumust ei leitud");
  if (isClient() && !clientSeesOffer(o)) return notFound("See pakkumus ei ole veel teile saadetud");
  return `
  <div class="view docview">
    <div class="between no-print" style="width:100%;max-width:840px;margin-bottom:20px">
      <a class="btn btn-ghost btn-sm" href="#/pakkumus/${o.id}">${I.back} Tagasi pakkumusele</a>
      <button class="btn btn-primary btn-sm" onclick="window.print()">${I.file} Prindi / salvesta PDF</button>
    </div>
    ${offerSheetHTML(o)}
  </div>`;
};

View.pakkumus.init = (id) => {
  const o = DB.offerById(id); if (!o) return;
  const mutate = (fn, msg) => { fn(); AUDIT.unshift({ aeg: NOW_EE(), autor: isClient() ? roleClient().kontakt + " (üürnik)" : "Tarmo Sepp", tegevus: msg }); DB.save(); toast(msg); router(); };

  /* üürihinna muutmine (€/m²) — arvutused uuenevad kohe, ilma täisrenderduseta */
  const recalc = () => {
    const t = offerTotals(o);
    const set = (eid, html) => { const el = document.getElementById(eid); if (el) el.innerHTML = html; };
    t.rows.forEach(r => {
      set("rent-" + r.sp.id, `<b>${eur(r.rent)} €</b>`);
      set("pc-rent-" + r.sp.id, `${eur(r.rent)} €`);   // mitme pinnaga kokkuvõte
      set("pc-hind-" + r.sp.id, eur(r.hind));
      set("pl-" + r.sp.id, r.hind !== r.sp.hind ? `hinnakiri ${eur(r.sp.hind)}` : "");
    });
    set("pc-net", `${eur(t.rentSum)} €`);
    set("pc-vat", `${eur(t.rentSum*VAT_RATE)} €`);
    set("pc-gross", `${eur(withVat(t.rentSum))} €`);
  };
  /* hinnagraafiku muudatus: sordi astmed, uuenda auto-eritingimus, salvesta, renderda uuesti */
  const finishG = (sp, msg) => {
    const g = o.graafik && o.graafik[sp.id];
    if (g) g.sort((a, b) => (a.kuniKuu == null) - (b.kuniKuu == null) || a.kuniKuu - b.kuniKuu);
    syncGraafikEri(o);
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: ${sp.nimi} ${msg} — ` +
      pricePeriods(o, sp).map(p => `${perLabel(p.from, p.to)} ${eur(p.hind)} €/m²`).join(", ") + "." });
    DB.save(); router();
  };
  const num = (v) => { const n = parseFloat(String(v).replace(",", ".")); return (isFinite(n) && n > 0) ? n : null; };

  o.spaceIds.map(DB.spaceById).forEach(sp => {
    const inp = document.getElementById("pi-" + sp.id);
    if (inp) {
      inp.oninput = () => {
        const v = num(inp.value); if (v == null) return; // poolik sisestus — oota
        o.hinnad = o.hinnad || {};
        if (Math.abs(v - sp.hind) < 0.005) delete o.hinnad[sp.id]; else o.hinnad[sp.id] = v;
        recalc(); DB.save();
      };
      inp.onchange = () => {
        const v = num(inp.value);
        if (v == null) { inp.value = eur(offerPrice(o, sp)); return; } // vigane sisend → taasta
        inp.value = eur(offerPrice(o, sp));
        AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: ${sp.nimi} üürihind → ${eur(offerPrice(o, sp))} €/m² (hinnakiri ${eur(sp.hind)}).` });
        DB.save();
      };
    }

    /* astmeline üür: + hinnaperiood → graafik kahe astmega (praegune hind → põhihind) */
    const addStep = document.getElementById("add-step-" + sp.id);
    if (addStep) addStep.onclick = () => {
      const cur = offerPrice(o, sp);
      o.graafik = o.graafik || {};
      o.graafik[sp.id] = [{ kuniKuu: 12, hind: cur }, { kuniKuu: null, hind: sp.hind }];
      if (o.hinnad) delete o.hinnad[sp.id];
      finishG(sp, "hinnagraafik lisatud");
    };

    const g = o.graafik && o.graafik[sp.id];
    if (g) {
      g.forEach((row, i) => {
        const pi = document.getElementById(`pi-${sp.id}-${i}`);
        if (pi) pi.onchange = () => { const v = num(pi.value); if (v == null) { pi.value = eur(row.hind); return; } row.hind = v; finishG(sp, "hinnagraafik muudetud"); };
        const mo = document.getElementById(`mo-${sp.id}-${i}`);
        if (mo) mo.onchange = () => { const v = parseInt(mo.value, 10); if (!isFinite(v) || v < 1) { mo.value = row.kuniKuu; return; } row.kuniKuu = v; finishG(sp, "hinnagraafik muudetud"); };
        const rm = document.getElementById(`rm-${sp.id}-${i}`);
        if (rm) rm.onclick = () => {
          g.splice(i, 1);
          if (g.length === 1) { // viimane aste üksi → tagasi lihthinnaks
            const base = g[0].hind;
            delete o.graafik[sp.id];
            if (Math.abs(base - sp.hind) >= 0.005) { o.hinnad = o.hinnad || {}; o.hinnad[sp.id] = base; }
          }
          finishG(sp, "hinnaaste eemaldatud");
        };
      });
      const add2 = document.getElementById("add2-" + sp.id);
      if (add2) add2.onclick = () => {
        const prevBound = g.length > 1 ? (g[g.length - 2].kuniKuu || 12) : 12;
        g.splice(g.length - 1, 0, { kuniKuu: prevBound + 12, hind: g[g.length - 1].hind });
        finishG(sp, "hinnaaste lisatud");
      };
    }
  });

  const send = document.getElementById("send-offer");
  if (send) send.onclick = () => objReady(offerTotals(o).spaces) && mutate(() => o.staatus = "Saadetud", `Pakkumus ${o.id} saadetud · jagamislink kliendi e-postile (kehtib kuni ${o.kehtivKuni})`);

  const resend = document.getElementById("resend-offer");
  if (resend) resend.onclick = () => {
    if (!objReady(offerTotals(o).spaces)) return;
    const replyEl = document.getElementById("op-reply");
    const reply = replyEl ? replyEl.value.trim() : "";
    mutate(() => { o.staatus = "Saadetud"; o.kliendiEttepanek = null;
      if (reply) (o.labiraakimised = o.labiraakimised || []).push({ roll: "operaator", autor: "Tarmo Sepp (üürileandja)", tekst: reply, aeg: NOW_EE() });
    }, `Pakkumus ${o.id} uuendatud ja saadetud uuesti kliendile`);
  };
  /* pindade lisamine/eemaldamine (Mustand ja Kliendi ettepanek) — summad arvutuvad ümber */
  document.querySelectorAll(".rm-sp").forEach(b => b.onclick = () => {
    const sid = b.dataset.sp; if (o.spaceIds.length <= 1) return;
    const spn = (DB.spaceById(sid) || {}).nimi || sid;
    mutate(() => { o.spaceIds = o.spaceIds.filter(x => x !== sid);
      if (o.hinnad) delete o.hinnad[sid];
      if (o.graafik) delete o.graafik[sid];
    }, `Pind ${spn} eemaldatud pakkumusest ${o.id}`);
  });
  const addSpT = document.getElementById("add-sp-toggle");
  if (addSpT) addSpT.onclick = () => {
    const list = document.getElementById("add-sp-list");
    if (list) list.style.display = list.style.display === "none" ? "block" : "none";
  };
  document.querySelectorAll("[data-addsp]").forEach(b => b.onclick = () => {
    const sid = b.dataset.addsp;
    const spn = (DB.spaceById(sid) || {}).nimi || sid;
    mutate(() => o.spaceIds.push(sid), `Pind ${spn} lisatud pakkumusse ${o.id}`);
  });
  const cancel = document.getElementById("cancel-offer");
  if (cancel) cancel.onclick = () => { if (!confirm(`Tühista pakkumus ${o.id}? See on lõppolek — lepingut sellest ei teki.`)) return;
    mutate(() => o.staatus = "Tühistatud", `Pakkumus ${o.id} tühistatud`); };

  const vac = document.getElementById("view-as-client");
  if (vac) vac.onclick = () => setRole("client", o.clientId, "#/pakkumus/" + o.id);

  /* mustandis: kommertssisu ja eritingimuste muutmine (autosalvestus) */
  const kom = document.getElementById("kom-in");
  if (kom) kom.onchange = () => {
    const v = kom.value.trim();
    if (!v) { kom.value = o.kommerts; return; }
    o.kommerts = v;
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: kommertssisu muudetud.` });
    DB.save();
  };
  const eriById = (eid) => (o.eritingimused || []).find(x => String(x.id) === String(eid));
  document.querySelectorAll(".eri-txt").forEach(t => t.onchange = () => {
    const e = eriById(t.dataset.eid); if (!e) return;
    const v = t.value.trim();
    if (!v) { t.value = e.tekst; return; }
    e.tekst = v;
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: eritingimuse sõnastus muudetud.` });
    DB.save();
  });
  document.querySelectorAll(".eri-rm").forEach(b => b.onclick = () => {
    const e = eriById(b.dataset.eid); if (!e) return;
    if (!confirm("Eemalda eritingimus? Seda ei saa tagasi võtta.")) return;
    o.eritingimused = o.eritingimused.filter(x => x !== e);
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: eritingimus eemaldatud.` });
    DB.save(); toast("Eritingimus eemaldatud"); router();
  });
  const eriT = document.getElementById("eri-add-toggle");
  if (eriT) eriT.onclick = () => {
    const box = document.getElementById("eri-add-box");
    if (!box) return;
    const open = box.style.display === "none";
    box.style.display = open ? "block" : "none";
    if (open) { const t = document.getElementById("eri-new"); if (t) t.focus(); }
  };
  const eriAdd = document.getElementById("eri-add-btn");
  if (eriAdd) eriAdd.onclick = () => {
    const txtEl = document.getElementById("eri-new"), kyEl = document.getElementById("eri-new-ky");
    const txt = txtEl ? txtEl.value.trim() : "";
    if (!txt) { toast("Sõnasta enne eritingimuse tekst"); if (txtEl && txtEl.focus) txtEl.focus(); return; }
    const ky = (kyEl && kyEl.value) || null;
    o.eritingimused.push({ id: "e" + Date.now(), tekst: txt, kirjutabYle: ky });
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: eritingimus lisatud${ky ? ` (kirjutab üle: ${ky})` : ""}.` });
    DB.save(); toast("Eritingimus lisatud · voolab lepingu Lisa 3-e"); router();
  };

  /* kontaktisiku väljad (mustandis): salvestuvad pakkumuse külge */
  const saveCt = () => {
    const g = (eid) => { const e = document.getElementById(eid); return e ? String(e.value).trim() : ""; };
    o.kontakt = { nimi: g("ct-nimi"), epost: g("ct-epost"), tel: g("ct-tel") };
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: kontaktisik → ${o.kontakt.nimi||"—"} · ${o.kontakt.epost||"—"} · ${o.kontakt.tel||"—"}.` });
    DB.save();
  };
  ["ct-nimi","ct-epost","ct-tel"].forEach(eid => { const e = document.getElementById(eid); if (e) e.onchange = saveCt; });

  /* aktsepteeritud pakkumus → lepingu mustand(id): N pinda = N lepingut (etapp 04.8) */
  const toLease = document.getElementById("to-lease");
  if (toLease) toLease.onclick = () => {
    const cl2 = DB.clientById(o.clientId);
    const ct2 = offerContact(o, cl2);
    const made = [];
    o.spaceIds.forEach(sid => {
      const sp = DB.spaceById(sid);
      const num = Math.max(0, ...LEASES.map(x => +x.id.split("-")[2] || 0)) + 1;
      const lid = `LEP-${DEMO_TODAY.getFullYear()}-` + String(num).padStart(3, "0");
      const hind = offerPrice(o, sp); /* põhihind: erihind või graafiku viimane aste */
      /* v408: üleandmispäev = järgmise kuu algus PÄRIS tänasest; lõpp ja indekseerimine sealt edasi */
      const y0 = DEMO_TODAY.getFullYear(), m0 = DEMO_TODAY.getMonth() + 1;
      const algusD = new Date(y0, m0, 1);
      const loppD = new Date(y0, m0 + o.pikkusKuud, 0);
      const indD = new Date(y0 + 1, m0, 1);
      const tehing = { algus: fmtISO(algusD), kuud: o.pikkusKuud, hind, tagatisKuud: 3,
        parkimine: sp.parkimine, otstarve: null, erisused: null };
      LEASES.push({
        id: lid, clientId: o.clientId, spaceId: sid, pakkumus: o.id,
        staatus: "Mustand V1", versioon: "Mustand V1", pikkusKuud: o.pikkusKuud,
        algus: fmtEE(algusD), lopp: fmtEE(loppD), allkirjastatud: null,
        kontakt: ct2 ? { nimi: ct2.nimi, epost: ct2.epost, tel: ct2.tel } : null,
        indeks: { meetod: "Fikseeritud %", maar: "3%", sagedus: "iga 12 kuu", jargmine: fmtEE(indD) },
        tehing,
        pohi: pohiTehing({ cl: cl2, ct: ct2, sp, facts: tehing }),
        /* pakkumuse (b) eritingimused kopeeritakse automaatselt Lisa 3-e (juba kokku lepitud) */
        eri: (o.eritingimused || []).map((e, i) => ({ ref: `Lisa 3 · p${i + 1}`, tekst: e.tekst, kirjutabYle: e.kirjutabYle || null, staatus: "Aktsepteeritud" })),
        kommentaarid: [],
        lisad: [
          { nr: 1, nimi: `Pinnaplaan (${sp.nimi})`, fail: (sp.plaanFail || objektOf(sp).failid.pinnaplaan) || "— lisamata —" },
          { nr: 2, nimi: "Asendiplaan + parkimisskeem", fail: objektOf(sp).failid.parkimine || "— lisamata —" },
          { nr: 3, nimi: "Eritingimused", fail: "— genereeritud —" },
        ],
        allkirjad: [],
      });
      sp.staatus = "Lepingus"; sp.tenant = cl2.nimi;
      made.push(lid);
    });
    o.lepingud = made; o.seotudLeping = made[0]; o.staatus = "Lepinguks teisendatud";
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id} teisendatud lepingu${made.length > 1 ? "teks" : "ks"}: ${made.join(", ")} — üldtingimused mallist, põhitingimused tehinguandmetest, eritingimused Lisa 3-e.` });
    DB.save();
    toast(made.length > 1 ? `${made.length} lepingu mustandit loodud · eritingimused kopeeritud Lisa 3-e` : "Lepingu mustand V1 loodud · eritingimused kopeeritud Lisa 3-e");
    location.hash = "#/leping/" + made[0];
  };

  /* aktsept → kontoloome (spets 7.2): küsitakse isiku-/ettevõtteandmed, siis konto + aktsept */
  const acc = document.getElementById("cl-accept");
  if (acc) acc.onclick = () => { const a = document.getElementById("cl-konto-area");
    a.style.display = a.style.display === "none" ? "block" : "none"; };
  const kontoGo = document.getElementById("cl-konto-go");
  if (kontoGo) kontoGo.onclick = () => {
    const g = (eid) => { const e = document.getElementById(eid); return e ? String(e.value).trim() : ""; };
    const nimi = g("ka-nimi"), epost = g("ka-epost");
    if (!nimi || !/^\S+@\S+\.\S+$/.test(epost)) { toast("Kontrollige esindaja nime ja e-posti"); return; }
    const cl2 = DB.clientById(o.clientId);
    mutate(() => { o.staatus = "Aktsepteeritud"; cl2.konto = { loodud: TODAY_EE, esindaja: nimi, epost }; },
      `Kliendikonto loodud (${cl2.nimi} · ${nimi}) · pakkumus ${o.id} aktsepteeritud`);
  };
  const dec = document.getElementById("cl-decline");
  if (dec) dec.onclick = () => { if (!confirm("Lükkad pakkumuse tagasi? See on lõppolek.")) return;
    mutate(() => o.staatus = "Tagasi lükatud", `Pakkumus ${o.id} tagasi lükatud`); };
  /* läbirääkimised: „Alusta läbirääkimisi" avab paneeli dokumendi KOHAL (mitte modaali) —
     üürnik näeb kirjutades pakkumust; ettepanek läheb mõlemale nähtavasse logisse */
  const negoPanelEl = document.getElementById("nego-panel");
  const negoOpen = (open) => { if (!negoPanelEl) return; negoPanelEl.hidden = !open;
    if (open) { negoPanelEl.scrollIntoView({ behavior: "smooth", block: "start" });
      const t = document.getElementById("cl-propose-text"); if (t) t.focus({ preventScroll: true }); } };
  const prop = document.getElementById("cl-propose");
  if (prop) prop.onclick = () => negoOpen(true);
  ["nego-close", "nego-cancel"].forEach(eid => { const b = document.getElementById(eid); if (b) b.onclick = () => negoOpen(false); });
  /* kliendi täiendus lõimes (ettepaneku seisus) — sama logi, uus sissekanne */
  const negoAdd = document.getElementById("cl-nego-add");
  if (negoAdd) negoAdd.onclick = () => {
    const t = document.getElementById("cl-nego-more"); const txt = t ? t.value.trim() : "";
    if (!txt) { toast("Kirjuta täiendus"); if (t) t.focus(); return; }
    const cl3 = DB.clientById(o.clientId), ct3 = offerContact(o, cl3);
    mutate(() => (o.labiraakimised = o.labiraakimised || []).push({ roll: "klient", autor: (ct3.nimi || cl3.kontakt) + " (üürnik)", tekst: txt, aeg: NOW_EE() }),
      "Täiendus saadetud üürileandjale");
  };
  const propSend = document.getElementById("cl-propose-send");
  if (propSend) propSend.onclick = () => {
    const txt = document.getElementById("cl-propose-text").value.trim();
    if (!txt) { toast("Kirjeldage soovitud muudatust"); return; }
    const cl2 = DB.clientById(o.clientId), ct2 = offerContact(o, cl2);
    mutate(() => { o.staatus = "Kliendi ettepanek"; o.kliendiEttepanek = txt;
      (o.labiraakimised = o.labiraakimised || []).push({ roll: "klient", autor: (ct2.nimi || cl2.kontakt) + " (üürnik)", tekst: txt, aeg: NOW_EE() });
    }, `Muudatusettepanek saadetud · operaator vaatab üle`);
  };
};

/* Kokkuvõte-kaart (pakkumuse külgveerg) — viide examples/rent_offer_full_panel_arrow_button.html:
   suur bruto-number ees, siis pind/hind/neto read, kõrvalkulud kiipidena. Ühe pinnaga pakkumus
   järgib viidet 1:1; mitme pinnaga saab iga pind oma rea (m² × €/m² → €), astmeline hind
   näitab astmed pinna all ja kokku-read perioodi kaupa. id-d (pc-*) hoiab recalc elus. */
function priceCard(t, vat, cls="") {
  const m2 = t.spaces.reduce((s,x)=>s+x.yyripind,0);
  const ob = objektOf(t.spaces[0]);
  const one = t.rows.length === 1;
  /* rida: silt + arv ühel joonel; valikuline arvutus (calc) vaikselt teise reana all, et kitsas veerus ei murduks */
  const row = (l, v, id="", strong=false, calc="") => `<div class="pc-row"><span class="lbl">${l}</span><span class="num${strong?" strong":""}"${id?` id="${id}"`:""}>${v}</span>${calc?`<span class="pc-calc">${calc}</span>`:""}</div>`;
  const base = t.astmeline ? t.avgSum : t.rentSum;   // astmelise puhul kaalutud keskmine
  const big = vat ? withVat(base) : base;
  const elekter = t.spaces.reduce((s,x)=>s+x.elekter,0);
  return `
  <div class="card pad pc ${cls}">
    <h3 class="side-h">Kokkuvõte</h3>
    <div class="pc-lbl">Üür kuus (${vat?"bruto":"neto"})${t.astmeline?` · ${t.kuud} kuu keskmine`:""}</div>
    <div class="pc-big"${t.astmeline?"":' id="pc-gross"'}>${eur(big)} €</div>
    ${vat ? `<div class="pc-sub">sh käibemaks ${VAT_RATE*100}% · <span${t.astmeline?"":' id="pc-vat"'}>${eur(base*VAT_RATE)} €</span></div>` : ""}
    <div class="pc-hr"></div>
    ${t.rows.map(r => r.astmeline
      ? row(r.sp.nimi, `${eur(r.sp.yyripind,1)} m²`) + r.periods.map(p => row(`<span class="pc-per">${perLabel(p.from,p.to)}</span> · ${eur(p.hind)} €/m²`, `${eur(p.rent)} €`)).join("")
      : one
        ? row(r.sp.nimi, `${eur(r.sp.yyripind,1)} m²`) + row("Hind", `<span id="pc-hind-${r.sp.id}">${eur(r.hind)}</span> €/m²`)
        : row(r.sp.nimi, `${eur(r.rent)} €`, "pc-rent-"+r.sp.id, false, `${eur(r.sp.yyripind,1)} m² × <span id="pc-hind-${r.sp.id}">${eur(r.hind)}</span> €/m²`)
    ).join("")}
    ${t.astmeline
      ? (one ? "" : t.segments.map(sg => row(`Kokku ${perLabel(sg.from,sg.to)}`, `${eur(sg.sum)} €`, "", true)).join(""))
      : row(`Üür kokku (neto)${one?"":` <span class="pc-per">· ${eur(m2,1)} m²</span>`}`, `${eur(t.rentSum)} €`, "pc-net", true)}
    <div class="pc-hr"></div>
    <div class="pc-lbl">Kõrvalkulud</div>
    <div class="pc-pills">
      <span class="pc-pill">${ob.korvalkulu.talvine == null ? "Talvine kõrvalkulu määramata" : `Talv ≈ ${eur(t.kkWin,0)} € · ${eur(ob.korvalkulu.talvine)} €/m²`}</span>
      <span class="pc-pill">${ob.korvalkulu.suvine == null ? "Suvine kõrvalkulu määramata" : `Suvi ≈ ${eur(t.kkSum,0)} € · ${eur(ob.korvalkulu.suvine)} €/m²`}</span>
      ${elekter ? `<span class="pc-pill">Elekter ${elekter} A</span>` : ""}
      ${t.parking ? `<span class="pc-pill">${t.parking} parkimiskoht${t.parking === 1 ? "" : "a"}</span>` : ""}
    </div>
    <div class="pc-note">Kõrvalkulud tasutakse tegeliku tarbimise järgi ega sisaldu pakkumuse summas.</div>
  </div>`;
}

/* Lisad-kaart (pakkumuse külgveerg, operaator + klient): 3D PDF-ikoon, silm paremal;
   puuduv fail → "lisamata" silt ja klõpsuta rida */
function lisadCard(t, cls="", style="") {
  const att = (f, title, label, sub) => `
    <button class="att att-pdf ${f ? "" : "nofile"}" onclick="openPdf('${f || ""}','${title}')">
      ${I.pdf3d}<div style="flex:1;line-height:1.35"><b>${label}</b> <span class="muted">· ${sub}</span></div>
      ${f ? I.eye.replace('<svg','<svg class="att-eye"') : '<span class="tag">lisamata</span>'}</button>`;
  return `
  <div class="card pad ${cls}"${style ? ` style="${style}"` : ""}>
    <h3 class="side-h" style="margin-bottom:8px">Lisad</h3>
    <div data-hglide>
      ${t.spaces.map(sp => att((sp.plaanFail || objektOf(sp).failid.pinnaplaan), `Lisa 1 · pinnaplaan · ${sp.nimi}`, "Lisa 1", `Pinnaplaan (${sp.nimi})`)).join("")}
      ${att(objektOf(t.spaces[0]).failid.parkimine, "Lisa 2 · asendiplaan + parkimisskeem", "Lisa 2", "Asendiplaan + parkimisskeem")}
    </div>
  </div>`;
}

/* ---------- Pakkumise koostamine (wizard) --------------------------------- */
let WIZ = { step: 1, client: null, spaces: [], months: 60, risk: false };
View.pakkumusUus = () => {
  WIZ = { step: 1, client: null, spaces: [], months: 60, risk: false, objektId: PRE_OBJECT };
  PRE_OBJECT = null;
  /* kliendivaatest tulles („Loo pakkumine sellele kliendile") on klient eeltäidetud */
  if (PRE_CLIENT) { WIZ.client = DB.clientById(PRE_CLIENT); if (WIZ.client) WIZ.step = 2; PRE_CLIENT = null; }
  return `<div class="view"><a class="btn btn-ghost btn-sm" href="#/pakkumised" style="margin-bottom:20px">${I.back} Katkesta</a>
    <div class="overline reveal">Etapp 04 · uus hinnapakkumine</div>
    <h1 class="page-h1 reveal" style="margin:8px 0 24px">Koosta hinnapakkumine</h1>
    <div id="wiz" class="reveal"></div></div>`;
};
View.pakkumusUus.init = renderWiz;

/* moodne stepper: jooksva täitejoonega rada + täpid (jagatud mõlema wizardi vahel) */
/* sammu ikoon sildi järgi — märk näitab sisu; tehtud samm asendub linnukesega */
const STEP_IC = { "Objekt": "building", "Seaded": "edit", "Tüüp": "grid", "Klient": "user", "Üürnik": "user", "Kandidaat": "user", "Osapool": "user",
  "Riskiraport": "risk", "Pinnad": "building", "Pind": "building", "Ese": "building", "Ametikoht": "pin",
  "Põhitingimused": "edit", "Tingimused": "edit", "Mustand V1": "file", "Ülevaade": "search",
  "Fail": "file", "Ülevaatus": "search", "Kinnitus": "check" };
function stepperHTML(steps, cur) {
  const n = steps.length;
  const fill = (Math.max(0, Math.min(cur, n - 1)) / (n - 1) * 100).toFixed(1);
  return `<div class="stepper" style="grid-template-columns:repeat(${n},1fr)">
    <div class="trk" style="left:${(50 / n).toFixed(2)}%;right:${(50 / n).toFixed(2)}%"><i style="width:${fill}%"></i></div>
    ${steps.map((s, i) => { const cls = i < cur ? "done" : i === cur ? "current" : "";
      const ic = I[STEP_IC[s]] || I.file;
      return `<div class="sp ${cls}"><span class="dot">${ic}${i < cur ? `<span class="tick">${I.check}</span>` : ""}</span><span class="lbl">${s}</span></div>`; }).join("")}
  </div>`;
}

/* kliendiotsingu soovitused (jagatud mõlema wizardi vahel): tühjalt kliendiregister,
   tippides esiletõstetud vasted äriregistrist */
function clientSuggestHTML(v) {
  const esc = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hl = t => v ? String(t).replace(new RegExp("(" + esc + ")", "i"), '<mark class="hl">$1</mark>') : t;
  const m = v ? CLIENTS.filter(c => c.nimi.toLowerCase().includes(v) || c.registrikood.includes(v)) : CLIENTS.slice(0, 4);
  if (v && !m.length) return `<div class="muted" style="font-size:14px;padding:8px 2px">Vastet pole — demo äriregistris on ${ACCOUNT.landlord.nimi} osapooled. Proovi nime või registrikoodi.</div>`;
  return `<div class="overline" style="margin:4px 0 12px">${v ? "Vasted · äriregister" : "Kliendiregister"}</div>` +
    m.map(c => `<div class="pick cl-pick" data-clpick="${c.id}">
      <span class="pick-av">${c.nimi.slice(0, 1)}</span>
      <div style="flex:1;min-width:0"><b>${hl(c.nimi)}</b>
        <div class="muted mono" style="font-size:14px;margin-top:2px">${hl(c.registrikood)} · ${c.kmkr || "KMKR puudub"} · ${c.aadress}</div></div>
      ${c.risk && c.risk.skoor ? pill(c.risk.skoor) : `<span class="tag">äriregister</span>`}
    </div>`).join("");
}

function renderWiz() {
  const wiz = document.getElementById("wiz"); if (!wiz) return;
  const steps = ["Klient","Riskiraport","Pinnad","Ülevaade"];
  const head = stepperHTML(steps, WIZ.step - 1);
  let body = "";

  if (WIZ.step === 1) {
    body = `<div class="card pad">
      <div class="field"><label>Kliendi nimi või registrikood</label>
        <div class="clsearch">${I.search}<input id="cl-input" placeholder="nt Future Invest OÜ või 14258963" value="${WIZ.client?WIZ.client.nimi:''}" autocomplete="off"/></div></div>
      <div id="cl-suggest" style="margin-top:16px"></div>
      <div class="wrap-actions" style="margin-top:20px;justify-content:flex-end"><button class="btn btn-primary" id="w-next" ${WIZ.client?'':'disabled'} style="${WIZ.client?'':'opacity:.5;pointer-events:none'}">Edasi ${I.arrow}</button></div>
    </div>`;
  } else if (WIZ.step === 2) {
    const c = WIZ.client;
    body = `<div class="card pad">
      <div class="between" style="margin-bottom:16px"><div><div class="overline">Klient tuvastatud</div><div style="font-weight:700;font-size:20px;margin-top:4px">${c.nimi}</div>
        <div class="muted mono" style="font-size:14px">${c.registrikood} · ${c.aadress}</div></div>${pill(c.tyyp,"grey")}</div>
      <div id="risk-area" style="margin-top:16px">
        <button class="btn btn-primary" id="run-risk">${I.risk} Telli riskiraport</button>
        <span class="muted" style="margin-left:12px;font-size:14px">või jätka ilma</span>
      </div>
      <div class="wrap-actions" style="margin-top:20px;justify-content:space-between"><button class="btn btn-ghost" id="w-back">${I.back} Tagasi</button><button class="btn btn-primary" id="w-next">Edasi ${I.arrow}</button></div>
    </div>`;
  } else if (WIZ.step === 3) {
    body = wizSpacesHTML();
  } else {
    const spaces = WIZ.spaces.map(DB.spaceById);
    const t = { spaces, rows: spaces.map(sp=>({ sp, hind: sp.hind, rent: rent(sp) })),
                rentSum: spaces.reduce((s,x)=>s+rent(x),0), kkWin: spaces.reduce((s,x)=>s+kkWinter(x),0),
                kkSum: spaces.reduce((s,x)=>s+kkSummer(x),0), parking: spaces.reduce((s,x)=>s+x.parkimine,0) };
    const m2 = spaces.reduce((s,x)=>s+x.yyripind,0);
    body = `<div class="cl-layout" style="align-items:start">
      <div class="card pad">
        <div class="between" style="align-items:flex-start;gap:20px">
          <div>
            <div class="overline">Pakkumuse ülevaade</div>
            <div style="font-weight:700;font-size:20px;margin:8px 0 4px">${WIZ.client.nimi}</div>
            <div class="muted" style="font-size:14px">${spaces.length} pind${spaces.length>1?"a":""} · ${hoonedOf(spaces)}${WIZ.risk?' · riskiskoor '+WIZ.client.risk.skoor:''}</div>
          </div>
          <div class="field" style="margin:0;width:200px;flex:none"><label>Rendiperioodi pikkus</label>
            <select id="months">${[12,24,36,60].map(m=>`<option value="${m}" ${WIZ.months===m?'selected':''}>${m % 12 === 0 ? (m/12) + " aastat" : m + " kuud"} (${m} kuud)</option>`).join("")}</select></div>
        </div>
        <div class="divline"></div>
        ${spaces.map(s=>`<div class="between" style="padding:8px 0;border-bottom:1px dashed var(--line)">
          <div><b class="mono">${s.nimi}</b> <span class="muted">${spaceParts(s).map(p=>`${p.osa} ${eur(p.m2,1)} m²`).join(" + ")}</span>
            <div class="muted mono" style="font-size:12px">${eur(s.yyripind,1)} m² × ${eur(s.hind)} €/m²</div></div>
          <div class="mono" style="font-weight:700">${eur(rent(s))} €</div></div>`).join("")}
        <div class="overline" style="margin:20px 0 8px">Lisad · lähevad pakkumusega kaasa</div>
        ${spaces.map(sp => { const f = (sp.plaanFail || objektOf(sp).failid.pinnaplaan); return `
        <button class="att ${f?'':'nofile'}" onclick="openPdf('${f||""}','Lisa 1 · pinnaplaan · ${sp.nimi}')">
          ${I.file.replace('<svg','<svg class="fic"')}
          <div style="flex:1;text-align:left"><b>Lisa 1</b> · Pinnaplaan (${sp.nimi})</div>
          <span class="tag">${f ? "PDF · vaata" : "lisamata"}</span></button>`; }).join("")}
        ${(() => { const f = objektOf(spaces[0]).failid.parkimine; return `
        <button class="att ${f?'':'nofile'}" onclick="openPdf('${f||""}','Lisa 2 · asendiplaan + parkimisskeem')">
          ${I.file.replace('<svg','<svg class="fic"')}
          <div style="flex:1;text-align:left"><b>Lisa 2</b> · Asendiplaan + parkimisskeem</div>
          <span class="tag">${f ? "PDF · vaata" : "lisamata"}</span></button>`; })()}
        <div class="wrap-actions" style="margin-top:20px"><button class="btn btn-ghost" id="w-back">${I.back} Tagasi</button>
          <button class="btn btn-primary" id="w-finish">${I.check} Loo pakkumuse mustand</button></div>
      </div>
      <!-- parem paan sama keelega kui lepinguvaates: 300px, kleepuv, teadlikult õhuke -->
      <div class="cl-side">
        <div class="card pad">
          <div class="overline" style="margin-bottom:12px">Kokkuvõte</div>
          <div class="cd-sum">${eur(t.rentSum,0)} € <small>/ kuu (neto)</small></div>
          <div class="muted" style="font-size:14px;margin-top:4px">+ käibemaks ${VAT_RATE*100}% · bruto ${eur(withVat(t.rentSum))} €</div>
          <div class="divline"></div>
          <dl class="kv">
            <dt>Periood</dt><dd class="mono" id="sum-months">${WIZ.months} kuud</dd>
            <dt>Üüripind</dt><dd class="mono">${eur(m2,1)} m²</dd>
            <dt>Parkimiskohti</dt><dd class="mono">${t.parking}</dd>
          </dl>
          <div class="muted" style="font-size:12px;margin-top:12px">Kõrvalkulud tasutakse tegeliku tarbimise järgi. Täpne hinnastus ja eritingimused on järgmises vaates (mustand).</div>
        </div>
      </div>
    </div>`;
  }
  wiz.innerHTML = head + body;
  bindWiz();
}

/* ---- samm 3: pinnad — hoone valik otsinguga (combobox) + otsitav kompaktne loend + valiku kokkuvõte ----
   Filtrid (WIZ.objektId, WIZ.q) ei renderda kogu sammu uuesti: read peidetakse/näidatakse ja jalus uueneb kohapeal,
   nii et sisendi fookus ja kursor säilivad. */
function wizFreeSpaces() {
  return SPACES.filter(s => ["Vaba", "Pakkumusel"].includes(s.staatus) && (!WIZ.objektId || objektOf(s).id === WIZ.objektId));
}
function wizSpaceRow(s) {
  const o = objektOf(s);
  const sel = WIZ.spaces.includes(s.id);
  const jaotus = s.jaotus ? s.jaotus.map(p => `${p.osa} ${eur(p.m2, 1)} m²`).join(" + ") : "";
  const meta = ` · ${eur(s.yyripind, 1)} m² · ${eur(s.hind)} €/m²${s.parkimine ? ` · ${s.parkimine} pk` : ""}`;
  return `<div class="sp-row ${sel ? "sel" : ""}" data-sp="${s.id}" data-obj="${o.id}" data-q="${escHtml((s.nimi + " " + s.tyyp + " " + o.nimi + " " + (jaotus || "")).toLowerCase())}" role="checkbox" aria-checked="${sel}" tabindex="0">
    <span class="box">${I.check}</span>
    <span class="nm">${s.nimi}${jaotus ? `<small>${jaotus}</small>` : ""}</span>
    <span class="ty" data-meta="${escHtml(meta)}">${s.tyyp}${multiObj() && !WIZ.objektId ? `<span class="tag">${o.nimi}</span>` : ""}</span>
    <span class="m2 r">${eur(s.yyripind, 1)} <small>m²</small></span>
    <span class="pr r">${eur(s.hind)} <small>€/m²</small></span>
    <span class="rent r">${eur(rent(s))} €</span>
  </div>`;
}
function wizSpacesFoot() {
  const sel = WIZ.spaces.map(DB.spaceById).filter(Boolean);
  if (!sel.length) return `<span class="muted">Ühtegi pinda pole valitud</span>`;
  const m2 = sel.reduce((a, x) => a + x.yyripind, 0), r = sel.reduce((a, x) => a + rent(x), 0);
  return `<span>Valitud <b>${sel.length}</b> pind${sel.length > 1 ? "a" : ""}</span><span class="muted">·</span><span><b>${eur(m2, 1)}</b> m²</span><span class="muted">·</span><span><b>${eur(r)} €</b> / kuus</span>
    <button class="btn btn-text btn-sm sp-clear" id="sp-clear">Tühjenda valik</button>`;
}
function wizSpacesHTML() {
  const free = wizFreeSpaces();
  const cur = WIZ.objektId ? DB.objektById(WIZ.objektId) : null;
  const total = SPACES.filter(s => ["Vaba", "Pakkumusel"].includes(s.staatus)).length;
  return `<div class="card pad">
      <div class="sp-tools">
        <div class="field combo" id="sp-combo">
          <label for="sp-obj">Hoone</label>
          <input id="sp-obj" class="fld" placeholder="Kõik hooned · otsi nime või aadressi" value="${cur ? escHtml(cur.nimi) : ""}" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="sp-obj-pop">
          <span class="combo-chev">${I.chevD}</span>
          <div class="drop" id="sp-obj-pop" role="listbox"></div>
        </div>
        <div class="field">
          <label for="sp-q">Otsi pinda</label>
          <input id="sp-q" class="fld" placeholder="Nimi, tüüp või osa" value="${escHtml(WIZ.q || "")}" autocomplete="off">
        </div>
        <div class="sp-count" id="sp-count">${free.length} / ${total} vaba</div>
      </div>
      <div class="sp-list">
        <div class="sp-head"><span></span><span>Pind</span><span>Tüüp</span><span class="r">Üüripind</span><span class="r">Hind</span><span class="r">Üür / kuus</span></div>
        <div id="sp-rows">${free.length ? free.map(wizSpaceRow).join("") : (WIZ.objektId ? `<div class="sp-empty">Selles hoones pole vabu pindu.</div>` : occupiedSpacesNote())}</div>
        <div class="sp-empty" id="sp-none" hidden>Otsingule ei vasta ükski vaba pind.</div>
        <div class="sp-foot" id="sp-foot">${wizSpacesFoot()}</div>
      </div>
      <div class="wrap-actions" style="margin-top:20px;justify-content:space-between"><button class="btn btn-ghost" id="w-back">${I.back} Tagasi</button>
        <button class="btn btn-primary" id="w-next" ${WIZ.spaces.length ? "" : "disabled"}>Vaata ülevaadet ${I.arrow}</button></div>
    </div>`;
}
function bindWizSpaces() {
  const rows = document.getElementById("sp-rows"), foot = document.getElementById("sp-foot"), next = document.getElementById("w-next");
  const q = document.getElementById("sp-q"), none = document.getElementById("sp-none"), count = document.getElementById("sp-count");
  const objIn = document.getElementById("sp-obj"), pop = document.getElementById("sp-obj-pop"), combo = document.getElementById("sp-combo");
  const total = SPACES.filter(s => ["Vaba", "Pakkumusel"].includes(s.staatus)).length;
  const refresh = () => {
    foot.innerHTML = wizSpacesFoot();
    const clr = document.getElementById("sp-clear");
    if (clr) clr.onclick = () => { WIZ.spaces = []; rows.querySelectorAll(".sp-row").forEach(r => { r.classList.remove("sel"); r.setAttribute("aria-checked", "false"); }); refresh(); };
    if (next) next.disabled = !WIZ.spaces.length;
  };
  const filter = () => {
    const t = (q.value || "").toLowerCase().trim(); WIZ.q = t;
    let n = 0;
    rows.querySelectorAll(".sp-row").forEach(r => { const ok = !t || r.dataset.q.includes(t); r.hidden = !ok; if (ok) n++; });
    none.hidden = n > 0 || !rows.querySelector(".sp-row");
    count.textContent = `${n} / ${total} vaba`;
  };
  const toggle = (r) => {
    const id = r.dataset.sp;
    WIZ.spaces = WIZ.spaces.includes(id) ? WIZ.spaces.filter(x => x !== id) : [...WIZ.spaces, id];
    const on = WIZ.spaces.includes(id); r.classList.toggle("sel", on); r.setAttribute("aria-checked", String(on));
    refresh();
  };
  rows.querySelectorAll(".sp-row").forEach(r => {
    r.onclick = () => toggle(r);
    r.onkeydown = e => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); toggle(r); } };
  });
  q.oninput = filter; filter();
  /* hoone combobox: tipi → filter; vali → WIZ.objektId, loend renderdub uuesti (valik säilib) */
  const renderPop = () => {
    const t = objIn.value.toLowerCase().trim();
    const cur = WIZ.objektId ? DB.objektById(WIZ.objektId) : null;
    const match = OBJEKTID.filter(o => !t || cur && t === cur.nimi.toLowerCase() || (o.nimi + " " + (o.ehr && o.ehr.aadress || "")).toLowerCase().includes(t));
    const cnt = (o) => SPACES.filter(s => ["Vaba", "Pakkumusel"].includes(s.staatus) && objektOf(s).id === o.id).length;
    pop.innerHTML = `<button class="combo-item ${WIZ.objektId ? "" : "on"}" data-obj="" role="option"><span><span class="t">Kõik hooned</span><span class="s">${OBJEKTID.length} objekti</span></span><span class="n">${total} vaba</span></button>` +
      (match.length ? match.map(o => `<button class="combo-item ${WIZ.objektId === o.id ? "on" : ""}" data-obj="${o.id}" role="option"><span><span class="t">${o.nimi}</span><span class="s">${o.ehr && o.ehr.aadress || ""}</span></span><span class="n">${cnt(o)} vaba</span></button>`).join("") : `<div class="combo-empty">Hoonet ei leitud</div>`);
    pop.querySelectorAll(".combo-item").forEach(b => b.onclick = () => {
      WIZ.objektId = b.dataset.obj || null; closePop();
      renderWiz();
      const nq = document.getElementById("sp-q"); if (nq) nq.focus();
    });
  };
  const openPop = () => { renderPop(); pop.classList.add("open"); objIn.setAttribute("aria-expanded", "true"); };
  const closePop = () => { pop.classList.remove("open"); objIn.setAttribute("aria-expanded", "false"); };
  objIn.onfocus = () => { objIn.select(); openPop(); };
  objIn.oninput = () => { openPop(); };
  objIn.onkeydown = e => {
    if (e.key === "Escape") { closePop(); return; }
    if (e.key === "Enter") { e.preventDefault(); const f = pop.querySelector(".combo-item[data-obj]:not(.on)") || pop.querySelector(".combo-item"); if (f) f.click(); }
    if (e.key === "ArrowDown") { e.preventDefault(); const f = pop.querySelector(".combo-item"); if (f) f.focus(); }
  };
  pop.onkeydown = e => { const items = [...pop.querySelectorAll(".combo-item")]; const i = items.indexOf(document.activeElement);
    if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
    if (e.key === "ArrowUp") { e.preventDefault(); (items[i - 1] || objIn).focus(); }
    if (e.key === "Escape") { closePop(); objIn.focus(); } };
  combo.addEventListener("focusout", e => { if (!combo.contains(e.relatedTarget)) { closePop(); const cur = WIZ.objektId ? DB.objektById(WIZ.objektId) : null; objIn.value = cur ? cur.nimi : ""; } });
  refresh();
}

function bindWiz() {
  const next = document.getElementById("w-next");
  const back = document.getElementById("w-back");
  if (back) back.onclick = () => { WIZ.step--; renderWiz(); };
  if (next) next.onclick = () => { WIZ.step++; renderWiz(); };

  if (WIZ.step === 1) {
    const inp = document.getElementById("cl-input");
    const sug = document.getElementById("cl-suggest");
    const show = () => {
      sug.innerHTML = clientSuggestHTML(inp.value.toLowerCase().trim());
      sug.querySelectorAll("[data-clpick]").forEach(el => el.onclick = () => {
        WIZ.client = DB.clientById(el.dataset.clpick); WIZ.step = 2; renderWiz();
      });
    };
    inp.oninput = show; show();
    /* Enter kinnitab esimese vaste — klõps pole kohustuslik */
    inp.onkeydown = e => { if (e.key === "Enter") { const f = sug.querySelector("[data-clpick]"); if (f) f.click(); } };
  }
  if (WIZ.step === 2) {
    const rb = document.getElementById("run-risk");
    if (rb) rb.onclick = () => {
      const area = document.getElementById("risk-area");
      area.innerHTML = `<div class="thinking"><span class="d"></span><span class="d"></span><span class="d"></span><span style="margin-left:4px">Päring: Krediidiinfo · Inforegister · Kohtutäitur · Äriregister…</span></div>`;
      WIZ.risk = true;
      setTimeout(() => { area.innerHTML = riskInline(WIZ.client); }, 1100);
    };
  }
  if (WIZ.step === 3) bindWizSpaces();
  if (WIZ.step === 4) {
    /* periood valitakse ülevaates — kokkuvõtte rida uueneb kohe, ilma täisrenderduseta */
    const mSel = document.getElementById("months");
    if (mSel) mSel.onchange = e => { WIZ.months = +e.target.value;
      const sm = document.getElementById("sum-months"); if (sm) sm.textContent = WIZ.months + " kuud"; };
    document.getElementById("w-finish").onclick = () => {
      const n = Math.max(0, ...OFFERS.map(o => +o.id.split("-")[2] || 0)) + 1;
      const id = `PAK-${DEMO_TODAY.getFullYear()}-` + String(n).padStart(3, "0");
      const spaces = WIZ.spaces.map(DB.spaceById);
      const kehtiv = new Date(DEMO_TODAY); kehtiv.setDate(kehtiv.getDate() + 14);
      OFFERS.unshift({
        id, clientId: WIZ.client.id, spaceIds: [...WIZ.spaces], pikkusKuud: WIZ.months,
        staatus: "Mustand", kehtivKuni: fmtEE(kehtiv), loodud: TODAY_EE, looja: "Tarmo Sepp",
        kontakt: { nimi: WIZ.client.kontakt, epost: WIZ.client.epost, tel: WIZ.client.tel || "" },
        kommerts: `${WIZ.client.nimi}-le pakume ${hoonedOf(spaces)} pinda ${spaces.map(s=>s.nimi).join(", ")} (${spaces.map(s=>s.tyyp).join("; ")}) heas logistilises asukohas (${objektOf(spaces[0]).ehr.aadress}). ${spaces.reduce((s,x)=>s+x.parkimine,0) ? `Pakkumus sisaldab ${spaces.reduce((s,x)=>s+x.parkimine,0)} parkimiskohta; kõrvalkulud` : "Kõrvalkulud"} vastavalt hooajalisele keskmisele.`,
        eritingimused: [],
      });
      spaces.forEach(s => { if (s.staatus === "Vaba") { s.staatus = "Pakkumusel"; s.tenant = WIZ.client.nimi; } });
      AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Pakkumuse mustand ${id} loodud (${WIZ.client.nimi} · ${spaces.map(s=>s.nimi).join(", ")}).` });
      DB.save();
      toast("Pakkumuse mustand loodud · eeltäidetud m²-de, hindade ja lisadega");
      location.hash = "#/pakkumus/" + id;
    };
  }
}
function riskInline(c) {
  const col = STATUS[c.risk.skoor];
  const cssCol = `var(--${col})`;
  return `<div class="card pad" style="border-color:var(--line-strong)">
    <div class="gauge"><div class="ring" style="background:conic-gradient(${cssCol} ${c.risk.skoor==='MADAL'?75:c.risk.skoor==='KESKMINE'?50:25}%, var(--paper-2) 0)">
      <div class="inner"><div class="sc" style="color:${cssCol}">${c.risk.skoor}</div><div class="lb">SKOOR</div></div></div>
      <div><div class="overline">Koondskoor</div><div style="font-weight:700;font-size:16px;margin:3px 0">${c.nimi}</div>
        <div class="muted" style="font-size:14px">4 allikat · ${c.risk.kuupaev} · informatiivne, ei blokeeri</div></div></div>
  </div>`;
}

/* ---------- Lepingute loend ----------------------------------------------- */
const LEASE_FILTERS = {
  mustand: { t: "Mustand", st: ["Mustand V1"] },
  labiraakimisel: { t: "Läbirääkimisel", st: ["Saadetud"] },
  allkirjastamisel: { t: "Allkirjastamisel", st: ["Allkirjastamisel"] },
};
View.lepingud = (f) => {
  const flt = f && LEASE_FILTERS[f];
  const lrows = flt ? LEASES.filter(l => flt.st.includes(l.staatus)) : LEASES;
  const trows = flt ? TLEPINGUD.filter(t => flt.st.includes(t.staatus)) : TLEPINGUD;
  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Lepingud</h1></div>
      <a class="btn btn-primary" href="#/leping-uus">${I.lease} Uus leping</a>
    </div>
    ${flt ? `<div class="flex reveal" style="margin-bottom:16px;gap:12px">${pill("Filter: " + flt.t, "blue")}<a class="steplink" href="#/lepingud">Näita kõiki</a></div>` : ""}

    <div class="sec-h reveal"><h2>Üürilepingud</h2><span class="meta">platvormis loodud</span></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Tunnus</th><th>Üürnik</th><th>Pind</th><th>Periood</th><th>Indekseerimine</th><th>Olek</th></tr></thead>
        <tbody>
        ${lrows.length ? lrows.map(l => { const cl = DB.clientById(l.clientId); const sp = DB.spaceById(l.spaceId);
          return `<tr class="clickable" onclick="location.hash='#/leping/${l.id}'">
            <td><span class="id">${l.id}</span></td><td>${cl.nimi}</td><td class="mono">${sp.nimi}</td>
            <td class="mono">${l.algus} – ${l.lopp}</td>
            <td><span class="tag">${l.indeks.meetod} · ${l.indeks.maar}</span></td>
            <td>${pill(l.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:20px">Selles faasis üürilepinguid pole.</td></tr>`}
        </tbody>
      </table>
    </div>

    ${!TLEPINGUD.length ? "" : `
    <div class="sec-h reveal" style="margin-top:32px"><h2>Töölepingud</h2><span class="meta">osakond ${OSAKOND.nimi}</span></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Tunnus</th><th>Isik</th><th>Ametikoht</th><th>Algus</th><th>Katseaeg kuni</th><th>Olek</th></tr></thead>
        <tbody>
        ${trows.length ? trows.map(t => { const a = DB.ametikohtById(t.ametikohtId);
          return `<tr class="clickable" onclick="location.hash='#/tooleping/${t.id}'">
            <td><span class="id">${t.id}</span></td><td>${t.isik}${t.roll==="kandidaat"?` <span class="tag">kandidaat</span>`:""}</td>
            <td>${a.nimi}</td><td class="mono">${t.algus}</td><td class="mono">${t.katseaegLopp}</td>
            <td>${pill(t.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:20px">Selles faasis töölepinguid pole.</td></tr>`}
        </tbody>
      </table>
    </div>`}

    ${flt ? "" : `
    <div class="sec-h reveal" style="margin-top:32px"><h2>Imporditud lepingud</h2><span class="meta">olemasolev portfell</span>
      <a class="btn btn-ghost btn-sm" style="margin-left:auto" href="#/import">${I.file} Impordi leping (PDF/DOCX)</a></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Tunnus</th><th>Liik</th><th>Pool</th><th>Ese</th><th class="r">Struktuur</th><th>Päritolu</th></tr></thead>
        <tbody>
        ${IMPORDITUD.map(x => `<tr class="clickable" onclick="location.hash='#/imp/${x.id}'">
            <td><span class="id">${x.id}</span></td><td>${x.liik}</td><td>${x.pool}</td>
            <td class="mono" style="font-size:14px">${x.ese}</td>
            <td class="r mono">${x.punkte} punkti</td>
            <td>${pill("Imporditud")}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="muted reveal" style="margin-top:12px;font-size:14px">Imporditud lepingud osalevad otsingus, Q&A-s, võtmekuupäevades ja aruandluses — kuid ei osale muudatuste voos (etapp 08). Skaneeritud (pildipõhised) dokumendid jäävad struktuurituvastusest välja.</div>`}
  </div>`;
};

/* ---------- Töölepingu detail (sama mootor, sama klauslimudel) -------------- */
window.tlSend = (id) => {
  const t = DB.tlepingById(id); if (!t) return;
  t.staatus = "Saadetud";
  AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Tööpakkumine ${id} saadetud kandidaadile (turvaline link e-postile).` });
  DB.save(); toast("Tööpakkumine saadetud kandidaadile — turvaline link e-postile"); router();
};
View.tooleping = (id) => {
  const t = DB.tlepingById(id); if (!t) return notFound("Töölepingut ei leitud");
  const a = DB.ametikohtById(t.ametikohtId);
  const signed = t.staatus === "Kehtiv";
  const states = ["Mustand V1","Saadetud","Kõik aktsept.","Allkirjastamisel","Kehtiv"];
  const sIdx = signed ? 4 : t.staatus === "Allkirjastamisel" ? 3 : (t.staatus === "Mustand V1" ? 0 : 1);

  return `
  <div class="view">
    <a class="btn btn-ghost btn-sm reveal" href="#/lepingud" style="margin-bottom:20px">${I.back} Lepingud</a>
    <div class="page-head reveal">
      <div><div class="overline">Tööleping</div>
        <h1 class="page-h1" style="margin-top:8px">${t.isik}</h1>
        <p class="page-sub mono" style="font-size:14px">${t.id} · ${a.nimi} · osakond ${OSAKOND.nimi}${t.roll==="kandidaat"?" · kandidaat":""}</p></div>
      <div style="text-align:right">${pill(t.staatus)}</div>
    </div>

    ${signed ? "" : `
    <!-- kehtival lepingul rada ei kuvata — teekond on läbi, olek on päises ja olekukaardil -->
    <div class="cl-track reveal">
      ${states.map((st,i)=>`${i?`<span class="ct-rail ${i<=sIdx?'done':''}"></span>`:""}
        <span class="ct-step ${i<sIdx?'done':i===sIdx?'current':''}"><i></i><span>${st}</span></span>`).join("")}
    </div>`}

    <div class="split">
      <div>
        <div class="doc reveal">
          <div class="doc-head">
            <div><div class="doc-title">Töölepingu dokument</div></div>
            ${signed ? `<span class="pill green"><i class="dot"></i>Allkirjastatud</span>` : pill(t.staatus)}
          </div>

          <div class="clause-group">
            <div class="gh"><span class="doc-h2">Töölepingu põhitingimused</span><span class="pill blue"><i class="dot"></i>Tehinguandmetest · ese: ametikoht</span></div>
            ${t.pohi.map(p => `<div class="clause ${p.muudetud?'flag':''}">
              <div class="ref">${p.ref}</div>
              <div class="body"><div class="val">${p.vaartus}</div>
                ${p.muudetud?`<div class="overwrite">${I.arrow} muudetud läbirääkimisel ${p.otse ? "(otse kokkulepe)" : "→ Lisa 3"}</div>`:""}${(nr => nr ? `<div class="overwrite">${I.arrow} kirjutatud üle: Lisa ${nr} eritingimustes (ülimuslik)</div>` : "")(ringYleRef(l, p.ref))}</div>
              <div></div></div>`).join("")}
          </div>

          <div class="clause-group" style="border-top:1px solid var(--line)">
            <div class="gh"><span class="overline">Töölepingu üldtingimused · näidispunktid</span><span class="pill grey"><i class="dot"></i>Lukus · mallist v1.1</span></div>
            ${TL_ULD.map(c => `<div class="clause locked">
              <div class="ref">${c.ref}</div>
              <div class="body"><div class="ttl">${c.pealkiri}</div><div class="txt">${c.tekst}</div></div>
              <div class="lockico">${I.lock}</div></div>`).join("")}
          </div>

          <div class="clause-group" style="border-top:1px solid var(--line)">
            <div class="gh"><span class="overline">Eritingimused · Lisa 3</span><span class="pill accent"><i class="dot"></i>Ülimuslik · kirjutab üle</span></div>
            ${t.eri.length ? t.eri.map(e => `<div class="clause flag">
              <div class="ref">${e.ref}</div>
              <div class="body"><div class="txt" style="color:var(--ink)">${e.tekst}</div>
                ${e.kirjutabYle?`<div class="overwrite">${I.arrow} kirjutab üle: ${e.kirjutabYle}</div>`:""}</div>
              <div>${pill(e.staatus)}</div></div>`).join("")
              : `<div class="empty" style="padding:24px"><div>Eritingimusi pole — lisanduvad läbirääkimisel.</div></div>`}
          </div>
        </div>
      </div>

      <div>
        ${signed ? signCard(t) : t.staatus === "Mustand V1" ? `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:8px">Olek · mustand</div>
          <div style="font-size:14px;line-height:1.6">Mustand V1 on koostatud — saatke kandidaadile ülevaatamiseks. Sama töövoog nagu hinnapakkumisel: turvaline link e-postile, kontot pole vaja.</div>
          <button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:16px" onclick="tlSend('${t.id}')">${I.send} Saada kandidaadile (V1)</button>
        </div>` : `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:8px">Olek · tööpakkumine</div>
          <div style="font-size:14px;line-height:1.6">Tööpakkumine on kandidaadil ülevaatamisel — sama töövoog nagu hinnapakkumisel (etapid 04–06): punktikommentaarid, aktsept, allkirjastamine portaalis.</div>
          <div class="muted" style="font-size:12px;margin-top:12px">Kandidaat toimetab e-postile saadetud turvalise lingi kaudu ilma kontota; konto tekib allkirjastamisel.</div>
        </div>`}

        <div class="card pad reveal" style="margin-top:20px">
          <div class="overline" style="margin-bottom:12px">Võtmekuupäevad</div>
          <dl class="kv">
            <dt>Algus</dt><dd class="mono">${t.algus}</dd>
            <dt>Tähtaeg</dt><dd>${t.tahtaeg}</dd>
            <dt>Katseaja lõpp</dt><dd class="mono">${t.katseaegLopp}</dd>
            <dt>Palgaülevaatus</dt><dd class="mono">${t.palgaylevaatus}</dd>
          </dl>
        </div>

        <div class="card pad reveal" style="margin-top:20px">
          <div class="between" style="margin-bottom:8px"><div class="overline">Vertikaali adapter · TÖR</div><span class="pill grey"><i class="dot"></i>post-MVP</span></div>
          <div class="muted" style="font-size:14px;line-height:1.6">Töötamise kanne (TÖR/EMTA) vormistatakse lepingu sõlmimisel/lõpetamisel <b>operaatori kinnitusega</b> (human-in-the-loop) — mitte allkirjastamise automaatse kõrvalmõjuna.</div>
        </div>

        <div class="card pad reveal" style="margin-top:20px">
          <div class="overline" style="margin-bottom:12px">Lisad</div>
          ${t.lisad.map(x => `<button class="att nofile" onclick="toast('Ametijuhend on eseme (ametikoha) manus — demos illustratiivne')">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1"><b>Lisa ${x.nr}</b> · ${x.nimi}</div>
            <span class="tag">${x.fail}</span></button>`).join("")}
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------- Lepingu import: fail → AI-tuvastatud struktuur ORIGINAALI KÕRVAL → operaatori kinnitus ----------
   Spets v2 „Olemasolevate lepingute import": PDF/DOCX loetakse klauslimudelisse (punktid, tüübitud parameetrid,
   tähtajad, pooled), operaator vaatab tuvastatud struktuuri üle ja kinnitab; parandused logitakse auditisse.
   Originaal on õiguslik tõde — struktuur on indeks ja lähendus. Kinnitatud leping saab päritolu „Imporditud",
   osaleb otsingus, Q&A-s ja kalendris; muudatuste voos (etapp 08) ei osale.
   Demo: kaks näidist — UUS kindlustuspoliis (HTML-faksiimile, sest päris faili pole) ja päris MARU üürileping
   (PDF iframe'is), mille import tuvastab duplikaadi ja pakub struktuuri uuendamist. Lohistatud suvaline
   PDF/DOCX loetakse poliisi näidise järgi (tekstikihi tuvastus on mock). Sammud: Fail · Ülevaatus · Kinnitus. */
let IMP = null;
const impDefaults = () => ({ step: 0, sample: null, fileName: null, pages: 0, fields: [], deadlines: [], clauses: [], checked: new Set(), edits: [], objektId: null, dup: null, result: null, busy: false });

/* kindlustuspoliisi näidis — parameetrid koos usaldusväärsuse ja allikaviitega (lk · punkt) */
function impSampleKindlustus() {
  const b11g = DB.COMPANY_ID === "b11g";
  const ese = b11g ? "Stock Office + Self Storage · Betooni 11g" : "Hoone T6B · Taevavärava tee 6b";
  const votja = b11g ? "B11G OÜ" : "Taevavärava OÜ";
  const summa = b11g ? "3 200 000 €" : "4 850 000 €";
  const preemia = b11g ? "6 240,00 € aastas" : "8 730,00 € aastas";
  const y = DEMO_TODAY.getFullYear();
  const alg = `01.10.${y}`, lopp = `30.09.${y + 1}`, otsus = `31.08.${y + 1}`, makse = `15.10.${y}`;
  return {
    id: "kindlustus", liik: "Kindlustusleping", pool: "If P&C Insurance AS", ese, fileName: `Varakindlustuse_poliis_${b11g ? "B11G" : "T6B"}_${y}.pdf`, pages: 6,
    solmitud: `18.09.${y}`, allkirjad: "If P&C Insurance AS (kindlustusandja) · " + votja + " (kindlustusvõtja) · digitaalselt",
    fields: [
      { k: "Kindlustusandja", v: "If P&C Insurance AS", conf: .98, lk: 1, ref: "p 1.1" },
      { k: "Kindlustusvõtja", v: votja, conf: .97, lk: 1, ref: "p 1.2" },
      { k: "Kindlustusobjekt", v: ese, conf: .93, lk: 1, ref: "p 2.1" },
      { k: "Periood", v: `${alg} – ${lopp} (12 kuud)`, conf: .96, lk: 2, ref: "p 3.1" },
      { k: "Kindlustussumma", v: summa, conf: .91, lk: 2, ref: "p 4.1" },
      { k: "Preemia", v: preemia, conf: .89, lk: 2, ref: "p 5.1" },
      { k: "Maksetähtaeg", v: makse, conf: .74, lk: 2, ref: "p 5.2", note: "Tekstis „15 päeva jooksul poliisi väljastamisest“ — kuupäev on tuletatud" },
      { k: "Omavastutus", v: "1 500 € kindlustusjuhtumi kohta · torm ja üleujutus 5 000 €", conf: .62, lk: 3, ref: "p 6.1", note: "Kaks omavastutust samas punktis — kontrolli, kumb kehtib" },
      { k: "Kaetud riskid", v: "Tuli · torm · vandalism · veekahju · murdvargus", conf: .88, lk: 3, ref: "p 7.1" },
      { k: "Pikenemine", v: "Automaatne 12 kuuks, kui ei öelda üles 30 päeva enne perioodi lõppu", conf: .71, lk: 4, ref: "p 9.2", note: "Ülesütlemise tähtaeg tuletatud perioodi lõpust" },
    ],
    deadlines: [
      { d: makse, t: "preemia maksetähtaeg", conf: .74, lk: 2, ref: "p 5.2" },
      { d: otsus, t: "pikenemise otsustuskoht · ülesütlemine 30 päeva enne lõppu", conf: .71, lk: 4, ref: "p 9.2" },
      { d: lopp, t: "kindlustusperioodi lõpp", conf: .96, lk: 2, ref: "p 3.1" },
    ],
    clauses: [
      { nr: "1", t: "Pooled", lk: 1 }, { nr: "2", t: "Kindlustusobjekt ja asukoht", lk: 1 }, { nr: "3", t: "Kindlustusperiood", lk: 2 },
      { nr: "4", t: "Kindlustussumma ja väärtuse alus", lk: 2 }, { nr: "5", t: "Kindlustusmakse ja tasumine", lk: 2 }, { nr: "6", t: "Omavastutus", lk: 3 },
      { nr: "7", t: "Kindlustatud riskid", lk: 3 }, { nr: "8", t: "Välistused", lk: 3 }, { nr: "9", t: "Lepingu kestus ja pikenemine", lk: 4 },
      { nr: "10", t: "Kahjukäsitlus ja teavitamine", lk: 4 }, { nr: "11", t: "Poolte kohustused", lk: 5 }, { nr: "12", t: "Vaidluste lahendamine", lk: 6 },
    ],
    /* originaali faksiimile: iga lõik kannab lk ja punkti — struktuurirea klõps kerib ja tõstab esile */
    orig: [
      { lk: 1, ref: "pealkiri", h: "VARAKINDLUSTUSE POLIIS", sub: `Poliis nr IF-${y}-${b11g ? "0448" : "0392"} · Äri- ja tootmishoonete varakindlustus` },
      { lk: 1, ref: "p 1.1", t: "1.1. Kindlustusandja: If P&C Insurance AS, registrikood 10100168, Lõõtsa 8a, 11415 Tallinn." },
      { lk: 1, ref: "p 1.2", t: `1.2. Kindlustusvõtja: ${votja}, registrikood ${b11g ? "14876544" : "16333502"}. Soodustatud isik: kindlustusvõtja.` },
      { lk: 1, ref: "p 2.1", t: `2.1. Kindlustusobjekt: ${ese} — hoone(d) koos oluliste osade, tehnosüsteemide ja siseviimistlusega. Kindlustatud on ka hoonesse püsivalt paigaldatud seadmed.` },
      { lk: 2, ref: "p 3.1", t: `3.1. Kindlustusperiood: ${alg} 00:00 – ${lopp} 24:00. Kindlustuskaitse algab poliisil märgitud kuupäeval tingimusel, et esimene makse on tasutud tähtajaks.` },
      { lk: 2, ref: "p 4.1", t: `4.1. Kindlustussumma: ${summa}. Kindlustusväärtuse aluseks on taastamisväärtus. Alakindlustust ei rakendata, kui erinevus ei ületa 10 %.` },
      { lk: 2, ref: "p 5.1", t: `5.1. Kindlustusmakse: ${preemia}, tasutakse ühes osas. Makse sisaldab kõiki riiklikke makse.` },
      { lk: 2, ref: "p 5.2", t: "5.2. Kindlustusmakse tasumise tähtaeg on 15 päeva jooksul poliisi väljastamisest. Tähtaja ületamisel on kindlustusandjal õigus kaitse peatada." },
      { lk: 3, ref: "p 6.1", t: "6.1. Omavastutus on 1 500 € iga kindlustusjuhtumi kohta. Tormi- ja üleujutuskahjude korral kohaldatakse omavastutust 5 000 €." },
      { lk: 3, ref: "p 7.1", t: "7.1. Kindlustatud riskid: tulekahju, plahvatus, pikselöök, torm, vandalism, torustiku leke ja veekahju, murdvargus ja röövimine." },
      { lk: 3, ref: "p 8.1", t: "8.1. Kindlustuskaitse ei hõlma: sõda, terrorism, tuumarisk, järkjärguline kulumine, hallitus, kahjurid, kindlustusvõtja tahtlus." },
      { lk: 4, ref: "p 9.1", t: "9.1. Leping kehtib kindlustusperioodi lõpuni." },
      { lk: 4, ref: "p 9.2", t: "9.2. Leping pikeneb automaatselt järgmiseks 12 kuuks samadel tingimustel, kui kumbki pool ei ole teisele poolele teatanud lepingu lõpetamise soovist hiljemalt 30 päeva enne kindlustusperioodi lõppu." },
      { lk: 4, ref: "p 10.1", t: "10.1. Kindlustusjuhtumist tuleb kindlustusandjale teatada viivitamata, kuid mitte hiljem kui 5 tööpäeva jooksul." },
      { lk: 5, ref: "p 11.1", t: "11.1. Kindlustusvõtja kohustub hoidma tuleohutus- ja valveseadmed töökorras ning teavitama riski suurenemisest." },
      { lk: 6, ref: "p 12.1", t: "12.1. Vaidlused lahendatakse läbirääkimiste teel, kokkuleppe puudumisel Harju Maakohtus." },
    ],
  };
}
/* päris MARU üürileping — struktuur registrist (LEP-2023-029) ja klauslikihist; originaal = PDF */
function impSampleMaru() {
  const x = DB.impById("LEP-2023-029"); if (!x) return null;
  const kl = klauslidOf(x.id); const lkOf = (nr) => { const p = kl && kl.punktid.find(q => q.osa === "PT" && q.nr === nr); return p ? p.lk : 1; };
  const refs = { "Periood": "3.2", "Üleandmine": "2.3", "Üüripind": "2.1", "Kasutusotstarve": "2.4", "Üürihind": "3.1", "Üür": "3.1", "Parkimine": "2.2", "Tagatisraha": "4.1", "Indekseerimine": "3.4", "Maksetähtaeg": "3.3", "Kõrvalkulud": "3.5", "Elekter": "2.5" };
  const conf = { "Indekseerimine": .78, "Tagatisraha": .83, "Parkimine": .9 };
  return {
    id: "maru", liik: x.liik, pool: x.pool, ese: x.ese, fileName: x.fail, pages: 8, pdf: "lisad/importitud/MARU_uurileping_P29.pdf", dupId: x.id,
    solmitud: x.solmitud, allkirjad: x.allkirjad,
    fields: x.parameetrid.map(([k, v]) => ({ k, v, conf: conf[k] || .95, lk: lkOf(refs[k] || "1.1"), ref: "PT p " + (refs[k] || "1.1"), note: k === "Indekseerimine" ? "Lisa 3 asendab üldtingimuste fikseeritud 3 % THI-ga — kontrolli, et kehtiv sõnastus on Lisa 3 oma" : null })),
    deadlines: x.tahtajad.filter(t => /^\d\d\.\d\d\.\d{4}/.test(t)).map(t => ({ d: t.slice(0, 10), t: t.slice(13), conf: .9, lk: 2, ref: "PT p 3" })),
    clauses: kl ? kl.punktid.filter(p => p.osa !== "L3").map(p => ({ nr: (p.osa === "ÜT" ? "ÜT " : "") + p.nr, t: p.pealkiri, lk: p.lk })) : [],
  };
}
function impSamples() { return [impSampleKindlustus(), impSampleMaru()].filter(Boolean); }

View.importUus = () => {
  IMP = impDefaults();
  return `<div class="view"><a class="btn btn-ghost btn-sm" href="#/lepingud" style="margin-bottom:20px">${I.back} Katkesta</a>
    <div class="overline reveal">Olemasoleva lepingu import · PDF/DOCX → klauslimudel</div>
    <h1 class="page-h1 reveal" style="margin:8px 0 24px">Impordi leping</h1>
    <div id="impwiz" class="reveal"></div></div>`;
};
View.importUus.init = () => renderImp();

function renderImp() {
  const w = document.getElementById("impwiz"); if (!w) return;
  const head = stepperHTML(["Fail", "Ülevaatus", "Kinnitus"], IMP.step);
  let body = "";
  if (IMP.step === 0) body = impStepFile();
  else if (IMP.step === 1) body = IMP.busy ? impAnalysing() : impStepReview();
  else body = impStepDone();
  w.innerHTML = head + body;
  bindImp();
}

/* --- 1 · FAIL: lohista või vali; all näidisfailid --- */
function impStepFile() {
  const samples = impSamples();
  return `
  <div class="card pad" style="max-width:820px;margin:0 auto">
    <div class="imp-drop" id="imp-drop" tabindex="0" role="button" aria-label="Vali või lohista fail">
      <span class="imp-drop-ic">${I.file}</span>
      <div class="imp-drop-t">Lohista PDF või DOCX siia</div>
      <div class="imp-drop-s">või <u>vali fail</u> arvutist · ainult tekstikihiga dokumendid — skaneeritud (pildipõhised) failid jäävad struktuurituvastusest välja</div>
      <input type="file" id="imp-file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden>
    </div>
    <div class="overline" style="margin:24px 0 8px">Näidisfailid</div>
    <div class="imp-samples">
      ${samples.map(s => `<button class="imp-sample" data-sample="${s.id}">
        <span class="icotile t-lease">${s.pdf ? I.pdf3d : I.file}</span>
        <span class="grow"><span class="t">${s.fileName}</span><span class="s">${s.liik} · ${s.pool} · ${s.pages} lk${s.dupId ? ` · registris juba ${s.dupId}` : " · registris veel puudub"}</span></span>
        <span class="mono muted" style="font-size:12px">${s.pdf ? "PDF" : "PDF · tekstikiht"}</span>
      </button>`).join("")}
    </div>
    <div class="muted" style="font-size:12px;margin-top:16px;line-height:1.5">Import loeb dokumendi samasse klauslimudelisse, milles sünnivad platvormi enda lepingud: punktid, tüübitud parameetrid, tähtajad, pooled. Originaal jääb õiguslikuks tõeks; tuvastatud struktuur on selle indeks ja lähendus, mille sa järgmises sammus üle vaatad.</div>
  </div>`;
}
/* --- analüüs: sammud nagu agendil, iga samm settib --- */
function impAnalysing() {
  return `<div class="card pad" style="max-width:820px;margin:0 auto">
    <div class="between" style="margin-bottom:16px"><div><div class="overline">Loen dokumenti</div><div style="font-weight:600;margin-top:4px">${escHtml(IMP.fileName)}</div></div><div class="thinking"><span class="d"></span><span class="d"></span><span class="d"></span></div></div>
    <div id="imp-ana"></div></div>`;
}
function impStartAnalysis(sample, fileName) {
  IMP.sample = sample; IMP.fileName = fileName || sample.fileName; IMP.pages = sample.pages;
  IMP.fields = sample.fields.map(f => ({ ...f, orig: f.v })); IMP.deadlines = sample.deadlines.map(d => ({ ...d })); IMP.clauses = sample.clauses;
  IMP.checked = new Set(); IMP.edits = []; IMP.dup = sample.dupId ? DB.impById(sample.dupId) : null;
  IMP.objektId = (impObjektidOf(sample.ese)[0]) || (OBJEKTID.length === 1 ? OBJEKTID[0].id : null);
  IMP.step = 1; IMP.busy = true; renderImp();
  const steps = [
    ["Loen tekstikihti", `${IMP.pages} lk · ${IMP.clauses.length || 12} punkti tuvastatud`],
    ["Tuvastan lepinguliigi ja pooled", `${sample.liik} · ${sample.pool}`],
    ["Ekstraktin parameetrid ja tähtajad", `${IMP.fields.length} parameetrit · ${IMP.deadlines.length} tähtaega · ${IMP.fields.filter(f => f.conf < .8).length} vajab kontrolli`],
    ["Seon esemeregistriga", IMP.objektId ? `${DB.objektById(IMP.objektId).nimi}` : "Ese tuvastamata — vali ülevaatuses"],
    IMP.dup ? ["Kontrollin registrit", `Sama leping on registris: ${IMP.dup.id} — pakun struktuuri uuendamist`] : ["Kontrollin registrit", "Duplikaate ei leitud"],
  ];
  let i = 0;
  const next = () => {
    const host = document.getElementById("imp-ana"); if (!host) return;
    const prev = host.querySelector(".step.run"); if (prev) { prev.classList.replace("run", "done"); prev.querySelector("i").innerHTML = I.check; const d = prev.querySelector(".step-det"); if (d) d.hidden = false; }
    if (i < steps.length) { const [t, det] = steps[i++]; host.insertAdjacentHTML("beforeend", `<div class="step run"><i><span class="spin"></span></i><div><b>${t}</b><div class="step-det" hidden>${det}</div></div></div>`); setTimeout(next, 650); }
    else setTimeout(() => { IMP.busy = false; renderImp(); }, 350);
  };
  next();
}
const impObjektidOf = (ese) => OBJEKTID.filter(o => (ese || "").includes(o.nimi)).map(o => o.id);

/* --- 2 · ÜLEVAATUS: originaal vasakul, struktuur paremal; madala usaldusega read vajavad kontrolli --- */
const impConfCls = (c) => c >= .85 ? "hi" : c >= .75 ? "mid" : "lo";
const impConfLbl = (c) => c >= .85 ? "kindel" : c >= .75 ? "kontrolli" : "ebakindel";
function impFlags() { return IMP.fields.map((f, i) => ({ f, i })).filter(({ f }) => f.conf < .8); }
function impPending() { return impFlags().filter(({ i }) => !IMP.checked.has(i) && !IMP.edits.some(e => e.i === i)).length; }
function impStepReview() {
  const s = IMP.sample, pending = impPending(), flags = impFlags().length;
  const objSel = `<select class="fld" id="imp-obj"><option value="">— ettevõtte tasemel (ese sidumata) —</option>${OBJEKTID.map(o => `<option value="${o.id}" ${o.id === IMP.objektId ? "selected" : ""}>${o.nimi}</option>`).join("")}</select>`;
  return `
  <div class="imp-split">
    <div class="card imp-pane">
      <div class="card-h"><div><h3>Originaal</h3><div class="muted" style="font-size:12px;margin-top:2px">${escHtml(IMP.fileName)} · ${IMP.pages} lk${s.pdf ? "" : " · tekstikiht"}</div></div>${pill("Õiguslik tõde", "ink")}</div>
      <div class="imp-orig" id="imp-orig">${s.pdf ? `<iframe id="imp-pdf" src="${s.pdf}#page=1&view=FitH" title="Originaaldokument"></iframe>` : impFacsimile(s)}</div>
    </div>
    <div class="card imp-pane">
      <div class="card-h"><div><h3>Tuvastatud struktuur</h3><div class="muted" style="font-size:12px;margin-top:2px">${IMP.fields.length} parameetrit · ${IMP.deadlines.length} tähtaega · ${IMP.clauses.length} punkti</div></div>${pill("Indeks ja lähendus", "blue")}</div>
      <div class="imp-body">
        ${IMP.dup ? `<div class="note imp-note">${I.info}<div><b>Sama leping on juba registris</b> — ${IMP.dup.id} · kinnitatud ${IMP.dup.kinnitatud}. Kinnitamine uuendab olemasoleva lepingu struktuuri, uut kirjet ei teki.</div></div>` : ""}
        ${flags ? `<div class="note imp-note ${pending ? "warn" : "ok"}">${pending ? I.warn : I.check}<div>${pending ? `<b>${pending} välja ootab kontrolli</b> — AI ei olnud kindel. Ava allikas, paranda või märgi kontrollituks.` : `<b>Kõik ebakindlad väljad kontrollitud</b> — võid importi kinnitada.`}</div></div>` : ""}

        <div class="overline">Leping</div>
        <div class="imp-kv"><span class="k">Liik</span><span class="v">${s.liik}</span><span class="k">Osapool</span><span class="v">${s.pool}</span><span class="k">Sõlmitud</span><span class="v mono">${s.solmitud}</span><span class="k">Ese registris</span><span class="v">${objSel}</span></div>

        <div class="overline" style="margin-top:20px">Parameetrid <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">· klõps viitel avab koha originaalis</span></div>
        <div class="imp-rows">
          ${IMP.fields.map((f, i) => { const flag = f.conf < .8, ok = IMP.checked.has(i) || IMP.edits.some(e => e.i === i);
            return `<div class="imp-row ${flag ? (ok ? "ok" : "flag") : ""}" data-i="${i}">
              <label class="k" for="imp-f${i}">${f.k}</label>
              <input class="fld v" id="imp-f${i}" value="${escHtml(f.v)}" data-i="${i}" aria-label="${f.k}">
              <span class="conf ${impConfCls(f.conf)}" title="AI usaldusväärsus ${Math.round(f.conf * 100)} %"><i style="width:${Math.round(f.conf * 100)}%"></i><b>${Math.round(f.conf * 100)} %</b></span>
              <button class="src" type="button" data-lk="${f.lk}" data-ref="${f.ref}" title="Ava originaalis">lk ${f.lk} · ${f.ref}</button>
              ${flag ? `<label class="chk"><input type="checkbox" data-chk="${i}" ${ok ? "checked" : ""}> kontrollitud</label>` : ""}
              ${f.note && !ok ? `<div class="note-t">${f.note}</div>` : ""}
            </div>`; }).join("")}
        </div>

        <div class="overline" style="margin-top:20px">Tähtajad <span class="muted" style="font-weight:400;text-transform:none;letter-spacing:0">· lähevad võtmekuupäevade kalendrisse</span></div>
        <div class="imp-rows">
          ${IMP.deadlines.map((d, i) => `<div class="imp-row dl" data-di="${i}">
            <input class="fld mono d" value="${d.d}" data-di="${i}" aria-label="Kuupäev" style="width:112px">
            <input class="fld v" value="${escHtml(d.t)}" data-dt="${i}" aria-label="Tähtaja kirjeldus">
            <span class="conf ${impConfCls(d.conf)}"><i style="width:${Math.round(d.conf * 100)}%"></i><b>${Math.round(d.conf * 100)} %</b></span>
            <button class="src" type="button" data-lk="${d.lk}" data-ref="${d.ref}">lk ${d.lk} · ${d.ref}</button>
          </div>`).join("")}
        </div>

        <details class="imp-clauses" style="margin-top:20px"><summary><span class="overline">Punktid klauslimudelis</span><span class="tag">${IMP.clauses.length}</span></summary>
          <div class="imp-cl">${IMP.clauses.map(c => `<button type="button" class="src" data-lk="${c.lk}" data-ref="p ${c.nr.replace(/^ÜT /, "")}"><span class="mono">${c.nr}</span> ${c.t}<span class="muted mono" style="margin-left:auto">lk ${c.lk}</span></button>`).join("")}</div>
        </details>
      </div>
      <div class="imp-foot">
        <button class="btn btn-ghost" id="imp-back">${I.back} Tagasi</button>
        <div class="grow muted" style="font-size:12px">${IMP.edits.length ? `${IMP.edits.length} parandust logitakse auditisse · ` : ""}${pending ? `${pending} välja ootab kontrolli` : "Kinnitus märgib lepingu päritoluga „Imporditud“"}</div>
        <button class="btn btn-primary" id="imp-confirm" ${pending ? "disabled" : ""}>${I.check} ${IMP.dup ? "Kinnita ja uuenda struktuuri" : "Kinnita import"}</button>
      </div>
    </div>
  </div>`;
}
/* originaali faksiimile: A4-leht lõikudena; lk-vahetus eraldajana */
function impFacsimile(s) {
  let lk = 0;
  return `<div class="sheet sheet-embed imp-sheet">${s.orig.map(o => {
    const brk = o.lk !== lk ? `<div class="imp-pg mono">lk ${o.lk}</div>` : ""; lk = o.lk;
    return brk + (o.h ? `<h2 class="imp-h" data-ref="${o.ref}" data-lk="${o.lk}">${o.h}</h2><div class="muted" style="font-size:12px;margin-bottom:18px">${o.sub || ""}</div>` : `<p data-ref="${o.ref}" data-lk="${o.lk}">${o.t}</p>`);
  }).join("")}</div>`;
}
/* struktuurirea viide → originaalis kohale: HTML-il esiletõst + kerimine, PDF-il lehekülg */
function impJump(lk, ref) {
  const s = IMP.sample;
  if (s.pdf) { const fr = document.getElementById("imp-pdf"); if (fr) fr.src = `${s.pdf}#page=${lk}&view=FitH`; return; }
  const orig = document.getElementById("imp-orig"); if (!orig) return;
  orig.querySelectorAll(".hl").forEach(e => e.classList.remove("hl"));
  const el = orig.querySelector(`[data-ref="${ref}"]`) || orig.querySelector(`[data-lk="${lk}"]`);
  if (el) { el.classList.add("hl"); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

/* --- 3 · KINNITUS: kviitung — mis registrisse läks, kuhu, kelle volitusel --- */
function impStepDone() {
  const r = IMP.result;
  return `<div class="card pad" style="max-width:720px;margin:0 auto">
    <div class="flex" style="gap:12px;align-items:center;margin-bottom:16px"><span class="icotile t-lease" style="background:var(--color-success-subtle);color:var(--color-success)">${I.check}</span>
      <div><h3 class="side-h" style="margin:0">${r.updated ? "Struktuur uuendatud" : "Import kinnitatud"}</h3><div class="muted" style="font-size:12px;margin-top:2px">${r.aeg} · Tarmo Sepp</div></div>
      <span style="margin-left:auto">${pill("Imporditud")}</span></div>
    <dl class="kv">
      <dt>Leping</dt><dd class="mono">${r.id}</dd>
      <dt>Liik · osapool</dt><dd>${r.liik} · ${r.pool}</dd>
      <dt>Ese</dt><dd>${r.ese}</dd>
      <dt>Struktuur</dt><dd class="mono">${r.punkte} punkti · ${r.params} parameetrit</dd>
      <dt>Kalendrisse</dt><dd class="mono">${r.tahtajad} tähtaega</dd>
      <dt>Parandusi</dt><dd class="mono">${r.edits}</dd>
    </dl>
    <div class="muted" style="font-size:12px;margin-top:16px;line-height:1.5">Leping osaleb nüüd otsingus, agendi Q&A-s, võtmekuupäevade kalendris ja aruandluses. Muudatuste voos (etapp 08) imporditud leping ei osale — õiguslik tõde on originaaldokument.</div>
    <div class="wrap-actions" style="margin-top:20px">
      <a class="btn btn-primary" href="#/imp/${r.id}">${I.arrow} Ava leping</a>
      <a class="btn btn-ghost" href="#/kalender">${I.cal} Võtmekuupäevad</a>
      <button class="btn btn-text" id="imp-again">Impordi veel</button>
    </div>
  </div>`;
}
function impConfirm() {
  const s = IMP.sample, aeg = NOW_EE();
  const params = IMP.fields.map(f => [f.k, f.v.trim()]);
  const tahtajad = IMP.deadlines.filter(d => /^\d\d\.\d\d\.\d{4}$/.test(d.d.trim())).map(d => `${d.d.trim()} · ${d.t.trim()}`);
  const punkte = IMP.clauses.length || 12;
  let id;
  if (IMP.dup) {
    id = IMP.dup.id;
    Object.assign(IMP.dup, { parameetrid: params, tahtajad, kinnitatud: `Tarmo Sepp · ${TODAY_EE}` });
    if (IMP.objektId) IMP.dup.objektId = IMP.objektId;
    AUDIT.unshift({ aeg, autor: "Tarmo Sepp", tegevus: `${id}: imporditud struktuur vaadatud üle ja uuendatud (${IMP.edits.length} parandust).` });
  } else {
    const n = Math.max(0, ...IMPORDITUD.map(x => +(x.id.match(/IMP-\d{4}-(\d+)/) || [])[1] || 0)) + 1;
    id = `IMP-${DEMO_TODAY.getFullYear()}-${String(n).padStart(3, "0")}`;
    const entry = { id, liik: s.liik, pool: s.pool, ese: s.ese, objektId: IMP.objektId || undefined, punkte, kinnitatud: `Tarmo Sepp · ${TODAY_EE}`, fail: IMP.fileName,
      solmitud: s.solmitud, allkirjad: s.allkirjad, parameetrid: params, lisad: [], tahtajad,
      failid: [{ nimi: `${s.liik} · originaal`, fail: s.pdf || null, silt: `${IMP.pages} lk · ${s.pdf ? "PDF" : "PDF · tekstikiht"}` }], kontaktid: [], lisatud: true };
    IMPORDITUD.push(entry);
    KEY_DATES.push(...DB.impKeyDates(entry)); KEY_DATES.sort((a, b) => a.kuupaev.localeCompare(b.kuupaev)); /* kalender, avaleht ja ülevaade loevad KEY_DATES-ist */
    AUDIT.unshift({ aeg, autor: "Tarmo Sepp", tegevus: `Leping ${id} imporditud (${s.liik} · ${s.pool}) — struktuur kinnitatud, ${tahtajad.length} tähtaega kalendrisse.` });
  }
  IMP.edits.forEach(e => AUDIT.unshift({ aeg, autor: "Tarmo Sepp", tegevus: `${id}: impordi parandus — ${e.k}: „${e.from}" → „${e.to}".` }));
  DB.save();
  IMP.result = { id, updated: !!IMP.dup, liik: s.liik, pool: s.pool, ese: s.ese, punkte, params: params.length, tahtajad: tahtajad.length, edits: IMP.edits.length, aeg };
  IMP.step = 2; renderImp();
  toast(IMP.dup ? `${id} · struktuur uuendatud` : `${id} imporditud · ${tahtajad.length} tähtaega kalendris`);
}

function bindImp() {
  const w = document.getElementById("impwiz"); if (!w) return;
  if (IMP.step === 0) {
    const drop = document.getElementById("imp-drop"), file = document.getElementById("imp-file");
    const take = (f) => {
      if (!f) return;
      if (!/\.(pdf|docx)$/i.test(f.name)) { toast("Ainult PDF või DOCX — skaneeritud pildid ja muud vormingud jäävad struktuurituvastusest välja"); return; }
      const sample = /maru|P_29|P29/i.test(f.name) && impSampleMaru() ? impSampleMaru() : impSampleKindlustus();
      impStartAnalysis(sample, f.name);
    };
    if (drop && file) {
      drop.onclick = () => file.click();
      drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); } };
      file.onchange = () => take(file.files && file.files[0]);
      ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
      ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
      drop.addEventListener("drop", e => take(e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]));
    }
    w.querySelectorAll("[data-sample]").forEach(b => b.onclick = () => { const s = impSamples().find(x => x.id === b.dataset.sample); if (s) impStartAnalysis(s); });
    return;
  }
  if (IMP.step === 1 && !IMP.busy) {
    const back = document.getElementById("imp-back"); if (back) back.onclick = () => { IMP.step = 0; renderImp(); };
    const obj = document.getElementById("imp-obj"); if (obj) obj.onchange = () => { IMP.objektId = obj.value || null; };
    /* viited → originaal; aktiivne rida markeeritakse */
    w.querySelectorAll(".src").forEach(b => b.onclick = () => { w.querySelectorAll(".imp-row.on").forEach(r => r.classList.remove("on")); const row = b.closest(".imp-row"); if (row) row.classList.add("on"); impJump(+b.dataset.lk, b.dataset.ref); });
    /* parandus = auditisse logitav muutus; ebakindla välja parandus loeb ühtlasi kontrollituks */
    const refresh = () => { const pend = impPending(); const c = document.getElementById("imp-confirm"); if (c) c.disabled = pend > 0; };
    w.querySelectorAll("input.v[data-i]").forEach(inp => inp.onchange = () => {
      const i = +inp.dataset.i, f = IMP.fields[i], to = inp.value.trim();
      IMP.edits = IMP.edits.filter(e => e.i !== i);
      if (to !== f.orig) IMP.edits.push({ i, k: f.k, from: f.orig, to });
      f.v = to; renderImp();
    });
    w.querySelectorAll("input[data-di]").forEach(inp => inp.onchange = () => { IMP.deadlines[+inp.dataset.di].d = inp.value; });
    w.querySelectorAll("input[data-dt]").forEach(inp => inp.onchange = () => { IMP.deadlines[+inp.dataset.dt].t = inp.value; });
    w.querySelectorAll("input[data-chk]").forEach(cb => cb.onchange = () => { const i = +cb.dataset.chk; cb.checked ? IMP.checked.add(i) : IMP.checked.delete(i); renderImp(); });
    const c = document.getElementById("imp-confirm"); if (c) c.onclick = () => { if (impPending()) { toast("Kontrolli enne ebakindlad väljad — ava allikas ja märgi kontrollituks"); return; } impConfirm(); };
    refresh();
    return;
  }
  if (IMP.step === 2) { const a = document.getElementById("imp-again"); if (a) a.onclick = () => { IMP = impDefaults(); renderImp(); }; }
}

/* ---------- Imporditud lepingu detail -------------------------------------- */
View.imporditud = (id) => {
  const x = DB.impById(id); if (!x) return notFound("Imporditud lepingut ei leitud");
  const P = (k) => (x.parameetrid.find(p => p[0] === k) || [])[1] || null;
  /* hero: kuutasu suurelt; ülejäänud parameetrid faktiplokkidena */
  const kuu = P("Üür") || P("Tasu") || P("Preemia");
  const kuuNum = kuu ? kuu.replace(/\s*\(.*\)/, "").replace(/\/kuus.*$/, "").trim() : null;
  const skip = new Set(["Üür", "Tasu", "Preemia"]);
  const faktid = x.parameetrid.filter(p => !skip.has(p[0]));
  const eri = (x.lisad || []).filter(l => l.punktid && l.punktid.length);
  /* vasakule ainult SISULISED lisad — need, mis on paremal juba failina, ei kordu */
  const muud = (x.lisad || []).filter(l => !(l.punktid && l.punktid.length) && !(x.failid || []).some(f => f.fail === l.fail));
  const fileBtn = (f, title) => f ? `<button class="btn btn-ghost btn-sm" onclick="openPdf('${f}','${title.replace(/'/g, "")}')">${I.eye} Ava</button>` : "";
  return `
  <div class="view">
    <a class="btn btn-ghost btn-sm reveal" href="#/lepingud" style="margin-bottom:20px">${I.back} Lepingud</a>
    <div class="page-head reveal">
      <div><div class="overline">Imporditud ${x.liik.toLowerCase()}</div>
        <h1 class="page-h1" style="margin-top:8px">${x.pool}</h1>
        <p class="page-sub mono" style="font-size:14px">${x.id} · ${x.ese}</p></div>
      <div style="text-align:right">${pill("Imporditud")}<div class="muted mono" style="font-size:12px;margin-top:8px">${x.solmitud ? `Sõlmitud ${x.solmitud} · ` : ""}kinnitatud ${x.kinnitatud}</div></div>
    </div>

    <div class="split">
      <div>
        <!-- 1) põhitingimused: summa ees, faktid plokkidena -->
        <div class="card pad reveal imp-main">
          ${kuuNum ? `<div class="imp-hero"><div class="pc-lbl">${x.liik === "Üürileping" ? "Üür kuus (neto)" : "Tasu kuus (neto)"}</div>
            <div class="pc-big">${kuuNum}</div>
            ${x.liik === "Üürileping" && P("Üürihind") ? `<div class="pc-sub">${P("Üürihind")} · ${P("Üüripind") || ""}</div>` : `<div class="pc-sub">${P("Periood") || ""}</div>`}</div>` : ""}
          <div class="fact-grid">
            ${faktid.map(([k, v]) => `<div class="fact-tile"><div class="fl">${k}</div><div class="fv">${v}</div></div>`).join("")}
          </div>
          <div class="muted" style="font-size:12px;margin-top:16px">Tuvastatud allkirjastatud originaalist · ${x.punkte} punkti klauslimudelis · õiguslik tõde on originaaldokument.</div>
        </div>

        <!-- 2) eritingimused (Lisa 3): mida kokku lepiti ja mida see üldtingimustes muudab -->
        ${eri.map(l => `
        <div class="card pad reveal" style="margin-top:20px">
          <div class="between" style="margin-bottom:16px"><div><h3 class="side-h" style="margin:0">Lisa ${l.nr} · ${l.nimi}</h3>
            ${l.allkirjastatud ? `<div class="muted" style="font-size:12px;margin-top:3px">Allkirjastatud ${l.allkirjastatud} · muudab üldtingimusi allpool loetletud punktides</div>` : ""}</div>
            ${fileBtn(l.fail, x.id + " · Lisa " + l.nr)}</div>
          <ol class="eri-list">
            ${l.punktid.map(p => `<li><div class="eri-h"><b>${p.pealkiri}</b><span class="chg">${p.muudab}</span></div><div class="eri-t">${p.tekst}</div></li>`).join("")}
          </ol>
        </div>`).join("")}

        <!-- 3) muud lisad (plaanid, spetsifikatsioonid) lühidalt -->
        ${muud.length ? `
        <div class="card pad reveal" style="margin-top:20px">
          <h3 class="side-h" style="margin-bottom:12px">Lisad</h3>
          ${muud.map(l => `<div class="lisa-row"><div class="lisa-nr">${l.nr}</div><div style="flex:1;min-width:0"><b>${l.nimi}</b>${l.sisu ? `<div class="muted" style="font-size:14px;line-height:1.5;margin-top:2px">${l.sisu}</div>` : ""}</div>${fileBtn(l.fail, x.id + " · Lisa " + l.nr + " · " + l.nimi)}</div>`).join("")}
        </div>` : ""}

        <!-- 4) kogu leping punktide kaupa — kokkukeeratud; agent ja otsing loevad sama kihti -->
        ${(() => { const kl = klauslidOf(x.id); if (!kl) return ""; const muud = kl.punktid.filter(p => p.muudetud).length; return `
        <details class="card reveal kl-all" id="kl-all" style="margin-top:20px">
          <summary><div><h3 class="side-h" style="margin:0">Kogu leping punktide kaupa</h3>
            <div class="muted" style="font-size:12px;margin-top:3px">${kl.punktid.length} punkti · ${Object.values(kl.osad).filter(o => !/^Lisa \d$/.test(o)).join(" · ")}${muud ? ` · ${muud} punkti muudetud Lisa 3-ga` : ""} · sama kiht, millest agent ja otsing vastavad</div></div>
            <span class="tag">ava</span></summary>
          <div class="kl-body">
            <input class="kl-q" id="kl-q" placeholder="Filtreeri punkte… nt allüür, viivis, reageerimisaeg" autocomplete="off">
            <div id="kl-list">${klList(x.id, kl)}</div>
          </div>
        </details>`; })()}

        <!-- 5) tähtajad → kalender -->
        <div class="card pad reveal" style="margin-top:20px">
          <h3 class="side-h" style="margin-bottom:12px">Tähtajad võtmekuupäevade kalendris</h3>
          ${x.tahtajad.map(td => { const d = td.slice(0, 10), t = td.slice(13); const isDate = /^\d\d\.\d\d\.\d{4}$/.test(d);
            return `<div class="td-row"><span class="td-date mono">${isDate ? d : "—"}</span><span>${isDate ? t : td}</span></div>`; }).join("")}
          <a class="btn btn-ghost btn-sm" href="#/kalender" style="margin-top:12px">${I.cal} Ava kalender</a>
        </div>
      </div>

      <div>
        <div class="card pad reveal">
          <h3 class="side-h" style="margin-bottom:8px">Lähtedokumendid</h3>
          <div class="muted" style="font-size:12px;margin-bottom:8px">Allkirjastatud originaal on õiguslik tõde.</div>
          <div data-hglide>
          ${(x.failid || []).length ? x.failid.map(f => f.download
            ? `<a class="att att-pdf" href="${f.fail}" download>${I.pdf3d}<div style="flex:1;line-height:1.35"><b>${f.nimi}</b></div><span class="tag">${f.silt || "laadi alla"}</span></a>`
            : `<button class="att att-pdf" onclick="openPdf('${f.fail}','${x.id} · ${f.nimi.replace(/'/g, "")}')">${I.pdf3d}<div style="flex:1;line-height:1.35"><b>${f.nimi}</b>${f.silt ? `<div class="muted" style="font-size:12px">${f.silt}</div>` : ""}</div>${I.eye.replace('<svg','<svg class="att-eye"')}</button>`).join("")
            : `<button class="att nofile">${I.file.replace('<svg','<svg class="fic"')}<div style="flex:1"><b>Originaal</b></div><span class="tag">${x.fail}</span></button>`}
          </div>
        </div>
        ${x.allkirjad ? `
        <div class="card pad reveal" style="margin-top:20px">
          <h3 class="side-h" style="margin-bottom:8px">Allkirjad</h3>
          <div style="font-size:14px;line-height:1.55">${x.allkirjad}</div>
        </div>` : ""}
        ${(x.kontaktid || []).length ? `
        <div class="card pad reveal" style="margin-top:20px">
          <h3 class="side-h" style="margin-bottom:4px">Poolte esindajad</h3>
          ${x.kontaktid.map(k => `<div style="font-size:14px;font-weight:700;margin-top:12px">${k.pool}</div>${k.read.map(r => `<div class="muted" style="font-size:14px;line-height:1.55">${r}</div>`).join("")}`).join("")}
        </div>` : ""}
      </div>
    </div>
  </div>`;
};

/* klauslite loend vaates: osa → jagu → punktid; Lisa 3 muudetud punktil kehtiv tekst ees, algne all */
function klList(id, kl) {
  const groups = [];
  kl.punktid.forEach(p => { const osa = p.osa; let g = groups.find(g => g.osa === osa); if (!g) { g = { osa, lbl: kl.osad[osa] || osa, jaod: [] }; groups.push(g); }
    let j = g.jaod.find(j => j.jagu === p.jagu); if (!j) { j = { jagu: p.jagu, pealkiri: p.pealkiri, punktid: [] }; g.jaod.push(j); } j.punktid.push(p); });
  const viisLbl = { lisatud: "täiendatud", asendatud: "asendatud", kehtetu: "kehtetu" };
  return groups.map(g => `<div class="kl-osa"><div class="kl-osa-h">${g.lbl}</div>
    ${g.jaod.map(j => `<div class="kl-jagu">${/^Lisa/.test(j.jagu) ? "" : `<div class="kl-jagu-h"><span class="mono">${j.jagu}</span> ${j.pealkiri}</div>`}
      ${j.punktid.map(p => { const m = p.muudetud; return `<div class="kl-row" data-key="${klKey(p)}" data-txt="${(p.nr + " " + p.tekst + " " + (m ? m.tekst : "") + " " + p.pealkiri).toLowerCase().replace(/"/g, "")}">
        <span class="kl-nr mono">${/^Lisa/.test(p.nr) ? p.nr : p.nr}</span>
        <div class="kl-t">
          ${m ? `<div class="kl-chg"><span class="chg alt">${m.lisa} · ${viisLbl[m.viis] || m.viis}${m.nr && m.nr !== p.nr ? " · p " + m.nr : ""}</span></div>` : ""}
          ${p.muudab ? `<div class="kl-chg"><span class="chg">muudab ÜT p ${p.muudab} · ${viisLbl[p.viis] || p.viis}</span></div>` : ""}
          ${m && m.viis !== "lisatud" ? `<div class="${m.viis === "kehtetu" ? "kl-old" : ""}">${m.viis === "kehtetu" ? p.tekst : m.tekst}</div><div class="kl-old">${m.viis === "kehtetu" ? "" : "Algne: " + p.tekst}</div>`
            : m && m.viis === "lisatud" ? `<div>${p.tekst}</div><div class="kl-add">+ ${m.nr}: ${m.tekst}</div>` : `<div>${p.tekst}</div>`}
        </div>
        <button class="kl-pg" title="Ava originaal leheküljelt ${p.lk}" onclick="openPdf('${klFail(id, p)}','${id} · ${klOsaLbl(p)}${p.nr}',${p.lk})">lk ${p.lk}</button>
      </div>`; }).join("")}
    </div>`).join("")}</div>`).join("");
}
View.imporditud.init = () => {
  const q = document.getElementById("kl-q"), list = document.getElementById("kl-list"), det = document.getElementById("kl-all");
  if (q && list) q.addEventListener("input", () => {
    const v = q.value.trim().toLowerCase();
    list.querySelectorAll(".kl-row").forEach(r => { r.hidden = !!v && !r.dataset.txt.includes(v); });
    list.querySelectorAll(".kl-jagu").forEach(j => { j.hidden = !j.querySelector(".kl-row:not([hidden])"); });
    list.querySelectorAll(".kl-osa").forEach(o => { o.hidden = !o.querySelector(".kl-row:not([hidden])"); });
  });
  if (IMP_FOCUS && det) {
    const row = list && list.querySelector(`.kl-row[data-key="${IMP_FOCUS}"]`); IMP_FOCUS = null;
    if (row) { det.open = true; setTimeout(() => { row.scrollIntoView({ behavior: "smooth", block: "center" }); row.classList.add("hl"); setTimeout(() => row.classList.remove("hl"), 2600); }, 120); }
  }
};

/* ---------- Lepingu detail ------------------------------------------------ */
let LEP_FOCUS_ID = null;
/* muudatusrežiim (Kehtiv leping): dokumendi asemel klõpsatav punktivaade —
   klient kommenteerib, operaator lisab muudatusi ringi (→ Lisa N) */
let LEP_MUUDATUS_MODE = false;
window.lepMuudatus = (on) => { LEP_MUUDATUS_MODE = on; router(); };

/* ---------- juhitud vool: süsteem juhib, kasutaja ei otsi ------------------ */
/* järgmine punkt, mis vajab PRAEGUSE rolli tegevust — kommentaaride tekkejärjekorras.
   Operaatoril: punkt, kus üürniku sõna oli viimane (otsusta või vasta).
   Üürnikul: kinnitust ootav ettepanek VÕI arutelu, kus üürileandja küsis viimasena. */
function nextOpenRef(l) {
  const cs = l.kommentaarid || [];
  const c = isClient()
    ? cs.find(x => x.staatus === "Ootab kinnitust" || (x.staatus === "Ootel" && !cmtOotabOp(x)))
    : cs.find(cmtOotabOp);
  return c ? c.clauseRef : null;
}
/* keri punkti juurde ja ava lõim; suletud üldtingimuste voldikud avanevad teel */
function gotoClause(ref) {
  const el = document.querySelector(`[data-clause="${ref}"]`);
  if (!el) return;
  let d = el.closest("details"), opened = false;
  while (d) { if (!d.open) { d.open = true; opened = true; } d = d.parentElement ? d.parentElement.closest("details") : null; }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  /* voldiku avanemine on animeeritud (::details-content) — keri pärast animatsiooni täpselt kohale */
  if (opened) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 360);
  const exp = document.querySelector(".clause-expand");
  if (!(exp && exp.dataset.for === String(ref))) openClause(el, ref);
}
/* juhtriba nupp: hüppa esimese tegevust vajava punkti juurde.
   Kehtival lepingul avab vajadusel enne muudatusrežiimi (interaktiivne punktivaade). */
window.lepHyppa = () => {
  const l = CURRENT_LEASE; if (!l) return;
  const ref = nextOpenRef(l); if (!ref) return;
  if (l.staatus === "Kehtiv" && !LEP_MUUDATUS_MODE) { LEP_MUUDATUS_MODE = true; REOPEN_CLAUSE = ref; router(); return; }
  gotoClause(ref);
};
window.lepAsClient = () => { const l = CURRENT_LEASE; if (l) setRole("client", l.clientId, "#/leping/" + l.id); };
/* „lepingu algusesse" hõljuknupp: ilmub, kui dokument on alla keritud */
window.docTop = () => window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
let DOCTOP_RAF = false;
window.addEventListener("scroll", () => {
  if (DOCTOP_RAF) return; DOCTOP_RAF = true;
  requestAnimationFrame(() => { DOCTOP_RAF = false;
    const b = document.getElementById("doc-top");
    if (b) b.classList.toggle("show", window.scrollY > 480);
  });
}, { passive: true });

/* JUHTRIBA — alati üks vastus küsimusele „mida MINA nüüd teen?":
   kelle kord + tegevus + ÜKS nupp, mis viib kohale. Sama riba juhib sõlmimist
   (Mustand→Saadetud→Allkirjastamisel) ja muudatusringi (Kehtiv, Lisa N). */
function juhtriba(l) {
  const cs = l.kommentaarid || [];
  /* lahtised punktid jagunevad kelle-kord järgi: opOotel = üürniku sõna oli viimane
     (pall üürileandja käes), kliOotel = üürileandja küsis arutelus (kord üürnikul) */
  const opOotel = cs.filter(cmtOotabOp).length;
  const kliOotel = cs.filter(c => c.staatus === "Ootel" && !cmtOotabOp(c)).length;
  const kinni = cs.filter(c => c.staatus === "Ootab kinnitust").length;
  const cl9 = isClient();
  const bar = (mode, kes, tx, btn) => `
    <div class="guide ${mode} reveal"><span class="g-top"><span class="g-nav" aria-hidden="true"><i class="g-needle"></i></span><span class="g-kes">${kes}</span></span><span class="g-tx">${tx}</span>${btn || ""}</div>`;
  const hyppa = (lbl) => `<button class="btn btn-primary btn-sm" onclick="lepHyppa()">${lbl}<span class="bic">${I.arrow}</span></button>`;
  const asClient = `<button class="btn btn-ghost btn-sm" onclick="lepAsClient()">Vaata üürnikuna<span class="bic">${I.arrow}</span></button>`;
  if (l.staatus === "Mustand V1") return cl9
    ? bar("wait", "Ootab üürileandjat", "Üürileandja koostab lepingu mustandit — saate teate, kui see on valmis.")
    : bar("me", "Sinu kord", "Vaata mustand üle — faktid on lausetes muudetavad. Kui valmis, saada üürnikule.",
        `<button class="btn btn-primary btn-sm send-draft">Saada üürnikule<span class="bic">${I.arrow}</span></button>`);
  if (l.staatus === "Saadetud") {
    if (cl9) {
      if (kinni) return bar("me", "Sinu kord", `Üürileandja pakkus <b>${kinni} uut sõnastust</b> — ava punkt ja kinnita sealsamas.`, hyppa("Ava esimene"));
      if (kliOotel) return bar("me", "Sinu kord", `Üürileandja ootab sinu vastust <b>${kliOotel} punkti</b> arutelus.`, hyppa("Ava ja vasta"));
      if (opOotel) return bar("wait", "Ootab üürileandjat", `Sinu <b>${opOotel} ettepanek${opOotel > 1 ? "ut" : ""}</b> on üürileandja lahendada — saad teate, kui ta vastab.`);
      if (cs.length) return bar("me", "Sinu kord", "Kõik punktid on kokku lepitud — aktsepteeri leping, siis liigub see allkirjastamisse.",
        `<button class="btn btn-primary btn-sm" id="cl-accept-all">Aktsepteeri leping<span class="bic">${I.check}</span></button>`);
      return bar("me", "Sinu kord", "Vaata leping üle — klõpsa punktil, kui tahad küsida või muuta. Kui kõik sobib, aktsepteeri.",
        `<button class="btn btn-primary btn-sm" id="cl-accept-all">Aktsepteerin kõik punktid<span class="bic">${I.check}</span></button>`);
    }
    if (opOotel) return bar("me", "Sinu kord", `Üürnik ootab vastust <b>${opOotel} punktile</b> — ava ja otsusta sealsamas.`, hyppa("Ava esimene"));
    if (kliOotel) return bar("wait", "Ootab üürnikku", `${kliOotel} punkt${kliOotel > 1 ? "i" : ""} ootab üürniku vastust arutelus.`, asClient);
    if (kinni) return bar("wait", "Ootab üürnikku", `${kinni} sõnastus${kinni > 1 ? "t" : ""} ootab üürniku kinnitust punkti juures.`, asClient);
    if (cs.length) return bar("wait", "Ootab üürnikku", "Kõik punktid lahendatud — ootel on üürniku lõplik kinnitus.", asClient);
    return bar("wait", "Ootab üürnikku", "Üürnik vaatab lepingu üle — tema kommentaarid ilmuvad siia.", asClient);
  }
  /* tegevus (meetodivalik + Alusta allkirjastamist) elab KOHE all järgmises kaardis —
     eraldi „juurde" nupp siin oleks eksitav dubleering */
  if (l.staatus === "Allkirjastamisel") return bar("me", "Sinu kord", "Kõik on kokku lepitud — vali meetod ja allkirjasta leping.");
  if (l.staatus === "Kehtiv") {
    const r = aktiivneRing(l);
    if (!r && !opOotel && !kliOotel && !kinni) return "";
    const nr = (r || { nr: nextLisaNr(l) }).nr;
    const n = r ? r.faktid.length + r.punktid.length : 0;
    if (cl9) {
      if (kinni) return bar("me", "Sinu kord", `Üürileandja pakkus <b>${kinni} uut sõnastust</b> (→ Lisa ${nr}) — ava punkt ja kinnita.`, hyppa("Ava esimene"));
      if (kliOotel) return bar("me", "Sinu kord", `Üürileandja ootab sinu vastust <b>${kliOotel} punkti</b> arutelus.`, hyppa("Ava ja vasta"));
      if (opOotel) return bar("wait", "Ootab üürileandjat", `Sinu <b>${opOotel} muudatusettepanek${opOotel > 1 ? "ut" : ""}</b> on üürileandja lahendada.`);
      if (r && r.staatus === "Kinnitamisel") return bar("me", "Sinu kord", `Lisa ${nr} muudatused (${n} punkti) ootavad sinu kinnitust — dokument on all avatud.`,
        `<button class="btn btn-primary btn-sm" id="ring-accept">Kinnitan muudatused<span class="bic">${I.check}</span></button>`);
      if (r && r.staatus === "Allkirjastamisel") return bar("me", "Sinu kord", `Muudatused kinnitatud — allkirjasta Lisa ${nr}.`,
        `<button class="btn btn-primary btn-sm" id="ring-sign">Allkirjasta (Smart-ID)<span class="bic">${I.shield}</span></button>`);
      if (r) return bar("wait", "Ootab üürileandjat", `Lisa ${nr} on üürileandja käes koostamisel — saate teate, kui see on kinnitamiseks valmis.`);
      return "";
    }
    if (opOotel) return bar("me", "Sinu kord", `Üürnik ootab vastust <b>${opOotel} muudatusettepanekule</b> — otsusta punkti juures (→ Lisa ${nr}).`, hyppa("Ava esimene"));
    if (kliOotel) return bar("wait", "Ootab üürnikku", `${kliOotel} punkt${kliOotel > 1 ? "i" : ""} ootab üürniku vastust arutelus.`, asClient);
    if (kinni) return bar("wait", "Ootab üürnikku", `${kinni} sõnastus${kinni > 1 ? "t" : ""} ootab üürniku kinnitust.`, asClient);
    if (r && r.staatus === "Koostamisel") return bar("me", "Sinu kord", `Lisa ${nr} on koos (${n} punkti) — saada üürnikule kinnitamiseks.`,
      `<button class="btn btn-primary btn-sm" id="ring-send" ${n ? "" : "disabled"}>Saada üürnikule<span class="bic">${I.arrow}</span></button>`);
    if (r && r.staatus === "Kinnitamisel") return bar("wait", "Ootab üürnikku", `Lisa ${nr} ootab üürniku kinnitust.`, asClient);
    if (r && r.staatus === "Allkirjastamisel") return bar("me", "Sinu kord", `Üürnik kinnitas muudatused — allkirjasta Lisa ${nr}.`,
      `<button class="btn btn-primary btn-sm" id="ring-sign">Allkirjasta (Smart-ID)<span class="bic">${I.shield}</span></button>`);
    return "";
  }
  return "";
}
/* dokumendifookus (Kehtiv leping): eelvaates on korraga ÜKS dokument, valik külgpaanilt */
let LEP_DOC_SEL = "leping";
window.lepDoc = (k) => { LEP_DOC_SEL = k; router(); };
/* ava dokument eelvaates ka muudatusrežiimist (režiim kinni + valik) */
window.lepDocFull = (k) => { LEP_MUUDATUS_MODE = false; LEP_DOC_SEL = k; router(); };
/* millise ringi-seisu peale on eelvaade juba automaatselt avatud (üks kord seisu kohta) */
let LEP_RING_AUTO = null;

/* kehtiva lepingu dokumentide loend: põhileping + lisad (PDF + genereeritud) */
function lepDokumendid(l) {
  const sp = DB.spaceById(l.spaceId), f = {...objektOf(sp).failid, pinnaplaan: sp.plaanFail || objektOf(sp).failid.pinnaplaan};
  const eriN = l.eri.filter(e => !e.sonastamisel).length;
  const docs = [
    { k: "leping", nimi: "Üürileping", meta: l.id, tyyp: "a4" },
    { k: "lisa1", nimi: "Lisa 1 · Pinnaplaan", meta: sp.nimi, tyyp: "pdf", fail: f.pinnaplaan },
    { k: "lisa2", nimi: "Lisa 2 · Asendiplaan + parkimine", meta: "", tyyp: "pdf", fail: f.parkimine },
  ];
  if (eriN) docs.push({ k: "lisa3", nimi: "Lisa 3 · Eritingimused", meta: `${eriN} punkti`, tyyp: "a4" });
  (l.muudatused || []).filter(m => m.staatus === "Jõustunud").forEach(m =>
    docs.push({ k: "lisaN:" + m.nr, nimi: `Lisa ${m.nr} · Eritingimused`, meta: `muudatus · jõustunud ${m.joustus}`, tyyp: "a4", nr: m.nr }));
  /* aktiivne ring alates kinnitamisest on PÄRIS dokument — kuulub valikusse */
  const ar = aktiivneRing(l);
  if (ar && ["Kinnitamisel", "Allkirjastamisel"].includes(ar.staatus))
    docs.push({ k: "lisaN:" + ar.nr, nimi: `Lisa ${ar.nr} · Eritingimused`, meta: `muudatus · ${ar.staatus.toLowerCase()}`, tyyp: "a4", nr: ar.nr });
  return docs;
}
function dokumendidCard(l) {
  const docs = lepDokumendid(l);
  if (!docs.some(d => d.k === LEP_DOC_SEL)) LEP_DOC_SEL = "leping";
  /* sama keel kui külgriba navigatsioonil: vaikne rida, aktiivne = tume tindipill */
  return `<div class="card pad reveal" style="margin-top:20px">
    <div class="overline" style="margin-bottom:8px">Dokumendid</div>
    <div class="doc-picks"><span class="dp-glide" aria-hidden="true"></span>
    ${docs.map(d => `<button class="doc-pick ${LEP_DOC_SEL === d.k ? "on" : ""} ${d.tyyp === "pdf" && !d.fail ? "nofile" : ""}" onclick="lepDoc('${d.k}')">
      ${I.file.replace('<svg', '<svg class="ic"')}
      <span class="dp-tx">${d.nimi}${d.meta ? `<small>${d.meta}</small>` : ""}</span>
    </button>`).join("")}
    </div>
  </div>`;
}

/* dokumendivalija liugur: positsioneeri aktiivse rea alla; kui eelmine asukoht
   on teada, alusta SEALT ja libise uude (üle täisrenderduse — beui gliding pill) */
let DP_GLIDE = null;
function dpGlide() {
  const host = document.querySelector(".doc-picks");
  const on = host && host.querySelector(".doc-pick.on");
  const g = host && host.querySelector(".dp-glide");
  if (!host || !on || !g) { DP_GLIDE = null; return; }
  const y = on.offsetTop, hh = on.offsetHeight;
  if (DP_GLIDE && (DP_GLIDE.y !== y || DP_GLIDE.h !== hh)) {
    g.style.transition = "none";
    g.style.transform = `translateY(${DP_GLIDE.y}px)`; g.style.height = DP_GLIDE.h + "px";
    g.classList.add("set");
    void g.offsetHeight; /* reflow enne libisema hakkamist */
    g.style.transition = "";
  }
  g.style.transform = `translateY(${y}px)`; g.style.height = hh + "px";
  g.classList.add("set");
  DP_GLIDE = { y, h: hh };
}

/* ÜLDINE LIBISEV VALIK ([data-glide] hostid): sama põhimõte kui dokumendivalijal,
   aga 2D (x+y+mõõt) — pf-sakid, kalendri/pindade filtrid, allkirjameetodi plaadid.
   Eelmine asukoht elab GLIDES-is hosti võtme all üle täisrenderduse. */
const GLIDES = {};
function glideTo(host) {
  const active = host.querySelector(".on, .sel");
  if (!active) return;
  let g = host.querySelector(":scope > .g-pill");
  if (!g) { g = document.createElement("span"); g.className = "g-pill"; g.setAttribute("aria-hidden", "true"); host.prepend(g); }
  const key = host.dataset.glide;
  const cur = { x: active.offsetLeft, y: active.offsetTop, w: active.offsetWidth, h: active.offsetHeight };
  const set = (r) => { g.style.transform = `translate(${r.x}px,${r.y}px)`; g.style.width = r.w + "px"; g.style.height = r.h + "px"; };
  const prev = GLIDES[key];
  /* v389: filtrikiibid (.pf-views) EI libise — pill hüppab kohe uue kiibi alla ja TÄITUB vasakust servast
     (laius 0 → täis, .18s, CSS-is ilma transform-üleminekuta); .method plaadid libisevad endiselt */
  const fill = host.classList.contains("pf-views");
  if (prev && (prev.x !== cur.x || prev.y !== cur.y || prev.w !== cur.w)) {
    g.style.transition = "none"; set(fill ? { ...cur, w: 0 } : prev); g.classList.add("set");
    void g.offsetHeight; g.style.transition = "";
  }
  set(cur); g.classList.add("set"); GLIDES[key] = cur;
}
function glideBars() { document.querySelectorAll("[data-glide]").forEach(glideTo); }
/* klassivahetus ilma renderduseta (nt allkirjameetod) — liugur järgneb klõpsule */
document.addEventListener("click", (e) => {
  const h = e.target.closest("[data-glide]");
  if (h) requestAnimationFrame(() => glideTo(h));
});

/* LIBISEV HOVER (data-hglide loendid, nt pakkumuse lisad): pill järgneb kursorile.
   Esmailmumine ilma lennuta (transition maha), edasi veereb ridade vahel. */
document.addEventListener("mouseover", (e) => {
  const row = e.target.closest("[data-hglide] > *");
  if (!row || row.classList.contains("hg-pill") || row.classList.contains("nofile")) return;
  const host = row.parentElement;
  let g = host.querySelector(":scope > .hg-pill");
  if (!g) { g = document.createElement("span"); g.className = "hg-pill"; g.setAttribute("aria-hidden", "true"); host.prepend(g); }
  const fresh = !g.classList.contains("set");
  if (fresh) g.style.transition = "none";
  g.style.transform = `translateY(${row.offsetTop}px)`; g.style.height = row.offsetHeight + "px";
  if (fresh) { void g.offsetHeight; g.style.transition = ""; }
  g.classList.add("set");
});
document.addEventListener("mouseout", (e) => {
  const host = e.target.closest("[data-hglide]");
  if (host && !host.contains(e.relatedTarget)) {
    const g = host.querySelector(":scope > .hg-pill");
    if (g) g.classList.remove("set");
  }
});


/* Toimingud (Kehtiv leping): muudatuse ALGATAMINE + lõpetamine ÜHES vaikses kaardis.
   Käimasoleva muudatuse elutsükkel (olek, saatmine, kinnitus, allkiri) elab
   JUHTRIBAL — siin sama teekonda ei dubleerita. Jõustunud lisad elavad
   Dokumendid-valijas. Lõpetamine = teavitus (üld p 12), mitte dokument. */
function toimingudCard(l, openCmts) {
  const r = aktiivneRing(l);
  /* sama reakeel kui lõpetamise voldikul — vaikne rida; aktiivse muudatuse ajal
     muudatusrežiimi lüli (punktivaade dokument ↔ ettepanekud) + koostamisel tühistus */
  const mo = ((!r && !openCmts) ? `<button class="act-row" onclick="lepMuudatus(true)">
      <span>${isClient() ? "Tee muudatusettepanek" : "Algata muudatus"}</span>
      <span class="mono" style="font-size:12px;color:var(--faint)">→ Lisa ${nextLisaNr(l)}</span>
      <span class="chev">${I.arrow}</span>
    </button>` : `<button class="act-row" onclick="lepMuudatus(true)">
      <span>Muudatusrežiim</span>
      <span class="mono" style="font-size:12px;color:var(--faint)">Lisa ${(r || { nr: nextLisaNr(l) }).nr}</span>
      <span class="chev">${I.arrow}</span>
    </button>`) + (!isClient() && r && r.staatus === "Koostamisel" ? `<button class="act-row" id="ring-cancel">
      <span style="color:var(--red)">Tühista muudatusring</span>
      <span class="chev">${I.arrow}</span>
    </button>` : "");
  const lo = l.lopetamine;
  let lop;
  if (lo) {
    const who = lo.poolt === "üürnik" ? "Üürnik" : "Üürileandja";
    lop = `<div class="between" style="margin-bottom:8px"><b style="font-size:14px">Lõpeb ${lo.loppKuupaev}</b>${pill(lo.staatus)}</div>
      <div class="muted" style="font-size:12px">${who} · ülesütlemisteade ${lo.esitatud} (üld p 12)${lo.pohjus ? ` · ${lo.pohjus}` : ""}</div>
      ${!isClient() && lo.staatus === "Teavitatud" ? `<button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:8px" id="lop-ack">${I.check} Võta teadmiseks</button>` : ""}`;
  } else {
    const eD = addKuudISO(DEMO_TODAY.toISOString().slice(0, 10), 12);
    const eISO = `${eD.getFullYear()}-${String(eD.getMonth() + 1).padStart(2, "0")}-${String(eD.getDate()).padStart(2, "0")}`;
    lop = `<details class="sa-inline">
      <summary><span>Lepingu lõpetamine</span><span class="chev">${I.arrow}</span></summary>
      <div class="muted" style="font-size:12px;line-height:1.55;margin:4px 0 8px">Üld p 12: kumbki pool võib lepingu üles öelda 1-aastase etteteatamisega. Varaseim lõpp <b class="mono">${fmtEE(eD)}</b>.</div>
      <div class="field" style="margin-bottom:8px"><label>Lõppkuupäev</label><input id="lop-date" type="date" value="${eISO}" min="${eISO}"></div>
      <div class="field" style="margin-bottom:8px"><label>Põhjus (valikuline)</label><input id="lop-reason" type="text" placeholder="${isClient() ? "nt kolime suurematele pindadele" : "nt hoone rekonstrueerimine"}"></div>
      <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center" id="lop-send">Esita lõpetamisteade</button>
    </details>`;
  }
  return `<div class="card pad reveal" style="margin-top:20px">
    <div class="overline" style="margin-bottom:12px">Toimingud</div>
    ${mo}
    <div class="divline"></div>
    ${lop}
  </div>`;
}

/* faktimuudatus → sõnastatud eritingimuse punkt */
function faktPohiRef(key) { const k = Object.keys(FACT_OF_REF).find(x => FACT_OF_REF[x] === key); return k ? k.replace(/^P /, "p ") : ""; }
function faktPunktTekst(x) {
  return `Alates käesoleva lisa jõustumisest on ${String(x.label).toLowerCase()} ${x.uusTxt} (senise ${x.vanaTxt} asemel) — muudetakse põhitingimuste punkti ${faktPohiRef(x.key)}.`;
}
/* ringi punktid ühtse loeteluna: faktipunktid (genereeritud) + sõnastatavad punktid */
function ringItems(r, nr) {
  const items = [];
  (r ? r.faktid : []).forEach((x, i) => items.push({ kind: "f", i, auto: true, tekst: faktPunktTekst(x),
    kirjutabYle: `Põhi · ${faktPohiRef(x.key)}`, staatus: "Aktsepteeritud", sonastamisel: false }));
  (r ? r.punktid : []).forEach((x, i) => items.push({ kind: "p", i, auto: false, tekst: x.tekst, algne: x.algne,
    kirjutabYle: x.kirjutabYle, staatus: x.staatus || "Aktsepteeritud", sonastamisel: !!x.sonastamisel }));
  items.forEach((it, n) => it.ref = `Lisa ${nr} · p${n + 1}`);
  return items;
}
/* Eritingimused · Lisa N plokk dokumendi all (muudatusrežiim) — SAMA keel kui
   sõlmimisel Lisa 3 plokil: punktid sünnivad, sõnastatakse (AI) ja kinnitatakse siin */
function ringEriGroup(l) {
  const r = aktiivneRing(l);
  const nr = (r || { nr: nextLisaNr(l) }).nr;
  const koostab = !isClient() && (!r || r.staatus === "Koostamisel");
  const items = ringItems(r, nr);
  const rows = items.map(it => {
    if (it.sonastamisel && isClient()) return `
            <div class="clause">
              <div class="ref">${it.ref}</div>
              <div class="body"><div class="txt">Kinnitatud muudatus on operaatori sõnastamisel — punkt muutub siin nähtavaks pärast sõnastuse kinnitamist.</div></div>
              <div>${pill("Sõnastamisel")}</div></div>`;
    if (koostab && it.sonastamisel) return `
            <div class="clause flag">
              <div class="ref">${it.ref}</div>
              <div class="body">
                ${it.algne ? `<div class="eri-orig">Üürniku ettepanek: „${it.algne}"</div>` : ""}
                <textarea class="eri-in ring-txt" data-i="${it.i}" aria-label="Eritingimuse sõnastus">${it.tekst}</textarea>
                ${it.kirjutabYle ? `<div class="overwrite">${I.arrow} kirjutab üle: ${it.kirjutabYle}</div>` : ""}
                <div class="wrap-actions" style="margin-top:8px">
                  <button class="btn btn-ghost btn-sm ring-ai" data-i="${it.i}">${I.spark} Sõnasta AI-ga</button>
                  <button class="btn btn-primary btn-sm ring-ok" data-i="${it.i}">${I.check} Kinnita sõnastus</button>
                  <span class="muted" style="font-size:12px">üürnikule nähtav alles pärast kinnitust</span></div></div>
              <div style="display:grid;gap:8px;justify-items:end">${pill("Sõnastamisel")}<button class="rmstep ring-rm" data-kind="p" data-i="${it.i}" title="Eemalda">×</button></div>
            </div>`;
    /* kinnitatud punkt rahuneb dokumendiks — sinine taust jääb ainult sõnastamisel reale */
    return `
            <div class="clause">
              <div class="ref">${it.ref}</div>
              <div class="body"><div class="txt" style="color:var(--ink)">${it.tekst}</div>
                ${it.kirjutabYle ? `<div class="overwrite">${I.arrow} kirjutab üle: ${it.kirjutabYle}</div>` : ""}
                ${it.auto ? `<div class="muted" style="font-size:12px;margin-top:4px">Genereeritud faktimuudatusest — jõustumisel uueneb põhitingimus automaatselt.</div>` : ""}</div>
              <div style="display:grid;gap:8px;justify-items:end">${pill(cmtPill(it.staatus))}${koostab ? `<button class="rmstep ring-rm" data-kind="${it.kind}" data-i="${it.i}" title="Eemalda">×</button>` : ""}</div>
            </div>`;
  }).join("");
  const add = koostab ? `
            <div class="eri-add">
              <div class="overline" style="margin-bottom:8px">Lisa eritingimus</div>
              <textarea id="ring-new" class="eri-in" placeholder="Sõnasta muudatus… nt „Alates 01.01.2027 on Üürnikul õigus kasutada täiendavalt 2 parkimiskohta.&quot;"></textarea>
              <div class="eri-tools">
                <button class="btn btn-primary btn-sm" id="ring-new-add">${I.plus} Lisa punkt</button>
              </div>
              <div class="muted" style="font-size:12px;margin-top:8px">Punkt lisandub täiendava tingimusena — lepingupunkti ülekirjutus tekib punktil klõpsates. Kõik kogunevad Lisa ${nr} eritingimustesse ja jõustuvad pärast üürniku kinnitust ja allkirjastamist.</div>
            </div>` : "";
  return `
          <div class="clause-group" style="border-top:1px solid var(--line)">
            <div class="gh"><span class="doc-h2">Äriruumide üürilepingu eritingimused <span class="h2-sub">· Lisa ${nr} (muudatus)</span></span></div>
            ${rows || `<div class="empty" style="padding:24px"><div>Punkte pole veel — klõpsa lepingupunktil (muudatus tuleb siia) või lisa uus eritingimus.</div></div>`}
            ${add}
          </div>`;
}

/* --- Muudatusring: kehtiva lepingu iga muudatus = JÄRGMINE lisa (3, 4, 5 …) ---
   Ring kogub kokkulepitud muudatused (faktid + punktid), üürnik kinnitab,
   pooled allkirjastavad (konteiner K{nr}) ja alles jõustumisel rakenduvad
   faktimuudatused lepingu lausetesse. Põhileping on kogu aja Kehtiv. */
function aktiivneRing(l) { return (l.muudatused || []).find(m => m.staatus !== "Jõustunud") || null; }
function nextLisaNr(l) {
  const base = l.eri.filter(e => !e.sonastamisel).length ? 4 : 3;
  return base + (l.muudatused || []).filter(m => m.staatus === "Jõustunud").length;
}
function ensureRing(l, algataja) {
  let r = aktiivneRing(l);
  if (!r) {
    r = { nr: nextLisaNr(l), staatus: "Koostamisel", algataja, loodud: TODAY_EE, joustus: null,
      faktid: [], punktid: [], allkirjad: [] };
    (l.muudatused = l.muudatused || []).push(r);
    AUDIT.unshift({ aeg: NOW_EE(), autor: algataja === "üürnik" ? (DB.clientById(l.clientId) || {}).kontakt + " (üürnik)" : "Tarmo Sepp",
      tegevus: `${l.id}: muudatusring alustatud → koostatakse Lisa ${r.nr}.` });
  }
  return r;
}
/* faktiväärtuse inimloetav kuju (ring + Lisa N dokument) */
function faktTxt(key, val) {
  return key === "algus" ? isoToEE(val) : key === "hind" ? eur(val) + " €/m²"
    : key === "kuud" ? val + " kuud" : key === "tagatisKuud" ? val + " kuu üür"
    : key === "parkimine" ? val + " kohta" : String(val);
}
/* faktisisend (kuupäev/number/valik/tekst) — otsemuutmine JA muudatusring jagavad sama */
function faktiSisend(fKey, f) {
  if (fKey === "algus") return `<input id="fact-edit-in" type="date" value="${f.algus}" class="ce-in" style="width:auto">`;
  if (fKey === "hind") return `<input id="fact-edit-in" type="number" step="0.05" min="0.5" value="${f.hind}" class="ce-in" style="width:9em"> <span class="muted" style="font-size:14px">€/m² kuus</span>`;
  if (fKey === "parkimine") return `<input id="fact-edit-in" type="number" step="1" min="0" value="${f.parkimine}" class="ce-in" style="width:7em"> <span class="muted" style="font-size:14px">kohta</span>`;
  if (fKey === "kuud") { const opts = [...new Set([12, 24, 36, 60, 120, f.kuud])].sort((x, y) => x - y);
    return `<select id="fact-edit-in" class="ce-in" style="width:auto">${opts.map(v => `<option value="${v}" ${v === f.kuud ? "selected" : ""}>${v % 12 === 0 ? (v / 12) + " aastat" : v + " kuud"}</option>`).join("")}</select>`; }
  if (fKey === "tagatisKuud") { const opts = [...new Set([1, 2, 3, 6, f.tagatisKuud])].sort((x, y) => x - y);
    return `<select id="fact-edit-in" class="ce-in" style="width:auto">${opts.map(v => `<option value="${v}" ${v === f.tagatisKuud ? "selected" : ""}>${v} kuu üür</option>`).join("")}</select>`; }
  return `<input id="fact-edit-in" type="text" value="${String(f[fKey] || "").replace(/"/g, "&quot;")}" class="ce-in" style="width:100%">`;
}
/* ringi jõustumine: allkirjad + jõustunud olek. PÕHILEPINGUT EI MUUDETA —
   allkirjastatud dokument on puutumatu, kõik muutused elavad lisas endas
   (ülimuslikud punktid); leping viitab neile dünaamiliselt (ringYleRef). */
function ringJousta(l, r) {
  const cl = DB.clientById(l.clientId);
  r.allkirjad = [
    { pool: ACCOUNT.landlord.nimi, isik: "Margus Varne", meetod: "Smart-ID", aeg: NOW_EE() },
    { pool: cl.nimi, isik: cl.kontakt, meetod: "Smart-ID", aeg: NOW_EE() },
  ];
  r.staatus = "Jõustunud"; r.joustus = TODAY_EE;
  AUDIT.unshift({ aeg: NOW_EE(), autor: "Mõlemad pooled", tegevus: `${l.id}: Lisa ${r.nr} (eritingimused, muudatus) allkirjastatud ja jõustunud — ${r.faktid.length} faktimuudatust, ${r.punktid.length} punkti. Põhileping jääb muutmata, lisa on ülimuslik.` });
}
/* kas põhitingimuse punkt on jõustunud lisaga üle kirjutatud? → lisa number */
function ringYleRef(l, ref) {
  const refD = String(ref).replace(/^P /, "p ");
  for (const m of (l.muudatused || []).filter(m => m.staatus === "Jõustunud")) {
    if (m.faktid.some(x => faktPohiRef(x.key) === refD)) return m.nr;
    if (m.punktid.some(p => (p.kirjutabYle || "").includes(refD) || (p.kirjutabYle || "").split(" (")[0] === String(ref))) return m.nr;
  }
  return null;
}
/* varasemad demod rakendasid faktimuudatused põhilepingusse — taasta originaal
   (vana väärtus on ringis alles) ja korista sildid; jooksutatakse korra stardis */
function migrateRingFacts() {
  LEASES.forEach(l => {
    if (!(l.pohi || []).some(p => p.muudatusLisa)) return;
    const first = {};
    (l.muudatused || []).filter(m => m.staatus === "Jõustunud").forEach(m =>
      m.faktid.forEach(x => { if (!(x.key in first)) first[x.key] = x.vana; }));
    if (Object.keys(first).length) {
      const t = ensureTehing(l);
      Object.entries(first).forEach(([k, v]) => { t[k] = v; });
      rebuildPohi(l);
    }
    l.pohi.forEach(p => { if (p.muudatusLisa) { delete p.muudatusLisa; delete p.muudetud; delete p.otse; } });
    DB.save();
  });
}

/* faktisisendi väärtuse lugemine + valideerimine; tagastab val või undefined */
function faktiVal(fKey, inEl) {
  if (!inEl) return undefined;
  let val = inEl.value;
  if (fKey === "hind") val = parseFloat(val);
  if (["parkimine", "kuud", "tagatisKuud"].includes(fKey)) val = parseInt(val, 10);
  if (val === "" || val == null || (typeof val === "number" && !isFinite(val))) return undefined;
  return val;
}

/* Lepingu dokumendivaade — sama „sheet" keel kui pakkumusel; kasutusel alates
   allkirjastamisfaasist, mil leping on lukus ja peab välja nägema nagu päris leping. */
function leaseSheetHTML(l, cls) {
  const cl = DB.clientById(l.clientId), sp = DB.spaceById(l.spaceId), L = ACCOUNT.landlord;
  const obj = objektOf(sp);
  const sigL = (l.allkirjad || [])[0], sigT = (l.allkirjad || [])[1];
  return `
    <div class="sheet ${cls || ""}" data-doc="Äriruumide üürileping · ${l.id}">
      <div class="sh-head">
        <div>
          ${obj.logo ? `<img class="sh-logo" src="${obj.logo}" alt="${obj.nimi}">` : ""}
          <div class="sh-brand">${L.nimi}</div>
          <!-- rekvisiidid elavad plokis „1. Pooled" — päises ei korrata -->
        </div>
        <div style="text-align:right">
          <div class="sh-title">Äriruumide üürileping</div>
          <div class="sh-sub mono">${l.id}${l.pakkumus ? `<br>Pakkumusest ${l.pakkumus}` : ""}<br>${l.allkirjastatud ? `Allkirjastatud: <b>${l.allkirjastatud}</b>` : `Versioon: ${l.versioon || "—"} · allkirjastamisel`}</div>
        </div>
      </div>

      <div class="sh-lbl" style="margin-top:16px">Põhitingimused · ${sp.nimi} · ${obj.nimi} · ${obj.ehr.aadress}</div>

      <!-- pooled AINULT siin (1. Pooled) — P 1.x read on tabelist väljas, et infot mitte korrata -->
      <div class="sh-lbl" style="margin-top:12px">1. Pooled</div>
      <div class="sh-parties" style="margin-top:8px">
        <div><div class="sh-lbl">1.1 · Üürileandja</div>
          <b>${L.nimi}</b><br><span class="sh-sub">Reg ${L.registrikood} · KMKR ${L.kmkr}<br>${L.aadress}<br>${L.epost} · ${L.mobiil}${L.pank ? `<br>${L.pank} · ${L.iban}` : ""}</span></div>
        <div><div class="sh-lbl">1.2 · Üürnik</div>
          <b>${cl.nimi}</b><br><span class="sh-sub">Reg ${cl.registrikood}${cl.kmkr ? ` · KMKR ${cl.kmkr}` : ""}<br>${cl.aadress}<br>${cl.epost}${cl.tel ? ` · ${cl.tel}` : ""}</span></div>
      </div>
      ${(() => {
        /* A4-murdja käsitleb iga otselast ühe plokina — üks suur tabel hüppaks
           tervikuna järgmisele lehele. Sektsioon = oma tabel, pealkirjarida sees. */
        const grupid = [];
        l.pohi.filter(p => !["P 1.1", "P 1.2"].includes(p.ref)).forEach(p => {
          if ((p.sec && p.sec !== "1. Pooled") || !grupid.length) grupid.push({ sec: p.sec !== "1. Pooled" ? p.sec : null, rows: [] });
          grupid[grupid.length - 1].rows.push(p);
        });
        return grupid.map(g => `<table class="sh-tbl">
        <tbody>${g.sec ? `<tr><td colspan="2" style="padding-top:12px"><span class="sh-lbl">${g.sec}</span></td></tr>` : ""}${g.rows.map(p => `<tr>
          <td class="sh-sub" style="vertical-align:top;width:170px">${String(p.ref).replace(/^P /, "")}${p.pealkiri ? ` · ${p.pealkiri}` : ""}</td>
          <td>${p.vaartus}${p.muudetud ? ` <span class="sh-sub">(muudetud läbirääkimisel${p.otse ? "" : " → Lisa 3"})</span>` : ""}${(nr => nr ? ` <span class="sh-sub">(kirjutatud üle: Lisa ${nr}, ülimuslik)</span>` : "")(ringYleRef(l, p.ref))}</td></tr>`).join("")}
        </tbody>
      </table>`).join("");
      })()}
      <!-- indekseerimine elab üldtingimustes (p 5.2) ja eritingimused eraldi Lisa 3
           dokumendis (K2) — kumbagi põhilepingus ei dubleerita -->

      <div class="sh-lbl" style="margin-top:20px">Üldtingimused · täistekst (mall v3.2)</div>
      ${ULD_FULL.length ? ULD_FULL.map(s => `
      <div class="sh-usec-h">${s.nr}. ${s.pealkiri}</div>
      ${s.punktid.map(pp => `<div class="sh-up"><span class="mono">${pp.ref}</span><p>${pp.tekst}</p></div>`).join("")}`).join("") : ULD_CLAUSES.map(c => `
      <div class="sh-up"><span class="mono">${c.ref}</span><p><b>${c.pealkiri}.</b> ${c.tekst}</p></div>`).join("")}
      <!-- peatükid on A4-murdja jaoks LAMEDAD (pealkiri + punktid eraldi plokid) —
           terve peatüki plokk oli ühest lehest kõrgem ja voolas üle -->

      <div class="sh-lbl" style="margin-top:20px">Lisad</div>
      <div class="sh-sub">${(l.lisad || []).filter(x => x.nr !== 3).map(x => `Lisa ${x.nr} · ${x.nimi}`).join("; ")}${l.eri.filter(e => !e.sonastamisel).length ? "; Lisa 3 · Eritingimused (eraldi dokument, konteiner K2)" : ""}${(l.muudatused || []).filter(m => m.staatus === "Jõustunud").map(m => `; Lisa ${m.nr} · Eritingimused (muudatus) (jõustunud ${m.joustus})`).join("")}.</div>

      <div class="sh-signs">
        <div><div class="sh-lbl">Üürileandja</div><b>${L.nimi}</b>
          <div class="sh-sub">${sigL ? `${sigL.isik} · ${sigL.meetod} · ${sigL.aeg}` : "Allkirjastatakse digitaalselt (Smart-ID / Mobiil-ID)"}</div>
          <div class="sh-sigline ${sigL ? "done" : ""}">${sigL ? "/allkirjastatud digitaalselt/" : ""}</div></div>
        <div><div class="sh-lbl">Üürnik</div><b>${cl.nimi}</b>
          <div class="sh-sub">${sigT ? `${sigT.isik} · ${sigT.meetod} · ${sigT.aeg}` : `${cl.kontakt} · allkirjastatakse digitaalselt`}</div>
          <div class="sh-sigline ${sigT ? "done" : ""}">${sigT ? "/allkirjastatud digitaalselt/" : ""}</div></div>
      </div>
      <div class="sh-foot">
        <div class="sh-sub">${l.eri.filter(e => !e.sonastamisel).length
          ? "Dokument allkirjastatakse ASiC-E konteinerites (K1 leping + plaanid · K2 Lisa 3)."
          : "Dokument allkirjastatakse ASiC-E konteineris (K1 leping + plaanid)."}</div>
        <div style="text-align:right" class="sh-sub">Koostatud ThinkOne platvormil</div>
      </div>
    </div>`;
}
/* Lisa 3 · Eritingimused ERALDI dokumendina (konteiner K2) — kuvatakse lepingu
   eelvaate all, kui kinnitatud eritingimusi on */
function lisa3SheetHTML(l) {
  const cl = DB.clientById(l.clientId), L = ACCOUNT.landlord;
  const obj = objektOf(DB.spaceById(l.spaceId));
  const eri = l.eri.filter(e => !e.sonastamisel);
  const sigL = (l.allkirjad || [])[0], sigT = (l.allkirjad || [])[1];
  return `
    <div class="sheet sheet-embed a4-src" data-doc="Lisa 3 · Eritingimused · ${l.id}">
      <div class="sh-head">
        <div>${obj.logo ? `<img class="sh-logo" src="${obj.logo}" alt="${obj.nimi}">` : ""}<div class="sh-brand">${L.nimi}</div><div class="sh-sub">Reg ${L.registrikood} · KMKR ${L.kmkr}<br>${L.aadress}</div></div>
        <div style="text-align:right"><div class="sh-title">Lisa 3 · Eritingimused</div>
          <div class="sh-sub mono">${l.id}<br>${l.allkirjastatud ? `Allkirjastatud: <b>${l.allkirjastatud}</b>` : "allkirjastamisel · konteiner K2"}</div></div>
      </div>
      <div class="sh-sub" style="margin-top:16px">Äriruumide üürilepingu ${l.id} lisa. Eritingimused on Poolte kokkuleppel ülimuslikud Üld- ja Põhitingimuste suhtes niivõrd, kuivõrd nendes on kokku lepitud teisiti.</div>
      <div class="sh-lbl" style="margin-top:20px">Kokkulepitud eritingimused</div>
      <ol class="sh-ol">${eri.map(e => `<li>${e.tekst}${e.kirjutabYle ? ` <span class="sh-sub">(kirjutab üle: ${e.kirjutabYle})</span>` : ""}</li>`).join("")}</ol>
      <div class="sh-signs">
        <div><div class="sh-lbl">Üürileandja</div><b>${L.nimi}</b>
          <div class="sh-sigline ${sigL ? "done" : ""}">${sigL ? "/allkirjastatud digitaalselt/" : ""}</div></div>
        <div><div class="sh-lbl">Üürnik</div><b>${cl.nimi}</b>
          <div class="sh-sigline ${sigT ? "done" : ""}">${sigT ? "/allkirjastatud digitaalselt/" : ""}</div></div>
      </div>
    </div>`;
}

/* Lisa N · Eritingimused (muudatusring) eraldi dokumendina — konteiner K{nr}.
   SAMA kuju kui Lisa 3-l: ühtne punktiloetelu (faktimuudatused sõnastatud punktidena). */
function annexSheetHTML(l, r) {
  const cl = DB.clientById(l.clientId), L = ACCOUNT.landlord;
  const obj = objektOf(DB.spaceById(l.spaceId));
  const sigL = (r.allkirjad || [])[0], sigT = (r.allkirjad || [])[1];
  const punktid = ringItems(r, r.nr).filter(it => !it.sonastamisel);
  return `
    <div class="sheet sheet-embed a4-src" data-doc="Lisa ${r.nr} · Eritingimused · ${l.id}">
      <div class="sh-head">
        <div>${obj.logo ? `<img class="sh-logo" src="${obj.logo}" alt="${obj.nimi}">` : ""}<div class="sh-brand">${L.nimi}</div><div class="sh-sub">Reg ${L.registrikood} · KMKR ${L.kmkr}<br>${L.aadress}</div></div>
        <div style="text-align:right"><div class="sh-title">Lisa ${r.nr} · Eritingimused</div>
          <div class="sh-sub mono">${l.id}<br>${r.joustus ? `Jõustunud: <b>${r.joustus}</b>` : `${r.staatus.toLowerCase()} · konteiner K${r.nr}`}</div></div>
      </div>
      <div class="sh-sub" style="margin-top:16px">Äriruumide üürilepingu ${l.id} lisa (lepingu muudatus). Eritingimused on Poolte kokkuleppel ülimuslikud Üld- ja Põhitingimuste ning varasemate lisade suhtes niivõrd, kuivõrd nendes on kokku lepitud teisiti.</div>
      <div class="sh-lbl" style="margin-top:20px">Kokkulepitud eritingimused</div>
      <ol class="sh-ol">${punktid.map(p => `<li>${p.tekst}${p.kirjutabYle ? ` <span class="sh-sub">(kirjutab üle: ${p.kirjutabYle})</span>` : ""}</li>`).join("")}</ol>
      <div class="sh-signs">
        <div><div class="sh-lbl">Üürileandja</div><b>${L.nimi}</b>
          <div class="sh-sub">${sigL ? `${sigL.isik} · ${sigL.meetod} · ${sigL.aeg}` : "Allkirjastatakse digitaalselt"}</div>
          <div class="sh-sigline ${sigL ? "done" : ""}">${sigL ? "/allkirjastatud digitaalselt/" : ""}</div></div>
        <div><div class="sh-lbl">Üürnik</div><b>${cl.nimi}</b>
          <div class="sh-sub">${sigT ? `${sigT.isik} · ${sigT.meetod} · ${sigT.aeg}` : `${cl.kontakt} · allkirjastatakse digitaalselt`}</div>
          <div class="sh-sigline ${sigT ? "done" : ""}">${sigT ? "/allkirjastatud digitaalselt/" : ""}</div></div>
      </div>
    </div>`;
}

/* akna suuruse muutus → lehed mõõdavad end ümber (lähtesisu hoitakse el._src-is;
   üks debounce-kuular kogu äpile — muudel vaadetel #a4-wrap puudub ja midagi ei juhtu) */
let A4_RESIZE_T = null;
window.addEventListener("resize", () => {
  clearTimeout(A4_RESIZE_T);
  A4_RESIZE_T = setTimeout(() => {
    const el = document.getElementById("a4-wrap");
    if (el && el._src) { el.innerHTML = el._src; paginateA4(el); }
  }, 250);
});

/* Dokumendi eelvaade A4-lehtedena: mõõdab plokid päriselt ja murrab lehtedele;
   üksik leht hoiab A4 proportsiooni (210:297), lehtede vahel väike vahe */
function paginateA4(wrap) {
  wrap.querySelectorAll(".a4-src").forEach(src => {
    const title = src.dataset.doc || "";
    const doc = document.createElement("div"); doc.className = "a4-doc";
    src.parentNode.insertBefore(doc, src);
    const kids = [...src.children];
    let page = null, H = 0;
    const newPage = () => {
      page = document.createElement("div");
      page.className = "sheet sheet-embed a4-page";
      doc.appendChild(page);
      if (!H) H = Math.round(page.getBoundingClientRect().width * 297 / 210);
      page.style.height = H + "px";
    };
    newPage();
    /* mahtuvuse kontroll ristkülikutega — scrollHeight ei arvesta viimase ploki
       alumist marginaali ja laseb sisul jaluse (64px reserv) alale valguda */
    const FOOT_RESERV = 68; /* 64px jalus + ümardusvaru */
    const overflows = () => {
      const last = page.lastElementChild; if (!last) return false;
      return last.getBoundingClientRect().bottom > page.getBoundingClientRect().bottom - FOOT_RESERV;
    };
    kids.forEach(k => {
      page.appendChild(k);
      /* ei mahu (ja pole lehe ainus plokk) → järgmisele lehele; sektsioonipealkiri
         ei tohi orvuna vana lehe lõppu jääda — tuleb punktiga kaasa */
      if (overflows() && page.children.length > 1) {
        const prev = k.previousElementSibling;
        const pull = prev && page.children.length > 2 && /(^|\s)(sh-usec-h|sh-lbl)(\s|$)/.test(prev.className || "") ? prev : null;
        newPage();
        if (pull) page.appendChild(pull);
        page.appendChild(k);
      }
    });
    src.remove();
    const pages = doc.querySelectorAll(".a4-page");
    pages.forEach((p, i) => {
      const f = document.createElement("div"); f.className = "a4-pfoot";
      f.innerHTML = `<span>${title}</span><span>Lk ${i + 1} / ${pages.length}</span>`;
      p.appendChild(f);
    });
  });
}

View.leping = (id) => {
  const l = DB.leaseById(id); if (!l) return notFound("Lepingut ei leitud");
  if (isClient() && !clientSeesLease(l)) return notFound("See leping ei ole veel teile saadetud");
  const cl = DB.clientById(l.clientId); const sp = DB.spaceById(l.spaceId);
  const signed = l.staatus === "Kehtiv";
  const editPohi = !isClient() && l.staatus === "Mustand V1"; /* põhitingimused muudetavad enne saatmist */
  /* mustandis genereeritakse laused faktidest inline-väljadega (vt pohiTehing/factMark);
     loevaates sama mootoriga, aga võtmeväärtused lihtsalt rasvaselt (lause ise normaalkaalus) */
  const facts = editPohi ? ensureTehing(l) : null;
  const editRows = editPohi ? pohiTehing({ cl, ct: l.kontakt || null, sp, facts, edit: true }, factMark(facts)) : null;
  const readRows = !editPohi && !isNaN(Date.parse(ensureTehing(l).algus))
    ? pohiTehing({ cl, ct: l.kontakt || null, sp, facts: l.tehing }, (k, t) => `<b class="fv">${t}</b>`) : null;
  /* üldtingimused on vaikimisi kokku volditud; kommentaarid avavad ploki ise.
     Kehtival lepingul loeb dokumendi jaoks AINULT lahtine kommentaar — sõlmimisaegne
     ajalugu ei märgista ridu ega ava sektsioone (puhas leht; ajalugu elab punkti lõimes) */
  const relCmt = (c) => l.staatus !== "Kehtiv" || cmtOpen(c);
  const uldCmts = ULD_FULL.length
    ? ULD_FULL.reduce((s, sec) => s + sec.punktid.filter(p => (l.kommentaarid||[]).some(c => c.clauseRef === p.ref && relCmt(c))).length, 0)
    : ULD_CLAUSES.filter(c => (l.kommentaarid||[]).some(k => k.clauseRef === c.ref && relCmt(k))).length;
  const uldPts = ULD_FULL.length ? ULD_FULL.reduce((s, x) => s + x.punktid.length, 0) : ULD_CLAUSES.length;
  /* operaator vormib Lisa 3 kogu läbirääkimise vältel: üld → Lisa 3 saatmine + sõnastamine */
  const canShape = !isClient() && ["Mustand V1","Saadetud"].includes(l.staatus);
  const openCmts = (l.kommentaarid||[]).filter(cmtOpen).length;
  if (LEP_FOCUS_ID !== l.id) { LEP_FOCUS_ID = l.id; LEP_MUUDATUS_MODE = false; LEP_DOC_SEL = "leping"; DP_GLIDE = null; }
  /* Lisa N jõudis kinnitamisele/allkirjastamisele → SEE dokument avaneb eelvaates ise
     (üks kord seisu kohta — kasutaja hilisem käsitsi valik jääb püsima) */
  if (l.staatus === "Kehtiv") { const ra = aktiivneRing(l);
    if (ra && ["Kinnitamisel", "Allkirjastamisel"].includes(ra.staatus)) {
      const key = `${l.id}:${ra.nr}:${ra.staatus}`;
      if (LEP_RING_AUTO !== key) { LEP_RING_AUTO = key; LEP_DOC_SEL = "lisaN:" + ra.nr; LEP_MUUDATUS_MODE = false; } } }
  /* Kehtiv + muudatusrežiim: dokumendi asemel klõpsatav punktivaade (muudatused → Lisa N) */
  const muudatusMode = l.staatus === "Kehtiv" && LEP_MUUDATUS_MODE;
  const states = ["Mustand V1","Saadetud","Kõik aktsept.","Allkirjastamisel","Kehtiv"];
  /* Allkirjastamisel = samm 3; „Kõik aktsept." on läbikäidav vaheseis (aktsept viib kohe allkirjastamisse) */
  const sIdx = signed ? 4 : l.staatus === "Allkirjastamisel" ? 3 : (l.staatus === "Mustand V1" ? 0 : 1);

  return `
  <div class="view">
    <a class="btn btn-ghost btn-sm reveal" href="${isClient()?'#/portaal':'#/lepingud'}" style="margin-bottom:20px">${I.back} ${isClient()?'Minu dokumendid':'Lepingud'}</a>
    <!-- üürileandja info-päis eemaldatud (nagu pakkumusvaates v156) — identiteet on
         dokumendi päises, staatus lehe päises; plokk oli puhas dubleering -->
    <div class="page-head reveal">
      <div><div class="overline">Üürileping · ${l.versioon||"allkirjastatud"}</div>
        <h1 class="page-h1" style="margin-top:8px">${cl.nimi}</h1>
        <p class="page-sub mono" style="font-size:14px">${l.id} · ${sp.nimi} · ${objektOf(sp).nimi} · pakkumusest ${l.pakkumus}</p></div>
      <div style="text-align:right">${pill(l.staatus)}${l.lopetamine?`<div style="margin-top:8px">${pill("Lõpeb "+l.lopetamine.loppKuupaev+" · ülesütlemine","amber")}</div>`:""}</div>
    </div>

    ${signed ? "" : `
    <!-- kehtival lepingul rada ei kuvata — teekond on läbi, olek on päises ja olekukaardil -->
    <div class="cl-track reveal">
      ${states.map((st,i)=>`${i?`<span class="ct-rail ${i<=sIdx?'done':''}"></span>`:""}
        <span class="ct-step ${i<sIdx?'done':i===sIdx?'current':''}"><i></i><span>${st}</span></span>`).join("")}
    </div>`}

    <!-- sama paigutuskeel kui pakkumuse kliendivaates: lai dokument + 300px kleepuv külg -->
    <div class="cl-layout">
      <div>
        ${(l.staatus === "Allkirjastamisel" || (l.staatus === "Kehtiv" && !muudatusMode)) ? `
        <!-- pikk A4-dokument: „algusesse" hõljuknupp ilmub kerides -->
        <button class="doc-top" id="doc-top" onclick="docTop()" title="Lepingu algusesse">${I.up}</button>
        ${(() => {
          /* Allkirjastamisel: kõik allkirjastatavad dokumendid järjest (konteinerite kontekst) */
          if (l.staatus === "Allkirjastamisel") return "";
          /* Kehtiv: dokumendifookus — eelvaates on täpselt ÜKS dokument (valik külgpaanilt) */
          const sel = LEP_DOC_SEL;
          if (sel === "lisa1" || sel === "lisa2") {
            const sp2 = DB.spaceById(l.spaceId), f2 = {...objektOf(sp2).failid, pinnaplaan: sp2.plaanFail || objektOf(sp2).failid.pinnaplaan};
            const fail = sel === "lisa1" ? f2.pinnaplaan : f2.parkimine;
            const title = sel === "lisa1" ? `Lisa 1 · Pinnaplaan (${sp2.nimi})` : "Lisa 2 · Asendiplaan + parkimisskeem";
            return fail ? `
        <div class="doc reveal" style="overflow:hidden">
          <div class="doc-head" style="padding:12px 20px"><div><div class="doc-title" style="font-size:16px">${title}</div></div>
            <button class="btn btn-ghost btn-sm" onclick="openPdf('${fail}','${title}')">Ava suurelt</button></div>
          <iframe class="att-frame" src="${fail}#toolbar=0&navpanes=0&view=FitH" title="${title}"></iframe>
        </div>` : `
        <div class="card pad reveal"><div class="empty" style="padding:40px"><div class="ic">${I.file}</div><div>${title} — PDF on lisamata.</div></div></div>`;
          }
          const selRing = String(sel).startsWith("lisaN:") ? (l.muudatused || []).find(m => m.nr === +String(sel).split(":")[1]) : null;
          const inner = sel === "lisa3" ? lisa3SheetHTML(l) : selRing ? annexSheetHTML(l, selRing) : leaseSheetHTML(l, "sheet-embed a4-src");
          return `
        <div class="reveal" id="a4-wrap">${inner}</div>`;
        })()}
        ${l.staatus !== "Allkirjastamisel" ? "" : `
        <!-- allkirjastamisfaas: päris dokumendid A4-lehtedena (K1 leping + K2 Lisa 3) -->
        <div class="reveal" id="a4-wrap">
          ${leaseSheetHTML(l, "sheet-embed a4-src")}
          ${l.eri.filter(e => !e.sonastamisel).length ? `<div class="a4-doclbl">Lisa 3 · Eritingimused</div>${lisa3SheetHTML(l)}` : ""}
          ${(l.muudatused || []).filter(m => m.staatus === "Jõustunud").map(m => `<div class="a4-doclbl">Lisa ${m.nr} · Eritingimused (muudatus)</div>${annexSheetHTML(l, m)}`).join("")}
        </div>`}` : `
        ${muudatusMode ? `
        <!-- muudatusrežiimi riba: tagasi dokumendile + kuhu muudatused kogunevad -->
        <div class="between reveal" style="margin-bottom:12px;gap:12px">
          <button class="btn btn-ghost btn-sm" onclick="lepMuudatus(false)">${I.back} Näita dokumenti</button>
          <span class="tag">Muudatusrežiim · klõpsa punktil — kokkulepe → Lisa ${(aktiivneRing(l) || { nr: nextLisaNr(l) }).nr}</span>
        </div>` : ""}
        <div class="doc reveal">
          <div class="doc-head">
            <div><div class="doc-title">Üürilepingu dokument</div><div class="doc-sub">${editPohi ? "Muuda fakte otse lausetes — tuletatud väärtused uuenevad ise" : `Klõpsa punktil ${isClient()?"kommenteerimiseks":"kommentaaride vaatamiseks"}`}</div></div>
            ${signed ? `<span class="pill green"><i class="dot"></i>Allkirjastatud</span>` : pill(l.staatus)}
          </div>

          <!-- PÕHITINGIMUSED (malli struktuuris, väärtused tehinguandmetest) -->
          <div class="clause-group">
            <div class="gh"><span class="doc-h2">Äriruumide üürilepingu põhitingimused</span></div>
            ${editPohi ? `<div class="fact-legend">Valge väli lauses = tehingufakt, muuda otse; <span class="fact">esile tõstetud</span> väärtus arvutub faktidest ise. Registrist tulevad punktid kannavad allika-märgist.</div>` : ""}
            ${l.pohi.map(p => { const pcmts = (l.kommentaarid||[]).filter(c => c.clauseRef === p.ref);
              /* rea pill = kommentaari PÄRIS seis: Lahendamisel / Kinnitatud / Selgitatud / Tagasi lükatud.
                 Kehtival lepingul ainult lahtine seis — lahendatud ajalugu ei märgista dokumenti */
              const cmtLbl = pcmts.some(cmtOpen) ? "Lahendamisel"
                : (pcmts.length && l.staatus !== "Kehtiv") ? cmtPill(pcmts[pcmts.length-1].staatus) : null;
              const refD = String(p.ref).replace(/^P /, "p ");
              /* sektsioonipealkiri „1. Pooled": nummerdatud kivi + dokumendikaalus nimi */
              const sm = p.sec ? String(p.sec).match(/^(\d+)\.\s*(.+)$/) : null;
              const secH = p.sec ? (sm ? `<div class="gh sec-h"><span class="sec-n">${sm[1]}</span><span class="sec-t">${sm[2]}</span></div>`
                                       : `<div class="gh"><span class="overline">${p.sec}</span></div>`) : "";
              /* pooled/esindajad võtmeplaatidena; üürnik saab OMA esindaja (P 6.2) andmeid muuta */
              const repEdit = isClient() && !["Kehtiv","Allkirjastamisel"].includes(l.staatus);
              const kv = pooledKV(p.ref, cl, l.kontakt, repEdit);
              if (editPohi) { const er = editRows.find(x => x.ref === p.ref), src = POHI_SRC[p.ref];
                return secH + `<div class="clause">
                <div class="ref">${refD}</div>
                <div class="body">${p.pealkiri?`<div class="ttl">${p.pealkiri}</div>`:""}${kv || `<div class="val fval">${er ? er.vaartus : p.vaartus}</div>`}</div>
                <div><span class="src-chip${src ? "" : " live"}">${src || "tehingust"}</span></div></div>`; }
              const rr = readRows && readRows.find(x => x.ref === p.ref);
              /* helesinine flag-taust AINULT seni, kuni punkt on lahtine — lahendatud punkt rahuneb dokumendiks */
              return secH + `<div class="clause clickable ${cmtLbl==="Lahendamisel"?'flag':''}" data-clause="${p.ref}">
                <div class="ref">${refD}</div>
                <div class="body">${p.pealkiri?`<div class="ttl">${p.pealkiri}</div>`:""}${kv || `<div class="val">${rr ? rr.vaartus : p.vaartus}</div>`}
                  ${p.muudetud?`<div class="overwrite">${I.arrow} muudetud läbirääkimisel ${p.otse ? "(otse kokkulepe)" : "→ Lisa 3"}</div>`:""}${(nr => nr ? `<div class="overwrite">${I.arrow} kirjutatud üle: Lisa ${nr} eritingimustes (ülimuslik)</div>` : "")(ringYleRef(l, p.ref))}</div>
                <div>${cmtLbl?pill(cmtLbl):`<span class="hov-edit">${I.edit}</span>`}</div></div>`; }).join("")}
          </div>

          <!-- ÜLDTINGIMUSED — TÄISTEKST mallist (Üürileping.docx). Lukus: teksti ei muudeta
               kunagi; mustandis saab iga punkti saata eritingimustesse ülekirjutamisele. -->
          <div class="clause-group" style="border-top:1px solid var(--line)">
            <details class="uld-all" ${uldCmts ? "open" : ""}>
            <summary><span class="doc-h2">Äriruumide üürilepingu üldtingimused <span class="h2-sub">· täistekst</span></span>
              ${uldCmts ? pill(uldCmts + " kommentaari", "amber") : ""}
              <span class="cnt">${uldPts} punkti</span><span class="chev">${I.arrow}</span></summary>
            ${canShape ? `<div class="muted" style="font-size:12px;margin:0 0 8px">punkti ei muudeta — „→ Lisa 3" loob ülimusliku eritingimuse</div>` : ""}
            ${ULD_FULL.length ? ULD_FULL.map(sec => {
              const secCmts = sec.punktid.filter(p => (l.kommentaarid||[]).some(c => c.clauseRef === p.ref && relCmt(c))).length;
              return `
              <details class="uld-sec" ${secCmts ? "open" : ""}>
                <summary><span class="chev">${I.arrow}</span><span class="secnr">${sec.nr}.</span> ${sec.pealkiri}
                  ${secCmts ? pill(secCmts + " kommentaari", "amber") : ""}
                  <span class="cnt">${sec.punktid.length} punkti</span><span class="lockico" style="width:13px;height:13px">${I.lock}</span></summary>
                ${sec.punktid.map(p => {
                  const over = (l.eri||[]).some(e => ((e.kirjutabYle||"").split(" (")[0]) === `Üld · p ${p.ref}`);
                  const cmts = (l.kommentaarid||[]).filter(c => c.clauseRef === p.ref);
                  const pend = cmts.some(cmtOpen);
                  return `<div class="uld-p ${editPohi ? "" : "clickable"}" ${editPohi ? "" : `data-clause="${p.ref}"`} ${editPohi ? "" : `title="Klõpsa ${isClient() ? "kommenteerimiseks" : "kommentaaride vaatamiseks"}"`}>
                    <span class="pref">${p.ref}</span>
                    <div><p>${p.tekst}</p>${over ? `<div class="overwrite" style="margin-top:8px">${I.arrow} kirjutatud üle: eritingimus Lisa 3-s (ülimuslik)</div>` : ""}</div>
                    <div style="display:flex;gap:8px;align-items:center">${pend ? pill("Lahendamisel") : (cmts.length && l.staatus !== "Kehtiv") ? pill(cmtPill(cmts[cmts.length-1].staatus)) : ""}${canShape ? `<button class="uld-send" data-uref="${p.ref}" title="Saada eritingimustesse ülekirjutamisele">→ Lisa 3</button>` : ""}</div>
                  </div>`; }).join("")}
              </details>`; }).join("")
            : ULD_CLAUSES.map(c => `<div class="clause locked">
              <div class="ref">${c.ref}</div>
              <div class="body"><div class="ttl">${c.pealkiri}</div><div class="txt">${c.tekst}</div></div>
              <div style="display:flex;gap:8px;align-items:center">${canShape ? `<button class="uld-send" data-uref="${c.ref}" title="Saada eritingimustesse ülekirjutamisele">→ Lisa 3</button>` : ""}<span class="lockico">${I.lock}</span></div></div>`).join("")}
            </details>
          </div>

          <!-- ERITINGIMUSED (Lisa 3) — mustandis sõnastatavad -->
          <div class="clause-group" style="border-top:1px solid var(--line)">
            <div class="gh"><span class="doc-h2">Äriruumide üürilepingu eritingimused <span class="h2-sub">· Lisa 3</span></span></div>
            ${l.eri.length ? l.eri.map((e,i) => { const ecmts = (l.kommentaarid||[]).filter(c => c.clauseRef === e.ref);
              /* sõnastamisel punkt: üürnik näeb vaikset kohatäidet, mitte tööversiooni */
              if (e.sonastamisel && isClient()) return `
            <div class="clause">
              <div class="ref">${e.ref}</div>
              <div class="body"><div class="txt">Kinnitatud muudatus on operaatori sõnastamisel — punkt muutub siin nähtavaks pärast sõnastuse kinnitamist.</div></div>
              <div>${pill("Sõnastamisel")}</div></div>`;
              /* sinine flag-taust ainult tööseisus punktil (sõnastamisel või lahtine kommentaar) —
                 kinnitatud eritingimus rahuneb dokumendiks nagu põhitingimusedki */
              const eflag = (e.sonastamisel || ecmts.some(cmtOpen)) ? "flag" : "";
              /* üürnik EI kommenteeri eritingimust läbirääkimiste ajal — punkt on juba
                 läbirääkimiste tulem; kehtival lepingul jääb klõps lahti (= muudatusettepanek) */
              const eClick = !canShape && (!isClient() || l.staatus === "Kehtiv");
              return canShape ? `
            <div class="clause ${eflag}">
              <div class="ref">${e.ref}</div>
              <div class="body">
                ${e.sonastamisel && e.algne ? `<div class="eri-orig">Üürniku ettepanek: „${e.algne}"</div>` : ""}
                <textarea class="eri-in leri-txt" data-i="${i}" aria-label="Eritingimuse sõnastus">${e.tekst}</textarea>
                ${e.kirjutabYle?`<div class="overwrite">${I.arrow} kirjutab üle: ${e.kirjutabYle}</div>`:""}
                ${e.sonastamisel ? `<div class="wrap-actions" style="margin-top:8px">
                  <button class="btn btn-ghost btn-sm eri-ai" data-i="${i}">${I.spark} Sõnasta AI-ga</button>
                  <button class="btn btn-primary btn-sm eri-ok" data-i="${i}">${I.check} Kinnita sõnastus</button>
                  <span class="muted" style="font-size:12px">üürnikule nähtav alles pärast kinnitust</span></div>` : ""}
                ${ecmts.length?`<div style="margin-top:8px"><button class="steplink" data-ecmt="${e.ref}">Vaata kommentaare (${ecmts.length})</button></div>`:""}</div>
              <div style="display:grid;gap:8px;justify-items:end">${pill(cmtPill(e.staatus))}<button class="rmstep leri-rm" data-i="${i}" title="Eemalda eritingimus">×</button></div>
            </div>` : `
            <div class="clause ${eflag} ${eClick?'clickable':''}" ${eClick?`data-clause="${e.ref}"`:''}>
              <div class="ref">${e.ref}</div>
              <div class="body"><div class="txt" style="color:var(--ink)">${e.tekst}</div>
                ${e.kirjutabYle?`<div class="overwrite">${I.arrow} kirjutab üle: ${e.kirjutabYle}</div>`:""}</div>
              <div>${pill(cmtPill(e.staatus))}</div></div>`; }).join("")
              : `<div class="empty" style="padding:24px"><div>Eritingimusi pole — ${canShape ? "saada üldtingimuste punkt siia ülekirjutamisele (nupp „→ Lisa 3”) või lisandub läbirääkimisel." : "lisanduvad läbirääkimisel."}</div></div>`}
          </div>
          ${l.staatus === "Kehtiv" ? ringEriGroup(l) : ""}
        </div>`}
      </div>

      <!-- külgveerg: kleepuv, liigub kerimisel kaasa -->
      <div class="cl-side">
        <!-- JUHTKAART esimesena: kelle kord + mida teha + üks nupp; paan on kleepuv,
             seega alati nähtaval — dokumenti ei kata miski -->
        ${juhtriba(l)}
        ${signed ? signCard(l) : l.staatus === "Allkirjastamisel" ? signPanel(l) : `
        <!-- läbirääkimiste ajal on tehingu võtmefaktid alati silme ees -->
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:12px">Tehing</div>
          ${lepStatRow(l)}
        </div>`}
        ${l.staatus === "Kehtiv" ? dokumendidCard(l) + toimingudCard(l, openCmts) : ""}

        <!-- indekseerimise külgkaart eemaldatud: indekseerimine elab lepingus endas
             (üld p 5.2 / Lisa 3 ülekirjutus) — muutmine käib punkti läbirääkimisega -->

        ${(l.staatus === "Allkirjastamisel" || signed) ? "" : (lisadRead => `
        <!-- kehtival lepingul asendab seda Dokumendid-valija; allkirjastamisel konteinerid -->
        <div class="card pad reveal" style="margin-top:20px">
          <div class="overline" style="margin-bottom:12px">Lisad · klõpsa vaatamiseks</div>
          ${lisadRead}
        </div>`)(`
          ${l.lisad.map(x => { const has = /\.pdf$/i.test(x.fail);
            /* Lisa 3 = genereeritud dokument: rida on olemas AINULT siis, kui
               eritingimustes on kokku lepitud (kinnitatud punktid olemas) */
            const gen3 = x.nr === 3, eriN = l.eri.filter(e => !e.sonastamisel).length;
            if (gen3 && !eriN) return "";
            return `<button class="att ${has || (gen3 && eriN) ? '' : 'nofile'}" onclick="${gen3 ? `openLisa3('${l.id}')` : `openPdf('${x.fail}','Lisa ${x.nr} · ${x.nimi}')`}">
              ${I.file.replace('<svg','<svg class="fic"')}
              <div style="flex:1"><b>Lisa ${x.nr}</b> · ${x.nimi}</div>
              <span class="tag">${gen3 ? `${eriN} punkti · vaata` : has ? "PDF · vaata" : x.fail}</span></button>`; }).join("")}
          ${(l.muudatused || []).filter(m => m.staatus === "Jõustunud").map(m => `
          <button class="att" onclick="openLisaN('${l.id}',${m.nr})">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1"><b>Lisa ${m.nr}</b> · Eritingimused (muudatus)</div>
            <span class="tag">jõustunud ${m.joustus} · vaata</span></button>`).join("")}`)}
      </div>
    </div>
  </div>`;
};
View.leping.init = (id) => {
  const l = DB.leaseById(id);
  /* allkirjastamisfaasi eelvaade: murra dokumendid A4-lehtedeks (mõõtmispõhine).
     NB: oota veebifondid ära — asendusfondi meetrikaga mõõdetud lehed kasvaksid
     Interi saabudes jaluse peale (paistis eriti hard-reload'i järel) */
  const a4 = document.getElementById("a4-wrap");
  if (a4) {
    const go = () => { const el = document.getElementById("a4-wrap");
      if (el) { el._src = el._src || el.innerHTML; paginateA4(el); } };
    if (document.fonts && document.fonts.status !== "loaded") document.fonts.ready.then(go); else go();
  }
  document.querySelectorAll("[data-clause]").forEach(el => el.onclick = () => openClause(el, el.dataset.clause));
  /* pärast otsust avatakse sihtpunkt (sama või JÄRGMINE lahtine) — süsteem juhib,
     kasutaja ei otsi: keritakse kohale, suletud voldikud avanevad teel */
  if (REOPEN_CLAUSE) { const rc = REOPEN_CLAUSE; REOPEN_CLAUSE = null; gotoClause(rc); }
  /* muudetava eritingimuse kommentaarid avanevad eraldi nupust (rida ise on tekstiväli) */
  document.querySelectorAll("[data-ecmt]").forEach(b => b.onclick = (ev) => { if (ev && ev.stopPropagation) ev.stopPropagation(); openClause(b, b.dataset.ecmt); });

  /* muudatusringi elutsükkel (Kehtiv leping): eemalda → saada → kinnita → allkirjasta */
  if (l && l.staatus === "Kehtiv") {
    const lm = (fn, msg) => { fn(); DB.save(); toast(msg); router(); };
    document.querySelectorAll(".ring-rm").forEach(b => b.onclick = () => {
      const r = aktiivneRing(l); if (!r || r.staatus !== "Koostamisel") return;
      if (b.dataset.kind === "f") r.faktid.splice(+b.dataset.i, 1); else r.punktid.splice(+b.dataset.i, 1);
      lm(() => {}, "Punkt eemaldatud Lisa eritingimustest");
    });
    /* sõnastamise voog Lisa N plokis — sama muster kui sõlmimisel (leri-txt/eri-ai/eri-ok) */
    document.querySelectorAll(".ring-txt").forEach(t => t.onchange = () => {
      const r = aktiivneRing(l); const p = r && r.punktid[+t.dataset.i]; if (!p) return;
      p.tekst = t.value; DB.save();
    });
    document.querySelectorAll(".ring-ai").forEach(b => b.onclick = () => {
      const r = aktiivneRing(l); const p = r && r.punktid[+b.dataset.i]; if (!p) return;
      b.innerHTML = `<span class="thinking"><span class="d"></span><span class="d"></span><span class="d"></span></span> sõnastan…`;
      setTimeout(() => {
        p.tekst = aiSonasta(p);
        AUDIT.unshift({ aeg: NOW_EE(), autor: "ThinkOne AI", tegevus: `${l.id}: AI pakkus Lisa ${r.nr} eritingimuse sõnastuse — ootab operaatori kinnitust.` });
        DB.save(); toast("AI sõnastus valmis — vaata üle ja kinnita"); router();
      }, 900);
    });
    document.querySelectorAll(".ring-ok").forEach(b => b.onclick = () => {
      const r = aktiivneRing(l); const p = r && r.punktid[+b.dataset.i]; if (!p) return;
      const t = document.querySelector(`.ring-txt[data-i="${b.dataset.i}"]`);
      const v = (t ? t.value : p.tekst).trim();
      if (!v) { toast("Sõnastus on tühi — kirjuta või kasuta AI-d"); return; }
      p.tekst = v; p.sonastamisel = false; p.staatus = "Aktsepteeritud";
      lm(() => AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: Lisa ${r.nr} eritingimuse sõnastus kinnitatud.` }), "Sõnastus kinnitatud");
    });
    const rna = document.getElementById("ring-new-add");
    if (rna) rna.onclick = () => {
      const t = document.getElementById("ring-new"); const txt = t ? t.value.trim() : "";
      if (!txt) { toast("Sõnasta eritingimus"); if (t) t.focus(); return; }
      const ky = (document.getElementById("ring-new-ky") || {}).value || null;
      const r = ensureRing(l, "operaator");
      lm(() => { r.punktid.push({ tekst: txt, algne: null, kirjutabYle: ky || null, staatus: "Aktsepteeritud" });
        AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: eritingimus lisatud Lisa ${r.nr}-i.` });
      }, `Punkt lisatud Lisa ${r.nr} eritingimustesse`);
    };
    const rs = document.getElementById("ring-send");
    if (rs) rs.onclick = () => { const r = aktiivneRing(l); if (!r) return;
      if (r.punktid.some(p => p.sonastamisel)) { toast("Sõnastamisel punktid vajavad enne kinnitamist"); return; }
      lm(() => { r.staatus = "Kinnitamisel"; LEP_MUUDATUS_MODE = false;
        AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: Lisa ${r.nr} eritingimused saadetud üürnikule kinnitamiseks.` });
      }, `Lisa ${r.nr} saadetud üürnikule kinnitamiseks`); };
    const rc2 = document.getElementById("ring-cancel");
    if (rc2) rc2.onclick = () => { if (!confirm("Tühistad muudatusringi? Kogutud muudatused kaovad.")) return;
      lm(() => { l.muudatused = (l.muudatused || []).filter(m => m.staatus === "Jõustunud"); LEP_MUUDATUS_MODE = false;
        AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: muudatusring tühistatud.` });
      }, "Muudatusring tühistatud"); };
    const ra = document.getElementById("ring-accept");
    if (ra) ra.onclick = () => { const r = aktiivneRing(l); if (!r) return;
      lm(() => { r.staatus = "Allkirjastamisel";
        AUDIT.unshift({ aeg: NOW_EE(), autor: roleClient().kontakt + " (üürnik)", tegevus: `${l.id}: Lisa ${r.nr} muudatused kinnitatud → allkirjastamisele.` });
      }, `Muudatused kinnitatud · Lisa ${r.nr} liigub allkirjastamisse`); };
    const rg = document.getElementById("ring-sign");
    if (rg) rg.onclick = () => { const r = aktiivneRing(l); if (!r) return;
      lm(() => ringJousta(l, r), `Lisa ${r.nr} allkirjastatud ja jõustunud · leping uuenes`); };
    /* lõpetamisteade: teavitus + operaatori teadmiseks võtmine (võtmekuupäev kalendrisse) */
    const ls = document.getElementById("lop-send");
    if (ls) ls.onclick = () => {
      const d = document.getElementById("lop-date"); const iso = d ? d.value : "";
      if (!iso) { toast("Vali lõppkuupäev"); return; }
      const kp = isoToEE(iso);
      if (!confirm(`Esitad lepingu ülesütlemisteate — leping lõpeb ${kp}. Jätkan?`)) return;
      const pohjus = (document.getElementById("lop-reason") || {}).value || "";
      const poolt = isClient() ? "üürnik" : "operaator";
      const autor = isClient() ? roleClient().kontakt + " (üürnik)" : "Tarmo Sepp";
      lm(() => {
        l.lopetamine = { esitatud: TODAY_EE, poolt, pohjus: pohjus.trim(), loppKuupaev: kp, staatus: "Teavitatud" };
        AUDIT.unshift({ aeg: NOW_EE(), autor, tegevus: `${l.id}: ülesütlemisteade esitatud (üld p 12) — leping lõpeb ${kp}.` });
      }, "Lõpetamisteade esitatud · teine pool saab teate");
    };
    const la = document.getElementById("lop-ack");
    if (la) la.onclick = () => lm(() => {
      l.lopetamine.staatus = "Kinnitatud";
      const cl2 = DB.clientById(l.clientId);
      KEY_DATES.push({ kuupaev: eeToISO(l.lopetamine.loppKuupaev), tyyp: "Lepingu lõpp", margis: "amber",
        objekt: `${l.id} · ${cl2 ? cl2.nimi : ""}`, info: "Ülesütlemine (üld p 12) · pinna vabanemine planeerida" });
      AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: ülesütlemisteade teadmiseks võetud — lõppkuupäev ${l.lopetamine.loppKuupaev} kalendris.` });
    }, "Teade teadmiseks võetud · võtmekuupäev kalendris");
  }

  /* mustandis: tehingufaktid otse lausetes muudetavad — muutus kirjutab laused,
     lepingu kuupäevad ja tuletatud summad ise uueks (autosalvestus + audit) */
  if (l) document.querySelectorAll(".fact-in").forEach(el => {
    el.onkeydown = (ev) => { if (ev.key === "Enter") el.blur(); };
    el.onchange = () => {
      const k = el.dataset.f, f = ensureTehing(l);
      let v = el.value;
      if (el.type === "number") { v = parseFloat(v); if (!(v >= (k === "hind" ? 0.5 : 0))) { el.value = f[k]; return; } if (k === "parkimine") v = Math.round(v); }
      else if (el.tagName === "SELECT") v = +v;
      else if (el.type === "date") { if (!v) { el.value = f.algus; return; } }
      else { v = v.trim(); if (!v) { el.value = f[k] || ""; return; } }
      if (v === f[k]) return;
      f[k] = v;
      rebuildPohi(l);
      FACT_FLASH = { id: l.id, keys: [k, ...(FACT_DERIVED[k] || [])] };
      const disp = el.type === "date" ? isoToEE(v) : k === "hind" ? eur(v) + " €/m²"
        : k === "kuud" ? (v % 12 === 0 ? v / 12 + " a" : v + " kuud") : k === "tagatisKuud" ? v + " kuu üür" : v;
      AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: tehingufakt „${FACT_LABELS[k] || k}" → ${disp} — põhitingimuste laused uuenesid.` });
      DB.save(); toast(`Salvestatud · ${FACT_LABELS[k] || k} → ${disp}`); router();
    };
  });
  /* üürnik: oma esindaja andmete (P 6.2) muutmine — salvestub lepingu kontaktina
     (mitte kliendiregistrisse); P 1.2 ja P 6.2 laused kirjutavad end uueks */
  if (l) document.querySelectorAll(".rep-in").forEach(el => {
    el.onclick = (ev) => ev.stopPropagation();
    el.onkeydown = (ev) => { if (ev.key === "Enter") el.blur(); };
    el.onchange = () => {
      const cl2 = DB.clientById(l.clientId);
      const k = el.dataset.k, v = el.value.trim();
      const cur = l.kontakt || { nimi: cl2.kontakt, epost: cl2.epost, tel: cl2.tel || "" };
      if (k !== "tel" && !v) { el.value = cur[k] || ""; return; }
      if (k === "epost" && !/^\S+@\S+\.\S+$/.test(v)) { toast("Kontrollige e-posti aadressi"); el.value = cur.epost || ""; return; }
      if (v === (cur[k] || "")) return;
      l.kontakt = Object.assign({}, cur); l.kontakt[k] = v;
      ensureTehing(l); rebuildPohi(l);
      AUDIT.unshift({ aeg: NOW_EE(), autor: (roleClient().kontakt || "Üürnik") + " (üürnik)", tegevus: `${l.id}: üürniku esindaja andmed uuendatud (P 6.2).` });
      DB.save(); toast("Esindaja andmed uuendatud"); router();
    };
  });

  /* pärast fakti muutust: muutunud + tuletatud väärtuste sähvatus uues renderduses */
  if (l && FACT_FLASH && FACT_FLASH.id === l.id) {
    const ks = FACT_FLASH.keys; FACT_FLASH = null;
    document.querySelectorAll(".fact[data-f], .fact-in[data-f]").forEach(el => { if (ks.includes(el.dataset.f)) el.classList.add("flash"); });
  }

  /* üldtingimuste punkt → Lisa 3: tekst jääb lukku, ülekirjutav eritingimus sünnib punkti tekstist */
  if (l) document.querySelectorAll(".uld-send").forEach(b => b.onclick = (ev) => {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const ref = b.dataset.uref;
    let orig = null;
    (window.ULD_FULL || []).forEach(s => (s.punktid || []).forEach(p => { if (p.ref === ref) orig = p.tekst; }));
    if (orig == null) { const c = ULD_CLAUSES.find(x => x.ref === ref); if (c) orig = c.tekst; }
    const ky = String(ref).startsWith("§") ? `Üld · ${ref}` : `Üld · p ${ref}`;
    if ((l.eri || []).some(e => ((e.kirjutabYle || "").split(" (")[0]) === ky)) { toast(`Punktil ${ref} on juba eritingimus Lisa 3-s`); return; }
    l.eri.push({ ref: `Lisa 3 · p${l.eri.length + 1}`, tekst: orig || "", kirjutabYle: ky, staatus: "Ettepanek" });
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: üldtingimuste punkt ${ref} saadetud eritingimustesse ülekirjutamisele (Lisa 3, ülimuslik).` });
    DB.save(); toast(`Punkt ${ref} → Lisa 3 — sõnasta ülimuslik kokkulepe`); router();
  });

  /* Lisa 3 punktide sõnastus ja eemaldus mustandis (autosalvestus + renummerdus) */
  if (l) document.querySelectorAll(".leri-txt").forEach(t => t.onchange = () => {
    const e = l.eri[+t.dataset.i]; if (!e) return;
    const v = t.value.trim();
    if (!v) { t.value = e.tekst; return; }
    e.tekst = v;
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: eritingimuse ${e.ref} sõnastus muudetud mustandis.` });
    DB.save();
  });
  if (l) document.querySelectorAll(".leri-rm").forEach(b => b.onclick = () => {
    const e = l.eri[+b.dataset.i]; if (!e) return;
    if (!confirm("Eemalda eritingimus Lisa 3-st? Seda ei saa tagasi võtta.")) return;
    l.eri.splice(+b.dataset.i, 1);
    l.eri.forEach((x, i) => x.ref = `Lisa 3 · p${i + 1}`);
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: eritingimus eemaldatud (Lisa 3 renummerdatud).` });
    DB.save(); toast("Eritingimus eemaldatud"); router();
  });

  /* sõnastamisel eritingimus: AI pakub juriidilise sõnastuse (ettepanek + arutelu),
     operaator kinnitab — alles kinnitus teeb punkti üürnikule nähtavaks */
  if (l) document.querySelectorAll(".eri-ai").forEach(b => b.onclick = () => {
    const e = l.eri[+b.dataset.i]; if (!e) return;
    b.disabled = true;
    b.innerHTML = `<span class="thinking"><span class="d"></span><span class="d"></span><span class="d"></span></span> Sõnastan…`;
    setTimeout(() => {
      e.tekst = aiSonasta(e);
      AUDIT.unshift({ aeg: NOW_EE(), autor: "ThinkOne AI", tegevus: `${l.id}: AI pakkus eritingimuse ${e.ref} sõnastuse (ettepaneku ja arutelu põhjal) — ootab operaatori kinnitust.` });
      DB.save(); toast("AI sõnastus valmis — vaata üle ja kinnita"); router();
    }, 900);
  });
  if (l) document.querySelectorAll(".eri-ok").forEach(b => b.onclick = () => {
    const e = l.eri[+b.dataset.i]; if (!e) return;
    const t = document.querySelector(`.leri-txt[data-i="${b.dataset.i}"]`);
    const v = (t ? t.value : e.tekst).trim();
    if (!v) { toast("Sõnastus on tühi — kirjuta või kasuta AI-d"); return; }
    e.tekst = v; e.sonastamisel = false; e.staatus = "Aktsepteeritud";
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: eritingimuse ${e.ref} sõnastus kinnitatud — nähtav mõlemale poolele.` });
    DB.save(); toast("Sõnastus kinnitatud — eritingimus on nüüd üürnikule nähtav"); router();
  });

  /* indekseerimise valikukaart eemaldatud — indekseerimist muudetakse lepingupunkti
     läbirääkimisega (üld p 5.2 kommentaar → Lisa 3 ülekirjutus), mitte eraldi halduriga */

  const lac = document.getElementById("lease-as-client");
  if (lac && l) lac.onclick = () => setRole("client", l.clientId, "#/leping/" + l.id);

  /* saatmisnupp on kahes kohas (dokumendi päis + kleepuv külgkaart) — sama tegevus */
  if (l) document.querySelectorAll(".send-draft").forEach(sd => sd.onclick = () => {
    if (l.staatus === "Mustand V1") { l.staatus = "Saadetud"; }
    else { const v = +((l.versioon||"Mustand V1").match(/\d+/)||[1])[0]; l.versioon = "Mustand V" + (v+1); }
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id} ${l.versioon||"mustand"} saadetud üürnikule.` });
    DB.save(); toast("Mustand saadetud üürnikule · teavitus saadetud"); router();
  });

  const accAll = document.getElementById("cl-accept-all");
  if (accAll && l) accAll.onclick = () => {
    l.staatus = "Allkirjastamisel";
    AUDIT.unshift({ aeg: NOW_EE(), autor: roleClient().kontakt + " (üürnik)", tegevus: `${l.id}: kõik punktid aktsepteeritud → allkirjastamisele.` });
    DB.save(); toast("Kõik punktid aktsepteeritud · leping liigub allkirjastamisse"); router();
  };

  const sign = document.getElementById("do-sign");
  if (sign) sign.onclick = doSign;
  document.querySelectorAll(".m-btn").forEach(b => b.onclick = () => { document.querySelectorAll(".m-btn").forEach(x=>x.classList.remove("sel")); b.classList.add("sel"); });
  dpGlide();
};

let CURRENT_LEASE = null;
let REOPEN_CLAUSE = null; /* pärast lõimes vastamist/otsust avatakse sama punkt uuesti */
/* punkti kommentaarid avanevad KOHE punkti alla (sama muster kui portfelli kaardi eelvaade) */
function openClause(el, ref) {
  const l = CURRENT_LEASE; if (!l) return;
  const host = el.closest(".clause") || el.closest(".uld-p") || el;
  const existing = document.querySelector(".clause-expand");
  const wasOpen = existing && existing.dataset.for === String(ref);
  if (existing) existing.remove();
  document.querySelectorAll(".clause.open, .uld-p.open").forEach(x => x.classList.remove("open"));
  if (wasOpen) return;

  const all = (l.kommentaarid||[]).filter(c => c.clauseRef === ref);
  /* kehtival lepingul algab iga muudatus PUHTALT LEHELT: elavas lõimes on ainult
     lahtised kommentaarid; sõlmimisaegne (ja varasemate ringide) lahendatud ajalugu
     voldib „Läbirääkimiste ajalugu" alla */
  const kehtivDoc = l.staatus === "Kehtiv";
  const hist = kehtivDoc ? all.filter(c => !cmtOpen(c)) : [];
  const cmts = kehtivDoc ? all.filter(cmtOpen) : all;
  /* otsustatakse VIIMASE lahtise kommentaari üle — varasem lahendatud ei tohi voogu lukustada */
  const pending = cmts.filter(cmtOpen);
  const cmt = pending[pending.length - 1] || cmts[cmts.length - 1];
  const exp = document.createElement("div");
  exp.className = "clause-expand"; exp.dataset.for = String(ref);
  /* lõim: punkt → üürniku ettepanek → ARUTELU (vastused mõlemalt poolelt) → lõplik otsus.
     Vastamine ei otsusta — otsustab ainult Aktsepteeri/Lükka tagasi. */
  /* oma sõnumi tööriistad (muuda/kustuta ikoonidena) — kuni punkt on Ootel;
     algset kommentaari saab kustutada ainult enne, kui keegi on vastanud */
  const thTools = (ci, mi, edit, del) => (edit || del) ? `<span class="th-tools">
      ${edit ? `<button data-cedit="${ci}:${mi}" title="Muuda">${I.edit}</button>` : ""}
      ${del ? `<button class="del" data-cdel="${ci}:${mi}" title="Kustuta">${I.trash}</button>` : ""}</span>` : "";
  const thCard = (c) => { const aru = c.arutelu || [];
    const ci = (l.kommentaarid || []).indexOf(c);
    const openC = c.staatus === "Ootel";
    const mineC = thTenant(null, c.autor) === isClient();
    return `
    <div class="cmt th-card ${thSkin(null, c.autor)}">
      ${thHead(null, c.autor, c.aeg)}
      ${thTools(ci, -1, openC && mineC, openC && mineC && !aru.length)}
      <div class="body">${c.tekst}</div>
      ${c.staatus === "Ootel" && !aru.length ? `<div style="margin-top:8px">${pill(c.staatus)}</div>` : ""}
    </div>
    ${aru.map((m, mi) => `<div class="cmt th-card th-step ${thSkin(m.roll, m.autor)}">
      ${thHead(m.roll, m.autor, m.aeg)}
      ${thTools(ci, mi, openC && (m.roll === "klient") === isClient(), openC && (m.roll === "klient") === isClient())}
      <div class="body">${m.tekst}</div>
      ${c.staatus === "Ootel" && !c.vastus && mi === aru.length - 1 ? `<div style="margin-top:8px">${pill("Arutelul")}</div>` : ""}
    </div>`).join("")}
    ${c.vastus ? `<div class="cmt th-card th-step th-lessor th-dec ${c.staatus === "Aktsepteeritud" ? "ok" : c.staatus === "Selgitatud" ? "info" : "no"}">
      ${thHead("operaator", "Tarmo Sepp", c.otsusAeg || c.aeg)}
      <div class="body">${c.vastus}</div>
      <div class="th-verdict"><span class="th-stamp ${c.staatus === "Aktsepteeritud" ? "ok" : c.staatus === "Selgitatud" ? "info" : "no"}">${cmtPill(c.staatus)}</span></div>
    </div>` : ""}
    ${c.ettepanek && c.staatus === "Ootab kinnitust" ? (ep => `<div class="cmt th-card th-step th-lessor th-dec wait">
      ${thHead("operaator", "Tarmo Sepp", ep.aeg)}
      <div class="overline" style="margin:2px 0 8px">${ep.tyyp === "selgitus" ? "Selgitus — muudatust ei tehta"
        : "Uue sõnastuse ettepanek · " + (ep.siht === "otse" ? "põhitingimus muudetakse otse"
        : ep.siht === "eri" ? "Lisa 3 punkti sõnastus muudetakse"
        : ep.siht === "lisa3" ? "vormistatakse Lisa 3 eritingimusena (ülimuslik)"
        : `vormistatakse Lisa ${ep.lisaNr} kokkuleppes — jõustub allkirjastamisel`)}</div>
      <div class="body">${ep.kuva || ep.tekst}</div>
      ${ep.markus ? `<div class="muted" style="font-size:14px;margin-top:8px">${ep.markus}</div>` : ""}
      ${isClient() && c === cmt && l.staatus !== "Allkirjastamisel" ? `
      <!-- üürniku otsus elab OTSE sõnastuse juures — sisendväli avaneb alles soovil -->
      <div class="wrap-actions" style="margin-top:12px">
        <button class="btn btn-primary btn-sm" id="conf-prop">${ep.tyyp === "selgitus" ? "Kinnitan — küsimus sai vastuse" : "Kinnitan uue sõnastuse"}<span class="bic">${I.check}</span></button>
        <button class="btn btn-ghost btn-sm" id="prop-reply-t">Ei sobi — vastan arutellu</button>
      </div>
      <div id="prop-reply-area" style="display:none;margin-top:8px">
        <textarea id="new-cmt" rows="2" class="ce-in" placeholder="Miks sõnastus ei sobi — punkt läheb tagasi üürileandjale…"></textarea>
        <div class="wrap-actions" style="margin-top:8px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" id="send-cmt">Vasta<span class="bic">${I.enter}</span></button></div>
      </div>` : `<div class="th-verdict"><span class="th-stamp wait">Ootab kinnitust</span></div>`}
    </div>`)(c.ettepanek) : ""}
    `; };
  exp.innerHTML = `
    ${hist.length ? `<details class="cmt-hist"><summary><span class="chev">${I.arrow}</span>Läbirääkimiste ajalugu · ${hist.length} lahendatud</summary><div class="thread">${hist.map(thCard).join("")}</div></details>` : ""}
    ${cmts.length ? `<div class="thread">${cmts.map(thCard).join("")}</div>`
      : hist.length ? "" : `<div class="muted" style="font-size:14px;margin:12px 0 4px">Sellel punktil pole veel kommentaare.</div>`}
    <div class="ce-foot"></div>`;
  /* laiendus avaneb PUNKTI SEES (body-veerus), mitte punkti alumise joone all;
     klõpsud lõime sees ei tohi mullina punktini jõuda (sulgeks laienduse) */
  exp.onclick = (ev) => ev.stopPropagation();
  (host.querySelector(".body") || host.children[1] || host).appendChild(exp);
  host.classList.add("open");

  const foot = exp.querySelector(".ce-foot");
  /* jump=true → pärast otsust hüppab vaade JÄRGMISE sinu tegevust vajava punkti
     juurde (kui on); muidu avatakse sama punkt uuesti */
  const mutate = (msg, jump) => { REOPEN_CLAUSE = (jump && nextOpenRef(l)) || ref; DB.save(); toast(msg); router(); };
  const openThread = cmt && cmt.staatus === "Ootel";

  /* oma sõnumi muutmine kohapeal + kustutamine (ikoonid kaardi hoveril) */
  exp.querySelectorAll("[data-cedit]").forEach(b => b.onclick = (ev) => {
    ev.stopPropagation();
    const [ci9, mi9] = b.dataset.cedit.split(":").map(Number);
    const c9 = (l.kommentaarid || [])[ci9]; if (!c9) return;
    const tgt = mi9 >= 0 ? (c9.arutelu || [])[mi9] : c9;
    const card = b.closest(".th-card"), body = card && card.querySelector(".body");
    if (!tgt || !body || body.querySelector(".cedit-in")) return;
    body.innerHTML = `<textarea class="ce-in cedit-in" rows="3">${String(tgt.tekst).replace(/</g, "&lt;")}</textarea>
      <div class="wrap-actions" style="margin-top:8px;justify-content:flex-end">
        <button class="btn btn-ghost btn-sm cedit-cancel">Loobu</button>
        <button class="btn btn-primary btn-sm cedit-save">Salvesta<span class="bic">${I.check}</span></button>
      </div>`;
    const ta = body.querySelector(".cedit-in"); ta.focus();
    body.querySelector(".cedit-cancel").onclick = (e2) => { e2.stopPropagation(); REOPEN_CLAUSE = ref; router(); };
    body.querySelector(".cedit-save").onclick = (e2) => {
      e2.stopPropagation();
      const v = ta.value.trim();
      if (!v) { toast("Tekst ei saa olla tühi"); ta.focus(); return; }
      tgt.tekst = v;
      AUDIT.unshift({ aeg: NOW_EE(), autor: isClient() ? roleClient().kontakt + " (üürnik)" : "Tarmo Sepp", tegevus: `${l.id}: sõnum punkti „${ref}" arutelus muudetud.` });
      mutate("Sõnum muudetud");
    };
  });
  exp.querySelectorAll("[data-cdel]").forEach(b => b.onclick = (ev) => {
    ev.stopPropagation();
    const [ci9, mi9] = b.dataset.cdel.split(":").map(Number);
    const c9 = (l.kommentaarid || [])[ci9]; if (!c9) return;
    if (mi9 >= 0) { if (c9.arutelu) c9.arutelu.splice(mi9, 1); }
    else l.kommentaarid.splice(ci9, 1);
    AUDIT.unshift({ aeg: NOW_EE(), autor: isClient() ? roleClient().kontakt + " (üürnik)" : "Tarmo Sepp", tegevus: `${l.id}: sõnum punkti „${ref}" arutelus kustutatud.` });
    REOPEN_CLAUSE = ref; DB.save(); toast("Sõnum kustutatud"); router();
  });

  if (isClient() && l.staatus !== "Allkirjastamisel") {
    if (cmt && cmt.staatus === "Ootab kinnitust" && cmt.ettepanek) {
      /* operaatori ettepanek ootab ÜÜRNIKU kinnitust — otsusenupud elavad
         ettepanekukaardil lõimes; jalusesse ei renderdu midagi */
      const ep = cmt.ettepanek;
      const who = roleClient().kontakt + " (üürnik)";
      foot.remove();
      exp.querySelector("#prop-reply-t").onclick = () => {
        const ar = exp.querySelector("#prop-reply-area");
        ar.style.display = ar.style.display === "none" ? "block" : "none";
        if (ar.style.display !== "none") { const t = ar.querySelector("#new-cmt"); if (t) t.focus(); }
      };
      exp.querySelector("#conf-prop").onclick = () => {
        cmt.otsusAeg = NOW_EE();
        if (ep.tyyp === "selgitus") {
          cmt.staatus = "Selgitatud";
          cmt.vastus = `Selgitatud — ${ep.tekst}`;
          AUDIT.unshift({ aeg: NOW_EE(), autor: who, tegevus: `${l.id}: üürnik kinnitas selgituse punktile „${ref}" — muudatust ei tehta.` });
          mutate("Selgitus kinnitatud · punkt suletud", true);
          return;
        }
        if (ep.siht === "ring") {
          /* kehtiv leping: kinnitatud sõnastus koguneb muudatusringi, jõustub allkirjastamisel */
          const ring = ensureRing(l, "operaator");
          if (ep.fKey) {
            ring.faktid = ring.faktid.filter(x => x.key !== ep.fKey);
            ring.faktid.push({ key: ep.fKey, label: FACT_LABELS[ep.fKey], vana: ep.vana, uus: ep.val, vanaTxt: ep.vanaTxt, uusTxt: ep.uusTxt });
          } else ring.punktid.push({ tekst: ep.tekst, algne: ep.algne || cmt.tekst, kirjutabYle: ep.kyRef });
          cmt.staatus = "Aktsepteeritud";
          cmt.vastus = `Kinnitatud — kokkulepe vormistatakse Lisa ${ring.nr} eritingimusena (ülimuslik), jõustub allkirjastamisel.`;
          AUDIT.unshift({ aeg: NOW_EE(), autor: who, tegevus: `${l.id}: üürnik kinnitas sõnastuse punktile „${ref}" → Lisa ${ring.nr}.` });
          mutate(`Kinnitatud → Lisa ${ring.nr} · jõustub allkirjastamisel`, true);
          return;
        }
        if (ep.siht === "otse" && ep.fKey) {
          const f = ensureTehing(l);
          f[ep.fKey] = ep.val; rebuildPohi(l);
          const row = l.pohi.find(x => x.ref === ref); if (row) { row.muudetud = true; row.otse = true; }
          cmt.staatus = "Aktsepteeritud";
          cmt.vastus = `Kinnitatud — punkt muudetud otse: ${FACT_LABELS[ep.fKey]} → ${ep.uusTxt}.`;
        } else if (ep.siht === "eri") {
          const er = l.eri.find(x => x.ref === ref);
          if (er) { er.tekst = ep.tekst; er.muudetud = true; }
          cmt.staatus = "Aktsepteeritud";
          cmt.vastus = "Kinnitatud — punkti sõnastus muudetud.";
        } else {
          l.eri.push({ ref: "Lisa 3 · p" + (l.eri.length + 1), tekst: ep.tekst, algne: cmt.tekst,
            kirjutabYle: ep.kyRef, staatus: "Aktsepteeritud", sonastamisel: false });
          const pohiRow = l.pohi.find(x => x.ref === ref); if (pohiRow) pohiRow.muudetud = true;
          cmt.staatus = "Aktsepteeritud";
          cmt.vastus = `Kinnitatud — vormistatud Lisa 3 eritingimusena (ülimuslik, kirjutab üle: ${ep.kyRef}).`;
        }
        AUDIT.unshift({ aeg: NOW_EE(), autor: who, tegevus: `${l.id}: üürnik kinnitas uue sõnastuse punktile „${ref}".` });
        mutate("Uus sõnastus kinnitatud · punkt lahendatud", true);
      };
      exp.querySelector("#send-cmt").onclick = () => {
        const txt = exp.querySelector("#new-cmt").value.trim(); if (!txt) return;
        /* vastus kinnituse asemel: ettepanek jääb ajalukku arutelu sissekandena, punkt läheb tagasi Ootele */
        cmt.arutelu = cmt.arutelu || [];
        cmt.arutelu.push({ roll: "operaator", autor: "Tarmo Sepp", aeg: ep.aeg, tekst: `${ep.tyyp === "selgitus" ? "Selgitus" : "Sõnastusettepanek"} (ei kinnitatud): ${ep.kuva || ep.tekst}` });
        cmt.arutelu.push({ roll: "klient", autor: who, aeg: NOW_EE(), tekst: txt });
        cmt.ettepanek = null; cmt.staatus = "Ootel";
        AUDIT.unshift({ aeg: NOW_EE(), autor: who, tegevus: `${l.id}: üürnik vastas ettepanekule punktil „${ref}" — läbirääkimine jätkub.` });
        mutate("Vastus saadetud · punkt läks tagasi üürileandjale", true);
      };
    } else if (openThread && cmtOotabOp(cmt)) {
      /* pall on üürileandja käes — üürnik ei kirjuta juurde (muidu koguneks ühepoolne
         monoloog, millele keegi ei vasta): sisendi asemel vaikne teade */
      foot.innerHTML = `<div class="th-wait">${I.hourglass}
        <div><b>Ootab üürileandja vastust</b> — saad teate, kui ta vastab.</div></div>`;
    } else if (openThread) {
      /* üürileandja küsis arutelus viimasena — kord on üürnikul; vastus läheb SAMASSE
         arutellu, mitte paralleelkommentaariks */
      foot.innerHTML = `<textarea id="new-cmt" rows="2" class="ce-in" placeholder="Teie vastus arutellu…"></textarea>
        <div class="wrap-actions" style="margin-top:8px;justify-content:flex-end"><button class="btn btn-primary btn-sm" id="send-cmt">Vasta<span class="bic">${I.enter}</span></button></div>`;
      foot.querySelector("#send-cmt").onclick = () => {
        const txt = foot.querySelector("#new-cmt").value.trim(); if (!txt) return;
        cmt.arutelu = cmt.arutelu || [];
        cmt.arutelu.push({ roll: "klient", autor: roleClient().kontakt + " (üürnik)", aeg: NOW_EE(), tekst: txt });
        AUDIT.unshift({ aeg: NOW_EE(), autor: roleClient().kontakt + " (üürnik)", tegevus: `Vastus arutellu: ${l.id} punkt „${ref}".` });
        mutate("Vastus saadetud · operaatorit teavitatud");
      };
    } else if (cmts.length && !pending.length && l.staatus !== "Kehtiv") {
      /* punkt on lahendatud — LUKUS (kinnitatud/tagasi lükatud). ERAND: selgitusega
         suletud punkti saab üürnik vastates TAAS AVADA (sulgemine oli operaatori
         ühepoolne akt — kui vastus ei ammendanud, jätkub arutelu). */
      const finCta = l.staatus === "Saadetud" && !(l.kommentaarid || []).some(cmtOpen) ? `<div class="fin-cta">
          <b>${I.check} Kõik punktid on kokku lepitud</b>
          <button class="btn btn-primary btn-sm" id="acc-inline">Aktsepteeri leping — liigu allkirjastamisele<span class="bic">${I.arrow}</span></button></div>` : "";
      const reopen = cmt && cmt.staatus === "Selgitatud" && l.staatus === "Saadetud" ? `
        <div style="margin-top:${finCta ? 12 : 4}px">
          <textarea id="reopen-cmt" rows="2" class="ce-in" placeholder="Kui vastus ei ammenda — vastake ja punkt avaneb uuesti…"></textarea>
          <div class="wrap-actions" style="margin-top:8px;justify-content:flex-end"><button class="btn btn-ghost btn-sm" id="reopen-send">Vasta — ava punkt uuesti<span class="bic">${I.enter}</span></button></div>
        </div>` : "";
      if (finCta || reopen) {
        foot.innerHTML = finCta + reopen;
        const acc = foot.querySelector("#acc-inline");
        if (acc) acc.onclick = () => { const b = document.getElementById("cl-accept-all"); if (b) b.click(); };
        const ro = foot.querySelector("#reopen-send");
        if (ro) ro.onclick = () => {
          const txt = foot.querySelector("#reopen-cmt").value.trim();
          if (!txt) { toast("Kirjuta, mis jäi vastusest puudu"); return; }
          /* vana selgitus kolib arutellu tavalise operaatori sõnumina — ajalugu säilib */
          cmt.arutelu = cmt.arutelu || [];
          if (cmt.vastus) cmt.arutelu.push({ roll: "operaator", autor: "Tarmo Sepp", aeg: cmt.otsusAeg || cmt.aeg, tekst: String(cmt.vastus).replace(/^Selgitatud — /, "") });
          cmt.arutelu.push({ roll: "klient", autor: roleClient().kontakt + " (üürnik)", aeg: NOW_EE(), tekst: txt });
          cmt.vastus = null; cmt.otsusAeg = null; cmt.staatus = "Ootel";
          AUDIT.unshift({ aeg: NOW_EE(), autor: roleClient().kontakt + " (üürnik)", tegevus: `${l.id}: üürnik avas selgitusega suletud punkti „${ref}" uuesti — arutelu jätkub.` });
          mutate("Punkt avatud uuesti · operaatorit teavitatud");
        };
      } else foot.remove();
    } else {
      /* uus kommentaar/ettepanek punkti juurde; kehtival lepingul = muudatusettepanek */
      foot.innerHTML = `<textarea id="new-cmt" rows="3" class="ce-in" placeholder="${l.staatus === "Kehtiv" ? "Teie muudatusettepanek või küsimus kehtiva lepingu punkti kohta — kokkulepe vormistatakse uue lisana…" : "Teie kommentaar või muudatusettepanek selle punkti kohta…"}"></textarea>
        <div class="wrap-actions" style="margin-top:8px;justify-content:flex-end"><button class="btn btn-primary btn-sm" id="send-cmt">Saada<span class="bic">${I.enter}</span></button></div>`;
      foot.querySelector("#send-cmt").onclick = () => {
        const txt = foot.querySelector("#new-cmt").value.trim(); if (!txt) return;
        l.kommentaarid = l.kommentaarid || [];
        l.kommentaarid.push({ clauseRef: ref, autor: roleClient().kontakt + " (üürnik)", aeg: NOW_EE(), tekst: txt, staatus: "Ootel", vastus: null });
        AUDIT.unshift({ aeg: NOW_EE(), autor: roleClient().kontakt + " (üürnik)", tegevus: `Kommentaar lisatud ${l.id} punktile „${ref}".` });
        mutate("Kommentaar saadetud · operaatorit teavitatud");
      };
    }
    if (!(cmt && cmt.staatus === "Ootab kinnitust")) { const ta = foot.querySelector("#new-cmt"); if (ta) ta.focus(); }
  } else if (!isClient() && openThread) {
    /* ÜKS sisenemiskoht: „Lahenda" avab kommentaari all minipaneeli kolme teekonnaga
       (vasta / muuda punkti / sõnasta eritingimus). Sõnastusettepanekud lähevad
       üürnikule kinnitamiseks — midagi ei rakendu enne kinnitust. */
    const fKey = FACT_OF_REF[ref];
    const eriRow = l.eri.find(x => x.ref === ref);
    /* kehtival lepingul EI muudeta midagi otse — kokkulepe vormistatakse
       järgmise lisana (Lisa N) ja jõustub allkirjastamisel */
    const kehtiv = l.staatus === "Kehtiv";
    const ringNr = kehtiv ? (aktiivneRing(l) || { nr: nextLisaNr(l) }).nr : null;
    const kyRef = eriRow ? ref : (/^\d/.test(String(ref)) ? `Üld · p ${ref}` : ref);
    const canMuuda = (fKey || eriRow) && !kehtiv;
    const eriLbl = kehtiv ? `Lisa ${ringNr} (muudatus)` : "Lisa 3";
    /* valikurida: ikoon + pealkiri; selgitus elab info-ikooni tooltipi taga (sama
       muster kui indekseerimise kaardil) — kolm valikut on ühe pilguga skaneeritavad */
    const resOpt = (o, ic, t, tip) => `<button class="res-opt" data-o="${o}">
            <span class="ro-ic">${ic}</span><span class="ro-t">${t}</span>
            <span class="tip" data-tip="${tip}">${I.info}</span></button>`;
    foot.innerHTML = `
      <div class="wrap-actions" style="margin-top:4px"><button class="btn btn-primary btn-sm" id="res-open">Lahenda<span class="bic">${I.chevD}</span></button></div>
      <div class="res-panel" id="res-panel" style="display:none">
        <div class="res-opts">
          ${resOpt("vasta", I.chat, "Vasta kommentaarile",
            "Vastus läheb arutellu; linnukesega sulged punkti selle vastusega (Selgitatud — üürnik saab vastates taas avada). Tagasilükkamine sulgeb põhjendusega.")}
          ${canMuuda ? resOpt("muuda", I.edit, "Muuda lepingupunkti", eriRow
            ? "Muudab olemasoleva Lisa 3 punkti sõnastust — uut punkti ei teki. Jõustub pärast üürniku kinnitust."
            : "Kirjutab põhitingimuse fakti ümber — laused, summad ja tähtajad arvutuvad üle. Jõustub pärast üürniku kinnitust.") : ""}
          ${resOpt("eri", I.spark, "Sõnasta eritingimus",
            `Loob ülimusliku punkti (${eriLbl}), mis kirjutab senise tingimuse üle. AI teeb eeltäite üürniku ettepaneku põhjal; jõustub pärast üürniku kinnitust.`)}
        </div>
        <div id="res-form"></div>
      </div>`;
    const panel = foot.querySelector("#res-panel");
    const form = foot.querySelector("#res-form");
    const resOpen = foot.querySelector("#res-open");
    resOpen.onclick = () => {
      const open = panel.style.display === "none";
      panel.style.display = open ? "block" : "none";
      resOpen.classList.toggle("open", open); /* kivis olev nool pöördub */
    };
    const sendProp = (ep) => {
      if (kehtiv) ep.lisaNr = ringNr;
      ep.aeg = NOW_EE();
      cmt.ettepanek = ep; cmt.staatus = "Ootab kinnitust";
      AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: ${ep.tyyp === "selgitus" ? "selgitus" : "uue sõnastuse ettepanek"} punktile „${ref}" saadetud üürnikule kinnitamiseks.` });
      mutate(ep.tyyp === "selgitus" ? "Selgitus saadetud · üürnik kinnitab punkti juures" : "Ettepanek saadetud · üürnik kinnitab punkti juures", true);
    };
    const FORMS = {
      vasta: () => `
        <textarea id="res-txt" rows="3" class="ce-in" placeholder="Vastus üürnikule…"></textarea>
        <label class="res-close"><input type="checkbox" id="res-close-chk">sulge punkt selle vastusega <small>· muudatust ei tehta; üürnik saab vastates taas avada</small></label>
        <div class="wrap-actions" style="margin-top:8px">
          <button class="btn btn-primary btn-sm" id="res-aru">Vasta<span class="bic">${I.enter}</span></button>
          <!-- tagasilükkamine (lõplik) seisab lahus paremal -->
          <button class="btn btn-ghost btn-sm" id="res-rej" style="margin-left:auto">Lükka tagasi</button>
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px">Ilma linnukeseta jääb punkt aruteluna lahtiseks; linnukesega sulgub Selgitatuna. Tagasilükkamine sulgeb punkti põhjendusega.</div>`,
      muuda: () => fKey ? `
        <div class="overline" style="margin-bottom:8px">${FACT_LABELS[fKey] || fKey}</div>
        <div class="flex" style="gap:8px;flex-wrap:wrap;align-items:center">${faktiSisend(fKey, ensureTehing(l))}</div>
        <div class="wrap-actions" style="margin-top:12px"><button class="btn btn-primary btn-sm" id="res-send-muuda">Saada üürnikule kinnitamiseks<span class="bic">${I.arrow}</span></button></div>
        <div class="muted" style="font-size:12px;margin-top:8px">Põhitingimus kirjutatakse ümber pärast üürniku kinnitust — laused, summad ja tähtajad arvutuvad üle.</div>` : `
        <div class="overline" style="margin-bottom:8px">${ref} · uus sõnastus</div>
        <textarea id="res-txt" rows="4" class="ce-in">${eriRow ? eriRow.tekst : ""}</textarea>
        <div class="wrap-actions" style="margin-top:12px"><button class="btn btn-primary btn-sm" id="res-send-muuda">Saada üürnikule kinnitamiseks<span class="bic">${I.arrow}</span></button></div>
        <div class="muted" style="font-size:12px;margin-top:8px">Lisa 3 punkti sõnastus muudetakse pärast üürniku kinnitust — uut punkti ei teki.</div>`,
      eri: () => `
        <div class="overline" style="margin-bottom:8px">Eritingimus → ${eriLbl} · ülimuslik</div>
        <textarea id="res-txt" rows="4" class="ce-in">${aiSonasta({ algne: cmt.tekst, kirjutabYle: kyRef })}</textarea>
        <div class="wrap-actions" style="margin-top:12px">
          <button class="btn btn-primary btn-sm" id="res-send-eri">Saada üürnikule kinnitamiseks<span class="bic">${I.arrow}</span></button>
          <button class="btn btn-ghost btn-sm" id="res-ai">${I.spark} Sõnasta AI-ga</button>
        </div>
        <div class="muted" style="font-size:12px;margin-top:8px">AI eeltäitis sõnastuse üürniku ettepaneku põhjal — muutke vajadusel.${kehtiv ? ` Kokkulepe vormistatakse Lisa ${ringNr} eritingimusena — jõustub allkirjastamisel.` : ""}</div>`,
    };
    panel.querySelectorAll(".res-opt").forEach(b => b.onclick = () => {
      panel.querySelectorAll(".res-opt").forEach(x => x.classList.toggle("sel", x === b));
      form.innerHTML = FORMS[b.dataset.o]();
      const need = (msg) => { const tt = form.querySelector("#res-txt"); const v = tt ? tt.value.trim() : "";
        if (!v) { toast(msg || "Kirjuta tekst"); if (tt) tt.focus(); } return v; };
      const t0 = form.querySelector("#res-txt"); if (t0) t0.focus();
      const aru = form.querySelector("#res-aru");
      if (aru) aru.onclick = () => {
        const v = need("Kirjuta vastus"); if (!v) return;
        const chk = form.querySelector("#res-close-chk");
        if (chk && chk.checked) {
          /* SULGEV vastus: punkt sulgub KOHE Selgitatuna — kinnitusringi pole;
             kui vastus ei ammenda, avab üürnik punkti vastates uuesti */
          cmt.staatus = "Selgitatud"; cmt.otsusAeg = NOW_EE();
          cmt.vastus = `Selgitatud — ${v}`;
          AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: punkt „${ref}" suletud selgitusega — muudatust ei tehta.` });
          mutate("Punkt suletud selgitusega · üürnik saab vajadusel taas avada", true);
          return;
        }
        cmt.arutelu = cmt.arutelu || [];
        cmt.arutelu.push({ roll: "operaator", autor: "Tarmo Sepp", aeg: NOW_EE(), tekst: v });
        AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Vastus arutellu: ${l.id} punkt „${ref}" (otsus veel tegemata).` });
        mutate("Vastus saadetud · punkt jääb lahtiseks");
      };
      const rej = form.querySelector("#res-rej");
      if (rej) rej.onclick = () => {
        /* tagasilükkamine ilma põhjenduseta jätaks üürniku pimedusse — põhjendus on kohustuslik */
        const v = need("Lisa põhjendus — üürnik näeb seda punkti juures"); if (!v) return;
        cmt.staatus = "Tagasi lükatud"; cmt.otsusAeg = NOW_EE();
        cmt.vastus = `Ei aktsepteeritud — ${v}`;
        AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: ettepanek punktile „${ref}" tagasi lükatud (põhjendusega).` });
        mutate("Ettepanek tagasi lükatud · üürnik näeb põhjendust punkti juures", true);
      };
      const sm = form.querySelector("#res-send-muuda");
      if (sm) sm.onclick = () => {
        if (fKey) {
          const val = faktiVal(fKey, form.querySelector("#fact-edit-in"));
          if (val === undefined) { toast("Kontrolli väärtust"); return; }
          const f2 = ensureTehing(l);
          sendProp({ tyyp: "sonastus", siht: "otse", fKey, val, vana: f2[fKey],
            vanaTxt: faktTxt(fKey, f2[fKey]), uusTxt: faktTxt(fKey, val),
            kuva: `${FACT_LABELS[fKey]}: ${faktTxt(fKey, f2[fKey])} → <b>${faktTxt(fKey, val)}</b>`, kyRef });
        } else {
          const v = need("Sõnasta punkt"); if (!v) return;
          sendProp({ tyyp: "sonastus", siht: "eri", tekst: v, algne: eriRow.tekst, kyRef });
        }
      };
      const se = form.querySelector("#res-send-eri");
      if (se) se.onclick = () => {
        const v = need("Sõnasta punkt"); if (!v) return;
        sendProp({ tyyp: "sonastus", siht: kehtiv ? "ring" : "lisa3", tekst: v, algne: cmt.tekst, kyRef });
      };
      const aiB = form.querySelector("#res-ai");
      if (aiB) aiB.onclick = () => { const tt = form.querySelector("#res-txt"); if (tt) tt.value = aiSonasta({ algne: cmt.tekst, tekst: tt.value, kirjutabYle: kyRef }); };
    });
  } else if (!isClient() && l.staatus === "Kehtiv" && !(cmt && cmt.staatus === "Ootab kinnitust")) {
    /* kehtival lepingul avab punkti klõps operaatorile muudatustööriista —
       kokkulepe koguneb ringi ja vormistatakse järgmise lisana (Lisa N) */
    const fKey = FACT_OF_REF[ref];
    const eriRow = l.eri.find(x => x.ref === ref);
    const nr = (aktiivneRing(l) || { nr: nextLisaNr(l) }).nr;
    const f = fKey ? ensureTehing(l) : null;
    foot.innerHTML = `
      <div class="overline" style="margin:12px 0 8px">Muudatus → Lisa ${nr}</div>
      ${fKey ? `<div class="flex" style="gap:8px;flex-wrap:wrap;align-items:center">${faktiSisend(fKey, f)}</div>` : `
      <textarea id="ring-txt" rows="3" class="ce-in" placeholder="${eriRow ? "Punkti uus sõnastus…" : `Uus kokkulepe selle punkti kohta — vormistatakse Lisa ${nr} punktina (ülimuslik)…`}">${eriRow ? eriRow.tekst : ""}</textarea>`}
      <div class="wrap-actions" style="margin-top:8px"><button class="btn btn-primary btn-sm" id="ring-add">${I.plus} Lisa muudatusringi</button></div>
      <div class="muted" style="font-size:12px;margin-top:8px">Muudatused kogunevad Lisa ${nr} kokkuleppesse — jõustuvad pärast üürniku kinnitust ja allkirjastamist. Leping ise seni ei muutu.</div>`;
    foot.querySelector("#ring-add").onclick = () => {
      if (fKey) {
        const val = faktiVal(fKey, foot.querySelector("#fact-edit-in"));
        if (val === undefined) { toast("Kontrolli väärtust"); return; }
        const ring = ensureRing(l, "operaator");
        ring.faktid = ring.faktid.filter(x => x.key !== fKey);
        ring.faktid.push({ key: fKey, label: FACT_LABELS[fKey], vana: f[fKey], uus: val, vanaTxt: faktTxt(fKey, f[fKey]), uusTxt: faktTxt(fKey, val) });
        AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: muudatus lisatud Lisa ${ring.nr} ringi (${FACT_LABELS[fKey]} → ${faktTxt(fKey, val)}).` });
        mutate(`Muudatus lisatud Lisa ${ring.nr} ringi`);
      } else {
        const t2 = foot.querySelector("#ring-txt"); const txt = t2 ? t2.value.trim() : "";
        if (!txt) { toast("Sõnasta muudatus"); if (t2) t2.focus(); return; }
        const kyRef = eriRow ? ref : (/^\d/.test(String(ref)) ? `Üld · p ${ref}` : ref);
        const ring = ensureRing(l, "operaator");
        ring.punktid.push({ tekst: txt, algne: eriRow ? eriRow.tekst : null, kirjutabYle: kyRef });
        AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${l.id}: punkt lisatud Lisa ${ring.nr} ringi (kirjutab üle: ${kyRef}).` });
        mutate(`Muudatus lisatud Lisa ${ring.nr} ringi`);
      }
    };
  } else {
    foot.remove(); /* ainult loetav seis — laiendus sulgub sama punkti teise klõpsuga */
  }
}
function closeSide(){ const s=document.getElementById("side"); if(s) s.classList.remove("open"); const sc=document.getElementById("scrim"); if(sc) sc.classList.remove("open"); }
window.closeSide = closeSide;


function signPanel(l) {
  const leaseSpace = DB.spaceById(l.spaceId); const f = {...objektOf(leaseSpace).failid, pinnaplaan: leaseSpace.plaanFail || objektOf(leaseSpace).failid.pinnaplaan};
  return `<div class="card pad reveal">
    <div class="overline" style="margin-bottom:12px">Allkirjastamine</div>
    ${lepStatRow(l)}
    <div class="container-card" style="margin-bottom:12px">
      <div class="ch"><b>Allkirjastatavad dokumendid</b><span class="tag">leping + plaanid</span></div>
      <div class="ci">${I.file.replace('<svg','<svg class="fic"')} Üürileping ${l.id}</div>
      <div class="ci" style="cursor:pointer" onclick="openPdf('${f.pinnaplaan||""}','Lisa 1 · pinnaplaan')">${I.file.replace('<svg','<svg class="fic"')} Lisa 1 · pinnaplaan <span class="tag" style="margin-left:auto">vaata</span></div>
      <div class="ci" style="cursor:pointer" onclick="openPdf('${f.parkimine||""}','Lisa 2 · asendiplaan + parkimisskeem')">${I.file.replace('<svg','<svg class="fic"')} Lisa 2 · asendiplaan + parkimine <span class="tag" style="margin-left:auto">vaata</span></div>
    </div>
    ${l.eri.filter(e => !e.sonastamisel).length ? `
    <div class="container-card" style="margin-bottom:16px">
      <div class="ch"><b>Eritingimused</b><span class="tag">eraldi dokument</span></div>
      <div class="ci" style="cursor:pointer" onclick="openLisa3('${l.id}')">${I.file.replace('<svg','<svg class="fic"')} Lisa 3 · eritingimused <span class="tag" style="margin-left:auto">vaata</span></div>
    </div>` : ""}
    <div class="overline" style="margin-bottom:8px">Allkirjastamise meetod</div>
    <div class="method" id="method" data-glide="method">
      <button class="m-btn sel" data-m="Smart-ID"><span class="m-ic si">${I.smartid}</span>
        <span class="m-tx"><span class="m">Smart-ID</span><span class="s">soovituslik</span></span></button>
      <button class="m-btn" data-m="Mobiil-ID"><span class="m-ic mi">${I.mobiilid}</span>
        <span class="m-tx"><span class="m">Mobiil-ID</span><span class="s">+372</span></span></button>
    </div>
    <button class="btn btn-primary" id="do-sign" style="width:100%;justify-content:center;margin-top:16px">${I.shield} Alusta allkirjastamist</button>
    <div class="muted" style="font-size:12px;margin-top:12px;text-align:center">Eeldab kõikide punktide aktsepteerimist.</div>
  </div>`;
}
function doSign() {
  const m = document.querySelector(".m-btn.sel")?.dataset.m || "Smart-ID";
  const btn = document.getElementById("do-sign");
  btn.innerHTML = `<span class="shimmer light"></span> ${m} · kontrollkood 4271`;   /* v354: shimmer-joon punktide asemel */
  btn.disabled = true;
  const l = CURRENT_LEASE;
  setTimeout(() => {
    if (l) {
      const c = DB.clientById(l.clientId);
      l.staatus = "Kehtiv"; l.allkirjastatud = TODAY_EE; l.versioon = null;
      l.allkirjad = [
        { pool: ACCOUNT.landlord.nimi, isik: "Margus Varne", meetod: m, aeg: NOW_EE() + " 14:05" },
        { pool: c.nimi, isik: c.kontakt, meetod: m, aeg: NOW_EE() + " 14:09" },
      ];
      const sp = DB.spaceById(l.spaceId); if (sp) { sp.staatus = "Üüritud"; sp.tenant = c.nimi; }
      AUDIT.unshift({ aeg: NOW_EE(), autor: "Mõlemad pooled", tegevus: `${l.id} allkirjastatud (${m}) → arhiveeritud. Võtmekuupäevad kalendrisse.` });
      DB.save();
    }
    toast("Leping allkirjastatud ("+m+") → arhiveeritud · võtmekuupäevad kalendrisse");
    router();
  }, 1600);
}
/* võtmefaktide plokk (üür kuus + tähtaeg) — SAMA keel igas lepinguseisus:
   mustandis/läbirääkimistel elab „Tehing" kaardis, allkirjastamisel paneelis,
   kehtival olekukaardil. Faktid tulevad tehingust, uuenevad iga muudatusega. */
function lepStatRow(l) {
  const f = ensureTehing(l), sp9 = DB.spaceById(l.spaceId);
  const kuur = f && sp9 && !isNaN(parseFloat(f.hind)) ? eur(parseFloat(f.hind) * sp9.yyripind) : null;
  const kehtiv9 = l.staatus === "Kehtiv";
  return `<div class="stat-row">
    ${kuur ? `<div class="stat"><div class="l">Üür kuus · +km</div><div class="v">${kuur} €</div></div>` : ""}
    <div class="stat"><div class="l">${kehtiv9 ? "Kehtib kuni" : "Tähtaeg"}</div>
      <div class="v">${kehtiv9 ? (l.lopp || "—") : (f && f.kuud ? (f.kuud % 12 === 0 ? (f.kuud / 12) + " a" : f.kuud + " kuud") : "—")}</div></div>
  </div>`;
}

function signCard(l) {
  /* vaikne olekukaart: seis + kaks võtmerida; allkirjade detailid voldikus */
  return `<div class="card pad reveal">
    <!-- staatusepill elab päises (äpiülene konventsioon) — siin ei korrata -->
    <div style="margin-bottom:12px"><b style="font-size:14px">Kehtiv leping</b></div>
    ${lepStatRow(l)}
    <div class="ci" style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:14px">
      <span class="muted">Allkirjastatud</span>
      <span style="flex:1;text-align:right" class="mono">${l.allkirjastatud || "—"}</span>
    </div>
    <details class="sa-inline">
      <summary><span>Allkirjad · ${l.allkirjad.length}</span><span class="chev">${I.arrow}</span></summary>
      ${l.allkirjad.map(a => `<div class="ci" style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="flex:1;font-size:14px"><b>${a.isik}</b> · ${a.pool}<div class="muted mono" style="font-size:12px">${a.meetod} · ${a.aeg}</div></div>${I.check.replace('<svg','<svg style="width:15px;color:var(--green)"')}</div>`).join("")}
      <a class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-top:12px" href="#/audit">${I.audit} Ekspordi audit trail</a>
    </details>
  </div>`;
}

/* ---------- Uus leping (wizard, etapp 05) -----------------------------
   Üks tegevus „Loo leping" — tüüp (üüri/töö) valitakse wizardi esimesel sammul.
   Sama mootor: mõlemad vertikaalid läbivad osapool → ese → tingimused → mustand. */
function lwizDefaults() {
  return { step: 0, tyyp: null, client: null, space: null, years: 5,
    /* v408: vaikimisi algus = ülejärgmise kuu 1. (üürileping) / järgmise kuu 1. (tööleping) päris tänasest */
    algus: fmtISO(new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth() + 2, 1)), otstarve: "Büroo, lao- ja tootmispind", risk: false,
    tl: { isik: "", epost: "", amet: null, algus: fmtISO(new Date(DEMO_TODAY.getFullYear(), DEMO_TODAY.getMonth() + 1, 1)), katseaeg: 4, tasu: null } };
}
let LWIZ = lwizDefaults();

function addYearsISO(iso, y) {
  const p = iso.split("-").map(Number);
  const d = new Date(p[0] + y, p[1] - 1, p[2]); d.setDate(d.getDate() - 1);
  return d;
}
function isoToEE(iso) { const p = iso.split("-"); return `${p[2]}.${p[1]}.${p[0]}`; }

View.lepingUus = () => {
  LWIZ = lwizDefaults();
  return `<div class="view"><a class="btn btn-ghost btn-sm" href="#/lepingud" style="margin-bottom:20px">${I.back} Katkesta</a>
    <div class="overline reveal">Uus leping · ilma pakkumuseta</div>
    <h1 class="page-h1 reveal" id="lw-title" style="margin:8px 0 24px">Koosta leping</h1>
    <div id="lwiz" class="reveal"></div></div>`;
};
View.lepingUus.init = renderLWiz;

function renderLWiz() {
  const wiz = document.getElementById("lwiz"); if (!wiz) return;
  const ttl = document.getElementById("lw-title");
  if (ttl) ttl.textContent = LWIZ.tyyp === "yyri" ? "Koosta üürileping" : LWIZ.tyyp === "too" ? "Koosta tööleping" : "Koosta leping";
  /* enne tüübivalikut on sammud üldnimedega — leping = osapool + ese + tingimused, vertikaalist sõltumata */
  const steps = LWIZ.tyyp === "yyri" ? ["Tüüp","Üürnik","Pind","Põhitingimused"]
              : LWIZ.tyyp === "too"  ? ["Tüüp","Kandidaat","Ametikoht","Tingimused","Mustand V1"]
              : ["Tüüp","Osapool","Ese","Tingimused","Mustand V1"];
  const head = stepperHTML(steps, LWIZ.step);
  let body = "";

  if (LWIZ.step === 0) {
    body = `
    <div class="ltyp-grid">
      <button class="ltyp ltyp-visual ltyp-lease reveal" data-ltyyp="yyri">
        <span class="ltyp-copy">
          <span class="t">Üürileping</span>
          <span class="s">Koosta äriruumi üürileping pinna, osapoolte ja põhiandmete alusel.</span>
        </span>
        <span class="ltyp-art" aria-hidden="true"><img src="assets/rbp-describe-original.webp" width="500" height="500" alt="" draggable="false"></span>
        <span class="ltyp-foot" aria-hidden="true"><span class="arr">${I.arrow}</span></span>
      </button>
      ${!AMETIKOHAD.length ? "" : `
      <button class="ltyp ltyp-simple reveal" data-ltyyp="too">
        <span class="ltyp-copy">
          <span class="t">Tööleping</span>
          <span class="s">Koosta tööleping ametikoha, kandidaadi ja tingimuste alusel.</span>
        </span>
        <span class="ltyp-art" aria-hidden="true"><span class="ltyp-simple-ic">${I.user}</span></span>
        <span class="ltyp-foot" aria-hidden="true"><span class="arr">${I.arrow}</span></span>
      </button>`}
      <button class="ltyp ltyp-visual ltyp-generator soon reveal" data-ltyyp="gen">
        <span class="ltyp-copy">
          <span class="t">Lepingugeneraator</span>
          <span class="s">Kirjelda vajadust. AI seab kokku mustandi, faktid ja eritingimused.</span>
        </span>
        <span class="ltyp-art" aria-hidden="true"><img src="assets/rbp-generate-original.webp" width="500" height="500" alt="" draggable="false"></span>
        <span class="ltyp-foot"><span class="soon-tag">Tulekul</span></span>
      </button>
    </div>`;
  } else if (LWIZ.tyyp === "too") {
    body = tlWizBody();
  } else if (LWIZ.step === 1) {
    body = `<div class="card pad">
      <div class="field"><label>Üürniku nimi või registrikood</label>
        <div class="clsearch">${I.search}<input id="lcl-input" placeholder="nt Future Invest OÜ või 14258963" value="${LWIZ.client?LWIZ.client.nimi:''}" autocomplete="off"/></div></div>
      <div id="lcl-suggest" style="margin-top:16px"></div>
    </div>`;
  } else if (LWIZ.step === 2) {
    const free = SPACES.filter(s => ["Vaba","Pakkumusel"].includes(s.staatus));
    body = `<div class="card pad">
      <div class="between" style="margin-bottom:12px">
        <div><div class="overline">Üürnik</div><div style="font-weight:700;font-size:16px">${LWIZ.client.nimi}</div></div>
        ${pill(LWIZ.client.risk.skoor)}
      </div>
      <div class="overline" style="margin:16px 0 12px">Vali pind (leping = 1 pind) · ${multiObj() ? OBJEKTID.map(o=>o.nimi).join(" · ") : OBJEKT.nimi}</div>
      ${free.length ? free.map(s => { const sel = LWIZ.space === s.id;
        return `<div class="pick ${sel?'sel':''}" data-lsp="${s.id}">
          <div class="box">${I.check}</div>
          <div style="flex:1"><div style="font-weight:600"><span class="mono">${s.nimi}</span> · ${s.tyyp}${multiObj()?` <span class="tag" style="margin-left:8px">${objektOf(s).nimi}</span>`:""}</div>
            <div class="muted mono" style="font-size:14px">${eur(s.yyripind,1)} m² · ${eur(s.hind)} €/m²${s.parkimine?` · ${s.parkimine} parkimiskohta`:""}${s.elekter?` · ${s.elekter} A`:""}</div></div>
          <div class="mono" style="font-weight:700;text-align:right">${eur(rent(s))} €<div class="muted" style="font-size:12px;font-weight:500">üür / kuus</div></div>
        </div>`; }).join("") : occupiedSpacesNote()}
      <div class="muted" style="margin-top:12px;font-size:14px">Pinnaga tuleb automaatselt kaasa Lisa 1 (pinnaplaan) ja Lisa 2 (asendiplaan + parkimisskeem).</div>
      <div class="wrap-actions" style="margin-top:20px;justify-content:space-between"><button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
        <button class="btn btn-primary" id="lw-next" ${LWIZ.space?'':'disabled'} style="${LWIZ.space?'':'opacity:.5;pointer-events:none'}">Põhitingimused ${I.arrow}</button></div>
    </div>`;
  } else if (LWIZ.step === 3) {
    const sp = DB.spaceById(LWIZ.space);
    const kuusYyr = rent(sp);
    body = `<div class="split" style="align-items:start">
      <div class="card pad">
        <div class="overline" style="margin-bottom:16px">Põhitingimused · eeltäidetud mallist ja pinna andmetest</div>
        <div class="grid g2">
          <div class="field"><label>Üleandmispäev (p 2.3)</label><input type="date" id="lw-algus" value="${LWIZ.algus}"/></div>
          <div class="field"><label>Tähtaeg (p 5.1)</label><select id="lw-years">
            ${[1,3,5,10].map(y=>`<option value="${y}" ${LWIZ.years===y?'selected':''}>${y} aastat</option>`).join("")}</select></div>
        </div>
        <!-- kasutusotstarve tuleb mallist ja indekseerimine üldtingimustest (p 5.2) —
             mõlemad on mustandis muudetavad (fakt lauses / indekseerimise külgkaart) -->
        <div class="muted" style="font-size:12px;margin-top:4px">Kasutusotstarve ja indekseerimine (üld p 5.2 standard) tulevad mallist — vajadusel muudad neid mustandis.</div>
        <div class="wrap-actions" style="margin-top:20px;justify-content:space-between"><button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
          <button class="btn btn-primary" id="lw-finish">${I.check} Loo mustand V1</button></div>
      </div>
      <div class="card pad">
        <div class="overline" style="margin-bottom:12px">Arvutus · ${sp.nimi}</div>
        <div class="price">
          <div class="price-row"><span class="lbl">Üür (p 3.1)</span><span class="calc">${eur(sp.yyripind,1)} m² × ${eur(sp.hind)} €</span><span class="amt">${eur(kuusYyr)} €</span></div>
          <div class="price-row"><span class="lbl">Tagatisraha (p 4.1)</span><span class="calc">3 kuu üür</span><span class="amt">${eur(kuusYyr*3)} €</span></div>
          <div class="price-row"><span class="lbl muted">Kõrvalkulu (talvine, info)</span><span class="calc">Moderan</span><span class="amt" style="color:var(--muted)">${eur(kkWinter(sp))} €</span></div>
        </div>
      </div>
    </div>`;
  }
  /* eraldi ülevaate sammu pole — arvutuskaart põhitingimuste kõrval näitab sama info
     ja mustand ise ON ülevaade */
  wiz.innerHTML = head + body;
  bindLWiz();
}

/* --- töölepingu voog: kandidaat → ametikoht → tingimused → mustand ---------- */
function tlKatEnd() { const p = LWIZ.tl.algus.split("-").map(Number);
  const d = new Date(p[0], p[1]-1 + LWIZ.tl.katseaeg, p[2]); d.setDate(d.getDate()-1); return d; }
function tlPalgaYlev() { const p = LWIZ.tl.algus.split("-").map(Number); return new Date(p[0]+1, p[1]-1, p[2]); }

function tlWizBody() {
  if (LWIZ.step === 1) {
    return `<div class="card pad">
      <div class="grid g2">
        <div class="field"><label>Kandidaadi nimi</label><input id="tl-isik" value="${LWIZ.tl.isik}" placeholder="nt Anna Kask"/></div>
        <div class="field"><label>E-post (turvaline link ülevaatamiseks)</label><input id="tl-epost" value="${LWIZ.tl.epost}" placeholder="anna@epost.ee"/></div>
      </div>
      <div class="muted" style="font-size:14px;margin-top:8px">Kandidaat toimetab e-postile saadetud lingi kaudu ilma kontota — konto tekib allkirjastamisel. Sama muster nagu hinnapakkumise jagamislink.</div>
      <div class="wrap-actions" style="margin-top:20px;justify-content:space-between">
        <button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
        <button class="btn btn-primary" id="tl-next1">Ametikoht ${I.arrow}</button>
      </div>
    </div>`;
  }
  if (LWIZ.step === 2) {
    const vabad = AMETIKOHAD.filter(a => ametikohtHoive(a) < a.kvoot);
    const taidetud = AMETIKOHAD.filter(a => ametikohtHoive(a) >= a.kvoot);
    return `<div class="card pad">
      <div class="between" style="margin-bottom:12px">
        <div><div class="overline">Kandidaat</div><div style="font-weight:700;font-size:16px">${LWIZ.tl.isik}</div></div>
      </div>
      <div class="overline" style="margin:16px 0 12px">Vali ametikoht (leping = 1 ametikoht) · osakond ${OSAKOND.nimi}</div>
      ${vabad.length ? vabad.map(a => { const sel = LWIZ.tl.amet && LWIZ.tl.amet.id === a.id; const h = ametikohtHoive(a);
        return `<div class="pick ${sel?'sel':''}" data-tlamet="${a.id}">
          <div class="box">${I.check}</div>
          <div style="flex:1"><div style="font-weight:600">${a.nimi}</div>
            <div class="muted" style="font-size:14px">${a.ylesanded}</div></div>
          <div style="text-align:right"><div class="mono" style="font-weight:700">${eur(a.tasu,0)} €</div>
            <div class="muted" style="font-size:12px">bruto / kuus · hõive ${h}/${a.kvoot}</div></div>
        </div>`; }).join("") : `
        <div class="note" style="margin-bottom:12px">${I.info}<div>Vabu ametikohti pole — kvoot on täidetud. Lisa ametikoht esemeregistris (osakond on samasugune konteiner nagu hoone).</div></div>
        ${taidetud.map(a => `<div class="pick off">
          <div style="flex:1"><div style="font-weight:600">${a.nimi}</div>
            <div class="muted" style="font-size:14px">hõive ${ametikohtHoive(a)}/${a.kvoot}</div></div>
          ${pill("Täidetud")}
        </div>`).join("")}`}
      <div class="wrap-actions" style="margin-top:20px;justify-content:space-between">
        <button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
        <button class="btn btn-primary" id="tl-next2" ${LWIZ.tl.amet?'':'disabled'} style="${LWIZ.tl.amet?'':'opacity:.5;pointer-events:none'}">Tingimused ${I.arrow}</button>
      </div>
    </div>`;
  }
  if (LWIZ.step === 3) {
    const a = LWIZ.tl.amet;
    const tasu = LWIZ.tl.tasu != null ? LWIZ.tl.tasu : a.tasu;
    return `<div class="split" style="align-items:start">
      <div class="card pad">
        <div class="overline" style="margin-bottom:16px">Tingimused · eeltäidetud ametikohalt (ese kannab andmed)</div>
        <div class="grid g2">
          <div class="field"><label>Tööle asumine</label><input type="date" id="tl-algus" value="${LWIZ.tl.algus}"/></div>
          <div class="field"><label>Katseaeg (TLS § 86)</label><select id="tl-katseaeg">
            ${[[4,"4 kuud · standard"],[6,"6 kuud"],[0,"Ilma katseajata"]].map(([v,t])=>`<option value="${v}" ${LWIZ.tl.katseaeg===v?'selected':''}>${t}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>Töötasu (bruto, € kuus)</label><input type="number" id="tl-tasu" value="${tasu}"/></div>
        <div class="muted" style="font-size:14px;margin-top:8px">Tähtaeg: tähtajatu (standard). Palgaülevaatus tekib võtmekuupäevana automaatselt — kord aastas.</div>
        <div class="wrap-actions" style="margin-top:20px;justify-content:space-between"><button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
          <button class="btn btn-primary" id="tl-next3">Ülevaade ${I.arrow}</button></div>
      </div>
      <div class="card pad">
        <div class="overline" style="margin-bottom:12px">Arvutus · ${a.nimi}</div>
        <div class="price">
          <div class="price-row"><span class="lbl">Töötasu</span><span class="calc">bruto / kuus</span><span class="amt">${eur(tasu,0)} €</span></div>
          <div class="price-row"><span class="lbl">Katseaja lõpp</span><span class="calc">${LWIZ.tl.katseaeg||"—"} ${LWIZ.tl.katseaeg?"kuud":""}</span><span class="amt">${LWIZ.tl.katseaeg?fmtEE(tlKatEnd()):"—"}</span></div>
          <div class="price-row"><span class="lbl muted">Palgaülevaatus</span><span class="calc">kord aastas</span><span class="amt" style="color:var(--muted)">${fmtEE(tlPalgaYlev())}</span></div>
        </div>
      </div>
    </div>`;
  }
  /* step 4 · ülevaade */
  const a = LWIZ.tl.amet;
  return `<div class="card pad">
    <div class="overline">Mustand V1 · ülevaade</div>
    <div style="font-weight:700;font-size:20px;margin:8px 0 2px">${LWIZ.tl.isik} · ${a.nimi}</div>
    <div class="muted" style="font-size:14px">${isoToEE(LWIZ.tl.algus)} · tähtajatu · ${LWIZ.tl.katseaeg?`katseaeg ${LWIZ.tl.katseaeg} kuud`:"ilma katseajata"}</div>
    <div class="divline"></div>
    <dl class="kv">
      <dt>Töötasu</dt><dd class="mono">${eur(LWIZ.tl.tasu != null ? LWIZ.tl.tasu : a.tasu,0)} € kuus (bruto)</dd>
      <dt>Katseaja lõpp</dt><dd class="mono">${LWIZ.tl.katseaeg?fmtEE(tlKatEnd()):"—"}</dd>
      <dt>Palgaülevaatus</dt><dd class="mono">${fmtEE(tlPalgaYlev())}</dd>
      <dt>Lisad</dt><dd>Lisa 1 ametijuhend (${a.nimi.toLowerCase()})</dd>
    </dl>
    <div class="muted" style="margin-top:16px;font-size:14px">Mustand genereeritakse struktureeritult: üldtingimused töölepingu mallist (lukus) + põhitingimused ametikohalt ja sisestustest. TÖR-kanne — post-MVP adapter.</div>
    <div class="wrap-actions" style="margin-top:20px"><button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
      <button class="btn btn-primary" id="lw-finish">${I.check} Loo mustand V1</button></div>
  </div>`;
}

function createTLFromWizard() {
  const a = LWIZ.tl.amet;
  const tasu = LWIZ.tl.tasu != null ? LWIZ.tl.tasu : a.tasu;
  const num = Math.max(0, ...TLEPINGUD.map(x => +x.id.split("-")[2] || 0)) + 1;
  const id = `TL-${DEMO_TODAY.getFullYear()}-` + String(num).padStart(3, "0");
  const algusEE = isoToEE(LWIZ.tl.algus);
  const kat = LWIZ.tl.katseaeg;
  const t = {
    id, isik: LWIZ.tl.isik, roll: "kandidaat", ametikohtId: a.id,
    staatus: "Mustand V1", algus: algusEE, tahtaeg: "Tähtajatu", allkirjastatud: null,
    katseaegLopp: kat ? fmtEE(tlKatEnd()) : null, palgaylevaatus: fmtEE(tlPalgaYlev()),
    pohi: [
      { ref: "Pooled", vaartus: `${ACCOUNT.landlord.nimi} (tööandja) ⋅ ${LWIZ.tl.isik} (töötaja)` },
      { ref: "Ametikoht", vaartus: `${a.nimi} · osakond ${OSAKOND.nimi}` },
      { ref: "Tööülesanded", vaartus: `Ametijuhendi järgi (Lisa 1): ${a.ylesanded}` },
      { ref: "Töötasu", vaartus: `${eur(tasu,0)} € kuus (bruto) · makstakse kuu viimasel tööpäeval` },
      { ref: "Töö tegemise koht", vaartus: `${multiObj() ? OBJEKTID.map(o=>o.nimi).join(" · ") : OBJEKT.nimi} · ${OBJEKT.ehr.aadress}` },
      { ref: "Tööaeg", vaartus: "Täistööaeg · 40 tundi nädalas" },
      { ref: "Algus ja tähtaeg", vaartus: `${algusEE} · tähtajatu` },
      { ref: "Katseaeg", vaartus: kat ? `${kat} kuud · kuni ${fmtEE(tlKatEnd())}` : "Kokkuleppel ilma katseajata" },
      { ref: "Palgaülevaatus", vaartus: `Kord aastas · järgmine ${fmtEE(tlPalgaYlev())}` },
    ],
    eri: [],
    lisad: [{ nr: 1, nimi: `Ametijuhend (${a.nimi.toLowerCase()})`, fail: "— eseme manus —" }],
    allkirjad: [],
  };
  TLEPINGUD.unshift(t);
  AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Tööleping ${id} (Mustand V1) loodud otse (ilma pakkumuseta) — kandidaat ${LWIZ.tl.isik}, ametikoht ${a.nimi}.` });
  DB.save();
  toast(`Mustand V1 loodud (${id}) — üldtingimused mallist, põhitingimused ametikohalt`);
  location.hash = "#/tooleping/" + id;
}

/* kui valitavaid pindu pole: selgitus + hõivatud pinnad staatusega (loetav tupikuta seis) */
function occupiedSpacesNote() {
  const muud = SPACES.filter(s => !["Vaba","Pakkumusel"].includes(s.staatus));
  return `
  <div class="note" style="margin-bottom:12px">${I.info}<div>Vabu pindu praegu pole — kõik pinnad on üüritud, reserveeritud või lepingus.
    Vabasta pind esemeregistris või vali kasutajamenüüst (külgriba all) „Lähtesta demo", et naasta seemneandmete juurde.</div></div>
  ${muud.map(s => `<div class="pick off">
    <div style="flex:1"><div style="font-weight:600"><span class="mono">${s.nimi}</span> · ${s.tyyp}${multiObj()?` <span class="tag" style="margin-left:8px">${objektOf(s).nimi}</span>`:""}</div>
      <div class="muted mono" style="font-size:14px">${eur(s.yyripind,1)} m²${s.tenant?` · ${s.tenant}`:""}</div></div>
    ${pill(s.staatus)}
  </div>`).join("")}`;
}

function bindLWiz() {
  const back = document.getElementById("lw-back");
  if (back) back.onclick = () => { LWIZ.step--; renderLWiz(); };
  const next = document.getElementById("lw-next");

  if (LWIZ.step === 0) {
    document.querySelectorAll("[data-ltyyp]").forEach(el => el.onclick = () => {
      /* generaator on teadlikult „tulekul" — tegeleme hiljem */
      if (el.dataset.ltyyp === "gen") { toast("Lepingugeneraator on teel — AI-mustand vabast kirjeldusest tuleb järgmises etapis"); return; }
      LWIZ.tyyp = el.dataset.ltyyp; LWIZ.step = 1; renderLWiz();
    });
    return;
  }
  if (LWIZ.tyyp === "too") {
    const n1 = document.getElementById("tl-next1");
    if (n1) n1.onclick = () => {
      const isik = (document.getElementById("tl-isik").value || "").trim();
      if (!isik) { toast("Sisesta kandidaadi nimi"); return; }
      LWIZ.tl.isik = isik;
      LWIZ.tl.epost = (document.getElementById("tl-epost").value || "").trim();
      LWIZ.step = 2; renderLWiz();
    };
    document.querySelectorAll("[data-tlamet]").forEach(el => el.onclick = () => {
      LWIZ.tl.amet = DB.ametikohtById(el.dataset.tlamet); renderLWiz();
    });
    const n2 = document.getElementById("tl-next2");
    if (n2) n2.onclick = () => { LWIZ.step = 3; renderLWiz(); };
    const n3 = document.getElementById("tl-next3");
    if (n3) n3.onclick = () => {
      LWIZ.tl.algus = document.getElementById("tl-algus").value || LWIZ.tl.algus;
      LWIZ.tl.katseaeg = +document.getElementById("tl-katseaeg").value;
      LWIZ.tl.tasu = +document.getElementById("tl-tasu").value || LWIZ.tl.amet.tasu;
      LWIZ.step = 4; renderLWiz();
    };
    const fin = document.getElementById("lw-finish");
    if (fin) fin.onclick = createTLFromWizard;
    return;
  }

  if (LWIZ.step === 1) {
    const inp = document.getElementById("lcl-input");
    const sug = document.getElementById("lcl-suggest");
    const show = () => {
      sug.innerHTML = clientSuggestHTML(inp.value.toLowerCase().trim());
      sug.querySelectorAll("[data-clpick]").forEach(el => el.onclick = () => {
        LWIZ.client = DB.clientById(el.dataset.clpick); LWIZ.step = 2; renderLWiz();
      });
    };
    inp.oninput = show; show(); inp.focus();
    /* Enter kinnitab esimese vaste — klõps pole kohustuslik */
    inp.onkeydown = e => { if (e.key === "Enter") { const f = sug.querySelector("[data-clpick]"); if (f) f.click(); } };
  }
  if (LWIZ.step === 2) {
    if (next) next.onclick = () => { LWIZ.step = 3; renderLWiz(); };
    document.querySelectorAll(".pick[data-lsp]").forEach(el => el.onclick = () => {
      LWIZ.space = el.dataset.lsp; renderLWiz();
    });
  }
  if (LWIZ.step === 3) {
    /* põhitingimused on viimane samm — otstarve ja indekseerimine tulevad mallist
       (vaikeväärtused LWIZ-is) ja on mustandis muudetavad */
    const fin = document.getElementById("lw-finish");
    if (fin) fin.onclick = () => {
      LWIZ.algus = document.getElementById("lw-algus").value || LWIZ.algus;
      LWIZ.years = +document.getElementById("lw-years").value;
      createLeaseFromWizard();
    };
  }
}

function createLeaseFromWizard() {
  const sp = DB.spaceById(LWIZ.space);
  const c = LWIZ.client;
  const loppD = addYearsISO(LWIZ.algus, LWIZ.years);
  const indeksD = addYearsISO(LWIZ.algus, 1); indeksD.setDate(indeksD.getDate() + 1);
  const num = Math.max(0, ...LEASES.map(x => +x.id.split("-")[2] || 0)) + 1;
  const id = `LEP-${DEMO_TODAY.getFullYear()}-` + String(num).padStart(3, "0");
  const tehing = { algus: LWIZ.algus, kuud: LWIZ.years * 12, hind: sp.hind, tagatisKuud: 3,
    parkimine: sp.parkimine, otstarve: LWIZ.otstarve, erisused: null };
  const lease = {
    id, clientId: c.id, spaceId: sp.id, pakkumus: "— (loodud ilma pakkumuseta)",
    staatus: "Mustand V1", versioon: "Mustand V1", pikkusKuud: LWIZ.years * 12,
    algus: isoToEE(LWIZ.algus), lopp: fmtEE(loppD), allkirjastatud: null,
    /* indekseerimine tuleb mallist (üld p 5.2 standard) — erisused sünnivad läbirääkimisel */
    indeks: { meetod: "Fikseeritud %", maar: "3%", sagedus: "iga 12 kuu", jargmine: fmtEE(indeksD) },
    tehing,
    pohi: pohiTehing({ cl: c, ct: null, sp, facts: tehing }),
    eri: [],
    kommentaarid: [],
    lisad: [
      { nr: 1, nimi: `Pinnaplaan (${sp.nimi})`, fail: (sp.plaanFail || objektOf(sp).failid.pinnaplaan) || "— lisamata —" },
      { nr: 2, nimi: "Asendiplaan + parkimisskeem", fail: objektOf(sp).failid.parkimine || "— lisamata —" },
      { nr: 3, nimi: "Eritingimused", fail: "— genereeritud —" },
    ],
    allkirjad: [],
  };
  LEASES.push(lease);
  sp.staatus = "Lepingus"; sp.tenant = c.nimi;
  AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Lepingu mustand ${id} loodud otse (ilma pakkumuseta) (${c.nimi} · ${sp.nimi}).` });
  DB.save();
  toast(`Mustand V1 loodud (${id}) · üldtingimused mallist, lisad seotud automaatselt`);
  location.hash = "#/leping/" + id;
}

/* ---------- Riskiraport --------------------------------------------------- */
View.risk = (cid) => {
  const c = cid ? DB.clientById(cid) : CLIENTS[0];
  const col = STATUS[c.risk.skoor];
  const pct = c.risk.skoor==='MADAL'?78:c.risk.skoor==='KESKMINE'?52:26;
  const cssCol = `var(--${col})`;
  const sources = c.risk.skoor==='KÕRGE'
    ? [ {allikas:"Krediidiinfo",tulemus:"Reiting C · 1 registreeritud maksehäire",skoor:"KÕRGE"},
        {allikas:"Inforegister",tulemus:"Käive langenud 35% · väike omakapital",skoor:"KESKMINE"},
        {allikas:"Kohtutäitur",tulemus:"1 avatud täitemenetlus (2 140 €)",skoor:"KÕRGE"},
        {allikas:"Äriregister",tulemus:"Staatus korras · esindusõigus korras",skoor:"MADAL"} ]
    : RISK_SOURCES;
  /* päringute ajalugu: iga kliendi viimane raport, uuemad eespool */
  const hist = [...CLIENTS].sort((a, b) => parseEE(b.risk.kuupaev) - parseEE(a.risk.kuupaev));
  return `<div class="view">
    ${cid?`<a class="btn btn-ghost btn-sm reveal" href="#/pakkumus/PAK-2026-014" style="margin-bottom:20px">${I.back} Tagasi</a>`:""}
    <div class="page-head reveal"><div><div class="overline">Riskiraport</div>
      <h1 class="page-h1" style="margin-top:8px">${c.nimi}</h1>
      <p class="page-sub mono" style="font-size:14px">${c.registrikood} · päring ${c.risk.kuupaev}</p></div>
    </div>
    <div class="risk-layout">
      <div class="card reveal" style="overflow:hidden">
        <div class="card-h"><h3>Ajalugu</h3><span class="overline">${hist.length} päringut</span></div>
        <div class="risk-search"><span>${I.search}</span><input id="risk-search" placeholder="Otsi ettevõtet või registrikoodi…" autocomplete="off"/></div>
        <div class="risk-hist">
          ${hist.map(x => `<a class="rh ${x.id === c.id ? "active" : ""}" href="#/risk/${x.id}" data-otsi="${(x.nimi + " " + x.registrikood).toLowerCase()}">
            <div><div class="nm">${x.nimi}</div><div class="dt mono">${x.risk.kuupaev}</div></div>
            ${pill(x.risk.skoor)}
          </a>`).join("")}
          <div class="muted" id="risk-empty" style="display:none;padding:16px 20px;font-size:14px">Vastet ei leitud.</div>
        </div>
      </div>
      <div class="split" style="align-items:start">
        <div class="card reveal" style="overflow:hidden">
          <div class="card-h"><h3>Allikad</h3><span class="overline">4 registrit</span></div>
          <table class="tbl"><tbody>
          ${sources.map(s => `<tr><td><b>${s.allikas}</b></td><td class="muted">${s.tulemus}</td><td class="r">${pill(s.skoor)}</td></tr>`).join("")}
          </tbody></table>
        </div>
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:16px">Koondskoor</div>
          <div class="gauge" style="flex-direction:column;align-items:center;text-align:center;gap:16px">
            <div class="ring" style="width:140px;height:140px;background:conic-gradient(${cssCol} ${pct}%, var(--paper-2) 0)">
              <div class="inner" style="width:108px;height:108px"><div><div class="sc" style="font-size:24px;color:${cssCol}">${c.risk.skoor}</div><div class="lb">KOONDSKOOR</div></div></div>
            </div>
            <div class="muted" style="font-size:14px">Krediidiinfo · Inforegister · Kohtutäitur · Äriregister</div>
          </div>
          <div class="divline"></div>
          <div class="muted" style="font-size:14px;text-align:center">Raport on nõuandev — lõpliku otsuse teeb operaator.</div>
        </div>
      </div>
    </div>
  </div>`;
};
View.risk.init = () => {
  const s = document.getElementById("risk-search");
  if (!s) return;
  s.addEventListener("input", () => {
    const q = s.value.trim().toLowerCase();
    let n = 0;
    document.querySelectorAll(".risk-hist .rh").forEach(r => {
      const hit = !q || r.dataset.otsi.includes(q);
      r.style.display = hit ? "" : "none";
      if (hit) n++;
    });
    const e = document.getElementById("risk-empty");
    if (e) e.style.display = n ? "none" : "";
  });
};

/* ---------- Kalender: loend (nädalate kaupa) | kuu · tüübi- ja objektifilter -- */
const KTYYP = (t) => t === "Lepingu lõpp" ? "loppemine" : t === "Indekseerimine" ? "indekseerimine"
  : t === "Katseaja lõpp" ? "katseaeg" : t === "Palgaülevaatus" ? "palgaylevaatus"
  : t === "Pakkumuse kehtivus" ? "pakkumus" : "muu";
const KTYYP_LBL = { loppemine: "Lõppemine", indekseerimine: "Indekseerimine", katseaeg: "Katseaeg", palgaylevaatus: "Palgaülevaatus", pakkumus: "Pakkumuse aegumine" };

/* kirje → seotud dokument (leping / imporditud / tööleping / pakkumus) */
function kdDocRef(k) {
  const m = k.objekt.match(/^([A-ZÕÄÖÜ]{2,4}-\d{4}-\d+)/);
  if (!m) return null;
  const id = m[1];
  if (DB.leaseById(id)) return { kind: "lease", id, href: "#/leping/" + id, obj: DB.leaseById(id) };
  if (DB.impById(id)) return { kind: "imp", id, href: "#/imp/" + id, obj: DB.impById(id) };
  if (DB.tlepingById(id)) return { kind: "tl", id, href: "#/tooleping/" + id, obj: DB.tlepingById(id) };
  if (DB.offerById(id)) return { kind: "offer", id, href: "#/pakkumus/" + id, obj: DB.offerById(id) };
  return null;
}
/* indekseerimise arvutus: vana üür → uus, meetod, indeksi väärtus */
function kdIndexCalc(k) {
  const ref = kdDocRef(k);
  let vana = null, meetod = "Fikseeritud 3%", idx = "fikseeritud 3% (üldtingimuste p 5.2)";
  if (ref && ref.kind === "lease") {
    vana = rent(DB.spaceById(ref.obj.spaceId));
    if (ref.obj.indeks.meetod !== "Fikseeritud %") { meetod = "Statistikaameti THI"; idx = "THI 12 kuu muutus +3,4% (Statistikaamet)"; }
  } else if (ref && ref.kind === "imp") {
    const s = (ref.obj.parameetrid.find(p => p[0] === "Üür") || [])[1] || "";
    vana = parseFloat(s.replace(/[^\d,\.]/g, "").replace(",", ".")) || null;
    const im = (ref.obj.parameetrid.find(p => p[0] === "Indekseerimine") || [])[1] || "";
    if (im.includes("THI")) { meetod = "Statistikaameti THI"; idx = "THI 12 kuu muutus +3,4% (Statistikaamet)"; }
  }
  if (vana == null) return null;
  const pct = idx.includes("3,4") ? 0.034 : 0.03;
  return { vana, uus: vana * (1 + pct), pctTxt: (pct * 100).toFixed(1).replace(".", ","), meetod, idx, ref };
}
/* kirje kodu-hoone (objektifiltri jaoks): tuvastatakse üürniku järgi */
function kdHoone(k) {
  for (const o of OBJEKTID) {
    if (SPACES.filter(s => objektOf(s).id === o.id).some(s => s.tenant && k.objekt.includes(s.tenant))) return o.id;
  }
  return "";
}
/* kirje kodu-objektid (Ülevaate skoop + objektikaardi „järgmine tähtaeg"): dokumendiviite
   kaudu (leping / import / pakkumus), varuvariandina üürniku nime järgi; tühi = ettevõttetasemel */
function kdObjektid(k) {
  const ref = kdDocRef(k);
  const spObj = (id) => { const s = DB.spaceById(id); return s ? objektOf(s).id : null; };
  if (ref && ref.kind === "imp") return impObjektid(ref.obj);
  if (ref && ref.kind === "lease") return [spObj(ref.obj.spaceId)].filter(Boolean);
  if (ref && ref.kind === "offer") return [...new Set((ref.obj.spaceIds || [ref.obj.spaceId]).map(spObj).filter(Boolean))];
  const h = kdHoone(k);
  return h ? [h] : [];
}

let KAL_ITEMS = [];
View.kalender = (arg) => {
  const parts = (arg || "").split("/");
  const mode = parts[0] === "kuu" ? "kuu" : "loend";
  const dIso = (iso) => Math.ceil((new Date(iso) - DEMO_TODAY) / 86400000);
  KAL_ITEMS = [...KEY_DATES].sort((a, b) => new Date(a.kuupaev) - new Date(b.kuupaev));

  const toolbar = `
  <div class="pf-toolbar reveal">
    <div class="tabbar" style="box-shadow:var(--shadow-sm)">
      <a class="${mode === "loend" ? "active" : ""}" href="#/kalender">Loend</a>
      <a class="${mode === "kuu" ? "active" : ""}" href="#/kalender/kuu">Kuu</a>
    </div>
    ${mode === "loend" ? `
    <div class="pf-views" id="kal-tyybid" data-glide="kal-tyybid">
      <button class="pf-view on" data-kt="">Kõik</button>
      ${Object.entries(KTYYP_LBL).filter(([k]) => TLEPINGUD.length || !["katseaeg", "palgaylevaatus"].includes(k)).map(([k, t]) => `<button class="pf-view" data-kt="${k}">${t}</button>`).join("")}
    </div>
    <select id="kal-obj" class="eri-ky" style="margin-left:auto">
      <option value="">Kõik objektid</option>
      ${OBJEKTID.map(o => `<option value="${o.id}">${o.nimi}</option>`).join("")}
    </select>` : ""}
  </div>`;

  let body = "";
  if (mode === "loend") {
    /* nädalagrupid (esmaspäevast) */
    const wkStart = (iso) => { const d = new Date(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
    const groups = [];
    KAL_ITEMS.forEach((k, i) => {
      const ws = wkStart(k.kuupaev); const key = ws.getFullYear() + "-" + ws.getMonth() + "-" + ws.getDate();
      let g = groups.find(x => x.key === key);
      if (!g) { const we = new Date(ws); we.setDate(we.getDate() + 6);
        g = { key, ws, lbl: `${fmtEE(ws).slice(0,6)} – ${fmtEE(we)}`, see: DEMO_TODAY >= ws && DEMO_TODAY <= we, items: [] }; groups.push(g); }
      g.items.push({ k, i });
    });
    body = groups.map(g => `
    <div class="kal-wk reveal" data-kwk="1">
      <div class="sec-h" style="margin:24px 0 12px"><h2 style="font-size:16px">${g.see ? "See nädal" : "Nädal"}</h2><span class="meta">${g.lbl}${g.see ? " · täna " + TODAY_EE : ""}</span></div>
      <div class="card" style="overflow:hidden">
        ${g.items.map(({ k, i }) => { const ki = kdIcon(k.tyyp); const ref = kdDocRef(k); const kt = KTYYP(k.tyyp);
          const calc = kt === "indekseerimine" ? kdIndexCalc(k) : null;
          const d = dIso(k.kuupaev);
          const verb = kt === "loppemine" ? "Ava leping" : kt === "pakkumus" ? "Ava pakkumus" : (kt === "katseaeg" || kt === "palgaylevaatus") ? "Ava tööleping" : "Ava";
          return `
        <div class="kal-row clickable" data-ki="${i}" data-kt="${kt}" data-ko="${kdHoone(k)}">
          <div class="kal-date"><div class="mono d">${k.kuupaev.slice(8,10)}</div><div class="overline m">${monthName(k.kuupaev.slice(0,7)).slice(0,3)}</div></div>
          <span class="kd-ic ${ki.cls}" title="${k.tyyp}">${ki.ic}</span>
          <div style="flex:1;min-width:0">
            <div class="flex" style="gap:8px;flex-wrap:wrap"><b style="font-size:14px">${k.tyyp}</b><span class="tag">${k.objekt}</span></div>
            <div class="muted" style="font-size:14px;margin-top:3px">
              ${calc ? `${eur(calc.vana,0)} € → <b style="color:var(--ink)">${eur(calc.uus,0)} €</b> (+${calc.pctTxt}%) · ${calc.meetod} ${pill("rakendub automaatselt","accent")}` : k.info}
            </div>
          </div>
          ${ref ? `<a class="btn btn-ghost btn-sm" href="${ref.href}" onclick="event.stopPropagation()">${verb}</a>` : `<span class="muted mono" style="font-size:12px">${d} p</span>`}
        </div>`; }).join("")}
      </div>
    </div>`).join("") + `<div class="muted reveal" id="kal-tyhi" style="display:none;padding:24px;text-align:center;font-size:14px">Selle filtriga sündmusi pole.</div>`;
  } else {
    /* kuuvaade */
    const ym = /^\d{4}-\d{2}$/.test(parts[1]) ? parts[1] : "2026-06";
    const [Y, M] = ym.split("-").map(Number);
    const prev = new Date(Y, M - 2, 1), next = new Date(Y, M, 1);
    const pad2 = (n) => String(n).padStart(2, "0");
    const ymOf = (dd) => `${dd.getFullYear()}-${pad2(dd.getMonth() + 1)}`;
    const first = new Date(Y, M - 1, 1);
    const lead = (first.getDay() + 6) % 7;
    const dim = new Date(Y, M, 0).getDate();
    const byDay = {};
    KAL_ITEMS.forEach((k, i) => { if (k.kuupaev.slice(0, 7) === ym) { const dd = +k.kuupaev.slice(8, 10); (byDay[dd] = byDay[dd] || []).push({ k, i }); } });
    const cells = [];
    for (let x = 0; x < lead; x++) cells.push(`<div class="cal-cell off"></div>`);
    for (let dd = 1; dd <= dim; dd++) {
      const today = ym === "2026-06" && dd === 10;
      cells.push(`<div class="cal-cell ${today ? "today" : ""}">
        <div class="cal-d mono">${dd}</div>
        ${(byDay[dd] || []).map(({ k, i }) => { const ki = kdIcon(k.tyyp);
          return `<button class="cal-chip" data-ki="${i}" title="${k.tyyp} · ${k.objekt}"><span class="kd-ic ${ki.cls}" style="width:13px;height:13px">${ki.ic}</span><span>${k.tyyp}</span></button>`; }).join("")}
      </div>`);
    }
    body = `
    <div class="card pad reveal">
      <div class="between" style="margin-bottom:16px">
        <a class="btn btn-ghost btn-sm" href="#/kalender/kuu/${ymOf(prev)}">${I.back} ${monthName(ymOf(prev))}</a>
        <h2 style="font-size:16px">${monthName(ym)}</h2>
        <a class="btn btn-ghost btn-sm" href="#/kalender/kuu/${ymOf(next)}">${monthName(ymOf(next))} ${I.arrow}</a>
      </div>
      <div class="cal-head">${["E","T","K","N","R","L","P"].map(x => `<div>${x}</div>`).join("")}</div>
      <div class="cal-grid">${cells.join("")}</div>
    </div>`;
  }

  return `
  <div class="view">
    <div class="page-head reveal"><div><h1 class="page-h1">Kalender</h1></div></div>
    ${toolbar}
    ${body}
  </div>`;
};

/* kirje detailisisu — jagatud loendi inline-paneeli ja kuuvaate popupi vahel */
function kalDetailCore(i) {
  const k = KAL_ITEMS[i]; if (!k) return null;
  const ref = kdDocRef(k); const kt = KTYYP(k.tyyp); const ki = kdIcon(k.tyyp);
  const d = Math.ceil((new Date(k.kuupaev) - DEMO_TODAY) / 86400000);
  let detail = `<div style="font-size:14px;line-height:1.6">${k.info}</div>`;
  let extra = "";
  if (kt === "indekseerimine") {
    const c = kdIndexCalc(k);
    if (c) detail = `
      <div style="background:var(--surface-soft);border-radius:8px;padding:8px 16px">
        <div class="price-row"><span class="lbl">Vana üür</span><span class="calc">${c.meetod}</span><span class="amt mono">${eur(c.vana)} €</span></div>
        <div class="price-row"><span class="lbl">Uus üür</span><span class="calc">+${c.pctTxt}%</span><span class="amt mono" style="color:var(--accent-deep)">${eur(c.uus)} €</span></div>
      </div>
      <div class="muted" style="font-size:14px;margin-top:12px">Indeksi väärtus: ${c.idx}.</div>
      <div style="margin-top:12px">${pill("rakendub automaatselt","accent")}</div>
      <div class="muted" style="font-size:12px;margin-top:12px">Korraline indekseerimine ei nõua lepingu muudatust — uut lisa ega allkirjastamist ei teki. Rakendumisel: kanne audit trail'i + teavitus mõlemale poolele.</div>`;
    extra = ref && ref.kind === "lease"
      ? `<button class="btn btn-ghost btn-sm" onclick="closeKal();location.hash='${ref.href}';toast('Erikokkulepe (nt vahelejätt) vormistatakse muudatusena: uus lisa nr → kinnitus → aktsept → allkirjastamine (etapp 08)')">${I.edit} Vormista erandina muudatus</button>`
      : `<div class="muted" style="font-size:12px">Imporditud leping — muudatusi platvormis ei vormistata (originaal on tõde).</div>`;
  } else if (kt === "loppemine") {
    const teavitus = d > 90 ? `Teavitus plaanis ${d - 90} päeva pärast (90 p enne lõppu, operaator + klient).`
      : `Teavitus saadetud — operaatorile ja kliendile (90 p reegel).`;
    detail += `<div class="divline"></div><div class="overline" style="margin-bottom:8px">90-päevase teavituse seis</div>
      <div class="flex" style="gap:8px;align-items:flex-start">${d > 90 ? pill("Plaanis", "grey") : pill("Saadetud", "green")}<span class="muted" style="font-size:14px">${teavitus}</span></div>`;
    extra = ref ? (ref.kind === "lease"
      ? `<button class="btn btn-ghost btn-sm" onclick="closeKal();location.hash='${ref.href}';toast('Muudatus: uus lisa nr → kinnitus → aktsept → allkirjastamine (etapp 08)')">${I.edit} Alusta muudatust</button>`
      : `<div class="muted" style="font-size:12px">Imporditud leping — muudatusi platvormis ei vormistata (originaal on tõde).</div>`) : "";
  }
  return { k, ref, kt, ki, d, detail, extra };
}

/* sulgeb nii loendi inline-paneeli kui kuuvaate popupi */
function closeKal() {
  const ex = document.querySelector(".kal-expand"); if (ex) ex.remove();
  document.querySelectorAll(".kal-row.open").forEach(r => r.classList.remove("open"));
  const m = document.getElementById("kal-pop"); if (m) m.remove();
}

/* loendivaade: detail avaneb klõpsatud rea ALLA (sama muster kui portfellis) */
function kalExpand(rowEl, i) {
  const existing = document.querySelector(".kal-expand");
  const wasOpen = existing && existing.dataset.for === String(i);
  closeKal();
  if (wasOpen) return;
  const c = kalDetailCore(i); if (!c) return;
  const exp = document.createElement("div");
  exp.className = "kal-expand"; exp.dataset.for = i;
  exp.innerHTML = `<div class="kal-exp-in">${c.detail}${c.extra ? `<div class="divline"></div>${c.extra}` : ""}</div>`;
  rowEl.after(exp);
  rowEl.classList.add("open");
}

/* kuuvaade: detail avaneb keskele popupina */
function kalModal(i) {
  closeKal();
  const c = kalDetailCore(i); if (!c) return;
  const k = c.k;
  const wrap = document.createElement("div");
  wrap.className = "kal-pop-wrap"; wrap.id = "kal-pop";
  wrap.innerHTML = `
    <div class="kal-pop-scrim"></div>
    <div class="kal-pop card">
      <div class="flex" style="gap:12px;margin-bottom:16px"><span class="kd-ic lg ${c.ki.cls}">${c.ki.ic}</span>
        <div><div class="overline">${k.tyyp}</div>
        <div style="font-weight:700;font-size:16px;margin-top:2px">${k.objekt}</div>
        <div class="muted mono" style="font-size:12px;margin-top:2px">${k.kuupaev.split("-").reverse().join(".")} · ${c.d} päeva pärast</div></div></div>
      ${c.detail}
      ${c.extra ? `<div class="divline"></div>${c.extra}` : ""}
      <div class="wrap-actions" style="margin-top:16px">
        ${c.ref ? `<a class="btn btn-primary" style="flex:1;justify-content:center" href="${c.ref.href}" onclick="closeKal()">${I.arrow} Ava ${c.ref.kind === "offer" ? "pakkumus" : c.ref.kind === "tl" ? "tööleping" : "leping"}</a>` : ""}
        <button class="btn btn-ghost" onclick="closeKal()">Sulge</button></div>
    </div>`;
  wrap.querySelector(".kal-pop-scrim").onclick = closeKal;
  (document.getElementById("app-view") || document.body).appendChild(wrap);
}

View.kalender.init = () => {
  document.querySelectorAll(".kal-row[data-ki]").forEach(el => el.onclick = (ev) => {
    if (ev && ev.target && ev.target.closest && ev.target.closest("a")) return;
    kalExpand(el, +el.dataset.ki);
  });
  document.querySelectorAll(".cal-chip[data-ki]").forEach(el => el.onclick = () => kalModal(+el.dataset.ki));
  /* tüübi- ja objektifilter (klientsiipselt; tühjad nädalagrupid peituvad) */
  const apply = () => {
    closeKal();
    const onBtn = document.querySelector("#kal-tyybid .pf-view.on");
    const kt = onBtn && onBtn.dataset ? onBtn.dataset.kt : "";
    const ob = document.getElementById("kal-obj");
    const ko = ob ? (ob.value || "") : "";
    document.querySelectorAll("[data-ki]").forEach(el => {
      const hit = (!kt || el.dataset.kt === kt) && (!ko || el.dataset.ko === ko);
      el.style.display = hit ? "" : "none";
    });
    let any = false;
    document.querySelectorAll("[data-kwk]").forEach(g => {
      const has = [...g.querySelectorAll("[data-ki]")].some(el => el.style.display !== "none");
      g.style.display = has ? "" : "none"; if (has) any = true;
    });
    const e = document.getElementById("kal-tyhi"); if (e) e.style.display = any ? "none" : "";
  };
  document.querySelectorAll("#kal-tyybid .pf-view").forEach(b => b.onclick = () => {
    document.querySelectorAll("#kal-tyybid .pf-view").forEach(x => x.classList.remove("on"));
    b.classList.add("on"); apply();
  });
  const ob = document.getElementById("kal-obj");
  if (ob) ob.onchange = apply;
};

/* ---------- Audit trail --------------------------------------------------- */
View.audit = () => `<div class="view">
  <div class="page-head reveal"><div><h1 class="page-h1">Tegevuste jälg</h1></div>
    <button class="btn btn-ghost">${I.file} Ekspordi (PDF)</button></div>
  <div class="card pad reveal">
    <div class="tl">
      ${AUDIT.map(a => `<div class="tl-item"><div class="tl-dot"><div class="tl-date">${a.aeg}</div></div>
        <div class="tl-body"><div class="t">${a.tegevus}</div><div class="s">${a.autor}</div></div></div>`).join("")}
    </div>
  </div>
</div>`;

/* ---------- Kliendiportaal: minu dokumendid -------------------------------- */
View.portaal = () => {
  const c = roleClient();
  /* klient näeb pakkumust/lepingut alles pärast saatmist — mustandid on operaatori omad */
  const offers = OFFERS.filter(o => o.clientId === c.id && clientSeesOffer(o));
  const leases = LEASES.filter(l => l.clientId === c.id && clientSeesLease(l));
  const eesnimi = c.kontakt.split(" ")[0];
  const demoable = CLIENTS.filter(x => OFFERS.some(o => o.clientId === x.id && clientSeesOffer(o)) || LEASES.some(l => l.clientId === x.id && clientSeesLease(l)));
  if (!demoable.some(x => x.id === c.id)) demoable.unshift(c);

  const offerRow = (o) => { const t = offerTotals(o); const d = daysUntil(o.kehtivKuni);
    return `<tr class="clickable" onclick="location.hash='#/pakkumus/${o.id}'">
      <td><div style="font-weight:600">${t.spaces.map(s=>`${s.nimi} · ${eur(s.yyripind,1)} m²`).join(", ")} · ${hoonedOf(t.spaces)}</div>
        <div class="muted mono" style="font-size:12px">${o.id} · ${o.pikkusKuud} kuud · kehtib kuni ${o.kehtivKuni}${d>=0&&d<=7?` (${d} p)`:""}</div></td>
      <td>${pill(o.staatus)}</td>
      <td class="r mono">${eur(t.rentSum,0)} €</td></tr>`; };

  const leaseRow = (l) => { const sp = DB.spaceById(l.spaceId);
    const n = (l.kommentaarid||[]).filter(x=>x.staatus==="Ootel").length;
    return `<tr class="clickable" onclick="location.hash='#/leping/${l.id}'">
      <td><div style="font-weight:600">${sp.nimi} · ${objektOf(sp).nimi}</div>
        <div class="muted mono" style="font-size:12px">${l.id} · ${l.algus} – ${l.lopp}${n?` · ${n} kommentaari ootel`:""}</div>
        ${l.staatus==="Kehtiv" ? `<div style="margin-top:4px"><button class="steplink" onclick="event.stopPropagation();toast('Allkirjastatud konteinerid: K1 leping + plaanid · K2 Lisa 3 (ASiC-E) — allalaadimine demos illustratiivne')">↓ PDF (K1 + K2)</button></div>` : ""}</td>
      <td>${pill(l.staatus)}</td>
      <td class="r mono">${eur(rent(sp),0)} €</td></tr>`; };

  /* Tähtajad (spets 7.3): kliendi enda lepingutest + pakkumuse lingi aegumine */
  const tahtajad = [];
  leases.forEach(l => {
    if (l.indeks && l.indeks.jargmine) tahtajad.push({ d: l.indeks.jargmine, t: "Indekseerimine", s: `${l.id} · ${l.indeks.meetod} ${l.indeks.maar || ""} — rakendub automaatselt` });
    if (l.lopp) tahtajad.push({ d: l.lopp, t: "Lepingu lõppemine", s: `${l.id} — teavitus ${(SEADED.teavitused || {}).lepp || 90} päeva ette, ka meilile` });
  });
  offers.filter(o => o.staatus === "Saadetud").forEach(o => tahtajad.push({ d: o.kehtivKuni, t: "Pakkumuse link aegub", s: `${o.id} — otsustage enne tähtaega` }));
  tahtajad.sort((a, b) => parseEE(a.d) - parseEE(b.d));

  /* Vestlus (spets 7.3): sama CommunicationThread, mida operaator näeb Suhtluses */
  const minuTh = suhtlusThreads().filter(t => t.klient === c.nimi);
  const conv = minuTh.find(t => t.id === PO_SEL) || minuTh[0];

  return `
  <div class="view">
    <div class="between reveal" style="margin-bottom:20px;align-items:flex-end">
      <div>
        <div class="overline">${ACCOUNT.landlord.nimi} · kliendiportaal</div>
        <div class="greet" style="margin-top:8px">Tere, ${eesnimi}. <span class="accent-word">Teie dokumendid.</span></div>
      </div>
      <div class="field" style="margin:0"><select id="persona-pick" style="padding:8px 12px;font-size:14px">
        ${demoable.map(x=>`<option value="${x.id}" ${x.id===c.id?'selected':''}>${x.nimi}</option>`).join("")}</select></div>
    </div>

    <div class="grid" style="gap:20px">
      <div class="card reveal">
        <div class="card-h"><h3>Hinnapakkumised</h3><span class="overline">${offers.length} tk</span></div>
        <table class="tbl"><tbody>
          ${offers.length ? offers.map(offerRow).join("") : `<tr><td class="muted" style="padding:20px">Pakkumusi pole.</td></tr>`}
        </tbody></table>
      </div>
      <div class="card reveal">
        <div class="card-h"><h3>Minu lepingud</h3><span class="overline">${leases.length} tk</span></div>
        <table class="tbl"><tbody>
          ${leases.length ? leases.map(leaseRow).join("") : `<tr><td class="muted" style="padding:20px">Lepinguid pole.</td></tr>`}
        </tbody></table>
      </div>
      <div class="card reveal">
        <div class="card-h"><h3>Tähtajad</h3><span class="overline">${tahtajad.length} tk</span></div>
        ${tahtajad.length ? tahtajad.map(k => `
        <div class="flex" style="gap:12px;padding:12px 20px;border-top:1px solid var(--line)">
          <span class="mono" style="flex:none;font-size:14px;font-weight:600">${k.d}</span>
          <div style="min-width:0"><b style="font-size:14px">${k.t}</b>
            <div class="muted" style="font-size:12px">${k.s}</div></div>
        </div>`).join("") : `<div class="muted" style="padding:20px;font-size:14px">Tähtaegu pole — need tekivad allkirjastatud lepingust.</div>`}
        <div class="muted" style="padding:12px 20px 16px;font-size:12px;border-top:1px solid var(--line)">Kõik teavitused saadetakse ka meilile: <span class="mono">${(c.konto && c.konto.epost) || c.epost}</span></div>
      </div>
      <div class="card reveal suh-thread" style="min-height:320px;max-height:430px">
        <div class="suh-head">
          <div style="flex:1;min-width:0"><b style="font-size:14px">Vestlus üürileandjaga</b>
            <div class="muted" style="font-size:12px;margin-top:2px">${conv ? "punktikommentaarid + vabavestlus samas voos" : "vestlus algab dokumendist"}</div></div>
          ${minuTh.length > 1 ? `<select id="po-doc" style="padding:8px 12px;font-size:14px">
            ${minuTh.map(t => `<option value="${t.id}" ${conv && t.id === conv.id ? "selected" : ""}>${t.docT} ${t.id}</option>`).join("")}</select>`
            : conv ? `<span class="tag">${conv.docT} · ${conv.id}</span>` : ""}
        </div>
        ${conv ? `
        <div class="suh-msgs">
          ${conv.msgs.slice(-6).map(m => `
          <div class="msg ${m.who === "op" ? "" : "me"}">
            <div class="mb">
              ${m.ref ? `<span class="msg-ref">${m.ref}</span>` : ""}
              <div class="tx">${m.tekst}</div>
              <div class="mm"><span>${m.who === "op" ? ACCOUNT.landlord.nimi : "Teie"}</span><span class="mono">${m.aeg}</span></div>
            </div>
          </div>`).join("")}
        </div>
        <div class="suh-foot">
          <div class="flex" style="gap:8px">
            <input id="po-in" placeholder="Kirjuta üürileandjale…" autocomplete="off"/>
            <button class="comp-send" id="po-send" title="Saada">${I.up}</button>
          </div>
          <div class="muted" style="font-size:12px;margin-top:8px">Vastab üürileandja meeskond — sõnum jõuab ka meilile. Kogu suhtlus logitakse dokumendi juurde.</div>
        </div>` : `<div class="empty" style="padding:32px"><div>Vestlusi pole veel.</div></div>`}
      </div>
      <div class="card pad reveal">
        <div class="overline" style="margin-bottom:12px">Üürileandja kontakt</div>
        <dl class="kv">
          <dt>Ettevõte</dt><dd>${ACCOUNT.landlord.nimi}</dd>
          <dt>E-post</dt><dd class="mono">${ACCOUNT.landlord.epost}</dd>
          <dt>Telefon</dt><dd class="mono">${ACCOUNT.landlord.mobiil}</dd>
          <dt>Objekt</dt><dd>${multiObj() ? OBJEKTID.map(o=>o.nimi).join(" · ") : OBJEKT.nimi} · ${OBJEKT.ehr.aadress}</dd>
        </dl>
      </div>
    </div>
  </div>`;
};
let PO_SEL = null; /* portaali vestluse valitud dokument */
View.portaal.init = () => {
  const s = document.getElementById("persona-pick");
  if (s) s.onchange = e => setRole("client", e.target.value);
  const pd = document.getElementById("po-doc");
  if (pd) pd.onchange = () => { PO_SEL = pd.value; router(); };
  /* kliendi sõnum → sama CommunicationThread → operaatori Suhtluses vastamata */
  const c = roleClient();
  const minuTh = suhtlusThreads().filter(t => t.klient === c.nimi);
  const conv = minuTh.find(t => t.id === PO_SEL) || minuTh[0];
  const inp = document.getElementById("po-in");
  const send = () => {
    const v = inp ? inp.value.trim() : "";
    if (!v || !conv) return;
    conv.doc.vestlus = conv.doc.vestlus || [];
    conv.doc.vestlus.push({ who: "client", autor: c.kontakt + " (üürnik)", aeg: NOW_EE() + " 11:0" + (conv.doc.vestlus.length % 10), tekst: v });
    AUDIT.unshift({ aeg: NOW_EE(), autor: c.kontakt + " (üürnik)", tegevus: `${conv.id}: kliendi sõnum (CommunicationThread) — ilmub operaatori Suhtlusesse vastamata.` });
    DB.save(); toast("Saadetud üürileandjale — vastus tuleb ka meilile"); router();
  };
  const sb2 = document.getElementById("po-send");
  if (sb2) sb2.onclick = send;
  if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
};

/* ---------- Ülevaate skoop: kogu portfell (oid puudub/vale) või üks objekt --------------
   Kõik mõõdikud, hero, pipeline ja vertikaalide plokid loevad AINULT siit, mitte globaalidest.
   Töölepingud ei ole objektipõhised → paistavad ainult kogu-portfelli skoobis. */
function ylScope(oid) {
  const objekt = (oid && DB.objektById(oid)) || null;
  const inObj = (ids) => !objekt || ids.includes(objekt.id);
  const spObj = (id) => { const s = DB.spaceById(id); return s ? objektOf(s).id : null; };
  return {
    objekt,
    spaces:    SPACES.filter(s => inObj([objektOf(s).id])),
    offers:    OFFERS.filter(o => inObj((o.spaceIds || [o.spaceId]).map(spObj))),
    leases:    LEASES.filter(l => inObj([spObj(l.spaceId)])),
    imports:   IMPORDITUD.filter(x => inObj(impObjektid(x))),
    keyDates:  KEY_DATES.filter(k => inObj(kdObjektid(k))),
    tlepingud: objekt ? [] : TLEPINGUD,
  };
}

/* objektikaart (jagatud: Ülevaade + Portfell › Esemed): täituvusriba, vabad, €/kuu, järgmine tähtaeg */
/* üksiku objektiga ettevõttel täidab rea teise poole „Lisa objekt" kutse */
function objAddCard() {
  return `
  <a class="obj-add reveal" href="#/objekt-uus">
    <span class="oa-ic">${I.plus}</span>
    <div><div class="t">Lisa objekt</div>
    <div class="s">EHR autotäide · pindade CSV-import</div></div>
  </a>`;
}

/* objekti koondnäitajad (jagatud kaardi ja loendirea vahel) */
function objStats(o) {
  const dIso = (iso) => Math.ceil((new Date(iso) - DEMO_TODAY) / 86400000);
  const sp = SPACES.filter(s => objektOf(s).id === o.id);
  const hoiv = sp.filter(s => ["Üüritud","Lepingus"].includes(s.staatus));
  const m2 = sp.reduce((s,x) => s + x.yyripind, 0);
  const om2 = hoiv.reduce((s,x) => s + x.yyripind, 0);
  const vaba = sp.filter(s => s.staatus === "Vaba");
  const nextKd = KEY_DATES.map(k => ({ k, d: dIso(k.kuupaev) })).filter(x => x.d >= 0)
    .sort((a,b) => a.d - b.d).find(x => kdObjektid(x.k).includes(o.id));
  return { sp, m2, pct: m2 ? Math.round(om2 / m2 * 100) : 0, vaba, vabaM2: vaba.reduce((s,x) => s + x.yyripind, 0),
    rent: hoiv.reduce((s,x) => s + rent(x), 0), nextKd: nextKd ? nextKd.k : null,
    boksid: sp.length > 0 && sp.every(s => s.tyyp === "Laoboks") };
}

function objMiniCard(o) {
  const st = objStats(o);
  return `
  <a class="card pad obj-mini reveal" href="#/objekt/${o.id}">
    <div class="between" style="margin-bottom:12px">
      <div style="font-weight:700;font-size:16px">${o.nimi}</div>
      <span class="mono" style="font-size:14px;font-weight:600">${st.pct}%</span>
    </div>
    <div class="bar" style="margin-bottom:16px"><i style="width:${st.pct}%"></i></div>
    <dl class="kv" style="gap:8px 16px">
      <dt>Vabu pindu</dt><dd class="mono">${st.vaba.length} tk · ${eur(st.vabaM2,0)} m²</dd>
      <dt>Üüritulu</dt><dd class="mono">${eur(st.rent,0)} € / kuu</dd>
      <dt>Järgmine tähtaeg</dt><dd class="mono">${st.nextKd ? fmtShort(st.nextKd.kuupaev) + " · " + st.nextKd.tyyp : "—"}</dd>
    </dl>
  </a>`;
}

/* objektide plokk (jagatud: Ülevaade + Portfell › Esemed) — kuni OBJ_CARD_MAX objekti kaartidena,
   sealt edasi kompaktne loend kiirfiltriga (kümned ühe üürnikuga objektid = erakinnisvara muster) */
const OBJ_CARD_MAX = 3;
function objektidBlock(objs, withAdd) {
  if (objs.length <= OBJ_CARD_MAX) return `
    <div class="grid g2" style="gap:16px;margin-bottom:24px">
      ${objs.map(objMiniCard).join("")}
      ${withAdd && objs.length === 1 ? objAddCard() : ""}
    </div>`;
  const row = (o) => { const st = objStats(o);
    /* ühe üksusega objekt (korter, maja) → üürniku nimi; mitmega → vabade arv ja m² */
    const kes = st.sp.length === 1
      ? (st.sp[0].tenant ? `<span style="font-weight:600">${st.sp[0].tenant}</span>` : `<span class="muted">vaba</span>`)
      : `${st.vaba.length} vaba · ${eur(st.vabaM2,0)} m²`;
    return `<tr class="clickable" data-row="1" onclick="location.hash='#/objekt/${o.id}'">
      <td><div style="font-weight:600">${o.nimi}</div><div class="muted" style="font-size:12px">${o.ehr ? o.ehr.aadress : ""}</div></td>
      <td class="mono">${st.sp.length} ${st.boksid ? "boksi" : st.sp.length === 1 ? "üksus" : "pinda"} · ${eur(st.m2,0)} m²</td>
      <td><span class="bar"><i style="width:${st.pct}%"></i></span><span class="mono" style="font-size:14px;font-weight:600">${st.pct}%</span></td>
      <td class="mono" style="font-size:14px">${kes}</td>
      <td class="r mono">${eur(st.rent,0)} €</td>
      <td class="mono" style="font-size:14px">${st.nextKd ? fmtShort(st.nextKd.kuupaev) + " · " + st.nextKd.tyyp : "—"}</td>
    </tr>`; };
  return `
    <div class="pf-toolbar reveal">
      <div class="pf-search">${I.search}<input id="obj-q" placeholder="Filtreeri: objekt, aadress, üürnik…" autocomplete="off"/></div>
      <span class="muted" style="margin-left:auto;font-size:14px">${objs.length} objekti</span>
    </div>
    <div class="card reveal obj-list" style="overflow:hidden;margin-bottom:24px">
      <table class="tbl">
        <thead><tr><th>Objekt</th><th>Üksused</th><th>Täituvus</th><th>Üürnik / vabad</th><th class="r">€ / kuu</th><th>Järgmine tähtaeg</th></tr></thead>
        <tbody>${objs.map(row).join("")}</tbody>
      </table>
    </div>`;
}

/* kiirfilter: peidab read, mis ei sisalda otsingusõnu (jagatud objektiloendi ja portfelli vahel) */
function wireQuickFilter(inputId, rowSel, onFilter) {
  const q = document.getElementById(inputId);
  if (!q) return;
  q.addEventListener("input", () => {
    const v = q.value.trim().toLowerCase();
    document.querySelectorAll(rowSel).forEach(tr => {
      tr.style.display = !v || (tr.textContent || "").toLowerCase().includes(v) ? "" : "none";
    });
    if (onFilter) onFilter();
  });
}

/* ---------- Ülevaade: „Kuidas meil läheb?" (juhi/CFO kokpit) ----------------
   Skoop: kogu portfell või üks objekt (#/ylevaade/<objektId>) — päises skoobi-pill.
   1) 4 meetrikakaarti  2) kinnisvara plokk (täituvuse hero + objektid)  3) pipeline-read
   4) vertikaalide plokid, mis ilmuvad ainult andmete olemasolul (Teenuslepingud, Personal)
   5) Ekspordi (3 valmisaruannet) */

/* Teenuslepingud (haldus/hooldus/kindlustus/valve …): imporditud lepingud, mis LIIGID järgi
   kuuluvad teenuste vertikaali — kulu ja järgmine otsustuskoht */
function teenusedBlock(sc) {
  const ts = sc.imports.filter(x => LIIGID[x.liik] === "teenused");
  if (!ts.length) return "";
  const kulu = ts.reduce((s,x) => s + (impKuutasu(x) || 0), 0);
  const liigid = [...new Set(ts.map(x => x.liik.replace(/leping$/, "")))].join(" · ");
  const next = ts.map(x => ({ x, j: impJargmine(x) })).filter(a => a.j).sort((a,b) => a.j.paev - b.j.paev)[0];
  return `
    <div class="sec-h reveal"><h2>Teenuslepingud</h2><span class="meta">${liigid}</span></div>
    <div class="met-grid met-grid-3 reveal">
      <a class="card pad met" href="#/portfell/lepingud" onclick="pfPresetType('teenused')"><div class="l">Lepinguid</div><div class="n mono">${ts.length}<small>tk</small></div><div class="s">imporditud · osalevad tähtaegades ja Q&amp;A-s</div></a>
      <a class="card pad met" href="#/portfell/lepingud" onclick="pfPresetType('teenused')"><div class="l">Kulu</div><div class="n mono">${eur(kulu,0)}<small>€/kuu</small></div><div class="s">tasud kokku (neto) · aastapreemiad kuu kaupa</div></a>
      <a class="card pad met" href="#/kalender"><div class="l">Järgmine otsustuskoht</div><div class="n mono">${next ? next.j.paev : "—"}<small>${next ? "päeva" : ""}</small></div><div class="s">${next ? `${next.j.kuupaev} · ${next.x.liik} · ${next.j.tekst}` : "tähtaegu pole"}</div></a>
    </div>`;
}

/* Personal (töölepingute vertikaal) — ettevõttetasemel, mitte objektipõhine */
function personalBlock() {
  if (!AMETIKOHAD.length) return "";
  const kvoot = AMETIKOHAD.reduce((s,a) => s + a.kvoot, 0);
  const taidetud = AMETIKOHAD.reduce((s,a) => s + ametikohtHoive(a), 0);
  const katseajad = TLEPINGUD.filter(t => t.staatus === "Kehtiv" && daysUntil(String(t.katseaegLopp).slice(0,10)) >= 0);
  const palgad = TLEPINGUD.filter(t => t.staatus === "Kehtiv" && t.palgaylevaatus);
  return `
    <div class="sec-h reveal"><h2>Personal</h2><span class="meta">osakond ${OSAKOND.nimi}</span></div>
    <div class="met-grid met-grid-3 reveal">
      <a class="card pad met" href="#/register"><div class="l">Ametikohad</div><div class="n mono">${taidetud}<small>/${kvoot} täidetud</small></div><div class="s">${kvoot - taidetud ? (kvoot - taidetud) + " vaba kohta" : "kõik täidetud"}</div></a>
      <a class="card pad met" href="#/kalender"><div class="l">Katseajad</div><div class="n mono">${katseajad.length}<small>käimas</small></div><div class="s">${katseajad.length ? "järgmine lõpeb " + katseajad.map(t=>t.katseaegLopp).sort()[0] : "—"}</div></a>
      <a class="card pad met" href="#/kalender"><div class="l">Palgaülevaatused</div><div class="n mono">${palgad.length}<small>kokku lepitud</small></div><div class="s">${palgad.length ? "järgmine " + palgad.map(t=>t.palgaylevaatus).sort((a,b)=>parseEE(a)-parseEE(b))[0] : "—"}</div></a>
    </div>`;
}

/* skoobi-juhtelement päises: üks objekt → staatiline silt; mitu → rippmenüü (Kogu portfell + objektid) */
function ylScopeCtl(sc) {
  if (!multiObj()) return `<span class="tag">${OBJEKT.nimi} · ${SPACES.length} pinda</span>`;
  const lbl = sc.objekt ? sc.objekt.nimi : `Kogu portfell · ${OBJEKTID.length} objekti`;
  const item = (href, t, on, sub) => `<a class="up-item" href="${href}"><span>${t}${sub ? `<span class="muted" style="font-weight:500;font-size:12px"> · ${sub}</span>` : ""}</span>${on ? `<span class="tick">${I.check}</span>` : ""}</a>`;
  return `
    <div class="pop-wrap" style="display:inline-block">
      <button class="preset-btn" id="yl-scope-btn">${lbl}${I.chevD}</button>
      <div class="drop drop-l" id="yl-scope-pop">
        <div class="up-lbl">Skoop</div>
        ${item("#/ylevaade", "Kogu portfell", !sc.objekt, `${OBJEKTID.length} objekti`)}
        ${OBJEKTID.map(o => item("#/ylevaade/" + o.id, o.nimi, sc.objekt && sc.objekt.id === o.id,
          `${SPACES.filter(s => objektOf(s).id === o.id).length} ${objStats(o).boksid ? "boksi" : "pinda"}`)).join("")}
      </div>
    </div>`;
}

View.ylevaade = (oid) => {
  const sc = ylScope(oid);
  const dIso = (iso) => Math.ceil((new Date(iso) - DEMO_TODAY) / 86400000);
  /* meetrikad — skoobist */
  const occ = sc.spaces.filter(s => ["Üüritud","Lepingus"].includes(s.staatus));
  const rentOcc = occ.reduce((s,x) => s + rent(x), 0);
  /* v388: 1. kaart on „Vabad pinnad" (täituvus % elab all hero-s — ei kordu üksteise peal) */
  const vabad = sc.spaces.filter(s => s.staatus === "Vaba");
  const vabaM2 = vabad.reduce((s,x) => s + x.yyripind, 0);
  const aktiivsed = sc.leases.filter(l => l.staatus === "Kehtiv").length + sc.tlepingud.filter(t => t.staatus === "Kehtiv").length + sc.imports.length;
  const t90 = sc.keyDates.filter(k => { const d = dIso(k.kuupaev); return d >= 0 && d <= 90; }).length;
  /* pipeline-loendurid */
  const pc = (sts) => sc.offers.filter(o => sts.includes(o.staatus)).length;
  const lc = (sts) => sc.leases.filter(l => sts.includes(l.staatus)).length + sc.tlepingud.filter(t => sts.includes(t.staatus)).length;

  const pstep = (n, t, href) => `<a class="pipe-step ${n ? "" : "zero"}" href="${href}"><b class="mono">${n}</b>${t}</a>`;

  return `
  <div class="view">
    <div class="page-head reveal">
      <div class="yl-head"><h1 class="page-h1">Ülevaade</h1>${ylScopeCtl(sc)}</div>
      <div class="pop-wrap">
        <button class="btn btn-ghost btn-sm" id="exp-btn">${I.file} Ekspordi ${I.chevD}</button>
        <div class="drop" id="exp-pop">
          <div class="up-lbl">Valmisaruanded · Excel / PDF</div>
          <button class="up-item" onclick="toast('Aruanne „Täituvus” (Excel/PDF) — demos illustratiivne')">${I.grid.replace('<svg','<svg class="ic"')}<span>Täituvus</span></button>
          <button class="up-item" onclick="toast('Aruanne „Rahavoog” (Excel/PDF) — demos illustratiivne')">${I.euro.replace('<svg','<svg class="ic"')}<span>Rahavoog</span></button>
          <button class="up-item" onclick="toast('Aruanne „Tähtajad” (Excel/PDF) — demos illustratiivne')">${I.cal.replace('<svg','<svg class="ic"')}<span>Tähtajad</span></button>
        </div>
      </div>
    </div>

    <!-- 1) neli meetrikakaarti — igaüks avab vastava vaate -->
    <div class="met-grid reveal">
      <a class="card pad met" href="#/register"><div class="l">Vabad pinnad</div><div class="n mono">${vabad.length}<small>tk</small></div><div class="s">${eur(vabaM2,0)} m² pakkumiseks</div></a>
      <a class="card pad met" href="#/lepingud"><div class="l">Üüritulu</div><div class="n mono">${eur(rentOcc,0)}<small>€/kuu</small></div><div class="s">aktiivsete summa (neto)</div></a>
      <a class="card pad met" href="#/lepingud"><div class="l">Aktiivsed lepingud</div><div class="n mono">${aktiivsed}<small>tk</small></div><div class="s">kehtivad · sh imporditud</div></a>
      <a class="card pad met" href="#/kalender"><div class="l">Tähtaegu 90 päeva sees</div><div class="n mono">${t90}<small>tk</small></div><div class="s">võtmekuupäevad</div></a>
    </div>

    <!-- 2) kinnisvara plokk: täituvuse hero + objektid (objektid ainult kogu-portfelli skoobis) -->
    ${taituvusCard(sc)}
    ${sc.objekt ? "" : `
    <div class="sec-h reveal" style="margin-top:8px"><h2>Objektid</h2>${OBJEKTID.length > OBJ_CARD_MAX ? `<a class="btn btn-ghost btn-sm" href="#/objekt-uus" style="margin-left:auto">${I.plus} Lisa objekt</a>` : ""}</div>
    ${objektidBlock(OBJEKTID, true)}`}

    <!-- 3) pipeline-read: iga faasi number on klikitav filter -->
    <div class="sec-h reveal"><h2>Pakkumuste ja lepingute seis</h2></div>
    <div class="card pad reveal" style="margin-bottom:24px">
      <div class="pipe">
        <span class="pipe-lbl">Pakkumused</span>
        ${pstep(pc(["Mustand"]), "Mustand", "#/pakkumised/mustand")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(pc(["Saadetud"]), "Saadetud", "#/pakkumised/saadetud")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(pc(["Kliendi ettepanek"]), "Läbirääkimisel", "#/pakkumised/labiraakimisel")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(pc(["Aktsepteeritud","Lepinguks teisendatud"]), "Aktsepteeritud", "#/pakkumised/aktsepteeritud")}
      </div>
      <div class="pipe" style="border-top:1px solid var(--line);margin-top:12px;padding-top:12px">
        <span class="pipe-lbl">Lepingud</span>
        ${pstep(lc(["Mustand V1"]), "Mustand", "#/lepingud/mustand")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(lc(["Saadetud"]), "Läbirääkimisel", "#/lepingud/labiraakimisel")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(lc(["Allkirjastamisel"]), "Allkirjastamisel", "#/lepingud/allkirjastamisel")}
      </div>
    </div>

    <!-- 4) teiste vertikaalide plokid — ilmuvad ainult andmete olemasolul;
            mitte-objektipõhised (Personal) ainult kogu-portfelli skoobis -->
    ${teenusedBlock(sc)}
    ${sc.objekt ? "" : personalBlock()}
  </div>`;
};
View.ylevaade.init = () => {
  const wire = (bid, pid) => { const b = document.getElementById(bid), p = document.getElementById(pid);
    if (b && p) b.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); p.classList.toggle("open"); }; };
  wire("exp-btn", "exp-pop");
  wire("yl-scope-btn", "yl-scope-pop");
  wireQuickFilter("obj-q", ".obj-list [data-row]");
};

/* ---------- Portfell: 3 tabi — Lepingud · Kliendid · Esemed ----------------- */
let PF_ROWS = []; /* viimati renderdatud lepinguread (külgpaneeli eelvaateks) */

function pfLepinguRows() {
  const rows = [];
  LEASES.forEach(l => { const cl = DB.clientById(l.clientId); const sp = DB.spaceById(l.spaceId);
    const tag = (l.pohi || []).find(p => p.ref.startsWith("Tagatisraha"));
    rows.push({ kind: "lease", id: l.id, klient: cl.nimi, ese: `${sp.nimi} · ${objektOf(sp).nimi}`, tyyp: "Üürileping",
      kuus: rent(sp), algus: l.algus, lopp: l.lopp, olek: l.staatus, imp: false, href: "#/leping/" + l.id,
      tagatis: tag ? tag.vaartus.split(" (")[0] : null, m2hind: sp.hind, m2: sp.yyripind,
      kontakt: { nimi: cl.kontakt, epost: cl.epost, tel: cl.tel }, indeks: l.indeks, l }); });
  TLEPINGUD.forEach(t => { const a = DB.ametikohtById(t.ametikohtId);
    rows.push({ kind: "tl", id: t.id, klient: t.isik, ese: `${a.nimi} · ${OSAKOND.nimi}`, tyyp: "Tööleping",
      kuus: a.tasu, algus: t.algus, lopp: t.tahtaeg === "Tähtajatu" ? "tähtajatu" : t.tahtaeg, olek: t.staatus, imp: false, href: "#/tooleping/" + t.id, t }); });
  IMPORDITUD.forEach(x => {
    const per = (x.parameetrid.find(p => p[0] === "Periood") || [])[1] || "";
    const mm = per.replace(/\s*\(.*\)/, "").split(" – ");
    const num = impKuutasu(x);
    const tagP = x.parameetrid.find(p => p[0] === "Tagatisraha");
    const impSp = x.liik === "Üürileping" ? SPACES.find(s => s.tenant === x.pool) : null;
    rows.push({ kind: "imp", id: x.id, klient: x.pool, ese: x.ese, tyyp: x.liik,
      kuus: num, algus: mm[0] || "—", lopp: mm[1] || "—", olek: "Kehtiv", imp: true, href: "#/imp/" + x.id,
      tagatis: tagP ? tagP[1].split(" (")[0] : null, m2hind: impSp ? impSp.hind : null, m2: impSp ? impSp.yyripind : null,
      indeksTxt: (x.parameetrid.find(p => p[0] === "Indekseerimine") || [])[1] || null, x }); });
  return rows;
}
/* tüübifilter vertikaalide konfiguratsioonist (LIIGID/VERTIKAALID): Kõik + iga vertikaal, millel
   ridu on (imporditud üürilepingud loevad üüri alla; haldus/hooldus/kindlustus = Teenuslepingud;
   registrile tundmatu liik paistab ainult „Kõik" all) */
const PF_TYPES = Object.assign({ koik: { t: "Kõik", f: () => true } },
  Object.fromEntries(Object.entries(VERTIKAALID).map(([id, v]) => [id, { t: v.t, f: r => LIIGID[r.tyyp] === id }])));
let PF_TYPE = "koik";
window.pfSetType = (t) => { if (PF_TYPES[t]) PF_TYPE = t; router(); };
/* eelvalik teisest vaatest tulles (nt Ülevaate teenuste kaart) — ilma re-renderduseta, hash viib kohale */
window.pfPresetType = (t) => { if (PF_TYPES[t]) PF_TYPE = t; };

/* salvestatud vaated — Aktiivsed on vaikimisi; lõppolekud paistavad AINULT arhiivis */
const PF_VIEWS = {
  aktiivsed:      { t: "Aktiivsed",              f: r => r.imp || r.olek === "Kehtiv" },
  labiraakimisel: { t: "Läbirääkimisel",         f: r => ["Mustand V1", "Saadetud", "Allkirjastamisel"].includes(r.olek) },
  loppevad:       { t: "Lõppevad 6 kuu jooksul", f: r => { const m = /^\d\d\.\d\d\.\d{4}$/.test(r.lopp) ? daysUntil(r.lopp) : null; return m != null && m >= 0 && m <= 183; } },
  imporditud:     { t: "Imporditud",             f: r => r.imp },
  arhiiv:         { t: "Arhiiv",                 f: r => ["Lõppenud", "Ennetähtaegselt lõpetatud", "Tühistatud"].includes(r.olek) },
};

View.portfell = (arg) => {
  const parts = (arg || "").split("/");
  const tab = ["lepingud", "pakkumused", "kliendid", "esemed"].includes(parts[0]) ? parts[0] : "lepingud";
  const sub = parts[1] || "";
  const tabs = [["lepingud", "Lepingud"], ["pakkumused", "Pakkumused"], ["kliendid", "Kliendid"], ["esemed", "Esemed"]];

  let body = "";
  if (tab === "pakkumused") {
    /* v407: pooleliolevad pakkumused on ka portfellis — sama loend mis #/pakkumised, filtrilingid jäävad sakki */
    body = `
    <div class="between reveal pf-offers-bar">
      ${offerFiltersHTML(sub, "#/portfell/pakkumused")}
      <a class="btn btn-primary btn-sm" href="#/pakkumus-uus">${I.offer} Uus pakkumine</a>
    </div>
    ${offerTableHTML(sub)}`;
  } else if (tab === "lepingud") {
    const vk = PF_VIEWS[sub] ? sub : "aktiivsed";
    const all = pfLepinguRows();
    /* aktiivne tüübikiip, millel ridu pole (nt pärast ettevõttevahetust), langeb tagasi „Kõik" peale */
    if (PF_TYPE !== "koik" && !all.some(PF_TYPES[PF_TYPE].f)) PF_TYPE = "koik";
    PF_ROWS = all.filter(PF_VIEWS[vk].f).filter(PF_TYPES[PF_TYPE].f);
    /* vaaterežiim: kaardid (vaikimisi) või loend — valik püsib localStorage'is */
    let mode = "cards";
    try { if (localStorage.getItem("thinkone_pf_mode") === "list") mode = "list"; } catch (e) {}
    const tyhi = vk === "arhiiv" ? "Arhiiv on tühi — lõppolekud paistavad ainult siin (nähtavusreegel)." : "Selles vaates lepinguid pole.";
    const cards = `
    <div class="pf-cards reveal">
      ${PF_ROWS.length ? PF_ROWS.map((r, i) => {
        /* perioodiriba: kui palju lepingust on käes (DEMO_TODAY järgi) — kaart jutustab aja ise */
        const dts = /^\d\d\./.test(r.algus) && /^\d\d\./.test(String(r.lopp));
        const pct = dts ? Math.max(0, Math.min(100, Math.round((DEMO_TODAY - parseEE(r.algus)) / (parseEE(r.lopp) - parseEE(r.algus)) * 100))) : 0;
        return `
      <div class="card pf-card" data-pfrow="${i}">
        <div class="between" style="margin-bottom:12px">
          <span class="tag">${r.tyyp}</span>
          <span style="display:inline-flex;gap:8px">${r.imp ? pill("Imporditud") : ""}${pill(r.olek)}</span>
        </div>
        <div class="t">${r.klient}</div>
        <div class="s">${r.id} · ${r.ese}</div>
        <div class="pf-foot">
          <span class="sum">${r.kuus != null ? eur(r.kuus, 0) + " €" : "—"}${r.kuus != null ? `<small> / kuu</small>` : ""}</span>
          <span class="per">${r.m2 != null ? `<b>${eur(r.m2, 0)} m²</b>` : ""}${r.m2 != null && r.m2hind != null ? " · " : ""}${r.m2hind != null ? `${eur(r.m2hind, 2)} €/m²` : ""}</span>
        </div>
        ${dts ? `
        <div class="pf-time"><span class="d">${r.algus}</span><span class="track"><i style="width:${pct}%"></i></span><span class="d">${r.lopp}</span></div>`
        : `<div class="pf-time"><span class="d">${r.algus === "—" && String(r.lopp) === "—" ? "periood määramata" : `${r.algus} – ${r.lopp}`}</span></div>`}
      </div>`; }).join("") : `<div class="card pad muted" style="grid-column:1/-1;font-size:14px">${tyhi}</div>`}
    </div>`;
    const loend = `
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Klient</th><th>Ese</th><th>Tüüp</th><th class="r">€ / kuu</th><th>Algus</th><th>Lõpp</th><th>Olek</th></tr></thead>
        <tbody>
        ${PF_ROWS.length ? PF_ROWS.map((r, i) => `
          <tr class="clickable" data-pfrow="${i}">
            <td><div style="font-weight:600">${r.klient}</div><div class="muted mono" style="font-size:12px">${r.id}</div></td>
            <td style="font-size:14px">${r.ese}</td>
            <td><span class="tag">${r.tyyp}</span>${r.imp ? ` ${pill("Imporditud")}` : ""}</td>
            <td class="r mono">${r.kuus != null ? eur(r.kuus, 0) + " €" : "—"}</td>
            <td class="mono">${r.algus}</td><td class="mono">${r.lopp}</td>
            <td>${pill(r.olek)}</td>
          </tr>`).join("") : `<tr><td class="muted" style="padding:20px" colspan="7">${tyhi}</td></tr>`}
        </tbody>
      </table>
    </div>`;
    body = `
    <div class="pf-toolbar reveal">
      <div class="pf-search">${I.search}<input id="pf-q" placeholder="Filtreeri: klient, ese, tunnus…" autocomplete="off"/></div>
      <div class="pf-views" data-glide="pf-tyyp">${Object.entries(PF_TYPES).filter(([k, v]) => k === "koik" || all.some(v.f)).map(([k, v]) => `<button class="pf-view ${k === PF_TYPE ? "on" : ""}" onclick="pfSetType('${k}')">${v.t}</button>`).join("")}</div>
      <span class="pf-sep"></span>
      <div class="pf-views" data-glide="pf-vaated">${Object.entries(PF_VIEWS).map(([k, v]) => `<a class="pf-view ${k === vk ? "on" : ""}" href="#/portfell/lepingud/${k}">${v.t}</a>`).join("")}</div>
      <div class="pf-mode" title="Vaade">
        <button class="${mode === "cards" ? "on" : ""}" onclick="pfSetMode('cards')" title="Kaardid">${I.grid}</button>
        <button class="${mode === "list" ? "on" : ""}" onclick="pfSetMode('list')" title="Loend">${I.rows}</button>
      </div>
    </div>
    ${mode === "cards" ? cards : loend}`;
  } else if (tab === "kliendid") {
    const viimane = (c) => {
      const ajad = [];
      LEASES.filter(l => l.clientId === c.id).forEach(l => (l.kommentaarid || []).forEach(k => ajad.push(k.aeg.split(" ")[0])));
      OFFERS.filter(o => o.clientId === c.id).forEach(o => {
        if (o.kliendiEttepanek) ajad.push(o.loodud);
        (o.labiraakimised || []).forEach(m => ajad.push(m.aeg.split(" ")[0]));
      });
      return ajad.sort((a, b) => parseEE(b) - parseEE(a))[0] || "—";
    };
    body = `
    <div class="pf-toolbar reveal">
      <div class="pf-search">${I.search}<input id="pf-q" placeholder="Filtreeri: nimi, registrikood…" autocomplete="off"/></div>
    </div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Nimi</th><th>Registrikood</th><th class="r">Lepinguid</th><th class="r">€ / kuu</th><th>Riskiskoor</th><th>Viimane suhtlus</th></tr></thead>
        <tbody>
        ${CLIENTS.map(c => { const cls = LEASES.filter(l => l.clientId === c.id);
          const sum = cls.filter(l => l.staatus === "Kehtiv").reduce((s, l) => s + rent(DB.spaceById(l.spaceId)), 0);
          return `<tr class="clickable" data-pfrow-k="1" onclick="location.hash='#/klient/${c.id}'">
            <td><div style="font-weight:600">${c.nimi}</div><div class="muted mono" style="font-size:12px">${c.kontakt}</div></td>
            <td class="mono">${c.registrikood}</td>
            <td class="r mono">${cls.length}</td>
            <td class="r mono">${sum ? eur(sum, 0) + " €" : "—"}</td>
            <td>${pill(c.risk.skoor)}<div class="muted mono" style="font-size:12px;margin-top:3px">${c.risk.kuupaev}</div></td>
            <td class="mono" style="font-size:14px">${viimane(c)}</td>
          </tr>`; }).join("")}
        </tbody>
      </table>
    </div>`;
  } else {
    const ek = sub === "ametikohad" ? "ametikohad" : "objektid";
    body = `
    <div class="pf-toolbar reveal">
      <div class="pf-views" data-glide="pf-esemed">
        <a class="pf-view ${ek === "objektid" ? "on" : ""}" href="#/portfell/esemed">Objektid</a>
        ${AMETIKOHAD.length ? `<a class="pf-view ${ek === "ametikohad" ? "on" : ""}" href="#/portfell/esemed/ametikohad">Ametikohad</a>` : ""}
      </div>
      ${ek === "objektid" ? `<a class="btn btn-primary btn-sm" href="#/objekt-uus" style="margin-left:auto">${I.plus} Lisa objekt</a>` : `<a class="steplink" href="#/register" style="margin-left:auto">Ava esemeregister →</a>`}
    </div>
    ${ek === "objektid" ? objektidBlock(OBJEKTID, false) : `
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Ametikoht</th><th class="r">Töötasu (bruto)</th><th class="r">Hõive</th><th>Olek</th></tr></thead>
        <tbody>
        ${AMETIKOHAD.map(a => { const h = ametikohtHoive(a);
          const tl = TLEPINGUD.find(t => t.ametikohtId === a.id && t.staatus === "Kehtiv");
          const pk = TLEPINGUD.find(t => t.ametikohtId === a.id && t.staatus !== "Kehtiv");
          const olek = h >= a.kvoot ? "Täidetud" : pk ? "Pakkumisel" : h > 0 ? "Osaline hõive" : "Täitmata";
          const link = tl ? "#/tooleping/" + tl.id : pk ? "#/tooleping/" + pk.id : "#/register";
          return `<tr class="clickable" onclick="location.hash='${link}'">
            <td><div style="font-weight:600">${a.nimi}</div><div class="muted" style="font-size:12px">${a.ylesanded}</div></td>
            <td class="r mono">${eur(a.tasu, 0)} €</td>
            <td class="r mono"><b>${h}</b> / ${a.kvoot}</td>
            <td>${pill(olek)}</td></tr>`; }).join("")}
        </tbody>
      </table>
    </div>`}`;
  }

  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Portfell</h1></div>
      <div class="tabbar">${tabs.map(([k, t]) => `<a class="${k === tab ? "active" : ""}" href="#/portfell/${k}">${t}</a>`).join("")}</div>
    </div>
    ${body}
  </div>`;
};

window.pfSetMode = (m) => { try { localStorage.setItem("thinkone_pf_mode", m); } catch (e) {} router(); };

View.portfell.init = () => {
  /* filtreeriv otsing: peidab read, mis ei sisalda otsingusõnu */
  wireQuickFilter("pf-q", "[data-pfrow],[data-pfrow-k]", () => {
    /* filtreerimine sulgeb avatud laienduse — ankurdatud rida võib kaduda */
    const ex = document.querySelector(".pf-expand"); if (ex) ex.remove();
    document.querySelectorAll(".pf-card.open").forEach(c => c.classList.remove("open"));
    document.querySelectorAll(".pf-cards.has-open").forEach(g => g.classList.remove("has-open"));
  });
  wireQuickFilter("obj-q", ".obj-list [data-row]");
  /* kaardi klikk → laiendus kaardirea alla; loendirea klikk → külgpaneeli eelvaade */
  document.querySelectorAll(".pf-cards [data-pfrow]").forEach(c => c.onclick = () => pfExpand(c));
  document.querySelectorAll("tr[data-pfrow]").forEach(tr => tr.onclick = () => pfPreview(PF_ROWS[+tr.dataset.pfrow]));
};

/* lepingurea „järgmine samm" — jagatud kaardilaienduse ja külgpaneeli vahel */
function pfNextStep(r) {
  const samm = r.kind === "lease" ? ({ "Mustand V1": "Saada mustand üürnikule ülevaatamiseks.",
      "Saadetud": (r.l.kommentaarid || []).some(c => c.staatus === "Ootel") ? "Vasta üürniku kommentaaridele." : "Oota üürniku otsust.",
      "Allkirjastamisel": "Lõpeta allkirjastamine (Smart-ID / Mobile-ID).",
      "Kehtiv": `Järgmine: indekseerimine ${r.l.indeks.jargmine} — automaatne.` }[r.olek] || "—")
    : r.kind === "tl" ? (r.olek === "Saadetud" ? "Tööpakkumine on kandidaadil ülevaatamisel." : r.olek === "Mustand V1" ? "Saada tööpakkumine kandidaadile." : `Järgmine: katseaja lõpp ${r.t.katseaegLopp}.`)
    : "Imporditud leping osaleb otsingus, Q&A-s ja kalendris; muudatusi ei vormistata.";
  const ootel = r.kind === "lease" ? (r.l.kommentaarid || []).filter(c => c.staatus === "Ootel").length : 0;
  return { samm, ootel };
}

/* kaardi eelvaade: avaneb kaardirea ALLA (mitte küljelt) — nool näitab, kelle oma.
   Sisu on spec-sheet: suured faktiplaadid, indekseerimise aktsentriba, kontaktirida. */
function pfExpandHTML(r) {
  const { samm, ootel } = pfNextStep(r);
  /* kaart ise jääb avatuna nähtavale (klient, olek, üür, m², periood on SEAL) —
     laiendus näitab AINULT seda, mida kaardil pole: tagatis, indekseerimine,
     kontakt, järgmine samm ja tegevused. Kordamine oli müra. */
  const facts = [];
  if (r.kind === "tl") { facts.push(["Algus", r.algus]); facts.push(["Tähtaeg", r.lopp]); }
  if (r.tagatis) facts.push(["Tagatis", r.tagatis]);
  const strip = r.kind === "lease" && r.indeks
    ? `<div class="pf-index">${I.trend}<div>Indekseerimine · ${r.indeks.meetod === "Fikseeritud %" ? "fikseeritud " + r.indeks.maar : r.indeks.maar} · ${r.indeks.sagedus} — järgmine <b>${r.indeks.jargmine}</b></div></div>`
    : r.kind === "imp" && r.indeksTxt
    ? `<div class="pf-index">${I.trend}<div>Indekseerimine · ${r.indeksTxt} — <b>tuvastatud originaalist</b></div></div>`
    : r.kind === "tl" && (r.t.katseaegLopp || r.t.palgaylevaatus)
    ? `<div class="pf-index">${I.hourglass}<div>${r.t.katseaegLopp ? `Katseaeg kuni <b>${r.t.katseaegLopp}</b>` : ""}${r.t.katseaegLopp && r.t.palgaylevaatus ? " · " : ""}${r.t.palgaylevaatus ? `palgaülevaatus <b>${r.t.palgaylevaatus}</b>` : ""}</div></div>`
    : "";
  const kontakt = r.kontakt
    ? `<div class="pf-kontakt">${I.user}<div><b>${r.kontakt.nimi}</b> · ${r.kontakt.epost} · ${r.kontakt.tel}</div></div>`
    : r.kind === "tl"
    ? `<div class="pf-kontakt">${I.user}<div><b>${r.klient}</b> · ${r.t.roll === "kandidaat" ? "kandidaat" : "töötaja"} · osakond ${OSAKOND.nimi}</div></div>`
    : "";
  return `
  <div class="pf-exp-in">
    <div>
      ${facts.length ? `<div class="pf-facts" style="margin-top:0">${facts.map(f => `<div class="pf-fact"><div class="l">${f[0]}</div><div class="v">${f[1]}</div></div>`).join("")}</div>` : ""}
      ${strip}
      ${kontakt}
    </div>
    <div class="pf-exp-side">
      <div class="overline" style="margin-bottom:8px">Järgmine samm</div>
      <div style="font-size:14px;line-height:1.6">${samm}</div>
      <div class="wrap-actions" style="margin-top:16px">
        <button class="btn btn-ghost btn-sm" onclick="toast('PDF genereeritud — demos illustratiivne')">${I.file} Laadi PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('Auditikaust (kõik versioonid + suhtlus) eksporditud — demos illustratiivne')">${I.audit} Ekspordi auditikaust</button>
      </div>
      <div class="wrap-actions" style="margin-top:12px">
        <a class="btn btn-primary" href="${r.href}">${I.arrow} Ava</a>
        ${ootel ? `<a class="btn btn-primary" href="${r.href}">Vasta ettepanekutele (${ootel})</a>` : ""}
      </div>
    </div>
  </div>`;
}

function pfExpand(cardEl) {
  const grid = cardEl.parentElement;
  const existing = grid.querySelector(".pf-expand");
  const idx = cardEl.dataset.pfrow;
  const wasOpen = existing && existing.dataset.for === idx;
  if (existing) existing.remove();
  grid.querySelectorAll(".pf-card.open").forEach(c => c.classList.remove("open"));
  grid.classList.remove("has-open");
  if (wasOpen) return;
  const r = PF_ROWS[+idx]; if (!r) return;
  /* paneel läheb klõpsatud kaardi REA lõppu — nii ei jää ruudustikku auke */
  const cards = [...grid.querySelectorAll("[data-pfrow]")].filter(c => c.style.display !== "none");
  const pos = cards.indexOf(cardEl);
  const cols = getComputedStyle(grid).gridTemplateColumns.split(" ").length;
  const anchor = cards[Math.min(pos - (pos % cols) + cols - 1, cards.length - 1)];
  const exp = document.createElement("div");
  exp.className = "pf-expand"; exp.dataset.for = idx;
  exp.innerHTML = pfExpandHTML(r);
  anchor.after(exp);
  cardEl.classList.add("open");
  grid.classList.add("has-open");
  const gx = grid.getBoundingClientRect(), cx = cardEl.getBoundingClientRect();
  exp.style.setProperty("--cx", (cx.left - gx.left + cx.width / 2 - 7) + "px");
}

/* lepingurea eelvaade külgpaneelis (loendivaade): pooled · ese · summad · järgmine samm */
function pfPreview(r) {
  if (!r) return;
  const head = document.getElementById("side-head"), body = document.getElementById("side-body"), foot = document.getElementById("side-foot");
  const { samm, ootel } = pfNextStep(r);
  head.innerHTML = `<div class="overline">${r.tyyp}${r.imp ? " · imporditud" : ""}</div>
    <div style="font-weight:700;font-size:16px;margin-top:4px">${r.klient}</div>
    <div class="muted" style="font-size:14px;margin-top:2px">${r.id} · ${r.ese}</div>`;
  body.innerHTML = `
    <dl class="kv">
      <dt>Pooled</dt><dd style="font-size:14px">${ACCOUNT.landlord.nimi} ⋅ ${r.klient}</dd>
      <dt>Summa</dt><dd class="mono">${r.kuus != null ? eur(r.kuus, 0) + " € / kuu" : "—"}</dd>
      <dt>Periood</dt><dd class="mono">${r.algus} – ${r.lopp}</dd>
      <dt>Olek</dt><dd>${pill(r.olek)}</dd>
    </dl>
    <div class="divline"></div>
    <div class="overline" style="margin-bottom:8px">Järgmine samm</div>
    <div style="font-size:14px;line-height:1.6">${samm}</div>
    <div class="divline"></div>
    <div class="wrap-actions">
      <button class="btn btn-ghost btn-sm" onclick="toast('PDF genereeritud — demos illustratiivne')">${I.file} Laadi PDF</button>
      <button class="btn btn-ghost btn-sm" onclick="toast('Auditikaust (kõik versioonid + suhtlus) eksporditud — demos illustratiivne')">${I.audit} Ekspordi auditikaust</button>
    </div>`;
  foot.innerHTML = `<div class="wrap-actions">
    <a class="btn btn-primary" style="flex:1;justify-content:center" href="${r.href}" onclick="closeSide()">${I.arrow} Ava</a>
    ${ootel ? `<a class="btn btn-primary" href="${r.href}" onclick="closeSide()">Vasta ettepanekutele (${ootel})</a>` : ""}
  </div>`;
  document.getElementById("side").classList.add("open");
  document.getElementById("scrim").classList.add("open");
}

/* ---------- Kliendivaade 360° ----------------------------------------------- */
let PRE_CLIENT = null;
window.preOffer = (cid) => { PRE_CLIENT = cid; location.hash = "#/pakkumus-uus"; };

View.klient = (cid) => {
  const c = DB.clientById(cid); if (!c) return notFound("Klienti ei leitud");
  const cls = LEASES.filter(l => l.clientId === c.id);
  const offs = OFFERS.filter(o => o.clientId === c.id);
  const vestlused = [];
  cls.forEach(l => (l.kommentaarid || []).forEach(k => vestlused.push({ ...k, doc: l.id, href: "#/leping/" + l.id })));
  offs.forEach(o => {
    (o.labiraakimised || []).forEach(m => vestlused.push({ aeg: m.aeg, autor: m.autor, tekst: m.tekst,
      staatus: m.roll === "klient" && o.staatus === "Kliendi ettepanek" && o.kliendiEttepanek === m.tekst ? "Ootel" : "Vastatud", doc: o.id, href: "#/pakkumus/" + o.id }));
    if (o.kliendiEttepanek && !(o.labiraakimised || []).some(m => m.tekst === o.kliendiEttepanek))
      vestlused.push({ aeg: o.loodud, autor: c.kontakt + " (üürnik)", tekst: o.kliendiEttepanek, staatus: "Ootel", doc: o.id, href: "#/pakkumus/" + o.id });
  });
  const tahtajad = KEY_DATES.filter(k => k.objekt.includes(c.nimi));
  return `
  <div class="view">
    <a class="btn btn-ghost btn-sm reveal" href="#/portfell/kliendid" style="margin-bottom:20px">${I.back} Kliendid</a>
    <div class="page-head reveal">
      <div><div class="overline">Klient</div>
        <h1 class="page-h1" style="margin-top:8px">${c.nimi}</h1>
        <p class="page-sub mono" style="font-size:14px">Reg ${c.registrikood} · KMKR ${c.kmkr || "—"} · ${c.aadress} <span class="tag" style="margin-left:8px">e-äriregister</span></p></div>
      <div style="text-align:right">
        ${pill(c.risk.skoor)}<div class="muted mono" style="font-size:12px;margin-top:4px">päring ${c.risk.kuupaev}</div>
        <div class="wrap-actions" style="margin-top:12px;justify-content:flex-end">
          <a class="btn btn-ghost btn-sm" href="#/risk/${c.id}">${I.risk} Telli riskiraport</a>
          <button class="btn btn-primary btn-sm" onclick="preOffer('${c.id}')">${I.offer} Loo pakkumine sellele kliendile</button>
        </div>
      </div>
    </div>

    <div class="split">
      <div>
        <div class="sec-h reveal"><h2>Lepingud</h2><span class="meta">${cls.length} tk</span></div>
        <div class="card reveal" style="overflow:hidden;margin-bottom:24px">
          <table class="tbl"><tbody>
          ${cls.length ? cls.map(l => { const sp = DB.spaceById(l.spaceId); return `
            <tr class="clickable" onclick="location.hash='#/leping/${l.id}'">
              <td><b class="mono" style="font-size:14px">${l.id}</b><div class="muted" style="font-size:12px">${sp.nimi} · ${l.algus} – ${l.lopp}</div></td>
              <td class="r mono">${eur(rent(sp), 0)} €</td><td class="r">${pill(l.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:16px">Lepinguid pole.</td></tr>`}
          </tbody></table>
        </div>

        <div class="sec-h reveal"><h2>Pakkumused</h2><span class="meta">${offs.length} tk</span></div>
        <div class="card reveal" style="overflow:hidden;margin-bottom:24px">
          <table class="tbl"><tbody>
          ${offs.length ? offs.map(o => { const t = offerTotals(o); return `
            <tr class="clickable" onclick="location.hash='#/pakkumus/${o.id}'">
              <td><b class="mono" style="font-size:14px">${o.id}</b><div class="muted" style="font-size:12px">${t.spaces.map(s => s.nimi).join(", ")} · kehtib ${o.kehtivKuni}</div></td>
              <td class="r mono">${eur(t.rentSum, 0)} €</td><td class="r">${pill(o.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:16px">Pakkumusi pole.</td></tr>`}
          </tbody></table>
        </div>

        <div class="sec-h reveal"><h2>Vestlused</h2></div>
        <div class="card pad reveal">
          ${vestlused.length ? vestlused.map(v => `
          <div class="kd-item" style="cursor:pointer" onclick="location.hash='${v.href}'">
            <span class="kd-ic blue">${I.chat}</span>
            <div style="flex:1;min-width:0"><div class="t" style="font-size:14px">${v.tekst.length > 90 ? v.tekst.slice(0, 90) + "…" : v.tekst}</div>
              <div class="s">${v.doc} · ${v.aeg}</div></div>
            ${pill(v.staatus)}
          </div>`).join("") : `<div class="muted" style="font-size:14px">Suhtlust veel pole.</div>`}
        </div>
      </div>

      <div>
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:12px">Kontakt</div>
          <dl class="kv">
            <dt>Kontaktisik</dt><dd>${c.kontakt}</dd>
            <dt>E-post</dt><dd class="mono" style="font-size:14px">${c.epost}</dd>
            <dt>Telefon</dt><dd class="mono">${c.tel || "—"}</dd>
          </dl>
        </div>
        <div class="card pad reveal" style="margin-top:20px">
          <div class="between" style="margin-bottom:12px"><div class="overline">Riskiraportid</div><a class="steplink" href="#/risk/${c.id}">Ava →</a></div>
          <div class="kd-item"><span class="kd-ic ${c.risk.skoor === "KÕRGE" ? "amber" : "green"}">${I.shield}</span>
            <div style="flex:1"><div class="t" style="font-size:14px">Koondskoor ${c.risk.skoor}</div><div class="s">Krediidiinfo · Inforegister · Kohtutäitur · Äriregister</div></div>
            <span class="kd-date mono">${c.risk.kuupaev}</span></div>
          <div class="muted" style="font-size:12px;margin-top:8px">Ajalugu koguneb iga päringuga — raport on informatiivne, ei blokeeri.</div>
        </div>
        <div class="card pad reveal" style="margin-top:20px">
          <div class="overline" style="margin-bottom:12px">Tähtajad</div>
          ${tahtajad.length ? tahtajad.map(k => { const ki = kdIcon(k.tyyp); return `
          <div class="kd-item"><span class="kd-ic ${ki.cls}">${ki.ic}</span>
            <div style="flex:1;min-width:0"><div class="t">${k.tyyp}</div><div class="s">${k.objekt}</div></div>
            <span class="kd-date mono">${fmtShort(k.kuupaev)}</span></div>`; }).join("") : `<div class="muted" style="font-size:14px">Lähiajal tähtaegu pole.</div>`}
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------- Osapooled: kliendid + töötajad --------------------------------- */
View.osapooled = () => `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Osapooled</h1></div>
      <a class="btn btn-ghost btn-sm" href="#/portfell">${I.back} Portfell</a>
    </div>

    <div class="sec-h reveal"><h2>Kliendid</h2></div>
    <div class="card reveal" style="overflow:hidden;margin-bottom:24px">
      <table class="tbl">
        <thead><tr><th>Ettevõte</th><th>Kontakt</th><th>Seotud</th><th>Risk</th></tr></thead>
        <tbody>
        ${CLIENTS.map(c => { const nOff = OFFERS.filter(o=>o.clientId===c.id).length; const nLease = LEASES.filter(l=>l.clientId===c.id).length;
          return `<tr class="clickable" onclick="location.hash='#/risk/${c.id}'">
            <td><div style="font-weight:600">${c.nimi}</div><div class="muted mono" style="font-size:12px">${c.registrikood} · ${c.aadress}</div></td>
            <td><div>${c.kontakt}</div><div class="muted mono" style="font-size:12px">${c.epost}${c.tel?` · ${c.tel}`:""}</div></td>
            <td class="mono" style="font-size:14px">${nOff} pakkumust · ${nLease} lepingut</td>
            <td>${pill(c.risk.skoor)}</td></tr>`; }).join("")}
        </tbody>
      </table>
    </div>

    ${!TLEPINGUD.length ? "" : `
    <div class="sec-h reveal"><h2>Töötajad ja kandidaadid</h2><span class="meta">osakond ${OSAKOND.nimi}</span></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Isik</th><th>Ametikoht</th><th>Algus</th><th>Olek</th></tr></thead>
        <tbody>
        ${TLEPINGUD.map(t => { const a = DB.ametikohtById(t.ametikohtId);
          return `<tr class="clickable" onclick="location.hash='#/tooleping/${t.id}'">
            <td><div style="font-weight:600">${t.isik}</div><div class="muted mono" style="font-size:12px">${t.id}${t.roll==="kandidaat"?" · kandidaat":""}</div></td>
            <td>${a.nimi}</td><td class="mono">${t.algus}</td>
            <td>${pill(t.staatus)}</td></tr>`; }).join("")}
        </tbody>
      </table>
    </div>`}
  </div>`;

/* ---------- Suhtlus: vestluste loend + lõim (üks CommunicationThread) --------
   Allikad: pakkumuse lingi kommentaarid · lepingu punktikommentaarid ·
   kliendikonto vabavestlus. Vastamata vestlus ilmub automaatselt Avalehele. */
const suhAeg = (s) => { const [d, t] = String(s).split(" "); const dt = parseEE(d); if (t) { const [h, m] = t.split(":"); dt.setHours(+h || 0, +m || 0); } return dt; };
function suhtlusThreads() {
  const th = [];
  LEASES.forEach(l => {
    const msgs = [];
    (l.kommentaarid || []).forEach(c => {
      msgs.push({ who: "client", autor: c.autor, aeg: c.aeg, tekst: c.tekst, ref: c.clauseRef, staatus: c.staatus });
      if (c.vastus) msgs.push({ who: "op", autor: "Tarmo Sepp (operaator)", aeg: c.aeg, tekst: c.vastus, ref: c.clauseRef });
    });
    (l.vestlus || []).forEach(m => msgs.push(m));
    if (msgs.length) { const cl = DB.clientById(l.clientId);
      th.push({ id: l.id, klient: cl.nimi, kontakt: cl.kontakt, docT: "Üürileping", href: "#/leping/" + l.id, kind: "lease", doc: l, msgs,
        pending: (l.kommentaarid || []).some(c => c.staatus === "Ootel") }); }
  });
  OFFERS.forEach(o => {
    const msgs = [];
    const cl = DB.clientById(o.clientId);
    /* läbirääkimiste logi (v158+): ettepanekud ja vastused voorude kaupa */
    (o.labiraakimised || []).forEach(m => msgs.push({
      who: m.roll === "klient" ? "client" : "op", autor: m.autor, aeg: m.aeg, tekst: m.tekst,
      ref: m.roll === "klient" ? "ettepanek" : "vastus",
      staatus: m.roll === "klient" && o.staatus === "Kliendi ettepanek" && o.kliendiEttepanek === m.tekst ? "Ootel" : undefined }));
    /* vanem salvestus/seeme: ettepanek ilma logita — ära topelda */
    if (o.kliendiEttepanek && !(o.labiraakimised || []).some(m => m.tekst === o.kliendiEttepanek))
      msgs.push({ who: "client", autor: cl.kontakt + " (üürnik)", aeg: o.loodud, tekst: o.kliendiEttepanek, ref: "vabas vormis", staatus: "Ootel" });
    (o.vestlus || []).forEach(m => msgs.push(m));
    if (msgs.length) th.push({ id: o.id, klient: cl.nimi, kontakt: cl.kontakt, docT: "Pakkumus", href: "#/pakkumus/" + o.id, kind: "offer", doc: o, msgs,
      pending: o.staatus === "Kliendi ettepanek" });
  });
  th.forEach(x => x.msgs.sort((a, b) => suhAeg(a.aeg) - suhAeg(b.aeg)));
  th.sort((a, b) => suhAeg(b.msgs[b.msgs.length - 1].aeg) - suhAeg(a.msgs[a.msgs.length - 1].aeg));
  return th;
}

View.suhtlus = (tid) => {
  const th = suhtlusThreads();
  const sel = th.find(x => x.id === tid) || th.find(x => x.pending) || th[0];
  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Suhtlus</h1></div>
    </div>

    <div class="suh-layout reveal">
      <!-- vasak: vestluste loend -->
      <div class="card" style="overflow:hidden;display:flex;flex-direction:column">
        <div style="padding:16px 16px 12px">
          <div class="pf-search" style="width:100%">${I.search}<input id="suh-q" placeholder="Otsi klienti või dokumenti…" autocomplete="off"/></div>
          <div class="pf-views" style="margin-top:12px">
            <button class="pf-view" data-sf="ootel">Vastamata</button>
            <button class="pf-view on" data-sf="">Kõik</button>
          </div>
        </div>
        <div class="suh-list">
          ${th.length ? th.map(x => { const last = x.msgs[x.msgs.length - 1]; return `
          <a class="sl-row ${sel && x.id === sel.id ? "sel" : ""}" href="#/suhtlus/${x.id}" data-sl="${x.pending ? "ootel" : ""}">
            ${avatar(x.klient)}
            <div style="flex:1;min-width:0">
              <div class="flex" style="gap:8px"><b style="font-size:14px">${x.klient}</b><span class="tag">${x.id}</span></div>
              <div class="sl-last">${last.who === "op" ? "Sina: " : ""}${last.tekst.length > 64 ? last.tekst.slice(0, 64) + "…" : last.tekst}</div>
            </div>
            <div style="text-align:right;flex:none">
              <div class="muted mono" style="font-size:12px">${last.aeg.split(" ")[0]}</div>
              ${x.pending ? `<i class="sl-dot"></i>` : ""}
            </div>
          </a>`; }).join("") : `<div class="muted" style="padding:20px;font-size:14px">Vestlusi pole.</div>`}
        </div>
      </div>

      <!-- parem: lõim -->
      ${sel ? `
      <div class="card suh-thread">
        <div class="suh-head">
          <div style="flex:1;min-width:0">
            <div class="flex" style="gap:8px"><b style="font-size:16px">${sel.klient}</b><span class="tag">${sel.docT} · ${sel.id}</span>${sel.pending ? pill("Ootel") : ""}</div>
            <div class="muted" style="font-size:12px;margin-top:3px">${sel.kontakt}</div>
          </div>
          <a class="btn btn-ghost btn-sm" href="${sel.href}">${I.arrow} Ava ${sel.kind === "offer" ? "pakkumus" : "leping"}</a>
        </div>
        <div class="suh-msgs" id="suh-msgs">
          ${(() => { let prevDay = ""; return sel.msgs.map(m => {
            const day = (m.aeg || "").split(" ")[0];
            const sep = day && day !== prevDay ? `<div class="msg-day">${day === TODAY_EE ? "Täna" : day}</div>` : "";
            if (day) prevDay = day;
            return sep + `
          <div class="msg ${m.who === "op" ? "me" : ""}">
            <div class="mb">
              ${m.ref ? (sel.kind === "lease" ? `<button class="msg-ref" onclick="openLepingPunkt('${sel.id}','${m.ref}')" title="Ava punkt tehinguvaates">${m.ref}</button>` : `<span class="msg-ref">${m.ref}</span>`) : ""}
              <div class="tx">${m.tekst}</div>
              <div class="mm"><span>${m.autor}</span><span class="mono">${m.aeg.split(" ")[1] || m.aeg}</span>${m.staatus === "Ootel" && m.who === "client" ? pill("Ootel") : ""}</div>
            </div>
          </div>`; }).join(""); })()}
        </div>
        <div class="suh-foot">
          <div class="flex" style="gap:8px">
            <button class="comp-ic" title="Lisa fail" onclick="toast('Faili lisamine vestlusse — demos illustratiivne')">${I.clip}</button>
            <input id="suh-in" placeholder="Kirjuta vastus…" autocomplete="off"/>
            <button class="btn btn-ghost btn-sm" id="suh-ai" title="AI koostab mustandi — toimeta ja saada">${I.spark} Koosta vastus AI-ga</button>
            <button class="comp-send" id="suh-send" title="Saada">${I.up}</button>
          </div>
          <div class="muted" style="font-size:12px;margin-top:8px">AI koostab mustandi — toimetad ja saadad ise.</div>
        </div>
      </div>` : `<div class="card pad"><div class="empty"><div class="ic">${I.chat}</div><div>Vali vestlus vasakult.</div></div></div>`}
    </div>
  </div>`;
};

View.suhtlus.init = (tid) => {
  const th = suhtlusThreads();
  const sel = th.find(x => x.id === tid) || th.find(x => x.pending) || th[0];
  /* otsing + Vastamata|Kõik filter */
  const q = document.getElementById("suh-q");
  const apply = () => {
    const v = q ? q.value.trim().toLowerCase() : "";
    const onB = document.querySelector(".pf-views .pf-view.on[data-sf]");
    const sf = onB && onB.dataset ? onB.dataset.sf : "";
    document.querySelectorAll(".sl-row").forEach(r => {
      const hit = (!v || (r.textContent || "").toLowerCase().includes(v)) && (!sf || r.dataset.sl === sf);
      r.style.display = hit ? "" : "none";
    });
  };
  if (q) q.addEventListener("input", apply);
  document.querySelectorAll(".pf-view[data-sf]").forEach(b => b.onclick = () => {
    document.querySelectorAll(".pf-view[data-sf]").forEach(x => x.classList.remove("on"));
    b.classList.add("on"); apply();
  });
  if (!sel) return;
  /* saatmine: sõnum läheb dokumendi CommunicationThread'i */
  const inp = document.getElementById("suh-in");
  const send = () => {
    const v = inp ? inp.value.trim() : "";
    if (!v) return;
    if (sel.kind === "offer") {
      /* pakkumuse lõim = läbirääkimiste logi — sama ajalugu, mida näeb klient pakkumusvaates */
      (sel.doc.labiraakimised = sel.doc.labiraakimised || []).push({ roll: "operaator", autor: "Tarmo Sepp (üürileandja)", tekst: v, aeg: NOW_EE() });
    } else {
      sel.doc.vestlus = sel.doc.vestlus || [];
      sel.doc.vestlus.push({ who: "op", autor: "Tarmo Sepp (operaator)", aeg: NOW_EE() + " 10:0" + (sel.doc.vestlus.length % 10), tekst: v });
    }
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `${sel.id}: sõnum saadetud kliendile (CommunicationThread).` });
    DB.save(); toast("Saadetud kliendile"); router();
  };
  const sb2 = document.getElementById("suh-send");
  if (sb2) sb2.onclick = send;
  if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
  /* AI-mustand: eeltäidab sisendi, operaator toimetab ja saadab ise */
  const ai = document.getElementById("suh-ai");
  if (ai) ai.onclick = () => {
    const last = [...sel.msgs].reverse().find(m => m.who === "client");
    const eesnimi = (sel.kontakt || "").split(" ")[0];
    const sisu = last && /tagatis/i.test(last.tekst)
      ? "Saame pakkuda tagatisraha vähendamist 2 kuu üürile tingimusel, et lepingu tähtaeg on vähemalt 5 aastat — vormistame selle eritingimusena (Lisa 3)."
      : last && /indeks|thi/i.test(last.tekst)
      ? "THI-põhine indekseerimine sobib — vormistame selle eritingimusena, mis kirjutab üle üldtingimuste p 5.2."
      : "Vaatasime Teie ettepaneku üle ja tuleme lahendusega tagasi järgmises mustandis. Kokkulepe vormistatakse eritingimusena (Lisa 3).";
    if (inp) { inp.value = `Tere, ${eesnimi}! Täname tagasiside eest${last && last.ref && last.ref !== "vabas vormis" ? ` punkti ${last.ref} kohta` : ""}. ${sisu} Parimate soovidega, Tarmo Sepp`; if (inp.focus) inp.focus(); }
    toast("AI mustand valmis — toimeta ja saada");
  };
};

/* ==========================================================================
   SEADED (spets 6) — ettevõtted · kasutajad · mallid · teavitused
   ======================================================================== */
let SEADED = {
  varvid: {},   /* ettevõte → aktsentvärv (läheb dokumentidele) */
  lisatud: [],  /* äriregistrist lisatud ettevõtted (demo) */
  kutsed: [],   /* saadetud kasutajakutsed */
  teavitused: { lepp: 90, pakk: 7, katse: 14, palk: 30, indeks: 30 },
};
try { const _s = localStorage.getItem("thinkone_seaded"); if (_s) { const p = JSON.parse(_s);
  SEADED = Object.assign(SEADED, p, { teavitused: Object.assign(SEADED.teavitused, p.teavitused || {}) }); } } catch (e) {}
const seadSave = () => { try { localStorage.setItem("thinkone_seaded", JSON.stringify(SEADED)); } catch (e) {} };

const REG_KOODID = { taeva: "16333502", b11g: "14892077" };
const TEAVITUSED_DEF = [
  { k: "lepp",   t: "Lepingu lõppemine",  s: "ülesütlemise otsustusaken — teavitus mõlemale poolele" },
  { k: "pakk",   t: "Pakkumuse aegumine", s: "meeldetuletus kliendile ja operaatorile enne lingi aegumist" },
  { k: "indeks", t: "Indekseerimine",     s: "eelteade; korraline indekseerimine rakendub automaatselt" },
];

View.seaded = () => {
  const kasutajad = [
    { nimi: "Tarmo Sepp", epost: "tarmo@tember.ee", roll: "Admin", olek: "Aktiivne" },
    { nimi: "Margus Varne", epost: ACCOUNT.landlord.epost, roll: "Operaator", olek: "Aktiivne" },
  ];
  const ettRow = (nimi, reg, cur, extra, logo) => `
    <div class="flex row-line">
      ${logo}
      <div style="flex:1;min-width:0"><b style="font-size:14px">${nimi}</b>${cur?` <span class="tag">aktiivne</span>`:""}
        <div class="muted mono" style="font-size:12px">reg ${reg}</div></div>
      ${extra}
    </div>`;
  const sw = (cid) => `<label class="flex" style="gap:8px;cursor:pointer" title="Aktsentvärv — läheb dokumentidele">
      <input type="color" class="ett-varv fld-color" data-cid="${cid}" value="${SEADED.varvid[cid] || "#006566"}">
      <span class="muted" style="font-size:12px">aktsentvärv</span></label>`;

  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Seaded</h1></div>
    </div>

    <div class="set-grid reveal">
      <!-- 1 · Ettevõtted -->
      <div class="card pad">
        <div class="card-h" style="padding:0 0 12px"><h3>Ettevõtted</h3><span class="overline">${DB.COMPANIES.length + SEADED.lisatud.length} tk</span></div>
        ${DB.COMPANIES.map(c => ettRow(c.nimi, REG_KOODID[c.id] || "—", c.id === DB.COMPANY_ID,
          sw(c.id),
          c.id === "taeva" ? `<img src="lisad/T6B_logo.png" alt="" style="height:28px;flex:none">`
                           : `<span class="ett-logo" style="background:${SEADED.varvid[c.id] || "#006566"}">${c.nimi[0]}</span>`)).join("")}
        ${SEADED.lisatud.map((e, i) => ettRow(e.nimi, e.reg, false,
          `<span class="tag">seadistamisel</span><button class="rmstep" data-ett-rm="${i}" title="Eemalda">×</button>`,
          `<span class="ett-logo" style="background:var(--ink-2)">${e.nimi[0]}</span>`)).join("")}
        <div class="divline"></div>
        <div class="overline" style="margin-bottom:8px">Lisa ettevõte</div>
        <div class="flex" style="gap:8px">
          <input id="ett-reg" class="fld mono" placeholder="Registrikood, nt 10633207" inputmode="numeric" autocomplete="off" style="flex:1;width:auto">
          <button class="btn btn-primary btn-sm" id="ett-otsi">Otsi äriregistrist</button>
        </div>
        <div id="ett-leid"></div>
        <div class="muted" style="font-size:12px;margin-top:12px">Andmed tulevad e-äriregistrist automaatselt (autotäide). Logo ja aktsentvärv lähevad dokumentidele — pakkumus, leping, kliendilink.</div>
      </div>

      <!-- 2 · Kasutajad -->
      <div class="card pad">
        <div class="card-h" style="padding:0 0 12px"><h3>Kasutajad</h3><span class="overline">${kasutajad.length + SEADED.kutsed.length} tk</span></div>
        ${kasutajad.map(u => `
        <div class="flex row-line">
          <span class="ett-logo" style="background:var(--accent-deep)">${u.nimi.split(" ").map(x=>x[0]).join("")}</span>
          <div style="flex:1;min-width:0"><b style="font-size:14px">${u.nimi}</b>
            <div class="muted mono" style="font-size:12px">${u.epost}</div></div>
          <span class="tag">${u.roll}</span>${pill(u.olek, "green")}
        </div>`).join("")}
        ${SEADED.kutsed.map((k, i) => `
        <div class="flex row-line">
          <span class="ett-logo" style="background:var(--muted)">?</span>
          <div style="flex:1;min-width:0"><b style="font-size:14px;font-family:var(--font-mono)">${k.epost}</b>
            <div class="muted" style="font-size:12px">kutse saadetud ${k.aeg}</div></div>
          <span class="tag">${k.roll}</span>${pill("Ootel")}
          <button class="rmstep" data-kutse-rm="${i}" title="Tühista kutse">×</button>
        </div>`).join("")}
        <div class="divline"></div>
        <div class="overline" style="margin-bottom:8px">Kutsu kasutaja</div>
        <div class="flex" style="gap:8px;flex-wrap:wrap">
          <input id="ku-epost" class="fld" type="email" placeholder="nimi@ettevote.ee" autocomplete="off" style="flex:1;min-width:170px;width:auto">
          <select id="ku-roll" class="fld" style="width:auto"><option>Operaator</option><option>Admin</option></select>
          <button class="btn btn-primary btn-sm" id="ku-saada">${I.send} Saada kutse</button>
        </div>
        <div class="muted" style="font-size:12px;margin-top:12px">Admin — seaded, kasutajad ja mallid; Operaator — igapäevane tehingutöö. Peenem õiguste jaotus (RBAC) — post-MVP.</div>
      </div>

      <!-- 3 · Mallid -->
      <div class="card pad">
        <div class="card-h" style="padding:0 0 12px"><h3>Mallid</h3><span class="overline">versioneeritud</span></div>
        ${OBJEKTID.map(o => `
          ${multiObj() ? `<div class="overline" style="margin:12px 0 2px">${o.nimi}</div>` : ""}
          ${[["uld", o.mallid.uldtingimused], ["eri", o.mallid.eritingimused], ["pakk", o.mallid.pakkumus]].map(([k, m]) => `
          <div class="flex row-line">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1;min-width:0"><b style="font-size:14px">${m}</b>
              ${k === "uld" ? `<div class="muted" style="font-size:12px">${(m.match(/v[\d.]+/) || ["v1.0"])[0]} kehtiv · varasemad arhiivis · uus versioon ei puuduta allkirjastatuid</div>` : ""}</div>
            <button class="steplink" onclick="toast('Mall avatud versioonihaldusega — külmub allkirjaga. Demos illustratiivne.')">Ava mall</button>
            ${k === "uld" ? `<button class="steplink" onclick="toast('Uus versioon (mustand) — jõustub avaldamisel ainult uutele lepingutele; allkirjastatud jäävad oma versiooni juurde')">Uus versioon</button>` : ""}
          </div>`).join("")}`).join("")}
        <div class="muted" style="font-size:12px;margin-top:12px">Üldtingimused on lepingus lukus — muudatus käib ainult uue malliversiooniga. Eritingimuste põhi ja pakkumuse põhi on lähtepunktid, mida operaator tehingus kohandab.</div>
      </div>

      <!-- 4 · Teavitused -->
      <div class="card pad">
        <div class="card-h" style="padding:0 0 12px"><h3>Teavitused</h3><span class="overline">vaikeajad</span></div>
        ${TEAVITUSED_DEF.map(d => `
        <div class="flex row-line">
          <div style="flex:1;min-width:0"><b style="font-size:14px">${d.t}</b>
            <div class="muted" style="font-size:12px">${d.s}</div></div>
          <input class="fld fld-sm tv-in mono" data-tv="${d.k}" value="${SEADED.teavitused[d.k]}" inputmode="numeric" style="width:64px;text-align:right">
          <span class="muted" style="font-size:14px;flex:none">päeva ette</span>
        </div>`).join("")}
        <div class="muted" style="font-size:12px;margin-top:12px">Vaikeajad kehtivad uutele tähtaegadele; üksikul lepingul saab aega eraldi muuta. Kõik teavitused lähevad ka meilile — operaatorile tööpostkasti, kliendile tema kontaktile.</div>
      </div>
    </div>
  </div>`;
};

View.seaded.init = () => {
  /* äriregistri autotäide (simuleeritud) */
  const otsi = document.getElementById("ett-otsi"), leid = document.getElementById("ett-leid");
  if (otsi) otsi.onclick = () => {
    const reg = (document.getElementById("ett-reg").value || "").trim();
    if (!/^\d{8}$/.test(reg)) { toast("Registrikood on 8-kohaline number"); return; }
    const nimi = "Kolmas Kinnisvara OÜ";
    leid.innerHTML = `<div class="card pad" style="background:var(--surface-soft);box-shadow:none;margin-top:12px">
      <div class="overline" style="margin-bottom:8px">e-äriregister · autotäide</div>
      <b style="font-size:14px">${nimi}</b>
      <div class="muted mono" style="font-size:12px;margin-top:2px">reg ${reg} · KMKR EE10${reg.slice(0,6)} · Pärnu mnt 15, Tallinn</div>
      <button class="btn btn-primary btn-sm" id="ett-lisa" style="margin-top:12px">${I.plus} Lisa kontole</button>
    </div>`;
    document.getElementById("ett-lisa").onclick = () => {
      SEADED.lisatud.push({ reg, nimi }); seadSave();
      AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Ettevõte ${nimi} (reg ${reg}) lisatud kontole e-äriregistri autotäitega.` });
      toast("Ettevõte lisatud — järgmised sammud: logo, aktsentvärv ja portfelli import"); router();
    };
  };
  document.querySelectorAll("[data-ett-rm]").forEach(b => b.onclick = () => {
    SEADED.lisatud.splice(+b.dataset.ettRm, 1); seadSave(); toast("Ettevõte eemaldatud"); router();
  });
  /* aktsentvärv */
  document.querySelectorAll(".ett-varv").forEach(inp => inp.onchange = () => {
    SEADED.varvid[inp.dataset.cid] = inp.value; seadSave();
    toast("Aktsentvärv salvestatud — rakendub dokumentidel ja kliendilingil");
  });
  /* kasutajakutse */
  const saada = document.getElementById("ku-saada");
  if (saada) saada.onclick = () => {
    const e = (document.getElementById("ku-epost").value || "").trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) { toast("Sisesta korrektne e-posti aadress"); return; }
    const roll = document.getElementById("ku-roll").value;
    SEADED.kutsed.push({ epost: e, roll, aeg: NOW_EE() }); seadSave();
    AUDIT.unshift({ aeg: NOW_EE(), autor: "Tarmo Sepp", tegevus: `Kasutajakutse saadetud: ${e} (${roll}).` });
    toast("Kutse saadetud e-postile — kehtib 7 päeva"); router();
  };
  document.querySelectorAll("[data-kutse-rm]").forEach(b => b.onclick = () => {
    SEADED.kutsed.splice(+b.dataset.kutseRm, 1); seadSave(); toast("Kutse tühistatud"); router();
  });
  /* teavituste vaikeajad */
  document.querySelectorAll(".tv-in").forEach(inp => inp.onchange = () => {
    const v = parseInt(inp.value, 10);
    if (!isFinite(v) || v < 1) { inp.value = SEADED.teavitused[inp.dataset.tv]; return; }
    SEADED.teavitused[inp.dataset.tv] = v; seadSave();
    toast("Teavituse vaikeaeg salvestatud: " + v + " päeva ette");
  });
};

/* ==========================================================================
   ROUTER + SHELL
   ======================================================================== */
function notFound(msg) { return `<div class="view"><div class="empty"><div class="ic">${I.search}</div><h2>${msg}</h2><a class="btn btn-primary" href="${isClient() ? '#/portaal' : '#/'}">Tagasi avalehele</a></div></div>`; }

/* nav: 5 lehte, igaüks vastab ühele igavesele küsimusele (tiimi brainstorm) */
const NAV_OP = [
  { href: "#/",         ic: I.spark,    t: "Avaleht",  q: "Mida ma täna tegema pean?" },
  { href: "#/ylevaade", ic: I.grid,     t: "Ülevaade", q: "Kuidas meil läheb?" },
  { href: "#/pakkumised", ic: I.offer, t: "Pakkumised", q: "Minu tegevust ootavad pakkumised",
    count: () => OFFERS.filter(o => ["Mustand", "Kliendi ettepanek"].includes(o.staatus)).length },
  { href: "#/portfell", ic: I.building, t: "Portfell", q: "Mis meil on ja kellega?",
    count: () => LEASES.filter(l=>l.staatus!=="Kehtiv").length + TLEPINGUD.filter(t=>t.staatus!=="Kehtiv").length },
  { href: "#/kalender", ic: I.cal,      t: "Kalender", q: "Mis millal juhtub?" },
  { href: "#/suhtlus",  ic: I.chat,     t: "Suhtlus",  q: "Mida osapooled ütlevad?",
    count: () => LEASES.reduce((s,l) => s + (l.kommentaarid||[]).filter(c=>c.staatus==="Ootel").length, 0) + OFFERS.filter(o=>o.staatus==="Kliendi ettepanek").length },
];
const NAV_CLIENT = [
  { grp: "Portaal" },
  { href: "#/portaal", ic: I.grid, t: "Minu dokumendid" },
];

function renderNav(active) {
  const nav = isClient() ? NAV_CLIENT : NAV_OP;
  return nav.map(n => {
    if (n.grp) return `<div class="group-lbl">${n.grp}</div>`;
    const c = typeof n.count === "function" ? n.count() : n.count;
    return `<a href="${n.href}" class="${active===n.href?'active':''}" ${active===n.href?'aria-current="page"':''} aria-label="${n.t}${c ? ' '+c : ''}" title="${n.q||n.t}">${n.ic.replace('<svg','<svg class="ic"')}<span>${n.t}</span>${c?`<span class="count">${c}</span>`:""}</a>`;
  }).join("");
}

let LAST_VIEW_KEY = null; /* viimane renderdatud hash — eristab vaatevahetust uuesti-renderdusest */

/* Objekti seadistamine: üks mustand, kolm sammu. */
let OBJ_DRAFT = null;
let PRE_OBJECT = null;
const objEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const objNumber = v => String(v ?? '').trim() === '' ? null : Number(String(v).replace(/\s/g,'').replace(',','.'));
function objField(key, label, value, required=false, numeric=false) {
  return `<div class="field"><label for="of-${key}">${label}</label><input id="of-${key}" data-of="${key}" value="${objEsc(value)}" ${required?'required':''} ${numeric?'inputmode="decimal"':''} autocomplete="off"></div>`;
}
function objStart(id) {
  if (isClient()) return '<div class="view">Objekte saab lisada halduri vaates.</div>';
  if (!OBJ_DRAFT || OBJ_DRAFT.edit !== (id || null)) {
    const o = id && DB.objektById(id);
    if (id && !o) return '<div class="view">Objekti ei leitud.</div>';
    OBJ_DRAFT = { edit: id || null, step:1, obj: o ? JSON.parse(JSON.stringify(o)) : {
      id:'obj-'+crypto.randomUUID(), nimi:'', ehr:{kood:'',aadress:'',kasutusotstarve:'',ehitisealunePind:null,suletudNetopind:null,korrusteArv:null,ehitusaasta:null,allikas:'Käsitsi'},
      korvalkulu:{talvine:null,suvine:null,allikas:'Käsitsi'}, kaibemaksugaMaksustatud:true,
      failid:{}, mallid:{...OBJEKT.mallid}, logo:'', custom:true
    }, spaces:o ? JSON.parse(JSON.stringify(SPACES.filter(s=>objektOf(s).id===id))) : [], importText:'', importing:false };
  }
  return `<div class="view obj-flow"><a class="btn btn-ghost btn-sm" href="${id?'#/objekt/'+id:'#/portfell/esemed'}">${I.back} Tagasi portfelli</a><div class="overline" style="margin-top:24px">${objEsc(ACCOUNT.landlord.nimi)}</div><h1 class="page-h1" style="margin:8px 0 24px">${id?'Objekti seaded':'Lisa objekt'}</h1><div id="obj-wizard"></div></div>`;
}
function objDraw() {
  const root=document.getElementById('obj-wizard'); if(!root || !OBJ_DRAFT) return;
  const d=OBJ_DRAFT, o=d.obj;
  let body='';
  if(d.step===1) body=`<h2>Millise objekti lisame?</h2><div class="obj-search"><div class="field"><label for="obj-query">Aadress või EHR-kood</label><input id="obj-query" placeholder="Otsi demohoonet: Näidise 8"></div><button type="button" class="btn btn-ghost" id="obj-search">Otsi</button></div><p class="muted">EHR-i näidisotsing · päringut registrisse ei saadeta.</p><div id="obj-results"></div><button type="button" class="steplink" id="obj-manual">Sisesta käsitsi</button><div class="obj-fields" style="margin-top:24px">${objField('nimi','Objekti nimi',o.nimi,true)}${objField('ehr.aadress','Aadress',o.ehr.aadress,true)}</div><details><summary>Rohkem hooneandmeid</summary><div class="obj-fields">${objField('ehr.kood','EHR-kood',o.ehr.kood)}${objField('ehr.kasutusotstarve','Kasutusotstarve',o.ehr.kasutusotstarve)}${objField('ehr.ehitisealunePind','Ehitisealune pind, m²',o.ehr.ehitisealunePind,false,true)}${objField('ehr.suletudNetopind','Suletud netopind, m²',o.ehr.suletudNetopind,false,true)}${objField('ehr.korrusteArv','Korruste arv',o.ehr.korrusteArv,false,true)}${objField('ehr.ehitusaasta','Ehitusaasta',o.ehr.ehitusaasta,false,true)}</div></details>`;
  if(d.step===2) body=`<div class="between"><h2>Üüripinnad</h2><span class="muted">${d.spaces.length} pinda</span></div><div class="wrap-actions"><button type="button" class="btn btn-primary btn-sm" id="obj-add-space">${I.plus} Lisa pind</button><button type="button" class="btn btn-ghost btn-sm" id="obj-import">Impordi tabelist</button></div>${d.importing?`<div class="obj-import"><h3>CSV või Excelist kopeeritud read</h3><p class="muted">Esimene rida on päis. Kohustuslikud veerud: nimi, tüüp, üüripind, hind. Kasuta semikoolonit, koma või tabeldusmärki.</p><button type="button" class="steplink" id="obj-template">Laadi CSV-mall</button><div class="field"><label for="obj-csv">Ava CSV-fail</label><input type="file" id="obj-csv" accept=".csv,.tsv,text/csv,text/tab-separated-values"></div><div class="field"><label for="obj-paste">Või kleebi tabel siia</label><textarea id="obj-paste" rows="5" placeholder="nimi;tüüp;üüripind;hind">${objEsc(d.importText)}</textarea></div><button type="button" class="btn btn-ghost btn-sm" id="obj-parse">Too read eelvaatesse</button><p class="muted">Pinnad salvestatakse alles töövoo lõpus.</p></div>`:''}<div class="obj-space-list">${d.spaces.length?d.spaces.map((s,i)=>`<section class="obj-space"><div class="between"><h3>Pind ${i+1}</h3>${!SPACES.some(x=>x.id===s.id)?`<button type="button" class="steplink" data-remove="${i}">Eemalda</button>`:''}</div><div class="obj-fields">${objField(`spaces.${i}.nimi`,'Pinna nimi',s.nimi,true)}${objField(`spaces.${i}.tyyp`,'Tüüp',s.tyyp,true)}${objField(`spaces.${i}.yyripind`,'Üüripind, m²',s.yyripind,true,true)}${objField(`spaces.${i}.hind`,'Hind, €/m² kuus',s.hind,true,true)}</div><details><summary>Täpsustused ja pinnaplaan</summary><div class="obj-fields">${objField(`spaces.${i}.neto`,'Netopind, m²',s.neto,false,true)}${objField(`spaces.${i}.koef`,'Koefitsient',s.koef,false,true)}${objField(`spaces.${i}.elekter`,'Elektrivõimsus, A',s.elekter,false,true)}${objField(`spaces.${i}.parkimine`,'Parkimiskohti',s.parkimine,false,true)}</div>${objUpload(`space:${i}`,'Pinnaplaan (PDF)',s.plaanFail,s.plaanNimi)}</details><p class="obj-row-error" id="obj-row-${i}" aria-live="polite"></p></section>`).join(''):'<div class="obj-empty">Lisa esimene pind või jätka ja lisa pinnad hiljem.</div>'}</div>`;
  if(d.step===3) body=`<h2>Pakkumuse seaded</h2><p class="muted">${objEsc(o.nimi)} · ${d.spaces.length} pinda · ${eur(d.spaces.reduce((n,s)=>n+(objNumber(s.yyripind)||0),0),1)} m²</p><label class="obj-check"><input type="checkbox" id="obj-vat" ${o.kaibemaksugaMaksustatud?'checked':''}> Üürile lisandub käibemaks</label><div class="obj-fields">${objField('korvalkulu.talvine','Talvine kõrvalkulu, €/m²',o.korvalkulu.talvine,false,true)}${objField('korvalkulu.suvine','Suvine kõrvalkulu, €/m²',o.korvalkulu.suvine,false,true)}</div><p class="muted">Tühi kõrvalkulu tähendab „määramata”. Täpsusta see enne pakkumuse saatmist.</p><div class="field"><label for="obj-template-select">Lepingumall</label><select id="obj-template-select">${OBJEKTID.filter((x,i,a)=>a.findIndex(y=>JSON.stringify(y.mallid)===JSON.stringify(x.mallid))===i).map(x=>`<option value="${x.id}" ${JSON.stringify(x.mallid)===JSON.stringify(o.mallid)?'selected':''}>${objEsc(x.mallid.uldtingimused)}</option>`).join('')}</select></div><details><summary>Dokumendid ja logo · võib lisada hiljem</summary>${objUpload('parkimine','Parkimisskeem (PDF)',o.failid.parkimine,o.parkimineNimi)}${objUpload('pinnaplaan','Ühine pinnaplaan (PDF, kui pindadel eraldi plaane pole)',o.failid.pinnaplaan,o.pinnaplaanNimi)}${objUpload('logo','Objekti logo (PNG või JPEG)',o.logo,o.logoNimi)}</details>`;
  root.innerHTML=stepperHTML(['Objekt','Pinnad','Seaded'],d.step-1)+`<form id="obj-form" class="card pad" novalidate>${body}<div id="obj-error" class="obj-error" role="alert" tabindex="-1"></div><div class="obj-foot"><button type="button" class="btn btn-ghost" id="obj-back">${d.step===1?'Loobu':'Tagasi'}</button><button class="btn btn-primary" type="submit">${d.step===3?(d.edit?'Salvesta muudatused':'Lisa objekt'):d.step===2&&!d.spaces.length?'Lisan pinnad hiljem':'Edasi'} ${I.arrow}</button></div></form>`;
  root.querySelectorAll('[data-of]').forEach(el=>el.addEventListener('input',()=>{let target=el.dataset.of.startsWith('spaces.')?d:o;const bits=el.dataset.of.split('.');bits.slice(0,-1).forEach(k=>target=target[k]); target[bits.at(-1)]=el.value;el.removeAttribute('aria-invalid');}));
  const on=(id,fn)=>{const el=document.getElementById(id);if(el)el.onclick=fn;};
  on('obj-back',()=>{if(d.step>1){d.step--;objDraw();}else{OBJ_DRAFT=null;location.hash=d.edit?'#/objekt/'+d.edit:'#/portfell/esemed';}});
  on('obj-manual',()=>document.getElementById('of-nimi').focus());
  on('obj-search',()=>{const q=document.getElementById('obj-query').value.trim().toLowerCase();document.getElementById('obj-results').innerHTML=q&&('näidise 8 demohoone demo-008'.includes(q))?'<button type="button" class="pick" id="obj-use-sample"><b>Näidise 8 · demohoone</b><span class="tag">Näidisandmed</span></button>':'<p class="muted">Vastet ei leitud. Proovi „Näidise 8” või sisesta andmed käsitsi.</p>';on('obj-use-sample',()=>{Object.assign(o,{nimi:'Näidise 8'});Object.assign(o.ehr,{aadress:'Näidise 8, Tallinn (demo)',kood:'DEMO-008',kasutusotstarve:'Büroo- ja laohoone',ehitisealunePind:1200,suletudNetopind:1800,korrusteArv:2,ehitusaasta:2024,allikas:'EHR näidisandmed'});objDraw();});});
  const query=document.getElementById('obj-query');if(query)query.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();document.getElementById('obj-search').click();}};
  on('obj-add-space',()=>{d.spaces.push(objNewSpace(d.obj.id));objDraw();root.querySelectorAll('[data-of$=".nimi"]')[d.spaces.length-1]?.focus();});
  on('obj-import',()=>{d.importing=!d.importing;objDraw();});
  root.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{d.spaces.splice(+b.dataset.remove,1);objDraw();});
  on('obj-template',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\uFEFFnimi;tüüp;üüripind;hind;neto;koef;elekter;parkimine\r\nPind 1;Ladu;120,5;8,50;115;1,05;32;2'],{type:'text/csv;charset=utf-8'}));a.download='pindade-mall.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);});
  const paste=document.getElementById('obj-paste');if(paste)paste.oninput=()=>d.importText=paste.value;
  const csv=document.getElementById('obj-csv');if(csv)csv.onchange=async()=>{try{if(!csv.files[0])return;if(csv.files[0].size>1024*1024)throw Error('CSV-fail võib olla kuni 1 MB.');d.importText=await csv.files[0].text();paste.value=d.importText;}catch(e){objError(e.message);}};
  on('obj-parse',()=>{try{const rows=objParseCSV(d.importText);d.spaces.push(...rows.map(r=>({...objNewSpace(o.id),...r})));d.importing=false;d.importText='';objDraw();objValidate();}catch(e){objError(e.message);}});
  const vat=document.getElementById('obj-vat');if(vat)vat.onchange=()=>o.kaibemaksugaMaksustatud=vat.checked;
  const tpl=document.getElementById('obj-template-select');if(tpl)tpl.onchange=()=>o.mallid={...DB.objektById(tpl.value).mallid};
  root.querySelectorAll('[data-upload]').forEach(el=>el.onchange=()=>objReadFile(el));
  root.querySelectorAll('[data-file-remove]').forEach(el=>el.onclick=()=>{const k=el.dataset.fileRemove;if(k.startsWith('space:')){const s=d.spaces[+k.split(':')[1]];delete s.plaanFail;delete s.plaanNimi;}else if(k==='logo'){o.logo='';delete o.logoNimi;}else{delete o.failid[k];delete o[k+'Nimi'];}objDraw();});
  document.getElementById('obj-form').onsubmit=e=>{e.preventDefault();if(!objValidate())return;if(d.step<3){d.step++;objDraw();root.scrollIntoView({block:'start'});}else objCommit();};
  if(d.focusLast){d.focusLast=false;root.querySelectorAll('[data-of$=".nimi"]')[d.spaces.length-1]?.focus();}
}
function objNewSpace(id){return {id:'p-'+crypto.randomUUID(),objektId:id,nr:0,nimi:'',tyyp:'',yyripind:'',hind:'',neto:'',koef:'',elekter:0,parkimine:0,staatus:'Vaba',tenant:null};}
function objError(s){const el=document.getElementById('obj-error');if(el){el.textContent=s;el.focus();}}
function objValidate(){
  const d=OBJ_DRAFT;let first=null;
  document.querySelectorAll('#obj-form [data-of]').forEach(el=>{
    const key=el.dataset.of, raw=el.value.trim(), n=objNumber(raw);
    let msg='';
    if(el.required&&!raw)msg='Täida see väli.';
    else if(el.hasAttribute('inputmode')&&raw&&(!Number.isFinite(n)||n<0||(/yyripind|koef/.test(key)&&n===0)||(/parkimine|korrusteArv|ehitusaasta/.test(key)&&!Number.isInteger(n))))msg='Sisesta sobiv positiivne arv (hind võib olla 0).';
    else if(!el.hasAttribute('inputmode')&&/[<>"'`\\]/.test(raw))msg='Kasuta tekstis tähti, numbreid ja tavalisi kirjavahemärke; jutumärgid ja erimärgid pole selles demos toetatud.';
    el.setCustomValidity(msg);el.setAttribute('aria-invalid',msg?'true':'false');if(msg&&!first)first=el;
  });
  if(d.step===1&&OBJEKTID.some(o=>o.id!==d.edit&&((d.obj.ehr.kood&&o.ehr.kood===d.obj.ehr.kood)||(o.nimi.toLowerCase()===d.obj.nimi.trim().toLowerCase()&&o.ehr.aadress.toLowerCase()===d.obj.ehr.aadress.trim().toLowerCase())))){objError('See objekt on ettevõtte portfellis juba olemas.');return false;}
  if(d.step===2){const names=new Set();d.spaces.forEach((s,i)=>{const key=s.nimi.trim().toLowerCase();const dup=key&&names.has(key);names.add(key);const el=document.getElementById('obj-row-'+i);if(el)el.textContent=dup?'Sama nimega pind on juba selles objektis.':'';if(dup&&!first)first=document.getElementById(`of-spaces.${i}.nimi`);});}
  if(first){objError(first.validationMessage||'Paranda märgitud pindade andmed.');first.closest('details')?.setAttribute('open','');first.focus();return false;}return true;
}
function objUpload(key,label,url,name){return `<div class="field obj-upload"><label>${label}</label>${url?`<span class="muted">${objEsc(name||'Fail lisatud')} <button type="button" class="steplink" data-file-remove="${key}">Eemalda fail</button></span>`:''}<input aria-label="${label}" type="file" data-upload="${key}" accept="${key==='logo'?'image/png,image/jpeg':'.pdf,application/pdf'}"><small class="muted">Kuni 1 MB faili kohta.</small></div>`;}
async function objReadFile(el){
  const f=el.files[0];if(!f)return;const d=OBJ_DRAFT,key=el.dataset.upload;
  const targetSpace=key.startsWith('space:')?d.spaces[+key.split(':')[1]]:null;
  d.pending=(d.pending||0)+1;
  try{
    if(f.size>1024*1024)throw Error('Fail on liiga suur. Vali kuni 1 MB fail.');
    const bytes=new Uint8Array(await f.arrayBuffer());
    const pdf=String.fromCharCode(...bytes.slice(0,5))==='%PDF-';
    const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71;
    const jpg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(key==='logo'?!(png||jpg):!pdf)throw Error(key==='logo'?'Vali PNG- või JPEG-pilt.':'Vali PDF-fail.');
    const mime=key==='logo'?(png?'image/png':'image/jpeg'):'application/pdf';
    const url=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Faili lugemine ebaõnnestus.'));r.readAsDataURL(new Blob([bytes],{type:mime}));});
    if(OBJ_DRAFT!==d)return;
    if(targetSpace){targetSpace.plaanFail=url;targetSpace.plaanNimi=f.name;}
    else if(key==='logo'){d.obj.logo=url;d.obj.logoNimi=f.name;}
    else{d.obj.failid[key]=url;d.obj[key+'Nimi']=f.name;}
    el.parentElement.querySelector('span')?.remove();const label=document.createElement('span');label.className='muted';label.textContent=f.name;el.before(label);
  }catch(e){objError(e.message);el.value='';}finally{d.pending--;}
}
function objParseCSV(text){
  const clean=text.replace(/^\uFEFF/,'').trim();if(!clean)throw Error('Lisa esmalt CSV-fail või kleebi tabel.');
  const line=clean.split(/\r?\n/)[0],sep=line.includes('\t')?'\t':line.includes(';')?';':',';
  const rows=[];let row=[],v='',quoted=false;
  for(let i=0;i<clean.length;i++){const c=clean[i];if(c==='"'){if(quoted&&clean[i+1]==='"'){v+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===sep||c==='\n')){row.push(v.trim());v='';if(c==='\n'){rows.push(row);row=[];}}else if(c!=='\r'||quoted)v+=c;}
  if(quoted)throw Error('CSV-failis on sulgemata jutumärgid.');row.push(v.trim());rows.push(row);
  const alias={'nimi':'nimi','pinna nimi':'nimi','tüüp':'tyyp','tyyp':'tyyp','üüripind':'yyripind','üüripind m²':'yyripind','yyripind':'yyripind','hind':'hind','hind €/m²':'hind','neto':'neto','netopindala':'neto','koef':'koef','koefitsient':'koef','elekter':'elekter','elektrivõimsus':'elekter','parkimine':'parkimine','parkimiskohtade arv':'parkimine'};
  const headers=rows.shift().map(x=>alias[x.toLowerCase()]);
  if(['nimi','tyyp','yyripind','hind'].some(k=>!headers.includes(k)))throw Error('Päises peavad olema nimi, tüüp, üüripind ja hind. Laadi mall või paranda päist.');
  if(headers.filter(Boolean).some((k,i,a)=>a.indexOf(k)!==i))throw Error('Tabelis on korduvad veerud.');
  const data=rows.filter(r=>r.some(Boolean));if(!data.length)throw Error('Tabelis puuduvad pinnad.');if(data.length>200)throw Error('Impordi korraga kuni 200 pinda.');
  return data.map((r,i)=>{if(r.length!==headers.length)throw Error(`Reas ${i+2} on vale arv veerge.`);return Object.fromEntries(headers.map((k,j)=>[k,r[j]]).filter(([k])=>k));});
}
function objCommit(){
  const d=OBJ_DRAFT,o=JSON.parse(JSON.stringify(d.obj));
  if(d.pending){objError('Faili lugemine on pooleli. Proovi hetke pärast uuesti.');return;}
  ['ehitisealunePind','suletudNetopind','korrusteArv','ehitusaasta'].forEach(k=>o.ehr[k]=objNumber(o.ehr[k]));
  ['talvine','suvine'].forEach(k=>o.korvalkulu[k]=objNumber(o.korvalkulu[k]));
  o.nimi=o.nimi.trim();o.ehr.aadress=o.ehr.aadress.trim();
  const added=d.spaces.map((s,i)=>{const x={...s,nr:s.nr||i+1};['yyripind','hind','neto','koef','elekter','parkimine'].forEach(k=>x[k]=objNumber(x[k])??(k==='elekter'||k==='parkimine'?0:null));x.nimi=x.nimi.trim();x.tyyp=x.tyyp.trim();if(x.jaotus&&Math.abs(x.jaotus.reduce((n,p)=>n+p.m2,0)-x.yyripind)>.01)delete x.jaotus;return x;});
  const oldObjects=OBJEKTID.slice(),oldSpaces=SPACES.slice();const oldIndex=OBJEKTID.findIndex(x=>x.id===o.id);
  const oldObject=oldIndex>=0?{...OBJEKTID[oldIndex]}:null;
  if(oldIndex>=0)Object.assign(OBJEKTID[oldIndex],o);else OBJEKTID.push(o);
  const ids=new Set(added.map(s=>s.id));SPACES.splice(0,SPACES.length,...SPACES.filter(s=>!ids.has(s.id)),...added);
  if(!DB.save()){if(oldObject)Object.assign(oldObjects[oldIndex],oldObject);OBJEKTID.splice(0,OBJEKTID.length,...oldObjects);SPACES.splice(0,SPACES.length,...oldSpaces);objError('Salvestamine ebaõnnestus. Brauseri salvestusruum võib olla täis. Eemalda suuri faile ja proovi uuesti.');return;}
  OBJ_DRAFT=null;location.hash=d.returnTo||'#/objekt/'+o.id;toast(d.edit?'Objekti andmed salvestatud':'Objekt lisatud');
}
window.objEdit=(id,step=1)=>{OBJ_DRAFT=null;objStart(id);OBJ_DRAFT.step=step;location.hash='#/objekt-seaded/'+id;};
window.objAdd=id=>{objEdit(id,2);OBJ_DRAFT.spaces.push(objNewSpace(id));OBJ_DRAFT.focusLast=true;};
window.objOffer=id=>{PRE_OBJECT=id;location.hash='#/pakkumus-uus';};
function objReady(spaces){
  const incomplete=spaces.map(objektOf).find(o=>o.korvalkulu.talvine==null||o.korvalkulu.suvine==null);
  const missingPlan=spaces.find(s=>objektOf(s).custom&&!(s.plaanFail||objektOf(s).failid.pinnaplaan));
  if(incomplete||missingPlan){const back=location.hash;toast(incomplete?'Täpsusta objekti kõrvalkulud enne pakkumuse saatmist.':'Lisa pinna plaan enne pakkumuse saatmist.');objEdit(incomplete?incomplete.id:objektOf(missingPlan).id,incomplete?3:2);OBJ_DRAFT.returnTo=back;return false;}return true;
}

const ROUTES = [
  {re:/^#\/objekt-uus$/,view:()=>objStart(),crumb:"Portfell › Lisa objekt",nav:"#/portfell",init:objDraw},
  {re:/^#\/objekt-seaded\/(.+)$/,view:id=>objStart(id),crumb:"Portfell › Objekti seaded",nav:"#/portfell",init:objDraw},
  { re: /^#\/portaal$/, view: () => View.portaal(), crumb: "Minu dokumendid", nav: "#/portaal", init: () => View.portaal.init && View.portaal.init() },
  { re: /^#?\/?$/, view: () => View.dashboard(), crumb: "Avaleht", nav: "#/", init: View.dashboard.init },
  { re: /^#\/agent$/, view: () => View.agent(), crumb: "AI-agent", nav: "#/", init: () => View.agent.init() },
  /* key: alamtee = skoop (üks objekt), mitte uus vaade — skoobivahetus on vaikne re-render */
  { re: /^#\/ylevaade(?:\/(.+))?$/, key: "ylevaade", view: m => View.ylevaade(m), crumb: "Ülevaade", nav: "#/ylevaade", init: () => View.ylevaade.init() },
  /* key: alamtee on FILTER, mitte uus vaade — vahetus ei käivita avanemiskoreograafiat ega keri üles */
  { re: /^#\/portfell(?:\/(.+))?$/, key: "portfell", view: m => View.portfell(m), crumb: "Portfell", nav: "#/portfell", init: () => View.portfell.init() },
  { re: /^#\/klient\/(.+)$/, view: m => View.klient(m), crumb: "Portfell › Klient", nav: "#/portfell" },
  { re: /^#\/suhtlus(?:\/(.+))?$/, key: "suhtlus", view: m => View.suhtlus(m), crumb: "Suhtlus", nav: "#/suhtlus", init: m => View.suhtlus.init(m) },
  { re: /^#\/osapooled$/, view: () => View.osapooled(), crumb: "Portfell › Osapooled", nav: "#/portfell" },
  { re: /^#\/register$/, view: () => View.register(), crumb: "Portfell › Esemeregister", nav: "#/portfell" },
  { re: /^#\/objekt(?:\/(.+))?$/, view: m => View.objekt(m), crumb: "Portfell › Esemeregister › Objekt", nav: "#/portfell", init: () => View.objekt.init() },
  { re: /^#\/tooleping\/(.+)$/, view: m => View.tooleping(m), crumb: "Portfell › Tööleping", nav: "#/portfell" },
  { re: /^#\/imp\/(.+)$/, view: m => View.imporditud(m), crumb: "Portfell › Imporditud leping", nav: "#/portfell", init: () => View.imporditud.init() },
  { re: /^#\/pakkumised(?:\/(.+))?$/, key: "pakkumised", view: m => View.pakkumised(m), crumb: "Pakkumised", nav: "#/pakkumised" },
  { re: /^#\/pakkumus-uus$/, view: () => View.pakkumusUus(), crumb: "Pakkumised › Uus", nav: "#/pakkumised", init: View.pakkumusUus.init },
  { re: /^#\/pakkumus-doc\/(.+)$/, view: m => View.pakkumusDoc(m), crumb: "Pakkumised › Dokument", nav: "#/pakkumised" },
  { re: /^#\/pakkumus\/(.+)$/, view: m => View.pakkumus(m), crumb: "Pakkumised › Pakkumus", nav: "#/pakkumised", init: View.pakkumus.init },
  { re: /^#\/lepingud(?:\/(.+))?$/, key: "lepingud", view: m => View.lepingud(m), crumb: "Portfell › Lepingud", nav: "#/portfell" },
  { re: /^#\/import$/, view: () => View.importUus(), crumb: "Portfell › Lepingud › Import", nav: "#/portfell", init: View.importUus.init },
  { re: /^#\/leping-uus$/, view: () => View.lepingUus(), crumb: "Portfell › Lepingud › Uus leping", nav: "#/portfell", init: View.lepingUus.init },
  { re: /^#\/leping\/(.+)$/, view: m => View.leping(m), crumb: "Portfell › Leping", nav: "#/portfell", init: View.leping.init },
  { re: /^#\/risk\/(.+)$/, view: m => View.risk(m), crumb: "Portfell › Riskiraport", nav: "#/portfell", init: View.risk.init },
  { re: /^#\/risk$/, view: () => View.risk(), crumb: "Portfell › Riskiraport", nav: "#/portfell", init: View.risk.init },
  { re: /^#\/kalender(?:\/(.+))?$/, key: "kalender", view: m => View.kalender(m), crumb: "Kalender", nav: "#/kalender", init: () => View.kalender.init() },
  { re: /^#\/audit$/, view: () => View.audit(), crumb: "Ülevaade › Audit trail", nav: "#/ylevaade" },
  { re: /^#\/seaded$/, view: () => View.seaded(), crumb: "Seaded", nav: "", init: () => View.seaded.init() },
];

function router() {
  if (!document.getElementById("app-view")) return; /* kujundusgalerii laeb app.js komponentide pärast */
  setMobileNav(false, false);
  document.querySelectorAll('.drop.open').forEach(el => el.classList.remove('open'));
  document.getElementById('loo-btn')?.classList.remove('open');
  let h = location.hash || "#/";
  // kliendirežiimis on avaleht portaal
  if (isClient() && /^#?\/?$/.test(h)) h = "#/portaal";
  closeSide(); closePdf();
  let route = ROUTES.find(r => r.re.test(h)) || ROUTES[0];
  const m = h.match(route.re);
  const arg = m && m[1];
  CURRENT_LEASE = /^#\/leping\//.test(h) ? DB.leaseById(arg) : null;

  /* avanemiskoreograafia AINULT vaatevahetusel: sama vaate uuesti-renderdus
     (iga tegevuse järel) EI käivita reveal-animatsioone uuesti — vaade püsib paigal */
  const appView = document.getElementById("app-view");
  /* route.key: filtri-alamteega vaated (portfell, lepingud, kalender …) loevad
     ÜHEKS vaateks — filtrivahetus ei ole vaatevahetus */
  const vKey = route.key || h;
  const viewChanged = LAST_VIEW_KEY !== vKey;
  appView.classList.toggle("re-render", !viewChanged);
  LAST_VIEW_KEY = vKey;
  appView.innerHTML = route.view(arg);
  document.getElementById("nav").innerHTML = renderNav(route.nav);
  document.getElementById("crumb").innerHTML = isClient()
    ? `ThinkOne <b>/</b> ${route.crumb} <span class="role-chip" style="margin-left:8px">KLIENDIPORTAAL</span>`
    : `ThinkOne <b>/</b> ${route.crumb}`;
  /* avalehel on suur komposer — kompaktne ülariba-oma on seal peidus */
  document.body.classList.toggle("dash-shell", !isClient() && (/^#?\/?$/.test(h) || /^#\/agent$/.test(h)));
  /* kliendirollis pole operaatori tööriistu: otsing + „Loo" on peidus */
  document.body.classList.toggle("client-shell", isClient());
  /* üles keritakse AINULT vaatevahetusel — sama vaate uuesti-renderdus (faktimuutus,
     otsus, kinnitus) jätab kasutaja täpselt sinna, kus ta oli */
  if (viewChanged) window.scrollTo(0,0);
  if (route.init) route.init(arg);
  document.title = `${route.crumb} · ThinkOne`;
  appView.querySelectorAll('.ns-item[onclick], .pf-card, .kal-row.clickable[onclick]').forEach(el => {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('keydown', e => {
      if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); el.click(); }
    });
  });
  stackTables(appView);
  glideBars();
  if (typeof updateNotifBadge === "function") updateNotifBadge();
}

/* Tabelid kitsal vaatel: iga lahter saab päise sildi (data-l) — CSS (.tbl.stack) esitab read
   sildistatud kirjetena, kõik väljad ja toimingud säilivad. Lahter, kus on ainult nupud, saab .tbl-actions. */
function stackTables(root) {
  (root || document).querySelectorAll("table.tbl").forEach(t => {
    t.classList.add("stack");
    const heads = [...t.querySelectorAll("thead th")].map(th => th.textContent.trim());
    t.querySelectorAll("tbody tr").forEach(tr => {
      [...tr.children].forEach((td, i) => {
        if (td.tagName !== "TD") return;
        if (!td.hasAttribute("data-l")) td.setAttribute("data-l", heads[i] || "");
        const kids = [...td.children];
        const ownText = [...td.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        const isBtn = el => el.matches("button, a.btn, .btn");
        if (kids.length && !ownText && kids.every(k => isBtn(k) || (k.children.length && [...k.children].every(isBtn)))) td.classList.add("tbl-actions");
      });
    });
  });
}

/* TOAST STACK — virnastuvad teated (beui „Animated Toast Stack" vanilla-tõlge):
   uusim ees, vanemad taanduvad sügavusse (üles + väiksemaks + hajusamaks);
   hover laotab virna lahti lugemiseks, klõps sulgeb kohe. API jäi samaks: toast(msg). */
const TOASTS = [];
function toastHost() {
  let host = document.getElementById("toasts");
  if (!host) {
    host = document.createElement("div"); host.id = "toasts"; document.body.appendChild(host);
    host.addEventListener("mouseenter", () => { host.classList.add("exp"); toastLayout(); });
    host.addEventListener("mouseleave", () => { host.classList.remove("exp"); toastLayout(); });
  }
  return host;
}
function toastLayout() {
  const exp = document.getElementById("toasts")?.classList.contains("exp");
  TOASTS.forEach((el, i) => {
    el.style.setProperty("--ty", exp ? `-${i * (el.offsetHeight + 8)}px` : `-${i * 11}px`);
    el.style.setProperty("--sc", exp ? "1" : String(Math.max(.86, 1 - i * .05)));
    el.style.setProperty("--op", exp ? "1" : i > 2 ? "0" : String(1 - i * .22));
  });
}
function toastGone(el) {
  const i = TOASTS.indexOf(el); if (i < 0) return;
  TOASTS.splice(i, 1); clearTimeout(el._t);
  el.classList.add("out");
  setTimeout(() => { el.remove(); }, 420);
  toastLayout();
}
function toast(msg) {
  const host = toastHost();
  const el = document.createElement("div"); el.className = "toastx";
  el.innerHTML = `<span class="tic">${I.check.replace('<svg', '<svg style="width:17px;height:17px"')}</span><span class="ttx">${msg}</span>`;
  el.onclick = () => toastGone(el);
  host.appendChild(el);                          /* hilisem DOM = virna peal */
  TOASTS.unshift(el);
  el.style.setProperty("--ty", "18px"); el.style.setProperty("--sc", ".96"); el.style.setProperty("--op", "0");
  requestAnimationFrame(() => requestAnimationFrame(toastLayout));
  while (TOASTS.length > 4) toastGone(TOASTS[TOASTS.length - 1]);
  el._t = setTimeout(() => toastGone(el), 4200);
}
window.toast = toast; // inline-onclick handlerite jaoks (nt imporditud lepingu originaal)

/* date helpers */
const MONTHS = ["jaanuar","veebruar","märts","aprill","mai","juuni","juuli","august","september","oktoober","november","detsember"];
function fmtShort(iso){ const p = iso.split("-"); return `${p[2]}.${p[1]}`; }
function monthName(ym){ const p = ym.split("-"); return `${MONTHS[+p[1]-1].replace(/^./,c=>c.toUpperCase())} ${p[0]}`; }

/* ==========================================================================
   GLOBAALNE KEST: teavitused · omnibox · „+ Loo"
   ======================================================================== */

/* --- teavitused: süvalingid + loetuks märkimine (püsib localStorage'is) ----- */
function buildNotifs() {
  const n = [];
  OFFERS.forEach(o => { const cl = DB.clientById(o.clientId);
    if (o.staatus === "Kliendi ettepanek") n.push({ id: "n-prop-" + o.id, ic: I.edit, t: `${cl.nimi} tegi muudatusettepaneku`, s: `${o.id} · pakkumus`, href: "#/pakkumus/" + o.id, aeg: o.loodud });
    else if (o.staatus === "Saadetud") { const d = daysUntil(o.kehtivKuni);
      if (d >= 0 && d <= 7) n.push({ id: "n-exp-" + o.id, ic: I.offer, t: `Pakkumus aegub ${d} päeva pärast`, s: `${o.id} · ${cl.nimi}`, href: "#/pakkumus/" + o.id, aeg: o.kehtivKuni }); } });
  LEASES.forEach(l => (l.kommentaarid || []).filter(c => c.staatus === "Ootel").forEach(c =>
    n.push({ id: "n-cmt-" + l.id + "-" + c.clauseRef, ic: I.chat, t: `Uus kommentaar punktile „${c.clauseRef}"`, s: `${l.id} · ${c.autor}`, href: "#/leping/" + l.id, aeg: c.aeg })));
  TLEPINGUD.filter(t => t.staatus === "Saadetud").forEach(t =>
    n.push({ id: "n-tl-" + t.id, ic: I.user, t: `Tööpakkumine kandidaadil ülevaatamisel`, s: `${t.id} · ${t.isik}`, href: "#/tooleping/" + t.id, aeg: "" }));
  KEY_DATES.slice(0, 2).forEach(k =>
    n.push({ id: "n-kd-" + k.kuupaev + "-" + k.tyyp, ic: I.cal, t: k.tyyp, s: k.objekt, href: "#/kalender", aeg: fmtShort(k.kuupaev) }));
  return n;
}
function notifReadIds() { try { return JSON.parse(localStorage.getItem("thinkone_notif_read") || "[]"); } catch (e) { return []; } }
function updateNotifBadge() {
  const read = notifReadIds();
  const unread = buildNotifs().filter(x => !read.includes(x.id)).length;
  const b = document.getElementById("nbadge");
  if (b) { b.textContent = unread; b.hidden = !unread; }
  return unread;
}
function renderNotifs() {
  const el = document.getElementById("notif-pop"); if (!el) return;
  const read = notifReadIds();
  const items = buildNotifs();
  el.innerHTML = `
    <div class="np-head"><span class="overline">Teavitused</span>${items.some(x => !read.includes(x.id)) ? `<button class="steplink" onclick="markAllNotifs()">Märgi kõik loetuks</button>` : ""}</div>
    ${items.length ? items.map(x => `
    <button class="np-item ${read.includes(x.id) ? "read" : ""}" onclick="location.hash='${x.href}';document.getElementById('notif-pop').classList.remove('open')">
      <span class="np-ic">${x.ic}</span>
      <span class="np-tx"><span class="t">${x.t}</span><span class="s">${x.s}</span></span>
      ${x.aeg ? `<span class="np-aeg mono">${x.aeg}</span>` : ""}
      ${read.includes(x.id) ? "" : `<i class="np-dot"></i>`}
    </button>`).join("") : `<div class="muted" style="padding:16px;font-size:14px">Teavitusi pole.</div>`}`;
}
window.markAllNotifs = () => {
  try { localStorage.setItem("thinkone_notif_read", JSON.stringify(buildNotifs().map(x => x.id))); } catch (e) {}
  renderNotifs(); updateNotifBadge(); toast("Kõik teavitused märgitud loetuks");
};

/* --- omnibox: tulemused · küsi AI-lt (⌘K, Enter avab esimese) ---------------
   Tegevused elavad „+ Loo" nupus — omniboxis neid ei dubleerita. */
/* mitmesõnaline sobitus: iga sõna peab leiduma ("loo pakk" → "Loo hinnapakkumine…") */
function omniMatch(hay, q) { const w = q.split(/\s+/).filter(Boolean); return w.length && w.every(x => hay.includes(x)); }
function omniResults(q) {
  const res = [];
  if (q) {
    CLIENTS.forEach(c => { if (omniMatch((c.nimi + " " + c.registrikood).toLowerCase(), q)) res.push({ ic: I.user, t: c.nimi, s: `Klient · ${c.registrikood}`, href: "#/risk/" + c.id }); });
    OFFERS.forEach(o => { const cl = DB.clientById(o.clientId); if (omniMatch((o.id + " " + cl.nimi).toLowerCase(), q)) res.push({ ic: I.offer, t: `${o.id} · ${cl.nimi}`, s: `Pakkumus · ${o.staatus}`, href: "#/pakkumus/" + o.id }); });
    LEASES.forEach(l => { const cl = DB.clientById(l.clientId); if (omniMatch((l.id + " " + cl.nimi).toLowerCase(), q)) res.push({ ic: I.lease, t: `${l.id} · ${cl.nimi}`, s: `Üürileping · ${l.staatus}`, href: "#/leping/" + l.id }); });
    TLEPINGUD.forEach(t => { if (omniMatch((t.id + " " + t.isik).toLowerCase(), q)) res.push({ ic: I.user, t: `${t.id} · ${t.isik}`, s: `Tööleping · ${t.staatus}`, href: "#/tooleping/" + t.id }); });
    IMPORDITUD.forEach(x => { if (omniMatch((x.id + " " + x.pool + " " + x.liik).toLowerCase(), q)) res.push({ ic: I.file, t: `${x.id} · ${x.pool}`, s: `${x.liik} · imporditud`, href: "#/imp/" + x.id }); });
    /* lepingute sisu: klauslikiht (kuni 3 vastet, viib lepingusse õige punkti juurde) */
    if (q.length >= 3) klOtsi(q, 3).hits.forEach(h => res.push({ ic: I.file, t: `${klOsaLbl(h.p)}${h.p.nr} · ${h.p.pealkiri.toLowerCase()}`, s: `${h.id} · ${(klKehtiv(h.p) || h.p.tekst).slice(0, 80)}…`, href: "#/imp/" + h.id, focus: klKey(h.p) }));
    SPACES.forEach(s => { if (omniMatch((s.nimi + " " + (s.tenant || "")).toLowerCase(), q)) res.push({ ic: I.pin, t: `${s.nimi}${s.tenant ? " · " + s.tenant : ""}`, s: `${objektOf(s).nimi} · ${s.staatus}`, href: "#/objekt/" + objektOf(s).id }); });
  }
  return res.slice(0, 6);
}
function omniRender() {
  const inp = document.getElementById("omni-in"), pop = document.getElementById("omni-pop");
  if (!inp || !pop) return;
  const q = inp.value.trim().toLowerCase();
  const res = omniResults(q);
  const row = (r, first) => `<button class="om-row ${first ? "sel" : ""}" onclick="omniGo('${r.href}'${r.focus ? `,'${r.focus}'` : ""})">${r.ic.replace('<svg','<svg class="ic"')}<span class="tx"><span class="t">${r.t}</span>${r.s ? `<span class="s">${r.s}</span>` : ""}</span></button>`;
  let first = true; let html = "";
  if (res.length) { html += `<div class="om-lbl">Tulemused</div>` + res.map(r => { const h = row(r, first); first = false; return h; }).join(""); }
  html += `<div class="om-lbl">Küsi AI-lt</div>
    <button class="om-row om-ai ${first ? "sel" : ""}" onclick="omniAsk()">${I.spark.replace('<svg','<svg class="ic"')}<span class="tx"><span class="t">${q ? `Küsi AI-lt: „${inp.value.trim()}"` : "Ava AI-agent — küsi või anna korraldus"}</span><span class="s">vastus avaneb AI-paneelis</span></span></button>`;
  pop.innerHTML = html;
  pop.classList.add("open");
}
function omniGo(href, focus) { const pop = document.getElementById("omni-pop"); if (pop) pop.classList.remove("open"); const i = document.getElementById("omni-in"); if (i) i.value = ""; if (focus) IMP_FOCUS = focus; if (location.hash === href) router(); else location.hash = href; }
function omniAsk() { const i = document.getElementById("omni-in"); const q = i ? i.value.trim() : ""; const pop = document.getElementById("omni-pop"); if (pop) pop.classList.remove("open"); if (i) i.value = ""; runAgentPanel(q || ""); }
window.omniGo = omniGo; window.omniAsk = omniAsk;
function omniEnter() {
  const pop = document.getElementById("omni-pop");
  if (!pop || !pop.classList.contains("open")) { omniRender(); return; }
  /* Enter avab esimese: tulemus → küsi AI-lt */
  const inp = document.getElementById("omni-in");
  const q = inp ? inp.value.trim().toLowerCase() : "";
  const res = omniResults(q);
  if (res.length) { omniGo(res[0].href, res[0].focus); return; }
  omniAsk();
}

/* --- „+ Loo": 6 valikut (ainus värviline nupp) ------------------------------ */
function renderLooMenu() {
  const el = document.getElementById("loo-pop"); if (!el) return;
  const items = [
    { ic: I.offer, t: "Hinnapakkumine", s: "klient → riskiraport → pinnad", href: "#/pakkumus-uus" },
    { ic: I.lease, t: "Leping", s: "üürileping otse, ilma pakkumuseta", href: "#/leping-uus" },
    { ic: I.edit,  t: "Muudatus", s: "vali leping, uus lisa nr", href: "#/lepingud", msg: "Vali leping, mille muudatust alustada" },
    { ic: I.building, t: "Objekt", s: "Hoone → pinnad → pakkumuse seaded", href: "#/objekt-uus" },
    { ic: I.user,  t: "Klient", s: "äriregistri autotäide", href: "#/osapooled", msg: "Uus klient: äriregistri autotäide — demos näidisklientidega" },
    { ic: I.file,  t: "Impordi leping", s: "PDF/DOCX → struktuur originaali kõrval → kinnitus", href: "#/import" },
  ];
  el.innerHTML = items.map(x => `
    <button class="np-item" onclick="document.getElementById('loo-pop').classList.remove('open');location.hash='${x.href}';${x.msg ? `toast('${x.msg}')` : ""}">
      <span class="np-ic">${x.ic}</span>
      <span class="np-tx"><span class="t">${x.t}</span><span class="s">${x.s}</span></span>
    </button>`).join("");
}

/* AI-agent on globaalne: ⌘J / ikoon avab parempoolse paneeli, programmiline käivitus näidisnuppudelt */
window.askAgent = (q) => runAgentPanel(q);

function setMobileNav(open, restoreFocus = true) {
  const toggle = document.getElementById('mobile-nav-toggle');
  const backdrop = document.getElementById('nav-backdrop');
  const sidebar = document.getElementById('sidebar');
  const wasOpen = document.body.classList.contains('nav-open');
  document.body.classList.toggle('nav-open', open);
  if (toggle) { toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label', open ? 'Sulge menüü' : 'Ava menüü'); }
  if (backdrop) backdrop.hidden = !open;
  document.querySelectorAll('.main, .omni-center, .role-tab').forEach(el => { el.inert = open; });
  if (open && sidebar) [...sidebar.querySelectorAll('a, button')].find(el => el.getClientRects().length)?.focus();
  else if (wasOpen && restoreFocus && toggle) toggle.focus();
}

function boot() {
  try {
    renderShell();
    document.getElementById('mobile-nav-toggle').onclick = () => setMobileNav(!document.body.classList.contains('nav-open'));
    document.getElementById('nav-backdrop').onclick = () => setMobileNav(false);
    document.getElementById('nav').addEventListener('click', e => { if (e.target.closest('a')) setMobileNav(false); });
    window.matchMedia('(max-width: 1024px)').addEventListener('change', () => setMobileNav(false, false));
    window.addEventListener('resize', () => document.querySelectorAll('.nstack').forEach(nsLayout));
    window.addEventListener('keydown', e => {
      if (!document.body.classList.contains('nav-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); setMobileNav(false); }
      if (e.key === 'Tab') {
        const items = [...document.querySelectorAll('#sidebar a, #sidebar button')].filter(el => el.getClientRects().length && !el.disabled);
        const first = items[0], last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    });
    const shortcut = document.querySelector('.omni kbd');
    if (shortcut) shortcut.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
    /* AI-paneel: ikoon + ⌘J; sulgub navigeerimisel */
    const aiBtn = document.getElementById("ai-btn");
    if (aiBtn) aiBtn.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); agentPopOpen() ? closeAgentPop() : agentSuggest(); };
    window.addEventListener("hashchange", closeAgentPop);
    /* omnibox */
    const oi = document.getElementById("omni-in");
    if (oi) {
      oi.addEventListener("focus", omniRender);
      oi.addEventListener("input", omniRender);
      oi.addEventListener("keydown", e => {
        if (e.key === "Enter") omniEnter();
        if (e.key === "Escape") { const p = document.getElementById("omni-pop"); if (p) p.classList.remove("open"); oi.blur(); }
      });
      /* klaviatuuriteekond: fookus lahkub otsingust (Tab) → hüpik sulgub */
      const ow = document.getElementById("omni-wrap");
      if (ow) ow.addEventListener("focusout", e => { if (!ow.contains(e.relatedTarget)) { const p = document.getElementById("omni-pop"); if (p) p.classList.remove("open"); } });
    }
    /* sinine saatmisnupp = küsi AI-lt (tühjalt avab soovitused) */
    const osend = document.getElementById("omni-send");
    if (osend) osend.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); omniAsk(); };
    /* + Loo */
    renderLooMenu();
    const loo = document.getElementById("loo-btn");
    if (loo) loo.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); const p = document.getElementById("loo-pop"); if (p) loo.classList.toggle("open", p.classList.toggle("open")); };
    /* Seaded + kasutajamenüü */
    const st = document.getElementById("sb-settings");
    if (st) st.onclick = () => { location.hash = "#/seaded"; };
    const su = document.getElementById("sb-user");
    if (su) su.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); const p = document.getElementById("user-pop"); if (p) p.classList.toggle("open"); };
    /* külgriba kokku/lahti (ainult ikoonid); valik püsib localStorage'is */
    const appEl = document.querySelector(".app");
    const col = document.getElementById("sb-collapse");
    const setCollapse = (min) => {
      appEl.classList.toggle("sb-min", min);
      if (col) col.title = min ? "Ava menüü" : "Tõmba menüü kokku";
      try { localStorage.setItem("thinkone_sbmin", min ? "1" : "0"); } catch (e) {}
    };
    let sbMin = false; try { sbMin = localStorage.getItem("thinkone_sbmin") === "1"; } catch (e) {}
    setCollapse(sbMin);
    if (col) col.onclick = () => setCollapse(!appEl.classList.contains("sb-min"));
    window.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === "k") { e.preventDefault();
        const d = document.getElementById("dash-ask"); // avalehel fokuseeri suur komposer
        if (d) { d.focus(); return; }
        const i = document.getElementById("omni-in"); if (i && i.focus) { i.focus(); omniRender(); } }
      if ((e.metaKey || e.ctrlKey) && e.key && e.key.toLowerCase() === "j") { e.preventDefault(); agentPopOpen() ? closeAgentPop() : agentSuggest(); }
    });
    const sw = document.getElementById("role-switch");
    if (sw) sw.onclick = () => {
      /* dokumendivaates vahetades jää samale dokumendile ja vali selle klient */
      const m = location.hash.match(/^#\/(pakkumus|leping)\/(.+)$/);
      if (isClient()) {
        setRole("op", null, m ? location.hash : null);
      } else {
        let docu = null, visible = false;
        if (m) {
          docu = m[1] === "pakkumus" ? DB.offerById(m[2]) : DB.leaseById(m[2]);
          visible = docu && (m[1] === "pakkumus" ? clientSeesOffer(docu) : clientSeesLease(docu));
        }
        setRole("client", (docu && docu.clientId) || LAST_CLIENT, visible ? location.hash : null);
      }
    };
    const rs = document.getElementById("demo-reset");
    if (rs) rs.onclick = () => { if (confirm("Lähtesta demo algseisu? Kõik sisestatud andmed kustuvad.")) DB.reset(); };
    migrateRingFacts(); /* varasem demo-seis: jõustunud lisade faktid põhilepingust tagasi originaalile */
    router();
  } catch (e) {
    console.error(e);
    const v = document.getElementById("app-view");
    if (v) v.innerHTML = `<div class="view"><div class="note" style="background:var(--red-soft);color:var(--red-ink)">${I.info}<div><b>Demo viga:</b> ${e.message}</div></div></div>`;
  }
}
window.addEventListener("hashchange", router);
window.addEventListener("keydown", e => { if (e.key === "Escape") { closePdf(); closeSide(); closeAgentPop(); } });
/* juhtkaardi kompassinõel osutab kursori suunas — „süsteem näitab, kuhu minna".
   Dekoratiivne (markupis aria-hidden); reduced-motion eelistusel nõel ei liigu.
   rAF-throttle, üks kuular kogu äpile. */
(() => {
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  let raf = 0, mx = -1, my = -1;
  document.addEventListener("mousemove", (e) => {
    mx = e.clientX; my = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      document.querySelectorAll(".guide.me .g-needle").forEach(n => {
        const r = n.parentElement.getBoundingClientRect();
        if (!r.width) return;
        const dx = mx - (r.left + r.width / 2), dy = my - (r.top + r.height / 2);
        /* nurga „lahtikerimine": ilma selleta teeks nõel 179°→-179° hüppel terve tiiru */
        const prev = parseFloat(n.dataset.a || "0");
        let a = Math.atan2(dy, dx) * 180 / Math.PI;
        a += Math.round((prev - a) / 360) * 360;
        n.dataset.a = a;
        n.style.transform = `rotate(${a.toFixed(1)}deg)`;
      });
    });
  }, { passive: true });
})();
/* kujundusgalerii (kujundus.html) laeb app.js ainult komponentide (pill, STATUS, I, toast) pärast — kesta seal pole */
if (document.getElementById("app-view")) {
  if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot);
  else boot();
}
