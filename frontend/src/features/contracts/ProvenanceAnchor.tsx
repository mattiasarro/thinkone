"use client";
import { createContext, useContext } from "react";
import { t } from "@/i18n";
import type { SourceDocument } from "@/types/api";

export type Provenance = Record<string, unknown> | null | undefined;

/** Set by the contract page: opens the source viewer at a document + page. */
export const SourceViewerContext = createContext<((docId: string, page: number) => void) | null>(null);

/** Picks the source document a provenance record points at: explicit id, else the original import file. */
export function anchorDoc(prov: Provenance, docs: SourceDocument[]): SourceDocument | undefined {
  const id = prov?.source_document_id;
  return (typeof id === "string" && docs.find((d) => d.id === id)) || docs.find((d) => d.role === "original") || docs[0];
}

/** "lk N" pill: opens the signed original at that page in the in-app viewer. Nothing when there is no page anchor. */
export function ProvenanceAnchor({ prov, docs, className }: { prov: Provenance; docs: SourceDocument[]; className?: string }) {
  const open = useContext(SourceViewerContext);
  const page = prov?.page;
  if (typeof page !== "number" || page <= 0) return null;
  const doc = anchorDoc(prov, docs);
  const label = t("contract.page", { n: page });
  const cls = `pill flex-none ${className ?? ""}`;
  if (!doc || !open) return <span className={cls} title={t("contract.provenance")}>{label}</span>;
  return <button type="button" className={`${cls} hover:bg-primary-subtle`} title={t("contract.openOriginal", { n: page })} onClick={() => open(doc.id, page)}>{label}</button>;
}
