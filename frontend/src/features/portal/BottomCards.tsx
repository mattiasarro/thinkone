import { Card } from "@/components/ui/Card";
import { IconBuilding, IconChat, IconLink } from "@/components/ui/Icons";
import { t } from "@/i18n";
import { cx, initials } from "@/lib/format";
import type { PortalQuote } from "@/types/portal";
import { daysLabel, fmtDay } from "./util";

const MONTHS = ["jaan", "veebr", "märts", "apr", "mai", "juuni", "juuli", "aug", "sept", "okt", "nov", "dets"];

/** Tähtajad and Kontakt side by side, same height (demo `.po2-alumine`); stacked under 900px. */
export function BottomCards({ q }: { q: PortalQuote }) {
  const [, m, d] = q.valid_until.split("-");
  const c = q.contact;
  const name = c.company ?? q.party_name;
  return (
    <div className="portal-bottom">
      <Card pad>
        <div className="portal-sek"><h2>{t("portal.deadlines.title")}</h2><span>{t("portal.deadlines.one")}</span></div>
        <div className={cx("portal-tl-r", q.days_left < 0 && "past")}>
          <span className="portal-tl-d"><span>{Number(d)}</span><small>{MONTHS[Number(m) - 1] ?? m}</small></span>
          <span className="min-w-0"><b className="block text-sm font-medium">{t("portal.deadlines.expires")}</b><small className="text-muted text-xs">{t("portal.validUntil", { date: fmtDay(q.valid_until) })} · {t("portal.deadlines.expiresSub")}</small></span>
          <span className="text-muted text-xs whitespace-nowrap">{daysLabel(q.days_left)}</span>
        </div>
      </Card>
      <Card pad>
        <div className="portal-sek"><h2>{t("portal.contact.title")}</h2><span>{t("portal.contact.sub")}</span></div>
        <div className="flex items-center gap-3 mb-3">
          <span className="portal-av">{/* eslint-disable-next-line @next/next/no-img-element -- presigned bucket URL, not a static asset */}
            {c.logo_url ? <img src={c.logo_url} alt={name} /> : initials(name)}</span>
          <span className="min-w-0"><b className="block text-sm">{name}</b><small className="text-muted text-xs">{q.property_name}</small></span>
        </div>
        {c.email && <a className="portal-kr" href={`mailto:${c.email}`}><IconChat /><span><small>{t("portal.contact.email")}</small>{c.email}</span></a>}
        {c.phone && <a className="portal-kr" href={`tel:${c.phone.replace(/\s+/g, "")}`}><IconLink /><span><small>{t("portal.contact.phone")}</small>{c.phone}</span></a>}
        {c.address && <div className="portal-kr"><IconBuilding /><span><small>{t("portal.contact.address")}</small>{c.address}</span></div>}
      </Card>
    </div>
  );
}
