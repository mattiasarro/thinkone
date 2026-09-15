"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useCommitImport, useImport, useSaveReview, IMPORT_PENDING } from "@/lib/queries/imports";
import { Card, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, statusTone } from "@/components/ui/Pill";
import { ErrorState, Loading, Spinner } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconCheck, IconAlert } from "@/components/ui/Icons";
import { SourcePane } from "./SourcePane";
import { ProposalEditor } from "./ProposalEditor";
import { LinkSection, type LinkState } from "./LinkSection";
import { loadChecked, saveChecked, uncertainKeys } from "./reviewState";
import type { ImportJobDetail, Proposal } from "@/types/api";

const SUPPORTING = ["maintenance", "management", "insurance", "security"];

export function ImportReviewPage({ id }: { id: string }) {
  const job = useImport(id);
  if (job.isLoading) return <Loading rows={6} />;
  if (job.error || !job.data) return <ErrorState error={job.error} onRetry={() => job.refetch()} />;
  const j = job.data;
  if (IMPORT_PENDING.has(j.status)) {
    return (
      <div className="grid gap-5">
        <Back />
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
  if (j.status === "failed") {
    return (
      <div className="grid gap-5">
        <Back />
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
        <Back />
        <Card className="pad">
          <div className="note info mb-4">{t("imports.alreadyCommitted")}</div>
          {j.committed_contract_id && <LinkButton href={`/app/portfell/leping/${j.committed_contract_id}`} variant="primary">{t("imports.viewContract")}</LinkButton>}
        </Card>
      </div>
    );
  }
  return <Review job={j} />;
}

function Back() {
  return <LinkButton href="/app/portfell/import" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("imports.title")}</LinkButton>;
}

function Review({ job }: { job: ImportJobDetail }) {
  const base = useMemo<Proposal>(() => job.reviewed ?? job.proposal ?? { contract: { title: "", category: "other", counterparty_name: "", summary: "" }, parties: [], parameters: [], key_dates: [], clauses: [] }, [job.reviewed, job.proposal]);
  const [draft, setDraft] = useState<Proposal>(base);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [link, setLink] = useState<LinkState>(() => ({
    company_id: "", asset_id: "", space_id: "", partyMode: "new", party_id: "",
    // supporting agreements (haldus/hooldus/kindlustus/turva) cover a property rather than occupying a space
    allocation_kind: SUPPORTING.includes(base.contract.category) ? "coverage" : "exclusive",
  }));
  const [activePage, setActivePage] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const save = useSaveReview(job.id);
  const commit = useCommitImport(job.id);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => { setChecked(loadChecked(job.id)); }, [job.id]);
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

  const onChange = useCallback((p: Proposal) => { dirty.current = true; setDraft(p); }, []);
  const onCheck = useCallback((key: string, v: boolean) => {
    setChecked((s) => { const n = new Set(s); if (v) n.add(key); else n.delete(key); saveChecked(job.id, n); return n; });
  }, [job.id]);
  const onAnchor = useCallback((page: number | null | undefined) => {
    if (!page) return;
    setActivePage(page);
    document.getElementById(`src-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const unresolved = uncertainKeys(draft).filter((k) => !checked.has(k));
  const canCommit = unresolved.length === 0 && !!draft.contract.title && (link.partyMode === "new" || !!link.party_id);

  const doCommit = async () => {
    try {
      if (dirty.current) await save.mutateAsync(draft);
      const newParty = link.partyMode === "new" ? (draft.parties.find((p) => p.name.toLowerCase() === draft.contract.counterparty_name.toLowerCase()) ?? draft.parties[0] ?? { name: draft.contract.counterparty_name, role: "counterparty", confidence: 1 }) : null;
      const r = await commit.mutateAsync({
        company_id: link.company_id || null, asset_id: link.space_id || link.asset_id || null, allocation_kind: link.asset_id || link.space_id ? link.allocation_kind : null,
        party_id: link.partyMode === "existing" ? link.party_id : null, party: newParty, category: draft.contract.category,
        checked: Array.from(checked),
      });
      toast.success(t("imports.committed"));
      router.push(`/app/portfell/leping/${r.contract_id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="grid gap-5">
      <Back />
      <PageHead title={t("imports.review")} sub={job.source_document?.filename}
        actions={
          <>
            <span className="text-xs text-muted" aria-live="polite">{saveState === "saving" ? t("imports.saving") : saveState === "saved" ? t("imports.savedReview") : saveState === "error" ? t("common.error") : ""}</span>
            <Button variant="primary" onClick={doCommit} disabled={!canCommit} busy={commit.isPending} title={unresolved.length ? t("imports.commitBlocked", { n: unresolved.length }) : undefined}><IconCheck width={16} height={16} />{t("imports.commit")}</Button>
          </>
        } />
      {job.duplicate_of_contract_id && (
        <div className="note warning items-center flex-wrap"><IconAlert width={18} height={18} /><span className="flex-1">{t("imports.duplicate")}</span><Link href={`/app/portfell/leping/${job.duplicate_of_contract_id}`} className="btn btn-ghost btn-sm">{t("imports.duplicateOpen")}</Link></div>
      )}
      {unresolved.length > 0 && <div className="note warning"><IconAlert width={18} height={18} />{t("imports.commitBlocked", { n: unresolved.length })}</div>}
      <div className="grid gap-5 xl:grid-cols-2 items-start">
        <SourcePane job={job} activePage={activePage} />
        <div className="grid gap-5 min-w-0">
          <ProposalEditor draft={draft} onChange={onChange} checked={checked} onCheck={onCheck} onAnchor={onAnchor} />
          <LinkSection draft={draft} state={link} onChange={setLink} />
          <div className="flex justify-end"><Button variant="primary" size="lg" onClick={doCommit} disabled={!canCommit} busy={commit.isPending}><IconCheck width={16} height={16} />{t("imports.commit")}</Button></div>
        </div>
      </div>
    </div>
  );
}
