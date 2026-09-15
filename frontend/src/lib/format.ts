const dateFmt = new Intl.DateTimeFormat("et-EE", { day: "2-digit", month: "2-digit", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("et-EE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const numFmt = new Intl.NumberFormat("et-EE", { maximumFractionDigits: 2 });
const eurFmt = new Intl.NumberFormat("et-EE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 });

export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return isNaN(d.getTime()) ? String(v) : dateFmt.format(d);
}
export function fmtDateTime(v: string | Date | null | undefined): string {
  if (!v) return "—";
  const d = typeof v === "string" ? new Date(v) : v;
  return isNaN(d.getTime()) ? String(v) : dateTimeFmt.format(d);
}
export function fmtNum(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  return isNaN(n) ? String(v) : numFmt.format(n);
}
export function fmtEur(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  const n = typeof v === "string" ? Number(v) : v;
  return isNaN(n) ? String(v) : eurFmt.format(n);
}
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
export function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}
/** yyyy-mm-dd in local time */
export function isoDay(d: Date): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "?";
}
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
export function valueToString(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Jah" : "Ei";
  if (typeof v === "number") return fmtNum(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
