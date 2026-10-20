"use client";
import { t } from "@/i18n";
import { Pill, type Tone } from "@/components/ui/Pill";
import { cx, daysUntil, fmtDate, fmtFixed } from "@/lib/format";
import type { KeyDate, KeyDateStatus as Status } from "@/types/api";

/** The one label every view shows for a key date (status from the backend: keydates.status_of). Only an undone task is red;
 *  a milestone that happened is history, a deadline that went by has lapsed, an option that opened stays open. */
export function keyDateLabel(k: KeyDate): { text: string; tone: Tone; hint?: string } {
  const n = daysUntil(k.due_date);
  const status: Status = k.status ?? (n >= 0 ? "upcoming" : "past");
  switch (status) {
    case "upcoming": return { text: n === 0 ? t("keyDates.status.today") : t("home.inDays", { n }), tone: n <= 30 ? "warning" : "neutral" };
    case "overdue": return { text: t("keyDates.status.overdue"), tone: "error", hint: t("keyDates.statusHint.overdue") };
    case "unconfirmed": return { text: t("keyDates.status.unconfirmed"), tone: "warning", hint: t("keyDates.statusHint.unconfirmed") };
    case "done": {
      const rent = k.resolution_data?.rent;
      const text = rent && rent.new !== rent.old ? `✓ ${t("keyDates.doneRent", { amount: fmtFixed(rent.new) })}` : `✓ ${k.resolved_at ? t("keyDates.status.doneOn", { date: fmtDate(k.resolved_at) }) : t("keyDates.status.done")}`;
      return { text, tone: "success", hint: k.resolved_at ? t("keyDates.status.doneOn", { date: fmtDate(k.resolved_at) }) : undefined };
    }
    case "skipped": return { text: t("keyDates.status.skipped"), tone: "neutral", hint: t("keyDates.statusHint.skipped") };
    case "open_since": return { text: t("keyDates.status.openSince", { date: fmtDate(k.due_date) }), tone: "neutral", hint: t("keyDates.statusHint.openSince") };
    case "lapsed": return { text: t("keyDates.status.lapsed"), tone: "neutral", hint: t("keyDates.statusHint.lapsed") };
    default: return { text: t("keyDates.status.past"), tone: "neutral", hint: t("keyDates.statusHint.past") };
  }
}

/** Open = someone still has to say what happened. */
export const isOpen = (k: KeyDate) => k.status === "overdue" || k.status === "unconfirmed";
/** History = folded away on the contract page (an option that is still open is not history). */
export const isHistory = (k: KeyDate) => !isOpen(k) && k.status !== "open_since" && daysUntil(k.due_date) < 0;

export function KeyDatePill({ k, className }: { k: KeyDate; className?: string }) {
  const l = keyDateLabel(k);
  return <Pill tone={l.tone} title={l.hint} className={className}>{l.text}</Pill>;
}

/** Inline text variant (contract page row sub-line). */
export function KeyDateStatusText({ k }: { k: KeyDate }) {
  const l = keyDateLabel(k);
  const color = l.tone === "error" ? "text-error" : l.tone === "warning" ? "text-warning" : l.tone === "success" ? "text-success" : "";
  return <span className={cx(color)} title={l.hint}>{l.text}</span>;
}
