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

## Run locally

See the "Local development" section of [deploy/RAILWAY.md](deploy/RAILWAY.md). Demo data: `cd backend && uv run python scripts/seed_demo.py`.
