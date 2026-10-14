# Phase 3 manual test plan

Dev: https://dev.thinkone.ai (API https://api.dev.thinkone.ai/api/health). Start from the Phase 2 plan's scenarios 1–3 (account,
company, a building with spaces from `data/pinnad-import/pinnad_naidis.csv` and a parking register) — the quote loop needs a
building with spaces. Paths are relative to the repo root.

## 3.1 Quote loop (hinnapakkumine)

### Settings
- Seaded → Teavitused → „Pakkumise vaikeväärtused”: kehtivus 14 päeva, rendiperiood 60 kuud, tagatis 3 kuud, vaikus 5 päeva,
  lepingu lingi kehtivus 30 päeva. Change validity to 21 → saved; a new quote gets „kehtib kuni” 21 days ahead. Set it back to 14.

### Create (wizard)
- Ülariba „+ Uus” → „Pakkumine” (also Avaleht „Loo pakkumine”, pinna leht „Loo pakkumine”, osapoole leht „Loo pakkumine”).
- Step Klient: search „Future” → nothing → „Lisa osapool” → äriregister search → pick a company → roles Üürnik → save → it is selected.
- Step Riskiraport: informational only → „Jätka ilma”.
- Step Pinnad: pick the building → spaces listed with status; a „Üüritud” space is disabled; tick „Pind 1” and „Pind 2” → „Loo pakkumise mustand”.
- The quote page opens: number `PAK-<year>-001`, status Mustand, contact from the party card, both spaces with their list prices,
  parking spots = the spaces' register spots, totals net + KM 24 % + gross, kõrvalkulu info line, commercial text with the
  client's name and the spaces; Portfell → Pakkumised lists it under Pooleli and Mustandid; the two spaces read „Pakkumisel”.

### Edit the draft
- Pinnad ja hind: set Pind 1 €/m² to 9,00 → totals update, the document (iframe) re-renders. „+ hinnaperiood” → 1–12 kuu 8,00,
  alates 13. kuust 9,00 → save → Eritingimused shows an automatic locked term „… üür on astmeline …” (kirjutab üle Põhi · Üür).
  Elektrivõimsus 80 A → a second automatic term „Erandina üldtingimuste punktist 4.4 …”; set 32 → it disappears.
- Parkimiskohad: untick one spot, tick a free one in another zone → saved; „Pinna kohad” restores the defaults.
  (Building without a register: a plain count input.)
- „+ Lisa pind” → add Pind 4; remove Pind 2 with ×; removing the last space is refused.
- Rendiperiood 36 kuud; Kehtib kuni +30 days (a past date is refused); Omadused: add „Põranda kandevõime: 5 t/m²”.
- Eritingimused: add „Üürnik võib paigaldada sildi.”, edit it, delete it; the automatic one cannot be edited/deleted.
- Lisad: Lisa 1 = pinnaplaanid (when uploaded in the object workflow), Lisa 2 = parkimisskeem; „Laadi PDF” adds Lisa 3+; delete it.
- Klient: edit contact e-mail to your own address → saved (contact editing is draft-only).
- „Versioonid” / „Muudatused” pills are absent on an unsent draft.

### Send and the client portal (no account)
- Guide card „Saada kliendile” → „Kinnita ja saada” (optional message) → status Saadetud, „Versioonid · 1”, „Eelvaade · PDF”
  opens the frozen V1 PDF, Kirjad lists the letter (queued → sent), Klient card shows the link validity and „Klient pole linki
  veel avanud”; editing is locked; guide card = „Ootab kliendi vastust · kehtib veel N päeva”.
- Open the e-mail → the link `/portal/<token>`: „Tere, <nimi>.”, status box „Teie kord”, the document card, the A4 document,
  attachments, PDF download, decision card, chat, Tähtajad + Kontakt. Back in the operator view: „Klient avas lingi …”,
  Sündmuslogi has `quote.link_opened` by „link holder (<e-mail>)”.
- Client: „Alusta läbirääkimisi” → „Kas hind 8,50 oleks võimalik?” → status box „Ootame üürileandja vastust”, the proposal in the
  thread, „Täiendage ettepanekut” box works (second message). Operator: Pakkumised → „Ootab minu vastust”, unread badge,
  Avaleht „Vajab tegevust” row, in-app notification; Suhtlus lists the thread with the unread count.
- Operator: guide card „Vasta kliendi ettepanekule”: reply only → „Saada uuesti” → letter „Vastus Teie ettepanekule”, version
  stays V1. Client proposes again; operator changes the price to 8,50 → „Muudatused · 2” (üür kuus + €/m²) → „Saada uuesti” with
  a reply → V2, letter „Uuendatud pakkumine (V2)”, Versioonid shows the diff; the portal shows „Uuendatud · V2” with the changes.
- Chat: client writes in Vestlus → operator sees it in Suhtlus and on the quote (Vestlus card), replies → client sees the reply.
- Client: „Aktsepteerin pakkumise” → portal „Pakkumine on aktsepteeritud”; operator: status Aktsepteeritud, guide card „Koosta
  leping” (disabled until 3.2), notification „… aktsepteeris pakkumise”.
- Second quote: client „Lükkan pakkumise tagasi” with a reason → Tagasi lükatud, the link stops working (404 page), the space is
  „Vaba” again; Pakkumised → Lõpetatud.
- Third quote: operator „Tühista pakkumine” → Tühistatud, link dead.

### Reminders, expiry, bounces
- Create and send a quote with validity 5 days → guide card „Meenuta kliendile” with an editable draft; „Mitte praegu” hides it
  for 3 days; „Saada meeldetuletus” → letter „Meeldetuletus …” in Kirjad.
- Send a quote to a bouncing address (Postmark sandbox or a `.invalid` domain) → Kirjad shows „põrkas tagasi”, guide card „Kiri ei
  jõudnud kohale” with the address field → fix → „Saada uuesti” → new letter; the old link is dead, the new one works.
- Expiry: a sent quote whose validity passed is moved to Aegunud by the nightly job (05:30 UTC); the portal shows „Pakkumine
  aegus” and refuses accept; the operators get a notification.
- Sündmuslogi → olem „Pakkumine”: created, updated, sent, version_frozen, client_proposal, accepted/rejected/expired, reminded.
