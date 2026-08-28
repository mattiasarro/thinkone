/* ============================================================================
   ThinkOne — demorakenduse loogika (hash-router SPA, raamistikuvaba)
   ========================================================================== */
const DB = window.DB;
const { OBJEKT, OBJEKTID, objektOf, ACCOUNT, SPACES, CLIENTS, OFFERS, LEASES, ULD_CLAUSES, KEY_DATES,
        AUDIT, RISK_SOURCES, VAT_RATE, eur, withVat, rent, spaceParts, kkWinter, kkSummer,
        OSAKOND, AMETIKOHAD, TLEPINGUD, TL_ULD, IMPORDITUD, ametikohtHoive } = DB;
/* mitme hoone abistajad: hoonete nimed komplekti kohta + kas ettevõttel on >1 hoonet */
const multiObj = () => OBJEKTID.length > 1;
const hoonedOf = (spaces) => [...new Set(spaces.map(s => objektOf(s).nimi))].join(" + ");

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
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/></svg>`,
  lock:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`,
  check:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12l4.5 4.5L19 6"/></svg>`,
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
  /* allkirjastamismeetodid — maja oma ikoonikeeles (mitte brändimärgid):
     Smart-ID = nutitelefoni rakendus, Mobiil-ID = SIM-kaart */
  smartid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="6" y="2.5" width="12" height="19" rx="2.6"/><path d="M9.3 12.1l2 2 3.5-3.9"/></svg>`,
  mobiilid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5.5 4.6A1.6 1.6 0 0 1 7.1 3h6.4l5 5v11.4a1.6 1.6 0 0 1-1.6 1.6H7.1a1.6 1.6 0 0 1-1.6-1.6z"/><rect x="9" y="11" width="6" height="6" rx="1.2"/></svg>`,
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
const DEMO_TODAY = new Date(2026, 5, 10); // 10.06.2026
function parseEE(s) { const p = s.split("."); return new Date(+p[2], +p[1]-1, +p[0]); }
function daysUntil(eeDate) { return Math.ceil((parseEE(eeDate) - DEMO_TODAY) / 86400000); }
const TODAY_EE = "10.06.2026";

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
  document.querySelectorAll(".drop.open").forEach(d => { if (!e.target.closest(".pop-wrap") && !e.target.closest(".omni-wrap")) d.classList.remove("open"); });
  const cm = document.getElementById("co-menu");
  if (cm && cm.classList.contains("open") && !e.target.closest(".sb-context")) cm.classList.remove("open");
  const pm = document.getElementById("preset-menu");
  if (pm && pm.classList.contains("open") && !e.target.closest(".preset-wrap")) pm.classList.remove("open");
  if (agentPopOpen() && !e.target.closest("#agent-pop") && !e.target.closest("#ai-btn") && !e.target.closest(".composer") && !e.target.closest(".omni-wrap")) closeAgentPop();
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
    swEl.textContent = "← Tagasi operaatori vaatesse";
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
    swEl.textContent = "Vaata üürnikuna →";
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
const STATUS = {
  // pinnad
  "Vaba": "green", "Üüritud": "ink", "Lepingus": "blue", "Reserveeritud": "amber", "Pakkumusel": "violet",
  // pakkumus
  "Mustand": "grey", "Saadetud": "blue", "Kliendi ettepanek": "amber", "Aktsepteeritud": "green",
  "Lepinguks teisendatud": "green",
  "Tagasi lükatud": "red", "Aegunud": "grey", "Tühistatud": "red",
  // leping
  "Kehtiv": "green", "Allkirjastatud": "green", "Allkirjastamisel": "amber", "Lõppenud": "grey",
  "Mustand V1": "grey",
  // risk
  "MADAL": "green", "KESKMINE": "amber", "KÕRGE": "red",
  // kommentaar / kliendi tegevus ootab operaatori otsust — must: tegevus MINU laual
  "Ootel": "ink",
  // lõim käib: viimane sõna on öeldud, otsust veel pole
  "Arutelul": "amber",
  // operaatori ettepanek (uus sõnastus või selgitus) ootab üürniku kinnitust
  "Ootab kinnitust": "amber",
  // küsimus sai vastuse, muudatust ei sündinud — neutraalne informatiivne lõpp
  "Selgitatud": "blue",
  // üürnik kinnitas operaatori ettepaneku — kommentaari lõppolek (kuvanimi; sisemine väärtus on Aktsepteeritud)
  "Kinnitatud": "green",
  // punktil on lahtine kommentaar (Ootel või Ootab kinnitust) — dokumendirea kuvanimi; must nagu Ootel
  "Lahendamisel": "ink",
  // muudatusring (kehtiva lepingu muudatus → uus lisa)
  "Koostamisel": "grey", "Kinnitamisel": "amber", "Jõustunud": "green", "Teavitatud": "amber",
  // eritingimus mustandis: operaatori ettepanek (klient pole veel näinud)
  "Ettepanek": "blue", "Sõnastamisel": "amber",
  // ametikoht (hõive projektsioon) + import
  "Täidetud": "ink", "Täitmata": "grey", "Osaline hõive": "amber", "Pakkumisel": "violet", "Imporditud": "violet",
};
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
/* täidetud pill: dokumendireal peab lahtine punkt silma torkama ka siis, kui rea
   taust on peaaegu valge — ülejäänud pillid on taustata (ikoon + värviline kiri) */
