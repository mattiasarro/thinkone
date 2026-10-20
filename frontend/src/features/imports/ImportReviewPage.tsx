"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { markOpened, useCommitImport, useExcludeImport, useImport, useImportBatch, useRestoreImport, useSaveDeskState, useSaveReview, IMPORT_PENDING } from "@/lib/queries/imports";
import { useContracts, useParking } from "@/lib/queries/portfolio";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, statusTone } from "@/components/ui/Pill";
import { ErrorState, Loading, Spinner } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { fmtDate, fmtFixed } from "@/lib/format";
import { IconArrowLeft, IconCheck, IconAlert, IconX, IconChevronLeft, IconChevronRight } from "@/components/ui/Icons";
import { SourceViewer, fileLabel, type SourceFocus } from "./SourceViewer";
import { CalendarCard, ClausesCard, FilesStep, Note, PaneHead, PartiesStep, RemovedNote, Signatures, SpaceStep, Step, ValuesStep, type ReviewCtl } from "./ReviewPane";
import { initialPartyRows, partyRowsValid, syncPartyRows, useLinkDefaults, type LinkState } from "./LinkSection";
import { fmtValue, kdLabel, monthlyOf, needlesFor, num, parkingCheck, spotsOf, termYears, type Spot } from "./reviewModel";
import type { DeskRow, DeskToimik, ImportJobDetail, ImportSourceFile, Proposal } from "@/types/api";

const SUPPORTING = ["maintenance", "management", "insurance", "security"];
const EMPTY: Proposal = { contract: { title: "", category: "other", counterparty_name: "", summary: "" }, parties: [], parameters: [], key_dates: [], clauses: [] };

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

const nextOf = (toimikud: DeskToimik[], rootId: string | undefined) => {
  const left = toimikud.filter((x) => (x.state === "ootab" || x.state === "valmis") && x.row.id !== rootId);
  return left.find((x) => x.state === "ootab") ?? left[0];
};

