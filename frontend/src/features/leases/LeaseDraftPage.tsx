"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { useCancelLease, useLease, useLeaseNegotiation, useSendLease, useSendRound } from "@/lib/queries/leases";
import { Card, CardBody, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, statusTone, type Tone } from "@/components/ui/Pill";
import { ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconAi, IconChevronLeft, IconExternal, IconLink } from "@/components/ui/Icons";
import { cx, fmtDate, fmtDateTime, fmtEur, fmtNum, valueToString } from "@/lib/format";
import { useRun, type Run } from "@/features/quotes/quoteRun";
import { openAttachment } from "@/lib/queries/settings";
import { LeasePane, ThreadRow } from "./LeasePane";
import { ChatCard, ClientCard, DealCard, LettersRoundsCard, RepsCard, SpecialCard } from "./LeaseCards";
import type { LeaseChange, LeaseDraft, LeaseNegotiation } from "@/types/api";

export const LEASE_OPEN = new Set(["draft", "sent", "negotiating", "ready_to_sign"]);

/** The operator can shape the deal while drafting, and during negotiation only on their own turn (one round = one letter). */
export function operatorEditable(lease: LeaseDraft, neg: LeaseNegotiation | undefined): boolean {
  if (!lease.editable) return false;
  if (lease.status === "draft") return true;
  return (neg?.turn ?? lease.round?.side) === "operator";
}

export function LeaseDraftPage({ id }: { id: string }) {
  const lease = useLease(id);
  const neg = useLeaseNegotiation(id);
  if (lease.isLoading || (neg.isLoading && !neg.data)) return <Loading rows={6} />;
  if (lease.error || !lease.data) return <ErrorState error={lease.error} onRetry={() => lease.refetch()} />;
  if (neg.error || !neg.data) return <ErrorState error={neg.error} onRetry={() => neg.refetch()} />;
  return <Detail lease={lease.data} neg={neg.data} refetch={() => { void lease.refetch(); void neg.refetch(); }} />;
}

