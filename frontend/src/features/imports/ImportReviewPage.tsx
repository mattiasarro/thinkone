"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { markOpened, useCommitImport, useExcludeImport, useImport, useImportBatch, useRestoreImport, useSaveDeskState, useSaveReview, IMPORT_PENDING } from "@/lib/queries/imports";
import { useContracts } from "@/lib/queries/portfolio";
import { Select, Input } from "@/components/ui/Field";
import { Card, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, statusTone } from "@/components/ui/Pill";
import { ErrorState, Loading, Spinner } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconArrowLeft, IconCheck, IconAlert, IconX } from "@/components/ui/Icons";
import { SourcePane } from "./SourcePane";
import { ProposalEditor } from "./ProposalEditor";
import { LinkSection, initialPartyRows, partyRowsValid, syncPartyRows, type LinkState } from "./LinkSection";
import { uncertainKeys } from "./reviewState";
import type { DeskToimik, ImportJobDetail, Proposal } from "@/types/api";

const SUPPORTING = ["maintenance", "management", "insurance", "security"];

export function ImportReviewPage({ id }: { id: string }) {
  const job = useImport(id);
  if (job.isLoading) return <Loading rows={6} />;
  if (job.error || !job.data) return <ErrorState error={job.error} onRetry={() => job.refetch()} />;
  const j = job.data;
  if (IMPORT_PENDING.has(j.status)) {
    return (
      <div className="grid gap-5">
        <Back batchId={j.batch_id} />
        <Card className="pad text-center py-16">
          <div className="mx-auto mb-4 w-fit"><Spinner /></div>
          <h2 className="text-lg">{t("imports.processing")}</h2>
          <p className="text-muted text-sm mt-1">{t("imports.processingSub")}</p>
          <div className="mt-4"><Pill tone={statusTone(j.status)}>{tEnum("imports.status", j.status)}</Pill></div>
          <p className="text-xs text-muted mt-3">{j.source_document?.filename}</p>
        </Card>
      </div>
    );
  }
  if (j.status === "excluded") return <Excluded job={j} />;
  if (j.status === "failed") {
    return (
      <div className="grid gap-5">
        <Back batchId={j.batch_id} />
        <Card className="pad">
          <div className="note error mb-4"><IconAlert width={18} height={18} /><span><strong>{t("imports.failed")}</strong>{j.error ? ` — ${j.error}` : ""}</span></div>
          <LinkButton href="/app/portfell/import/manual" variant="primary">{t("imports.manualLink")}</LinkButton>
        </Card>
      </div>
    );
  }
  if (j.status === "committed" || j.status === "manual") {
    return (
      <div className="grid gap-5">
        <Back batchId={j.batch_id} />
        <Card className="pad">
          <div className="note info mb-4">{t("imports.alreadyCommitted")}</div>
          {j.committed_contract_id && <LinkButton href={`/app/portfell/leping/${j.committed_contract_id}`} variant="primary">{t("imports.viewContract")}</LinkButton>}
        </Card>
      </div>
    );
  }
  return <Review job={j} />;
}

function Back({ batchId }: { batchId?: string | null }) {
  return <LinkButton href={batchId ? `/app/portfell/import/p/${batchId}` : "/app/portfell/import"} variant="ghost" size="sm" className="w-fit"><IconArrowLeft width={16} height={16} />{batchId ? t("imports.desk.backImport") : t("imports.title")}</LinkButton>;
}

/** „Ei impordi” — the reason, and the way back (demo: always with a reason). */
function Excluded({ job }: { job: ImportJobDetail }) {
  const restore = useRestoreImport();
  const toast = useToast();
  return (
    <div className="grid gap-5">
      <Back batchId={job.batch_id} />
      <Card className="pad">
        <div className="note mb-4"><IconX width={18} height={18} /><span>{t("imports.desk.excludedNote", { reason: job.excluded_reason ?? t("imports.desk.excludeDefault") })}</span></div>
        <p className="text-xs text-muted mb-4">{job.source_document?.filename}</p>
        <Button onClick={async () => { try { await restore.mutateAsync(job.id); } catch (e) { toast.error(errorMessage(e)); } }} busy={restore.isPending}>{t("imports.desk.restore")}</Button>
      </Card>
    </div>
  );
}

