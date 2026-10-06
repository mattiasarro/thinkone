# ThinkOne — demokeskkond

Lepingutöövoo platvormi **interaktiivne demo** funktsionaalspetsifikatsiooni **v2** järgi:
kaks sammast (esemeregister + lepingumootor), mida ühendab hõive; kaks vertikaali samal
mootoril (ärikinnisvara üürilepingud + töölepingud); olemasolevate lepingute import.
Päris andmed projektikaustast: **Üürileandja/tööandja Taevavärava OÜ**, **Hoone T6B**
(Rae vald), pinnad ja üürilepingupõhi.

## Avamine

Topeltklõps failil **`index.html`** — avaneb brauseris. Build'i ega serverit pole vaja
(staatiline HTML/CSS/JS, töötab ka võrguta; fondid laetakse Google Fontsist, kui internet on,
muidu langeb tagasi Segoe UI peale).

## Mida demos näeb

Navigatsioon jaguneb viie igavese küsimuse järgi: **Avaleht** (mida ma täna tegema pean? — AI),
**Ülevaade** (kuidas meil läheb? — täituvus, töösolev, portfelli tervis), **Portfell** (mis meil
on ja kellega? — esemeregister, pakkumised, lepingud, osapooled, dokumendid), **Kalender**
(mis millal juhtub?) ja **Suhtlus** (mida osapooled ütlevad? — kogu lepingusuhtlus koos).

| Vaade | Spetsi osa | Sisu |
|-------|-----------|------|
| **Dashboard** | 03 | Minimaalne, AI-agent fookuses: tervitus + suur sisend + näidiskiibid + 4 põhinuppu; „Vajab tegevust täna" peidus kellanupu ja koondnumbri taga (avaneb klikiga) |
| **Esemeregister** | Kaks sammast | Täituvuse joongraafik kuude lõikes (jooksev kuu hõivetest); konteinerid hoonete kaupa + osakond (ametikohad); hõive = projektsioon, headcount = kvoothõive |
| **Hoone T6B pinnad** | 02 | EHR baasandmed, 34 pinda t6b.ee kodulehelt (29 pinda + 5 bürood, päris m² ja jaotus), igal pinnal oma plaan (Lisa 1), kõrvalkulu, KM-seadistus |
| **Parkimiskohad** | 02 | Eraldi ese hoone küljes: 115 kohta parkimisplaanilt, register olekuvärvidega; pakkumuses/lepingus kohad plaanilt → Lisa 2 genereeritakse |
| **Pakkumised** | 04 | Olekumasin, (a) vabatekst + (b) eritingimused, hinnastus KM-iga, astmeline üür, jagamislink kliendile (kontota, kehtib pakkumuse aja) |
| **Lepingud** | 05–08 | Kolm sektsiooni: üürilepingud (klausli-dokument: üld lukus / põhi / eri Lisa 3, `kirjutab_üle`, allkirjastamine) · **töölepingud** (sama klauslimudel, katseaeg/palgaülevaatus, TÖR-adapter post-MVP) · **imporditud lepingud** (originaal = õiguslik tõde) |
| **Riskiraport** | 04 | Päris avaandmed (Äriregister + EMTA, `riskiandmed.js`), reeglipõhine skoor KÕRGE/KESKMINE/MADAL |
| **Võtmekuupäevad** | 07 | Indekseerimine (automaatne vs erikokkulepe), algus/lõpp (teavitus 90 p ette), katseaeg, palgaülevaatus — kõik vertikaalid ühes vaates |
| **Audit trail** | — | Decision Memory, 1-klikiga eksport |

