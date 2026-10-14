import { Card } from "@/components/ui/Card";
import { t } from "@/i18n";
import type { PortalLease } from "@/types/portal";
import { ContactCard, DeadlineRow } from "../BottomCards";
import { fmtDay } from "../util";

/** Tähtajad (handover, end) and Kontakt — the same bottom row as the quote page. */
export function LeaseBottomCards({ lease }: { lease: PortalLease }) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="portal-bottom pl-bottom">
      <Card pad>
        <div className="portal-sek"><h2>{t("portal.deadlines.title")}</h2><span>{t("portal.lease.deadlines.two")}</span></div>
        <DeadlineRow date={lease.handover} past={lease.handover < today} title={t("portal.lease.deadlines.handover")} sub={t("portal.lease.deadlines.handoverSub")} right={fmtDay(lease.handover)} />
        <DeadlineRow date={lease.end} past={lease.end < today} title={t("portal.lease.deadlines.end")} sub={t("portal.lease.deadlines.endSub", { months: lease.months })} right={fmtDay(lease.end)} />
      </Card>
      <ContactCard contact={lease.contact} fallbackName={lease.landlord_name ?? lease.party_name} property={lease.property_name} />
    </div>
  );
}