/** Annex or supporting document: which contract it belongs to (demo „vali leping”) — a contract of this import or one in the registry. */
function ParentPicker({ job, toimikud, value, onChange }: { job: ImportJobDetail; toimikud: DeskToimik[]; value: string; onChange: (v: string) => void }) {
  const contracts = useContracts({});
  const imported = (contracts.data ?? []).filter((c) => c.origin === "imported"); // an external annex goes only onto an imported contract
  const inBatch = toimikud.flatMap((x) => [x.row]).filter((r) => r.kind === "contract" && r.id !== job.id && r.state !== "ei" && r.state !== "viga");
  return (
    <Card className="pad grid gap-3">
      <h3 className="text-base">{t("imports.desk.parent")}</h3>
      <Select label={t("imports.desk.parentPick")} value={value} onChange={(e) => onChange(e.target.value)} placeholder={t("imports.desk.parentNone")}>
        {inBatch.length > 0 && <optgroup label={t("imports.desk.parentBatch")}>{inBatch.map((r) => <option key={r.id} value={`job:${r.id}`}>{[r.counterparty || r.title || r.filename, r.spaces.join(" + "), r.number].filter(Boolean).join(" · ")}</option>)}</optgroup>}
        {imported.length > 0 && <optgroup label={t("imports.desk.parentRegistry")}>{imported.map((c) => <option key={c.id} value={`contract:${c.id}`}>{[c.number, c.party?.name || c.title].filter(Boolean).join(" · ")}</option>)}</optgroup>}
      </Select>
    </Card>
  );
}

