# ThinkOne — Ärikinnisvara üürilepingute töövoo funktsionaalne spetsifikatsioon

## Rollid

- **Admin** — operaatori õigused + konto/ettevõtte seadistus, kasutajate haldus, mallide haldus.
- **Operaator** — üürileandja esindaja. Loob objekte, pakkumusi, lepinguid; vaatab üle kliendi ettepanekud; kinnitab ja saadab.
- **Klient (üürnik)** — logib portaali, vaatab pakkumust/lepingut, kommenteerib punkte, aktsepteerib, allkirjastab.

## Andmemudel (olemid ja hierarhia)

```
Konto (kasutaja organisatsioon)
 └─ Ettevõte / üürileandja (1..n; igaühel oma äriregistri andmed + logo/kujundus)
     └─ Objekt / ärikinnisvara objekt (1..n)
         ├─ Hoone baasandmed (EHR ehitisregister: ehitise kood, aadress,
         │     kasutusotstarve, ehitisealune pind, suletud netopind,
         │     korruste arv, ehitusaasta)
         ├─ Pind / üüripind (1..n):
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
 │   · kehtivusaeg (möödumisel automaatne "Aegunud")
 │   · (a) vabatekst-kommertssisu (rich-text)
 │   · (b) eritingimused: (struktureeritud, voolab lepingu Lisa 3-e)
 │   · summad: üür + kõrvalkulu (neto; KM eraldi, vt "Hinnastus ja käibemaks")
Üürileping   ── seotud 1 Pind + Klient  (1 pakkumus → n lepingut)
 │   · summad (üür + kõrvalkulu, kuus) · käibemaksuga_maksustatud? (objektist päritav)
 │   · indekseerimine (meetod: fikseeritud % | Statistikaameti indeks; sagedus; järgmine kuupäev)
 └─ Lisa (nummerdatud; eritingimused = Lisa 3, muudatused 4,5,…)
 └─ Lepingupunkt (adresseeritav; kommenteeritav)
        · kategooria: üld | põhi | eri
        · lukus? (üld = lukus; põhi ja eri = operaatori muudetavad)
        · kirjutab_üle? → viide üld-/põhipunktile, mille eritingimus üle kirjutab (ülimuslik)
SignatureContainer (Konteiner 1: leping+plaanid; Konteiner 2: eritingimused)
KeyDate (algus/lõpp/indekseerimine; teavitus x päeva ette)
AuditEvent / CommunicationThread / ClauseComment (kogu tsükli jälg)
```

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
Lihtne vaade, 4 põhitegevust: **Loo hinnapakkumine · Loo üürileping · Üürilepingu muudatus · Riskiraport**. Lisaks ülevaade pooleliolevatest pakkumustest/lepingutest ja eelolevatest võtmekuupäevadest.

Kuna Decision Memory & Audit Trail olemas siis saab küsida ka kõikide sammude kohta pakkumuses või lepingus mida sai kliendiga räägitud

### 04 — Hinnapakkumine
1. Operaator sisestab kliendi nime/registrikoodi → Eesti firma puhul **äriregistri autotäide**; välisfirma/eraisik käsitsi.
2. **Riskiraport** (nupp, valikuline, informatiivne): päring **Krediidiinfo + Inforegister + Kohtutäitur + Äriregister** → koondskoor **KÕRGE/KESKMINE/MADAL**. Ei blokeeri.
3. Operaator valib **ühe või mitu pinda**, määrab lepingu pikkuse → süsteem koostab pakkumuse õigete m²-de ja hindadega; lisana pinnaplaan + parkimisskeem; kaasa kõrvalkulu (talvine/suvine €/m²) ja elektrivõimsus.
4. Pakkumusel on **kaks osa**: (a) **vabas vormis kommertssisu** (rich-text, täiesti
   korrigeeritav — paindlik läbirääkimiseks); (b) struktureeritud **eritingimuste sektsioon**
   (punktide loend), kuhu operaator fikseerib läbirääkimisel kokku lepitud eritingimused.
   Just (b) voolab hiljem lepingu Lisa 3-e (vt p 7) — vabatekst (a) ei kandu lepingusse sõnasõnalt.
