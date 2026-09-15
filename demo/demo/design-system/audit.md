# ThinkOne · UI audit ja kujundussüsteemi ettepanek

Kuupäev: 10.09.2026 · alus: demo v420 · staatus: **RAKENDATUD v421** (kasutaja otsus: petrooleum kõigile põhitegevustele, fondid Inter + Bricolage; vt HANDOFF.md)

## Ulatus ja lähtekoht

ThinkOne on lepingutöövoo demo: kinnisvaraportfell, pakkumused, läbirääkimised ja lepingud, lisaks personalisuund. Kasutajarollid on operaator ja klient/üürnik. Lähtun töölaudadest igapäevaseks tööks ning telefonist dokumentide ja tegevuste jälgimiseks; see on olemasolevast tootest tuletatud eeldus.

Tehnoloogia on raamistikuvaba HTML/CSS/JavaScript SPA. Säilib olemasolev teostus, sõltuvusi ei lisata. Säilivad tekstid, äriloogika, andmed, dokumendisisu, rollid ja teekonnad. Ainult hele teema.

Lähtekoodis vaadati üle kõik 23 View-vaadet, objekti lisamise/muutmise voog ning ühised komponendid; ruuteris on 26 kirjet. Lisaks kontrolliti kujundusgalerii ja kahe eraldiseisva näitelehe stiiliisolatsiooni. Brauseris mõõdeti 22 esinduslikku aadressi töölaual ja 320 px laiuses ning kuut vaadet 768 px laiuses. Operaatori kõrval kontrolliti kliendiportaali. See ei ole kõigi andme-, õiguste-, laadimis- ja veaseisundite täielik läbimäng: native üüri- ja töölepingu detailide kontroll tugineb osaliselt lähtekoodile ja galeriile, sest testandmetes polnud vastavaid kirjeid. Selleks uusi ärikirjeid ei loodud.

**Praegu ei ole rakenduse faile muudetud.** Kõrvalolev tokenifail ei ole rakendusega ühendatud.

## 1. Praeguste variantide inventuur

Täielik leitud väärtuste loend koos näidisselektorite, esinemisarvude ja lähteridadega: [inventory.json](inventory.json). Allolevad arvud kirjeldavad kirjapildilt erinevaid CSS-väärtusi, mitte sama suurt arvu iseseisvaid disainivalikuid. Dünaamiline geomeetria ja dokumendi vormistus ei ole automaatselt vead.

| Valdkond | Praegu kasutusel | Vastuolu / mõju |
| --- | --- | --- |
| Nupud | 6 üldist välimust: primary, accent, green, ghost, soft, quiet; base ja sm; lisaks loomise-, saatmise-, rea-, filtri-, manuse- ja allkirjastamisnupud | Must, petrooleum ja roheline konkureerivad põhitegevusena. Puudub terviklik sm/md/lg ja olekute süsteem. |
| Nupu mõõt | Tavaline ligikaudu 35–40 px, väike 32 px; ikoonitoimingud muu hulgas 28, 36 ja 42 px | Kõrgus muutub ikooni/sisu järgi. .btn:has(svg) muudab ka külgpolstrit. Telefonis pole 44 px miinimum tagatud. |
| Värvid | 51 juurtokenit kokku; põhistiilis 108 värviavaldiste kirjapilti, sh läbipaistvused | Neutraalid, aktsendivariandid ja varjud korduvad. Sama värv teenib tegevust, staatust ja kategooriat. |
| Kirjaperekonnad | Laetakse Inter, Inter Tight, Bricolage Grotesque ja Geist Mono; tegelikud põhivalikud on Inter/Bricolage/Geist | Projektijuhis ja rakendus on lahknenud. Inter Tight jääb varufondiks; nelja veebifondi pole vaja. |
| Kirjasuurus | 32 väärtust, neist üks 0; 8–58 px ning clamp(28px, 3.2vw, 42px); palju 0,5 px vahesid | 9/9,5/10/10,5/11/11,5 px mikrotekst ning 13/13,5/14/14,5/15/15,5 px dubleerivad rolle. |
| Kirjakaal | 400, 450, 500, 550, 600, 650, 700 | Sama taseme siltidel eri kaalud; btn-soft 700, tavanupp 600. |
| Raadiused | 26 väärtusekirjeldust; juurtokenid 8/10/12/14 px, kohalikud 2–24 px ning 99/999 px/50% ja liitnurgad | Kontrollide, kaartide ja kiipide nurgad ei väljenda kindlat hierarhiat. |
| Vahed | 156 padding-kombinatsiooni, 27 gap-väärtust; puudub ühine vahede skaala | Kõrvuti elemendid ei joondu. Korduvad 5/6/7/9/11/13/15/17/19/22/26 px valikud. |
| Varjud | 3 juurtaset, kuid 48 shadow-väärtusekirjeldust | Kaardid, nupud, teated ja hüpikaknad kasutavad eraldi varjuretsepte. |
| Staatused | .pill: green/amber/red/blue/teal/grey/accent/ink; eraldi täidetud Lahendamisel | Oleku tähendus, tähelepanuprioriteet ja visuaalne tugevus on ühte klassi segatud. |
| Märgendid | .tag + lime/lav; rolli-, allika- ja loendurikiibid, kohtpõhised staatuseülekirjutused | lime on tegelikult petrooleum, lav roheline; suurus, kaal, täide ja nurgad erinevad. |
| Sisendid | .field, .fact-in, .rep-in, .price-in, .ce-in, .eri-in, .prose-in; otsingud ja vestluskastid; seadete inline-väljad | Tavalised väljad umbes 41–43 px, tekstisisesed 25–27 px; eri servad, polstrid ja fookus. |
| Valikud | .field select, eraldi seadete select, brauseri checkbox, .obj-check, valiku- ja allkirjastamiskaardid | Puudub ühtne check/radio/switch mõõdustik ja vea-/disabled-/fookuskeel. Uut lülitit ei lisata sinna, kus seda pole. |
| Liikumine | 55 transition- ja 21 animation-väärtusekirjeldust | Kestused on laiali; sisenemine ja väljumine pole paaris. Olemas on ka püsiv drift/pulse. |
| Kohalikud stiilid | app.js-is 716 style-atribuudi esinemist, neist 20 nuppudel | Komponentide väljanägemist dubleeritakse mallides. Osa on põhjendatud arvutatud mõõdud või dokumendisisu, mitte eemaldatav viga. |