function Detail({ lease, neg, refetch }: { lease: LeaseDraft; neg: LeaseNegotiation; refetch: () => void }) {
  const run = useRun(refetch);
  const cancel = useCancelLease(lease.id);
  const [cancelDlg, setCancelDlg] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [specialFor, setSpecialFor] = useState<{ clauseId: string; number: string; container: string } | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const post = useCallback((msg: Record<string, unknown>) => { frame.current?.contentWindow?.postMessage({ source: "thinkone-host", ...msg }, "*"); }, []);
  const select = useCallback((clauseId: string | null) => { setSelected(clauseId); post({ type: "select", clauseId }); }, [post]);
  const isOpen = LEASE_OPEN.has(lease.status);
  const latest = neg.versions[neg.versions.length - 1];
  const editable = operatorEditable(lease, neg);

  // ---- the A4 sheet talks to us: clicks select a clause; we mark open/done threads and mirror the pane's selection
  const marks = useMemo(() => {
    const open = new Set<string>(), done = new Set<string>();
    for (const th of neg.threads) (th.status === "resolved" ? done : open).add(th.clause_id);
    for (const c of open) done.delete(c);
    return { open: [...open], done: [...done] };
  }, [neg.threads]);
  const postMarks = useCallback(() => post({ type: "marks", open: marks.open, done: marks.done }), [post, marks]);
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { source?: string; type?: string; clauseId?: string | null } | null;
      if (!d || d.source !== "thinkone-doc") return;
      if (d.type === "ready") { postMarks(); if (selected) post({ type: "select", clauseId: selected }); }
      else if (d.type === "clause" && d.clauseId) { if (selected === d.clauseId) select(null); else setSelected(d.clauseId); }
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [post, postMarks, selected, select]);
  useEffect(() => { postMarks(); }, [postMarks]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")) { el.blur(); return; } // the first Esc only leaves the field
      if (document.querySelector("[role='dialog']")) return; // modals close themselves
      select(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [select]);

  const docSrc = viewVersion ? `/api/v1/leases/${lease.id}/versions/${viewVersion}/document.html` : `/api/v1/leases/${lease.id}/document.html`;
  const onCancel = async () => { const r = await run(cancel.mutateAsync({}), t("lease.cancelled")); if (r) setCancelDlg(false); };
  const turn: { tone: Tone; label: string } | null = !isOpen ? null : lease.status === "ready_to_sign" ? { tone: "success", label: t("lease.done") } : neg.turn === "client" ? { tone: "neutral", label: t("lease.tenantTurn") } : { tone: neg.next_step?.urgent ? "warning" : "primary", label: t("lease.yourTurn") };

  return (
    <div className="grid gap-5">
      <LinkButton href="/app/portfell?tab=lepingud" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("lease.back")}</LinkButton>
      <PageHead
        title={<span className="flex items-center gap-3 flex-wrap"><span className="font-mono text-base text-muted font-medium">{lease.number}</span>{lease.title}</span>}
        sub={<span className="flex flex-wrap items-center gap-2 mt-2">
          <Pill tone={statusTone(lease.status)}>{tEnum("contract.status", lease.status)}</Pill>
          {lease.party && <Link href={`/app/portfell/osapool/${lease.party.id}`} className="text-primary font-semibold text-sm">{lease.party.name}</Link>}
          {lease.deal.property && <Link href={`/app/portfell/objekt/${lease.deal.property.id}`} className="text-muted text-sm">· {lease.deal.property.name}</Link>}
        </span>}
        actions={<>
          <LinkButton href={`/app/ai?context_type=contract&context_id=${lease.id}&origin=${encodeURIComponent(`/app/portfell/leping/${lease.id}`)}`} variant="ghost" size="sm"><IconAi width={16} height={16} />{t("ai.askAbout", { what: t("ai.askLease") })}</LinkButton>
          {neg.link && <a href={neg.link.url} target="_blank" rel="noopener" className="btn btn-ghost"><IconExternal width={16} height={16} />{lease.deal.vertical === "employment" ? t("lease.employment.viewAsEmployee") : t("lease.viewAsTenant")}</a>}
          {isOpen && <Button variant="text" onClick={() => setCancelDlg(true)}>{t("lease.cancel")}</Button>}
        </>}
      />

      {/* riba: document pills — no number, no status trail (demo v769) */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <button type="button" className={cx("pill", viewVersion === null && "primary")} onClick={() => setViewVersion(null)}>{t("lease.riba.document")}</button>
        {lease.annexes.map((a) => {
          const label = t("lease.riba.annex", { n: a.number, title: a.title });
          if (a.kind === "special_terms") return <button key={`a${a.number}`} type="button" className="pill hover:text-ink" onClick={() => document.getElementById("lease-special")?.scrollIntoView({ behavior: "smooth", block: "start" })}>{label}</button>;
          if (a.missing || !a.attachment_id) return <span key={`a${a.number}-${a.space_id ?? ""}`} className="pill opacity-60" title={t("lease.riba.missing")}>{label} · {t("lease.riba.missing")}</span>;
          const aid = a.attachment_id;
          return <button key={aid} type="button" className="pill hover:text-ink" onClick={() => void openAttachment(aid)}>{label}</button>;
        })}
        {latest?.pdf_url && <a href={latest.pdf_url} target="_blank" rel="noopener" className="pill hover:text-ink">{t("lease.riba.preview")}</a>}
        {neg.versions.length > 0 && <button type="button" className={cx("pill", neg.changes_since_v1.length > 0 && "warning")} onClick={() => setChangesOpen(true)}>{t("lease.riba.changes", { n: neg.changes_since_v1.length })}</button>}
        {neg.versions.length > 0 && <button type="button" className={cx("pill", viewVersion !== null && "info")} onClick={() => setVersionsOpen(true)}>{viewVersion !== null ? `${t("lease.riba.v", { n: viewVersion })} · ` : ""}{t("lease.riba.versions", { n: neg.versions.length })}</button>}
      </div>

      <KeySheet lease={lease} turn={turn} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start">
        <div className="min-w-0">
          <iframe ref={frame} key={`${lease.version}-${neg.rounds.length}-${viewVersion ?? "live"}`} title={t("lease.riba.document")} src={docSrc} className="w-full bg-white rounded-surface shadow-surface" style={{ minHeight: "1100px", border: 0 }} onLoad={postMarks} />
        </div>
        <div className="grid gap-5 min-w-0">
          <GuideCard lease={lease} neg={neg} run={run} onSelect={select} />
          <LeasePane lease={lease} neg={neg} run={run} selected={selected} onSelect={select} editable={editable} onSpecialFor={(c) => { setSpecialFor(c); document.getElementById("lease-special")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} />
          <DealCard lease={lease} run={run} editable={editable} />
          <RepsCard lease={lease} run={run} editable={editable} />
          <ClientCard lease={lease} neg={neg} run={run} />
          <SpecialCard lease={lease} run={run} editable={editable} prefill={specialFor} onPrefillDone={() => setSpecialFor(null)} />
          {lease.status !== "draft" && <ChatCard lease={lease} run={run} />}
          <LettersRoundsCard neg={neg} />
        </div>
      </div>

      <Modal open={changesOpen} onClose={() => setChangesOpen(false)} title={t("lease.changes.title")} sub={t("lease.changes.sub")} wide>
        {neg.changes_since_v1.length === 0 ? <p className="text-sm text-muted">{t("lease.changes.none")}</p> : <ChangeList changes={neg.changes_since_v1} onPick={(cid) => { setChangesOpen(false); select(cid); }} />}
      </Modal>
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title={t("lease.versions.title")} wide>
        <ol className="grid gap-4">
          {[...neg.versions].reverse().map((v) => (
            <li key={v.number} className="rounded-control p-3 grid gap-2" style={{ background: "var(--color-surface-subtle)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <Pill tone={v.number === lease.sent_version ? "primary" : "neutral"}>{t("lease.riba.v", { n: v.number })}</Pill>
                <span className="text-sm text-muted">{fmtDateTime(v.created_at)}</span>
                <span className="ml-auto flex gap-1">
                  {v.pdf_url && <a href={v.pdf_url} target="_blank" rel="noopener" className="btn btn-text btn-sm"><IconExternal width={14} height={14} />{t("lease.versions.pdf")}</a>}
                  <Button size="sm" variant={viewVersion === v.number ? "primary" : "ghost"} onClick={() => { setViewVersion(v.number); setVersionsOpen(false); }}>{t("lease.versions.open")}</Button>
                </span>
              </div>
              {v.note && <p className="text-sm whitespace-pre-wrap"><span className="text-muted">{t("lease.versions.note")}:</span> {v.note}</p>}
              {v.number === 1 ? <p className="text-xs text-muted">{t("lease.versions.first")}</p> : v.changes.length === 0 ? <p className="text-xs text-muted">{t("lease.versions.noChanges")}</p> : <ChangeList changes={v.changes} compact />}
            </li>
          ))}
        </ol>
      </Modal>
      <ConfirmDialog open={cancelDlg} onClose={() => setCancelDlg(false)} onConfirm={onCancel} busy={cancel.isPending} title={t("lease.cancel")} body={t("lease.cancelConfirm", { number: lease.number })} />
    </div>
  );
}

/** Word-level-ish changes since V1 (demo „Muudatused · N”): wording as struck-through before + after; facts as before → after. */
export function ChangeList({ changes, compact, onPick }: { changes: LeaseChange[]; compact?: boolean; onPick?: (clauseId: string) => void }) {
  return (
    <ul className={cx("grid", compact ? "gap-1 text-xs" : "gap-3 text-sm")}>
      {changes.map((c) => {
        const label = onPick && c.clause_id ? <button type="button" className="font-medium text-primary text-left" onClick={() => onPick(c.clause_id as string)}>{c.label}</button> : <span className="font-medium">{c.label}</span>;
        const kind = <span className="pill">{tEnum("lease.changes.kinds", c.kind)}</span>;
        if (c.kind === "wording" || c.kind === "added" || c.kind === "removed") {
          return (
            <li key={c.key} className="grid gap-1">
              <div className="flex items-center gap-2 flex-wrap">{label}{kind}</div>
              {c.before != null && <p className="text-muted line-through whitespace-pre-wrap m-0">{String(c.before)}</p>}
              {c.after != null && <p className="whitespace-pre-wrap m-0">{String(c.after)}</p>}
            </li>
          );
        }
        return <li key={c.key} className="flex gap-2 flex-wrap items-center">{label}{kind}<span className="text-muted line-through">{valueToString(c.before)}</span><span>→</span><span className="font-semibold">{valueToString(c.after)}</span></li>;
      })}
    </ul>
  );
}

/** Key-data sheet (demo `lepVotiHTML`): four numbers above the document, the period and the turn on the right. */
function KeySheet({ lease, turn }: { lease: LeaseDraft; turn: { tone: Tone; label: string } | null }) {
  const d = lease.deal;
  const tot = d.totals;
  const emp = d.vertical === "employment" ? d.employment : null;
  return (
    <Card className="pad">
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 min-w-0">
          {emp ? (<>
            <Tile label={t("lease.key.salary")} value={fmtEur(emp.salary)} sub={t("lease.key.salarySub")} />
            <Tile label={t("lease.key.position")} value={emp.position?.name ?? "—"} sub={emp.department?.name ?? undefined} />
            <Tile label={t("lease.key.probation")} value={emp.probation_end ? fmtDate(emp.probation_end) : "—"} sub={emp.probation_months ? t("lease.key.probationMonths", { n: emp.probation_months }) : t("lease.key.noProbation")} />
            <Tile label={t("lease.key.salaryReview")} value={emp.salary_review ? fmtDate(emp.salary_review) : "—"} />
          </>) : (<>
            <Tile label={t("lease.key.rent")} value={fmtEur(tot.monthly_net)} sub={tot.vat_taxable ? t("lease.key.gross", { amount: fmtEur(tot.monthly_gross) }) : undefined} />
            <Tile label={t("lease.key.price")} value={fmtEur(tot.avg_price_per_m2)} sub={tot.stepped ? "ø" : undefined} />
            <Tile label={t("lease.key.area")} value={`${fmtNum(tot.area_m2)} m²`} />
            <Tile label={t("lease.key.deposit")} value={d.deposit_months ? fmtEur(d.deposit) : "—"} sub={d.deposit_months ? t("lease.key.depositMonths", { n: d.deposit_months }) : t("lease.key.noDeposit")} />
          </>)}
        </div>
        <div className="grid gap-2 justify-items-end self-center text-right">
          <div className="text-sm font-medium text-muted">{d.end ? t("lease.key.period", { from: fmtDate(d.handover), to: fmtDate(d.end), n: d.months }) : t("lease.key.openEnded", { from: fmtDate(d.handover) })}</div>
          {turn && <Pill tone={turn.tone}>{turn.label}</Pill>}
        </div>
      </div>
    </Card>
  );
}
function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="min-w-0"><div className="overline">{label}</div><div className="font-heading text-2xl font-semibold tabular-nums mt-0.5">{value}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div>;
}

// ---------------------------------------------------------------- juhtkaart ---------------------------------------

/** ONE guide card (demo `juhtKaart`): whose-turn mark · title · text · ONE primary button. */
function GuideCard({ lease, neg, run, onSelect }: { lease: LeaseDraft; neg: LeaseNegotiation; run: Run; onSelect: (clauseId: string) => void }) {
  const ns = neg.next_step;
  const send = useSendLease(lease.id);
  const round = useSendRound(lease.id);
  const toast = useToast();
  const [sendOpen, setSendOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [body, setBody] = useState("");
  const whose: { tone: Tone; label: string } = !ns ? { tone: "neutral", label: tEnum("contract.status", lease.status) } : ns.code === "sign" ? { tone: "success", label: t("lease.done") } : ns.side === "client" ? { tone: "neutral", label: t("lease.tenantTurn") } : { tone: ns.urgent ? "warning" : "primary", label: t("lease.yourTurn") };
  const mine = neg.threads.filter((th) => th.status !== "resolved" && th.whose_turn === "operator");
  const lastRound = neg.rounds[neg.rounds.length - 1];
  const hasEmail = /\S+@\S+\.\S+/.test(lease.contact.email || "");

  const doSend = async () => { const r = await run(send.mutateAsync({ message: msg.trim() || null, expected_version: lease.version }), t("lease.guide.sent")); if (r) { setSendOpen(false); setMsg(""); } };
  const doRound = async () => { const r = await run(round.mutateAsync({ body: body.trim() || null }), t("lease.guide.roundSent")); if (r) setBody(""); };
  const copy = async () => { if (!neg.link) return; try { await navigator.clipboard.writeText(neg.link.url); toast.success(t("lease.guide.linkCopied")); } catch { toast.error(t("common.error")); } };

  let content: ReactNode = null;
  let primary: ReactNode = null;
  let secondary: ReactNode = null;
  switch (ns?.code) {
    case "send":
      content = !hasEmail ? <div className="note warning"><span>{t("lease.guide.noEmail")}</span></div> : null;
      primary = <Button variant="primary" disabled={!hasEmail} onClick={() => setSendOpen(true)}>{ns?.title ?? t("lease.guide.send")}</Button>;
      break;
    case "answer":
      content = (
        <div className="grid gap-3">
          {mine.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted mb-1">{t("lease.guide.answerList")}</div>
              <ul className="grid gap-1">{mine.map((th) => <li key={th.id}><ThreadRow th={th} onClick={() => onSelect(th.clause_id)} /></li>)}</ul>
            </div>
          )}
          {neg.pending_count === 0 && neg.unsent_count > 0 && <textarea className="fld" rows={3} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("lease.guide.sendAnswersBody")} aria-label={t("lease.guide.sendAnswersBody")} />}
          {neg.pending_count > 0 && <p className="text-xs text-warning m-0">{t("lease.guide.pendingReason", { n: neg.pending_count })}</p>}
        </div>
      );
      primary = neg.pending_count === 0 && neg.unsent_count === 0
        ? <Button variant="primary" busy={round.isPending} onClick={doRound}>{t("lease.guide.returnToTenant")}</Button>
        : <Button variant="primary" busy={round.isPending} disabled={neg.pending_count > 0} onClick={doRound}>{t("lease.guide.sendAnswers", { n: neg.unsent_count })}</Button>;
      break;
    case "waiting":
      content = neg.link ? (
        <div className="rounded-control p-3 grid gap-1 text-sm" style={{ background: "var(--color-surface-subtle)" }}>
          <div className="flex items-center gap-2"><IconLink width={14} height={14} className="text-muted" /><span>{neg.link.opened_at ? t("lease.guide.linkOpened", { at: fmtDateTime(neg.link.opened_at) }) : t("lease.guide.linkNotOpened")}</span></div>
          {lastRound && <div className="text-xs text-muted">{t("lease.guide.lastRound", { n: lastRound.nr, date: fmtDateTime(lastRound.created_at) })}</div>}
        </div>
      ) : null;
      secondary = <Button variant="text" size="sm" onClick={copy}>{t("lease.guide.copyLink")}</Button>;
      break;
    case "sign":
      content = <div className="note success"><span>{t("lease.guide.sign")}</span></div>;
      break;
    default:
      break;
  }

  return (
    <Card>
      <CardBody className="grid gap-3">
        <div className="flex items-center gap-2 flex-wrap"><Pill tone={whose.tone}>{whose.label}</Pill></div>
        <div>
          <h3 className="text-base">{ns ? ns.title : t("lease.guide.closed")}</h3>
          <p className="text-sm text-muted mt-1">{ns ? ns.text : tEnum("contract.status", lease.status)}</p>
        </div>
        {content}
        {(primary || secondary) && <div className="flex items-center gap-2 flex-wrap">{primary}<span className="ml-auto flex gap-1">{secondary}</span></div>}
      </CardBody>
      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t("lease.guide.sendTitle")} sub={t("lease.guide.sendSub", { email: lease.contact.email || "—" })}
        footer={<><Button onClick={() => setSendOpen(false)}>{t("common.cancel")}</Button><Button variant="primary" busy={send.isPending} onClick={doSend}>{t("lease.guide.send")}</Button></>}>
        <textarea className="fld" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("lease.guide.sendMessage")} aria-label={t("lease.guide.sendMessage")} />
      </Modal>
    </Card>
  );
}
