import { Card } from "@/components/ui/Card";
import { Pill, statusTone } from "@/components/ui/Pill";
import { t, tEnum } from "@/i18n";
import { fmtNum } from "@/lib/format";
import type { PortalQuote } from "@/types/portal";
import { daysLabel, fmtDay, validityLeft } from "./util";

const WISHES = [
  { key: "extra", label: "portal.wish.extra", text: "portal.wish.extraText" },
  { key: "parking", label: "portal.wish.parking", text: "portal.wish.parkingText" },
  { key: "change", label: "portal.wish.change", text: "portal.wish.changeText" },
] as const;

export function DocumentCards({ q, onWish }: { q: PortalQuote; onWish: (text: string) => void }) {
  const spaces = q.spaces.map((s) => s.name).join(", ");
  const left = validityLeft(q);
  return (
    <div className="portal-cards">
      <Card className="portal-k">
        <div className="portal-k-pea">
          <span>{t("portal.docKind")} · {t("portal.periodMonths", { n: q.period_months })} · <span className="font-mono">{q.number}</span></span>
          <Pill tone={statusTone(q.status)}>{tEnum("portal.status", q.status)}</Pill>
        </div>
        <div className="portal-k-t">{q.property_name}</div>
        <div className="portal-k-s">{spaces}{q.totals.area_m2 ? ` · ${t("portal.area", { a: fmtNum(q.totals.area_m2) })}` : ""}</div>
        <div className="portal-k-raha">{fmtNum(q.totals.monthly_net)}<small>{t("portal.perMonth")}</small></div>
        {q.totals.vat_taxable && <div className="portal-k-km">{t("portal.withVat", { gross: fmtNum(q.totals.monthly_gross) })}</div>}
        <div className="portal-k-aeg">{t("portal.validUntil", { date: fmtDay(q.valid_until) })} · {daysLabel(q.days_left)}</div>
        <div className="portal-k-edu" aria-hidden="true"><i style={{ width: `${(left * 100).toFixed(1)}%` }} /></div>
        {q.whose_turn === "client" && q.can_respond && (
          <span className="portal-k-samm"><i aria-hidden="true" />{t("portal.nextStep")}</span>
        )}
      </Card>
      <Card className="portal-k wish">
        <div className="portal-k-t">{t("portal.wish.title")}</div>
        <div className="portal-k-s">{t("portal.wish.sub")}</div>
        <div className="portal-chips">
          {WISHES.map((w) => (
            <button key={w.key} type="button" className="portal-chip" onClick={() => onWish(t(w.text))}>{t(w.label)}</button>
          ))}
        </div>
      </Card>
    </div>
  );
}