### Soovituslik demo-teekond
Algseis (pärast „Lähtesta demo"): üks kehtiv leping (**LEP-2026-001**, Killa Distribution OÜ · Pind 4), kuus pakkumust
eri olekutes ja kaks imporditud lepingut (AS Maru Ehitus, Caverion Eesti AS). Töölepingute vertikaal on MVP-s väljas.

1. **Avalehel** küsi AI-agendilt *„Loo pakkumine Future Invest OÜ-le, pind 22"* → **Ava pakkumuse mustand** → määra parkimiskohad plaanil → **Kinnita ja saada**.
2. **Portfell → Pakkumused**: roheline riba näitab, mis vajab tegevust — **Vasta kliendile** (Osaühing ONRY ettepanek) · **Loo leping** (Osaühing Maatrans).
3. **Lepingu mustand**: faktid lausetes, parkimiskohad plaanilt (P 2.2) → **Saada üürnikule** → **Vaata üürnikuna** (A4, punktid klõpsatavad) → kommenteeri → lahenda paremas paanis → allkirjasta mõlemalt poolelt.
4. **Portfell → Lepingud → LEP-2026-001**: kehtiv leping — dokumendivalija ribal, Lisa 2 parkimisplaan, **Vaheta kohti** (ajalugu), muudatused.
5. **Portfell → Lepingud → LEP-2023-029** (AS Maru Ehitus): imporditud leping — klauslikiht on indeks, originaal on õiguslik tõde; osaleb Q&A-s ja kalendris.
6. **Portfell → Esemed → Hoone T6B**: pinnad (klõps avab dokumendi) ja parkimisregister.

### Lisavõimalused
- **Mitu ettevõtet ühe konto all** (spets etapp 01): külgriba kontekstikaardil saab vahetada
  aktiivset ettevõtet — Taevavärava OÜ (Hoone T6B, täisportfell) ↔ **B11G OÜ** (hiljuti kontole
  lisatud, vana portfell imporditud — üürileping + hooldusleping, uusi lepinguid platvormis veel
  pole). Kummagi ettevõtte sisestused püsivad eraldi.
- **Mitu hoonet ühe ettevõtte all** (Ettevõte → Objekt 1..n): B11G OÜ-l on samal aadressil
  (Betooni 11g) kaks hoonet — **Stock Office** (laod-kontorid) ja **Self Storage** (laoboksid,
  oma lepingumall). Esemeregister näitab mõlemat konteinerina, objektivaates saab hoonete
  vahel lülituda; pakkumuse wizard pakub mõlema hoone pindu koos hoone märgisega.
- **Täielik operaator↔klient tsükkel**: pakkumus → jagamislink → kliendi vaade (kommentaar / ettepanek / aktsept / keeldumine) → leping → allkirjastamine. Rollivahetus külgribalt või „Ava kliendilink" nupust.
- **Astmeline üür** pakkumuses (+ hinnaperiood) — genereerib automaatse eritingimuse, mis voolab lepingu Lisa 3-e.
- **Uus leping** (Lepingud → nupp): üürnik (autotäide) → pind → põhitingimused → Mustand V1.
- **Üldtingimuste täistekst** — 18 jagu / 114 punkti ekstraktitud otse failist `Üürileping.docx`, kuvatakse akordionina (lukus).
- **Lisad on vaadatavad** — Lisa 1 (pinna oma plaan) avaneb täisekraanil PDF-ina, Lisa 2 (parkimiskohad) on plaanilt genereeritud; pakkumusest on **prinditav dokumendieelvaade** (T6B logo, salvesta PDF-iks).

## Failistruktuur

- `index.html` — kest (sidebar + ThinkOne logo, topbar, külgpaneel, PDF-vaatur)
- `styles.css` — disainikeel (v423 „coded visuals": tume neutraalne vaikimisi, hele teema `[data-theme="light"]`, brändivärvita)
- `data.js` — näidisandmed (`window.DB`): pinnad, parkimisplaan (`PARK_SVGS`), pakkumused, imporditud lepingud; `DEMO_TODAY` = päris tänane (kehtiv leping luuakse esmakäivitusel `app.js`-is)
- `klauslid.js` — imporditud lepingute klauslistruktuur
- `uldtingimused.js` — üürilepingupõhja täistekst (genereeritud `Üürileping.docx`-ist)
- `riskiandmed.js` — GENEREERITUD (`python tools/riskiandmed.py`) Äriregistri ja EMTA avaandmetest; käsitsi ei muudeta
- `app.js` — hash-router SPA, vaated ja interaktsioonid (raamistikuvaba)
- `lisad/` — päris PDF-id ja logod: `pinnad/` (34 pinna plaani + kõik pinnad, PDF + PNG-eelvaade), `T6B_parkimisskeem.pdf`, `T6B_logo.png`, `importitud/`
- `AUDIT.md` — koodiauditi raport (22.09.2026, v485 → parandused v486)

> Demo on illustratiivne: andmed on näidislikud, välised liidesed (e-äriregister, EHR,
> Moderan, riskiregistrid, Statistikaamet, TÖR, allkirjastamine, frontier-mudeli API)
> on simuleeritud.


### Objekti lisamine (v399)

Portfell → Objektid → Lisa objekt (või ülariba Uus → Objekt). Kolm sammu: hoone andmed, pinnad, pakkumuse seaded. EHR-otsingu näide on „Näidise 8”; käsitsi saab sisestada uue aadressi. Pinnad saab lisada ükshaaval, CSV/TSV-failist või Excelist kopeerides. Impordi vead parandatakse enne salvestamist samas vormis. XLSX-faili otse ei loeta.

Pinnad, objektid ja lisatud failid säilivad ettevõttepõhiselt brauseris. PDF-plaanid ja PNG/JPEG-logo: kuni 1 MB faili kohta; brauseri salvestusruumi täitumisel jääb mustand parandamiseks avatuks. Töövoo sammude vahel säilivad sisestused; lõpetamata mustand lehe värskendamist üle ei ela. Tühja objekti saab salvestada ja hiljem täiendada nupust Muuda / Lisa pind. Loo pakkumus avab selle objekti pinnavaliku. Puuduv kõrvalkulu ei võrdu nulliga; enne uue objekti pakkumuse saatmist küsib demo puuduvaid kõrvalkulusid ja pinnaplaani. Täiendamise järel avaneb sama pakkumus. EHR ja pakkumuse saatmine on jätkuvalt simuleeritud.
