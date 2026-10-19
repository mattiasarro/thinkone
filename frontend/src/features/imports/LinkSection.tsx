"use client";
import { useEffect, useState } from "react";
import { t, tEnum } from "@/i18n";
import { useAriregister, useCompanies } from "@/lib/queries/settings";
import { useAssets, useParties } from "@/lib/queries/portfolio";
import { useDebounced } from "@/lib/hooks";
import { PARTY_ROLES, type Asset, type Proposal, type SpaceAttributes } from "@/types/api";
import { defaultRole } from "@/features/contracts/PartiesCard";

/** One party of the contract to commit: from the proposal (``index``, mode new → find-or-create) or an existing registry party. */
export interface PartyRow { index: number | null; party_id: string; role: string; is_primary: boolean; include: boolean; mode: "new" | "existing" }
export interface LinkState { company_id: string; asset_id: string; space_ids: string[]; allocation_kind: "exclusive" | "coverage"; parties: PartyRow[]; parking_numbers: string[] | null }

const OUR_SIDE = new Set(["landlord", "client", "insured", "employer"]);
const roleOptions = PARTY_ROLES.map((r) => ({ value: r, label: tEnum("imports.partyRoles", r) }));

export function isOurs(draft: Proposal, i: number): boolean {
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
export function contractArea(draft: Proposal): number | null {
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
export function suggestSpace(spaces: Asset[], area: number | null): Asset | null {
  if (area == null) return null;
  const same = spaces.filter((s) => Math.abs(Number((s.attributes as Partial<SpaceAttributes>).rentable_area_m2) - area) <= 0.15 && s.status !== "jagatud" && s.status !== "mitteaktiivne");
  const free = same.filter((s) => s.status === "vaba");
  return same.length === 1 ? same[0] : free.length === 1 ? free[0] : null;
}

/** Live äriregister line for a new counterparty (demo p8ArRida): the registry is the truth for the name. */
export function RegistryRow({ code, contractName }: { code: string | null | undefined; contractName: string }) {
  const q = useAriregister(code && /^\d{8}$/.test(code) ? code : "");
  if (!code || !/^\d{8}$/.test(code)) return null;
  const hit = q.data?.find((h) => h.registry_code === code) ?? q.data?.[0];
  const link = <a className="p8-ar-l" href={`https://ariregister.rik.ee/est/company/${code}`} target="_blank" rel="noopener" title={t("imports.ir.openRegistry")}>↗</a>;
  if (q.isLoading) return <span className="p8-ar">{t("imports.registry")}: {t("imports.registryChecking")}</span>;
  if (!hit) return <span className="p8-ar halb">{t("imports.registry")}: {t("imports.registryNotFound", { code })} {link}</span>;
  const other = hit.name.trim().toLowerCase() !== contractName.trim().toLowerCase();
  return <span className="p8-ar">{t("imports.registry")}: <b>{hit.name}</b>{hit.status ? ` · ${t("imports.registryStatus", { status: hit.status })}` : ""}{other ? ` · ${t("imports.registryOtherName")}` : ""} {link}</span>;
}

/** The link defaults (demo: the machine picks, the operator only confirms): our company by name or the only one, and the
 *  building + space from the contract's asset hint („P_29” → Pind 29). */
export function useLinkDefaults(draft: Proposal, state: LinkState, onChange: (s: LinkState) => void) {
  const companies = useCompanies();
  const properties = useAssets({ type_code: "property" });
  const allSpaces = useAssets({ type_code: "space" });
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
      if (byName.length === 1 && byName[0].parent_id) { onChange({ ...state, asset_id: byName[0].parent_id, space_ids: [byName[0].id], allocation_kind: "exclusive", parking_numbers: null }); return; }
      if (allSpaces.isLoading) return;
      const m = properties.data.find((p) => (p.name && hint.includes(p.name.toLowerCase())) || ((p.attributes.address as string | undefined)?.toLowerCase() && hint.includes((p.attributes.address as string).toLowerCase())))
        ?? (byName.length > 1 ? properties.data.find((p) => p.id === byName[0].parent_id) : undefined);
      if (m) onChange({ ...state, asset_id: m.id });
    }
  }, [draft.asset_hint, properties.data, allSpaces.data, allSpaces.isLoading, state, onChange]);
  return { companies: companies.data ?? [], properties: properties.data ?? [], loading: companies.isLoading || properties.isLoading };
}

/** Party rows: one primary among the included; dropping the primary passes it on (the commit needs exactly one). */
export function setPartyRow(rows: PartyRow[], i: number, patch: Partial<PartyRow>): PartyRow[] {
  let next = rows.map((r, k) => (k === i ? { ...r, ...patch } : r));
  if (patch.is_primary) next = next.map((r, k) => ({ ...r, is_primary: k === i }));
  if (patch.include === false && rows[i].is_primary) { const f = next.findIndex((r) => r.include); next = next.map((r, k) => ({ ...r, is_primary: k === f })); }
  if (patch.include === true && !next.some((r) => r.include && r.is_primary)) next[i] = { ...next[i], is_primary: true };
  return next;
}
export function dropPartyRow(rows: PartyRow[], i: number): PartyRow[] {
  const next = rows.filter((_, k) => k !== i);
  if (next.some((r) => r.include) && !next.some((r) => r.include && r.is_primary)) { const f = next.findIndex((r) => r.include); next[f] = { ...next[f], is_primary: true }; }
  return next;
}

export const spaceArea = (s: Asset) => Number((s.attributes as Partial<SpaceAttributes>).rentable_area_m2) || 0;
export const pickableSpace = (s: Asset) => s.status !== "jagatud" && s.status !== "mitteaktiivne";
export { roleOptions };


/** Search + pick one registry party (the same pattern the contract page's „Lisa osapool” uses). */
export function ExistingPicker({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const parties = useParties({ q: dq || undefined });
  return (
    <div className="grid gap-2">
      <input className="fld fld-sm" aria-label={t("common.search")} placeholder={t("portfolio.parties.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      <select className="fld fld-sm" aria-label={t("imports.party")} value={value} onChange={(e) => onChange(e.target.value, e.target.selectedOptions[0]?.dataset.name ?? "")} size={Math.min(6, Math.max(2, (parties.data ?? []).length + 1))}>
        <option value="">{t("common.selectPlaceholder")}</option>
        {(parties.data ?? []).map((p) => <option key={p.id} value={p.id} data-name={p.name}>{p.name}{p.registry_code ? ` (${p.registry_code})` : ""}</option>)}
      </select>
    </div>
  );
}