5. Pakkumusele määratakse **kehtivusaeg**. Operaator kinnitab → saadetakse kliendile (portaali kaudu, klient logib sisse).
6. Klient: **aktsepteerib** | **teeb vabas vormis muudatusettepaneku** | **keeldub**. Ettepaneku
   järel operaator kinnitab → pakkumus uueneb → saadetakse uuesti. Tsükkel kuni aktsept. Kui klient
   keeldub → pakkumus läheb olekusse **Tagasi lükatud**; kehtivusaja möödumisel automaatselt **Aegunud**;
   operaator võib enne aktsepti **Tühistada**. Kõik kolm on lõppolekud (lepingut ei teki).
7. **Aktsepteeritud pakkumus voolab lepingu malli.** Kui pakkumus kattis mitut pinda → tekib **N lepingu mustandit (üks pinna kohta)**, igaüks eeltäidetud selle pinna andmetega. Lepingu mustand **genereeritakse struktureeritult** (mitte vabateksti kopeerimisest): üldtingimused mallist (lukus) + põhitingimused tehinguandmetest + Lisa 3 = pakkumuse (b)-sektsiooni eritingimused, mis **kopeeritakse automaatselt iga lepingu Lisa 3-e** (operaator saab lepingupõhiselt veel korrigeerida).

