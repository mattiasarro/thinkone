# ThinkOne demo — üleandmine

Lepingutöövoo platvormi interaktiivne demo (ärikinnisvara üürilepingud: pakkumine → läbirääkimine → allkiri → kehtiv leping,
import, objektid ja pinnad, parkimine, sündmuslogi). Seis: **30.09.2026, v=807**.

## Käivitamine

- Lihtsaim: topeltklõps `demo/index.html` (serverit pole vaja).
- Lokaalserver (brauseriautomaatika, ekraanipildid): `node serve.js` või `start-demo.cmd` → http://localhost:8471/
- Build'i, npm-i ega sõltuvusi pole — raamistikuvaba staatiline SPA (`app.js` + `data.js` + `styles.css` jt).
  Välised teegid (pdf.js, Tesseract.js) laetakse CDN-ist alles impordi ajal.

## Testimine

- **Lepingute import:** `#/import` (või „+ Uus” → Import) → lohista failid kaustast `testfailid/lepingud/`
  (terve pinna kaust korraga; lisad ja kaasdokumendid seotakse õige lepingu juurde). Failid on PÄRIS lepingud isikuandmetega —
  ainult kohalikuks testimiseks, mitte avalikku reposse (`.gitignore` jätab `testfailid/` välja).
- **Tühi konto nullist:** külgriba ettevõttevalik → „Uus konto” → `#/alusta` (ettevõte → hoone → pinnad → lepingud).
- **Objekti lisamine:** „+ Uus” → Objekt (5 sammu). Plaanide hulgi-üleslaadimiseks sobivad `demo/lisad/pinnad/T6B_Pind_*.pdf`.
- **Kaks rolli:** all paremal „Vaata üürnikuna” — sama dokument üürniku vaates.
- **Lähtesta:** Seaded → „Lähtesta demo” (andmed elavad brauseri localStorage-is + IndexedDB-s).

## Arendus Claude'iga

- `CLAUDE.md` on projektijuhis — Claude Code loeb selle automaatselt. Seal on kõik kokkulepitud reeglid (disainikeel, nupud,
  paigutus, andmemudel, mida EI tehta). Uue otsuse järel lisa see sinna — nii jääb teadmine järgmisele sessioonile.
- Pärast iga CSS/JS muudatust tõsta `demo/index.html`-is cache-versiooni (`?v=NN`, kõik kuus viidet) ja jooksuta `node --check demo/app.js`.
- Soovitus: `git init` kohe alguses — muudatused on siis commit'idena põhirepo tagasi toodavad.
- `HANDOFF.md` = pikk arenduslogi (miks midagi on nii tehtud).
