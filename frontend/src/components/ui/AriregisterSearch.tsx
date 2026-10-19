"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { fetchAriregisterDetail, useAriregister } from "@/lib/queries/settings";
import { useDebounced } from "@/lib/hooks";
import { Spinner } from "@/components/ui/State";
import { IconSearch } from "@/components/ui/Icons";
import { cx } from "@/lib/format";
import type { AriregisterHit } from "@/types/api";

// Search hits carry the status code (R/L/N/K), the company card its text — both map to one short label and tone (demo `AR_STAATUS`).
const STATUS: Record<string, [string, string]> = { R: ["registered", "green"], L: ["liquidating", "amber"], N: ["bankrupt", "red"], K: ["deleted", ""] };
const STATUS_TEXT: Record<string, string> = { "registrisse kantud": "R", "likvideerimisel": "L", "pankrotis": "N", "kustutatud": "K" };
function statusOf(raw: string | null): [string, string] | null {
  if (!raw) return null;
  const code = STATUS[raw] ? raw : STATUS_TEXT[raw.toLowerCase()];
  return code ? [t(`setup.company.status_${STATUS[code][0]}` as Parameters<typeof t>[0]), STATUS[code][1]] : [raw, ""];
}
// Registry addresses run county → parish → village → street; read street first (demo `alAadress`).
const streetFirst = (a: string | null) => (a && /maakond/i.test(a.split(",")[0] ?? "") ? a.split(",").map((x) => x.trim()).reverse().join(", ") : a);

/** Name/registry-code search over äriregister. `onPick` gets the search hit at once and the full card (VAT, contacts, board) when it arrives.
 *  `variant="setup"` is the „Alusta” look (demo v623 `.al-otsi`/`.al-pick`): no label, big field with the source tag, filled result rows. */
export function AriregisterSearch({ id = "ar-q", onPick, variant = "field", examples, examplesLabel }: { id?: string; onPick: (hit: AriregisterHit, detail: AriregisterHit | null) => void; variant?: "field" | "setup"; examples?: { t: string; q: string }[]; examplesLabel?: string }) {
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
  const busy = reg.isFetching || enriching;
  const hits = (reg.data ?? []).slice(0, 6);
  if (variant === "setup") return (
    <>
      <div className="al-otsi">
        <span className="al-otsi-ik"><IconSearch /></span>
        <input id={id} type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("setup.company.placeholder")} aria-label={t("setup.company.placeholder")} aria-controls={`${id}-res`} autoComplete="off" spellCheck={false} />
        <span className="al-otsi-src">{busy && <Spinner />}{t("setup.company.sourceValue")}</span>
      </div>
      {dq.length < 2 && examples?.length ? <Examples label={examplesLabel} items={examples} onPick={setQ} /> : null}
      {dq.length >= 2 && !reg.isLoading && (
        <div id={`${id}-res`} className="al-res" aria-live="polite">
          {hits.length === 0 ? <div className="al-tyhi"><b>{t("setup.company.noResults")}</b>{examples?.length ? <><span>{t("setup.company.noResultsSub")}</span><Examples items={examples} onPick={setQ} /></> : null}</div> : hits.map((h) => {
            const st = statusOf(h.status);
            return (
              <button key={h.registry_code} type="button" className="al-pick" onClick={() => pick(h)}>
                <span className="al-pick-t"><b>{h.name}</b><small>{streetFirst(h.address) || t("setup.company.noAddress")}</small></span>
                <span className="al-pick-r"><span className="mono">{h.registry_code}</span>{st && <span className={cx("al-seis", st[1])}>{st[0]}</span>}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
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

function Examples({ label, items, onPick }: { label?: string; items: { t: string; q: string }[]; onPick: (q: string) => void }) {
  return <div className="al-naited">{label && <span>{label}</span>}{items.map((n) => <button key={n.q} type="button" className="al-naide" onClick={() => onPick(n.q)}>{n.t}<span className="al-naide-s">{n.q}</span></button>)}</div>;
}
