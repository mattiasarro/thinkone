import { fmtDate, fmtNum, valueToString } from "@/lib/format";
import { t } from "@/i18n";
import type { PortalQuote } from "@/types/portal";

/** yyyy-mm-dd → dd.mm.yyyy without timezone drift. */
export function fmtDay(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return fmtDate(iso);
  return `${m[3]}.${m[2]}.${m[1]}`;
}

export function daysLabel(n: number): string {
  if (n < 0) return t("portal.expired");
  if (n === 0) return t("portal.lastDay");
  if (n === 1) return t("portal.dayLeft");
  return t("portal.daysLeft", { n });
}

/** Share of the validity window still left (0..1), measured from the last send. */
export function validityLeft(q: PortalQuote): number {
  const last = q.versions[q.versions.length - 1];
  const end = new Date(q.valid_until + "T00:00:00").getTime();
  const start = last ? new Date(last.created_at).getTime() : end - 30 * 86400000;
  const total = Math.max(1, Math.round((end - start) / 86400000));
  return Math.min(1, Math.max(0, q.days_left / total));
}

/** Diff values can be numbers, strings, lists or objects — render them readably. */
export function changeValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" && x !== null ? JSON.stringify(x) : String(x))).join(", ") : "—";
  if (typeof v === "number") return fmtNum(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDay(v);
  return valueToString(v);
}

export function isClientMessage(authorType: string): boolean {
  return authorType === "client";
}
