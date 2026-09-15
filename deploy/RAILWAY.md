# ThinkOne on Railway — setup

One Railway project, four services: **postgres** (managed), **api**, **worker**, **frontend**. Object storage is
**Cloudflare R2** (S3 API, EU jurisdiction). Everything environment-specific is an env var (architecture §9).

## 0. Prerequisites

- Railway account + the Railway CLI (`npm i -g @railway/cli`, then `railway login`).
- Cloudflare account with R2 enabled; one bucket (e.g. `thinkone-prod`) and an R2 API token (Object Read & Write).
- Anthropic API key (Console → API keys). Prompts reach Anthropic under DPA; nothing is used for training.
- Postmark server token + a verified sending domain (SPF/DKIM/DMARC records) — optional at first
  (`EMAIL_PROVIDER=fake` logs emails instead of sending).
- This repository pushed to GitHub (Railway deploys from the repo).

## 1. Create the project and Postgres

```bash
railway init            # new project, e.g. "thinkone"
railway add --database postgres
```

Railway exposes `DATABASE_URL` (postgresql://…) on the Postgres service. The API needs the **asyncpg** form; use a
reference variable so it never gets copied by hand (step 3).

## 2. Create the three app services from the repo

In the Railway dashboard: **New → GitHub Repo** three times (or `railway add --service api` etc.), one service each:

| Service    | Root directory | Config file (set under Settings → Config-as-code) | Public networking |
| ---------- | -------------- | -------------------------------------------------- | ----------------- |
| `api`      | `/`            | `deploy/railway/api.railway.json`                  | yes (generate a domain) |
| `worker`   | `/`            | `deploy/railway/worker.railway.json`               | no                |
| `frontend` | `/`            | `deploy/railway/frontend.railway.json`             | yes (generate a domain) |

`api` and `worker` build the same `backend/Dockerfile`; the config files only differ in the start command. The api start
command runs `python scripts/migrate.py` (Alembic to head + Procrastinate schema when missing + grants) before `uvicorn`,
so migrations run on every deploy (idempotent). The worker starts `procrastinate worker` (queues: default, email, import; daily key-date cron).

## 3. Environment variables

**api** and **worker** (identical, except worker doesn't need CORS/PUBLIC_URL but harmless):

```
APP_ENV=prod
SECRET_KEY=<64 random chars: openssl rand -hex 32>
DATABASE_URL=${{Postgres.DATABASE_URL}}          # Railway reference; the app rewrites postgresql:// → asyncpg
DB_APP_ROLE=thinkone_app                         # NOBYPASSRLS role the first migration creates; sessions SET ROLE to it
PUBLIC_URL=https://<frontend-domain>
API_PUBLIC_URL=https://<api-domain>
CORS_ORIGINS=https://<frontend-domain>
S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com
S3_BUCKET=thinkone-prod
S3_KEY=<R2 access key id>
S3_SECRET=<R2 secret access key>
S3_REGION=auto
LLM_MODE=live
ANTHROPIC_API_KEY=<key>
LLM_MODEL=claude-opus-5
INTEGRATIONS_MODE=fake            # flip per adapter when credentials arrive: ARIREGISTER_MODE=live, EHR_MODE=live
EMAIL_PROVIDER=postmark           # or fake
POSTMARK_TOKEN=<server token>
POSTMARK_WEBHOOK_SECRET=<random>  # sent by Postmark as X-Webhook-Secret header (configure in Postmark webhook URL headers)
EMAIL_FROM=ThinkOne <noreply@yourdomain.ee>
SENTRY_DSN=<optional>
LOG_LEVEL=INFO
```

The Postgres URL Railway gives is `postgresql://`; `app/infra/settings.py` accepts it and derives the asyncpg / psycopg
forms. Use the **private** URL (`DATABASE_URL`, host `postgres.railway.internal`) — the app needs a direct connection
(LISTEN/NOTIFY, no transaction pooler).

**frontend**:

```
API_INTERNAL_URL=http://api.railway.internal:8000    # private networking; browser calls stay same-origin via Next rewrites
PORT=3000
```

## 4. Deploy order and first run

1. Deploy **api** (migrations create the schema, RLS policies and the `thinkone_app` role).
2. Deploy **worker**.
3. Deploy **frontend**; open its domain → `/register` creates the first account + admin user.
4. Postmark: add webhook `https://<api-domain>/api/v1/webhooks/postmark` for Delivery, Bounce, Spam complaint, with a
   custom header `X-Webhook-Secret: <POSTMARK_WEBHOOK_SECRET>`.
5. Health check: `https://<api-domain>/api/health` → `{"status":"ok"}`; API docs at `/api/docs`.

## 5. Day-2

- **Migrations**: automatic on api deploy. Roll back with `railway run --service api alembic downgrade -1`.
- **Logs**: Railway → service → Logs (structured JSON). Errors also go to Sentry if `SENTRY_DSN` is set.
- **Backups**: Railway Postgres has point-in-time backups on paid plans; enable them. R2: turn on bucket versioning.
- **Restore drill** (architecture §8): `railway run --service api sh` → `pg_dump`/`pg_restore` into a scratch DB and
  compare row counts (a scheduled job for this is Phase 4 hardening).
- **Scaling**: api and worker are stateless; add replicas in Railway. Worker concurrency via the start command
  (`--concurrency N`).
- **Credentials that unlock live adapters**: äriregister (open data needs none — set `ARIREGISTER_MODE=live`),
  EHR public API (`EHR_MODE=live`). Moderan, Statistikaamet, risk sources, Dokobit arrive with Phases 3–4.

## Local development

```bash
docker compose -f deploy/compose.dev.yml up -d        # postgres :55433, minio :9000 (console :9001)
cd backend && cp .env.example .env && uv sync
uv run python scripts/migrate.py                        # alembic + procrastinate schema
uv run uvicorn app.api.main:app --reload --port 8000  # API  → http://localhost:8000/api/docs
uv run procrastinate --app app.worker.tasks.app worker  # worker (second terminal)
cd ../frontend && pnpm install && pnpm dev              # http://localhost:3000
uv run pytest -q                                        # backend tests (real Postgres, RLS on)
```
