# Contract parties: drop `contract.party_id`, use a join table only

Self-contained instructions. Repo: `/Users/m/code/thinkone` (FastAPI backend in `backend/`, Next.js frontend in `frontend/`).
Read `AGENTS.md` first: every change is tested, pushed to `main` and redeployed to Railway (api → worker → frontend).

## Goal

A contract can have any number of parties, each with a role in that contract (two joint tenants, a guarantor, insurer +
insured, a tenant replaced by amendment). Today `contract.party_id` holds exactly one counterparty and every view reads it.
After this change the ONLY link between contracts and parties is the table `contract_party`; the column `contract.party_id`
no longer exists. Views that showed "the party" show the primary party, which is one row flagged `is_primary` per contract.

Vocabulary: a party's *role in a contract* uses the same closed list as everything else, `PARTY_ROLES` in
`backend/app/domain/parties.py` (landlord, tenant, client, supplier, manager, maintainer, security, insurer, insured,
employer, employee, other). `tests/test_parties.py::test_party_role_vocabulary_is_shared` keeps it equal to the import
schema's `PartyRole`; do not add a second list.

Rule for the counterparty role of a contract category (replaces `_party_role` in `backend/app/domain/imports.py`, which
today returns `client` for leases — leases must say `tenant` from now on):

| category | counterparty role | our company's role |
| --- | --- | --- |
| lease | tenant | landlord |
| employment | employee | employer |
| insurance | insurer | insured |
| maintenance | maintainer | client |
| management | manager | client |
| security | security | client |
| other | supplier | client |

`party.roles` (what a party is across the portfolio) keeps being filled by `find_or_create_party` with the same role.

## 1. Model + migration

### `backend/app/models/contracts.py`

Add after `Contract`:

```python
class ContractParty(Base, TenantMixin, TimestampMixin):
    """contract ↔ party with the party's role in THIS contract. Exactly one row per contract is primary.

    ``valid_from``/``valid_to`` let a tenant change by amendment keep the old tenant on the history."""

    __tablename__ = tenant_table("contract_party")
    __table_args__ = (
        UniqueConstraint("contract_id", "party_id", "role", name="uq_contract_party_role"),
        Index("ix_contract_party_primary", "contract_id", unique=True, postgresql_where=text("is_primary")),
    )
    id: Mapped[uuid.UUID] = uuid_pk()
    contract_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contract.id"), index=True)
    party_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("party.id"), index=True)
    role: Mapped[str] = mapped_column(String(30))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    valid_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    valid_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    source: Mapped[str] = mapped_column(String(12), default="manual", server_default="manual")  # import | manual | amendment
```

Imports needed: `UniqueConstraint`, `text` from `sqlalchemy`. Remove the `party_id` column from `Contract`. Export
`ContractParty` from `backend/app/models/__init__.py`. Because the table name goes through `tenant_table(...)`, it is in
`TENANT_TABLES`: tests truncate it and the RLS loop knows it, but the first migration already ran, so the new migration must
enable RLS itself (below).

### Migration `backend/alembic/versions/20261008_<rev>_contract_party.py`

Generate with `cd backend && uv run alembic revision -m "contract party join table"` and write by hand (do not autogenerate
against the live DB). `down_revision = "2b95143ec937"`. Upgrade, in this order:

1. `op.create_table("contract_party", ...)` with the columns above plus `account_id` (FK `account.id`, not null),
   `created_at`/`updated_at` (`server_default=sa.text("now()")`), indexes on `account_id`, `contract_id`, `party_id`, the
   unique constraint and the partial unique index `CREATE UNIQUE INDEX ix_contract_party_primary ON contract_party (contract_id) WHERE is_primary`.
