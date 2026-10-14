import { Card } from "@/components/ui/Card";
import { IconCheck, IconClock, IconEdit } from "@/components/ui/Icons";
import { t } from "@/i18n";
import { cx } from "@/lib/format";
import type { PortalQuote } from "@/types/portal";

const CLOSED = new Set(["accepted", "converted", "rejected", "cancelled", "expired"]);

/** The icon box background alone carries the state (demo v781/v782): amber = Teie kord, grey = waiting, green = closed. */
export function StatusBox({ q, onGoToDecision }: { q: PortalQuote; onGoToDecision: () => void }) {
  const mine = q.whose_turn === "client";
  const done = CLOSED.has(q.status);
  const cta = mine && q.can_respond;
  return (
    <Card pad className={cx("portal-hero", cta && "has-cta")}>
      <span className={cx("portal-hero-ic", mine ? "client" : done ? "done" : undefined)} aria-hidden="true">
        {mine ? <IconEdit /> : done ? <IconCheck /> : <IconClock />}
      </span>
      <div className="min-w-0">
        <div className="portal-hero-t">{q.step_title}</div>
        {q.step_text && <div className="portal-hero-s">{q.step_text}</div>}
      </div>
      {cta && (
        <button type="button" className="btn btn-primary portal-hero-cta" onClick={onGoToDecision}>{t("portal.goToDecision")}</button>
      )}
    </Card>
  );
}
