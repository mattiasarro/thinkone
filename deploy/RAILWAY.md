# ThinkOne on Railway — setup

One Railway project, four services: **postgres** (managed), **api**, **worker**, **frontend**. Object storage is a
**Railway bucket** in the EU-West (ams) region (S3 API); Cloudflare R2 works the same way behind the S3 seam. Everything environment-specific is an env var (architecture §9).

## 0. Prerequisites

- Railway account + the Railway CLI (`npm i -g @railway/cli`, then `railway login`).
- Object storage: a Railway bucket (created below) — or a Cloudflare R2 bucket + API token if you prefer R2.
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

Railway's JSON config-as-code is deprecated, so build and start settings live on the service (dashboard → Settings, or
`railway environment edit --service-config`). Create three empty services (`railway add --service api` etc., or the MCP
`create-service`), connect each to the GitHub repo (branch `main`), and set:

| Service    | Root directory | Builder / Dockerfile | Start command | Health check | Restart | Watch paths |
| ---------- | -------------- | -------------------- | ------------- | ------------ | ------- | ----------- |
| `api`      | `/backend`     | Dockerfile `Dockerfile` | `sh -c 'python scripts/migrate.py && uvicorn app.api.main:app --host 0.0.0.0 --port $PORT'` | `/api/health`, timeout 180 s | ON_FAILURE ×5 | `/backend/**` |
| `worker`   | `/backend`     | Dockerfile `Dockerfile` | `procrastinate --app app.worker.tasks.app worker --concurrency 4` | none | ALWAYS | `/backend/**` |
| `frontend` | `/frontend`    | Dockerfile `Dockerfile` | `node server.js` | `/login` | ON_FAILURE | `/frontend/**` |

Generate a public domain for `api` (target port 8000) and `frontend` (target port 3000); the worker stays private.
`api` and `worker` build the same image; only the start command differs. The api start command runs
`python scripts/migrate.py` (Alembic to head + Procrastinate schema when missing + grants) before `uvicorn`, so
migrations run on every deploy (idempotent). Both apps bind IPv4 (`0.0.0.0`): Railway's health check and public proxy reach the container over IPv4, and a
uvicorn bound to `::` failed its health check. The frontend therefore proxies to the api's **public** URL rather than
the IPv6-only private hostname.

Object storage: `railway bucket create thinkone-files --region ams --environment production` (EU West), then
`railway bucket credentials --bucket <name> --environment production --json` gives endpoint, bucket name and keys.

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
S3_ENDPOINT=<bucket endpoint>          # Railway bucket (railway bucket credentials --bucket thinkone-files) or R2
S3_BUCKET=<bucket name>
S3_KEY=<access key id>
S3_SECRET=<secret access key>
S3_REGION=auto
S3_ADDRESSING=virtual                 # Railway buckets and R2 use virtual-host URLs; MinIO uses path
LLM_MODE=live
ANTHROPIC_API_KEY=<key>
LLM_MODEL=claude-opus-5
INTEGRATIONS_MODE=fake            # per-adapter overrides; both public registries need no credentials:
ARIREGISTER_MODE=live
EHR_MODE=live                     # Buildings Actual Data API (livekluster.ehr.ee/api/building)
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

Also set `PORT=8000` on `api` so the public domain's target port and uvicorn agree (Railway otherwise assigns a
random port). The frontend gets `PORT=3000`.

**frontend**:

```
API_INTERNAL_URL=https://<api-domain>   # the browser calls same-origin /api/*; a runtime route-handler proxy forwards
PORT=3000                                #   to this URL (read per request). Private http://api.railway.internal:8000 is
HOSTNAME=0.0.0.0                         #   IPv6-only and needs an IPv6-bound api — see §2.
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
- **Live adapters**: äriregister and EHR are live and need no credentials. Moderan, Statistikaamet, risk sources and Dokobit
  arrive with Phases 3–4.

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
