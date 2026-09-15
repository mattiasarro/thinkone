"use client";
import { useEffect, useState } from "react";
import { t, tEnum } from "@/i18n";
import { Select, Input } from "@/components/ui/Field";
import { useCompanies } from "@/lib/queries/settings";
import { useAssets, useParties } from "@/lib/queries/portfolio";
import { useDebounced } from "@/lib/hooks";
import type { Proposal } from "@/types/api";

export interface LinkState { company_id: string; asset_id: string; space_id: string; allocation_kind: "exclusive" | "coverage"; partyMode: "existing" | "new"; party_id: string }

export function LinkSection({ draft, state, onChange }: { draft: Proposal; state: LinkState; onChange: (s: LinkState) => void }) {
  const companies = useCompanies();
  const properties = useAssets({ type_code: "property" });
  const spaces = useAssets({ type_code: "space", parent_id: state.asset_id || undefined });
  const [pq, setPq] = useState("");
  const dpq = useDebounced(pq, 300);
  const parties = useParties({ q: dpq || undefined });
  const set = <K extends keyof LinkState>(k: K, v: LinkState[K]) => onChange({ ...state, [k]: v });

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
      const m = properties.data.find((p) => (p.name && hint.includes(p.name.toLowerCase())) || ((p.attributes.address as string | undefined)?.toLowerCase() && hint.includes((p.attributes.address as string).toLowerCase())));
      if (m) onChange({ ...state, asset_id: m.id });
    }
  }, [draft.asset_hint, properties.data, state, onChange]);

  const newParty = draft.parties.find((p) => p.name.toLowerCase() === draft.contract.counterparty_name.toLowerCase()) ?? draft.parties[0];
  return (
    <section className="card pad grid gap-1">
      <h3 className="text-base mb-3">{t("imports.link")}</h3>
      <Select label={t("imports.company")} value={state.company_id} placeholder={t("common.selectPlaceholder")} onChange={(e) => set("company_id", e.target.value)}>
        {(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </Select>
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Select label={t("imports.asset")} value={state.asset_id} placeholder={t("common.selectPlaceholder")} onChange={(e) => onChange({ ...state, asset_id: e.target.value, space_id: "" })} hint={draft.asset_hint?.name || draft.asset_hint?.address ? `${t("imports.asset_hint")}: ${[draft.asset_hint.name, draft.asset_hint.address].filter(Boolean).join(", ")}` : undefined}>
          {(properties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
        <Select label={t("imports.space")} value={state.space_id} placeholder={t("common.selectPlaceholder")} disabled={!state.asset_id} onChange={(e) => set("space_id", e.target.value)}>
          {(spaces.data ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>
      <Select label={t("imports.allocationKind")} value={state.allocation_kind} onChange={(e) => set("allocation_kind", e.target.value as LinkState["allocation_kind"])} options={[{ value: "exclusive", label: tEnum("contract.allocationKind", "exclusive") }, { value: "coverage", label: tEnum("contract.allocationKind", "coverage") }]} />
      <fieldset className="field">
        <legend className="field-label">{t("imports.party")}</legend>
        <div className="flex gap-4 flex-wrap mb-2">
          <label className="check !min-h-0"><input type="radio" name="partyMode" checked={state.partyMode === "existing"} onChange={() => set("partyMode", "existing")} />{t("imports.pickExisting")}</label>
          <label className="check !min-h-0"><input type="radio" name="partyMode" checked={state.partyMode === "new"} onChange={() => set("partyMode", "new")} />{t("imports.createNew")}</label>
        </div>
        {state.partyMode === "existing" ? (
          <div className="grid gap-2">
            <Input className="!mb-0" aria-label={t("common.search")} placeholder={t("portfolio.parties.search")} value={pq} onChange={(e) => setPq(e.target.value)} />
            <select className="fld" aria-label={t("imports.party")} value={state.party_id} onChange={(e) => set("party_id", e.target.value)} size={Math.min(6, Math.max(2, (parties.data ?? []).length + 1))}>
              <option value="">{t("common.selectPlaceholder")}</option>
              {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.registry_code ? ` (${p.registry_code})` : ""}</option>)}
            </select>
          </div>
        ) : (
          <div className="note info">{newParty ? t("imports.partyNew", { name: `${newParty.name}${newParty.registry_code ? ` (${newParty.registry_code})` : ""}` }) : t("imports.partyNew", { name: draft.contract.counterparty_name })}</div>
        )}
      </fieldset>
    </section>
  );
}