Põhivärvide praegused perekonnad: valged/hallid (#FFFFFF, #F6F5F3, #F0F0EE, #E9E9E7, #D9D9D6), tekst (#161512, #454542, #666762, #70716B, #515151), petrooleum (#006566, #005455, #005758), soojad nn accent-soft toonid (#EEEBE6, #E4E0DA), kaks musta gradienti ning OKLCH roheline/ooker/punane/sinine/petrooleum koos pehmete ja tumedate harudega. Täpne täielik loend on inventuurifailis.

## 2. Olulised leiud ja prioriteet

### P1 · esmalt kasutatavus

1. **Mobiilis päris ülevool.** 320 px vaateaknas on lehe mõõdetud laius: Ülevaade 451, Portfell 328, Lepingud 392, Seaded 408, pakkumuse detail 448, pakkumuse mustand 444, pakkumuse dokument 428 ja objekt 641 px. 768 px juures: Ülevaade 825, Portfell 857 ja objekt 895 px. 1440 px kontrollis kogu lehe ülevoolu ei leitud. Pakkumuste tabel on lisaks sisemiselt vähemalt 780 px lai umbes 283 px konteineris; lehe ülevoolu puudumine üksi ei tähenda head mobiilivaadet.
2. **Osa väikese teksti kontrastist ei vasta AA-le.** Praegune --amber valgel annab 4,36:1; --green ja --teal lõuendil umbes 4,39:1; --blue pehmel pinnal 4,47:1; --faint pehmel pinnal 4,32:1. Need pole suure teksti erandid: staatuse tekst on 11 px. Tavalise teksti nõue on vähemalt 4,5:1. [WCAG teksti kontrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
3. **Kontrollide tabamisala ja fookus pole ühtsed.** Mobiilis on 28–42 px juhtnuppe. Globaalne sisendite outline'i eemaldamine eeldab lokaalset asendust, mida näiteks inline-stiiliga seadete väljadel ei saa ühtselt eeldada. Vaja on kontrollida kogu klaviatuuriteekonda. Nõutud 44 px mobiilsiht on selle projekti nõue; WCAG 2.2 AA baaskriteerium on 24 px koos eranditega. [WCAG sihtala](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
4. **Madalad servakontrastid.** Pehmel taustal läbipaistva servaga väljad ja väga heledad piirjooned ei anna alati piisavat kontrolli kontuuri. Olulise kontrollipiiri siht on vähemalt 3:1; dekoratiivne kaardiserv võib jääda peeneks. [WCAG mittetekstiline kontrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

### P2 · süsteemi järjepidevus

- **Kujundusgalerii pole usaldusväärne lähteallikas.** Näiteks Allkirjastamisel on galeriis sinine, rakenduses ooker; Tühistatud hall versus punane; Pakkumusel sinine versus petrooleum; Lepingus ooker versus sinine. Galerii peab tulevikus kasutama sama olekukaarti ja komponente.
- **Nupu olekud pole täielikult koondatud.** Põhinupul on hover/active olemas, kuid disabled ei välista kõiki hover-efekte ning puudub ühine laadimisolek. Praegune ghost on sisuliselt valge äärisega secondary; quiet on eraldi destruktiivne välimus.
- **CSS-i kihistus tekitab päris vigu.** .cl-side hilisem sticky-deklaratsioon tühistab varasema väikse ekraani static-reegli. Objekti voos on border-top/bottom: 1px solid var(--edge), kuigi --edge sisaldab juba kogu servadeklaratsiooni; tulemus on vigane.
- **Ülekatete käitumine erineb.** Dropdown'id ja PDF-modaal kasutavad display-vahetust; sisenemisanimatsioonil pole järjepidevat väljumispaari. Sahtel kasutab teist lahendust. Teate teksti nowrap/ellipsis võib olulise tagasiside ära lõigata.
- **Kitsal vaatel kohandumine on fragmentaarne.** Külgriba sulgub alles 760 px juures; fikseeritud tabelid, kaheveerulised vormid ja dokumendipolstrid vajavad sisupõhist murdumist.
- **Hooldatavus.** --accent-soft-2 ja --blue-soft ei saanud kontrollitud runtime-failides kasutusviidet. Need on eemaldamiskandidaadid, mitte selles etapis kustutatud tokenid. Kohalikke stiile tuleb liigitada, mitte pimesi massiliselt eemaldada.

### Mis juba töötab ja säilib

Valged kaardid ja soe hele lõuend; olemasolev petrooleum; selge külgnavigatsioon; staatuste tekst ja edenemisikoonid; üldine prefers-reduced-motion kaitse; prindivaate eraldus. Uue lepingu illustratsioonikaardid jäävad valgeks ka hover'il: pehme vari, nool veidi paremale ja illustratsiooni kerge päripäevane pööre. Pilte, kompaktset mõõtu ega senist paigutust selle auditi käigus ei muudeta.

## 3. Pakutav tokenikomplekt

Kavand: [tokens.proposed.css](tokens.proposed.css). Kasutusreeglid: [style-guide.proposed.md](style-guide.proposed.md).

| Roll | Väärtus / reegel | Põhjendus |
| --- | --- | --- |
| Primary | #006566; hover #005455; pehme valikupind #EAF2F0 | Üks aktsent kõigile põhitegevustele. See asendaks musta ja rohelise põhitegevuse konkurentsi; vajab kinnitust. Logo ja põhitekst jäävad süsimustaks. |
| Neutraalid, 7 astet | #FFFFFF / #F6F5F3 / #ECECEA / #D6D6D2 / #85857F / #60605B / #161512 | Vastavalt pind, lõuend, hover/pehme pind, eraldaja, kontrolliserv, teisene tekst, põhitekst. |
| Success | #246747 / #EEF6F1 | Edu või kehtiv olek, mitte üldine kinnitamisnupu värv. |
| Warning | #805719 / #FBF4E8 | Ootab tähelepanu/kinnitust; paremini loetav ooker. |
| Error | #A12B35 / #FBEEF0 | Viga või destruktiivne tegevus. |
| Info | #345F9A / #EDF3FA | Informatiivne olek; kategooriaid ei värvita automaatselt siniseks. |
| Fondid | Inter kasutajaliideses; Bricolage Grotesque pealkirjades | Säilitab praeguse iseloomu kahe fondiga. Mõõtarvud Inter tabular-nums, ilma eraldi monofondita. |
| Tüpograafia | 12/14/16/20/24/32 px, read 16/20/24/28/32/40 px; kaalud 400/500/600 | Kuus kindlat rolli, ära kaovad murd-pikslised vaheastmed. |
| Vahed | 0/4/8/12/16/20/24/32/40/48/64 px | Üks 4 px alusega skaala; jooned ja optiline ikoonigeomeetria pole paigutusvahed. |
| Raadiused | 4/8/12 px | Märgend/check, kontroll, kaart/ülekate. Ringikujuline ikoon/avatar on eraldi geomeetria, mitte uus kaardistiil. |
| Varjud | 3 taset | Pind, hover/dropdown, modaal; üks soe varjutoon. Mitte vari iga elemendi ümber. |
| Liikumine | 150/250/400 ms; ühine ease ja exit | Hover/fookus, ülekatted, vajadusel sektsiooni orientatsioon. 400 ms ei lisandu igale navigeerimisele. |

Pakutavate paaride arvutus: valge tekst primary-taustal 6,88:1; teisene tekst pehmel neutraalsel pinnal 5,34:1; semantilised tekstid oma taustal 5,79–6,38:1; kontrolliserv valgel 3,71:1 ja lõuendil 3,41:1. Need on kindlate värvipaaride kontrollid, mitte kogu saidi ligipääsetavuse sertifikaat. Läbipaistvused, pildid, fookuse taustad ja päris olekud kontrollitakse rakendamisel uuesti.

## 4. Ühiste komponentide kavand

- **Button:** primary, secondary, ghost, destructive; sm/md/lg kõrgusega 32/40/48 px ja külgpolstriga 12/16/20 px. Mobiilis sm/md vähemalt 44 px. Ikoon ei muuda mõõtu. Kõigil default, hover, active, focus-visible, disabled ja loading; loading ei muuda nupu laiust ega käivita tegevust teist korda.
- **Badge:** üks komponent, viis semantilist varianti; 12 px tekst, 24 px miinimumkõrgus, 4 px raadius. Säilivad olemasolevad olekusildid ja tähenduslikud ikoonid. Kategooriasilt on neutraalne. Olekukaart on ühine galeriiga; tähelepanuprioriteeti ei lahendata enam ühe erandliku musta kapsliga.
- **Field:** sisend, select ja textarea jagavad servi, fookust, tüpograafiat ja olekuid. Üherealiste kõrgused vastavad nuppudele. Mobiilis sisendi tekst 16 px; check/radio/switch saavad vähemalt 44 px sildiga tabamisala. Olemasolevaid veateateid ei kirjutata ümber.
- **Pinnad:** kaardi ja modaali raadius 12 px; tavapolster 24 px, mobiilis 16 px. Dropdown kasutab sama serva ja varjutaset; toast on hele ning tekst saab murduda. Tabeli joondus, reavahed ja sorteerimis-/filtritoimingud on ühised.
- **Responsiivsus:** külgriba läheb sahtliks kuni 1024 px; vormid murduvad sisu järgi. Tabelid muutuvad kitsal vaatel sildistatud kirjeteks, säilitades kõik andmed ja tegevused, ilma külgsuunalise kerimise nõudeta. Dokumendi ekraanivaade kohandub, trükivaade ja prinditav sisu säilivad.
- **Liikumine:** hover/press/fookus, ülekate sisse ja välja, ainult päris laadimisega seotud skeleton. Ei lisata dekoratiivset püsiliikumist. Reduced-motion lülitab nihked ja pöörded välja; sisu ei jää animatsiooni taha peitu.

## 5. Vaadete kaupa: praegu → kavandatud tulemus

See on **enne / kavandatud pärast**, mitte väide valmis refaktori kohta. Kõigile ridadele lisanduvad eespool kirjeldatud ühised komponendid.

| Vaade | Praegu / fookus | Kavandatud pärast |
| --- | --- | --- |
| Ühine kest ja navigatsioon | Eri loomise-, otsingu- ja ikooninupud; hiline mobiilimurre | Ühised kontrollid, selge aktiivne navigeerimine, 44 px tabamisalad ja varasem sahtel |
| Avaleht | Eraldi composer/preset/nupuretseptid, mitmed tekstiskaalad | Säilib AI-keskne kompositsioon; ühtsed sisendid, tegevused ja rahulikum liikumine |
| Ülevaade | 320 ja 768 px juures ülevool; metriikide eri rõhutused | Murdvad sektsioonid, ühine arvude ja pealkirjade hierarhia |
| Portfell | Kaardi/tabeli režiimidel eri stiilid; ülevool | Sama filter ja staatus; kitsal ekraanil loetavad kirjed |
| Esemeregister | Tihedad tabelid ja väikesed märgendid | Ühised tabeliread, fondid, kategooriad ja mobiilikirjed |
| Objekt | Suurim mõõdetud ülevool; mitut tüüpi väiketoimingud | Üheveeruline mobiilipaigutus, murduvad andmeplokid ja üks esmane tegevus |
| Lisa objekt | Hiljem lisatud eraldi väljad/servareeglid | Ühised vormikontrollid, sammud ja veaseisundid; vigase servadeklaratsiooni parandus |
| Objekti seaded | Jagab lisamisvoogu; eraldi salvestus-/manusekontrollid | Sama vormisüsteem lisamisvooga; andmete salvestamine ei muutu |
| Pakkumised | Vähemalt 780 px sisetabel | Ühine tabel, mobiilis sildistatud kirjed ja nähtavad põhitegevused |
| Pakkumuse detail ja läbirääkimine | Kolm täidetud nupuvärvi, mikrotoimingud, kitsas külgpaan | Selge põhitegevus, ühtne vastamisrida ja kohanduv külgpaan; sama läbirääkimisloogika |
| Pakkumuse dokument | Paberi mõõdud/polster tekitavad telefonis ülevoolu | Ekraanil loetav dokument ja ühtne tööriistariba; trükipaigutus säilib |
| Koosta hinnapakkumine | Must/petrooleum tegevuste segu, inline-vormierandid | Ühtsed väljad, sammude hierarhia ja nupud |
| Lepingute loend | Eri lepinguplokkide tihedus ja 320 px ülevool | Sama loendireegel kõikidele lepinguliikidele |
| Üürilepingu detail | Eraldi redaktori-, punkti-, kinnitamis- ja allkirjanupud | Ühine kontrollisüsteem; dokument ja täpsed toimingud säilivad; runtime-kontroll vajab sobivat testkirjet |
| Töölepingu detail | Oma detail-/manusekujundus | Sama detailraam ja olekud; runtime-kontroll vajab sobivat testkirjet |
| Imporditud leping | Dokumendivalik, punktiredaktor ja muudatusringide eri nupud | Ühised tabs/tegevused/olekud, säilitades algdokumendi ja muudatuste sisu |
| Koosta leping | Illustratsioonikaardid juba sobivas valges suunas | Säilib kompaktne valge kaart, vari, noole nihe ja pildi pööre; ühtlustub ülejäänud vorm |
| Risk | Eraldi värviharud ja tihe allikate tabel | Kontrastsed semantilised olekud, sama otsing ja mobiilikirjed |
| Kalender | Eraldi kuupäeva-/filtrikiibid ja mininupud | Ühine juhtimisrida ja puutemõõdud; olemasolevate kuuvaate/nimekirja andmed säilivad |
| Tegevuste jälg | Väike metatekst ja eri loendirütm | Ühine ajajoone tüpograafia ja vahed; sündmusi ei muudeta |
| Kliendiportaal / Minu dokumendid | Oma composer ja mitu loendistiili | Sama süsteem kui operaatoril; kliendi õigused ja tegevused säilivad |
| Kliendi detail | Mitu eraldi tihedat tabeliplokki | Ühine kokkuvõte, andmerütm ja mobiilikirjed |
| Osapooled | Tabeli sisu võib kitsal ekraanil peituda | Kõik väljad säilivad sildistatud mobiilikirjetes |
| Suhtlus | Veel üks composer ja filtrinuppude perekond | Sama sisendi- ja saatmiskontroll, ühtne sõnumirütm |
| AI-agent | Eraldi saatmis- ja kinnitamis-/keeldumisnupud | Sama composer, ühine primary/destructive ning laadimisolek |
| Seaded | Palju inline-välju, erinev fookus, 408 px laius telefonis | Ühine vorm, vead, check/radio ja salvestusnupud; ettevõtte dokumendivärvid jäävad sisuks |
| Kujundusgalerii | Dubleerib staatuseid ja erineb rakendusest | Elav stiilijuhend päris komponentide ja sama olekukaardiga |
| Avalehe variandid / pakkumuse näiteleht | Isoleeritud katsetuste stiilid | Selgelt katsenäited, mitte teine tootmise disainisüsteem; ei kustutata ilma eraldi otsuseta |

## 6. Rakendamise järjekord pärast kinnitust

1. Ühised tokenid, Button/Badge/Field ja tegelikke komponente kasutav galerii.
2. Ühine kest, navigatsioon, vormid, tabelid ja kõige suurema ülevooluga vaated.
3. Pakkumuste/lepingute detailid ja ülejäänud vaated; CSS-erandite eemaldamine komponentide kaupa.
4. Mõõdud 320/375/768/1024/1440+; klaviatuur, fookus, hover/active/disabled/loading/error, reduced-motion, mõlemad rollid ja prindivaade. Alles siis tegelik enne/pärast kokkuvõte iga vaate kohta.

Kinnitamiseks on eelkõige üks brändiotsus: **kas kõik üldised põhitegevused võivad minna ühtsele petrooleumtäitele**, asendades praeguse musta/rohelise/petrooleumi jaotuse? Ülejäänud ettepanek säilitab ThinkOne'i heleda, valgete kaartidega üldsuuna.
