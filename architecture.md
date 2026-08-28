# ThinkOne — Architecture

Implements the **v2 functional spec** ([ThinkOne - Funktsionaalne spetsifikatsioon v2.md](<ThinkOne - Funktsionaalne spetsifikatsioon v2.md>)), which generalizes the v1 lease workflow into a contract platform: an asset registry (esemeregister) and a contract engine (lepingumootor) joined by allocations (hõive), with employment contracts as the second vertical and import of existing contracts. (v1 spec: [spec.md](spec.md), historical.)

Single deployment target: **Railway** — app containers with managed Postgres/Redis, Cloudflare R2 object storage, and a frontier model via the Anthropic API (DPA; API data not used for training). The v1 on-prem target (Proxmox + vLLM, "data never leaves the machine") is retired with spec v2; the provider interfaces that enabled it (LLM, storage, email, signing) remain as seams so a self-hosted variant stays possible later, but it is not designed or estimated here.

All environment-specific behavior stays behind configuration and provider interfaces (12-factor: env vars only, no code branches per environment).

## Decisions already made

| Decision           | Choice                                                                    | Rationale                                                                                                                                                                                                                                     |
| ------------------ | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack              | **FastAPI backend + Next.js frontend**                                    | Python owns the domain logic _and_ the agent — tools share Pydantic models with services. Frontend consumes a generated OpenAPI client.                                                                                                       |
| Signing            | **Dokobit hash-signing API + local ASiC-E assembly**                      | Only SHA-256 digests leave the infrastructure; documents stay local. Broker handles the Smart-ID/Mobile-ID ceremony under one contract. Behind a `SignatureProvider` interface.                                                               |
| Client portal auth | **Share-link (no account) → eID account at signing**                      | Spec v2: quote + the lease drafts born from it are reachable via signed expiring links; the account is created at signing from the eID identity the Dokobit ceremony already yields (Smart-ID/Mobile-ID); same broker as signing.             |
| LLM                | **Anthropic API behind a `ChatModel` seam**                               | Native `anthropic` SDK, model `claude-opus-5`. Single adapter today; the seam stays so a self-hosted adapter can return if ever needed.                                                                                                       |
| Background jobs    | **Procrastinate** (Postgres-backed task queue)                            | Transactional enqueue with the domain write; async-native; reuses the single Postgres — no separate durable broker to run or back up.                                                                                                         |
| Persistence        | **Event-logged relational core — Postgres; no XTDB, no event sourcing**   | Every mutation emits a `domain_event` in-transaction; legally significant values are versioned facts with validity periods; every sent/signed version is an immutable artifact. §2 explains why a bitemporal DB / ES write model is rejected. |
| Party & access     | **One `party` table with roles; `membership` = user↔account M2M**         | Client/employee/supplier are roles, not tables — merging separate tables later is migration hell. M2M membership keeps advisor access and the counterparty network open without rework.                                                       |
| Tenancy            | **`account_id` on every row + Postgres RLS from V1**                      | "Thousand-account shape" from day one; repository scoping alone is convention, not enforcement.                                                                                                                                               |
| Agent autonomy     | **`requires_confirmation` policy on every mutating tool (MVP: all true)** | Future autopilot becomes per-tool configuration, not development.                                                                                                                                                                             |
| Frontend IA        | **Five pages + omnibox — the demo is the UX spec**                        | Avaleht · Ülevaade · Portfell · Kalender · Suhtlus; a new vertical adds types and filters, never a page.                                                                                                                                      |

Added with spec v2: **Deployment = Railway only** (v1 on-prem/vLLM target retired). **Vertical = configuration + a thin code module** — schemas, templates, and key-date kinds are configuration; calculations and integrations are code in `verticals/<name>.py`; never a formula DSL, never EAV. **Agent runs in-process** in api/worker, not as a separate AI service — the spec's "AI-kihi taristu jookseb Railway platvormil" is satisfied by the whole platform running on Railway, and tools stay plain Python sharing transactions with the domain; a separate agent service would turn every tool call into a network hop for no benefit.

