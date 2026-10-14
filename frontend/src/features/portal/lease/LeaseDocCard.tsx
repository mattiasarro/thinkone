import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { t, tEnum } from "@/i18n";
import { fmtDateTime, fmtNum } from "@/lib/format";
import type { LeaseChange, PortalLease } from "@/types/portal";
import { changeValue, fmtDay } from "../util";
import { leaseStatusTone } from "./util";

/** The lease as a document card (same shell as the quote card): kind · number · status, property, spaces, rent, period, deposit. */
export function LeaseDocCard({ lease }: { lease: PortalLease }) {
  const monthly = typeof lease.totals.monthly_net === "number" ? lease.totals.monthly_net : null;
  return (
    <div className="portal-cards">
      <Card className="portal-k">
        <div className="portal-k-pea">
          <span>{t("portal.lease.docKind")} · <span className="font-mono">{lease.number}</span></span>
          <Pill tone={leaseStatusTone(lease.status)}>{tEnum("portal.lease.status", lease.status)}</Pill>
        </div>
        <div className="portal-k-t">{lease.property_name ?? lease.number}</div>
        {lease.space_names.length > 0 && <div className="portal-k-s">{lease.space_names.join(", ")}</div>}
        {monthly !== null && <div className="portal-k-raha">{fmtNum(monthly)}<small>{t("portal.perMonth")}</small></div>}
        <div className="portal-k-aeg">{t("portal.lease.period", { from: fmtDay(lease.handover), to: fmtDay(lease.end), months: lease.months })}</div>
        {lease.deposit > 0 && <div className="portal-k-km">{t("portal.lease.deposit", { amount: fmtNum(lease.deposit) })}</div>}
        {lease.turn === "client" && (
          <span className="portal-k-samm"><i aria-hidden="true" />{t("portal.lease.nextStep")}</span>
        )}
      </Card>
    </div>
  );
}

/** „Uuendatud · V{n}” — what the landlord's latest letter changed (wording before → after, facts before → after). Only when there is more than one version. */
export function LeaseVersionNote({ lease }: { lease: PortalLease }) {
  const latest = lease.versions.length > 1 ? lease.versions[lease.versions.length - 1] : null;
  if (!latest) return null;
  return (
    <div className="note info flex-col mb-3">
      <div className="flex items-baseline gap-2 flex-wrap">
        <b>{t("portal.lease.updated", { v: latest.number })}</b>
        <span className="text-xs opacity-80">{fmtDateTime(latest.created_at)}</span>
      </div>
      {latest.note && <div className="text-sm">{t("portal.doc.versionNote")}: {latest.note}</div>}
      {latest.changes.length > 0 && (
        <div className="portal-changes">
          {latest.changes.map((c, i) => <ChangeLine key={c.key ?? i} c={c} />)}
        </div>
      )}
    </div>
  );
}

function ChangeLine({ c }: { c: LeaseChange }) {
  if (c.kind === "wording") {
    return (
      <div className="portal-lease-wording">
        <b>{c.label}</b>
        <span className="portal-lease-before">{typeof c.before === "string" ? c.before : changeValue(c.before)}</span>
        <span>{typeof c.after === "string" ? c.after : changeValue(c.after)}</span>
      </div>
    );
  }
  if (c.kind === "added") return <div><b>{c.label}:</b> {t("portal.lease.change.added")} — {changeValue(c.after)}</div>;
  if (c.kind === "removed") return <div><b>{c.label}:</b> {t("portal.lease.change.removed")} — <span className="portal-lease-before">{changeValue(c.before)}</span></div>;
  return <div><b>{c.label}:</b> {changeValue(c.before)} → {changeValue(c.after)}</div>;
}
