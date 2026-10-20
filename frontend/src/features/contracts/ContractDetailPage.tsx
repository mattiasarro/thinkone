"use client";
import { useCallback, useState, type ReactNode } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { useAudit, useContract, useDeleteAllocation, useDeleteKeyDate, useReopenKeyDate, useResolveKeyDate, useUpdateContract } from "@/lib/queries/portfolio";
import { api, errorMessage } from "@/lib/api";
import { Card, CardHeader, CardBody, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconChevronLeft, IconEdit, IconExternal, IconPlus, IconTrash, IconDownload, IconCheck, IconX, IconArrowLeft } from "@/components/ui/Icons";
import { cx, fmtDate, fmtDateTime, valueToString } from "@/lib/format";
import { KeyDateDialog } from "@/features/keydates/KeyDateDialog";
import { KeyDateStatusText, isHistory, isOpen } from "@/features/keydates/KeyDateStatus";
import { IndexationCard } from "./IndexationCard";
import { ClauseTree } from "./ClauseTree";
import { ProvenanceAnchor, SourceViewerContext } from "./ProvenanceAnchor";
import { SourceViewer } from "./SourceViewer";
import { AmendmentDialog } from "./AmendmentDialog";
import { AttachmentsList } from "./AttachmentsList";
import { AllocationDialog } from "./AllocationDialog";
import { PartiesCard } from "./PartiesCard";
import { LeaseDraftPage } from "@/features/leases/LeaseDraftPage";
import type { Allocation, ContractDetail, ContractFact, KeyDate, SourceDocument } from "@/types/api";

export function ContractDetailPage({ id }: { id: string }) {
  const q = useContract(id);
  if (q.isLoading) return <Loading rows={6} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  // platform drafts on the lease engine: üürileping and tööleping (backend GET /leases/{id} accepts both type codes)
  if (q.data.origin === "platform" && (q.data.type_code === "lease" || q.data.type_code === "employment")) return <LeaseDraftPage id={id} />;
  return <Detail c={q.data} />;
}

