import { t, tEnum } from "@/i18n";
import { fmtDate, fmtFixed } from "@/lib/format";
import type { Proposal } from "@/types/api";
import { UNCERTAIN } from "./reviewState";

/** A place the operator looks at (demo `irKohad`): an uncertain value, or a missing link. ``key`` is the checked-key for
 *  values (`parameter:3`), so „Õige” is the same check the commit gate reads. */
export interface Spot { key: string; step: 1 | 2 | 3; kind: "party" | "parameter" | "key_date" | "date" | "space"; idx: number; label: string; value: string; note: string; page: number | null; needles: string[] }

export const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

/** „7.60” → „7,60”, „1328.48” → „1 328,48” — the decimals the contract wrote stay. */
export function fmtValue(v: string | number | null | undefined, unit?: string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v).trim();
  const out = /^\d{4}-\d{2}-\d{2}$/.test(s) ? fmtDate(s) : /^-?\d+(\.\d+)?$/.test(s) ? fmtFixed(Number(s), (s.split(".")[1] ?? "").length) : s;
  return unit ? `${out} ${unit}` : out;
}

/** Strings to mark in the original for a value: the quoted text first, then the value as the contract writes it. */
export function needlesFor(value: string | number | null | undefined, text?: string | null): string[] {
  const tx = (text ?? "").replace(/\s+/g, " ").trim();
  const quote = tx ? [tx.length > 48 ? tx.slice(0, 48) : tx] : [];
  const v = String(value ?? "").trim();
  const vals = !v ? [] : /^\d{4}-\d{2}-\d{2}/.test(v) ? [fmtDate(v)] : /^-?\d+\.\d+$/.test(v) ? [v.replace(".", ","), fmtValue(v), v] : [v];
  // a distinctive value (174,8 · 02.01.2024) is marked itself; a short one („2”, „3”) would hit anywhere — the quote first
  return vals.some((x) => x.length >= 4) ? [...vals, ...quote] : [...quote, ...vals];
}

/** pp.kk.aaaa or ISO → ISO (null if not a date). */
export function toIso(raw: string): string | null {
  const s = raw.trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** The contract's start and end: one copy, on the head (the calendar's start/end entries are made from it at commit). */
export const HEAD_DATES = ["start_date", "end_date"] as const;
export type HeadDate = (typeof HEAD_DATES)[number];
export const headDateLabel = (f: HeadDate) => (f === "start_date" ? t("contract.startDate") : t("contract.endDate"));
export const headDateUnsure = (d: Proposal, f: HeadDate) => (d.date_checks?.[f]?.confidence ?? 1) < UNCERTAIN;

export const kdLabel = (k: { kind: string; title: string }) => k.title || tEnum("keyDates.kinds", k.kind);

/** The places to look at, in panel order: who (parties) · what it is tied to (space) · values. */
export function spotsOf(draft: Proposal, checked: Set<string>, needSpace: boolean): Spot[] {
  const out: Spot[] = [];
  draft.parties.forEach((p, i) => {
    const key = `party:${i}`;
    if (p.confidence < UNCERTAIN && !checked.has(key))
      out.push({ key, step: 1, kind: "party", idx: i, label: tEnum("imports.partyRoles", p.role), value: [p.name, p.registry_code].filter(Boolean).join(" · "), note: t("imports.ir.notePartyUnsure"), page: p.page ?? null, needles: needlesFor(p.registry_code, p.name) });
  });
  if (needSpace) out.push({ key: "space", step: 2, kind: "space", idx: -1, label: t("imports.ir.space"), value: "", note: t("imports.ir.noteSpace"), page: null, needles: [] });
  for (const f of HEAD_DATES) {
    const key = `contract:${f}`, chk = draft.date_checks?.[f], v = draft.contract[f];
    if (chk && chk.confidence < UNCERTAIN && !checked.has(key))
      out.push({ key, step: 3, kind: "date", idx: -1, label: headDateLabel(f), value: v ? fmtDate(v) : "—", note: chk.note || t("imports.ir.noteUnsure"), page: chk.page ?? null, needles: needlesFor(v) });
  }
  draft.parameters.forEach((p, i) => {
    const key = `parameter:${i}`;
    if (p.confidence < UNCERTAIN && !checked.has(key))
      out.push({ key, step: 3, kind: "parameter", idx: i, label: p.label || p.key, value: fmtValue(p.value, p.unit), note: p.note || t("imports.ir.noteUnsure"), page: p.page ?? null, needles: needlesFor(p.value, p.text) });
  });
  draft.key_dates.forEach((k, i) => {
    const key = `key_date:${i}`;
    if (k.confidence < UNCERTAIN && !checked.has(key))
      out.push({ key, step: 3, kind: "key_date", idx: i, label: kdLabel(k), value: fmtDate(k.date), note: k.note || t("imports.ir.noteUnsure"), page: k.page ?? null, needles: needlesFor(k.date) });
  });
  return out;
}

/** Cross-checks among the sure values (demo `impRist`: the operator does not have to trust the machine). */
export function crossChecks(draft: Proposal, spaceArea: number | null): string[] {
  const by = (k: string) => num(draft.parameters.find((p) => p.key === k)?.value);
  const area = by("area_m2") ?? (draft.asset_hint?.area_m2 != null ? Number(draft.asset_hint.area_m2) : null);
  const rate = by("rent_per_m2"), monthly = by("rent_monthly");
  const R: string[] = [];
  if (area != null && spaceArea != null && Math.abs(area - spaceArea) <= 0.15) R.push(t("imports.ir.crossArea", { area: fmtFixed(area, 1) }));
  if (area != null && rate != null) {
    const m = area * rate;
    if (monthly == null || Math.abs(monthly - m) < 1) R.push(`${fmtFixed(area, 1)} m² × ${fmtFixed(rate, 2)} €/m² = ${fmtFixed(m, 2)} € ${t("imports.ir.perMonth")}`);
  }
  const s = draft.contract.start_date ?? draft.contract.signed_at, e = draft.contract.end_date;
  if (s && e) {
    const a = new Date(s), b = new Date(e);
    const months = (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
    if (months > 0 && months % 12 === 0 && Math.abs(b.getDate() - a.getDate()) <= 1) R.push(`${fmtDate(s)} + ${months / 12} a = ${fmtDate(e)}`);
  }
  return R;
}

/** Monthly rent the contract states, else area × €/m². */
export function monthlyOf(draft: Proposal, area: number | null): number | null {
  const by = (k: string) => num(draft.parameters.find((p) => p.key === k)?.value);
  const m = by("rent_monthly");
  if (m != null) return m;
  const a = by("area_m2") ?? area, r = by("rent_per_m2");
  return a != null && r != null ? a * r : null;
}

export function termYears(draft: Proposal): number | null {
  const s = draft.contract.start_date ?? draft.contract.signed_at, e = draft.contract.end_date;
  if (!s || !e) return null;
  const y = (new Date(e).getTime() - new Date(s).getTime()) / (365.25 * 86400000);
  return y > 0 ? Math.round(y * 10) / 10 : null;
}
