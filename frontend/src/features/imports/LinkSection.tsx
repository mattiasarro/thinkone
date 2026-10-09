"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { Select, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { useAriregister, useCompanies } from "@/lib/queries/settings";
import { useAssets, useParking, useParties } from "@/lib/queries/portfolio";
import { useDebounced } from "@/lib/hooks";
import { fmtNum } from "@/lib/format";
import { SpotChip } from "@/features/assets/ParkingRegister";
import { PARTY_ROLES, type Asset, type Proposal, type SpaceAttributes } from "@/types/api";
import { defaultRole } from "@/features/contracts/PartiesCard";

/** One party of the contract to commit: from the proposal (``index``, mode new → find-or-create) or an existing registry party. */
export interface PartyRow { index: number | null; party_id: string; role: string; is_primary: boolean; include: boolean; mode: "new" | "existing" }
export interface LinkState { company_id: string; asset_id: string; space_id: string; allocation_kind: "exclusive" | "coverage"; parties: PartyRow[]; parking_numbers: string[] | null }

const OUR_SIDE = new Set(["landlord", "client", "insured", "employer"]);
const roleOptions = PARTY_ROLES.map((r) => ({ value: r, label: tEnum("imports.partyRoles", r) }));

function isOurs(draft: Proposal, i: number): boolean {
  const p = draft.parties[i];
  const ours = (draft.contract.our_company_name ?? "").trim().toLowerCase();
  return OUR_SIDE.has(p.role) || (!!ours && p.name.trim().toLowerCase() === ours);
}

/** The proposal's counterparty: first non-our-side party with a specific role, else the one named as counterparty, else the first included. */
function counterpartyIndex(draft: Proposal, included: number[]): number | null {
  const specific = included.find((i) => draft.parties[i].role !== "other");
  if (specific != null) return specific;
  const named = included.find((i) => draft.parties[i].name.trim().toLowerCase() === (draft.contract.counterparty_name ?? "").trim().toLowerCase());
  return named ?? included[0] ?? null;
}

/** One row per proposal party; our side is left out by default; the counterparty is primary. */
export function initialPartyRows(draft: Proposal): PartyRow[] {
  const included = draft.parties.map((_, i) => i).filter((i) => !isOurs(draft, i));
  const primary = counterpartyIndex(draft, included);
  return draft.parties.map((p, i) => ({
    index: i, party_id: "", include: included.includes(i), mode: "new" as const, is_primary: i === primary,
    role: i === primary ? defaultRole(draft.contract.category) : p.role,
  }));
}

/** Keep the rows in step with an edited proposal: drop rows whose index is gone, add rows for new proposal parties. */
export function syncPartyRows(rows: PartyRow[], draft: Proposal): PartyRow[] {
  const kept = rows.filter((r) => r.index == null || r.index < draft.parties.length);
  const have = new Set(kept.map((r) => r.index).filter((i): i is number => i != null));
  const added = draft.parties.map((p, i) => i).filter((i) => !have.has(i)).map((i) => ({ index: i, party_id: "", include: !isOurs(draft, i), mode: "new" as const, is_primary: false, role: draft.parties[i].role }));
  const out = [...kept, ...added];
  if (out.some((r) => r.include) && !out.some((r) => r.include && r.is_primary)) {
    const first = out.findIndex((r) => r.include);
    out[first] = { ...out[first], is_primary: true };
  }
  return out.length === rows.length && out.every((r, i) => r === rows[i]) ? rows : out;
}

export function partyRowsValid(rows: PartyRow[]): boolean {
  const inc = rows.filter((r) => r.include);
  return inc.length > 0 && inc.every((r) => r.mode === "new" ? r.index != null : !!r.party_id) && inc.filter((r) => r.is_primary).length === 1;
}

const num = (v: unknown) => { const n = Number(String(v ?? "").replace(",", ".").replace(/[^\d.-]/g, "")); return Number.isFinite(n) ? n : null; };

/** Area the contract states: asset_hint.area_m2, else the area_m2 parameter. */
function contractArea(draft: Proposal): number | null {
  if (draft.asset_hint?.area_m2 != null) return Number(draft.asset_hint.area_m2);
  const p = draft.parameters.find((x) => x.key === "area_m2");
  return p ? num(p.value) : null;
}

