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

## 3.2 Contract preparation (lepingu mustand)

### From an accepted quote
- Accepted quote → guide card „Koosta leping”: „Eraldi lepingud · N” / „Üks ühine leping” (only with several spaces), handover
  date (default the 1st of next month) → the draft page opens: number `LEP-<year>-NNN`, status Mustand, key-data tiles,
  the A4 document with Põhitingimused (6 sections generated from the deal), Üldtingimused (locked, from the building's
  template), Lisa 3 (the quote's special terms, „kirjutab üle: p X”), Lisad list; the quote reads „Lepinguks teisendatud”
  and links to the draft; the space reads „üüritud” only after signing (Phase 4) — until then the draft holds the allocation.
- Tehing card: change the handover, months, deposit months, €/m² → the main terms regenerate; edit a clause's wording by hand
  (✎), then change a fact → the edited clause keeps your text and shows „Kontrolli sõnastust”. Esindajad: fill the landlord
  rows → P 6.1 updates. Lisa 3: add a manual special term overriding a general clause → the general clause shows „muudetud:
  Lisa 3 p N” in the document.
- „Loo leping 0-st” (ülariba „+ Uus” → Leping, or the party/space page): Klient → Riskiraport → Pinnad → Tingimused → draft.
- Tööleping: Portfell → Esemed → add a department and a position; „+ Uus → Leping” → liik Tööleping → candidate (person) →
  position → salary/start/probation → draft `TL-…` with TLS main terms, probation and salary-review key dates, the position
  allocated (quota).

### Negotiation (one round = one letter)
- „Saada üürnikule” → V1 frozen (PDF), the client gets a link with its own validity, turn = client; the operator cannot edit.
- Client (portal): the A4 with clickable clauses; click 2.4 → „Lisa märkus”; click 4.1 → „Soovin muuta: Tagatis (kuud) → 2”;
  „Saada märkused · 2”. Operator: Avaleht shows „Vasta üürniku märkustele · 2”; the draft page pane lists the threads; the
  document marks them; „Kuidas lahendame?”: Selgitan (resolves as Selgitatud) · Muudan: tagatis → 2 (proposal) · „Saada
  vastused · 2” (blocked while a thread is unanswered). Client: „Kinnitan” on the proposal → the fact and the clause change,
  „Sobib” on the explanation → when nothing is open: „Aktsepteerin kõik punktid” → Allkirjastamiseks valmis; the operator is
  notified; „Muudatused · N” shows the wording diff against V1; Versioonid shows V2 when the document changed.
- A locked general clause: „Muuda sõnastust” is refused → „Saadan Lisa 3-sse” creates a proposed special clause the client
  confirms or declines („Ei sobi — vastan arutellu” removes it); „Jääb samaks” closes a thread neutrally (never „tagasi
  lükatud”); „Tühista leping” frees the space and kills the link.

## 3.3 AI foundation and risk

- Sidebar „AI” → `/app/ai`: example chips; „Millised pinnad on vabad?” → „Töö käik” shows `Loen pindu` → a table card;
  „Loo pakkumine ettevõttele X, Hoone T6B pind 12” → a confirmation card → „Kinnita” → the draft is created under your
  name and linked; „Muuda” puts a sentence in the composer; ambiguous „pind” → the assistant asks (clarify card).
- On a lease page „Küsi selle lepingu kohta” → the thread opens with the context chip „Kontekst · LEP-…”; „Kui suur on üür ja
  millisest punktist?” → the answer cites „§3.1” chips that open the clause; a made-up § never appears (the step list says
  „Kontrollin viiteid”).
- Thread list grouped by day; delete → 10 s „Võta tagasi”; usage line under the composer; Seaded → Teavitused → AI: lower
  the monthly budget to 1 → the next answer says the budget is exhausted; restore it.
- Riskiraport: party page → „Telli riskiraport” → score gauge, signals (Äriregister status/age, EMTA tax debt, turnover
  trend, rent vs turnover), „Liidestamata: Krediidiinfo, Inforegister, Kohtutäitur, majandusaasta aruanded”; the quote
  wizard step 2 shows the same; the quote's client block shows the pill.
- Evals: `cd backend && uv run python -m app.agent.evals.runner --base https://api.dev.thinkone.ai --email … --password …`
  over the seeded portfolio; target ≥ 95 % (format and questions to be agreed with Future Invest).
