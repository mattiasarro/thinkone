# ThinkOne — Lepingutöövoo platvormi funktsionaalne spetsifikatsioon (v2)

> **Versioon 2** — täiendab v1 üürilepingute spetsifikatsiooni platvormikihiga: kaks sammast
> (esemeregister + lepingumootor), töölepingud teise vertikaalina, olemasolevate lepingute import,
> struktureeritud andmeregister (RAG-i alus) ning AI-agendi uuendatud lahendus.
> Dokument on arenduslepingu lähteülesanne.

## Platvormi ülevaade

ThinkOne viib lepingu sünnist täitmiseni — pakkumine, läbirääkimine, allkiri, kohustused —
nii, et iga tükk sünnib **struktuursena ja masinloetavana**.

**Esimesed vertikaalid on ärikinnisvara üürilepingud ja töölepingud** — teadlikult
paralleelselt, sest kaks erinevat lepinguliiki samal mootoril tõestavad platvormi:
järgmine lepinguliik on **peamiselt konfiguratsioon + õhuke vertikaalimoodul, mitte uus koodibaas**.

**Vertikaal = konfiguratsioon + õhuke koodmoodul:** esemetüübid, parameetriskeemid ja
mallid on konfiguratsioon; arvutused ja integratsioonid (vertikaali adapterid, nt TÖR)
on vertikaali väike koodmoodul. Mitte uus koodibaas.

**Kaks sammast**, mida ühendab **hõive**:

1. **Esemeregister** — kõik, mille kohta lepingud käivad; tüübitud ja hierarhiline.
2. **Lepingumootor** — lepingutüübid, mallid, klauslid, olekud.

**Andmed enne dokumenti:** kõik sünnib struktuursena → AI teab, mis tegelikult kehtib.
Dokument (PDF/DOCX) on struktuursete andmete projektsioon, mitte tõe allikas.

### Esemeregister

- **Esemetüübid** — atribuudiskeemid tulevad vertikaalist (pind: m², hind; ametikoht:
  ülesanded, töötasu).
- **Konteinerid ja üksused** — hoone → pinnad; osakond → ametikohad.
- **Staatus = projektsioon** — pind vaba/üüritud, ametikoht täidetud — **arvutub hõivetest**,
  seda ei hallata käsitsi.
- **Manused** — plaanid, ametijuhendid, dokumendid eseme küljes.

### Lepingumootor

- **Lepingutüübid** — üürileping, tööleping, … = mall + parameetriskeem + reeglid.
- **Klauslimudel** — üld (lukus) / põhi (andmed) / eri (kirjutab üle; ülimuslik).
- **Lepingumallid** — versioneeritud; **külmuvad allkirjaga**.

*Ärikinnisvara vertikaalis: Objekt = konteiner, Pind = üksus, üürileping = hõive pinna peal.
Töölepingute vertikaalis: osakond = konteiner, ametikoht = üksus, tööleping = hõive
ametikoha peal.*

## Rollid