/** Same key as the plans matcher: „Pind 8” / „P_08” / „P 8” → „8”; „B1” / „Büroo 1” → „B1”. */
function spaceKey(name: string): string | null {
  const m = (name ?? "").trim().replace(/[_\-.]+/g, " ").match(/^(pind|boks|büroo|buroo|ladu|p|unit|space)?\s*0*([A-Z]?\d{1,3}[A-Z]?)$/i);
  if (!m) return null;
  const v = m[2].toUpperCase().replace(/^0+(?=\d)/, "");
  return m[1] && /^(büroo|buroo|boks|b)$/i.test(m[1]) && /^\d/.test(v) ? `B${v}` : v;
}

/** „Kas see on Pind 13?” (demo 11b): one concrete, free space of the building with the same rentable area (±0.15 m²). */
function suggestSpace(spaces: Asset[], area: number | null): Asset | null {
  if (area == null) return null;
  const same = spaces.filter((s) => Math.abs(Number((s.attributes as Partial<SpaceAttributes>).rentable_area_m2) - area) <= 0.15 && s.status !== "jagatud" && s.status !== "mitteaktiivne");
  const free = same.filter((s) => s.status === "vaba");
  return same.length === 1 ? same[0] : free.length === 1 ? free[0] : null;
}

/** Live äriregister line for a new counterparty (demo p8ArRida): the registry is the truth for the name. */
function RegistryRow({ code, contractName }: { code: string | null | undefined; contractName: string }) {
  const q = useAriregister(code && /^\d{8}$/.test(code) ? code : "");
  if (!code || !/^\d{8}$/.test(code)) return null;
  const hit = q.data?.find((h) => h.registry_code === code) ?? q.data?.[0];
  const link = <a className="text-primary font-semibold" href={`https://ariregister.rik.ee/est/company/${code}`} target="_blank" rel="noopener">↗</a>;
  if (q.isLoading) return <p className="text-xs text-muted mt-1">{t("imports.registry")}: {t("imports.registryChecking")}</p>;
  if (!hit) return <p className="text-xs text-warning mt-1">{t("imports.registry")}: {t("imports.registryNotFound", { code })} {link}</p>;
  const other = hit.name.trim().toLowerCase() !== contractName.trim().toLowerCase();
  return <p className="text-xs text-muted mt-1">{t("imports.registry")}: <b>{hit.name}</b>{hit.status ? ` · ${t("imports.registryStatus", { status: hit.status })}` : ""}{other ? ` · ${t("imports.registryOtherName")}` : ""} {link}</p>;
}

