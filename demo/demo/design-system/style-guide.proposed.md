# ThinkOne · lühike stiilijuhend — kavand

Staatus: RAKENDATUD demos v421 (10.09.2026). See dokument on viide; rakenduse tokenid elavad styles.css :root-is.

## Põhimõtted

- Hele soe lõuend, valged pinnad, tume tekst, üks petrooleumaktsent.
- Säilita praegused tekstid, andmed, õigused ja töövood. Ära lisa uut tegevust ainult kujundushierarhia pärast.
- Kasuta värvi rolli järgi, mitte tooni nime või lehe järgi. Sama semantika = sama komponent.
- Olemasolev raamistikuvaba HTML/CSS/JS jääb alles; komponente jagatakse CSS-klasside ja väikeste renderdusabilistega. Ei Reacti, Tailwindi ega uut build'i.

## Värv ja tekst

Põhitekst on --color-text. Meta-, abi- ja placeholder-tekst on --color-text-secondary: mitte vähendatud opacity. Mõlemad on mõeldud heledatele pindadele. --color-divider on dekoratiivne eraldaja, **mitte** tekst ega ainus vormikontrolli piir; selleks on --color-border-control.

Primary on petrooleum, valge tekstiga. Success/warning/error/info on olekute paarid, mitte osakondade või lepinguliikide kaunistused. Neutral kasutatakse kategooriate ja vaikimisi märgendite jaoks.

Inter: sisutekst, tabelid, sildid ja nupud. Bricolage Grotesque: lehe- ja sektsioonipealkirjad. Numbrid: Inter + tabular-nums, summa paremale. Võrdsete summade visuaalset joondust ei lahendata tühikute abil.

| Roll | Suurus / rida | Kaal |
| --- | --- | --- |
| Abitekst / badge | 12 / 16 px | 400; badge 500 |
| Silt, kompaktne tabel, nupp | 14 / 20 px | 500; tegevus 600 |
| Sisulõik, mobiili vormiväli | 16 / 24 px | 400 |
| Väike sektsioonipealkiri | 20 / 28 px | 600 |
| Lehepealkiri | 24 / 32 px | 600 |
| Avalehe põhipealkiri | 32 / 40 px | 600 |

12 px ei ole tavateksti vaikimisi suurus. Mobiili sisendid on 16 px; kasutaja brauseri teksti suurendamist ei piirata.

## Button

Kavandatud ühine liides: variant = primary | secondary | ghost | destructive; size = sm | md | lg. Ikooniga nupp ja ikoonita nupp kasutavad sama mõõdukontrakti.

| Variant | Vaikimisi | Hover | Vajutatud |
| --- | --- | --- | --- |
| primary | Petrooleum + valge tekst | Primary-hover | Sama toon + 1 px visuaalne allanihe |
| secondary | Valge + kontrolliserv + tume tekst | Neutraalne pehme pind | Sama toon + 1 px allanihe |
| ghost | Läbipaistev + tume tekst, ilma serva/varjuta | Neutraalne pehme pind | Sama toon + 1 px allanihe |
| destructive | Error + valge tekst | Error-hover | Sama toon + 1 px allanihe |

Kõrgus sm/md/lg = 32/40/48 px; külgpolster 12/16/20 px; raadius 8 px; ikoon 16 px (lg 20 px). Need on miinimumid: mitmerealine pikk tekst peab vajadusel kasvama, mitte lõikuma.

Kõigi variantide ühised olekud:

- focus-visible: 2 px petrooleum-outline, 2 px eraldus pinnast; nähtav ka hover'i või vea ajal.
- disabled: neutraalne pehme pind, teisene tekst, ei varje/nihkeid ega pointer-hover-efekte; native disabled seal, kus element seda toetab.
- loading: sama laius, sama silt, reserveeritud indikaatoriala, aria-busy; topeltkäivitus blokeeritud olemasoleva toimingu piires. Disabled-stiil ei pea laadimisteksti tuhmistama.
- hover ainult hover-võimelisel seadmel; klaviatuuri fookus ei sõltu sellest.

Kuni 640 px või pointer: coarse korral on kõigi interaktiivsete kontrollide tabamisala vähemalt 44 × 44 px. Väikse visuaalse ikooni ümber kasvatatakse tegelikku nuppu/silti, mitte kattuvaid nähtamatuid alasid.

Üks selge põhitegevus ühe otsustusploki kohta. Lugemisvaatele ei leiutata uut CTA-d; eraldi seadistusvormidel võib igaühel olla oma salvestamine. Destruktiivse nupu tugevus ei tähenda, et see peaks konkureerima tavategevusega igas reas.

## Badge, staatus ja kategooria

Üks Badge, semantic = neutral | success | warning | error | info. 12/16 px tekst, kaal 500, vähemalt 24 px kõrge, polster 4 × 8 px, vahe 4 px, raadius 4 px. Värv ja pehme taust tulevad paarina samast semantikast. Väga pikk silt võib kitsal vaatel murduda.

Praegune pill()-abiline ja STATUS/PILL_SHAPE on hea alus: koonda semantiline kaardistus sinna ning kasuta sama allikat galeriis. Säilita kõik olekute täpsed nimed ja edenemis-/tulemusikoonid. Staatuse tähendust ei muudeta värvide vähendamise käigus. Neutraalsed olekud ja kategooriad võivad jagada värvi, sest neid eristab tekst/ikoon.

