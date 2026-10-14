# ThinkOne

Contract-workflow platform (Estonian commercial real estate first, employment contracts second, import of existing contracts).

| Path | What |
| --- | --- |
| `ThinkOne - Funktsionaalne spetsifikatsioon v2.md` | functional spec (current) |
| `architecture.md` | architecture + build plan (§11) |
| `phases.md` | contract phases |
| `demo/` | interactive UX reference (static SPA) — the operator experience the frontend implements |
| `backend/` | FastAPI API + Procrastinate worker (one package, two entrypoints); Postgres with RLS; R2/MinIO storage |
| `frontend/` | Next.js operator app |
| `deploy/` | `compose.dev.yml` (local Postgres + MinIO), Railway service configs, **[RAILWAY.md](deploy/RAILWAY.md)** setup guide |

## Phase 2 status

Implemented: account/user setup with invites and the data-driven „Alusta · 10 minutit” setup card, companies (äriregister
autofill), asset registry (object workflow in five steps — building with EHR autofill · spaces with parts breakdown, CSV
import and a space page · bulk floor-plan upload matched by filename · parking register as a separate asset with per-space
default spots · terms + template; derived occupancy; space split/merge; delete guard for documented spaces), parties with
roles (contracts link to any number of parties with a role each, one primary), templates (general-terms DOCX → locked clause tree), import pipeline (PDF/DOCX/ASiC-E → extraction with anchors → LLM
structuring → review with „Kas see on Pind N?” and äriregister check → commit with space + parking-spot linking; manual
registration for scans; externally signed amendments; in-progress/finished batches), versioned contract facts, key dates +
calendar + daily scan, notifications with email delivery state, global event log page with actor/entity filters and CSV/JSONL/PDF
export plus the per-contract court folder, omnibox search, portfolio health report. Every write is event-logged; RLS is enforced
by a non-superuser application role.

## Phase 3 status

Milestone 3.1 (quote loop): quotes with the demo's wizard and draft page (per-space prices, stepped rent and over-cap electricity
as automatic special terms, parking from the register, VAT as a dated setting, features, attachments), branded quote PDF frozen
as an immutable version on every send, accountless client portal through an expiring share link (accept / propose / decline,
chat, versions with diffs), negotiation and chat threads on the Suhtlus page, letters with delivery state, reminders and
bounce handling, nightly expiry, quote defaults in settings.

Milestone 3.2 (contract preparation): lease drafts generated from an accepted quote (N separate or one shared) or from
scratch — main terms from the deal facts (regenerated on change, operator edits kept and flagged), the building's
general terms snapshotted and locked, Lisa 3 from the quote's special terms with `overrides_clause_id`, facts, key dates
and allocations; the clause editor and the negotiation pane (threads per clause, „Kuidas lahendame?”: explain · fact or
wording proposal · Lisa 3 · answer; one round = one letter; proposals confirmed by the other side; „kõik punktid
aktsepteeritud” → ready_to_sign); the client's A4 view through the same share-link portal; the employment contract
(tööleping) as the second type on the same engine (position quota, TLS main terms, probation/salary-review key dates);
the rule-based attention queue on Avaleht; clause wording in the omnibox index.

Milestone 3.3 (AI foundation): streaming tool-use seam on the Anthropic adapter (scripted fake offline), 18 Pydantic
tools (read: portfolio search, properties/spaces, quotes, contracts, `load_contract` for grounded Q&A, effective state,
key dates, audit trail, negotiation; draft: quote/lease drafts, special-term and commercial-text wording, party from the
registry, risk report — every draft tool returns a confirmation card, nothing sends or signs), the loop with machine-
checked citations (`[§3.1|clause id]` must resolve to a loaded clause), threads/messages/citations/draft feedback/token
metering tables with a monthly budget, SSE chat API, the `/app/ai` page, the risk report on open data (äriregister +
EMTA; paid sources shown as „liidestamata”), and an eval runner over a golden set (`backend/app/agent/evals/`).
See `data/TESTPLAN-phase3.md`.

## Run locally

See the "Local development" section of [deploy/RAILWAY.md](deploy/RAILWAY.md). Demo data: `cd backend && uv run python scripts/seed_demo.py`.
