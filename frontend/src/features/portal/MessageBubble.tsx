import { Pill } from "@/components/ui/Pill";
import { t } from "@/i18n";
import { fmtDateTime, cx } from "@/lib/format";
import type { PortalMessage } from "@/types/portal";
import { isClientMessage } from "./util";

export function MessageBubble({ m, landlord, showVersion }: { m: PortalMessage; landlord: string | null; showVersion?: boolean }) {
  const me = isClientMessage(m.author_type);
  const sys = m.author_type === "system";
  const who = me ? t("portal.decision.you") : sys ? t("app.name") : m.author_name || landlord || t("portal.landlord");
  return (
    <div className={cx("portal-m", me && "me", sys && "sys")}>
      <div className="portal-m-b">{m.body}</div>
      <div className="portal-m-meta">
        <span>{who}</span>
        <span>·</span>
        <time dateTime={m.created_at}>{fmtDateTime(m.created_at)}</time>
        {showVersion && typeof m.meta?.version === "number" && <Pill className="ml-1">{t("portal.decision.version", { n: m.meta.version })}</Pill>}
      </div>
    </div>
  );
}
