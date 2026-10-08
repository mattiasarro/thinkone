# Phase 2 manual test plan

Production: https://frontend-production-ba0c.up.railway.app (API https://api-production-b9c7d.up.railway.app/api/health).
The database was emptied on 2026-10-06, so start from scenario 1. Paths below are relative to the repo root.

## Input files

| File | Used in |
| --- | --- |
| `data/pinnad-import/pinnad_naidis.csv` | spaces CSV in the demo header (parts, amperes, parking numbers) — 6 rows OK |
| `data/pinnad-import/pinnad_vigased.csv` | spaces CSV with row errors (missing area, missing name, non-numeric, parts mismatch, duplicate name, taken parking spot) |
| `data/uuripinnad-import/uuripinnad_test.csv` | old spec-v2 header (netopind/koefitsient) — still accepted |
| `data/plaanid/` (4 PDF, 2 PNG, 1 ZIP) | bulk plan upload; names match the spaces of `pinnad_naidis.csv` |
| `data/parkimine/parkimiskohad.csv` | parking register table (`nr;tsoon;tüüp;pind`), last row has an unknown space |
| `data/manused/objekt/*` | site plan, parking plan, logo, generic attachments |
| `data/mallid/*` | general-terms DOCX samples (good, v2, second company, three error cases) + text bodies for the two text template kinds |
| `demo/testfailid/lepingud/Üürileping.docx` | the real general-terms template (local only, the folder is gitignored) |
| `demo/demo/lisad/importitud/MARU_uurileping_P29.pdf` | lease import (real signed contract — personal data) |
| `demo/demo/lisad/importitud/MARU_uurileping_P29_lisa3.pdf` | externally signed amendment of that lease |
| `demo/demo/lisad/importitud/Hooldusleping_H5-08.docx` | maintenance contract import (DOCX, coverage on the building) |
| `demo/demo/lisad/importitud/T6B_pind_29_plaan.pdf` | drawing without usable text → fails structuring → manual registration |
| `demo/testfailid/lepingud/Üürileping P13_T6B_RÄNDTSIRKUS.asice` | ASiC-E container import with signatures (local only) |

## 1. Account and users

- Open `/login` → „Loo konto”: account name, your name, e-mail, password → lands on Avaleht with the „Alusta · 10 minutit” card showing 0/4.
- Seaded → Kasutajad → „Kutsu kasutaja” with a second e-mail you can read; role Operaator.
  - Open the invite link from the e-mail, set name and password → logs in as that user; back in Seaded the status is Aktiivne.
  - Change the role to Admin; try to invite the same e-mail again (rejected).
- Log out → „Unustasid parooli?” → request a reset link → set a new password → log in with it (old sessions are gone).
- Seaded → Teavitused: change „Lepingu lõpp” from 90 to 60 days → saved; reload to confirm.

## 2. Companies

- Seaded → Ettevõtted → „Lisa ettevõte” → search the äriregister by name (e.g. „Taevavärava”) → pick a hit → fields fill (registry code, address, VAT, e-mail/phone when the registry has them) → save.
  - Edit the company, upload `data/manused/objekt/logo.png` as logo → logo appears in the list.
  - Add a second company by typing a name only (no registry search) → saved; this is the one to use for the „no parking” building later.
- Avaleht: the setup card now shows 1/4, step 1 „Tehtud”.

## 3. Object workflow (five steps)

- Avaleht → „Lisa objekt” (or Portfell → Esemed → „Lisa objekt”).
- **Step 1 Hoone**
  - Search EHR with „Taevavärava tee 6b” (or any real address) → pick a hit → address and building facts fill; or „Sisesta käsitsi”: name „Näidise Ärimaja”, address, company.
  - Next → the building exists; the left rail shows step 1 done.