function Review({ job }: { job: ImportJobDetail }) {
  const base = useMemo<Proposal>(() => job.reviewed ?? job.proposal ?? { contract: { title: "", category: "other", counterparty_name: "", summary: "" }, parties: [], parameters: [], key_dates: [], clauses: [] }, [job.reviewed, job.proposal]);
  const [draft, setDraft] = useState<Proposal>(base);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(job.checked ?? []));
  const [link, setLink] = useState<LinkState>(() => (job.link as unknown as LinkState | null) ?? ({
    company_id: "", asset_id: "", space_ids: [], parties: initialPartyRows(base), parking_numbers: null,
    // supporting agreements (haldus/hooldus/kindlustus/turva) cover a property rather than occupying a space
    allocation_kind: SUPPORTING.includes(base.contract.category) ? "coverage" : "exclusive",
  }));
  const desk = useSaveDeskState(job.id);
  const batch = useImportBatch(job.batch_id ?? undefined);
  const exclude = useExcludeImport();
  const [excluding, setExcluding] = useState<string | null>(null);
  const isChild = job.kind === "annex" || job.kind === "document";
  const deskRow = useMemo(() => batch.data?.toimikud?.flatMap((x) => [x.row, ...x.children]).find((r) => r.id === job.id), [batch.data, job.id]);
  const [parent, setParent] = useState<string>(() => job.parent_job_id ? `job:${job.parent_job_id}` : job.parent_contract_id ? `contract:${job.parent_contract_id}` : "");
  useEffect(() => { if (!parent && deskRow?.parent) setParent(`${deskRow.parent.kind}:${deskRow.parent.id}`); }, [deskRow, parent]);
  useEffect(() => { void markOpened(job.id); }, [job.id]);
  // the link decisions live on the job, so the desk knows the lease has its space (and can confirm it in bulk)
  const linkSaved = useRef(false);
  useEffect(() => {
    if (isChild) return;
    if (!linkSaved.current) { linkSaved.current = true; if (!job.link) return; }
    const h = setTimeout(() => { desk.mutate({ link: link as unknown as Record<string, unknown> }); }, 600);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [link]);
  const pickParent = (v: string) => {
    setParent(v);
    const [kind, id] = v.split(":");
    desk.mutate({ parent_job_id: kind === "job" ? id : null, parent_contract_id: kind === "contract" ? id : null });
  };
  const [activePage, setActivePage] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const save = useSaveReview(job.id);
  const commit = useCommitImport(job.id);
  const toast = useToast();
  const router = useRouter();

  // Debounced PATCH reviewed
  useEffect(() => {
    if (!dirty.current) return;
    setSaveState("saving");
    const h = setTimeout(async () => {
      try { await save.mutateAsync(draft); setSaveState("saved"); } catch { setSaveState("error"); }
    }, 800);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);

  const onChange = useCallback((p: Proposal) => { dirty.current = true; setDraft(p); setLink((l) => { const parties = syncPartyRows(l.parties, p); return parties === l.parties ? l : { ...l, parties }; }); }, []);
  const onCheck = useCallback((key: string, v: boolean) => {
    setChecked((s) => { const n = new Set(s); if (v) n.add(key); else n.delete(key); desk.mutate({ checked: Array.from(n) }); return n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);
  const onAnchor = useCallback((page: number | null | undefined) => {
    if (!page) return;
    setActivePage(page);
    document.getElementById(`src-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const unresolved = uncertainKeys(draft).filter((k) => !checked.has(k));
  // a child confirms onto its contract: one already in the registry, or — while the contract still waits — together with it
  const parentRow = parent.startsWith("job:") ? batch.data?.toimikud?.find((x) => x.row.id === parent.slice(4))?.row : undefined;
  const childWaits = isChild && !!parentRow && parentRow.state !== "kinnitatud";
  const canCommit = unresolved.length === 0 && !!draft.contract.title && (isChild ? !!parent && !childWaits : partyRowsValid(link.parties));

  const doCommit = async () => {
    try {
      if (dirty.current) await save.mutateAsync(draft);
      const r = await commit.mutateAsync({
        company_id: link.company_id || null, asset_ids: link.space_ids.length ? link.space_ids : link.asset_id ? [link.asset_id] : null, allocation_kind: link.asset_id ? link.allocation_kind : null,
        parties: link.parties.filter((x) => x.include).map((x) => ({ index: x.mode === "new" ? x.index : null, party_id: x.mode === "existing" ? x.party_id : null, role: x.role, is_primary: x.is_primary, include: true })),
        category: draft.contract.category,
        checked: Array.from(checked), parking_numbers: link.space_ids.length ? link.parking_numbers : null,
      });
      toast.success(t("imports.committed"));
      // next in this import (demo: straight to the next toimik), else back to the import
      const left = (await batch.refetch()).data?.toimikud?.filter((x) => (x.state === "ootab" || x.state === "valmis") && x.row.id !== job.id) ?? [];
      const nxt = left.find((x) => x.state === "ootab") ?? left[0];
      router.push(nxt ? `/app/portfell/import/${nxt.row.id}` : job.batch_id ? `/app/portfell/import/p/${job.batch_id}` : `/app/portfell/leping/${r.contract_id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="grid gap-5">
      <Back batchId={job.batch_id} />
      <PageHead title={t("imports.review")} sub={job.source_document?.filename}
        actions={
          <>
            {excluding === null
              ? <Button variant="text" onClick={() => setExcluding("")}>{t("imports.desk.exclude")}</Button>
              : <span className="flex items-center gap-2"><Input aria-label={t("imports.desk.excludeReason")} placeholder={t("imports.desk.excludeReason")} value={excluding} onChange={(e) => setExcluding(e.target.value)} className="!mb-0 w-48" autoFocus />
                  <Button onClick={async () => { try { await exclude.mutateAsync({ id: job.id, reason: excluding || undefined }); router.push(job.batch_id ? `/app/portfell/import/p/${job.batch_id}` : "/app/portfell/import"); } catch (e) { toast.error(errorMessage(e)); } }} busy={exclude.isPending}>{t("imports.desk.exclude")}</Button>
                  <Button variant="text" onClick={() => setExcluding(null)}>{t("common.cancel")}</Button></span>}
            <span className="text-xs text-muted" aria-live="polite">{saveState === "saving" ? t("imports.saving") : saveState === "saved" ? t("imports.savedReview") : saveState === "error" ? t("common.error") : ""}</span>
            <Button variant="primary" onClick={doCommit} disabled={!canCommit} busy={commit.isPending} title={unresolved.length ? t("imports.commitBlocked", { n: unresolved.length }) : undefined}><IconCheck width={16} height={16} />{isChild ? t("imports.desk.childCommit") : t("imports.commit")}</Button>
          </>
        } />
      {job.duplicate_of_contract_id && (
        <div className="note warning items-center flex-wrap"><IconAlert width={18} height={18} /><span className="flex-1">{t("imports.duplicate")}</span><Link href={`/app/portfell/leping/${job.duplicate_of_contract_id}`} className="btn btn-ghost btn-sm">{t("imports.duplicateOpen")}</Link></div>
      )}
      {unresolved.length > 0 && <div className="note warning"><IconAlert width={18} height={18} />{t("imports.commitBlocked", { n: unresolved.length })}</div>}
      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <SourcePane job={job} activePage={activePage} />
        <div className="grid gap-5 min-w-0 grid-cols-[minmax(0,1fr)]">
          <ProposalEditor draft={draft} onChange={onChange} checked={checked} onCheck={onCheck} onAnchor={onAnchor} />
          {isChild ? <ParentPicker job={job} toimikud={batch.data?.toimikud ?? []} value={parent} onChange={pickParent} /> : <LinkSection draft={draft} state={link} onChange={setLink} />}
          {childWaits && parentRow && <div className="note items-center flex-wrap"><span className="flex-1">{t("imports.desk.childWaits")}</span><Link href={`/app/portfell/import/${parentRow.id}`} className="btn btn-ghost btn-sm">{t("imports.desk.openParent")}</Link></div>}
          <div className="flex justify-end"><Button variant="primary" size="lg" onClick={doCommit} disabled={!canCommit} busy={commit.isPending}><IconCheck width={16} height={16} />{isChild ? t("imports.desk.childCommit") : t("imports.commit")}</Button></div>
        </div>
      </div>
    </div>
  );
}