Added with the MVP review (2026-08): the persistence invariants and party/access model above, plus — **key-date kinds as configuration records** (not enums; the calendar scales to new date types without development), **citations stored as data** (every AI answer's clause references persist as rows), **AI-draft feedback captured from day 1** (used / edited / discarded), **every sent draft frozen** (not only signed versions), **N signers per party** (joint representation is first-class), **.asice/.bdoc import** (containers are unpacked, signature metadata kept), **optimistic concurrency + idempotent sends**, **deliverability-grade email** (own sending domain, SPF/DKIM/DMARC, bounce visibility), **i18n-ready strings, full account export, product metrics from day 1**, and **soft delete everywhere** with GDPR erasure as an explicit procedure.

---

## 1. High-level architecture

```
                ┌────────────────────────────────────────────────────────┐
                │                    Reverse proxy (TLS)                  │
                │                    Railway edge                         │
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
     │ jobs, cron, PDF,│                     └────────────────┘   │ Cloudflare R2   │
     │ signing, agent  │                     ┌────────────────┐   │ plans, PDFs,    │
     └──┬──────┬───────┘────────────────────▶│     Redis      │   │ signed asice    │
        │      │                             │ cache, pub/sub │   └─────────────────┘
        │      │                             └────────────────┘
        │      └──────────────► External adapters (outbound only):
        │                       e-Äriregister · EHR · Moderan · Krediidiinfo ·
        │                       Inforegister · Kohtutäitur · Statistikaamet ·
        │                       Dokobit (hash sign + identity) · SMTP ·
        │                       TÖR (post-MVP, operator-confirmed)
        │
 ┌──────▼───────────────────────────────┐
 │   Anthropic API (claude-opus-5)      │
 │  DPA · no training on API data ·     │
 │  per-request context only; agent     │
 │  loop runs in-process in api/worker  │
 │  — no separate AI service            │
 └──────────────────────────────────────┘
```

**Shape: modular monolith.** One Python package (`backend/app`) with two entrypoints — `api` (uvicorn) and `worker` (Procrastinate). Same image, different command. No microservices: the domain is one tightly coupled workflow and the team is small; module boundaries inside the package keep it splittable later.

### Components

| Component       | Technology                                                                     | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| frontend        | Next.js (App Router), TypeScript, Tailwind, TanStack Query, TipTap (rich text) | Operator app = the demo's five-page IA — **Avaleht · Ülevaade · Portfell · Kalender · Suhtlus** — plus the **omnibox** (Cmd+K: search across all entities + command palette, §8); a new vertical adds types and filters to these pages, never a page. Route groups: `/app` (operator/admin — incl. the import review UI, the largest new v2 surface) and `/portal` (client; quote/lease-draft share-link views run accountless, see §8). UI strings i18n-ready from day 1. API types generated from OpenAPI via Orval. |
| api             | FastAPI, SQLAlchemy 2 (async), Pydantic v2, Alembic                            | REST + SSE (chat streaming, notifications).                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| worker          | Procrastinate (Postgres-backed, async, built-in periodic tasks)                | Key-date scanning, indexation, quote expiry, PDF rendering, signing ceremonies, risk reports, emails, audit exports, agent runs. Jobs enqueue in the same DB transaction as the domain write (no dual-write window). Procrastinate's tables are created alongside Alembic migrations (`procrastinate schema --apply`).                                                                                                                                                                                                 |
| db              | PostgreSQL 16                                                                  | Single database; multi-tenant by `account_id` + RLS (§8). Also holds the job queue, the event log, and the search projection.                                                                                                                                                                                                                                                                                                                                                                                          |
| cache / pub-sub | Redis 7                                                                        | SSE pub/sub and short-lived cache. The durable job queue now lives in Postgres (Procrastinate); Redis no longer holds queue state. Optional: Postgres `LISTEN/NOTIFY` can drive SSE too, letting you drop Redis entirely.                                                                                                                                                                                                                                                                                              |
| files           | S3 API — Cloudflare R2 (MinIO as local-dev stand-in)                           | Floor plans, site plans, generated PDFs, signed containers, imported source documents, audit exports. Never store file bytes in Postgres.                                                                                                                                                                                                                                                                                                                                                                              |
| llm             | Anthropic API (`claude-opus-5`), agent loop in-process                         | See §6.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| pdf             | WeasyPrint (HTML/CSS → PDF, Jinja2 templates)                                  | Pure-Python, no headless browser; company logo/accent color injected per Company.                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| digidoc         | libdigidocpp (RIA) with Python bindings, in the worker image                   | ASiC-E container assembly, OCSP + timestamp. Fallback if packaging fights back: tiny DigiDoc4j (Java) sidecar with a 3-endpoint HTTP API.                                                                                                                                                                                                                                                                                                                                                                              |

---

## 2. Domain model

### Persistence invariants (event-logged CRUD)

One storage decision underlies the MVP review's architecture points, and it is made explicitly here: **a conventional relational core in Postgres wrapped in three invariants** — not a bitemporal database (e.g. XTDB), not an event-sourced write model.

The domain has two time axes, and they need different tools:

- **Valid time is contract content.** "Rent is 2 892 € from 01.01.2025" takes effect from a contractual date (indexation date, annex effective date), not from when someone typed it. No database provides this for free — it is negotiated domain data and must be modeled explicitly whatever the engine, so a bitemporal store's headline feature would not remove the modeling work.
- **Record time is the event log.** Who changed what, when, and why is served by a mandatory in-transaction event log — richer than DB-level system versioning because it carries actor type, reason, and correlation.
- The one genuinely bitemporal need — **correction vs. amendment** — is two columns, not a database product: an indexation writes a new fact version with a contractual `valid_from`; fixing a typo writes one with a back-dated `valid_from`, `reason=correction`, and a `recorded_at` that reveals when the truth was learned. And the dispute-grade question "what did the client see on date X" is answered by frozen artifacts (invariant 3), not by database replay — a court accepts a signed container, not an event fold.

**Event sourcing is rejected as the write model** on the same economics: the domain is relational and query-heavy (clause trees, portfolio search, dashboards, calendars), and its history is already first-class rows — comments with statuses, negotiation rounds, annexes, document versions, signatures. ES would add projection infrastructure and event-schema evolution for no additional legal value. The design is forward-compatible instead: the event stream exists (invariant 1), so real projections — analytics, the counterparty network — can be added later without rearchitecting.

**Invariant 1 — every mutation emits a `domain_event`, in the same transaction.** Append-only: `id, ts, account_id, actor_type: human|system|agent, actor_user_id, on_behalf_of, entity_type, entity_id, action, payload (JSONB), reason, correlation_id`. No code path writes the database without one. One table serves four readers: the audit trail / decision memory (§8), product metrics (time-to-first-answer, click-to-accept), the automation measure (`actor_type` — impossible to reconstruct retroactively), and the AI-feedback dataset (§6). Enforcement is structural: every write goes through a domain command that emits the event — the agent calls the same commands, so it cannot bypass the log — plus a CI check that fails on repository writes outside a command. And every action and preference carries a `user_id` even under the flat V1 permission model: personalized AI cannot be built on anonymous history.

**Invariant 2 — legally significant values are versioned facts, never overwritten.** `contract_fact` rows (rent, utility rates, indexation parameters, salary) carry `valid_from/valid_to`, `recorded_at`, `reason: initial|indexation|amendment|correction`; an exclusion constraint forbids overlapping validity for one key. "Mis kehtis 1.01.2025?" is a range lookup. Stepped rent (astmeline üür) is the same shape on the price side — a rent value per period. The current-value columns on `contract` remain as a **maintained projection** of the latest fact version — the write path updates both atomically — so everyday queries and search stay plain SQL.

**Invariant 3 — every externally visible version is an immutable artifact.** Not only signed containers: every send-to-client freezes the rendered PDF _and_ a clause-tree snapshot, content-addressed in object storage — evidence of exactly what the counterparty saw and negotiated over. Signing additionally freezes numbering (see clause rules below).

Two floor rules complete the model: **soft delete everywhere** (`deleted_at` + partial indexes; hard deletion exists only as the explicit, event-logged **GDPR-erasure procedure**), and **post-signature corrections never happen silently** — the legal fix is an amendment (new annex, stage 08), the register fix is a `reason=correction` fact version plus event, so the signed document and the register cannot quietly diverge.

### v2 platform core: assets, allocations, verticals

The engine owns only what is provably universal across the three known contract shapes — real-estate lease, employment contract, imported generic contract: **contract + clause tree + state machines + document versions + key dates + event log**. Everything else is per-vertical.

```
asset_type       vertical, kind: container|unit, attribute-schema ref (code)
asset            account_id, asset_type_id, parent_id (container → units),
                 name, attributes JSONB (validated by the vertical's Pydantic
                 schema — schema lives in code, data in JSONB), capacity
                 (units: 1 = exclusive, N = quota/headcount); status DERIVED
allocation       contract_id ↔ asset_id, kind: exclusive|quota|coverage,
                 period  (supersedes lease.space_id)
contract_type    vertical?, config: template kinds, parameter schema,
                 key-date kinds, annex-role mapping, asset-binding rule
```

- **Vertical = configuration + a thin code module.** `verticals/real_estate.py` and `verticals/employment.py` register asset-type Pydantic schemas, main-terms generators, calculations (m²-pricing vs. salary), key-date kinds seeded as `key_date_kind` config records (`probation`, `salary_review` join `start|end|indexation`), annex-numbering roles (Lisa 1–2 are per-vertical), and adapters (EHR/Moderan/Statistikaamet vs. TÖR). The engine never branches on a vertical's name — it calls registered hooks. No formula DSL, no EAV.
- **Status is a projection.** vaba/üüritud and täidetud/täitmata are computed from active allocations vs. `capacity` — never stored, never hand-maintained.
- **"Occupancy" is not one thing.** `allocation.kind` distinguishes exclusive occupancy (lease on a space), quota occupancy (N employment contracts on one position — headcount), and coverage (an imported insurance/maintenance contract covering a whole building — container-level target, non-exclusive). This is deliberately a flat enum plus a nullable capacity column, **not** an inheritance hierarchy of contract types: types differ in config data and behavior hooks, and both compose better than they subclass.
- **Generic contract type.** Imported non-vertical contracts (haldus/hooldus/kindlustus/valve) use a `generic` contract_type: no parameter schema, no unit binding, optional `coverage` allocation. The clause model works without a vertical.
- `property`/`space` become the real-estate vertical's two asset types; their v1 columns move into that vertical's attribute schema. `lease` generalizes to `contract` (`contract_type_id`, `origin: platform|imported`). The v1 entity map below is the real-estate configuration of this core and reads with that rename.

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
party                        (Klient/Osapool)        ONE table for every counterparty: EE company |
                                                     foreign company | person (registry code / isikukood);
                                                     roles via party_role: client|employee|supplier|…
                                                     (one party may hold several). Replaces v1 `client`;
                                                     employees/candidates are parties too. Also the seed
                                                     of the future counterparty network.
risk_report                  (Riskiraport)           party_id, score HIGH/MED/LOW, source payloads, ts
quote                        (Hinnapakkumine)        party_id, property_id, status, valid_until,
                                                     commercial_body (TipTap JSON), totals,
                                                     version (optimistic lock, §8)
quote_space                                          quote_id ↔ space_id (1..n spaces per quote)
quote_special_term                                   structured items — flow into lease annex 3
lease → contract             (Üürileping)            quote_id?, space via allocation (exactly 1),
                                                     party_id, status, origin: platform|imported,
                                                     version (optimistic lock); rent, utility,
                                                     vat_taxable (inherited), indexation (method:
                                                     fixed_pct | stat_cpi, rate, frequency, next_date)
                                                     as current-value columns = maintained projection
                                                     of contract_fact (invariant 2)
contract_fact                                        versioned facts (invariant 2): contract_id, key,
                                                     value JSONB, valid_from/valid_to, recorded_at,
                                                     reason: initial|indexation|amendment|correction,
                                                     superseded_by; exclusion constraint: no overlapping
                                                     validity per key among live rows
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
                                                     s3_key, sha256, status; signer rows: N signers PER
                                                     PARTY, each with own ceremony state (joint
                                                     representation, §5)
source_document                                      imported original (PDF/DOCX/ASiC-E): s3_key, sha256
                                                     — the LEGAL TRUTH for origin=imported contracts;
                                                     for containers also the extracted signature
                                                     metadata (who signed, when)
key_date_kind                                        CONFIGURATION RECORD, not a code enum: name,
                                                     default notify_days, vertical? — verticals seed
                                                     kinds (start|end|indexation|probation|salary_review);
                                                     new kinds (insurance end, permit expiry) are rows,
                                                     not development
key_date                     (KeyDate)               subject (contract now; polymorphic so future
                                                     envelope documents can join), kind_id →
                                                     key_date_kind, due_date, notify_days_before, fired_at
domain_event                 (AuditEvent/sündmuslogi) append-only event log — invariant 1; see §8
agent_thread / agent_message                         AI conversations: persisted domain data linked to
                                                     the entities they touched (decision memory, §6)
agent_citation                                       answer → clause/contract links stored as rows (§6)
ai_draft_feedback                                    fate of every AI draft: used|edited|discarded (§6)
search_index                                         omnibox projection: one row per searchable entity
                                                     (entity_type, entity_id, account_id, tsvector,
                                                     trigram text, display payload) — §8
thread / message             (CommunicationThread)   per quote/lease; in-app messages (the Suhtlus page
                                                     renders these as one timeline)
membership                                           user ↔ account M2M with role: admin|operator — an
                                                     advisor org (law firm, accountant) can later hold a
                                                     limited role on many accounts without schema change;
                                                     carries per-user notification prefs (incl. vacation
                                                     delegate)
user                                                 operators/admins: global identity (email+password);
                                                     accounts via membership
portal_identity                                      client-side users; personal code (isikukood) from
                                                     Smart-ID/Mobile-ID auth, linked to party(ies)
notification                                         in-app inbox + email dispatch state incl. delivery/
                                                     bounce status from provider webhooks (§8)
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
3. emits a `domain_event` (with `actor_type` — human, system for cron/expiry, agent),
4. enqueues follow-up jobs (notifications, PDF render, signing).

Because the job queue lives in Postgres (Procrastinate, see §3), step 4 enqueues _inside_ the same transaction as steps 2–3: a state change and the jobs it triggers commit atomically. There is no dual-write window where a lease is marked signed but its notification or signing job is silently lost — exactly the failure a contract workflow with a court-grade audit trail cannot tolerate. (A Redis-based queue would need a separate transactional-outbox table for the same guarantee; here the queue table _is_ the outbox.)

Both the REST handlers and the agent tools call the _same_ transition functions — there is no second path. Time-based transitions (quote expiry, lease end) are fired by the worker's cron jobs through the same functions.

Spec-v2 additions: the quote machine gains a final `converted_to_contracts` state after `accepted` (validity default 14 days, config); the same machines serve **every contract type** — verticals add no states. Imported contracts enter the machine directly in their archived/active state and never pass through the negotiation states.

**Archive visibility (spec stage 07).** Default list views show only active contracts and their current state; superseded document versions, replaced annexes, and terminal-state documents are filtered out and revealed with one click. This is a query-layer filter on state/`superseded_at` — not a separate store.

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
      events.py         #   command wrapper: every mutation emits domain_event (invariant 1)
      facts.py          #   versioned contract facts — valid-time writes/reads (invariant 2)
      objects.py        #   property/space setup, CSV import
      quotes.py
      leases.py         #   clause engine, annex numbering, overrides
      signing.py        #   orchestration of the signing ceremony
      keydates.py       #   indexation calc (fixed % / CPI), expiry
      pricing.py        #   rent, utility, VAT presentation
      registry.py       #   portfolio search (Postgres FTS), effective_state,
                        #   smart-dashboard attention rules
    verticals/          # thin per-vertical code modules (config + hooks):
      real_estate.py    #   asset schemas, pricing calc, EHR/Moderan wiring
      employment.py     #   position schema, salary fields; TÖR deferred
    ingest/             # import of existing contracts (text-layer PDF/DOCX only)
      extract.py        #   text + page/char anchors (PyMuPDF / python-docx); NO OCR
      structure.py      #   LLM structuring job → clause-tree + params proposal
    agent/
      tools.py          #   Pydantic-typed tools wrapping domain services
      loop.py           #   provider-agnostic tool loop
      providers/        #   anthropic_native.py (sole adapter; seam kept)
      prompts/          #   versioned; prompt version stamped into each run's events
      evals/            #   golden Q&A set + runner (§6)
    integrations/       # one adapter per external system, each with a FakeX stub
      ariregister.py, ehr.py, moderan.py, risk/  (krediidiinfo, inforegister,
      kohtutaitur), statistikaamet.py, dokobit_sign.py, dokobit_identity.py,
      email.py, tor.py (post-MVP; filing always operator-confirmed)
    documents/
      templates/        #   Jinja2 HTML for quote, lease, annexes
      render.py         #   WeasyPrint
      container.py      #   libdigidocpp ASiC-E assembly
    infra/              # db session, S3 client, redis, settings (pydantic-settings)
    worker/             # Procrastinate app: task + periodic-task definitions
  tests/
```

**Layering rule:** `api` and `worker` call `domain`; `domain` calls `integrations` through interfaces (`Protocol` classes); nothing imports upward. Every integration ships a deterministic fake so the full workflow runs locally with zero external accounts (`INTEGRATIONS_MODE=fake`). A second rule: **no naked writes** — api, worker, and agent mutate state only through domain commands (`domain/events.py`), which emit `domain_event` and maintain fact/search projections in the same transaction; CI fails on repository writes outside a command.

**Frontend type sharing:** CI runs FastAPI's OpenAPI export → Orval → typed TanStack Query hooks committed to `frontend/src/api/`. Agent tool-call payloads (the proposals rendered as confirmable cards in chat) are part of the OpenAPI schema, so they cross the boundary typed as well.

---

## 4. Document pipeline

1. **Authoring** — quotes have (a) free-form rich text (TipTap JSON) and (b) structured special-term items; leases are fully structured (clause rows). No document is ever produced by copying free text into a contract.
2. **Rendering** — Jinja2 HTML + company branding → WeasyPrint → PDF. Rendered PDFs are immutable, content-addressed (`sha256`) objects in S3: `account/{id}/lease/{id}/v{n}/lease.pdf`.
3. **Assembly of attachments** — at quote/lease creation the system collects the right files automatically: Lisa 1 floor plans from the selected space(s), Lisa 2 site/parking plan from the property (uploaded once during object setup — stage 02 of the spec).
4. **Versioning** — every send-to-client creates a new immutable document version: the rendered PDF **and** a clause-tree snapshot are frozen, content-addressed (invariant 3 — evidence of exactly what the client saw, for every draft V1, V2, … not only the signed one); the negotiation loop never mutates an already-sent version.

### Clause editor architecture

The clause tree is edited in the operator UI by a **structure-owns-the-tree, TipTap-per-clause** model — _not_ one ProseMirror document for the whole contract.

- **The app/React layer owns the structure**, keyed by `clause_id`: the tree, sibling order, derived numbering, lock state, comment pins, override links, and all block operations (add / indent / reorder / promote / merge). These are commands on the domain model, not editor side-effects — so `clause_id`s are created and destroyed only by guarded operations, never by an editor split/merge you'd have to police.
- **TipTap edits one clause's inline body**, not the document. Each clause renders as static HTML; a TipTap instance is mounted only on the clause being actively edited (click-to-edit), so there is ~1 live editor at a time, not one per clause. Locked clauses (general/main) render as static HTML with no editor at all.
- **Minimal per-clause schema**: paragraph, bold/italic, inline bullet lists (the non-addressable enumerations from §2), plus one custom inline extension — `clauseRef`, carrying `targetClauseId` and rendered through a NodeView to the _live_ derived number. That extension is what makes in-text cross-references store ids and resolve to numbers at render time. Bodies persist as TipTap/ProseMirror **JSON** in `clause.text` (JSON, not HTML, so `clauseRef` ids survive round-trips).
- **Promotion** (inline bullet → addressable clause, per §2) is "extract the selected range from this clause's JSON → create a new clause row with a fresh id" — a model operation, not a ProseMirror split.

**Three renderers, one numbering function.** The editing view (React tree + per-clause TipTap), the signed-PDF view (server-side WeasyPrint, step 2 above), and the LLM-context view (`render_contract_context`, §6 Contract Q&A) all consume the _same_ clause tree and the _same_ numbering derivation. That derivation lives in shared logic — computed server-side and handed to all three — so the operator's editor, the legal PDF, and any `§` the agent cites can never disagree on "§5.1.2".

### Import pipeline (existing contracts)

Spec v2 brings existing contracts (haldus/hooldus/kindlustus/valve plus old leases — quote import dropped per Future Invest 2026-08; stray old quotes live on as plain attachments) into the clause model. This is the one place the platform's "document is a projection of structure" principle **inverts**: for imported contracts the signed source document is the legal truth, and the extracted clause structure is an index/approximation of it. The UI badges imported contracts accordingly; a dispute is settled by the stored original, never by the extraction.

- **Scope: text-layer PDF/DOCX only.** Scanned/image-only documents are explicitly out of scope — no OCR. Upload validation rejects PDFs without an extractable text layer (such files can still be stored as plain attachments).
- **Digital containers (.asice/.bdoc) are first-class input.** Estonian legacy contracts commonly live in signature containers: the pipeline unpacks the container, applies the text-layer rule to the datafiles inside, and records the container's signature metadata (signers, timestamps) on `source_document`; the container itself is stored unaltered as the legal original.
- **Manual registration (no OCR).** A scanned document kept as an attachment can get operator-entered key data (parties, amounts, key dates, contract kind) as a **clause-less `origin=imported` contract record** — it then joins the key-date calendar, search, and reporting like any imported contract. No clause tree, no content Q&A; for content, only the original file governs. Cheap: a form over the existing model, no LLM involved.
- **Flow:** upload → `ingest/extract.py` pulls text with page/char anchors → worker job runs LLM structuring (structured output validated against the clause schema; every proposed clause carries a provenance anchor into the source) → **operator review UI** (source and proposed structure side by side; corrections are edits to the proposal, logged to the audit trail) → commit as `contract` with `origin=imported` plus a `source_document` row. Nothing enters the registry without operator confirmation.
- **Imported contracts are outside the amendment flow.** Stage 08 (new annexes, early termination via annex) applies only to `origin=platform` contracts — the platform never signs an annex on top of a base contract it did not produce. Imported contracts participate in search, Q&A, key dates, and reporting only.
- **Externally signed amendments are registerable (MVP).** When an imported contract is amended outside the platform, the operator uploads the signed annex (text-layer → extraction; scanned → manual key data), updates the contract's parameters and key dates, all audit-logged — the registry's "mis tegelikult kehtib" stays truthful even though the ceremony happened elsewhere. Proposed post-MVP: a **verified-amendment flow** — stage 08 on an imported contract with two safeguards: the operator verifies only the clauses the amendment touches against the source PDF (provenance anchors, side-by-side), and the annex quotes the amended original text verbatim so its legal meaning never depends on extraction quality. Full re-baseline (confirming the whole tree authoritative) reserved for contracts amended repeatedly. Pending Future Invest's choice (their question 4.2).
- Imported non-vertical contracts get the `generic` contract type (§2); imported old leases may be mapped onto the real-estate vertical for typed parameters.

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

- **N signers per party, each with independent ceremony state.** Estonian companies routinely sign through two board members jointly (ühine esindusõigus); a container reaches `signed` only when every required signer of every party has completed, and the signer list is per-contract data, not an assumption of one-per-side.
- Each container requires its own ceremony per signer — the UI runs them sequentially (sign Container 1 → immediately prompt Container 2).
- `SignatureProvider` is an interface; a `FakeSigner` signs with a self-issued test cert for dev/demo. A future "direct SK" adapter would only replace steps 2/4/5.
- Signed containers are validated locally with libdigidocpp after assembly (do not ship to SiVa — that would upload the document).
- Qualified timestamping + OCSP require an SK contract even in the Dokobit-hash setup; budget for it.
- Signing methods are **Smart-ID / Mobile-ID only** (decision 2026-08). Smart-ID covers Baltic signers (Estonian, Latvian, Lithuanian personal codes), which handles the välisfirma client type's realistic case. **eIDAS / cross-border signing is out of MVP scope** — it is an open-ended family of national schemes that strains the hash-signing flow (Dokobit's fuller-API territory); if ever needed it becomes another method behind `SignatureProvider`, and eIDAS 2.0 wallets may standardize it in the meantime.

---

## 6. AI agent

### Provider abstraction

```python
class ChatModel(Protocol):
    async def stream(self, system: str, messages: list[Msg],
                     tools: list[ToolDef]) -> AsyncIterator[Event]: ...
```

- **`anthropic_native.py`** — official `anthropic` SDK (never an OpenAI-compatible shim for Claude). Default model `claude-opus-5`, adaptive thinking, streaming. Prompt caching: `cache_control` breakpoint after the (stable) system prompt + tool definitions; conversation appended after it.
- Internal event vocabulary (`text_delta`, `tool_call`, `done`) keeps the loop and UI provider-agnostic. The sole adapter today is Anthropic; the seam exists so a self-hosted adapter could return if a customer ever demands it.
- **In-process, not a service.** The loop runs inside api/worker — tools are plain Python functions sharing transactions and Pydantic models with the domain. A separate agent service (one reading of the spec's "AI-kihi taristu jookseb Railway platvormil") is explicitly rejected: it would turn every tool call into a network hop and route context data through an extra processor for no benefit. The sentence is satisfied by the platform itself running on Railway.

The loop itself is hand-rolled (~small): the agent here is ~15 domain tools + entity resolution + Q&A, and human-in-the-loop control matters more than framework features. Because tools are plain Pydantic-typed functions, adopting deepagents/LangGraph later is a harness swap, not a rewrite.

### Tools = the service layer, minus consequences

Per the spec's human-in-the-loop rule, the agent **has no tool that sends, signs, or transitions to a client-visible state**. Beyond that structural rule, **every mutating tool definition carries a `requires_confirmation` policy field — all `true` in MVP**: consequential effects exist only as confirmable proposals. That one field is what later turns autopilot („AI valmistas ette 4 asja — vaata üle ja kinnita") into per-tool configuration instead of development. Tool classes:

- **Read/Q&A** — `search_parties`, `get_property`, `list_spaces`, `get_quote`, `get_lease`, `load_contract` (full rendered contract text for grounded Q&A — see Contract Q&A below), `search_portfolio` (FTS + typed filters over the whole registry, incl. imported contracts), `get_effective_state` (üld + põhi + overriding eri merged; each value carries its source clause id), `list_key_dates`, `get_audit_trail`, `summarize_negotiation` (Decision Memory = audit events + clause comments + threads).
- **Draft/prepare** — `create_quote_draft`, `create_lease_draft`, `draft_contract_from_brief` (the spec's **lepingugeneraator**: free-form brief → contract draft through the same template + clause services; the draft enters the normal mustand → läbirääkimine → allkiri flow), `draft_special_term`, `draft_commercial_text` (the quote's free-form commercial section), `apply_client_proposal` (turn a client's free-form ettepanek into concrete draft edits — special-term wording plus its `kirjutab_üle` target — for operator review), `draft_reply` (response draft in a Suhtlus thread), `explain_clause` (plain-language explanation of a clause in its contract context), `start_amendment_draft`, `order_risk_report`, `create_party_from_registry`.
- **Clarify** — ambiguous orders ("pind 12" matches two spaces) end the turn with a question, as the spec requires.

"Send to client" / "start signing" appear in the chat UI as **confirmation cards** rendered from the draft the agent produced; clicking them calls the normal REST endpoint under the operator's session. The agent literally cannot perform consequential actions — enforcement is structural, not prompt-based. Structured answers are **cards too, not paragraphs**: „mis indekseerub 2027?" returns a mini-table (contract · date · old→new rent) with an „Ava Portfellis" deep link — card payloads are typed in the OpenAPI schema like tool payloads.

Two spec-v2 clarifications. **No UX automation:** a command like „Loo pakkumine ettevõttele Future Invest OÜ, Hoone T6B pind 12" means the agent resolves the entities, creates the draft via tools, and replies with a confirmation card plus a **deep-link to the draft page** — it never drives the UI. **Client chat is human↔human:** the portal vestlusliides writes to CommunicationThread between client and operator; the AI answers operators only. Confirmed by Future Invest (2026-08): in MVP the AI never answers end users — the client's chat is human↔human with the operator. Nothing here precludes adding client-facing AI later.

Authorization: agent runs inside the operator's request context — tools see exactly what the operator's role and `account_id` allow. Every tool call writes a `domain_event` with `actor_type = agent`, `on_behalf_of = <operator>`.

### Contract Q&A

Operators ask natural-language questions about a contract — "when can the tenant terminate?", "what's the rent after the next indexation?", "which clause covers roof repairs?". Each contract fits in the model's context, so this needs **no retrieval layer** (no embeddings, no vector store, no chunking): the whole contract is rendered once and placed in the prompt. The feature is operator-only — it sits inside the existing Read/Q&A tool class with no new endpoint, tenancy scope, or audit path.

- **Third renderer.** `documents/render.py` gains `render_contract_context(lease, version)` — a third consumer of the §4 numbering derivation, alongside the React editor and the WeasyPrint PDF. It walks the committed clause tree into flat markdown carrying stable `§X.Y` numbers **and** a `clause.id` anchor per node, plus lease metadata (rent, utility, VAT, indexation, key dates) and the structured special terms. Because it reuses the one numbering function, any `§` the model cites already matches the editor and the signed PDF.
- **One read tool.** `load_contract(lease_id, version="signed"|"draft")` joins the Read/Q&A class; the existing tool loop pulls the rendered text into context and the agent answers from it. `version` reuses §2's signing-freezes-numbering rule: a _signed_ contract cites the frozen numbers pinned by `sha256` ("the contract you signed on 2026-03-11 says…"); a _draft_ cites the live derived tree.
- **Citations are machine-checked.** The model answers with the §4 `clauseRef` token; every citation is post-validated to resolve to a real node — the same "a reference whose target is gone is a loud validation error" rule from §2. A hallucinated `§9.9` fails validation instead of reaching the operator, and valid citations render in chat as clickable live numbers. Validated citations are then **stored as `agent_citation` rows** (message → clause id) — the substrate for source chips and future trust metrics, not just markup in a rendered reply.
- **The contract is the cached prefix.** A contract is immutable once signed and slow-changing as a draft — ideal cache content. The §6 `cache_control` breakpoint extends to cover system + tools + contract; Q&A turns append after it, so multi-turn follow-ups on one contract are cheap.
- **Per-contract vs. portfolio.** `load_contract` answers questions about one identified contract. Cross-contract questions ("which leases index next year?") route to the structured tools (`search_portfolio`, `list_key_dates`, `get_lease`) aggregating across contracts — including imported ones — never load N full contracts into one context.

### Conversations, feedback, evals, cost

- **AI conversations are domain data.** `agent_thread`/`agent_message` persist every operator chat, linked to the entities the run touched; they are part of decision memory, appear in the per-contract audit export where relevant, and follow account retention (GDPR erasure covers them). Where AI conversations live is a schema answer, not a mystery.
- **Feedback is captured from day 1.** The fate of every AI draft — used unchanged | edited | discarded — plus import-structuring corrections and suggestion accepts land in `ai_draft_feedback` and `domain_event`. Nearly free to log now; in two years it is the dataset a "company-minded" assistant is tuned on. Impossible to backfill.
- **Eval harness is an architectural requirement, not QA garnish.** Prompts are versioned in-repo (`agent/prompts/`, version stamped into each run's events); `agent/evals/` holds a golden set (~50 questions over seed data with expected answers and required citations — format agreed with Future Invest) and a runner executable on demand and nightly; target ≥95% correct answers with valid citations. Import structuring gets the same treatment (extraction fixtures → expected clause trees).
- **Cost is governed per account.** Token usage is metered per agent run (rows keyed to account/user/run, rolled up daily), prompt caching per above, runaway protection (max turns and tool calls per run; monthly per-account budget → graceful degradation with an operator-visible notice). Who pays overage is a pricing question — the meter is what keeps every answer to it possible.

### Smart dashboard („Vajab tegevust täna")

Rules first, LLM garnish. The attention queue is computed by deterministic domain rules — expiring quote, unanswered client comment, approaching key date without a decision: exactly the spec's own examples — so selection is cheap, explainable, and testable (`domain/registry.py`). The LLM at most phrases the one-line "why this needs you" summary on top of the rule output; it never selects the items and never scans the portfolio.

### Import structuring

The ingest pipeline (§4) reuses the same provider: a worker job sends extracted text to the model with a structured-output schema mirroring the clause tree + typed parameters + parties + key dates; the proposal is validated against the schema, anchored to source offsets, and queued for operator review. Nothing is committed without confirmation. Because Q&A and structuring outputs are operator-reviewed, the quality bar everywhere stays operator-assist, not client-facing legal advice.

---

## 7. External integrations

All adapters are outbound-only, retried via the worker, and snapshot their raw responses (for the audit trail and for re-parsing):

| System                                                  | Used for                                                     | Notes                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| e-Äriregister                                           | Company autofill (onboarding + client creation)              | Open-data JSON for basics; XML gateway (contract) if KMKR/extended fields needed.                                                                                        |
| EHR (ehitisregister)                                    | Building autofill by EHR code/address                        | Public API; fields stored on `property`, manually correctable.                                                                                                           |
| Moderan                                                 | Utility costs (last 12 months → winter/summer €/m² averages) | Computed at import; manual entry fallback per spec.                                                                                                                      |
| Krediidiinfo + Inforegister + Kohtutäitur + Äriregister | Risk report                                                  | Fan-out in worker, aggregate to HIGH/MED/LOW, store per-source payloads + timestamp. Informational, never blocking.                                                      |
| Statistikaamet                                          | CPI for index-linked leases                                  | Fetched by the indexation cron only when `method=stat_cpi`.                                                                                                              |
| Dokobit                                                 | Hash signing + Smart-ID/Mobile-ID identity (signing-time)    | §5; one broker contract for both.                                                                                                                                        |
| TÖR (töötamise register)                                | Employment registration on contract signing/termination      | **Post-MVP.** When built, filing happens only on operator confirmation (human-in-the-loop), never as an automatic side effect of signing.                                |
| Email                                                   | Postmark / SES on a dedicated sending domain                 | SPF/DKIM/DMARC from day 1; delivery/bounce webhooks update `notification` and surface to the operator („kiri ei jõudnud kohale — saada uuesti"). Behind `EmailProvider`. |

---

## 8. Cross-cutting concerns

**Auth & tenancy.** Operators/admins: email + password (argon2) with optional TOTP, session cookies; a user's accounts come via `membership` (M2M with role) — one account each in practice today, but advisor organizations (a law firm or accountant with a limited role on many client accounts) must never require a schema change. Clients (spec v2): **no account during negotiation** — a signed, expiring share-link token sent by email grants access to exactly one quote, and the same grant **extends to the lease drafts born from that quote** (the contract stage carries its own validity window), covering stage-05 clause comments and acceptance. Actions taken via link are audit-attributed as "link holder (email)" — weaker identity than eID, acceptable pre-signature. The **account is created at signing**, seeded from the eID identity (personal code) the Dokobit ceremony already yields, and linked to the contract; from then on the client uses a portal session. Tenancy: `account_id` on every row and **Postgres RLS enforced from V1** (per-request `SET LOCAL app.account_id`, policies on every tenant table), with repository-layer scoping as the second belt — the schema is "thousand-account shaped" even while one account uses it. **Intra-account roles:** all operators of an account see all account data in V1 — per-vertical/field visibility (e.g. salaries in the employment vertical) is an explicit non-goal for MVP, documented as a known limitation and designed to bolt on later (role → vertical grants).

**Event log (audit trail & decision memory).** The append-only `domain_event` table of §2 invariant 1 — written inside the same transaction as the change, carrying `actor_type (human|system|agent)`, `on_behalf_of`, and `reason`. Document versions and signed containers are immutable S3 objects referenced by sha256. **1-click export**: worker job assembles a ZIP per contract — events as CSV/JSONL + every sent and signed document version + containers (the "court folder") — into S3 and hands the operator a download link. The same table feeds product metrics and the AI-feedback dataset: one write, many readers. (Optional later: hash-chain events for tamper evidence.)

**Concurrency & idempotency.** Negotiable drafts (quote, contract, annex) carry a `version` counter: mutating endpoints take the expected version and answer 409 — „keegi muutis vahepeal" — on mismatch, so two operators on one draft get a conflict message, never silent overwrites. Consequential commands (send, start signing, email dispatch) take an **idempotency key**, and their jobs use Procrastinate queueing locks, so a double-clicked „Saada" or a retried worker produces exactly one send.

**Portfolio registry & search.** The spec's „struktureeritud andmeregister (RAG-i alus)" is, as specified, a structured registry — every example query („mis indekseerub 2027?", „kelle katseaeg lõpeb sel kuul?") is a typed filter, not semantic search. V1 ships Postgres FTS + `pg_trgm` over clause text, indexes over typed parameters and key dates, and `effective_state(contract)` as a pure derivation (üld + põhi + overriding eri merged, each value carrying the clause id it came from — deterministic for platform-born contracts, extraction-quality-bounded for imported ones). The agent tools (§6) sit on top. Embeddings/vector search stay deferred until semantic search over imported free text demonstrably needs them. The **omnibox** (Cmd+K) reads one `search_index` projection — a row per searchable entity (contracts, clauses, parties, spaces, quotes, documents, threads, key dates) with tsvector + trigram + display payload — maintained by the same domain commands that mutate the entities, in-transaction, so search is never stale. The command palette is the same field: typed intents („loo pakkumine") resolve to actions, and the roadmap merges this input with the agent.

**Key dates & indexation.** Daily cron scans `key_date`: fires notifications `notify_days_before` ahead (contract end defaults to 90 days, to operator **and** client; `probation`/`salary_review` kinds come from the employment vertical); on the due date applies the transition. Regular indexation (per spec) applies the new rent **automatically, with no new annex**: compute (fixed % internally; CPI delta from Statistikaamet), update lease rent, write audit event, notify both parties. Deviations (skip a year, change method) and early termination go through the amendment flow (new annex, stage-08 cycle). Quote expiry → `expired`; lease end date → `ended`.

**Notifications.** Single `notify(event, recipients)` in the domain layer → in-app row + email job. Triggers per spec: sent, comment added, accepted, signing invitation, key date approaching. Delivery state is first-class: provider webhooks (delivered / bounced / complaint) update `notification`, and a bounce surfaces on the quote/contract — „kiri ei jõudnud kohale — saada uuesti". A per-user **notification delegate** (vacation cover) is a `membership` setting: post-MVP feature, but the column exists from day one.

**Observability.** Structured JSON logs (correlation id = request/agent-run id); Railway built-in logs; Sentry for errors. **Product metrics from day 1** are queries over `domain_event`, not a separate pipeline: time from question to first answer, clicks from draft to accept, share of actions with `actor_type=agent`.

**i18n & export.** UI strings live in locale files from the first screen (Estonian ships alone; nothing user-visible is hard-coded), and generated documents already template per company. The full account dataset — contracts, facts, key dates, events — is exportable via API/CSV: a trust point in sales and the customer's escape hatch.

**Files & backups.** Uploads are limited by size and content type (plans, PDFs, DOCX, ASiC-E). Managed Postgres backups are complemented by a scheduled **restore drill** — a worker job restores the latest backup into a scratch database and sanity-checks row counts, because a backup that has never been restored is a rumor. R2 bucket versioning guards the artifact store.

---

## 9. Deployment (Railway)

Single target per spec v2; the v1 on-prem layout (Proxmox VMs + vLLM + GPU sizing) is retired. Local development runs the same containers via `deploy/compose.dev.yml` — postgres, redis, minio (S3-compatible stand-in for R2) — with `INTEGRATIONS_MODE=fake`, so the full workflow runs with zero external accounts.

| Concern                 | Railway implementation                                                                                                                                                  |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| frontend / api / worker | Three Railway services from the same Dockerfiles; private networking between them.                                                                                      |
| Postgres / Redis        | Railway managed plugins. Postgres also backs the Procrastinate job queue; Redis is only cache + SSE pub/sub (and is optional if SSE moves to Postgres `LISTEN/NOTIFY`). |
| Object storage          | Railway has no S3 — Cloudflare R2 (S3 API), EU jurisdiction. Plans, PDFs, signed containers, imported source documents, audit exports.                                  |
| LLM                     | `ANTHROPIC_API_KEY`, model `claude-opus-5` (adaptive thinking, streaming, prompt caching on system + tools + loaded contract).                                          |
| Signing/digidoc         | libdigidocpp in the worker image; only SHA-256 digests leave the infrastructure (Dokobit hash-signing, §5).                                                             |
| Email                   | Postmark / SES on a dedicated sending domain (SPF/DKIM/DMARC); bounce webhooks → `notification`.                                                                        |
| Cron                    | Procrastinate periodic tasks (the worker is a long-running service); no Railway-specific cron needed.                                                                   |

Privacy posture (document it to customers): contract data resides on Railway + R2 (EU); prompts reach Anthropic under DPA and are not used for training; only per-request context is ever sent — the datastore is never synced to the model provider (the spec's minimality principle). The v1 "data never leaves the house" guarantee is retired together with the on-prem target.

### Configuration matrix

Everything environment-specific is an env var consumed by `infra/settings.py`:

```
ANTHROPIC_API_KEY / LLM_MODEL   (ChatModel seam in code; single provider today)
S3_ENDPOINT / S3_BUCKET / S3_KEY / S3_SECRET
DATABASE_URL / REDIS_URL
DOKOBIT_SIGN_TOKEN / DOKOBIT_IDENTITY_TOKEN / DOKOBIT_ENV=sandbox|prod
INTEGRATIONS_MODE=fake|live     (per-adapter overrides: ARIREGISTER_MODE=..., etc.)
EMAIL_PROVIDER=postmark|ses|smtp  POSTMARK_TOKEN / SMTP_URL  (sending domain DNS: SPF/DKIM/DMARC)
PUBLIC_URL                      (share links, emails, portal deep-links)
```

---

## 10. Repository layout

```
thinkone/
  spec.md                                          # v1 (historical)
  ThinkOne - Funktsionaalne spetsifikatsioon v2.md # current spec
  architecture.md
  demo/               # interactive UX reference (static SPA) — the operator experience §1's frontend implements
  backend/            # FastAPI + worker (one package, two entrypoints)
  frontend/           # Next.js (operator app + client portal)
  deploy/
    compose.dev.yml   # local dev: postgres, redis, minio, INTEGRATIONS_MODE=fake
    railway/          # service configs / railway.json
  scripts/            # openapi→orval codegen, db seed, backup
```

---

## 11. Build plan

_(build-plan.md, which estimated the retired v1 on-prem scope, is deleted; this section is the plan of record — per-phase estimates to be added.)_

De-risking order: generalize the data model **while** building the real-estate vertical on it; prove the platform with the employment vertical; ship import as its own phase. The invariants land in phase 0 because retrofitting them is the expensive path — and they are exactly what keeps the review's "future" list possible.

- **Phase 0 — platform skeleton.** Monolith scaffold (api + worker), auth, `membership` M2M, RLS tenancy, `domain_event` + command pattern + CI enforcement, `party`, settings, provider fakes, CI/CD to Railway, i18n scaffolding, Sentry, sending domain + email provider with bounce webhooks.
- **Phase 1 — asset registry + real-estate config.** Company onboarding (äriregistri autofill), property/EHR, spaces CSV import, allocations + derived status, attachments, templates.
- **Phase 2 — contract engine + offer→lease flow.** Clause tree + editor, versioned facts, state machines, rendering + sent-version freezing, share links, quote wizard (incl. stepped rent), negotiation (comments, threads), Ülevaade/Portfell pages, omnibox v1 (search).
- **Phase 3 — signing + lifecycle.** Multi-signer Dokobit ceremonies, both containers, account-at-signing, archive visibility, key-date engine on `key_date_kind`, indexation (fixed % + CPI) as fact versions, notifications + Kalender page.
- **Phase 4 — agent.** Tool belt over the same commands (`requires_confirmation` on every mutating def), contract Q&A with stored citations, entity resolution, confirmation + answer cards, omnibox↔agent merge, smart-dashboard rules, eval harness + golden set, token budgets/metering.
- **Phase 5 — import.** Extraction (PDF/DOCX + ASiC-E unpack), LLM structuring, review UI (the largest new frontend surface), manual registration for scans, portfolio health report (below), Suhtlus completeness.
- **Phase 6 — second vertical + amendments.** Employment vertical as the modularity proof (config + thin module), amendment flow (annex rounds), renewal drafts, audit-export polish.

### Open scope decisions (Future Invest)

Three yes/no proposals from the MVP review — all are rules + jobs over primitives that exist by phase 5, all recommended yes:

1. **One-click renewal** — 90 days before end, a ready renewal draft (new period, indexed price, same special terms), not just a notification. A trigger + assembly of existing parts; the landlord's most repeated workflow.
2. **Portfolio health report after import** — "X lepingut sees · 3 lõpevad 6 kuu jooksul · 2-l puudub viidatud lisa · 4-l pole indekseerimist kokku lepitud." Rule-based; the first "wow" of day one. (Ships with phase 5.)
3. **Follow-up autopilot** — 5 days without a client response → queued "Saada meeldetuletus?" + AI-drafted polite nudge. A time rule + the `requires_confirmation` card.

Plus the still-open **imported-contract amendment path** (their question 4.2): registration of externally signed amendments ships (§4); the verified-amendment flow remains the post-MVP proposal pending their answer.

### Futures the architecture must not preclude (and now doesn't)

- **Counterparty network** — the tenant's free post-signature view of their own contracts: enabled by `party` + `portal_identity` + per-user events; MVP ships only a "Powered by ThinkOne" mark + interest list.
- **Autopilot homepage** — "AI valmistas ette 4 asja — vaata üle ja kinnita": the `requires_confirmation` policy field + the confirmation-card pattern.
- **Envelope documents** — file + type + state + key dates without the clause model: `key_date_kind` config + polymorphic `key_date.subject` + the import machinery.
- **Template import / DOCX round-trip** — a new customer's Word template read into üld/põhi/eri structure by the same import machinery (operator confirms); a lawyer's Word redline finds its way back via anchors. On the roadmap before the first external sale; not built now, not excluded.
