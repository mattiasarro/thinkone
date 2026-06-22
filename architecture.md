# ThinkOne — Architecture

Implements [spec.md](spec.md). Two deployment targets from one codebase:

1. **On-prem** — single Linux machine running Proxmox; app stack via docker-compose; self-hosted LLM via vLLM (spec example: Qwen3.5-35B-A3B). Sensitive client/contract data never leaves the machine.
2. **Railway** — same containers on Railway with managed Postgres/Redis, S3-compatible object storage, and a frontier model via the Anthropic API.

All target-specific behavior is isolated behind configuration and provider interfaces (12-factor: env vars only, no code branches per environment).

## Decisions already made

| Decision           | Choice                                                    | Rationale                                                                                                                                                                       |
| ------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack              | **FastAPI backend + Next.js frontend**                    | Python owns the domain logic _and_ the agent — tools share Pydantic models with services. Frontend consumes a generated OpenAPI client.                                         |
| Signing            | **Dokobit hash-signing API + local ASiC-E assembly**      | Only SHA-256 digests leave the infrastructure; documents stay local. Broker handles the Smart-ID/Mobile-ID ceremony under one contract. Behind a `SignatureProvider` interface. |
| Client portal auth | **Smart-ID / Mobile-ID login** (Dokobit Identity Gateway) | Strong eID identity from first login; same identity later used for signing; same broker as signing.                                                                             |
| LLM                | **Provider interface with two adapters**                  | vLLM (OpenAI-compatible client) on-prem; Anthropic SDK (native, `claude-opus-4-8`) on Railway.                                                                                  |
| Background jobs    | **Procrastinate** (Postgres-backed task queue)            | Transactional enqueue with the domain write; async-native; reuses the single Postgres — no separate durable broker to run or back up.                                           |

---

## 1. High-level architecture

```
                ┌────────────────────────────────────────────────────────┐
                │                    Reverse proxy (TLS)                  │
                │            Caddy (on-prem) / Railway edge               │
                └───────────────┬──────────────────────┬─────────────────┘
                                │                      │
                       ┌────────▼────────┐    ┌────────▼────────┐
                       │   frontend       │    │      api        │
                       │   Next.js        │───▶│   FastAPI       │
                       │ operator + client│    │ REST + SSE      │
                       │     portal       │    │                 │
                       └─────────────────┘    └──┬────┬────┬────┘
                                                 │    │    │
              ┌──────────────────────────────────┘    │    └───────────────┐
              │                                       │                    │
     ┌────────▼────────┐                     ┌────────▼───────┐   ┌────────▼────────┐
     │     worker      │                     │   PostgreSQL   │   │  Object storage │
     │ Procrastinate:  │────────────────────▶│  (all state)   │   │   S3 API:       │
     │ jobs, cron, PDF,│                     └────────────────┘   │ MinIO / R2      │
     │ signing, agent  │                     ┌────────────────┐   │ plans, PDFs,    │
     └──┬──────┬───────┘────────────────────▶│     Redis      │   │ signed asice    │
        │      │                             │ cache, pub/sub │   └─────────────────┘
        │      │                             └────────────────┘
        │      └──────────────► External adapters (outbound only):
        │                       e-Äriregister · EHR · Moderan · Krediidiinfo ·
        │                       Inforegister · Kohtutäitur · Statistikaamet ·
        │                       Dokobit (hash sign + identity) · SMTP
        │
 ┌──────▼───────────────────────────────┐
 │            LLM provider              │
 │  on-prem:  vLLM (OpenAI-compatible,  │
 │            internal network only)    │
 │  Railway:  Anthropic API             │
 │            (claude-opus-4-8)         │
 └──────────────────────────────────────┘
```

**Shape: modular monolith.** One Python package (`backend/app`) with two entrypoints — `api` (uvicorn) and `worker` (Procrastinate). Same image, different command. No microservices: the domain is one tightly coupled workflow and the team is small; module boundaries inside the package keep it splittable later.

### Components

