# Phase 3 proposal — Quotes, portal, contract preparation, AI foundation

Written 2026-10-13 against: `phases.md` (Phase 3 paragraph), the v2 functional spec (stages 03–05, AI agent, state machines),
`architecture.md` §11 Phase 3, the demo at v808 (`demo/CLAUDE.md` rules + `demo/demo/app.js`), and the Phase 2 code on `dev`
(`backend/`, `frontend/`). The demo is the UX reference the acceptance criteria are written against; where the demo is
richer than the written spec, the demo wins (architecture §11 Phase 1).

## 1. What Phase 3 must deliver

`phases.md`: the quote workflow and the first operator–client loop (dashboard, quote creation, pricing and VAT, quote PDFs,
client portal access, client review/response flows, messaging, notifications, integrations where access exists); the
contract-preparation foundation (lease and employment templates, clause and variable foundations, draft generation,
commenting/review foundations, portfolio views); the AI foundation (chat, Q&A over permitted context, tools that find and
explain records, the human-in-the-loop workflows).

**Exit demo (architecture §11, unchanged):** a full operator↔client loop — a quote created by hand *and* by agent command,
link sent, client proposes, operator folds the proposal into Lisa 3, the lease draft reaches „kõik punktid aktsepteeritud”;
the AI answers portfolio questions with clickable citations.

Everything about signing, account creation at signing, key-date automation (indexation), amendments (Lisa N rounds, early
termination), renewal and follow-up autopilot is Phase 4 and is deliberately left out below.

## 2. Baseline we build on (Phase 2, on `dev`)

- `contract` with `STATUSES` already containing `draft · sent · negotiating · ready_to_sign · signing · signed · active …`
  (`backend/app/domain/contracts.py`), `contract_party` (N parties, one primary), `contract_fact` (versioned facts),
  `clause` tree with derived numbering and `overrides_clause_id`, `allocation` (exclusive/quota/coverage) with derived
  space status, `attachment` roles (`floor_plan · site_plan · overview_plan · parking_plan · logo · annex`), `template`
  kinds `general_terms` (DOCX → locked clause tree) · `special_terms_base` · `quote_base` (text bodies with `{{…}}`
  fields, samples in `data/mallid/`), `key_date` + kinds (incl. employment `probation`, `salary_review`), `notification`
  with Postmark delivery/bounce state, `domain_event` on every write, `search_index` + omnibox, account settings with
  `quote_expiry` (14) and `notify_days.quote_expiry` (3), Procrastinate worker with a daily key-date scan.
- `ChatModel.structured()` (Anthropic adapter + fake) — used by import structuring, DOCX template ingestion, plan matching.
  There is **no streaming/tool-use seam yet**; that is the first AI deliverable.
- Verticals: `real_estate.py` (property/space/parking schemas, VAT flag, utility costs) and `employment.py`
  (department/position schemas) exist as config; the employment contract type is seeded (`quota:position`) but has no
  template, generator or UI.
- Frontend: operator shell with Avaleht · Ülevaade · Portfell (Lepingud/Esemed/Osapooled/Import) · Kalender · Suhtlus
  (placeholder) · Seaded; no `/portal` route group, no TipTap, no SSE.

## 3. Scope, by workstream

### A. Quote loop (hinnapakkumine)

**Model.** `quote` (number `PAK-YYYY-NNN`, company/property, party, status, `valid_until`, period months, contact
{name,email,phone}, commercial text (TipTap JSON), `omadused` [{label,value}], totals projection, `version` lock),
`quote_space` (space, €/m² override, stepped-rent schedule `[{until_month, price}]`, parking spot ids or count, electrical
amperes override), `quote_special_term` (text, `overrides` target: a general-terms clause id or a main-term key, `auto`
flag + kind `stepped_rent | electricity`), `quote_attachment` (auto-assembled Lisa 1/2 + uploaded PDFs, numbered),
`document_version` (shared with contracts: kind, number V1…Vn, frozen snapshot JSON + rendered PDF sha256 in R2,
sent_at, sent_by — invariant 3, every send freezes), `share_link` (token hash, subject quote|contract, email,
expires_at, opened_at), `thread` / `message` (CommunicationThread: negotiation letters and free chat, author
operator|link_holder, optional `version_no`).

**State machine** exactly the spec's: `draft → sent → (client_proposal → sent)* → accepted → converted`; terminal
`rejected | expired | cancelled`. Expiry is a worker cron (daily, plus the existing scan) — the demo only *displays*
„Kehtivus möödas”; here the transition is real and the portal stops offering accept buttons on an expired quote.

