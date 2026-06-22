# ThinkOne — Build Plan (on-prem, single engineer)

Companion to [architecture.md](architecture.md). A phased, time-estimated delivery plan for the **on-prem target** (Proxmox + docker-compose + self-hosted vLLM), built by **one senior engineer**. The Railway / frontier-model target is out of scope here — the provider interfaces keep it available later, but none of its work is estimated below.

## Assumptions

- **One senior engineer**, genuinely full-stack: comfortable across FastAPI/Python, Next.js/TS, containers/Proxmox ops, a non-trivial ProseMirror/TipTap editor, signing/crypto (ASiC-E, OCSP), and self-hosted LLM tooling. The estimates assume real fluency in *all* of these — if any one area (most often the clause editor, the digidoc/crypto work, or GPU/vLLM ops) is unfamiliar, apply that phase's high end or beyond.
- **Estimates are planning ranges, not commitments.** Per-workstream sizes are **engineer-days of build effort**. Per-phase figures are **solo calendar weeks** — the workstream effort plus the integration, debugging, test, and iteration time that isn't separately itemized.
- **No parallelism.** Phases run in sequence; nothing overlaps — the agent in particular is a phase in the queue, not a track that runs alongside feature work. The estimates reflect that single queue.
- **Definition of done per phase:** works end-to-end on a staging on-prem box against sandbox integrations where available, has automated tests for the domain logic and state machines, and is demoable. That is *not* "production-hardened" — that is Phase 7.
- **Key-person risk is real and unmitigated.** A solo plan has no bus factor and no one to unblock you on a stuck day. There is no slack built in for illness or a contract stalling — see long-lead dependencies.
- **Excluded:** data migration from any legacy system, end-user training, legal review of contract templates, and the Railway deployment.

## Long-lead dependencies — start procurement on day 0

These have external lead times and gate later phases. Kick them off in week 1 even though the code that consumes them lands months later. For a solo build this is doubly important: there's no slack in the schedule to absorb a stalled contract.

| Dependency | Gates | Why start now |
|---|---|---|
| **Dokobit** contract + sandbox creds (signing **and** Identity Gateway) | Phase 3 (portal login) & 5 (signing) | Commercial onboarding + sandbox access takes weeks; both client-portal auth and signing block on it. |
| **SK ID Solutions** agreement (OCSP + qualified timestamp) | Phase 5 | Required to finalize valid ASiC-E even via the Dokobit-hash path. |
| **e-Äriregister** XML gateway access (only if KMKR / extended fields are needed beyond open data) | Phase 1 & 3 | Contracted access; open-data JSON covers the basics meanwhile. |
| **Moderan API** access | Phase 2 | Utility-cost autofill; manual entry is the fallback if delayed. |
| **Risk sources** — Krediidiinfo / Inforegister / Kohtutäitur | Phase 3 | Each is a separate account/contract; the risk report degrades gracefully without any one of them. |
| **GPU host** for vLLM (≥24 GB, ideally 48 GB) | Phase 0 & 6 | Hardware procurement + Proxmox PCIe passthrough; the agent track can't be validated without it. |

Every integration ships behind a `FakeX` stub from day one (`INTEGRATIONS_MODE=fake`), so build work is **not** blocked on these landing — but real-integration validation and the pilot are.

## De-risking spikes — do these in month 1, before their phases

Solo, your biggest enemy is discovering a fatal blocker deep into the timeline with no one to help and months of sunk work. Front-load the two scariest unknowns as small timeboxed spikes during Phase 0/1, well before Phases 5 and 6:

- **ASiC-E validity spike (~2–3 d):** get libdigidocpp building in the worker image, assemble a throwaway container, sign it in the Dokobit sandbox, and validate it against an external validator. If libdigidocpp fights the build, fall back to the DigiDoc4j sidecar *now* — not in month 8.
- **vLLM tool-calling spike (~2 d):** stand up the chosen Qwen build at the target quantization and confirm it emits reliable structured tool calls for a handful of representative instructions. If quality is poor, you want to know while there's still room to change model/quantization or rescope the agent.

These hours are not "extra" — they pull the two highest-variance risks forward where they're cheap to absorb.

## Phase overview & sequence