| Component       | Technology                                                                     | Notes                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| frontend        | Next.js (App Router), TypeScript, Tailwind, TanStack Query, TipTap (rich text) | Two route groups: `/app` (operator/admin) and `/portal` (client). API types generated from OpenAPI via Orval.                                                                                                                                                                                                          |
| api             | FastAPI, SQLAlchemy 2 (async), Pydantic v2, Alembic                            | REST + SSE (chat streaming, notifications).                                                                                                                                                                                                                                                                            |
| worker          | Procrastinate (Postgres-backed, async, built-in periodic tasks)                | Key-date scanning, indexation, quote expiry, PDF rendering, signing ceremonies, risk reports, emails, audit exports, agent runs. Jobs enqueue in the same DB transaction as the domain write (no dual-write window). Procrastinate's tables are created alongside Alembic migrations (`procrastinate schema --apply`). |
| db              | PostgreSQL 16                                                                  | Single database; multi-tenant by `account_id` scoping.                                                                                                                                                                                                                                                                 |
| cache / pub-sub | Redis 7                                                                        | SSE pub/sub and short-lived cache. The durable job queue now lives in Postgres (Procrastinate); Redis no longer holds queue state. Optional: Postgres `LISTEN/NOTIFY` can drive SSE too, letting you drop Redis entirely.                                                                                              |
| files           | S3 API — MinIO (on-prem) / Cloudflare R2 or S3 (Railway)                       | Floor plans, site plans, generated PDFs, signed containers, audit exports. Never store file bytes in Postgres.                                                                                                                                                                                                         |
| llm             | vLLM (on-prem) / Anthropic API (Railway)                                       | See §6.                                                                                                                                                                                                                                                                                                                |
| pdf             | WeasyPrint (HTML/CSS → PDF, Jinja2 templates)                                  | Pure-Python, no headless browser; company logo/accent color injected per Company.                                                                                                                                                                                                                                      |
| digidoc         | libdigidocpp (RIA) with Python bindings, in the worker image                   | ASiC-E container assembly, OCSP + timestamp. Fallback if packaging fights back: tiny DigiDoc4j (Java) sidecar with a 3-endpoint HTTP API.                                                                                                                                                                              |

---

## 2. Domain model

Mapping of spec entities to tables (names in English; spec term in parentheses):

```
account                      (Konto)
company                      (Ettevõte/üürileandja)  account_id, registry data, logo, accent_color, kmkr
property                     (Objekt)                company_id, EHR fields (ehr_code, address,
                                                     use_type, footprint_m2, net_area_m2, floors,
                                                     build_year), vat_taxable, utility_cost_winter/summer
space                        (Pind)                  property_id, name, type, net_area_m2,
                                                     rentable_area_m2, coefficient, price_per_m2,
                                                     electrical_capacity_kw, parking_spots
attachment                                           polymorphic: space floor plans (Lisa 1),
                                                     property site/parking plan (Lisa 2) → S3 key + sha256
template                                             property_id, kind: general_terms | special_terms_base
                                                     | quote_base; versioned, immutable once referenced
client                       (Klient)                EE company | foreign company | person
risk_report                  (Riskiraport)           client_id, score HIGH/MED/LOW, source payloads, ts
quote                        (Hinnapakkumine)        client_id, property_id, status, valid_until,
                                                     commercial_body (TipTap JSON), totals
quote_space                                          quote_id ↔ space_id (1..n spaces per quote)
quote_special_term                                   structured items — flow into lease annex 3
lease                        (Üürileping)            quote_id?, space_id (exactly 1), client_id, status,
                                                     rent, utility, vat_taxable (inherited), indexation
                                                     (method: fixed_pct | stat_cpi, rate, frequency,
                                                     next_date)
annex                        (Lisa)                  lease_id, number (1=floor plan, 2=site plan,
                                                     3=special terms, 4+=amendments), status
clause                       (Lepingupunkt)          lease_id, annex_id?, parent_id? (tree node),
                                                     container: body|annex_id, ordinal (sibling order),
                                                     number_style, category: general|main|special,
                                                     locked, overrides_clause_id (ülimuslikkus,
                                                     machine-readable), text (rich; display number is
                                                     DERIVED from tree, never stored), source_template_id
clause_comment               (ClauseComment)         clause_id, author (operator|client), body,
                                                     resolution: accepted|rejected|open
signature_container          (SignatureContainer)    lease_id, kind: contract(1)|special_terms(2),
                                                     s3_key, sha256, status, signer rows
key_date                     (KeyDate)               lease_id, kind: start|end|indexation, due_date,
                                                     notify_days_before, fired_at
audit_event                  (AuditEvent)            append-only; see §8
thread / message             (CommunicationThread)   per quote/lease; in-app messages
user                                                 operators/admins; account_id, role
portal_identity                                      client-side users; personal code (isikukood) from
                                                     Smart-ID/Mobile-ID auth, linked to client(s)
notification                                         in-app inbox + email dispatch state
```