**Wizard** — the demo's three steps (`renderWiz`): Klient (party search with äriregister autofill, reuse `PartyModal`) →
Riskiraport (advisory, never blocks; see D-risk below) → Pinnad (spaces with status Vaba/Pakkumisel, multi-select).
Prefill from a space page or a party page. „Loo pakkumise mustand” applies `account.settings` defaults (period 60 months,
validity 14 days).

**Draft page** (`View.pakkumus`): editable while `draft` or `client_proposal`. Client block (contact editable in draft
only, risk pill). Kommerts rich text (negotiation only, never flows into the contract). Spaces table: parts split,
€/m² per space (override deleted when equal to the price list), add/remove space, live totals. Stepped rent per space
(`+ hinnaperiood`, weighted average in totals) → **auto special term** overriding „Üür (P 3.1)”. Period select
12/24/36/60/120. Parking: default = the space's register spots; with a parking plan the operator picks spots on the
existing `ParkingPlanView` („Vali lähimad vabad” = nearest free regular spots); without a plan a count. Electrical
capacity per space; above the general-terms cap (parsed from the template, 63 A in ÜT 4.4) → **auto special term** per
space, removed when back under the cap. Omadused chips (informational, never contract terms — demo v795). Kõrvalkulu
shown read-only from the property (winter/summer €/m², source Moderan|manual), not summed. VAT: `property.vat_taxable`
→ net + VAT (rate is a dated config value, 24 % today) + gross. Eritingimused: free-text items, no override picker in the
UI (demo decision), auto items not hand-editable. Lisad: Lisa 1 floor plan per space and Lisa 2 parking/site plan
assembled automatically; PDF uploads get the next free number. Key-data sheet above the document (üür · €/m² · m² ·
rendiperiood, „Kehtib veel N päeva · kuni …”) — the demo's `offerVotiHTML`.

**Quote PDF.** WeasyPrint + Jinja2, company logo/accent, content = the demo's `offerSheetHTML` (header, PAK number, dates,
recipient, intro from the `quote_base` template merge fields, price table with stepped rows and net/VAT/gross, parking /
electricity / omadused lines, kõrvalkulu reference, special terms with „kirjutab üle: …”, annex list, non-binding
footer). Rendered on every send and frozen as the version's PDF; „Eelvaade · PDF” pill opens the current render.

**Sending.** „Kinnita ja saada” → email (Postmark, template `pakkumine`) with the share link, `V1` frozen, status `sent`.
Resend creates `V(n+1)` only when content changed since the last snapshot (`offerPending`); reply-only resend keeps the
version. Letter log on the quote (`kirjad`: kind, subject, recipient, delivered/bounced, opened) fed by the existing
Postmark webhooks; bounce → red guide card „Kiri ei jõudnud kohale” with inline address fix + „Saada uuesti”;
`quote.link_opened` event when the client opens the link. Reminder („Meenuta kliendile”) when ≤ 7 days remain or ≥ N
days of silence (N from settings, default 5): editable draft email in the guide card, „Saada” / „Mitte praegu” (snooze
3 days). This is a rule plus a template — no LLM needed.

**Operator negotiation panel** („Läbirääkimised”, right pane): message thread, jump chips „Ettepanekus: hind / parkimine /
rendiperiood” (keyword rule, as in the demo), reply box, „Saada uuesti” (shows „N muudatust läheb kliendile versioonina
Vn”), „Tühista pakkumine”. Version diff modal (`Muudatused / Vana / Uus`: rent total, spaces, €/m², parking, annexes,
electricity, omadused, period, validity, special terms, kommerts) and the client card's „Uuendatud · Vn” with the old
rent struck through.

**Acceptance → conversion** (guide card after `accepted`): „Eraldi lepingud · N” (default, one lease per space) or
„Üks ühine leping” (only when all spaces are in one building; per-space prices, all floor plans in Lisa 1). The third
demo option „Lisa kehtivale LEP-…” creates an amendment round on a signed lease — that is stage 08 and goes to Phase 4.
Conversion creates the drafts described in C and marks the quote `converted`.

**Portfell → Pakkumised tab** with the demo filters: Pooleli · Mustandid · Ootab klienti · Ootab minu vastust · Lõpetatud ·
Vajab tegevust; card model = name + status pill, space/building, €/month, time, next step.

### B. Client portal (share link, no account)

