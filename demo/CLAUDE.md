# ThinkOne — projektijuhis (Claude Code)

Lepingutöövoo platvorm spec/demo faasis. Autoriteetsed dokumendid:
`ThinkOne - Funktsionaalne spetsifikatsioon v2.md` (v1 fail on aegunud) ning
`architecture.md` + `architecture-addendum.md` (kernel on vertikaali-agnostiline;
`domain/contracts/` ei impordi kunagi `domain/realestate/`). Dokumendid ja UI on eesti keeles.

## See pakett (üleandmine arendajale, 30.09.2026, demo v=807)

Koopia algsest repost ainult vajalike failidega:
- `demo/` — töötav demo (index.html + 6 JS-/CSS-faili + `lisad/` plaanid, logod, imporditud näidislepingu originaalid).
- `testfailid/lepingud/` — PÄRIS allkirjastatud T6B lepingud (.asice/.pdf, pindade kaupa) impordi testimiseks (`#/import`).
  NB: sisaldavad isikuandmeid — ära pane avalikku reposse ega väliste teenuste külge; `.gitignore` jätab kausta välja.
  Pinnaplaanide hulgi-üleslaadimise testiks sobivad `demo/lisad/pinnad/T6B_Pind_*.pdf` (seotakse failinime järgi).
- `ThinkOne - Funktsionaalne spetsifikatsioon v2.md`, `architecture.md`, `architecture-addendum.md`, `architecture/architecture.html` — alusdokumendid.
- `HANDOFF.md` — pikk arenduslogi (miks midagi on nii); `tools/` — generaatorid (`riskiandmed.py`, klauslikiht).
- Allpool on viiteid kaustadele, mida selles paketis EI OLE (`demo 3/`, `demo 4/`, `demo 2 - Steven/`, `ThinkOne_uhendusplaan.md`,
  `demo/design-system/`, kujunduslaborid `*-variandid.html`) — need on ajalugu; reeglid ise kehtivad.