2. Backfill from the old column with one `INSERT ... SELECT`:
   ```sql
   INSERT INTO contract_party (id, account_id, contract_id, party_id, role, is_primary, valid_from, source, created_at, updated_at)
   SELECT gen_random_uuid(), c.account_id, c.id, c.party_id,
          CASE c.category WHEN 'lease' THEN 'tenant' WHEN 'employment' THEN 'employee' WHEN 'insurance' THEN 'insurer'
                          WHEN 'maintenance' THEN 'maintainer' WHEN 'management' THEN 'manager' WHEN 'security' THEN 'security'
                          ELSE 'supplier' END,
          true, c.start_date, CASE c.origin WHEN 'imported' THEN 'import' ELSE 'manual' END, now(), now()
   FROM contract c WHERE c.party_id IS NOT NULL
   ```
   `gen_random_uuid()` exists on Postgres 13+ (Railway's is 16).
3. RLS: `from app.infra.rls import enable_rls_sql` and `for stmt in enable_rls_sql("contract_party"): op.execute(stmt)`.
   Grants need nothing: the app role has default privileges on new tables (`app_role_sql` in the first migration).
4. `op.drop_index("ix_contract_party_id", table_name="contract")` and `op.drop_column("contract", "party_id")`.

Downgrade: add the column + index back, `UPDATE contract c SET party_id = cp.party_id FROM contract_party cp WHERE cp.contract_id = c.id AND cp.is_primary`,
disable RLS with `disable_rls_sql("contract_party")`, drop the table.

Production runs `python scripts/migrate.py` on every api deploy, so the migration applies itself.

## 2. Domain

### New `backend/app/domain/contract_parties.py`

All writes go through here (the layering test `tests/test_layering.py` forbids writes outside `app/domain`). Every write
emits a `domain_event` (`entity_type="contract_party"`, `entity_id=row.id`, payload with `contract_id`, `contract_number`,
`party_id`, `party_name`, `role`, `is_primary`), as every domain command does.

```python
async def list_for_contract(session, contract_id) -> list[tuple[ContractParty, Party]]      # ordered: primary first, then role, name
async def list_for_contracts(session, contract_ids) -> dict[uuid.UUID, list[tuple[ContractParty, Party]]]  # batch, one query
async def primary_parties(session, contract_ids) -> dict[uuid.UUID, Party]                   # batch helper for lists/calendar/allocations
async def add_party(session, actor, *, contract_id, party_id, role, is_primary=False, valid_from=None, source="manual") -> ContractParty
    # role must be in PARTY_ROLES; if is_primary, clear the previous primary first (event "contract_party.primary_changed")
    # the first party added to a contract becomes primary automatically
    # also adds `role` to party.roles when missing (reuse the role-merge part of find_or_create_party, factor it into parties.add_role)
async def update_party(session, actor, contract_party_id, *, role=None, valid_from=None, valid_to=None) -> ContractParty
async def set_primary(session, actor, contract_party_id) -> ContractParty
async def remove_party(session, actor, contract_party_id) -> None
    # hard delete of the link row (it is a link, not a record); refuse to remove the primary while other parties remain
    # — set another primary first. Removing the last party is allowed; the health report then flags "Osapool sidumata".
async def replace_parties(session, actor, contract_id, items: list[dict], source) -> list[ContractParty]
    # items: [{party_id, role, is_primary, valid_from}] — the set a re-import or the operator wants; adds, updates roles,
    # removes the rest. Used by import commit on duplicate re-import.
def counterparty_role(category: str) -> str   # the table above
def our_role(category: str) -> str            # second column of the table
```

After `add_party`/`remove_party`/`set_primary` call `contracts.index_contract(session, contract)` so the omnibox subtitle
follows the primary party.

### `backend/app/domain/contracts.py`

- `create_contract(...)`: replace `party_id: uuid.UUID | None` with `parties: list[dict] | None` (same item shape as
  `replace_parties`); after the flush, call `contract_parties.add_party` for each (the first marked primary, or the first
  item if none is). Event payload: `parties: [...]` instead of `party_id`.
- `index_contract`: primary party name from `contract_parties.primary_parties(session, [c.id])`.

### `backend/app/domain/portfolio.py`

- `list_contracts`: remove the `outerjoin(Party, Party.id == Contract.party_id)`. Build a primary-party subquery
  (`select(ContractParty.contract_id, ContractParty.party_id).where(ContractParty.is_primary)`) and outer-join `Party`
  through it so the return type `list[tuple[Contract, Party | None]]` and the `q` filter on `Party.name` keep working.
  `party_id` filter → `Contract.id.in_(select(ContractParty.contract_id).where(ContractParty.party_id == party_id))`
  (any role, not only primary).
- `contract_bundle`: `party` = primary party; add `"parties": await contract_parties.list_for_contract(session, contract.id)`.
- `update_contract`: drop `party_id` from the accepted fields (the API no longer sends it).
- `health_report` `no_party` finding: contracts with no `contract_party` row (`~Contract.id.in_(select(ContractParty.contract_id))`).

### `backend/app/domain/parties.py`

- `contracts_of(session, party_id)`: join through `ContractParty` (any role), distinct, same ordering.
- `delete_party`: refuse (`Conflict`) when the party has `contract_party` rows — today a party on a contract could be
  soft-deleted and leave a dangling id.
- Factor the "add role if missing + fill empty fields" block of `find_or_create_party` into `add_role(session, actor, party, role)`
  so `contract_parties.add_party` can reuse it.

### `backend/app/domain/imports.py`

- `commit_import(...)`: replace the `party_id` / `party_override` parameters with
  `parties: list[dict] | None` where each item is `{"index": <position in prop.parties> | None, "party_id": <existing> | None,
  "role": <PARTY_ROLES>, "is_primary": bool, "include": bool}`. Semantics:
  - `None` (old clients, tests) → default set: every proposal party whose role is not in `{landlord, client, insured, employer}`
    and whose name is not our company's name (`prop.contract.our_company_name`, case-insensitive) is included via
    `find_or_create_party` with its own role; the counterparty (`_counterparty(prop)`) is primary; if nothing qualifies,
    fall back to `counterparty_role(cat)` on the counterparty.
  - Given → for each included item: `party_id` set → that party; else `find_or_create_party` from `prop.parties[index]`
    (name, registry code, address, e-mail) with `item.role`. Exactly one `is_primary`; if none, the first.
  - New contract → `add_party` per item with `source="import"`. Duplicate re-import (`job.duplicate_of_contract_id`) →
    `replace_parties(..., source="import")`.
- Remove `_party_role`; use `counterparty_role`. Event payload: `parties: [{party_id, role, is_primary}]`.
- `index_entity` subtitle: primary party name.
- `manual_register(...)`: keep the single `counterparty_name` + `registry_code` form; create the party with
  `counterparty_role(category)` and add it as primary through `add_party`.
- `register_amendment(...)` (external amendment): accept an optional `new_party_id` + `valid_from`; when given, close the
  current primary row (`valid_to = valid_from - 1 day`), add the new party as primary with `source="amendment"`. This is the
  tenant-change case; keep it minimal (no UI field yet is fine, but the domain path should exist and be tested).

## 3. API

### `backend/app/api/operator/contracts.py`

- `ContractOut.party: PartyRef | None` stays — it is the primary party, so lists and cards do not change shape.
- `ContractDetailOut` gains `parties: list[ContractPartyOut]` with `id, party: PartyRef, role, is_primary, valid_from, valid_to, source`.
- `ContractPatchIn`: remove `party_id`.
- New routes:
  - `GET /contracts/{id}/parties` → `list[ContractPartyOut]`
  - `POST /contracts/{id}/parties` body `{party_id, role, is_primary?, valid_from?}` → 201 `ContractPartyOut`
  - `PATCH /contracts/{id}/parties/{cp_id}` body `{role?, is_primary?, valid_from?, valid_to?}` (`is_primary: true` → `set_primary`)
  - `DELETE /contracts/{id}/parties/{cp_id}` → 204 (`Conflict` when removing the primary while others remain)
- `_out(c, p, kd)` is unchanged: callers pass the primary party from `portfolio.list_contracts` / `primary_parties`.

### `backend/app/api/operator/imports.py`

- `CommitIn`: remove `party_id` and `party`; add `parties: list[CommitPartyIn] | None = None` with
  `CommitPartyIn {index: int | None, party_id: uuid | None, role: str, is_primary: bool = False, include: bool = True}`.
- Pass `parties=[x.model_dump() for x in body.parties] if body.parties is not None else None` to `commit_import`.

### Other readers of `contract.party_id`

- `backend/app/api/operator/keydates.py`: `_party_names` currently keys by `c.party_id`; replace with
  `contract_parties.primary_parties(session, [contract ids])` and look up by contract id.
- `backend/app/api/operator/assets.py` `_alloc_out`: party name via `primary_parties(session, [c.id])` (batch it in the
  callers that build many allocations: `get_asset`, `asset_allocations`).
- `backend/app/api/operator/parties.py` `party_contracts`: unchanged API, now returns contracts in any role; add `role`
  (the party's role in that contract) to `PartyContractOut` — fetch it from `list_for_contracts`.
- `backend/app/domain/audit.py` `resolve_entities`: add `"contract_party"` → label `"{party_name} · {role}"`, link to the contract
  (`/app/portfell/leping/{payload.contract_id}`). Add `contract_party: "Lepingu osapool"` to the entity words there and in
  `frontend/src/i18n/et.ts` under `audit.entities`.
- `backend/scripts/seed_demo.py`: unchanged (it commits through the import API).

## 4. Frontend

### `frontend/src/types/api.ts`

- `ContractSummary.party` stays (primary). Add
  `export interface ContractParty { id: UUID; party: { id: UUID; name: string; registry_code: string | null }; role: string; is_primary: boolean; valid_from: ISODate | null; valid_to: ISODate | null; source: string }`
  and `parties: ContractParty[]` on `ContractDetail`.
- `ImportCommitInput`: remove `party_id` and `party`; add `parties?: { index: number | null; party_id: string | null; role: string; is_primary: boolean; include: boolean }[]`.
- Add `PartyContractRow` with `role` for the party page if `PartyContractOut` changed.

### `frontend/src/lib/queries/portfolio.ts`

- `useUpdateContract`: drop `party_id` from the body type.
- Add `useAddContractParty(contractId)`, `useUpdateContractParty(contractId)`, `useRemoveContractParty(contractId)` posting to
  the routes above; on success invalidate `["contract", id]`, `["contracts"]`, `["party-contracts"]`, `["audit"]`.

### `frontend/src/features/contracts/ContractDetailPage.tsx`

- Header link to `c.party` (primary) stays.
- Replace the single party line with a **"Pooled"** card: one row per `c.parties` entry — party name (link to the party
  page), role (dropdown of `PARTY_ROLES` with labels from `imports.partyRoles`), a "Peamine" pill or a "Tee peamiseks" text
  button, the validity dates when set, a remove icon button (disabled with a title when it is the primary and others exist).
  Footer: "Lisa osapool" → a small modal with a party search (reuse the search + list pattern from `LinkSection`), role
  dropdown, "Peamine" checkbox. Remove the party picker from the header edit if one exists.

### `frontend/src/features/imports/LinkSection.tsx` + `ImportReviewPage.tsx`

- Replace the `partyMode` / `party_id` pair in `LinkState` with `parties: { index: number | null; party_id: string; role: string; is_primary: boolean; include: boolean; mode: "new" | "existing" }[]`,
  initialised from `draft.parties`: one row per proposal party, `include` = role not in {landlord, client, insured, employer}
  and name ≠ `draft.contract.our_company_name`, `mode: "new"`, `is_primary` on the counterparty (first included row otherwise).
  Keep the rows in sync when `draft.parties` changes (by index; drop rows whose index no longer exists).
- Render one row per party: checkbox "Lepingu osapool" (include), name + registry code, role dropdown, "Peamine" radio
  (exactly one among included rows), and per row "Loo uus ettepanekust" / "Vali olemasolev" (existing → the same search +
  select as today). Keep the `RegistryRow` under each "new" row.
- Allow adding a row that is not in the proposal (e.g. a guarantor you know about): "Lisa osapool" → `index: null`,
  `mode: "existing"`.
- `canCommit`: at least one included row, each `existing` row has a `party_id`, exactly one primary.
- `doCommit`: send `parties: link.parties.filter(r => r.include).map(r => ({ index: r.mode === "new" ? r.index : null, party_id: r.mode === "existing" ? r.party_id : null, role: r.role, is_primary: r.is_primary, include: true }))`.
- Delete the now-unused `partyNew`/`pickExisting`/`createNew` strings only if nothing else uses them.

### `frontend/src/features/portfolio/PartyDetailPage.tsx`

Show the role column in the contracts table (the party's role in each contract).

### i18n (`frontend/src/i18n/et.ts`)

`contract.parties: "Pooled"`, `contract.addParty: "Lisa osapool"`, `contract.primary: "Peamine"`, `contract.makePrimary: "Tee peamiseks"`,
`contract.removeParty: "Eemalda lepingult"`, `contract.primaryKeep: "Peamist osapoolt ei saa eemaldada — määra enne teine peamiseks"`,
`contract.partyAdded/partyRemoved`, `imports.includeParty: "Lepingu osapool"`, `imports.addPartyRow: "Lisa osapool"`,
`imports.onePrimary: "Täpselt üks osapool peab olema peamine"`, `audit.entities.contract_party: "Lepingu osapool"`.

## 5. Tests

- `backend/tests/helpers.py::make_contract`: replace `party_id` with `parties: list[tuple[uuid.UUID, str]] | None`
  (party id, role); the first becomes primary. Update the four callers (`test_audit_search_keydates.py`, `test_parties.py`).
- `test_parties.py`: `test_party_contracts` → contract linked as tenant appears; link the same party as `insurer` on a second
  contract → both listed with roles; deleting a party with contracts → 409; `find_or_create_party` role merge unchanged.
- New `tests/test_contract_parties.py`:
  - add two tenants to one lease (second with `is_primary=False`), detail lists both, `ContractOut.party` is the primary;
  - `set_primary` on the second → the first loses the flag; removing the primary while another remains → 409; after
    `set_primary` the removal works; last-party removal allowed and the health report shows `no_party`;
  - unknown role → 422; duplicate (contract, party, role) → 409;
  - RLS: a second account cannot read the rows (same pattern as the other tenant tests);
  - events: `contract_party.added`, `contract_party.primary_changed`, `contract_party.removed` appear under `entity_type=contract_party`
    and the global log resolves them to the contract link.
- `test_imports.py`: `test_import_lease_pdf_end_to_end` commits with the default set → one `tenant` row that is primary and
  `c["party"]["registry_code"] == "10714568"` still holds; add a commit with an explicit `parties` list that includes a second
  existing party as `other` (a guarantor) → two rows; duplicate re-import with a different list → rows replaced, not appended.
  `test_import_maintenance_docx_and_coverage`: role is `maintainer`. Manual registration test: role from `counterparty_role`.
- `test_audit_search_keydates.py`: key-date `party_name` comes from the primary party.
- Run everything: `cd backend && uv run pytest -q` (real Postgres on :55433; the migration is applied by the fixture) and
  `uv run ruff check app tests`; `cd frontend && npx tsc --noEmit && npx eslint .`.

## 6. Docs, deploy, verification

- `architecture.md` §2 entity map: replace `contract.party_id` with the `contract_party` row (contract_id, party_id, role,
  is_primary, valid_from/to, source) and one sentence: "a contract's parties are rows, the primary one is what single-party
  views show". `README.md` Phase 2 status: "contracts link to any number of parties with a role".
- `data/TESTPLAN-phase2.md` §7/§8: the Seosed box lists every proposal party with include/role/primary; the contract page has
  a Pooled card (add a second party, make it primary, remove).
- Commit, `git push origin main`, then `railway redeploy --service api --from-source --yes` (runs the migration), wait for
  SUCCESS, same for `worker`, then `frontend`. Check `https://api-production-b9c7d.up.railway.app/api/health` and open a
  contract page in production: the Pooled card shows the backfilled primary party with the role from the category table.
- Rollback: `railway` redeploy of the previous deployment plus `uv run alembic downgrade -1` through `railway ssh --service api`
  (the downgrade restores `contract.party_id` from the primary rows).
