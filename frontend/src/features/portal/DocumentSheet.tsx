import { IconDownload, IconExternal } from "@/components/ui/Icons";
import { t } from "@/i18n";
import { fmtDateTime } from "@/lib/format";
import type { PortalQuote } from "@/types/portal";
import { changeValue } from "./util";

/** Attachment pills + PDF above, the latest version's changes when there is more than one, then the A4 sheet in an iframe. */
export function DocumentSheet({ q }: { q: PortalQuote }) {
  const latest = q.versions.length > 1 ? q.versions[q.versions.length - 1] : null;
  return (
    <section aria-label={t("portal.doc.title")}>
      <div className="portal-sek"><h2>{t("portal.doc.title")}</h2><span className="font-mono">{q.number} · V{q.sent_version}</span></div>
      {(q.attachments.length > 0 || q.pdf_url) && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {q.attachments.map((a) => a.url ? (
            <a key={String(a.number)} className="pill" href={a.url} target="_blank" rel="noopener noreferrer">
              {t("portal.doc.attachment", { n: a.number, title: a.title })}<IconExternal width={12} height={12} />
            </a>
          ) : (
            <span key={String(a.number)} className="pill">{t("portal.doc.attachment", { n: a.number, title: a.title })}</span>
          ))}
          {q.pdf_url && (
            <a className="btn btn-ghost btn-sm ml-auto" href={q.pdf_url} target="_blank" rel="noopener noreferrer"><IconDownload />{t("portal.doc.pdf")}</a>
          )}
        </div>
      )}
      {latest && (
        <div className="note info flex-col mb-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <b>{t("portal.doc.updated", { v: q.sent_version })}</b>
            <span className="text-xs opacity-80">{fmtDateTime(latest.created_at)}</span>
          </div>
          {latest.note && <div className="text-sm">{t("portal.doc.versionNote")}: {latest.note}</div>}
          {latest.changes.length > 0 && (
            <div className="portal-changes">
              {latest.changes.map((c, i) => (
                <div key={c.key ?? i}><b>{c.label}:</b> {changeValue(c.before)} → {changeValue(c.after)}</div>
              ))}
            </div>
          )}
        </div>
      )}
      <iframe className="portal-sheet" src={q.document_url} title={t("portal.doc.frame")} loading="lazy" />
    </section>
  );
}
