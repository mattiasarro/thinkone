"use client";
import { t } from "@/i18n";
import type { SourceDocument } from "@/types/api";

export type Provenance = Record<string, unknown> | null | undefined;

/** Picks the source document a provenance record points at: explicit id, else the original import file. */
export function anchorDoc(prov: Provenance, docs: SourceDocument[]): SourceDocument | undefined {
  const id = prov?.source_document_id;
  return (typeof id === "string" && docs.find((d) => d.id === id)) || docs.find((d) => d.role === "original") || docs[0];
}

/** "lk N" pill linking into the signed source document (PDF viewers honour #page=N). Nothing when there is no page anchor. */
export function ProvenanceAnchor({ prov, docs, className }: { prov: Provenance; docs: SourceDocument[]; className?: string }) {
  const page = prov?.page;
  if (typeof page !== "number" || page <= 0) return null;
  const doc = anchorDoc(prov, docs);
  const label = t("contract.page", { n: page });
  const title = doc ? `${t("contract.provenance")}: ${doc.filename}, ${label}` : t("contract.provenance");
  const cls = `pill flex-none ${className ?? ""}`;
  if (!doc?.url) return <span className={cls} title={title}>{label}</span>;
  const pdf = doc.content_type?.includes("pdf") || doc.filename.toLowerCase().endsWith(".pdf");
  return <a href={pdf ? `${doc.url}#page=${page}` : doc.url} target="_blank" rel="noopener" className={`${cls} hover:bg-primary-subtle`} title={title}>{label}</a>;
}
