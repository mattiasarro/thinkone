"use client";
import { useEffect } from "react";
import { t } from "@/i18n";
import { useSourceView } from "@/lib/queries/portfolio";
import { Modal } from "@/components/ui/Modal";
import { ErrorState, Loading } from "@/components/ui/State";
import { IconExternal } from "@/components/ui/Icons";

/** The signed original at a provenance anchor: the PDF (also the one inside an ASiC-E container) scrolled to the page,
 *  or the extracted text pages scrolled to the page when there is no PDF to embed (DOCX). */
export function SourceViewer({ contractId, docId, page, onClose }: { contractId: string; docId: string | null; page: number | null; onClose: () => void }) {
  const q = useSourceView(contractId, docId);
  const v = q.data;
  const pdf = v?.pdf_url ? `${v.pdf_url}#page=${page ?? 1}` : null;
  useEffect(() => {
    if (!docId || pdf || !v?.text_pages || !page) return;
    const h = setTimeout(() => document.getElementById(`sv-page-${page}`)?.scrollIntoView({ block: "start" }), 30);
    return () => clearTimeout(h);
  }, [docId, pdf, v, page]);
  return (
    <Modal open={!!docId} onClose={onClose} wide title={t("contract.original")} sub={v ? `${v.filename}${page ? ` · ${t("contract.page", { n: page })}` : ""}` : null}>
      <div className="-m-[var(--card-padding)] flex flex-col" style={{ height: "min(78vh, 900px)" }}>
        <div className="flex justify-end px-3 py-2 border-b flex-none" style={{ borderColor: "var(--line)" }}>
          {v?.pdf_url && <a href={pdf ?? v.pdf_url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm"><IconExternal width={14} height={14} />{t("contract.openNewTab")}</a>}
        </div>
        <div className="flex-1 min-h-0 overflow-auto">
          {q.isLoading ? <div className="p-6"><Loading rows={4} /></div> : q.error || !v ? <div className="p-6"><ErrorState error={q.error} onRetry={() => q.refetch()} /></div>
            : pdf ? <iframe key={pdf} src={pdf} title={v.filename} className="w-full h-full border-0" />
            : (v.text_pages ?? []).length > 0 ? (
              <div className="p-5 grid gap-5">
                {(v.text_pages ?? []).map((p) => (
                  <section key={p.page} id={`sv-page-${p.page}`} className={page === p.page ? "rounded-control p-3 -m-3 ring-2 ring-[var(--color-primary-ring)]" : undefined}>
                    <div className="overline mb-1">{t("contract.page", { n: p.page })}</div>
                    <pre className="whitespace-pre-wrap font-ui text-sm leading-6">{p.text}</pre>
                  </section>
                ))}
              </div>
            ) : <p className="p-6 text-sm text-muted">{t("contract.noPreview")}</p>}
        </div>
      </div>
    </Modal>
  );
}