- **Step 2 Pinnad**
  - „Lisa pind” by hand: name „Pind 9”, type ladu, 100 m², parts ladu 80 / kontor 10 → save is refused with the parts-sum message; set olmeala 10 → saved (the parts line shows under the name in the table).
  - „Impordi tabelist” → „Ava CSV-fail” `pinnad_naidis.csv` → „Too read eelvaatesse” → 6 rows OK → „Salvesta 6 pinda” → toast mentions created spaces; the import note says parking numbers went to the register.
  - Import `pinnad_vigased.csv` → preview: row 2 OK, rows 3–7 rejected with the reason per row (missing üüripind, missing nimi, not a number, parts don't sum, taken parking spot 3, duplicate name); the save button stays available for the one good row.
  - Import `pinnad_naidis.csv` again → every row is „update”; nothing duplicates.
  - Import the old-format `uuripinnad_test.csv` → still accepted (legacy columns ignored in the UI).
  - Edit „Pind 1” from the table: change the price → saved; delete the hand-made „Pind 9” from the table.
- **Step 3 Plaanid**
  - Drop all files from `data/plaanid/` at once (including the ZIP and both PNGs).
  - Check the proposal: `Naidis_Pind_01.pdf` → Pind 1, `Naidis_Pind_02.pdf` → Pind 2 and `Naidis_Pind_02.png` is skipped („sama pind mitmes failis”), `Naidis_Pind_04.png` → Pind 4, `Naidis_B1.pdf` → Büroo 1, from the ZIP `Naidis_Pind_03.pdf` → Pind 3 and `Buroo_2.pdf` → Büroo 2, `koondplaan_korrus_1.pdf` → „Koondplaan”.
  - Change one row by hand (e.g. send the koondplaan to Pind 4 → the PNG for Pind 4 becomes skipped because PDF wins), then set it back to „Koondplaan”.
  - „Kinnita N plaani” → the „Praegused plaanid” list shows every space with a plan; click a filename → opens in a new tab.
  - Upload `Naidis_Pind_01.pdf` again alone → the row note says it replaces the previous one; the space keeps both files (newest first).
- **Step 4 Parkimine**
  - The CSV import already created spots 1–7 (1, 2 → Pind 1; 3 → Pind 2; 4, 5, 6 → Pind 3; 7 → Büroo 1): check the „Pindade kaupa” view.
  - „Lisa parkimiskohad” → Vahemik 20–22, zone „Hoov”, type elektriauto → Eelvaade → „Lisa 3 kohta”.
  - „Impordi tabelist” → paste or open `parkimiskohad.csv` → preview: 8 → Büroo 2, 9, 10–12 elektriauto, 13 ligipääsetav + reserv, 14–16 zone P-1; the last row is rejected („Pind 9” does not exist) → commit → „11 kohta lisatud”. Re-run the same file → 0 added, 11 skipped.
  - „Kohad” view: select 9 and 14 → set type ligipääsetav; select 13 → „Kasutusest väljas” (status changes); select 15 → „Pinna kohaks” Büroo 2; select 16 → „Kustuta kohad”.
  - „Pindade kaupa” → Pind 2 → „Muuda” → add spot 9 → save → Pind 2 shows 3 and 9; the space's parking count updates on the space page.
  - Next.
- **Step 5 Tingimused**
  - VAT checkbox, winter/summer utility costs; „Üldtingimuste mall” is empty until scenario 5 — come back after uploading the template and pick it.
  - Upload logo.png and hoone_tutvustus.pdf from `data/manused/objekt/` under their roles → they appear in the list. (asendiplaan.pdf and parkimisskeem.pdf go through the Plaanid step: their names put them under Asendiplaan / Parkimisskeem.)
  - The summary line shows spaces, m², plans and parking counts → „Lõpeta” → object page.
- **Second building without parking**: new object under the second company, one space by hand, step 4 → „Parkimist pole” → the object page says parking is not set; „Lisa siiski parkimiskohad” brings the form back.
- Avaleht: setup card 3/4 (contracts still to do).

## 4. Object and space pages

- Portfell → Esemed: the building card shows occupancy bar and pills; open it.
  - Spaces table sorted naturally (Pind 1, 2, 3 … not 1, 10, 2); parts under names; plan icon next to a space with a plan opens it.
  - Parking card: chips with zone, counts, „Halda kohti” → management page; „Pinnaplaanid” link → wizard step 3; „Lisa pind” → step 2.
- Click „Pind 1” → space page.
  - Header: status Vaba, type and parts; stat tiles: area, €/m², rent per month.
  - „Muuda andmeid” → modal with the same form; electrical capacity in A; the parking chips show the building's register with the space's own spots selected; untick 2, tick 9 → save → the page's parking card reflects it (and the register page moves spot 9).
  - „Jaga üksusteks” (Pind 1 has ladu 220 + kontor 30 + olmeala 12,5): units A = ladu 220 + olmeala 6,25, B = kontor 30 + olmeala 6,25, prices, parking split → save → parent becomes „Jagatud”, units listed under „Praegu”, object occupancy counts only the units, parking register shows the units.
  - On a unit: „Jaga üksusteks” is disabled with the reason; „Kustuta pind” is disabled with the reason.
  - Back on Pind 1 → „Ühenda üksused tagasi” → one space again with its spots.
  - Büroo 2 → „Kustuta pind” → confirm text lists the spots that stay in the register → deleted; the register shows 8 and 15 as „Pinnata”.
- Contract-related actions are re-checked in scenario 7 after an import.

## 5. Templates (Seaded → Mallid) — files in `data/mallid/`

- „Laadi üldtingimuste DOCX” → name „Äriruumide üürilepingu üldtingimused”, company 1 → `uldtingimused_naidis.docx` → row: version 1, Kehtiv, 33 punkti.
  - „Vaata” → 6 sections with derived numbers 1 … 6.4; sub-points 2.2.1, 2.2.2, 4.4.1, 6.3.1, 6.3.2; point 2.2 ends with the sentence about the electronic act (an unnumbered paragraph merged in); every node is locked.
  - Upload `uldtingimused_naidis_v2.docx` under the same name and company → version 2 current (34 punkti, new 3.4; 5.3 says 14 days); version 1 stays listed, not current.
  - Upload `uldtingimused_laoboksid.docx` under company 2 → an independent template (4 sections, 9 points); object step 5 of a company-2 building offers only it.
  - Error cases, each must show a toast and create nothing: `uldtingimused_ilma_pealkirjata.docx`, `uldtingimused_nummerdamata.docx`, `vale_formaat.pdf` (choose „All files” in the picker).
  - Upload the real `demo/testfailid/lepingud/Üürileping.docx` (local only) → 18 sections, 132 punkti.
- „Loo mall” → kind Eritingimuste põhi, name, paste `eritingimuste_pohi.md` → saved; „Vaata” shows the text; create again with the same name → version 2.
- „Loo mall” → kind Pakkumuse põhi, paste `pakkumuse_pohi.md` → saved; try an empty body → refused.
- Sündmuslogi shows `template.general_terms_ingested` (sections/points in the payload) and `template.created`.
- Object → Muuda → step 5 → pick the general-terms template → „Lõpeta”.

## 6. Parties

- Portfell → Osapooled → „Lisa osapool” → search äriregister „AS Maru Ehitus” → pick → fields fill → roles „üürnik” → save.
  - Open the party page → details, empty contract list; edit the contact e-mail; delete it (it is recreated by the import below).
  - Add a person (kind Eraisik) with a personal code.

## 7. Import — the core Phase 2 flow

Before importing, add a space named „Pind 29” (ladu, 174,8 m², price 7,60, parts ladu 150 / kontor 14,8 / olmeala 10) to the building and give it parking spots 20 and 21 — the lease hint is `P_29` / 174,8 m².

- **Lease PDF**: Portfell → Import → drop `MARU_uurileping_P29.pdf` → the row shows „Loen teksti” then „Tuvastan struktuuri” (one to three minutes; the page polls).
  - Review page: source text pages on one side, proposal on the other; click a „lk N” anchor → the source scrolls.
  - Contract fields: category Üürileping, dates; parties with registry codes; parameters (rent_per_m2 7.60, area_m2 174.8, deposit, parking 2 …); key dates (end, indexation); more than 100 clauses in the tree.
  - Edit a parameter value → „Salvestan muudatusi…” then „Muudatused salvestatud”; reload → the edit persists.
  - „Kinnita import” is blocked while uncertain fields are unchecked (the warning counts them); tick every „Kontrollitud” box.
  - Seosed: building and „Pind 29” are pre-selected from the hint (if not, choose the building → the blue „Kas see on Pind 29?” suggestion appears → „Jah, see pind”); „Parkimiskohad lepingusse” shows 20 and 21 selected — untick 21.
  - Seosed → Osapooled: one row per proposal party. The landlord (our side) is unticked, AS Maru Ehitus is ticked, role „Üürnik”, „Peamine” selected; the row shows the e-äriregister line with the registered name and status. „Vali olemasolev” on the row switches to a search of registry parties. „Lisa osapool” adds a row that is not in the document (e.g. a guarantor from the registry, role „Muu”). Commit is blocked while no row or more than one row is „Peamine”.
  - „Kinnita import” → contract page opens.
- **Verify the links**: contract page „Seotud esemed” lists Pind 29 and spot P 20 (links go to the space page and the parking page); space page: status Üüritud, „Praegu” shows the contract, „Kustuta pind” disabled with the LEP reason; parking register: spot 20 Üüritud with the contract number, 21 Vaba.
- **Maintenance DOCX**: import `Hooldusleping_H5-08.docx` → category Hooldusleping, number HOO-…; Seosed: building only, seose liik „Katab” → commit → the building's „Hõive” card lists it with kind Katab; Caverion is the primary party with role „Hooldaja” (and gets that role on its party page).
- **Scan-like PDF**: import `T6B_pind_29_plaan.pdf` → status „Ebaõnnestus” with the reason → „Registreeri skaneeritud dokument käsitsi” → fill title, counterparty, dates, one key date, one parameter, building → „Registreeri leping” → contract with no clause structure; the source document opens.
  - On the failed job: „Proovi uuesti” (retry) → it fails again the same way (expected for a drawing).
- **ASiC-E**: import the `.asice` → the review shows „Allkirjad konteineris” with signer names, codes and times; commit without a space.
- **Duplicate**: upload `MARU_uurileping_P29.pdf` again → the review warns it is probably already imported with a link to the existing contract → commit → the existing contract is updated, not duplicated; its Pooled card shows the party set you committed this time (rows replaced, not appended).
- Import list: „Pooleli” and „Lõpetatud” groups; Avaleht lists „Import ootab ülevaatamist” for a job left in review.

## 8. Contract page

- Open the lease: header with number, status, origin pill „Imporditud · originaal on õiguslik tõde”.
  - Põhiandmed: facts with „alates” dates and provenance (page → opens source anchor); „Lähtedokumendid” → „Ava originaal” opens the PDF from storage.
  - Tingimused: the clause tree keeps the original numbering.
  - Võtmekuupäevad: add one (kind, date, notify days), edit, delete.
  - Manused: upload a file as annex → listed; delete it.
  - Märkmed: edit and save.
  - Pooled: the imported lease lists AS Maru Ehitus as „Peamine” with role Üürnik. „Lisa osapool” → search a registry party, role „Muu”, add → a second row; „Tee peamiseks” on it → the pill moves and the contracts list / calendar show the new name; the trash icon on the primary is disabled with the reason while another party remains; remove the non-primary row → gone, an event in the audit trail; the party page's contracts table shows the role column.
  - „Registreeri väline muudatus” → `MARU_uurileping_P29_lisa3.pdf`, note, one changed parameter (key `rent_per_m2`, new value, the sentence from the annex), one key date (e.g. kind Lepingu lõpp with the new date) → submit. Expect: a second entry under „Lähtedokumendid” with role amendment (opens the PDF); in „Põhiandmed” the new rent value with „alates <today>” (the dialog has no effective-date field, so the version starts today); the added key date in „Võtmekuupäevad” and in the calendar — the old end date is NOT replaced, delete it by hand if the annex supersedes it; the contract's own end date field does not change (not editable from this dialog); „Auditijälg” shows `contract.external_amendment_registered` with the note and the old → new values. Known gap: the superseded fact version is still listed next to the new one.
  - Edit title/category via the header edit; change status to Lõppenud → the space becomes Vaba and the delete guard still mentions the archived contract.
  - Auditijälg at the bottom; „Ekspordi auditijälg” → ZIP with events.jsonl, events.csv, manifest.json.

## 9. Calendar, home, notifications

- Kalender: month and list views, kind filter, prev/next month; the imported key dates appear; add a key date 5 days from today on the lease.
- Avaleht „Vajab tegevust”: that key date is listed with „N p pärast”; an overdue one shows „üle tähtaja”.
- Notifications: the daily scan runs at 05:15 UTC — the next morning the bell shows the key-date notification (mark read, mark all read) and the e-mail arrives at the account users' addresses; Seaded → Teavitused controls the lead days.
- Ülevaade: counts (contracts by status, buildings, spaces, occupied/free, key dates in 30 days, open imports) and the health report findings (contracts ending within 6 months, missing referenced annex, no indexation agreed); click a finding → contract.

## 10. Event log and search

- Sündmuslogi (sidebar): counts per actor (Inimene / Süsteem) and per entity; click „Ese” → only asset events; search „Pind 29”; rows link to the space, contract, party or import; the day groups say „Täna”.
  - Export CSV, JSONL and PDF → files download with the current filter applied.
  - Check that the earlier actions are there: pinnaplaan replacement („before → after”), parking assignment, split and merge, space deletion with released spots, import retried/failed/committed.
- Omnibox (top bar, Ctrl K): search a space name, a contract number, a party → hits link to the right pages; a deleted space is not found.

## 11. Multi-account

- With the second user, register a separate account (Loo konto) and add that user to the first account via invite → the user menu offers „Vaheta kontot”; data never leaks between accounts (the other account's objects, parties and events are not visible).