function Review({ job }: { job: ImportJobDetail }) {
  const original = useMemo<Proposal>(() => job.proposal ?? job.reviewed ?? EMPTY, [job.proposal, job.reviewed]);
  const base = useMemo<Proposal>(() => job.reviewed ?? job.proposal ?? EMPTY, [job.reviewed, job.proposal]);
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
  const toimikud = useMemo(() => batch.data?.toimikud ?? [], [batch.data]);
  const deskRow = useMemo(() => toimikud.flatMap((x) => [x.row, ...x.children]).find((r) => r.id === job.id), [toimikud, job.id]);
  const toimik = useMemo(() => toimikud.find((x) => x.row.id === job.id || x.children.some((ch) => ch.id === job.id)), [toimikud, job.id]);
  const [parent, setParent] = useState<string>(() => job.parent_job_id ? `job:${job.parent_job_id}` : job.parent_contract_id ? `contract:${job.parent_contract_id}` : "");
  useEffect(() => { if (!parent && deskRow?.parent) setParent(`${deskRow.parent.kind}:${deskRow.parent.id}`); }, [deskRow, parent]);
  useEffect(() => { void markOpened(job.id); }, [job.id]);
  const stableLink = useCallback((s: LinkState) => setLink(s), []);
  const defaults = useLinkDefaults(draft, link, stableLink);
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

  const check = useCallback((key: string, v: boolean) => {
    setChecked((s) => { const n = new Set(s); if (v) n.add(key); else n.delete(key); desk.mutate({ checked: Array.from(n) }); return n; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);
  const edit = useCallback((p: Proposal, k?: string) => {
    dirty.current = true; setDraft(p);
    setLink((l) => { const parties = syncPartyRows(l.parties, p); return parties === l.parties ? l : { ...l, parties }; });
    if (k) check(k, true);
  }, [check]);

  // the original: which file, and what to mark on which page
  const files = useMemo<ImportSourceFile[]>(() => job.files?.length ? job.files : job.source_document ? [{ index: 0, name: job.source_document.filename, kind: job.source_document.format === "docx" ? "docx" : job.source_document.format === "pdf" ? "pdf" : "other", main: true, size: null }] : [], [job.files, job.source_document]);
  const mainFile = files.find((f) => f.main)?.index ?? 0;
  const [tab, setTab] = useState(mainFile);
  const [focus, setFocus] = useState<SourceFocus | null>(null);
  const seq = useRef(0);
  const show = useCallback((page: number | null | undefined, needles: string[], file?: number) => {
    const f = file ?? mainFile;
    setTab(f);
    setFocus({ file: f, page: page ?? null, needles: needles.filter(Boolean), seq: ++seq.current });
  }, [mainFile]);

  // the places to look at — one active at a time (demo: the active one is open in the original)
  const isLease = draft.contract.category === "lease";
  const needSpace = !isChild && isLease && defaults.properties.length > 0 && link.space_ids.length === 0;
  // parking: the numbers the contract names, checked against the register (preselected when they all exist)
  const parkingReg = useParking(!isChild && isLease && link.space_ids.length ? link.asset_id || undefined : undefined);
  const park = useMemo(() => (!isChild && isLease ? parkingCheck(draft, parkingReg.data ?? [], link.space_ids) : null), [draft, parkingReg.data, link.space_ids, isChild, isLease]);
  useEffect(() => {
    if (park && link.parking_numbers === null && park.register.length && !park.missing.length) setLink((l) => (l.parking_numbers === null ? { ...l, parking_numbers: park.register } : l));
  }, [park, link.parking_numbers]);
  const parkSpot = useMemo<Spot | null>(() => park?.issue && !checked.has("parking")
    ? { key: "parking", step: 2, kind: "parking", idx: -1, label: t("imports.ir.parkLabel"), value: "", note: park.issue, page: park.page, needles: park.needles } : null, [park, checked]);
  const spots = useMemo(() => spotsOf(draft, checked, needSpace, parkSpot), [draft, checked, needSpace, parkSpot]);
  const [active, setActive] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const cur = spots.find((s) => s.key === active) ?? null;
  const activate = useCallback((key: string) => {
    setActive(key); setEditing(null);
    const s = spots.find((x) => x.key === key);
    if (s && s.needles.length) show(s.page, s.needles);
  }, [spots, show]);
  // keep one place active: after „Õige” the next one opens in the original
  useEffect(() => {
    if (active?.startsWith("show:")) return;
    if (spots.length && !spots.some((s) => s.key === active)) {
      const nxt = spots[0];
      setActive(nxt.key);
      if (nxt.needles.length) show(nxt.page, nxt.needles);
    }
  }, [spots, active, show]);

  // removing a value shifts the indexes after it: the checks follow (parameter:5 → parameter:4), the removed one's goes
  const [removed, setRemoved] = useState<{ kind: "parameter" | "key_date"; i: number; item: Proposal["parameters"][number] | Proposal["key_dates"][number]; wasChecked: boolean } | null>(null);
  const shiftChecks = useCallback((kind: string, i: number, by: 1 | -1, add?: boolean) => {
    setChecked((s) => {
      const n = new Set<string>();
      s.forEach((k) => {
        const [kk, v] = k.split(":"), j = Number(v);
        if (kk !== kind) n.add(k);
        else if (by < 0) { if (j < i) n.add(k); else if (j > i) n.add(`${kind}:${j - 1}`); }
        else n.add(j < i ? k : `${kind}:${j + 1}`);
      });
      if (add) n.add(`${kind}:${i}`);
      desk.mutate({ checked: Array.from(n) });
      return n;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);
  const remove = useCallback((kind: "parameter" | "key_date", i: number) => {
    const list = kind === "parameter" ? draft.parameters : draft.key_dates;
    if (!list[i]) return;
    setRemoved({ kind, i, item: list[i], wasChecked: checked.has(`${kind}:${i}`) });
    setEditing(null); setActive(null);
    shiftChecks(kind, i, -1);
    dirty.current = true;
    setDraft(kind === "parameter" ? { ...draft, parameters: draft.parameters.filter((_, j) => j !== i) } : { ...draft, key_dates: draft.key_dates.filter((_, j) => j !== i) });
  }, [draft, checked, shiftChecks]);
  const undoRemove = () => {
    if (!removed) return;
    const { kind, i, item, wasChecked } = removed;
    shiftChecks(kind, i, 1, wasChecked);
    dirty.current = true;
    setDraft(kind === "parameter"
      ? { ...draft, parameters: [...draft.parameters.slice(0, i), item as Proposal["parameters"][number], ...draft.parameters.slice(i)] }
      : { ...draft, key_dates: [...draft.key_dates.slice(0, i), item as Proposal["key_dates"][number], ...draft.key_dates.slice(i)] });
    setRemoved(null);
  };

  const ctl: ReviewCtl = { job, draft, original, edit, checked, check, active, activate, editing, setEditing, show, remove };

  // a child confirms onto its contract: one already in the registry, or — while the contract still waits — together with it
  const parentRow = parent.startsWith("job:") ? toimikud.find((x) => x.row.id === parent.slice(4))?.row : undefined;
  const childWaits = isChild && !!parentRow && parentRow.state !== "kinnitatud";
  const unresolved = spots.filter((s) => s.kind !== "space");
  const canCommit = unresolved.length === 0 && !!draft.contract.title && (isChild ? !!parent && !childWaits : partyRowsValid(link.parties) && !needSpace);
  const open = spots.length + (!isChild && !partyRowsValid(link.parties) ? 1 : 0) + (isChild && !parent ? 1 : 0);
  const next = nextOf(toimikud, toimik?.row.id);

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
      const nxt = nextOf((await batch.refetch()).data?.toimikud ?? [], toimik?.row.id ?? job.id);
      router.push(nxt ? `/app/portfell/import/${nxt.row.id}` : job.batch_id ? `/app/portfell/import/p/${job.batch_id}` : `/app/portfell/leping/${r.contract_id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const nextSpot = () => {
    if (!spots.length) return;
    const i = spots.findIndex((s) => s.key === active);
    const s = spots[(i + 1) % spots.length] ?? spots[0];
    activate(s.key);
    setTimeout(() => document.querySelector(`.ir-paan [data-ak="${CSS.escape(s.key)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
  };
  const primary = () => { if (spots.length) nextSpot(); else if (canCommit) void doCommit(); };

  // keyboard (demo `irKlaviatuur`): ↑↓ move · Enter right · E fix · Ctrl+Enter confirm
  const keyRef = useRef({ spots, cur, canCommit, primary, activate, check, setEditing });
  keyRef.current = { spots, cur, canCommit, primary, activate, check, setEditing };
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = keyRef.current, el = e.target as HTMLElement | null;
      if (el?.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.altKey || document.querySelector("[role=dialog]")) return;
      if (e.key === "Enter" && e.ctrlKey) { e.preventDefault(); if (k.canCommit) k.primary(); return; }
      if (e.ctrlKey || e.shiftKey) return;
      if ((e.key === "ArrowDown" || e.key === "ArrowUp") && k.spots.length) {
        e.preventDefault();
        const i = k.spots.findIndex((s) => s.key === k.cur?.key), j = (i + (e.key === "ArrowDown" ? 1 : -1) + k.spots.length) % k.spots.length;
        k.activate(k.spots[j].key);
        setTimeout(() => document.querySelector(`.ir-paan [data-ak="${CSS.escape(k.spots[j].key)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 30);
      } else if (e.key === "Enter" && k.cur && k.cur.kind !== "space" && k.cur.kind !== "parking" && !el?.closest("button, a, summary, label")) {
        e.preventDefault(); k.check(k.cur.key, true);
      } else if ((e.key === "e" || e.key === "E") && k.cur && k.cur.kind !== "space" && k.cur.kind !== "parking") { e.preventDefault(); k.setEditing(k.cur.key); }
    };
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, []);

  // header: who · what · how much · when
  const mainLabel = isChild ? (job.kind === "annex" ? (job.annex_number ? t("imports.desk.annex", { nr: job.annex_number }) : t("imports.desk.annexNoNr")) : t("imports.desk.document")) : t("imports.ir.tabContract");
  const labelOf = (f: ImportSourceFile) => fileLabel(f, mainLabel, null);
  const spaceNames = deskRow?.spaces ?? [];
  const area = num(draft.parameters.find((p) => p.key === "area_m2")?.value) ?? (draft.asset_hint?.area_m2 != null ? Number(draft.asset_hint.area_m2) : null);
  const monthly = monthlyOf(draft, area);
  const years = termYears(draft);
  const kindLabel = isChild ? mainLabel : tEnum("contract.category", draft.contract.category);
  const who = draft.contract.counterparty_name || draft.contract.title || t("imports.desk.unknownTenant");
  const sub = [spaceNames.join(" + "), years ? `${String(years).replace(".", ",")} a` : "", monthly != null ? `${fmtFixed(monthly, 2)} € ${t("imports.ir.perMonth")}` : ""].filter(Boolean).join(" · ");
  const dates = draft.contract.start_date || draft.contract.signed_at ? `${fmtDate(draft.contract.start_date ?? draft.contract.signed_at)} – ${draft.contract.end_date ? fmtDate(draft.contract.end_date) : "…"}` : undefined;

  // the bar: ← import · n / N · ‹ › · file
  const queue = toimikud.filter((x) => x.state !== "loen");
  const at = toimik ? queue.findIndex((x) => x.row.id === toimik.row.id) : -1;
  const prev = at > 0 ? queue[at - 1] : null, nextT = at >= 0 && at < queue.length - 1 ? queue[at + 1] : null;
  const batchName = batch.data?.batch?.name;

  const commitLabel = isChild ? (job.kind === "annex" ? t("imports.ir.commitAnnex") : t("imports.ir.commitDoc")) : t("imports.ir.commitContract");
  return (
    <div className="ir-view">
      <div className="ir-vasak">
        <div className="ir-riba">
          <Link className="ir-tagasi" href={job.batch_id ? `/app/portfell/import/p/${job.batch_id}` : "/app/portfell/import"}><IconArrowLeft />{batchName || t("imports.desk.backImport")}</Link>
          {at >= 0 && <span className="ir-n mono">{at + 1} / {queue.length}</span>}
          <span className="ir-nav">
            {prev ? <Link className="ir-nav-b" href={`/app/portfell/import/${prev.row.id}`} aria-label={t("imports.ir.prev")} title={t("imports.ir.prev")}><IconChevronLeft /></Link> : <span className="ir-nav-b off" aria-hidden><IconChevronLeft /></span>}
            {nextT ? <Link className="ir-nav-b" href={`/app/portfell/import/${nextT.row.id}`} aria-label={t("imports.ir.next")} title={t("imports.ir.next")}><IconChevronRight /></Link> : <span className="ir-nav-b off" aria-hidden><IconChevronRight /></span>}
          </span>
          <span className="ir-fail"><span className="ir-fail-ik">{(job.source_document?.format ?? "").toUpperCase().replace("ASICE", "ASiC-E")}</span><span className="mono" title={job.source_document?.filename}>{job.source_document?.filename}</span></span>
        </div>
        <SourceViewer jobId={job.id} files={files} textPages={job.text_pages ?? []} tab={tab} onTab={(i) => { setTab(i); setFocus(null); }} focus={focus} mainLabel={mainLabel} />
      </div>
      <aside className="ir-paan" aria-label={t("imports.review")}>
        <PaneHead overline={`${kindLabel} · ${open ? t("imports.ir.needsReview") : t("imports.ir.readyToCommit")}`} title={who} sub={sub || undefined} mono={dates} />
        {job.duplicate_of_contract_id && <Note tone="amber"><b>{t("imports.duplicate")}</b><span><Link className="steplink" href={`/app/portfell/leping/${job.duplicate_of_contract_id}`}>{t("imports.duplicateOpen")}</Link></span></Note>}
        {job.source_document?.has_text_layer === false && <Note tone="amber"><b>{t("imports.noTextLayer")}</b></Note>}
        <Signatures job={job} />
        <div className="ir-sammud">
          {isChild ? (
            <>
              <Step nr={1} title={t("imports.ir.q1")} ok>
                <button type="button" className="ir-q-v" onClick={() => show(1, needlesFor(draft.contract.title))}>{[mainLabel, draft.contract.title].filter(Boolean).join(" · ")}</button>
                {draft.contract.summary && <div className="ir-q-s">{draft.contract.summary}</div>}
              </Step>
              <ParentStep job={job} toimikud={toimikud} value={parent} onChange={pickParent} parentRow={childWaits ? parentRow : undefined} />
              {(draft.parameters.length > 0 || draft.key_dates.length > 0) && <ValuesStep c={ctl} nr={3} spots={spots} spaceArea={null} />}
            </>
          ) : (
            <>
              <PartiesStep c={ctl} link={link} onLink={setLink} spots={spots} />
              <SpaceStep c={ctl} link={link} onLink={setLink} properties={defaults.properties} companies={defaults.companies} spots={spots} park={park} />
              <ValuesStep c={ctl} nr={3} spots={spots} spaceArea={null} />
              <FilesStep nr={4} rows={toimik && toimik.row.id === job.id ? toimik.children : []} files={files} onTab={(i) => { setTab(i); setFocus(null); }} mainLabel={labelOf} />
            </>
          )}
        </div>
        {removed && (
          <RemovedNote label={removed.kind === "parameter" ? ((removed.item as Proposal["parameters"][number]).label || (removed.item as Proposal["parameters"][number]).key) : kdLabel(removed.item as Proposal["key_dates"][number])}
            value={removed.kind === "parameter" ? fmtValue((removed.item as Proposal["parameters"][number]).value, (removed.item as Proposal["parameters"][number]).unit) : fmtDate((removed.item as Proposal["key_dates"][number]).date)} onUndo={undoRemove} />
        )}
        <CalendarCard c={ctl} contract={!isChild} />
        <ClausesCard c={ctl} />
        <div className="ir-jalus">
          {excluding === null ? (
            <button type="button" className="btn btn-primary ir-pohi" onClick={primary} disabled={!spots.length && !canCommit} aria-busy={commit.isPending}>
              {commit.isPending ? <Spinner /> : spots.length ? t("imports.ir.lookMore", { n: spots.length }) : <><IconCheck width={16} height={16} />{commitLabel}{next ? ` ${t("imports.ir.andNext")}` : ""}</>}
            </button>
          ) : (
            <div className="ir-jata">
              <input className="fld fld-sm" aria-label={t("imports.desk.excludeReason")} placeholder={t("imports.ir.excludeReason")} value={excluding} onChange={(e) => setExcluding(e.target.value)} autoFocus
                onKeyDown={(e) => { if (e.key === "Escape") setExcluding(null); }} />
              <Button size="sm" onClick={async () => { try { await exclude.mutateAsync({ id: job.id, reason: excluding || undefined }); router.push(job.batch_id ? `/app/portfell/import/p/${job.batch_id}` : "/app/portfell/import"); } catch (e) { toast.error(errorMessage(e)); } }} busy={exclude.isPending}>{t("imports.desk.exclude")}</Button>
              <button type="button" className="steplink" onClick={() => setExcluding(null)}>{t("common.cancel")}</button>
            </div>
          )}
          {childWaits && <div className="ir-kk-miks">{t("imports.desk.childWaits")}</div>}
          <div className="ir-jalus-r">
            {excluding === null && <button type="button" className="steplink" onClick={() => setExcluding("")}>{t("imports.ir.skip")}</button>}
            <span className="ir-kbd" aria-live="polite">{saveState === "saving" ? t("imports.saving") : saveState === "error" ? t("common.error") : t("imports.ir.keys")}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

/** Annex or supporting document: which contract it belongs to (demo „Millise lepingu juurde?”) — a contract of this import or one in the registry. */
function ParentStep({ job, toimikud, value, onChange, parentRow }: { job: ImportJobDetail; toimikud: DeskToimik[]; value: string; onChange: (v: string) => void; parentRow?: DeskRow }) {
  const contracts = useContracts({});
  const imported = (contracts.data ?? []).filter((c) => c.origin === "imported"); // an external annex goes only onto an imported contract
  const inBatch = toimikud.map((x) => x.row).filter((r) => r.kind === "contract" && r.id !== job.id && r.state !== "ei" && r.state !== "viga");
  return (
    <Step nr={2} title={t("imports.ir.qParent")} ok={!!value} extra={!value ? <em>{t("imports.desk.olek.pickContract")}</em> : undefined}>
      <div className="ir-pv">
        <select className="ir-sel" aria-label={t("imports.desk.parentPick")} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{t("imports.desk.parentPick")}…</option>
          {inBatch.length > 0 && <optgroup label={t("imports.desk.parentBatch")}>{inBatch.map((r) => <option key={r.id} value={`job:${r.id}`}>{[r.counterparty || r.title || r.filename, r.spaces.join(" + "), r.number].filter(Boolean).join(" · ")}</option>)}</optgroup>}
          {imported.length > 0 && <optgroup label={t("imports.desk.parentRegistry")}>{imported.map((c) => <option key={c.id} value={`contract:${c.id}`}>{[c.number, c.party?.name || c.title].filter(Boolean).join(" · ")}</option>)}</optgroup>}
        </select>
        {parentRow && <div className="ir-q-s">{t("imports.ir.parentWaits")} · <Link className="steplink" href={`/app/portfell/import/${parentRow.id}`}>{t("imports.desk.openParent")}</Link></div>}
      </div>
    </Step>
  );
}