const PILL_FILL = { "Lahendamisel": 1 };
const pill = (txt, kind) => {
  const shape = PILL_SHAPE[txt];
  const ic = shape ? `<span class="st">${stIcon(shape)}</span>` : `<i class="dot"></i>`;
  return `<span class="pill ${kind || STATUS[txt] || "grey"}${PILL_FILL[txt] ? " fill" : ""}">${ic}${txt}</span>`;
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
function openPdf(src, title) {
  if (!src || !/\.pdf$/i.test(src)) { toast("Sellel lisal pole faili — dokument genereeritakse süsteemis"); return; }
  document.getElementById("pdftitle").textContent = title || src.split("/").pop();
  const fr = document.getElementById("pdfframe"), ht = document.getElementById("pdfhtml");
  fr.style.display = ""; fr.src = src;
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
  const acts = []; /* ty: off = pakkumus (sinine) · lease = üürileping (violetne) · tl = tööleping (roheline) */
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

/* täituvuse joongraafik kuude lõikes (elab Esemeregistris; viimane punkt = hõivetest) */
function taituvusCard() {
  const occ = SPACES.filter(s => ["Üüritud","Lepingus"].includes(s.staatus));
  const m2All = SPACES.reduce((s,x) => s + x.yyripind, 0);
  const m2Occ = occ.reduce((s,x) => s + x.yyripind, 0);
  const pct = Math.round(m2Occ / m2All * 100);
  const rentOcc = occ.reduce((s,x) => s + rent(x), 0);
  const KUUD_LBL = ["jul","aug","sep","okt","nov","dets","jaan","veeb","märts","apr","mai","juuni"];
  const KUUD_FULL = ["Juuli 2025","August 2025","September 2025","Oktoober 2025","November 2025","Detsember 2025",
    "Jaanuar 2026","Veebruar 2026","Märts 2026","Aprill 2026","Mai 2026","Juuni 2026 · praegu"];
  const series = [...DB.TAITUVUS_AJALUGU, pct];
  const n = series.length;
  const lo = Math.max(0, Math.min(...series) - 6), hi = Math.min(100, Math.max(...series) + 6);
  const X = i => ((i + 0.5) / n) * 100;
  const Y = v => 100 - ((v - lo) / ((hi - lo) || 1)) * 100;
  const linePts = series.map((v,i) => `${X(i).toFixed(2)},${Y(v).toFixed(2)}`).join(" ");
  const areaPts = `${X(0).toFixed(2)},100 ${linePts} ${X(n-1).toFixed(2)},100`;
  const gridTicks = [];
  for (let gt = Math.ceil(lo / 10) * 10; gt <= Math.floor(hi / 10) * 10; gt += 10) gridTicks.push(gt);
  return `
  <div class="card hero reveal" style="margin-bottom:20px">
    <div class="between" style="align-items:flex-start">
      <div><h2 style="font-size:22px">Täituvus</h2>
        <div class="muted" style="font-size:12.5px;margin-top:5px;max-width:360px">Staatus on projektsioon — arvutub hõivetest, seda ei hallata käsitsi.</div></div>
      <span class="tag">${multiObj() ? OBJEKTID.map(o=>o.nimi).join(" · ") : OBJEKT.nimi} · ${SPACES.length} pinda</span>
    </div>
    <div class="hero-body">
      <div>
        <div class="hero-big">${pct}<small>%</small></div>
        <div class="muted" style="font-size:12.5px;margin-top:6px">üüripinnast hõives<br>(${eur(m2Occ,0)} / ${eur(m2All,0)} m²)</div>
        <div class="divline"></div>
        <div class="mono" style="font-size:15px;font-weight:600">${eur(rentOcc,0)} € <span class="muted" style="font-weight:400;font-size:11.5px">üüritulu / kuus</span></div>
      </div>
      <div style="min-width:0">
        <div class="lchart">
          ${gridTicks.map(gt => `<div class="gline" style="top:${Y(gt).toFixed(1)}%"><span class="mono">${gt}%</span></div>`).join("")}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id="lgrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="rgba(0,89,207,.18)"/><stop offset="1" stop-color="rgba(0,89,207,0)"/></linearGradient></defs>
            <polygon points="${areaPts}" fill="url(#lgrad)"/>
            <polyline points="${linePts}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
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
      <a class="overline" href="#/objekt" style="margin-left:auto">Pinnad →</a>
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
      <div class="dm-q reveal">Millega saan täna aidata?</div>

      <!-- 4 kiirkaarti tervituse ja sisendi vahel (kontekstitundlikud:
           B11G seadistuse ajal asendub esimene „Jätka seadistust" kaardiga) -->
      <div class="dm-cards reveal">
        ${DB.COMPANY_ID === "b11g" ? `
        <a class="dm-card" href="#/register" onclick="toast('Seadistus: pinnaplaanid ja Moderani kõrvalkulu on veel lisamata (3/5 tehtud)')">
          <span class="qi">${I.building}</span><span class="lbl">Jätka seadistust <span class="mono" style="color:var(--accent-deep)">3/5</span></span><span class="arr">${I.arrow}</span>
        </a>` : `
        <a class="dm-card" href="#/pakkumus-uus">
          <span class="qi">${I.offer}</span><span class="lbl">Loo pakkumine</span><span class="arr">${I.arrow}</span>
        </a>`}
        <a class="dm-card" href="#" id="qc-ask">
          <span class="qi">${I.spark}</span><span class="lbl">Küsi portfelli kohta</span><span class="arr">${I.arrow}</span>
        </a>
        <a class="dm-card" href="#/risk">
          <span class="qi">${I.risk}</span><span class="lbl">Riskiraport</span><span class="arr">${I.arrow}</span>
        </a>
        <a class="dm-card" href="#/lepingud" onclick="toast('Import: PDF/DOCX loetakse klauslimudelisse, operaator kinnitab')">
          <span class="qi">${I.file}</span><span class="lbl">Impordi leping</span><span class="arr">${I.arrow}</span>
        </a>
      </div>

      <!-- AI-komposer: sisend üleval, all vasakul logo + agendi eelseadistus, paremal manused/mikrofon/saada -->
      <div class="composer reveal">
        <input id="dash-ask" placeholder="${AGENT_PRESETS[0].ph}" autocomplete="off"/>
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
      <!-- chati all: tegevust vajavad punktid (peidus koondnumbri taga) + kalender -->
      <div class="dm-actions reveal">
        <button class="dm-attn ${acts.length ? "" : "ok"}" id="attn-btn" title="Vajab tegevust täna">
          ${I.bell}
          <span>Vajab tegevust</span>
          <span class="cnt mono">${acts.length}</span>
        </button>
        <button class="dm-attn" id="kd-btn" title="Võtmekuupäevad">
          ${I.cal}
          <span>Võtmekuupäevad</span>
          <span class="cnt mono">${KEY_DATES.length}</span>
        </button>
      </div>

      <div class="card dm-actpanel" id="attn-panel" hidden>
        <div class="between" style="padding:18px 24px 0">
          <h2 style="font-size:15px">Vajab tegevust täna</h2>
          <span class="pill ink"><i class="dot"></i>${acts.length}</span>
        </div>
        <div class="act-list" style="padding:4px 24px 12px">
          ${acts.length ? acts.map(a => `
          <div class="arow" onclick="location.hash='${a.href}'">
            <span class="icotile t-${a.ty}">${a.ic}</span>
            <div style="flex:1;min-width:0"><div class="t">${a.t}</div><div class="s mono">${a.s}</div></div>
            ${pill(a.pill[0], a.pill[1])}
            <span class="chev">${I.arrow}</span>
          </div>`).join("") : `<div class="muted" style="padding:14px 0;font-size:13px">Kõik tehtud — midagi ei oota otsust.</div>`}
        </div>
      </div>

      <div class="card dm-actpanel" id="kd-panel" hidden>
        <div class="between" style="padding:18px 24px 0">
          <h2 style="font-size:15px">Võtmekuupäevad</h2>
          <a class="overline" href="#/kalender">Ava kalender →</a>
        </div>
        <div class="kd" style="padding:6px 24px 14px">
          ${KEY_DATES.slice(0,6).map(k => { const ki = kdIcon(k.tyyp); return `
          <div class="kd-item" title="${k.info}">
            <span class="kd-ic ${ki.cls}">${ki.ic}</span>
            <div style="flex:1;min-width:0;text-align:left"><div class="t">${k.tyyp}</div><div class="s">${k.objekt}</div></div>
            <span class="kd-date mono">${fmtShort(k.kuupaev)}</span>
          </div>`; }).join("")}
        </div>
      </div>
    </div>
  </div>`;
};

View.dashboard.init = () => {
  const inp = document.getElementById("dash-ask");
  const go = document.getElementById("dash-go");
  if (go) go.onclick = () => runAgentPanel(inp ? inp.value : "");
  if (inp) { inp.addEventListener("keydown", e => { if (e.key === "Enter") runAgentPanel(inp.value); }); inp.focus(); }
  /* kiirkaart „Küsi portfelli kohta" fokuseerib sisendi */
  const qc = document.getElementById("qc-ask");
  if (qc) qc.onclick = (e) => { if (e && e.preventDefault) e.preventDefault(); if (inp && inp.focus) inp.focus(); };
  /* kaks avanevat paneeli chati all — korraga lahti üks */
  const ab = document.getElementById("attn-btn"), ap = document.getElementById("attn-panel");
  const kb = document.getElementById("kd-btn"), kp = document.getElementById("kd-panel");
  const setPanel = (btn, panel, open, otherBtn, otherPanel) => {
    panel.hidden = !open; btn.classList.toggle("open", open);
    if (open && otherPanel && !otherPanel.hidden) { otherPanel.hidden = true; if (otherBtn) otherBtn.classList.remove("open"); }
  };
  if (ab && ap) ab.onclick = () => setPanel(ab, ap, ap.hidden, kb, kp);
  if (kb && kp) kb.onclick = () => setPanel(kb, kp, kp.hidden, ab, ap);
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
function openAgentPop() {
  const p = document.getElementById("agent-pop");
  if (p) p.classList.add("open");
  const cx = document.getElementById("ag-ctx");
  if (cx) cx.innerHTML = `<span class="ag-chip">${I.pin.replace('<svg','<svg class="ic"')} Vaatad: ${agentCtx()}</span>`;
}
function closeAgentPop() {
  const p = document.getElementById("agent-pop");
  if (p) p.classList.remove("open");
}
const agentPopOpen = () => { const p = document.getElementById("agent-pop"); return p && p.classList.contains("open"); };

function wireAgentInput(focus) {
  const f = document.getElementById("agent-follow");
  if (!f) return;
  f.addEventListener("keydown", e => { if (e.key === "Enter" && f.value.trim()) runAgentPanel(f.value); });
  if (focus) f.focus();
}

function runAgentPanel(cmd) {
  if (!cmd || !cmd.trim()) { agentSuggest(); return; }
  const head = document.getElementById("ag-head");
  const body = document.getElementById("ag-body");
  const foot = document.getElementById("ag-foot");
  head.innerHTML = `<div class="flex" style="gap:9px"><span style="width:18px;color:var(--accent-deep);display:flex">${I.spark}</span>
      <div><div class="overline">AI-agent</div>
      <div style="font-weight:700;font-size:15px;margin-top:2px">„${cmd.length > 60 ? cmd.slice(0,60) + "…" : cmd}"</div></div></div>`;
  body.innerHTML = `
    <div class="muted" style="font-size:12px;margin-bottom:12px">Mudel analüüsib korraldust, tuvastab olemid…</div>
    <div class="skel" style="height:13px;width:88%"></div>
    <div class="skel" style="height:13px;width:72%;margin-top:9px"></div>
    <div class="skel" style="height:13px;width:80%;margin-top:9px"></div>
    <div class="skel" style="height:34px;width:55%;margin-top:16px;border-radius:999px"></div>`;
  foot.innerHTML = agentFoot("Jätka vestlust…");
  openAgentPop();
  wireAgentInput(false);
  setTimeout(() => { const b = document.getElementById("ag-body"); if (b) b.innerHTML = `<div class="ag-answer">${agentAnswer(cmd)}</div>`; }, 950);
}

function agentAnswer(cmd) {
  const q = cmd.toLowerCase();
  // Q&A üle KÕIGI vertikaalide — töölepingud (katseaeg / palgaülevaatus)
  if (q.includes("katsea") || q.includes("palgaülevaatus") || q.includes("palgaylevaatus")) {
    return `
      <div class="overline" style="margin-bottom:10px">Vastus</div>
      <div style="font-size:13.5px;line-height:1.65">
        Sel kuul (juuni 2026) ei lõpe ühtegi katseaega. Järgmine: <b>Marten Kivi</b> (Hooldustehnik,
        <span class="mono">TL-2026-004</span>) — katseaeg lõpeb <b>30.09.2026</b>, teavitus 14 päeva ette.<br><br>
        Järgmine palgaülevaatus: <b>Karl Mets</b> (Objektihaldur) — 01.03.2027, kokku lepitud töölepingus.
      </div>
      <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn btn-accent btn-sm" href="#/tooleping/TL-2026-004">${I.arrow} Ava tööleping</a>
        <a class="btn btn-ghost btn-sm" href="#/kalender">${I.cal} Võtmekuupäevad</a>
      </div>`;
  }
  // Q&A — imporditud lepingud (olemasolev portfell)
  if (q.includes("kindlustus") || q.includes("haldusleping") || q.includes("import")) {
    if (DB.COMPANY_ID === "b11g") {
      return `
      <div class="overline" style="margin-bottom:10px">Vastus</div>
      <div style="font-size:13.5px;line-height:1.65">
        Betooni 11g hoonete (Stock Office · Self Storage) kohta <b>kindlustuslepingut registris ei ole</b>. Imporditud on kaks lepingut:
        üürileping <span class="mono">LEP-2023-041</span> (Viking Metall OÜ) ja hooldusleping
        <span class="mono">HOO-2024-06</span> (Clanner Kinnisvarahooldus OÜ).<br><br>
        <span class="muted" style="font-size:12px">Soovitus: lisa varakindlustuse poliis impordi kaudu,
        siis jõuab selle lõpptähtaeg võtmekuupäevade kalendrisse.</span>
      </div>
      <div style="margin-top:14px"><a class="btn btn-accent btn-sm" href="#/imp/HOO-2024-06">${I.arrow} Ava imporditud leping</a></div>`;
    }
    return `
      <div class="overline" style="margin-bottom:10px">Vastus</div>
      <div style="font-size:13.5px;line-height:1.65">
        Hoone T6B varakindlustus: <b>If P&C Insurance AS</b>, poliis <span class="mono">KIN-2026-07</span> —
        kindlustussumma 4,2 M€, poliis kehtib kuni <b>31.01.2027</b> (teavitus 90 päeva ette).<br><br>
        <span class="muted" style="font-size:12px">Vastus tugineb imporditud lepingu tuvastatud struktuurile —
        õiguslik tõde on allkirjastatud originaaldokument.</span>
      </div>
      <div style="margin-top:14px"><a class="btn btn-accent btn-sm" href="#/imp/KIN-2026-07">${I.arrow} Ava imporditud leping</a></div>`;
  }
  // Q&A — seis / indekseerimine
  if (q.includes("seisus") || q.includes("indekseer") || q.includes("millal")) {
    return `
      <div class="overline" style="margin-bottom:10px">Vastus</div>
      <div style="font-size:13.5px;line-height:1.65">
        <b>Future Invest OÜ:</b> aktiivne pakkumus <span class="mono">PAK-2026-014</span> (Pind 12, mustand, kehtib 23.06.2026). Allkirjastatud lepinguid veel ei ole.<br><br>
        Järgmine indekseerimine portfellis: <b>01.07.2026</b> — LEP-2025-014 (Estplast OÜ), Statistikaameti THI, <i>automaatne, lisa ei teki</i>.
      </div>
      <div style="margin-top:14px"><a class="btn btn-ghost btn-sm" href="#/kalender">${I.cal} Ava võtmekuupäevad</a></div>`;
  }
  // Toiming — riskiraport
  if (q.includes("riskiraport") || q.includes("riski")) {
    return agentEntities([
      { ic: I.user, lbl: "Ettevõte", val: "Roheline Ladu OÜ" },
      { ic: I.shield, lbl: "Toiming", val: "Riskiraport (etapp 04)" },
    ]) + `<div style="margin-top:14px"><a class="btn btn-accent btn-sm" href="#/risk/c-rohe">${I.risk} Ava riskiraport →</a></div>`;
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
    <div class="muted" style="margin-top:12px;font-size:12.5px">Mustand on koostatud õigete m²-de ja hindadega. Saatmine nõuab operaatori kinnitust.</div>
    <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap">
      <a class="btn btn-accent btn-sm" href="#/pakkumus/PAK-2026-014">${I.arrow} Ava pakkumuse mustand</a>
      <a class="btn btn-ghost btn-sm" href="#/pakkumus-uus">Ava koostamise vaade</a>
    </div>`;
}
/* tühi sisend → näidiskorralduste vaade (mida agent oskab) */
function agentSuggest() {
  const head = document.getElementById("ag-head");
  const body = document.getElementById("ag-body");
  const foot = document.getElementById("ag-foot");
  head.innerHTML = `<div class="flex" style="gap:9px"><span style="width:18px;color:var(--accent-deep);display:flex">${I.spark}</span>
    <div><div class="overline">AI-agent</div>
    <div style="font-weight:700;font-size:15px;margin-top:2px">Mida agent oskab</div></div></div>`;
  body.innerHTML = `
    <div style="font-size:13.5px;line-height:1.65;color:var(--ink-2)">Kirjuta vabas vormis korraldus või küsimus — agent tuvastab olemid, käivitab õige töövoo või vastab kogu portfelli põhjal (sh imporditud lepingud).</div>
    <div class="muted" style="font-size:12px;margin-top:10px">Nt „Loo pakkumine Future Invest OÜ-le, pind 12" · „Kelle katseaeg lõpeb sel kuul?" · „Mis seisus on hoone kindlustus?"</div>
    <div class="muted" style="font-size:11.5px;margin-top:12px">Tagajärgedega sammud (saatmine, allkirjastamine) nõuavad alati operaatori kinnitust.</div>`;
  foot.innerHTML = agentFoot("Küsi, otsi või anna korraldus — agent aitab…");
  openAgentPop();
  wireAgentInput(true);
}

/* paneeli jalus: suur kutsuv sisend + saada-nupp */
function agentFoot(placeholder) {
  return `<div class="ag-input">
    <span class="spk">${I.spark}</span>
    <input id="agent-follow" placeholder="${placeholder}" autocomplete="off"/>
    <button class="ag-send" onclick="sendAgentPrompt()" title="Saada (Enter)">${I.enter}</button></div>`;
}
window.sendAgentPrompt = () => { const f = document.getElementById("agent-follow"); if (f && f.value.trim()) runAgentPanel(f.value); };

function agentEntities(items) {
  return `<div class="flex" style="gap:8px;margin-bottom:4px"><span class="spark" style="width:18px;color:var(--accent-deep)">${I.spark}</span>
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
          <div style="font-weight:700;font-size:19px;margin-top:5px">${o.nimi}</div>
          <div class="muted" style="font-size:12.5px;margin-top:2px">${o.ehr.aadress}</div></div>
        <span class="tag lime">Ärikinnisvara</span>
      </div>
      <div class="divline"></div>
      <dl class="kv">
        <dt>Üksused</dt><dd>${sp.length} ${boksid ? "laoboksi" : "üüripinda"} · ${eur(m2,0)} m²</dd>
        <dt>Hõive</dt><dd>${hoivatud} üüritud/lepingus · ${vabad} vaba <span class="muted" style="font-size:11px">(projektsioon)</span></dd>
        <dt>Atribuudiskeem</dt><dd class="muted" style="font-size:12.5px">${boksid ? "m² · hind €/m² · korrus — oma mall (laoboksi üldtingimused)" : "m² · hind €/m² · elektrivõimsus · parkimine · Lisa 1 plaan"}</dd>
      </dl>
      <a class="btn btn-primary btn-sm" style="margin-top:14px" href="#/objekt/${o.id}">Ava ${boksid ? "boksid" : "pinnad"} ${I.arrow}</a>
    </div>`;
  };

  const akRow = (a) => {
    const h = ametikohtHoive(a);
    const tl = TLEPINGUD.find(t => t.ametikohtId === a.id && t.staatus === "Kehtiv");
    const pakkumine = TLEPINGUD.find(t => t.ametikohtId === a.id && t.staatus !== "Kehtiv");
    const olek = h >= a.kvoot ? "Täidetud" : pakkumine ? "Pakkumisel" : h > 0 ? "Osaline hõive" : "Täitmata";
    const link = tl ? `#/tooleping/${tl.id}` : pakkumine ? `#/tooleping/${pakkumine.id}` : null;
    return `<tr class="${link?'clickable':''}" ${link?`onclick="location.hash='${link}'"`:""}>
      <td><div style="font-weight:600">${a.nimi}</div><div class="muted" style="font-size:11.5px">${a.ylesanded}</div></td>
      <td class="r mono">${eur(a.tasu,0)} €</td>
      <td class="mono">${a.katseaeg}</td>
      <td class="r mono"><b>${h}</b> / ${a.kvoot}</td>
      <td>${pill(olek)}${tl?`<div class="muted" style="font-size:11px;margin-top:3px">${tl.isik}</div>`:pakkumine?`<div class="muted" style="font-size:11px;margin-top:3px">${pakkumine.isik} (kandidaat)</div>`:""}</td>
    </tr>`; };

  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Esemeregister</h1></div>
      <a class="btn btn-ghost btn-sm" href="#/portfell">${I.back} Portfell</a>
    </div>

    <div class="grid g2 reveal" style="gap:18px;align-items:stretch">
      ${OBJEKTID.map(hooneCard).join("")}

      <div class="card pad">
        <div class="between" style="align-items:flex-start">
          <div><div class="overline">Osakond</div>
            <div style="font-weight:700;font-size:19px;margin-top:5px">${OSAKOND.nimi}</div>
            <div class="muted" style="font-size:12.5px;margin-top:2px">${OSAKOND.ettevote}</div></div>
          <span class="tag lav">Töölepingud</span>
        </div>
        <div class="divline"></div>
        <dl class="kv">
          <dt>Üksused</dt><dd>${AMETIKOHAD.length} ametikohta · kvoot ${kvoot} kohta</dd>
          <dt>Hõive</dt><dd>${taidetud} / ${kvoot} täidetud <span class="muted" style="font-size:11px">(headcount = kvoothõive)</span></dd>
          <dt>Atribuudiskeem</dt><dd class="muted" style="font-size:12.5px">ülesanded · töötasu · katseaeg · ametijuhend manusena</dd>
        </dl>
        <div class="muted" style="margin-top:14px;font-size:11.5px">Vertikaal = konfiguratsioon + õhuke koodmoodul (arvutused, TÖR-adapter) — mitte uus koodibaas.</div>
      </div>
    </div>

    <div class="sec-h reveal" style="margin-top:30px"><h2>Ametikohad</h2><span class="meta">osakond ${OSAKOND.nimi} · klõpsa real lepingu/pakkumise avamiseks</span></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Ametikoht</th><th class="r">Töötasu (bruto)</th><th>Katseaeg</th><th class="r">Hõive</th><th>Olek</th></tr></thead>
        <tbody>${AMETIKOHAD.map(akRow).join("")}</tbody>
      </table>
    </div>

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
    <a class="btn btn-ghost btn-sm reveal" href="#/register" style="margin-bottom:18px">${I.back} Esemeregister</a>
    ${multiObj() ? `
    <div class="qa reveal" style="margin-bottom:18px">
      ${OBJEKTID.map(o => `<a href="#/objekt/${o.id}" class="${o.id===obj.id?'qa-new':''}"><span class="qi">${I.building}</span>${o.nimi}</a>`).join("")}
    </div>`:""}
    <div class="card obj-hero reveal">
      <div class="band">
        <div class="flex" style="justify-content:space-between;align-items:flex-start">
          <div>
            <div class="overline" style="color:var(--faint)">Objekt · ärikinnisvara${multiObj() ? ` · ${ACCOUNT.landlord.nimi}` : ""}</div>
            <h1 style="margin-top:6px">${obj.nimi}</h1>
            <div class="addr">${e.aadress}</div>
          </div>
          <div style="text-align:right">
            ${obj.kaibemaksugaMaksustatud ? pill("KM-kohustus: JAH","accent") : pill("KM-kohustus: EI","grey")}
            <div class="mono" style="color:var(--muted);font-size:11px;margin-top:8px">EHR ${e.kood}</div>
            <button class="btn btn-ghost btn-sm" style="margin-top:10px;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.25);color:#fff" onclick="toast('EHR autotäite käsitsi parandus — demos illustratiivne')">${I.edit} Muuda</button>
          </div>
        </div>
      </div>
      <div class="ehr-grid">
        ${[
          ["Kasutusotstarve", e.kasutusotstarve, ""],
          ["Ehitisealune pind", e.ehitisealunePind.toLocaleString("et-EE"), "m²"],
          ["Suletud netopind", e.suletudNetopind.toLocaleString("et-EE"), "m²"],
          ["Korruseid", e.korrusteArv, ""],
          ["Ehitusaasta", e.ehitusaasta, ""],
          [boksid ? "Bokse kokku" : "Parkimiskohti kokku", boksid ? spaces.length : spaces.reduce((s,x)=>s+x.parkimine,0), ""],
        ].map(([l,v,u]) => `<div class="ehr-cell"><div class="l">${l}</div><div class="v mono">${v}${u?` <span class="u">${u}</span>`:""}</div></div>`).join("")}
      </div>
    </div>

    <div class="grid g2 reveal" style="gap:16px;margin-top:16px">
      <div class="card pad">
        <div class="between" style="margin-bottom:10px"><div class="overline">Kõrvalkulu</div>
          <button class="steplink" onclick="toast('Moderan: viimase 12 kuu keskmine uuendatud')">Uuenda</button></div>
        <dl class="kv">
          <dt>Talvine (okt–märts)</dt><dd class="mono">${eur(k.talvine)} €/m²</dd>
          <dt>Suvine (apr–sept)</dt><dd class="mono">${eur(k.suvine)} €/m²</dd>
          <dt>Allikas</dt><dd style="font-size:12px">${k.allikas}</dd>
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

    <div class="sec-h reveal" style="margin-top:30px"><h2>${boksid ? "Laoboksid" : "Üüripinnad"}</h2><span class="meta">${spaces.length} ${boksid ? "boksi (näidis — päris majas kümneid)" : "pinda"} · klõpsa kaardil pinna paneeli avamiseks</span>
      <div style="margin-left:auto;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="openPdf('${pf}','Lisa 1 · pinnaplaan')">${I.pin} Pinnaplaan</button>
        <button class="btn btn-ghost btn-sm" onclick="openPdf('${kf}','Lisa 2 · asendiplaan + parkimisskeem')">${I.car} Parkimisskeem</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('Import: mall alla → fail üles → reaviisiline valideerimine veateadetega → kinnita. Demos illustratiivne.')">${I.file} Impordi pinnad (CSV/Excel)</button>
        <button class="btn btn-primary btn-sm" onclick="toast('Uus pind: käsitsi vorm — demos illustratiivne')">${I.plus} Lisa pind</button>
      </div>
    </div>
    <div class="pf-views reveal" id="sp-filter" style="margin-bottom:14px">
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
          <div><div class="mono" style="font-weight:650;font-size:15px">${s.nimi}</div>
            <div class="muted" style="font-size:11.5px;margin-top:2px">${s.tyyp}${!boksid && s.parkimine ? ` · ${s.parkimine} parkimiskohta` : ""}</div></div>
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
                     : `<span class="muted" style="font-size:11.5px">${s.tenant}</span>`)
            : `<span class="muted" style="font-size:11.5px">Netopind ${eur(s.neto,1)} m² · koef ${s.koef}</span>`}
        </div>
      </div>`; }).join("")}
    </div>
    <div class="muted reveal" id="sp-tyhi" style="display:none;padding:26px;text-align:center;font-size:13px">Selle filtriga pindu pole.</div>
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
    <div style="margin-top:6px">${pill(s.staatus)}</div>`;
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
    <button class="att ${o.failid.pinnaplaan ? "" : "nofile"}" onclick="openPdf('${o.failid.pinnaplaan || ""}','Lisa 1 · pinnaplaan · ${s.nimi}')">
      ${I.file.replace('<svg','<svg class="fic"')}<div style="flex:1"><b>Lisa 1</b> · Pinnaplaan</div><span class="tag">${o.failid.pinnaplaan ? "PDF · vaata" : "lisamata"}</span></button>
    <div class="divline"></div>
    <div class="overline" style="margin-bottom:8px">Hõive ajalugu</div>
    ${hist.length ? hist.map(h => `
    <div class="kd-item" ${h.href ? `style="cursor:pointer" onclick="closeSide();location.hash='${h.href}'"` : ""}>
      <span class="kd-ic green">${I.user}</span>
      <div style="flex:1;min-width:0"><div class="t" style="font-size:13px">${h.kes}</div><div class="s">${h.millal} · ${h.hind}</div></div>
      ${pill(h.olek)}
    </div>`).join("") : `<div class="muted" style="font-size:12.5px">Pind on vaba — ajalugu koguneb hõivetest.</div>`}`;
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
  mustand: { t: "Mustand", st: ["Mustand"] },
  saadetud: { t: "Saadetud", st: ["Saadetud"] },
  labiraakimisel: { t: "Läbirääkimisel", st: ["Kliendi ettepanek"] },
  aktsepteeritud: { t: "Aktsepteeritud", st: ["Aktsepteeritud", "Lepinguks teisendatud"] },
};
View.pakkumised = (f) => {
  const flt = f && OFFER_FILTERS[f];
  const rows = flt ? OFFERS.filter(o => flt.st.includes(o.staatus)) : OFFERS;
  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Hinnapakkumised</h1></div>
      <a class="btn btn-accent" href="#/pakkumus-uus">${I.offer} Uus pakkumine</a>
    </div>
    ${flt ? `<div class="flex reveal" style="margin-bottom:14px;gap:10px">${pill("Filter: " + flt.t, "blue")}<a class="steplink" href="#/pakkumised">Näita kõiki (${OFFERS.length})</a></div>` : ""}
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Tunnus</th><th>Klient</th><th>Pind</th><th>Pikkus</th><th>Kehtib kuni</th><th class="r">Üür / kuus</th><th>Olek</th></tr></thead>
        <tbody>
        ${rows.length ? rows.map(o => { const cl = DB.clientById(o.clientId); const t = offerTotals(o);
          return `<tr class="clickable" onclick="location.hash='#/pakkumus/${o.id}'">
            <td><span class="id">${o.id}</span></td>
            <td>${cl.nimi}</td>
            <td class="mono">${t.spaces.map(s=>`${s.nimi} · ${eur(s.yyripind,1)} m²`).join("<br>")}</td>
            <td class="mono">${o.pikkusKuud} kuud</td>
            <td class="mono">${o.kehtivKuni}</td>
            <td class="r mono"><b>${eur(t.rentSum)}</b> €</td>
            <td>${pill(o.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:18px">Selles faasis pakkumusi pole.</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
};

/* ---------- Pakkumuse detail ---------------------------------------------- */
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
  const sIdx = seotud.length ? 3 : ({ "Mustand":0,"Saadetud":1,"Kliendi ettepanek":1,"Tagasi lükatud":1,"Aegunud":1,"Aktsepteeritud":2,"Lepinguks teisendatud":3 }[o.staatus] ?? 0);
  /* kliendi rada on lühem — mustand pole tema maailmas olemas */
  const clSteps = ["Saadetud", "Aktsepteeritud", "Leping"];
  const clIdx = (seotud.length || o.staatus === "Lepinguks teisendatud") ? 2 : o.staatus === "Aktsepteeritud" ? 1 : 0;
  /* redigeerimisel saab pindu lisada: vabad pinnad, mis pole veel pakkumuses */
  const availSpaces = SPACES.filter(s => s.staatus === "Vaba" && !o.spaceIds.includes(s.id));
  /* läbirääkimiste logi — mõlemale poolele nähtav ajalugu, püsib läbi voorude */
  const nego = o.labiraakimised || [];
  const negoMsg = (m) => `<div class="nego-msg ${m.roll}">
    <div class="nm">${m.autor} · <span class="mono">${m.aeg}</span></div>
    <div class="tx">${m.tekst}</div></div>`;
  const negoCard = nego.length ? `
    <div class="card pad reveal" style="margin-top:18px">
      <div class="overline" style="margin-bottom:10px">Läbirääkimised</div>
      ${nego.map(negoMsg).join("")}
    </div>` : "";
  /* uus eritingimus lisandub alati täiendava punktina — „kirjutab üle" seosed
     tekivad läbirääkimistel süsteemi kaudu, käsitsi valikut siin pole */

  return `
  <div class="view">
    <a class="btn btn-ghost btn-sm reveal" href="${isClient()?'#/portaal':'#/pakkumised'}" style="margin-bottom:18px">${I.back} ${isClient()?'Minu dokumendid':'Pakkumised'}</a>
    <div class="page-head reveal">
      <div><div class="overline">Hinnapakkumine</div>
        <h1 class="page-h1" style="margin-top:8px">${cl.nimi}</h1>
        <p class="page-sub mono" style="font-family:var(--font-mono);font-size:12px">${o.id} · loodud ${o.loodud} · ${o.looja}</p></div>
      <div style="text-align:right">${pill(o.staatus)}<div class="muted mono" style="font-size:11px;margin-top:8px">Kehtib kuni ${o.kehtivKuni}</div>
        <div style="margin-top:10px"><a class="btn btn-ghost btn-sm" href="#/pakkumus-doc/${o.id}">${I.file} Eelvaade · prindi / PDF</a></div></div>
    </div>

    ${isClient() ? `
    <!-- kliendi minimalistlik olekurada: peenike rööbas, hetkeseis pulseeriva punktiga -->
    <div class="cl-track reveal">
      ${clSteps.map((st,i) => `${i?`<span class="ct-rail ${i<=clIdx?'done':''}"></span>`:""}
        <span class="ct-step ${i<clIdx?'done':i===clIdx?'current':''}"><i></i><span>${st}</span></span>`).join("")}
    </div>` : `
    <!-- operaatori olekurada — sama minimalistlik keel; kliendi ettepanek värvib hetkesammu kollaseks -->
    <div class="cl-track reveal">
      ${states.map((st,i) => `${i?`<span class="ct-rail ${i<=sIdx?'done':''}"></span>`:""}
        <span class="ct-step ${i<sIdx?'done':i===sIdx?'current':''}${i===sIdx && o.staatus==="Kliendi ettepanek" ? ' amber':''}"><i></i><span>${i===1 && o.staatus==="Kliendi ettepanek" ? "Kliendi ettepanek" : st}</span></span>`).join("")}
    </div>
    ${o.staatus==="Kliendi ettepanek" ? `
    <!-- ettepanek on ainus operaatori otsust ootav asi — seisab omaette tegevuskaardina -->
    <div class="prop-note reveal">
      <span class="pn-ic">${I.chat}</span>
      <div style="flex:1;min-width:0">
        <div class="pn-lbl">Kliendi ettepanek · ootab teie vastust</div>
        <div class="pn-txt">„${o.kliendiEttepanek}"</div>
        <div class="pn-hint">Kohenda hindu või tingimusi ja saada pakkumus uuesti — kliendi link jääb samaks.</div>
      </div>
    </div>`:""}`}

    ${isClient() ? "" : `
    <!-- klient + kontaktisik (täislaius) — operaatori tööriist, kliendile ennast ei näidata -->
    <div class="card pad reveal" style="margin-bottom:20px">
      <div class="between" style="align-items:flex-start;gap:20px;flex-wrap:wrap">
        <div style="min-width:200px">
          <div class="overline">Klient</div>
          <div style="font-weight:700;font-size:16px;margin-top:4px">${cl.nimi}</div>
          <div class="muted mono" style="font-size:12px;margin-top:3px">${cl.registrikood} · KMKR ${cl.kmkr||"—"}</div>
        </div>
        ${editCt ? `
        <div style="flex:1;min-width:280px;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px">
          <div class="field" style="margin:0"><label>Kontaktisik · nimi</label><input id="ct-nimi" value="${ct.nimi||""}" placeholder="Ees- ja perekonnanimi"/></div>
          <div class="field" style="margin:0"><label>E-post</label><input id="ct-epost" type="email" value="${ct.epost||""}" placeholder="nimi@ettevote.ee"/></div>
          <div class="field" style="margin:0"><label>Telefon</label><input id="ct-tel" value="${ct.tel||""}" placeholder="+372 …"/></div>
        </div>` : `
        <dl class="kv" style="flex:1;min-width:280px;max-width:560px">
          <dt>Kontakt</dt><dd>${ct.nimi||"—"}</dd>
          <dt>E-post</dt><dd>${ct.epost||"—"}</dd>
          <dt>Telefon</dt><dd class="mono">${ct.tel||"—"}</dd>
        </dl>`}
        <div style="text-align:right">
          ${pill(cl.risk.skoor)}
          ${!isClient()?`<div style="margin-top:10px"><a class="btn btn-ghost btn-sm" href="#/risk/${cl.id}">${I.risk} Riskiraport</a></div>`:""}
        </div>
      </div>
      ${editCt?`<div class="muted" style="font-size:11px;margin-top:10px">Kontaktisik on eeltäidetud kliendikaardilt — pakkumus ja teavitused saadetakse sellele kontaktile.</div>`:""}
    </div>`}

    <!-- sama paigutuskeel kui lepingul: lai dokument + 300px kleepuv külg (mõlemad rollid) -->
    <div class="cl-layout">
      <div>
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
          <div style="padding:20px 26px 14px">
            <!-- vabatekst näeb välja nagu dokumendilõik — serv ilmub alles hoveril/fookusel -->
            <textarea id="kom-in" class="prose-in">${o.kommerts}</textarea>
            <div class="muted" style="font-size:10.5px;margin-top:8px">Salvestub automaatselt · vabatekst on läbirääkimiseks, lepingusse voolab ainult eritingimuste sektsioon.</div>
          </div>` : `
          <div style="padding:22px 26px;font-size:14px;line-height:1.65;color:var(--ink-2)">${o.kommerts}</div>`}
        </div>

        <!-- üüripinnad: osade jaotus + selge m² × €/m² -->
        <div class="doc reveal" style="margin-bottom:20px">
          <div class="doc-head"><div><div class="doc-title">Üüripinnad</div><div class="doc-sub">Hind €/m² kuus</div></div></div>
          <table class="tbl">
            <thead><tr><th>Pind</th><th>Osa</th><th class="r">m²</th><th class="r">€/m²</th><th class="r">Üür / kuus</th></tr></thead>
            <tbody>
              ${t.rows.map(r => { const sp = r.sp; const parts = spaceParts(sp); const spf = objektOf(sp).failid.pinnaplaan || "";
                const partRows = parts.map((p,i) => `<tr>
                  <td>${i===0?`<a class="mono" style="font-weight:700;cursor:pointer;border-bottom:1px dashed var(--line-strong)" onclick="openPdf('${spf}','Lisa 1 · pinnaplaan · ${sp.nimi}')" title="Ava pinnaplaan">${sp.nimi}</a>${canEditPrice && o.spaceIds.length>1?` <button class="rmstep rm-sp" data-sp="${sp.id}" title="Eemalda pind pakkumusest">×</button>`:""}`:""}</td>
                  <td>${p.osa}</td>
                  <td class="r mono">${eur(p.m2,1)}</td>
                  <td class="r mono">${i!==0?"":r.astmeline?`<span class="muted" style="font-size:11px">astmeline ↓</span>`:(canEditPrice
                    ? `<input class="price-in" id="pi-${sp.id}" value="${eur(r.hind)}" inputmode="decimal" aria-label="Üürihind €/m²">`
                    : eur(r.hind))}</td>
                  <td class="r mono" id="rent-${sp.id}">${i!==0||r.astmeline?"":`<b>${eur(r.rent)} €</b>`}</td>
                </tr>`).join("") + (parts.length>1?`<tr>
                  <td></td><td class="muted" style="font-size:12px">kokku</td>
                  <td class="r mono" style="font-size:12px;color:var(--muted)">${eur(sp.yyripind,1)}</td><td></td><td></td>
                </tr>`:"") + (canEditPrice && !r.astmeline ? `<tr>
                  <td></td><td colspan="4" style="padding-top:0;padding-bottom:10px">
                    <button class="steplink" id="add-step-${sp.id}">+ hinnaperiood</button>
                    <span class="muted" id="pl-${sp.id}" style="font-size:11px;margin-left:10px">${r.hind!==sp.hind?`hinnakiri ${eur(sp.hind)}`:""}</span></td>
                </tr>` : "");
                const stepRows = !r.astmeline ? "" : r.periods.map((p,i) => { const last = i===r.periods.length-1;
                  return `<tr>
                    <td></td>
                    <td class="mono" style="font-size:12.5px">${canEditPrice && !last
                      ? `${p.from}.&ndash; <input class="price-in mo" id="mo-${sp.id}-${i}" value="${p.to}" inputmode="numeric" aria-label="Kuni kuuni"> kuu`
                      : perLabel(p.from,p.to)}</td>
                    <td></td>
                    <td class="r mono">${canEditPrice
                      ? `<input class="price-in" id="pi-${sp.id}-${i}" value="${eur(p.hind)}" inputmode="decimal" aria-label="Üürihind €/m²">${!last?` <button class="rmstep" id="rm-${sp.id}-${i}" title="Eemalda aste">×</button>`:""}`
                      : eur(p.hind)}</td>
                    <td class="r mono"><b>${eur(p.rent)} €</b></td>
                  </tr>`; }).join("") + (canEditPrice?`<tr><td></td><td colspan="4" style="padding-top:4px">
                    <button class="steplink" id="add2-${sp.id}">+ veel aste</button>
                    <span class="muted" style="font-size:11px;margin-left:10px">põhihind = viimane aste · hinnakiri ${eur(sp.hind)} €/m²</span></td></tr>`:"");
                return partRows + stepRows; }).join("")}
            </tbody>
          </table>
          ${canEditPrice && availSpaces.length ? `
          <div style="padding:4px 26px 4px">
            <button class="steplink" id="add-sp-toggle">+ Lisa pind</button>
            <div id="add-sp-list" style="display:none;margin-top:8px">
              ${availSpaces.map(s => `<button class="att" data-addsp="${s.id}">
                ${I.building.replace('<svg','<svg class="fic"')}
                <div style="flex:1;text-align:left"><b class="mono">${s.nimi}</b> · ${s.tyyp}
                  <div class="muted" style="font-size:11px">${objektOf(s).nimi} · ${eur(s.yyripind,1)} m² · ${eur(s.hind)} €/m²</div></div>
                <span class="tag">lisa</span></button>`).join("")}
            </div>
          </div>`:""}
          <div class="muted" style="padding:12px 26px 16px;font-size:12px">Kõrvalkulud (küte, vesi, haldus jm): talvine ~${eur(objektOf(t.spaces[0]).korvalkulu.talvine)} €/m², suvine ~${eur(objektOf(t.spaces[0]).korvalkulu.suvine)} €/m² — informatiivne, tasutakse tegeliku tarbimise järgi ega sisaldu pakkumuse summas.</div>
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
                  ${e.autoGraafik?`<div class="muted" style="font-size:11px;margin-top:4px">Genereeritud hinnagraafikust — uueneb hinna muutmisel automaatselt.</div>`:""}`}
                </div>
                <div>${canEditPrice && !e.autoGraafik ? `<button class="rmstep eri-rm" data-eid="${e.id}" title="Eemalda eritingimus">×</button>` : ""}</div>
              </div>`).join("") : (canEditPrice ? "" : `<div class="empty" style="padding:30px"><div>Eritingimusi pole veel lisatud.</div></div>`)}
            ${canEditPrice ? `
            <div class="eri-add">
              <div class="overline" style="margin-bottom:8px">Lisa eritingimus</div>
              <textarea id="eri-new" class="eri-in" placeholder="Sõnasta eritingimus… nt „Üürivaba sisseseadeperiood 1 kuu alates üleandmispäevast.&quot;"></textarea>
              <div class="eri-tools">
                <button class="btn btn-primary btn-sm" id="eri-add-btn">${I.plus} Lisa eritingimus</button>
              </div>
              <div class="muted" style="font-size:11px;margin-top:8px">Punkt lisandub täiendava tingimusena ja jõuab lepingu Lisa 3-e; läbirääkimistel tekkivad ülekirjutused seob süsteem ise.</div>
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
          <div class="muted" style="font-size:11.5px;margin:4px 0 14px">Link kehtib kuni <b>${o.kehtivKuni}</b> · kontot pole vaja</div>
          ${o.staatus === "Saadetud" ? `
          <button class="btn btn-green" style="width:100%;justify-content:center;margin-bottom:9px" id="cl-accept">${I.check} Aktsepteerin pakkumuse</button>
          <div id="cl-konto-area" style="display:none;margin-bottom:9px;padding:12px;background:var(--surface-soft);border-radius:12px">
            <div class="overline" style="margin-bottom:8px">Kontoloome · kinnitage andmed</div>
            <div class="muted" style="font-size:11px;margin-bottom:10px">Aktsepteerimisel luuakse ${cl.nimi} kliendikonto — sealt näete lepinguid, tähtaegu ja vestlust.</div>
            <div class="field" style="margin:0 0 8px"><label>Ettevõte</label><input value="${cl.nimi} · reg ${cl.registrikood}" disabled></div>
            <div class="field" style="margin:0 0 8px"><label>Esindaja nimi</label><input id="ka-nimi" value="${ct.nimi||cl.kontakt}"></div>
            <div class="field" style="margin:0 0 8px"><label>Isikukood (allkirjastamiseks)</label><input id="ka-ik" placeholder="38xxxxxxxxx" inputmode="numeric"></div>
            <div class="field" style="margin:0 0 8px"><label>E-post</label><input id="ka-epost" type="email" value="${ct.epost||cl.epost}"></div>
            <div class="field" style="margin:0 0 10px"><label>Telefon</label><input id="ka-tel" value="${ct.tel||""}" placeholder="+372 …"></div>
            <button class="btn btn-green btn-sm" style="width:100%;justify-content:center" id="cl-konto-go">${I.check} Loo konto ja aktsepteeri</button>
          </div>
          <button class="btn btn-soft" style="width:100%;justify-content:center;margin-bottom:9px" id="cl-propose">${I.chat} Alusta läbirääkimisi</button>
          <!-- keeldumine on lahutatud joonega — et seda ei vajutataks ekslikult läbirääkimiste asemel -->
          <div style="border-top:1px solid var(--line);margin:12px 0 6px"></div>
          <button class="btn-quiet" style="width:100%" id="cl-decline">Keeldun</button>` :
          o.staatus === "Kliendi ettepanek" ? `
          <div class="note">${I.info}<div>Teie ettepanek on üürileandjal ülevaatamisel — uuendatud pakkumus tuleb samale lingile.</div></div>` :
          ["Aktsepteeritud","Lepinguks teisendatud"].includes(o.staatus) ? `
          <div class="note" style="background:var(--green-soft);color:var(--green-ink)">${I.check.replace('stroke-width="2.2"','stroke-width="1.8"')}<div>Aktsepteeritud — ${seotud.length ? "leping on koostatud." : "üürileandja koostab lepingu mustandi."}</div></div>
          ${seotud.length ? `<a class="btn btn-accent" style="width:100%;justify-content:center;margin-top:10px" href="#/leping/${seotud[0]}">${I.lease} Ava leping</a>` : ""}` : `
          <div class="note accent">${I.warn}<div>Pakkumuse link on aegunud — küsige üürileandjalt uus pakkumus.</div></div>`}
        </div>` : ""}
        ${isClient() && clientSeesOffer(o) ? `
        <!-- lisad otsuse all — klõps avab eelvaatemodaali (varem iframe'idena dokumendi all) -->
        <div class="card pad reveal" style="margin-top:18px">
          <div class="overline" style="margin-bottom:10px">Lisad · klõpsa vaatamiseks</div>
          ${t.spaces.map(sp => { const f = objektOf(sp).failid.pinnaplaan; return `
          <button class="att ${f ? "" : "nofile"}" onclick="openPdf('${f || ""}','Lisa 1 · pinnaplaan · ${sp.nimi}')">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1"><b>Lisa 1</b> · Pinnaplaan (${sp.nimi})</div>
            <span class="tag">${f ? "PDF · vaata" : "lisamata"}</span></button>`; }).join("")}
          ${(() => { const f = objektOf(t.spaces[0]).failid.parkimine; return `
          <button class="att ${f ? "" : "nofile"}" onclick="openPdf('${f || ""}','Lisa 2 · asendiplaan + parkimisskeem')">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1"><b>Lisa 2</b> · Asendiplaan + parkimisskeem</div>
            <span class="tag">${f ? "PDF · vaata" : "lisamata"}</span></button>`; })()}
        </div>` : ""}
        <!-- TEGEVUS on veerus esimene — kleepuva külje ülaosas alati nähtav -->
        ${!isClient() && o.staatus==="Mustand" ? `
        <div class="card pad reveal">
          <button class="btn btn-green" style="width:100%;justify-content:center" id="send-offer">${I.send} Kinnita ja saada kliendile</button>
          <div class="muted" style="font-size:11px;margin-top:9px;text-align:center">Klient saab lingi e-postile · kehtib ${o.kehtivKuni}-ni</div>
        </div>`:""}
        ${!isClient() && o.staatus==="Kliendi ettepanek" ? `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:10px">Kliendi ettepanek ootab läbivaatust</div>
          <div class="muted" style="font-size:11.5px;margin-bottom:8px">Kohenda vajadusel hindu/tingimusi otse dokumendis ja lisa vastus — mõlemad jõuavad kliendini samal lingil.</div>
          <textarea id="op-reply" rows="3" placeholder="Vastus kliendile (valikuline) — nt mida muutsite ja miks…" style="width:100%;margin-bottom:9px;padding:10px 13px;border:1px solid var(--line-strong);border-radius:9px;font-family:inherit;font-size:13px;outline:none;resize:vertical"></textarea>
          <button class="btn btn-green" style="width:100%;justify-content:center;margin-bottom:9px" id="resend-offer">${I.send} Vasta ja saada pakkumus uuesti</button>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center" id="cancel-offer">Tühista pakkumus</button>
        </div>`:""}
        <!-- (kliendi otsus elab kleepuval tegevusribal vaate lõpus) -->
        ${!isClient() && o.staatus==="Saadetud" ? `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:10px">Ootab kliendi otsust</div>
          <div class="muted" style="font-size:12.5px;margin-bottom:10px">Jagamislink on saadetud e-postile <span class="mono">${ct.epost||cl.epost}</span> ja kehtib kuni ${o.kehtivKuni}. Klient toimetab ilma kontota — konto luuakse aktsepteerimisel (küsitakse isiku-/ettevõtteandmed). Demo korras saad läbirääkimise ise läbi mängida:</div>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center" id="view-as-client">Ava kliendilink (${ct.nimi||cl.kontakt}) →</button>
        </div>`:""}
        <!-- (kliendi olekuinfo elab otsuseribal) -->
        ${!isClient() && o.staatus==="Aktsepteeritud" && !seotud.length ? `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:8px">Aktsepteeritud</div>
          <div class="muted" style="font-size:12.5px;margin-bottom:12px">Pakkumus voolab lepingu malli: ${o.spaceIds.length > 1 ? `${o.spaceIds.length} pinda → ${o.spaceIds.length} lepingu mustandit (üks pinna kohta)` : "tekib lepingu mustand"} — üldtingimused mallist (lukus), põhitingimused tehinguandmetest, eritingimused kopeeritakse Lisa 3-e.</div>
          <button class="btn btn-accent" style="width:100%;justify-content:center" id="to-lease">${I.lease} Loo lepingu mustand${o.spaceIds.length > 1 ? "id" : ""} →</button>
        </div>`:""}
        ${isClient() ? "" : `<div style="margin-top:18px">${priceCard(t, vat, "reveal")}</div>`}

        ${isClient() ? "" : `
        <div class="card pad reveal" style="margin-top:18px">
          <div class="overline" style="margin-bottom:10px">Lisad · klõpsa vaatamiseks</div>
          ${t.spaces.map(sp => `<button class="att" onclick="openPdf('${objektOf(sp).failid.pinnaplaan||""}','Lisa 1 · pinnaplaan · ${sp.nimi}')">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1"><b>Lisa 1</b> · Pinnaplaan (${sp.nimi})</div>
            <span class="tag">PDF · vaata</span></button>`).join("")}
          <button class="att" onclick="openPdf('${objektOf(t.spaces[0]).failid.parkimine||""}','Lisa 2 · asendiplaan + parkimisskeem')">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1"><b>Lisa 2</b> · Asendiplaan + parkimisskeem</div>
            <span class="tag">PDF · vaata</span></button>
        </div>`}
        ${negoCard}
        ${seotud.length ? `
        <div class="card pad reveal" style="margin-top:18px">
          <div class="overline" style="margin-bottom:10px">Lepingud sellest pakkumusest</div>
          ${seotud.map(lid => { const ll = DB.leaseById(lid); return `
          <button class="att" onclick="location.hash='#/leping/${lid}'">
            ${I.lease.replace('<svg','<svg class="fic"')}
            <div style="flex:1;text-align:left"><b>${lid}</b>${ll ? `<div class="muted" style="font-size:11px">${(DB.spaceById(ll.spaceId)||{}).nimi || ""}</div>` : ""}</div>
            ${ll ? pill(ll.staatus) : ""}
          </button>`; }).join("")}
        </div>`:""}
      </div>
    </div>

    ${isClient() && o.staatus === "Saadetud" ? `
    <!-- läbirääkimiste modaal — teadlik samm omaette aknas, mitte nupp keeldumise kõrval -->
    <div class="nego-modal" id="nego-modal">
      <div class="nego-box">
        <div class="between" style="align-items:flex-start;margin-bottom:4px">
          <div><div class="overline">Läbirääkimised · ${o.id}</div>
            <h3 style="font-size:17px;margin:6px 0 0">Tehke muudatusettepanek</h3></div>
          <button class="nego-x" id="nego-close" title="Sulge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </div>
        ${nego.length ? `<div style="margin-top:10px">${nego.map(negoMsg).join("")}</div>` : ""}
        <textarea id="cl-propose-text" rows="4" placeholder="Kirjeldage vabas vormis, mida sooviksite muuta — nt üürihind, periood, parkimiskohad…" style="width:100%;margin-top:12px;padding:11px 14px;border:1px solid var(--line-strong);border-radius:10px;font-family:inherit;font-size:13.5px;outline:none;resize:vertical"></textarea>
        <div class="muted" style="font-size:11.5px;margin-top:8px">Pakkumus jääb kehtima ja link samaks — üürileandja vastab siinsamas ning saadab vajadusel uuendatud pakkumuse.</div>
        <div style="display:flex;gap:8px;margin-top:14px">
          <button class="btn btn-primary" style="flex:1;justify-content:center" id="cl-propose-send">${I.send} Saada ettepanek</button>
          <button class="btn btn-ghost" id="nego-cancel">Loobu</button>
        </div>
      </div>
    </div>`:""}

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
        <td class="sh-sub" style="padding-left:18px">${perLabel(p.from,p.to)}</td><td></td>
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

      <div class="sh-lbl" style="margin-top:22px">Eritingimused</div>
      ${o.eritingimused.length
        ? `<ol class="sh-ol">${o.eritingimused.map(e => `<li>${e.tekst}${e.kirjutabYle?` <span class="sh-sub">(kirjutab üle: ${e.kirjutabYle})</span>`:""}</li>`).join("")}</ol>`
        : `<div class="sh-sub">Eritingimusi ei ole — kohalduvad üürileandja standardtingimused.</div>`}

      <div class="sh-lbl" style="margin-top:18px">Lisad</div>
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
    <div class="between no-print" style="width:100%;max-width:840px;margin-bottom:18px">
      <a class="btn btn-ghost btn-sm" href="#/pakkumus/${o.id}">${I.back} Tagasi pakkumusele</a>
      <button class="btn btn-accent btn-sm" onclick="window.print()">${I.file} Prindi / salvesta PDF</button>
    </div>
    ${offerSheetHTML(o)}
  </div>`;
};

View.pakkumus.init = (id) => {
  const o = DB.offerById(id); if (!o) return;
  const mutate = (fn, msg) => { fn(); AUDIT.unshift({ aeg: TODAY_EE, autor: isClient() ? roleClient().kontakt + " (üürnik)" : "Tarmo Sepp", tegevus: msg }); DB.save(); toast(msg); router(); };

  /* üürihinna muutmine (€/m²) — arvutused uuenevad kohe, ilma täisrenderduseta */
  const recalc = () => {
    const t = offerTotals(o);
    const set = (eid, html) => { const el = document.getElementById(eid); if (el) el.innerHTML = html; };
    t.rows.forEach(r => {
      set("rent-" + r.sp.id, `<b>${eur(r.rent)} €</b>`);
      set("pc-rent-" + r.sp.id, `${eur(r.rent)} €`);
      set("pc-calc-" + r.sp.id, `${eur(r.sp.yyripind,1)} m² × ${eur(r.hind)} €/m²`);
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
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: ${sp.nimi} ${msg} — ` +
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
        AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: ${sp.nimi} üürihind → ${eur(offerPrice(o, sp))} €/m² (hinnakiri ${eur(sp.hind)}).` });
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
  if (send) send.onclick = () => mutate(() => o.staatus = "Saadetud", `Pakkumus ${o.id} saadetud · jagamislink kliendi e-postile (kehtib kuni ${o.kehtivKuni})`);

  const resend = document.getElementById("resend-offer");
  if (resend) resend.onclick = () => {
    const replyEl = document.getElementById("op-reply");
    const reply = replyEl ? replyEl.value.trim() : "";
    mutate(() => { o.staatus = "Saadetud"; o.kliendiEttepanek = null;
      if (reply) (o.labiraakimised = o.labiraakimised || []).push({ roll: "operaator", autor: "Tarmo Sepp (üürileandja)", tekst: reply, aeg: TODAY_EE });
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
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: kommertssisu muudetud.` });
    DB.save();
  };
  const eriById = (eid) => (o.eritingimused || []).find(x => String(x.id) === String(eid));
  document.querySelectorAll(".eri-txt").forEach(t => t.onchange = () => {
    const e = eriById(t.dataset.eid); if (!e) return;
    const v = t.value.trim();
    if (!v) { t.value = e.tekst; return; }
    e.tekst = v;
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: eritingimuse sõnastus muudetud.` });
    DB.save();
  });
  document.querySelectorAll(".eri-rm").forEach(b => b.onclick = () => {
    const e = eriById(b.dataset.eid); if (!e) return;
    if (!confirm("Eemalda eritingimus? Seda ei saa tagasi võtta.")) return;
    o.eritingimused = o.eritingimused.filter(x => x !== e);
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: eritingimus eemaldatud.` });
    DB.save(); toast("Eritingimus eemaldatud"); router();
  });
  const eriAdd = document.getElementById("eri-add-btn");
  if (eriAdd) eriAdd.onclick = () => {
    const txtEl = document.getElementById("eri-new"), kyEl = document.getElementById("eri-new-ky");
    const txt = txtEl ? txtEl.value.trim() : "";
    if (!txt) { toast("Sõnasta enne eritingimuse tekst"); if (txtEl && txtEl.focus) txtEl.focus(); return; }
    const ky = (kyEl && kyEl.value) || null;
    o.eritingimused.push({ id: "e" + Date.now(), tekst: txt, kirjutabYle: ky });
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: eritingimus lisatud${ky ? ` (kirjutab üle: ${ky})` : ""}.` });
    DB.save(); toast("Eritingimus lisatud · voolab lepingu Lisa 3-e"); router();
  };

  /* kontaktisiku väljad (mustandis): salvestuvad pakkumuse külge */
  const saveCt = () => {
    const g = (eid) => { const e = document.getElementById(eid); return e ? String(e.value).trim() : ""; };
    o.kontakt = { nimi: g("ct-nimi"), epost: g("ct-epost"), tel: g("ct-tel") };
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id}: kontaktisik → ${o.kontakt.nimi||"—"} · ${o.kontakt.epost||"—"} · ${o.kontakt.tel||"—"}.` });
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
      const lid = "LEP-2026-" + String(num).padStart(3, "0");
      const hind = offerPrice(o, sp); /* põhihind: erihind või graafiku viimane aste */
      const algusD = new Date(2026, 6, 1); /* üleandmispäev: järgmise kuu algus (demo) */
      const loppD = new Date(2026, 6 + o.pikkusKuud, 0);
      const indD = new Date(2027, 6, 1);
      const tehing = { algus: "2026-07-01", kuud: o.pikkusKuud, hind, tagatisKuud: 3,
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
          { nr: 1, nimi: `Pinnaplaan (${sp.nimi})`, fail: objektOf(sp).failid.pinnaplaan || "— lisamata —" },
          { nr: 2, nimi: "Asendiplaan + parkimisskeem", fail: objektOf(sp).failid.parkimine || "— lisamata —" },
          { nr: 3, nimi: "Eritingimused", fail: "— genereeritud —" },
        ],
        allkirjad: [],
      });
      sp.staatus = "Lepingus"; sp.tenant = cl2.nimi;
      made.push(lid);
    });
    o.lepingud = made; o.seotudLeping = made[0]; o.staatus = "Lepinguks teisendatud";
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumus ${o.id} teisendatud lepingu${made.length > 1 ? "teks" : "ks"}: ${made.join(", ")} — üldtingimused mallist, põhitingimused tehinguandmetest, eritingimused Lisa 3-e.` });
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
  if (dec) dec.onclick = () => { if (!confirm("Keeldud pakkumusest? See on lõppolek.")) return;
    mutate(() => o.staatus = "Tagasi lükatud", `Pakkumus ${o.id} tagasi lükatud`); };
  /* läbirääkimised: modaal (teadlik samm), ettepanek läheb mõlemale nähtavasse logisse */
  const negoModal = document.getElementById("nego-modal");
  const negoOpen = (open) => { if (negoModal) { negoModal.classList.toggle("open", open);
    if (open) { const t = document.getElementById("cl-propose-text"); if (t) t.focus(); } } };
  const prop = document.getElementById("cl-propose");
  if (prop) prop.onclick = () => negoOpen(true);
  ["nego-close", "nego-cancel"].forEach(eid => { const b = document.getElementById(eid); if (b) b.onclick = () => negoOpen(false); });
  if (negoModal) negoModal.onclick = (e) => { if (e.target === negoModal) negoOpen(false); };
  const propSend = document.getElementById("cl-propose-send");
  if (propSend) propSend.onclick = () => {
    const txt = document.getElementById("cl-propose-text").value.trim();
    if (!txt) { toast("Kirjeldage soovitud muudatust"); return; }
    const cl2 = DB.clientById(o.clientId), ct2 = offerContact(o, cl2);
    mutate(() => { o.staatus = "Kliendi ettepanek"; o.kliendiEttepanek = txt;
      (o.labiraakimised = o.labiraakimised || []).push({ roll: "klient", autor: (ct2.nimi || cl2.kontakt) + " (üürnik)", tekst: txt, aeg: TODAY_EE });
    }, `Muudatusettepanek saadetud · operaator vaatab üle`);
  };
};

function priceCard(t, vat, cls="") {
  const m2 = t.spaces.reduce((s,x)=>s+x.yyripind,0);
  return `
  <div class="card pad ${cls}">
    <div class="overline" style="margin-bottom:12px">Üür · kuus${vat?` · KM ${VAT_RATE*100}%`:""}</div>
    <div class="price">
      ${t.rows.map(r => r.astmeline
        ? r.periods.map((p,i) => `<div class="price-row"><span class="lbl">${i===0?r.sp.nimi:""}</span><span class="calc">${perLabel(p.from,p.to)} · ${eur(p.hind)} €/m²</span><span class="amt">${eur(p.rent)} €</span></div>`).join("")
        : `<div class="price-row"><span class="lbl">${r.sp.nimi}</span><span class="calc" id="pc-calc-${r.sp.id}">${eur(r.sp.yyripind,1)} m² × ${eur(r.hind)} €/m²</span><span class="amt" id="pc-rent-${r.sp.id}">${eur(r.rent)} €</span></div>`).join("")}
      ${t.astmeline ? `
      ${t.segments.map(sg => `<div class="price-row total"><span class="lbl">Kokku ${perLabel(sg.from,sg.to)}</span><span class="calc">${vat?`bruto ${eur(withVat(sg.sum))} €`:""}</span><span class="amt">${eur(sg.sum)} €</span></div>`).join("")}` : `
      <div class="price-row total"><span class="lbl">Üür kokku (neto)</span><span class="calc">${eur(m2,1)} m²</span><span class="amt" id="pc-net">${eur(t.rentSum)} €</span></div>
      ${vat?`
      <div class="price-row vat"><span class="lbl">Käibemaks (${VAT_RATE*100}%)</span><span></span><span class="amt" id="pc-vat">${eur(t.rentSum*VAT_RATE)} €</span></div>
      <div class="price-row total"><span class="lbl">Üür kokku (bruto)</span><span></span><span class="amt" id="pc-gross" style="color:var(--accent-deep)">${eur(withVat(t.rentSum))} €</span></div>`:""}`}
    </div>
    ${t.astmeline ? `<div class="muted" style="font-size:11.5px;margin-top:8px">Kaalutud keskmine ${t.kuud} kuu peale: <b>${eur(t.avgM2)} €/m²</b> · ${eur(t.avgSum)} €/kuus (neto). Tagatis ja indekseerimine põhihinnast.</div>` : ""}
    <div class="divline"></div>
    <!-- kõrvalkulud + tehnilised faktid ühe vaikse reana — detailid elavad dokumendis -->
    <div class="muted" style="font-size:11.5px;line-height:1.6">Kõrvalkulud tegeliku tarbimise järgi: talv ~${eur(objektOf(t.spaces[0]).korvalkulu.talvine)} €/m² (≈ ${eur(t.kkWin,0)} €), suvi ~${eur(objektOf(t.spaces[0]).korvalkulu.suvine)} €/m² (≈ ${eur(t.kkSum,0)} €) — ei sisaldu summas. Elektrivõimsus ${t.spaces.reduce((s,x)=>s+x.elekter,0)} A · ${t.parking} parkimiskohta.</div>
  </div>`;
}

/* ---------- Pakkumise koostamine (wizard) --------------------------------- */
let WIZ = { step: 1, client: null, spaces: [], months: 60, risk: false };
View.pakkumusUus = () => {
  WIZ = { step: 1, client: null, spaces: [], months: 60, risk: false };
  /* kliendivaatest tulles („Loo pakkumine sellele kliendile") on klient eeltäidetud */
  if (PRE_CLIENT) { WIZ.client = DB.clientById(PRE_CLIENT); if (WIZ.client) WIZ.step = 2; PRE_CLIENT = null; }
  return `<div class="view"><a class="btn btn-ghost btn-sm" href="#/pakkumised" style="margin-bottom:18px">${I.back} Katkesta</a>
    <div class="overline reveal">Etapp 04 · uus hinnapakkumine</div>
    <h1 class="page-h1 reveal" style="margin:8px 0 24px">Koosta hinnapakkumine</h1>
    <div id="wiz" class="reveal"></div></div>`;
};
View.pakkumusUus.init = renderWiz;

/* moodne stepper: jooksva täitejoonega rada + täpid (jagatud mõlema wizardi vahel) */
/* sammu ikoon sildi järgi — märk näitab sisu; tehtud samm asendub linnukesega */
const STEP_IC = { "Tüüp": "grid", "Klient": "user", "Üürnik": "user", "Kandidaat": "user", "Osapool": "user",
  "Riskiraport": "risk", "Pinnad": "building", "Pind": "building", "Ese": "building", "Ametikoht": "pin",
  "Põhitingimused": "edit", "Tingimused": "edit", "Mustand V1": "file", "Ülevaade": "search" };
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
  if (v && !m.length) return `<div class="muted" style="font-size:12.5px;padding:6px 2px">Vastet pole — demo äriregistris on ${ACCOUNT.landlord.nimi} osapooled. Proovi nime või registrikoodi.</div>`;
  return `<div class="overline" style="margin:4px 0 10px">${v ? "Vasted · äriregister" : "Kliendiregister"}</div>` +
    m.map(c => `<div class="pick cl-pick" data-clpick="${c.id}">
      <span class="pick-av">${c.nimi.slice(0, 1)}</span>
      <div style="flex:1;min-width:0"><b>${hl(c.nimi)}</b>
        <div class="muted mono" style="font-size:12px;margin-top:2px">${hl(c.registrikood)} · ${c.kmkr || "KMKR puudub"} · ${c.aadress}</div></div>
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
      <div id="cl-suggest" style="margin-top:14px"></div>
      <div class="wrap-actions" style="margin-top:18px;justify-content:flex-end"><button class="btn btn-primary" id="w-next" ${WIZ.client?'':'disabled'} style="${WIZ.client?'':'opacity:.5;pointer-events:none'}">Edasi ${I.arrow}</button></div>
    </div>`;
  } else if (WIZ.step === 2) {
    const c = WIZ.client;
    body = `<div class="card pad">
      <div class="between" style="margin-bottom:16px"><div><div class="overline">Klient tuvastatud</div><div style="font-weight:700;font-size:18px;margin-top:4px">${c.nimi}</div>
        <div class="muted mono" style="font-size:12px">${c.registrikood} · ${c.aadress}</div></div>${pill(c.tyyp,"grey")}</div>
      <div id="risk-area" style="margin-top:16px">
        <button class="btn btn-accent" id="run-risk">${I.risk} Telli riskiraport</button>
        <span class="muted" style="margin-left:12px;font-size:13px">või jätka ilma</span>
      </div>
      <div class="wrap-actions" style="margin-top:20px;justify-content:space-between"><button class="btn btn-ghost" id="w-back">${I.back} Tagasi</button><button class="btn btn-primary" id="w-next">Edasi ${I.arrow}</button></div>
    </div>`;
  } else if (WIZ.step === 3) {
    const free = SPACES.filter(s => ["Vaba","Pakkumusel"].includes(s.staatus));
    body = `<div class="card pad">
      <div class="overline" style="margin-bottom:6px">Vali üks või mitu pinda · ${multiObj() ? OBJEKTID.map(o=>o.nimi).join(" · ") : OBJEKT.nimi}</div>
      <!-- rendiperioodi pikkus valitakse järgmises sammus (ülevaade) — siin jäi ta märkamata -->
      <div style="margin-top:12px">
        ${free.length ? free.map(s => { const sel = WIZ.spaces.includes(s.id);
          return `<div class="pick ${sel?'sel':''}" data-sp="${s.id}">
            <div class="box">${I.check}</div>
            <div style="flex:1"><div style="font-weight:600"><span class="mono">${s.nimi}</span> · ${s.tyyp}${multiObj()?` <span class="tag" style="margin-left:6px">${objektOf(s).nimi}</span>`:""}</div>
              <div class="muted mono" style="font-size:12px">${s.jaotus?s.jaotus.map(p=>`${p.osa} ${eur(p.m2,1)} m²`).join(" + ")+" = ":""}${eur(s.yyripind,1)} m² · ${eur(s.hind)} €/m²${s.parkimine?` · ${s.parkimine} parkimiskohta`:""}${s.elekter?` · ${s.elekter} A`:""}</div></div>
            <div class="mono" style="font-weight:700;text-align:right">${eur(rent(s))} €<div class="muted" style="font-size:11px;font-weight:500">üür / kuus</div></div>
          </div>`; }).join("") : occupiedSpacesNote()}
      </div>
      <div class="wrap-actions" style="margin-top:20px;justify-content:space-between"><button class="btn btn-ghost" id="w-back">${I.back} Tagasi</button>
        <button class="btn btn-primary" id="w-next" ${WIZ.spaces.length?'':'disabled'} style="${WIZ.spaces.length?'':'opacity:.5;pointer-events:none'}">Vaata ülevaadet ${I.arrow}</button></div>
    </div>`;
  } else {
    const spaces = WIZ.spaces.map(DB.spaceById);
    const t = { spaces, rows: spaces.map(sp=>({ sp, hind: sp.hind, rent: rent(sp) })),
                rentSum: spaces.reduce((s,x)=>s+rent(x),0), kkWin: spaces.reduce((s,x)=>s+kkWinter(x),0),
                kkSum: spaces.reduce((s,x)=>s+kkSummer(x),0), parking: spaces.reduce((s,x)=>s+x.parkimine,0) };
    const m2 = spaces.reduce((s,x)=>s+x.yyripind,0);
    body = `<div class="cl-layout" style="align-items:start">
      <div class="card pad">
        <div class="between" style="align-items:flex-start;gap:18px">
          <div>
            <div class="overline">Pakkumuse ülevaade</div>
            <div style="font-weight:700;font-size:18px;margin:6px 0 4px">${WIZ.client.nimi}</div>
            <div class="muted" style="font-size:13px">${spaces.length} pind${spaces.length>1?"a":""} · ${hoonedOf(spaces)}${WIZ.risk?' · riskiskoor '+WIZ.client.risk.skoor:''}</div>
          </div>
          <div class="field" style="margin:0;width:200px;flex:none"><label>Rendiperioodi pikkus</label>
            <select id="months">${[12,24,36,60].map(m=>`<option value="${m}" ${WIZ.months===m?'selected':''}>${m % 12 === 0 ? (m/12) + " aastat" : m + " kuud"} (${m} kuud)</option>`).join("")}</select></div>
        </div>
        <div class="divline"></div>
        ${spaces.map(s=>`<div class="between" style="padding:8px 0;border-bottom:1px dashed var(--line)">
          <div><b class="mono">${s.nimi}</b> <span class="muted">${spaceParts(s).map(p=>`${p.osa} ${eur(p.m2,1)} m²`).join(" + ")}</span>
            <div class="muted mono" style="font-size:11.5px">${eur(s.yyripind,1)} m² × ${eur(s.hind)} €/m²</div></div>
          <div class="mono" style="font-weight:700">${eur(rent(s))} €</div></div>`).join("")}
        <div class="overline" style="margin:18px 0 8px">Lisad · lähevad pakkumusega kaasa</div>
        ${spaces.map(sp => { const f = objektOf(sp).failid.pinnaplaan; return `
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
          <button class="btn btn-accent" id="w-finish">${I.check} Loo pakkumuse mustand</button></div>
      </div>
      <!-- parem paan sama keelega kui lepinguvaates: 300px, kleepuv, teadlikult õhuke -->
      <div class="cl-side">
        <div class="card pad">
          <div class="overline" style="margin-bottom:10px">Kokkuvõte</div>
          <div class="cd-sum">${eur(t.rentSum,0)} € <small>/ kuu (neto)</small></div>
          <div class="muted" style="font-size:12px;margin-top:5px">+ käibemaks ${VAT_RATE*100}% · bruto ${eur(withVat(t.rentSum))} €</div>
          <div class="divline"></div>
          <dl class="kv">
            <dt>Periood</dt><dd class="mono" id="sum-months">${WIZ.months} kuud</dd>
            <dt>Üüripind</dt><dd class="mono">${eur(m2,1)} m²</dd>
            <dt>Parkimiskohti</dt><dd class="mono">${t.parking}</dd>
          </dl>
          <div class="muted" style="font-size:11.5px;margin-top:10px">Kõrvalkulud tasutakse tegeliku tarbimise järgi. Täpne hinnastus ja eritingimused on järgmises vaates (mustand).</div>
        </div>
      </div>
    </div>`;
  }
  wiz.innerHTML = head + body;
  bindWiz();
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
  if (WIZ.step === 3) {
    document.querySelectorAll(".pick[data-sp]").forEach(el => el.onclick = () => {
      const id = el.dataset.sp;
      WIZ.spaces = WIZ.spaces.includes(id) ? WIZ.spaces.filter(x=>x!==id) : [...WIZ.spaces, id];
      renderWiz();
    });
  }
  if (WIZ.step === 4) {
    /* periood valitakse ülevaates — kokkuvõtte rida uueneb kohe, ilma täisrenderduseta */
    const mSel = document.getElementById("months");
    if (mSel) mSel.onchange = e => { WIZ.months = +e.target.value;
      const sm = document.getElementById("sum-months"); if (sm) sm.textContent = WIZ.months + " kuud"; };
    document.getElementById("w-finish").onclick = () => {
      const n = Math.max(0, ...OFFERS.map(o => +o.id.split("-")[2] || 0)) + 1;
      const id = "PAK-2026-" + String(n).padStart(3, "0");
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
      AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Pakkumuse mustand ${id} loodud (${WIZ.client.nimi} · ${spaces.map(s=>s.nimi).join(", ")}).` });
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
      <div><div class="overline">Koondskoor</div><div style="font-weight:700;font-size:15px;margin:3px 0">${c.nimi}</div>
        <div class="muted" style="font-size:12.5px">4 allikat · ${c.risk.kuupaev} · informatiivne, ei blokeeri</div></div></div>
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
      <a class="btn btn-accent" href="#/leping-uus">${I.lease} Uus leping</a>
    </div>
    ${flt ? `<div class="flex reveal" style="margin-bottom:14px;gap:10px">${pill("Filter: " + flt.t, "blue")}<a class="steplink" href="#/lepingud">Näita kõiki</a></div>` : ""}

    <div class="sec-h reveal"><h2>Üürilepingud</h2><span class="meta">ärikinnisvara vertikaal · platvormis loodud</span></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Tunnus</th><th>Üürnik</th><th>Pind</th><th>Periood</th><th>Indekseerimine</th><th>Olek</th></tr></thead>
        <tbody>
        ${lrows.length ? lrows.map(l => { const cl = DB.clientById(l.clientId); const sp = DB.spaceById(l.spaceId);
          return `<tr class="clickable" onclick="location.hash='#/leping/${l.id}'">
            <td><span class="id">${l.id}</span></td><td>${cl.nimi}</td><td class="mono">${sp.nimi}</td>
            <td class="mono">${l.algus} – ${l.lopp}</td>
            <td><span class="tag">${l.indeks.meetod} · ${l.indeks.maar}</span></td>
            <td>${pill(l.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:18px">Selles faasis üürilepinguid pole.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="sec-h reveal" style="margin-top:30px"><h2>Töölepingud</h2><span class="meta">teine vertikaal samal mootoril · tööpakkumine → läbirääkimine → allkiri</span></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Tunnus</th><th>Isik</th><th>Ametikoht</th><th>Algus</th><th>Katseaeg kuni</th><th>Olek</th></tr></thead>
        <tbody>
        ${trows.length ? trows.map(t => { const a = DB.ametikohtById(t.ametikohtId);
          return `<tr class="clickable" onclick="location.hash='#/tooleping/${t.id}'">
            <td><span class="id">${t.id}</span></td><td>${t.isik}${t.roll==="kandidaat"?` <span class="tag">kandidaat</span>`:""}</td>
            <td>${a.nimi}</td><td class="mono">${t.algus}</td><td class="mono">${t.katseaegLopp}</td>
            <td>${pill(t.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:18px">${flt ? "Selles faasis töölepinguid pole." : "Töölepinguid pole."}</td></tr>`}
        </tbody>
      </table>
    </div>

    ${flt ? "" : `
    <div class="sec-h reveal" style="margin-top:30px"><h2>Imporditud lepingud</h2><span class="meta">olemasolev portfell · PDF/DOCX → klauslimudel · originaal on õiguslik tõde</span>
      <button class="btn btn-ghost btn-sm" style="margin-left:auto">${I.file} Impordi leping (PDF/DOCX)</button></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Tunnus</th><th>Liik</th><th>Pool</th><th>Ese</th><th class="r">Struktuur</th><th>Päritolu</th></tr></thead>
        <tbody>
        ${IMPORDITUD.map(x => `<tr class="clickable" onclick="location.hash='#/imp/${x.id}'">
            <td><span class="id">${x.id}</span></td><td>${x.liik}</td><td>${x.pool}</td>
            <td class="mono" style="font-size:12px">${x.ese}</td>
            <td class="r mono">${x.punkte} punkti</td>
            <td>${pill("Imporditud")}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
    <div class="muted reveal" style="margin-top:12px;font-size:12px">Imporditud lepingud osalevad otsingus, Q&A-s, võtmekuupäevades ja aruandluses — kuid ei osale muudatuste voos (etapp 08). Skaneeritud (pildipõhised) dokumendid jäävad struktuurituvastusest välja.</div>`}
  </div>`;
};

/* ---------- Töölepingu detail (sama mootor, sama klauslimudel) -------------- */
window.tlSend = (id) => {
  const t = DB.tlepingById(id); if (!t) return;
  t.staatus = "Saadetud";
  AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Tööpakkumine ${id} saadetud kandidaadile (turvaline link e-postile).` });
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
    <a class="btn btn-ghost btn-sm reveal" href="#/lepingud" style="margin-bottom:18px">${I.back} Lepingud</a>
    <div class="page-head reveal">
      <div><div class="overline">Tööleping</div>
        <h1 class="page-h1" style="margin-top:8px">${t.isik}</h1>
        <p class="page-sub mono" style="font-size:12px">${t.id} · ${a.nimi} · osakond ${OSAKOND.nimi}${t.roll==="kandidaat"?" · kandidaat":""}</p></div>
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
          <div style="font-size:13px;line-height:1.6">Mustand V1 on koostatud — saatke kandidaadile ülevaatamiseks. Sama töövoog nagu hinnapakkumisel: turvaline link e-postile, kontot pole vaja.</div>
          <button class="btn btn-accent" style="width:100%;justify-content:center;margin-top:14px" onclick="tlSend('${t.id}')">${I.send} Saada kandidaadile (V1)</button>
        </div>` : `
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:8px">Olek · tööpakkumine</div>
          <div style="font-size:13px;line-height:1.6">Tööpakkumine on kandidaadil ülevaatamisel — sama töövoog nagu hinnapakkumisel (etapid 04–06): punktikommentaarid, aktsept, allkirjastamine portaalis.</div>
          <div class="muted" style="font-size:11.5px;margin-top:10px">Kandidaat toimetab e-postile saadetud turvalise lingi kaudu ilma kontota; konto tekib allkirjastamisel.</div>
        </div>`}

        <div class="card pad reveal" style="margin-top:18px">
          <div class="overline" style="margin-bottom:10px">Võtmekuupäevad</div>
          <dl class="kv">
            <dt>Algus</dt><dd class="mono">${t.algus}</dd>
            <dt>Tähtaeg</dt><dd>${t.tahtaeg}</dd>
            <dt>Katseaja lõpp</dt><dd class="mono">${t.katseaegLopp}</dd>
            <dt>Palgaülevaatus</dt><dd class="mono">${t.palgaylevaatus}</dd>
          </dl>
          <div class="muted" style="margin-top:10px;font-size:11.5px">Katseaeg ja palgaülevaatus on võtmekuupäevad — teavitus x päeva ette, kõik vertikaalid ühes kalendris.</div>
        </div>

        <div class="card pad reveal" style="margin-top:18px">
          <div class="between" style="margin-bottom:8px"><div class="overline">Vertikaali adapter · TÖR</div><span class="pill grey"><i class="dot"></i>post-MVP</span></div>
          <div class="muted" style="font-size:12.5px;line-height:1.6">Töötamise kanne (TÖR/EMTA) vormistatakse lepingu sõlmimisel/lõpetamisel <b>operaatori kinnitusega</b> (human-in-the-loop) — mitte allkirjastamise automaatse kõrvalmõjuna.</div>
        </div>

        <div class="card pad reveal" style="margin-top:18px">
          <div class="overline" style="margin-bottom:10px">Lisad</div>
          ${t.lisad.map(x => `<button class="att nofile" onclick="toast('Ametijuhend on eseme (ametikoha) manus — demos illustratiivne')">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1"><b>Lisa ${x.nr}</b> · ${x.nimi}</div>
            <span class="tag">${x.fail}</span></button>`).join("")}
        </div>
      </div>
    </div>
  </div>`;
};

/* ---------- Imporditud lepingu detail -------------------------------------- */
View.imporditud = (id) => {
  const x = DB.impById(id); if (!x) return notFound("Imporditud lepingut ei leitud");
  return `
  <div class="view">
    <a class="btn btn-ghost btn-sm reveal" href="#/lepingud" style="margin-bottom:18px">${I.back} Lepingud</a>
    <div class="page-head reveal">
      <div><div class="overline">Imporditud leping</div>
        <h1 class="page-h1" style="margin-top:8px">${x.pool}</h1>
        <p class="page-sub mono" style="font-size:12px">${x.id} · ${x.liik} · ${x.ese}</p></div>
      <div style="text-align:right">${pill("Imporditud")}<div class="muted mono" style="font-size:11px;margin-top:8px">Kinnitatud: ${x.kinnitatud}</div></div>
    </div>

    <div class="split">
      <div>
        <div class="doc reveal">
          <div class="doc-head"><div><div class="doc-title">Tuvastatud struktuur</div></div>
            <span class="tag">${x.punkte} punkti klauslimudelis</span></div>
          <div style="padding:20px 26px">
            <dl class="kv">${x.parameetrid.map(([k,v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
            <div class="divline"></div>
            <div class="overline" style="margin-bottom:8px">Tuvastatud tähtajad → võtmekuupäevade kalender</div>
            ${x.tahtajad.map(td => `<div class="flex" style="gap:9px;padding:6px 0;font-size:13px"><span style="width:15px;color:var(--accent-deep);display:flex">${I.cal}</span><span class="mono">${td}</span></div>`).join("")}
          </div>
        </div>
      </div>
      <div>
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:10px">Osaleb võrdselt platvormi lepingutega</div>
          ${["Otsing ja filtrid","AI-agent ja Q&A","Võtmekuupäevade kalender","Aruandlus"].map(s => `<div class="flex" style="gap:9px;padding:5px 0;font-size:13px"><span style="width:15px;color:var(--green);display:flex">${I.check}</span>${s}</div>`).join("")}
          <div class="divline"></div>
          <div class="overline" style="margin-bottom:10px">Ei osale</div>
          <div class="muted" style="font-size:12.5px;line-height:1.6">Muudatuste voog (etapp 08) — platvorm ei vormista lisasid imporditud baaslepingu peale.</div>
        </div>
        <div class="card pad reveal" style="margin-top:18px">
          <div class="overline" style="margin-bottom:10px">Lähtedokument</div>
          <button class="att nofile" onclick="toast('Originaaldokument (allkirjastatud PDF) — demos illustratiivne')">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1"><b>Originaal</b> · õiguslik tõde</div>
            <span class="tag">${x.fail}</span></button>
        </div>
      </div>
    </div>
  </div>`;
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
window.lepSignGo = () => { const b = document.getElementById("do-sign") || document.getElementById("ring-sign");
  if (b) b.scrollIntoView({ behavior: "smooth", block: "center" }); };

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
  const hyppa = (lbl) => `<button class="btn btn-green btn-sm" onclick="lepHyppa()">${I.arrow} ${lbl}</button>`;
  const asClient = `<button class="btn btn-ghost btn-sm" onclick="lepAsClient()">Vaata üürnikuna ${I.arrow}</button>`;
  if (l.staatus === "Mustand V1") return cl9
    ? bar("wait", "Ootab üürileandjat", "Üürileandja koostab lepingu mustandit — saate teate, kui see on valmis.")
    : bar("me", "Sinu kord", "Vaata mustand üle — faktid on lausetes muudetavad. Kui valmis, saada üürnikule.",
        `<button class="btn btn-primary btn-sm send-draft">${I.send} Saada üürnikule</button>`);
  if (l.staatus === "Saadetud") {
    if (cl9) {
      if (kinni) return bar("me", "Sinu kord", `Üürileandja pakkus <b>${kinni} uut sõnastust</b> — ava punkt ja kinnita sealsamas.`, hyppa("Ava esimene"));
      if (kliOotel) return bar("me", "Sinu kord", `Üürileandja ootab sinu vastust <b>${kliOotel} punkti</b> arutelus.`, hyppa("Ava ja vasta"));
      if (opOotel) return bar("wait", "Ootab üürileandjat", `Sinu <b>${opOotel} ettepanek${opOotel > 1 ? "ut" : ""}</b> on üürileandja lahendada — saad teate, kui ta vastab.`);
      if (cs.length) return bar("me", "Sinu kord", "Kõik punktid on kokku lepitud — aktsepteeri leping, siis liigub see allkirjastamisse.",
        `<button class="btn btn-green btn-sm" id="cl-accept-all">${I.check} Aktsepteeri leping</button>`);
      return bar("me", "Sinu kord", "Vaata leping üle — klõpsa punktil, kui tahad küsida või muuta. Kui kõik sobib, aktsepteeri.",
        `<button class="btn btn-green btn-sm" id="cl-accept-all">${I.check} Aktsepteerin kõik punktid</button>`);
    }
    if (opOotel) return bar("me", "Sinu kord", `Üürnik ootab vastust <b>${opOotel} punktile</b> — ava ja otsusta sealsamas.`, hyppa("Ava esimene"));
    if (kliOotel) return bar("wait", "Ootab üürnikku", `${kliOotel} punkt${kliOotel > 1 ? "i" : ""} ootab üürniku vastust arutelus.`, asClient);
    if (kinni) return bar("wait", "Ootab üürnikku", `${kinni} sõnastus${kinni > 1 ? "t" : ""} ootab üürniku kinnitust punkti juures.`, asClient);
    if (cs.length) return bar("wait", "Ootab üürnikku", "Kõik punktid lahendatud — ootel on üürniku lõplik kinnitus.", asClient);
    return bar("wait", "Ootab üürnikku", "Üürnik vaatab lepingu üle — tema kommentaarid ilmuvad siia.", asClient);
  }
  if (l.staatus === "Allkirjastamisel") return bar("me", "Sinu kord", "Kõik on kokku lepitud — allkirjasta leping.",
    `<button class="btn btn-green btn-sm" onclick="lepSignGo()">${I.shield} Allkirjastamise juurde</button>`);
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
        `<button class="btn btn-green btn-sm" id="ring-accept">${I.check} Kinnitan muudatused</button>`);
      if (r && r.staatus === "Allkirjastamisel") return bar("me", "Sinu kord", `Muudatused kinnitatud — allkirjasta Lisa ${nr}.`,
        `<button class="btn btn-green btn-sm" id="ring-sign">${I.shield} Allkirjasta (Smart-ID)</button>`);
      if (r) return bar("wait", "Ootab üürileandjat", `Lisa ${nr} on üürileandja käes koostamisel — saate teate, kui see on kinnitamiseks valmis.`);
      return "";
    }
    if (opOotel) return bar("me", "Sinu kord", `Üürnik ootab vastust <b>${opOotel} muudatusettepanekule</b> — otsusta punkti juures (→ Lisa ${nr}).`, hyppa("Ava esimene"));
    if (kliOotel) return bar("wait", "Ootab üürnikku", `${kliOotel} punkt${kliOotel > 1 ? "i" : ""} ootab üürniku vastust arutelus.`, asClient);
    if (kinni) return bar("wait", "Ootab üürnikku", `${kinni} sõnastus${kinni > 1 ? "t" : ""} ootab üürniku kinnitust.`, asClient);
    if (r && r.staatus === "Koostamisel") return bar("me", "Sinu kord", `Lisa ${nr} on koos (${n} punkti) — saada üürnikule kinnitamiseks.`,
      `<button class="btn btn-primary btn-sm" id="ring-send" ${n ? "" : "disabled"}>${I.send} Saada üürnikule</button>`);
    if (r && r.staatus === "Kinnitamisel") return bar("wait", "Ootab üürnikku", `Lisa ${nr} ootab üürniku kinnitust.`, asClient);
    if (r && r.staatus === "Allkirjastamisel") return bar("me", "Sinu kord", `Üürnik kinnitas muudatused — allkirjasta Lisa ${nr}.`,
      `<button class="btn btn-green btn-sm" id="ring-sign">${I.shield} Allkirjasta (Smart-ID)</button>`);
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
  const sp = DB.spaceById(l.spaceId), f = objektOf(sp).failid;
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
  return `<div class="card pad reveal" style="margin-top:18px">
    <div class="overline" style="margin-bottom:8px">Dokumendid</div>
    ${docs.map(d => `<button class="doc-pick ${LEP_DOC_SEL === d.k ? "on" : ""} ${d.tyyp === "pdf" && !d.fail ? "nofile" : ""}" onclick="lepDoc('${d.k}')">
      ${I.file.replace('<svg', '<svg class="ic"')}
      <span class="dp-tx">${d.nimi}${d.meta ? `<small>${d.meta}</small>` : ""}</span>
    </button>`).join("")}
  </div>`;
}


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
      <span class="mono" style="font-size:10.5px;color:var(--faint)">→ Lisa ${nextLisaNr(l)}</span>
      <span class="chev">${I.arrow}</span>
    </button>` : `<button class="act-row" onclick="lepMuudatus(true)">
      <span>Muudatusrežiim</span>
      <span class="mono" style="font-size:10.5px;color:var(--faint)">Lisa ${(r || { nr: nextLisaNr(l) }).nr}</span>
      <span class="chev">${I.arrow}</span>
    </button>`) + (!isClient() && r && r.staatus === "Koostamisel" ? `<button class="act-row" id="ring-cancel">
      <span style="color:var(--red)">Tühista muudatusring</span>
      <span class="chev">${I.arrow}</span>
    </button>` : "");
  const lo = l.lopetamine;
  let lop;
  if (lo) {
    const who = lo.poolt === "üürnik" ? "Üürnik" : "Üürileandja";
    lop = `<div class="between" style="margin-bottom:6px"><b style="font-size:13px">Lõpeb ${lo.loppKuupaev}</b>${pill(lo.staatus)}</div>
      <div class="muted" style="font-size:11.5px">${who} · ülesütlemisteade ${lo.esitatud} (üld p 12)${lo.pohjus ? ` · ${lo.pohjus}` : ""}</div>
      ${!isClient() && lo.staatus === "Teavitatud" ? `<button class="btn btn-primary btn-sm" style="width:100%;justify-content:center;margin-top:9px" id="lop-ack">${I.check} Võta teadmiseks</button>` : ""}`;
  } else {
    const eD = addKuudISO(DEMO_TODAY.toISOString().slice(0, 10), 12);
    const eISO = `${eD.getFullYear()}-${String(eD.getMonth() + 1).padStart(2, "0")}-${String(eD.getDate()).padStart(2, "0")}`;
    lop = `<details class="sa-inline">
      <summary><span>Lepingu lõpetamine</span><span class="chev">${I.arrow}</span></summary>
      <div class="muted" style="font-size:11.5px;line-height:1.55;margin:4px 0 8px">Üld p 12: kumbki pool võib lepingu üles öelda 1-aastase etteteatamisega. Varaseim lõpp <b class="mono">${fmtEE(eD)}</b>.</div>
      <div class="field" style="margin-bottom:8px"><label>Lõppkuupäev</label><input id="lop-date" type="date" value="${eISO}" min="${eISO}"></div>
      <div class="field" style="margin-bottom:9px"><label>Põhjus (valikuline)</label><input id="lop-reason" type="text" placeholder="${isClient() ? "nt kolime suurematele pindadele" : "nt hoone rekonstrueerimine"}"></div>
      <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center" id="lop-send">Esita lõpetamisteade</button>
    </details>`;
  }
  return `<div class="card pad reveal" style="margin-top:18px">
    <div class="overline" style="margin-bottom:10px">Toimingud</div>
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
                <div class="wrap-actions" style="margin-top:9px">
                  <button class="btn btn-soft btn-sm ring-ai" data-i="${it.i}">${I.spark} Sõnasta AI-ga</button>
                  <button class="btn btn-green btn-sm ring-ok" data-i="${it.i}">${I.check} Kinnita sõnastus</button>
                  <span class="muted" style="font-size:11px">üürnikule nähtav alles pärast kinnitust</span></div></div>
              <div style="display:grid;gap:8px;justify-items:end">${pill("Sõnastamisel")}<button class="rmstep ring-rm" data-kind="p" data-i="${it.i}" title="Eemalda">×</button></div>
            </div>`;
    /* kinnitatud punkt rahuneb dokumendiks — sinine taust jääb ainult sõnastamisel reale */
    return `
            <div class="clause">
              <div class="ref">${it.ref}</div>
              <div class="body"><div class="txt" style="color:var(--ink)">${it.tekst}</div>
                ${it.kirjutabYle ? `<div class="overwrite">${I.arrow} kirjutab üle: ${it.kirjutabYle}</div>` : ""}
                ${it.auto ? `<div class="muted" style="font-size:11px;margin-top:4px">Genereeritud faktimuudatusest — jõustumisel uueneb põhitingimus automaatselt.</div>` : ""}</div>
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
              <div class="muted" style="font-size:11px;margin-top:8px">Punkt lisandub täiendava tingimusena — lepingupunkti ülekirjutus tekib punktil klõpsates. Kõik kogunevad Lisa ${nr} eritingimustesse ja jõustuvad pärast üürniku kinnitust ja allkirjastamist.</div>
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
    AUDIT.unshift({ aeg: TODAY_EE, autor: algataja === "üürnik" ? (DB.clientById(l.clientId) || {}).kontakt + " (üürnik)" : "Tarmo Sepp",
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
  if (fKey === "hind") return `<input id="fact-edit-in" type="number" step="0.05" min="0.5" value="${f.hind}" class="ce-in" style="width:9em"> <span class="muted" style="font-size:12px">€/m² kuus</span>`;
  if (fKey === "parkimine") return `<input id="fact-edit-in" type="number" step="1" min="0" value="${f.parkimine}" class="ce-in" style="width:7em"> <span class="muted" style="font-size:12px">kohta</span>`;
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
    { pool: ACCOUNT.landlord.nimi, isik: "Margus Varne", meetod: "Smart-ID", aeg: TODAY_EE },
    { pool: cl.nimi, isik: cl.kontakt, meetod: "Smart-ID", aeg: TODAY_EE },
  ];
  r.staatus = "Jõustunud"; r.joustus = TODAY_EE;
  AUDIT.unshift({ aeg: TODAY_EE, autor: "Mõlemad pooled", tegevus: `${l.id}: Lisa ${r.nr} (eritingimused, muudatus) allkirjastatud ja jõustunud — ${r.faktid.length} faktimuudatust, ${r.punktid.length} punkti. Põhileping jääb muutmata, lisa on ülimuslik.` });
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
      <div class="sh-sub" style="margin-top:14px">Äriruumide üürilepingu ${l.id} lisa. Eritingimused on Poolte kokkuleppel ülimuslikud Üld- ja Põhitingimuste suhtes niivõrd, kuivõrd nendes on kokku lepitud teisiti.</div>
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
      <div class="sh-sub" style="margin-top:14px">Äriruumide üürilepingu ${l.id} lisa (lepingu muudatus). Eritingimused on Poolte kokkuleppel ülimuslikud Üld- ja Põhitingimuste ning varasemate lisade suhtes niivõrd, kuivõrd nendes on kokku lepitud teisiti.</div>
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
  if (LEP_FOCUS_ID !== l.id) { LEP_FOCUS_ID = l.id; LEP_MUUDATUS_MODE = false; LEP_DOC_SEL = "leping"; }
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
    <a class="btn btn-ghost btn-sm reveal" href="${isClient()?'#/portaal':'#/lepingud'}" style="margin-bottom:18px">${I.back} ${isClient()?'Minu dokumendid':'Lepingud'}</a>
    <!-- üürileandja info-päis eemaldatud (nagu pakkumusvaates v156) — identiteet on
         dokumendi päises, staatus lehe päises; plokk oli puhas dubleering -->
    <div class="page-head reveal">
      <div><div class="overline">Üürileping · ${l.versioon||"allkirjastatud"}</div>
        <h1 class="page-h1" style="margin-top:8px">${cl.nimi}</h1>
        <p class="page-sub mono" style="font-size:12px">${l.id} · ${sp.nimi} · ${objektOf(sp).nimi} · pakkumusest ${l.pakkumus}</p></div>
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
        ${(() => {
          /* Allkirjastamisel: kõik allkirjastatavad dokumendid järjest (konteinerite kontekst) */
          if (l.staatus === "Allkirjastamisel") return "";
          /* Kehtiv: dokumendifookus — eelvaates on täpselt ÜKS dokument (valik külgpaanilt) */
          const sel = LEP_DOC_SEL;
          if (sel === "lisa1" || sel === "lisa2") {
            const sp2 = DB.spaceById(l.spaceId), f2 = objektOf(sp2).failid;
            const fail = sel === "lisa1" ? f2.pinnaplaan : f2.parkimine;
            const title = sel === "lisa1" ? `Lisa 1 · Pinnaplaan (${sp2.nimi})` : "Lisa 2 · Asendiplaan + parkimisskeem";
            return fail ? `
        <div class="doc reveal" style="overflow:hidden">
          <div class="doc-head" style="padding:13px 20px"><div><div class="doc-title" style="font-size:15px">${title}</div></div>
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
        <div class="between reveal" style="margin-bottom:12px;gap:10px">
          <button class="btn btn-soft btn-sm" onclick="lepMuudatus(false)">${I.back} Näita dokumenti</button>
          <span class="tag">Muudatusrežiim · klõpsa punktil — kokkulepe → Lisa ${(aktiivneRing(l) || { nr: nextLisaNr(l) }).nr}</span>
        </div>` : ""}
        <div class="doc reveal">
          <div class="doc-head">
            <div><div class="doc-title">Üürilepingu dokument</div><div class="doc-sub">${editPohi ? "Muuda fakte otse lausetes — tuletatud summad ja kuupäevad uuenevad ise (salvestub automaatselt)" : `Klõpsa punktil ${isClient()?"kommenteerimiseks":"kommentaaride vaatamiseks"}`}</div></div>
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
            ${canShape ? `<div class="muted" style="font-size:11px;margin:0 0 6px">punkti ei muudeta — „→ Lisa 3" loob ülimusliku eritingimuse</div>` : ""}
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
                    <div><p>${p.tekst}</p>${over ? `<div class="overwrite" style="margin-top:7px">${I.arrow} kirjutatud üle: eritingimus Lisa 3-s (ülimuslik)</div>` : ""}</div>
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
                ${e.sonastamisel ? `<div class="wrap-actions" style="margin-top:9px">
                  <button class="btn btn-soft btn-sm eri-ai" data-i="${i}">${I.spark} Sõnasta AI-ga</button>
                  <button class="btn btn-green btn-sm eri-ok" data-i="${i}">${I.check} Kinnita sõnastus</button>
                  <span class="muted" style="font-size:11px">üürnikule nähtav alles pärast kinnitust</span></div>` : ""}
                ${ecmts.length?`<div style="margin-top:6px"><button class="steplink" data-ecmt="${e.ref}">Vaata kommentaare (${ecmts.length})</button></div>`:""}</div>
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
        ${signed ? signCard(l) : l.staatus === "Allkirjastamisel" ? signPanel(l) : ""}
        ${l.staatus === "Kehtiv" ? dokumendidCard(l) + toimingudCard(l, openCmts) : ""}

        <!-- indekseerimise külgkaart eemaldatud: indekseerimine elab lepingus endas
             (üld p 5.2 / Lisa 3 ülekirjutus) — muutmine käib punkti läbirääkimisega -->

        ${(l.staatus === "Allkirjastamisel" || signed) ? "" : (lisadRead => `
        <!-- kehtival lepingul asendab seda Dokumendid-valija; allkirjastamisel konteinerid -->
        <div class="card pad reveal" style="margin-top:18px">
          <div class="overline" style="margin-bottom:10px">Lisad · klõpsa vaatamiseks</div>
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
        AUDIT.unshift({ aeg: TODAY_EE, autor: "ThinkOne AI", tegevus: `${l.id}: AI pakkus Lisa ${r.nr} eritingimuse sõnastuse — ootab operaatori kinnitust.` });
        DB.save(); toast("AI sõnastus valmis — vaata üle ja kinnita"); router();
      }, 900);
    });
    document.querySelectorAll(".ring-ok").forEach(b => b.onclick = () => {
      const r = aktiivneRing(l); const p = r && r.punktid[+b.dataset.i]; if (!p) return;
      const t = document.querySelector(`.ring-txt[data-i="${b.dataset.i}"]`);
      const v = (t ? t.value : p.tekst).trim();
      if (!v) { toast("Sõnastus on tühi — kirjuta või kasuta AI-d"); return; }
      p.tekst = v; p.sonastamisel = false; p.staatus = "Aktsepteeritud";
      lm(() => AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: Lisa ${r.nr} eritingimuse sõnastus kinnitatud.` }), "Sõnastus kinnitatud");
    });
    const rna = document.getElementById("ring-new-add");
    if (rna) rna.onclick = () => {
      const t = document.getElementById("ring-new"); const txt = t ? t.value.trim() : "";
      if (!txt) { toast("Sõnasta eritingimus"); if (t) t.focus(); return; }
      const ky = (document.getElementById("ring-new-ky") || {}).value || null;
      const r = ensureRing(l, "operaator");
      lm(() => { r.punktid.push({ tekst: txt, algne: null, kirjutabYle: ky || null, staatus: "Aktsepteeritud" });
        AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: eritingimus lisatud Lisa ${r.nr}-i.` });
      }, `Punkt lisatud Lisa ${r.nr} eritingimustesse`);
    };
    const rs = document.getElementById("ring-send");
    if (rs) rs.onclick = () => { const r = aktiivneRing(l); if (!r) return;
      if (r.punktid.some(p => p.sonastamisel)) { toast("Sõnastamisel punktid vajavad enne kinnitamist"); return; }
      lm(() => { r.staatus = "Kinnitamisel"; LEP_MUUDATUS_MODE = false;
        AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: Lisa ${r.nr} eritingimused saadetud üürnikule kinnitamiseks.` });
      }, `Lisa ${r.nr} saadetud üürnikule kinnitamiseks`); };
    const rc2 = document.getElementById("ring-cancel");
    if (rc2) rc2.onclick = () => { if (!confirm("Tühistad muudatusringi? Kogutud muudatused kaovad.")) return;
      lm(() => { l.muudatused = (l.muudatused || []).filter(m => m.staatus === "Jõustunud"); LEP_MUUDATUS_MODE = false;
        AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: muudatusring tühistatud.` });
      }, "Muudatusring tühistatud"); };
    const ra = document.getElementById("ring-accept");
    if (ra) ra.onclick = () => { const r = aktiivneRing(l); if (!r) return;
      lm(() => { r.staatus = "Allkirjastamisel";
        AUDIT.unshift({ aeg: TODAY_EE, autor: roleClient().kontakt + " (üürnik)", tegevus: `${l.id}: Lisa ${r.nr} muudatused kinnitatud → allkirjastamisele.` });
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
        AUDIT.unshift({ aeg: TODAY_EE, autor, tegevus: `${l.id}: ülesütlemisteade esitatud (üld p 12) — leping lõpeb ${kp}.` });
      }, "Lõpetamisteade esitatud · teine pool saab teate");
    };
    const la = document.getElementById("lop-ack");
    if (la) la.onclick = () => lm(() => {
      l.lopetamine.staatus = "Kinnitatud";
      const cl2 = DB.clientById(l.clientId);
      KEY_DATES.push({ kuupaev: eeToISO(l.lopetamine.loppKuupaev), tyyp: "Lepingu lõpp", margis: "amber",
        objekt: `${l.id} · ${cl2 ? cl2.nimi : ""}`, info: "Ülesütlemine (üld p 12) · pinna vabanemine planeerida" });
      AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: ülesütlemisteade teadmiseks võetud — lõppkuupäev ${l.lopetamine.loppKuupaev} kalendris.` });
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
      AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: tehingufakt „${FACT_LABELS[k] || k}" → ${disp} — põhitingimuste laused uuenesid.` });
      DB.save(); router();
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
      AUDIT.unshift({ aeg: TODAY_EE, autor: (roleClient().kontakt || "Üürnik") + " (üürnik)", tegevus: `${l.id}: üürniku esindaja andmed uuendatud (P 6.2).` });
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
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: üldtingimuste punkt ${ref} saadetud eritingimustesse ülekirjutamisele (Lisa 3, ülimuslik).` });
    DB.save(); toast(`Punkt ${ref} → Lisa 3 — sõnasta ülimuslik kokkulepe`); router();
  });

  /* Lisa 3 punktide sõnastus ja eemaldus mustandis (autosalvestus + renummerdus) */
  if (l) document.querySelectorAll(".leri-txt").forEach(t => t.onchange = () => {
    const e = l.eri[+t.dataset.i]; if (!e) return;
    const v = t.value.trim();
    if (!v) { t.value = e.tekst; return; }
    e.tekst = v;
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: eritingimuse ${e.ref} sõnastus muudetud mustandis.` });
    DB.save();
  });
  if (l) document.querySelectorAll(".leri-rm").forEach(b => b.onclick = () => {
    const e = l.eri[+b.dataset.i]; if (!e) return;
    if (!confirm("Eemalda eritingimus Lisa 3-st? Seda ei saa tagasi võtta.")) return;
    l.eri.splice(+b.dataset.i, 1);
    l.eri.forEach((x, i) => x.ref = `Lisa 3 · p${i + 1}`);
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: eritingimus eemaldatud (Lisa 3 renummerdatud).` });
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
      AUDIT.unshift({ aeg: TODAY_EE, autor: "ThinkOne AI", tegevus: `${l.id}: AI pakkus eritingimuse ${e.ref} sõnastuse (ettepaneku ja arutelu põhjal) — ootab operaatori kinnitust.` });
      DB.save(); toast("AI sõnastus valmis — vaata üle ja kinnita"); router();
    }, 900);
  });
  if (l) document.querySelectorAll(".eri-ok").forEach(b => b.onclick = () => {
    const e = l.eri[+b.dataset.i]; if (!e) return;
    const t = document.querySelector(`.leri-txt[data-i="${b.dataset.i}"]`);
    const v = (t ? t.value : e.tekst).trim();
    if (!v) { toast("Sõnastus on tühi — kirjuta või kasuta AI-d"); return; }
    e.tekst = v; e.sonastamisel = false; e.staatus = "Aktsepteeritud";
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: eritingimuse ${e.ref} sõnastus kinnitatud — nähtav mõlemale poolele.` });
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
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id} ${l.versioon||"mustand"} saadetud üürnikule.` });
    DB.save(); toast("Mustand saadetud üürnikule · teavitus saadetud"); router();
  });

  const accAll = document.getElementById("cl-accept-all");
  if (accAll && l) accAll.onclick = () => {
    l.staatus = "Allkirjastamisel";
    AUDIT.unshift({ aeg: TODAY_EE, autor: roleClient().kontakt + " (üürnik)", tegevus: `${l.id}: kõik punktid aktsepteeritud → allkirjastamisele.` });
    DB.save(); toast("Kõik punktid aktsepteeritud · leping liigub allkirjastamisse"); router();
  };

  const sign = document.getElementById("do-sign");
  if (sign) sign.onclick = doSign;
  document.querySelectorAll(".m-btn").forEach(b => b.onclick = () => { document.querySelectorAll(".m-btn").forEach(x=>x.classList.remove("sel")); b.classList.add("sel"); });
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
  const thCard = (c) => { const aru = c.arutelu || []; return `
    <div class="cmt th-card ${thSkin(null, c.autor)}">
      ${thHead(null, c.autor, c.aeg)}
      <div class="body">${c.tekst}</div>
      ${c.staatus === "Ootel" && !aru.length ? `<div style="margin-top:9px">${pill(c.staatus)}</div>` : ""}
    </div>
    ${aru.map((m, mi) => `<div class="cmt th-card th-step ${thSkin(m.roll, m.autor)}">
      ${thHead(m.roll, m.autor, m.aeg)}
      <div class="body">${m.tekst}</div>
      ${c.staatus === "Ootel" && !c.vastus && mi === aru.length - 1 ? `<div style="margin-top:9px">${pill("Arutelul")}</div>` : ""}
    </div>`).join("")}
    ${c.vastus ? `<div class="cmt th-card th-step th-lessor th-dec ${c.staatus === "Aktsepteeritud" ? "ok" : c.staatus === "Selgitatud" ? "info" : "no"}">
      ${thHead("operaator", "Tarmo Sepp", c.otsusAeg || c.aeg)}
      <div class="body">${c.vastus}</div>
      <div style="margin-top:9px">${pill(cmtPill(c.staatus))}</div>
    </div>` : ""}
    ${c.ettepanek && c.staatus === "Ootab kinnitust" ? (ep => `<div class="cmt th-card th-step th-lessor th-dec wait">
      ${thHead("operaator", "Tarmo Sepp", ep.aeg)}
      <div class="overline" style="margin:2px 0 6px">${ep.tyyp === "selgitus" ? "Selgitus — muudatust ei tehta"
        : "Uue sõnastuse ettepanek · " + (ep.siht === "otse" ? "põhitingimus muudetakse otse"
        : ep.siht === "eri" ? "Lisa 3 punkti sõnastus muudetakse"
        : ep.siht === "lisa3" ? "vormistatakse Lisa 3 eritingimusena (ülimuslik)"
        : `vormistatakse Lisa ${ep.lisaNr} kokkuleppes — jõustub allkirjastamisel`)}</div>
      <div class="body">${ep.kuva || ep.tekst}</div>
      ${ep.markus ? `<div class="muted" style="font-size:12px;margin-top:6px">${ep.markus}</div>` : ""}
      ${isClient() && c === cmt && l.staatus !== "Allkirjastamisel" ? `
      <!-- üürniku otsus elab OTSE sõnastuse juures — sisendväli avaneb alles soovil -->
      <div class="wrap-actions" style="margin-top:11px">
        <button class="btn btn-green btn-sm" id="conf-prop">${I.check} ${ep.tyyp === "selgitus" ? "Kinnitan — küsimus sai vastuse" : "Kinnitan uue sõnastuse"}</button>
        <button class="btn btn-ghost btn-sm" id="prop-reply-t">Ei sobi — vastan arutellu</button>
      </div>
      <div id="prop-reply-area" style="display:none;margin-top:9px">
        <textarea id="new-cmt" rows="2" class="ce-in" placeholder="Miks sõnastus ei sobi — punkt läheb tagasi üürileandjale…"></textarea>
        <div class="wrap-actions" style="margin-top:8px;justify-content:flex-end"><button class="btn btn-soft btn-sm" id="send-cmt">${I.enter} Vasta</button></div>
      </div>` : `<div style="margin-top:9px">${pill("Ootab kinnitust")}</div>`}
    </div>`)(c.ettepanek) : ""}
    `; };
  exp.innerHTML = `
    ${hist.length ? `<details class="cmt-hist"><summary><span class="chev">${I.arrow}</span>Läbirääkimiste ajalugu · ${hist.length} lahendatud</summary><div class="thread">${hist.map(thCard).join("")}</div></details>` : ""}
    ${cmts.length ? `<div class="thread">${cmts.map(thCard).join("")}</div>`
      : hist.length ? "" : `<div class="muted" style="font-size:12.5px;margin:10px 0 4px">Sellel punktil pole veel kommentaare.</div>`}
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
        cmt.otsusAeg = TODAY_EE;
        if (ep.tyyp === "selgitus") {
          cmt.staatus = "Selgitatud";
          cmt.vastus = `Selgitatud — ${ep.tekst}`;
          AUDIT.unshift({ aeg: TODAY_EE, autor: who, tegevus: `${l.id}: üürnik kinnitas selgituse punktile „${ref}" — muudatust ei tehta.` });
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
          AUDIT.unshift({ aeg: TODAY_EE, autor: who, tegevus: `${l.id}: üürnik kinnitas sõnastuse punktile „${ref}" → Lisa ${ring.nr}.` });
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
        AUDIT.unshift({ aeg: TODAY_EE, autor: who, tegevus: `${l.id}: üürnik kinnitas uue sõnastuse punktile „${ref}".` });
        mutate("Uus sõnastus kinnitatud · punkt lahendatud", true);
      };
      exp.querySelector("#send-cmt").onclick = () => {
        const txt = exp.querySelector("#new-cmt").value.trim(); if (!txt) return;
        /* vastus kinnituse asemel: ettepanek jääb ajalukku arutelu sissekandena, punkt läheb tagasi Ootele */
        cmt.arutelu = cmt.arutelu || [];
        cmt.arutelu.push({ roll: "operaator", autor: "Tarmo Sepp", aeg: ep.aeg, tekst: `${ep.tyyp === "selgitus" ? "Selgitus" : "Sõnastusettepanek"} (ei kinnitatud): ${ep.kuva || ep.tekst}` });
        cmt.arutelu.push({ roll: "klient", autor: who, aeg: TODAY_EE, tekst: txt });
        cmt.ettepanek = null; cmt.staatus = "Ootel";
        AUDIT.unshift({ aeg: TODAY_EE, autor: who, tegevus: `${l.id}: üürnik vastas ettepanekule punktil „${ref}" — läbirääkimine jätkub.` });
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
        <div class="wrap-actions" style="margin-top:9px;justify-content:flex-end"><button class="btn btn-accent btn-sm" id="send-cmt">${I.enter} Vasta</button></div>`;
      foot.querySelector("#send-cmt").onclick = () => {
        const txt = foot.querySelector("#new-cmt").value.trim(); if (!txt) return;
        cmt.arutelu = cmt.arutelu || [];
        cmt.arutelu.push({ roll: "klient", autor: roleClient().kontakt + " (üürnik)", aeg: TODAY_EE, tekst: txt });
        AUDIT.unshift({ aeg: TODAY_EE, autor: roleClient().kontakt + " (üürnik)", tegevus: `Vastus arutellu: ${l.id} punkt „${ref}".` });
        mutate("Vastus saadetud · operaatorit teavitatud");
      };
    } else if (cmts.length && !pending.length && l.staatus !== "Kehtiv") {
      /* punkt on lahendatud (kinnitatud/selgitatud/tagasi lükatud) — LUKUS:
         uut sisendit läbirääkimise ajal ei avata, lõim jääb loetavaks.
         Kehtival lepingul jääb kommenteerimine lahti (= uus muudatusettepanek). */
      if (l.staatus === "Saadetud" && !(l.kommentaarid || []).some(cmtOpen)) {
        /* viimane punkt sai kinnitatud — teekond EI katke: lõpusamm sünnib sealsamas */
        foot.innerHTML = `<div class="fin-cta">
          <b>${I.check} Kõik punktid on kokku lepitud</b>
          <button class="btn btn-green btn-sm" id="acc-inline">Aktsepteeri leping — liigu allkirjastamisele</button></div>`;
        foot.querySelector("#acc-inline").onclick = () => { const b = document.getElementById("cl-accept-all"); if (b) b.click(); };
      } else foot.remove();
    } else {
      /* uus kommentaar/ettepanek punkti juurde; kehtival lepingul = muudatusettepanek */
      foot.innerHTML = `<textarea id="new-cmt" rows="3" class="ce-in" placeholder="${l.staatus === "Kehtiv" ? "Teie muudatusettepanek või küsimus kehtiva lepingu punkti kohta — kokkulepe vormistatakse uue lisana…" : "Teie kommentaar või muudatusettepanek selle punkti kohta…"}"></textarea>
        <div class="wrap-actions" style="margin-top:9px;justify-content:flex-end"><button class="btn btn-accent btn-sm" id="send-cmt">${I.enter} Saada</button></div>`;
      foot.querySelector("#send-cmt").onclick = () => {
        const txt = foot.querySelector("#new-cmt").value.trim(); if (!txt) return;
        l.kommentaarid = l.kommentaarid || [];
        l.kommentaarid.push({ clauseRef: ref, autor: roleClient().kontakt + " (üürnik)", aeg: TODAY_EE, tekst: txt, staatus: "Ootel", vastus: null });
        AUDIT.unshift({ aeg: TODAY_EE, autor: roleClient().kontakt + " (üürnik)", tegevus: `Kommentaar lisatud ${l.id} punktile „${ref}".` });
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
      <div class="wrap-actions" style="margin-top:4px"><button class="btn btn-primary btn-sm" id="res-open">${I.check} Lahenda</button></div>
      <div class="res-panel" id="res-panel" style="display:none">
        <div class="res-opts">
          ${resOpt("vasta", I.chat, "Vasta kommentaarile",
            "Kolm väljundit: vastus arutellu (punkt jääb lahtiseks), selgitus (üürnik kinnitab, muudatust ei tehta) või tagasilükkamine põhjendusega.")}
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
    foot.querySelector("#res-open").onclick = () =>
      { panel.style.display = panel.style.display === "none" ? "block" : "none"; };
    const sendProp = (ep) => {
      if (kehtiv) ep.lisaNr = ringNr;
      ep.aeg = TODAY_EE;
      cmt.ettepanek = ep; cmt.staatus = "Ootab kinnitust";
      AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: ${ep.tyyp === "selgitus" ? "selgitus" : "uue sõnastuse ettepanek"} punktile „${ref}" saadetud üürnikule kinnitamiseks.` });
      mutate(ep.tyyp === "selgitus" ? "Selgitus saadetud · üürnik kinnitab punkti juures" : "Ettepanek saadetud · üürnik kinnitab punkti juures", true);
    };
    const FORMS = {
      vasta: () => `
        <textarea id="res-txt" rows="3" class="ce-in" placeholder="Vastus üürnikule…"></textarea>
        <div class="wrap-actions" style="margin-top:9px">
          <button class="btn btn-accent btn-sm" id="res-aru">${I.enter} Vasta arutellu</button>
          <button class="btn btn-soft btn-sm" id="res-selgita">Selgitus — muudatust pole vaja</button>
          <button class="btn btn-ghost btn-sm" id="res-rej">Lükka tagasi</button>
        </div>
        <div class="muted" style="font-size:11px;margin-top:6px">Arutelu jätab punkti lahtiseks. Selgituse kinnitab üürnik — punkt sulgub muudatuseta. Tagasilükkamine sulgeb punkti põhjendusega.</div>`,
      muuda: () => fKey ? `
        <div class="overline" style="margin-bottom:8px">${FACT_LABELS[fKey] || fKey}</div>
        <div class="flex" style="gap:8px;flex-wrap:wrap;align-items:center">${faktiSisend(fKey, ensureTehing(l))}</div>
        <div class="wrap-actions" style="margin-top:10px"><button class="btn btn-green btn-sm" id="res-send-muuda">${I.send} Saada üürnikule kinnitamiseks</button></div>
        <div class="muted" style="font-size:11px;margin-top:6px">Põhitingimus kirjutatakse ümber pärast üürniku kinnitust — laused, summad ja tähtajad arvutuvad üle.</div>` : `
        <div class="overline" style="margin-bottom:8px">${ref} · uus sõnastus</div>
        <textarea id="res-txt" rows="4" class="ce-in">${eriRow ? eriRow.tekst : ""}</textarea>
        <div class="wrap-actions" style="margin-top:10px"><button class="btn btn-green btn-sm" id="res-send-muuda">${I.send} Saada üürnikule kinnitamiseks</button></div>
        <div class="muted" style="font-size:11px;margin-top:6px">Lisa 3 punkti sõnastus muudetakse pärast üürniku kinnitust — uut punkti ei teki.</div>`,
      eri: () => `
        <div class="overline" style="margin-bottom:8px">Eritingimus → ${eriLbl} · ülimuslik</div>
        <textarea id="res-txt" rows="4" class="ce-in">${aiSonasta({ algne: cmt.tekst, kirjutabYle: kyRef })}</textarea>
        <div class="wrap-actions" style="margin-top:8px"><button class="btn btn-soft btn-sm" id="res-ai">${I.spark} Sõnasta AI-ga</button><span class="muted" style="font-size:11px">AI sõnastus üürniku ettepaneku põhjal — muutke vajadusel</span></div>
        <div class="wrap-actions" style="margin-top:10px"><button class="btn btn-green btn-sm" id="res-send-eri">${I.send} Saada üürnikule kinnitamiseks</button></div>
        ${kehtiv ? `<div class="muted" style="font-size:11px;margin-top:6px">Kokkulepe vormistatakse Lisa ${ringNr} eritingimusena — jõustub allkirjastamisel.</div>` : ""}`,
    };
    panel.querySelectorAll(".res-opt").forEach(b => b.onclick = () => {
      panel.querySelectorAll(".res-opt").forEach(x => x.classList.toggle("sel", x === b));
      form.innerHTML = FORMS[b.dataset.o]();
      const need = (msg) => { const tt = form.querySelector("#res-txt"); const v = tt ? tt.value.trim() : "";
        if (!v) { toast(msg || "Kirjuta tekst"); if (tt) tt.focus(); } return v; };
      const t0 = form.querySelector("#res-txt"); if (t0) t0.focus();
      const aru = form.querySelector("#res-aru");
      if (aru) aru.onclick = () => {
        const v = need("Kirjuta vastus arutellu"); if (!v) return;
        cmt.arutelu = cmt.arutelu || [];
        cmt.arutelu.push({ roll: "operaator", autor: "Tarmo Sepp", aeg: TODAY_EE, tekst: v });
        AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Vastus arutellu: ${l.id} punkt „${ref}" (otsus veel tegemata).` });
        mutate("Vastus saadetud · punkt jääb lahtiseks");
      };
      const sel = form.querySelector("#res-selgita");
      if (sel) sel.onclick = () => {
        const v = need("Kirjuta selgitus — üürnik näeb ja kinnitab selle"); if (!v) return;
        sendProp({ tyyp: "selgitus", tekst: v });
      };
      const rej = form.querySelector("#res-rej");
      if (rej) rej.onclick = () => {
        /* tagasilükkamine ilma põhjenduseta jätaks üürniku pimedusse — põhjendus on kohustuslik */
        const v = need("Lisa põhjendus — üürnik näeb seda punkti juures"); if (!v) return;
        cmt.staatus = "Tagasi lükatud"; cmt.otsusAeg = TODAY_EE;
        cmt.vastus = `Ei aktsepteeritud — ${v}`;
        AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: ettepanek punktile „${ref}" tagasi lükatud (põhjendusega).` });
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
      <div class="overline" style="margin:10px 0 8px">Muudatus → Lisa ${nr}</div>
      ${fKey ? `<div class="flex" style="gap:8px;flex-wrap:wrap;align-items:center">${faktiSisend(fKey, f)}</div>` : `
      <textarea id="ring-txt" rows="3" class="ce-in" placeholder="${eriRow ? "Punkti uus sõnastus…" : `Uus kokkulepe selle punkti kohta — vormistatakse Lisa ${nr} punktina (ülimuslik)…`}">${eriRow ? eriRow.tekst : ""}</textarea>`}
      <div class="wrap-actions" style="margin-top:9px"><button class="btn btn-primary btn-sm" id="ring-add">${I.plus} Lisa muudatusringi</button></div>
      <div class="muted" style="font-size:11px;margin-top:6px">Muudatused kogunevad Lisa ${nr} kokkuleppesse — jõustuvad pärast üürniku kinnitust ja allkirjastamist. Leping ise seni ei muutu.</div>`;
    foot.querySelector("#ring-add").onclick = () => {
      if (fKey) {
        const val = faktiVal(fKey, foot.querySelector("#fact-edit-in"));
        if (val === undefined) { toast("Kontrolli väärtust"); return; }
        const ring = ensureRing(l, "operaator");
        ring.faktid = ring.faktid.filter(x => x.key !== fKey);
        ring.faktid.push({ key: fKey, label: FACT_LABELS[fKey], vana: f[fKey], uus: val, vanaTxt: faktTxt(fKey, f[fKey]), uusTxt: faktTxt(fKey, val) });
        AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: muudatus lisatud Lisa ${ring.nr} ringi (${FACT_LABELS[fKey]} → ${faktTxt(fKey, val)}).` });
        mutate(`Muudatus lisatud Lisa ${ring.nr} ringi`);
      } else {
        const t2 = foot.querySelector("#ring-txt"); const txt = t2 ? t2.value.trim() : "";
        if (!txt) { toast("Sõnasta muudatus"); if (t2) t2.focus(); return; }
        const kyRef = eriRow ? ref : (/^\d/.test(String(ref)) ? `Üld · p ${ref}` : ref);
        const ring = ensureRing(l, "operaator");
        ring.punktid.push({ tekst: txt, algne: eriRow ? eriRow.tekst : null, kirjutabYle: kyRef });
        AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${l.id}: punkt lisatud Lisa ${ring.nr} ringi (kirjutab üle: ${kyRef}).` });
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
  const f = objektOf(DB.spaceById(l.spaceId)).failid;
  return `<div class="card pad reveal">
    <div class="overline" style="margin-bottom:12px">Allkirjastamine</div>
    <div class="container-card" style="margin-bottom:12px">
      <div class="ch"><b>Allkirjastatavad dokumendid</b><span class="tag">leping + plaanid</span></div>
      <div class="ci">${I.file.replace('<svg','<svg class="fic"')} Üürileping ${l.id}</div>
      <div class="ci" style="cursor:pointer" onclick="openPdf('${f.pinnaplaan||""}','Lisa 1 · pinnaplaan')">${I.file.replace('<svg','<svg class="fic"')} Lisa 1 · pinnaplaan <span class="tag" style="margin-left:auto">vaata</span></div>
      <div class="ci" style="cursor:pointer" onclick="openPdf('${f.parkimine||""}','Lisa 2 · asendiplaan + parkimisskeem')">${I.file.replace('<svg','<svg class="fic"')} Lisa 2 · asendiplaan + parkimine <span class="tag" style="margin-left:auto">vaata</span></div>
    </div>
    ${l.eri.filter(e => !e.sonastamisel).length ? `
    <div class="container-card" style="margin-bottom:14px">
      <div class="ch"><b>Eritingimused</b><span class="tag">eraldi dokument</span></div>
      <div class="ci" style="cursor:pointer" onclick="openLisa3('${l.id}')">${I.file.replace('<svg','<svg class="fic"')} Lisa 3 · eritingimused <span class="tag" style="margin-left:auto">vaata</span></div>
    </div>` : ""}
    <div class="overline" style="margin-bottom:8px">Allkirjastamise meetod</div>
    <div class="method" id="method">
      <button class="m-btn sel" data-m="Smart-ID"><span class="m-ic si">${I.smartid}</span>
        <span class="m-tx"><span class="m">Smart-ID</span><span class="s">soovituslik</span></span></button>
      <button class="m-btn" data-m="Mobiil-ID"><span class="m-ic mi">${I.mobiilid}</span>
        <span class="m-tx"><span class="m">Mobiil-ID</span><span class="s">+372</span></span></button>
    </div>
    <button class="btn btn-green" id="do-sign" style="width:100%;justify-content:center;margin-top:14px">${I.shield} Alusta allkirjastamist</button>
    <div class="muted" style="font-size:11.5px;margin-top:10px;text-align:center">Eeldab kõikide punktide aktsepteerimist.</div>
  </div>`;
}
function doSign() {
  const m = document.querySelector(".m-btn.sel")?.dataset.m || "Smart-ID";
  const btn = document.getElementById("do-sign");
  btn.innerHTML = `<span class="thinking" style="color:#fff"><span class="d" style="background:#fff"></span><span class="d" style="background:#fff"></span><span class="d" style="background:#fff"></span></span> ${m} · kontrollkood 4271`;
  btn.disabled = true;
  const l = CURRENT_LEASE;
  setTimeout(() => {
    if (l) {
      const c = DB.clientById(l.clientId);
      l.staatus = "Kehtiv"; l.allkirjastatud = TODAY_EE; l.versioon = null;
      l.allkirjad = [
        { pool: ACCOUNT.landlord.nimi, isik: "Margus Varne", meetod: m, aeg: TODAY_EE + " 14:05" },
        { pool: c.nimi, isik: c.kontakt, meetod: m, aeg: TODAY_EE + " 14:09" },
      ];
      const sp = DB.spaceById(l.spaceId); if (sp) { sp.staatus = "Üüritud"; sp.tenant = c.nimi; }
      AUDIT.unshift({ aeg: TODAY_EE, autor: "Mõlemad pooled", tegevus: `${l.id} allkirjastatud (${m}) → arhiveeritud. Võtmekuupäevad kalendrisse.` });
      DB.save();
    }
    toast("Leping allkirjastatud ("+m+") → arhiveeritud · võtmekuupäevad kalendrisse");
    router();
  }, 1600);
}
function signCard(l) {
  /* vaikne olekukaart: seis + kaks võtmerida; allkirjade detailid voldikus */
  return `<div class="card pad reveal">
    <!-- staatusepill elab päises (äpiülene konventsioon) — siin ei korrata -->
    <div style="margin-bottom:10px"><b style="font-size:14px">Kehtiv leping</b></div>
    <div class="ci" style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:12.5px">
      <span class="muted">Allkirjastatud</span>
      <span style="flex:1;text-align:right" class="mono">${l.allkirjastatud || "—"}</span>
    </div>
    <details class="sa-inline">
      <summary><span>Allkirjad · ${l.allkirjad.length}</span><span class="chev">${I.arrow}</span></summary>
      ${l.allkirjad.map(a => `<div class="ci" style="display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid var(--line)">
        <div style="flex:1;font-size:12.5px"><b>${a.isik}</b> · ${a.pool}<div class="muted mono" style="font-size:11px">${a.meetod} · ${a.aeg}</div></div>${I.check.replace('<svg','<svg style="width:15px;color:var(--green)"')}</div>`).join("")}
      <a class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-top:10px" href="#/audit">${I.audit} Ekspordi audit trail</a>
    </details>
  </div>`;
}

/* ---------- Uus leping (wizard, etapp 05) -----------------------------
   Üks tegevus „Loo leping" — tüüp (üüri/töö) valitakse wizardi esimesel sammul.
   Sama mootor: mõlemad vertikaalid läbivad osapool → ese → tingimused → mustand. */
function lwizDefaults() {
  return { step: 0, tyyp: null, client: null, space: null, years: 5,
    algus: "2026-08-01", otstarve: "Büroo, lao- ja tootmispind", risk: false,
    tl: { isik: "", epost: "", amet: null, algus: "2026-09-01", katseaeg: 4, tasu: null } };
}
let LWIZ = lwizDefaults();

function addYearsISO(iso, y) {
  const p = iso.split("-").map(Number);
  const d = new Date(p[0] + y, p[1] - 1, p[2]); d.setDate(d.getDate() - 1);
  return d;
}
function fmtEE(d) { return String(d.getDate()).padStart(2,"0") + "." + String(d.getMonth()+1).padStart(2,"0") + "." + d.getFullYear(); }
function isoToEE(iso) { const p = iso.split("-"); return `${p[2]}.${p[1]}.${p[0]}`; }

View.lepingUus = () => {
  LWIZ = lwizDefaults();
  return `<div class="view"><a class="btn btn-ghost btn-sm" href="#/lepingud" style="margin-bottom:18px">${I.back} Katkesta</a>
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
      <button class="ltyp reveal" data-ltyyp="yyri" style="--tint:var(--violet-soft)">
        <span class="ic" style="background:var(--violet-soft);color:var(--violet)">${I.lease}</span>
        <div class="t">Üürileping</div>
        <div class="s">Ärikinnisvara vertikaal — pind kannab tehinguandmed, klauslipõhi on äriruumide üürileping.</div>
        <div class="chips"><span class="tag">ese: pind</span><span class="tag">Lisa 1–2 automaatselt</span><span class="tag">indekseerimine</span></div>
        <span class="arr">${I.arrow}</span>
      </button>
      <button class="ltyp reveal" data-ltyyp="too" style="--tint:var(--green-soft)">
        <span class="ic" style="background:var(--green-soft);color:var(--green)">${I.user}</span>
        <div class="t">Tööleping</div>
        <div class="s">Personali vertikaal — ametikoht kannab tehinguandmed, klauslipõhi on tööleping (TLS).</div>
        <div class="chips"><span class="tag">ese: ametikoht</span><span class="tag">katseaeg</span><span class="tag">palgaülevaatus</span></div>
        <span class="arr">${I.arrow}</span>
      </button>
      <button class="ltyp soon reveal" data-ltyyp="gen" style="--tint:var(--accent-soft)">
        <span class="ic" style="background:var(--accent-soft);color:var(--accent-deep)">${I.spark}</span>
        <div class="t">Lepingugeneraator</div>
        <div class="s">AI koostab mustandi vabas vormis kirjeldusest — mall, tehingufaktid ja eritingimused ühe viibaga.</div>
        <div class="chips"><span class="tag">AI-mustand</span><span class="tag">vaba sisend</span></div>
        <span class="soon-tag">Tulekul</span>
      </button>
    </div>
    <div class="muted" style="margin-top:14px;font-size:12px;text-align:center">Sama mootor ja olekumasin mõlemal — erinevus on ese ja klauslipõhi. Hinnapakkumine elab eraldi „+ Loo" menüüs.</div>`;
  } else if (LWIZ.tyyp === "too") {
    body = tlWizBody();
  } else if (LWIZ.step === 1) {
    body = `<div class="card pad">
      <div class="field"><label>Üürniku nimi või registrikood</label>
        <div class="clsearch">${I.search}<input id="lcl-input" placeholder="nt Future Invest OÜ või 14258963" value="${LWIZ.client?LWIZ.client.nimi:''}" autocomplete="off"/></div></div>
      <div id="lcl-suggest" style="margin-top:14px"></div>
    </div>`;
  } else if (LWIZ.step === 2) {
    const free = SPACES.filter(s => ["Vaba","Pakkumusel"].includes(s.staatus));
    body = `<div class="card pad">
      <div class="between" style="margin-bottom:10px">
        <div><div class="overline">Üürnik</div><div style="font-weight:700;font-size:16px">${LWIZ.client.nimi}</div></div>
        ${pill(LWIZ.client.risk.skoor)}
      </div>
      <div class="overline" style="margin:14px 0 10px">Vali pind (leping = 1 pind) · ${multiObj() ? OBJEKTID.map(o=>o.nimi).join(" · ") : OBJEKT.nimi}</div>
      ${free.length ? free.map(s => { const sel = LWIZ.space === s.id;
        return `<div class="pick ${sel?'sel':''}" data-lsp="${s.id}">
          <div class="box">${I.check}</div>
          <div style="flex:1"><div style="font-weight:600"><span class="mono">${s.nimi}</span> · ${s.tyyp}${multiObj()?` <span class="tag" style="margin-left:6px">${objektOf(s).nimi}</span>`:""}</div>
            <div class="muted mono" style="font-size:12px">${eur(s.yyripind,1)} m² · ${eur(s.hind)} €/m²${s.parkimine?` · ${s.parkimine} parkimiskohta`:""}${s.elekter?` · ${s.elekter} A`:""}</div></div>
          <div class="mono" style="font-weight:700;text-align:right">${eur(rent(s))} €<div class="muted" style="font-size:11px;font-weight:500">üür / kuus</div></div>
        </div>`; }).join("") : occupiedSpacesNote()}
      <div class="muted" style="margin-top:10px;font-size:12px">Pinnaga tuleb automaatselt kaasa Lisa 1 (pinnaplaan) ja Lisa 2 (asendiplaan + parkimisskeem).</div>
      <div class="wrap-actions" style="margin-top:18px;justify-content:space-between"><button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
        <button class="btn btn-primary" id="lw-next" ${LWIZ.space?'':'disabled'} style="${LWIZ.space?'':'opacity:.5;pointer-events:none'}">Põhitingimused ${I.arrow}</button></div>
    </div>`;
  } else if (LWIZ.step === 3) {
    const sp = DB.spaceById(LWIZ.space);
    const kuusYyr = rent(sp);
    body = `<div class="split" style="align-items:start">
      <div class="card pad">
        <div class="overline" style="margin-bottom:14px">Põhitingimused · eeltäidetud mallist ja pinna andmetest</div>
        <div class="grid g2">
          <div class="field"><label>Üleandmispäev (p 2.3)</label><input type="date" id="lw-algus" value="${LWIZ.algus}"/></div>
          <div class="field"><label>Tähtaeg (p 5.1)</label><select id="lw-years">
            ${[1,3,5,10].map(y=>`<option value="${y}" ${LWIZ.years===y?'selected':''}>${y} aastat</option>`).join("")}</select></div>
        </div>
        <!-- kasutusotstarve tuleb mallist ja indekseerimine üldtingimustest (p 5.2) —
             mõlemad on mustandis muudetavad (fakt lauses / indekseerimise külgkaart) -->
        <div class="muted" style="font-size:11.5px;margin-top:4px">Kasutusotstarve ja indekseerimine (üld p 5.2 standard) tulevad mallist — vajadusel muudad neid mustandis.</div>
        <div class="wrap-actions" style="margin-top:18px;justify-content:space-between"><button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
          <button class="btn btn-accent" id="lw-finish">${I.check} Loo mustand V1</button></div>
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
      <div class="muted" style="font-size:12px;margin-top:6px">Kandidaat toimetab e-postile saadetud lingi kaudu ilma kontota — konto tekib allkirjastamisel. Sama muster nagu hinnapakkumise jagamislink.</div>
      <div class="wrap-actions" style="margin-top:18px;justify-content:space-between">
        <button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
        <button class="btn btn-primary" id="tl-next1">Ametikoht ${I.arrow}</button>
      </div>
    </div>`;
  }
  if (LWIZ.step === 2) {
    const vabad = AMETIKOHAD.filter(a => ametikohtHoive(a) < a.kvoot);
    const taidetud = AMETIKOHAD.filter(a => ametikohtHoive(a) >= a.kvoot);
    return `<div class="card pad">
      <div class="between" style="margin-bottom:10px">
        <div><div class="overline">Kandidaat</div><div style="font-weight:700;font-size:16px">${LWIZ.tl.isik}</div></div>
      </div>
      <div class="overline" style="margin:14px 0 10px">Vali ametikoht (leping = 1 ametikoht) · osakond ${OSAKOND.nimi}</div>
      ${vabad.length ? vabad.map(a => { const sel = LWIZ.tl.amet && LWIZ.tl.amet.id === a.id; const h = ametikohtHoive(a);
        return `<div class="pick ${sel?'sel':''}" data-tlamet="${a.id}">
          <div class="box">${I.check}</div>
          <div style="flex:1"><div style="font-weight:600">${a.nimi}</div>
            <div class="muted" style="font-size:12px">${a.ylesanded}</div></div>
          <div style="text-align:right"><div class="mono" style="font-weight:700">${eur(a.tasu,0)} €</div>
            <div class="muted" style="font-size:11px">bruto / kuus · hõive ${h}/${a.kvoot}</div></div>
        </div>`; }).join("") : `
        <div class="note" style="margin-bottom:12px">${I.info}<div>Vabu ametikohti pole — kvoot on täidetud. Lisa ametikoht esemeregistris (osakond on samasugune konteiner nagu hoone).</div></div>
        ${taidetud.map(a => `<div class="pick off">
          <div style="flex:1"><div style="font-weight:600">${a.nimi}</div>
            <div class="muted" style="font-size:12px">hõive ${ametikohtHoive(a)}/${a.kvoot}</div></div>
          ${pill("Täidetud")}
        </div>`).join("")}`}
      <div class="wrap-actions" style="margin-top:18px;justify-content:space-between">
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
        <div class="overline" style="margin-bottom:14px">Tingimused · eeltäidetud ametikohalt (ese kannab andmed)</div>
        <div class="grid g2">
          <div class="field"><label>Tööle asumine</label><input type="date" id="tl-algus" value="${LWIZ.tl.algus}"/></div>
          <div class="field"><label>Katseaeg (TLS § 86)</label><select id="tl-katseaeg">
            ${[[4,"4 kuud · standard"],[6,"6 kuud"],[0,"Ilma katseajata"]].map(([v,t])=>`<option value="${v}" ${LWIZ.tl.katseaeg===v?'selected':''}>${t}</option>`).join("")}</select></div>
        </div>
        <div class="field"><label>Töötasu (bruto, € kuus)</label><input type="number" id="tl-tasu" value="${tasu}"/></div>
        <div class="muted" style="font-size:12px;margin-top:6px">Tähtaeg: tähtajatu (standard). Palgaülevaatus tekib võtmekuupäevana automaatselt — kord aastas.</div>
        <div class="wrap-actions" style="margin-top:18px;justify-content:space-between"><button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
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
    <div style="font-weight:700;font-size:18px;margin:6px 0 2px">${LWIZ.tl.isik} · ${a.nimi}</div>
    <div class="muted" style="font-size:13px">${isoToEE(LWIZ.tl.algus)} · tähtajatu · ${LWIZ.tl.katseaeg?`katseaeg ${LWIZ.tl.katseaeg} kuud`:"ilma katseajata"}</div>
    <div class="divline"></div>
    <dl class="kv">
      <dt>Töötasu</dt><dd class="mono">${eur(LWIZ.tl.tasu != null ? LWIZ.tl.tasu : a.tasu,0)} € kuus (bruto)</dd>
      <dt>Katseaja lõpp</dt><dd class="mono">${LWIZ.tl.katseaeg?fmtEE(tlKatEnd()):"—"}</dd>
      <dt>Palgaülevaatus</dt><dd class="mono">${fmtEE(tlPalgaYlev())}</dd>
      <dt>Lisad</dt><dd>Lisa 1 ametijuhend (${a.nimi.toLowerCase()})</dd>
    </dl>
    <div class="muted" style="margin-top:14px;font-size:12px">Mustand genereeritakse struktureeritult: üldtingimused töölepingu mallist (lukus) + põhitingimused ametikohalt ja sisestustest. TÖR-kanne — post-MVP adapter.</div>
    <div class="wrap-actions" style="margin-top:20px"><button class="btn btn-ghost" id="lw-back">${I.back} Tagasi</button>
      <button class="btn btn-accent" id="lw-finish">${I.check} Loo mustand V1</button></div>
  </div>`;
}

function createTLFromWizard() {
  const a = LWIZ.tl.amet;
  const tasu = LWIZ.tl.tasu != null ? LWIZ.tl.tasu : a.tasu;
  const num = Math.max(0, ...TLEPINGUD.map(x => +x.id.split("-")[2] || 0)) + 1;
  const id = "TL-2026-" + String(num).padStart(3, "0");
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
  AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Tööleping ${id} (Mustand V1) loodud otse (ilma pakkumuseta) — kandidaat ${LWIZ.tl.isik}, ametikoht ${a.nimi}.` });
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
    <div style="flex:1"><div style="font-weight:600"><span class="mono">${s.nimi}</span> · ${s.tyyp}${multiObj()?` <span class="tag" style="margin-left:6px">${objektOf(s).nimi}</span>`:""}</div>
      <div class="muted mono" style="font-size:12px">${eur(s.yyripind,1)} m²${s.tenant?` · ${s.tenant}`:""}</div></div>
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
  const id = "LEP-2026-" + String(num).padStart(3, "0");
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
      { nr: 1, nimi: `Pinnaplaan (${sp.nimi})`, fail: objektOf(sp).failid.pinnaplaan || "— lisamata —" },
      { nr: 2, nimi: "Asendiplaan + parkimisskeem", fail: objektOf(sp).failid.parkimine || "— lisamata —" },
      { nr: 3, nimi: "Eritingimused", fail: "— genereeritud —" },
    ],
    allkirjad: [],
  };
  LEASES.push(lease);
  sp.staatus = "Lepingus"; sp.tenant = c.nimi;
  AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Lepingu mustand ${id} loodud otse (ilma pakkumuseta) (${c.nimi} · ${sp.nimi}).` });
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
    ${cid?`<a class="btn btn-ghost btn-sm reveal" href="#/pakkumus/PAK-2026-014" style="margin-bottom:18px">${I.back} Tagasi</a>`:""}
    <div class="page-head reveal"><div><div class="overline">Riskiraport</div>
      <h1 class="page-h1" style="margin-top:8px">${c.nimi}</h1>
      <p class="page-sub mono" style="font-size:12px">${c.registrikood} · päring ${c.risk.kuupaev}</p></div>
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
          <div class="muted" id="risk-empty" style="display:none;padding:14px 18px;font-size:12.5px">Vastet ei leitud.</div>
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
          <div class="gauge" style="flex-direction:column;align-items:center;text-align:center;gap:14px">
            <div class="ring" style="width:140px;height:140px;background:conic-gradient(${cssCol} ${pct}%, var(--paper-2) 0)">
              <div class="inner" style="width:108px;height:108px"><div><div class="sc" style="font-size:22px;color:${cssCol}">${c.risk.skoor}</div><div class="lb">KOONDSKOOR</div></div></div>
            </div>
            <div class="muted" style="font-size:13px">Krediidiinfo · Inforegister · Kohtutäitur · Äriregister</div>
          </div>
          <div class="divline"></div>
          <div class="muted" style="font-size:12px;text-align:center">Raport on nõuandev — lõpliku otsuse teeb operaator.</div>
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
    <div class="pf-views" id="kal-tyybid">
      <button class="pf-view on" data-kt="">Kõik</button>
      ${Object.entries(KTYYP_LBL).map(([k, t]) => `<button class="pf-view" data-kt="${k}">${t}</button>`).join("")}
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
      <div class="sec-h" style="margin:22px 0 10px"><h2 style="font-size:15px">${g.see ? "See nädal" : "Nädal"}</h2><span class="meta">${g.lbl}${g.see ? " · täna " + TODAY_EE : ""}</span></div>
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
            <div class="flex" style="gap:8px;flex-wrap:wrap"><b style="font-size:13.5px">${k.tyyp}</b><span class="tag">${k.objekt}</span></div>
            <div class="muted" style="font-size:12px;margin-top:3px">
              ${calc ? `${eur(calc.vana,0)} € → <b style="color:var(--ink)">${eur(calc.uus,0)} €</b> (+${calc.pctTxt}%) · ${calc.meetod} ${pill("rakendub automaatselt","accent")}` : k.info}
            </div>
          </div>
          ${ref ? `<a class="btn btn-ghost btn-sm" href="${ref.href}" onclick="event.stopPropagation()">${verb}</a>` : `<span class="muted mono" style="font-size:10.5px">${d} p</span>`}
        </div>`; }).join("")}
      </div>
    </div>`).join("") + `<div class="muted reveal" id="kal-tyhi" style="display:none;padding:26px;text-align:center;font-size:13px">Selle filtriga sündmusi pole.</div>`;
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
      <div class="between" style="margin-bottom:14px">
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
  let detail = `<div style="font-size:13px;line-height:1.6">${k.info}</div>`;
  let extra = "";
  if (kt === "indekseerimine") {
    const c = kdIndexCalc(k);
    if (c) detail = `
      <div style="background:var(--surface-soft);border-radius:12px;padding:6px 14px">
        <div class="price-row"><span class="lbl">Vana üür</span><span class="calc">${c.meetod}</span><span class="amt mono">${eur(c.vana)} €</span></div>
        <div class="price-row"><span class="lbl">Uus üür</span><span class="calc">+${c.pctTxt}%</span><span class="amt mono" style="color:var(--accent-deep)">${eur(c.uus)} €</span></div>
      </div>
      <div class="muted" style="font-size:12px;margin-top:10px">Indeksi väärtus: ${c.idx}.</div>
      <div style="margin-top:10px">${pill("rakendub automaatselt","accent")}</div>
      <div class="muted" style="font-size:11.5px;margin-top:10px">Korraline indekseerimine ei nõua lepingu muudatust — uut lisa ega allkirjastamist ei teki. Rakendumisel: kanne audit trail'i + teavitus mõlemale poolele.</div>`;
    extra = ref && ref.kind === "lease"
      ? `<button class="btn btn-ghost btn-sm" onclick="closeKal();location.hash='${ref.href}';toast('Erikokkulepe (nt vahelejätt) vormistatakse muudatusena: uus lisa nr → kinnitus → aktsept → allkirjastamine (etapp 08)')">${I.edit} Vormista erandina muudatus</button>`
      : `<div class="muted" style="font-size:11.5px">Imporditud leping — muudatusi platvormis ei vormistata (originaal on tõde).</div>`;
  } else if (kt === "loppemine") {
    const teavitus = d > 90 ? `Teavitus plaanis ${d - 90} päeva pärast (90 p enne lõppu, operaator + klient).`
      : `Teavitus saadetud — operaatorile ja kliendile (90 p reegel).`;
    detail += `<div class="divline"></div><div class="overline" style="margin-bottom:6px">90-päevase teavituse seis</div>
      <div class="flex" style="gap:8px;align-items:flex-start">${d > 90 ? pill("Plaanis", "grey") : pill("Saadetud", "green")}<span class="muted" style="font-size:12px">${teavitus}</span></div>`;
    extra = ref ? (ref.kind === "lease"
      ? `<button class="btn btn-ghost btn-sm" onclick="closeKal();location.hash='${ref.href}';toast('Muudatus: uus lisa nr → kinnitus → aktsept → allkirjastamine (etapp 08)')">${I.edit} Alusta muudatust</button>`
      : `<div class="muted" style="font-size:11.5px">Imporditud leping — muudatusi platvormis ei vormistata (originaal on tõde).</div>`) : "";
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
      <div class="flex" style="gap:10px;margin-bottom:14px"><span class="kd-ic lg ${c.ki.cls}">${c.ki.ic}</span>
        <div><div class="overline">${k.tyyp}</div>
        <div style="font-weight:700;font-size:15px;margin-top:2px">${k.objekt}</div>
        <div class="muted mono" style="font-size:11px;margin-top:2px">${k.kuupaev.split("-").reverse().join(".")} · ${c.d} päeva pärast</div></div></div>
      ${c.detail}
      ${c.extra ? `<div class="divline"></div>${c.extra}` : ""}
      <div class="wrap-actions" style="margin-top:16px">
        ${c.ref ? `<a class="btn btn-accent" style="flex:1;justify-content:center" href="${c.ref.href}" onclick="closeKal()">${I.arrow} Ava ${c.ref.kind === "offer" ? "pakkumus" : c.ref.kind === "tl" ? "tööleping" : "leping"}</a>` : ""}
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
        <div class="muted mono" style="font-size:11px">${o.id} · ${o.pikkusKuud} kuud · kehtib kuni ${o.kehtivKuni}${d>=0&&d<=7?` (${d} p)`:""}</div></td>
      <td>${pill(o.staatus)}</td>
      <td class="r mono">${eur(t.rentSum,0)} €</td></tr>`; };

  const leaseRow = (l) => { const sp = DB.spaceById(l.spaceId);
    const n = (l.kommentaarid||[]).filter(x=>x.staatus==="Ootel").length;
    return `<tr class="clickable" onclick="location.hash='#/leping/${l.id}'">
      <td><div style="font-weight:600">${sp.nimi} · ${objektOf(sp).nimi}</div>
        <div class="muted mono" style="font-size:11px">${l.id} · ${l.algus} – ${l.lopp}${n?` · ${n} kommentaari ootel`:""}</div>
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
        <div class="greet" style="margin-top:6px">Tere, ${eesnimi}. <span class="accent-word">Teie dokumendid.</span></div>
      </div>
      <div class="field" style="margin:0"><select id="persona-pick" style="padding:8px 12px;font-size:13px">
        ${demoable.map(x=>`<option value="${x.id}" ${x.id===c.id?'selected':''}>${x.nimi}</option>`).join("")}</select></div>
    </div>

    <div class="grid" style="gap:18px">
      <div class="card reveal">
        <div class="card-h"><h3>Hinnapakkumised</h3><span class="overline">${offers.length} tk</span></div>
        <table class="tbl"><tbody>
          ${offers.length ? offers.map(offerRow).join("") : `<tr><td class="muted" style="padding:18px">Pakkumusi pole.</td></tr>`}
        </tbody></table>
      </div>
      <div class="card reveal">
        <div class="card-h"><h3>Minu lepingud</h3><span class="overline">${leases.length} tk</span></div>
        <table class="tbl"><tbody>
          ${leases.length ? leases.map(leaseRow).join("") : `<tr><td class="muted" style="padding:18px">Lepinguid pole.</td></tr>`}
        </tbody></table>
      </div>
      <div class="card reveal">
        <div class="card-h"><h3>Tähtajad</h3><span class="overline">${tahtajad.length} tk</span></div>
        ${tahtajad.length ? tahtajad.map(k => `
        <div class="flex" style="gap:12px;padding:10px 18px;border-top:1px solid var(--line)">
          <span class="mono" style="flex:none;font-size:12px;font-weight:600">${k.d}</span>
          <div style="min-width:0"><b style="font-size:13px">${k.t}</b>
            <div class="muted" style="font-size:11px">${k.s}</div></div>
        </div>`).join("") : `<div class="muted" style="padding:18px;font-size:12.5px">Tähtaegu pole — need tekivad allkirjastatud lepingust.</div>`}
        <div class="muted" style="padding:10px 18px 14px;font-size:11px;border-top:1px solid var(--line)">Kõik teavitused saadetakse ka meilile: <span class="mono">${(c.konto && c.konto.epost) || c.epost}</span></div>
      </div>
      <div class="card reveal suh-thread" style="min-height:320px;max-height:430px">
        <div class="suh-head">
          <div style="flex:1;min-width:0"><b style="font-size:14px">Vestlus üürileandjaga</b>
            <div class="muted" style="font-size:11px;margin-top:2px">${conv ? "punktikommentaarid + vabavestlus samas voos" : "vestlus algab dokumendist"}</div></div>
          ${minuTh.length > 1 ? `<select id="po-doc" style="padding:6px 10px;font-size:12px">
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
          <div class="muted" style="font-size:10.5px;margin-top:7px">Vastab üürileandja meeskond — sõnum jõuab ka meilile. Kogu suhtlus logitakse dokumendi juurde.</div>
        </div>` : `<div class="empty" style="padding:30px"><div>Vestlusi pole veel.</div></div>`}
      </div>
      <div class="card pad reveal">
        <div class="overline" style="margin-bottom:10px">Üürileandja kontakt</div>
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
    conv.doc.vestlus.push({ who: "client", autor: c.kontakt + " (üürnik)", aeg: TODAY_EE + " 11:0" + (conv.doc.vestlus.length % 10), tekst: v });
    AUDIT.unshift({ aeg: TODAY_EE, autor: c.kontakt + " (üürnik)", tegevus: `${conv.id}: kliendi sõnum (CommunicationThread) — ilmub operaatori Suhtlusesse vastamata.` });
    DB.save(); toast("Saadetud üürileandjale — vastus tuleb ka meilile"); router();
  };
  const sb2 = document.getElementById("po-send");
  if (sb2) sb2.onclick = send;
  if (inp) inp.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
};