- **Admin** — operaatori õigused + konto/ettevõtte seadistus, kasutajate haldus, mallide haldus.
- **Operaator** — üürileandja/tööandja esindaja. Loob objekte, pakkumusi, lepinguid; vaatab üle kliendi ettepanekud; kinnitab ja saadab.
- **Klient (üürnik)** — pakkumuse etapis toimetab **ilma kontota** e-postile saadetud turvalise lingi kaudu (vt etapp 04); **konto tekib allkirjastamisel** ja seotakse lepinguga. Konto kaudu vaatab lepingut, kommenteerib punkte, aktsepteerib, allkirjastab.
- **Töötaja / kandidaat** — töölepingute vertikaali osapool, analoogne kliendi rolliga (vt „Töölepingute vertikaal").

## Andmemudel (olemid ja hierarhia)

Ärikinnisvara vertikaali andmemudel (v1 struktuur, säilitatud):

```
Konto (kasutaja organisatsioon)
 └─ Ettevõte / üürileandja (1..n; igaühel oma äriregistri andmed + logo/kujundus)
     └─ Objekt / ärikinnisvara objekt (1..n)          ← esemeregistri konteiner
         ├─ Hoone baasandmed (EHR ehitisregister: ehitise kood, aadress,
         │     kasutusotstarve, ehitisealune pind, suletud netopind,
         │     korruste arv, ehitusaasta)
         ├─ Pind / üüripind (1..n):                   ← esemeregistri üksus
         │     nimi · tüüp · netopindala m² · üüripind m² (neto + koefitsiendiga
         │     jaotatud üldpind, arvutatud mallis) · koefitsient (metaandmena) ·
         │     hind €/m² (üüripinna kohta) · elektrivõimsus (imporditud, pinna kohta) ·
         │     parkimiskohtade arv · Lisa 1 pinnaplaan(id)
         ├─ Lisa 2: asendiplaan + parkimisskeem (objekti kohta)
         ├─ Kõrvalkulu (objekti tasemel: talvine €/m², suvine €/m², allikas Moderan)
         ├─ käibemaksuga_maksustatud? (objekti tasemel; pärandub lepingusse)
         ├─ Üldtingimused (muutumatu mall)
         ├─ Eritingimuste põhi (mall)
         └─ Pakkumuse põhi (mall)

Klient (Eesti firma | välisfirma | eraisik)             ──┐
Riskiraport (Kliendi kohta, ajatempel, skoor, allikad)    │
Hinnapakkumine  ── seotud Objekt + Pind[] + Klient
 │   · kehtivusaeg (vaikimisi 14 päeva; möödumisel automaatne "Aegunud")
 │   · jagamislink (kliendile e-postiga; kehtib sama kaua kui pakkumus)
 │   · (a) vabatekst-kommertssisu (rich-text)
 │   · (b) eritingimused: (struktureeritud, voolab lepingu Lisa 3-e)
 │   · summad: üür + kõrvalkulu (neto; KM eraldi, vt "Hinnastus ja käibemaks")
Üürileping   ── seotud 1 Pind + Klient  (1 pakkumus → n lepingut)   ← hõive
 │   · summad (üür + kõrvalkulu, kuus) · käibemaksuga_maksustatud? (objektist päritav)
 │   · indekseerimine (meetod: fikseeritud % | Statistikaameti indeks; sagedus; järgmine kuupäev)
 │   · päritolu: platvormis loodud | imporditud (olemasolev leping)
 └─ Lisa (nummerdatud; eritingimused = Lisa 3, muudatused 4,5,…)
 └─ Lepingupunkt (adresseeritav; kommenteeritav)
        · kategooria: üld | põhi | eri
        · lukus? (üld = lukus; põhi ja eri = operaatori muudetavad)
        · kirjutab_üle? → viide üld-/põhipunktile, mille eritingimus üle kirjutab (ülimuslik)
SignatureContainer (Konteiner 1: leping+plaanid; Konteiner 2: eritingimused)
KeyDate (algus/lõpp/indekseerimine/katseaeg/palgaülevaatus; teavitus x päeva ette,
         lepingu lõpp vaikimisi 90 päeva ette operaatorile ja kliendile)
AuditEvent / CommunicationThread / ClauseComment (kogu tsükli jälg)
```

Sama struktuur üldistub esemeregistri kaudu teistele vertikaalidele: konteiner → üksus →
hõive → leping. Töölepingute vertikaali konkreetne kaardistus on peatükis
„Töölepingute vertikaal".

## Etapid

### 01 — Onboarding
- Admin sisestab ettevõtte nime/registrikoodi → **e-äriregistrist autotäide**: nimi, registrinumber, juriidiline aadress, KMKR number jm.
- Mitu ettevõtet ühe `Account`'i all (eri objektid võivad kuuluda eri firmadele).
- Lisaks: logo/aktsentvärvi valik (kasutatakse pakkumuse ja lepingu dokumentidel).

### 02 — Ärikinnisvara objekti seadistamine
Objekt registreeritakse **üks kord**, skaleeruv. Eesmärk: vajalik info saab sisse minimaalse vaevaga ja koondub hiljem automaatselt pakkumusse/lepingusse.

**Hoone baasandmed — EHR (ehitisregister) autotäide:**
- Operaator sisestab **ehitisregistri koodi või aadressi** → **EHR-ist autotäide**: ehitise aadress, kasutusotstarve, ehitisealune pind, suletud netopind, korruste arv, ehitusaasta jm hoone meta-andmed.
- Andmed salvestatakse **objekti tasemel** ja kanduvad vajadusel automaatselt dokumentidesse (pakkumus/leping). Puuduvaid/ebatäpseid välju saab käsitsi parandada.

**Üüripindade sisestus — CSV/Excel import-mall:**
- Ühtne eeltäidetav mall, **1 rida = 1 pind**. Veerud: pinna nimi · tüüp · netopindala · **üüripind** · koefitsient · hind €/m² · elektrivõimsus · parkimiskohtade arv.
- Operaator täidab malli (sageli olemasolevast tabelist) ja impordib korraga kõik pinnad. Import valideerib (puuduvad/valed väljad → veateade reaviisiliselt).
- **Käsitsi vorm** parandusteks ja üksikute pindade lisamiseks/muutmiseks.

**Üüripinna arvutus:** üüripind = neto + koefitsiendiga jaotatud üldkasutatav pind. **Arvutus tehakse mallis väljaspool süsteemi** (operaator arvutab nagunii); süsteem salvestab lõpliku üüripinna ja kasutab seda otse hinnastuses (hind €/m² käib üüripinna pealt). Koefitsient ja netopindala salvestatakse metaandmena.

**Dokumendid — kõik ette valmistatud objekti seadistamisel:**
- Iga pinna **Lisa 1 – pinnaplaan(id)** laetakse üles ja seotakse pinna külge.
- Objekti **Lisa 2 – asendiplaan + parkimisskeem** laetakse üles objekti külge.
- Tehingu (pakkumus/leping) loomisel koondab süsteem õiged failid **automaatselt** — tehingu hetkel lisatööd ei ole.

**Parkimine:** iga pind salvestab **parkimiskohtade arvu**; paigutust näitab objekti asendiplaan (Lisa 2). Pakkumusse/lepingusse tuleb kaasa arv + skeem.

**Muu objekti info:**
- Üürileandja seos + objekti kujundus (logo, kasutatakse dokumentidel).
- **Üürilepingu üldtingimused** (muutumatud), **eritingimuste põhi** (mall), **pakkumuse põhi** (mall).
- **Kõrvalkulu**: Moderani API-st viimase aasta andmed → arvutatud talvine (okt–märts) ja suvine (apr–sept) aritmeetiline keskmine €/m² (objekti tasemel). Juhul kui keskmise kõrvalkulu kohta info puudub, lisatakse käsitsi.

### 03 — Dashboard
Vaade koondab 4 põhitegevust: **Loo hinnapakkumine · Loo üürileping · Üürilepingu muudatus · Riskiraport**.

**Objekti olulisim info** kohe nähtaval:
- **Täituvus** (staatus arvutub hõivetest, vt esemeregister) ja **vabad pinnad**.
- **Lähenevad võtmekuupäevad** (lõppemised, indekseerimised, katseajad).
- Pooleliolevad pakkumused ja lepingud.

**Lepingu preview võtmeandmetega** — iga leping avaneb dashboardilt kompaktse eelvaatena
(pooled, pind/ese, summad, tähtajad, olek), ilma täisdokumenti avamata.

**„Vajab tegevust täna" — smart dashboard:** AI valib välja lepingud, mis **vajavad
operaatorit päriselt** (mitte ainult staatuse järgi): aeguv pakkumus, vastuseta
kommentaar, lähenev tähtaeg ilma otsuseta jms. Prioriseeritud tegevusloend.

**Vestlusaken** (vt „AI-agent"): korraldused, küsimused ja **vaba suhtlus lepingu
teemadel**. Kuna Decision Memory & Audit Trail on olemas, saab küsida ka kõikide
sammude kohta pakkumuses või lepingus, mida sai kliendiga räägitud.

### 04 — Hinnapakkumine
1. Operaator sisestab kliendi nime/registrikoodi → Eesti firma puhul **äriregistri autotäide**; välisfirma/eraisik käsitsi.
2. **Riskiraport** (nupp, valikuline, informatiivne): päring **Krediidiinfo + Inforegister + Kohtutäitur + Äriregister** → koondskoor **KÕRGE/KESKMINE/MADAL**. Ei blokeeri.
3. Operaator valib **ühe või mitu pinda**, määrab lepingu pikkuse → süsteem koostab pakkumuse õigete m²-de ja hindadega; lisana pinnaplaan + parkimisskeem; kaasa kõrvalkulu (talvine/suvine €/m²) ja elektrivõimsus.
4. Pakkumusel on **kaks osa**: (a) **vabas vormis kommertssisu** (rich-text, täiesti
   korrigeeritav — paindlik läbirääkimiseks); (b) struktureeritud **eritingimuste sektsioon**
   (punktide loend), kuhu operaator fikseerib läbirääkimisel kokku lepitud eritingimused.
   Just (b) voolab hiljem lepingu Lisa 3-e (vt p 7) — vabatekst (a) ei kandu lepingusse sõnasõnalt.
5. Pakkumusele määratakse **kehtivusaeg — vaikimisi 14 päeva** (kliendi aktseptiks/allkirjaks;
   operaator saab vajadusel muuta). Operaator kinnitab → saadetakse kliendile.
6. **Kliendi ligipääs ilma kontota:** klient saab **e-postile pakkumuse lingi**, mis
   **kehtib sama kaua kui pakkumus**. Lingi kaudu näeb klient **ainult seda pakkumust**
   ning saab **teha muudatusettepanekuid ja märkusi ilma kontot loomata**. Vajadusel saab
   pakkumuse saata ka **e-kirja ja PDF-ina**. Kui klient pakkumuse **aktsepteerib ja
   asub allkirjastama**, luuakse talle **lepinguga seotud kliendikonto** — selleks
   küsitakse vajalikud isiku- või ettevõtteandmed. **Sama lingipõhine ligipääs laieneb
   pakkumusest sündinud lepingu mustandi(te)le**: klient saab lingi kaudu ka lepingu
   punkte kommenteerida ja aktsepteerida (etapp 05); lepinguetapi lingil on oma
   kehtivusaeg. Konto tekib allkirjastamisel (etapp 06).
7. Klient: **aktsepteerib** | **teeb vabas vormis muudatusettepaneku** | **keeldub**. Ettepaneku
   järel operaator kinnitab → pakkumus uueneb → saadetakse uuesti. Tsükkel kuni aktsept. Kui klient
   keeldub → pakkumus läheb olekusse **Tagasi lükatud**; kehtivusaja möödumisel automaatselt **Aegunud**;
   operaator võib enne aktsepti **Tühistada**. Kõik kolm on lõppolekud (lepingut ei teki).
8. **Aktsepteeritud pakkumus voolab lepingu malli.** Kui pakkumus kattis mitut pinda → tekib **N lepingu mustandit (üks pinna kohta)**, igaüks eeltäidetud selle pinna andmetega. Lepingu mustand **genereeritakse struktureeritult** (mitte vabateksti kopeerimisest): üldtingimused mallist (lukus) + põhitingimused tehinguandmetest + Lisa 3 = pakkumuse (b)-sektsiooni eritingimused, mis **kopeeritakse automaatselt iga lepingu Lisa 3-e** (operaator saab lepingupõhiselt veel korrigeerida).

### 05 — Üürileping
- **Lepingu punktid (Clause) tekivad kolmest allikast:** **üldtingimused** = mallist, struktureeritud lukus punktidena (ei muudeta kunagi); **põhitingimused** = tehingupõhised punktid (pind, üür, periood, kõrvalkulu, indeks + **osapoolte lisakontaktandmed**, mis pakkumises ei kajastu), genereeritud Object/Space/pakkumuse andmetest ja **operaatori poolt muudetavad**; **eritingimused (Lisa 3)** = läbirääkimisel muudetav punktide loend.
- **Pakkumusest sündinud mustand**: eeltäidetud põhi- ja üldtingimused, pinnaplaan (Lisa 1), asendiplaan+parkimine (Lisa 2), eritingimused (Lisa 3) juhul kui pakkumuses juba kokku lepiti muudatusi.
- Operaator vaatab üle → saadab **mustand V1** kliendile.
- Klient: **kinnitab** | **tagastab kommentaaridega** — iga lepingu punkt on klikitav ja kommenteeritav. Lisaks punktikommentaaridele on kliendil ja operaatoril kasutada **vestlusliides vabaks suhtluseks lepingu teemadel** (vt „AI-agent → Vestlusliides") — kogu suhtlus logitakse CommunicationThread'i.
- Operaator märgib iga ettepaneku **aktsepteeritud / ei**. Mustand liigub edasi-tagasi kuni **kõik punktid aktsepteeritud**.
- **Reegel:** aktsepteeritud muudatus lisatakse automaatselt **eritingimustesse (Lisa 3)**; üldtingimuste teksti ei muudeta kunagi (eritingimus on ülimuslik). Tekkiv eritingimuse punkt **viitab väljaga `kirjutab_üle`** sellele üld-/põhipunktile, mille ta üle kirjutab — nii on ülimuslikkus masinloetav ja dokument saab kuvada seose („§X, muudetud Lisa 3 p Y"). **Operaator saab mustandis muuta põhitingimusi** (nt korrigeerida tehinguandmeid, lisada osapoolte **lisakontaktandmeid**, mis pakkumises ei kajastu) **ja eritingimusi (Lisa 3)**; **üldtingimused on lukus** (erinevalt pakkumusest, mis on täiesti vabas vormis).
- **Lepingu loomine 0-st** (mitte pakkumusest): kliendi nimi → äriregistri autotäide + vajadusel riskiraport → pind valitakse (tuleb kaasa Lisa 1 + Lisa 2) → mustand V1 → eritingimuste kokkulepe → mõlema aktsept → allkirjastamine.

### 06 — Allkirjastamine
- Digitaalne allkirjastamine ThinkOne portaalis.
- **Konteiner 1:** üürileping + pinnaplaan + parkimisplaan. **Konteiner 2:** lisa (eritingimused).
- Meetodid: **Smart-ID / Mobile-ID**. Smart-ID katab kogu Baltikumi (Eesti, Läti ja
  Leedu isikukoodiga allkirjastajad) — see katab ka välisfirmade esindajate tavajuhu.
  **eIDAS / muu piiriülene allkirjastamine ei kuulu MVP skoopi**; vajadusel lisatakse
  hiljem eraldi meetodina.
- Kui klient toimetas seni ilma kontota (pakkumuse lingi kaudu), **luuakse allkirjastamisel kliendikonto** ja seotakse lepinguga (vt etapp 04 p 6).
- Allkirjastatud dokumendiversioonid **külmutatakse** (vt „Vundament").

### 07 — Arhiveerimine + võtmekuupäevad
- Allkirjastatud leping → **arhiiv**.
- **Arhiivi nähtavusreegel:** kõik lepinguosad — varasemad versioonid, asendatud lisad, aegunud/tühistatud dokumendid — **arhiveeritakse eraldi peidetuna**; vaikevaadetes on nähtavad **ainult aktiivsed lepingud** ja nende kehtiv seis. Arhiveeritud osad on ühe klikiga avatavad (audit, vaidlused), kuid ei risusta töövaateid.
- **Võtmekuupäevad kalendrisse**: algus, lõpp, **indekseerimine**, + teavitus x päeva ette.
- **Lepingu lõppemise teavitus saadetakse vaikimisi 90 päeva ette** — nii **operaatorile kui ka kliendile** (rakendusesisene + e-post).
- **Indekseerimine järgib lepingut**: indekseerimismeetod lepitakse kokku **üürilepingus endas** ja salvestatakse lepingu parameetrina (meetod, määr/protsent või indeksi tüüp, sagedus, järgmine indekseerimiskuupäev). Toetatud on **kaks meetodit**: **(a) fikseeritud %-määr** — sisemine arvutus, väline allikas pole vajalik; **(b) Statistikaameti indeks** (nt tarbijahinnaindeks) — kasutatakse teatud lepingutes, mis seovad üüri välise indeksiga.
- **Korraline indekseerimine ei nõua lepingu muudatust**: kuna indekseerimine on lepingus juba sätestatud, **ei teki uut lisa ega allkirjastamist**. Võtmekuupäeval süsteem arvutab uue üüri kokkulepitud meetodi alusel (indeksi korral Statistikaametist võetud muutuse põhjal), **rakendab selle automaatselt**, logib audit trail'i ja **teavitab pooli** (operaator + klient).
- **Erand — indekseerimise erikokkulepe**: kui pooled lepivad kokku lepingus sätestatust **erineva** käitumise — nt jätavad indekseerimise mõneks aastaks **vahele** või muudavad määra/meetodit — vormistatakse see **muudatusena** (uus Lisa nr, etapp 08 voog: kinnitus → aktsept → allkirjastamine).
- **Lepingu lõppemine**: tähtaja lõpp on **automaatne** võtmekuupäeva-üleminek (`Arhiveeritud → Lõppenud`), uut lisa ei teki. **Ennetähtaegne lõpetamine** (poolte kokkuleppel/etteteatamisega) vormistatakse **muudatusena** (uus Lisa nr, etapp 08 voog: kinnitus → aktsept → allkirjastamine), misjärel leping läheb olekusse **Ennetähtaegselt lõpetatud**.
- **Audit trail**: kogu tsükkel — kõik dokumendi versioonid, allkirjastatud versioonid, kogu kommunikatsioon. **1-klikiga eksport** (nt kohtulahendite tarbeks).

### 08 — Üürilepingu muudatus
- Muudatused tehakse **alati eritingimustes**. Iga muudatus → **järgmine lisa nr** (Lisa 3 → 4 → 5 …).
- Sama voog: muudatus kliendile kinnitamiseks → peab saama aktsepteeritud → allkirjastamine.
- **Ka lepingu ennetähtaegne lõpetamine** kasutab sama muudatuse-voogu (uus Lisa nr) ning viib lepingu lõppolekusse **Ennetähtaegselt lõpetatud**. Üürnik saab vajadusel teha läbi süsteemi ettepaneku lepingu muudatusteks.

## Töölepingute vertikaal

Töölepingud on **teine lepingutüüp samal mootoril** ja platvormi **modulaarsuse test**:
vertikaal realiseeritakse konfiguratsiooni (esemetüübid, parameetriskeemid, mallid) ja
õhukese koodmoodulina (arvutused, TÖR-adapter), mitte eraldi koodibaasina.

Kaardistus platvormi mõistetele:

| Platvormi mõiste | Ärikinnisvara | Töölepingud |
|---|---|---|
| Konteiner | Hoone/objekt | Osakond |
| Üksus (ese) | Pind | Ametikoht (ülesanded, töötasu, ametijuhend manusena) |
| Hõive | Üürileping pinnal | Tööleping ametikohal; **headcount = kvoothõive** (mitu kohta täidetud) |
| Staatus (projektsioon) | Pind vaba/üüritud | Ametikoht täidetud/täitmata |
| Pakkumus → leping | Hinnapakkumine → üürileping | **Tööpakkumine → läbirääkimine → allkiri sama töövooga** (etapid 04–06 analoogia) |
| Võtmekuupäevad | Algus/lõpp/indekseerimine | Algus/lõpp + **katseaeg** ja **palgaülevaatus** võtmekuupäevadena |
| Vertikaali adapter (integratsioon) | EHR, Moderan, Statistikaamet | **TÖR-kanne** (töötamise register) |

- **Ametikohad esemeregistris:** atribuudiskeem vertikaalist — ülesanded, töötasu,
  nõuded; ametijuhend eseme manusena.
- **Sama klauslimudel:** üldtingimused (lukus) / põhitingimused (andmed) / eritingimused
  (ülimuslikud, `kirjutab_üle`), sama olekumasin, sama allkirjastamis- ja arhiveerimisvoog.
- **TÖR-kanne vertikaali adapterina:** töölepingu sõlmimisel/lõpetamisel vormistatakse
  registrikanne vertikaalispetsiifilise integratsioonina (sama muster nagu EHR/Moderan
  ärikinnisvaras).

**Skoobipiirangud (MVP, teadlikud otsused):**

- **Kontosisene rollipõhine ligipääsupiirang ei kuulu MVP skoopi** — kõik konto
  operaatorid näevad kõiki konto andmeid (sh töölepingute töötasusid). Teadlik,
  dokumenteeritud piirang; peenem õigustemudel (rolli-/vertikaalipõhine nähtavus)
  lisatakse hiljem.
- **TÖR-kanne ei kuulu MVP skoopi.** Hilisemal lisamisel vormistatakse kanne alati
  operaatori kinnitusega (human-in-the-loop), mitte allkirjastamise automaatse
  kõrvalmõjuna.

## Olemasolevate lepingute import

Olemasolevad ja süsteemiväliselt loodud vanad lepingud **imporditakse sisse ja viiakse
õigesse struktuuri** — sama klauslimudelisse, milles sünnivad platvormi enda lepingud.

- **Hõlmatud lepinguliigid:** haldus-, hooldus-, kindlustus- ja valvelepingud; **kaasa
  arvatud vanad, varem loodud üürilepingud**. Üüripakkumisi ei impordita (otsus
  08.2026); vajadusel säilitatakse üksikud vanad pakkumised tavaliste manustena.
- **Sisend:** PDF/DOCX. Dokument loetakse (AI-toega) klauslimudelisse: punktid,
  tüübitud parameetrid, tähtajad, pooled, hõived.
- **Skoop:** ainult tekstikihiga PDF/DOCX. **Skaneeritud (pildipõhised) dokumendid on
  struktuurituvastusest väljas** — OCR ei kuulu skoopi; sellised failid saab hoida
  tavaliste manustena, kuid klauslimudelisse neid ei loeta.
- **Käsitsi registreerimine (ilma OCR-ita):** skaneeritud dokumendile, mis jääb
  manuseks, saab operaator käsitsi sisestada võtmeandmed (pooled, summad, tähtajad,
  lepingu liik). Selline kirje osaleb võtmekuupäevade kalendris, otsingus ja
  aruandluses võrdselt imporditud lepinguga; klauslistruktuuri ja sisu-Q&A-d ei teki
  — sisu osas kehtib ainult originaalfail.
- **Tõe allikas:** imporditud lepingu puhul on **allkirjastatud lähtedokument
  (PDF/DOCX) õiguslik tõde**; tuvastatud klauslistruktuur on selle **indeks ja
  lähendus**, mitte autoriteetne versioon. (Platvormis sündinud lepingul on vastupidi:
  struktuur on tõde ja dokument projektsioon.) Kasutajaliides kuvab imporditud
  lepingul selle eristuse; vaidluse korral kehtib originaaldokument.
- **Muudatused:** imporditud lepingud **ei osale muudatuste voos (etapp 08)** —
  platvorm ei vormista lisasid imporditud baaslepingu peale. Imporditud lepingud
  osalevad otsingus, Q&A-s, võtmekuupäevades ja aruandluses. **Väljaspool platvormi
  sõlmitud muudatuse saab registreerida:** operaator laeb allkirjastatud lisa üles
  (tekstikihiga fail loetakse struktuuri, skaneeritu registreeritakse käsitsi
  võtmeandmetega), uuendab lepingu parameetreid ja võtmekuupäevi; kõik logitakse
  audit trail'i — register püsib tõene ka siis, kui muudatus vormistati mujal.
- **Kontroll:** operaator vaatab tuvastatud struktuuri üle ja kinnitab; parandused
  logitakse audit trail'i. Imporditud leping märgitakse päritoluga `imporditud`.
- **Tulemus:** olemasolev portfell muutub varaks — imporditud lepingud osalevad otsingus,
  Q&A-s, võtmekuupäevade kalendris ja aruandluses võrdselt platvormis sündinud
  lepingutega.

## 💡 Idee: Dokumendiregister (ümbrik)

> **Staatus: idee / kaalumisel** — ei kuulu veel lähteülesande skoopi, kirjas
> edasise arutelu jaoks.
>
> Lisaks lepingutele hoiab platvorm ka **muid dokumente** — poliitikad, sertifikaadid,
> load, aktid, volikirjad, protokollid jm.
>
> Iga selline dokument on **ümbrik**: fail + tüüp + omanik + olek (kehtiv/aegunud) +
> võtmekuupäevad + seosed esemete ja lepingutega. **Klauslimudelit ei rakendata** —
> see on ainult lepingute jaoks.
>
> Dokumente saab **importida samamoodi nagu olemasolevaid lepinguid** (AI ekstraktib metaandmed
> ja tähtajad, operaator kinnitab), aga neid ei suruta lepingumudelisse ega segata
> lepingutega — need on registris **eraldi tüübina**.
>
> Ümbrik-dokumendid **osalevad otsingus, Q&A-s, võtmekuupäevade kalendris ja
> aruandluses võrdselt lepingutega**. Vajadusel saab ümbriku hiljem **tõsta
> klauslimudelisse** (nt kui dokument osutub lepinguks).
>
> See ütleb kolm asja: platvorm võimaldab **kõiki dokumente**, neid saab **sisse tuua**,
> ja need **ei lähe lepingutega segamini** (eraldi tase, klauslimudel ainult lepingutele).

## Vundament — struktureeritud andmeregister (RAG-i alus)

Kiht, kuhu kõik koguneb. Iga leping, klausel, parameeter ja otsus on **masinloetav
kirje** — mitte PDF kaustas. Sellest kihist vastab platvorm küsimusele, mida keegi
teine ei suuda: **mis tegelikult kehtib?**

Registri sisu:

- klauslid + ülimuslikkus (`kirjutab_üle` seosed)
- tüübitud parameetrid
- hõived
- tähtajad ja kohustused
- dokumendiversioonid (allkirjaga külmutatud)
- audit trail · decision memory
- **efektiivne seis** lepingu ja eseme lõikes (üld + põhi + ülimuslikud eritingimused kokku arvutatuna)

**Sisse ⟶** platvormis sündivad lepingud (juba struktuursed) + **import**:
olemasolevad lepingud PDF/DOCX → loetakse samasse klauslimudelisse (vt „Olemasolevate lepingute import").

**⟶ Välja**

- **AI-agent ja Q&A** — vastused kogu portfelli üle (vt „AI-agent").
- **Otsing ja filtrid** — nt *„mis indekseerub 2027?"* · *„kelle katseaeg lõpeb sel kuul?"*
- **Aruandlus** — täituvus, rahavood, tähtajad.
- **Võtmekuupäevade kalender** — kõik vertikaalid ühes vaates.
- **Eksport** — sh audit trail'i 1-klikiga eksport.

## AI-agent (platvormi „aju")

Platvormi keskmes on **frontier-klassi keelemudel, mida kasutatakse API kaudu**; kogu
platvorm (sh AI-kiht) jookseb Railway platvormil — agent on platvormi backend'i osa,
mitte eraldi teenus. Mudel toimib **agendina**: mõistab vabas vormis korraldusi,
tuvastab vajalikud olemid ja käivitab õiged töövoo-sammud, lihtsustades operaatori tööd.

### Vestlusliides (sisendkanal)
Dashboardil on **vabas vormis vestlusaken** korralduste ja küsimuste jaoks. Vestlusliides
võimaldab **vaba suhtlust lepingu teemadel** — mitte ainult lepingupunktide
kommenteerimist: operaator (ja klient oma vaates) saab arutada lepingu sisu, küsida
selgitusi ja tausta; suhtlus logitakse CommunicationThread'i. **MVP-s AI
lõppkasutajale (klient/töötaja) ei vasta** (otsus 08.2026): kliendi vaates on
vestlus inimestevaheline suhtlus operaatoriga; AI toetab ainult operaatorit.

- **Toiming (näide):** *„Loo pakkumine ettevõttele Future Invest OÜ, Hoone T6B pind 12."* → agent tuvastab kliendi (Future Invest OÜ), objekti (Hoone T6B) ja pinna (nr 12), koostab pakkumuse mustandi õigete andmetega ja **käivitab pakkumise protsessi** (etapp 04).
- **Küsimus (näide):** *„Mis seisus on Future Invest OÜ lepingud ja millal on järgmine indekseerimine?"* → agent vastab Decision Memory / Audit Trail põhjal.

### Mida agent oskab (funktsionaalsel tasandil)
- **Toimingute käivitamine korralduse põhjal** — samad töövood mis käsitsi (etapid 02–08): loo pakkumine, loo üürileping, alusta muudatust, telli riskiraport, lisa objekt/pind.
- **Lepingugeneraator** — operaator kirjutab **vabas vormis ülesande/sisendi**, mille
  kohta on lepingut vaja, ja agent **loob mustandi** (klauslimudelis, õige malli ja
  parameetriskeemiga). Mustand siseneb tavalisse töövoogu: **mustand → läbirääkimine →
  allkirjastamine** — sama olekumasin ja inimkontroll mis käsitsi loodud lepingul.
- **Olemite tuvastus ja eeltäide** — leiab korraldusest ettevõtte, objekti, pinna(d), perioodi jms; puuduoleva küsib üle.
- **Chat ja Q&A kogu portfelli üle** — vastab **kõikide platvormi dokumentide ja
  lepingute kohta** (sh imporditud olemasolevad lepingud): objektid, pakkumused, lepingud,
  võtmekuupäevad (Decision Memory + Audit Trail + struktureeritud andmeregister).
- **Smart dashboard'i prioriseerimine** — valib lepingud, mis vajavad operaatorit päriselt (vt etapp 03).
- **Mustandite ja soovituste koostamine** — nt eritingimuste sõnastus, läbirääkimise kokkuvõte, pakkumuse kommertsteksti mustand (operaator kinnitab/muudab).
- **Olemasolevate lepingute struktuuri tuvastus** — impordi toel (vt „Olemasolevate lepingute import").

### Reeglid ja inimkontroll
- Agent **kasutab samu ärireegleid ja olekumasinaid** mis käsitsi töövoog — ülimuslikkuse ja lukustuse reeglid kehtivad (eritingimused Lisa 3, üldtingimused lukus).
- **Tagajärgedega sammud (saatmine, allkirjastamine) nõuavad operaatori kinnitust** — agent valmistab ette, operaator vaatab üle ja kinnitab (human-in-the-loop).
- Agent **ei automatiseeri kasutajaliidest**: korralduse peale koostab ta mustandi
  tööriistade (samade äriteenuste) kaudu ning vastab vestluses kinnituskaardi ja
  **lingiga loodud mustandile**; operaator vaatab üle ja tegutseb sealt edasi.
- Mitmeti mõistetava korralduse korral agent **täpsustab** (nt mitu sobivat pinda → küsib, millist).
- Iga agendi tehtud samm **logitakse Audit Trail'i** (sh „agent operaatori korraldusel").

### Andmed ja privaatsus
- Frontier-mudelit kasutatakse **API kaudu andmetöötluslepingu (DPA) alusel**; AI-kihi
  taristu jookseb Railway platvormil. Päringutesse kaasatakse **ainult vastamiseks
  vajalik kontekst** (minimaalsuse põhimõte); mudelipakkuja juures andmeid treeninguks
  ei kasutata (lepinguline nõue).
- Agent näeb ainult **kasutaja õiguste piires** olevaid andmeid (sama ligipääsuloogika mis kasutajal).
- Struktureeritud andmeregister (vundament) ja dokumendid püsivad **platvormi enda
  andmebaasis**; välisele mudelile ei sünkroniseerita andmehoidlat, vaid saadetakse
  päringupõhine kontekst.

## Olekumasinad

**Hinnapakkumine:** `Mustand → Saadetud → (Kliendi ettepanek → Operaatori läbivaatus → Saadetud)* → Aktsepteeritud → Lepingu(te)ks teisendatud`
- Kehtivusaeg **vaikimisi 14 päeva** saatmisest; möödumisel automaatne üleminek olekusse `Aegunud`.
- Lõppolekud (negatiivsed): `Saadetud`/läbirääkimine → **`Tagasi lükatud`** (klient keeldub) | **`Aegunud`** (kehtivusaeg möödus, automaatne) | **`Tühistatud`** (operaator katkestab enne aktsepti). Neist edasi lepingut ei teki.

**Leping / Lisa:** `Mustand V1 → Saadetud → (Kommentaarid/ettepanekud → Operaatori läbivaatus → Saadetud)* → Kõik punktid aktsepteeritud → Allkirjastamisel → Allkirjastatud → Arhiveeritud`. Muudatus (etapp 08) taaskäivitab sama tsükli uue lisaga. **Korraline indekseerimine rakendub automaatselt ilma uue lisata**; ainult indekseerimise erikokkulepe (nt vahelejätmine) läbib etapp 08 voo.
- Enne allkirjastamist (Mustand/Saadetud): kumbki pool katkestab → **`Tühistatud`** (lõppolek).
- Pärast arhiveerimist (aktiivne leping): tähtaja lõpp → **`Lõppenud`** (automaatne, võtmekuupäeva-põhine); ennetähtaegne lõpetamine (etapp 08 muudatuse-voog) → **`Ennetähtaegselt lõpetatud`**.
- **Nähtavus:** aktiivsed lepingud on vaikevaadetes nähtavad; asendatud versioonid ja lõppolekusse jõudnud dokumendid arhiveeritakse eraldi peidetuna (vt etapp 07).

Samad olekumasinad kehtivad **kõigile lepingutüüpidele** (sh tööleping) — vertikaal ei
defineeri oma olekuid, vaid kasutab mootori omi.

## Lisade numeratsioon (lepingu kohta)
- **Lisa 1:** pinnaplaan (selle lepingu pinna kohta)
- **Lisa 2:** asendiplaan + parkimisskeem
- **Lisa 3:** eritingimused (esimene)
- **Lisa 4, 5, …:** iga järgnev muudatus (sh indekseerimise erikokkulepe; korraline indekseerimine lisa ei tekita)

*(Töölepingute vertikaalis täidavad Lisa 1–2 rolli vertikaali konfiguratsioonis
määratud manused, nt ametijuhend; eritingimuste ja muudatuste numeratsiooniloogika on sama.)*

## Hinnastus ja käibemaks
- **Üür** (pinna kohta, kuus) = `üüripind m² × hind €/m²`.
- **Kõrvalkulu** (informatiivne, hooajaline) = `üüripind m² × kõrvalkulu €/m²` — talvine ja suvine eraldi (allikas Moderan, objekti tasemel).
- **Elektrivõimsus** imporditakse **pinnaandmetega** (iga pinna kohta, CSV/Excel import-mallis koos teiste pinna väljadega); vajadusel käsitsi parandatav.
- Kõik hinnad salvestatakse **käibemaksuta (neto)**.
- Objekti tasemel väli **`käibemaksuga_maksustatud?`** (ärikinnisvara KM-kohustus on vabatahtlik; pärandub lepingusse). Kui jah → pakkumus/leping kuvab **neto + käibemaks (Eesti standardmäär) + bruto**; kui ei → kuvatakse netos.
- **Lepingu kogusumma** (kuus) = üür + kõrvalkulu kokku; kuvatakse vastavalt KM-seadistusele.

## Välised andmesõltuvused (funktsionaalsel tasandil)
e-äriregister (ettevõtte autotäide) · **EHR ehitisregister (hoone baasandmete autotäide)** · Moderan (kõrvalkulu) · Krediidiinfo · Inforegister · Kohtutäitur · Äriregister (riskiraport) · **Statistikaamet (indekseerimine — indeksipõhise meetodi korral)** · **TÖR töötamise register (töölepingute vertikaali adapter; post-MVP, vt skoobipiirangud)** · Smart-ID/Mobile-ID (allkirjastamine; Smart-ID katab Baltikumi — eIDAS post-MVP) · **frontier-keelemudeli API + Railway (AI-kihi taristu)** · e-post/teavitused. *(Indekseerimine: fikseeritud %-määra korral sisemine; teatud lepingutes seotud Statistikaameti indeksiga.)*

## Teavitused
- Kanalid: rakendusesisene + e-post (klient ja operaator).
- Käivitajad: pakkumus/leping saadetud, kommentaar lisatud, aktsept, allkirjastamise kutse, võtmekuupäev x päeva ees (sh indekseerimine, katseaeg, palgaülevaatus).
- **Lepingu lõppemine: teavitus vaikimisi 90 päeva ette, nii operaatorile kui kliendile.**
- Pakkumuse link kliendile e-postiga (kehtib pakkumuse kehtivusaja, vaikimisi 14 päeva).
