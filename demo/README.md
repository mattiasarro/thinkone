# ThinkOne ā€” demokeskkond

LepingutĆ¶Ć¶voo platvormi **interaktiivne demo** funktsionaalspetsifikatsiooni **v2** jĆ¤rgi:
kaks sammast (esemeregister + lepingumootor), mida Ć¼hendab hĆµive; kaks vertikaali samal
mootoril (Ć¤rikinnisvara Ć¼Ć¼rilepingud + tĆ¶Ć¶lepingud); olemasolevate lepingute import.
PĆ¤ris andmed projektikaustast: **ĆĆ¼rileandja/tĆ¶Ć¶andja TaevavĆ¤rava OĆ**, **Hoone T6B**
(Rae vald), pinnad ja Ć¼Ć¼rilepingupĆµhi.

## Avamine

TopeltklĆµps failil **`index.html`** ā€” avaneb brauseris. Build'i ega serverit pole vaja
(staatiline HTML/CSS/JS, tĆ¶Ć¶tab ka vĆµrguta; fondid laetakse Google Fontsist, kui internet on,
muidu langeb tagasi Segoe UI peale).

## Mida demos nĆ¤eb

Navigatsioon jaguneb viie igavese kĆ¼simuse jĆ¤rgi: **Avaleht** (mida ma tĆ¤na tegema pean? ā€” AI),
**Ćlevaade** (kuidas meil lĆ¤heb? ā€” tĆ¤ituvus, tĆ¶Ć¶solev, portfelli tervis), **Portfell** (mis meil
on ja kellega? ā€” esemeregister, pakkumised, lepingud, osapooled, dokumendid), **Kalender**
(mis millal juhtub?) ja **Suhtlus** (mida osapooled Ć¼tlevad? ā€” kogu lepingusuhtlus koos).

| Vaade | Spetsi osa | Sisu |
|-------|-----------|------|
| **Dashboard** | 03 | Minimaalne, AI-agent fookuses: tervitus + suur sisend + nĆ¤idiskiibid + 4 pĆµhinuppu; ā€˛Vajab tegevust tĆ¤na" peidus kellanupu ja koondnumbri taga (avaneb klikiga) |
| **Esemeregister** | Kaks sammast | TĆ¤ituvuse joongraafik kuude lĆµikes (jooksev kuu hĆµivetest); konteinerid hoonete kaupa + osakond (ametikohad); hĆµive = projektsioon, headcount = kvoothĆµive |
| **Hoone T6B pinnad** | 02 | EHR baasandmed, 12 Ć¼Ć¼ripinda (pĆ¤ris mĀ²-d), kĆµrvalkulu, KM-seadistus |
| **Pakkumised** | 04 | Olekumasin, (a) vabatekst + (b) eritingimused, hinnastus KM-iga, astmeline Ć¼Ć¼r, jagamislink kliendile (kontota, kehtib pakkumuse aja) |
| **Lepingud** | 05ā€“08 | Kolm sektsiooni: Ć¼Ć¼rilepingud (klausli-dokument: Ć¼ld lukus / pĆµhi / eri Lisa 3, `kirjutab_Ć¼le`, allkirjastamine) Ā· **tĆ¶Ć¶lepingud** (sama klauslimudel, katseaeg/palgaĆ¼levaatus, TĆ–R-adapter post-MVP) Ā· **imporditud lepingud** (originaal = Ćµiguslik tĆµde) |
| **Riskiraport** | 04 | Koondskoor + 4 allikat (KĆ•RGE/KESKMINE/MADAL) |
| **VĆµtmekuupĆ¤evad** | 07 | Indekseerimine (automaatne vs erikokkulepe), algus/lĆµpp (teavitus 90 p ette), katseaeg, palgaĆ¼levaatus ā€” kĆµik vertikaalid Ć¼hes vaates |
| **Audit trail** | ā€” | Decision Memory, 1-klikiga eksport |

