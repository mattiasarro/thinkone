"use client";
import { useState } from "react";
import { t, tEnum } from "@/i18n";
import { useDeleteKeyDate, useReopenKeyDate, useResolveKeyDate } from "@/lib/queries/portfolio";
import { errorMessage } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/State";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconArrowLeft, IconCheck, IconEdit, IconPlus, IconTrash, IconX } from "@/components/ui/Icons";
import { cx, fmtDate } from "@/lib/format";
import { ProvenanceAnchor } from "@/features/contracts/ProvenanceAnchor";
import { KeyDateDialog } from "./KeyDateDialog";
import { KeyDateStatusText, isHistory, isOpen } from "./KeyDateStatus";
import type { ContractDetail, KeyDate } from "@/types/api";

/** A contract's key dates (the contract page and a signed platform lease): open tasks first, then what is coming; history
 *  (happened, lapsed, resolved) folded away. */
export function ContractKeyDatesCard({ c }: { c: ContractDetail }) {
  const [dialog, setDialog] = useState<{ open: boolean; item?: KeyDate | null }>({ open: false });
  const [del, setDel] = useState<KeyDate | null>(null);
  const [pastOpen, setPastOpen] = useState(false);
  const delKd = useDeleteKeyDate();
  const toast = useToast();
  const onDelete = async () => { if (!del) return; try { await delKd.mutateAsync(del.id); toast.success(t("keyDates.deleted")); setDel(null); } catch (e) { toast.error(errorMessage(e)); } };

  const byDue = [...c.key_dates].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const main = [...byDue.filter(isOpen), ...byDue.filter((k) => !isOpen(k) && !isHistory(k))];
  const past = byDue.filter(isHistory);
  const row = (k: KeyDate, muted?: boolean) => <KdRow key={k.id} k={k} c={c} muted={muted} onEdit={() => setDialog({ open: true, item: k })} onDelete={() => setDel(k)} />;

  return (
    <Card>
      <CardHeader title={t("contract.keyDates")} actions={<Button size="sm" onClick={() => setDialog({ open: true, item: null })}><IconPlus width={14} height={14} />{t("common.add")}</Button>} />
      {c.key_dates.length === 0 ? <EmptyState title={t("contract.noKeyDates")} /> : (
        <>
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>{main.map((k) => row(k))}</ul>
          {past.length > 0 && (
            <>
              <button type="button" className="w-full text-left text-xs font-semibold text-muted px-[var(--card-padding)] py-2.5 border-t hover:text-primary" style={{ borderColor: "var(--line)" }}
                      aria-expanded={pastOpen} onClick={() => setPastOpen(!pastOpen)}>
                {pastOpen ? t("keyDates.hidePast") : t("keyDates.showPast", { n: past.length })}
              </button>
              {pastOpen && <ul className="divide-y border-t" style={{ borderColor: "var(--line)" }}>{past.map((k) => row(k, true))}</ul>}
            </>
          )}
        </>
      )}
      <KeyDateDialog open={dialog.open} onClose={() => setDialog({ open: false })} initial={dialog.item} contractId={c.id} lockContract />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={onDelete} busy={delKd.isPending} title={t("common.delete")} body={del ? t("keyDates.deleteConfirm", { title: del.title }) : null} />
    </Card>
  );
}

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
