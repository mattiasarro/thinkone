# ThinkOne — sessiooni üleandmine (seisuga 10.09.2026)

> See fail on AI-assistendi (Claude Code) sessioonide vaheline üleandmismärge.
> Tööreeglid elavad `CLAUDE.md`-s (laaditakse automaatselt); siin on sessioonide
> ajalugu ja nüansid. Kui midagi aegub, uuenda või kustuta julgelt.

## Kontekst ja fookus

- **Töö käib AINULT `demo/` kaustas** — spetsifikatsiooni ja arhitektuurifaile
  ei muudeta ilma kasutaja palveta.
- Demo on **raamistikuvaba staatiline SPA**; topeltklõps `demo/index.html` töötab
  alati. Brauseriautomaatika/ekraanipiltide jaoks `node serve.js` → localhost:8471.
- Cache-versioon praegu **v=426** (kõik VIIS viidet index.html-is sünkroonis: styles + 4 js).
- **Reaotsad (10.09.2026):** töökoopia `demo/*` on nüüd LF-iga (teine tööriist kirjutas LF; git `autocrlf`
  normaliseerib commit'il). Patch-skriptid tuvastagu reaots dünaamiliselt (`s.includes("\r\n")`), mitte eeldagu CRLF-i.
- **Teine tööriist (ChatGPT) töötab samas töökoopias** (v390–406) ja EI kirjuta HANDOFF-i — pärast tema sessiooni
  kaardista muudatused `git diff` järgi ja lisa siia (vt 10.09.2026 jaotis).
- Paigaldatud disainiskillid (`npx skills add Leonxlnx/taste-skill`): `.agents/skills/`
  + `.claude/skills/` + `skills-lock.json` (jälgimata; kaustakopeerimisega tulevad kaasa).
  Kasutuses: design-taste-frontend (audit) + high-end-visual-design (motion-pass).
- **HOIATUS (PowerShell + UTF-8):** PS5.1 `Get-Content -Raw` / `Select-String` loeb
  BOM-ita UTF-8 ANSI-na → mojibake. Kasuta Edit-tööriista või
  `[System.IO.File]::ReadAllText/WriteAllText` + `UTF8Encoding($false)`.
  Pärast `git add`-i taastab `git checkout --` INDEKSIST — HEAD-ist: `git checkout HEAD --`.
- Disainiviited: `examples/` (jälgimata, kasutaja lisatud) — nt
  `rent_offer_full_panel_arrow_button.html` = pakkumuse külgveeru viide (rakendatud v336).
  Uus viide samasse kausta → rakenda demo klassidega, mitte viite CSS-muutujatega.
- `importitud/` (repo juur, jälgimata) = kasutaja PÄRIS lähtelepingud; demos kasutatavad koopiad on
  `demo/lisad/importitud/` all (commit'itud). Uus päris leping → kopeeri sinna ASCII-nimega, loe
  faktid välja (Word COM docx → PDF; PDF tekst pdf.js-iga headless Chrome'is) ja lisa `IMPORDITUD`-i.
- Jälgimata failid: `demo/lisad/T6B_parkimisskeem_uus.pdf` (kasutaja lisatud,
  veel sidumata — küsi, kas siduda `OBJEKT.failid.parkimine` viitega) ja Wordi
  ajutine `~$rileping.docx` (kaob faili sulgemisel).
- Üürilepingu AUTORITEETNE originaal: `Üürileping/Üürileping.docx` — põhitingimuste
  struktuur demos peegeldab seda (vt allpool).
- Git-ajalugu on parim muudatuste kroonika: `git log --oneline` — iga samm on
  eraldi commit'itud eestikeelse selgitusega.

## 11.09.2026 (v=426) — TEEMAKIHT „Medi-joon" (roheline raam, pillid, Poppins)

Kasutaja saatis teise viite (Medi tervisedashboard) ja palus sama puhast joont, värvid võivad olla samad. Rakendatud
`styles.css` LÕPPU eraldi plokina (tokenite ülekirjutus + kesta/komponentide reeglid), et seda saaks ühe kustutusega tagasi
võtta. Sisu: `.app` 16 px polster + 16 px vahe, `.sidebar` roheline 28 px plaat (sticky, `calc(100dvh - 32px)`), `.topbar`
+ `.main` kreem plaat (28 px ülemised/alumised nurgad), logo valge (lg-box rect valge, path roheline), nav valge/.82,
aktiivne rgb(255 255 255/.18) + oranž täpp (`::after`, peidus kui `.count`), otsing/nupud/väljad/kiibid pillid, kaardid 24 px
servata, tabelipäis kriipsjoonega, graafik roheline + kriipsjooned + oranž hetkepunkt, `.lmonths .now` oranž, `.hbubble` valge
tooltip, roheline fookuskaart (`.met-grid > .met:first-child`, `.cl-side .card:has(.pc-big)`), Poppins pealkirjades
(fondilink index.html + kujundus.html). ≤1024 raam ilma polstrita, sahtel roheline. Kontrollitud: ülevaade, pakkumuse detail,
avaleht. app.js: graafiku gradient rohekaks.

## 11.09.2026 (v=425) — VIITE ELEMENDID: avatarid, kiibipilved, väärtus-enne-silti, delta, tilaala

`avatar(name)`/`initials()` app.js-is (`.av-i` helesinine ring + koobalt-initsiaalid): pakkumuste tabeli klient-lahter (`.ent` = avatar + nimi + kontakt) ja suhtluse loend. Täituvuse hero all `.delta.up/.down/.flat` (pp eelmise kuuga, `objektAjalugu` viimane väärtus). Kiibipilved: `.pf-view/.tabbar a/.offer-filters a` valimata = primary-subtle + koobalt, valitud = koobalt (tabbar ilma valge kestata, `.pf-sep` peidus). Suhtluse valitud vestlus `.sl-row.sel` = koobalt-kaart valge tekstiga. `.met` = väärtus enne silti (flex order). Tilaala: `.obj-add`, `.obj-upload input[type=file]` dashed. Tume tooltip: `.hbubble`, `.tip::after`, `.lchart .pt.now` = `--color-text`.

## 11.09.2026 (v=424) — VIITE JÄRGI: küllastunud koobalt, servata kaardid, nurgad 8/12/16, must UI-st välja

Kasutaja saatis viitepildi (koobalt-UI kaardikomplekt: valged kaardid pehme laia varjuga heledal hallil, sinised kiibid ja
avatarid helesinisel pinnal, roheline ainult positiivsel muutusel, nupud ~12 px nurgaga). Rakendatud tokenitena:
primary `#1F5EFF` / hover `#1749D6` / subtle `#E9EFFF`, `--color-success-vivid #22C55E` (`.bar > i`, `.pf-time .track i`,
`.stepper .trk i`, toast/step/fin-cta ikoonid), raadiused 8/12/16, `--edge-color rgb(20 26 38 / .04)` + laiem `--shadow-surface`,
lõuend `#F0F1F5`. `btn-ghost` = lõuenditooni pind ilma servata; `btn-primary` sinise kumaga. Kõik mustad valikud
(tabbar, pf-view, pf-mode, lmonths.now, pipe-step b, ladder, ct-rail, res-opt/m-btn.sel, eri-list number) → koobalt või
primary-subtle; `--ink-grad` → primary (oma sõnum), `--stone` → primary. Avatarid (`.sb-user .av`, `.cl-mono`, `.pick-av`,
`.th-av`, `.cm-av`) = helesinine ring + koobalt-initsiaalid. Kiibid (`.pc-pill`, `.kd-date`, `.ag-chip`, `.preset-btn`,
`.dm-chip`, `.omni kbd`) = primary-subtle + primary tekst. Kontrollitud: avaleht, pakkumuse detail.

## 11.09.2026 (v=423) — PALETI VAHETUS „Grafiit + koobalt", Geist, listid, pindade valik

Kasutaja: v421/422 oli „liiga valge ja ebaprofessionaalne". Rakendati `.agents/skills/redesign-existing-projects`
(fondivahetus → palett → olekud → rütm → komponendid) ja `design-taste-frontend` (neutraalne baas + üks aktsent, tint-varjud).
Kolm suunda mokiti artefaktina (Grafiit+koobalt · Mets+luu · Kiltkivi+terrakota); kasutaja valis **grafiit + koobalt**,
**hele külgriba** (lõuendist aste tumedam, mitte tume) ja **Geist + Bricolage + Geist Mono**.

- **Tokenid**: neutraalid jahedaks (`#EDEFF3` lõuend · `#E2E5EB` külgriba/pehme pind · `#CDD2DA` eraldaja · `#838B98` kontrolliserv ·
  `#596170` teisene · `#141821` tekst), primary `#2A55C7` / hover `#2348AB` / subtle `#E6ECFA` / ring `--color-primary-ring`,
  info `#2F6A8C` (eraldi toon primary'st), kaardiserv `#DDE1E7` tahke, varjud `rgb(20 26 38 / …)`. Body-gradient koobalt-valgusega.
- **VIGA PARANDATUD**: v421 normaliseerija oli teinud `--color-primary-subtle: var(--color-primary-subtle)` (tsükkel → tühi);
  seepärast puudus aktiivsel navil taust. Nüüd tahke väärtus.
- **Fondid**: `--font-ui` Geist, `--font-mono` Geist Mono. `.mono` = Geist tabular-nums (sildid/tunnused tekstis), `.num` ja
  `.tbl .id/.r`, `.price-row .amt`, `.pc-row .num`, `.cd-sum`, `.pc-big`, `.stat/.pf-fact/.sp-nums .v`, `.kal-date .d` = Geist Mono.
  `.ehr-cell .v` jääb UI-kirja (tekstväärtused). Google Fonts link index.html + kujundus.html.
- **Listid** (styles.css „LISTID" plokk enne KEST-i): ühine polster/eraldaja/hover; 32 px ikoonitiilid (`.icotile`, `.kd-ic.lg`,
  `.nh-ic`, `.np-ic`, `.att .fic`, `.om-row .ic` …) pehmel pinnal, svg 18 px; rea-hover `::after` jooned maas.
  Avalehe `.nstack` = valge kaart + read; `nsLayout()` näitab kokkuvolditult 3 esimest rida (mitte kaardipakk), toggle
  peidus kui ≤3. Kalender ≤640: tekst täislai, nupp oma real.
- **Pindade valik** (viisardi samm 3): `wizSpacesHTML()` + `bindWizSpaces()` app.js-is. Hoone-combobox (`#sp-obj`, `.combo`,
  `.drop` listbox, klaviatuur ↑↓/Enter/Esc, focusout sulgeb; globaalne `.drop.open` sulgeja jätab `.combo` vahele),
  pinnaotsing (`#sp-q`, filtreerib `data-q` järgi ilma re-renderita), 40 px read (`.sp-row`, role=checkbox, tühik/Enter),
  jalus valiku kokkuvõttega (`#sp-foot`: n · m² · €/kuus · Tühjenda), `WIZ.objektId` + `WIZ.q`. Mobiilis 2-realine rida.
- **Tabel**: päis `--color-thead` taust + uppercase; `tr.sel` primary-subtle; `td.r/.num` mono.
- Kontroll: 13 marsruuti 320/768 ilma ülevooluta (sh samm 3); töölaual avaleht, ülevaade, pakkumised, detail, objekt, seaded, kalender.

## 10.09.2026 (v=421) — UI-AUDITI RAKENDUS: tokenid, Button/Badge/Field, kest, mobiil, galerii

Alus: `demo/design-system/audit.md` (+ loetav `audit.html`), `tokens.proposed.css`, `style-guide.proposed.md`.
Kasutaja otsused enne alustamist: **petrooleum kõigile põhitegevustele** (must ja roheline nupp kadusid),
fondid auditi järgi (Inter + Bricolage; Inter Tight ja Geist Mono ei laeta), kõik 4 etappi, baseline commit enne.

- **Tokenid** on `styles.css :root`-is (koopia tokens.proposed.css-ist + `--text-display-lg 40px` erand hero-numbrile
  ja avalehe küsimusele). Vanad nimed on ALIASED (`--paper`, `--ink`, `--ink-2`→text, `--muted`/`--faint`→text-secondary,
  `--line`→neutral-2, `--line-strong`→divider, `--accent*`, `--green/amber/red/blue/teal*`→semantilised, `--r*`, `--shadow*`,
  `--ink-grad`→ tume PIND (avatar, oma sõnum, valitud sakk) — mitte enam nupp). `--accent-soft-2` ja `--blue-soft` kustutatud.
- **Normaliseerimisskript** (scratchpad, ühekordne) viis kogu CSS-i skaalale: kirjasuurused → 6 rolli, padding/margin/gap → 4 px
  skaala (≤3 px optilised jäid), raadiused → 4/8/12 (50% jäi), transition/animation kestused → 150/250 ms (laadimisindikaatorid
  spin/blink/shimmer jäid), box-shadow → 3 taset (inset-rõngad jäid). Sama loogika inline-stiilidele app.js-is.
  Klauslirea geomeetria (26→24, 36→32/36) käsitsi ühtlustatud.
- **Button**: `.btn` + primary/ghost/text/destructive, sm/md/lg 32/40/48, ikoonikast 22 px (ikoon 16) EI muuda polstrit
  (`.btn:has(svg)` reeglid maas), `disabled` neutraalne, `aria-busy` = spinner + silt peidus, laius ei muutu; mobiilis/puutel 44 px.
  Legacy klassid (`btn-accent/green/soft/quiet`) on CSS-is aliased, app.js ja galerii markup migreeritud.
  „+ Uus" (`.btn-loo`) ja rollivahetus (`.role-tab`, operaator = ghost, klient = primary) samas keeles; läige/pööre/vedru maas.
- **Badge**: `pill()` → `.pill.<sem>`; `STATUS` väärtused on nüüd success/warning/error/info/neutral (+`PILL_KIND` legacy
  green/amber/… → semantika). Ootel/Lahendamisel/Arutelul = warning (must kapsel `.pill.fill` kadus). Tag neutraalne
  (lime/lav aliased). Tumedal objektibändil `.pill` hele poolläbipaistev.
- **Field**: `.field input/select/textarea` + lahtine `.fld` (`.fld-sm` 32 px, `.fld-color`): 40 px, kontrolliserv `#85857F`
  (3,71:1), valge pind, fookus = globaalne outline (`:focus-visible`), read-only/disabled/error (`aria-invalid`, `.err`).
  Mähitud sisendid (omni, composer, pf-search, risk-search, ag-input, suh-foot) kannavad outline'i mähisel `:focus-within`.
  `.field input` selektor on `:where(...)`-iga (spetsiifilisus 0,1,1), et `.clsearch input` polster võidaks.
  Tekstisisesed väljad (fact-in, rep-in, price-in, ce-in, eri-in) said sama serva ja sm-mõõdu. Check/radio 20 px, `.check` 44 px.
- **Kest**: päis 64 px, navi read 44 px / ikoon 20 px, aktiivne = `--color-primary-subtle` + primary; sahtel ≤1024 px
  (`drawer-in` 250 ms), ≤640 px kompaktne. `window.matchMedia('(max-width: 1024px)')` boot-is.
- **Tabelid**: `stackTables()` router-is lisab igale `table.tbl`-ile `.stack` + `td[data-l]` (thead tekst); ainult nuppudega
  lahter → `.tbl-actions`. ≤760 px: rida = plokk, silt absoluutselt vasakul 38 %, sisu voolab tavaliselt. `.offer-table .tbl
  { min-width: 780px }` maas. Ruudustikud kõik `minmax(0, 1fr)` (sisu ei venita veergu). Kontroll: 320/375/768 px kõigil
  26 marsruudil `scrollWidth ≤ vaateaken` (iframe-mõõtmine).
- **Ülekatted**: `.drop/.co-menu/.preset-menu/.pdfmodal` sisse-välja paar `display allow-discrete + @starting-style`
  (Chrome-first); `.side` 250 ms; toast HELE kaart, tekst murdub; scrim ilma blur'ita. PDF-modaal tagastab fookuse avajale.
- **Liikumine**: needle-drift ja ct-pulse (püsivõnkumised) eemaldatud; reduced-motion nullib tokenid + nihked/pöörded.
- **CSS-vead**: `.cl-side` sticky nüüd ENNE ≤1100 reeglit (+ `!important` static); obj-flow `border: var(--edge)` (mitte
  `1px solid var(--edge)`); `.empty .ic` keskele.
- **Galerii** `kujundus.html` laeb `uldtingimused.js + data.js + klauslid.js + app.js`; app.js `boot()` ja `router()`
  ei käivitu ilma `#app-view`'ta. Koopiad (I, STATUS, PILL_SHAPE, pill, toast) kustutatud. Sektsioonid: Button (4 varianti,
  3 mõõtu, disabled/loading/fookus), Badge (semantilised + KOGU STATUS renderdatud), Field olekud.
- **Ei muudetud**: tekstid, andmed, äriloogika, rollid, teekonnad, illustratsioonikaardid (`.ltyp`: vari + nool 5 px +
  pilt 5°, nüüd tokenitega), dokumendi A4/print eraldus (`.sheet` ekraanil ≤900/≤640 kitsam polster).
- **Runtime-kontroll puudub** (testkirjeid pole): natiivne üürilepingu detail (`#/leping/…`), töölepingu detail — CSS on ühine,
  aga vaadet pole silmaga üle vaadatud. Print kontrollitud ainult CSS-i järgi.

## 10.09.2026 (v=415–420) — NUPUKEEL viite rbp-shader-template.vercel.app järgi: prooviti ja VÕETI MAHA

**v420:** kasutaja „go back, not looking as good as i hoped" → kogu v415–419 kiht tagasi (CSS täpselt v414 kujule,
Geist-link maas, app.js 12 noolt taas paljaks `${I.arrow}`/`.arr`). Kontrollitud: `git diff` HEAD-i suhtes ei
sisalda nupukeele jälgi; smoke 13 vaadet, konsool tühi. Allolev kirjeldus jääb ajalooks (mida prooviti).

Kasutaja: „I like buttons here … and those arrow animation … in CAPS they look better. Could we implement same style
and fonts." Viide mõõdetud headless'is: sildid 12 px, weight 500, letter-spacing 1.2 px (.1em), uppercase,
padding 12/20, raadius 6, LAME; CTA = sildipill + omaette noolekast (40×40, 4 px vahe, sama täide); hoveril nool
libiseb paremale välja ja teine tuleb vasakult sisse (transform .5s cubic-bezier(.22,1,.36,1)). Font: leht laadib
Geisti, aga nuppudel renderdub Windowsis Segoe UI Semibold (Tailwindi ui-sans-serif) — võtsime Geisti (Google
Fonts `family=Geist:wght@400..700` index.html linki; `--font-btn: "Geist", "Inter", "Segoe UI", …`).
- **`.btn`**: font-btn, 12 px / 500 / .1em / uppercase, min-height 40, padding 0 18, radius 6, varjuta, hover ainult
  toon (transform/vari maas); `.btn-sm` 11 px / .09em / min-height 32 / padding 0 14. `.btn-soft` lame (õrn
  aktsent-serv .22). `.btn-loo` („+ UUS") ja `.btn-quiet` samas keeles (quiet 11.5 px / .07em / nowrap, et
  „Lükkan pakkumuse tagasi" ei murduks).
- **`.bic` = libisev nool**: `svg` transform .5s välja paremale, `::before` (sama nool `mask`-ina,
  `background: currentColor`) translateX(-100%) → 0. Vaikimisi väike 22 px kast (ghost/soft).
- **Täidetud nupud** (`.btn-primary/.btn-accent/.btn-green`) + `.bic:last-child` = SPLIT: nupp ise läbipaistev
  (`position:relative; isolation:isolate; padding-right: 62` = 18+4+40; sm 50), sildiosa taust `::before`
  ümarnurkne (`inset: -1px 43px -1px -1px`; sm 35), tiil `.bic` ABSOLUUTSELT paremas servas (40×kõrgus; sm 32),
  `--bg-solid` per variant (primary = `--ink` solid, mitte gradient; hover-toonid). Absoluutne tiil → silt
  tsentreerub ka `width:100%; justify-content:center` nuppudel (külgkaardi „Saada üürnikule").
- `#res-open` (Lahenda-chevron) libisemisest välja arvatud (pöördub nagu enne).
- app.js: 12 nuppu, mille viimane laps oli paljas `${I.arrow}` (Edasi/Vaata ülevaadet/Põhitingimused/Ava pinnad/
  kalendri kuu jne) + „Kinnita ja saada" `.arr` → `<span class="bic">${I.arrow}</span>` (regex, ainult .btn sees).
- Kontroll: pakkumus (op/üürnik), viisardid, leping, objekt-uus, mobiil, B11G — konsool tühi; hover-vahekaader
  näitab kahte noolt (vana väljumas, uus sisenemas).

## 10.09.2026 (v=414) — uue lepingu viisardi tüübisamm pakkumuse viisardi rütmis

Kasutaja: „anna sama palju ruumi nagu hinnapakkumises … stepperi ja pealkirja vahe samaks … joonda vasakult".
Põhjus: ChatGPT-kihi erandid `#lwiz:has(> .ltyp-grid) > .stepper { max-width:760px; margin:24px auto }` ja
`.ltyp-grid { max-width:760px; margin-inline:auto }` (+ max-height 800 media). Need maas → stepper kasutab
vaikemargineid `.stepper { margin: 60px 0 90px }` täislaiuses nagu `#wiz`; `.ltyp-grid` =
`repeat(auto-fill, minmax(300px, 360px)); justify-content: start` (kaardid 360 px, vasakul; 3 kaardiga
(Tööleping) mahuvad ühte ritta). Mõõdetud: mõlema viisardi `.reveal` plokk y=282, kaardid/sisukaart y=438.

## 10.09.2026 (v=411–413) — ruudustik lõuendil: prooviti ja VÕETI MAHA

**v413:** kasutaja „go back, before was better" → ruudustikukihid eemaldatud, `body` taust nagu v410 (kommentaar
CSS-is jääb). Kui kunagi uuesti proovida: kaks `repeating-linear-gradient` kihti taustavirna ette (kirjeldus all).

Kasutaja: „add barely visible grid to the main background". `body` taustavirna kaks pealmist kihti:
`repeating-linear-gradient(90deg|0deg, rgba(10,12,16,.028) 0 1px, transparent 1px 32px)` — 32 px samm, tint 2,8 %
(4 % oli 1× ekraanil juba „nähtav"), `background-attachment: fixed` nagu teised kihid. Paistab ainult lõuendil —
külgriba, päis ja kaardid on valged. Tera (`body::after`, 3,5 %) jääb peale.

## 10.09.2026 (v=409–410) — logomärk kastis

Kasutaja pilt: must ümarnurkne ruut, valge märk sees, sõnamärk kõrval. `index.html`: `.logo-mark` (kokkutõmmatud
menüü) viewBox 93×116 → 116×116, sees `<g class="lg-box"><rect 116×116 rx=26/> + <g transform="translate(28.2
20.9) scale(0.64)">märk</g></g>` (v410: märk .745 → .64, et kasti ja märgi vahele jääks rohkem õhku — kast jäi samaks); täislogo `.logo` viewBox 501 → 525, sama kast ees, sõnamärk
`<g class="lg-word" transform="translate(24 0)">`. CSS: `.sb-top .lg-box rect { fill: currentColor }`,
`.lg-box path { fill:#fff }`; logo kõrgus 27 → 29 px, märk 24 → 26 px. Favicon ja agendi avatar (`I.mark`) puutumata.

## 10.09.2026 (v=408) — demo jälgib PÄRIS aega

Kasutaja: „pane demo kuidagi ka aega jälgima, kui teen pakkumise siis on tänane kuupäev ja samamoodi kellaajad kus vaja."
- **data.js** (IIFE ülaosa): `SEED_ANCHOR` = 10.06.2026 (seemne kirjutamise „täna"), `DEMO_TODAY` = päris tänane
  (kohalik kesköö), `SEED_SHIFT_DAYS`, `TODAY_EE`, `NOW_EE()` („dd.mm.yyyy hh:mm"), `fmtEE`/`fmtISO`,
  `shiftDates(str, days)` (nihutab stringis kõik dd.mm.yyyy JA yyyy-mm-dd, kellaaeg jääb), `shiftDeep`,
  `shiftStoryDates()` — jookseb ENNE `load()`-i: OFFERS, LEASES, TLEPINGUD, AUDIT, KEY_DATES (v.a „(imporditud)"),
  IMPORDITUD ainult `kinnitatud`. Päris lepingute `solmitud`/perioodid/tähtajad/THI (2023–2030) EI nihku.
  Kõik eksporditud `DB`-s; app.js destruktureerib (`DEMO_TODAY, TODAY_EE, NOW_EE, fmtEE, fmtISO, SEED_SHIFT_DAYS`).
- **Salvestatud seis ei nihku** — demo elab edasi päris ajas (pakkumus aegub päriselt); „Lähtesta demo" seemendab
  tänasest. Seega pärast paari nädalat on seemnelugu „vana" — see on teadlik valik (aja jälgimine).
- **app.js:** `DEMO_TODAY`/`TODAY_EE` konstandid ja `fmtEE` duplikaat maas; `parseEE` talub „dd.mm.yyyy hh:mm";
  `aeg: TODAY_EE` → `aeg: NOW_EE()` (68 kohta: audit, lõimed, ettepanekud), `otsusAeg`/`ep.aeg` samuti;
  `loodud`/`joustus`/`esitatud`/`allkirjastatud` jäävad kuupäevaks. Id-aastad `PAK-/LEP-/TL-${aasta}`.
  Pakkumusest lepinguks: algus = järgmise kuu 1. päris tänasest, lõpp + indekseerimine sealt. Lepinguviisardi
  vaikealgus ülejärgmise (üür) / järgmise (tööleping) kuu 1. Täituvuse graafiku 12 kuusilti tuletatud DEMO_TODAY-st.
- Kontroll 10.09.2026 (nihe 92 p): pakkumused 26.08–23.09, PAK-011 aegub 6 p pärast, avalehe „Vajab tegevust" 3
  kirjet, kalender (16.09 + päris 2027–2030), kuusildid okt…sep, uus sõnum „10.09.2026 17:20", uus leping
  LEP-2026-001 01.10.2026–30.09.2031, indeks 01.10.2027; konsool tühi.
- NB seemne kirjutajale: uued seemnekuupäevad kirjuta ANKRU (10.06.2026) suhtes; KEY_DATES `info` tekstid
  („aegub 7 päeva pärast") on staatilised — vajadusel tuleta.

## 10.09.2026 (v=407) — pooleliolevad pakkumused Portfellis + avalehe „Vajab tegevust" lahti

Kasutaja: „Hetkel on keeruline jõuda tagasi pakkumuste juurde, mis on pooleli … kas peaks ka portfellis näha olema?"
- **Portfell → sakk „Pakkumused"** (`#/portfell/pakkumused[/filter]`, sakkide järjekord Lepingud · Pakkumused ·
  Kliendid · Esemed). Loend on JAGATUD `#/pakkumised` lehega: `offerFiltersHTML(f, base)` (filtririba,
  `base` = linkide eesliide) + `offerTableHTML(f)`; `View.pakkumised` kasutab samu. Filtrid (ChatGPT v39x
  `OFFER_FILTERS`): Pooleli (vaikimisi; järjestus ettepanek → mustand → saadetud) · Mustandid · Ootab klienti ·
  Ootab minu vastust · Lõpetatud. Pooleli-vaates olekupilli all **järgmine samm** (`.offer-next`): „vasta
  kliendile" (aktsent) / „saada kliendile" / „ootab klienti · N p". Read `data-pfrow-k` (kiirfiltri jaoks, kui
  otsing sakile lisatakse). Külgriba „Pakkumised" (ChatGPT) jääb otseteeks samale loendile.
- **Avaleht:** „Vajab tegevust" virn (`#ns-attn`, `buildActs` — sisaldas pakkumusi juba: ettepanek ootab vastust,
  aegumas ≤7 p, mustand) on nüüd vaikimisi LAHTI (`.nstack.exp`, „Näita vähem"), sest kokkuvoldituna paistis ainult
  esimene kirje ja kasutaja ei leidnud pakkumusi. Võtmekuupäevad jääb kokkuvoldituks.
- Ülevaate pipeline jääb; nüüd on kolm teed: külgriba, Portfell, avaleht.
- **Testitaristu:** port 8471 oli hõivatud võõra `serve.js`-iga (serveeris git HEAD-iga identset koopiat mujalt —
  ilmselt teise tööriista/kasutaja server, alustatud 14:21). Kontrolliskriptid kasutavad nüüd oma serverit
  (scratchpad `tserve.js <root> <port>`, port 8472, CDP 9334). Ära eelda, et 8471 on sinu töökoopia.

## 08.–10.09.2026 (v=390–406) — teise tööriista (ChatGPT) muudatused, tagantjärele kaardistatud

Detailne sammuajalugu puudub (HANDOFF-i ei täiendatud; ainult README lõik „Objekti lisamine (v399)").
Kaardistatud `git diff a97e1e7` põhjal 10.09.2026; kõik allolev on commit'is koos v368–389 sammudega.
- **Objekti lisamise viisard** `#/objekt-uus` (+ `#/objekt-seaded/:id` muutmiseks, `window.objEdit`): kolm sammu
  Objekt → Pinnad → Seaded (`OBJ_DRAFT`, `objStart`/`objDraw`/`objValidate`/`objCommit` ~app.js:6233+; route
  ~6355). EHR-otsingu mock („Näidise 8"), käsitsi aadress, pindade lisamine + CSV-import (`objParseCSV`),
  PDF-plaanide ja logo üleslaadimine (`objUpload`, ≤1 MB). Sissepääsud: Portfell → Objektid → „Lisa objekt",
  ülevaate objektiplokk (`.obj-add`), ülariba „+ Uus → Objekt". Objektid püsivad `DB.save`-s (`objects` võti
  `thinkone_demo_v1*` all; laadimisel merge `OBJEKTID`-i, data.js). `DB.save` tagastab nüüd true/false
  (kvoodi täitumise kaitse).
- **Külgriba „Pakkumised"** navipunkt (`NAV_OP`, ~6208): loendur = `Mustand` + `Kliendi ettepanek` pakkumused
  („Minu tegevust ootavad pakkumised"). NB: see katab osaliselt kasutaja 07.09 küsimuse „kuidas jõuda
  pooleliolevate pakkumusteni" — Portfelli sakk + avalehe „Vajab tegevust" on veel tegemata.
- **Leivapuru** taas nähtav päises (`.crumb { display:block }` styles.css ~2199 tühistab varasema peitmise ~321).
- **Ligipääsetavus + mobiil:** skip-link „Liigu põhisisu juurde", `aria-label`/`aria-current` navil,
  omniboxil, `main#app-view tabindex=-1`; hamburger `#mobile-nav-toggle` + `.nav-backdrop` + `setMobileNav()`
  (~6591), kitsas ekraanis külgriba sahtlina; omnibox kbd-vihje ⌘K/Ctrl K platvormi järgi.
- **Uue lepingu tüübivalik** (`#/leping-uus`, ~4362): plaadid `.ltyp-visual` illustratsioonidega
  `demo/assets/rbp-describe(-original).webp` / `rbp-generate(-original).webp`; lisaks
  `assets/contract-generator-object.png`, `lease-card-object.png`, `demo/examples/contract-3d-illustration.svg`.
- **Allkirjastamise ikoonid** päris pildid: `I.smartid` → `lisad/smart-id.png`, `I.mobiilid` → `lisad/mobileid.webp`.
- **Kõrvalkulud:** `kkWinter/kkSummer` tagastavad NaN, kui objektil määr puudub; kuva „määramata".
- `tickNumbers` (numbrite tiksumine) eemaldatud. styles.css +286/−115 (mobiil, viisard, ltyp, crumb).
- Kontroll 10.09 headless: `#/`, ülevaade, portfell, objekt-uus, pakkumus, pakkumised, kalender, suhtlus,
  leping-uus, leping (to-lease), mobiil 390 px — konsool tühi, 0 võrguviga.

## 07.09.2026 (v=368–389) — Ülevaate kaardid valgeks; pakkumuse läbirääkimised DOKUMENDI PEALE

- **v368:** v352 värvilised mõõdikukaardid (`met-ink/met-green/met-amber`) tagasi pööratud — kõik neli valged.
- **v369:** kasutaja: „läbirääkimised popup ei ole hea mõte… tahaks samal ajal lepingut näha kui kirjutan.
  Liigutame selle akna üles lepingu peale… see vaate vahetamine tuleks ümber teha." Pakkumusvaates
  (`View.pakkumus`):
  - **Modaal maas** (`#nego-modal`, `.nego-modal/.nego-box` CSS) ja **režiimivahetus maas**
    (`OFFER_NEGO_MODE`, `pakNego`, „Vaata pakkumust"/„Ava läbirääkimised"/„Muuda pakkumust",
    `prop-note` kollased märkmed, külgveeru „Ava läbirääkimised" kaart, `.nego-msg` CSS).
  - Asemel **`#nego-panel`** (`.doc.nego-panel`) dokumendiveeru ÜLAOSAS, pakkumus jääb alla nähtavaks:
    - *Kliendi ettepanek* (mõlemad rollid): alati lahti — lõim (`th-card`) + üürnikul `th-wait` ja
      „Täiendage ettepanekut", operaatoril vastus + „Vasta ja saada pakkumus uuesti" + „Tühista pakkumus";
      operaator kohendab hindu/pindu/eritingimusi sealsamas all (`canEditPrice` kehtib selles seisus).
    - *Saadetud, üürnik*: paneel renderdatud `hidden`-iga; külje „Alusta läbirääkimisi" (`#cl-propose`)
      võtab `hidden` maha, `scrollIntoView` (`scroll-margin-top: hd-h+18px`) + fookus tekstialale;
      X / „Loobu" peidab tagasi. `.reveal` animatsioon käivitub avamisel.
    - „Läbirääkimiste ajalugu" voldik (`negoHist`) kolis `.cl-layout` kohalt dokumendiveergu paneeli ette.
  - Käsitlejad (`resend-offer`, `cancel-offer`, `cl-nego-add`, `cl-propose-send`) muutmata — ainult asukoht.
  - Kontroll headless (op ettepanek, üürnik saadetud enne/pärast avamist, üürnik ettepanek, uuesti saatmine
    → ajalugu voldik): konsool tühi.
- **v370:** külgveeru „Kokkuvõte" oli dokumendist 18 px allpool (mähis `<div style="margin-top:18px">` pole `.card`):
  reegel `.cl-side > .card:first-child` → `.cl-side > :first-child { margin-top:0 !important }`. Mõõdetud: pakkumus
  (3 seisu) ja lepingu vaade (juhtkaart) — dokument ja külg samal y-l.
- **v371:** „Saada ettepanek" (`#cl-propose-send`) lennuki-ikooni asemel nool sildi järel `bic`-kastis (sama keel kui „Saada üürnikule").
- **v372:** operaatori „Vasta ja saada pakkumus uuesti" (`#resend-offer`) oli liiga pikk → „Saada uuesti" + nool `bic`-kastis;
  vastuse väli on otse kohal ja vihjerida all ütleb, et vastus läheb kaasa.
- **v373:** „Saada uuesti" oli 40 px (teised `.btn-sm` 32 px): `.wrap-actions` flex venitas nupu kõrval oleva `.btn-quiet`
  (padding 12px → 40 px) kõrguseks. `.wrap-actions { align-items:center }` — kehtib kõigile 33 kasutuskohale, muudab
  ainult eri kõrgusega naabrite ridu.
- **v374:** „Tühista pakkumus" (`#cancel-offer`) `.btn-quiet` (punane tekst, roosa hover — kasutajale ei meeldinud) →
  `.btn.btn-ghost.btn-sm` nagu üürniku „Loobu"; klõps küsib `confirm`-i niikuinii. Ilma ikoonita `.btn-sm` oli 29 px
  (ikooni/bic-iga 32): `.btn-sm { min-height:32px }` globaalselt — nüüd kõik väikesed nupud ühekõrgused.
  `.btn-quiet` jääb veel „Keeldun" (üürniku otsusekaart) ja „Keela" (agendi loakaart) peale.
- **v375:** operaatori kliendiplokk (mustandis kontaktivorm, hiljem `.cl-blokk` identiteediriba) kolis `.cl-layout`
  kohalt (ulatus külgveeru alla) dokumendiveeru esimeseks plokiks — dokumendi laiuses (768 px), Kokkuvõte/„Kinnita
  ja saada" joondub selle ülaservaga. Mustandi vorm ümber: klient + risk ülal ühel real, kolm välja (`ct-nimi`,
  `ct-epost`, `ct-tel`, id-d samad) all `minmax(200px,1fr)` reana — enne murdus 2+1 ja e-post jäi kitsaks.
- **v376:** „Läbirääkimiste ajalugu" voldik (`negoHist`, nüüd klass `.nego-hist`) dokumendiveerust tagasi `.cl-layout`
  KOHALE — külgveerg joondus voldiku, mitte dokumendi ülaservaga. Lahti olles `max-width: calc(100% - 318px)`
  (= dokumendiveeru laius), alla 1100 px täislaius. Mõõdetud: dokument ja külg samal y-l kinni ja lahti.
- **v377 (TAGASI PÖÖRATUD v378-s):** kasutaja: „Kliendi/Ettevõtte nimi pakkumuse päises on korduv info. Võta see plokk välja." Operaatori
  kliendiplokk MAAS: identiteediriba (`.cl-blokk`/`.cl-mono`/`.cl-ident`/`.cl-sep`/`.cl-risk` markup + CSS kustutatud)
  ja mustandi kaardi nimi/reg-osa. Nimi on H1-s, reg + kontakt dokumendi „Saaja" plokis. **Risk** kolis päise
  paremasse veergu: riskipill oleku pilli kõrval + „Riskiraport" ghost-nupp „Eelvaade" kõrval (ainult operaatoril).
  Mustandis jääb dokumendiveeru ette ainult kontaktiväljade kaart (`ct-nimi`/`ct-epost`/`ct-tel`, käsitlejad samad).
- **v378:** kasutaja: „tegelikult mõtlesin seda kõige esimest headerit, võta eelmine muudatus tagasi." → v377 tagasi
  (kliendiplokk v376 kujul + `.cl-*` CSS HEAD-ist sõna-sõnalt; risk taas plokis) ja pakkumuse LEHEPÄIS MAAS
  (`.page-head`: overline „Hinnapakkumine" + kliendi nimi H1 + „id · loodud · looja"). Ülemine rida on nüüd
  `.between`: tagasi-nupp vasakul; paremal olekupill (vajalik lõppolekutele Tagasi lükatud/Aegunud/Tühistatud, mida
  rada ei näita) · mono-meta „id · loodud · kehtib kuni" · „Eelvaade · prindi / PDF". `o.looja` kuskil enam ei kuvata
  (auditlogis olemas). Mõlemad rollid; üürnikul on pealkirjaks dokument ise. Kontroll headless: op 3 seisu + üürnik.
- **v379:** kasutaja: ülemise rea olekupill + „id · loodud · kehtib kuni" ka maha („taas kordamine ja ajab vaate
  segaseks"). Rida = tagasi-nupp vasakul, „Eelvaade · prindi / PDF" paremal, muud ei midagi. Et lõppolekud ei kaoks:
  olekurada (`.cl-track`) kuvab Tagasi lükatud/Aegunud/Tühistatud hetkesammu sildina klassiga `.end` (punane
  märk, pulss maas; `endSt` mõlemal rajal; `Tühistatud` lisatud `sIdx` kaarti sammule 1).
- **v380:** üürniku otsusekaart: `.btn-soft` („Alusta läbirääkimisi"; ka „Näita dokumenti" lepingu muudatusrežiimis ja
  lõime saatenupp) ilma 1.5px aktsent-rõngata, ainult vari; `.btn-quiet` hover roosast (`--red-soft`) neutraalseks
  (`--surface-soft`), inline-flex + `svg` 15px ikooni jaoks (kehtib ka agendi „Keela" nupule). „Keeldun" →
  „Lükkan pakkumuse tagasi" (vastab tulemolekule „Tagasi lükatud") + uus ikoon `I.x`; confirm-tekst samas keeles.
- **v381:** olekurada (`.cl-track`, pakkumus + leping, markup muutmata) huvitavamaks, ainult CSS: märgid 7/10 → 16 px;
  tehtud = tindine ketas valge LINNUKESEGA (`::after` pööratud servad), hetkesamm = aktsent-/amber-ketas valge
  südamikuga + pulss, tulevane = õõnes ring (`inset` rõngas) ja PUNKTIIR-rööbas (`repeating-linear-gradient`),
  lõppolek `.end` = punane ketas ristiga (`::before`/`::after` bars). Kontroll: ettepanek, aktsepteeritud,
  tühistatud, lepingu 5-sammuline rada.
- **v382–384:** kasutaja: „ei ole centris linnuke, ega täpp." Põhjus: ketas (elemendi taust) ja märk (`::after`
  laps, linnuke pööratud border-karbina) rasterdati eri lähtepunktist, murdosa-piksli x-il (flex-rööpad) nihkusid
  0,5–0,8 px. Lahendus: `::after` maas, ketas JA märk on `i` enda taustakihid — ketas `radial-gradient(circle,
  var(--ink/--accent/--amber/--red) 7.6px, transparent 8.2px)`, täpp `radial-gradient(#fff 2.7px…)`, linnuke/rist
  valge SVG data-URI (viewBox 16, tee 8,8 ümber; linnuke optiliselt 0,4 px üles nihutatud, sest pikem haru kaalub
  massi), tulevane samm õõnes ring gradientina. Mõõdetud pikslitsentroididega DPR 1/1.25/1.5/2: täpp delta 0,
  linnuke ≤0,3 px. ÕPPETUND: headless-profiil (`udd`) cache'is `index.html`-i → versioonitõste ei jõudnud
  kohale; mõõtmisskriptides `Network.setCacheDisabled`.
- **v385–386:** kasutaja: „läbirääkimiste ajalugu ei ole väga märgatav ja on liiga kliendiandmete plokis kinni.
  Kliendiandmed ja riskiraport kujunda/paiguta ka paremini." (1) `.nego-hist` voldik on nüüd KAART (valge, `--edge`,
  `--shadow-sm`, 20 px vahe): päis `details.nego-hist > summary` = ikoonitiil `.nh-ic` + „Läbirääkimiste ajalugu" +
  `.nh-sub` „N sõnumit · viimati kuupäev" (negoAll-ist) + nool paremal (`margin-left:auto`, lahti 90°); lahti olles
  joon päise all, lõim kaardi sees täisläbipaistvusega. NB: selektorid `details.nego-hist …`, sest
  `details.cmt-hist summary` (0,1,2) võitis `.nego-hist > summary` (0,1,1) — hall kiip jäi alles. Lepingu
  punktilõime `.cmt-hist` jääb vaikseks kiibiks. (2) Kliendikaart KAHE reana: `.cl-top` = monogramm · `.cl-name`+reg ·
  `.cl-risk` (pill + Riskiraport) paremal; `.cl-contact` = juuspeen joon + avatar + overline „Kontaktisik" + nimi +
  e-post · tel ühel real. Endine ühe-joone `.cl-blokk`/`.cl-sep`/`.cl-ident` maas (risk murdus 768 px-l orvuks).
- **v387:** kasutaja: „parem paan ka reasta ilusti ühele joonele" — ajalugu-kaart (`negoHist`) taas dokumendiveeru
  ESIMENE laps (v376 vastupidi: siis oli see hall kiip, mille kõrgusega külg ei tohtinud joonduda; nüüd kaart
  kaardiga). `max-width: calc(100% - 318px)` + 1100 px media maas (veerg piirab). NB: `details.nego-hist { margin:0
  0 20px }` — `details.cmt-hist { margin:8px … }` (0,1,1) võitis `.nego-hist` (0,1,0) ja tekitas 8 px nihke. Mõõdetud:
  ajalugu, dokument ja külg samal y-l (228) kinni ja lahti.
- **v388:** ülevaade: kasutaja „Täituvus on kahes kohas üksteise peal … line chart võiks olla täis värviga ümaram joon".
  1. mõõdikukaart „Täituvus %" → **„Vabad pinnad"** (`vabad.length` tk + `vabaM2` m² pakkumiseks, link #/register);
  `pct`/`m2All` View.ylevaade-st maas (hero arvutab ise). Täituvuse graafik (`taituvusCard`): polyline → sujuv
  Catmull-Rom→cubic-bezier `path` (pinge 1/6, viewBox-ruumis; `preserveAspectRatio=none` + non-scaling-stroke),
  ala sama kõvera alla, gradient .42→.16→.04 (enne .18→0), joon 2.5 px. TÄHELEPANEK: seemnes on jooksva kuu
  täituvus 5 % (175/3611 m²) vs ajalugu 30–40 % — graafik kukub juunis järsult; andmeküsimus, mitte UI.
- **v389:** filtrikiibid: kasutaja „filtri transition, tee kiiremaks ja bounce effecti pole vaja lõppu. Täida lihtsalt
  kiirelt filtri pill (pilli servast lõpuni)." `glideTo` — `.pf-views` hostidel (`fill`) pannakse `.g-pill` kohe uue
  kiibi alla laiusega 0 ja CSS `.pf-views[data-glide] > .g-pill { transition: width .18s cubic-bezier(.2,.7,.2,1) }`
  (transform ilma üleminekuta → hüpe, spring maas); kiibi kiri `color .18s`. `.method` allkirjaplaadid libisevad
  endiselt (.5s spring). Mõõdetud rAF-kaadritega: 0→14→28→…→101 px ~180 ms, kohe uues asukohas.

## 05.09.2026 (v=363) — Klauslikiht: kogu lepingu tekst otsingus ja agendis, vaates kokkukeeratult

Kasutaja: vaates ei pea kõike näitama, aga otsingus peab TEADMA kogu lepingu sisu. Tehtud:
- **UUS fail `demo/klauslid.js`** (88 KB, index.html-is data.js järel): `KLAUSLID[id] = { fail, lisa3fail?,
  osad, punktid[] }`, punkt = `{ nr, osa (PT|ÜT|L3|HL|Lisa N), jagu, pealkiri, tekst, lk, muudetud?,
  muudab?, viis? }`. MARU 127 punkti (PT 15 + ÜT 112 + Lisa 3 viis punkti), Caverion 89 (14 jagu +
  Lisad 1–5 tekstiplokkidena). ÜT punktil `muudetud = { lisa:"Lisa 3", viis: lisatud|asendatud|kehtetu,
  nr, tekst }` → `klKehtiv(p)` annab KEHTIVA sõnastuse (5.2 THI, 6.3, 8.2 asendatud; 3.2 täiendatud
  3.2.2-ga; 12.5 kehtetu).
- **Genereerimine:** `tools/pdftext.html` (pdf.js, geomeetriline sõnaühendus — ilma selleta poolitas
  fondivahetus sõnu) → tekst `tools/txt/*.v2.txt` → `node tools/gen-klauslid.js` → klauslid.js.
  Parser: jagu = „N. PEALKIRI" (suurtähed), punkt = „N.N(.N)", PT→ÜT vahetus pealkirjareaga, Caverioni
  lisad „LISA N – …" ühe plokina. Lisa 3 seosed on generaatoris käsitsi (tekst ebaregulaarne).
- **Agent** (`agentPlan`): vabas vormis küsimus (`?` või kas/mis/mida/millal/kuidas/kes/kui/palju…),
  mis pole kanooniline teema (kindlustus/seisus/indekseer/katsea/palga) → `klauslVastus(q)`:
  `klTokens` (stopsõnad + eesliide-tüvestus 4/6 tähte) → `klOtsi` (skoor = tokenite vasted kehtivas
  tekstis + pealkirjas, lepingubias sõnade järgi, lisaplokid −.3) → top 3 tsitaadiga (`klTsitaat`:
  lühike punkt tervikuna, pikk plokk = otsisõnaga lause/aken ellipsitega), viide `klViide`
  „LEP-2023-029 · ÜT p 11.1 · lk 5", kiip „kehtiv sõnastus · Lisa 3", nupud „Originaal · lk N"
  (`openPdf(src,title,page)` → `#page=N`) ja „Ava leping" (`IMP_FOCUS`). Sammud: analüüs (otsisõnad)
  · `klauslid.otsi` · `lisad.kehtiv`; luba ei küsi. Näited: „Kas üürnik võib pinda allüürile anda?"
  → ÜT 11.1; „Mis on Caverioni reageerimisaeg avarii korral?" → Lisa 1 „24/7 … kuni 4 h".
- **Omnibox** (`omniResults`): kuni 3 klauslivastet (`I.file`, „ÜT p 5.2 · üür ja kõrvalkulud"), klõps
  → `omniGo(href, focus)` → leping avaneb ja kerib punktile.
- **Vaade** (`View.imporditud`): `<details class="kl-all">` „Kogu leping punktide kaupa · N punkti …
  sama kiht, millest agent ja otsing vastavad" (vaikimisi KINNI), sees filter `#kl-q` (peidab read/jaod/
  osad) ja `klList`: osa → jagu → read (`.kl-row data-key="ÜT|5.2"`), muudetud punktil kehtiv tekst
  ees + `.kl-old` (algne mahatõmmatud), „lk N" nupp avab originaali õigelt lehelt. `View.imporditud.init`
  (ROUTES sai `init`): filter + `IMP_FOCUS` → ava, keri, `.hl` 2,6 s.
- CLAUDE.md: failide loetelu + „neli *.js viidet, kõik viis sünkroonis".
- **v364:** päise `.omni` sai tumeda varju (1px kontakt + 6px pehme must/hall, sama keel kui „+ Uus"); fookuses rõngas + vari.
- **v365 — kõik `.btn` nupud „+ Uus" keeles:** neutraalne vari (1px kontakt + 4px pehme must/hall),
  hoveril tõus 1px + sügavam vari, active scale .98; ikoon (`.btn > svg`) omaette 22px kastis (raadius 6,
  täidetud nupul hele poolläbipaistev, `.btn-ghost/.btn-soft` hall), `.btn-sm` 18px kast; `.bic` ring
  → sama kast; `:has(> svg:first-child/last-child)` vähendab serva-paddingut 9px-ni. Padding 8/16 (sm 6/12).
- v366 favicon petrooleum/valge PROOVITUD ja tagasi pööratud (revert) — kasutaja: must-valge oli parem. Ära paku uuesti.
- **v367:** `.role-tab` HORISONTAALNE nupp all paremas nurgas (right/bottom 24px, raadius `--r`, ikoon kastis, hoveril tõus), mitte enam serva sakk.

## 05.09.2026 (v=361) — Taevavärava imporditud lepingud PÄRIS dokumentidest

Kasutaja pani `importitud/` kausta kaks päris lepingut (üürileping lisadega + hooldusleping) —
„teeme nende põhjal reaalse näidise Taevavärava alla, muid pole vaja; õiget lepingut peaks saama avada".
- **Failid** → `demo/lisad/importitud/`: `MARU_uurileping_P29.pdf` (8 lk), `MARU_uurileping_P29_lisa3.pdf`,
  `T6B_pind_29_plaan.pdf` (Lisa 1), `P29_parkimine.pdf` (Lisa 2), `Hooldusleping_H5-08.docx` +
  Wordiga eksporditud `Hooldusleping_H5-08.pdf` (18 lk). Tekst loeti pdf.js-iga (ajutine
  `demo/_pdftext.html`, kustutatud); Word COM PDF-i avamine jäi dialoogi taha — ära kasuta.
- **`IMPORDITUD`** (data.js) = AINULT kaks kirjet: `LEP-2023-029` AS Maru Ehitus (Pind 29, 174,8 m²,
  7,60 €/m² → 1 328,48 €/kuus, 7 a alates 25.11.2023, üleandmine 02.01.2024, THI-indekseerimine iga 12 kuu
  esimene 01.01.2025, tagatis 3 kuud korrigeeritakse 02.01.2029, pikendusõigus 5 a järel +5 a, ÜT 12.5
  kehtetu, logo fassaadile; kontaktid Lisa/ÜT p 6) ja `HOO-2023-H508` Caverion Eesti AS (1 104 €/kuus,
  01.06.2023 tähtajatu, 2 kuu etteteatamine, 24/7 ≤4 h, arve 5. kp, viivis 0,01 %/p, hinnad 1× aastas,
  garantii 2 a). Uued väljad: `solmitud`, `allkirjad`, `failid[{nimi,fail,silt,download?}]`,
  `kontaktid[{pool,read[]}]`. Vanad neli näidist (Estplast, Käsitöö Koda, Propert, If P&C) KUSTUTATUD.
- **SPACES:** Pind 7 ja 10 vabaks; UUS `p29` „Pind 29" (Üüritud, AS Maru Ehitus; portfelli rida leiab
  pinna `tenant === pool` järgi). **CLIENTS:** `c-maru`. **KEY_DATES:** 01.01.2027 indekseerimine,
  01.06.2027 hindade ülevaatus (Caverion), 25.11.2028 pikendusõigus, 02.01.2029 tagatis, 25.11.2030 lõpp.
- **`View.imporditud`:** „Lähtedokumendid" kaart avab failid `openPdf`-iga (`.att-pdf` 3D-ikoon, silm),
  docx = allalaadimislink; lisaks „Allkirjad" ja „Poolte esindajad" kaardid; päises „Sõlmitud …".
  Agendi vastused: kindlustust registris pole (viitab MARU + Caverion), indekseerimine 01.01.2027 MARU.
- Tulemus (headless): Ülevaade täituvus 5 % · üüritulu 1 328 €/kuu · 2 aktiivset lepingut; kalender
  1 328 → 1 374 € (+3,4 %); PDF-modaal avab õige faili; kõik 6 faili serveeruvad; konsool tühi.
- **v362 — vaade ümber** („segane, pudruna; Lisa 3 punktid selgelt koondatuna"): „Osaleb / ei osale"
  plokk KUSTUTATUD. Vasak veerg: (1) põhitingimused — kuutasu suurelt (`.imp-hero`, `.pc-big`) +
  ülejäänud `parameetrid` 3-veerulise `.fact-grid` plokkidena (Üür/Tasu/Preemia võti hero's);
  (2) iga `lisad[]` kirje, millel `punktid[]` = eraldi kaart „Lisa N · Eritingimused" nummerdatud
  `.eri-list`-iga (pealkiri + `.chg` kiip „muudab ÜT p X" + tekst) ja „Ava" nupp; (3) „Lisad" kaart
  ainult SISULISTE lisadega (need, mis pole paremal failina — hoolduslepingul 1–5, MARU-l puudub);
  (4) tähtajad `.td-row` + „Ava kalender". Parem: lähtedokumendid, allkirjad, poolte esindajad.
  data.js: MARU `parameetrid` = ainult põhitingimused (12 fakti), Lisa 3 viis punkti `lisad[2].punktid`;
  Caverion `lisad` 1–5 sisukokkuvõtetega.

## 05.09.2026 (v=356) — Aktsent SÜGAV PETROOLEUM (sinep ei sobinud)

Kasutaja: „sinep ei ole ka õige, mis oleks parim aktsent heledale kontrastiks?" → soovitus:
tume küllastunud jahe toon, mis kannab valget teksti (L ≈ 40–48%) ja ei lange staatustega kokku.
Pakutud petrooleum / bordoo / ainult süsimust; valiti petrooleum.
- Tokenid: `--accent #006566` (oklch 45% .10 195), `--accent-hover #005455`, `--accent-deep #005758`,
  `--on-accent #FFFFFF` (valge tekst tagasi). `.btn-loo`/`.role-tab.client` gradiendi hele ots #007F7F.
  rgba(0,101,102,…) rõngastes/varjudes/graafiku täites; ettevõtte vaikevärv `#006566`.
- Hoiatuspere (`--amber*`) TAGASI ookriks (toon 78) — petrooleumiga kokkulangevust pole;
  `mark.hl` tagasi markerkollaseks. Üürilepingu pere `--teal` (205) jäi — aktsendi sugulane.
- Ajalugu: sinine (v≤337) → vask (v338) → sinep (v355) → petrooleum (v356). Ära paku vaske/sinepit
  uuesti; vask ja sinep olid mõlemad liiga heledad, et täidisel valget teksti kanda.
- Kontroll headless: avaleht, pakkumus; konsool tühi.

## 05.09.2026 (v=355) — Aktsent vasest SINEPIKS (merevaik)

Kasutaja: „lets try mustard yellow/amber for accent color".
- Tokenid: `--accent #DEA71D` (oklch 76% .15 84), `--accent-hover #CC9300` (täidise hover),
  `--accent-deep #845B00` (tekst/ikoon heledal), UUS `--on-accent #1F1604` — kollane on hele, seega
  KÕIK aktsent-täidised (nupud, badge'id, send-ringid, stepper, role-tab.client, ::selection,
  `.btn-loo` gradient #EDC23E→accent→hover) kannavad TUMEDAT teksti. Hover-täidised olid
  `--accent-deep` → nüüd `--accent-hover` (deep on tekstitoon).
- Hoiatuspere (`--amber*`) nihutati toonilt 78 → 55 (oranž), et sinepist erineda; `met-amber`
  Ülevaate kaart on sinepitoonis = aktsent (tähelepanu = aktsent, teadlik).
- `mark.hl` (otsingu esiletõst) kollasest → hele mint oklch(91% .09 165), muidu langeks aktsendiga kokku.
- rgba(177,88,43,…) → rgba(222,167,29,…) (14 kohta + `--pulse`), fact-flash oklch(85% .13 86),
  app.js graafiku täide ja ettevõtte vaikevärv `#DEA71D`. CLAUDE.md disainirida uuendatud.
- Kontroll headless: avaleht, pakkumus, ülevaade (graafik sinep), vestluse loakaart; konsool tühi.

## 05.09.2026 (v=352) — Ülevaate mõõdikukaardid sisule vastava taustaga

**TAGASI PÖÖRATUD 07.09.2026 (v=368):** kasutaja palus kaardid valgeks tagasi — `met-ink/met-green/met-amber`
klassid `View.ylevaade` ankrutelt ja CSS-plokk styles.css-ist eemaldatud; kõik neli `.met` kaarti on taas valged.

Täisvärvid (kasutaja ei taha heledaid tinte): `.met.met-ink` Täituvus = `--ink-grad` + valge;
`.met.met-green` Üüritulu = roheline gradient (oklch 57%→46% .12 155) + valge; `.met.met-amber`
Tähtaegu 90 päeva sees = merevaik (oklch 86%→79% .13 85) + tume tekst; Aktiivsed lepingud jääb
valgeks. Klassid `View.ylevaade` met-grid ankrutel.
- **v353:** agendi avatar (`.cm-av`, intro, `.ag-input .spk`) kannab ThinkOne logomärki `I.mark`
  (fill currentColor, viewBox 93×116), mitte sädet; `.entity` pillid raadius 999 → `var(--r)`.
- **v354:** allkirjastamise ootel (`doSign`, nupp #do-sign) kolme vilkuva punkti asemel **shimmer-joon**
  `.shimmer.light` (96×4 rada, 1/3 riba libiseb -100% → 300%, 1,5 s ease-in-out, lõputult —
  kasutaja antud ShimmerLine'i CSS-vaste). Tume variant `.shimmer` valgel. Teised ootekohad
  (`.thinking` punktid: 2293, 3454, 3606) jäid — kandidaat samaks vahetada.

## 05.09.2026 (v=351) — AI-vestlus keskel (nagu Claude): töö käik, tööriista luba, sisend all

Kasutaja: agendi vastus ei tohi avaneda küljel; keskel mõtlemine/protsess, sisend alla; mocki
protsess (otsib pindu, päring ettevõtte kohta …) ja tööriista kinnitus.
- **Vana paremalt libisev `.agent-pop` KADUS** (index.html aside + CSS `.agent-pop .ag-ctx .ag-head
  .ag-x .ag-body .ag-answer .ag-foot` kustutatud). `agentPopOpen()` tagastab false ja
  `closeAgentPop()` on tühi — vanad viited (⌘J, #ai-btn) jäid ohutuks.
- **Uus vaade `#/agent`** (`View.agent`, ROUTES; `dash-shell` kehtib ka seal → päise omnibox
  peidus). Iga sisend (`runAgentPanel`: avalehe komposer, omnibox `omniAsk`, `askAgent`, ⌘J
  `agentSuggest`) → `AGENT.pending` + hash `#/agent`; `View.agent.init` käivitab `agentRun`.
  Tühi lõim = intro „Mida agent oskab" + 4 näidiskorraldust (`AGENT_SUGG`).
- **`agentPlan(cmd)`** (mock): pakkumus → 4 sammu (analüüs · `pinnad.otsi` · `ariregister.otsi` ·
  `hinnakiri.loe`) + luba `koosta_pakkumus`; riskiraport → 4 sammu (äriregister, EMTA,
  krediidiinfo) + luba `koosta_riskiraport`; küsimus (kindlustus/seisus/indekseer/…/„?") → 3
  lugevat sammu, luba ei küsi. Vastus = olemasolev `agentAnswer(cmd)`.
- **`agentRun`:** kasutaja mull paremal (`.cm.user .cm-b`), agendi sõnum (`.cm.ai`): `<details
  class="proc">` „Töötan…" → sammud ilmuvad järjest (spinner → linnuke, detail avaneb), lõpus
  „Töö käik · N sammu · X,X s"; muutev toiming → `.tool-ask` kaart (Luba / Luba selles vestluses
  alati / Keela → `agentDecide(uid, 1|2|0)`, `AGENT.allowAll`); Luba → lisasamm `plan.doing` →
  vastus `.cm-text`, `details` keerdub kokku; Keela → „Selge, jätan tegemata…". Lõpp-HTML
  salvestub `AGENT.msgs` re-renderiks (lehe värskendus = tühi lõim). Vaate vahetus poole pealt
  jätab protsessi vaikselt pooleli (`stepsEl()` guard).
- **Sisend all:** `.chat-dock` fixed (left `--sb-w`, sb-min järgneb), `agentFoot()` `.ag-input`
  + vihje. `.view.chat` padding-bottom 190px. Vastuse „Vastus"/„Tuvastatud olemid" pead
  vestluses peidus (`.ent-head`).
- Kontroll headless: pakkumus (luba → vastus), küsimus (ilma loata), riskiraport omniboxist
  (keela) + jätkuküsimus, tühi intro; konsool tühi.

## 05.09.2026 (v=350) — Filtrikiibid nupuraadiusega, rea-hover lepingupunkti keeles

- Filtrikiibid `.preset-btn .pf-view .pf-search` + liugur `.pf-views .g-pill`: 999px → `var(--r)`
  (10px) — sama raadius kui nuppudel. (Sildid/staatuskapslid `.tag .pill .pc-pill` jäid kapsliks.)
- **Rea-hover** (`.kal-row .sl-row .mall-row .uld-p.clickable .risk-hist .rh .tbl tbody tr.clickable`):
  hall täide maas, asemel `::after` täiteta riba joonte + varjuga nagu `.clause.clickable::after`.
  Reeglid on styles.css LÕPUS (võidavad vanad hover-taustad järjekorraga). Tabelis kannab
  pseudo `td:first-child::after`, `tr` on `position: relative` (Chrome toetab). Avatud ÜT-punkt
  (`.uld-p.open`) ilma ribata. Menüüde/popupite read (om-row, np-item, co-item…) jäid halliks.
- Kontroll headless: portfelli loend (tabelirida), kalender; konsool tühi.

## 05.09.2026 (v=349) — Heledad vasetoonid maas, rollivahetus parema serva sakina

Kasutaja: heledad oranžid varjundid ei meeldi, vaja kontrastsemat; „Vaata üürnikuna" paremasse
serva kleepuvaks, huvitavamaks.
- **Tint-tokenid:** `--accent-soft #EEEBE6`, `--accent-soft-2 #E4E0DA` (soe hall, mitte virsik) —
  kõik valikud/kiibid/faktid/note said automaatselt halli tausta, kontrast tuleb vask-tekstist.
  Eraldi tugevamaks: navi `.count` täis-vask + valge; `.btn-soft` = valge + 1.5px vask-kontuur,
  hoveril täis-vask; oma sõnumid `.msg.me .mb` = `--ink-grad` + valge tekst; stepper `done`
  täis-vask, `current` rõngas `rgba(177,88,43,.18)`; rõngad (`.ladder i.cur`, `.tl-dot`,
  `.dm-attn.open`) rgba-vask; `.fact` hall + `--accent-deep` tekst, sähvatus oklch(78% .11 45)
  → hall; `mark.hl` markerkollane oklch(90% .12 92); `.note` `--surface-soft`; lõuendi
  ülavalgus ja `.obj-add:hover` rgba(177,88,43,…).
- **Rollivahetus `#role-switch`:** külgriba jalusest välja, index.html lõppu `<button
  class="role-tab">`; `position: fixed; right: 0; top: 50%`, ikoon (`I.eye`) + vertikaalne silt
  (`writing-mode: vertical-rl` + rotate 180°, loeb alt üles), raadius ainult vasakul. Operaatorina
  `--ink-grad` „Vaata üürnikuna", kliendina VASK `.client` „Tagasi operaatoriks" (renderShell seab
  innerHTML + klassi). Hoveril libiseb 4px välja. `.sb-switch` CSS kustutatud.
- Kontroll headless: portfell (operaator), pakkumus kliendina (vask-sakk, kontuur-nupp), suhtlus.

## 05.09.2026 (v=342) — Päis kõrgemaks, külgriba valge, tiilid ja aktiivne rida helehallid

Kasutaja: päis kõrgemaks; külgriba päisega sama (valge); tiili ja külgriba taustad vahetusse;
aktiivne rida helehall valgel. (`demo/avaleht-variandid.html` — 10 vaba varianti — kasutajale
ei sobinud ükski; fail jäi jälgimata, ei ole committed.)
- `--hd-h` 72 → 84px. `.sidebar` taust `--surface`.
- `.nav a .ic` taust `--surface-soft`, läbipaistev 1px serv, ilma varjuta; hoveril tiil VALGE +
  `--line-strong` serv + tõus/vari (nagu enne). Aktiivne rida `--surface-soft`, ilma varjuta;
  aktiivne tiil endiselt vask + valge ikoon.
- **v343:** aktiivne rida TÄISLAIUSES — `.nav a.active::after` (left/right -14px üle külgriba
  paddingu, z-index -1; `.nav a` sai `z-index:0`) helehalli taustaga, hairline üleval-all ja SAMA
  varjuga kui `.clause.clickable::after` hoveril; v344: riba TÄITETA (background none) — ainult
  jooned + vari; v345: ka aktiivse TIILI taust maas (`.nav a.active .ic` background none, ikoon
  vaskne). sb-min-is riba peidus (ainult vask-ikoon). v346: külgriba `border-right` maas.
- **v347:** riba (`::after` jooned + vari) KUSTUTATUD — aktiivne = vask-ikoon tiilis ilma taustata +
  paks silt; hover käib aktiivsel nagu teistel. v348: aktiivsel jääb ikooni hover-olek PAIKA
  (valge tiil + `--line-strong` serv + hoveri vari), hoveril lisandub ainult tõus.

## 05.09.2026 (v=340) — Soft-UI navi: ikoon valges tiilis, aktiivne valge kaart vask-tiiliga

Viide: kasutaja kuvatõmmis (Argon/Soft-UI stiilis külgriba). Ainult CSS, markup sama.
- **Külgriba taust** `var(--paper)` (mitte valge) — valged tiilid ja aktiivne valge kaart
  vajavad tooni alla; päis jäi valgeks, juuspeened jooned samad. Padding 14px.
- **Tiil = svg ise** (`.nav a .ic`): 34px, padding 9px, valge taust, `--edge`, pehme vari,
  raadius 10px — replaced-elemendil töötab padding+taust, markupi ei muudetud.
- **Passiivne rida:** ilma taustata, silt 500 (`--ink-2`); **hover:** tiil tõuseb vedruga 2px
  (`--ease-spring`), vari kasvab, ikoon vaskne, silt 3px paremale.
- **Aktiivne:** `background var(--surface)`, silt 700, serv varjuna
  (`0 0 0 1px rgba(10,12,16,.05)` + shadow-sm — mõõt ei hüppa), tiil `--accent` valge ikooniga
  + vase kuma; hoveril aktiivne ei liigu. Loendur passiivsel `--accent-soft/--accent-deep`,
  aktiivsel vask/valge.
- **sb-min:** rida ilma kaardita, tiil 42px (padding 12), gap 8px; aktiivne = vaskne tiil.
- Kontroll headless: portfell, hover (aktiivne + passiivne), kokkutõmmatud; konsool tühi.
- **Proovitud ja TAGASI pööratud (v=341, commit 95b4dee → revert 556248c):** külgriba + päis
  ühes kerges hallis (`--shell #F1EFEC`) ja lõuend heledam (`--canvas #FAF9F7`). Kasutaja:
  „parem oli" — paberitoonis külgriba + VALGE päis + `--paper` lõuend jääb. Ära paku uuesti.

## 04.09.2026 õhtu (v=339) — Klassikaline kest: külgriba + valge päis ühes L-raamis

Kasutaja: „liidaks headeri navbariga kokku klassikaliselt ja header ka valge". Enne: külgriba
hõljuv kaart (20px õhk, raadius, vari), mis kattis 80% täislaiuses toonitud päisest.
- **Mõõdud** (`:root`): `--sb-w 272px`, `--hd-h 72px` (enne 284/96); `--sb-top`/`--sb-m`
  KUSTUTATUD (kasutuskohti polnud). Kokkutõmmatult `--sb-w 76px`.
- **`.sidebar`**: `grid-row 1/3`, `sticky top 0; height 100vh`, margin/raadius/vari maas,
  ainult `border-right: 1px solid var(--line)`; padding `0 16px 18px`.
- **`.sb-top`** (logo + klapinupp): `height: var(--hd-h)`, `margin: 0 -16px`, `border-bottom`
  — logorea joon jätkab päise joont üle kogu laiuse (üks L-kujuline valge raam). `.nav`
  margin-top 22px. sb-min: veerg, gap 2px (24px märk + 42px nupp mahub 72-sse).
- **`.topbar`**: `grid-column: 2` (külgriba KÕRVAL, mitte all), valge `var(--surface)`,
  `border-bottom: 1px solid var(--line)`, blur/vari/toon maas, padding `0 24px 0 28px`.
- Päise sisu valgel taustal: `.omni` = `--surface-soft` väli läbipaistva servaga, fookuses
  valge + `--line-strong` + shadow-sm; `.top-actions` flat (ilma kapslita); `.top-qa`
  kapsel `--surface-soft`, ilma varjuta.
- `.view` ülaõhk 100px → 52px (päis ei kata enam sisu). `.cl-side` sticky top 115px jäi (> 72).
- Kontroll headless: avaleht, portfell, kokkutõmmatud külgriba, pakkumus keritult; konsool tühi.

## 04.09.2026 õhtu (v=338) — Vask-aktsent, päise kontrast, „+ Uus" nupp, navi hoverid

Kasutaja: värvid häirisid — sinise aktsendi asemel midagi muud, päisele natuke kontrasti, Uus-nupp
huvitavamaks, navi hoverid ilma taustata + ikoonianimatsioon. Valik (AskUserQuestion): VASK.
- **Aktsent → vask** (`:root`): `--accent #B1582B` (oklch 56% .13 45), `--accent-deep #8A3F17`,
  soft/soft-2 oklch 91%/.04 ja 87.5%/.052 toonil 45. Punane hoiatuspere nihutati jahedamaks
  (toon 28 → 17), et vasest erineda. `--ink-grad` sinakast mustast SOOJAKS (#2F2A25→#0E0C0A).
  Kõvakodeeritud sinised asendatud: `rgba(0,89,207,…)` → `rgba(177,88,43,…)` (fookusrõngas,
  läige, pulse, stepper, fact-flash), `#86B5EC/#DCE9FA` → `#EFAC8D/#FDE1D5` (.fact), lõuendi
  ülavalgus `rgba(184,212,245)` → `rgba(244,197,177)`, varjud `rgba(30,37,52)` → `rgba(40,34,28)`,
  `.note` taust blue-soft → oklch(95.5% .024 45). app.js: täituvusgraafiku täitegradient ja
  ettevõtte vaikevärv `#0059CF` → `#B1582B`. `--blue` (259) jäi AINULT info-staatusele
  (pill.blue, icotile.t-off, kd-ic.blue, th-stamp.info); „Imporditud" on petrooleum, mitte sinine.
- **Päis** (`.topbar`): `rgba(232,227,220,.9)` + `inset 0 -1px 0 rgba(22,21,18,.08)` — tumedam
  soe riba, kaardid hõljuvad selle peal.
- **`.btn-loo` („+ Uus")**: ainus vask-täidisega nupp — 135° gradient (#CB6C3C → accent → deep),
  ülaserva valgusjoon, vase kuma; hoveril tõuseb 1px, `::after` läige pühib üle (.6s), pluss
  pöörab 90° + scale 1.15 (vedru `--ease-spring`); `.open` = 45° rist võidab hoveri.
  reduced-motion: läige ja tõus väljas.
- **Navi hover** (`.nav a:hover`): taust puudub; ikoon `translateY(-1px) scale(1.2) rotate(-8deg)`
  vedru-overshoot'iga + värvub vaskseks; silt nihkub 3px paremale. Aktiivsel (must plokk) ikoon
  jääb valgeks. reduced-motion guard.
- Kontroll headless (hover CDP `Input.dispatchMouseEvent` kaudu, shot.js `--hover=x,y`):
  avaleht, pakkumus, ülevaade (graafik vask), portfell; konsool tühi.

## 04.09.2026 õhtu (v=337) — Raadiused alla: kaardid 12px, nupud ümarnurk

Viite (`examples/`) järgi: kaart 12px. Nupud olid kapslid (999px) → ümarnurk.
- **Skaala** (`:root`): `--r-sm 8 · --r 10 · --r-lg 12 · --r-xl 14` (enne 9/14/20/24).
  Kõvakodeeritud väärtused nihutati astme võrra: 22→14, 20/18/16→12, 14/13/12→10, 11/10→8,
  ≤9 jäid; vestlusmullid `10px 10px 4px 10px`. app.js inline: skel 999→10, kontoloome kast
  12→10, textarea 10→8, 4648 kast 12→10.
- **Nupud → `var(--r)`** (10px): `.btn .btn-loo .sb-switch .btn-quiet .nav a .sb-item .top-qa a
  .qa a .dm-attn .tabbar a .pf-mode button .suh-foot input`; väiksed → `var(--r-sm)`:
  `.btn-sm .uld-send .eri-ky .price-in`. Kapselgrupid nuppude ümber (`.top-qa .top-actions
  .tabbar .pf-mode`) → `var(--r-xl)` = sisu 10 + padding 4.
- **Kapsliks JÄID** (nagu viite kiibid): `.tag .pill .pc-pill .preset-btn .pf-view .pf-search
  .entity .pipe-step .dm-chip .role-chip .kd-date .hbubble .toastx`, badge'id/kbd, ringikujulised
  ikoon-nupud (`.comp-send .comp-ic`, 50%). Teadlik valik: kiip = kapsel, nupp = ümarnurk.
  Portfelli filtrikiibid (must aktiivne kapsel) vs sakiriba (must ümarnurk) — kui häirib,
  kandidaat: `.preset-btn/.pf-view` + `.pf-views .g-pill` → `var(--r)`.
- Kontroll headless: avaleht, pakkumus, portfell, ülevaade — konsool tühi.

## 04.09.2026 õhtu (v=336) — Pakkumuse külgveerg disainiviite järgi

Viide `examples/rent_offer_full_panel_arrow_button.html` (Kinnita-nupp noolega, Kokkuvõte,
Lisad 3D-PDF-ikoonidega). Muudatused ainult pakkumuse vaate külgveerus (`View.pakkumus`):

- **Saatmisnupp:** „Kinnita ja saada" + `I.arrow` (klass `.arr`, 17px) — enne `I.send` +
  „… kliendile". Alltekst sama.
- **`priceCard(t, vat, cls)` → Kokkuvõte-kaart** (`.pc`): pealkiri `.side-h`, silt
  `.pc-lbl` „Üür kuus (bruto)", suur number `.pc-big` (displeikiri nagu Ülevaate hero-big,
  32px, `--accent-deep`), `.pc-sub` „sh käibemaks 24% · …", `.pc-hr`, read `.pc-row`
  (silt + mono-arv; valikuline `.pc-calc` teine rida), kõrvalkulud `.pc-pill` kiipidena
  (Talv/Suvi €·€/m², Elekter A, N parkimiskohta — 0 → kiip peidus), `.pc-note`.
  Variandid: ÜKS pind = viide 1:1 (Pind · m² / Hind · €/m² / Üür kokku (neto)); MITU pinda =
  iga pind oma rida (€) + calc-rida „m² × €/m²", neto-real m² kokku; ASTMELINE = suur number
  kaalutud keskmine („· 60 kuu keskmine"), pinna all perioodiread, mitme pinnaga lisaks
  „Kokku <periood>" read (ühe pinnaga ei dubleerita). Live-recalc id-d: `pc-hind-<sp>`,
  `pc-rent-<sp>` (ainult mitme pinnaga), `pc-net`, `pc-vat`, `pc-gross` (astmelisel
  puudub — täisrender). Vana `.price-row` CSS jäi alles (kasutuseta pakkumuses).
- **`lisadCard(t, cls, style)`** — jagatud operaator + klient: `.att.att-pdf` rida,
  `I.pdf3d` (56×64 svg, klass `.pdf3d` 28×32) + „Lisa N · <span class=muted>· nimi</span>"
  + `I.eye` (`.att-eye`, hoveril tumeneb); fail puudu → `.nofile` + „lisamata" silt, ikoon
  hall. `data-hglide` veerev hover jäi. Ülejäänud lisa-read (pinna vaade, wizard, lepingu
  Lisad) on ENDISELT `I.file` + „PDF · vaata" sildiga — kandidaat ühtlustamiseks.
- Uued ikoonid `I.eye`, `I.pdf3d`. Kontroll headless Chrome'iga (laiendus ühendus katkes
  ekraanipildi ajal): mustand, 2 pinda, astmeline, live-recalc (9,00 → 2862/686,88/3548,88),
  kliendi vaade, PDF-modaal klõpsul; konsool tühi.

## 04.09.2026 sessioon (v=335) — Ülevaade skoobi, vertikaalide ja skaleeruvate objektidega

Kasutaja mure: Ülevaate mõõdikud käisid vaikimisi kogu ettevõtte kohta, ilma et keegi
ütleks mille kohta; mitme objektiga (B11G) või kümnete ühe üürnikuga objektidega
(erakinnisvara) see ei skaleeru; teised lepingutüübid (teenus, laen …) ei mahtunud kuhugi.
Otsused: kolmandat ettevõtet EI lisatud (struktuur olemasoleva kahe peal), mõõdikute rida
jäi visuaalselt samaks, skoop = märgistatud koondvaade + objektivalija, objektid kaardid ≤3.

- **Skoop** (`ylScope(oid)`, app.js): `#/ylevaade` = kogu portfell, `#/ylevaade/<objektId>` =
  üks objekt (ROUTES `key: "ylevaade"` → vaikne re-render). Tagastab filtreeritud `spaces /
  offers / leases / imports / keyDates / tlepingud`; KÕIK mõõdikud, `taituvusCard(sc)`,
  pipeline ja plokid loevad ainult skoobist. Vale id → kogu portfell. Päises `ylScopeCtl`:
  üks objekt → staatiline `.tag`; mitu → `.preset-btn#yl-scope-btn` + `.drop.drop-l` menüü
  (`.page-head` sai `position:relative; z-index:5`, muidu jäi menüü reveal-kaartide alla).
  Objekti-skoobis on „Objektid" ja Personal peidus; hero „Pinnad →" viib objektile.
- **Lepinguliik → vertikaal** (`LIIGID` + `VERTIKAALID`, app.js algus): Üüri→kinnisvara,
  Haldus/Hooldus/Kindlustus/Valve/Teenus→teenused, Töö→personal, Laen→finants. Ülevaate
  plokid on funktsioonid, mis tagastavad `""` andmeteta: `teenusedBlock(sc)` (UUS: Lepinguid ·
  Kulu €/kuu · Järgmine otsustuskoht päevades; kaardid viivad Portfelli `pfPresetType`
  eelvalikuga), `personalBlock()`. Portfelli tüübikiibid (`PF_TYPES`) genereeritakse samast
  konfiguratsioonist ja paistavad ainult ridade olemasolul; aktiivne kiip ilma ridadeta langeb
  „Kõik" peale. Uus lepingutüüp = üks rida `LIIGID`-is (+ soovi korral oma plokk).
- **Objektiseosed:** `impObjektid(x)` (`x.objektId` string|massiiv, muidu tekstivaste `ese`
  vs objektinimed — kõik seemned lahenevad tekstist, seemneid ei muudetud), `kdObjektid(k)`
  (`kdDocRef` + `kdHoone` peal; parandas objektikaardi „Järgmine tähtaeg", mis enne leidis
  ainult üürniku nime järgi), `impKuutasu(x)` (Üür/Tasu/Preemia, €/aastas → /12 — kindlustus
  näitab nüüd 320 €/kuu), `impJargmine(x)`. Ristobjekti leping (B11G hooldus) näitab
  täissummat kummaski objekti-skoobis — teadlik.
- **Objektide plokk** `objektidBlock(objs, withAdd)` (jagatud Ülevaade + Portfell › Esemed,
  alam-sakk „Hooned" → „Objektid"): ≤`OBJ_CARD_MAX`=3 kaardid (`objStats(o)` jagatud), ≥4
  kompaktne `.tbl` loend (Üksused · täituvusriba · Üürnik/vabad — ühe üksusega objektil
  üürniku nimi · €/kuu · järgmine tähtaeg) + `.pf-search#obj-q` kiirfilter
  (`wireQuickFilter`, sama abi nüüd ka `#pf-q` all). Loendirežiim pole seemnetega nähtav —
  testimiseks brauseri konsoolis `DB.OBJEKTID.push({id,nimi,ehr:{aadress}})` + `DB.SPACES.push
  ({…objektId})` → `router()`; reload puhastab (objektid ei salvestu).
- data.js: B11G objektidel `taituvusAjalugu` (11 väärtust, nagu `TAITUVUS_AJALUGU`; `KUUD_LBL`
  on 11+1 külge kirjutatud); `objektAjalugu(o)` langeb ettevõtte koondile.
- Kontroll käis headless Chrome'iga CDP kaudu (Chrome-laiendus polnud ühendatud) — mõlemad
  ettevõtted, mõlemad objekti-skoobid, vale id, kiibid, 5 ajutise objektiga loend; konsool tühi.

## 02.09.2026 sessioon (v=296 → v=332) — high-end motion-pass (beui), voopoleerimised

**Liikumiskeel (beui vanilla-tõlked, kõik reduced-motion guardidega):**
- **TOAST STACK** (`toastx`/`TOASTS`/`toastLayout`): teated virnas, uusim ees,
  hover laotab, klõps sulgeb; API `toast(msg)` sama.
- **AVANEMISKOREOGRAAFIA**: reveal = tõus+blur AINULT vaatevahetusel;
  `#app-view.re-render` summutab sama vaate uuesti-renderduse animatsioonid;
  `route.key` (portfell/lepingud/pakkumised/kalender/suhtlus) — filtri-alamtee
  EI ole vaatevahetus (ei keri üles, ei koreografeeri). `scrollTo(0,0)` ainult
  vaatevahetusel — tegevused jätavad kasutaja paigale.
- **LIUGURID**: dokumendivalija `dpGlide` (vertikaalne, mäletab üle renderduse);
  üldine `[data-glide]`+`glideTo/GLIDES` (pf-sakid, kalendri/pindade filtrid,
  allkirjameetod); hover-liugur `[data-hglide]`+`.hg-pill` (pakkumuse lisade read).
- **TEAVITUSVIRNAD avalehel** (`nstack`/`nsLayout`): Vajab tegevust + Võtme-
  kuupäevad = kaardipakid toonitud ALUSPLAADIL (beui notification-stack), hover
  laotab ÜLEKIHINA (`ns-slot` hoiab layout-kõrgust, dataset.h mõõdetakse ÜKS kord),
  beui-tempo ease-out (.16,1,.3,1). Avaleht: 4 kiirkaarti → `dm-chips` viibad
  komposeri all.
- Muu: `tickNumbers` (mõõdikud loevad üles), dokumendikandik `#a4-wrap` (double-
  bezel), `.stat`/`lepStatRow` võtmefaktid (Tehing-kaart läbirääkimistel, signCard,
  signPanel), nool-kivi `.bic` KÕIGIL CTA-del (saatmine=nool), `.doc-top`
  „algusesse" nupp (Kehtiv+Allkirjastamisel eelvaade, all keskel).

**Maitse-audit (v296):** puhas #000 → soe süsimust `--ink:#161512`;
gradiendi ots #070A0F. Teadlikud erandid kirjas commitis (eesti mõttekriips jääb;
overline'id on toote-UI; oma SVG-ikoonid jäävad).

**Pakkumuse vaade:** eritingimuse lisamine steplink-kirjutajaks; priceCard read
kahetasandiliseks (grid-areas — ei murdu 300px paanis) + kõrvalkulud kv-tabelina;
kliendiplokk (saadetud+) identiteediribaks (`cl-blokk`: monogramm+nimi+kontaktisik
th-av märgiga+risk). **Pakkumuse läbirääkimine lepinguga samas keeles:**
`OFFER_NEGO_MODE` — Kliendi ettepaneku seisus KESKEL lõim (thSkin/thHead kaardid,
`.nego-thread` konnektoriteta), operaatoril vastus+„Muuda pakkumust"+Tühista
lõimes, „Vaata pakkumust" ↔; klõpsatav bänner tagasiteeks MÕLEMAL rollil;
negoCard külgpaanist maas; pärast uuesti saatmist `negoHist` voldik layout'i
KOHAL (täislaius — külg joondub dokumendiga).

**Portfelli kaardid:** m²+€/m² kaardil, `pf-time` perioodiriba (kui palju käes),
hover-tõste; laiendus EI korda kaardi infot (ainult tagatis/indeks/kontakt/samm).

**Lepingu vool:**
- Otsusekaardid: külgtriip → **OTSUSETEMPEL** `.th-stamp` (topeltraam, kalle;
  wait=katkendjoon).
- Kommentaari muutmine/kustutamine ikoonidena (`th-tools`, hoveril aja asemel;
  oma sõnum, kuni Ootel; avakommentaari kustutus ainult enne vastuseid).
- **VASTAMISMUDEL (v330, kehtiv!)**: katsetused v326–v328 (üürnik sulgeb „Sain
  vastuse") PÖÖRATI TAGASI (tekitasid lisaringi — üürnik sulges op lubaduse
  peale). Lõplik: operaatoril ÜKS „Vasta" + linnuke „sulge punkt selle
  vastusega" (`res-close-chk`) → sulgeb KOHE Selgitatuna (kinnitusringi pole);
  üürnik saab selgitusega suletud punkti VASTATES taas avada (vana selgitus
  kolib arutellu, punkt → Ootel). Kinnitatud/Tagasi lükatud lukus.
- Juhtkaart: Allkirjastamisel ilma nuputa (tegevus kohe all); „Saada üürnikule"
  kivis nool (mitte lennuk).

## 01.09.2026 sessioon (v=293 → v=295) — MVP kärbe, kujundusgalerii, OKLCH-palett, puhas portfell

**MVP 1. etapp: töölepingute vertikaal VÄLJAS (v=293):** `AMETIKOHAD`/`TLEPINGUD`
seemned tühjad (sisu git-ajaloos, v=292 seis), KEY_DATES katseaeg/palk maas.
Kõik UI-plokid gate'itud `.length` taha (tühjana peidus, andmete tagasitulekul
ärkavad): registri osakonnakaart+tabel, Lepingud-vaate TL-sektsioon, wizardi
Tööleping-kaart, portfelli TL-filter + Ametikohad-sakk, kliendivaate töötajad,
kalendri katseaja/palga filtrid, AI katseaja-vastus, teavituste read. Mootor
(View.tooleping, tlWiz, helperid, TL_ULD) jääb koodi uinuma.

**Kujundusgalerii `demo/kujundus.html`:** disainilabor — iga komponent kõigis
olekutes, lingib SAMA styles.css-i ajatempliga (alati värske, cache-bump pole
vaja). Sektsioonid: tokenid, tüpograafia, nupud, pillimaatriks (stIcon/pill
KOOPIA app.js-ist — kui app.js-is muutub, uuenda galeriis!), juhtkaart, kaardid,
dokumendiread, täislõim, Lahenda, vormid, külgpaan, tabelid, A4, mikro.
Karkass kg-prefiksiga. Töövoog: CSS-muudatus galeriis = muudatus demos;
markup-muudatus viiakse app.js-i samas commitis.

**Palett harmooniasse (v=294):** tokeniplokk OKLCH-astmetena — iga staatuspere
SAMA heleduse/küllastusega: base `oklch(54% .115 H)` · ink `oklch(41% .095 H)` ·
soft `oklch(95.5% .024 H)`; toonid: sinine 259 (aktsendist), roheline 155,
ooker 78 (base 58% — teadlik erand, kollane loeb tumedamana), punane 28,
violett 295. Staatussinine #2A77C6 → aktsendi toonist; accent-soft = eraldi
INTERAKTSIOONITINT (valikud/chipid/btn-soft), rahustatud B8D4F5 → oklch(91% .045).
Aktsent #0059CF ja soojad neutraalid JÄID (bränd). Timmimine = üks number reeglis.

**Puhas lepinguportfell (v=295):** LEASES seeme tühi — lepingud sünnivad demo
käigus. Kaks Aktsepteeritud pakkumust teisendamiseks valmis (PAK-2026-003 Baltic
p1, PAK-2026-007 Nordproff p4 + eritingimus kaasas); pinnad p1/p4 → Pakkumusel;
KEY_DATES/AUDIT lepinguviited koristatud. IMPORDITUD portfell jääb (impordi
demo). Vana localStorage vajab „Lähtesta demo".

## 28.08.2026 (v=291) — allkirjastamismeetodid: eIDAS maha, kaks kompaktset plaati

**eIDAS eemaldatud** (nupp + `leaseSheetHTML` allkirjaploki tekst „(Smart-ID / Mobiil-ID)").
Alles Smart-ID (vaikimisi) + Mobiil-ID.

**Kujundus:** kolm suurt keskjoondatud kasti (16px padding, accent-soft valikutaust) →
kaks kompaktset plaati `grid 1fr 1fr`: ikoonikivi + nimi + saba, padding 8/10px.
Valikukeel sama mis „Lahenda" ridadel — valitu on VALGE kaart tindiservaga (varem sinine
täidis), ikoonikivi kasvab vedruga. Reduced-motion guard olemas.

**Ikoonid** (`I.smartid`, `I.mobiilid`) on maja OMA ikoonikeeles, MITTE brändimärgid:
Smart-ID = nutitelefon linnukesega (roheline), Mobiil-ID = SIM-kaart (sinine). Päris
brändilogosid repos pole; kui kasutaja need annab, käib sama muster mis hoonelogodel —
fail `demo/lisad/`-i ja `<img>` ikooni asemel.

## 28.08.2026 (v=290) — „Lahenda" valikud: selgitused tooltipi taha + elu sisse

Operaatori `.res-opt` read olid kaherealised (pealkiri + `<small>` selgitus) — kolm
valikut lugesid tekstiplokina. Nüüd **üherealised: ikoonikivi · pealkiri · info-ikoon**,
selgitus elab `.tip[data-tip]` tooltipi taga (sama muster kui indekseerimise kaardil oli).
Ikoonid: `I.chat` vasta · `I.edit` muuda · `I.spark` eritingimus. Tooltipi tekstid on
ümber kirjutatud (mida valik TEEB), form'i enda vihjeread jäid (mida iga nupp teeb).

**Animatsioon:** (1) valitud rea ikoonikivi läheb tumedaks ja kaldub vedruga
(`--ease-spring`, rotate -6° scale 1.08); (2) üle valitud rea jookseb ÜKS õrn sinine
valgusviirg (`res-sweep` — animeerib `background-position`, MITTE transform'i: nii ei vaja
rida `overflow:hidden`'it, mis lõikaks tooltipi ära); (3) vormi read tõusevad trepiga
(`#res-form > *` rise + nth-child viide) ja paneel ise avaneb rise'iga.
Kõik reduced-motion guard'i taga.

## 28.08.2026 (v=289) — pillid taustata, „Lahendamisel" ainus täidetud

Kõik staatusepillid (Kehtiv, Saadetud, Kinnitatud, Arutelul, Ootel, Imporditud …)
kaotasid halli kapsli: `.pill { background: none; padding: 0 }` — alles jäid edenemisringi
ikoon + värviline kiri. Hall kapsel lisas igale reale kasti, mida sisu ei vajanud.

**Erand:** `PILL_FILL = { "Lahendamisel": 1 }` (app.js) lisab klassi `.fill` →
must taust + valge kiri. Põhjus: dokumendireal on lahtise punkti riba nüüd peaaegu valge
(#FBFBFB, v=281), nii et pill on ainus signaal ja peab silma torkama. `.pill.fill` peab
CSS-is olema PÄRAST värviklasse (`.pill.ink` jt), muidu võidab must kiri valge asemel.
NB: `.tag` (kategooriasildid „Üürileping", „5 punkti") jäid kapsliks — nii tekib
kontrast: tag = silt, pill = seis.

## 28.08.2026 (v=288) — „kelle kord" ka lõimes: üürnik ei kirjuta monoloogi

**Probleem:** kui punkt ootas üürileandja vastust, sai üürnik ikka juurde kirjutada —
tekkis ühepoolne jutt, millele keegi ei vastanud, ja juhtkaart ütles „Ootab üürileandjat",
samal ajal kui lõim kutsus vastama.

**Reegel — VIIMANE SÕNA otsustab** (`cmtOotabOp(c)`): kui lahtisel („Ootel") punktil oli
viimane sõna üürniku oma (või arutelu on tühi), on pall ÜÜRILEANDJA käes; kui üürileandja
küsis arutelus viimasena, on kord üürnikul.

- **Lõimes:** pall üürileandja käes → tekstiala + „Vasta" nupu asemel vaikne teade
  `.th-wait` (liivakell + „**Ootab üürileandja vastust** — saad teate, kui ta vastab").
  Üürileandja küsimuse järel tuleb sisend tagasi.
- **Juhtkaart:** vana `ootel` loendur jagunes kaheks — `opOotel` (pall üürileandjal) ja
  `kliOotel` (kord üürnikul). Üürnikul lisandus „Sinu kord · Üürileandja ootab sinu vastust
  N punkti arutelus" + `Ava ja vasta`; operaatoril „Ootab üürnikku · N punkti ootab üürniku
  vastust arutelus". Kehtiva lepingu haru sai sama jaotuse.
- **`nextOpenRef`:** operaatoril nüüd `cmtOotabOp` (mitte iga „Ootel"), üürnikul „Ootab
  kinnitust" VÕI arutelu, kus üürileandja küsis viimasena — nii leiab „Ava ja vasta" sihi.

NB: portfelli/teavituste „Ootel" loendurid jäid endiseks (need on lahtiste punktide
loendid, mitte kelle-kord juhis).

## 28.08.2026 (v=287) — sektsiooninumber tumedaks

Lepingu sektsioonikivi (`.sec-h .sec-n` — „1. Pooled", „2. Üüripind" …) sinisest
(accent-soft/accent-deep) → tume taust + valge number. Toon elab nüüd tokenis
**`--stone: #515151`**, mida jagab ka `.overwrite` märgis (v=284).

## 28.08.2026 (v=286) — kommentaarilõim: osapool loetav ilma nime lugemata

**Probleem:** sama osapool nägi lõimes välja kahte moodi — üürniku avakommentaar oli
VALGE äärisega kaart, tema arutelu-vastused AMBER (`.th-op.tk`), operaator hall. Amber on
majas staatusevärv (Ootab kinnitust / Arutelul), nii et autorsus luges staatusena. Ikoone
polnud üldse — kes räägib, sai teada ainult nime lugedes.

**Uus keel (`thTenant`/`thSkin`/`thHead` app.js-is):**
- **Üürnik** = hall kaart (`.th-tenant`, surface-soft, ääriseta) + HELE märk (valge ring,
  peen serv, `I.user`).
- **Üürileandja** = valge kaart (`.th-lessor`, edge + shadow-sm) + TUME märk (ink-grad
  ring, `I.building`) — dokumendi enda hääl.
- Kaardipäis ümber ehitatud: märk · nimi (ilma „(üürnik)" sabata) + rolli mikrosilt
  („ÜÜRNIK" / „ÜÜRILEANDJA", `· sina` aktiivse rolli juures) · aeg. Vana `.who` rida maas.
- Staatusevärvid jäävad AINULT staatusele — osapoolt need enam ei märgi.

**Klassid korda:** `.th-op` (nimi valetas — tähendas trepi-geomeetriat, mitte operaatorit)
→ **`.th-step`**; `.tk` modifikaator kadus (asendab `.th-tenant`); surnud `.thread .th-form`
(v249-st) ja kasutuseta `.cmt .who` kustutatud. Otsusekaardi staatuseriba 2px → 3px ja
kombineeritud kaardivarjuga (`inset 3px 0 0 var(--green), var(--shadow-sm)`).

**Staatus:** „Arutelul" lisatud STATUS + PILL_SHAPE kaartidesse (amber · quarter-ring) —
varem oli `pill("Arutelul","amber")` kõvakodeeritud ja ainus pill kogu äpis ILMA
edenemisringi ikoonita (kukkus `<i class="dot">` peale).

## 28.08.2026 (v=285) — juhtkaardi pealkiri taustata

`.g-kes` („SINU KORD" / „OOTAB ÜÜRNIKKU") kaotas pilli tausta: must kiri (wait-olekus
hall), 10px → **13px**, letter-spacing .08 → .06em, padding/raadius maas. Tume pill
võistles kaardi rohelise nupuga — nüüd on kaardil üks tegevusvärv.

## 28.08.2026 (v=284) — ülekirjutuse märgis tumehalliks

`.overwrite` kapsel („kirjutab üle: …", „muudetud läbirääkimisel → Lisa N") sinisest
(accent-soft/accent-deep) → **taust #515151, tekst valge** — sinine luges tegevusena,
hall kapsel on faktimärgis.

## 28.08.2026 (v=292) — silm → kompass; „kelle kord" tagasi mikrokirjaks

**Silm asendatud KOMPASSIGA** (`.g-nav > i.g-needle`, vana `.g-eye`/`.g-pupil`/`eye-blink`
kustutatud): nõel = kaks kolmnurka tipp-tipi vastu (tume ots juhib, hele saba,
keskel neet) ja OSUTAB kursori suunas — „süsteem näitab, kuhu minna" istub juhitud
voolu keeles paremini kui vaatav silm. Ootel-olekus (`.guide.wait`) nõel ei järgne,
vaid triivib vaikselt ±14° (`needle-drift` 9s) ja tipp on hall — otsib suunda.

NB app.js kuularis: nurk kerib „lahti" (`a += Math.round((prev-a)/360)*360`), muidu
teeks nõel 179°→−179° hüppel terve tiiru. Reduced-motion: kuular ei käivitu, triivi pole.

**`.g-kes`** („SINU KORD") 13px → tagasi **10px** / .06 → .08em (v=285 suurendus tagasi
võetud); taustata jäi.

## 28.08.2026 (v=283) — juhtkaardi silm

Juhtkaardi pilli ees on nüüd SILM (`.g-top > .g-eye > i.g-pupil`, aria-hidden):
„Sinu kord" olekus avatud silm, mille PUPILL JÄLGIB KURSORIT (globaalne rAF-throttle'itud
mousemove app.js lõpus — selector `.guide.me .g-pupil`, max nihe 4px, lähedal vaatab
otse `d/16` kaudu) + pilgutab iga 7s (`eye-blink` keyframe); „Ootab teist poolt" olekus
silm PUHKAB suletud lauga (`.guide.wait` — pupill peidus, kumer laug ::after).
Reduced-motion: pupill paigal, pilgutust pole. Puhas dekoratsioon, tekst ei sõltu sellest.

## 27.08.2026 õhtune sessioon (v=279) — kujunduse kooskõla-pass

**Eesmärk:** „konstantne ja ühtlane" — kogu CSS üle käidud, detailimõtted beautifului.dev
vaimus (ühtsed mikrointeraktsioonid, kontsentrilised raadiused, üks fookuskeel).

**Uued tokenid (:root):** `--ease` + `--ease-spring` (KÕIK cubic-bezier'id nüüd tokenil —
NB: replace ei tohi tabada definitsiooni ennast), `--focus-ring` (sinine 3px rõngas),
`--scrim-bg` (kõik 4 modaalikatet ühtsed: sama toon + blur(3px)), `--accent-soft-2`
(#A6C7EF — btn-soft/sb-switch hover), staatuspere tumedad astmed `--green-deep`,
`--green-ink`, `--amber-ink`, `--red-ink` (ink = tekst pehmel taustal; ka app.js
inline-stiilid kasutavad). **Magenta tokenid + `.pill.magenta` KUSTUTATUD.**

**Ühtlustused:** kõik mikro-hoverid .12–.18s → **.15s** (chevron-pöörded .2s, paneelid
.22s+); SISESTUSVÄLJADE FOOKUS ÜKS KEEL — accent-serv + `--focus-ring` (varem pooltel
hall serv + suur ripp-vari: field/eri-in/ce-in/price-in/ag-input/risk-search/suh-foot/
eri-ky; omni+composer jäid teadlikult varju-süvenemisega — komposeri pere identiteet);
ladder'i „Kliendi ettepanek" täpp magenta→amber (pill oli ammu amber), suhtluse
sl-dot→accent, tooltip'i vari soe→jahe rgba(10,12,16), obj-add hover paletti,
hover-TÕSTED maha (qa/suh-item/cl-pick — „vaikne liikumine: vari süveneb"), ag-send
ring (nagu omni/comp-send), ag-input 19→18px, rippmenüüd kontsentriliseks (välis 16px =
rea 10px + padding 6px; co-menu/preset-menu), pill-raadiused 20px→999px, 12.8px→13px.
Surnud CSS maha: `.track` (orb alates v152) ja `.focus-note` (fookusrežiim kadus v278).

**Pillid (v=280):** „Ootel" ja „Lahendamisel" amber→**must (ink)** — tegevus minu laual
loeb tugevalt; „Ootab kinnitust"/„Kliendi ettepanek"/„Arutelul" jäid ambriks (ootan teist
poolt). Seadete kutse-pill kasutab nüüd kaardi vaikimisi tooni (eksplitsiitne amber maas).

**Flag-taust (v=281):** tööseisus punkti (`.clause.flag`) sinine accent-soft plokk →
**servast-servani õrn hall riba** (surface-soft, negatiivne -26px margin üle clause-group
paddingu, sisu joonel padding 36px kaudu); `:not(.open)` — avatud punkt endiselt läbipaistev,
lõime rälsi geomeetria puutumata. Kehtib kõigis flag-kontekstides (pakkumuse eri,
tööleping, ring, lease-dokument).

**Indekseerimise kaart KUSTUTATUD (v=282):** külgpaani „Indekseerimine · üld p 5.2"
kaart (select THI/fikseeritud% + idx-sel/idx-pct haldur + .idx-pct-row CSS) maha KOGU
sõlmimis- ja muudatusvoost — indekseerimine elab lepingus endas (üld p 5.2, erisus =
Lisa 3 ülekirjutus) ja MUUTMINE KÄIB PUNKTI LÄBIRÄÄKIMISEGA nagu iga teine tingimus.
autoIndeks eripunktide lukustus eemaldatud (olid „haldab külgkaart"); wizard loob alati
standardi (LWIZ.indeks default kadus). `l.indeks` andmeväli JÄI — kalender/portfell/
võtmekuupäevad loevad seda edasi; korraline indekseerimine polnud nagunii lepingumuudatus.
Flag-riba heledamaks: surface-soft → **#FBFBFB**.

**Uued sujuvusdetailid:** details-voldikud AVANEVAD LIBISEDES (`::details-content` +
`interpolate-size: allow-keywords`, progressiivne — Chrome 131+, mujal endine hetkavamine;
reduced-motion guard); nuppude vajutuse tagasiside `scale(.97)`; `gotoClause` teeb
voldiku avamisel 360ms järelkerimise (animatsioon nihutab sihtmärki — muidu maandub viltu).

## 27.08.2026 sessioon (v=250 → v=278) — juhitud vool: „süsteem juhib, kasutaja ei otsi"

**Taust:** kasutaja tundis, et vool jäi hoolimata parandustest segaseks („ei tea
kuhu nüüd minema pean"). Täisanalüüs + pakett P1–P4, kasutaja kinnitas kõik.

**JUHTKAART (`juhtriba(l)`, `.guide` CSS):** külgpaani ESIMENE kaart mõlemas
rollis, igas olekus — „SINU KORD" (must pill) / „Ootab üürnikku/üürileandjat"
(hall) + juhis + ÜKS päris tegevusnupp. Katab: Mustand (send-draft klass),
Saadetud (lahenda N → `lepHyppa()` / kinnita N / `#cl-accept-all`), Allkirjastamisel
(`lepSignGo()` kerib paneelini), Kehtiv + ring (sama keel Lisa N-iga: `#ring-send`
/ `#ring-accept` / `#ring-sign` on nüüd juhtkaardi nupud). NB: enne oli riba
dokumendi kohal sticky (v269–277 katsetused: stuck-vari, katted — kasutajale ei
istunud, kõik maha võetud) — LÕPLIK lahendus: kaart kleepuvas külgpaanis (v278).

**AUTOHÜPE:** `mutate(msg, jump)` + `nextOpenRef(l)` (operaatoril esimene Ootel,
üürnikul esimene Ootab-kinnitust) + `gotoClause(ref)` (kerib, avab suletud
üld-voldikud, avab lõime). Otsustav tegevus (ettepanek/kinnitus/tagasilükkamine)
hüppab JÄRGMISE lahtise punkti juurde; `REOPEN_CLAUSE` käib nüüd gotoClause kaudu.
Kehtival avab `lepHyppa` vajadusel enne muudatusrežiimi.

**LÕPUSAMM KOHAPEAL (`.fin-cta`):** üürniku viimase kinnituse järel ilmub
sealsamasse „Kõik punktid on kokku lepitud — Aktsepteeri leping" (klikib
#cl-accept-all, mis elab juhtkaardil).

**KÜLGPAANI DEDUP:** clientLeaseCard, operatorLeaseCard ja muudatusStaatusCard
KUSTUTATUD — juhtkaart katab. „Tühista muudatusring" = Toimingud-kaardi punane
act-row (operaator, Koostamisel). Külge jäid: juhtkaart, signCard/signPanel,
Dokumendid, Toimingud, indeks. `.cl-side > .card:first-child` margin nullitud.

**FOOKUSREŽIIM KUSTUTATUD:** lepFocus/LEP_FOCUS_OFF/focus-note/lepFookusCard maas;
muudatusrežiim JÄI sisemise mehaanikana (Kehtiv A4-eelvaade ↔ punktivaade), aga
juhtkaart viib ise õigesse kohta. Žargoon maha: „Konteiner K1/K2" → „Allkirjastatavad
dokumendid"/„Eritingimused", „(V1)" maas, A4 sildid „Lisa N · Eritingimused".

**Muud sama sessiooni viimistlused (enne juhitud voolu, v=250–268):**
üürniku kinnitus OTSE ettepanekukaardil (sisend „Ei sobi — vastan arutellu" taga,
v260); kinnitatud punkt lukustub + kuvanimi „Kinnitatud" (`cmtPill`, v261);
dokumendiread: sinine flag ainult lahtisel, „kommentaar"-pilli asemel päris seis
Lahendamisel/Kinnitatud/Selgitatud (v262–263, ka eri+ring read v265); üürnik ei
kommenteeri eritingimusi läbirääkimisel (eClick, v264); Kehtiv = puhas leht:
lahendatud ajalugu punkti lõimes `details.cmt-hist` voldikus, dokument ei kanna
vanu märgiseid (`relCmt`, v266); sektsioonipäiste selgituspillid peidetud (v267);
muudatusringi elutsükkel tuttavas olekukaardis (v268, hiljem v272 juhtkaardiks);
Kinnitamisele saadetud Lisa N avaneb eelvaates ISE (`LEP_RING_AUTO`, dokumendivalikus
aktiivne ring, `lepDocFull`, v270). Teisel seadmel v250–259: punktirea hover
(servast-servani jooned + vari, pliiatsi-ikoon).

## 25.–26.08.2026 sessioon (v=229 → v=249) — dokumendifookus, kinnituspõhine läbirääkimine, „Lahenda"

**Kehtiv leping = dokumendifookus (v=229–239 kandis):** külgpaanil `dokumendidCard`
(`.doc-pick` read: Üürileping / Lisa 1 / Lisa 2 / Lisa 3 / Lisa N — valik määrab,
MIS on eelvaates; olek `LEP_DOC_SEL`/`window.lepDoc`), kompaktne `signCard`
(allkirjad+audit `sa-inline` voldikus), `toimingudCard` (Algata muudatus `.act-row`,
lõpetamine voldikus). Põhileping on allkirjastamise järel MUUTUMATU — `ringJousta`
EI rakenda enam fakte (ainult allkirjad+staatus), pohi-real viide „(kirjutatud üle:
Lisa N, ülimuslik)" (`ringYleRef`); `migrateRingFacts()` taastab startup'is varem
rakendatud faktid originaalideks. Stepper ja topelt-staatused Kehtiv olekus peidus;
muudatusrežiim taastatav (window.lepMuudatus), iga uus muudatus algab puhtalt lehelt
(fookus ainult lahtistel kommentaaridel). A4 re-pagineerib resize'il (`el._src` +
debounce); <1100px külgpaan dokumendi ette. Kollapseeritud navbari geomeetria: 42px
plaadid, `--sb-w` collapsed 94px (74 kaart + 20 `--sb-m`).

**Pakkumuse viimistlus (v=240–247):** kliendi hinnapakkumises lisad paremasse
paani otsuse ploki alla; operaatori mustandis Üüripinnad puhtamaks — m²-pill maha,
hinnasisend samal real (hinnakiri-vihje + „+ hinnaperiood" alamreal, `pl-${sp.id}`
id säilitatud recalc() jaoks), „Lisa pind" = steplink + `.att` loend
(`data-addsp`), eritingimus lisandub ALATI täiendava punktina (kirjutab-üle
valikud + `kyOpts` eemaldatud). Dokumendipäised (`.doc-head`) hallilt valgeks.

**Läbirääkimine punkti lõimes, kinnituspõhine (v=248):** vana otsusemaatriks
asendatud ettepanekumudeliga — MIDAGI ei rakendu enne üürniku kinnitust.
`cmt.ettepanek = {tyyp: sonastus|selgitus, siht: otse|eri|lisa3|ring, fKey/val/
vanaTxt/uusTxt/kuva VÕI tekst/algne, kyRef, lisaNr, aeg}`; uus staatus
**„Ootab kinnitust"** (PILL amber, shape three) + `cmtOpen()` helper (lahtine =
Ootel VÕI Ootab kinnitust — fookus, pillid, kinnita/allkirjasta gating).
Lõimes ettepanekukaart (`th-dec.wait`, kollane aktsent) sihi-selgitusega.
Üürnik kinnitab punkti juures („Kinnitan uue sõnastuse" → fakt/eri/lisa3/ring
rakendub; selgitusel → Selgitatud) VÕI vastab arutellu → ettepanek ajalukku
(arutelu kirjena), punkt tagasi Ootele. Ka „Selgitatud" vajab nüüd üürniku
kinnitust. Kehtival lepingul siht alati ring (Lisa N), jõustub allkirjastamisel.

**„Lahenda" minipaneel (v=249):** operaatoril kommentaari all AINULT üks nupp
„Lahenda" → `.res-panel` (valge kaart) kolme teekonnaga: (1) Vasta kommentaarile
(üks tekstiala; väljundid: Vasta arutellu / Selgitus / Lükka tagasi),
(2) Muuda lepingupunkti (ainult fakti- või eri-punktil, MITTE kehtival lepingul;
faktisisend või sõnastus → üürnik kinnitab), (3) Sõnasta eritingimus
(AI-eeltäide `aiSonasta` + „Sõnasta AI-ga" → Lisa 3 / kehtival Lisa N).
Siht-valik elab menüütasandil (otse-vs-lisa3 toggle kadus); lõimesisene
op-vastamisvorm ja jaluse otsuse-textarea eemaldatud. NB: vana „Sõnastamisel"
voog (dokumendi all sõnastamine) kehtib veel ainult varasematele andmetele —
uued aktseptid sünnivad valmis sõnastusega.

## 24.08.2026 sessioon (v=201 → v=228) — otsusemaatriks, muudatustöövoog, lõpetamine

**Kommentaari otsused (openClause) — täielik maatriks:** operaatori „Vasta" kolis
LÕIME sisse üürniku sõnumi alla (`.th-form` valge kaart, enter-ikoon nagu üürnikul);
jaluses ainult otsused. Neli teed punktitüübi järgi: „Muuda punkti otse"
(P-refi fakt, `FACT_OF_REF` map nüüd mooduli tasemel; sisend `faktiSisend`/`faktiVal`),
„Aktsepteeri → Lisa 3" (üld/põhi), eri-punktil „Muuda punkti" (sõnastus otse,
uut punkti ei teki), „Selgitatud" (uus staatus, sinine `th-dec.info` —
küsimus ilma muudatuseta, selgitus kohustuslik) ja „Lükka tagasi".
Fookuskaardil punktipealkirjad (`ttl`).

**Lepingu MUUDATUSTÖÖVOOG (kehtiv leping):** iga muudatus = JÄRGMINE lisa
(3→4→5; `nextLisaNr`). Andmed: `l.muudatused[] = {nr, staatus Koostamisel→
Kinnitamisel→Allkirjastamisel→Jõustunud, faktid[], punktid[], allkirjad}`,
`aktiivneRing/ensureRing/ringJousta` (faktid rakenduvad ALLES jõustumisel:
tehing+rebuildPohi, pohi-real `muudatusLisa` silt „(muudetud Lisa N-ga)").
UX = SAMA mis sõlmimisel: muudatusrežiim (`lepMuudatus`, dokument ↔ klõpsatav
punktivaade) ja dokumendi all „Eritingimused · Lisa N (muudatus)" plokk
(`ringEriGroup`): kliendi aktseptist punkt Sõnastamisel olekus, Sõnasta AI-ga +
Kinnita (`.ring-ai/.ring-ok/.ring-txt/.ring-rm`), eri-add vorm; faktimuudatused
genereeritud punktidena (`faktPunktTekst`). Külgkaart (`muudatusCard`) =
kokkuvõte + elutsükkel; Lisa N dokument (`annexSheetHTML`, Lisa 3 kujuga) +
`openLisaN` modaal + A4 all + lisade loetelus. Kliendi kommentaar Kehtiv olekus
lubatud (= muudatusettepanek; avalehe acts loeb).

**Lõpetamine = TEAVITUS (mitte dokument):** `l.lopetamine` — kumbki pool esitab
(üld p 12: 1-a etteteatamine, varaseim kuupäev arvutatud), päises amber pill,
operaatori „Võta teadmiseks" → KEY_DATES; suletud voldikuna külgpaanil.

**Muu:** pakkumuse wizardis periood ülevaate paremas nurgas + lisad `.att`
ridadena + parem paan õhuke kokkuvõte (300px `.cl-side`); pakkumuse vaade
lepingu paigutuskeeles (cl-layout, tegevuskaart üleval), vabatekst
dokumendilõiguna (`.prose-in`), priceCard saba üherealine; dokumendis
rendiperiood päisenurgas; A4: pooled 1 kord (1.1/1.2 numbrid, Põhitingimused
pealkiri ees), sektsioonikaupa tabelid, üld lamedaks + orvureegel,
ristküliku-mõõtmine + fonts.ready + RESIZE re-pagineerimine (`el._src`);
üürilepingu wizard 4 sammu (otstarve+indeks mallist, ülevaade maas); Lisa 3
nähtav alles kokkuleppe järel (K2 peidus kui punkte pole); kehtiva lepingu
külgpaan kompaktne (indeks allkirjakaardi reana, lõpetamine+lisad
`details.side-acc` voldikud); <1100px: külg dokumendi ette.

## 20.–23.08.2026 sessioon (v=170 → v=200) — faktimootor, kommentaarilõim, uus palett

> Suur sessioon; kronoloogia versioonide kaupa allpool. Suured teemad:
> (1) põhitingimused = faktid lausetes (v170), pooled võtmeplaatidena (v171),
> (2) lepinguvaate paigutus + indekseerimine + loevaate boldid (v172–174),
> (3) kommentaarid lõimena + arutelu-enne-otsust + AI-sõnastaja (v175–184),
> (4) A4-eelvaade + Lisa 3 eraldi dokument + eelvaatemodaal (v185, v196, v200),
> (5) coolors-palett (neutraalhallid + sinine pere) + kooskõla-audit (v187–198),
> (6) pisiasjad: profiilipilt, favicon, „+ Uus", staatus „Kehtiv", generaatorikaart.

### 20.08 (v=170) — põhitingimused: faktid lausetes

**Lepingu mustandi põhitingimused ümber ehitatud „faktid lausetes" mudelile:**
tehingufaktid elavad lepingu `tehing` objektis (`algus` ISO, `kuud`, `hind` €/m²,
`tagatisKuud`, `parkimine`, `otstarve`, `erisused`); laused genereerib
`pohiTehing({cl, ct, sp, facts, edit}, mk)`. Mustandis (Mustand V1) EI redigeeri
operaator enam proosat tekstikastides — iga fakt on inline-väli OTSE lause sees
(`factMark`: date/number/select/tekst) ja tuletatud väärtused (kuusüür,
tagatissumma, periood, kestus) on pehmed merevaik-esiletõstud (`.fact`), mis
fakti muutudes sähvatavad uuenemisest (`FACT_FLASH` + `FACT_DERIVED`).
Registrist tulevad punktid (P 1.x, P 2.1, P 3.2, P 6.x) kannavad allika-märgist
(`.src-chip`: profiilist/kliendiregistrist/pinnakaardilt/mallist).

- Fakti muutus → `rebuildPohi(l)`: laused, `l.algus/lopp/pikkusKuud` ja
  `indeks.jargmine` kirjutavad end uueks; `muudetud` lipud säilivad; audit + save.
- Salvestatav `l.pohi` on endiselt PUHAS tekst (sheet/kommentaarid muutmata);
  märgendus tekib ainult vaates. Vana (faktideta) localStorage-mustand →
  `ensureTehing(l)` tuletab faktid (hind parsitakse P 3.1 lausest).
- Mõlemad loomisteed (pakkumusest + wizard) loovad `tehing` objekti; pakkumustee
  salvestab ka `l.kontakt` (P 6.2 rebuild'i jaoks).
- Surnud `POHI_TPL` eemaldatud (refid ei klapinud P-refidega alates v168 —
  tpl-tsitaat ei renderdunud kunagi). Seemneparandus: LEP-2026-008 kommentaaride
  `clauseRef` vana kuju („Üür (p 3.1)") → „P 3.1"/„P 4.1", nüüd haakuvad
  punktidega taas; P 3.1 sai seemnes `muudetud: true` (kommentaari vastus lubas).
- Smoke-test (24 kontrolli, ajutine scratchpadis) jooksis rohelisena; NB:
  data.js on IIFE-s — Node-testis tuleb laadida ka app.js DB-destruktuur.
- 21.08 (v=171): pooled + esindajad (P 1.x, P 6.x) renderduvad dokumendivaates
  võtmeplaatidena (`pooledKV()` + `.pkv` grid) — „·"-jada asemel label+väärtus
  ruudustik registriandmetest; salvestatav `l.pohi` jääb endiselt tekstiks.
- 22.08 (v=172): lepinguvaade sama paigutuskeelega kui pakkumuse kliendivaade —
  `.cl-layout` (lai dokument + 300px külg) ja `.cl-side` (sticky) taaskasutatud;
  „Saada üürnikule" nüüd KA kleepuval külgkaardil (`.send-draft` klass, seob
  mõlemad nupud); üldtingimuste plokk tervikuna kokku volditav
  (`details.uld-all`, vaikimisi kinni, üld-kommentaarid avavad; sektsiooni 1
  auto-avamine eemaldatud).
- 22.08 (v=173): saatmisnupp AINULT külgkaardil (doc-head näitab olekupilli);
  indekseerimise kaart minimalistlik — selgitus kolis info-ikooni tooltippi
  (`.tip[data-tip]`, CSS-only hover), read-vaates üks rida + rütmirida;
  valikusse lisandus „Fikseeritud % · käsitsi" (`idx-pct` väli,
  `l.indeks.kohandatud` lipp hoiab välja nähtaval; % ≠ 3 → automaatne Lisa 3
  ülekirjutus nagu THI-l, % = 3 → standard, erikokkulepet ei teki).
- 22.08 (v=174): põhitingimuste LOEVAADE — lause normaalkaalus (450), ainult
  võtmeväärtused rasvased: sama generaator boldiva margiga (`readRows`,
  `<b class="fv">`); kui faktid pole tuletatavad, kuvatakse salvestatud tekst
  muutmata (rasvata).
- 22.08 (v=175): punkti kommentaarid LÕIMENA — avatud punkt jääb heledaks
  (halli tausta asemel), laiendus läbipaistev; küünarjooned (`.thread .th-card
  ::before`, `:first-child` ulatub punktini) ühendavad punkt → üürniku
  kommentaar → operaatori vastus (eraldi kaart `.th-op`, sügavam trepp,
  surface-soft taust; vana inline `.reply` plokk asendatud).
- 22.08 (v=176): kommentaarilõim avaneb PUNKTI SEES (append body-veergu, mitte
  `host.after`) — punkti alumine joon jääb lõime alla; pealkirjarida
  („Kommentaarid · p x.y") eemaldatud; `exp.onclick` stopPropagation, muidu
  sulgeks lõime sees klõps punkti.
- 22.08 (v=177): lõime joon algab punkti REF-sildi alt (nt „p 2.1"):
  `.clause.open::before` / `.uld-p.open::before` = vertikaalne rälss ref-veerus,
  kaardid haakuvad horisontaalharudega (`.th-card::before`, uld-p-l oma
  nihked); operaatori vastus endiselt küünarjoonega üürniku kaardi küljest.
  NB geomeetria (left/top pikslid) on arvutuslik — brauseris üle vaadata.
- 22.08 (v=178): kommentaaril ARUTELU enne otsust — `c.arutelu[]` (roll
  operaator/klient) kogub vastuseid, staatus jääb Ootel; operaatoril kolmas
  nupp „Vasta" (btn-soft), üürniku vastus lahtises lõimes läheb SAMASSE
  arutellu (mitte paralleelkommentaariks); otsustavad AINULT Aktsepteeri →
  Lisa 3 / Lükka tagasi. Viimane arutelusõnum kannab „Arutelul" pilli;
  kliendi sõnum amber-soft (`.th-op.tk`). Pärast vastamist/otsust avaneb sama
  punkt uuesti (`REOPEN_CLAUSE` init-is). Seemnes P 4.1 lõimel näidisarutelu.
- 22.08 (v=179): lõime disainipass — kõik jooned 1px (rälss hajub gradiendiga
  lõpus + scaleY „joonistub" animatsioon, reduced-motion guard), valged
  sõlmerõngad rälsil üürnikukaartide harude kohal, kaardid ilmuvad
  stagger'iga (nth-child delay), otsusekaart kannab staatusevärvi sisejoont
  (`.th-dec.ok/.no` roheline/punane inset), lõime tekstiväljad said maja
  `.ce-in` klassi (eri-in keel), otsusel oma aeg (`otsusAeg`); surnud
  `.cmt .reply` reegel eemaldatud.
- 22.08 (v=180): lepingu sektsioonipealkirjad (põhi-/üld-/eritingimused + töö-
  lepingu põhitingimused) said dokumendikaalu: `.doc-h2` (Inter Tight 650,
  16.5px) + vaiksem `.h2-sub` saba („· Lisa 3", „· täistekst"); eritingimuste
  pealkiri ühtlustatud „Äriruumide üürilepingu eritingimused"; sisemised
  sektsioonid (1. Pooled jne) jäid overline'iks; `:has(.doc-h2)` lisab õhku.
- 22.08 (v=182): üürnik saab OMA esindaja andmeid (P 6.2) plaatidel otse muuta
  (kliendiroll, kuni allkirjastamisfaasini): `pooledKV(..., editRep)` →
  `.rep-in` väljad; salvestub `l.kontakt` (mitte kliendiregistrisse),
  `rebuildPohi` uuendab P 1.2 + P 6.2 laused; e-posti valideerimine, klõps
  väljal EI ava kommentaarilõime (stopPropagation).
- 22.08 (v=183): pika arutelu jooned ei katke — trepitakse üks kord (küünarjoon
  üürniku kaardist esimesse vastusesse), järgnevad sama trepi sõnumid ripuvad
  üksteise küljes langejoonega (`.th-op + .th-op::before`, kõrgusest sõltumatu).
- 22.08 (v=184): AKTSEPT ≠ AVALDAMINE — kommentaari aktsept loob Lisa 3 punkti
  olekus „Sõnastamisel" (`e.sonastamisel`, `e.algne` = üürniku ettepanek);
  üürnik näeb vaikset kohatäidet, sheet filtreerib mustandid välja. Operaatori
  kaardil: algne ettepanek tsitaadina, nupud „Sõnasta AI-ga" (`aiSonasta()` —
  demo-simulatsioon, P 4.1-le arutelu-teadlik garantiiga sõnastus, muidu
  üldine mall; thinking-animatsioon) ja „Kinnita sõnastus" (→ Aktsepteeritud,
  üürnikule nähtav). Uld-send „→ Lisa 3" tee jäi endiselt Ettepanek-olekuga
  (operaatori enda sõnastustöö, mitte kliendi aktsept).
- 22.08 (v=185): allkirjastamisfaasi eelvaade A4-LEHTEDENA — `paginateA4()`
  murrab dokumendi mõõtmispõhiselt (plokid lehtedele, leht = 210:297 fikseeritud
  kõrgusega, 18px vahe, mono jalus „Lk x/N"); kui kinnitatud eritingimusi on,
  renderdub all ERALDI dokument `lisa3SheetHTML()` („Konteiner K2" sildiga),
  samuti lehtedena. Printimisel kõrgused vabastatakse (`@media print`).
  NB: leheks murdmine toimub init-is DOM-mõõtmisega — resize ei re-pagineeri.
- 22.08 (v=186): fookusrežiimi nupp → olekuteadlik bänner (`.focus-note`,
  prop-note keel): amber ikooniketas + „N punkti ootab otsust" + selgitusrida
  + suunanool (hover nihutab); kõik lahendatud → roheline toon (`.done`).
- 22.08 (v=187): PALETIVAHETUS — aktsent merevaik-oranž → pastelne tolmusinine
  `#6F8CC0` (deep `#2E4368` kiltkivi, soft `#E7EDF7` perivinkel); faktitoonid
  `#E9EFF9`/flash `#CBDAF1`; kõik rgba(217,106,0)→rgba(111,140,192), --pulse
  sama. Mustad nupud said 180° sinaka gradiendi: `--ink-grad`/`--ink-grad-hover`
  (btn-primary, btn-loo „+", nav a.active, sb-user av). Lõuendile teine
  radial-kuma paremalt üles (aktsendi sugulane, kreem jääb). Ettevõtte
  vaikevärv seadetes samuti aktsendiga. NB: staatuse-amber jäi alles.
- 22.08 (v=188–189): profiilipilt `demo/lisad/tarmo-sepp.webp` (TS asemel);
  aktsent ERKSAMAKS: `#4E80E1` rukkilillesinine (deep `#2C4C8F`, soft
  `#E5EDFC`), faktitoonid `#E6EEFC`/`#C3D6F8`, rgba → 78,128,225; mustade
  nuppude gradient 180° → 90° (vasakult paremale).
- 22.08 (v=194–198): sektsioonipealkirjad („1. Pooled") nummerdatud kiviga
  (`.sec-h`); kommentaari saatenupp „↵ Saada"; Lisa 3 dokumendile hoone logo +
  põhilepingus eri-loetelu asemel viide Lisa 3-le; favicon = must ThinkOne
  märk; VÄRVIKOOSKÕLA audit (v=198): btn-soft/sb-switch hover greige →
  sinine aste #A6C7EF, ai-fab säde ja toasti linnuke paletti (säde accent,
  linnuke mint #7CD9A6), vertikaalimärgised lime/lav → violet-soft/green-soft
  (samad toonid mis tüübikaartidel), .note tekst accent-deep, tooltip/pf-view
  tekstid neutraalseks, ag-answer gradient neutraalse lõpuga; „Ootel" ja
  „Kliendi ettepanek" pillid magenta → AMBER (tähelepanu-pere ühtne; magenta
  tokenid jäid alles, aga kasutuseta). — 3 kaarti: üüri + töö
  + LEPINGUGENERAATOR (AI-mustand, „Tulekul" märgis, klõps → toast; tegeleme
  hiljem). Ikoonidel vedru-animatsioon (hover: ketas kaldub -6°, ikoon õõtsub
  vastu; bouncy cubic-bezier), kaardil hoveril ärkav värvisfäär (`--tint`
  muutuja kaardi kaupa), generaatori säde hingab idle'is (spark-breathe);
  reduced-motion guard.
- 22.08 (v=191–192): päise „+" → kompaktne pill „+ Uus" (36px). Allkirjastatud
  lepingu/töölepingu staatus „Arhiveeritud" → „KEHTIV" (kõik viited app.js +
  data.js seemned; load() migreerib vana localStorage'i; olekurajad,
  pillivärvid ja loendurid renameiga kaasas).
- 22.08 (v=190): KOGU PALETT kasutaja coolors-paletile (000000·9A9A97·E9E9E7·
  F6F5F3·0059CF·B8D4F5·86B5EC·2A77C6): neutraalid soojast greige'ist
  neutraalhalliks (paper #F6F5F3, line #E9E9E7, faint #9A9A97, ink #000),
  varjud/edge jahedaks (rgba 10,12,16), aktsent #0059CF (deep #00459F —
  tuletatud tume aste, sest deep on ka tekstivärv; soft #B8D4F5), staatuse-
  sinine #2A77C6, faktisähvatus #86B5EC, fakti-bg #DCE9FA; ink-grad
  #24303F→#000. Lõuendi valguskumad sinakad. Toast neutraalmust.

## 17.–19.08.2026 sessioon (v=152 → v=169) — värvikeel + läbirääkimisvoog + leping

**Värvikeel:** roheline = aktsepteerin/kinnitan (`.btn-green`): kliendi aktseptid,
operaatori „Kinnita ja saada", kommentaari aktsept, „Alusta allkirjastamist".
`--accent-soft` hallikas greige `#E9E5DD`, `--accent-deep` matt must `#2B2722`
(oranž nupp → hover must). Viimased sinise jäägid koristatud (btn-soft hover,
ag-answer, ai-fab säde).

**Kliendi pakkumusvaade fookuses:** linkhead ja Klient-kaart (sh riskiskoor!)
kliendi eest peidus; minimalistlik olekurada `.cl-track` (Saadetud→Aktsepteeritud→
Leping), hetkeseis pulseeriv punkt (`--pulse` muutuja; amber-variant „Kliendi
ettepanek" jaoks). SAMA rada nüüd ka operaatori pakkumusel (4 sammu) ning
üüri-/töölepingul (5 sammu; Allkirjastamisel = samm 3 — indeksid parandatud,
vana `.track` CSS on orvuks). Pakkumuse tabelis elektrivõimsus pinna lõikes.

**Läbirääkimiste TÄISVOOG (pakkumus):** „Alusta läbirääkimisi" avab paneeli dokumendi kohal
(v369; kuni v368 modaal `#nego-modal`; Keeldun joonega lahutatud). Ettepanekud/vastused kogunevad
`o.labiraakimised` logisse (roll klient/operaator), mida näevad mõlemad pooled
külgveerus; operaatori kaardil vastuse väli + „Vasta ja saada uuesti".
Suhtluse leht ehitab pakkumuse lõimed SAMAST logist (ettepanek/vastus märgised)
ja sealt saadetud vastus läheb samasse logisse. Operaator näeb Saadetud+ olekus
dokumenti (offerSheetHTML), Mustand/Kliendi ettepanek = redigeerimisvaade;
redigeerimisel saab pindu lisada/eemaldada (×-nupp real + „Lisa pind" valik).

**Lepingupunktide kommenteerimine:** otsus käib VIIMASE lahtise kommentaari
kohta (esimene lukustas voo); tagasilükkamisel KOHUSTUSLIK põhjendus, aktseptil
valikuline täpsustus. Fookusrežiim (`lepFookusCard`): kommenteeritud punktid
ühes kohas (lahtised ees, lahendatud otsuse-pilliga), ülejäänud leping peidus;
püsib kuni üürniku „Aktsepteerin kõik punktid"; „Näita kogu lepingut" lüliti.

**Leping dokumendina:** alates Allkirjastamisel-olekust näevad mõlemad rollid
`leaseSheetHTML` dokumenti (logo, pooled pangaga, põhitingimused, Lisa 3,
üldtingimuste täistekst, allkirjaplokid).

**Põhitingimused ÜMBER EHITATUD originaali (Üürileping.docx) järgi:**
`pohiTehing()` generaator app.js-is — 6 sektsiooni, punktid `P x.y` refiga
(P-prefiks väldib põrget üldtingimuste refidega, nt 5.2!), pealkiri + täislause.
Lisandusid varem puudunud: Parkimiskohad 2.2, Üleandmispäev 2.3, Kõrvalkulud 3.2,
Tähtaja erisused 5.2, esindajad rollide kaupa 6.1–6.2, poolte pank/IBAN
(`ACCOUNT.landlord.pank/iban/esindajad`, ka B11G-l). Seemned + mõlemad
loomisteed sama struktuuriga. Vanad localStorage-lepingud kannavad vana
struktuuri — „Lähtesta demo" toob uue.

## 15.–17.08.2026 (v=137 → v=151) — viimistluspass teises seadmes

Päisele pehme vari (servajooneta), view ülapadding 100px, vaadete päised ilma
selgitavate kirjeldusteta. Stepper: 40px ümarad ruudumärgid sisuikoonidega,
tehtud samm linnukesega; wizardi kliendiotsing kaardisoovitustega. Esemevaade:
pinnad kaartidena + filter Lepingus/Vabad/Kõik (aktiivne filter must);
objektivaates EHR 3 veergu, mallid klõpsatavate ridadena; Suhtlus õhulisem
kuupäevaeraldajatega; kalendris detail rea all / popup keskel; ettevõttevahetus
jaluse joone peal. 17.08: kliendi otsusepaani sticky-top 90→115px (kõrge päise
järelparandus, oli seadmevahetusel commit'imata jäänud).

## 14.08.2026 õhtune sessioon (v=120 → v=136) — soe palett + päise/nav ümberehitus

**Parandus:** ettevõttevahetus B11G-le kukkus („reading 'nimi'") — vana
`thinkone_demo_v1_b11g` salvestus viitas Taevavärava klientidele, keda B11G
uues registris pole. `load()` (data.js) filtreerib nüüd laadimisel välja
pakkumused/lepingud/töölepingud, mille klient (`clientId`), pind (`spaceIds`
massiiv pakkumustel / `spaceId` lepingutel) või ametikoht seemnes puudub.

**Hoonepõhised logod pakkumusel:** igal objektil on `logo` väli (T6B png +
B11G kaks svg-d kaustas `demo/lisad/`; originaalid juurkaustas `B11G/`).
`offerSheetHTML` valib logo esimese pinna hoone järgi (`objektOf`).
Kliendilingi ülapäis (`clientLinkHead`) on ettevõttetasandi — B11G-l tähemärk.

**Palett (mitu iteratsiooni, lõppseis):** lõuend soe helehall/greige
`#F3EEEA→#F1EEEA`, soe süsi-must `#1C1A16`, aktsent **erk merevaik-oranž
`#D96A00`** (deep `#B35503`, soft `#FAEBD7`); logo tervenisti MUST; mustad
nupud jäävad. Teekond: indigo → sammal-oliiv → merevaik (git-ajaloos alles).
NB: valge tekst oranžil on ~3,4 kontrastiga (alla AA) — kasutaja teadlik;
staatusekollane `#B97F10` on aktsendi sugulastoon, vajadusel nihuta.

**Päis + nav (suur ümberehitus):** `.app` on nüüd 2-realine grid.
Päis (`.topbar`) on täislaiuses 96px klaasriba (`--hd-h`) lõuendi toonis;
sees AINULT omnibox + must ümmargune 44px „+" nupp (menüü avaneb nupu alla
keskele, `translate`-nihkega). Crumb on peidus (element #crumb PEAB DOM-i
jääma — router kirjutab sinna). Nav-kaart hõljub päise PEAL 80% ülekattega
(`--sb-top = --hd-h × .2`, z-index 25), õhk vasakul/all `--sb-m: 20px`
(`--sb-w` 284). Logo + klapinupp nav-kaardi ülareas (`.sb-top`), menüü algab
34px allpool; ettevõttevahetus kolis JALUSESSE Seadete kohale ja `.co-menu`
avaneb ÜLES. Kokkutõmmatud režiimis kompaktne logomärk (`.logo-mark`).

## 13.–14.08.2026 sessioon (v=85 → v=120) — suur disainipass + kliendivoog

**Disainisüsteem („Soft studio" pinguldatud + Apple-pass):**
- Lõuend: valgusgradient + 3,5% filmitera; kaartidel juuspeen serv (`--edge`);
  variable-fondid (Inter 400..700, Inter Tight 500..700), pealkirjad 650.
- Mono ainult mikrosiltidel (overline, ⌘K) — kõik sisuväärtused Inter tabulaarnumbritega.
- Vaikne liikumine: hover-tõsted asendatud varju süvenemisega; „+Loo" ühtlane sinine.
- Värviloogika: sinine = tegevus, roheline/kollane/punane = staatus, muu neutraalne.
- Üks AI-sisendi keel: avalehe suur komposer + kompaktne ülariba-oma (avalehel
  peidus, `dash-shell`; kliendirollis kogu keskosa peidus, `client-shell`).

**Portfell:**
- Lepingud-tabil kaardivaade (vaikimisi) + loend, lüliti püsib (`thinkone_pf_mode`).
- Tüübifilter Kõik/Üürilepingud/Töölepingud; kaartidel tagatis + m² hind (bold).
- Kaardi eelvaade avaneb kaardirea ALLA (pfExpand): avatud kaart vajub 5px, naabrid
  tuhmuvad 55%, valge paneel; sisu = faktiplaadid + indekseerimise aktsentriba +
  kontaktirida. Loendivaade kasutab endiselt külgpaneeli.

**Lepinguvoog:**
- „+ Loo" menüüs ÜKS kirje „Leping" — tüüp (üüri/töö) valitakse wizardi sammul 0
  (kaks suurt vertikaalikaarti). Enne valikut üldnimedega rada „Osapool·Ese·Tingimused".
- Töölepingul PÄRIS voog: kandidaat → ametikoht (vaba kvoot) → tingimused →
  Mustand V1 → dokumendivaade „Saada kandidaadile" nupuga. TLEPINGUD püsivad nüüd
  localStorage'is (save/load laiendatud).
- Moodne stepper (jooksva täitejoonega rada) jagatud mõlema wizardi vahel (stepperHTML).
- Wizardi kliendiotsing: Enter kinnitab esimese vaste; tühi vaste annab selgituse;
  B11G sai OMA kliendiregistri (Viking Metall, Clanner, Väikevedu — CLIENTS
  kirjutatakse b11g plokis üle). Pinnavaliku tühi seis näitab hõivatud pinnad
  tuhmilt + „Lähtesta demo" vihje (occupiedSpacesNote, mõlemas wizardis).

**Kliendiportaal (Apple-pass):**
- Üürnik näeb pakkumust DOKUMENDINA (offerSheetHTML — sama leht mis prindi/PDF-vaates),
  dokument sisu vasakus ääres, lisad AVATUNA all (iframe-eelvaated + „Ava suurelt").
- Otsus elab kleepuval kõrvalpaanil (300px, sticky top): suur summa, sinine
  „Aktsepteerin", helesinine `btn-soft` „Alusta läbirääkimisi" (sama keel kui
  külgriba rollinupp), vaikne punane „Keeldun". Paan on OLEKUTEADLIK — ettepanek
  ülevaatamisel / aktsepteeritud + Ava leping / aegunud (nupud ei kao hääletult).
- Lepingupunktide kommentaarid avanevad KOHE punkti alla (openClause inline,
  sama muster kui portfellis) — külgsahtlit dokumendis enam pole.
- Rollipõhised sildid: kliendile „kommenteeri", operaatorile „muuda".

## Teadaolevad nüansid

- B11G andmestik: `data.js` lõpus `if (COMPANY_ID === "b11g")` plokk kirjutab
  seemned üle ENNE localStorage'i laadimist; nüüd ka CLIENTS. Sama muster
  kolmanda ettevõtte jaoks.
- B11G-l failiviited puuduvad teadlikult — kliendi pakkumusvaates lisade
  eelvaateid siis lihtsalt ei kuvata.
- `View.risk.init` on route-tabelis viidatud — ära kustuta, asenda sisu.
- Vana localStorage ühildub: load() guard'ib puuduvad võtmed (tlepingud jm).
- Pärast hard-reload'i võib esimene klõps „tühjaks" jääda (sidumine pole jõudnud) —
  laadimisjärjekorra iseärasus, mitte viga.

## Tegemata / järgmised kandidaadid

- **Lepingugeneraator** (uue lepingu 3. kaart, „Tulekul") — AI-mustand vabast
  kirjeldusest; kasutaja sõnul „tegeleme hiljem". Haak olemas: `data-ltyyp="gen"`.
- Kliendi lepinguvaates KLIENT-kaart näitab kliendile tema enda riskiskoori ja
  „Riskiraport" nuppu — operaatori tööriist, võiks kliendi eest peita.
- Riskiraporti ja kalendri vaated pole „Apple-passiga" üle käidud.
- Pakkumuse wizardi samm 1 võiks kasutada sama suurt kaardikeelt nagu lepingu tüübivalik.
- A4-paginaator ei re-pagineeri akna suuruse muutmisel (arvutus init-is).
- Kommentaarilõime jooniste piksligeomeetria (rälsi/harude joondus) on arvutuslik —
  brauseris silmaga üle vaadata.

## Seadmevahetus

Projekt on git-repo (`main`), aga **remote'i pole** — teise seadmesse liikudes
kopeeri kogu kaust KOOS `.git` kataloogiga, või seadista GitHub (gh auth login →
privaatne repo → push). Brauseri localStorage on seadmepõhine — demo alustab
uues seadmes seemneandmetest, see on ootuspärane.