### Soovituslik demo-teekond
1. **Dashboardil** kĆ¼si AI-agendilt *ā€˛Kelle katseaeg lĆµpeb sel kuul?"* ā€” vastus tuleb Ć¼le kĆµigi vertikaalide; vĆµi *ā€˛Loo pakkumine Future Invest OĆ-le, pind 12"* ā†’ **Ava pakkumuse mustand** ā†’ **Kinnita ja saada** (jagamislink kliendi e-postile).
2. **Esemeregister**: kaks konteinerit kĆµrvuti ā€” sama muster (konteiner ā†’ Ć¼ksus ā†’ hĆµive) kannab mĆµlemat vertikaali; ametikohtade hĆµive arvutub tĆ¶Ć¶lepingutest.
3. **Lepingud ā†’ Nordproff OĆ** (LEP-2026-008): klĆµpsa pĆµhitingimuse punktidel ā†’ kliendi kommentaarid ā†’ aktsepteeri Lisa 3-e.
4. **Lepingud ā†’ Karl Mets** (TL-2026-002): tĆ¶Ć¶leping samal mootoril ā€” sama klauslimudel, katseaeg/palgaĆ¼levaatus vĆµtmekuupĆ¤evadena, TĆ–R-kanne post-MVP mĆ¤rkega.
5. **Lepingud ā†’ KIN-2026-07** (If P&C): imporditud leping ā€” tuvastatud struktuur on indeks ja lĆ¤hendus, originaal on Ćµiguslik tĆµde; osaleb Q&A-s ja kalendris, muudatuste voos mitte.

### LisavĆµimalused
- **Mitu ettevĆµtet Ć¼he konto all** (spets etapp 01): kĆ¼lgriba kontekstikaardil saab vahetada
  aktiivset ettevĆµtet ā€” TaevavĆ¤rava OĆ (Hoone T6B, tĆ¤isportfell) ā†” **B11G OĆ** (hiljuti kontole
  lisatud, vana portfell imporditud ā€” Ć¼Ć¼rileping + hooldusleping, uusi lepinguid platvormis veel
  pole). Kummagi ettevĆµtte sisestused pĆ¼sivad eraldi.
- **Mitu hoonet Ć¼he ettevĆµtte all** (EttevĆµte ā†’ Objekt 1..n): B11G OĆ-l on samal aadressil
  (Betooni 11g) kaks hoonet ā€” **Stock Office** (laod-kontorid) ja **Self Storage** (laoboksid,
  oma lepingumall). Esemeregister nĆ¤itab mĆµlemat konteinerina, objektivaates saab hoonete
  vahel lĆ¼lituda; pakkumuse wizard pakub mĆµlema hoone pindu koos hoone mĆ¤rgisega.
- **TĆ¤ielik operaatorā†”klient tsĆ¼kkel**: pakkumus ā†’ jagamislink ā†’ kliendi vaade (kommentaar / ettepanek / aktsept / keeldumine) ā†’ leping ā†’ allkirjastamine. Rollivahetus kĆ¼lgribalt vĆµi ā€˛Ava kliendilink" nupust.
- **Astmeline Ć¼Ć¼r** pakkumuses (+ hinnaperiood) ā€” genereerib automaatse eritingimuse, mis voolab lepingu Lisa 3-e.
- **Uus leping** (Lepingud ā†’ nupp): Ć¼Ć¼rnik (autotĆ¤ide) ā†’ pind ā†’ pĆµhitingimused ā†’ Mustand V1.
- **Ćldtingimuste tĆ¤istekst** ā€” 18 jagu / 114 punkti ekstraktitud otse failist `ĆĆ¼rileping.docx`, kuvatakse akordionina (lukus).
- **Lisad on vaadatavad** ā€” Lisa 1 (pinnaplaan) ja Lisa 2 (parkimisskeem) avanevad PDF-vaaturis; pakkumusest on **prinditav dokumendieelvaade** (T6B logo, salvesta PDF-iks).

## Failistruktuur

- `index.html` ā€” kest (sidebar + ThinkOne logo, topbar, kĆ¼lgpaneel, PDF-vaatur)
- `styles.css` ā€” disainisĆ¼steem (ā€˛Soft studio": hele lĆµuend, hĆµljuvad kaardid, ThinkOne sinine aktsent)
- `data.js` ā€” sĆ¼nteetilised nĆ¤idisandmed (`window.DB`): pinnad, ametikohad, pakkumused, Ć¼Ć¼ri- ja tĆ¶Ć¶lepingud, imporditud lepingud
- `uldtingimused.js` ā€” Ć¼Ć¼rilepingupĆµhja tĆ¤istekst (genereeritud `ĆĆ¼rileping.docx`-ist)
- `app.js` ā€” hash-router SPA, vaated ja interaktsioonid (raamistikuvaba)
- `lisad/` ā€” pĆ¤ris PDF-id: `T6B_pinnaplaan.pdf`, `T6B_parkimisskeem.pdf`, `T6B_logo.png`

> Demo on illustratiivne: andmed on nĆ¤idislikud, vĆ¤lised liidesed (e-Ć¤riregister, EHR,
> Moderan, riskiregistrid, Statistikaamet, TĆ–R, allkirjastamine, frontier-mudeli API)
> on simuleeritud.