function Detail({ c }: { c: ContractDetail }) {
  const imported = c.origin === "imported";
  const [kdDialog, setKdDialog] = useState<{ open: boolean; item?: KeyDate | null }>({ open: false });
  const [kdDel, setKdDel] = useState<KeyDate | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocDel, setAllocDel] = useState<Allocation | null>(null);
  const [amend, setAmend] = useState(false);
  const [src, setSrc] = useState<{ docId: string; page: number } | null>(null);
  const openSource = useCallback((docId: string, page: number) => setSrc({ docId, page }), []);
  const [notesOpen, setNotesOpen] = useState(false);
  const [pastOpen, setPastOpen] = useState(false);
  const [notes, setNotes] = useState(c.notes ?? "");
  const delKd = useDeleteKeyDate();
  const delAlloc = useDeleteAllocation(c.id);
  const update = useUpdateContract(c.id);
  const audit = useAudit("contract", c.id);
  const toast = useToast();

  const onDeleteKd = async () => { if (!kdDel) return; try { await delKd.mutateAsync(kdDel.id); toast.success(t("keyDates.deleted")); setKdDel(null); } catch (e) { toast.error(errorMessage(e)); } };
  const onDeleteAlloc = async () => { if (!allocDel) return; try { await delAlloc.mutateAsync(allocDel.id); toast.success(t("contract.allocationRemoved")); setAllocDel(null); } catch (e) { toast.error(errorMessage(e)); } };
  const saveNotes = async () => { try { await update.mutateAsync({ notes }); toast.success(t("contract.updated")); setNotesOpen(false); } catch (e) { toast.error(errorMessage(e)); } };
  const exportAudit = async () => {
    try {
      const r = await api.get<{ url?: string; download_url?: string } | string>("/audit/export", { contract_id: c.id });
      const url = typeof r === "string" ? null : (r.url ?? r.download_url);
      if (url) window.open(url, "_blank", "noopener"); else window.open(`/api/v1/audit/export?contract_id=${c.id}`, "_blank", "noopener");
      toast.info(t("contract.exportStarted"));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  // current versions only; superseded fact versions stay in the data (and the audit trail) but not in the grid
  const allFacts: ContractFact[] = c.facts?.length ? c.facts : Object.entries(c.current_values ?? {}).map(([key, value]) => ({ key, value: value as string | number | null, valid_from: null, reason: null }));
  const facts = allFacts.filter((f) => !f.valid_to);
  const versions = new Map<string, ContractFact[]>();
  for (const f of allFacts) versions.set(f.key, [...(versions.get(f.key) ?? []), f]);
  for (const [k, vs] of versions) versions.set(k, [...vs].sort((a, b) => (a.valid_from ?? "").localeCompare(b.valid_from ?? "") || (a.recorded_at ?? "").localeCompare(b.recorded_at ?? "")));
  const rentHistory = RENT_KEYS.map((k) => versions.get(k)).find((vs) => vs && vs.length > 1);
  const factSub = (f: ContractFact) => {
    const vs = versions.get(f.key) ?? [];
    const idx = vs.filter((v) => v.reason === "indexation").length;
    return [
      f.reason === "indexation" ? null : f.text,
      f.reason === "amendment" ? t("contract.amendedFact", { date: fmtDate(f.valid_from) }) : f.reason === "indexation" ? t("contract.indexedFact", { date: fmtDate(f.valid_from) }) : f.valid_from ? t("contract.validFrom", { date: fmtDate(f.valid_from) }) : null,
      vs.length > 1 ? t("contract.originalValue", { value: valueToString(vs[0].value) }) : null,
      idx > 1 ? t("contract.indexCount", { n: idx }) : null,
    ].filter(Boolean).join(" · ");
  };
  // key dates: open tasks first, then what is coming; history (happened, lapsed, resolved) folded away
  const byDue = [...c.key_dates].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const kdMain = [...byDue.filter(isOpen), ...byDue.filter((k) => !isOpen(k) && !isHistory(k))];
  const kdPast = byDue.filter(isHistory);

  return (
    <SourceViewerContext.Provider value={openSource}>
    <div className="grid gap-5">
      <LinkButton href="/app/portfell?tab=lepingud" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("portfolio.tabs.contracts")}</LinkButton>
      <PageHead
        title={<span className="flex items-center gap-3 flex-wrap"><span className="font-mono text-base text-muted font-medium">{c.number ?? "—"}</span>{c.title}</span>}
        sub={
          <span className="flex flex-wrap items-center gap-2 mt-2">
            <Pill tone={statusTone(c.status)}>{tEnum("contract.status", c.status)}</Pill>
            {c.category && <span className="pill">{tEnum("contract.category", c.category)}</span>}
            {imported && <Pill tone="info" title={t("contract.importedNote")}>{t("contract.importedNote")}</Pill>}
            {c.party && <Link href={`/app/portfell/osapool/${c.party.id}`} className="text-primary font-semibold text-sm">{c.party.name}</Link>}
          </span>
        }
        actions={<><Button onClick={() => setAmend(true)}><IconEdit width={16} height={16} />{t("contract.registerAmendment")}</Button><Button variant="text" onClick={exportAudit}><IconDownload width={16} height={16} />{t("contract.exportAudit")}</Button></>}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start">
        <div className="grid gap-5 min-w-0">
          <Card>
            <CardHeader title={t("contract.keyFacts")} />
            <CardBody>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                <Fact label={t("contract.startDate")} value={fmtDate(c.start_date)} />
                <Fact label={t("contract.endDate")} value={fmtDate(c.end_date)} />
                <Fact label={t("contract.signedAt")} value={fmtDate(c.signed_at)} />
                {facts.map((f) => (
                  <Fact key={f.id ?? f.key} label={f.label ?? f.key} value={`${valueToString(f.value)}${f.unit ? ` ${f.unit}` : ""}`}
                        sub={factSub(f)}
                        anchor={imported ? <ProvenanceAnchor prov={f.provenance} docs={c.source_documents} /> : null} />
                ))}
                {facts.length === 0 && <p className="text-sm text-muted col-span-full">{t("contract.noFacts")}</p>}
              </div>
              {rentHistory && (
                <details className="mt-3">
                  <summary className="text-xs font-semibold text-muted cursor-pointer hover:text-primary">{t("contract.rentHistory")} · {rentHistory.length}</summary>
                  <ol className="mt-2 grid gap-1 text-sm">
                    {[...rentHistory].reverse().map((v) => (
                      <li key={v.id ?? v.valid_from} className="flex items-center gap-3">
                        <span className="font-mono text-xs text-muted w-24 flex-none">{fmtDate(v.valid_from)}</span>
                        <span className="font-semibold tabular-nums">{valueToString(v.value)}{v.unit ? ` ${v.unit}` : ""}</span>
                        <span className="text-xs text-muted">{tEnum("contract.factReason", v.reason)}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("contract.clauses")} overline={imported ? t("contract.importedNote") : undefined} />
            <CardBody>
              {c.clauses.length === 0 ? <p className="text-sm text-muted">{t("contract.noClauses")}</p> : <ClauseTree clauses={c.clauses} imported={imported} docs={c.source_documents} />}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("contract.audit")} />
            <CardBody>
              {audit.isLoading ? <Loading /> : audit.error ? <ErrorState error={audit.error} /> : (audit.data ?? []).length === 0 ? <p className="text-sm text-muted">{t("contract.noAudit")}</p> : (
                <ol className="grid gap-2">
                  {(audit.data ?? []).map((ev, i) => (
                    <li key={ev.id ?? i} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs text-muted w-32 flex-none pt-0.5">{fmtDateTime(ev.ts ?? ev.occurred_at ?? ev.created_at)}</span>
                      <span className="min-w-0">
                        <span className="font-medium">{ev.action ?? ev.event_type ?? ev.kind ?? "—"}</span>
                        <span className="text-muted"> · {ev.actor_name ?? ev.actor ?? ev.actor_type ?? "—"}</span>
                        {ev.reason && <span className="block text-xs text-muted">{ev.reason}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-5 min-w-0">
          <IndexationCard contractId={c.id} />
          <PartiesCard c={c} />

          <Card>
            <CardHeader title={t("contract.keyDates")} actions={<Button size="sm" onClick={() => setKdDialog({ open: true, item: null })}><IconPlus width={14} height={14} />{t("common.add")}</Button>} />
            {c.key_dates.length === 0 ? <EmptyState title={t("contract.noKeyDates")} /> : (
              <>
                <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
                  {kdMain.map((k) => <KdRow key={k.id} k={k} c={c} onEdit={() => setKdDialog({ open: true, item: k })} onDelete={() => setKdDel(k)} />)}
                </ul>
                {kdPast.length > 0 && (
                  <>
                    <button type="button" className="w-full text-left text-xs font-semibold text-muted px-[var(--card-padding)] py-2.5 border-t hover:text-primary" style={{ borderColor: "var(--line)" }}
                            aria-expanded={pastOpen} onClick={() => setPastOpen(!pastOpen)}>
                      {pastOpen ? t("keyDates.hidePast") : t("keyDates.showPast", { n: kdPast.length })}
                    </button>
                    {pastOpen && (
                      <ul className="divide-y border-t" style={{ borderColor: "var(--line)" }}>
                        {kdPast.map((k) => <KdRow key={k.id} k={k} c={c} muted onEdit={() => setKdDialog({ open: true, item: k })} onDelete={() => setKdDel(k)} />)}
                      </ul>
                    )}
                  </>
                )}
              </>
            )}
          </Card>

          <Card>
            <CardHeader title={t("contract.allocations")} actions={<Button size="sm" onClick={() => setAllocOpen(true)}><IconPlus width={14} height={14} />{t("contract.addAllocation")}</Button>} />
            <CardBody>
              {c.allocations.length === 0 ? <p className="text-sm text-muted">{t("contract.noAllocations")}</p> : (
                <ul className="grid gap-2">
                  {c.allocations.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      {a.asset ? <Link href={a.asset.type_code === "space" ? `/app/portfell/pind/${a.asset.id}` : a.asset.type_code === "parking_spot" && a.asset.parent_id ? `/app/portfell/objekt/${a.asset.parent_id}/parkimine` : `/app/portfell/objekt/${a.asset.id}`} className="text-primary font-semibold truncate">{a.asset.name}</Link> : "—"}
                      <span className="pill ml-auto">{tEnum("contract.allocationKind", a.kind)}</span>
                      <button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.remove")} onClick={() => setAllocDel(a)}><IconTrash width={14} height={14} /></button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("contract.sourceDocuments")} />
            <CardBody>
              {c.source_documents.length === 0 ? <p className="text-sm text-muted">{t("contract.noSources")}</p> : <ul className="grid gap-3">{c.source_documents.map((d) => <SourceDoc key={d.id} d={d} />)}</ul>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("contract.attachments")} />
            <CardBody><AttachmentsList items={c.attachments} subjectType="contract" subjectId={c.id} role="annex" compact /></CardBody>
          </Card>

          <Card>
            <CardHeader title={t("contract.notes")} actions={!notesOpen && <Button size="sm" variant="text" onClick={() => setNotesOpen(true)}><IconEdit width={14} height={14} />{t("common.edit")}</Button>} />
            <CardBody>
              {notesOpen ? (
                <div>
                  <textarea className="fld" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label={t("contract.notes")} />
                  <div className="flex gap-2 justify-end mt-2"><Button size="sm" onClick={() => { setNotesOpen(false); setNotes(c.notes ?? ""); }}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={update.isPending} onClick={saveNotes}>{t("common.save")}</Button></div>
                </div>
              ) : <p className="text-sm whitespace-pre-wrap">{c.notes || <span className="text-muted">{t("contract.noNotes")}</span>}</p>}
            </CardBody>
          </Card>
        </div>
      </div>

      <KeyDateDialog open={kdDialog.open} onClose={() => setKdDialog({ open: false })} initial={kdDialog.item} contractId={c.id} lockContract />
      <ConfirmDialog open={!!kdDel} onClose={() => setKdDel(null)} onConfirm={onDeleteKd} busy={delKd.isPending} title={t("common.delete")} body={kdDel ? t("keyDates.deleteConfirm", { title: kdDel.title }) : null} />
      <AllocationDialog open={allocOpen} onClose={() => setAllocOpen(false)} c={c} />
      <ConfirmDialog open={!!allocDel} onClose={() => setAllocDel(null)} onConfirm={onDeleteAlloc} busy={delAlloc.isPending} title={t("common.remove")} body={allocDel ? t("contract.allocationRemoveConfirm", { name: allocDel.asset?.name ?? "" }) : null} />
      <AmendmentDialog open={amend} onClose={() => setAmend(false)} contractId={c.id} facts={allFacts} endDate={c.end_date} />
      <SourceViewer contractId={c.id} docId={src?.docId ?? null} page={src?.page ?? null} onClose={() => setSrc(null)} />
    </div>
    </SourceViewerContext.Provider>
  );
}

const RENT_KEYS = ["rent_monthly", "rent_per_m2", "fee_monthly"];

/** One key date: what it means now (status), and — for a task — what happened (done / skipped, undo). An open indexation is
 *  answered on the indexation card, where the rent changes with it. */
function KdRow({ k, c, muted, onEdit, onDelete }: { k: KeyDate; c: ContractDetail; muted?: boolean; onEdit: () => void; onDelete: () => void }) {
  const resolve = useResolveKeyDate();
  const reopen = useReopenKeyDate();
  const toast = useToast();
  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast.success(msg); } catch (e) { toast.error(errorMessage(e)); } };
  const open = isOpen(k);
  return (
    <li className={cx("flex items-center gap-2 px-[var(--card-padding)] py-2.5", muted && "opacity-75")}>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium truncate">{k.title}</span>
        <span className="block text-xs text-muted">{tEnum("keyDates.kinds", k.kind_code)} · {fmtDate(k.due_date)} · <KeyDateStatusText k={k} />{open && k.kind_code === "indexation" ? ` · ${t("keyDates.confirmOnCard")}` : ""}</span>
      </span>
      {c.origin === "imported" && <ProvenanceAnchor prov={k.provenance} docs={c.source_documents} />}
      {open && k.kind_code !== "indexation" && (
        <>
          <Button size="sm" busy={resolve.isPending} onClick={() => run(() => resolve.mutateAsync({ id: k.id, resolution: "done" }), t("keyDates.resolved"))}><IconCheck width={14} height={14} />{t("keyDates.markDone")}</Button>
          <button type="button" className="icon-btn !w-8 !h-8" title={t("keyDates.markSkipped")} aria-label={t("keyDates.markSkipped")} onClick={() => run(() => resolve.mutateAsync({ id: k.id, resolution: "skipped" }), t("keyDates.resolved"))}><IconX width={14} height={14} /></button>
        </>
      )}
      {k.resolution && (
        <button type="button" className="icon-btn !w-8 !h-8" title={t("keyDates.reopen")} aria-label={t("keyDates.reopen")} disabled={reopen.isPending}
                onClick={() => run(() => reopen.mutateAsync(k.id), t("keyDates.reopened"))}><IconArrowLeft width={14} height={14} /></button>
      )}
      <button type="button" className="icon-btn !w-8 !h-8" aria-label={t("common.edit")} onClick={onEdit}><IconEdit width={14} height={14} /></button>
      <button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.delete")} onClick={onDelete}><IconTrash width={14} height={14} /></button>
    </li>
  );
}

function Fact({ label, value, sub, anchor }: { label: string; value: string; sub?: string; anchor?: ReactNode }) {
  return (
    <div className="rounded-control p-3 min-w-0" style={{ background: "var(--color-surface-subtle)" }}>
      <div className="flex items-start justify-between gap-2"><div className="text-xs text-muted truncate" title={label}>{label}</div>{anchor}</div>
      <div className="font-semibold text-sm mt-0.5 break-words">{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5 line-clamp-2" title={sub}>{sub}</div>}
    </div>
  );
}

function SourceDoc({ d }: { d: SourceDocument }) {
  const sigs = d.container_signatures ?? [];
  return (
    <li className="text-sm">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-medium">{d.filename}</span>
        {d.url ? <a href={d.url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm"><IconExternal width={14} height={14} />{t("common.open")}</a> : <span className="text-xs text-muted">{d.content_type}</span>}
      </div>
      {sigs.length > 0 && (
        <ul className="mt-1 grid gap-0.5">
          {sigs.map((s, i) => (
            <li key={i} className="text-xs text-muted flex items-center gap-2">
              <Pill tone={s.valid === false ? "error" : "success"}>{t("contract.signatures")}</Pill>
              <span>{s.name ?? s.signer ?? "—"}{s.personal_code ? ` (${s.personal_code})` : ""} · {fmtDateTime(s.signed_at ?? s.time)}</span>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