| Phase | Focus | Estimate | Spec |
|---|---|---|---|
| 0 | Infrastructure & scaffolding | 3–4 wks | — |
| 1 | Core foundation (auth, tenancy, audit, onboarding) | 4–5 wks | 01 |
| 2 | Object & space setup | 4–5 wks | 02 |
| 3 | Quotes & client portal | 7–8 wks | 03–04 |
| 4 | Leases & clause engine/editor | 7–9 wks | 05 |
| 5 | Signing, archive, key dates, indexation, amendments | 6–7 wks | 06–08 |
| 6 | AI agent (vLLM) | 5–6 wks | "AI-agent" |
| 7 | Hardening & pilot | 4–5 wks | — |

**Sequence:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7. With one engineer there is no parallel track — the agent is a phase in the queue, not an overlapping workstream. It only depends on services that exist by end of Phase 3, so you *may* reorder it earlier (right after Phase 3, e.g. for a change of pace or to validate the model sooner), but it cannot run *alongside* anything.

**Milestones** (in active build weeks; calendar runs a bit longer):

- **Internal alpha** — end of Phase 4, ~28 weeks in: an operator sets up an object, sends a quote, negotiates it, and reaches a fully clause-structured lease draft. No signing yet.
- **Feature-complete beta** — end of Phase 5, ~34 weeks in: full lifecycle through digital signing, archive, key dates, and amendments.
- **Production pilot** — end of Phase 7: hardened, on a customer's box, with a real lease signed end-to-end.

**Total: ~40–49 active build weeks, ≈ 11–13 calendar months** for one senior engineer to a production pilot. The phase ranges sum to ~40–49 weeks of focused work; calendar lands above that once holidays, ops interrupts on the on-prem box, and the occasional stuck day with no one to pair with are counted.

---

## Phase 0 — Infrastructure & scaffolding (3–4 wks)

**Goal:** a running, deployable skeleton on the on-prem topology, with CI and the codegen pipeline, before any feature work. Fold the two de-risking spikes in here.

| Workstream | Size |
|---|---|
| Proxmox: `app` VM + `llm` VM (GPU PCIe passthrough), base OS, hardening, internal-bridge networking | 3–4 d |
| vLLM bring-up + tool-calling spike: NVIDIA driver + container toolkit, model pull, `--enable-auto-tool-choice --tool-call-parser hermes`, smoke-test tool calls | 2–4 d |
| docker-compose stack: Caddy (`tls internal`), Postgres 16, Redis, MinIO + bucket bootstrap, api + worker skeletons | 3 d |
| Repo scaffold: backend package (api/worker entrypoints), settings, Alembic + `procrastinate schema --apply`, Next.js app, OpenAPI→Orval codegen in CI | 3–4 d |
| Backups (nightly `pg_dump` + MinIO mirror to second disk/NAS) + structured logging | 2 d |
| ASiC-E validity spike (see above) | 2–3 d |

**Risk:** GPU driver/quantization friction is the classic time sink, and solo you have no one to pair through it — budget the high end if you haven't run vLLM on Proxmox before.
**Exit:** `docker compose up` brings the stack live; a hello-world endpoint round-trips through Caddy; the worker runs a no-op periodic task; vLLM answers a tool-call request; both spikes have a known-good or known-fallback answer.

## Phase 1 — Core foundation (4–5 wks)

**Goal:** the spine every later feature hangs off — identity, tenancy, the audit log, and the first integration pattern.

| Workstream | Size |
|---|---|
| Core domain models + migrations (account, company, user, audit_event, notification) | 3 d |
| Operator auth: argon2 + sessions, optional TOTP, role model (admin / operator) | 3–4 d |
| Tenancy: `account_id` scoping enforced in the repository layer | 2 d |
| Audit-event plumbing: append-only, written in the same transaction as the change, correlation ids | 2–3 d |
| Onboarding: company create + e-Äriregister autofill adapter (+ `FakeAriregister`); logo / accent-colour upload | 3–4 d |
| Notification spine: `notify()` → in-app row + email job; SMTP adapter via the customer's corporate relay | 2 d |

**Exit:** an admin registers, creates an account + company (with registry autofill), every write lands an audit event, and email sends through the on-prem relay.

## Phase 2 — Object & space setup (4–5 wks)

**Goal:** spec stage 02 — register an object once, scalably, with everything that later flows into deals.