### 05 — Üürileping
- **Lepingu punktid (Clause) tekivad kolmest allikast:** **üldtingimused** = mallist, struktureeritud lukus punktidena (ei muudeta kunagi); **põhitingimused** = tehingupõhised punktid (pind, üür, periood, kõrvalkulu, indeks + **osapoolte lisakontaktandmed**, mis pakkumises ei kajastu), genereeritud Object/Space/pakkumuse andmetest ja **operaatori poolt muudetavad**; **eritingimused (Lisa 3)** = läbirääkimisel muudetav punktide loend.
- **Pakkumusest sündinud mustand**: eeltäidetud põhi- ja üldtingimused, pinnaplaan (Lisa 1), asendiplaan+parkimine (Lisa 2), eritingimused (Lisa 3) juhul kui pakkumuses juba kokku lepiti muudatusi.
- Operaator vaatab üle → saadab **mustand V1** kliendile.
- Klient: **kinnitab** | **tagastab kommentaaridega** — iga lepingu punkt on klikitav ja kommenteeritav.
- Operaator märgib iga ettepaneku **aktsepteeritud / ei**. Mustand liigub edasi-tagasi kuni **kõik punktid aktsepteeritud**.
- **Reegel:** aktsepteeritud muudatus lisatakse automaatselt **eritingimustesse (Lisa 3)**; üldtingimuste teksti ei muudeta kunagi (eritingimus on ülimuslik). Tekkiv eritingimuse punkt **viitab väljaga `kirjutab_üle`** sellele üld-/põhipunktile, mille ta üle kirjutab — nii on ülimuslikkus masinloetav ja dokument saab kuvada seose („§X, muudetud Lisa 3 p Y"). **Operaator saab mustandis muuta põhitingimusi** (nt korrigeerida tehinguandmeid, lisada osapoolte **lisakontaktandmeid**, mis pakkumises ei kajastu) **ja eritingimusi (Lisa 3)**; **üldtingimused on lukus** (erinevalt pakkumusest, mis on täiesti vabas vormis).
- **Lepingu loomine 0-st** (mitte pakkumusest): kliendi nimi → äriregistri autotäide + vajadusel riskiraport → pind valitakse (tuleb kaasa Lisa 1 + Lisa 2) → mustand V1 → eritingimuste kokkulepe → mõlema aktsept → allkirjastamine.

### 06 — Allkirjastamine
- Digitaalne allkirjastamine ThinkOne portaalis.
- **Konteiner 1:** üürileping + pinnaplaan + parkimisplaan. **Konteiner 2:** lisa (eritingimused).
- Meetodid: **SmartID / Mobile-ID / eIDAS**.

### 07 — Arhiveerimine + võtmekuupäevad
- Allkirjastatud leping → **arhiiv**.
- **Võtmekuupäevad kalendrisse**: algus, lõpp, **indekseerimine**, + teavitus x päeva ette.
- **Indekseerimine järgib lepingut**: indekseerimismeetod lepitakse kokku **üürilepingus endas** ja salvestatakse lepingu parameetrina (meetod, määr/protsent või indeksi tüüp, sagedus, järgmine indekseerimiskuupäev). Toetatud on **kaks meetodit**: **(a) fikseeritud %-määr** — sisemine arvutus, väline allikas pole vajalik; **(b) Statistikaameti indeks** (nt tarbijahinnaindeks) — kasutatakse teatud lepingutes, mis seovad üüri välise indeksiga.
- **Korraline indekseerimine ei nõua lepingu muudatust**: kuna indekseerimine on lepingus juba sätestatud, **ei teki uut lisa ega allkirjastamist**. Võtmekuupäeval süsteem arvutab uue üüri kokkulepitud meetodi alusel (indeksi korral Statistikaametist võetud muutuse põhjal), **rakendab selle automaatselt**, logib audit trail'i ja **teavitab pooli** (operaator + klient).
- **Erand — indekseerimise erikokkulepe**: kui pooled lepivad kokku lepingus sätestatust **erineva** käitumise — nt jätavad indekseerimise mõneks aastaks **vahele** või muudavad määra/meetodit — vormistatakse see **muudatusena** (uus Lisa nr, etapp 08 voog: kinnitus → aktsept → allkirjastamine).
- **Lepingu lõppemine**: tähtaja lõpp on **automaatne** võtmekuupäeva-üleminek (`Arhiveeritud → Lõppenud`), uut lisa ei teki. **Ennetähtaegne lõpetamine** (poolte kokkuleppel/etteteatamisega) vormistatakse **muudatusena** (uus Lisa nr, etapp 08 voog: kinnitus → aktsept → allkirjastamine), misjärel leping läheb olekusse **Ennetähtaegselt lõpetatud**.
- **Audit trail**: kogu tsükkel — kõik dokumendi versioonid, allkirjastatud versioonid, kogu kommunikatsioon. **1-klikiga eksport** (nt kohtulahendite tarbeks).

### 08 — Üürilepingu muudatus
- Muudatused tehakse **alati eritingimustes**. Iga muudatus → **järgmine lisa nr** (Lisa 3 → 4 → 5 …).
- Sama voog: muudatus kliendile kinnitamiseks → peab saama aktsepteeritud → allkirjastamine.
- **Ka lepingu ennetähtaegne lõpetamine** kasutab sama muudatuse-voogu (uus Lisa nr) ning viib lepingu lõppolekusse **Ennetähtaegselt lõpetatud**. Üürnik saab vajadusel teha läbi süsteemi ettepaneku lepingu muudatusteks.

## AI-agent (platvormi „aju")

Platvormi keskmes on **ise-majutatud avatud keelemudel** (nt Qwen3.5-35B-A3B), mis jookseb **omas serveris** — tundlikud kliendi- ja lepinguandmed ei lahku majast. Mudel toimib **agendina**: mõistab vabas vormis korraldusi, tuvastab vajalikud olemid ja käivitab õiged töövoo-sammud, lihtsustades operaatori tööd.

### Vestlusaken (sisendkanal)
Dashboardil on **vabas vormis vestlusaken** korralduste ja küsimuste jaoks.

- **Toiming (näide):** *„Loo pakkumine ettevõttele Future Invest OÜ, Hoone T6B pind 12."* → agent tuvastab kliendi (Future Invest OÜ), objekti (Hoone T6B) ja pinna (nr 12), koostab pakkumuse mustandi õigete andmetega ja **käivitab pakkumise protsessi** (etapp 04).
- **Küsimus (näide):** *„Mis seisus on Future Invest OÜ lepingud ja millal on järgmine indekseerimine?"* → agent vastab Decision Memory / Audit Trail põhjal.

### Mida agent oskab (funktsionaalsel tasandil)
- **Toimingute käivitamine korralduse põhjal** — samad töövood mis käsitsi (etapid 02–08): loo pakkumine, loo üürileping, alusta muudatust, telli riskiraport, lisa objekt/pind.
- **Olemite tuvastus ja eeltäide** — leiab korraldusest ettevõtte, objekti, pinna(d), perioodi jms; puuduoleva küsib üle.
- **Q&A oma andmete üle** — vastab operaatori objektide, pakkumuste, lepingute ja võtmekuupäevade kohta (Decision Memory + Audit Trail).
- **Mustandite ja soovituste koostamine** — nt eritingimuste sõnastus, läbirääkimise kokkuvõte, pakkumuse kommertsteksti mustand (operaator kinnitab/muudab).

### Reeglid ja inimkontroll
- Agent **kasutab samu ärireegleid ja olekumasinaid** mis käsitsi töövoog — ülimuslikkuse ja lukustuse reeglid kehtivad (eritingimused Lisa 3, üldtingimused lukus).
- **Tagajärgedega sammud (saatmine, allkirjastamine) nõuavad operaatori kinnitust** — agent valmistab ette, operaator vaatab üle ja kinnitab (human-in-the-loop).
- Mitmeti mõistetava korralduse korral agent **täpsustab** (nt mitu sobivat pinda → küsib, millist).
- Iga agendi tehtud samm **logitakse Audit Trail'i** (sh „agent operaatori korraldusel").

### Andmed ja privaatsus
- Mudel on **ise-majutatud** (avatud mudel omas serveris) → andmed ei liigu kolmandate osapoolte teenustesse.
- Agent näeb ainult **operaatori õiguste piires** olevaid andmeid (sama ligipääsuloogika mis kasutajal).

## Olekumasinad

**Hinnapakkumine:** `Mustand → Saadetud → (Kliendi ettepanek → Operaatori läbivaatus → Saadetud)* → Aktsepteeritud → Lepingu(te)ks teisendatud`
- Lõppolekud (negatiivsed): `Saadetud`/läbirääkimine → **`Tagasi lükatud`** (klient keeldub) | **`Aegunud`** (kehtivusaeg möödus, automaatne) | **`Tühistatud`** (operaator katkestab enne aktsepti). Neist edasi lepingut ei teki.

**Leping / Lisa:** `Mustand V1 → Saadetud → (Kommentaarid/ettepanekud → Operaatori läbivaatus → Saadetud)* → Kõik punktid aktsepteeritud → Allkirjastamisel → Allkirjastatud → Arhiveeritud`. Muudatus (etapp 08) taaskäivitab sama tsükli uue lisaga. **Korraline indekseerimine rakendub automaatselt ilma uue lisata**; ainult indekseerimise erikokkulepe (nt vahelejätmine) läbib etapp 08 voo.
- Enne allkirjastamist (Mustand/Saadetud): kumbki pool katkestab → **`Tühistatud`** (lõppolek).
- Pärast arhiveerimist (aktiivne leping): tähtaja lõpp → **`Lõppenud`** (automaatne, võtmekuupäeva-põhine); ennetähtaegne lõpetamine (etapp 08 muudatuse-voog) → **`Ennetähtaegselt lõpetatud`**.

## Lisade numeratsioon (lepingu kohta)
- **Lisa 1:** pinnaplaan (selle lepingu pinna kohta)
- **Lisa 2:** asendiplaan + parkimisskeem
- **Lisa 3:** eritingimused (esimene)
- **Lisa 4, 5, …:** iga järgnev muudatus (sh indekseerimise erikokkulepe; korraline indekseerimine lisa ei tekita)

## Hinnastus ja käibemaks
- **Üür** (pinna kohta, kuus) = `üüripind m² × hind €/m²`.
- **Kõrvalkulu** (informatiivne, hooajaline) = `üüripind m² × kõrvalkulu €/m²` — talvine ja suvine eraldi (allikas Moderan, objekti tasemel).
- **Elektrivõimsus** imporditakse **pinnaandmetega** (iga pinna kohta, CSV/Excel import-mallis koos teiste pinna väljadega); vajadusel käsitsi parandatav.
- Kõik hinnad salvestatakse **käibemaksuta (neto)**.
- Objekti tasemel väli **`käibemaksuga_maksustatud?`** (ärikinnisvara KM-kohustus on vabatahtlik; pärandub lepingusse). Kui jah → pakkumus/leping kuvab **neto + käibemaks (Eesti standardmäär) + bruto**; kui ei → kuvatakse netos.
- **Lepingu kogusumma** (kuus) = üür + kõrvalkulu kokku; kuvatakse vastavalt KM-seadistusele.

## Välised andmesõltuvused (funktsionaalsel tasandil)
e-äriregister (ettevõtte autotäide) · **EHR ehitisregister (hoone baasandmete autotäide)** · Moderan (kõrvalkulu) · Krediidiinfo · Inforegister · Kohtutäitur · Äriregister (riskiraport) · **Statistikaamet (indekseerimine — indeksipõhise meetodi korral)** · SmartID/Mobile-ID/eIDAS (allkirjastamine) · e-post/teavitused. *(Indekseerimine: fikseeritud %-määra korral sisemine; teatud lepingutes seotud Statistikaameti indeksiga.)*

## Teavitused
- Kanalid: rakendusesisene + e-post (klient ja operaator).
- Käivitajad: pakkumus/leping saadetud, kommentaar lisatud, aktsept, allkirjastamise kutse, võtmekuupäev x päeva ees (sh indekseerimine).
