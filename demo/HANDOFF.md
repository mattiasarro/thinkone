# ThinkOne — sessiooni üleandmine (seisuga 26.09.2026)

> See fail on AI-assistendi (Claude Code) sessioonide vaheline üleandmismärge.
> Tööreeglid elavad `CLAUDE.md`-s (laaditakse automaatselt); siin on sessioonide
> ajalugu ja nüansid. Kui midagi aegub, uuenda või kustuta julgelt.

## 29.09.2026 (v=727 →) — ÜHENDAMINE kolleegi versiooniga (`demo 4/`, v644 + Kokkulepe; plaan `ThinkOne_uhendusplaan.md`)
- Plaan on kirjutatud KOLLEEGI vaatest: seal „tema” = meie `demo/`, „meie” = `demo 4/`. Alus jääb meie `demo/`; toome demo 4-st
  teemade kaupa, meie kujunduskeeles. Kolleegi skripte meil pole — port käsitsi `demo 4/app.js` (v644) koodist. Ühist alust
  (`demo 3/`, v626) enam pole; lähim on commit 36e94f8 (v626 + meie v627–628).
- Kasutaja otsused 29.09: läbirääkimine JÄÄB MEIE OMA (Kokkulepet ei tooda) · Avaleht = KOLLEEGI oma · dokumendi päis = meie
  päiserida + võtmeandmete leht, kolleegilt ainult „muudetud V2” märge · sõnavara kolleegilt (Pakkumine, Seis, teietamine, V2).
  Mitme pinnaga leping ja Ülevaade jäävad meie omaks (Ülevaatesse ainult kolleegi v644 päris ajalugu).
- Etapp 1 · arhiiv (v727): `arhiivLoend` kolleegi v627 kujul — seisukiibid (`AR_SEISUD`, `PF_ARH_SEIS`, `pfArhSeis`), aasta
  grupid, rida kuupäev · kes ja mis · miks · järglane / „Pind N on vaba” (`arhVaba`, meil `lepPindIds`); osapoole/pinna lehel
  `{ seisud: false }`; endine osapool: samm „Arhiivis” (kord `arh`) + „arhiivis alates”. CSS „AR-CSS v627” kiibid meie keeles.
  v728 (kasutaja): järglase veerg välja — rida = kuupäev · kes ja mis · miks arhiivis (`arhVaba` eemaldatud).
- Etapp 2 · AI leht (v729–730): kolleegi „AI v633” moodul (lõppseis v644) asendas meie vana agendi (`agentCtx` … enne „Objekt”):
  `#/ai` (ja `#/agent`) — vasakul vestluste ajalugu (`thinkone_ai_lood_<ettevõte>`, 3 seemnevestlust), päis „Vaatad: …” + Tagasi,
  vastus = lause + punktiviited + kaart, täpsustus nuppudena, muutev samm = kinnituskaart (Kinnita · Muuda · Loobu).
  „Küsi selle … kohta” (`aiKysiNupp`) lepingu/pakkumise/imporditud lepingu riba 1. rea lõpus ja osapoole lehel (`.dok-ylarida`).
  Abifunktsioonid ajutiselt kaasas (ÜHENDAMINE-plokk: `kpD`, `paevadeVahe`, `P6_THI`, `p6PctM`, `p6Meetod`, `seVaike`) — päris
  kuju tuleb oma etapis. `ylAndmed` tagastab ka `Rk`. AI tunnus = meie prisma (joon all + helk), mitte kolleegi vikerkaarerõngas;
  „Küsi …” = kiip; hoveril ei hüppa. AI lehel omnibox peidus (`dash-shell` ka `#/ai`-l).
- Etapp 3 · Avaleht + portaal + menüü (v731–732): meie „Fookus” (AGENT_PRESETS … View.dashboard.init) → kolleegi „AVALEHT v634”
  (tervitus · AI-sisend `ai-komp` → `aiAva` · „Vajab tegevust”: kokkuvõtlause, filter Kõik/Kiire/Sinu kord/Korras, triaažiriba,
  „Järgmisena” fookuskaart, read rühmade kaupa, „N vestlus ootab”, „Tähtajad kalendris”). `AGENT_TAIT`/`LEP_AVA_PUNKT` jäid.
  Pakkumise/lepingu read tulevad AJUTISELT meie `buildActs`-ist (`p7AvRead` vahelüli; tegusõna ≤ 12 märki, muidu 1. sõna);
  `p6AvRead` tühi (etapp 7). Portaal = kolleegi „PORTAAL v634” (hero Ootab teid / Ootame üürileandja vastust / Kõik on korras,
  dokumendid kaartidena, vestlus, tähtajad, kontakt); `p7Samm` vahelüli annab üürniku sammu (ka operaatori eelvaates `#/portaal`).
  Kasutajamenüü (`renderUserMenu`): „Kliendiportaal · vaata, mida klient näeb” / kliendina „Tagasi operaatoriks”.
  CSS „AV-CSS v634” meie keeles: sinine taustahelk välja, `av-seg` = meie segmentlüliti, hoveril ei hüppa, vestluse viide neutraalne.
  Vana Avalehe CSS (dash-*, fookus) on surnud kood — koristada lõpus.
  v733 (kasutaja: kontseptsioon ja paigutus jäävad, roosakas toon välja, rõhk jääb): `.av-f` = neutraalne `--surface-soft` + serv,
  rõhk = juhtkaardi prisma-joon all + helk; ikoon neutraalne, toon ainult täpil; `.av-j` = meie kaart (r-lg).
  v734 (kasutaja: „topelt rgb” — prisma on juba AI-sisendil): fookuskaardil prismat EI OLE; rõhk = tõstetud pind, `--line-strong`
  serv, `--shadow`, pulseeriv toonitäpp. Reegel: ühel vaatel üks prisma.
