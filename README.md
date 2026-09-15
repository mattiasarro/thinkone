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

Implemented: account/user setup with invites, companies (äriregister autofill), asset registry (property/space with EHR autofill,
CSV import, attachments, derived occupancy), parties with roles, templates (general-terms DOCX → locked clause tree),
import pipeline (PDF/DOCX/ASiC-E → extraction with anchors → LLM structuring → review → commit; manual registration for scans;
externally signed amendments), versioned contract facts, key dates + calendar + daily scan, notifications with email delivery
state, audit trail + export, omnibox search, portfolio health report. Every write is event-logged; RLS is enforced by a
non-superuser application role.

## Run locally

See the "Local development" section of [deploy/RAILWAY.md](deploy/RAILWAY.md). Demo data: `cd backend && uv run python scripts/seed_demo.py`.
