import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { IconBuilding, IconChat, IconLink } from "@/components/ui/Icons";
import { t } from "@/i18n";
import { cx, initials } from "@/lib/format";
import type { PortalContact, PortalQuote } from "@/types/portal";
import { daysLabel, fmtDay } from "./util";

const MONTHS = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];

/** One deadline row: the day block, a title + sub line, and a right-hand note. */
export function DeadlineRow({ date, title, sub, right, past }: { date: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; past?: boolean }) {
  const [, m, d] = date.split("-");
  return (
    <div className={cx("portal-tl-r", past && "past")}>
      <span className="portal-tl-d"><span>{Number(d)}</span><small>{MONTHS[Number(m) - 1] ?? m}</small></span>
      <span className="min-w-0"><b className="block text-sm font-medium">{title}</b>{sub && <small className="text-muted text-xs">{sub}</small>}</span>
      <span className="text-muted text-xs whitespace-nowrap">{right}</span>
    </div>
  );
}

/** The landlord's contact card (logo or initials, company, property, e-mail/phone/address). */
export function ContactCard({ contact, fallbackName, property }: { contact: PortalContact; fallbackName: string; property: string | null }) {
  const c = contact;
  const name = c.company ?? fallbackName;
  return (
    <Card pad>
      <div className="portal-sek"><h2>{t("portal.contact.title")}</h2><span>{t("portal.contact.sub")}</span></div>
      <div className="flex items-center gap-3 mb-3">
        <span className="portal-av">{/* eslint-disable-next-line @next/next/no-img-element -- presigned bucket URL, not a static asset */}
          {c.logo_url ? <img src={c.logo_url} alt={name} /> : initials(name)}</span>
        <span className="min-w-0"><b className="block text-sm">{name}</b>{property && <small className="text-muted text-xs">{property}</small>}</span>
      </div>
      {c.email && <a className="portal-kr" href={`mailto:${c.email}`}><IconChat /><span><small>{t("portal.contact.email")}</small>{c.email}</span></a>}
      {c.phone && <a className="portal-kr" href={`tel:${c.phone.replace(/\s+/g, "")}`}><IconLink /><span><small>{t("portal.contact.phone")}</small>{c.phone}</span></a>}
      {c.address && <div className="portal-kr"><IconBuilding /><span><small>{t("portal.contact.address")}</small>{c.address}</span></div>}
    </Card>
  );
}

/** Tähtajad and Kontakt side by side, same height (demo `.po2-alumine`); stacked under 900px. */
export function BottomCards({ q }: { q: PortalQuote }) {
  return (
    <div className="portal-bottom">
      <Card pad>
        <div className="portal-sek"><h2>{t("portal.deadlines.title")}</h2><span>{t("portal.deadlines.one")}</span></div>
        <DeadlineRow date={q.valid_until} past={q.days_left < 0} title={t("portal.deadlines.expires")} right={daysLabel(q.days_left)}
          sub={<>{t("portal.validUntil", { date: fmtDay(q.valid_until) })} · {t("portal.deadlines.expiresSub")}</>} />
      </Card>
      <ContactCard contact={q.contact} fallbackName={q.party_name} property={q.property_name} />
    </div>
  );
}