/* objektikaart (jagatud: Ülevaade + Portfell › Esemed): täituvusriba, vabad, €/kuu, järgmine tähtaeg */
/* üksiku objektiga ettevõttel täidab rea teise poole „Lisa objekt" kutse */
function objAddCard() {
  return `
  <a class="obj-add reveal" href="#/register" onclick="toast('Uus objekt: EHR autotäide + pindade CSV-import — demos illustratiivne')">
    <span class="oa-ic">${I.plus}</span>
    <div><div class="t">Lisa objekt</div>
    <div class="s">EHR autotäide · pindade CSV-import</div></div>
  </a>`;
}

function objMiniCard(o) {
  const dIso = (iso) => Math.ceil((new Date(iso) - DEMO_TODAY) / 86400000);
  const sp = SPACES.filter(s => objektOf(s).id === o.id);
  const m2 = sp.reduce((s,x) => s + x.yyripind, 0);
  const om2 = sp.filter(s => ["Üüritud","Lepingus"].includes(s.staatus)).reduce((s,x) => s + x.yyripind, 0);
  const opct = m2 ? Math.round(om2 / m2 * 100) : 0;
  const vaba = sp.filter(s => s.staatus === "Vaba");
  const vabaM2 = vaba.reduce((s,x) => s + x.yyripind, 0);
  const orent = sp.filter(s => ["Üüritud","Lepingus"].includes(s.staatus)).reduce((s,x) => s + rent(x), 0);
  const nextKd = KEY_DATES.map(k => ({ k, d: dIso(k.kuupaev) })).filter(x => x.d >= 0)
    .sort((a,b) => a.d - b.d)
    .find(x => sp.some(s => s.tenant && x.k.objekt.includes(s.tenant)));
  return `
  <a class="card pad obj-mini reveal" href="#/objekt/${o.id}">
    <div class="between" style="margin-bottom:10px">
      <div style="font-weight:700;font-size:15.5px">${o.nimi}</div>
      <span class="mono" style="font-size:13px;font-weight:600">${opct}%</span>
    </div>
    <div class="bar" style="margin-bottom:14px"><i style="width:${opct}%"></i></div>
    <dl class="kv" style="gap:7px 14px">
      <dt>Vabu pindu</dt><dd class="mono">${vaba.length} tk · ${eur(vabaM2,0)} m²</dd>
      <dt>Üüritulu</dt><dd class="mono">${eur(orent,0)} € / kuu</dd>
      <dt>Järgmine tähtaeg</dt><dd class="mono">${nextKd ? fmtShort(nextKd.k.kuupaev) + " · " + nextKd.k.tyyp : "—"}</dd>
    </dl>
  </a>`;
}