| Workstream | Size |
|---|---|
| Property model + EHR autofill adapter (+ stub); manual-correction UI | 3–4 d |
| Space CSV/Excel import: template, parsing, **row-level validation with per-row error reporting**, manual add/edit form | 5–6 d |
| Attachments: Lisa 1 floor plans (per space), Lisa 2 site/parking plan (per property) → MinIO upload, sha256, association | 3 d |
| Templates: general-terms / special-terms-base / quote-base, versioned + immutable-once-referenced (storage only here; tree editing lands in Phase 4) | 3 d |
| Moderan adapter (12-month → winter/summer €/m² averages) + manual fallback; object-level `vat_taxable` | 3 d |

**Risk:** the import-validation UX is deceptively large — real spreadsheets are messy; budget for iteration.
**Exit:** an operator imports a multi-space object from a spreadsheet, sees actionable row errors, fixes them, attaches plans, and the object is deal-ready.

## Phase 3 — Quotes & client portal (7–8 wks)

**Goal:** spec stages 03–04 — the first full operator↔client loop, including the portal and its eID login. The largest phase by surface area.

| Workstream | Size |
|---|---|
| Quote builder: free-form commercial body (TipTap, plain rich text) + structured special-terms list | 4–5 d |
| Pricing/VAT engine: rent + utility, net storage, VAT presentation from object flag + rate-with-effective-date | 3 d |
| PDF rendering: WeasyPrint + Jinja templates + company branding; content-addressed immutable versions in MinIO | 4–5 d |
| Client portal scaffold: `/portal` route group, session model, scoping to shared deals | 3 d |
| **Smart-ID / Mobile-ID login** via Dokobit Identity (+ stub); personal-code → invited-contact matching | 4–5 d |
| Negotiation loop: send → accept / free-form counter / decline; quote state machine; expiry periodic task | 4 d |
| Risk report: fan-out to 3 sources, aggregate HIGH/MED/LOW, store per-source payloads (+ stubs) | 3–4 d |
| Notifications wired to triggers (sent, comment, accept, expiry-approaching) | 2 d |

**Risk:** Dokobit Identity sandbox access must have landed (long-lead item). eID auth flows always have more edge cases than expected.
**Exit:** operator sends a quote; a client logs in with Smart-ID/Mobile-ID, sees the branded PDF, counters or accepts; the state machine and expiry behave; a risk report renders.

## Phase 4 — Leases & clause engine/editor (7–9 wks)

**Goal:** spec stage 05 and the structural heart of the product — the clause tree, its editor, and the locked/override model. The hardest single stretch of work in the project, and the widest range because of the editor.

| Workstream | Size |
|---|---|
| Clause tree model: adjacency list, `container`/`ordinal`/`number_style`, shared server-side numbering derivation | 4 d |
| Quote→N-lease conversion: one draft per space, general terms snapshotted locked, main terms generated, special terms copied to Annex 3 | 4 d |
| Locked/override engine: `overrides_clause_id`, "§X, muudetud Lisa 3 p Y" rendering, override-target + deletion guards | 4 d |
| **Clause editor** (architecture §4): app-owned tree, TipTap-per-clause mounted on focus, `clauseRef` inline extension, promotion/merge, drag-reorder | 8–10 d |
| Clause-level commenting: client pins comments per node; operator accept/reject; loop until all resolved | 4–5 d |
| Lease state machine + the from-scratch (non-quote) lease path | 3 d |

**Risk:** the clause editor is the project's single most complex UI and the 8–10 d is the likeliest underestimate — solo, there's no one to split the editor from the rest of the phase, so a hard week here stalls everything. If schedule slips, the "every point is a node" fallback (architecture §4) trades editor effort for more rows and pulls the alpha in.
**Exit (internal alpha):** a quote converts to lease drafts; the operator edits the structured clause tree with working numbering/overrides; a client comments per clause; the lease reaches "all clauses accepted."

## Phase 5 — Signing, archive, key dates, indexation, amendments (6–7 wks)

**Goal:** spec stages 06–08 — close the lifecycle. Highest external-integration risk (de-risked early by the Phase 0 spike).