- **Token**: signed, single-subject, expiring with the quote's validity; when the quote converts, the same grant extends to
  the drafts born from it with the contract stage's own validity (settings). Every action by the client writes
  `domain_event` with `actor_type=human`, actor „link holder (email)”. The token is stored hashed; the link is revocable;
  rate-limited; no operator data leaks beyond the one subject.
- **Routes** `/portal/[token]` (Next.js route group, no operator shell): „Minu dokumendid” page in the demo's v634/v780
  `po2` design — greeting, status box (Ootab teid / Ootame üürileandja vastust / Kõik on korras, state carried only by the
  icon box colour, one primary button), document cards sorted Teie kord → teine → korras, last card „Soovite midagi muuta?”
  with chips (Lisapind · Parkimiskoht · Muudatus lepingus) that only prefill the chat input, chat full width, then
  Tähtajad and Kontakt side by side (building logo or initials). Quote view: A4 sheet + attachments pills + decision card
  „Aktsepteerin pakkumise” (green) · „Alusta läbirääkimisi” (free-text panel → `client_proposal`) · „Lükkan pakkumise
  tagasi” (quiet, confirm). Lease draft view: always A4 (demo v526), clauses clickable → right pane thread; tenant edits
  only its own representatives (P 6.2) until signing.
- **Chat = CommunicationThread**, human↔human (Future Invest 2026-08: the AI never answers clients). The operator reads
  and answers it on the **Suhtlus page**, which replaces today's placeholder: one timeline per quote/lease, search,
  „Ootab vastust / Kõik” filters, next step above the thread.
- **Notifications** per spec triggers: quote/lease sent (client email with link), client proposal / comment (operator
  in-app + email), accepted, reminders. Client has no inbox; every client notification is an email with the link.
- **Operator preview** „Vaata üürnikuna”: a floating button on quote/lease pages that opens the portal rendering of that
  document in preview mode (read-only, no actions), replacing the demo's role switch.

### C. Contract preparation (leping mustand)

