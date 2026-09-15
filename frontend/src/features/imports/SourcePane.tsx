"use client";
import { t } from "@/i18n";
import { Pill } from "@/components/ui/Pill";
import { fmtDateTime } from "@/lib/format";
import { IconExternal } from "@/components/ui/Icons";
import type { ImportJobDetail } from "@/types/api";

export function SourcePane({ job, activePage }: { job: ImportJobDetail; activePage?: number | null }) {
  const doc = job.source_document;
  const isPdf = doc?.format === "pdf" && !!job.source_url;
  const sigs = doc?.container_signatures ?? [];
  const pdfUrl = job.source_url ? `${job.source_url}${activePage ? `#page=${activePage}` : ""}` : null;
  return (
    <div className="card flex flex-col xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] min-h-[420px]">
      <div className="card-h">
        <div className="min-w-0"><div className="overline">{t("imports.source")}</div><h3 className="truncate">{doc?.filename ?? "—"}</h3></div>
        {job.source_url && <a href={job.source_url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm"><IconExternal width={14} height={14} />{t("imports.openSource")}</a>}
      </div>
      {sigs.length > 0 && (
        <div className="px-[var(--card-padding)] py-2 border-b text-xs flex flex-wrap gap-2 items-center" style={{ borderColor: "var(--line)" }}>
          <span className="text-muted">{t("imports.signatures")}:</span>
          {sigs.map((s, i) => <Pill key={i} tone={s.valid === false ? "error" : "success"}>{s.name ?? s.signer ?? "—"} · {fmtDateTime(s.signed_at ?? s.time)}</Pill>)}
        </div>
      )}
      {doc?.has_text_layer === false && <div className="note warning m-4">{t("imports.noTextLayer")}</div>}
      <div className="flex-1 min-h-0 overflow-auto">
        {isPdf && pdfUrl ? (
          <iframe key={activePage ?? 0} src={pdfUrl} title={doc?.filename ?? "PDF"} className="w-full h-[70vh] xl:h-full border-0" />
        ) : (job.text_pages ?? []).length > 0 ? (
          <div className="p-4 grid gap-4">
            {(job.text_pages ?? []).map((p) => (
              <section key={p.page} id={`src-page-${p.page}`} className={activePage === p.page ? "rounded-control p-3 -m-3 ring-2 ring-[var(--color-primary-ring)]" : undefined}>
                <div className="overline mb-1">{t("imports.page", { n: p.page })}</div>
                <pre className="whitespace-pre-wrap font-ui text-sm leading-6">{p.text}</pre>
              </section>
            ))}
          </div>
        ) : <p className="p-6 text-sm text-muted">{t("common.none")}</p>}
      </div>
    </div>
  );
}
