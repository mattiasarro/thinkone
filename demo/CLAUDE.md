# ThinkOne — projektijuhis (Claude Code)

Lepingutöövoo platvorm spec/demo faasis. Autoriteetsed dokumendid:
`ThinkOne - Funktsionaalne spetsifikatsioon v2.md` (v1 fail on aegunud) ning
`architecture.md` + `architecture-addendum.md` (kernel on vertikaali-agnostiline;
`domain/contracts/` ei impordi kunagi `domain/realestate/`). Dokumendid ja UI on eesti keeles.

## Tööreeglid

- Töö käib AINULT `demo/` kaustas — spetsifikatsiooni- ja arhitektuurifaile ei muudeta ilma kasutaja palveta.
- Demo on raamistikuvaba staatiline SPA (`index.html` + `styles.css` + `data.js` + `klauslid.js` + `uldtingimused.js` + `app.js`). Build'i, npm-i ega sõltuvusi ei lisata — lihtsus on teadlik valik.
- Pärast igat CSS/JS muudatust tõsta cache-versiooni `index.html`-is: `styles.css?v=NN` + neli `*.js?v=NN` viidet, kõik viis sünkroonis.
- Pärast `app.js`/`data.js` muudatust jooksuta `node --check`.
- Demo „tänane" kuupäev on **päris tänane** (`DEMO_TODAY` data.js-is, v408). Seemneandmed on kirjutatud ankru
  **10.06.2026** (`SEED_ANCHOR`) järgi ja loo-kuupäevad (pakkumused, audit, impordi kinnitamine, pakkumuse
  võtmekuupäev) nihutatakse laadimisel tänasesse (`shiftStoryDates`); päris imporditud lepingute kuupäevad
  (2023–2030) ei nihku. Uued kirjed: `loodud` = `TODAY_EE`, `aeg` = `NOW_EE()` (kuupäev + kellaaeg). Uut seemet
  kirjuta ANKRU kuupäevades, mitte päris tänastes.