- **Draft generation** (quote → N drafts, and „Loo leping 0-st” wizard: Klient → Riskiraport → Pind → V1): number
  `LEP-YYYY-NNN`, status `draft`, `allocation` per space (period = handover date, default 1st of next month, + months),
  parties (landlord company + tenant primary), **general terms** snapshotted from the building's template version as
  locked `general` clauses, **main terms** generated by the real-estate vertical (the demo's `pohiTehing` map: P 1.1/1.2
  pooled, 2.1 üüripind, 2.2 parkimiskohad, 2.3 üleandmine, 2.4 otstarve, 3.1 üür incl. per-space rows, 3.2 kõrvalkulud,
  4.1 tagatis = N months' rent, 5.1/5.2 tähtaeg, 6.1/6.2 esindajad table) as `main` clauses whose numbers are inputs
  (facts) rendered inside the sentence, **facts** written as `contract_fact` `reason=initial` (rent, price per space,
  deposit, parking, period, indexation parameters from settings), Lisa 1/2 attachments assembled from the asset registry,
  Lisa 3 = the quote's special terms as already-accepted `special` clauses with `overrides_clause_id` resolved (auto
  electricity terms only to their own space's lease). Representatives: landlord side from company + contact person,
  tenant side from the quote contact; editable per side (`esMuudab` rules).
- **Clause editor** (architecture §4: structure owns the tree, TipTap mounted on one clause at a time): facts as inline
  inputs with source chips, „rebuildPohi” re-renders template wording and flags „Kontrolli sõnastust” when the operator
  had overridden it, ✎ wording edit with a change trail (unlocking a general clause records a diff), „→ Lisa 3” creates a
  special clause overriding the hovered clause, Lisa 3 wording „Sõnasta AI-ga” (workstream D) / „Kinnita sõnastus”.
  Üld clauses stay locked by default. Top bar as in the demo: ← Portfell · document pills (Leping · Lisa 1 · Lisa 2 ·
  Lisa 3 · Eelvaade PDF) · „Versioonid · N →” / „Muudatused · N →” · Ajalugu · „Tõendite kaust ↓” (exists) · „Küsi selle
  lepingu kohta”. Key-data sheet (üür kuus · €/m² · m² · tagatis with „P 3.1 ›” source links). No table of contents, no
  status trail on the bar (demo decisions).
- **Send V1** freezes `document_version` V1 (clause snapshot + PDF); from then on „Muudatused · N” compares against V1
  (word-level wording diffs, facts, Lisa 3 items) with tabs Muudatused / Saadetud / Kehtiv; each operator round reply
  freezes V(n). Lease PDF = WeasyPrint from the same tree and the same numbering function as the editor and the A4 web
  view.
- **Per-clause negotiation**: `clause_thread` (clause, opener, status `open | awaiting_confirmation | resolved`,
  resolution `changed | special_term | explained | unchanged` — shown as „Muudetud / Eritingimus / Selgitatud / Jääb
  samaks”, never „tagasi lükatud”), `clause_message`, `proposal` (target: fact value | wording | Lisa 3 text, with the
  override target). Tenant: comment, „Soovin muuta: <fakt>” structured wish, confirm/decline a proposal, „Sobib” on an
  explanation, reopen. Operator „Kuidas lahendame?” with the four demo options (Selgitan tingimust · Muudan: fakt/sõnastus
  · Saadan Lisa 3-sse · Soovin ainult vastata); tenant confirmation applies the fact (new `contract_fact`, rebuild main
  clause) or the wording or activates the Lisa 3 clause. Whose turn = last word (`aruOotabOp`).
- **Rounds** (üks voor = üks kiri): `contract.round {nr, side}`, the side that is waiting sees the last *published*
  snapshot (`pub`), its edits are blocked server-side; „Saada märkused · N” (tenant) / „Saada vastused · N” (operator,
  only when every pending point is answered; „Tagasta üürnikule” when nothing to answer) publishes one letter, one
  notification, one event and flips the turn. Round letters appear as a card only for the other side's letter.
- **End of rounds**: tenant with nothing open → „Aktsepteerin kõik punktid” → `ready_to_sign`; Phase 4 adds „Allkirjasta
  kohe”. The single guide card component (`juhtKaart`: whose-turn mark, text, meta, one primary button) drives both
  quote and lease states.
- **Employment contract template (tööleping)** — the config-path proof: `employment.py` registers the main-terms
  generator (employee, position, salary, start, probation end, salary review, place of work, working time), the general
  terms come from an uploaded DOCX template exactly like the lease (`contract_type_code=employment`), key dates `start ·
  end · probation · salary_review` are created at draft time, wizard type „Tööleping” (Kandidaat → Ametikoht →
  Tingimused → V1, available once a position exists), the candidate gets the same share-link portal and the same clause
  loop. No TÖR, no negotiation specifics beyond the shared engine. **Input needed:** Future Invest's employment template
  DOCX and one sample contract.
- **Portfolio views**: Lepingud list shows platform drafts with their negotiation state and whose turn; contract page
  gets the document pills, versions and the negotiation pane; archive filter hides superseded versions by default.

### D. Dashboard, overview, omnibox, risk

- **Avaleht „Fookus”** (demo v770): one next-step decision per document (`p7Samm` → `domain/registry.py` attention rules:
  quote draft unsent, client proposal waiting, expiring quote, lease round on the operator, imports in review, lease end
  ≤ 6 months → notice deadline, decision-type key dates ≤ 90 days; indexation shown as „rakendub ise”, green rows counted
  but not listed), compact focus card with one button + „Hiljem” (session), „Järgmisena” rows + „Näita veel”, links to
  Suhtlus and Kalender, composer at the bottom that opens the AI page. Rule-based; the LLM at most phrases the one-liner
  (not in Phase 3).
- **Ülevaade**: the four KPI tiles with sparklines — Üüritulu (from contract facts, 12 months actual → forecast),
  Täituvus, Lõpeb 12 kuu jooksul (% of rent), Tühja pinna hind — one detail pane at a time, neutral colours; the existing
  health box stays. Personal block (positions, probation, salary reviews) only if the employment vertical has data.
- **Omnibox**: index quotes, platform-lease clauses (demo gap: only imported clauses were searchable) and threads; Enter
  with no hit → „Küsi AI-lt” handing the text to the agent.
- **Risk report**: `risk_report` (party, score KÕRGE/KESKMINE/MADAL, per-source payloads, timestamp) behind a `RiskSource`
  seam with fakes. First real source = the demo's open-data scoring ported from `tools/riskiandmed.py` (äriregister
  annual-report figures + EMTA public tax-debt and quarterly turnover lists; rule-based `riskHinne`, never invented
  negatives). Krediidiinfo / Inforegister / Kohtutäitur adapters only when credentials arrive (contract: „where required
  access is available”). Page `/app/osapool/<id>/risk` with the demo's gauge + signals table; entry points wizard step 2,
  quote client block, party page, agent tool `order_risk_report`.