export function LinkSection({ draft, state, onChange }: { draft: Proposal; state: LinkState; onChange: (s: LinkState) => void }) {
  const companies = useCompanies();
  const properties = useAssets({ type_code: "property" });
  const spaces = useAssets({ type_code: "space", parent_id: state.asset_id || undefined });
  const allSpaces = useAssets({ type_code: "space" });
  const parking = useParking(state.asset_id || undefined);
  const set = <K extends keyof LinkState>(k: K, v: LinkState[K]) => onChange({ ...state, [k]: v });
  const area = useMemo(() => contractArea(draft), [draft]);
  const suggestion = useMemo(() => (state.asset_id && !state.space_id ? suggestSpace(spaces.data ?? [], area) : null), [spaces.data, area, state.asset_id, state.space_id]);

  // Sensible defaults: single company, company name match, counterparty name match, category-based allocation kind.
  useEffect(() => {
    if (!state.company_id && companies.data?.length) {
      const match = companies.data.find((c) => draft.contract.our_company_name && c.name.toLowerCase() === draft.contract.our_company_name.toLowerCase());
      const pick = match ?? (companies.data.length === 1 ? companies.data[0] : undefined);
      if (pick) onChange({ ...state, company_id: pick.id });
    }
  }, [companies.data, draft.contract.our_company_name, state, onChange]);
  useEffect(() => {
    if (!state.asset_id && draft.asset_hint && properties.data?.length) {
      const hint = `${draft.asset_hint.name ?? ""} ${draft.asset_hint.address ?? ""}`.toLowerCase();
      // a space named like the hint („P_29” → Pind 29) picks both the building and the space
      const key = draft.asset_hint.name ? spaceKey(draft.asset_hint.name) : null;
      const byName = key ? (allSpaces.data ?? []).filter((s) => s.parent_id && s.status !== "jagatud" && s.status !== "mitteaktiivne" && spaceKey(s.name) === key) : [];
      if (byName.length === 1 && byName[0].parent_id) { onChange({ ...state, asset_id: byName[0].parent_id, space_id: byName[0].id, allocation_kind: "exclusive", parking_numbers: null }); return; }
      if (allSpaces.isLoading) return;
      const m = properties.data.find((p) => (p.name && hint.includes(p.name.toLowerCase())) || ((p.attributes.address as string | undefined)?.toLowerCase() && hint.includes((p.attributes.address as string).toLowerCase())))
        ?? (byName.length > 1 ? properties.data.find((p) => p.id === byName[0].parent_id) : undefined);
      if (m) onChange({ ...state, asset_id: m.id });
    }
  }, [draft.asset_hint, properties.data, allSpaces.data, allSpaces.isLoading, state, onChange]);

  const rows = state.parties;
  const setRow = (i: number, patch: Partial<PartyRow>) => {
    let next = rows.map((r, k) => (k === i ? { ...r, ...patch } : r));
    if (patch.is_primary) next = next.map((r, k) => ({ ...r, is_primary: k === i }));
    if (patch.include === false && rows[i].is_primary) { const f = next.findIndex((r) => r.include); next = next.map((r, k) => ({ ...r, is_primary: k === f })); }
    if (patch.include === true && !next.some((r) => r.include && r.is_primary)) next[i] = { ...next[i], is_primary: true };
    set("parties", next);
  };
  const addRow = () => set("parties", [...rows, { index: null, party_id: "", role: "other", is_primary: !rows.some((r) => r.include), include: true, mode: "existing" }]);
  const dropRow = (i: number) => { const next = rows.filter((_, k) => k !== i); if (next.some((r) => r.include) && !next.some((r) => r.include && r.is_primary)) { const f = next.findIndex((r) => r.include); next[f] = { ...next[f], is_primary: true }; } set("parties", next); };
  const primaries = rows.filter((r) => r.include && r.is_primary).length;
  const spots = parking.data ?? [];
  const spaceSpots = state.space_id ? spots.filter((s) => s.space_id === state.space_id).map((s) => s.number) : [];
  const picked = state.parking_numbers ?? spaceSpots;
  const togglePark = (n: string) => set("parking_numbers", picked.includes(n) ? picked.filter((x) => x !== n) : [...picked, n]);
  return (
    <section className="card pad grid gap-1">
      <h3 className="text-base mb-3">{t("imports.link")}</h3>
      <Select label={t("imports.company")} value={state.company_id} placeholder={t("common.selectPlaceholder")} onChange={(e) => set("company_id", e.target.value)}>
        {(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Select label={t("imports.asset")} value={state.asset_id} placeholder={t("common.selectPlaceholder")} onChange={(e) => onChange({ ...state, asset_id: e.target.value, space_id: "", parking_numbers: null })} hint={draft.asset_hint?.name || draft.asset_hint?.address ? `${t("imports.asset_hint")}: ${[draft.asset_hint.name, draft.asset_hint.address].filter(Boolean).join(", ")}` : undefined}>
          {(properties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select label={t("imports.space")} value={state.space_id} placeholder={t("common.selectPlaceholder")} disabled={!state.asset_id} onChange={(e) => onChange({ ...state, space_id: e.target.value, parking_numbers: null })}>
          {(spaces.data ?? []).filter((s) => s.status !== "jagatud" && s.status !== "mitteaktiivne").map((s) => <option key={s.id} value={s.id}>{s.name} · {fmtNum((s.attributes as Partial<SpaceAttributes>).rentable_area_m2)} m²{s.status && s.status !== "vaba" ? ` · ${tEnum("assets.status", s.status)}` : ""}</option>)}
        </Select>
      </div>
      {suggestion && (
        <div className="note info items-center flex-wrap gap-2">
          <span><b>{t("imports.spaceSuggest", { name: suggestion.name })}</b> <span className="text-muted">{t("imports.spaceSuggestWhy", { area: fmtNum(area), name: suggestion.name })}</span></span>
          <Button size="sm" variant="primary" className="ml-auto" onClick={() => onChange({ ...state, space_id: suggestion.id, allocation_kind: "exclusive", parking_numbers: null })}>{t("imports.useSuggestion")}</Button>
        </div>
      )}
      <Select label={t("imports.allocationKind")} value={state.allocation_kind} onChange={(e) => set("allocation_kind", e.target.value as LinkState["allocation_kind"])} options={[{ value: "exclusive", label: tEnum("contract.allocationKind", "exclusive") }, { value: "coverage", label: tEnum("contract.allocationKind", "coverage") }]} />
      {state.space_id && state.allocation_kind === "exclusive" && spots.length > 0 && (
        <fieldset className="field">
          <legend className="field-label">{t("imports.parkingTake")} <Pill className="ml-1">{picked.length}</Pill></legend>
          <p className="text-xs text-muted mb-2">{t("imports.parkingTakeHint")} <Link href={`/app/portfell/objekt/${state.asset_id}/parkimine`} className="text-primary font-semibold">{t("assets.parkingRegisterLink")}</Link></p>
          <div className="flex flex-wrap gap-1.5">{spots.map((s) => <SpotChip key={s.id} s={s} on={picked.includes(s.number)} onClick={() => togglePark(s.number)} title={s.space_id && s.space_id !== state.space_id ? `${t("assets.parkingPickTaken")}: ${s.space_name}` : tEnum("assets.parkingReg.statuses", s.status)} />)}</div>
        </fieldset>
      )}
      <fieldset className="field">
        <legend className="field-label">{t("imports.parties")}</legend>
        <ul className="grid gap-2">
          {rows.map((r, i) => {
            const src = r.index != null ? draft.parties[r.index] : null;
            return (
              <li key={i} className={`rounded-control border p-2 grid gap-2 ${r.include ? "" : "opacity-60"}`} style={{ borderColor: "var(--line)" }}>
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="check !min-h-0"><input type="checkbox" checked={r.include} onChange={(e) => setRow(i, { include: e.target.checked })} />{t("imports.includeParty")}</label>
                  <span className="min-w-0 flex-1 text-sm font-semibold truncate">{src ? `${src.name}${src.registry_code ? ` (${src.registry_code})` : ""}` : <span className="text-muted font-normal">{t("imports.partyNotInProposal")}</span>}</span>
                  <label className="check !min-h-0" title={t("imports.onePrimary")}><input type="radio" name="primaryParty" disabled={!r.include} checked={r.include && r.is_primary} onChange={() => setRow(i, { is_primary: true })} />{t("imports.primary")}</label>
                  {src == null && <button type="button" className="icon-btn !w-8 !h-8" aria-label={t("common.remove")} onClick={() => dropRow(i)}>×</button>}
                </div>
                {r.include && (
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] items-start">
                    <Select className="!mb-0" aria-label={t("imports.role")} value={r.role} options={roleOptions} onChange={(e) => setRow(i, { role: e.target.value })} />
                    {src && (
                      <div className="flex gap-3 flex-wrap text-sm">
                        <label className="check !min-h-0"><input type="radio" name={`mode-${i}`} checked={r.mode === "new"} onChange={() => setRow(i, { mode: "new" })} />{t("imports.createNew")}</label>
                        <label className="check !min-h-0"><input type="radio" name={`mode-${i}`} checked={r.mode === "existing"} onChange={() => setRow(i, { mode: "existing" })} />{t("imports.pickExisting")}</label>
                      </div>
                    )}
                    {r.mode === "existing" && <div className="sm:col-span-2"><ExistingPicker value={r.party_id} onChange={(id) => setRow(i, { party_id: id })} /></div>}
                    {r.mode === "new" && src && <div className="sm:col-span-2 -mt-1"><RegistryRow code={src.registry_code} contractName={src.name} /></div>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <Button size="sm" onClick={addRow}>{t("imports.addPartyRow")}</Button>
          {rows.some((r) => r.include) && primaries !== 1 && <span className="text-xs text-warning">{t("imports.onePrimary")}</span>}
        </div>
      </fieldset>
    </section>
  );
}


/** Search + pick one registry party (the same pattern the contract page's „Lisa osapool” uses). */
function ExistingPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const parties = useParties({ q: dq || undefined });
  return (
    <div className="grid gap-2">
      <Input className="!mb-0" aria-label={t("common.search")} placeholder={t("portfolio.parties.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <select className="fld" aria-label={t("imports.party")} value={value} onChange={(e) => onChange(e.target.value)} size={Math.min(6, Math.max(2, (parties.data ?? []).length + 1))}>
        <option value="">{t("common.selectPlaceholder")}</option>
        {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.registry_code ? ` (${p.registry_code})` : ""}</option>)}
      </select>
    </div>
  );
}