- Muudatuste tagasi toomiseks põhirepo: hoia `?v=` cache-versioon ja CLAUDE.md reeglid ajakohased, kirjelda muudatused (commit'id).

## Tööreeglid

- Töö käib AINULT `demo/` kaustas — spetsifikatsiooni- ja arhitektuurifaile ei muudeta ilma kasutaja palveta.
- Demo on raamistikuvaba staatiline SPA (`index.html` + `styles.css` + `data.js` + `klauslid.js` + `uldtingimused.js` + `riskiandmed.js` + `app.js`). Build'i, npm-i ega sõltuvusi ei lisata — lihtsus on teadlik valik.
  Kausta ülejäänud failid (`kujundus.html`, `muudatused.html`, `labiraakimine.html`, `*-variandid.html`, `pdf.css`, `UX-KOKKUVOTE.*`,
  `AUDIT.md`, `UX-LABIVAATUS.md`, `MVP DESIGN.docx`) on kujundus-/viitematerjal — rakendus neid ei lae.
- **(Põhirepos) Disainisüsteemi pakk Claude Designi jaoks (`demo/design-system/`, 26.09 — selles paketis pole):** tokenid + komponentide eelvaated, GENEREERITUD
  jooksvast demost (`tools/run.js` + `tools/build.py`, vt README). Tõde on demo kood — Designis viimistletud komponent kantakse
  `styles.css`-i/`app.js`-i käsitsi ja pakk genereeritakse uuesti; `components.css`-i käsitsi ei parandata.
  Claude Designi projekt „ThinkOne demo" (tokenid + CSS-klassid, Reacti pole): `node demo/design-system/tools/bundle.mjs` → `ds-bundle/`,
  sünk `/design-sync`; seadistus ja märkmed `demo/design-system/.design-sync/` (config.json projectId, NOTES.md, conventions.md = agendi README).
- **(Ajalugu) Alus on „demo 3" (26.09.2026, v=626):** `demo/` kirjutati üle kaustaga `demo 3/` (meie v621 edasiarendus: v622 import lepingu
  kaupa + tekstituvastus, v623 „Alusta · 10 minutit" + Uus konto, v625 kalender ajajoonena + osapoole leht). Edasi töötame
  sellest seisust; `demo 3/` on ainult lähtekoopia, seda ei muudeta.
- Pärast igat CSS/JS muudatust tõsta cache-versiooni `index.html`-is: `styles.css?v=NN` + viis `*.js?v=NN` viidet, kõik kuus sünkroonis.
- Pärast `app.js`/`data.js` muudatust jooksuta `node --check`.
- **Riskiraport kasutab PÄRIS avaandmeid (v472):** `riskiandmed.js` on GENEREERITUD (`python tools/riskiandmed.py`,
  ainult standardteek) Äriregistri ja EMTA avaandmetest `data.js` registrikoodide järgi — käsitsi ei muudeta.
  Demo kliendid on päris ettevõtted päris registrikoodiga; skoor on reeglipõhine (`riskHinne`) ja iga signaal
  tugineb päris näitajale. Välja mõeldud negatiivseid fakte (maksehäire, täitemenetlus) päris ettevõtte kohta EI lisata;
  kontaktisikud ja e-postid (`*.example`) on väljamõeldud. Uue kliendi lisamisel jooksuta generaator uuesti.
- **Lepingu lõpetamine ja arhiiv (v479):** `l.sulgemine` (akt → üürniku kinnitus → lõpparveldus) käib Kehtiva lepingu peal;
  arhiveerimisel saab `l.staatus` väärtuse „Lõppenud" / „Ennetähtaegselt lõpetatud", pind läheb vabaks ja toimik on
  kirjutuskaitstud. Lepinguvaates kasuta `lepSigned(l)` (kehtiv VÕI arhiveeritud = allkirjastatud dokumendi vaade) ja
  `lepArh(l)` (toimingud keelatud) — mitte otse `l.staatus === "Kehtiv"`.
- Demo „tänane" kuupäev on **päris tänane** (`DEMO_TODAY` data.js-is, v408). Seemneandmed on kirjutatud ankru
  **10.06.2026** (`SEED_ANCHOR`) järgi ja loo-kuupäevad (pakkumused, audit, impordi kinnitamine, pakkumuse
  võtmekuupäev) nihutatakse laadimisel tänasesse (`shiftStoryDates`); päris imporditud lepingute kuupäevad
  (2023–2030) ei nihku. Uued kirjed: `loodud` = `TODAY_EE`, `aeg` = `NOW_EE()` (kuupäev + kellaaeg). Uut seemet
  kirjuta ANKRU kuupäevades, mitte päris tänastes.
- Kasutaja eelistab puhtaid, õhulisi vaateid; selgitavaid/dubleerivaid tabeleid ei lisata.
- **Ükski asi pole paanis kaks korda (v772, UX-läbivaatus):** OMA saadetud vooru kirja kaardina ei näidata (juhtkaart ütleb
  seda) ja kirjakaart (`lepVoorKiriHTML`) tuleb ainult teise poole punktiviidetega kirjale; versioonide loend on AINULT riba pillis
  „Versioonid · N →” (paani `p4VersioonidHTML` eemaldatud); „Punktid” tühiseis = üks lause (`np-tyhi`); dokumendi päises juhist ei
  korrata; lepingu esmakordsed vihjed eemaldatud (kordasid juhtkaarti — vihjete kood `coachFor` jäi, kasutust pole). Pakkumise
  läbirääkimise päises ainult „Läbirääkimised” (olek on võtmeandmete lehel). Portaali kaardil jalus ainult järgmise sammu
  jaoks (Teie kord / ootab). Kasutajale ei näidata sisemisi silte („Etapp 04”); KEY_DATES `info` ei sisalda suhtelist aega.
  **Üürnikule Teie-vorm kõikjal** (juhtkaardi laused, tühiseis, tööriistavihjed, lõime roll „· teie”). **Lõime päis** `thHead` =
  „Nimi · roll” (12 px, murdub; roll ei lõigu, monospace-silti pole). **Nupu värv:** juhtkaardi põhitegevus ja „Saada uuesti” =
  `btn-primary`; `btn-green` = otsuse kinnitamine/allkirjastamine. Heleda teema `--faint` 53% (AA ka pehmel pinnal).
- **Parem paan on TOIMINGUTE jaoks (v445, kehtib edaspidi alati):** juhtriba · punktid · arutelu ·
  allkirjastamine/toimingud. Numbreid ei dubleerita paani kaartidel. „Saadetud üürnikule” juhtkaart (v766): ikoon · pealkiri
  + alamrida „Voor N · Vn” · märgutuli paremas servas — korratäppi pealkirjas pole, versioon ei kordu metareas.
- **Lepinguvaade on PUHAS (v541 → v547, kasutaja otsus 23.09):** keskel on ainult dokument. Dokumendi kohal on ALATI
  õhuke riba (`.lep-riba`, `lepRibaHTML`/`lepPeaOsad`): ← tagasi · „Muudatused · N" ja dokumendid (lisad; kehtival lepingul
  dokumendivalija `LEP_DOC_SEL`) · „Küsi …”. **Numbrit ja olekurada ribal EI OLE (v769, kasutaja)** — olek on võtmeandmete lehel,
  number dokumendi päises, lõpetamise märge lehe ajaplokis. Sisukorda (`#ltree`) lepinguvaates
  EI OLE (v585, kasutaja: liiga kirju); kerimise edenemine (punktiirne riba + %) on „algusesse" pillis all keskel (`#doc-top`). Tehingu faktid on dokumendis endas; vana päist (`.lep-head`) ei näidata. **Pakkumusel sama (v560 → v769):** sama `.lep-riba`
  („Muudatused", eelvaade, lisad, seotud leping) — numbrit ja olekurada ka siin ei ole.
- **Kogu lepingu diff on ALATI kättesaadav pärast esimest saatmist (v441 → v506):** alates esimesest
  saatmisest on igas olekus ja mõlemal poolel „Muudatused · N" (`openLepDiff`; v541: puu tipus, kitsal ekraanil päises), mis avab modaalis
  koondvaate: punktide sõnastuse ja faktide muudatused sõnatasemel diffina + ajalugu, eritingimused (Lisa 3
  ülekirjutused) ja muudatuskokkulepped (Lisa N). Faktimuutus kirjutab `p.muudatused`-i kirje `viis: "fakt"`.
  **Muudatusi jälgitakse alates esimese versiooni saatmisest** (kasutaja otsus 23.09): „Saada üürnikule" salvestab
  `l.v1` hetktõmmise (`lepV1Snap`) ja kõik muudatuste vaated (diff, paani „Lahendatud ja muudetud", punkti ajalugu)
  võrdlevad sellega (`muutusV1`, `v1Hist`). Mustandis tehtud sõnastus/eritingimused on osa v1-st; mustandis nuppu pole.
- **OTSUSEKAART ON VÄLJAS (v723, kasutaja 29.09: „läbirääkimine läks liiga segaseks”):** operaatori paanis on lahtisel arutelul
  ALATI „Kuidas lahendame?” (Selgitan tingimust · Muudan: … · Saadan Lisa N-sse · Soovin ainult vastata). `const soov = null`
  lõimes; tuvastuse kood (`soovAnaluus`, `soovTuvasta` jt) jäi alles, aga kaarti ei näidata. Voorud (v707→) jäävad. Allpool on ajalugu.
- **Läbirääkimise otsusekaart (v642, kasutaja 27.09, etapp 1/4):** faktipunkti (P 2.2 parkimine, P 2.3 üleandmispäev, P 3.1 hind,
  P 4.1 tagatis, P 5.1 tähtaeg) arutelus tuvastab `soovTuvasta` üürniku viimasest sõnumist uue väärtuse (demos reeglid, tootes LLM)
  → paani ülaossa kaart: enne → pärast, tagajärjed (`soovTagajarg`), allikalause esiletõstuga; **Nõustun / Muudan / Ei nõustu**.
  Kõik läheb sama `sendProp`/`lahenda` teed (üürnik kinnitab, v1-diff, audit). Parkimine: kohad plaanilt (olemasolevad + uksele
  lähimad; vaba pinna „pehmed” kohad lubatud). Vana viis teed jäävad „Muud võimalused” alla; tuvastuseta punktil paan nagu enne.
  **Etapid 2–4 (v643–644):** `soovAnaluus` liigitab ka **sõnastuse muutuse** (palve-sõnad → AI mustand `aiUmber`/`aiSonasta`,
  siht „Kirjuta punkt üle” / „Vii lisasse”; soovitus üld → lisa, põhi/eri → üle; kehtival ainult Lisa N) ja **küsimuse**
  (`aiVastus` mustand → „Vasta ja sulge” = Selgitatud / „Vasta, jäta avatuks”). **Mitu soovi** (`soovMuud`): teine faktisoov samas
  sõnumis → „Ava eraldi arutelu” (üürniku lause + `c.soov` oma punkti juurde). **Üürnik**: faktipunkti komposeris „Soovin muuta:
  väärtus” → `cmt.soov` (täpne; kaardil „Üürniku täpne soov”). Saatmine alati `saadaFakt`/`saadaSonastus`/`saadaLisasse` → `sendProp`.
  **„Tagasi lükatud” lepingupunktis EI OLE (v647, kasutaja):** „Ei nõustu” tulemus = neutraalne „Jääb samaks” (hall, mitte punane;
  sisemine võti `"tagasi lükatud"` jääb andmete ühilduvuseks); vana valik „Lükkan tagasi” eemaldatud; üürnik saab vastates avada.
  (Pakkumuse olek „Tagasi lükatud” = klient loobus — eraldi asi, jääb.)
- **Üürnik näeb lepingut ALATI A4-dokumendina (v526, kasutaja otsus 23.09):** ka läbirääkimistel — mustandi töövaade on
  ainult üürileandjale. A4-s on punktid klõpsatavad (valik paanis, `togglePunkt`), lahtise aruteluga punkt on märgitud.
- **Rollivahetus = sama dokument teise poole vaates (v759, kasutaja 29.09):** kõik lülitid (hõljuv `#role-switch`, deal roomi
  päise „Tagasi operaatoriks”, kasutajamenüü) kutsuvad `rolliVaheta()` — pakkumine/`pakkumus-doc`/leping jääb samaks, valitud
  dokument (Lisa) ja punkt püsivad; toimingu alamtee (`/allkiri`, `/vasta`, `/saada`, `/leping`) jääb maha; muudatusrežiim ei
  lähe üürnikule. Mustand → üürniku portaal + selgitus. Uus lüliti EI kutsu `setRole` otse.
- **Läbirääkimise voorud (v707–710, kasutaja 29.09, etapp 1/3): üks voor = üks kiri.** Saadetud lepingul on kord `l.voor
  {nr, kes: klient|operaator}`; omaniku kommentaarid/vastused on MUSTAND, kuni ta vajutab juhtribal „Saada märkused · N” /
  „Saada vastused · N” (`lepVoorSaada`, operaatoril alles kui kõik ootel punktid vastatud) → `l.voorud` kirje, üks audit, üks
  teavitus, kord vahetub. Mitte-omanik näeb viimati saadetud seisu: `l.pub` hetktõmmis vahetatakse ruuteris LEASES-i
  (`LEP_SWAP`, `lepPubPane`/`lepPubTaasta`, `lepLive`), `DB.save` kirjutab alati elava objekti; body `voor-oota` peidab toimingud.
  Loendused/teavitused loevad `lepAruNahtav(l)`. Paanis viimane kiri `lepVoorKiriHTML`. Saatmata punktid (`lepSaatmata(l)`, v711–712): loendis oma rühm + pill „Saatmata”,
  üürnik saab märkust enne saatmist täiendada (mitte „Ootab üürileandjat”). v713 (kasutaja kavand): saatmata = väike märge
  viimase sõnumi all (`.th-saatmata`, `renderThread(l, p, saba)`), eraldi olekuplokki (`np-st`) pole; kuupäev = eraldusjoon.
  **v714: sama KÕIGIS olekutes ja mõlemal poolel** — ootab vastust/kinnitust, lahendatud, muudetud = üherealine `.th-noot`
  viimase sõnumi all (volditud arutelul voldiku kohal); üürniku „Ootab üürileandja vastust” mulli (`th-wait`) lõimes pole.
  **Kokkulepe lõpetab voorud (v717–722):** üürnikul, kel pole lahtist arutelu, pole midagi „saata” — juhtribal „Allkirjasta kohe”
  (aktsepteeri + `openSign`) / „Aktsepteeri, allkirjastan hiljem”; kinnitused lähevad aktsepteerimisega (`voorud[].kinnitus`).
  Etapid 2 (V2/V3 versioonid + diffi valik) ja 3 (avaleht/tähtaeg vooru kaupa) alles kasutaja käsul.
- **Mitme pinnaga leping (v649–650, kasutaja 28.09):** VAIKIMISI 1 pind = 1 leping (pakkumuse teisendus teeb N lepingut);
  ühine leping on ERAND — operaator valib pakkumuse paanis ja viisardis „Eraldi lepingud · N / Üks ühine leping” (ainult ühe maja
  pinnad). Mudel: `l.spaceIds` (kõik), `l.spaceId` = esimene; hinnad PINNAPÕHISELT `tehing.hinnad` (`f.hind` = esimene/ühtne).
  „Kas pind on lepingus?” → `lepOnPind(l, sid)`; summad `lepKuus`/`lepM2`; nimed `lepPindNimi`. P 2.1 loetleb pinnad, P 3.1 pindade
  kaupa (muudetav `hind@<spaceId>`), Lisa 1 iga pinna plaan (`spaceId`), P 2.2 kõigi pindade kohad; allkiri/arhiiv muudavad kõiki pindu.
  Pinnapõhise hinnaga lepingul hinna otsusekaarti pole (soov → sõnastus).
  **Pinna lisamine/eemaldamine kehtivale lepingule (v651):** AINULT muudatusringina (Lisa N, `ring.pinnad` {tyyp lisa|eemalda,
  spaceId, kpv ISO, hind, parkKohad, tagatis ±}). Allkirjastatud dokument EI muutu: mall/tekst loeb `lepPohiPinnad`; hõive, üür,
  parkimine, kalender loevad KEHTIVAID pindu `lepPinnad(l, tana)`/`lepKuus`/`lepParkKohad` (jõustunud muudatused kuupäeva järgi;
  `lepPindAjakava` stardis). Tagatis: lisal +N kuu üür (muudetav), eemaldamisel vahe tagastatakse (vaikimisi) või jääb. Viimast
  pinda ei eemaldata → lepingu lõpetamine. Pakkumuse paanis 3. valik „Lisa kehtivale LEP-…” (sama klient, sama maja).
  Pinnakaardil tulev muutus (v652, `pindAjakava`): „Vabaneb dd.mm.yyyy · Lisa N” / „Üüritakse alates … · Lisa N” / „… · allkirjastamata”.
- **Poolte esindajad = tabel (v699–704, kasutaja 29.09):** `l.esindajad = { yl: [..], yy: [..] }`, rida {roll, nimi, tel, epost}
  (`lepEsindajad` vaikimisi `esVaikimisi`: üürileandja profiilist + `ACCOUNT.landlord.kontaktisik`, üürniku 1. rida lepingu
  kontaktist). P 6.1/6.2 töövaates JA A4-s `esTabelHTML` (v705: kaherealine kirje roll | nimi / telefon · e-post — tekst ei murdu
  keset sõna); muudab `esMuudab`:
  operaator oma poolt kuni allkirjastamiseni + üürniku poolt mustandis, üürnik OMA poolt kuni allkirjastamiseni otse A4-s.
  Üürniku 1. rida = `l.kontakt`. Punkti tekst = `esTekst` (otsing, diff); mustandis `rebuildPohi(noLog)` (osa v1-st).
  A4-murdja: lehest kõrgem plokk → leht kasvab (`minHeight`), sisu ei lõigu.
- **Parkimise VAIKEJAOTUS (v586, kasutaja 25.09):** majas on kohad pindade vahel jaotatud (`SPACES[].parkKohad`,
  allikas `t6b-parkimine.xlsx`; üldkasutatavad `PARK_ERI`). Pakkumus/leping võtab pinna kohad VAIKIMISI (`offerParkKohad`,
  `pinnaKohad`), plaanilt saab ümber määrata („Pinna kohad" taastab). Pindade import loeb T6B struktuuri (osad m², parkimiskohtade numbrid).
- **Pinna jagamine üüriüksusteks (v588, kasutaja 25.09):** harv erijuht, ainult toiminguna (`openJaga`). Ema-pind jääb alles
  („Jagatud"), üksused (`emaId`) summeeruvad ema üüripinnaks — maja üüritav pind ei muutu. Kokkuvõtetes kasuta `pindYksus`
  (mitte kõiki `SPACES`). Uus pindu summeeriv koht peab jagatud ema välja jätma.
  **Olmeala saab jagada A ja B vahel (v639–640, kasutaja 27.09):** valik A · B · A+B; A+B puhul sisestatakse A m² käsitsi,
  B = ülejäänu (`JAGA.yhA`, `jagaYhA`). Ühiskasutuse märget pole — kumbki üksus saab lihtsalt oma olmeala osa.
- **Lepingute import (v595 → v622, Steveni demost, kasutaja 25.09):** `#/import` loeb PÄRIS allkirjastatud faile (.asice/.pdf/.docx)
  brauseris — ZIP DecompressionStream-iga, PDF pdf.js-iga (cdnjs), tekstikihita PDF Tesseract.js-iga (eesti keel, cdn.jsdelivr.net).
  Need kaks on AINSAD lubatud välised teegid ja laetakse alles vajadusel. v622: laud LEPINGU kaupa (toimik = leping + lisad +
  kaasdokumendid), ülevaatus samm-sammult, allkirjade meetod (ID-kaart / Mobiil-ID / Smart-ID) konteinerist, kinnitus tagasivõetav.
  Väljad T6B malli siltide järgi, iga väärtus viitab originaali kohale (`ank`); kahtlus → kasutaja kinnitab. Päris lepingute
  andmed (sh isikud) elavad ainult brauseris (localStorage + IndexedDB „thinkone_import"), repos neid ei ole.
  **Iga import on salvestatud partii (v638, kasutaja 27.09):** failid kannavad `pid`; `#/import` = impordikaartide loend
  (Pooleli / Lõpetatud, pf-card mudel), `#/import/p/<pid>` = ühe impordi laud, ülevaatuse järjekord impordi sees. „Jätka”
  (`impJatkaHref`) viib viimati avatud pooleli kirjeni (`f.viimati`); pooleli import on avalehe „Vajab tegevust” all.
  **Pinna olek tuleb dokumentidest (v602 → v657):** `pinnaOlekSync()` tuletab oleku IGA `DB.save()` ja käivituse ajal (mähis stardis):
  leping (allkirjastatud → Üüritud; allkirjastamata / tulevikus lisanduv → Lepingus) › Lisa N koostamisel (Lepingus) › kehtiv import
  (Üüritud) › avatud pakkumus, `OFFER_LOPP` väljas (Pakkumusel). Dokumendita Pakkumusel/Lepingus → Vaba; Üüritud jääb, v.a sama
  üürniku dokument sellel pinnal on lõppenud. Pinna olekut EI kirjutata enam käsitsi uutes kohtades — muuda dokumenti ja salvesta.
- **Uus konto + „Alusta · 10 minutit" (v623):** ettevõte `uus` (`COMPANIES`, andmevõti `thinkone_demo_v1_uus`) on tühi konto;
  `#/alusta` seadistusvoog: 1 ettevõte äriregistrist (päris e-äriregistri avalik otsing, võrguta tagavara `AL_REG_VARU`) → 2 hoone
  EHR-ist (näidisotsing `AL_EHR`) → 3 pinnad tabelist (sama CSV-import, näidis `PINNAD_NAIDIS`) → 4 lepingud (impordilaud).
  Tehtud sammud tulevad andmetest, mitte linnukesest; tühjal kontol ütleb iga põhileht, kus seadistus pooleli on.
- **Pinna leht `#/pind/<id>` (v653–655, kasutaja 28.09):** pinnakaardi klõps esemete all avab PINNA LEHE (mitte enam otse lepingu;
  üürniku link kaardil viib endiselt lepingusse). Osapoole lehe muster (`View.pind`, op-* klassid): päis (olek, tulev muutus, üüripind ·
  €/m² · üür kuus) · juhtkaart · Praegu (kaardimudel) · Tähtajad ja muudatused (`pinnaTahtajad`: KEY_DATES + Lisa N ring + lepingu
  lõpp/pakkumuse kehtivus) · Arhiiv. Külgveerus TOIMINGUD oleku järgi (vaba: Loo pakkumus · Lisa lepingule LEP-… · Jaga üksusteks ·
  Kustuta pind (v794, `pindKustuta`: AINULT dokumendivaba pind — `pindKustutaKeeld` keelab ka arhiveeritud/imporditud lepingu ja lõppenud
  pakkumise korral, jagatud ema/üksus → ühenda enne; kinnitus + 10 s „Võta tagasi”, kustutamine ja taastamine sündmuslogis; pinna
  parkimiskohad jäävad registrisse pinnata);
  lepingus: Ava leping · Algata muudatus · Eemalda pind (mitu pinda) · Lõpetamine) + pinna andmed. Seos lepinguga `lepPindSeos`
  (on/ring/endine); `openPindMuut(lid, tyyp, sid)` eelvalib pinna ja salvestus viib lepingusse muudatusrežiimis. Lepingu juhtribal
  pinna nimi → pinna leht (`.lm-pind`).
  **Pinna andmete muutmine (v658–659):** pinna lehe „Pind” kaardil „Muuda andmeid →” (`pindMuuda`) avab objekti seadete redaktori
  ÜHE PINNA režiimis (`OBJ_DRAFT.pind`: ainult see pind, stepperita, „Salvesta” salvestab kohe ja viib pinna lehele). Osade
  jaotus on muudetav (`osa_<k>` väljad, `OBJ_OSAD`) — summa peab võrduma üüripinnaga (valideerimine; muidu kaoks jaotus).
  Dokumendiga pinnal (`objPindLukk`: leping/import/avatud pakkumus) on üüripind LUKUS + märge; hinnakirja muutus ei mõjuta
  lepingut ega avatud pakkumust (`objHindKylmuta` kirjutab vana hinna `o.hinnad`-i). Sama kehtib objekti seadete täisloendis.
- **Pinnal pole netopinda ega koefitsienti (v656, kasutaja 28.09):** meie mudelis on ainult üüripind (+ osade jaotus); `neto`/`koef`
  eemaldati andmetest, kaartidelt, vormidest ja impordist. Hoone EHR-i „Suletud netopind” on eraldi asi ja jääb.
- **Kalender ajajoonena ja osapoole leht (v617 → v625):** kuupäev vasakul · selgroog · sündmus; täidetud merevaik = vajab otsust,
  tühi ring = rakendub ise (`kalIse`), möödunud read tuhmuvad, kuu pealkiri kleepub, „Täna" joon, üleval „Järgmised 30 päeva".
  Osapoole lehel sama täpp tähtaegadel.
- **Neli märki ja üks kaardimudel (v607):** Seis = `pill`, Kord = `kordMark`, Lugemata = `lugemataMark`, Arv = `arvMark` — uus loend/kaart
  kasutab `pfMudel`/`kaartHTML`/`ridaHTML` (järjekord: nimi+seis · tunnus+ese · raha · aeg · järgmine samm), mitte oma tabelit.
  Osapool tuletatakse dokumentidest (`osapooled()`, `#/osapool/<id>`), arhiivi sisu ainult päris andmetest (`arhiivInfo`).
  Steveni demost tuuakse funktsioone ÜHEKAUPA, põhidemo kujunduskeeles (`demo 2 - Steven/` on ainult lugemiseks).
- **Nupud (v629 →, kasutaja 27.09: „liiga palju erinevaid nuppe"):** koondame ~10 kujule. Kõrgusi on KAKS: `.btn` 40 px
  (`min-height`), `.btn-sm` 32 px. Hele esmane = AINULT `btn btn-primary` (`btn-accent` on kaotatud; „+ Uus" `btn-loo` ja rollinupp
  `role-tab` on `btn btn-primary` + ainult asukoht/pluss-pööre; ülariba „+ Uus” = `btn-sm`, v773). Teisene = AINULT `btn btn-ghost` (`btn-soft` kaotatud v630;
  kontekstis ei värvita ümber — ka mitte inline-stiiliga). Portfelli tööriistariba (`pf-new`) = `btn btn-ghost btn-sm`.
  Hoveril nupp EI nihku üles (v631, kasutaja) — tagasiside ainult varju/värviga. Kontuurnupp = avalehe kiibi välimus (v632:
  `--surface`, `--edge` äär, varjuta, kiri 500, hoveril `--surface-soft`). Nupu ikoonil EI OLE kasti (v632) — lihtne joonikoon.
  Ikoon liigub hoveril TÄHENDUSE järgi (v633): `I`-kaardi ikoonid kannavad `data-i` nime, animatsioonid styles.css lõpus
  (plokk „Ikoonide hover”) — nupud, avalehe kiibid, külgriba; uus ikoon lisa sobivasse rühma.
  Tekstinupp = AINULT `steplink` 12/600 (v634) — kontekstis suurust/kaalu ei muudeta; toimingurida `act-row` jääb
  omaks. Punane `btn-quiet` = 40 px tekstinupp otsuste paanis.
  Ikoonnupp = 32 px ring, hall ikoon 16 px (`icon-btn` · `sb-collapse`); saatmisnupp = 32 px hele ring,
  üles-nool (`omni-send` · `ag-send`) — v635. **Ülariba otsingukast (v773, kasutaja 30.09):** 32 px (= „+ Uus” `btn-sm` kõrval, ühel
  keskjoonel), `--line` serv, r 8, varjuta; „Ctrl K” äärisega kastis; saatmisnupp kasti sees ruut 24 px r 6 (`.omni .omni-send` —
  avalehe komposeri ring jääb). 2. etapi ümberkujundus (suund A „Tööriist”) võeti 30.09 tagasi — alles jäi ainult see otsingukast.
  Segmentlüliti (v636) = portfelli alamsakkide keel: läbipaistev 13/500 `--muted`, aktiivne `--surface-soft` + `--ink` 600,
  reakõrgus 16 px (`pf-view`, `pf-mode`, `df-tab`, `lm-doc`, `pf-subtabs`). Kiip = `--surface-soft`, äärte ja varjuta,
  r 8, 12/500, 28 px; valitud `.on` = `--ink` täidis (`preset-btn`, `al-naide`, `pk-chip`, `ir-dok`; `cal-chip` kompaktne).
  Uus nupp EI saa oma visuaali — vali olemasolevast: btn-primary · btn-ghost · btn-green · steplink · btn-quiet.
- **Parkimiskohad on ERALDI ese, seotud hoonega (v551, kasutaja otsus 24.09):** mitte pinnaga. Kohad tulevad hoone
  parkimisplaanist (`PARK_SVGS` data.js-is, allikas juurkausta `parkimisplaan.svg`; 115 kohta). Hõive TULETATAKSE
  dokumentidest (`parkHoive`: leping `l.tehing.parkKohad` › imporditud leping › pakkumus `o.parkKohad`); objekti lehel on
  parkimisregister (plaan olekuvärvidega, koha kaart, „kasutusest väljas" → `PARK_MUUD`). Pakkumuses (mustand/ettepanek) ja
  lepingu mustandis/läbirääkimisel määratakse kohad plaanilt (`parkPick`, „Vali lähimad vabad" = pinna uksele lähimad);
  Lisa 2 = genereeritud plaan (`fail: "park:"`, `openParkLisa`), P 2.2 lause loetleb numbrid. Kehtival lepingul saab kohti
  VAHETADA (arv sama) → `l.parkAjalugu` + P 2.2 ajalugu. Pakkumus → leping kannab kohad üle.
  **Arv tuleb ALATI valikust (v555):** kus hoonel on plaan, ei muudeta kohtade arvu numbrina — läbirääkimise ettepanek
  „Muudan: parkimiskohad" valib kohad plaanilt (`parkFaktValik` → `ep.parkKohad`), kinnitusel muutuvad arv JA kohad;
  üürnik näeb ettepanekut plaanil (`parkEelvaade`).
  **Parkimisregister (v660–661, kasutaja 28.09, 1. etapp):** alus on hoone kohtade LOEND `parkReg(objId)` = [{nr, tsoon, tyyp
  tavaline|elekter|inva|reserv, uld}] (salvestatud `PARK_REG`, data.js); plaan on valikuline kiht. Plaaniga hoonel (T6B) tuleb
  vaikeregister plaanilt + `PARK_ERI`. „Kas hoonel on parkimine?” → `parkOn(objId)`, plaan → `parkPlaaniga(objId)` — MITTE
  `parkSvg`. Plaanita hoonel on kohad kiipidena tsooni kaupa (`parkKiibidHTML`, sama olekuvärvistik; klõpsatav `PARK_KLIKK`), Lisa 2 =
  kiibid. Haldus `#/parkimine/<objId>` (objekti registris „Halda kohti”; tühjal hoonel „Lisa parkimiskohad”): lisamine vahemikuga
  või tabelist (`nr;tsoon;tüüp;pind`, nr võib olla 10-20) — ainult plaanita hoonel; valitud kohtadele tüüp, tsoon, üld/üüritav,
  pinna vaikejaotus (`pkhMaaraPinnale` → `sp.parkKohad` + `parkimine`), kustutamine (dokumendis olevat ei kustutata).
  Pinna redaktor kontrollib, et pinna parkimiskohad on registris. 2. etapp (plaani üleslaadimine/joonistamine) = hiljem.
  **Olekud (v663, kasutaja):** Vaba · Pakkumuses · Üüritud (leping ükskõik mis olekus + import; allkirjastamata märge ainult koha
  kaardil — „Lepingus” eraldi EI OLE) · Elektriauto (oma värv `--pk-ev`) · Reserv (endine „üldkasutatav”; lipp `k.uld`, mitte tüüp)
  · Kasutusest väljas. Reservi ja elektriauto kohti saab pakkumuses/lepingus VABALT valida (`h.vaba`); „Vali lähimad” võtab ainult
  tavalisi kohti. Tüübid: tavaline · elektriauto · ligipääsetav.
  **Haldus pindade kaupa (v664–666, kasutaja: „raske aru saada, mis pinnaga ja mitu”):** `#/parkimine/<objId>` vaikevaade
  „Pindade kaupa” (`pkhPinnadHTML`): rida = pind (üürnik, arv, kiibid olekuvärvis, lahknevus dokumendiga ⚠) + kogumid Pinnata ·
  Elektriauto · Reserv · Kasutusest väljas; rea klõps → eelvaade paremal (plaan/kiibid). „Muuda” = sama kohavalija mis pakkumuses
  (`parkPinnaMuuda(sid)`, `pkhKogumMuuda`). Termin on „PINNA KOHAD” (mitte vaikejaotus). „Kohad” vaade = tüüp/tsoon/reserv/kustuta.
  Objekti registris „Näita pinna kohti” (`PARK_REG_PIND`); pinna lehel parkimiskohtade real „Muuda” + „Lepingus”, kui erineb.
  **ÜKS KOHT IGA TASEME JAOKS (v668, kasutaja):** (1) hoone kohad — tüüp, tsoon, reserv, elektriauto, kasutusest väljas,
  lisamine/kustutamine — AINULT haldus `#/parkimine/<objId>`; objekti register on ülevaade (koha kaardil „Halda kohta →” =
  `parkHaldaKoht`). (2) Pinna kohad — AINULT kohavalija `parkPinnaMuuda` (sisenemised: halduse pinna rida, pinna leht, pinna
  redaktori kirjutuskaitstud rida `objParkRida`); vabateksti pole (erand: uus pind — numbrid kontrollitakse registri ja teiste
  pindade vastu; registrita hoone — ainult arv). CSV-import = esmane sisestus. (3) Üürniku kohad — AINULT dokumendis; mujal
  näidatakse lahknevust + link „Muuda dokumendis →”. Uut parkimise muutmiskohta EI lisata — suuna olemasolevasse.
- **Kommentaarid ja arutelud on ALATI paremas paanis (v432, kehtib edaspidi alati):** lepingu punktilõim
  igas olekus (ka Kehtiv — inline `.clause-expand` on eemaldatud) ja pakkumuse läbirääkimised (`#nego-panel`)
  elavad `.cl-side`-s. Dokumendi veergu lõime ei avata; klõps punktil valib selle paanis (`selectPunkt`).
  **Valik vabaneb (v761, kasutaja 29.09):** klõps dokumendist KÕRVALE (mitte paanis, dokumendilehel ega nupul) ja Esc
  (`lepPunktValik`, püüdefaasis) — sama sujuv sulgemine kui teine klõps (`togglePunkt`). Esc sulgeb enne avatud modaali;
  tekstiväljal lahkub esimene Esc ainult väljalt.
- **Paigutusreegel (v424, kehtib edaspidi alati):** otsuse-/läbirääkimiste paan on ALATI akna paremas
  servas (`.cl-side` = fixed, täiskõrgus, lõuendi taust + vasak juuspeen joon; ruum reserveeritakse
  `body.has-panel .main { padding-right: var(--paan-r) }`, klassi paneb `router()`). **Dokument seisab EKRAANI keskteljel
  (v760, kasutaja 29.09)** — üürnikul ja üürileandjal samas kohas, leping, pakkumine ja eelvaade (`docview`): `.view` vasak
  veeris = clamp(0, (100% + paan − külgriba − `--doc-v`) / 2, 100% − `--doc-v`), s.t täpselt keskel, kui mahub, muidu nihkub
  vaid nii palju, et paani/külgriba alla ei jää. ≥1440 px kahaneb paan 400 → 288 px (`--panel-w` clamp, 1660 px ja laiemal 400),
  et täis-A4 mahuks keskele; mõõdetud: ≥1440 px nihe 0 mõlemal poolel. Omnibox on samal teljel (`margin-right` ≈ külgriba).
  Dokumendid on A4 laiuses (`--a4: 794px` = 210 mm @ 96 dpi; `.doc`, `.sheet`, `#a4-wrap`, `.cl-full`). Alla 1440 px ei mahu A4 + paan
  kõrvuti: paan voolab sisu ETTE tavalise plokina (`--paan-r: 0`), veerg on A4 laiune ja sama valemiga keskel.
- Disainikeel (v423, „coded visuals"): TUME NEUTRAALNE vaikimisi — must lõuend (`--paper` oklch 14.5%),
  kaardid oklch 20.5% juuspeene servaga (`--edge`) + pehme vari, tekst oklch 98.5%. Brändivärvi pole:
  `--ink` = maksimaalse kontrastiga pind JA tekst, `--on-ink` selle vastand; esmased nupud ja aktiivsed
  olekud on HELE pind tumeda tekstiga (`--ink-grad`, `--accent` = oklch 92.2%). Staatuspered jäävad
  OKLCH-harmooniasse, aga heledas astmes (roheline 155 · ooker 82 · punane 25 · sinine 250 · petrooleum 205);
  `*-soft` on sama toon läbipaistvana. Ainus värviline aktsent on prisma-helk („sinu kord" juhtkaart,
  kinnitusteade) — mujal värvi ei lisata. Hele vaade elab `[data-theme="light"]` all, lüliti ülaribal
  (`toggleTheme()`, localStorage `thinkone_theme`, vaikimisi tume; teema seatakse `index.html` peaskriptis
  enne CSS-i, et sähvatust ei tekiks). Tüpograafia: Inter Tight (pealkirjad) / Inter (UI) / Geist Mono (mõõtarvud).
- **Arvud tuhandeeraldajaga (v567, kasutaja):** kõik summad/pindalad läbi `eur(n, frac)` — tühik (murdumatu) ka 4-kohalistel
  (`1 328 €`, `3 215 m²`); `toLocaleString` otse ei kasutata (et-EE jätaks 4-kohalised ilma eraldajata).
- **Avaleht = „Fookus” (v672 → v770, kasutaja 29.09: „muudame avalehte ikkagi rohkem selle sarnaseks”):** „Tere, Tarmo.” ·
  „N asja ootab sind. Alusta sellest.” · KOMPAKTNE fookuskaart (`dh-hero`: silt „01 · järgmine samm · kiire” + aeg · pealkiri ·
  üks rida · üks nupp + „Hiljem”) — kasutaja: „kõvasti väiksemaks, vähem kirjuks, ära näita AI teksti, lühike ja lööv”: AGENDI
  MUSTANDIT, tsitaati ja prismat kaardil EI OLE (neutraalne serv + vari; toon ainult kiire aja tekstil) · „Järgmisena” read
  (`dh-row`, 4 + „Näita veel”; v787 kasutaja: iga rea ja fookuskaardi pealkirja ees väike kastita joonikoon `.dh-ic` = tegevuse `ic`) · viited (vestlused, „N rakendub ise · Kalender”) · komposer all (`dashKomposer`: märk · režiim
  „Kiire vastus” · manus · hääl · saada → `aiAva`; prisma süttib ainult fookuses nagu omnibox) — „alumine ots on nii hea”.
  Andmed = `avJarjekord()` (üks otsus `p7Samm`, sama mis portfellis); rohelised (rakendub ise) ridadeks ei tule. „Hiljem” =
  `ACT_HILJEM` (sessioon). Kolleegi „Vajab tegevust” (filtrid, triaažiriba, `av-*`) on eemaldatud koos CSS-iga.
- **AI leht `#/ai` (v771, kasutaja 29.09: „reastumised keskel, vestlustele kustutusnupp, selgus majja”):** ÜKS telg — päise
  kontekstikiip, vestlus, sisend, teated ja ülariba „+ Uus” on `ail-main` keskel (`body:has(.view.ai-leht) .omni-center`
  nihe `--ail-w`); vestlus ja sisend sama laiusega `--ail-col` (760). Päises ainult kiip „Kontekst · LEP-… / Kogu portfell”
  (`aiCtxSilt`) — kui vestlus algas mõnelt lehelt, on kiip link sinna tagasi (eraldi „Tagasi” pole). Ajaloo real kustutusnupp
  (`icon-btn ail-del`, hoveril/valitud real/sahtlis alati) → `aiLoimKustuta` kustutab kohe + 10 s „Võta tagasi” (`toastTagasi`,
  sama mis impordi tagasivõtt). Mobiilis ajalugu = täiskõrguses sahtel tumeda taustaga (klõps taustal sulgeb).
- **Ülevaade = sakid (v674, 29.09):** neli küsimust = neli kasti minigraafikuga (Üüritulu · Täituvus · Lõpeb 12 kuu jooksul ·
  Tühja pinna hind), klõps vahetab ühe detailipaani (`YL_SAKK`); raha = 12 k tegelik → täna → 12 k prognoos nullbaasil; võrdlus
  „Eelmine kuu / aasta” (`thinkone_yl_vord`). Labor: `ylevaade-variandid.html`.
  **Värvid neutraalsed (v698, kasutaja: „eelmine versioon meeldis, värvid paigast”; v695 kest + juhtkaart tagasi võetud):**
  ülesehitus jääb (KPI-kastid minigraafikutega = sakid, plokid); `--yl-hoiv` = `--ink`, `--yl-pakk` = hall, `--yl-vabaneb` = ooker —
  sinist ega muud brändivärvi pole. Etapirada noolekujuline, toon neutraalne; mobiilis 2 veergu.
- **Kujunduse ühtlustamine (v676 →, kasutaja 29.09):** vanemad lehed tuuakse järk-järgult uuemasse keelde — eeskuju on
  impordi ülevaatus ja lepinguvaate parem paan. Muster: õhuke monospace-riba (`.lep-riba`: number · olek · dokumendid) ·
  keskel A4-dokument (`.a4-doc` > `.sheet.sheet-embed.a4-page`, `sh-head`/`sh-lbl`/`sh-tbl`/`sh-up`) · paremal `.cl-side` >
  `.side-stack` kaardid, pealkiri = kaardi esimene `.overline` (või `.between` > `.overline`), read `act-row`/`sa-inline`.
  **Imporditud leping (v676–678)** on esimene: `View.imporditud` = riba (+ otsing `#kl-q`) · struktureeritud dokument
  (`impDokHTML`: põhitingimused tabelina, punktid osade kaupa, Lisa 3 muudatus punkti juures, „lk N” → originaal) · paan
  (`impPaanHTML`: Toimingud · Toimik · Tähtajad kompaktselt `imp-td` · Allkirjastatud originaal). Riba: `.ir-tagasi` „← Portfell” +
  dokumendipillid `.ir-dok` (sama kui impordi ülevaatuses) + otsing; all keskel „algusesse” pill `#doc-top` (v693–694).
  **TOIMIK KLAUSLIKIHIS (v679–680, kasutaja: „muidu pole RAG-ile nähtav”):** impordil läheb klauslikihti (`KLAUSLID`/`x.klauslid`,
  sellest loevad otsing, agent `klOtsi` ja vaade) põhileping (PT/ÜT) + IGA LISA oma osana `L<nr>` (`impKlLisa`, oma originaal
  `k.failid[osa]`) + kaasdokumendi väljavõte `D<n>` (`impDokLisa`, `x.dokumendid`). Lisa muudatus salvestub `x.muutused`
  {silt, enne, parast, lisa, kp}; vaates „Kehtivad põhitingimused” näitab iga muudetud väärtuse päritolu. `impToimikMigr`
  viib vanad impordid stardis samale kujule. Joonised (plaanid) = ainult originaal, mitte „struktureerimata”.
  **Kehtiv seis = dokumendi 1. leht (v681–684, kasutaja):** `impSeisHTML` — neli võtmearvu (`IMP_VOTI` liigi järgi) ·
  ajariba `impAjariba` (sõlmitud → täna → lõpp; lisa roheline, tähtaeg ooker romb = vajab otsust, tühi romb = rakendub ise) ·
  teemad `IMP_TEEMA` (Raha · Ese · Aeg · Muu) + „Kokkulepitud erisused” (lisade punktid) · iga väärtuse allikas `impAllikas`
  („PT 3.1 ›” / „Lisa 2 ›”, klõps kerib punktini; lisaga muudetud roheline + „enne”). NB: vaate juurklass on `imp-v` —
  alamklassid ei tohi seda nime kasutada (v681 kokkupõrge: `.imp-v b` suurendas kõik paksud tekstid).
  **Pakkumus ja leping samas joones (v725–726, kasutaja 29.09):** riba = `.lep-riba.imp-riba` — **v769 (kasutaja):** rida 0 `.imp-r0`
  `.ir-tagasi` „← Portfell” (üürnikul „Minu dokumendid”); rida 1 dokumendipillid; viimane rida `.imp-kysi` „Küsi selle … kohta”
  paremal VAHETULT lehe kohal (imporditud lepingul samal real otsinguga; üürnikul pole). Numbri/olekuraja rida on eemaldatud
  (sama imporditud lepingul — arhiivi olek on selle paanis). Dokumendipillid `.ir-dok` (Leping/Pakkumus = `on`, lisad, Eelvaade ·
  PDF, „Muudatused · N →” ja seotud leping katkendääres `eraldi`); kehtival lepingul pillid = dokumendivalija (`lepDoc`).
  Dokumendi ees VÕTMEANDMETE LEHT (`votiSeisHTML`, impSeisHTML mudel): päis (olek · pool · ese | AEG) + neli arvu. **v763 (kasutaja):
  leht = tänane seis** — paremal ainult aeg (`o.aeg`: leping „Kehtib veel 4 aastat 9 kuud” + periood / „Algab” / „Periood” / „Kehtis”,
  pakkumine „Kehtib veel N päeva · kuni …” / „Kehtib kuni”; `kestusTxt`); pealkiri, number ja kuupäevad AINULT dokumendi päises
  (number + olek ribal) — lehele neid tagasi ei panda. „Küsi selle … kohta” (`aiKysiNupp`) = `btn btn-ghost btn-sm`, prismata
  (prisma on ülariba AI-sisendil). Neli arvu: leping `lepVotiHTML` (üür kuus · €/m² · üüripind · tagatis, allikas „P 3.1 ›” → `ltreeGo`), pakkumus `offerVotiHTML` (üür · €/m² ·
  m² · rendiperiood; hinnamuutusel `recalc` uuendab). Muudatusrežiimis lepingul lehte pole.
  **Allkirjad = platvormi kaart (v685–686, kasutaja):** imporditud lepingu paanis `impAllkirjadCard` sama `.sg-card`/`.sg-row`
  kujundusega kui platvormi `allkirjadCard` (pool · roll · ✓ · isik · meetod · aeg · n/2) — platvormis ja väljaspool allkirjastatud
  näeb välja ühtemoodi. Allikas `impAllkSeis`: konteineri allkirjad (kehtivus, ajatempel) või allkirjade tekst; pool üürileandja
  esindajate nimede järgi. NB: `impAllkirjastajad(T)` on impordi tekstituvastuse funktsioon — nime ei korrata.
  **Teksti struktuur (v687–692, kasutaja: tabelid/kontaktid üksteise otsas):** (1) IMPORT — `pdfTekst` säilitab read (
) ja veerud
  (	; pdf.js tühikutükk jäetakse vahe arvutusest välja), `impPunktid` → `impTekstVorm` (lõigu jätkread liidetakse, tabeli-/
  loendiread jäävad) + `IMP_JAGU_SABA` (järgmise jao pealkiri maha), punkti tekst kuni 1500 märki (varem 240!), kaasdokumendi
  väljavõte 2000. Tuvastus (v-väljad, punktid, lisade mõjud) on vana koodiga IDENTNE — kontrollitud 15 päris failiga.
  (2) KUVAMINE — `klStruktuur(tekst)`: read/TAB → `klRidadest`; muidu kontaktplokk `klKontakt` (lühike, ≥ 2 rolli/silti) ·
  tabel `klTabel` (hinnakiri „… EUR”, sagedus „… 2x aastas”, „TÖÖD SAGEDUS” sektsioonid) · loetelu `klLoend`/`klTapid`.
  Algtekst (otsing, AI) jääb muutmata. Päris lepingufaile testitakse ainult kohapeal; testprofiil ja tulemused kustutatakse.
- **ÜHENDAMINE kolleegi versiooniga (`demo 4/`, 29.09 →, plaan `ThinkOne_uhendusplaan.md` — seal „tema” = meie, „meie” = demo 4):**
  alus jääb `demo/`, toome teemade kaupa MEIE kujunduskeeles (üks prisma vaate kohta, hoveril ei hüppa, kiibid/nupud meie kujul).
  Otsused: läbirääkimine = MEIE voorud (Kokkulepet ei tooda) · Avaleht = kolleegi „Vajab tegevust” (v770: tagasi meie „Fookus”, vt ülal) · päis = meie riba + võtmeandmete
  leht (+ „muudetud V2”, v767 roheline `--green-ink` nagu paani „Muudetud” — kokku lepitud, mitte otsus) · sõnavara kolleegilt · mitu pinda ja Ülevaade meie omad · kalender = meie ajajoon + kolleegi sakid/filter.
  Tehtud (v727–746): arhiiv (seisukiibid) · AI leht `#/ai` · Avaleht + portaal + kasutajamenüü · kalender/Suhtlus/Seaded ·
  sõnavara („Pakkumine”, „Seis”, üürnikule „Teie …”, „V2”; marsruudid/võtmed jäid) + `kpD`/`paevadeVahe` · ÜKS järgmise sammu otsus
  `p7Samm` (portfell, Avaleht, portaal, Suhtlus loevad seda) · kirjad (`doc.kirjad`, põrge, meenuta) · versioonid V1…Vn + Ajalugu.
  Deal room (v747–752): üürnikul külgriba/omnibox peidus, päises ainult ThinkOne logo · Minu dokumendid · kasutaja.
  **v774 (kasutaja 30.09, proov):** logo `.dr-brand` on ülariba KESKEL (= akna ja dokumendi telg); et see paremat plokki ei kataks,
  kaob ≤ 1239 px kasutaja nimi (avatar jääb) ja ≤ 979 px „Tagasi operaatoriks” tekst (silm jääb).
  **v776 → v777 (kasutaja 30.09):** üürniku „← Minu dokumendid” = KLEEPUV ikoonnupp (`drKleep`: `.dr-kleep-w` sticky, kõrgus 0 +
  `btn btn-primary btn-sm .dr-kleep` 34 px — v778 kasutaja: must (tumedas teemas hele), nool täpselt keskel: `.btn.btn-sm.dr-kleep
  { padding: 0 }` tühistab `.btn-sm:has(> svg:first-child)` vasaku polstri) dokumendist VASAKUL 96 px päise all — dokumendi kohal eraldi rida pole, dokument on
  selle võrra kõrgemal. ≤ 1099 px (vasakul ruumi pole) tekstiga nupp dokumendi kohal, kleepub päise alla. Lepingul ja pakkumisel;
  portaalis pole. Päises ega ribas seda linki pole (v775 päise vasaku serva navigatsioon võeti tagasi). Paremal ainult identiteet: kasutaja + „Tagasi operaatoriks”. ≤ 560 px logo
  ei ole keskel (kattis avatari), vaid vasakul.
  Allkirjastamine (v753–754, kolleegi Plokk 6): allkirjastajad ANDMETEST (`allkirjastajad` + `esindus: "üksi"|"ühine"` —
  üürileandja `ACCOUNT.landlord`, klient `CLIENTS[]`; ühine = allkirjastavad kõik), allkirjad ISIKU kaupa `doc.allk` (`p6Seis`,
  `p6Loend`, `p6Jargmine`; vana kahe pesa `allkirjad` sünkroonib `p6SlotSync`, `lepSig` loeb seda), allkirjastamine AINULT Dokobiti
  aknas (`p6Allkiri(lid, nr)`, sama leping ja Lisa N), päris ASiC-E `.asice` (`p6Laadi`), allkirjakutsed kirjana (`p6Kutsu`).
  Kaardid meie `sg-card` kujul (`allkirjadCard(l, ring)`, `lepAllkKaart`). **v762 (kasutaja):** A4 ülanurga allkirjamärki
  (`a4SigBadge`) EI OLE — allkirjastatud lepingul on paanis SAMA „Allkirjad” kaart mis allkirjastamisel (+ ASiC-E konteinerid,
  jalus „on allkirjastatud”); valitud jõustunud Lisa N allkirjad eraldi kaardina ees. Vana „Kehtiv leping” kaarti pole. Pikendus (Lisa N `pikendus: true`, automaatika 90 p enne
  lõppu, `p6PikJuht`, „Ära pikenda”), indekseerimine rakendub ise (`p6IndeksRakenda`, `l.indeks.ajalugu`, kuuüür = `lepKuus` ×
  `p6Tegur`, päises „indekseeritud”), tähtajad `p6Sync` → KEY_DATES (`p6: true`), vaikus → meeldetuletuse mustand juhtkaardil
  (`p6MeenutaJuht`: leping, Lisa N, allkiri). Seeme `p6Seed`: Maatrans LEP-<aasta−2>-001, Pind 8, ühine esindusõigus.
  Etapp 8a (v755, kolleegi v644): auditi PDF (`p8AuditPdf`), tõendite kaust `.zip` (`p8Kaust`, riba pill „Tõendite kaust ↓”),
  AI sõnastus `p8Sonastus` (tingiv → kindel, küsimusele ei leiutata; `aiUmber`/`aiSonasta` kasutavad), „Mis erineb
  tavalisest” kaarti EI OLE (v765, kasutaja: sama info on muudatustes — `p8ErinKaart` eemaldatud, ära too tagasi), üürniku „Sobib” vastusele (`p8KliSobibVastus`), risk osapoolte
  loendis tekstina. Kehtiva lepingu TÄNANE üür = `lepKuusNyyd(l)` (indekseeritud) — portfell/osapool/Avaleht; dokument ja tagatis
  loevad `lepKuus`. „Vaata üürnikuna” jääb HÕLJUVAKS (kasutaja); kolleegi seemneid (Pind 24, PAK-2026-012) EI tooda (kasutaja).
  Etapp 8b (v756): impordi augud MEIE impordi peale — algsed funktsioonid nime all `impKahtlused0`/`irKaart0`/`irMuu0`, v644
  ümbrised lisavad: äriregistri rida (`p8ArRida`, päris e-äriregister, võrguta `AL_REG_VARU`), „Kas see on Pind N?” (`p8PinnaSoov`,
  ainult ÜHESE vaste korral — T6B-s on palju sama m²-ga pindu), kindlustus/hooldus omaette KIN-/HOO- kirjena (`p8TeenusParsi`,
  lõpp kalendrisse), käsitsi vorm loetamatule skaneeringule (`p8KasitsiHTML`), indekseerimine lepingu punktidest (`p8IndeksTxt`,
  T6B ÜT 5.2), tulemus „imporditud · registris kokku”, lisa hinnamuutus ka €/kuus. Imporditud lepingu TÄNANE üür `p8ImpKuus(x, d)`
  (lepingu hind → lisade `x.hinnad` → päris indekseerimise kuupäevad): portfell, võtmeandmed, Ülevaade (`rentAt` — platvormil
  `p6KuusProg`). Vanad impordid: `p8ImpMigr` stardis (indekseerimine klauslikihist, hinnad `x.muutused`-est).
  Surnud CSS koristatud (v758): 221 kasutamata klassi / 535 reeglit maha (vana avaleht dash/dh/dm, vana Suhtlus/agent/pipe,
  vanad lepingu-/pakkumisevaate klassid) — kontroll: 36 vaadet (tume/hele, mobiil, modaalid, Dokobit, import) pikslitäpselt samad.
  `ai-fab` jäeti (taastamisjuhis); dünaamiliselt kokkupandud nimed (`t-${…}`, `imp-…`) jäeti. Uus stiil = ainult kasutatud klass.
  Uus nähtav tekst kirjuta KOHE uues sõnavaras (pakkumine, seis). Detailid ja vahelülid: HANDOFF.md.
- **Kliendiportaal = osapoole lehe muster (v779, kasutaja 30.09: „erineb liiga palju muude elementidega”):** `View.portaal` (`.view.op.po3`)
  = päis (`overline` „Üürileandja · kliendiportaal” · `page-h1` „Tere, …” · `op-meta`) · juhtkaart `.guide.op-juht` (Teie kord /
  Üürileandja kord / Korras + `btn-primary`/`btn-ghost`) · „Teie dokumendid” portfelli kaardimudelis (`poDokMudelid` → `pfMudel`/
  `kaartHTML`; üürnikule pealkirjaks pind, tunnuseks „Üürileping LEP-…”) · VESTLUS ja KONTAKT KÕRVUTI pooleks (`.po3-kaks`; vestlus
  `card` + `ce-in` + `ag-send`, kontakt `op-kaart`/`op-k`) · „Tähtajad” osapoole ajajoonena (`opTahtaegHTML`, KEY_DATES — üürnikule
  sisemine info asendatud). Vana `po2-*` kujundus (sinine kast, siniste ribadega kaardid, must kuupäevaplokk) ja CSS eemaldatud; alles
  ainult sõnumimullid `po2-m*`/`po2-sonumid`. `pfSamm`: üürniku silmis (`p7Klient`) „ok” ei lange operaatori loogikale; `kordMark`
  üürnikule „Teise poole kord” → „Üürileandja kord”.
- **Kliendiportaal (v634 kujundus, v780 paigutus — kasutaja 30.09):** kujundus jääb v634 `po2-*` (tervitus, „Ootab teid/Ootame”
  kast, dokumendikaardid, tähtajad) — osapoole lehe mustris ümbertegemine (v779) võeti TAGASI („eelmine oli päris hea”). Paigutus:
  VESTLUS ÜKSI täislaiuses (v786, kasutaja); all TÄHTAJAD ja KONTAKT kõrvuti ÜHESUURUSTES kastides (`.po2-alumine` 1fr 1fr, stretch;
  kontaktil hoone logo `OBJEKT.logo`, logota hoonel initsiaalid; „Kirjuta üürileandjale” nuppu pole); ≤ 900 px üksteise all.
  **Olekukast (v781, kasutaja, labor `portaal-variandid.html` → A):** tavaline kaart (`--surface`, `--edge`, vari) — olekut kannab AINULT
  IKOONIKASTI taust (v782, kasutaja: ooker `--amber-soft` = ootab teid · hall = ootame · roheline `--green-soft` = korras; sildi täppi pole), nupud `btn-primary`/`btn-ghost`. Sinist ega
  tooniga gradienti pole.
  **Dokumentide rea viimane kaart (v783, kasutaja: „tühja ala kasutada, et seal alati oleks midagi”):** „Soovite midagi muuta?”
  (`poSoovKaart`, katkendjoon, kiibid `pk-chip` Lisapind · Parkimiskoht · Muudatus lepingus) — kiip täidab VESTLUSE sisendi lausega
  (`PO_SOOV`, kursor „…” kohal) ja viib sinna; saadab üürnik ise (sama CommunicationThread → operaatori Suhtlus). Alles jäid üldparandused: `pfSamm` üürniku silmis (`p7Klient`) „ok” ei lange
  operaatori loogikale; `kordMark` üürnikule „Teise poole kord” → „Üürileandja kord”.
- **Pakkumises elektrivõimsus ja lisaomadused (v788–789, kasutaja 30.09):** parkimise ja rendiperioodi all (`park-row`) rida
  „Elektrivõimsus” pinna kaupa (A; vaikimisi `sp.elekter`, erinev väärtus `o.elekter[spaceId]`, `offerElekter`, `offerTotals().elekter`)
  ja „Omadused” (`o.omadused` [{silt, v}], `offerOmadused` = täidetud; soovitused `OMADUS_SOOVITUS`, nt põranda kandevõime) — muutmine
  `mutate` kaudu (audit, versioonide diff „elektrivõimsus” / „Omadused”; pooleli omadus salvestub vaikselt). Dokumendis pinna rida +
  „elektrivõimsus kokku” + „Pinna omadused: …”; kokkuvõtte kiip „Elekter N A”. Klassid `pom-*` (NB `.om-*` on omniboxi/objekti oma).
  **Üle üldtingimuste piiri → eritingimus (v795, kasutaja):** ÜT p 4.4 „maksimaalse voolutugevusega 220V/360V, 63A” — piir loetakse mallist
  (`ULD_ELEKTER_MAX`); kui pinna elektrivõimsus on sellest SUUREM, loob `syncElekterEri` pakkumisse automaatse eritingimuse pinna kaupa
  (`autoElekter`, `spaceId`, „Erandina üldtingimuste punktist 4.4 on Üüripind (Pind N) … NA.”, kirjutab üle „Üld · p 4.4”) — nagu astmelise
  üüri `autoGraafik` (`eriAuto`: käsitsi ei muudeta, uueneb võimsusega, kaob ≤ piiri). Teisendus kannab selle Lisa 3-e (`uld:4.4`);
  eraldi lepingutel ainult oma pinna oma. Omadused (nt põranda kandevõime) on kliendile INFORMATIIVSED — lepingusse ega eritingimusteks
  ei lähe (kasutaja 30.09: kandevõime on piirang, ÜT 4.3 põrandakoormus 5000 kg/m² jääb muutmata).
- **Globaalne SÜNDMUSLOGI (v790–792, kasutaja 30.09; arhitektuur `architecture/architecture.html` §2 invariant 1 + §8):** iga muudatus
  = üks append-only kirje. Demos on ainus kirjutusrada endiselt `AUDIT.unshift/push/splice({aeg, autor, tegevus})` — need on mähitud
  (`logiPaigalda`, ruuteris + stardis) ja `logiNorm` lisab IGALE kirjele `domain_event` väljad: `id` (E-00001…), `ts` (ISO), `account_id`,
  `actor_type` human|system|agent (autor „ThinkOne/Süsteem” = süsteem, „AI…” = agent + `on_behalf_of`), `actor`, `entity_type`
  (pakkumine · leping · imporditud · import · pind · osapool · konto) + `entity_id` (tekstist PAK-/LEP-/KIN-/HOO-…), `action`
  (`LOGI_TEGEVUS`), `payload` {silt, enne, pärast} noole „→” ümbert (`logiMuutus`), `reason`, `correlation_id`; `lv` = struktuuri
  versioon (muutmisel arvutatakse vanad ümber, id jääb). Kirjeid EI muudeta ega kustutata. UUS muudatus kirjutab `AUDIT`-i kaudu, ja
  kui võimalik, kujul „Olem ID: silt vana → uus” (siis tuleb muutus struktureeritult välja). Leht `#/audit` „Sündmuslogi” (külgriba
  alaosas Seadete kohal, kasutaja): tegija-lüliti (`pf-views`), olemi kiibid, otsing, päevade kaupa read (klõps → olem), eksport
  CSV / JSONL (`logiEksport`, eelvaatega) / PDF. Per-leping ajalugu (`p4Ajalugu`) ja tõendite kaust loevad sama `AUDIT`-it.
  **v793 (kasutaja: „kas logitakse ka pinna parkimiskohtade jne sisestamised, muudatused, kustutamised?”):** augud suletud — objekti ja
  pindade redaktor (`objLogiMuutused`: pind lisatud/eemaldatud, iga välja muutus „Pind N: hind 8,00 → 8,50 €/m²”, osade jaotus, pinna
  parkimiskohad, objekti nimi/aadress/kõrvalkulu), parkimise CSV sidumine pinnaga, Lisa N punkti sõnastus, üürnik avas lingi
  (link holder), meeldetuletuse edasilükkamine. **Tagasivõtt ei kustuta logi** — `impTaasta` jätab AUDIT-i alles ja lisab
  kompenseeriva kirje („kinnitamine tagasi võetud … algsed kirjed jäävad logisse”). REEGEL: uus `DB.save()`-iga muudatus kirjutab ka
  `AUDIT`-i (erand: ainult UI-eelistus või pooleli sisestus); ükski kood ei tühjenda ega taasta `AUDIT`-it (v.a ebaõnnestunud salvestuse
  tagasipööramine sama kirje piires).
- **Plaanide hulgi-üleslaadimine (v797–800 → v801, kasutaja 30.09):** lohista/vali palju
  faile (PDF · PNG · JPG · SVG · ZIP, `zipLoe`) → sidumine FAILINIME järgi (`plVaste`/`plPinnaVoti`: „T6B_Pind_08” → Pind 8, „…_B1”/„Buroo 1”
  → Büroo 1; koondplaan jääb pinnata) → read „fail → pind” (vali käsitsi, sama pind mitmes failis → PDF > SVG > pilt, teised välja,
  „asendab …”) → kinnita. Failid IndexedDB-s (`IMP_IDB`, localStorage-isse ei mahu), `sp.plaanFail = "idb:plaan:<pind>:<räsi>.<laiend>"`,
  `plaanNimi`; sündmuslogisse „Pind N: pinnaplaan vana → uus” / „lisatud”. `idb:` loevad: `openPdf` (pilt/SVG → `pdfPilt`, mahub
  aknasse), lisa eelvaade `pdfEelvaade` (asünkroonne blob-URL), ASiC-E (`p6FailiSisu`; failinimi ja manifesti MIME laiendi järgi).
  Koostatud/allkirjastatud dokumendid hoiavad oma lisa (uus plaan läheb uutesse). v801: külgpaneel (`plAva`) on eemaldatud — plaanide
  ÜKS koht on objekti töövoo samm „Plaanid” (objekti lehe „Lisa plaanid” = `objEdit(id, 3)`); ka üksikfail (pinna rida) käib sama teed.
- **Objekti töövoog = „Alusta” keel (v801–802, kasutaja 30.09: „ühe vooga kõik vajalik”):** `#/objekt-uus` ja `#/objekt-seaded/<id>` —
  vasakul sammud olekuga (`al-rada`, `owSeis`), paremal üks kaart (`al-kaart`). VIIS sammu (`OW_SAMMUD`): 1 Hoone (ehitisregistri otsing
  `AL_EHR`/`alEhrOtsi` → faktid + nimi; „Sisesta käsitsi”; logo) · 2 Pinnad (CSV · EHR-i näidis `PINNAD_NAIDIS` · käsitsi; eelvaade
  `alEelHTML(P)` → „Lisa N pinda” mustandisse; kompaktne loend `objPinnadList`) · 3 Plaanid (hulgi `owPlLisa` + `plVaste`, sidumata failid
  valikuga, „Kogu hoone” ühine plaan; ootavad `d.plaanid`-is, IDB-sse `objCommit`-is) · 4 Parkimine (olemas → ülevaade + halduse link;
  puudub → register tabeli numbritest / vahemikust `owPark`, „Parkimist pole”; pinna kohad peavad loendis olema) · 5 Tingimused (KM,
  kõrvalkulu, mall) + kokkuvõte. Kohustuslik ainult hoone; uus objekt salvestub viimasel sammul, muutmisel „Salvesta muudatused”
  igal sammul (register luuakse muutmisel ainult, kui samm 4 oli lahti). Registri hoone võtab demos oma id (`obj-t6b` → plaan, näidis).
  Pinna lehe „Muuda andmeid” = sama redaktor ühe pinna režiimis (`objDrawPind`). `objReady`: kõrvalkulu → samm 5, plaan → samm 3.
  Sisenemised: ülariba „+ Uus” menüü „Objekt” (v804, `renderLooMenu`: Pakkumine · Leping · Objekt · Import), Esemete sakk, objAddCard.
- **Kolleegi audit 30.09 → v805–806 (reeglid edaspidi):**
  (1) Imporditud leping ↔ pind AINULT `x.pindIds` kaudu — üürniku nime (`s.tenant`) järgi seost EI tehta (pakkumine kirjutab
  `s.tenant`-i); seemne imporditud lepingutel on `pindIds`. (2) ÜKS tänase üüri allikas pinna kaupa `pindKuusNyyd(s)` (allkirjastatud
  leping × `p6Tegur` › kehtiv imporditud `p8ImpKuus` m² järgi) — Esemed/objekti kaart (`objStats`), pinna päis ja Ülevaade annavad sama
  summa; portfelli lepingute jalus = „Üür kuus” (kinnisvara) + eraldi „teenused ja muud lepingud” (`pfKuusJaotus`). Kalendri
  indekseerimine `kdIndexCalc` = päev enne → sel päeval samadest funktsioonidest (`p6KuusProg` / `p8ImpKuus`), kõvakodeeritud % pole.
  (3) KEHTIV tehing = põhileping + jõustunud Lisa N `faktid` (`lepKehtivTehing`; hind, hind@pind, tagatis, parkimine) — võtmeandmete
  leht, `lepHind`, `lepParkKohad`, tagatis loevad seda, märge „muudetud Lisa N” (`lepMuutLisa`); dokument ise ei muutu.
  (4) Voorud: ootaja muutjad on KOODIS kinni (`lepSwapL(l)`: `canShape`, `thTools`, `bindThreadActions`) — mitte ainult CSS. Üürnik ei
  saa saata, kui ettepanek/küsimus on otsustamata (juhtriba + `lepVoorSaada`); operaatori kord ilma vastatavata → „Tagasta üürnikule”.
  Vooru ajal nupud „Lisa vooru / Lisa märkus” (`lepSaadaSilt`), teated/audit `lepVoorTx`; ootamise ribad näitavad viimati saadetud kirja
  numbrit (`lepViimaneVoor`). Vaikuse meeldetuletus (`p6MeenutaJuht`) ka ootamise ribal ja pakkumisel mustandina; `p6Doc`/`p6Vaikus`
  loevad elavat lepingut ja `lepAruNahtav`. (5) Seadete vaikeväärtused (`seVaike`) mõjuvad: pakkumise periood ja kehtivus, lepingu
  tagatis ja indekseerimine (thi → THI). (6) MÄLU: `DB.save` salvestab üldtingimuste punkti, mille tekst = mall (`ULD_TX` ULD_FULL-ist),
  viitena `_u` (punktid, v1, versioonid, pub) — `lepKompakt`/`lepTaasta` data.js-is; `lepVoorPub` ei kanna versioone/v1/kirju. NB: kui
  mall (ULD_FULL) muutub, loevad vanad viited uut teksti — versioonitud mall on hiljem. (7) Üürnikule sisemisi silte pole
  (Muudatusrežiim → Muudatusettepanek, „konteiner K…” eemaldatud); P 2.4 tühi = `OTSTARVE_VAIKE` (mitte „null”); aktsepteeritud
  pakkumisel kehtivuse loendurit pole (`o.aktsepteeritud`); „Tähtaeg on käes” ainult tähtaja käes. Pakkumise „Kokkuvõte” ei korda
  üüri/€/m²/m² (võtmeandmete leht) — alles bruto/KM, astmed, kõrvalkulud. 390 px: `.obj-toolbar`, `.rk-tbl-w`, `.g2`/`.ehr-grid`.
  „Vaata üürnikuna” ≥ 1440 px paanist vasakul.
- **ÜKS juhtkaart (v807, audit 12, kasutaja 30.09):** lepingu juhtriba ja pakkumise operaatori seisud (mustand · saadetud · põrge ·
  meeldetuletus · aktsepteeritud) kasutavad sama komponenti `juhtKaart(mode, kes, tx, btn, meta)` / `juhtSaadetud(pea, sub, tx, meta, btn)`
  — alati „kelle kord” märk (`kordMark`), tekst, meta ja ÜKS põhinupp; teised valikud vaikselt (`steplink.g-teine`, `btn-quiet`).
  Üürniku lepingul „Allkirjasta kohe” (btn-green) + tekstinupp „Aktsepteeri, allkirjastan hiljem”; üürniku pakkumise otsusekaardil
  „Teie kord” märk. Uut seisukaarti oma markup'iga EI tehta — kasuta `juhtKaart`.
- AI-sisendi keel on ühtne: avalehe suur komposer + sama keelega kompaktne ülariba-komposer (avalehel peidus, `dash-shell` klass body-l).

## localStorage võtmed

`thinkone_demo_v1` (Taevavärava sisestused) · `thinkone_demo_v1_b11g` (B11G omad) ·
`thinkone_role` (operaator/klient) · `thinkone_company` (aktiivne ettevõte) ·
`thinkone_sbmin` (külgriba kokku/lahti) · `thinkone_notif_read` (loetud teavitused) ·
`thinkone_tips` (nähtud esmakordsed vihjed, v437) · `thinkone_seaded` (lisatud ettevõtted, kutsed, seaded) ·
`thinkone_theme` (tume/hele) · `thinkone_pf_mode` (portfelli vaaterežiim) · `thinkone_pf_sort` (Järjesta) · `thinkone_yl_vord` (ülevaate võrdlus) ·
`thinkone_loetud` (dokumentide lugemise aeg, Lugemata-märk) · `thinkone_demo_v1_uus` (Uus konto, v623).
IndexedDB `thinkone_import` hoiab imporditud originaale (Lähtesta demo kustutab).
„Lähtesta demo" puhastab andmete (iga ettevõtte oma) + rolli + ettevõtte + vihjete + seadete + loetud teavituste võtmed;
teema, külgriba ja portfelli režiim on kasutaja eelistused ja jäävad. Andmevõti hoiab ka `KEY_DATES`-i (v486).

## Lokaalne eelvaade

Topeltklõps `demo/index.html` töötab alati (serverit pole vaja). Brauseriautomaatika ja
ekraanipiltide jaoks: `node serve.js` (port 8471) või `start-demo.cmd` → http://localhost:8471/
(`demo/.claude/launch.json`: `python -m http.server 8765`).

## Märkmed

Ajaloolised nüansid (B11G andmestiku muster, puuduvad failiviited, agendi vastuste
ettevõtteteadlikkus, `View.risk.init` hoiatus) — vt `HANDOFF.md`.
