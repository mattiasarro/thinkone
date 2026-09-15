"use client";
import { useState } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { useAudit, useContract, useDeleteKeyDate, useUpdateContract } from "@/lib/queries/portfolio";
import { api, errorMessage } from "@/lib/api";
import { Card, CardHeader, CardBody, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconChevronLeft, IconEdit, IconExternal, IconPlus, IconTrash, IconDownload } from "@/components/ui/Icons";
import { fmtDate, fmtDateTime, valueToString, daysUntil } from "@/lib/format";
import { KeyDateDialog } from "@/features/keydates/KeyDateDialog";
import { ClauseTree } from "./ClauseTree";
import { AmendmentDialog } from "./AmendmentDialog";
import { AttachmentsList } from "./AttachmentsList";
import type { ContractDetail, ContractFact, KeyDate, SourceDocument } from "@/types/api";

export function ContractDetailPage({ id }: { id: string }) {
  const q = useContract(id);
  if (q.isLoading) return <Loading rows={6} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <Detail c={q.data} />;
}

function Detail({ c }: { c: ContractDetail }) {
  const imported = c.origin === "imported";
  const [kdDialog, setKdDialog] = useState<{ open: boolean; item?: KeyDate | null }>({ open: false });
  const [kdDel, setKdDel] = useState<KeyDate | null>(null);
  const [amend, setAmend] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(c.notes ?? "");
  const delKd = useDeleteKeyDate();
  const update = useUpdateContract(c.id);
  const audit = useAudit("contract", c.id);
  const toast = useToast();

  const onDeleteKd = async () => { if (!kdDel) return; try { await delKd.mutateAsync(kdDel.id); toast.success(t("keyDates.deleted")); setKdDel(null); } catch (e) { toast.error(errorMessage(e)); } };
  const saveNotes = async () => { try { await update.mutateAsync({ notes }); toast.success(t("contract.updated")); setNotesOpen(false); } catch (e) { toast.error(errorMessage(e)); } };
  const exportAudit = async () => {
    try {
      const r = await api.get<{ url?: string; download_url?: string } | string>("/audit/export", { contract_id: c.id });
      const url = typeof r === "string" ? null : (r.url ?? r.download_url);
      if (url) window.open(url, "_blank", "noopener"); else window.open(`/api/v1/audit/export?contract_id=${c.id}`, "_blank", "noopener");
      toast.info(t("contract.exportStarted"));
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const facts: ContractFact[] = c.facts?.length ? c.facts : Object.entries(c.current_values ?? {}).map(([key, value]) => ({ key, value: value as string | number | null, valid_from: null, reason: null }));

  return (
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
                  <Fact key={f.key} label={f.label ?? f.key} value={`${valueToString(f.value)}${f.unit ? ` ${f.unit}` : ""}`} sub={[f.text, f.valid_from ? t("contract.validFrom", { date: fmtDate(f.valid_from) }) : null].filter(Boolean).join(" · ")} />
                ))}
                {facts.length === 0 && <p className="text-sm text-muted col-span-full">{t("contract.noFacts")}</p>}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t("contract.clauses")} overline={imported ? t("contract.importedNote") : undefined} />
            <CardBody>
              {c.clauses.length === 0 ? <p className="text-sm text-muted">{t("contract.noClauses")}</p> : <ClauseTree clauses={c.clauses} imported={imported} />}
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
          <Card>
            <CardHeader title={t("contract.keyDates")} actions={<Button size="sm" onClick={() => setKdDialog({ open: true, item: null })}><IconPlus width={14} height={14} />{t("common.add")}</Button>} />
            {c.key_dates.length === 0 ? <EmptyState title={t("contract.noKeyDates")} /> : (
              <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
                {[...c.key_dates].sort((a, b) => a.due_date.localeCompare(b.due_date)).map((k) => {
                  const n = daysUntil(k.due_date);
                  return (
                    <li key={k.id} className="flex items-center gap-2 px-[var(--card-padding)] py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">{k.title}</span>
                        <span className="block text-xs text-muted">{tEnum("keyDates.kinds", k.kind_code)} · {fmtDate(k.due_date)} · <span className={n < 0 ? "text-error" : n <= 30 ? "text-warning" : ""}>{n < 0 ? t("home.overdue") : t("home.inDays", { n })}</span></span>
                      </span>
                      <button type="button" className="icon-btn !w-8 !h-8" aria-label={t("common.edit")} onClick={() => setKdDialog({ open: true, item: k })}><IconEdit width={14} height={14} /></button>
                      <button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.delete")} onClick={() => setKdDel(k)}><IconTrash width={14} height={14} /></button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title={t("contract.allocations")} />
            <CardBody>
              {c.allocations.length === 0 ? <p className="text-sm text-muted">{t("contract.noAllocations")}</p> : (
                <ul className="grid gap-2">
                  {c.allocations.map((a) => (
                    <li key={a.id} className="flex items-center gap-2 text-sm">
                      {a.asset ? <Link href={`/app/portfell/objekt/${a.asset.id}`} className="text-primary font-semibold truncate">{a.asset.name}</Link> : "—"}
                      <span className="pill ml-auto">{tEnum("contract.allocationKind", a.kind)}</span>
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
      <AmendmentDialog open={amend} onClose={() => setAmend(false)} contractId={c.id} />
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-control p-3 min-w-0" style={{ background: "var(--color-surface-subtle)" }}>
      <div className="text-xs text-muted truncate" title={label}>{label}</div>
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