| Workstream | Size |
|---|---|
| ASiC-E assembly: libdigidocpp in the worker image (or the DigiDoc4j sidecar fallback chosen in the spike), datafile assembly, local validation | 4–5 d |
| Dokobit hash ceremony: cert → SignedInfo digest → `/{method}/sign/hash` → finalize with OCSP + timestamp; two-container, per-signer-sequential flow; `FakeSigner` for dev | 5–6 d |
| Archive + signed-container storage (immutable, sha256) | 2 d |
| Key dates → calendar + `notify_days_before` periodic task | 3 d |
| Indexation: fixed-% (internal) + Statistikaamet CPI adapter; auto-apply at key date with audit + notify, **no new annex** | 4 d |
| Amendments / early termination: new annex, stage-08 flow reusing the negotiation + signing cycle | 3–4 d |
| Audit export: 1-click ZIP (events + document versions + signed containers) | 2–3 d |

**Risk:** still the riskiest integration work even after the spike — container validity must be re-verified against real validators with the *actual* lease + attachments before pilot, and the SK timestamp/OCSP contract must be live.
**Exit (beta):** a lease signs end-to-end producing valid ASiC-E containers, archives, schedules key dates, auto-applies an indexation, and exports a complete audit ZIP.

## Phase 6 — AI agent, vLLM (5–6 wks)

**Goal:** the spec's "platform brain" on the self-hosted model. A sequential phase for a solo build — it depends only on services that exist by end of Phase 3, so it can be moved earlier, but it can't overlap anything. It is also the most deferrable large phase if you want to reach a pilot sooner (see below).

| Workstream | Size |
|---|---|
| `ChatModel` interface + vLLM adapter (OpenAI-compatible client, structured tool calls); hand-rolled tool loop with normalized event stream | 4 d |
| Read/Q&A tools first (search clients, get property/quote/lease, key dates, negotiation summary over audit + comments) | 3–4 d |
| Chat UI: SSE streaming, message thread, tool-call rendering | 3–4 d |
| Draft/prepare tools + **confirmation cards** (create quote/lease draft, draft special term, order risk report) — consequential actions hit normal REST endpoints under the operator session | 4–5 d |
| Entity resolution ("Future Invest OÜ", "Hoone T6B pind 12") + clarify-on-ambiguity | 3 d |
| Agent eval set; validate the chosen Qwen build's tool-calling quality at the target quantization (extends the Phase 0 spike) | 3 d |

**Risk:** tool-calling reliability of the self-hosted model is the open question — the eval set must gate the pilot. The agent has **no** send/sign tool (HITL is structural), so its blast radius is bounded.
**Exit:** an operator drives read Q&A and prepares a quote/lease by instruction, reviewing confirmation cards before anything leaves; every agent step is audited as "agent on behalf of operator."

## Phase 7 — Hardening & pilot (4–5 wks)

**Goal:** turn feature-complete into production-on-a-customer-box.

| Workstream | Size |
|---|---|
| End-to-end integration testing against all real sandbox integrations; replace stubs | 4–5 d |
| Security pass: authz review, tenancy-isolation tests, secrets handling, dependency audit, signed-container validation against external validators | 4–5 d |
| Performance/soak: PDF + signing under load, vLLM latency, backup/restore drill | 2–3 d |
| Operability: runbook, monitoring/alerts (logs + errors), restore rehearsal, on-box deploy/upgrade procedure | 3 d |
| Pilot onboarding: a real company + object, one real lease signed end-to-end with the customer | 3–4 d |

**Risk:** solo, you are also the ops/on-call for the pilot box — budget for the operability work properly rather than treating it as an afterthought.
**Exit (pilot):** a customer operator runs a real lease from object setup through signed, archived contract on their own on-prem box, with backups and monitoring proven.

---

## If the timeline must compress

For a solo build, **scope is the main lever.** In rough order of leverage:

- **Defer the agent (Phase 6) to a fast-follow.** It's the largest deferrable chunk and the pilot can ship without it — pulls the pilot in by ~5–6 weeks.
- **Thin the agent further** when you do build it: read/Q&A only for v1, draft tools later.
- **Clause-editor fallback** (architecture §4): ship "every point is a node," defer inline-bullet promotion. Pulls the alpha in.
- **Defer amendments / early termination** (Phase 5) — the initial signing + indexation lifecycle stands without it.
- **Single-signer first** — defer the second container / multi-party sequencing if early customers sign solo.

None of these touch the critical-path spine (auth → objects → quotes → leases → signing); they trim breadth, not foundations.
