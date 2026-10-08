"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { fetchAriregisterDetail, useAriregister } from "@/lib/queries/settings";
import { useDebounced } from "@/lib/hooks";
import { Spinner } from "@/components/ui/State";
import { IconSearch } from "@/components/ui/Icons";
import type { AriregisterHit } from "@/types/api";

/** Name/registry-code search over äriregister. `onPick` gets the search hit at once and the full card (VAT, contacts, board) when it arrives. */
export function AriregisterSearch({ id = "ar-q", onPick }: { id?: string; onPick: (hit: AriregisterHit, detail: AriregisterHit | null) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);
  const reg = useAriregister(dq);
  const [enriching, setEnriching] = useState(false);
  const pick = async (h: AriregisterHit) => {
    setQ("");
    onPick(h, null);
    setEnriching(true);
    const d = await fetchAriregisterDetail(h.registry_code); // VAT number + contacts live on the company card, not in search results
    setEnriching(false);
    if (d) onPick(h, d);
  };
  return (
    <div className="field">
      <label htmlFor={id}>{t("settings.companies.searchRegistry")}</label>
      <div className="flex items-center gap-2 fld"><IconSearch width={16} height={16} className="text-muted flex-none" /><input id={id} value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 min-w-0 bg-transparent outline-none" placeholder={t("settings.companies.registryHint")} />{(reg.isFetching || enriching) && <Spinner />}</div>
      {dq.length >= 2 && !reg.isLoading && (
        <div className="mt-2 grid gap-1">
          {(reg.data ?? []).length === 0 ? <p className="text-sm text-muted">{t("common.noResults")}</p> : (reg.data ?? []).slice(0, 6).map((h) => (
            <button key={h.registry_code} type="button" className="drop-item border" style={{ borderColor: "var(--line)" }} onClick={() => pick(h)}>
              <span className="min-w-0"><span className="block font-semibold text-sm truncate">{h.name}</span><span className="block text-xs text-muted">{h.registry_code}{h.legal_form ? ` · ${h.legal_form}` : ""}{h.address ? ` · ${h.address}` : ""}{h.status ? ` · ${h.status}` : ""}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