- Kasutaja eelistab puhtaid, õhulisi vaateid; selgitavaid/dubleerivaid tabeleid ei lisata.
- Disainikeel: „Grafiit + koobalt" v424 (viide: kasutaja saadetud koobalt-UI kaardikomplekt 11.09.2026) (UI-audit + redesign-skill; vt `demo/design-system/` ja `.agents/skills/redesign-existing-projects`) — JAHE grafiit-neutraalskaala: lõuend `--color-canvas #F0F1F5`, külgriba `--color-sidebar` = neutral-2 `#E4E7EE` (lõuendist aste tumedam, aktiivne rida = valge kaart + primary), kaart ILMA nähtava servata (`--edge-color rgb(20 26 38 / .04)`), eraldub pehme laia tint-varjuga (`--shadow-surface`), tekst `#141821` / teisene `#596170`, tabelipäis `--color-thead #F6F7F9`. ÜKS primary = küllastunud KOOBALT (`--color-primary #1F5EFF`, hover `#1749D6`, pehme pind `--color-primary-subtle #E9EFFF` kiipidele/avataridele/valitud reale; erkroheline `--color-success-vivid #22C55E` AINULT edenemisjoonel ja positiivse muutuse ikoonil) KÕIGILE põhitegevustele. Semantilised paarid success `#1F6F4A` · warning `#8A5A12` · error `#B0303A` · info `#2F6A8C` (jahe tsüaan, et mitte segi minna primary'ga) + `-subtle` taustad AINULT olekutele; kategooriad neutraalsed. Ettevõtte dokumendivärv (Seaded) on kasutaja sisu ja jääb petrooleumiks. Tüpograafia 6 rolli (12/14/16/20/24/32 px), vahed 4 px skaalal, raadiused 8/12/16 (kiip/nupp/kaart), varjud 3 taset; must ei ole UI-värv (ainult logo) — valitud sakid, pipeline-numbrid, redelid ja oma sõnumid on koobalt; secondary-nupp (`btn-ghost`) on lõuenditooni pind ilma servata, kestused 150/250 ms. Geist (UI; `.mono` = Geist tabular-nums) + Geist Mono (`.num`, `.tbl .id`, summad, mõõtarvud) + Bricolage Grotesque (pealkirjad). Vanad tokeninimed (`--paper`, `--ink`, `--muted`, `--accent`, `--green` …) on `:root`-is aliased uutele; petrooleumi ei tohi kuhugi tagasi tuua.
- TEEMAKIHT „Medi-joon" v426 (viide: kasutaja saadetud Medi-dashboard 11.09.2026) — `styles.css` LÕPUS olev plokk kirjutab tokenid üle ja on praegu KEHTIV välimus: välislõuend salvee `--color-page #E6EEE8`, raam = kaks ümarat plaati (külgriba TÄISROHELINE `--color-sidebar #27A186` valgete ikoonide/tekstiga, 28 px nurgad; sisuala kreem `--color-content #F3F7F4`, päis läbipaistev), primary roheline `#1B8068` (valge tekst 4,85:1), pehme pind `#E3F2EC`, oranž `--color-attention #FF6B2C` AINULT tähelepanupunktidel (nav aktiivne täpp, teavitused, graafiku hetkepunkt/kuu), kaardid 24 px ilma servata rohekas-tinditud varjuga, nupud/väljad/kiibid/filtrid PILLID (`--radius-pill`), valimata filter = ainult tekst, valitud = roheline pill. ÜKS täidetud roheline fookuskaart: ülevaate esimene meetrika ja pakkumuse „Kokkuvõte" (`.cl-side .card:has(.pc-big)`). Pealkirjad Poppins 600, UI Geist, mõõtarvud Geist Mono. Kihi eemaldamine = plokk kustutada (alla jääb koobalt v424/425). Eelmiste ridade koobalt-väärtused on selle kihi all aliased.
- VÄRVIKIHT „Sinine + must" v430 (kasutaja valik 13.09.2026; viide: Halaska-versiooni ekraanipilt) — `styles.css` KÕIGE LÕPUS, Medi-joone peal: struktuur (raam, plaadid, pillid, Poppins) jääb Medi-joone omaks, värvid Halaska Kitist — jahe neutraalne lõuend `--color-page #EEF0F3` / sisuala `#FAFAFB`, tekst `#1F2328` / teisene `#6B7280`, külgriba TUME grafiit `--color-sidebar #23262B`, ÜKS sinine aktsent `--color-primary #3B82F6` (stepper, valitud filter/sakk, lingid, graafik, tähelepanupunkt `--color-attention` = sama sinine, oranž kaob), TUME täidis `--hk-fill #2A2D33` põhinuppudel (`.btn-primary`, `+ Uus`, saatmisnupud), fookuskaartidel ja loenduritel; secondary (`.btn-ghost`, `.dm-chip`, `.preset-btn`) = neutraalne hall pill tumeda tekstiga. Fookuskaartide kontrast tuleb tokenite ülekirjutusest kaardi skoobis (v429), mitte klassiloendist. Rohelist ei jää peale olekuvärvi. Kihi eemaldamine = plokk kustutada (alla jääb Medi-joon).
- Listid: üks reakeel (styles.css „LISTID" plokk) — 12/16 px polster, eraldaja `--line`, hover = lõuend, juhtiv 32 px ikoonitiil pehmel pinnal, pealkiri 14/500, meta 12 teisene, paremal mono-väärtus või märgend. Avalehe virnad on read (3 esimest + „Näita kõiki"), mitte kaardipakk. Pindade valik viisardis = `.sp-list` kompaktne loend (40 px read) + hoone-combobox otsinguga (`.combo`) + pinnaotsing; filtrid ei renderda sammu uuesti.
- Komponendid: Button = `.btn` + `btn-primary | btn-ghost (secondary) | btn-text | btn-destructive` + `btn-sm | btn-lg` (32/40/48 px, mobiilis ≥44); olekud `disabled` ja `aria-busy="true"` (laadimine). Badge = `pill(txt)` app.js-is; olekukaart `STATUS` (olek → success/warning/error/info/neutral) on ainus allikas ja galerii kasutab sama. Field = `.field > label + input/select/textarea` või lahtine `.fld`. Tabelid `.tbl` muutuvad ≤760 px sildistatud kirjeteks (router lisab `data-l`). Kujundusgalerii `demo/kujundus.html` laeb päris `app.js`-i (kest ei käivitu ilma `#app-view`'ta). Külgriba on sahtel ≤1024 px.
- Lepingu import (v431): `#/import` = Fail → Ülevaatus (originaal VASAKUL: PDF iframe või HTML-faksiimile · AI-tuvastatud struktuur PAREMAL: parameetrid usaldusväärsuse ja allikaviitega `lk · punkt`, tähtajad, punktid) → Kinnitus. Ebakindlad väljad (< 80 %) tuleb enne kinnitust parandada või „kontrollituks“ märkida; parandused logitakse auditisse. Näidised `impSampleKindlustus()` (uus poliis, faksiimile) ja `impSampleMaru()` (päris PDF, tuvastab duplikaadi LEP-2023-029 → uuendab). Kinnitus lisab `IMPORDITUD`-kirje (`lisatud: true`, id `IMP-YYYY-NNN`), tähtajad lähevad `KEY_DATES`-i (`DB.impKeyDates`), `save()` hoiab lisatud impordid võtmes `imports`. Sisenemine: avalehe kiip, „+ Uus“ menüü, Lepingud-vaate nupp.
- AI-sisendi keel on ühtne: avalehe suur komposer + sama keelega kompaktne ülariba-komposer (avalehel peidus, `dash-shell` klass body-l).

## localStorage võtmed

`thinkone_demo_v1` (Taevavärava sisestused) · `thinkone_demo_v1_b11g` (B11G omad) ·
`thinkone_role` (operaator/klient) · `thinkone_company` (aktiivne ettevõte) ·
`thinkone_sbmin` (külgriba kokku/lahti) · `thinkone_notif_read` (loetud teavitused).
„Lähtesta demo" puhastab andmete+rolli+ettevõtte võtmed.

## Lokaalne eelvaade

Topeltklõps `demo/index.html` töötab alati (serverit pole vaja). Brauseriautomaatika ja
ekraanipiltide jaoks: `node serve.js` (port 8471) või `start-demo.cmd` → http://localhost:8471/.

## Märkmed

Ajaloolised nüansid (B11G andmestiku muster, puuduvad failiviited, agendi vastuste
ettevõtteteadlikkus, `View.risk.init` hoiatus) — vt `HANDOFF.md`.