### E. AI foundation

- **Seam**: `ChatModel.stream(system, messages, tools)` on the Anthropic adapter (official SDK, `claude-opus-5-5`,
  streaming, adaptive thinking, prompt caching after system + tools + loaded contract) + a scripted fake; hand-rolled
  tool loop in-process (`agent/loop.py`), runs in the operator's request context (RLS + account), max turns / tool calls
  per run.
- **Persistence**: `agent_thread` (context subject: contract | quote | party | portfolio, title, origin page),
  `agent_message` (role, text, tool calls/results, cards, prompt version), `agent_citation` (message → clause id,
  validated), `ai_draft_feedback` (used | edited | discarded), `llm_usage` (tokens per run, account/user, daily rollup,
  monthly per-account budget → graceful degradation notice).
- **Tools (Pydantic, wrap domain services)** — read: `search_parties`, `get_property`, `list_spaces`, `get_quote`,
  `load_contract` (rendered contract context with `§` numbers + clause ids; signed or draft version), `search_portfolio`,
  `get_effective_state`, `list_key_dates`, `get_audit_trail`, `summarize_negotiation`; draft (all
  `requires_confirmation=true`): `create_quote_draft`, `create_lease_draft`, `draft_special_term` (the „Sõnasta AI-ga”
  and „Saadan Lisa 3-sse” prefill — replaces the demo's regex `aiSonasta`/`p8Sonastus`), `draft_commercial_text`,
  `explain_clause`, `order_risk_report`, `create_party_from_registry`. No tool sends, signs or changes a client-visible
  state — those appear as confirmation cards that call the normal endpoints. Entity resolution with clarification
  („pind 12” matches two spaces → question). `apply_client_proposal`, `draft_reply`, amendment drafts and the smart-
  dashboard phrasing stay in Phase 4 per the build plan.
- **Chat UI** (`/app/ai`, demo v771): thread list grouped Täna / Eile / 7 päeva / Varem, delete with 10 s undo,
  context chip „Kontekst · LEP-… / Kogu portfell” linking back to the origin page, SSE streaming, „Töö käik” step list
  showing the *real* tool calls, answers as text + clause-reference chips (validated citations open the clause) + data
  cards (mini-tables with „Ava Portfellis” links), clarification option buttons, confirmation card Kinnita · Muuda ·
  Loobu that creates the draft and deep-links to it. „Küsi selle … kohta” on contract/quote pages, Avaleht composer and
  omnibox fallback all open this page with context.
- **Q&A**: per-contract via `load_contract` (platform and imported trees alike); cross-contract via the structured tools;
  citations post-validated, hallucinated numbers rejected. **Eval runner** `agent/evals/` over the seed portfolio
  (`scripts/seed_demo.py`), golden set format agreed with Future Invest, first ~10 questions in Phase 3, target ≥ 95 %
  with valid citations by Phase 4 end.

### F. Cross-cutting (every workstream)

RLS on every new table (`tenant_table`), `domain_event` for every write incl. link-holder actions, `search_index`
maintenance, optimistic `version` + 409 on quote/contract drafts, idempotency keys on send/resend, i18n strings in
`frontend/src/i18n/et.ts`, Estonian „Teie” form for the client, backend tests for every state transition + RLS for
share links, a `data/TESTPLAN-phase3.md` manual plan with sample inputs, README Phase 3 status, demo kept as reference
(we back-port only when it stays the UX reference). `deploy/deploy.sh api worker frontend` on `dev` after each
milestone.

## 4. Out of scope for Phase 3 (and why)

| Item | Where it goes |
| --- | --- |
| Signing (Dokobit, ASiC-E, N signers), account-at-signing, „Allkirjasta kohe” | Phase 4 |
| Indexation application, lease end transition, 90-day notices automation | Phase 4 (data + scan already exist) |
| Amendments: Lisa N rounds, „Lisa kehtivale LEP-…” conversion option, early termination, space add/remove on a signed lease | Phase 4 (stage 08) |
| `apply_client_proposal`, `draft_reply` (Suhtlus „AI mustand”), negotiation summaries, smart-dashboard phrasing | Phase 4 „AI completion” |
| Follow-up autopilot, one-click renewal | Phase 4 (closed scope decisions) |
| Client-facing AI, TÖR, OCR, eIDAS, intra-account roles | Out of MVP (confirmed 2026-08) |
| Demo experiments the user reverted — decision card for wish detection (v723), pre-send email confirmation card (v641), table of contents in the document (v585), „Tagasi lükatud” clause outcome (v647), portal redesign v779, Avaleht „Vajab tegevust” triage (v770), „Mis erineb tavalisest” card (v765) | Not ported |

## 5. Inputs and decisions needed from Future Invest

1. **Employment template** DOCX + one sample tööleping, and the list of main terms the template expects.
2. **Golden-set format** and the first ten Q&A questions over the seed portfolio.
3. **Credentials**: Postmark sending domain for `dev.thinkone.ai` / `thinkone.ai` (SPF/DKIM/DMARC), Krediidiinfo /
   Inforegister / Kohtutäitur (risk), Moderan (kõrvalkulu; manual entry stays the fallback), e-äriregister XML user.
4. **Confirmations**: quote PDF design = the demo sheet; „Üks ühine leping” variant included; „Lisa kehtivale LEP-…”
   deferred to Phase 4; the contract-stage share-link validity default (proposal: 30 days, in settings); VAT rate as a
   dated config value (24 %).

## 6. Sequencing — three milestones, each with a sync demo

| Milestone | Delivers | Demo at the sync |
| --- | --- | --- |
| **3.1 Quote loop** | A model + wizard + draft page + PDF, share links + portal quote view, accept / propose / decline, versions and diff, letters + bounce + reminder, expiry cron, Pakkumised tab, Suhtlus page, notifications | Operator creates and sends a quote; client proposes a change via the link; operator resends V2; client accepts |
| **3.2 Contract preparation** | Quote → N drafts and „0-st” wizard, main-terms generator + facts, clause editor, send V1 + freeze + Muudatused diff, portal lease A4 + clause threads + rounds + „Kuidas lahendame?”, `ready_to_sign`, employment template + wizard, Avaleht Fookus, contract page pills/versions | The accepted quote becomes drafts; the client comments a clause; the operator folds it into Lisa 3; „kõik punktid aktsepteeritud”; a tööleping draft is generated from a position |
| **3.3 AI foundation + overview** | Streaming seam, loop, tools, chat UI with citations and confirmation cards, agent-created quote draft, evals + metering, Ülevaade KPIs, risk report (open data), omnibox extensions, test plan, hardening | „Loo pakkumine ettevõttele X, pind 12” → confirmation card → draft; portfolio and per-contract Q&A with clickable citations; eval run on the golden set |

Order inside a milestone: model + domain + state machine + tests first, API, then UI, then the demo-sync details.
Milestone 3.1 is the critical path (3.2 needs the quote and the share link; 3.3's `create_quote_draft` tool reuses 3.1's
domain command verbatim).

## 7. New tables (summary)

`quote · quote_space · quote_special_term · quote_attachment · document_version · share_link · thread · message ·
clause_thread · clause_message · proposal · contract_round (or columns on contract) · risk_report · agent_thread ·
agent_message · agent_citation · ai_draft_feedback · llm_usage`. All tenant-scoped with RLS; `document_version`,
`thread`/`message` and `share_link` are shared by quotes and contracts via a `subject_type/subject_id` pair.

## 8. Phase 3 acceptance checklist (draft, to be signed off)

- [ ] Quote created by hand and by agent command; PDF branded per company; every send frozen as a version with sha256.
- [ ] Client opens the link without an account; accept / propose / decline work and are event-logged as the link holder;
      an expired quote cannot be accepted; bounce surfaces with a resend.
- [ ] Accepted quote with two spaces produces two drafts (or one shared draft on request) with locked general terms,
      generated main terms with facts, Lisa 1–3 assembled, special terms carrying `overrides_clause_id`.
- [ ] Client comments a clause via the link, operator resolves it with one of the four options, the change lands in
      Lisa 3 or the fact, „Muudatused · N” shows the word-level diff against V1, rounds alternate strictly, the draft
      reaches `ready_to_sign`.
- [ ] A tööleping draft is generated from a position with the uploaded employment template and the employment key dates.
- [ ] Suhtlus shows every client message; operator and client notifications fire per spec triggers.
- [ ] AI answers a per-contract and a portfolio question with citations that open the cited clause; a hallucinated `§`
      never reaches the operator; conversations, citations and token usage are stored; the eval runner passes the
      agreed first questions.
- [ ] Avaleht shows one next step per document from the rule engine; Ülevaade shows the four KPI tiles.
- [ ] Every write is event-logged; RLS tests cover the new tables and share links; `uv run pytest`, `tsc`, `eslint`
      green; deployed on `dev`.
