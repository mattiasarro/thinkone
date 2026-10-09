# ThinkOne on Railway — setup

Two Railway projects in the **ThinkOne** workspace, each with four services — **Postgres** (managed), **api**,
**worker**, **frontend** — plus a **Railway bucket** in the EU-West (ams) region (S3 API). The projects share nothing
(own database, bucket, secrets). Everything environment-specific is an env var (architecture §9).

| Project | ID | Environment | Branch | Frontend | API | Bucket |
| ------- | -- | ----------- | ------ | -------- | --- | ------ |
| `prod` | `cd1607c6-06af-406c-bb80-1c7cf036c692` | `production` (`344deb4f-f1c1-4d37-a22f-3800dafd3b6e`) | `main` | `prod.thinkone.ai` (fallback `frontend-production-ba0c.up.railway.app`) | `api.prod.thinkone.ai` (fallback `api-production-b9c7d.up.railway.app`) | `functional-parcel-hPuf` |
| `dev` | `5ad19bb3-612e-4088-b188-cc58c94214a9` | `dev` (`133ca1aa-f44a-40a6-9364-862a9fea7338`) | `dev` | `dev.futureone.ai` (fallback `frontend-dev-3256.up.railway.app`) | `api.dev.futureone.ai` (fallback `api-dev-701f.up.railway.app`) | `thinkone-dev-files` |

Day-to-day work happens on `dev` against the dev project (see `AGENTS.md`); the working directory is `railway link`ed
to it. Deploy with `deploy/deploy.sh [--prod] <service>...` — it deploys the pushed HEAD commit by SHA and waits for
SUCCESS. Target prod on other CLI commands with `-p cd1607c6-06af-406c-bb80-1c7cf036c692 -e production`.

The dev project was built by repeating the steps below with the repo branch set to `dev` (`railway add --service <name>`
for each empty service, then connect the GitHub source with branch `dev`). Dev reuses the same Anthropic, RIK
(äriregister) and Postmark credentials as prod; `SECRET_KEY`, `POSTMARK_WEBHOOK_SECRET`, the database and the bucket
are its own. Dev `APP_ENV` is `prod` too (it only toggles secure cookies / the fake blob store). Create Railway
services **one at a time** — several concurrent MCP `create-service` calls wedged an environment's change queue and the
project had to be recreated.

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
Production custom domains (zone `thinkone.ai`, DNS at Zone.ee): `prod.thinkone.ai` → frontend (port 3000),
`api.prod.thinkone.ai` → api (port 8000). Each is a CNAME to the per-domain `*.up.railway.app` target Railway shows
when the domain is added (`railway domain <fqdn> --service <svc> --json`), plus a `_railway-verify.<host>` TXT record
with the token from the same output — Railway would not pass ownership validation on the CNAME alone. The
`*.up.railway.app` domains stay attached as fallbacks.
Dev custom domains (zone `futureone.ai`, DNS at GoDaddy): `dev.futureone.ai` → frontend, `api.dev.futureone.ai` → api.
Records Railway asks for (ownership is still *validating* until they exist):

| Host | Type | Value |
| ---- | ---- | ----- |
| `dev` | CNAME | `62x4jns1.up.railway.app` |
| `_railway-verify.dev` | TXT | `railway-verify=624b7a19a3e09b5d1b1531bfc78e0bd3a7bbc3ebc0ae3dbd6481f87b7248b6d2` |
| `api.dev` | CNAME | `jmgfa4uh.up.railway.app` |
| `_railway-verify.api.dev` | TXT | `railway-verify=c3b0a1c749e49bff76058ae03dbeae1b99877ee9b52ebddcf8e9d2183197b223` |

Check with `railway domain list --service frontend --json` / `railway domain status`. Until these resolve, use the
`*.up.railway.app` fallbacks; the dev frontend proxies to the api's Railway domain (`API_INTERNAL_URL`), so the app
works either way, but `PUBLIC_URL` (links in e-mails) already points at `https://dev.futureone.ai`.
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
LLM_MODEL=claude-opus-5-5
INTEGRATIONS_MODE=fake            # per-adapter overrides:
ARIREGISTER_MODE=live
ARIREGISTER_USER=<RIK XML service user>       # Äriregistri XML-teenus (ariregxmlv6.rik.ee) — VAT number, contacts, board;
ARIREGISTER_PASSWORD=<RIK XML service password> #   without these live mode falls back to the public autocomplete (basics only)
EHR_MODE=live                     # Buildings Actual Data API (livekluster.ehr.ee/api/building), no credentials
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
   Prod has this; dev does not yet (add a second webhook for `https://api.dev.futureone.ai/api/v1/webhooks/postmark`
   with dev's `POSTMARK_WEBHOOK_SECRET` if delivery/bounce events matter there).
5. Health check: `https://<api-domain>/api/health` → `{"status":"ok"}`; API docs at `/api/docs`.

## 5. Day-2

- **Migrations**: automatic on api deploy. Roll back with `railway run --service api alembic downgrade -1`.
- **Logs**: Railway → service → Logs (structured JSON). Errors also go to Sentry if `SENTRY_DSN` is set.
- **Backups**: Railway Postgres has point-in-time backups on paid plans; enable them. R2: turn on bucket versioning.
- **Restore drill** (architecture §8): `railway run --service api sh` → `pg_dump`/`pg_restore` into a scratch DB and
  compare row counts (a scheduled job for this is Phase 4 hardening).
- **Scaling**: api and worker are stateless; add replicas in Railway. Worker concurrency via the start command
  (`--concurrency N`).
- **Live adapters**: äriregister (RIK XML service with `ARIREGISTER_USER`/`ARIREGISTER_PASSWORD`; each `lihtandmed`/`detailandmed`
  query is billed by RIK per the contract) and EHR (public, no credentials). Moderan, Statistikaamet, risk sources and Dokobit
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