/* ---------- Ülevaade: „Kuidas meil läheb?" (juhi/CFO kokpit) ----------------
   1) 4 meetrikakaarti  2) objektikaardid  3) pipeline-read (klikitavad faasid)
   4) personaliplokk  5) Ekspordi (3 valmisaruannet) */
View.ylevaade = () => {
  const dIso = (iso) => Math.ceil((new Date(iso) - DEMO_TODAY) / 86400000);
  /* meetrikad */
  const occ = SPACES.filter(s => ["Üüritud","Lepingus"].includes(s.staatus));
  const m2All = SPACES.reduce((s,x) => s + x.yyripind, 0);
  const pct = Math.round(occ.reduce((s,x) => s + x.yyripind, 0) / m2All * 100);
  const rentOcc = occ.reduce((s,x) => s + rent(x), 0);
  const aktiivsed = LEASES.filter(l => l.staatus === "Kehtiv").length + TLEPINGUD.filter(t => t.staatus === "Kehtiv").length + IMPORDITUD.length;
  const t90 = KEY_DATES.filter(k => { const d = dIso(k.kuupaev); return d >= 0 && d <= 90; }).length;
  /* pipeline-loendurid */
  const pc = (sts) => OFFERS.filter(o => sts.includes(o.staatus)).length;
  const lc = (sts) => LEASES.filter(l => sts.includes(l.staatus)).length + TLEPINGUD.filter(t => sts.includes(t.staatus)).length;
  /* personal */
  const kvoot = AMETIKOHAD.reduce((s,a) => s + a.kvoot, 0);
  const taidetud = AMETIKOHAD.reduce((s,a) => s + ametikohtHoive(a), 0);
  const katseajad = TLEPINGUD.filter(t => t.staatus === "Kehtiv" && daysUntil(String(t.katseaegLopp).slice(0,10)) >= 0);
  const palgad = TLEPINGUD.filter(t => t.staatus === "Kehtiv" && t.palgaylevaatus);

  const pstep = (n, t, href) => `<a class="pipe-step ${n ? "" : "zero"}" href="${href}"><b class="mono">${n}</b>${t}</a>`;

  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Ülevaade</h1></div>
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
      <a class="card pad met" href="#/register"><div class="l">Täituvus</div><div class="n mono">${pct}<small>%</small></div><div class="s">üüripinnast hõives</div></a>
      <a class="card pad met" href="#/lepingud"><div class="l">Üüritulu</div><div class="n mono">${eur(rentOcc,0)}<small>€/kuu</small></div><div class="s">aktiivsete summa (neto)</div></a>
      <a class="card pad met" href="#/lepingud"><div class="l">Aktiivsed lepingud</div><div class="n mono">${aktiivsed}<small>tk</small></div><div class="s">kehtivad · sh imporditud</div></a>
      <a class="card pad met" href="#/kalender"><div class="l">Tähtaegu 90 päeva sees</div><div class="n mono">${t90}<small>tk</small></div><div class="s">võtmekuupäevad</div></a>
    </div>

    ${taituvusCard()}

    <!-- 2) objektikaardid -->
    <div class="sec-h reveal" style="margin-top:6px"><h2>Objektid</h2><span class="meta">klõps avab objektivaate</span></div>
    <div class="grid g2" style="gap:16px;margin-bottom:26px">
      ${OBJEKTID.map(objMiniCard).join("")}
      ${OBJEKTID.length === 1 ? objAddCard() : ""}
    </div>

    <!-- 3) pipeline-read: iga faasi number on klikitav filter -->
    <div class="sec-h reveal"><h2>Pipeline</h2><span class="meta">faasi number avab filtreeritud loendi</span></div>
    <div class="card pad reveal" style="margin-bottom:26px">
      <div class="pipe">
        <span class="pipe-lbl">Pakkumused</span>
        ${pstep(pc(["Mustand"]), "Mustand", "#/pakkumised/mustand")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(pc(["Saadetud"]), "Saadetud", "#/pakkumised/saadetud")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(pc(["Kliendi ettepanek"]), "Läbirääkimisel", "#/pakkumised/labiraakimisel")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(pc(["Aktsepteeritud","Lepinguks teisendatud"]), "Aktsepteeritud", "#/pakkumised/aktsepteeritud")}
      </div>
      <div class="pipe" style="border-top:1px solid var(--line);margin-top:10px;padding-top:12px">
        <span class="pipe-lbl">Lepingud</span>
        ${pstep(lc(["Mustand V1"]), "Mustand", "#/lepingud/mustand")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(lc(["Saadetud"]), "Läbirääkimisel", "#/lepingud/labiraakimisel")}<span class="pipe-arr">${I.arrow}</span>
        ${pstep(lc(["Allkirjastamisel"]), "Allkirjastamisel", "#/lepingud/allkirjastamisel")}
      </div>
    </div>

    <!-- 4) personaliplokk (töölepingute vertikaaliga) -->
    ${AMETIKOHAD.length ? `
    <div class="sec-h reveal"><h2>Personal</h2><span class="meta">töölepingute vertikaal · osakond ${OSAKOND.nimi}</span></div>
    <div class="met-grid reveal" style="grid-template-columns:repeat(3,1fr)">
      <a class="card pad met" href="#/register"><div class="l">Ametikohad</div><div class="n mono">${taidetud}<small>/${kvoot} täidetud</small></div><div class="s">${kvoot - taidetud ? (kvoot - taidetud) + " vaba kohta" : "kõik täidetud"}</div></a>
      <a class="card pad met" href="#/kalender"><div class="l">Katseajad</div><div class="n mono">${katseajad.length}<small>käimas</small></div><div class="s">${katseajad.length ? "järgmine lõpeb " + katseajad.map(t=>t.katseaegLopp).sort()[0] : "—"}</div></a>
      <a class="card pad met" href="#/kalender"><div class="l">Palgaülevaatused</div><div class="n mono">${palgad.length}<small>kokku lepitud</small></div><div class="s">${palgad.length ? "järgmine " + palgad.map(t=>t.palgaylevaatus).sort((a,b)=>parseEE(a)-parseEE(b))[0] : "—"}</div></a>
    </div>` : ""}
  </div>`;
};
View.ylevaade.init = () => {
  const eb = document.getElementById("exp-btn"), ep = document.getElementById("exp-pop");
  if (eb && ep) eb.onclick = (e) => { if (e && e.stopPropagation) e.stopPropagation(); ep.classList.toggle("open"); };
};

/* ---------- Portfell: 3 tabi — Lepingud · Kliendid · Esemed ----------------- */
let PF_ROWS = []; /* viimati renderdatud lepinguread (külgpaneeli eelvaateks) */

function pfLepinguRows() {
  const rows = [];
  LEASES.forEach(l => { const cl = DB.clientById(l.clientId); const sp = DB.spaceById(l.spaceId);
    const tag = (l.pohi || []).find(p => p.ref.startsWith("Tagatisraha"));
    rows.push({ kind: "lease", id: l.id, klient: cl.nimi, ese: `${sp.nimi} · ${objektOf(sp).nimi}`, tyyp: "Üürileping",
      kuus: rent(sp), algus: l.algus, lopp: l.lopp, olek: l.staatus, imp: false, href: "#/leping/" + l.id,
      tagatis: tag ? tag.vaartus.split(" (")[0] : null, m2hind: sp.hind,
      kontakt: { nimi: cl.kontakt, epost: cl.epost, tel: cl.tel }, indeks: l.indeks, l }); });
  TLEPINGUD.forEach(t => { const a = DB.ametikohtById(t.ametikohtId);
    rows.push({ kind: "tl", id: t.id, klient: t.isik, ese: `${a.nimi} · ${OSAKOND.nimi}`, tyyp: "Tööleping",
      kuus: a.tasu, algus: t.algus, lopp: t.tahtaeg === "Tähtajatu" ? "tähtajatu" : t.tahtaeg, olek: t.staatus, imp: false, href: "#/tooleping/" + t.id, t }); });
  IMPORDITUD.forEach(x => {
    const per = (x.parameetrid.find(p => p[0] === "Periood") || [])[1] || "";
    const mm = per.replace(/\s*\(.*\)/, "").split(" – ");
    const sum = (x.parameetrid.find(p => ["Üür", "Tasu"].includes(p[0])) || [])[1] || "";
    const num = parseFloat(String(sum).replace(/[^\d,\.]/g, "").replace(",", ".")) || null;
    const tagP = x.parameetrid.find(p => p[0] === "Tagatisraha");
    const impSp = x.liik === "Üürileping" ? SPACES.find(s => s.tenant === x.pool) : null;
    rows.push({ kind: "imp", id: x.id, klient: x.pool, ese: x.ese, tyyp: x.liik,
      kuus: num, algus: mm[0] || "—", lopp: mm[1] || "—", olek: "Kehtiv", imp: true, href: "#/imp/" + x.id,
      tagatis: tagP ? tagP[1].split(" (")[0] : null, m2hind: impSp ? impSp.hind : null,
      indeksTxt: (x.parameetrid.find(p => p[0] === "Indekseerimine") || [])[1] || null, x }); });
  return rows;
}
/* tüübifilter: üüri- vs töölepingud (imporditud üürilepingud loevad üüri alla;
   haldus/kindlustus jm imporditud liigid paistavad ainult „Kõik" all) */
const PF_TYPES = {
  koik: { t: "Kõik",         f: () => true },
  yyri: { t: "Üürilepingud", f: r => r.tyyp === "Üürileping" },
  too:  { t: "Töölepingud",  f: r => r.tyyp === "Tööleping" },
};
let PF_TYPE = "koik";
window.pfSetType = (t) => { if (PF_TYPES[t]) PF_TYPE = t; router(); };

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
  const tab = ["lepingud", "kliendid", "esemed"].includes(parts[0]) ? parts[0] : "lepingud";
  const sub = parts[1] || "";
  const tabs = [["lepingud", "Lepingud"], ["kliendid", "Kliendid"], ["esemed", "Esemed"]];

  let body = "";
  if (tab === "lepingud") {
    const vk = PF_VIEWS[sub] ? sub : "aktiivsed";
    PF_ROWS = pfLepinguRows().filter(PF_VIEWS[vk].f).filter(PF_TYPES[PF_TYPE].f);
    /* vaaterežiim: kaardid (vaikimisi) või loend — valik püsib localStorage'is */
    let mode = "cards";
    try { if (localStorage.getItem("thinkone_pf_mode") === "list") mode = "list"; } catch (e) {}
    const tyhi = vk === "arhiiv" ? "Arhiiv on tühi — lõppolekud paistavad ainult siin (nähtavusreegel)." : "Selles vaates lepinguid pole.";
    const cards = `
    <div class="pf-cards reveal">
      ${PF_ROWS.length ? PF_ROWS.map((r, i) => `
      <div class="card pf-card" data-pfrow="${i}">
        <div class="between" style="margin-bottom:10px">
          <span class="tag">${r.tyyp}</span>
          <span style="display:inline-flex;gap:6px">${r.imp ? pill("Imporditud") : ""}${pill(r.olek)}</span>
        </div>
        <div class="t">${r.klient}</div>
        <div class="s">${r.id} · ${r.ese}</div>
        <div class="pf-foot">
          <span class="sum">${r.kuus != null ? eur(r.kuus, 0) + " €" : "—"}${r.kuus != null ? `<small> / kuu</small>` : ""}</span>
          <span class="per">${r.algus === "—" && r.lopp === "—" ? "—" : `${r.algus} – ${r.lopp}`}</span>
        </div>
        ${r.tagatis || r.m2hind != null ? `
        <div class="pf-foot2">
          <span>${r.tagatis ? `Tagatis <b>${r.tagatis}</b>` : ""}</span>
          <span>${r.m2hind != null ? `<b>${eur(r.m2hind, 2)} €/m²</b>` : ""}</span>
        </div>` : ""}
      </div>`).join("") : `<div class="card pad muted" style="grid-column:1/-1;font-size:13px">${tyhi}</div>`}
    </div>`;
    const loend = `
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Klient</th><th>Ese</th><th>Tüüp</th><th class="r">€ / kuu</th><th>Algus</th><th>Lõpp</th><th>Olek</th></tr></thead>
        <tbody>
        ${PF_ROWS.length ? PF_ROWS.map((r, i) => `
          <tr class="clickable" data-pfrow="${i}">
            <td><div style="font-weight:600">${r.klient}</div><div class="muted mono" style="font-size:11px">${r.id}</div></td>
            <td style="font-size:12.5px">${r.ese}</td>
            <td><span class="tag">${r.tyyp}</span>${r.imp ? ` ${pill("Imporditud")}` : ""}</td>
            <td class="r mono">${r.kuus != null ? eur(r.kuus, 0) + " €" : "—"}</td>
            <td class="mono">${r.algus}</td><td class="mono">${r.lopp}</td>
            <td>${pill(r.olek)}</td>
          </tr>`).join("") : `<tr><td class="muted" style="padding:18px" colspan="7">${tyhi}</td></tr>`}
        </tbody>
      </table>
    </div>`;
    body = `
    <div class="pf-toolbar reveal">
      <div class="pf-search">${I.search}<input id="pf-q" placeholder="Filtreeri: klient, ese, tunnus…" autocomplete="off"/></div>
      <div class="pf-views">${Object.entries(PF_TYPES).map(([k, v]) => `<button class="pf-view ${k === PF_TYPE ? "on" : ""}" onclick="pfSetType('${k}')">${v.t}</button>`).join("")}</div>
      <span class="pf-sep"></span>
      <div class="pf-views">${Object.entries(PF_VIEWS).map(([k, v]) => `<a class="pf-view ${k === vk ? "on" : ""}" href="#/portfell/lepingud/${k}">${v.t}</a>`).join("")}</div>
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
            <td><div style="font-weight:600">${c.nimi}</div><div class="muted mono" style="font-size:11px">${c.kontakt}</div></td>
            <td class="mono">${c.registrikood}</td>
            <td class="r mono">${cls.length}</td>
            <td class="r mono">${sum ? eur(sum, 0) + " €" : "—"}</td>
            <td>${pill(c.risk.skoor)}<div class="muted mono" style="font-size:10.5px;margin-top:3px">${c.risk.kuupaev}</div></td>
            <td class="mono" style="font-size:12px">${viimane(c)}</td>
          </tr>`; }).join("")}
        </tbody>
      </table>
    </div>`;
  } else {
    const ek = sub === "ametikohad" ? "ametikohad" : "hooned";
    body = `
    <div class="pf-toolbar reveal">
      <div class="pf-views">
        <a class="pf-view ${ek === "hooned" ? "on" : ""}" href="#/portfell/esemed">Hooned</a>
        <a class="pf-view ${ek === "ametikohad" ? "on" : ""}" href="#/portfell/esemed/ametikohad">Ametikohad</a>
      </div>
      <a class="steplink" href="#/register" style="margin-left:auto">Ava esemeregister →</a>
    </div>
    ${ek === "hooned" ? `
    <div class="grid g2 reveal" style="gap:16px">${OBJEKTID.map(objMiniCard).join("")}</div>
    <div class="muted reveal" style="margin-top:12px;font-size:12px">Klõps kaardil avab objektivaate — hoone andmed (EHR), kõrvalkulu, mallid, pinnad ja import.</div>` : `
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
            <td><div style="font-weight:600">${a.nimi}</div><div class="muted" style="font-size:11.5px">${a.ylesanded}</div></td>
            <td class="r mono">${eur(a.tasu, 0)} €</td>
            <td class="r mono"><b>${h}</b> / ${a.kvoot}</td>
            <td>${pill(olek)}</td></tr>`; }).join("")}
        </tbody>
      </table>
    </div>
    <div class="muted reveal" style="margin-top:12px;font-size:12px">Ametikohad on esemeregistri teine esemetüüp (osakond ${OSAKOND.nimi}) — sama register, tüübifilter.</div>`}`;
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
  const q = document.getElementById("pf-q");
  if (q) q.addEventListener("input", () => {
    const v = q.value.trim().toLowerCase();
    document.querySelectorAll("[data-pfrow],[data-pfrow-k]").forEach(tr => {
      tr.style.display = !v || (tr.textContent || "").toLowerCase().includes(v) ? "" : "none";
    });
    /* filtreerimine sulgeb avatud laienduse — ankurdatud rida võib kaduda */
    const ex = document.querySelector(".pf-expand"); if (ex) ex.remove();
    document.querySelectorAll(".pf-card.open").forEach(c => c.classList.remove("open"));
    document.querySelectorAll(".pf-cards.has-open").forEach(g => g.classList.remove("has-open"));
  });
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
  const facts = [];
  if (r.kind === "tl") {
    if (r.kuus != null) facts.push(["Töötasu", `${eur(r.kuus,0)} € <small>/ kuu (bruto)</small>`]);
    facts.push(["Algus", r.algus]);
    facts.push(["Tähtaeg", r.lopp]);
  } else {
    if (r.kuus != null) facts.push(["Üür", `${eur(r.kuus,0)} € <small>/ kuu</small>`]);
    if (r.m2hind != null) facts.push(["m² hind", `${eur(r.m2hind,2)} € <small>/ m²</small>`]);
    if (r.tagatis) facts.push(["Tagatis", r.tagatis]);
    facts.push(["Periood", r.algus === "—" && r.lopp === "—" ? "—" : `${r.algus} – ${r.lopp}`]);
  }
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
      <div class="between" style="align-items:flex-start">
        <div><div class="overline">${r.tyyp}${r.imp ? " · imporditud" : ""}</div>
          <div style="font-weight:700;font-size:17px;margin-top:4px">${r.klient}</div>
          <div class="muted" style="font-size:12.5px;margin-top:2px">${r.id} · ${r.ese}</div></div>
        <div style="flex:none">${pill(r.olek)}</div>
      </div>
      <div class="pf-facts">${facts.map(f => `<div class="pf-fact"><div class="l">${f[0]}</div><div class="v">${f[1]}</div></div>`).join("")}</div>
      ${strip}
      ${kontakt}
    </div>
    <div class="pf-exp-side">
      <div class="overline" style="margin-bottom:6px">Järgmine samm</div>
      <div style="font-size:13px;line-height:1.6">${samm}</div>
      <div class="wrap-actions" style="margin-top:14px">
        <button class="btn btn-ghost btn-sm" onclick="toast('PDF genereeritud — demos illustratiivne')">${I.file} Laadi PDF</button>
        <button class="btn btn-ghost btn-sm" onclick="toast('Auditikaust (kõik versioonid + suhtlus) eksporditud — demos illustratiivne')">${I.audit} Ekspordi auditikaust</button>
      </div>
      <div class="wrap-actions" style="margin-top:12px">
        <a class="btn btn-accent" href="${r.href}">${I.arrow} Ava</a>
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
    <div class="muted" style="font-size:12.5px;margin-top:2px">${r.id} · ${r.ese}</div>`;
  body.innerHTML = `
    <dl class="kv">
      <dt>Pooled</dt><dd style="font-size:12.5px">${ACCOUNT.landlord.nimi} ⋅ ${r.klient}</dd>
      <dt>Summa</dt><dd class="mono">${r.kuus != null ? eur(r.kuus, 0) + " € / kuu" : "—"}</dd>
      <dt>Periood</dt><dd class="mono">${r.algus} – ${r.lopp}</dd>
      <dt>Olek</dt><dd>${pill(r.olek)}</dd>
    </dl>
    <div class="divline"></div>
    <div class="overline" style="margin-bottom:6px">Järgmine samm</div>
    <div style="font-size:13px;line-height:1.6">${samm}</div>
    <div class="divline"></div>
    <div class="wrap-actions">
      <button class="btn btn-ghost btn-sm" onclick="toast('PDF genereeritud — demos illustratiivne')">${I.file} Laadi PDF</button>
      <button class="btn btn-ghost btn-sm" onclick="toast('Auditikaust (kõik versioonid + suhtlus) eksporditud — demos illustratiivne')">${I.audit} Ekspordi auditikaust</button>
    </div>`;
  foot.innerHTML = `<div class="wrap-actions">
    <a class="btn btn-accent" style="flex:1;justify-content:center" href="${r.href}" onclick="closeSide()">${I.arrow} Ava</a>
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
    <a class="btn btn-ghost btn-sm reveal" href="#/portfell/kliendid" style="margin-bottom:18px">${I.back} Kliendid</a>
    <div class="page-head reveal">
      <div><div class="overline">Klient</div>
        <h1 class="page-h1" style="margin-top:8px">${c.nimi}</h1>
        <p class="page-sub mono" style="font-size:12px">Reg ${c.registrikood} · KMKR ${c.kmkr || "—"} · ${c.aadress} <span class="tag" style="margin-left:6px">e-äriregister</span></p></div>
      <div style="text-align:right">
        ${pill(c.risk.skoor)}<div class="muted mono" style="font-size:10.5px;margin-top:4px">päring ${c.risk.kuupaev}</div>
        <div class="wrap-actions" style="margin-top:12px;justify-content:flex-end">
          <a class="btn btn-ghost btn-sm" href="#/risk/${c.id}">${I.risk} Telli riskiraport</a>
          <button class="btn btn-accent btn-sm" onclick="preOffer('${c.id}')">${I.offer} Loo pakkumine sellele kliendile</button>
        </div>
      </div>
    </div>

    <div class="split">
      <div>
        <div class="sec-h reveal"><h2>Lepingud</h2><span class="meta">${cls.length} tk</span></div>
        <div class="card reveal" style="overflow:hidden;margin-bottom:22px">
          <table class="tbl"><tbody>
          ${cls.length ? cls.map(l => { const sp = DB.spaceById(l.spaceId); return `
            <tr class="clickable" onclick="location.hash='#/leping/${l.id}'">
              <td><b class="mono" style="font-size:12px">${l.id}</b><div class="muted" style="font-size:11.5px">${sp.nimi} · ${l.algus} – ${l.lopp}</div></td>
              <td class="r mono">${eur(rent(sp), 0)} €</td><td class="r">${pill(l.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:16px">Lepinguid pole.</td></tr>`}
          </tbody></table>
        </div>

        <div class="sec-h reveal"><h2>Pakkumused</h2><span class="meta">${offs.length} tk</span></div>
        <div class="card reveal" style="overflow:hidden;margin-bottom:22px">
          <table class="tbl"><tbody>
          ${offs.length ? offs.map(o => { const t = offerTotals(o); return `
            <tr class="clickable" onclick="location.hash='#/pakkumus/${o.id}'">
              <td><b class="mono" style="font-size:12px">${o.id}</b><div class="muted" style="font-size:11.5px">${t.spaces.map(s => s.nimi).join(", ")} · kehtib ${o.kehtivKuni}</div></td>
              <td class="r mono">${eur(t.rentSum, 0)} €</td><td class="r">${pill(o.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:16px">Pakkumusi pole.</td></tr>`}
          </tbody></table>
        </div>

        <div class="sec-h reveal"><h2>Vestlused</h2><span class="meta">punktikommentaarid + ettepanekud</span></div>
        <div class="card pad reveal">
          ${vestlused.length ? vestlused.map(v => `
          <div class="kd-item" style="cursor:pointer" onclick="location.hash='${v.href}'">
            <span class="kd-ic blue">${I.chat}</span>
            <div style="flex:1;min-width:0"><div class="t" style="font-size:12.5px">${v.tekst.length > 90 ? v.tekst.slice(0, 90) + "…" : v.tekst}</div>
              <div class="s">${v.doc} · ${v.aeg}</div></div>
            ${pill(v.staatus)}
          </div>`).join("") : `<div class="muted" style="font-size:12.5px">Suhtlust veel pole.</div>`}
        </div>
      </div>

      <div>
        <div class="card pad reveal">
          <div class="overline" style="margin-bottom:10px">Kontakt</div>
          <dl class="kv">
            <dt>Kontaktisik</dt><dd>${c.kontakt}</dd>
            <dt>E-post</dt><dd class="mono" style="font-size:12px">${c.epost}</dd>
            <dt>Telefon</dt><dd class="mono">${c.tel || "—"}</dd>
          </dl>
        </div>
        <div class="card pad reveal" style="margin-top:18px">
          <div class="between" style="margin-bottom:10px"><div class="overline">Riskiraportid</div><a class="steplink" href="#/risk/${c.id}">Ava →</a></div>
          <div class="kd-item"><span class="kd-ic ${c.risk.skoor === "KÕRGE" ? "amber" : "green"}">${I.shield}</span>
            <div style="flex:1"><div class="t" style="font-size:13px">Koondskoor ${c.risk.skoor}</div><div class="s">Krediidiinfo · Inforegister · Kohtutäitur · Äriregister</div></div>
            <span class="kd-date mono">${c.risk.kuupaev}</span></div>
          <div class="muted" style="font-size:11.5px;margin-top:8px">Ajalugu koguneb iga päringuga — raport on informatiivne, ei blokeeri.</div>
        </div>
        <div class="card pad reveal" style="margin-top:18px">
          <div class="overline" style="margin-bottom:10px">Tähtajad</div>
          ${tahtajad.length ? tahtajad.map(k => { const ki = kdIcon(k.tyyp); return `
          <div class="kd-item"><span class="kd-ic ${ki.cls}">${ki.ic}</span>
            <div style="flex:1;min-width:0"><div class="t">${k.tyyp}</div><div class="s">${k.objekt}</div></div>
            <span class="kd-date mono">${fmtShort(k.kuupaev)}</span></div>`; }).join("") : `<div class="muted" style="font-size:12.5px">Lähiajal tähtaegu pole.</div>`}
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

    <div class="sec-h reveal"><h2>Kliendid</h2><span class="meta">klõpsa real riskiraporti avamiseks</span></div>
    <div class="card reveal" style="overflow:hidden;margin-bottom:26px">
      <table class="tbl">
        <thead><tr><th>Ettevõte</th><th>Kontakt</th><th>Seotud</th><th>Risk</th></tr></thead>
        <tbody>
        ${CLIENTS.map(c => { const nOff = OFFERS.filter(o=>o.clientId===c.id).length; const nLease = LEASES.filter(l=>l.clientId===c.id).length;
          return `<tr class="clickable" onclick="location.hash='#/risk/${c.id}'">
            <td><div style="font-weight:600">${c.nimi}</div><div class="muted mono" style="font-size:11px">${c.registrikood} · ${c.aadress}</div></td>
            <td><div>${c.kontakt}</div><div class="muted mono" style="font-size:11px">${c.epost}${c.tel?` · ${c.tel}`:""}</div></td>
            <td class="mono" style="font-size:12px">${nOff} pakkumust · ${nLease} lepingut</td>
            <td>${pill(c.risk.skoor)}</td></tr>`; }).join("")}
        </tbody>
      </table>
    </div>

    <div class="sec-h reveal"><h2>Töötajad ja kandidaadid</h2><span class="meta">töölepingute vertikaal · klõpsa real lepingu avamiseks</span></div>
    <div class="card reveal" style="overflow:hidden">
      <table class="tbl">
        <thead><tr><th>Isik</th><th>Ametikoht</th><th>Algus</th><th>Olek</th></tr></thead>
        <tbody>
        ${TLEPINGUD.length ? TLEPINGUD.map(t => { const a = DB.ametikohtById(t.ametikohtId);
          return `<tr class="clickable" onclick="location.hash='#/tooleping/${t.id}'">
            <td><div style="font-weight:600">${t.isik}</div><div class="muted mono" style="font-size:11px">${t.id}${t.roll==="kandidaat"?" · kandidaat":""}</div></td>
            <td>${a.nimi}</td><td class="mono">${t.algus}</td>
            <td>${pill(t.staatus)}</td></tr>`; }).join("") : `<tr><td class="muted" style="padding:18px">Töölepinguid pole.</td></tr>`}
        </tbody>
      </table>
    </div>
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
          <div class="pf-search" style="width:100%;box-shadow:none;background:var(--surface-soft)">${I.search}<input id="suh-q" placeholder="Otsi klienti või dokumenti…" autocomplete="off"/></div>
          <div class="pf-views" style="margin-top:10px">
            <button class="pf-view" data-sf="ootel">Vastamata</button>
            <button class="pf-view on" data-sf="">Kõik</button>
          </div>
        </div>
        <div class="suh-list">
          ${th.length ? th.map(x => { const last = x.msgs[x.msgs.length - 1]; return `
          <a class="sl-row ${sel && x.id === sel.id ? "sel" : ""}" href="#/suhtlus/${x.id}" data-sl="${x.pending ? "ootel" : ""}">
            <div style="flex:1;min-width:0">
              <div class="flex" style="gap:7px"><b style="font-size:13px">${x.klient}</b><span class="tag">${x.id}</span></div>
              <div class="sl-last">${last.who === "op" ? "Sina: " : ""}${last.tekst.length > 64 ? last.tekst.slice(0, 64) + "…" : last.tekst}</div>
            </div>
            <div style="text-align:right;flex:none">
              <div class="muted mono" style="font-size:10px">${last.aeg.split(" ")[0]}</div>
              ${x.pending ? `<i class="sl-dot"></i>` : ""}
            </div>
          </a>`; }).join("") : `<div class="muted" style="padding:18px;font-size:12.5px">Vestlusi pole.</div>`}
        </div>
      </div>

      <!-- parem: lõim -->
      ${sel ? `
      <div class="card suh-thread">
        <div class="suh-head">
          <div style="flex:1;min-width:0">
            <div class="flex" style="gap:8px"><b style="font-size:15px">${sel.klient}</b><span class="tag">${sel.docT} · ${sel.id}</span>${sel.pending ? pill("Ootel") : ""}</div>
            <div class="muted" style="font-size:11.5px;margin-top:3px">${sel.kontakt}</div>
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
          <div class="muted" style="font-size:10.5px;margin-top:9px">AI koostab mustandi — toimetad ja saadad ise.</div>
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
      (sel.doc.labiraakimised = sel.doc.labiraakimised || []).push({ roll: "operaator", autor: "Tarmo Sepp (üürileandja)", tekst: v, aeg: TODAY_EE });
    } else {
      sel.doc.vestlus = sel.doc.vestlus || [];
      sel.doc.vestlus.push({ who: "op", autor: "Tarmo Sepp (operaator)", aeg: TODAY_EE + " 10:0" + (sel.doc.vestlus.length % 10), tekst: v });
    }
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `${sel.id}: sõnum saadetud kliendile (CommunicationThread).` });
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
  { k: "katse",  t: "Katseaja lõpp",      s: "tööleping — otsus enne katseaja lõppu" },
  { k: "palk",   t: "Palgaülevaatus",     s: "tööleping — iga-aastane ülevaatus" },
  { k: "indeks", t: "Indekseerimine",     s: "eelteade; korraline indekseerimine rakendub automaatselt" },
];

View.seaded = () => {
  const kasutajad = [
    { nimi: "Tarmo Sepp", epost: "tarmo@tember.ee", roll: "Admin", olek: "Aktiivne" },
    { nimi: "Margus Varne", epost: ACCOUNT.landlord.epost, roll: "Operaator", olek: "Aktiivne" },
  ];
  const ettRow = (nimi, reg, cur, extra, logo) => `
    <div class="flex" style="gap:12px;padding:11px 0;border-top:1px solid var(--line)">
      ${logo}
      <div style="flex:1;min-width:0"><b style="font-size:13.5px">${nimi}</b>${cur?` <span class="tag">aktiivne</span>`:""}
        <div class="muted mono" style="font-size:11px">reg ${reg}</div></div>
      ${extra}
    </div>`;
  const sw = (cid) => `<label class="flex" style="gap:7px;cursor:pointer" title="Aktsentvärv — läheb dokumentidele">
      <input type="color" class="ett-varv" data-cid="${cid}" value="${SEADED.varvid[cid] || "#0059CF"}" style="width:30px;height:26px;border:none;background:none;padding:0;cursor:pointer">
      <span class="muted" style="font-size:11px">aktsentvärv</span></label>`;

  return `
  <div class="view">
    <div class="page-head reveal">
      <div><h1 class="page-h1">Seaded</h1></div>
    </div>

    <div class="set-grid reveal">
      <!-- 1 · Ettevõtted -->
      <div class="card pad">
        <div class="card-h" style="padding:0 0 10px"><h3>Ettevõtted</h3><span class="overline">${DB.COMPANIES.length + SEADED.lisatud.length} tk</span></div>
        ${DB.COMPANIES.map(c => ettRow(c.nimi, REG_KOODID[c.id] || "—", c.id === DB.COMPANY_ID,
          sw(c.id),
          c.id === "taeva" ? `<img src="lisad/T6B_logo.png" alt="" style="height:28px;flex:none">`
                           : `<span class="ett-logo" style="background:${SEADED.varvid[c.id] || "#0059CF"}">${c.nimi[0]}</span>`)).join("")}
        ${SEADED.lisatud.map((e, i) => ettRow(e.nimi, e.reg, false,
          `<span class="tag">seadistamisel</span><button class="rmstep" data-ett-rm="${i}" title="Eemalda">×</button>`,
          `<span class="ett-logo" style="background:var(--ink-2)">${e.nimi[0]}</span>`)).join("")}
        <div class="divline"></div>
        <div class="overline" style="margin-bottom:8px">Lisa ettevõte</div>
        <div class="flex" style="gap:8px">
          <input id="ett-reg" placeholder="Registrikood, nt 10633207" inputmode="numeric" autocomplete="off"
            style="flex:1;padding:9px 13px;border:1px solid var(--line-strong);border-radius:9px;font-family:var(--font-mono);font-size:13px;outline:none">
          <button class="btn btn-primary btn-sm" id="ett-otsi">Otsi äriregistrist</button>
        </div>
        <div id="ett-leid"></div>
        <div class="muted" style="font-size:11px;margin-top:10px">Andmed tulevad e-äriregistrist automaatselt (autotäide). Logo ja aktsentvärv lähevad dokumentidele — pakkumus, leping, kliendilink.</div>
      </div>

      <!-- 2 · Kasutajad -->
      <div class="card pad">
        <div class="card-h" style="padding:0 0 10px"><h3>Kasutajad</h3><span class="overline">${kasutajad.length + SEADED.kutsed.length} tk</span></div>
        ${kasutajad.map(u => `
        <div class="flex" style="gap:12px;padding:11px 0;border-top:1px solid var(--line)">
          <span class="ett-logo" style="background:var(--accent-deep)">${u.nimi.split(" ").map(x=>x[0]).join("")}</span>
          <div style="flex:1;min-width:0"><b style="font-size:13.5px">${u.nimi}</b>
            <div class="muted mono" style="font-size:11px">${u.epost}</div></div>
          <span class="tag">${u.roll}</span>${pill(u.olek, "green")}
        </div>`).join("")}
        ${SEADED.kutsed.map((k, i) => `
        <div class="flex" style="gap:12px;padding:11px 0;border-top:1px solid var(--line)">
          <span class="ett-logo" style="background:var(--muted)">?</span>
          <div style="flex:1;min-width:0"><b style="font-size:13.5px;font-family:var(--font-mono)">${k.epost}</b>
            <div class="muted" style="font-size:11px">kutse saadetud ${k.aeg}</div></div>
          <span class="tag">${k.roll}</span>${pill("Ootel")}
          <button class="rmstep" data-kutse-rm="${i}" title="Tühista kutse">×</button>
        </div>`).join("")}
        <div class="divline"></div>
        <div class="overline" style="margin-bottom:8px">Kutsu kasutaja</div>
        <div class="flex" style="gap:8px;flex-wrap:wrap">
          <input id="ku-epost" type="email" placeholder="nimi@ettevote.ee" autocomplete="off"
            style="flex:1;min-width:170px;padding:9px 13px;border:1px solid var(--line-strong);border-radius:9px;font-family:inherit;font-size:13px;outline:none">
          <select id="ku-roll" style="padding:9px 12px;font-size:13px"><option>Operaator</option><option>Admin</option></select>
          <button class="btn btn-primary btn-sm" id="ku-saada">${I.send} Saada kutse</button>
        </div>
        <div class="muted" style="font-size:11px;margin-top:10px">Admin — seaded, kasutajad ja mallid; Operaator — igapäevane tehingutöö. Peenem õiguste jaotus (RBAC) — post-MVP.</div>
      </div>

      <!-- 3 · Mallid -->
      <div class="card pad">
        <div class="card-h" style="padding:0 0 10px"><h3>Mallid</h3><span class="overline">versioneeritud</span></div>
        ${OBJEKTID.map(o => `
          ${multiObj() ? `<div class="overline" style="margin:10px 0 2px">${o.nimi}</div>` : ""}
          ${[["uld", o.mallid.uldtingimused], ["eri", o.mallid.eritingimused], ["pakk", o.mallid.pakkumus]].map(([k, m]) => `
          <div class="flex" style="gap:10px;padding:10px 0;border-top:1px solid var(--line)">
            ${I.file.replace('<svg','<svg class="fic"')}
            <div style="flex:1;min-width:0"><b style="font-size:13px">${m}</b>
              ${k === "uld" ? `<div class="muted" style="font-size:11px">${(m.match(/v[\d.]+/) || ["v1.0"])[0]} kehtiv · varasemad arhiivis · uus versioon ei puuduta allkirjastatuid</div>` : ""}</div>
            <button class="steplink" onclick="toast('Mall avatud versioonihaldusega — külmub allkirjaga. Demos illustratiivne.')">Ava mall</button>
            ${k === "uld" ? `<button class="steplink" onclick="toast('Uus versioon (mustand) — jõustub avaldamisel ainult uutele lepingutele; allkirjastatud jäävad oma versiooni juurde')">Uus versioon</button>` : ""}
          </div>`).join("")}`).join("")}
        <div class="muted" style="font-size:11px;margin-top:10px">Üldtingimused on lepingus lukus — muudatus käib ainult uue malliversiooniga. Eritingimuste põhi ja pakkumuse põhi on lähtepunktid, mida operaator tehingus kohandab.</div>
      </div>

      <!-- 4 · Teavitused -->
      <div class="card pad">
        <div class="card-h" style="padding:0 0 10px"><h3>Teavitused</h3><span class="overline">vaikeajad</span></div>
        ${TEAVITUSED_DEF.map(d => `
        <div class="flex" style="gap:12px;padding:10px 0;border-top:1px solid var(--line)">
          <div style="flex:1;min-width:0"><b style="font-size:13px">${d.t}</b>
            <div class="muted" style="font-size:11px">${d.s}</div></div>
          <input class="tv-in mono" data-tv="${d.k}" value="${SEADED.teavitused[d.k]}" inputmode="numeric"
            style="width:52px;text-align:right;padding:7px 9px;border:1px solid var(--line-strong);border-radius:8px;font-size:13px;outline:none">
          <span class="muted" style="font-size:12px;flex:none">päeva ette</span>
        </div>`).join("")}
        <div class="muted" style="font-size:11px;margin-top:10px">Vaikeajad kehtivad uutele tähtaegadele; üksikul lepingul saab aega eraldi muuta. Kõik teavitused lähevad ka meilile — operaatorile tööpostkasti, kliendile tema kontaktile.</div>
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
    leid.innerHTML = `<div class="card pad" style="background:var(--surface-soft);box-shadow:none;margin-top:10px">
      <div class="overline" style="margin-bottom:6px">e-äriregister · autotäide</div>
      <b style="font-size:13.5px">${nimi}</b>
      <div class="muted mono" style="font-size:11px;margin-top:2px">reg ${reg} · KMKR EE10${reg.slice(0,6)} · Pärnu mnt 15, Tallinn</div>
      <button class="btn btn-accent btn-sm" id="ett-lisa" style="margin-top:10px">${I.plus} Lisa kontole</button>
    </div>`;
    document.getElementById("ett-lisa").onclick = () => {
      SEADED.lisatud.push({ reg, nimi }); seadSave();
      AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Ettevõte ${nimi} (reg ${reg}) lisatud kontole e-äriregistri autotäitega.` });
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
    SEADED.kutsed.push({ epost: e, roll, aeg: TODAY_EE }); seadSave();
    AUDIT.unshift({ aeg: TODAY_EE, autor: "Tarmo Sepp", tegevus: `Kasutajakutse saadetud: ${e} (${roll}).` });
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
function notFound(msg) { return `<div class="view"><div class="empty"><div class="ic">${I.search}</div><h2>${msg}</h2></div></div>`; }

/* nav: 5 lehte, igaüks vastab ühele igavesele küsimusele (tiimi brainstorm) */
const NAV_OP = [
  { href: "#/",         ic: I.spark,    t: "Avaleht",  q: "Mida ma täna tegema pean?" },
  { href: "#/ylevaade", ic: I.grid,     t: "Ülevaade", q: "Kuidas meil läheb?" },
  { href: "#/portfell", ic: I.building, t: "Portfell", q: "Mis meil on ja kellega?",
    count: () => OFFERS.filter(o=>["Mustand","Saadetud","Kliendi ettepanek"].includes(o.staatus)).length + LEASES.filter(l=>l.staatus!=="Kehtiv").length + TLEPINGUD.filter(t=>t.staatus!=="Kehtiv").length },
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
    return `<a href="${n.href}" class="${active===n.href?'active':''}" title="${n.q||n.t}">${n.ic.replace('<svg','<svg class="ic"')}<span>${n.t}</span>${c?`<span class="count">${c}</span>`:""}</a>`;
  }).join("");
}

const ROUTES = [
  { re: /^#\/portaal$/, view: () => View.portaal(), crumb: "Minu dokumendid", nav: "#/portaal", init: () => View.portaal.init && View.portaal.init() },
  { re: /^#?\/?$/, view: () => View.dashboard(), crumb: "Avaleht", nav: "#/", init: View.dashboard.init },
  { re: /^#\/ylevaade$/, view: () => View.ylevaade(), crumb: "Ülevaade", nav: "#/ylevaade", init: () => View.ylevaade.init() },
  { re: /^#\/portfell(?:\/(.+))?$/, view: m => View.portfell(m), crumb: "Portfell", nav: "#/portfell", init: () => View.portfell.init() },
  { re: /^#\/klient\/(.+)$/, view: m => View.klient(m), crumb: "Portfell › Klient", nav: "#/portfell" },
  { re: /^#\/suhtlus(?:\/(.+))?$/, view: m => View.suhtlus(m), crumb: "Suhtlus", nav: "#/suhtlus", init: m => View.suhtlus.init(m) },
  { re: /^#\/osapooled$/, view: () => View.osapooled(), crumb: "Portfell › Osapooled", nav: "#/portfell" },
  { re: /^#\/register$/, view: () => View.register(), crumb: "Portfell › Esemeregister", nav: "#/portfell" },
  { re: /^#\/objekt(?:\/(.+))?$/, view: m => View.objekt(m), crumb: "Portfell › Esemeregister › Objekt", nav: "#/portfell", init: () => View.objekt.init() },
  { re: /^#\/tooleping\/(.+)$/, view: m => View.tooleping(m), crumb: "Portfell › Tööleping", nav: "#/portfell" },
  { re: /^#\/imp\/(.+)$/, view: m => View.imporditud(m), crumb: "Portfell › Imporditud leping", nav: "#/portfell" },
  { re: /^#\/pakkumised(?:\/(.+))?$/, view: m => View.pakkumised(m), crumb: "Portfell › Pakkumised", nav: "#/portfell" },
  { re: /^#\/pakkumus-uus$/, view: () => View.pakkumusUus(), crumb: "Portfell › Pakkumised › Uus", nav: "#/portfell", init: View.pakkumusUus.init },
  { re: /^#\/pakkumus-doc\/(.+)$/, view: m => View.pakkumusDoc(m), crumb: "Portfell › Pakkumus · dokument", nav: "#/portfell" },
  { re: /^#\/pakkumus\/(.+)$/, view: m => View.pakkumus(m), crumb: "Portfell › Pakkumus", nav: "#/portfell", init: View.pakkumus.init },
  { re: /^#\/lepingud(?:\/(.+))?$/, view: m => View.lepingud(m), crumb: "Portfell › Lepingud", nav: "#/portfell" },
  { re: /^#\/leping-uus$/, view: () => View.lepingUus(), crumb: "Portfell › Lepingud › Uus leping", nav: "#/portfell", init: View.lepingUus.init },
  { re: /^#\/leping\/(.+)$/, view: m => View.leping(m), crumb: "Portfell › Leping", nav: "#/portfell", init: View.leping.init },
  { re: /^#\/risk\/(.+)$/, view: m => View.risk(m), crumb: "Portfell › Riskiraport", nav: "#/portfell", init: View.risk.init },
  { re: /^#\/risk$/, view: () => View.risk(), crumb: "Portfell › Riskiraport", nav: "#/portfell", init: View.risk.init },
  { re: /^#\/kalender(?:\/(.+))?$/, view: m => View.kalender(m), crumb: "Kalender", nav: "#/kalender", init: () => View.kalender.init() },
  { re: /^#\/audit$/, view: () => View.audit(), crumb: "Ülevaade › Audit trail", nav: "#/ylevaade" },
  { re: /^#\/seaded$/, view: () => View.seaded(), crumb: "Seaded", nav: "", init: () => View.seaded.init() },
];

function router() {
  let h = location.hash || "#/";
  // kliendirežiimis on avaleht portaal
  if (isClient() && /^#?\/?$/.test(h)) h = "#/portaal";
  closeSide(); closePdf();
  let route = ROUTES.find(r => r.re.test(h)) || ROUTES[0];
  const m = h.match(route.re);
  const arg = m && m[1];
  CURRENT_LEASE = /^#\/leping\//.test(h) ? DB.leaseById(arg) : null;

  document.getElementById("app-view").innerHTML = route.view(arg);
  document.getElementById("nav").innerHTML = renderNav(route.nav);
  document.getElementById("crumb").innerHTML = isClient()
    ? `ThinkOne <b>/</b> ${route.crumb} <span class="role-chip" style="margin-left:8px">KLIENDIPORTAAL</span>`
    : `ThinkOne <b>/</b> ${route.crumb}`;
  /* avalehel on suur komposer — kompaktne ülariba-oma on seal peidus */
  document.body.classList.toggle("dash-shell", !isClient() && /^#?\/?$/.test(h));
  /* kliendirollis pole operaatori tööriistu: otsing + „Loo" on peidus */
  document.body.classList.toggle("client-shell", isClient());
  window.scrollTo(0,0);
  if (route.init) route.init(arg);
  if (typeof updateNotifBadge === "function") updateNotifBadge();
}

/* toast */
let toastT;
function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el);
    el.style.cssText = "position:fixed;bottom:26px;left:50%;transform:translateX(-50%) translateY(20px);background:#000000;color:#fff;padding:13px 22px;border-radius:999px;font-size:13.5px;font-weight:500;box-shadow:0 24px 60px -22px rgba(10,12,16,.5);z-index:200;opacity:0;transition:.3s;display:flex;gap:10px;align-items:center;max-width:90vw"; }
  el.innerHTML = `<span style="color:#7CD9A6;display:flex">${I.check.replace('<svg','<svg style="width:17px"')}</span> ${msg}`;
  requestAnimationFrame(()=>{ el.style.opacity="1"; el.style.transform="translateX(-50%) translateY(0)"; });
  clearTimeout(toastT); toastT = setTimeout(()=>{ el.style.opacity="0"; el.style.transform="translateX(-50%) translateY(20px)"; }, 3600);
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
    </button>`).join("") : `<div class="muted" style="padding:16px;font-size:12.5px">Teavitusi pole.</div>`}`;
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
    SPACES.forEach(s => { if (omniMatch((s.nimi + " " + (s.tenant || "")).toLowerCase(), q)) res.push({ ic: I.pin, t: `${s.nimi}${s.tenant ? " · " + s.tenant : ""}`, s: `${objektOf(s).nimi} · ${s.staatus}`, href: "#/objekt/" + objektOf(s).id }); });
  }
  return res.slice(0, 6);
}
function omniRender() {
  const inp = document.getElementById("omni-in"), pop = document.getElementById("omni-pop");
  if (!inp || !pop) return;
  const q = inp.value.trim().toLowerCase();
  const res = omniResults(q);
  const row = (r, first) => `<button class="om-row ${first ? "sel" : ""}" onclick="omniGo('${r.href}')">${r.ic.replace('<svg','<svg class="ic"')}<span class="tx"><span class="t">${r.t}</span>${r.s ? `<span class="s">${r.s}</span>` : ""}</span></button>`;
  let first = true; let html = "";
  if (res.length) { html += `<div class="om-lbl">Tulemused</div>` + res.map(r => { const h = row(r, first); first = false; return h; }).join(""); }
  html += `<div class="om-lbl">Küsi AI-lt</div>
    <button class="om-row om-ai ${first ? "sel" : ""}" onclick="omniAsk()">${I.spark.replace('<svg','<svg class="ic"')}<span class="tx"><span class="t">${q ? `Küsi AI-lt: „${inp.value.trim()}"` : "Ava AI-agent — küsi või anna korraldus"}</span><span class="s">vastus avaneb AI-paneelis</span></span></button>`;
  pop.innerHTML = html;
  pop.classList.add("open");
}
function omniGo(href) { const pop = document.getElementById("omni-pop"); if (pop) pop.classList.remove("open"); const i = document.getElementById("omni-in"); if (i) i.value = ""; location.hash = href; }
function omniAsk() { const i = document.getElementById("omni-in"); const q = i ? i.value.trim() : ""; const pop = document.getElementById("omni-pop"); if (pop) pop.classList.remove("open"); if (i) i.value = ""; runAgentPanel(q || ""); }
window.omniGo = omniGo; window.omniAsk = omniAsk;
function omniEnter() {
  const pop = document.getElementById("omni-pop");
  if (!pop || !pop.classList.contains("open")) { omniRender(); return; }
  /* Enter avab esimese: tulemus → küsi AI-lt */
  const inp = document.getElementById("omni-in");
  const q = inp ? inp.value.trim().toLowerCase() : "";
  const res = omniResults(q);
  if (res.length) { omniGo(res[0].href); return; }
  omniAsk();
}

/* --- „+ Loo": 6 valikut (ainus värviline nupp) ------------------------------ */
function renderLooMenu() {
  const el = document.getElementById("loo-pop"); if (!el) return;
  const items = [
    { ic: I.offer, t: "Hinnapakkumine", s: "klient → riskiraport → pinnad", href: "#/pakkumus-uus" },
    { ic: I.lease, t: "Leping", s: "üüri- või tööleping · tüüp valitakse wizardis", href: "#/leping-uus" },
    { ic: I.edit,  t: "Muudatus", s: "vali leping, uus lisa nr", href: "#/lepingud", msg: "Vali leping, mille muudatust alustada" },
    { ic: I.building, t: "Objekt / pind", s: "EHR autotäide + CSV import", href: "#/register", msg: "Uus objekt: EHR autotäide + pindade CSV-import — demos illustratiivne" },
    { ic: I.user,  t: "Klient", s: "äriregistri autotäide", href: "#/osapooled", msg: "Uus klient: äriregistri autotäide — demos näidisklientidega" },
    { ic: I.file,  t: "Impordi lepingud", s: "PDF/DOCX → klauslimudel", href: "#/lepingud", msg: "Import: PDF/DOCX loetakse klauslimudelisse, operaator kinnitab — vt imporditud sektsiooni" },
  ];
  el.innerHTML = items.map(x => `
    <button class="np-item" onclick="document.getElementById('loo-pop').classList.remove('open');location.hash='${x.href}';${x.msg ? `toast('${x.msg}')` : ""}">
      <span class="np-ic">${x.ic}</span>
      <span class="np-tx"><span class="t">${x.t}</span><span class="s">${x.s}</span></span>
    </button>`).join("");
}

/* AI-agent on globaalne: ⌘J / ikoon avab parempoolse paneeli, programmiline käivitus näidisnuppudelt */
window.askAgent = (q) => runAgentPanel(q);

function boot() {
  try {
    renderShell();
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
if (document.readyState === "loading") window.addEventListener("DOMContentLoaded", boot);
else boot();