Lahendamisel ja Ootel vajavad endiselt tähelepanu: kasuta samas süsteemis arusaadavat märgendit ja olemasoleva tegevusrea hierarhiat, mitte erandlikku musta kapslit. Täpne kaardistus kontrollitakse mõlemas kasutajarollis.

Badge ei ole nupp. Klikitav filter on Button või segmentvalik sama fookuse ja puutemõõduga.

## Väljad ja valikud

Üherealiste sisendite/select'ide kõrgus vastab nuppude skaalale; vaikimisi md. Tekstiala kõrgus tuleneb ridade arvust, mitte juhuslikust px-erandist. Kasuta nähtavat label'it, ühtset kontrolliserva ning 8 px nurka. Read-only, disabled ja error on eraldi olekud.

Error kasutab error-serva ja olemasolevat veateksti, mis on väljaga seotud aria-describedby kaudu; aria-invalid ei asenda selgitust. Fookus jääb veaseisundis nähtavaks. Valideerimise ärireegleid ega veatekste selle refaktoriga ei muudeta.

Check/radio visuaal 20 px, sildiga tabamisala vähemalt 44 px; checked/unchecked/indeterminate (kui kasutusel), focus-visible, disabled ja error on järjepidevad. Switch kasutatakse ainult juba olemasoleva kohese sisse/välja valiku esitamiseks, mitte uueks ärifunktsiooniks. Native käitumine ja klaviatuur säilivad.

## Kaardid, tabelid ja ülekatted

- Kaart: valge, 12 px raadius, dekoratiivne serv; polster 24 px, telefonis 16 px. Varjutase 1 ainult siis, kui pind vajab eraldumist.
- Klikitav illustratsioonikaart: jääb valgeks; hover-varjutase 2, nool +5 px, pilt +5°. Fookus peab andma võrreldava selge tagasiside. Säilita senised pildid, kompaktsus ja tekstid.
- Tabel: ühine päis, eraldajad, 14 px tekst, ühtsed reavahed; toimingud ei ole pisikesed tekstilingid. Kitsal vaatel sildistatud kirjed, mis säilitavad väljad ja toimingud. Ühtegi väärtust ei peideta ainult seetõttu, et see ei mahu.
- Dropdown: 12 px raadius, varjutase 2; reavalikud vähemalt 44 px mobiilis. Modaal: sama raadius, varjutase 3, 24/16 px polster; nähtav sulgemine, Escape ja fookuse tagastamine.
- Toast: hele pind, semantiline ikoon/silt, tekst võib murduda; ekraanilugeja teavitus vastavalt olemasoleva teate tähtsusele.
- Äriprotsessi ei muudeta modaali asemel teiseks töövooks; ühtlustatakse olemasolevat esitus- ja fookuskäitumist.

## Paigutus ja liikumine

Vahed ainult 4 px skaalalt. Rakenduse sisuala maksimaalselt 1440 px; lugemistekst umbes 65ch; pikad vormid kuni 768 px. Need piirangud ei tohi kitsastel ekraanidel miinimumlaiuseks muutuda.

Murdekohad: kuni 640 px mobiilipolstrid ja puutemõõdud; kuni 1024 px külgribast sahtel. Tabeli/mitmeveerulise ploki murdumine sõltub ka olemasolevast sisuruumist, mitte ainult seadme nimetusest. CSS-murdepunkte ei kirjutata var()-i sisse, sest tavapärane media query seda ei toeta.

150 ms: hover, press, fookus. 250 ms: dropdown/modaal/sahtel sisse ja välja. 400 ms: ainult põhjendatud suunav sektsioonivahetus, mitte igal filtrivahetusel. Üldine liikumine kasutab transform/opacity; layout'i mõjutavat padding/width animatsiooni välditakse. Olemasolevaid filtrite scroll-asukoha ja fookuse säilitamise reegleid ei rikuta.

Reduced-motion korral keelatakse mitteoluline animatsioon ning nool/pilt ei nihku ega pöördu. Laadimine on endiselt arusaadav staatilise oleku kaudu. Ei dekoratiivset püsivõnkumist ega sunnitud sujuvat kerimist.

## Erandid ja migratsioon

Arvutatud protsentlaiused, graafiku geomeetria, korruseplaanid ja andmetest tulenevad mõõdud ei ole teemavärvide või nupustiili erandid. Neid võib anda CSS-muutujate kaudu. CSS-i ühekordsed kujundusvärvid ja nupupolstrid mallides eemaldatakse komponentide kaupa.

Ettevõtte seadistatavad dokumendivärvid ja imporditud dokumendisisu on kasutaja sisu. Neid ei asendata globaalse UI-paletiga. Ekraani dokument võib ümber paigutuda; A4/print eraldus, sisu ja väljatrüki käitumine säilivad ning kontrollitakse eraldi.

Pärast kinnitust ühendatakse tokenid, migreeritakse päris komponendid ja asendatakse galerii duplikaadid nendega. Alles kasutuse eemaldamise järel kustutatakse vanad tokenid/klassid. Praegune fail pole tootmisstiil ega valmis ligipääsetavuse garantii.