Key modeling rules from the spec, enforced in the domain layer:

- **General terms are immutable.** At lease creation, the property's `general_terms` template version is snapshotted into `clause` rows with `locked=true`. They are never edited; an accepted change creates a _special-terms clause_ with `overrides_clause_id` pointing at the locked clause. Rendering shows "§X, muudetud Lisa 3 p Y".
- **Quote → N leases.** Accepting a quote covering N spaces creates N lease drafts (one per space), each pre-filled: general terms (locked), main terms generated from property/space/quote data, quote's structured special terms copied into Annex 3.
- **Money is net.** All prices stored without VAT; VAT presentation derived from `property.vat_taxable` (inherited onto the lease at creation) and the standard Estonian rate (config value with effective date, not hard-coded).
- **Rentable area is an input,** not computed (the operator computes it in the import template); coefficient and net area are stored as metadata only.

### Clause structure, numbering & references

A clause is a **node in a tree** (adjacency list via `parent_id`), not a flat bullet — Estonian leases nest (§5 → 5.1 → (a)), and the spec requires every _point_ to be independently addressable, commentable, and override-targetable.

- **Node vs. inline bullet.** A bullet becomes its own `clause` node if and only if it must be independently commented on, overridden, or cross-referenced. Anything below that bar (a parenthetical enumeration nobody addresses on its own) stays as inline formatting inside a node's rich-text `text`. This keeps the tree from exploding into one node per line.
- **Numbers are derived, never stored as identity.** The displayed number (§5.1.2) is a pure function of the committed tree — walk `parent_id` to the container root, applying each level's `number_style`. Identity is the immutable `clause.id` (UUID), assigned once and never changed by reorder, insert, or re-parent.
- **Everything references by id.** `overrides_clause_id`, `clause_comment.clause_id`, and in-text cross-references all store `clause.id`, never a number. A mid-list insert or reorder changes only the _projection_: every number on a rendered document — including a number shown _inside_ a clause that cross-references another — is computed from one consistent read of the tree, so the referencing and referenced clauses renumber together, atomically. Drift is structurally impossible because no reference points at a number.
- **In-text cross-references are structured tokens.** Prose like "subject to §7.3" is a reference node in the rich text carrying the target `clause.id`, resolved to the live number at render time — never a typed string. This is the one place the by-id rule must reach _into_ the body text, not just the foreign keys.
- **Deletion is guarded.** A clause referenced by an override or an in-text token cannot be silently removed — FK `RESTRICT` / block-with-warning; rendering a reference whose target is gone is a loud validation error, never a blank or wrong number. (Override targets are usually `locked` general/main clauses, which aren't deleted anyway.)
- **Signed versions freeze the numbering.** On signing, the rendered document — with concrete "§5.1.2" — becomes an immutable artifact (the legal paper); that frozen numbering is a snapshot output, separate from the editable tree that later amendments work on.
- **Ordering** is `ordinal` scoped to `(container, parent_id)`; reorder/insert rewrites sibling ordinals (trivial at clause-list scale) — or use fractional ranks if single-row inserts ever matter. This touches order, not identity.

Templates carry the same shape: the `general_terms` body is itself a clause tree, snapshotted into the lease's tree at lease creation.

### State machines

Explicit, declarative transition maps in `domain/state_machines.py` — one for Quote, one for Lease/Annex, exactly as in the spec (incl. terminal states `rejected | expired | cancelled` for quotes; `cancelled | ended | early_terminated` for leases). Every transition:

1. validates guards (e.g. "all clauses accepted" before `ready_to_sign`),
2. is executed in one DB transaction,
3. emits an `audit_event`,
4. enqueues follow-up jobs (notifications, PDF render, signing).

Because the job queue lives in Postgres (Procrastinate, see §3), step 4 enqueues _inside_ the same transaction as steps 2–3: a state change and the jobs it triggers commit atomically. There is no dual-write window where a lease is marked signed but its notification or signing job is silently lost — exactly the failure a contract workflow with a court-grade audit trail cannot tolerate. (A Redis-based queue would need a separate transactional-outbox table for the same guarantee; here the queue table _is_ the outbox.)

Both the REST handlers and the agent tools call the _same_ transition functions — there is no second path. Time-based transitions (quote expiry, lease end) are fired by the worker's cron jobs through the same functions.

---

## 3. Backend structure

```
backend/
  app/
    api/                # FastAPI routers, request/response schemas (thin)
      operator/         #   /api/v1/... operator+admin endpoints
      portal/           #   /api/v1/portal/... client endpoints
      agent.py          #   chat: POST message, SSE stream
    domain/             # entities, services, state machines — NO framework imports
      objects.py        #   property/space setup, CSV import
      quotes.py
      leases.py         #   clause engine, annex numbering, overrides
      signing.py        #   orchestration of the signing ceremony
      keydates.py       #   indexation calc (fixed % / CPI), expiry
      pricing.py        #   rent, utility, VAT presentation
    agent/
      tools.py          #   Pydantic-typed tools wrapping domain services
      loop.py           #   provider-agnostic tool loop
      providers/        #   vllm_openai.py, anthropic_native.py
      prompts/
    integrations/       # one adapter per external system, each with a FakeX stub
      ariregister.py, ehr.py, moderan.py, risk/  (krediidiinfo, inforegister,
      kohtutaitur), statistikaamet.py, dokobit_sign.py, dokobit_identity.py,
      email.py
    documents/
      templates/        #   Jinja2 HTML for quote, lease, annexes
      render.py         #   WeasyPrint
      container.py      #   libdigidocpp ASiC-E assembly
    infra/              # db session, S3 client, redis, settings (pydantic-settings)
    worker/             # Procrastinate app: task + periodic-task definitions
  tests/
```

**Layering rule:** `api` and `worker` call `domain`; `domain` calls `integrations` through interfaces (`Protocol` classes); nothing imports upward. Every integration ships a deterministic fake so the full workflow runs locally with zero external accounts (`INTEGRATIONS_MODE=fake`).

**Frontend type sharing:** CI runs FastAPI's OpenAPI export → Orval → typed TanStack Query hooks committed to `frontend/src/api/`. Agent tool-call payloads (the proposals rendered as confirmable cards in chat) are part of the OpenAPI schema, so they cross the boundary typed as well.

---

## 4. Document pipeline

1. **Authoring** — quotes have (a) free-form rich text (TipTap JSON) and (b) structured special-term items; leases are fully structured (clause rows). No document is ever produced by copying free text into a contract.
2. **Rendering** — Jinja2 HTML + company branding → WeasyPrint → PDF. Rendered PDFs are immutable, content-addressed (`sha256`) objects in S3: `account/{id}/lease/{id}/v{n}/lease.pdf`.
3. **Assembly of attachments** — at quote/lease creation the system collects the right files automatically: Lisa 1 floor plans from the selected space(s), Lisa 2 site/parking plan from the property (uploaded once during object setup — stage 02 of the spec).
4. **Versioning** — every send-to-client creates a new immutable document version; the negotiation loop never mutates an already-sent version.

### Clause editor architecture

The clause tree is edited in the operator UI by a **structure-owns-the-tree, TipTap-per-clause** model — _not_ one ProseMirror document for the whole contract.

- **The app/React layer owns the structure**, keyed by `clause_id`: the tree, sibling order, derived numbering, lock state, comment pins, override links, and all block operations (add / indent / reorder / promote / merge). These are commands on the domain model, not editor side-effects — so `clause_id`s are created and destroyed only by guarded operations, never by an editor split/merge you'd have to police.
- **TipTap edits one clause's inline body**, not the document. Each clause renders as static HTML; a TipTap instance is mounted only on the clause being actively edited (click-to-edit), so there is ~1 live editor at a time, not one per clause. Locked clauses (general/main) render as static HTML with no editor at all.
- **Minimal per-clause schema**: paragraph, bold/italic, inline bullet lists (the non-addressable enumerations from §2), plus one custom inline extension — `clauseRef`, carrying `targetClauseId` and rendered through a NodeView to the _live_ derived number. That extension is what makes in-text cross-references store ids and resolve to numbers at render time. Bodies persist as TipTap/ProseMirror **JSON** in `clause.text` (JSON, not HTML, so `clauseRef` ids survive round-trips).
- **Promotion** (inline bullet → addressable clause, per §2) is "extract the selected range from this clause's JSON → create a new clause row with a fresh id" — a model operation, not a ProseMirror split.

**Two renderers, one numbering function.** The editing view (React tree + per-clause TipTap) and the signed-PDF view (server-side WeasyPrint, step 2 above) both consume the _same_ clause tree and the _same_ numbering derivation. That derivation lives in shared logic — computed server-side and handed to both — so the operator's editor and the legal PDF can never disagree on "§5.1.2".

---

## 5. Signing (Dokobit hash-signing + local ASiC-E)

Two containers per the spec: **Container 1** = lease PDF + floor plan + parking plan; **Container 2** = special terms annex. Flow per signer, orchestrated by a worker job with a state row (`signature_container.status`):

```
1. container.py: create ASiC-E, add datafiles                     (local)
2. dokobit: GET signer certificate (/smartid|mobile/certificate)  (digest-free)
3. container.py: prepareSignature(cert) → SignedInfo digest       (local)
4. dokobit: POST /{method}/sign/hash.json with the digest         (only hash leaves)
5. poll status → signature value; show verification code in UI
6. container.py: setSignatureValue → finalize (OCSP + timestamp
   via SK, hash-only) → store signed .asice in S3                 (local)
```

Notes:

- Each container requires its own ceremony per signer — the UI runs them sequentially (sign Container 1 → immediately prompt Container 2).
- `SignatureProvider` is an interface; a `FakeSigner` signs with a self-issued test cert for dev/demo. A future "direct SK" adapter would only replace steps 2/4/5.
- Signed containers are validated locally with libdigidocpp after assembly (do not ship to SiVa — that would upload the document).
- Qualified timestamping + OCSP require an SK contract even in the Dokobit-hash setup; budget for it.

---

## 6. AI agent

### Provider abstraction

```python
class ChatModel(Protocol):
    async def stream(self, system: str, messages: list[Msg],
                     tools: list[ToolDef]) -> AsyncIterator[Event]: ...
```

- **`vllm_openai.py`** — `openai` Python client with `base_url=http://vllm:8000/v1`. vLLM is launched with `--enable-auto-tool-choice --tool-call-parser hermes` (correct for Qwen-family models) so tool calls arrive as structured OpenAI tool calls.
- **`anthropic_native.py`** — official `anthropic` SDK (never an OpenAI-compatible shim for Claude). Default model `claude-opus-4-8`, adaptive thinking, streaming. Prompt caching: `cache_control` breakpoint after the (stable) system prompt + tool definitions; conversation appended after it.
- Internal event vocabulary (`text_delta`, `tool_call`, `done`) normalizes the two; the loop and the UI never see provider types.
- Selected by env: `LLM_PROVIDER=vllm|anthropic`.

The loop itself is hand-rolled (~small): the agent here is ~15 domain tools + entity resolution + Q&A, and human-in-the-loop control matters more than framework features. Because tools are plain Pydantic-typed functions, adopting deepagents/LangGraph later is a harness swap, not a rewrite.

### Tools = the service layer, minus consequences

Per the spec's human-in-the-loop rule, the agent **has no tool that sends, signs, or transitions to a client-visible state**. Tool classes:

- **Read/Q&A** — `search_clients`, `get_property`, `list_spaces`, `get_quote`, `get_lease`, `list_key_dates`, `get_audit_trail`, `summarize_negotiation` (Decision Memory = audit events + clause comments + threads).
- **Draft/prepare** — `create_quote_draft`, `create_lease_draft`, `draft_special_term`, `start_amendment_draft`, `order_risk_report`, `create_client_from_registry`.
- **Clarify** — ambiguous orders ("pind 12" matches two spaces) end the turn with a question, as the spec requires.

"Send to client" / "start signing" appear in the chat UI as **confirmation cards** rendered from the draft the agent produced; clicking them calls the normal REST endpoint under the operator's session. The agent literally cannot perform consequential actions — enforcement is structural, not prompt-based.

Authorization: agent runs inside the operator's request context — tools see exactly what the operator's role and `account_id` allow. Every tool call writes an `audit_event` with `actor = agent`, `on_behalf_of = <operator>`.

### Model sizing (on-prem)

Spec's example Qwen3.5-35B-A3B (MoE) fits a single 48 GB GPU (RTX 6000 Ada / L40S class) quantized FP8/AWQ with headroom for ~32k context; a 24 GB card works with tighter quantization and context. The GPU is the main hardware sizing driver of the on-prem box; everything else runs comfortably in 8 vCPU / 32 GB.

---

## 7. External integrations

All adapters are outbound-only, retried via the worker, and snapshot their raw responses (for the audit trail and for re-parsing):

| System                                                  | Used for                                                          | Notes                                                                                                               |
| ------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| e-Äriregister                                           | Company autofill (onboarding + client creation)                   | Open-data JSON for basics; XML gateway (contract) if KMKR/extended fields needed.                                   |
| EHR (ehitisregister)                                    | Building autofill by EHR code/address                             | Public API; fields stored on `property`, manually correctable.                                                      |
| Moderan                                                 | Utility costs (last 12 months → winter/summer €/m² averages)      | Computed at import; manual entry fallback per spec.                                                                 |
| Krediidiinfo + Inforegister + Kohtutäitur + Äriregister | Risk report                                                       | Fan-out in worker, aggregate to HIGH/MED/LOW, store per-source payloads + timestamp. Informational, never blocking. |
| Statistikaamet                                          | CPI for index-linked leases                                       | Fetched by the indexation cron only when `method=stat_cpi`.                                                         |
| Dokobit                                                 | Hash signing + Smart-ID/Mobile-ID portal login (Identity Gateway) | §5; one broker contract for both.                                                                                   |
| Email                                                   | SMTP (on-prem relay or provider; Resend/SES on Railway)           | Behind `EmailProvider`.                                                                                             |

---

## 8. Cross-cutting concerns

**Auth & tenancy.** Operators/admins: email + password (argon2) with optional TOTP, session cookies. Clients: Dokobit Identity Gateway (Smart-ID/Mobile-ID) → verified personal code → matched to invited client contacts; portal session scoped to the quotes/leases shared with that client. Tenancy: every query filtered by `account_id` in the repository layer (V1); Postgres RLS as a defense-in-depth upgrade later.

**Audit trail (Decision Memory).** Append-only `audit_event` table: `id, ts, account_id, actor (user|agent|system), on_behalf_of, entity_type, entity_id, action, payload (JSONB diff/summary), correlation_id`. Written inside the same transaction as the change. Document versions and signed containers are immutable S3 objects referenced by sha256. **1-click export**: worker job assembles a ZIP per lease — events as CSV/JSONL + all document versions + signed containers — into S3 and hands the operator a download link. (Optional later: hash-chain events for tamper evidence.)

**Key dates & indexation.** Daily cron scans `key_date`: fires notifications `notify_days_before` ahead; on the due date applies the transition. Regular indexation (per spec) applies the new rent **automatically, with no new annex**: compute (fixed % internally; CPI delta from Statistikaamet), update lease rent, write audit event, notify both parties. Deviations (skip a year, change method) and early termination go through the amendment flow (new annex, stage-08 cycle). Quote expiry → `expired`; lease end date → `ended`.

**Notifications.** Single `notify(event, recipients)` in the domain layer → in-app row + email job. Triggers per spec: sent, comment added, accepted, signing invitation, key date approaching.

**Observability.** Structured JSON logs (correlation id = request/agent-run id). On-prem: Loki + Grafana containers (optional profile in compose); Railway: built-in logs. Sentry (or GlitchTip self-hosted on-prem) for errors in both.

---

## 9. Deployment

### 9.1 On-prem (Proxmox + docker-compose + vLLM)

VM layout on one Proxmox host:

- **VM `app`** (8 vCPU / 32 GB / 200 GB): the docker-compose stack below.
- **VM `llm`** (GPU via PCIe passthrough, NVIDIA container toolkit): vLLM only. (Single-GPU hosts can merge this into `app`; separate VM keeps GPU driver churn away from the app.)
- Proxmox Backup Server (or vzdump) for VM snapshots; in-app backups regardless: nightly `pg_dump` + MinIO bucket mirror to a second disk/NAS.

`deploy/compose.onprem.yml` (sketch):

```yaml
services:
  caddy: # TLS termination — automatic Let's Encrypt, or `tls internal`
    # (built-in local CA) when the box has no public DNS;
    # routes / → frontend, /api → api
  frontend: # Next.js, build: ../frontend
  api: # build: ../backend, command: uvicorn app.api.main:app
  worker: # same image, command: procrastinate --app=app.worker.app worker
  postgres: # postgres:16, volume pgdata
  redis: # redis:7
  minio: # + one-shot job creating buckets
  # optional profile: loki, grafana, glitchtip
```

On the `llm` VM:

```yaml
services:
  vllm:
    image: vllm/vllm-openai:latest
    command: >
      --model Qwen/Qwen3.5-35B-A3B --quantization fp8
      --enable-auto-tool-choice --tool-call-parser hermes
      --max-model-len 32768
    deploy:
      {
        resources:
          { reservations: { devices: [{ driver: nvidia, count: 1 }] } },
      }
```

vLLM is reachable only on the internal bridge between the two VMs (no public exposure); the api/worker reach it as `LLM_BASE_URL=http://llm.internal:8000/v1`.

### 9.2 Railway (frontier models)

| Concern                 | Railway implementation                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| frontend / api / worker | Three Railway services from the same Dockerfiles; private networking between them.                                                                                      |
| Postgres / Redis        | Railway managed plugins. Postgres also backs the Procrastinate job queue; Redis is only cache + SSE pub/sub (and is optional if SSE moves to Postgres `LISTEN/NOTIFY`). |
| Object storage          | Railway has no S3 — use Cloudflare R2 (or AWS S3/Backblaze). Same S3 client, different endpoint/creds. EU bucket region.                                                |
| LLM                     | `LLM_PROVIDER=anthropic`, `ANTHROPIC_API_KEY`, model `claude-opus-4-8` (adaptive thinking, streaming, prompt caching on system+tools).                                  |
| Signing/digidoc         | Identical — libdigidocpp lives in the worker image; only hashes leave either way.                                                                                       |
| Email                   | Resend / SES.                                                                                                                                                           |
| Cron                    | Procrastinate periodic tasks (the worker is a long-running service) — keeps parity with on-prem; no Railway-specific cron needed.                                       |

Privacy note for this target: contract data resides on Railway (and R2) and prompts reach Anthropic — commercial API data is not used for training and is covered by DPA, but the spec's "data never leaves the house" guarantee only holds for the on-prem target. Position Railway as the SaaS/managed offering with that documented.

### 9.3 Configuration matrix

Everything that differs is an env var consumed by `infra/settings.py`:

```
LLM_PROVIDER=vllm|anthropic     LLM_BASE_URL / ANTHROPIC_API_KEY / LLM_MODEL
S3_ENDPOINT / S3_BUCKET / S3_KEY / S3_SECRET
DATABASE_URL / REDIS_URL
DOKOBIT_SIGN_TOKEN / DOKOBIT_IDENTITY_TOKEN / DOKOBIT_ENV=sandbox|prod
INTEGRATIONS_MODE=fake|live     (per-adapter overrides: ARIREGISTER_MODE=..., etc.)
EMAIL_PROVIDER=smtp|resend      SMTP_URL / RESEND_KEY
PUBLIC_URL                      (links in emails, magic deep-links into portal)
```

---

## 10. Repository layout

```
thinkone/
  spec.md
  architecture.md
  backend/            # FastAPI + worker (one package, two entrypoints)
  frontend/           # Next.js (operator app + client portal)
  deploy/
    compose.onprem.yml
    compose.llm.yml
    railway/          # service configs / railway.json
  scripts/            # openapi→orval codegen, db seed, backup
```

---

## 11. Build plan

The phased delivery plan — detailed workstreams, time estimates, long-lead dependencies, and milestones — lives in **[build-plan.md](build-plan.md)**. It targets the **on-prem** deployment (Proxmox + docker-compose + self-hosted vLLM); the provider interfaces keep the Railway / frontier-model target available later, but it is not estimated there.
