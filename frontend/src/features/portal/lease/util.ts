import type { Tone } from "@/components/ui/Pill";
import { t } from "@/i18n";
import { fmtNum } from "@/lib/format";
import type { LeaseThread, PortalLease, PortalLeaseStatus } from "@/types/portal";
import { fmtDay } from "../util";

export function leaseStatusTone(status: PortalLeaseStatus): Tone {
  switch (status) {
    case "draft": return "warning";
    case "sent": return "info";
    case "negotiating": return "warning";
    case "ready_to_sign": return "success";
    default: return "neutral";
  }
}

export const NUMBER_FACTS = new Set(["rent", "months", "deposit_months"]);
export const DATE_FACTS = new Set(["handover"]);

export function factInputType(key: string): "number" | "date" | "text" {
  if (NUMBER_FACTS.has(key)) return "number";
  if (DATE_FACTS.has(key)) return "date";
  return "text";
}

/** A fact value as the tenant reads it: dates as dd.mm.yyyy, numbers with the Estonian separators, the rest verbatim. */
export function factText(key: string | undefined, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key && DATE_FACTS.has(key) && typeof value === "string") return fmtDay(value);
  if (typeof value === "number") return fmtNum(value);
  if (typeof value === "string" && NUMBER_FACTS.has(key ?? "") && value.trim() !== "" && !Number.isNaN(Number(value))) return fmtNum(Number(value));
  return String(value);
}

export function kindLabel(kind: string | undefined): string | null {
  switch (kind) {
    case "proposal": return t("portal.lease.kind.proposal");
    case "accept": return t("portal.lease.kind.accept");
    case "decline": return t("portal.lease.kind.decline");
    case "explain": return t("portal.lease.kind.explain");
    case "ok": return t("portal.lease.kind.ok");
    default: return null;
  }
}

/** The thread of a clause (the backend keeps one per clause; the newest wins if there were ever more). */
export function threadOf(lease: PortalLease, clauseId: string | null): LeaseThread | null {
  if (!clauseId) return null;
  const xs = lease.threads.filter((th) => th.clause_id === clauseId);
  return xs.length ? xs[xs.length - 1] : null;
}

export function clauseTitle(number: string | null, heading: string | null): string {
  const n = number ? `p ${number}` : "";
  return [n, heading].filter(Boolean).join(" · ");
}

export type ThreadGroup = "mine" | "unsent" | "waiting" | "resolved";

/** A draft: the thread itself is unsent, or the tenant's last message (reply, decline) has no round yet — it goes with the next letter. */
export function isUnsent(th: LeaseThread): boolean {
  if (th.unsent) return true;
  const last = th.messages[th.messages.length - 1];
  return !!last && last.author_type === "client" && (last.meta?.round_nr === null || last.meta?.round_nr === undefined);
}

export function groupOf(th: LeaseThread): ThreadGroup {
  if (th.status === "resolved") return "resolved";
  if (isUnsent(th)) return "unsent";
  if (th.whose_turn === "client") return "mine";
  return "waiting";
}

/** The one-line note under the last message (demo v713/v714): never a status block. */
export function threadNote(th: LeaseThread): { text: string; tone: "wait" | "me" | "done" } | null {
  if (th.status === "resolved") return th.resolution_label ? { text: th.resolution_label, tone: "done" } : null;
  if (isUnsent(th)) return { text: t("portal.lease.note.unsent"), tone: "wait" };
  if (th.whose_turn === "client") return { text: t("portal.lease.note.yourDecision"), tone: "me" };
  return { text: t("portal.lease.note.waitingLandlord"), tone: "wait" };
}