- Etapp 4 · kalender + Suhtlus + Seaded (v735–738):
  KALENDER (kasutaja: meie ajajoon + kolleegi lisad, ajajoon puhtamaks): liik = sakk arvuga (`pf-tabs kal-tabs`), paremal objekt
  (kui > 1) · „Kõik · Vajab otsust · Rakendub ise” (`KAL_KIS`, meie `pf-views`) · Loend/Kuu ikoonlüliti; filter katab ajajoone,
  30 päeva kaardi ja kuuvaate kiibid (`KAL_KT/KO/KIS`). Ajajoon ühes kaardis (`.card.kal-aeg`), tüübiikoonid ja kuuruudud välja,
  kuu pealkiri ei kleepu (selgroog jookseb läbi), nool hoveril, id vaiksem. Päevad `paevadeVahe`/`kpD` (05.10 = 6 p, mitte 7).
  SUHTLUS = kolleegi „SUHTLUS v637” (päise lause, otsing, Ootab vastust/Kõik, avatarid, päevaeraldajad, mullid, koostaja + AI
  mustand). `suhtlusThreads`: üürileandja näeb `lepAruNahtav` (vooru saatmata märkused EI leki), ootel = `aruOotabOp` või
  kliendi viimane vaba sõnum. Lõime kohal järgmine samm `p8SuhSamm` — AJUTISELT `buildActs`-ist (etapp 5 → p7Samm).
  SEADED = kolleegi „SEADED v637/v644” (#/seaded/ettevote|dokumendid|automaatika): ettevõtted + aktsentvärv, kasutajad + kutse,
  eksport eelvaatega (`p8Eksport`, `p8Eelvaade`), mallid + kirjade eelvaated (`seKiriNaidis0` — etapis 6 p8KiriNaidis),
  `p8MallAva`, üldtingimuste versioonid, pakkumise vaikeväärtused (`seVaike`, `SEADED.vaike`), integratsioonid, teavitused.
  `p7Silt` = identsus (sõnavara etapis 5). CSS „LK-CSS v637” meie keeles: saatmisnupp 32 px hele ring, automaatika teade ja
  „Aktiivne” kiip neutraalsed (sinist pole).
- Etapp 5 · sõnavara, kuupäevad, üks järgmise sammu otsus (v739–742):
  SÕNAVARA: „pakkumus” → „pakkumine” (kõik käänded, ka „hinnapakkumine”) nähtavas tekstis app.js/data.js/index.html; EI muudetud:
  marsruudid (`#/pakkumus/…`, `#/portfell/pakkumused`), omaduste võtmed (`pakkumus:`), täpsed väiketähelised võtmesõned
  (`"pakkumus"`, `"pakkumused"`), regex-alternatiivid, identifikaatorid. Andmeväärtused muutusid järjekindlalt („Pakkumisel”,
  „Pakkumise kehtivus”); salvestatud seis migreerub (`p7Migreeri`, märk `thinkone_andmever_<ettevõte>` = 643). „Olek” → „Seis”
  siltides. Kuvanimed `p7Silt` (pill, olekurajad, võtmeandmete leht): „Mustand V1” → „Mustand”, üürnikul „Teie ettepanek”, „Teile
  saadetud”, „Leping koostatud”; `kordMark` üürnikule „Teie kord”; versioon `verSilt` → „V2”.
  KUUPÄEVAD: `kpD` (ISO ja pp.kk.aaaa → kohalik kesköö), `paevadeVahe` (ümardatult), `parseEE`/`daysUntil` nende kaudu; vanad
  `Math.ceil((new Date(iso) - DEMO_TODAY)…)` asendatud.
  ÜKS OTSUS `p7Samm(kind, doc)` (kolleegi v643, MEIE mudelil): pakkumine (Saada · Vasta · Koosta leping · Meenuta ≤ 7 p · Klient
  vaatab üle) ja leping (Saada mustand · Vasta üürnikule N punkti → Saada vastused N [meie voorud] · Allkirjasta · akt/arveldus ·
  muudatusettepanek · Lisa N · Korras + järgmine tähtaeg); üürniku harud (`p7Klient()` = üürnik või portaali eelvaade). Loevad:
  Portfelli rida (`pfSamm`), Avaleht (`p7AvRead`), portaal (`poSamm`), Suhtlus (`p8SuhSamm`). Vahelülid buildActs-ist on läinud.
  Kirja põrge (etapp 6) ja vaikus/allkirjastajad/pikendus (etapp 7, `p6AvRead`) lisanduvad.
- Etapp 6 · kirjad, versioonid, ajalugu (v743–746):
  KIRJAD (kolleegi Plokk 4 · 4.4): `doc.kirjad` [{liik, teema, tekst, saaja, aeg, olek kohal|porkus, avatud, pohjus, nr}];
  `p4Kiri` (põrge: vigane aadress / trükiviga domeenis / sama aadress põrkus varem), mallid `p4PakkumiseKiri` (pakkumine ·
  pakkumine-uus · pakkumine-vastus · meeldetuletus), `p4LepinguKiri`, `p4VastuseKiri` (meie vooru vastus). Saatmine = kiri:
  pakkumise „Kinnita ja saada” ja uuesti saatmine, lepingu `.send-draft`, `lepVoorSaada` (üürileandja vastus). Pakkumise paanis
  MEIE kaardid jäid (kolleegi pakkumise juhtkaarti ei toodud): Saadetud-kaart näitab kirja olekut; põrge → „Kiri ei jõudnud
  kohale” + `p4PorgeVorm` (paranda aadress · Saada uuesti, `p4Uuesti`); ≤ 7 p või vaikus ≥ 5 p → „Tuleta meelde” + `p4Meenuta`.
  Lepingu juhtriba meta = kirja olek, põrge = sinu kord + vorm. `p4Avas` = üürnik avas lingi. `p7Samm`: põrge = minu (punane,
  Avalehel Kiire). Käivitusel `p4Taida` (järeltäide + demo põrge PAK-2026-011 andres@mrsafe.example). Ootaja hetktõmmis kannab
  `kirjad` ja `versioonid` kaasa; `p4Uuesti` kirjutab `lepLive`-i.
  VERSIOONID (4.3): `l.versioonid` = V1 esimesel saatmisel, iga üürileandja vooru vastus = V(n) (`p4Snap`, `voorud[].ver`,
  `l.versioon` = „Mustand Vn”, kirja nr = versiooni nr); `p4VerTaida` annab vanadele V1 (`l.v1`-st). Riba: „Versioonid · N →”
  (`p4VerAva`: V1 · V2 · „Kokku V1 → praegu” = lepDiffHTML; kiri; faktid + punktid sõnatasemel) ja operaatoril „Ajalugu”
  (`p4Ajalugu`, külgpaneel: kirjad + audit). Punktide paani all versioonide loend. Võtmeandmete lehel „muudetud V2” (`p4-muud`).
  „+ Uus” = Pakkumine · Leping · Import (objekt Esemete sakis, muudatus lepingus).
  EI TOODUD (otsus 5 / meie kujundus): kokkuvõtte kaart, pakkumise juhtkaart.
- Deal room (v747, kasutaja: „säilita võtmeandmed + dokument ja ainult otsusepaan”): üürnikul (`client-shell`) külgriba,
  omnibox ja „+ Uus” peidus; päis = `p4DrBrand` (üürileandja logo + nimi → #/portaal) + `p4DrShell` (Minu dokumendid · kasutaja ·
  demos „Tagasi operaatoriks”, hõljuv rollinupp üürnikul peidus). Üürniku pakkumise paanis ainult otsus (lisade kaart välja —
  lisad on riba pillidel).
  v748–752 (kasutaja): päise vasakus ülanurgas AINULT ThinkOne logo (kloon külgriba `svg.logo`-st, `.dr-to`; kast tindiga,
  märk `--on-ink`, sõnamärgi `path` + `polygon` (I-täht) currentColor), klõps → #/portaal. Üürileandja logo ja nime päises EI OLE.
- Etapp 7a · allkirjastamine (v753, kolleegi Plokk 6 · 6.1–6.2):
  ANDMED: `ACCOUNT.landlord.allkirjastajad` [Tarmo Sepp] + `esindus: "üksi"`; `c-baltic` (Maatrans) Tarmo Kask + Merike Laan,
  `esindus: "ühine"` (e-äriregistri juhatus; e-postid `*.example`). Teised kliendid: allkirjastaja = lepingu kontakt.
  MUDEL: `p6Pool(l, "yl"|"yn")` → isikud (ühine → kõik juhatuse liikmed, muidu kontakt), `doc.allk` [{k, isikId, isik, meetod, aeg}]
  (doc = leping või Lisa N ring), `doc.allkKutsed` {isikId: aeg}. `p6SlotSync` hoiab vana `doc.allkirjad` [yl, yn] (pesa täitub, kui
  pool on valmis) — `lepSig`, `ootabMinuAllkirja`, avaleht jne loevad seda edasi. `p6Allkirjasta` → kõik koos → `p6LepJousta`
  (Kehtiv, pinnad Üüritud) / `p6RingJousta` (meie `ringJousta` + kuud-fakt nihutab `l.lopp`; `ringJousta` ei kirjuta `r.allk`-ga
  ringil allkirju üle).
  UI: Dokobiti aken `p6Dkb` (Smart-ID · Mobiil-ID telefoniga · ID-kaart → kontrollkood → valmis); vana `openSign`/`doSign` popup
  eemaldatud (`openSign()` = `p6Allkiri(CURRENT_LEASE)`; kiirtee `#/leping/ID/allkiri` avab akna, kui minu poolel on allkirjastaja).
  Juhtriba `allkBar(ring)` (leping ja Lisa N; ühine: „Tarmo Kask allkirjastas — allkirjastab ka Merike Laan”, nupp nimega).
  Paan: `allkirjadCard(l, ring)` isiku kaupa meie `sg-card` kujul (ühise esindusõiguse vahepealkiri, n/N); kehtival
  `lepAllkKaart` (allkirjad voldikus + konteinerite read `p6KontRida`: leping + iga jõustunud Lisa N, ikoonnupp → `.asice`).
  A4-märk `a4SigBadge` isiku kaupa ja valitud Lisa N järgi. Dokumendi allkirjaplokk `p6ShSigns` (iga allkirjastaja nimeliselt).
  KONTEINER: `p6Laadi` → STORE-ZIP (mimetype esimesena, UTF-8 nimed) + PDF-id (`p6Pdf`, põhileping + lisad + Lisa 3) +
  `META-INF/manifest.xml` — kontrollitud Pythoni zipfile-ga. Allkirjakutsed `p6Kutsu` (aktsepteerimine, Lisa N kinnitus).
- Etapp 7b · pikendus, indekseerimine, vaikus, seeme (v754, kolleegi 6.3–6.6):
  PIKENDUS: `p6PikOotel` (tähtajaline, ≤ 90 p lõpuni, ringi pole, `pikendusLoobutud` pole) → `p6PikValmista(l, auto)` = Lisa N
  {pikendus: true, faktid: [kuud vana → uus]} (pikkus = algne täisaastates 12–60 k). Juhtkaart `p6PikJuht` (Saada üürnikule ·
  Vaata lisa · Ära pikenda = `p6PikLoobu`), toimingutes „Pikenda lepingut” (`p6PikRida`), pikenduse ringil muudatusrežiimi/tühistust
  pole. Üürnik saatmata mustandit ei näe (`p6RingVaade`); saatmine = kiri `p6RingKiri`. Dokument/pill „Lisa N · Lepingu pikendus”.
  INDEKSEERIMINE: meetod `p6LepMeetod` (Lisa 3 eritingimus „indekseer…” › `l.indeks`), aastapäevad `p6IndeksKp`, möödunud
  rakenduvad ise `p6IndeksRakenda` → `l.indeks.ajalugu` + teade üürnikule (`p6IndeksTeade`, lisa ei teki). Kuuüür kuupäeval =
  `lepKuus(l) × p6Tegur(l, d)` (meie pinnapõhised hinnad jäävad); võtmeandmete lehel „üür kuus · indekseeritud pp.kk.aaaa”.
  TÄHTAJAD: `p6Sync` (router + käivitus) → `p6KdSync` kirjutab KEY_DATES-i (`p6: true`) indekseerimise ja lepingu lõpu.
  VAIKUS: `p6Vaikus(kind, doc, ring)` (l = saadetud leping, ring = Lisa N kinnitamisel, allk = allkiri venib; ≥ Seaded ·
  vaikus p) → juhtkaart `p6MeenutaJuht` (mustand + Muuda, Saada meeldetuletus · Mitte praegu = 3 p). Pakkumisel jääb meie
  „Tuleta meelde” (etapp 6). `p7SammLeping`: vaikus, isikupõhised allkirjad, pikendus, „ei pikendata” → Avaleht/portfell.
  Avaleht `p6AvRead`: rakendunud indekseerimine (Korras — rakendub ise).
  SEEME `p6Seed` (käivitusel, ka salvestatud seisule; ainult taeva, p8 Vaba): Maatrans LEP-<aasta−2>-001, Pind 8, algus kuu 1. kaks
  aastat tagasi (lõpp 90 p aknas), 3 allkirja, 2 rakendunud indekseerimist → automaatika teeb pikenduse mustandi (Lisa 3).
  `p6Automaatika` käivitusel. Testitud: ühine allkirjastamine (3 allkirja), Lisa N, pikendus lõpuni, meeldetuletus, `.asice`.
- Etapp 8a · v644 lisad ilma impordita (v755). Otsused: „Vaata üürnikuna” jääb hõljuvaks; „Mis erineb tavalisest” võtmeandmete
  lehe alla; kolleegi seemneid (PAK-2026-003 + Pind 24, Killa PAK-2026-012) ei tooda.
  AUDITI PDF: `#/audit` „Ekspordi (PDF)” → `p8Eelvaade` (veerud + 2 rida) → `p6Pdf`. TÕENDITE KAUST: `p8Kaust(lid)` = ZIP
  (LOEMIND.txt · 01_leping PDF · 02_versioonid/Vn.pdf · 03_kirjad.pdf · 04_allkirjad.pdf · 05_ajalugu.csv · 06_konteinerid/*.asice);
  operaatori riba pill „Tõendite kaust ↓” (pärast esimest saatmist, Ajalugu kõrval). AI SÕNASTUS: `p8Sonastus(tx)` — palve-sõnad
  maha, tingiv → kindel (`p8Kindel`), isik 3. isikusse (`p8Isik3`); „Kas saaks meil olla õigus …” → „Üürnikul on õigus …”; küsimus
  → null (sõnastust ei leiutata). `aiUmber` (Kirjuta üle) ja `aiSonasta` (Lisa 3/N) kasutavad seda, vana lause jääb tagavaraks.
  ERINEVUSED: `p8Erinevused(l)` (tagatis/tähtaeg vs `seVaike`, Lisa 3 indekseerimine, otstarve, erisused, muudetud sõnastus,
  eritingimused) → `p8ErinKaart` (`.voti-erin`, ainult üürnik, Saadetud/Allkirjastamisel/Kehtiv), rea klõps valib punkti.
  SOBIB: üürniku lõimes (üürileandja vastas, punkt lahti) „Sobib” → Lahendatud · selgitatud; voorus läheb märkusena teele.
  TÄNANE ÜÜR: `lepKuusNyyd` (portfell `kuus` + €/m², osapool `kliendiKuuyyr`, Avaleht `raha`, `leaseMetaBar`). Risk osapoolte
  loendis tunnuse tekstina („risk madal”), mitte seisu märgina. EI TOODUD: osapoole tähtajad kuukaartidena (meil ajajoon),
  arhiivi järglane (kasutaja võttis välja), kalendri filter ja mallide eelvaated olid juba etapis 4–5.
- Etapp 8b · impordi augud + Ülevaate päris ajalugu (v756). Meie impordi funktsioonid olid kolleegi omadega peaaegu identsed —
  lisatud samadesse kohtadesse; `impKahtlused`/`irKaart`/`irMuu` → `…0` + kolleegi ümbrised.
  11a ÄRIREGISTER: `p8ArParing` (e-äriregistri autocomplete, võrguta `AL_REG_VARU`) → ülevaatuse „Mis see on?” eraldi rida
  (`p8ArRida`; olek, „lepingus teise nimega”, ↗ link); uus osapool saab registri nime/aadressi (`p8ArKlient` `impKlient`-is).
  11b PINNA SOOVITUS: pinna kahtlusel `p8PinnaSoov` → kaart „Kas see on Pind N?” (Jah · Vali muu pind) — AINULT ühese vaste korral
  (sama m² ±0,15 või registris sama üürnik); T6B-s on palju sama suurusega pindu, siis kaarti pole (tavaline kahtlus jääb).
  11c TEENUS: `IMP_MUU` + Kindlustusleping/Hooldusleping; `impTuvasta` → `f.muu.teenus` (`p8TeenusParsi`: kindlustaja, reg, periood,
  makse); ülevaatus `p8IrTeenus`; kinnitus `p8TeenusKinnita` → IMPORDITUD `KIN-/HOO-aaaa-NN` (Periood, Preemia/Tasu) + lõpp kalendrisse.
  11d KÄSITSI: loetamatu skaneering / tundmatu dokument → „Sisesta käsitsi” (`p8KasitsiHTML`, üks veerg paanis) → `p8Kasitsi` teeb
  failist lepingu (`f.kasitsi`), ülevaatusel märk `p8KasitsiMark`, kinnitusel parameeter „Allikas”.
  11e INDEKS: `p8IndeksTxt(f)` (ÜT 5.2 „suureneb Üüripinna Üür … 3%”, THI, „ei indekseerita”, eritingimus) → parameeter
  „Indekseerimine” enne punktide kustutamist; tervise tähtaeg ainult indekseeritaval (`p8PoleIndeksit`).
  11f TULEMUS: „N lepingut imporditud · € kuus · registris kokku M kehtivat” (`p8KehtivaidRegistris`); tervis ka ilma uue impordita.
  11g LISA: `impMojuRead({ m2: p8LisaM2(f) })` → hinnamuutus „Üür: 1 459,20 € kuus · 8,00 €/m²”.
  12 AJALUGU: `p8HindAjalukku` (impRakendaLisa enne üle kirjutamist) → `x.hinnad`; `p8ImpKuus(x, d)` = hind kuupäeval (viimane
  lisa-hind ≤ d, siis × (1 + %) iga päris indekseerimise kuupäeva eest pärast seda; `p8ImpIndeks`: „esimene pp.kk.aaaa” või
  üleandmine + 12 k, kuni lõpuni). Portfelli imporditud rida `kuus` = tänane (`kuusLeping` = lepingu oma), €/m² sama teguriga;
  võtmeandmete „Üür” kaart = `p8ImpHero` („lepingus X € · N× meetod”); Ülevaade `rentAt` (platvorm `p6KuusProg`, import
  `p8ImpKuus`, muu vana valem `rentAt0`). `p8ImpMigr` (stardis): vanad impordid saavad „Indekseerimine” klauslikihist
  (`x.klauslid` PT/ÜT/L*) ja `x.hinnad` `x.muutused` „Üür” kirjetest.
  TESTITUD (päris failid ainult kohapeal, profiil ja ekraanipildid kustutatud): Evecon P7 + Lisa 3, TSG P8 + Lisa 3, Warrior P9 +
  Lisa 3, WiSo P3 + Lisa 4/5 — indeks tuvastatud kõigil (ÜT 5.2, 3 %), äriregister päris päringuga, WiSo Lisa 5 hinnaajalugu,
  Evecon täna 2 623 € (1× 3 %). Kindlustus ja käsitsi vorm sünteetiliste kirjetega.
  v757 (kasutaja): imporditud lepingu võtmeandmete allikas „Üür/Üürihind → PT 2.4” oli vale — `impAllikas` otsis tekstist ja
  PT 2.4 lõpus oli järgmise jao pealkiri „3. ÜÜR”. Nüüd enne punkti PEALKIRI, siis tekst ilma lõpu jaopealkirjata → PT 3.1.
- Surnud CSS koristus (v758, kasutaja): styles.css 6086 → 5377 rida (511 → 452 kB). Meetod: klass on surnud, kui tema nime pole ÜHESKI
  laetavas failis (app.js, index.html, data.js, klauslid.js, uldtingimused.js, riskiandmed.js) ega kokkupandavana (`eesliide-${`/`" +`);
  reeglist eemaldati ainult surnud selektorid (elus selektoriga reegel jäi), tühjaks jäänud @media plokid, kasutuseta @keyframes
  (shimmer, th-pulse) ja orvuks jäänud jaotise kommentaarid. `ai-fab` jäeti meelega (mälu: ülariba AI-nupu taastamine).
  Kontroll: enne/pärast ekraanipildid 36 vaatest (avaleht, ülevaade, portfell ×3, leping ×2, pakkumine, kalender, Suhtlus, Seaded,
  osapool, import + laud + ülevaatus, pind, parkimine, AI, audit, objektid, üürnik + portaal, hele teema, mobiil 390 px, diff-,
  versiooni- ja ajaloo modaal, Dokobiti aken, eksport) — pikslitäpselt samad (v.a kellaaeg).

## 29.09.2026 (v=707–710) — läbirääkimise voorud, etapp 1 (kasutaja: üks voor = üks kiri)
- Mudel: `l.voor` (kord), `l.pub` (JSON-tõmmis ilma pub/voor/voorud-ita, tehakse vooru alguses), `l.voorud` [{nr, kes, saadetud,
  pids, refid, v1?}]. Esimene saatmine: voorud=[{nr:0, v1:true}], voor 1 = klient. Vanad Saadetud-lepingud: `lepVoorEnsure`.
- Vaade: ruuter taastab eelmise vahetuse, siis mitte-omanikul `lepPubPane` (tõmmisele kopeeritakse voor/voorud, v709).
  DB.save ümbris paneb salvestuse ajaks elava objekti tagasi. `DB.leaseById` tagastab vahetuse ajal TÕMMISE — muutmiskoodis
  kasuta `lepLive(l)`.
- Punkti `mutate` toast vooru ajal: „… lisatud · saadad voorus korraga”. Avalehel `id:voor` tegevus.
- E2E (headless): mustand → saada → üürnik 2 kommentaari (op ei näe, pfSamm/teavitused 0) → üürnik saadab → op näeb kirja
  (P 3.1, P 5.1) + audit → op vastab + saadab → üürnik näeb vastuseid, „Aktsepteeri leping”; konsoolivigu 0.
- v711–712 (kasutaja: paan ütles „ootab üürileandja vastust”, kuigi voor saatmata): `lepSaatmata` → npItems rühm `draft`
  („N saatmata”, pill „Saatmata”), olekurida mõlemale poolele, üürniku lõimes „Ootab üürileandja vastust” asemel täiendamise väli.
- v713 (kasutaja kavand: ruumi kokku, selge hierarhia): saatmata olek → märge sõnumi all (kell-ikoon, `.th-saatmata`), `np-st`
  saatmatal punktil ei renderdu; `.np-v2 .th-day` = kuupäev + juuspeen joon; „Lisa” aktiivne alles tekstiga.
- v714 (kasutaja: sama loogika saadetud märkustel ja üürileandja vaates): `npDetail` teeb `st`-st `noot` (wait/ok/no) →
  `nootHTML()` lõime sabana või `th-noot-top` voldiku kohal; `st = null` alati; üürniku ootamise mull eemaldatud.
- v715 (kasutaja): kirja punktiviide (`.voor-ref`) → `lepVoorRef` = `ltreeGo(pid, true)` — valib punkti paanis ja kerib
  dokumendi kohale (töövaade `data-clause`, A4 `data-aref`).
- v716 (kasutaja: „ootab üürniku kinnitust” saatmata ettepanekul vale): ettepaneku kaart lõimes = üks kast `.th-ep`
  (silt „Ettepanek · kuidas vormistatakse” + enne → pärast + plaanilink), joondatud sõnumi tekstiga; `th-live` eemaldatud —
  olek tuleb lõime lõpu märkest (saatmata → „Läheb üürnikule…”, saadetud → „Ootab üürniku kinnitust”).
- v717–718 (kasutaja: kokkulepitud lepingu saab kohe allkirjastada): üürniku juhtribal „Allkirjasta kohe” (`#cl-accept-sign`
  = aktsepteeri → Allkirjastamisel + `openSign()`) ja teisene „Aktsepteeri, allkirjastan hiljem” / „Aktsepteerin kõik punktid”
  (`#cl-accept-all`); nupud `.g-nupud` täislaiuses; vooru ootamisel peidetud.
- v725–726 (kasutaja: pakkumus ja leping samas joones nagu imporditud leping + võtmeandmed päises): `lepRibaHTML` ja pakkumuse
  riba → impordi riba (← Portfell · nr · rada / `.ir-dok` pillid); `votiSeisHTML` + `lepVotiHTML`/`offerVotiHTML` dokumendi veeru
  algusesse. Kontrollitud: kehtiv leping, mustand, pakkumuse mustand, üürniku pakkumus ja leping, 390 px (ülevoolu pole).
- v724 (kasutaja: „eritingimus ja see joon näeb tobe välja”): punktide loendis lahendatud eritingimust eraldi (joonega
  `np-kid`) rida EI OLE — algse punkti detailis kast `.np-eri` („Kehtib eritingimus · Lisa 3 · p1 · ülimuslik” + sõnastus, klõps
  avab eritingimuse), algne sõnastus „Algne sõnastus · asendatud” (tuhm); tegevust vajav eritingimus = tavaline rida „… · asendab …”;
  eritingimuse detailis link „Asendab Üld · p 4.3 →”. Must `.overwrite` kiip paanis enam ei renderdu.
- v723 (kasutaja: „läbirääkimine liiga segane”, valik „Ainult otsusekaart välja”): `const soov = null` → paanis alati
  „Kuidas lahendame?”; voorud jäävad. Test: valikud nähtavad, „Muudan: üür” vorm ja „Selgitan” → Lahendatud · selgitatud.
- v719–722 (kasutaja: üürnik kinnitas ettepanekud, aga juhtriba näitas ikka „Saada märkused”): üürnikul, kel pole ühtki
  lahtist arutelu (`koikKokku`), saatmisriba EI tule — kohe „Allkirjasta kohe”; `lepSaatmata` on sel juhul tühi; aktsepteerimine
  kirjutab kinnitused viimaseks kirjaks (`voorud[].kinnitus`), `l.voor = null`, `l.pub` kustub. Ettepaneku lahendusel märge ilma
  isikuta (kinnitas üürnik).

## 29.09.2026 (v=705–706) — esindajad loetavaks (kasutaja: tekstid ei murduks veidralt)
- `esTabelHTML` tabelist kaherealisteks kirjeteks `.es-list > .es-r`: roll | nimi (paks) / telefon · e-post (`.es-k`, üksused
  nowrap, murdumine ainult üksuste vahel); väljad: nimi täislaiuses, telefon + e-post all; mobiilis kõik üksteise all.
- v699–704 `.es-tbl` CSS asendatud v705 plokiga (styles.css lõpus). E2E: mustand, üürnik A4, allkirjastatud, 390 px ✓; vigu 0.

## 29.09.2026 (v=699–704) — poolte esindajad tabelina + väljad (kasutaja: nagu originaalis, üürnik täidab ise)
- data.js: `ACCOUNT.landlord.kontaktisik` (Taevavärav). app.js: `esVaikimisi`, `lepEsindajad`, `esTekst`, `esTabelHTML`, `esMuudab`,
  `esSalvesta` (+ l.kontakt sünk); dokumendi tasemel `change`/`click` delegaadid (`.es-in`, `data-es-lisa/del`) — töötab ka pärast
  A4 lehekülgedeks jagamist. `pohiTehing` P 6.x tekst tabelist; kõik 5 kutsujat annavad `es: l.esindajad`.
- Vaikimisi rollid tekstina (`ES_VAIKEROLLID`), lisatud real muudetav roll; fikseeritud veerud; mobiilis rida virna.
- `paginateA4`: plokk üksi lehest kõrgem → `height:auto; minHeight:H` (varem lõigati overflow:hidden-iga).
- E2E: mustand (2 tabelit, 6 rida, operaator muudab, 6.1 EI märgi „Muudetud”), üürnik Saadetud (ainult yy muudetav, lisa rida),
  allkirjastatud (0 muudetavat, 2 loetavat), 390 px ✓; konsoolivigu 0.

## 29.09.2026 (v=698) — ülevaade: eelmine ülesehitus tagasi, ainult värvid neutraalseks (kasutaja: „juhtkaart ära, proovi veel”)
- `git checkout HEAD -- demo/app.js demo/styles.css` (v694 seis; pärast commit'i muutus ainult ülevaade), seejärel styles.css lõppu
  v698 plokk: `--yl-*` neutraalseks, ala gradient 12 %, etapiraja viimane = ink + `--on-ink` tekst, mobiilis etapid 2 veerus.
- v695–697 (op-pea päis, arvud-sakid, „Vajab tähelepanu”, sec-h väljas, `objVabad`) EI OLE koodis — kirjeldus allpool on ajalugu.
- E2E: tume/hele, sakid, 390 px (380), juhtkaarti pole; konsoolivigu 0.

## 29.09.2026 (v=695–697) — ülevaade rakenduse keeles (kasutaja: A + B + C)
- Arvutused (`ylAndmed`, prognoos, lõppevad, vabad) muutmata; kest: `pea(arvud)` op-pea, `arv()` sakid (aktiivne = joon all),
  `juht` juhtkaart, kastid (`yl-kastid`/`yl-k`) ja minigraafikud eemaldatud; jaotiste `<header class="yl-p-pea">` tõstetakse
  väljundis kaardist välja `sec-h yl-sec`-ks (regex `View.ylevaade` lõpus). `objVabad` + `OBJ_SPF` (objekti init klõpsab filtrit).
- Värvid: `--yl-*` üle kirjutatud (:root ja [data-theme=light]); etapirada ilma clip-path'ita, mobiilis 2 veergu (ülevool 502 → 380).
- E2E: Taevavärav (4 arvu, juhtkaart → objekt „Vabad” 28 kaarti), sakid, hele teema, 390 px, B11G (skoobi valik) ✓; vigu 0.

## 29.09.2026 (v=694) — imporditud lepingu riba impordi ülevaatuse keeles (kasutaja: pillid + „← Portfell”)
- Dokumendid tekstilinkide asemel `.ir-dok` pillid (Struktureeritud = `.on`, originaalid/lisad nupud; Word = allalaadimise link);
  tagasi = `.ir-tagasi` (ikoon + „Portfell”) nagu ülevaatuse „← Import”. Font `--font-ui` (riba on muidu mono).
  E2E: Maru (5 pilli), Caverion (Word-link), hele teema, 390 px ✓.

## 29.09.2026 (v=693) — imporditud lepingul „algusesse” pill kerimise edenemisega (kasutaja)
- `View.imporditud` sai sama `#doc-top` nupu (punktiirne riba + % + ↑) mis platvormi lepinguvaade; globaalne kerimiskuulaja
  ja `docTop()` töötavad muutmata. E2E: peidus algul, 40 % kerimisel nähtav „40%”, klõps → scrollY 0.

## 29.09.2026 (v=687–692) — punkti teksti struktuur: kuvamine + import (kasutaja: „proovime nii”)
- Kiht 2 (kuvamine, ka vanad andmed): `klStruktuur` + `klKontakt`/`klTabel`/`klRead`/`klLoend`/`klTapid`/`klRidadest`. Maru PT 6.1/6.2
  → roll · nimi · telefon · e-post ühel real; Caverion Lisa 2 → 5 sagedustabelit jaotiste kaupa (+ märkus), Lisa 3 → nummerdatud
  loend täppidega, Lisa 4 → hinnakiri (Teenus | Hind), Lisa 5 → kontaktplokid (Hooldaja/Tellija).
- Kiht 1 (import): `pdfTekst` rea-/veerueraldajad (Caverion Lisa 4: „Tehniku väljakutse tööpäevadel⇥08.00-17.00⇥60,00 EUR”);
  `impTekstVorm`, `IMP_JAGU_SABA`, 240 → 1500 märki (Nordista/Maru: 54/53 punkti olid varem lõigatud), lisade punktid vormistatud.
- Regressioon: demo-x (v675, vana pdfTekst) vs uus, 15 päris faili (Nordista, Maru, LEVV, CDR, Evecon, Electric Wings: lepingud,
  lisad, üleandmisaktid) → v-väljad, punktide numbrid ja lisade mõjud identsed (0 erinevust). Testprofiil + tulemused kustutatud.

## 29.09.2026 (v=685–686) — imporditud lepingu allkirjad platvormi kaardina (kasutaja: sama kujundus sees/väljas)
- `impAllkirjadCard` + `impAllkSeis` (v685 nimi `impAllkirjastajad` põrkus olemasoleva funktsiooniga → hilisem definitsioon
  kirjutas üle ja kaart jäi tühjaks; ümber nimetatud v686). Kaart Toimingute järel; „Allkirjad” voldik eemaldatud
  „Allkirjastatud originaal” kaardist. Hooldusleping: tellija · töövõtja.
- E2E: Maru (tekstist, 2/2), Caverion (tellija/töövõtja, roll „Caverion, juhatuse liige” alareal), simuleeritud konteiner
  (Smart-ID/Mobiil-ID · kell · kehtiv · ajatempliga); konsoolivigu 0.

## 29.09.2026 (v=681–684) — kehtiv seis silmapaistvaks (kasutaja: A + B + C)
- `impSeisHTML(x, kl, T)` asendab lk 1 tabeli: päis „Kehtiv seis · täna” + ese; `imp-voti` 4 kaarti (`imp-vc`); `impAjariba`;
  teemad; erisused; parandused. `impAllikas`: muutus → „Lisa N ›” (id:dok-LN), muidu PT-st (siis muust mitte-lisa osast) sõna
  `IMP_TYVI[k]` järgi → „PT 3.1 ›” (k:klKey). Init seob `.imp-src[data-goto]`.
- Parandused teel: `.imp-v` klassinime kokkupõrge vaate juurega → `.imp-vc`; „Periood” regex `perio`; „+ km” topelt tagatisel;
  ajariba sildid (grupp 2,5 %, mitte „täna” lähedal, kuju eraldi `<i>`-na); „Hinnad” → Raha; mobiilis numbrid 20 px, sildid peidus.
- E2E: Maru (16 allikaviidet, PT 3.1 klõps kerib), Caverion (tasu · periood · reageerimisaeg · etteteatamine, tähtajatu riba),
  hele teema, 390 px ✓; konsoolivigu 0.

## 29.09.2026 (v=679–680) — imporditud lepingu toimik: kõik dokumendid struktureeritult (kasutaja: terviklik pilt + RAG)
- Enne: klauslikihis ainult põhileping; lisade punktid olid `x.lisad`-is (mitte otsingus), lisa muutus kirjutas parameetri üle
  (ajalugu kadus), kaasdokument (garantiikiri jms) oli ainult failiviide.
- Import: `impRakendaLisa` → `muuda()` salvestab `x.muutused`; `impKlLisa` (osa L<nr>); `impDokLisa` (x.dokumendid + osa D<n>,
  väljavõte 900 märki `f.muu.tekst`); `klOsaLbl`/`klFail` tunnevad L<nr>/Lisa N/D<n>. `impToimikMigr()` stardis (idempotentne).
- Vaade: `impToimik(x)` (põhileping → lisad nr järgi → kaasdokumendid; ok = struktureeritud, null = joonis); lk 1 „Kehtivad
  põhitingimused” + `imp-muut` (muudetud Lisa N-ga · kp · enne) + toimiku rida; iga lisa oma leht (enne → pärast tabel + punktid),
  kaasdokumendi leht väljavõttega. Paanis „Toimik” asendab „Eritingimused” kaardi (klõps kerib lehele / avab joonise).
- E2E: Maru (4 dokumenti, joonised neutraalsed, Lisa 3 → leht), Caverion (HL + Lisa 1–5), simuleeritud import (Lisa 2 hind →
  muutused + päritolu tabelis, garantiikiri → D1, `klOtsi('garantii summa')` leiab D1), 390 px ✓; konsoolivigu 0.

## 29.09.2026 (v=676–678) — imporditud leping lepinguvaate mustris (kasutaja: impordi/parema paani keel teistele lehtedele)
- Vana vaade (hero-summa, faktiplokid, kaardid üksteise all, kokkukeeratud „Kogu leping”) → riba · A4 · paan.
- `impDokHTML`: lk 1 = päis (osapool, liik, id, sõlmitud, imporditud) + põhitingimuste tabel (+ impordil parandatud); edasi leht
  osa kaupa (PT/ÜT/L3 või HL/Lisa N), jagu `sh-usec-h`, punkt `sh-up.imp-p` (data-key = klKey, data-txt otsinguks), muudetud
  punkt rohelise joonega + `chg` kiibid; klausliteta leping → Lisa-punktid või märkus „tekst on originaalis”. `klList` eemaldatud.
- `impPaanHTML`: arhiivi/üürniku vahetuse märge · Toimingud (originaal, registreeri lisa, pinna leht, konteiner) · Tähtajad
  (`imp-td`: täpp — täidetud = vajab otsust, tühi = rakendub ise; kuupäev + kalSuht) · Eritingimused (Lisa punktid ↔ L3 klauslid
  järjekorra järgi, klõps kerib + vilgub) · Allkirjastatud originaal (sõlmitud, imporditud, punkte, allkirjad, esindajad voldikus).
- Riba: ← Portfell · id · ● Kehtiv/Arhiivis · Struktureeritud | Originaal | Lisa N (sulus osa ära) · otsing + vastete arv.
- E2E: Maru (otsing „allüür” 3 vastet, eritingimus → 5.2, IMP_FOCUS ÜT|12.3 kerib), Caverion, hele teema, 390 px ✓; vigu 0.

## 29.09.2026 (v=672–675) — avaleht „Fookus” + ülevaade sakkidena, üle võetud `demo-x/`-st (kasutaja tegi teises seadmes)
- `demo-x/` = täpselt v671 + v672–675 (kontrollitud diffiga: data.js identne, styles.css ainult lõppu lisatud, app.js muudatused
  ainult avalehe/ülevaate plokkides + 3 konksu: AGENT_TAIT pakkumuse vastuses, LEP_AVA_PUNKT lepingus). Üle võetud app.js,
  styles.css, index.html (v=675), tegevused-variandid.html, ylevaade-variandid.html.
- Vana ülevaate abid eemaldatud koos sellega: `taituvusAjalugu`, `pindHoivesKuupaeval`, `yksusKuupaeval`, `nsLayout`/`.nstack`.
- ÜLE VÕTMATA (viitematerjal, jäi `demo-x/`-i): `design-system/` lisad (audit, style-guide, tokens.proposed …) ja `ux-test/`
  47 ekraanipilti (clarity-*, goal1-*).
- E2E: avaleht (Fookus-kaart, agendi mustand, Järgmisena 3), ülevaade (4 sakki, B11G), parkimise haldus ja pinna leht töötavad
  koos; konsoolivigu 0.

## 28.09.2026 (v=670–671) — vana esemeregistri leht eemaldatud (kasutaja: jõudsin vanale lehele, esemed on portfellis)
- `View.register` kustutatud; `#/register` → `location.replace("#/portfell/esemed")` (vanad järjehoidjad).
- Lingid: objekti lehe tagasinupp („Esemed”), töölaua mõõdikud (Vabad pinnad → esemed, Ametikohad → esemed/ametikohad),
  seadistuse kiip, mitme hoonega pinnalink, ametikoha rea tagavaralink; esemete lehelt „Ava esemeregister →” ära.
- Murdteed „Portfell › Esemed › Objekt/Pind”; tekstides „esemeregister” → „esemed” / „pinna andmed”.
- E2E: #/register → #/portfell/esemed, objekti tagasinupp, 0 linki #/register (Taevavärav + B11G). Konsoolivigu 0.

## 28.09.2026 (v=668–669) — parkimise muutmiskohad koondatud (kasutaja: liiga mitmes kohas muudetav)
- Objekti koha kaart: `parkBlokk` eemaldatud → „Halda kohta →” (`parkHaldaKoht`: haldus, kohad-vaade, koht valitud).
- Haldus „Kohad”: „Märgi kasutusest välja” (dokumendis keelatud) / „Taasta kasutusse”.
- Pinna redaktor: `objParkRida` (olemasolev pind + register → rida „nr … · Muuda →” = kohavalija, draft sünkroonitakse);
  `objCommit` võtab registriga hoone olemasolevate pindade kohad elavast andmest (mustandi koopia ei kirjuta üle).
  Uue pinna numbrid: registris + mitte teise pinna küljes (teade nimetab pinnad).
- Lahknevus → „Muuda dokumendis →”; pinna lehe „Lepingus” rida lingiga.
- E2E: kaart 17 → haldus (17 valitud, väljas-nupp keelatud), 90 väljas/taasta, redaktor p4 valijaga 20 ära → salvestus, p1 puutumata,
  uus pind nr 18/30 → „nr 18 — Pind 4, nr 30 — Pind 7”. Konsoolivigu 0.

## 28.09.2026 (v=667) — parandus: „Näita pinna kohti” näitas „registris pole kohti” (kasutaja)
- Põhjus: halduse tagasilink `#/objekt/<id>#parkimine` → marsruut andis id-ks „obj-t6b#parkimine”; vaade langes tagasi OBJEKT-ile,
  aga `parkRegBind` sai vale id → valiku muutus renderdas tühja registri. `View.objekt` lõikab ankru, init loeb id `[^/?#]+`
  ja kerib `#parkimine` korral registrini. E2E: tagasilink → kerib registrini, valik p4/p1 töötab ✓.

## 28.09.2026 (v=664–666) — parkimise haldus pindade kaupa (kasutaja: grupeeringud selgemaks, haldus efektiivsemaks)
- `pkhDraw` ümber: riba „Pindade kaupa | Kohad”, „Lisa kohad” nupu taga (`PKH.lisaLahti`), pinna rippmenüü eemaldatud.
- `pkhPinnadHTML` + `pkhMini` + `pkhPinnaKohad` (täpne asendus, teistelt pindadelt ära) + `parkPinnaMuuda` (valija, oma kohad
  hõivest välja, siht = arv → „Vali lähimad” töötab) + `pkhKogumMuuda` (ev/reserv/valjas).
- Lahknevus: ühe pinnaga leping/pakkumus, mille kohad ≠ pinna kohad → rida; tugev (⚠, ooker), kui kasutab kohta väljaspool.
- E2E: 38 rida (Pind 1–30 numbrijärjekorras, Büroo 1–5, 4 kogumit), p4 eelvaade, p1 „Muuda” → lähimad → salvestus, reserv +50,
  objekti „Näita pinna kohti” p4, pinna lehe „Muuda”/„Lepingus”, lahknevus LEP-2026-001 nr 33, 390 px ✓; konsoolivigu 0.

## 28.09.2026 (v=663) — parkimise olekud (kasutaja: EV eraldi, üldkasutatav → reserv ja valitav, Lepingus+Üüritud kokku)
- `parkHoive`: leping → alati „Üüritud” (+ `allkirjastamata`), reserv → „Reserv” (vaba: true), elektriauto (mitte reservis) →
  „Elektriauto” (vaba: true). `parkPickUI` lubab `h.vaba` kohti; `parkLahimad` ainult `tyyp === "tavaline" && !uld`.
- Register: tüüp „reserv” → lipp (`parkReg` migreerib salvestatud kirjed); T6B: EV 31/32/84/85 eraldi, reserv 49/62/63 + inva 1/2.
- Haldus: „Märgi reserviks / Eemalda reservist”, vahemiku linnuke „Reserv”, tabelis tüüp „reserv” = lipp.
- E2E: T6B statistika 86/14/6/4/5/0, plaanil EV roheline ja reserv sinine, valikus 31 ja 49 lubatud, automaatvalik 75–78,
  allkirjastamata lepingu koht = Üüritud + märge. Konsoolivigu 0.

## 28.09.2026 (v=662) — parandus: pakkumuse viisardi pinnaloend jooksis kaardist välja (kasutaja ekraanipilt)
- Põhjus: v660 parkimiskiipide konteiner kasutas klassi `.pk-list`, mis on juba pinnavalija (`spPicker`) kerimisloend;
  `overflow: visible` tühistas `max-height`-kerimise. Kiibid → `.pk-kiibid`. Uute klasside kokkupõrkeid rohkem pole (kontrollitud).
- NB: `pk-*` eesliide on jagatud pinnavalija (pk-row, pk-chip, pk-filter) ja parkimise (pk-host, pk-leg) vahel — uuel klassil kontrolli.

## 28.09.2026 (v=660–661) — parkimisregister, 1. etapp (kasutaja: kuidas parkimiskohad süsteemi luuakse)
- Mudel: `PARK_REG` (data.js save/load) + `parkReg`/`parkOn`/`parkPlaaniga`/`parkTyypNimi`; `parkHoive` üldkasutatavad registrist;
  `parkLahimad` registrist (plaanita: pinna kohtade tsoon ees, siis nr). Väravad `parkSvg` → `parkOn`: P 2.2 mall, Lisa 2 (mall +
  pakkumuse lisad), `parkFix`, pakkumuse paan, pinnamuudatuse vorm, faktisisend, otsusekaart, objekti leht.
- `parkPlaanHTML` → plaanita hoonel `parkKiibidHTML`; valija/register kasutavad `PARK_KLIKK`. Haldusleht `viewParkHaldus` + `pkhDraw`
  (View registreeritakse View.pind järel — `View` const on alles rida ~1887!).
- E2E: T6B regressioon (115 kohta, sama statistika, plaan, „Vali lähimad” 75–78, Lisa 2) ✓; T6B haldus (tsoon/tüüp salvestub,
  lisamine peidetud) ✓; testhoone: tühi olek → vahemik 1–20 → tabel 21-25 elektriauto + 26–27 pinnale → kohad 1–3 pinnale →
  pakkumus võtab 1,2,3,26,27 → kiibivalik → Lisa 2 kiipidena → dokumendis kohta ei kustutata → püsib pärast laadimist;
  pinna redaktor: nr 99 pole registris → viga. Konsoolivigu 0.

## 28.09.2026 (v=658–659) — pinna andmete muutmine pinna lehelt (kasutaja: kus pärast importi pinna andmeid muuta?)
- Enne: ainult Objekt → Muuda → samm 2; osade jaotust ei saanud muuta; hinnakirja muutus muutis vaikselt avatud pakkumuse hinda
  (pakkumus loeb `sp.hind`, kui `o.hinnad` puudub) ja üüripinna muutus lepingu/pakkumuse summat.
- Nüüd: `pindMuuda(sid)` → ühe pinna redaktor; osad `objOsadHTML`/`objOsadSum` (elav summa) / `objOsadNorm` (→ jaotus, muud osad
  säilivad); lukk `objPindLukk` + `objPindMarge`; `objHindKylmuta` commit'is.
- E2E: p4 (lepingus) lukk + märge, osade vale summa → viga, õige → salvestus + tagasi pinna lehele, hind 8 → lepingu üür sama
  (2 548,50); p6 (pakkumus) hind 9,50 → pakkumus jääb 2 664 € (`hinnad.p6 = 7,5`); p1 vaba — lukuta; 390 px ✓; konsoolivigu 0.

## 28.09.2026 (v=657) — pinna olek dokumentidest (kasutaja: tagasi lükatud pakkumus hoidis pinda „Pakkumusel”)
- Põhjus: olekut kirjutati käsitsi ~10 kohas; tagasilükkamine/tühistamine/aegumine ei vabastanud pinda. `pinnaOlekSync` + DB.save mähis.
- Parkimishõive ja vana `avaPind` loevad lõppenud pakkumusi `OFFER_LOPP` järgi (varem puudus „Tühistatud”).
- E2E: tagasi lükatud → Vaba, tühistatud → Vaba, aegunud → Vaba (ja taas saadetud → Pakkumusel), Lisa N ring → Lepingus → tühistus
  → Vaba, arhiveerimine → Vaba, mustandleping → Lepingus → kehtiv → Üüritud, püsib pärast laadimist; B11G laeb vigadeta.
- Avatud: saadetud pakkumus, mille kehtivus on möödas, jääb „Saadetud” (automaatset „Aegunud” pole) → pind jääb Pakkumusel.

## 28.09.2026 (v=656) — netopind ja koef eemaldatud (kasutaja: neid ei kasutata)
- data.js 44 pinnalt `neto`/`koef`; UI: pinnakaart, pinna leht, pinna külgpaan, jagamise vorm (üksusele ei salvestata),
  objekti lisamise vorm, CSV-impordi tuletus + aliased + vihjed. Jagamise sisemine vahesumma (oma osad) jääb arvutuseks.

## 28.09.2026 (v=653–655) — pinna leht (kasutaja: igal pinnal oma leht — aktiivne leping, toimingud, arhiiv)
- `View.pind` + marsruut `#/pind/<id>`; `avaPind` suunab pinna lehele (vana otseavamise loogika jäi funktsiooni alles, kasutamata).
- `pinnaDokRead(s)`: lepingud `lepPindSeos` järgi (endine → arhiivi), imporditud `pindIds`/üürniku järgi, pakkumused `spaceIds`.
- `pinnaTahtajad`: dokumentide KEY_DATES (pinnamuudatused ainult selle pinna omad) + aktiivse ringi `pinnad` + lepingu lõpp /
  pakkumuse kehtivus, kui kalendris eraldi kirjet pole. `pindUusPak`, `pindMuudatus` (LEP_FOCUS_ID + muudatusrežiim).
- E2E: p4 (Üüritud), p6 (pakkumus Saadetud), p1 (vaba → Lisa lepingule LEP-2026-001, eelvalitud → salvestus → leping, pinna lehel
  „Lisatakse … Lisa 4”, hind Lisa N-st, tähtaeg „Pinna üleandmine”), kaardi klõps, `.lm-pind` link, 390 px ✓; konsoolivigu 0.

## 28.09.2026 (v=652) — pinnakaardil tulev muutus (kasutaja)
- `pindAjakava(sid)`: jõustunud eemaldus (kpv ≥ täna) → „Vabaneb kpv+1”; jõustunud lisa (kpv > täna) → „Üüritakse alates kpv”;
  koostamisel ring → „Lisatakse LEP-…-le alates … / Vabaneb …” + „allkirjastamata”. Kaardil `.sp-ajakava` (kalendri ikoon, link lepingule).
- Test: kolm seisu ✓, kuvamine objekti lehel ✓, konsoolivigu 0.

## 28.09.2026 (v=651) — pinna lisamine/eemaldamine kehtivale lepingule Lisa N-ga (kasutaja: nõustun soovitustega)
- Mudel: `lepPohiPindIds` (dokument) vs `lepPindIds(l, tana)` (kehtivad = dokument + jõustunud lisa − möödunud eemalda).
  `lepHind` (lisatud pinna hind ringist), `lepKuus`/`lepM2` täna, `lepTagatis` = dokumendi tagatis + vahed, `lepParkKohad`.
  Mall/readRows/rebuildPohi/buildPunktid → `lepPohiPinnad` (allkirjastatud P 2.1 ei muutu — testitud).
- Ring: `r.pinnad`; `pindPunktTekst` (Lisa N lause), `ringItems` kind "pn", loendur, × eemaldab (broneering vabaks),
  `ringYleRef` märgib p 2.1/3.1/2.2/4.1, `ringJousta` → pinna olek + KEY_DATES „Pinna üleandmine/tagastamine”.
- Vorm `openPindMuut(lid, lisa|eemalda)` külgpaanis (PM, pmDraw, pmSalvesta): pind, kuupäev, hind, kohad plaanilt, tagatis;
  eemaldamisel „Tagasta vahe / Jääb tagatiseks”; ainus pind → „Alusta lepingu lõpetamist” (`sulgAlusta`).
- Pakkumus: `data-lk="lisa"` kui kliendil samas majas kehtiv leping → ring.pinnad (+ pakkumus), LEP_FOCUS_ID + muudatusrežiim.
  Ringi tühistus vabastab broneeritud pinnad ja taastab pakkumuse „Aktsepteeritud”.
- Kõrvalparandus: ujuv „Vaata üürnikuna” kattis külgpaani jaluse nupu → `body:has(#side.open) .role-tab { display:none }`.
- E2E: lisa (Pind 1 → Lisa 4; tulevikus Lepingus, kuupäeval Üüritud, üür 2 548,50 → 6 115,70, tagatis +10 702, kohad liidetud) ✓;
  eemalda (Lisa 5, vaba, üür/tagatis tagasi) ✓; ainus pind → lõpetamine ✓; pakkumus → Lisa 4 ✓; tühistus ✓; konsoolivigu 0.

## 28.09.2026 (v=649–650) — mitme pinnaga leping (kasutaja: pinnapõhised hinnad, punktid 1–5, operaator valib)
- NB: pakkumus→leping tegi juba enne N eraldi lepingut („N pinda = N lepingut”) — see on vaikimisi; lisandus ühine leping erandina.
- Abifunktsioonid (ensureTehing ees): lepPindIds · lepPinnad · lepOnPind · lepPindNimi · tehHind · tehKuus · lepM2 · lepKuus · lepMituHinda.
  10 hõivepäringut `l.spaceId === x.id` → `lepOnPind`; allkiri (Üüritud) ja arhiveerimine (Vaba) kõigile pindadele.
- Mall `pohiTehing` saab `sps`: P 2.1 loetelu + kogupind; P 3.1 pindade kaupa kui hinnad erinevad (factMark `hind@sid`, muutmine
  `.fact-in` käsitlejas), ühtne hind → vana lause; kuusüür/tagatis summast. rebuildPohi hoiab ühtse hinna sünkroonis.
- Pakkumuse paan: `.lk-seg` (Eraldi · N / Üks ühine leping, eri majad → keelatud) → ühine: hinnad `offerPrice` pinna kaupa,
  kohad `offerParkKohad`, lisad pinnaplaanidega (`spaceId`). Viisard: pinnapick lülitab (LWIZ.spaces), `data-lwk`, arvutus pindade kaupa.
- Portfelli „kuus” = `lepKuus` (lepingu tegelik hind; varem pinna hinnakiri `rent(sp)`), m2hind = lepingu hind.
- Riba: sama numbriga lisad → „Lisa 1 · Pind 1 / Pind 2”.
- E2E: ühine (P 2.1/3.1, hinnad 7,50/7,00, hind@ 9,00 → summa + tagatis, lisad, olekud) ✓; vaikimisi 2 eraldi ✓; viisard ühine ✓;
  arhiveerimine vabastab mõlemad ✓; ühe pinnaga lepingu summa muutumatu ✓; konsoolivigu 0.

## 27.09.2026 (v=647–648) — „Tagasi lükatud” välja, „Ei nõustu” leebe (kasutaja)
- Nähtav tulemus „Jääb samaks” / „Sõnastus jääb samaks”, toon `info` (hall), mitte `no` (punane); juhtriba tone ok.
- Vana nimekirjast „Lükkan tagasi” (valik, vorm, käsitleja) eemaldatud; alles: Selgitan · Muudan · Saadan lisasse · Soovin ainult vastata.
- Üürnik saab „jääb samaks” punkti vastates uuesti avada (nagu selgitatud). Uus lahendusTekst eesliide „Jääb samaks — ”.
- Punktide loendur „N muudetud” → „N lahendatud” (loendas ka selgitatud/samaks jäänud).

## 27.09.2026 (v=646) — üürniku „Soovin muuta” väli oli nähtav ka suletuna (kasutaja: „Saada ei tööta”)
- Põhjus: `.soov-yy-f { display: flex }` kirjutas `hidden` atribuudi üle → väärtust sai muuta, aga saatmine pidas välja
  suletuks; ilma tekstita ei juhtunud midagi. Parandus: `.soov-yy-f[hidden], .soov-f[hidden], .soov[hidden] { display: none }`
  + tühja saatmise teade. Reegel: iga uus `display:flex/grid` komponent, mida peidetakse `hidden`-iga, vajab `[hidden]` reeglit.

## 27.09.2026 (v=645) — „Ei nõustu” ei töötanud faktikaardil (kasutaja)
- Põhjus: v643 ümberkorraldusel jäi `eiVorm` ühe ploki `const`-iks, faktikaardi plokk kutsus seda väljast → ReferenceError.
  Parandus: `let eiVorm` ühises ulatuses. Test: faktikaart ja sõnastuse kaart → põhjendus → „Tagasi lükatud” ✓.
- Õppetund: pärast ümberkorraldust korda KÕIGI kaardinuppude E2E-testi (fakti „Ei nõustu” testiti ainult enne v643).

## 27.09.2026 (v=643–644) — LÄBIRÄÄKIMINE, etapid 2–4 (kasutaja: „tee teised etapid ka ära”)
- Klassifikaator `soovAnaluus`: fakt (etapp 1) › palve (`SOOV_PALVE`) = sõnastus › küsimus (`SOOV_KYS`) › null (paan nagu enne).
  „Kas hind võiks olla 7 €?” = soov (palve-sõna võidab küsimärgi). Näidislaused 7/7 õigesti.
- Sõnastuse kaart: siht-segment, soovitus, AI mustand textarea's (siht vahetab mustandi), Nõustun → `saadaSonastus`
  (otse/eri) või `saadaLisasse` (Lisa 3 eritingimus sõnastamisel / kehtival ring); Ei nõustu → põhjendus → Tagasi lükatud.
  `soovPuhas` eemaldab tervituse, „palume lisada, et”, modaalverbi („peaks olema” → „on”).
- Küsimuse kaart: `aiVastus` (viitab punkti esimesele lausele) → Vasta ja sulge / Vasta, jäta avatuks.
- Mitu soovi: `soovMuud` (`SOOV_VOTI` märksõnad + `soovLoe`) → rida kaardil → uus arutelu teise punkti juurde (`c.soov`, `eraldatud`).
- Üürnik: „Soovin muuta: …” (parkimine arvuna — kohad valib üürileandja plaanilt) → tekst „Soovin muuta: X → Y.” + `c.soov`.
  `soovTuvasta` eelistab: hilisem vaba sõnum › `cmt.soov` › algne tekst.
- NB: heredoc'i python-string muutis `\b` backspace'iks (0x08) — parandatud; uutes patchides kasuta raw-stringe.
- E2E (testleping kustutatud): mitu soovi → eraldi P 2.2 ✓, üld → Lisa 3 ✓, põhi P 2.1 → otse ✓, küsimus → Selgitatud ✓,
  üürniku struktureeritud tagatis 3→1 → kaart „täpne soov” ✓; konsoolivigu 0.

## 27.09.2026 (v=642) — LÄBIRÄÄKIMISE LIHTSUSTAMINE, etapp 1: otsusekaart faktipunktidel (kasutaja)
- `soovTuvasta`/`soovLoe` (aiSonasta kõrval): hind (€, %, kümnendarv), parkimine (arv + „juurde/vähem”, sõnaarvud), tagatis
  („3 kuu üürilt 1 kuu üürile” → siht „-le”), tähtaeg (aastaks/kuud, ka „viieks aastaks”), üleandmispäev (pp.kk.aaaa).
  Näidislausete test: 12/12 õige (sh „Kas saaksite üle vaadata?” → null).
- Paan (`!kehtiv && fKey && !linked`, arutelu pole „Ootab kinnitust”): `.soov` kaart; Nõustun → `saadaFakt` (vana „Muudan” vormi
  loogika tõstetud ühiseks funktsiooniks); Muudan → `faktiSisend` eeltäidetud + „Saada vastupakkumine”; Ei nõustu → põhjendus
  kohustuslik → `lahenda("tagasi lükatud")`. Parkimine: `parkPickUI` eelvalitud (olemasolevad + `parkLahimad`, pehmed lubatud).
- E2E testleping (PAK-2026-003 põhjal, kustutatud): hind 7,50→7,00 Nõustun ✓, tagatis 3→1 Muudan→2 ✓, parkimine 4→6 plaanil ✓,
  Ei nõustu ✓, Muud võimalused (4 teed) ✓, konsoolivigu 0.

## 27.09.2026 (v=641) — telefonis pakkumuse dokument ei jookse üle serva
- Põhjus: `.sh-head` kaks plokki kõrvuti + `.sheet-embed` polster 44 px → parem plokk („Hinnapakkumine” + kuupäevad) 30 px üle serva.
- ≤600 px: päise plokid üksteise alla (parem plokk vasakjoondusega), polster 26/20, pealkiri 20 px, tabel 12 px.
  Mõõdetud 390 px: pakkumuse lehel ja lepinguvaates üle serva 0 elementi.

## 27.09.2026 (v=640) — olmeala jagamine ilma ühiskasutuse märketa (kasutaja)
- Kasutaja: osad pole ühiskasutuses — valik „Ühine” → „A+B”, rea silt „jaotus”; `yhine` lipp ja `spaceParts` „(ühine)” eemaldatud.
  Arvutus sama: A m² käsitsi, B = ülejäänu.

## 27.09.2026 (v=639) — pinna jagamine: ühine olmeala (kasutaja)
- Olmeala real kolmas valik „Ühine” (vaikimisi): A m² sisend (vaikimisi pooleks), B arvutatakse; ühisala jaguneb edasi netopinna
  suhtes (olmeala osa sees). Kontroll: igal üksusel peab olema põhiruum (mitte ainult olmeala).
- `spaceParts` (data.js) lisab ühisele osale „(ühine)” — pakkumus, leping, pinnakaart. Test Pind 7: A 5,0 / B 10,2 →
  7A 67,8 + 7B 271,8 = 339,6 m² (= ema), jagamine võeti testis tagasi.

## 27.09.2026 (v=638) — import salvestub partiina, pooleli ülevaatusele saab tagasi (kasutaja)
- `f.pid` (I1, I2 …): iga üleslaadimine = uus import; impordi laual „Lisa faile” lisab samasse. Vanad failid → `impPidMigr`
  koondab kuupäeva kaupa (kutsutakse `impToimikud`-is, ka ettevõttevahetuse järel).
- `#/import`: kaardid (Pooleli / Lõpetatud) — failid, lepingud, kinnitatud/kokku, edenemine (kinnitatud + välja jäetud),
  viimati avatud, järgmine samm. `#/import/p/<pid>`: senine laud selle impordi kohta; „Eemalda loendist” ainult lõpetatul.
- Ülevaatus: eelmine/järgmine ja „n / N” impordi sees; tagasi-link = impordi laud; avamine salvestab `root.viimati`.
- „Jätka” (`impJatkaHref`): avalehe „Vajab tegevust” (rida iga pooleli impordi kohta, pill „jätka”), portfelli riba, tulemuse leht.
- Test päris failidega: 2 importi, kinnitus → Lõpetatud, püsib reload'i järel. Testiandmed kustutatud (localStorage + IDB).

## 27.09.2026 (v=637) — kiirkontroll: modaalid, menüüd, kitsas ekraan
- Modaali (pdfmodal) „Sulge” btn-primary → btn-ghost btn-sm (sulgemine pole esmane tegevus; mujal „Sulge” juba kontuur).
- Mobiil: menüünupp 42 px (--line äär) → 40 px kontuurnupp (--edge, r 8); sahtli sulgemine 38 px ruut → 32 px ikoonnupp.
- Kontrollitud: muudatuste modaal, „+ Uus” menüü, impordilaud, 390 px portfell/pakkumus/menüü, 1024 px objekt — vigu pole.
  Kõrvalmärkus (enne olemas, mitte nupud): 390 px pakkumuse A4-dokument ulatub paremalt üle serva.

## 27.09.2026 (v=636) — NUPPUDE KOONDAMINE, samm 5: lülitid ja kiibid
- Segmentlüliti üks kuju (alamsakkide keel): `pf-view` (oli surface+vari, aktiivne tume/hele täidis), glide-pill `--surface-soft`,
  `pf-mode` Loend/Kaardid (oli konteiner + täidis), `tabbar` (kalendri Loend/Kuu; inline vari eemaldatud, `pf-sep` eraldaja),
  `df-tab`, `lm-doc`. Kõigil reakõrgus 16 px → 30 px (link pärinud 1,5 → oli 34).
- Kiip üks kuju: `preset-btn`, `al-naide` (oli täisümar + joon), `pk-chip`, `ir-dok` (eraldi = katkendäär), `cal-chip` (varjuta).
- Ese-filter ja Järjesta-valik: vari maha, raadius 8 (nagu kontuurnupp).
- Mõõdetud: segmendid 30 px (alamsakk märgiga 32), kiibid 28 px.

## 27.09.2026 (v=635) — NUPPUDE KOONDAMINE, samm 4: ikoon- ja saatmisnupud
- Ikoonnupp: `icon-btn` 34→32, `comp-ic` 34→32, `sb-collapse` 30 (ruut r9, --faint) → 32 ring --muted; ikoon 16 px.
  (Kokkutõmmatud külgriba `sb-min` sb-collapse jääb oma asukoha-/äärereegliga.)
- Saatmisnupp: `omni-send` 28 / `comp-send` 36 / `ag-send` 44 → kõik 32, nool 15 px; agendi nupp `I.enter` → `I.up`.
  Omnibox polster 5/6 → 3/4, et kõrgus jääks 40 (sama mis „+ Uus”).
- Ikoonide hover-animatsioonid (v633) laiendatud: icon-btn, comp-ic, comp-send, omni-send, ag-send; index.html teema-nupp
  `data-i=moon`, omni-send `data-i=up`. `rmstep` (reasisene ×) jääb tekstimärgiks.

## 27.09.2026 (v=634) — NUPPUDE KOONDAMINE, samm 3: tekstinupud
- `steplink` 12/600 (oli 700), hoveril allajoon (offset 3); 7 kontekstipõhist font-size'i kustutatud (11,5 / 12 / 12,5).
- „Näita kõiki” (`ns-toggle`, oli 11/500 + taust) ja „Soovin ainult vastata” (`hw-only`, 13 muted) = `steplink`.
- `btn-quiet` (punane): polster 8/16 + min-height 40 — sama kõrge kui naabruses olevad `.btn`-id.
- Jäid: lepingu riba mono `lt-link`, toimingurida `act-row` (rea keel, mitte link), `sb-reset`, tekstisisene `ar-jarg`.
- Kontroll: kõik nähtavad steplink'id 12px/600.

## 27.09.2026 (v=633) — ikoonide hover-animatsioonid (kasutaja)
- app.js: `I`-kaardi svg-d saavad `data-i=<nimi>` (üks tsükkel kaardi järel); index.html jaluse teema/Seaded = moon/gear.
- styles.css lõpus plokk: nool libiseb, tagasi vasakule, üles/välja diagonaal, pluss/rist/võrk/hammasratas pöörab, kell+vestlus
  heliseb, silm pilgutab, pliiats kirjutab, dokumendid kalduvad, muu hüppab. Kehtib `.btn`, `.btn-quiet`, `.dm-chip`, `.nav a`, `.sb-item`.
  Nupp ise ei liigu. prefers-reduced-motion lülitab välja. Kontrollitud headless hover'iga (transform/animation arvutatud stiilis).

## 27.09.2026 (v=632) — kontuurnupp = avalehe kiip, ikoonikastid kadusid (kasutaja)
- `.btn-ghost`: `--surface` + `--edge` äär, varjuta, kiri 500, hoveril `--surface-soft`; ikoon `--muted` → hoveril `--ink`.
- Kõigilt `.btn`-idelt kadus ikooni ümber olev kast (svg 15/14 px, `.bic` nool ilma kastita); `:has()` polster 13/10 px.

## 27.09.2026 (v=631) — nupud ei tõuse hoveril (kasutaja)
- `.btn:hover` translateY eemaldatud (vari jääb), samuti `.dm-chip`, `.res-opt .ro-ic`, `.m-btn .m-ic`. Kaardid (`.pf-card`) ja
  külgriba ikoonid tõusevad endiselt — need pole nupud.

## 27.09.2026 (v=630) — NUPPUDE KOONDAMINE, samm 2: kontuurnupud
- 34/38 px kontuurnupud kadusid juba v629 `.btn` min-height'iga → alles 40 ja 32.
- `btn-soft` → `btn-ghost` (7 kohta, CSS kustutatud); `.coach-f .btn` oma kontuurivariant kustutatud; objekti „Muuda" inline
  valge stiil (hele teemas katki) eemaldatud.
- Kõrvalleid: objekti päise pealkiri „Hoone T6B" oli mõlemas teemas nähtamatu (`.obj-hero` `--on-ink` jäänuk) → `--ink`.
- Mõõtmine: kontuurnupu kujud ainult 40/32 (vahe vaid ikooni/tekstiga polstris). Rühmi kokku 61 → 51.

## 27.09.2026 (v=629) — NUPPUDE KOONDAMINE, samm 1: heledad nupud + tööriistariba
- Inventuur (headless, 101 vaadet, 1361 nuppu): 44 eri kuju → ettepanek 10 (koondvaade artefaktina, generaator scratchpadis).
- `.btn` min-height 40 → kaks kõrgust (40/32). `btn-accent` → `btn-primary` (19 kohta, CSS reeglid kustutatud).
  `btn-loo` ja `role-tab` = `btn btn-primary` (oma visuaalreeglid kustutatud, alles asukoht/pluss-pööre/hõljuva nupu vari).
  `pf-new` = `btn btn-ghost btn-sm` (kasutaja otsus); `.pf-tabs a` sakistiil tühistatakse `.pf-tabs a.pf-new`-ga.
- Mõõtmine pärast: heledaid nupuvariante 9 → 2 (40 ja 32 px). Järgmised sammud: kontuur (34/38 → 40/32, btn-soft), siis
  tekstinupud, ikoon-/saatmisnupud, lülitid ja kiibid.

## Kontekst ja fookus

- **Töö käib AINULT `demo/` kaustas** — spetsifikatsiooni ja arhitektuurifaile
  ei muudeta ilma kasutaja palveta.
- Demo on **raamistikuvaba staatiline SPA**; topeltklõps `demo/index.html` töötab
  alati. Brauseriautomaatika/ekraanipiltide jaoks `node serve.js` → localhost:8471.
  **HOIATUS (17.09.2026):** port 8471 oli hõivatud TEISE ThinkOne koopiaga (v=436, `onboarding.js` +
  `negotiation.js`) — enne testimist kontrolli `curl localhost:8471 | grep app.js`; vajadusel serve.js koopia
  teisel pordil (`path.resolve` ROOT-ile, muidu Windowsis 403).
- Cache-versioon praegu **v=628** (v627–628: impordi kinnitus → kohe järgmine + kviitung; v622–626: „demo 3" üle võetud 26.09; v620–621: ajajoone hover valge kaart, avatud sündmus üks kaart; v617–619: kalender ajajooneks; v616: kaardiruudustik `minmax(0,1fr)` — pikk järgmise sammu lause ei venita veergu servani; v615: osapoole lehe veerud joondatud — parem veerg „Andmed" pealkirjaga, dokumendikaardid ilma sisenihketa; v614: Ese-filter tööriistareale, Seis-filter maha; v607–612: osapooled rollidega, arhiiv, neli märki, üks kaardimudel; v606: kinnitamine jääb impordi lauale; v604–605: ülevaatuse paan selgemaks; v603: impordi laua tööriistariba; v602: pinna olek dokumentidest; v600–601: impordi kinnitustoimingud; v595–599: lepingute import päris üürilepingutest; v594: jagada saab ainult mitme ruumiosaga pinda; v592–593: pinnad 2, 4, 5, 6, 22 vabad + salvestise migratsioon; v588–591: pinna jagamine üüriüksusteks; v586–587: parkimise vaikejaotus pindade vahel + pindade import T6B struktuuris; v577: portfelli alapealkiri eemaldatud; v579–581: saki põhinupp sakireal paremal — päise kõrgus igal sakil sama, hüpet pole; v582: ilma välise pillita — ikooniruut + tekst `--ink`) (kõik KUUS viidet index.html-is sünkroonis: styles + 5 js, sh `riskiandmed.js`).
- **v=585 — sisukord eemaldatud** (kasutaja: liiga kirju): `#ltree` märgendus lepinguvaatest ära (funktsioonid jäävad,
  `ltreeInit` väljub kohe; ↑/↓ punktide vahel enam ei tööta). Edenemisnäidik kolis „algusesse" nupule: `#doc-top` = pill
  (punktiirne riba `--p` · protsent · ↑), nüüd lepinguvaate tasemel (ka mustandis), ilmub > 320 px kerides.
- **v=583–584 — tagasi portfelli:** vana lepingute leht `#/lepingud[/filter]` suunatakse routeris `#/portfell/lepingud`-ile
  (mustand/läbirääkimisel/allkirjastamisel → Läbirääkimisel; `history.replaceState`); imporditud lepingu, töölepingu ja viisardi
  tagasi-nupud → „Portfell". Murupuru esimene osa („Portfell" / „Minu dokumendid") on link saki juurde, kust dokument avati
  (`navSubOf`: leping/imp → lepingud, pakkumus → pakkumused, klient → osapooled, objekt → esemed).
- **v=578 — portfelli „Kliendid" → „Osapooled"** samas `.pf-panel` kujunduses: kliendid + imporditud lepingute pooled, keda
  kliendiregistris pole (nt Caverion = Teenusepakkuja); roll alamvaadetena (Kõik · Üürnikud · Kliendid · Teenusepakkujad,
  `#/portfell/osapooled/<roll>`); veerud Osapool · Roll · Lepinguid · Tasu/kuu (kehtivad + imporditud) · Riskiskoor ·
  Viimane suhtlus · ↗; jalus summaga. Vana `#/portfell/kliendid` → alias; kliendi lehe tagasi-nupp „Osapooled".
- **v=576 — kolleegi auditi parandused (partii 1 + 2):**
  sisu: esmakäivitusel kehtiv leping `seedKehtivLeping` (Killa PAK-2026-007 → LEP-2026-001, allkirjad, parkimiskohad
  `parkLahimad`; `DB.FRESH`), täituvus 89 → 80 → 84 %; imporditud punktide arv klauslikihist (LEP-2023-029: 132), kihita
  lepingul aus tekst; poolte punkt originaalist siltide kaupa + „sõlmimise aegsed andmed" (`klPooledHTML`); README uuendatud.
  Portaal: kliendivalija ainult operaatori eelvaate ribal (`.po-preview`, „Ava kliendina"), üürnik valijat ei näe.
  Ligipääsetavus: omnibox/agent/komposer `:focus-within` rõngas (helk jääb); `--faint` 64 % tume / 55 % hele, heleda
  `--amber` 52 % (AA); vaatevahetusel `#sr-live` teade + fookus `#app-view`-le. Eskeipimine: omnibox, avalehe tegevused,
  võtmekuupäevad. Partii 3 (tokenite/komponentide dokument Mattiasele) jäi hilisemaks.
- **v=575 — portfelli uus paigutus (kasutaja eeskuju):** päis „Portfell" + alapealkiri, saki põhitegevus paremal (`Uus leping` /
  `Uus pakkumine` / `Lisa objekt`); allajoonitud sakid arvudega (`.pf-tabs`); roheline riba (`.pf-signbar`: pealkiri + alarida +
  „Vaata ja allkirjasta →" / „Vaata ja tegutse →"); kõik ühes paneelis `.pf-panel` (otsing + loend/kaardid · alamvaated · kiibid ·
  tabel · jalus „N lepingut · Kokku kuus X €"). Lepingute veerud: Klient/leping · Ese (tüüp + imporditud alareal; tüübifilter) ·
  Tasu/kuu · Periood (algus/lõpp kahel real; sort `psort`) · Olek · ↗ (`I.ext`; allkirja ootel roheline „Allkirjasta").
  Pakkumused samas paneelis (`offerTableHTML(f, true)` + jalus). Ikoonid `I.ext`, `I.sign`.
- **v=574 — pakkumuste riba „Näita"** (nagu lepingutel): üks tegevust vajav pakkumus → roheline tegevusnupp; mitu → „Näita"
  → `#/portfell/pakkumused/tegevus` (uus `OFFER_FILTERS.tegevus` „Vajab tegevust", arv ja read `offerTegevus` järgi, prioriteedi
  järjekorras; kiip on nähtav ainult siis, kui filter on aktiivne — esimesena).
- **v=572–573 — pakkumuste tabel: olek ja järgmine samm eraldi:** veerg „Olek" = ainult pill; uus paremale joondatud veerg
  „Järgmine samm" = väike nupp (esimene prioriteet — kliendi ettepanek — roheline, teised ghost) või vaikne „ootab klienti · N p".
- **v=568–571 — pakkumuste kiirteed** (kasutaja, nagu lepingute „Allkirjasta →"): `offerTegevus(o)` = mis ootab üürileandjat
  (Kliendi ettepanek → „Vasta kliendile", Aktsepteeritud ilma lepinguta → „Loo leping", Mustand → „Saada kliendile"). Olekulahtris
  kiirtee `#/pakkumus/ID/vasta|leping|saada` (marsruut lubab järelliidet; init puhastab URL-i, fookus + `.go-pulse` õigel väljal:
  `#op-reply` / `#to-lease` / `#send-offer`). Portfelli sakis pealkirja all `offerTegevusRiba` + otsing; saki arv = `offerTegevus`
  arv. „Pooleli" sisaldab nüüd Aktsepteeritud (ootab lepingut), „Lõpetatud" enam mitte. Saadetud: „ootab klienti · N p" (≤ 3 p ooker).
- **v=567 — tuhandeeraldaja alati:** `eur()` (data.js) vormindab `useGrouping:false` + ise lisatud murdumatu tühik iga 3 numbri järel
  (ka 4-kohalised: 1 328 €, 3 215 m²); EHR-i pindalad objekti lehel läbi `eur(…, 0)`. Hinnasisendid (€/m² < 1000) ei mõjutu.
- **v=566 — portfelli filtrid veerupäistes** (kasutaja): Lepingud-saki tööriistaribal ainult otsing + 4 vaadet arvudega
  (Aktiivsed · Läbirääkimisel · Lõppevad · Arhiiv) + kaart/loend. Tüübikiibid ja „Imporditud" vaade kadusid → `PF_COLS` päised:
  Tüüp (vertikaal + allikas platvorm/imporditud, `PF_TYPE`/`PF_IMP`), Olek (mitmikvalik `PF_OLEK`), Klient/€ kuus/Algus/Lõpp
  sorteerivad (`PF_SORT`). Popover `.th-pop` (`pfHeadBind`, sulgub väljaspool klõpsu / Esc). Kaardivaates sama päiserida
  (`.pf-colbar`); aktiivsed filtrid kiipidena `pfChips` (× / „Tühjenda kõik"). Vana `#/portfell/lepingud/imporditud` → allikafilter.
- **v=564–565 — plaan avaneb PDF-ina (kasutaja: PDF on selgem):** `openPdf` täisekraanil = PDF-raam `#view=Fit&toolbar=0&navpanes=0`
  (terve leht mahub, vektor terav); PNG-eelvaade jääb ainult kehtiva lepingu dokumendiveergu (`pdfEelvaade`). CSS: tühi `.pdfhtml`
  on `pk-max` režiimis peidus (muidu võttis pool akna kõrgusest).
- **v=563 — plaanide eelvaated teravaks:** `lisad/pinnad/*.png` + `T6B_parkimisskeem.png` uuesti 3600 px laiusega, 64-värviline
  palett (MEDIANCUT, ilma ditherita) — 2× resolutsioon, kokku 6,2 MB (enne 6,7 MB 1800 px). Modaalis `object-fit: contain`
  100 % kastist. Vektor-SVG oleks olnud ~4,6 MB/plaan — liiga raske. Importitud skaneeringud jäid 1800 px.
- **v=562 — plaan-PDF avaneb tervikuna:** `openPdf` täisekraani režiimis (`pk-max`) näitab PDF-i asemel sama nime `.png`-d
  (`.pdf-img`, mahub laiuse JA kõrguse järgi); pildi puudumisel PDF-vaatur `#view=Fit`. „Ava uues vahekaardis" = originaal-PDF.
- **v=561 — hoone kaart** (`objMiniCard`, kasutaja eeskuju): ikoon + nimi, täituvus % ja riba paremal; kaks suurt numbrit
  (Üüritulu € / kuu, Vaba pind m² · N pinda); jalus kalendriikooniga „Järgmine tähtaeg: 30.09 · tüüp" (sama aasta → pp.kk).
  Kasutusel Portfell › Esemed ja Ülevaates (≥ 2 objekti).
- **v=560 — pakkumuse ülaosa nagu lepingul:** tagasi-nupp + nupurida + `.cl-track` asendatud `.lep-riba`-ga: `PAK-… ✓ Mustand —
  ● Saadetud — ○ …` (kliendil lühem rada; „Kliendi ettepanek" ooker, lõppolek punane hetkesammul) + „Muudatused · N →",
  „Eelvaade · prindi / PDF", lisad (`openOfferLisa`) ja seotud lepingu link. `#offer-diff-n` id säilib (init uuendab arvu).
- **v=557–559 — laiad sisud üle ekraani:** `pdfMax(on)` paneb modaalile `.pk-max` (≈ kogu aken, 14 px äär); parkimise aknad
  (`openParkLisa`, `parkPickUI`, `parkEelvaade`) ja plaani-PDF-id (`openPdf`: pinnad/…plaan/parkim) avanevad nii, plaan skaleerub
  akna kõrgusesse (flex; JS-i `display:block` kirjutatakse CSS-is üle). `pdfKind` lähtestab (dokumendid jäävad 1100 px).
- **v=555–556 — parkimiskohad läbirääkimisel valikuga:** üldine valija `parkPickUI` (siht = kohustuslik arv või null = vaba arv,
  `onSave`); `faktiSisend("parkimine")` = peidetud väli + „Vali kohad plaanil" (`parkFaktValik`) — ettepanek kannab `parkKohad`,
  vana/uus tekst numbritega; kinnitusel `f.parkKohad = ep.parkKohad`; muudatusringi fakt kannab samuti kohti. Lepingu mustandi
  P 2.2 ja ühe pinnaga pakkumuse arv ei ole enam numbrisisend (tuleb valikust). Üürnik: „Vaata kohti plaanil" (`parkEelvaade`).
- **v=551–554 — parkimiskohad eraldi esemena** (kasutaja): `PARK_SVGS["obj-t6b"]` (juurkausta parkimisplaan.svg sisseehitatuna,
  „Pind 19" silt → „Pind 20"; data.js IIFE ekspordib `PARK_SVGS`, `PARK_MUUD`). `parkInfo` loeb SVG-st kohad (nr, ligipääsetav,
  keskpunkt) ja pindade uksed; `parkHoive` tuletab olekud (Üüritud/Lepingus/Pakkumuses/Kasutusest väljas); `parkPlaanHTML`
  värvib genereeritud `<style>`-iga (`--pk` muutuja); objekti lehel `parkRegisterHTML` + `parkRegBind` (ainult registriplokk
  renderdub uuesti). Pakkumuse mustandis rida „Kohad plaanil" (`parkPick('o')`), lepingu P 2.2 mustandis „määra kohad plaanil"
  (`[data-parkpick]`), Lisa 2 kõikjal `park:` (`parkFix` teisendab vana staatilise T6B_parkimisskeem.pdf viite), kehtival
  lepingul „Vaheta kohti" (arv sama). Pakkumuse versioonid/diff kannavad `parkKohad`. B11G-l plaani pole → vana käitumine.
- **v=549–550 — pindade oma plaanid:** `pindade-plaanid/` (kasutaja, 34 SVG + kõik pinnad; gitignore'is, ~160 MB) →
  headless Chrome print-to-pdf (vektor, ~380 KB) + pymupdf PNG-eelvaade 1800 px → `demo/lisad/pinnad/T6B_Pind_NN.pdf/.png`
  (NN = 01…30, B1…B5) ja `T6B_koik_pinnad.pdf` (objekti üldplaan). Iga pind: `plaanFail` → pakkumuse ja lepingu Lisa 1 on
  pinna oma plaan (valitud pind kollasena). `plaanFix`: vanad salvestatud Lisa 1 üldplaani viited → pinna plaan; `load()`
  täiendab salvestatud pindu `plaanFail`-iga ja viib vana üldplaani tee uuele. NB: pymupdf SVG-renderdus on vale (mustad
  alad) — kasuta Chrome'i. Pind 19 plaani pole (alusplaanil ühine Pind 20).
- **v=548 — lisa eelvaade pildina** (`pdfEelvaade`): kehtiva lepingu dokumendivalijas näidatakse PDF-lisa kõrval olevat
  sama nimega `.png`-d (täislaiuses, ei keri, PDF-vaaturi tumedat raami pole); pildi puudumisel varuvariant = PDF-raam.
  PNG-d tehtud pymupdf-iga 1800 px laiuseks: `lisad/T6B_parkimisskeem.png`, `T6B_pinnaplaan.png`, `importitud/P29_parkimine.png`,
  `importitud/T6B_pind_29_plaan.png` — PDF-i muutes genereeri PNG uuesti.
- **v=547 — lepingu nr, olekurada, muudatused ja dokumendid ALATI dokumendi kohal** (`.lep-riba`, ka laial ekraanil);
  puus on ainult sisukord + edenemisriba (puu „Leping" ja „Dokumendid" plokid eemaldatud).
- **v=545–546 — akna suuruse muutus:** A4 ümbermurdmine (resize) taastab nüüd märgised (`a4Marks`), allkirjade märgi
  (`a4SigBadge`) ja puu nähtavuse. Vana päis (`.lep-head`) on alati peidus; kitsal ekraanil `.lep-riba` — lepingu nr + olekurada
  + „Muudatused · N" + lisad monospace-ribana (`lepPeaOsad` = puu tipu ja riba ühine sisu).
- **v=543–544 — portfellist otse dokumenti** (kasutaja): kaardi/rea klõps avab kohe lepingu, pakkumuse, imporditud lepingu
  (`r.href`); eelvaateid (`pfExpand`, `pfPreview`) ja pinnapaneeli (`openSpacePanel`) hetkel ei avata, funktsioonid jäävad koodi.
  Pinnakaart (`avaPind`): leping › aktiivne pakkumus › imporditud leping › vaba pind = uus pakkumus pind eelvalitud (`PRE_SPACE`);
  hõivatud ilma dokumendita → teade.
- **v=542 — allkirjade märk A4-paberi ülanurgas** (`a4SigBadge`, pärast lehtedeks murdmist): allkirjastamisel ja
  allkirjastatud lepingul „○ Üürileandja · ✓ Üürnik · 1/2" (roheline linnuke = allkiri olemas, katkendring = puudu,
  „(sina)" oma poolel, nimi + aeg vihjena); 2/2 roheliselt.
- **v=541 — puhas lepinguvaade** (kasutaja otsus): päis (`.lep-head`) on peidus, kui puu on nähtaval (`body.lt-on`, seab
  `ltreeLayout`). Puu tipus „Leping": number, olekurada ✓/●/○ (kehtival üks olekurida), lõpetamise märge, „Muudatused · N →";
  puu lõpus „Dokumendid" (`lepDokumendid` — kehtival dokumendivalija, muidu avab lisa). Kitsal ekraanil jääb vana päis.
- **v=533–537 — lepingu puu (sisukord) dokumendi kõrval** (kasutaja eeskuju): `#ltree` akna vasakus vahealas (fixed,
  `ltreeLayout` — v540: kitsas — laius ≤ 168 px, 11,5 px mono; peidus, kui külgriba ja dokumendi vahel on < 170 px). Monospace, „└" harud; v538 „nagu nav": tekstina AINULT
  jaotiste pealkirjad, punktid numbrireana nende all (`.lt-n`); Üldtingimuste jaotiste numbrid ainult aktiivses jaotises; Lisa 3 → 1, 2, 3…
  Jooksev punkt hele (`ltreeSpy`: 35 % joon, valitud punkt eelistatud kui ekraanil), punktiirne edenemisriba + %,
  ↑/↓ valib eelmise/järgmise punkti (`ltreeKey`; paani tühi kommentaarikast ei blokeeri). Klõps puus = punkti valik paanis
  (jaotis → esimene punkt). Töötab mõlemal poolel, A4- ja mustandivaates.
- **v=526 — üürnik näeb lepingut ALATI A4-dokumendina** (kasutaja otsus 23.09): läbirääkimistel (Saadetud, Kõik aktsept.)
  sama A4 kui allkirjastamisel (`a4Koik`); mustandi töövaade (`renderPunktid`, `[data-clause]`) on ainult üürileandjale.
  A4-s on punkt klõpsatav (delegeeritud kuular `#a4-wrap`-il → `togglePunkt`), valitud punkt `.a4-sel`, lahtise aruteluga `.a4-open` (v532: neljakandiline raam ala SEES; ala jagab punktidevahelise ruumi pooleks — padding + sama negatiivne margin: osapooled 10 px, üldtingimuste read 8 px külgedel, Lisa 3 loend 3,5 px — naaberalad ei kattu, tekst ja lehtedeks murdmine ei nihku; hover 60 ms; prisma-helki siin EI kasutata, kasutaja otsus)
  (`a4Marks()` pärast lehtedeks murdmist ja iga valiku järel). Kehtib ka kehtiva lepingu A4-vaates.
- **v=523–525 — arutelu ajajoonena** (kasutaja eeskuju). Paani lõimes ühendab avatarid peen vertikaaljoon, iga päeva ees on
  eraldaja „23. september 2026" (`thDays`, kaardid kannavad `data-day`), oma sõnum on „Nimi · sina". Lahendus on ajajoone viimane
  sündmus: „Punkt selgitatud" + kellaaeg · „Põhjendus: …" · „Tarmo Sepp · üürileandja". Suletud arutelu voldik on kaart
  (`.np-box`): „Arutelu ja ajalugu" vasakul, „N kommentaari ⌃" paremal.
- **v=522 — PÄRIS pinnad t6b.ee-st** (loetud 23.09.2026): `SPACES` = 29 pinda (1–18, 20–30; Pind 19 kodulehel puudub)
  + 5 bürood (`bu1`–`bu5`, nr „B1"…), kokku 7775,3 m²; m², osad (`jaotus`), parkimine ja hinnaastmed kodulehelt, elekter hinnang.
  „Hõivatud" → Üüritud (tenant null). Päris vabad 2, 4, 5, 6, 22 kannavad demo pakkumusi: Future Invest mustand **Pind 22**
  (oli 12), ONRY Pind 2 (oli 3), Maatrans Pind 5 (oli 1), Killa 4, MR Safe 6. `vabanes` (4–6: 31.05.2026) → täituvuse ajalugu.
  `SPACES_SEED` versioon: vana salvestatud pinnastik asendub seemnega. Agent tunneb „pind N" / „büroo N" / „bN" (`spaceFromText`).
- **v=518–521 — „Kuidas lahendame?"** (kasutaja eeskuju, asendab v517 „Sinu vastus + Muud tegevused"). Operaatori lahtisel
  arutelul on valikuread (`.hw-opt`): Selgitan tingimust (sulgeb „Selgitatud") · Muudan sõnastust/fakti · Saadan Lisa 3-sse ·
  Lükkan tagasi + link „Soovin ainult vastata". Valik avab vormi SAMAS kohas: „← Tagasi", rasvane silt („Vastus üürnikule" /
  „Selgitus üürnikule" / „Põhjendus üürnikule"), tekstikast, märkus, täislaiuses roheline nupp („Saada vastus" jätab arutelu
  lahti). Sinu käigul on „Kehtiv sõnastus" voldikus (`.np-curf`); paani lõim on lame: initsiaalid · „Nimi · üürnik" · täna ainult kellaaeg.
- **v=517 — „Lahenda" menüü asemel vastamise plokk** (kasutaja eeskuju). Operaatori lahtisel arutelul (`bindThreadActions`,
  `openThread`): „Sinu vastus" tekstiväli + [Vasta ja lahenda] (= `lahenda(cmt,"selgitatud",…)`, sulgeb kohe) + [Vasta]
  (sõnum, arutelu jääb lahti) + märkus; `details#res-panel` „Muud tegevused": Muuda sõnastust / „Muuda: <fakt>" (FORMS.muuda),
  Saada Lisa 3-e (FORMS.eri), Lükka tagasi (FORMS.tagasi, põhjendus kohustuslik → `#res-rej`). Vana „vasta" vorm + linnuke
  eemaldatud. Rea pill „Sinu kord" (uus STATUS + `stIcon` kuju `clock`), kui käik on sinu; lahtise arutelu korral on lõim
  paanis otse (mitte voldikus) ja sinu käigul olekurida ei korrata.
- **v=514–516 — punktide paan kasutaja eeskuju järgi.** Päis „Punktid" + kokkuvõte („1 sinu kord · 1 ootab · 1 muudetud")
  + joon; grupisildid (SINU KORD / LAHENDATUD…) maha, järjekord jääb. Rida: `.np-rt` = „Punkt 2.2" silt + rasvane
  pealkiri, staatus pehme pillina, nool; read eraldab joon. Lahti (`npDetail` redigeerimata olek, `.np-v2`):
  „Kehtiv sõnastus" kast (`.np-cur`) → ülekirjutuse märgid + Muuda/→ Lisa 3 → `details.np-cmp` „Võrdle varasema
  sõnastusega" (diff v1/mall → kehtiv) → olekurida `.np-st` (ok/wait/no: „Muudatus kinnitatud · Tarmo Sepp · üürileandja
  · 23.09.2026 kell 21:15" / „Arutelul · Sinu kord") → `details.np-more` „Arutelu ja ajalugu · N kommentaari"
  (lahti, kui arutelu käib; sees lõim + sõnastuse ajalugu). Aruteluta punktil lõim + kommentaariväli otse.
  `.ce-foot` on `.np-thread`-is väljaspool voldikut (bindThreadActions). Uued ikoonid `I.clock`, `I.swap`, `I.checkc`.
- **v=509–513 — paani pealkirjad ühtsed, kompass maha.** Paremas paanis kõik plokipealkirjad (juhtriba `.g-kes`, `.side-h`,
  `.doc-title`, `.np-head > .overline`, kaardi esimene `.overline`) = 15 px / 700 / tavakiri / `--ink` (varem 4 stiili).
  Juhtriba kursorit jälgiv kompass (`.g-nav`/`.g-needle` + mousemove-skript) EEMALDATUD. „Sinu kord" (`.guide.me`)
  prisma-helk on nüüd pealkirja all (`.g-kes::after` joon + `::before` hägu); kaardi alumise serva helk juhtribal
  välja lülitatud (`.guide.guide.me::after/::before { content:none }`; `.turn-glow` kaartidel jääb). Paani kaartidel
  ühtne polster 18/20 px (`.cl-side .guide, .cl-side .card.pad`), läbirääkimiste plokk samal teljel, `.np-head` polster 0.
- **v=507–508 — punkti tekst on paanis tagasi** (kasutaja: kommenteerides peab tekst olema kohe näha; tühistab UX V3).
  `npDetail`: muutunud punktil diff, muidu `.np-word > .np-text` plokk (pind, max 260 px, keritav). Dokumendi
  `punktPill` „Sõnastus muudetud" järgib v1-t (mustandis tehtu ei ole pärast saatmist enam „muudetud").
  Lisa 2 parkimisskeem: `demo/lisad/T6B_parkimisskeem.pdf` genereeritud juurkausta `parkimisplaan.svg`-st
  (A4 rõhtpaigutus, vektor, headless Chrome `--print-to-pdf`, SVG inline'is).
- **v=506 — muudatuste jälgimine algab esimesest saatmisest.** `.send-draft` (Mustand V1 → Saadetud) kutsub
  `lepV1Snap(l)` → `l.v1 = { aeg, tekst:{id}, hist:{id: muudatuste arv}, eri:[id] }`. `lepJalgib(l)` (v1 olemas VÕI
  staatus ≠ Mustand V1 — vanad v1-ta saadetud lepingud jäävad malli-võrdlusele), `muutusV1(l,p)`, `v1Hist(l,p)`.
  Kasutavad: `lepDiffItems` (+ modaali tekstid „saadetud versioon", sakk „Saadetud"), päise nupp (mustandis puudub),
  `npItems` (arutelude-väline muutus ainult pärast v1-t), `npDetail` diff „saadetud → kehtiv" ja ajalugu.
  CLAUDE.md reegel v441 uuendatud.
- **v=504–505 — eritingimus pesastub ülekirjutatava punkti alla** (paani Punktid). `renderNegoPanel` koostab
  „üksused": vanem (punkt) + lapsed (eri, mille `kirjutabYle` = vanema id). Laps `.np-kid` (↳ ühendusjoon `::before`),
  vanem `.np-par`; kui vanemal oma tegevust pole, on ta kontekstirida `.np-ctx` (tuhm, pill puudub). Üksus läheb
  kiireloomulisema liikme gruppi (mine > wait > done); grupi arv loeb päris ridu (kontekst ei loe).
  `shown`-hulk asendab `it.list` kontrolli (kas valitud punkt on loendis renderdatud).
- **v=503 — üks klõps: ava + näita dokumendis** (kasutaja: eraldi nupp on lisaliigutus). `.np-goto` nupp on EEMALDATUD.
  Paani real `togglePunkt(id, {scroll:true})` avab sisu ja kerib dokumendis punktini: klikitav dokument → `selectPunkt`
  scroll; A4-vaade (allkirjastamisel/kehtiv) → `gotoA4` (kehtival vahetab vajadusel dokumendi). Sulgemine ei keri.
  Akordionis `.np-dh` peidetud (rida ütleb viite ja pealkirja). v499 nupu kirjeldus allpool on aegunud.
- **v=499–502 — „Näita dokumendis" nupp ja kitsas paan.** `.np-goto` on tekstiga nupp (silma-ikoon + „Näita dokumendis",
  pill), akordionis sisu esimene rida (varem ainult nool rea serva all — ei saadud aru). 1440–1519 px vahemikus (paan
  340 px) on punktirida kaherealine: viide + staatus + nool üleval, pealkiri all (varem lõigati „Eritingi…").
  NB: reeglid on `.np-list .np-row` spetsiifilisusega, sest baasreegel `.np-row` on failis meediapäringust hiljem.
- **v=498 — „Näita dokumendis" ka A4-vaates** (allkirjastamisel + kehtiv). A4 read kannavad `data-aref` = punkti id
  (`leaseSheetHTML`: pooled `pohi:P 1.1/1.2`, põhitingimuste `tr`, üldtingimuste `.sh-up`; `lisa3SheetHTML`: `li`).
  `gotoA4(id)` → `a4Flash` (keri keskele + `.a4-flash` 1,8 s); kehtival lepingul vahetab vajadusel `LEP_DOC_SEL`
  (eri → „lisa3", muu → „leping") ja keritakse pärast `paginateA4`-t (`A4_GOTO`). `a4Has(l, p)`: nool ainult punktidele,
  mis A4-s on (pohi, uld, kinnitatud eri). Lisa N (muudatusring) punktidel sihtmärki veel pole.
- **v=496–497 — kehtiva lepingu paani vahed.** Toimingud + „Kehtiv leping" kaart on `.side-stack` konteineris
  (grid, gap 18 px, margin-top 18 px); `.side-stack > .card { margin-top: 0 }`, sest `toimingudCard` kannab
  inline'is `margin-top:18px` (muidu esimene kaart oli 18 px madalamal). Uued kõrvuti kaardid pane sama konteinerisse.
- **v=493–495 — punktide paan on akordion.** Valitud punkti sisu (`npDetail`) renderdub OMA rea alla (`.np-list .np-detail`,
  vasak joon, `np-in` animatsioon), real nool `.np-chev` + `aria-expanded`. `togglePunkt(id)`: sama punkti teine klõps
  (paani real või dokumendi `[data-clause]`-il) sulgeb sujuvalt (`.np-closing` max-height → 0, 200 ms; reduced-motion
  → kohe). `selectPunkt` jääb programmilisteks valikuteks (REOPEN, gotoClause). Akordionis peidetakse `.np-dh` kordus
  (viide + pealkiri on real); „Näita dokumendis" (`.np-goto`) eemaldatakse, kui dokumendis pole klikitavat punkti
  (allkirjastamise A4-vaade).
- **v=491 — teise poole allkiri nähtavaks.** `lepSig(l)` = {yl, yn}, `ootabMinuAllkirja(l)` (üürnik allkirjastas,
  üürileandja mitte). Lepingu paanis juhtriba all `allkirjadCard(l)` (2 rida ✓/○, „(sina)", 1/2) ja juhtriba ütleb,
  kes/millal/millega allkirjastas. Avalehe „Vajab tegevust": „X allkirjastas — sinu allkiri puudu" (pri −1, esimesena)
  ja „leping valmis allkirjastamiseks" (pri 1). Portfell: kaardil/loendis `.pill-sig` „Üürnik allkirjastas" + nupp
  „Allkirjasta"; lepingute saki kohal `.pf-signbar` igas vaates. KIIRTEE: `#/leping/ID/allkiri` (marsruut lubab
  sufiksi) → `View.leping.init` puhastab aadressi (`history.replaceState`) ja avab `openSign()`, kui oma allkiri puudu.
- **v=490 — Portfelli navigatsioon ühes kohas** (kasutaja otsus 23.09): külgriba alamlingid (Lepingud / Pakkumused /
  Kliendid / Esemed) eemaldatud, valik käib lehe sakkidega (`.tabbar`). Loendurid `PF_COUNTS` → saki märk `.tb-n`;
  külgriba „Portfell" näitab summat. Üürileandja päris kontakt (`varne@futureinvest.info`) JÄÄB — kasutaja otsus
  23.09: klapib repos olevate imporditud lepingute PDF-idega (auditi #5 suletud).
- **v=489 — UX-testi jäägid.** Kõik natiivsed `confirm()`-id → `askConfirm(msg, okLbl)` (Promise, `.cfm` modaal,
  Esc/taust = loobu, Enter = kinnita; käsitlejad on `async`), „Lähtesta demo" → `askReset()`. Riskiraport:
  müügitulu tulbad (`rkYears`, `.rky*`) eemaldatud, majandusnäitajate tabel on ruudustikus nende kohal (`.rk-e`).
  Operaatori läbirääkimispaanis kiibid „Ettepanekus: Hind / Parkimiskohad / Rendiperiood" (`.nego-jump`,
  `[data-jump]` → keri + `.jump-flash` + fookus); mustrid on kitsad (tagatise „3 kuu üürilt" ei anna vastet).
  Kehtival lepingul paanis toimingud + allkirjad ENNE punktide ajalugu. Suhtluses vastamata lõim ≥ 3 p →
  „ootab N p" (`.sl-age`). Poolte kaardil e-post murdub `@` juures (`<wbr>`).
  **Kontrollitud:** kõigi klientide aadressid klapivad äriregistriga (UX-leid V12 aadressi osa ja auditi #27 olid ekslikud).
- **v=488 — pakkumuse viisard 3 sammuks.** „Ülevaade" samm eemaldatud (kordas mustandi lehte): 3. sammu nupp
  „Loo pakkumuse mustand" (`#w-finish`) loob pakkumuse kohe. Rendiperiood (vaikimisi `WIZ.months` 60) valitakse
  MUSTANDIS pinnatabeli all parkimiskohtade kõrval (`.period-in`, ainult `canEditPrice`; muidu tekst) — muudatus
  käib `mutate` kaudu, versioonidiff näeb „Rendiperiood". `.wiz-review`/`.wiz-side` stiilid eemaldatud.
- **v=487 — UX-testi parandused** (`demo/UX-KOKKUVOTE.md`/`.html`, pildid `demo/ux-test/`). Agent vastab portfelli
  ANDMETEST (`agentKdAnswer` tähtajad, `agentVabadAnswer`, `agentTaituvusAnswer`), tundmatule → `agentFallback`
  (näidisküsimused); pakkumust alustatakse ainult selge verbiga (loo/koosta/tee … pakkum), kliendita küsitakse
  „kellele"; `AG_SPEED` 0.15 (animatsioon ~0,5 s); uus küsimus luba ootava toimingu ajal jätab selle tegemata,
  jooksu ajal läheb `AGENT.queue`-sse. Täituvuse ajalugu arvutub hõivetest (`taituvusAjalugu`/`pindHoivesKuupaeval`,
  seemne massiivid `TAITUVUS_AJALUGU`/`taituvusAjalugu` on nüüd kasutamata). `fmtShort` lisab aasta, kui ≠ jooksev;
  avalehe võtmekuupäevad sorteeritud, möödunu `.kd-date.past` „· möödas". Allkiri on KAHEPOOLNE: `l.allkirjad`
  = [üürileandja|null, üürnik|null], `Kehtiv` alles kahe allkirjaga, juhtriba „Ootab üürnikku/üürileandjat";
  üürileandja allkirjastaja = Tarmo Sepp (oli „Margus Varne"). Faktimuutuse diff-kirje: `rebuildPohi(l, {noLog})`
  + üks kirje „Tarmo Sepp (üürileandja) · kinnitas …". Lisa 3 sõnastamine on PAANIS (`npDetail` eriEdit,
  `eriAI`/`eriOK`), dokumendis sõnastamisel eritingimus loetav, `toLisa3` ei keri (`LEP_SEL_PUNKT`).
  Viisardi riskisamm näitab avaandmete tulemust kohe (`riskPohjus` = „KESKMINE, sest …"), vahelejäetud samm
  `stepperHTML(…, skip)` ilma linnukeseta; riskiraporti skaala „0 · kõrge risk / madal risk · 100" + põhjus;
  `CLIENTS[].risk.kuupaev` nihutatakse (`shiftStoryDates`). Korduste eemaldus: lepingu ülarida ilma versioonita,
  dokumendi päise olekumärk maha, vihjed (`coachFor`) peituvad pärast esimest renderdust, „Kolm teed edasi" maha,
  paan ei korda muutmata punkti teksti, lahtise arutelu korral ainult „Lahenda", kliendi otsusekaardi
  „Alusta läbirääkimisi" peidus kui kast lahti, ühe objektiga Ülevaates „Objektid" plokk maha, kliendile
  „Muudatused" alles siis, kui on muudatusi. Rollinupp ainult pakkumuse/lepingu vaates (`body.role-ctx`),
  paanis 88 px alumine ruum; rollivahetus kerib üles ja kustutab teated; kliendi murupuru „Minu dokumendid ›".
  Paigutus: murdepunkt 1440 (oli 1280), 1440–1519 px paan 340 + polster 24 (täis-A4). Mobiil: olekurajal
  ainult hetkesamm sildiga, `.cl-layout > * { width:100% }`, `.doc` kerib tabelit, teemalüliti sahtlis (`.sb-theme`).
  Vale kliendi ID → `notFound`. Imporditud lepingu päises `.imp-next` (järgmine sündmus).
  (Otsused tehtud v490-s — vt ülal.)
- **23.09.2026 — korrastus pärast kaustade/seadmete vahel liigutamist.** Töökoopia = HEAD (v486),
  `main` tõmmatud fast-forwardiga samale commitile (varem 29 commiti maas). `demo/AUDIT.md` (22.09
  audit, v485 → parandused v486) on nüüd repos; lahtised auditi punktid (#13 CSS-i ülekirjutuskiht,
  #14 A4 murdepunkt 1280 vs ~1514 px, #16–#21, #27) ootavad otsust. `demo/lisad/T6B_parkimisskeem.pdf`
  on nüüd vektor-versioon (88 KB, endine 3,3 MB raster „P_29_parkimine"). `demo/design-system/`
  (TEISE koopia hele/petrooleum kujundussüsteem, kuskil viitamata) läks `_arhiiv/`-i.
  `demo/README.md` kodeering parandatud (oli cp1257-mojibake) ja faililoend ajakohastatud.
  `.gitignore` sai `.claude/` ja `~$*` (Office'i lukufailid).
- **v=486 — auditi parandused** (`d98a707`): `escH` katab `& < > " '` ja ~40 renderduskohta on escape'itud,
  `plainIn()` puhastab lühiväljad sisestamisel; puuduv `openLepingPunkt` lisatud; `save()` salvestab
  `KEY_DATES`-i (`keyDates`); „Lähtesta demo" puhastab ka `thinkone_seaded` + `thinkone_notif_read`
  (võtmed tuletatakse `COMPANIES`-ist); `DB.save` hoiatab täis localStorage'i korral; `fmtISO()`
  asendab `toISOString()` (UTC-nihe); `migratePunktid()` tagab `p.muudatused` massiivi; petrooleumi
  ja valge-helgi jäägid tokeniteks (`--hl-top`). Detailid: `demo/AUDIT.md`.
- **v=485 — riskiraport PÄRIS avaandmetega + lepingu lõpetamine ja arhiiv** (`54c2256`): `riskiandmed.js`
  genereeritakse `tools/riskiandmed.py`-ga; `l.sulgemine` (akt → üürniku kinnitus → lõpparveldus),
  arhiveeritud leping on kirjutuskaitstud (`lepSigned`/`lepArh`). Reeglid CLAUDE.md-s.
- **v=463 — pakkumuse versioonid ja muudatused** (`07d2b9f`): iga saatmine salvestab versiooni,
  päises „Muudatused · N" (sama modaal kui lepingul), üürniku otsusekaardil „Uuendatud · vN" + eelmine
  hind läbikriipsutatult; parkimiskohtade arv muudetakse ainult üüripindade plokis; lisasid saab
  eemaldada/lisada (Lisa N) ja need kanduvad lepingusse; üleslaaditud PDF-id avanevad eelvaates.
- **v=454 — ootamise juhtkaart juhtivaks, „Vaata üürnikuna" juhtribalt maha.** Kasutaja: nupp pole
  oluline (rollivahetus on püsinupp all paremas nurgas, `.role-tab`) ja info peab juhtima. `bar()` sai
  viienda parameetri `meta` ja lisab `wait`-olekus märgutule; `.g-live`/`.g-meta` stiilid on nüüd üldised
  (`.guide .g-live`), ootamisel merevaigune `wait-pulse`. Tekstid ütlevad, MIS JUHTUB JÄRGMISENA: „Lisa N
  (n punkti) on üürnikul kinnitada. Pärast kinnitust ilmub siia allkirjastamise nupp" + meta-rida
  (kellele saadetud, et leping kehtib muutmata kujul kuni Lisa N allkirjastamiseni). `asClient` kustutatud.
- **v=453 — keritud riba on dokumendist laiem.** `.lmeta.stuck` saab `margin-left/right: -18px` (`.view`
  polster on 36 px, seega mahub) — riba 830 px vs dokument 794 px, mõlemal pool 18 px üleulatust. Nii loeb
  ta dokumendi KOHAL hõljuva ribana ega sulandu lepingu servajoonega. Marginaal on üleminekus kaasas.
- **v=452 — faktiribale pind, keritult ka üürnik.** Uus fakt „Pind" (nimi + tüüp) on alati. Üürniku
  nimi (`.lm-co`) on peidus `max-width: 0; opacity: 0; margin-right: -28px` (viimane sööb flex-vahe) ja
  ilmub sujuvalt ainult `.lmeta.stuck` all — üleval seisab sama nimi juba `h1`-na, seega dubleerimist ei teki.
- **v=451 — allkirjastamine popupis, paanis ainult nupp.** `signPanel` (dokumendid + meetod + nupp
  paremas paanis) asendus `signModalHTML` + `openSign()`/`closeSign()`-iga: juhtribal on ainus nupp
  „Allkirjasta leping", modaal (`.signpop`, z 75 — dokumendi eelvaade z 80 avaneb selle PEALE) hoiab
  allkirjastatavate dokumentide loendit, meetodivalikut (`.m-btn`) ja kinnitust (`#do-sign` → `doSign`).
  Sulgub Esc-iga, taustaklõpsuga, ristiga ja allkirjastamise lõpus (`closeSign()` enne `router()`).
- **v=450 — ootemärguanne lõime jätkuks (v444 merevaigune kast tagasi pööratud).** Kasutaja: „AI slop".
  `.th-wait` ei ole enam hoiatuskast: katkendjoonega VARI-MULL üürileandja kohal (maja-ikoon rõngas),
  pealkiri + kolm kirjutamispunkti (`.th-dots`, 1,5 s hüpe 0,18 s vahega) ja aeglane madala kontrastiga
  helk üle kaardi (`::after`, 3,6 s). Taane 32 px = sama, mis vastusemullidel, nii et ta seisab lõime sees.
  Tähelepanu tuleb liikumisest, mitte värvist; `prefers-reduced-motion` seiskab mõlemad animatsioonid.
  Samas versioonis: `.np-row` viiteveerg `minmax(44px, auto)` + `.np-ref` max 86 px ellipsiga — pikk
  viide („Lisa 3 · p1") kattis varem pealkirja.
- **v=447/449 — faktiriba kleebib ülariba alla.** `.lmeta { position: sticky; top: var(--hd-h) }`,
  z-index 15 (ülariba 20, paan 18). Keritud olekus lisab globaalne scroll-kuulaja (sama, mis juhib
  `#doc-top` nuppu) klassi `.stuck`: väiksem polster, vari, ülaserv sulandub ülaribaga (ümarad nurgad
  ainult all). Lävi loetakse elemendi enda arvutatud `top`-ist, mitte `--hd-h`-st. NB: klassi lülitus
  käib `requestAnimationFrame`-is — taustavahekaardis (brauseriautomaatika) see throttle'itakse ja
  klass uueneb alles esimese renderduse järel; päris vaates on korras.
- **v=445/446 — Tehing ja Lisad paanist päise faktiribale.** Kasutaja: paan peaks olema toimingute jaoks.
  Uus `leaseMetaBar(l)` (`.lmeta`) seisab `.page-head` all igas olekus ja mõlemal poolel: neli fakti
  (üür kuus · tähtaeg/kehtib kuni · üleandmine · tagatis) + dokumendikiibid. Kehtival lepingul kiibid
  VALIVAD keskmises veerus näidatava dokumendi (`lepDoc`/`LEP_DOC_SEL`, aktiivne = tume tindikiip);
  mujal avavad modaali (`openPdf` / `openLisa3` / `openLisaN`). Paanist eemaldatud: Tehing-kaart,
  Lisad-kaart ja `dokumendidCard`. Surnud koodina kustutatud `dokumendidCard`, `dpGlide`/`DP_GLIDE`
  ja `lepStatRow`; `signCard` ning `signPanel` ei korda enam numbreid.
- **v=444 — „Ootab üürileandja vastust" märgatavaks.** Vaikne hall `.th-wait` kast luges märkamatuna
  (kasutaja pilt). Nüüd sama merevaigune keel kui ootejärgul: vasak värviserv, ikoonketas, rasvane
  pealkiri + selgitusrida (`.th-wait-s`) ja pulseeriv märgutuli (`.th-wait-d`, austab reduced-motion).
  `margin-top: 14px` hoiab ta eelmisest mullist lahus. Kasutuses kahes kohas: punkti lõime jalam ja
  pakkumuse kliendivaade.
- **v=441/443 — kogu lepingu diff ühe klõpsu kaugusel.** `openLepDiff(id)` avab `#pdfmodal`-is
  `lepDiffHTML(l)`: kokkuvõtteriba (muudetud punktid · eritingimused · ülekirjutused · ringid),
  ÜKS lüliti „Muudatused / Mall / Kehtiv" (`LEP_DIFF_MODE`, `bindDiffTabs`) ja plokid — punkti
  sõnadiff + muudatuste ajalugu (`VIIS_LBL`), Lisa 3 eritingimused ülekirjutuse märkega, Lisa N ringid
  lingiga `openLisaN`. Sisenemispunkt on `.page-head` paremas servas (igas olekus, ka Kehtiv/
  Allkirjastamisel, kus dokument on A4-lehtedena ja `.doc-head` puudub) — TEIST nuppu ei lisata.
  `rebuildPohi` kirjutab nüüd faktimuutuse punkti ajalukku (`viis: "fakt"`), muidu poleks hinna- ja
  tähtajamuutus koondvaates nähtav (tekst järgneb vaikselt malli sõnastusele). Modaali ülarea silt
  käib sisuga kaasa: `pdfKind()` (#pdfkind index.html-is).
- **v=440 — lõime jalamilt aktsepteerimisnupp maha.** Lahendatud punkti lõimes oli `#acc-inline`
  („Aktsepteeri leping — liigu allkirjastamisele"), mis vaid klõpsas juhtriba nuppu `#cl-accept-all`.
  Kasutaja: nupp on üleval juba olemas. Jääb ainult INFO `.fin-cta` reana: „Kõik punktid on praegu
  kokku lepitud". Tegevus elab ühes kohas — juhtribal paani ülaosas.
- **v=437/439 — esmakordne vihje (coach mark) juhtriba juures.** `coachFor(id)` renderdab plokile
  järgneva selgituse (nool ülal), `bindCoach()` (kutsutakse `router()`-is pärast `route.init`) märgib
  selgitatava ploki `.coach-lit` rõngaga ja seob „Selge" nupu; sulgemine kirjutab id-i localStorage'i
  võtmesse `thinkone_tips` ja rida kokkub. Kolm vihjet `COACH_DEFS`-is: `juht-klient-leping` (üürnik
  avab saadetud mustandi), `juht-op-mustand` (operaatori Mustand V1), `otsus-klient-pakkumus` (üürniku
  otsusekaart pakkumusel). NB: klassinimi `.tip` oli juba hõivatud (hover-tooltip `data-tip` atribuudiga,
  styles.css ~2143) — uus komponent on `.coach` / `data-coach`, ärge nimetage tagasi. „Lähtesta demo"
  kustutab ka `thinkone_tips`, nii et demo saab vihjetega uuesti läbi mängida.
- **v=436 — arutelu lõpp ja ootejärg: kummitempel välja, lõpuriba sisse.** `.th-stamp` / `.th-verdict`
  (mono, kaldu, VERSAALIDES tempel kaardi nurgas) on KUSTUTATUD — kasutaja: „templid pole head, aga
  esile on vaja tuua". Asemel: (1) lahendatud arutelu lõpetab `.th-out` — täislaiuses riba värvilise
  vasaku serva, ikooniketta, otsusesõna (13,5 px, 700, staatusevärv), põhjenduse ja „Lõpetas …" reaga;
  värv staatuseperest (`ok` roheline · `info` sinine · `no` punane), laiem kui astmelised sõnumikaardid,
  nii et lõim lõpeb nähtavalt. (2) „Ootab kinnitust" EI ole enam otsus vaid elav olek: `.th-live`
  pulseeriva merevaigu punktiga seisab sõnastuse EES ja ütleb rolli järgi „Ootab üürniku/sinu kinnitust";
  kaardil merevaigust vasak serv (`.th-card.th-dec.wait`). Pulss austab `prefers-reduced-motion`.
  Paani grupipäis „Lahendatud · muudetud" → „Lahendatud ja muudetud" (vana luges nagu üks staatus).
- **v=434/435 — pinnavalik: filter ees + kompaktne detailne rida.** Mõlemas viisardis (hinnapakkumine
  `WIZ.step 3`, üürileping `LWIZ.step 2`) renderdab valiku üks jagatud komponent `spPicker(free, {attr, isSel})`
  + `spRowHTML` + `bindSpPicker` (app.js, `occupiedSpacesNote` kõrval). Filter (otsing · maja kiibid ·
  tüübi kiibid · loendur) ilmub, kui vabu pindu on üle nelja; filtreerimine käib DOM-is klassiga `.pk-off`,
  ilma uuesti renderdamata. Olek elab mooduli tasemel (`SP_FILTER`, `SP_SCROLL`), sest viisard renderdab
  end igal valikul uuesti — nii püsivad nii filter kui kerimiskoht; `spFilterReset()` viisardi avamisel.
  Rida on üherealine veerustik (nimi+tüüp+maja · m² · €/m² · parkimine/elekter · üür): 80 px → 49 px,
  11 pinda 880 px → 539 px, nimekiri ise `max-height: min(46vh,430px)` (u 8 rida korraga), nii et
  viisardi nupud jäävad nähtavale. ≤900 px kaherealine grid (`grid-template-areas`), €/m² ja lisad teisel
  real. Pakkumuse „+ Lisa pind" nimekiri sai samuti kõrguslae. Kasutatav abifunktsioon: `spEsc` (`escHtml`).
- **v=433 — kontoloome samm pakkumuse aktsepteerimiselt maha.** Kliendi „Aktsepteerin pakkumuse" viis
  varem lahti vormi `#cl-konto-area` (esindaja, isikukood, e-post, telefon) ja alles „Loo konto ja
  aktsepteeri" muutis oleku. Nüüd aktsepteerib üks vajutus kohe (`#cl-accept` → `mutate`), `cl.konto`
  väli enam ei teki (teavituste meiliaadress kukub tagasi `c.epost` peale, `c.konto` lugemine jäi
  ühilduvuseks alles). Operaatori „Ootab kliendi otsust" tekst uuendatud: konto tekib alles lepingu
  allkirjastamisel. Spets 7.2 kirjeldab veel vana voogu — spetsifikatsioonifaili ei muudetud.
- **v=432 — kommentaarid KÕIKJAL paremas paanis.** (1) Pakkumuse läbirääkimised (`negoPanel` + ajaloo
  voldik `negoHist`) kolisid dokumendi veerust `.cl-side` ülaossa, „Teie otsus" / kokkuvõttekaardi kohale;
  CSS-i lisatud kitsam variant (`.cl-side .nego-panel`, `.cl-side .nego-body`, `.cl-side details.nego-hist`).
  (2) Kehtiva lepingu punktilõim käib nüüd samuti paanis: `#np` renderdub KÕIGIS olekutes, `openClause` ja
  inline `.clause-expand` on kustutatud, `gotoClause(id)` = `selectPunkt(id, {scroll:true})`, `[data-ecmt]`
  avab paani. Muudatusringi vorm (Lisa N) elab paani lõimes. Kontrollitud brauseris: pakkumus operaatori ja
  üürniku vaates, lepingu mustand, kehtiv leping muudatusrežiimis; konsool puhas.
- **v=431 — juhtriba SAADETUD-signaal.** Operaatori vaates olekus „Saadetud" ei kasuta juhtriba enam vaikset
  `wait`-varianti (kasutaja: märkamatu), vaid `sentBar()`-i: hele saatmisikoon (`.guide.sent .g-ic`), silt
  „SAADETUD ÜÜRNIKULE", pulseeriv sinine märgutuli (`.g-live`), metarida `Saadetud <aeg> · <versioon> ·
  <üürniku kontakt>` ja „Vaata üürnikuna" nupp. Saatmise aeg salvestub `l.saadetud` väljale `.send-draft`
  käitlejas. Prisma-helk jääb ainult „sinu kord" olekule.
- **v=429–430 — ÜKS KESKTELG: omnibox JA sisu külgriba ja paani vahelises alas.** Dokument tsentreerub
  `.main` sees (`margin-inline: auto`), omnibox nihkub `body.has-panel .omni-center { margin-right: var(--panel-w) }`
  võrra (ülariba grid `1fr auto 1fr` → keskmine veerg poole paani jagu vasakule); ≤1280 px tühistatakse.
  Lisaks v429-st: ülariba polster sümmeetriline (0 26px) ja „Uus" nupp `position:absolute` omniboxi kõrval
  (≥1281 px, mitte avalehel/portaalis), et otsingupill ise oleks keskteljel.
  Mõõdetud: 2560 px → omnibox ja dokument mõlemad 1199 (õhku 554/554); 1420 px → mõlemad 634.
  ÄRA proovi akna-keskjoondust (v427) ega vasakjoondust (v425) — mõlemad said tagasi lükatud.
- **v=427 — dokument AKNA keskteljel.** Teekond: v424 keskel paanist vabas alas (kasutaja: „ei ole keskel",
  sest 1440 px ekraanil täidab A4 kogu vaba ala) → v425 vasakule (võeti tagasi) → v426 revert → v427.
  Nüüd nihkub `body.has-panel .view` `50vw - a4/2 - 36px - sb-w` võrra; min/max hoiab veeru paani alt
  eemal. Murdepunkt 1100 → 1280 px, sest kitsamal ekraanil jääks dokument 400 px paani kõrval liiga kitsaks.
- **v=424 — PAIGUTUSREEGEL (vt CLAUDE.md):** paan akna paremas servas (fixed), sisu keskel, dokument A4
  (`--a4`). Vana `.cl-layout` grid (`1fr 300px` / `.cl-nego 1fr 380px`) on asendatud; `.cl-nego` klass
  jäi markupisse tähistuseks, aga laiust enam ei muuda. `.view` kitseneb dokumendivaadetes A4 + 72px
  peale, et päis, olekurada ja dokument oleksid ühel joonel.
- **v=423 — TUME TEEMA (kardinaalne kujundusvahetus, codedvisuals.com eeskujul).** Kogu palett elab
  `styles.css` tokenites: `:root` = tume, `[data-theme="light"]` = hele (vt CLAUDE.md disainikeel).
  Komponendireeglid on tokenipõhised — värvi ei kirjutata enam reeglitesse. Erandid, mis jäid teadlikult
  literaaliks: `--stone` märgise tekst (`#fff`), prindivaade (`body`/`.sheet` valge + must tekst),
  PDF-vaaturi taust. Filmitera (`body::after`) on `display:none` — tumedal lõuendil luges mürana.
  Teemalüliti: ülariba `#theme-btn` → `toggleTheme()` app.js-is.
- **v=422 (17.09.2026):** `doSign` allkirja aeg oli `NOW_EE() + " 14:05"` → topelt kellaaeg („… 19:28 14:05") lepingu
  allkirjaplokis; nüüd `NOW_EE()`. Sama muster on veel suhtluse vestluses (`vestlus.push … NOW_EE() + " 11:0…"`), parandamata.
  PDF-eksport: headless Chrome `file://` + `leaseSheetHTML` + `lisa3SheetHTML` + `@page A4` → `Page.printToPDF`
  (Lisa 1/2 on eraldi PDF-failid, eksporti ei liideta).
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


## 26.09.2026 (v=622–626) — „DEMO 3" ON UUS ALUS

- Kasutaja: kaustas `demo 3/` on väga hea versioon → `demo/` kirjutati selle sisuga üle (robocopy /MIR, 0 kustutatud faili;
  app.js/data.js/styles.css/index.html baidi kaupa identsed). `demo 3` on meie v621 edasiarendus; `demo 3/` jääb lähtekoopiaks.
- **v622 import lepingu kaupa:** laud rühmitab failid toimikuks (leping + lisad + kaasdokumendid), ülevaatus samm-sammult,
  tulemus + portfelli tervis; tekstikihita PDF → Tesseract.js (eesti keel, cdn.jsdelivr.net, laetakse vajadusel) — sõnakastid
  annavad samad ankrud ja kindluse; allkirjad XAdES-ist koos meetodiga (ID-kaart / Mobiil-ID / Smart-ID), ajatempel;
  kinnitamine ka hulgi tagasivõetav; impordis kinnitust ootavad lepingud registris veel ei paista. Imporditud lepingu vaates
  „Impordil parandatud" rida ja väljaspool platvormi allkirjastatud lisa sidumine.
- **v623 „Alusta · 10 minutit":** uus ettevõte „Uus konto" (`COMPANY_ID === "uus"`, tühjad massiivid, `OBJEKT` = `obj-none` kohatäide,
  esimene kinnitatud hoone saab OBJEKT-iks); `#/alusta` 4 sammu (äriregister → EHR → pinnad tabelist → impordilaud); `PINNAD_NAIDIS`
  (data.js) annab T6B pinnad CSV-na; tühjal kontol ütleb iga põhileht, kus seadistus pooleli on; klientideta kontol klientroll
  langeb operaatoriks.
- **v625:** kalender ajajoonena uue kujuga (kuupäev · selgroog · sündmus · aeg · nool, „Täna" joon, 30 päeva telg); osapoole leht
  (päis + kolm arvu, juhtkaart reana, dokumendid, tähtajad ajajoonena, arhiiv; paremal kontakt · allkirjastajad · riskiraportid);
  avalehe tegevused kasutavad Kord-märki (`v625-k2`), osapoole seis = riskitase (`v625-k3`).
- Uued viitefailid kaustas (rakendus neid ei lae): `pdf.css`, `muudatused.html`, `MVP DESIGN.docx`, uuendatud `kujundus.html`;
  `lisad/T6B_parkimisskeem_uus.pdf`; `.claude/launch.json` (python http.server 8765).
- Kontrollitud (headless Chrome): kõik põhivaated + Uus konto `#/alusta`, 0 konsoolivea.
- **v627–628 (kasutaja):** ülevaatuses „Kinnita leping ja järgmine" ei näita enam 0,9 s vahekaarti (`IMP_UI.tehtud`), mida ei
  jõudnud lugeda — liigub KOHE järgmise toimiku juurde ja selle paani ülaossa jääb kviitung (`IMP_UI.kviitung`, `irKviitungHTML`):
  „Eelmine: <nimi>" · LEP-id · registris · pind · tähtajad · „Ava" · „Võta tagasi" (`impKviitungTagasi` → `impTaasta`). Kviitung kaob
  järgmise otsusega (`impOtsus`, `impJata`) või uue kinnitusega; ühe kinnituse eraldi toasti enam pole (hulgikinnitusel jääb).
- **Claude Designi katsepakk (`demo/design-system/`):** `tokens.css` (kaks tokeniplokki muutmata), `components.css` (215 reeglit —
  ainult need, mis katse komponentidele demos rakenduvad, algses järjekorras; valitakse brauseris `el.matches`-iga, teemaatribuut
  ja pseudoklassid maha võetud), `previews/` 7 lehte (Värvid, Kiri, Neli märki + sakid + külgriba, Nupud, Portfelli kaart, rida,
  Juhtkaart) mõlemas teemas päris märgendusega, esimene rida `<!-- @dsCard group="…" -->`. Generaator `tools/` (ei lähe üles).
  **Sünkitud (26.09):** Claude Designi projekt „ThinkOne demo" (https://claude.ai/design/p/9ae0e3de-c685-4f5d-8701-91d8d7a4e735).
  Kuju „tokenid + CSS-klassid": tühi `_ds_bundle.js` (0 komponenti), `_ds_bundle.css` = kogu demo `styles.css`, kaardid
  `guidelines/cards/`, README = `.design-sync/conventions.md` (klassisõnavara agendile). Ehitus `tools/bundle.mjs`, märkmed `.design-sync/NOTES.md`.
## 25.09.2026 (v=617–619) — 3. MIGRATSIOON STEVENI DEMOST: kalender ajajooneks (2.5)

- Loendivaade on AJAJOON: üks pidev selgroog (`.kal-aeg::before`) läbi kõigi kuude, iga rea ees täpp (`.kal-tl-p`):
  täidetud merevaik = vajab otsust, tühi ring = rakendub ise (`kalIse`: indekseerimine, katseaeg, tagatise korrigeerimine).
  Möödunud read (`.moodas`) tuhmuvad. Rühmad on kuude kaupa (varem „See nädal" + aastad); kuu pealkiri kleepub ülariba alla
  (`.kal-kuu-h` sticky, vasak riba läbipaistev, et selgroog ei katkeks).
- Üleval kaart „Järgmised 30 päeva": kuni 4 lähimat tähtaega (päevi jäänud · ikoon · tüüp + objekt · kuupäev · olek) + legend;
  klõps kerib ajajoonel sama sündmuseni ja avab selle detaili.
- Sündmuste sisu jäi põhidemo omaks (rida, indekseerimise arvutus, avanev detail, tüübi- ja objektifilter). Kuuvaade muutmata.
- **v620–621 (kasutaja):** ajajoone real üldine reajoonte-hover (`.kal-row::after`, nurkades jooned) maha — hover = valge kaart
  (`--surface` + vari, raadius 12); avatud sündmus = rida + detail üheks kaardiks, detail joondub tekstiveeruga, peen joon vahel,
  sisu max 620 px; täpi rõngas järgib tausta.
## 25.09.2026 (v=607–612) — 2. MIGRATSIOON STEVENI DEMOST: osapooled · arhiiv · neli märki · üks kaardimudel

- **Neli märki (2.3)** — üks visuaal ühe tähenduse kohta: Seis = `pill()`, Kord = `kordMark(minu|teine|ok)` (ooker/hall/roheline täpp),
  Lugemata = `lugemataMark(n)` (sinine täpp + arv), Arv = `arvMark(n)` (`.mk-arv`, asendas `.count`/`.tb-n`/`.pf-n`/`.offer-filter-count`).
  Kord on kaardil, real, juhtkaardil (`juhtriba`/`juhtribaSulg` „g-kes") ja osapoole lehel. Lugemata = teise poole sõnumid
  (lepingu `arutelud`/`sonumid`, pakkumuse `labiraakimised` + `kliendiEttepanek`) uuemad kui dokumendi avamine
  (`dokLoetud`, localStorage `thinkone_loetud`); külgriba „Suhtlus" näitab lugemata arvu.
- **Üks kaardi-/reamudel (2.4)** — `pfMudel(r)` / `osapoolMudel(p)` → `kaartHTML` / `ridaHTML` / `pfLoendHTML`; järjekord alati:
  nimi + seis · tunnus + ese · raha · aeg · järgmine samm (`pfSamm`: Kord + lause + kiirtee). Lepingud, pakkumused ja osapooled
  kasutavad sama loendit (kaardid/read, `thinkone_pf_mode`). **Järjesta** (`thinkone_pf_sort`): Viimased ees (`pfViimaneMs` =
  audit + sõnumid + allkirjad, mitte loomise kuupäev) / Tähtaeg lähemal (`pfTahtaeg`: võtmekuupäevad, kehtivus) / Nimi; „sinu kord"
  alati ees. Veerupäiste sort eemaldati (kasutaja), filtrid (Ese, Seis) jäid. Vana `offerTableHTML`/`View.pakkumised` ja surnud
  `pfNextStep`/`pfExpand*`/`pfPreview` eemaldati.
- **Arhiiv (2.2)** — `ARH_OLEKUD` = Lõppenud · Ennetähtaegselt lõpetatud · Asendatud · Tühistatud; `arhiivInfo(r)` → miks + järglane;
  `arhiivLoend` ridadena aasta kaupa. Sisu AINULT päris andmetest (kasutaja): imporditu tähtaeg möödas (`impArhiivis`, järglane =
  hilisem leping samal pinnal), lisaga üürniku vahetus (`x.eelmised`, nt Rataskaevu → Bombay = „Asendatud" → järglane), lõppenud
  pakkumused (portfell › pakkumused › Arhiiv). Imporditud lepingu vaates arhiivi/üürnikuvahetuse märkus.
- **Osapooled rollidega (2.1)** — `osapooled()` tuletab dokumentidest (leping, pakkumus, tööleping, import); rollid üürnik ·
  töötaja · teenusepakkuja; alamvaated Kõik/Üürnikud/Töötajad/Teenusepakkujad/Arhiiv (endised). Leht `#/osapool/<id>`
  (vana `#/klient/` suunab): juhtkaart (järgmine samm, sh riskiraport puudub/vana) → Dokumendid (kaardid) + Arhiiv (volditud) →
  Kontakt · Allkirjastajad (dokumentidest; üürniku poolelt mitu allkirjastajat = „ühine esindusõigus") · Riskiraportid · Tähtajad.
  Loomisnuppu pole („+ Loo › Klient" eemaldati). Riskiraportita osapool: `View.risk`/`riskInline` näitavad märkust.
- **v614 (kasutaja):** Seis-veerufilter eemaldati; „Ese" (tüüp + allikas) on tööriistareal Järjesta kõrval (`pfEseBtnHTML`,
  sama koht kaardi- ja reavaates); tabelipäis on puhas tekst, `.pf-colbar` kaartide kohal kadus. Parandus: lisa üürimuutus
  (`impRakendaLisa` → m.hind) luges „182,4 m²" valesti → üür 0 (WiSo); impordi rea m²/hind tuleb `pindIds`-ist (Evecon P7 vs P15).
## 25.09.2026 (v=595–599) — LEPINGUTE IMPORT (1. migratsioon Steveni demost), PÄRIS lugemisega

- Allikas: Steveni `import.js` voog (laud → ülevaatus → tulemus). Tema versioonis oli „lugemine" simuleeritud (väljad käsitsi
  seemnes); meil loetakse PÄRIS faile kaustast `Üürileping/` (61 faili: .asice, .pdf, .docx). Kood elab app.js-is plokis
  „LEPINGUTE IMPORT (v595)" (uut faili ei tulnud), CSS `.ix-*`.
- Lugemine brauseris: `.asice` = ZIP → `zipLoe` (DecompressionStream, ilma teegita); PDF-i tekstikiht pdf.js-iga
  (cdnjs 3.11.174, laetakse ALLES impordil — kasutaja kinnitas); DOCX = `word/document.xml`. Allkirjastajad XAdES-i
  sertifikaadist (eesnimi + perenimi, isikukoodi ei loeta) + allkirjastamise aeg.
- Tuvastus T6B malli siltide järgi (`impParsiLeping`): üürnik + reg.kood, pind (2.1 või failinimi), m², parkimiskohad,
  üleandmine, üür, tagatis, tähtaeg (üleandmisest / allkirjastamisest), otstarve, esindajad, allkirjad. Lisad
  (`impParsiLisa`): „N. Pooled lepivad/soovivad …" punktid + mõjud (PT 5.1 periood, PT 1.2 uus üürnik, PT 2.2 parkimine,
  üür, ennetähtaegne lõpp) → rakenduvad lepingule. Muud: garantiikiri, akt, volikiri, skann (tekstikihita).
- Kahtlused (`impKahtlused`): m² ≠ register, pind failinimest, parkimiskohad ≠ maja jaotus või arv ≠ numbrid, üks allkiri,
  registrikood ≠ 8 kohta, pinnal leping/pakkumus/teine üürnik. Duplikaat → „Ei impordita" (nt Maru P29 = seemne LEP-2023-029).
- Päris leiud: P10–12 (3 kohta vs jaotuses 6), P24 (76–79 → Lisa 4: 83, 86, 87), B1–B2 jaotus erineb, P28/B3/Maru koopia
  üks allkiri, Titancompany reg.kood 9-kohaline, Rändtsirkus lõpeb Lisa 4-ga 31.01.2027, P14 üürnik → Bombay Group (Lisa 4).
- Ülevaatus: originaal A4-na keskel (pdf.js lõuend + esiletõstud `ank`: roheline = leitud, ooker = kontrolli; Word tekstina),
  paan paremal (1 Osapool · 2 Seos · 3 Põhitingimused, „Õige"/„Paranda", „Kinnita"). „Kinnita N valmis" teeb hulgi (lepingud
  enne lisasid). Tulemus: koondatud „Portfelli tervis".
- Kinnitus → IMPORDITUD-kirje (seemne kuju + `kood`, `registrikood`, `clientId`, `pindIds`, `imp: true`), pind saab üürniku,
  uus osapool CLIENTS-i (`impUus`), KEY_DATES „Lepingu lõpp". Salvestus: `imported`, `impClients`, `importFailid`
  andmevõtmes; originaalid IndexedDB „thinkone_import" (`openPdf('idb:…')`); „Lähtesta demo" kustutab. Päris andmed jäävad
  ainult brauserisse — repos neid pole.
- Demo lood (PAK-003/007/009/011/014, LEP-2026-001) on taas pindadel 2, 4, 5, 6, 22 — ainsad, millele päris lepingut pole
  (`SPACES_SEED` t6b-2026-09-25b, salvestise migratsioon kolib v592–594 seisust tagasi).
- Sisenemised: „+ Uus › Impordi lepingud", avalehe kiip, Portfell › Lepingud „Impordi".
- **v600–601 (kasutaja):** pinna kahtlusel on „Õige"; käsitsi muudetud pind (`seos.muudetud`) = kasutaja otsus → failinime
  märkus kaob, m² kontroll (leping vs valitud pinnad) jääb; kõik pinna põhjused ühes märkuses. Parkimisel „Lepingus õige" +
  „Maja jaotus" (üks klõps, `impOtsus(id,k,false,väärtus)`); numbrite sisestus ainult siis, kui arv ≠ loetletud numbrid.
  Märkus näitab otsust („Maja jaotuse järgi" / „Parandatud käsitsi"); originaali esiletõstud värvuvad otsuse järgi.
- **v602 (kasutaja): pinna olek tuleb DOKUMENTIDEST.** Seemnes on lepinguta pinnad „Vaba" (28 tk, varem t6b.ee järgi „Üüritud");
  „Üüritud" on ainult lepinguga pind (LEP-2026-001 Pind 4, seemne import Maru P29), pakkumusega „Pakkumusel". Import märgib
  pinna üüritud; `load()` taastab selle ka seemne vahetusel (`IMPORDITUD[].pindIds`). `SPACES_SEED` t6b-2026-09-25c.
  Lähtestatud demos on T6B täituvus ~7 % — import täidab maja päris lepingutega.
- **v603 (kasutaja): impordi laud** — oleku riba all tööriistariba: vasakul kokkuvõte (N faili loetud · valmis · vajab kontrolli ·
  imporditud · ei impordita, värvitäpid = riba värvid), paremal „Alusta ülevaatust" (`impAlusta` → `impJarjekord()[0]`) ja
  „Kinnita N valmis" (päisest ära). Grupid: Loen → Valmis kinnitamiseks → Vajab kontrolli → Imporditud → Ei impordita;
  ülevaatuse „järgmine" käib sama järjekorra järgi.
- **v604–605 (kasutaja): ülevaatuse paan** — päises liik + failinimi + allkirjad; sammud 1 Osapool · 2 Pind · 3 Põhitingimused
  näitavad olekut (roheline ✓ „korras" / ooker number „kontrolli"); üürnik ja pind ei kordu väljade loendis (nende kahtlused
  on oma sammu all). Väljad kahes veerus (silt | väärtus), kahtlusega rida ookris kastis, märkus + nupud täislaiusel (`.ix-fo`).
  Jalus: olekurida (⚠ N kontrollida / ✓ kõik kontrollitud) → „Kinnita" → „Jäta välja".
## 25.09.2026 (v=588–591) — pinna JAGAMINE üüriüksusteks (harv erijuht, ainult toiminguna)

- Objekti lehel pinna kaardil (hõljudes) „Jaga üksusteks" → külgpaneel (`openJaga`, `jagaDraw`, `jagaSalvesta`). Lubatud, kui
  `jagaKeeld(s)` on tühi: pole platvormi lepingut ega pooleli pakkumust, pole juba jagatud/üksus, pole laoboks.
- Kaks üksust (A/B). Kui pinnal on ≥ 2 põhiosa (olmealat arvestamata) ja jaotuse summa = üüripind: osad määratakse A/B-le
  (vaikimisi ladu → B, muu → A), ühisala jaguneb osade suhtes. Muidu jagamine pindala järgi (A m², B = jääk). Parkimiskohad
  pindala suhtes (klõps kiibil vahetab), elekter pindala suhtes; hind, olek (Vaba/Üüritud) ja üürnik üksuse kaupa.
- Salvestus: ema jääb alles (`staatus: "Jagatud"`, `jagatud: { alates, aeg, yksused, staatus, tenant }`), üksused on tavalised
  pinnad (`id` `<ema>-a/-b`, `emaId`, `alates`, sama `nr` ja plaan). Viimane üksus saab jäägi → summa = ema üüripind.
- Kokkuvõtted loevad `pindYksus` (ema välja): `objStats`, `ylScope`, registri hoonekaart, agent, omniotsing, parkimise
  vaikejaotus. Täituvuse ajalugu `yksusKuupaeval`: enne `alates` loeb ema (endise olekuga), pärast üksused.
- „Ühenda tagasi" (`jagaYhenda`) — ainult kui ühelgi üksusel pole lepingut ega pakkumust (ka lõpetatut, et viited ei katkeks).
- **v592 (kasutaja):** „Jaga üksusteks" ainult VABAL pinnal (`jagaKeeld`: `staatus !== "Vaba"` → keeld). Pinnad 2, 4, 5, 6, 22
  on seemnes vabad; demo lood kolisid sama suure pinna peale (olek + üürnik + vabanes vahetati): PAK-009 → Pind 11,
  PAK-007 / LEP-2026-001 (Killa) → Pind 27, PAK-003 → Pind 26, PAK-011 → Pind 23, PAK-014 → Pind 9 (vaba, mustand).
  `SPACES_SEED` = "t6b-2026-09-25" (vana salvestatud pinnastik asendub); pakkumused salvestises viitavad vanadele pindadele →
  „Lähtesta demo". T6B täituvus seemnes 84 % → 64 % (neli seni üüritud pinda on nüüd pakkumusel/vabad).
- **v594 (kasutaja):** jagada saab ainult pinda, millel on ≥ 2 põhiosa (nt ladu + kontor; olmeala ja ühisala ei loe) —
  `jagaKeeld` → `!jagaOsad(s)`. Pindala järgi jagamise režiim (A m² + jääk) eemaldati; Pind 2 (ainult ladu) pole jagatav.
- **v593:** `load()` kolib ka SALVESTATUD loo-pakkumused (id järgi: 009, 007, 003, 011, 014) ja neist tehtud lepingu uutele
  pindadele (sh `hinnad`/`graafik`/`parkimine` võtmed ja vaikejaotuse parkimiskohad) — vana pakkumus ei blokeeri enam vaba pinda
  ja lähtestamist pole vaja.
## 25.09.2026 (v=586–587) — parkimise VAIKEJAOTUS pindade vahel + pindade import T6B struktuuris

- **Maja jaotus** (`t6b-parkimine.xlsx`, genereeritud `p104_parkjaotus.py`-ga): `SPACES[].parkKohad` (34 pinda) + `PARK_ERI`
  (üldkasutatav: elekter 31,32,84,85 · inva 1,2 · reserv 49,62,63). Kokku 115 kohta, kõik kaetud. Pind 7 ja Pind 24: 4 → 3 kohta
  (xlsx järgi); xlsx Pind 19 + Pind 20 → meie ühine Pind 20 (66–69). `load()` võtab `parkKohad` seemnest ka vanadele andmetele.
- **Vaikimisi dokumendis:** pakkumus ilma `o.parkKohad`-ita kasutab `offerParkKohad(o)` = pinna kohad (`pinnaKohad`); `createLease`
  paneb `tehing.parkKohad` pinna kohtadest. Plaanivalijas „Pinna kohad" taastab vaikejaotuse; teise VABA pinna kohad (`pehme`,
  „Vaba pinna koht") on valitavad hoiatusega, üüritud/pakkumuses kohad mitte.
- `parkHoive` kihid: leping › imporditud › pakkumus › pinna vaikejaotus (üüritud pind = „Üüritud", vaba = „Pinnale määratud") ›
  `PARK_ERI` = „Üldkasutatav". Seemnes kõik kohad hõivatud/pakkumuses → registris „0 vaba" on õige.
- **Pindade import** (`objImportRow`, `OBJ_IMPORT_MALL`): päis `nimi;tüüp;üüripind;ladu;kontor;müügisaal;olmeala;ühisala;hind;elekter;parkimiskohad;staatus`.
  Kohustuslik nimi, üüripind, hind; osad → `jaotus`, tüüp/neto/koef tuletatakse osadest; `parkimiskohad` numbrid → `parkKohad`
  (arv = numbrite arv); staatus Vaba/Üüritud. Pinna vormis „Parkimiskohad (numbrid)", rea kokkuvõttes kohtade arv ja „üüritud".
## 17.09.2026 (v=421) — ÜHTNE PUNKTIMUDEL + läbirääkimiste PAAN (mustand → saadetud → allkirjastamine)

Kasutaja lähteülesanne: lepingu käsitlemine efektiivsemaks ja skaleeruvaks teistele lepingutüüpidele —
operaator võib muuta IGA punkti sõnastust (selge diff), iga punkti saab saata eritingimustesse, punktide
arutelu/kinnitamine paremas paanis, iga arutelu lõpeb selgelt. Otsused: hübriid põhitingimustel (faktid
struktuursed + sõnastuse ülekirjutus), ulatus Mustand V1→Saadetud→Allkirjastamisel (Kehtiv/Lisa N ja pakkumus
jäid tööle, UI muutmata), sõnatasemel inline-diff, sõnastab ainult operaator.

- **Andmemudel (leping):** `l.punktid[]` asendab `l.pohi`/`l.eri`/ULD_FULL-i otserenderduse. Punkt =
  `{ id ("pohi:P 3.1" | "uld:5.2" | "eri:<uid>"), osa, ref (eri: null — „Lisa 3 · pN" tuletatakse järjekorrast,
  `eriRef`), jaguNr, jagu, pealkiri, algne (mall/faktid), tekst (kehtiv), lukus, kirjutabYle (sihtpunkti ID),
  kirjutabYleTekst (pakkumuse vaba string, kui ei lahene), allikas, staatus/sonastamisel/aruteluId (eri),
  kontrolli (pohi: fakt muutus, sõnastus üle kirjutatud), muudatused[{aeg, autor, vana, uus, viis, aruteluId}] }`.
  `l.arutelud[]` asendab `l.kommentaarid`: `{ id, punktId, ref, algataja klient|operaator, autor, aeg, tekst,
  staatus Ootel|Ootab kinnitust|Lahendatud, lahendus muudetud|eritingimus|selgitatud|tagasi lükatud,
  lahendusTekst, lahendusAeg, sonumid[], ettepanek{tyyp, siht otse|eri|lisa3|ring, punktId, eriId?, tekst, algne, …} }`.
  `l.liik` (vaikimisi „Üürileping") valib `LEPINGUTYYBID` konfiguratsiooni (osad, pohiMall=pohiTehing, uldMall=ULD_FULL,
  faktid, kvRefs, lisad) — tuum (punktid/arutelud/diff/paan) ei tea m²-st ega üürist.
- **Abifunktsioonid** (app.js, factMark järel): `punktById/pohiOf/uldOf/eriOf/eriKinni/eriRef/punktRef(D)/kyLabel/kyOf/
  overriddenBy/sonastusMuudetud/kyParse/newEri/buildPunktid/createLease/migratePunktid`, diff `wordDiff/diffHTML/
  diffBlock/bindDiffTabs` (LCS, sõnad+tühikud, ~40 rida), arutelu `aruOpen/aruOotabOp/aruPill/LAHENDUS_LBL/aruOf/
  newArutelu/lahenda/muudaSonastus/toLisa3/eriKinnitusele`.
- **Migratsioon** `migratePunktid()` stardis (pärast `migrateRingFacts`): vanad localStorage-mustandid → punktid/arutelud,
  vanad väljad kustutatakse, üks audit-kirje „Andmemudel uuendatud". Idempotentne. Testitud v420-kujuga (scen2).
- **Faktimootor:** `rebuildPohi` uuendab pohi-punktide `algne`; kui `tekst === algne` järgneb tekst mallile, muidu
  `kontrolli = true` → paanis „Kontrolli sõnastust" (Võta malli sõnastus / Sobib nii), juhtriba loendab.
- **Dokument:** üks tsükkel `renderPunktid → renderOsa → renderPunkt/renderEri`; `data-clause` = punkti ID; `.sel` =
  paanis valitud; hover-nupud `.p-edit` (data-pedit) ja `.to-lisa3` (data-tolisa) igal põhi/üld-punktil; pillid
  Lahendamisel / lahendus / Sõnastus muudetud / Kontrolli sõnastust; `.overwrite` „kirjutatud üle: Lisa 3 · pN".
- **Paan `#np`** (`.cl-side`, laius 380 `.cl-layout.cl-nego`): `npItems` (Sinu kord / Ootab teist poolt / Lahendatud·
  muudetud) + `npDetail` (diffBlock või tekst, redaktor `#np-edit/#np-save/#np-cancel/#np-reset`, kontrolli-plokk,
  → Lisa 3, sõnastuse ajalugu, lõim). `selectPunkt(id, {scroll, edit})` sünkroonib dokumenti ILMA router()-ita;
  `gotoClause(id)` Kehtiv→inline `openClause`, muidu paan; `REOPEN_CLAUSE`/`nextOpenPunkt` ID-põhised.
  Lõim on jagatud: `threadCtx/thCardHTML/renderThread/bindThreadActions(root, l, punkt, rerender)` — paan ja Kehtiv
  inline-laiendus kasutavad sama koodi.
- **Sõnastuse muutmine:** Mustand V1 — paanis kohe (jälg `muudatused`, üld lukust lahti, audit). Saadetud — operaatori
  algatatud arutelu `Ootab kinnitust` + `ettepanek{siht:"otse"}`; üürnik näeb diffi, kinnitab/„ei sobi". Lahenda→
  „Muuda sõnastust otse" nüüd KÕIGIL punktidel (faktipunktil faktisisend nagu enne).
- **→ Lisa 3 = üks mehhanism:** loob eri-punkti `Sõnastamisel` (üürnikule nähtamatu) `kirjutabYle`=sihtpunkti ID.
  Mustand V1: `.eri-ok` avaldab. Saadetud: `.eri-ok` → `eriKinnitusele` (arutelu + `ettepanek{siht:"lisa3", eriId}`),
  üürnik kinnitab → Aktsepteeritud/lahendus eritingimus; „ei sobi" → eri jääb sõnastamisel, arutelu Ootel, Lahenda→
  „Saada Lisa 3-e" taaskasutab seotud punkti (`aruteluId`). Kinnitamist ootav eri on dokumendis lukus (pill).
- **Viisard:** „Üürnik" samm ei hüppa kliendi valikul edasi — avaneb esindaja plokk (nimi/e-post/tel, eeltäidetud
  registrist, `LWIZ.kontakt` → `l.kontakt`, P 1.2/P 6.2). Viisard ja pakkumus→leping kasutavad `createLease`-tehast.
- **A4 / Lisa 3 leht:** `pohiOf/uldOf` punktidest (`tekst`), märked sulgudes „(sõnastus muudetud)" / „(kirjutatud üle: …)";
  diff-märgendust lehel ei näidata.
- **Välised tarbijad** (avaleht, portfell, kliendid, suhtlus, teavitused) loevad `l.arutelud` (`ref`, `lahendusTekst`).
- **Surnud kood maha:** `ULD_CLAUSES` (data.js + app.js varuharud), `POHI_TABLE` (uldtingimused.js). `.uld-send` → `.to-lisa3`.
- **Kontroll:** headless Chrome CDP (scratchpad `cdp.js` + `scen1.js` 40/40, `scen2.js` migratsioon/idempotentsus/mobiil
  9/9, konsool puhas): viisard+esindaja, üld-diff + Vana/Uus lüliti, kontrolli-vood, → Lisa 3 + AI + kinnitus, näidisvoog
  (hind 8.00 → vastus → OK → Lisa 3 → üürniku kinnitus → „Eritingimus"), otse sõnastus + tagasilükkamine (põhjendus
  kohustuslik), selgitatud + taasava, fakt läbirääkimisel (parkimine), aktsept → allkirjastamine → Kehtiv → Lisa 4 ring,
  pakkumus→leping (`kirjutabYleTekst` varuvariant).
- Teadlikult tegemata (skoop): Kehtiv/Lisa N ring ja pakkumuse läbirääkimised on stringipõhised nagu enne; `View.tooleping`
  (`t.pohi/t.eri`) ei puudutatud.

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
