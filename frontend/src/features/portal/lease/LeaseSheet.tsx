"use client";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconDownload } from "@/components/ui/Icons";
import { t } from "@/i18n";
import type { PortalLease } from "@/types/portal";
import { LeaseVersionNote } from "./LeaseDocCard";

export type SelectSource = "doc" | "pane" | null;

interface Props {
  lease: PortalLease;
  selected: string | null;
  /** who last changed the selection — the sheet only echoes pane-made selections back into the iframe */
  source: SelectSource;
  onDocSelect: (clauseId: string) => void;
}

type DocMessage = { source?: string; type?: string; clauseId?: string | null };

/** The A4 sheet in an iframe — the tenant's only document view (demo v526). Clicks inside select a clause here; open/resolved threads are marked in the sheet. */
export const LeaseSheet = forwardRef<HTMLElement, Props>(function LeaseSheet({ lease, selected, source, onDocSelect }, ref) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(0);
  const frameKey = `${lease.sent_version}-${lease.rounds.length}`;

  const post = useCallback((msg: Record<string, unknown>) => {
    frame.current?.contentWindow?.postMessage({ source: "thinkone-host", ...msg }, "*");
  }, []);

  useEffect(() => {
    const onMessage = (ev: MessageEvent<DocMessage>) => {
      const d = ev.data;
      if (!d || d.source !== "thinkone-doc" || ev.source !== frame.current?.contentWindow) return;
      if (d.type === "ready") setReady((n) => n + 1);
      else if (d.type === "clause" && d.clauseId) onDocSelect(d.clauseId);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onDocSelect]);

  const marks = useMemo(() => {
    const open = lease.threads.filter((th) => th.status !== "resolved").map((th) => th.clause_id);
    const done = lease.threads.filter((th) => th.status === "resolved").map((th) => th.clause_id);
    return { open, done };
  }, [lease.threads]);
  const marksKey = `${marks.open.join(",")}|${marks.done.join(",")}`;

  // after (re)load: marks + the current selection; afterwards whenever threads change
  useEffect(() => {
    if (!ready) return;
    post({ type: "marks", open: marks.open, done: marks.done });
    post({ type: "select", clauseId: selected });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selection is echoed separately below; here only on load/marks change
  }, [ready, marksKey, post]);

  useEffect(() => {
    if (!ready || source === "doc") return;
    post({ type: "select", clauseId: selected });
  }, [ready, selected, source, post]);

  return (
    <section ref={ref} className="pl-sheet portal-lease-sheet" aria-label={t("portal.lease.docTitle")}>
      <div className="portal-sek"><h2>{t("portal.doc.title")}</h2><span className="font-mono">{lease.number} · V{lease.sent_version}</span></div>
      {lease.pdf_url && (
        <div className="flex mb-3">
          <a className="btn btn-ghost btn-sm ml-auto" href={lease.pdf_url} target="_blank" rel="noopener noreferrer"><IconDownload />{t("portal.doc.pdf")}</a>
        </div>
      )}
      <LeaseVersionNote lease={lease} />
      <iframe key={frameKey} ref={frame} className="portal-sheet portal-sheet-lease" src={lease.document_url} title={t("portal.lease.frame")} />
    </section>
  );
});
