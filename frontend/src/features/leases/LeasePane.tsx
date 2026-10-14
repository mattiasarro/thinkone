"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { t, tEnum } from "@/i18n";
import { useEditClause, useOpenThread, useThreadAction } from "@/lib/queries/leases";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { IconLock, IconX } from "@/components/ui/Icons";
import { cx, fmtDateTime, valueToString } from "@/lib/format";
import type { Run } from "@/features/quotes/quoteRun";
import type { LeaseClause, LeaseDraft, LeaseNegotiation, LeaseThread, LeaseThreadMessage } from "@/types/api";

/** Fact keys the operator can propose a new value for (backend `_apply_fact`); the rest are negotiated as wording. */
const FACT_INPUT: Record<string, "number" | "date" | "text"> = { rent: "number", parking: "number", handover: "date", months: "number", deposit_months: "number", purpose: "text", term_notes: "text" };

interface PaneProps { lease: LeaseDraft; neg: LeaseNegotiation; run: Run; selected: string | null; onSelect: (clauseId: string | null) => void; editable: boolean; onSpecialFor: (c: { clauseId: string; number: string; container: string }) => void }

/** „Punktid” — the selected clause's thread panel, or the accordion of all threads when nothing is selected (demo `.cl-side`). */
export function LeasePane({ lease, neg, run, selected, onSelect, editable, onSpecialFor }: PaneProps) {
  const clause = selected ? lease.clauses.find((c) => c.id === selected) ?? null : null;
  const thread = useMemo(() => {
    if (!selected) return null;
    const mine = neg.threads.filter((th) => th.clause_id === selected);
    return mine.find((th) => th.status !== "resolved") ?? mine[mine.length - 1] ?? null;
  }, [neg.threads, selected]);
  return (
    <Card>
      <CardHeader title={clause ? <span className="flex items-center gap-2 flex-wrap"><span className="font-mono text-sm text-muted">{t("lease.pane.clause", { number: clause.number })}</span>{clause.heading ?? ""}</span> : t("lease.pane.title")}
        actions={clause && <button type="button" className="icon-btn !w-8 !h-8" aria-label={t("common.close")} onClick={() => onSelect(null)}><IconX width={14} height={14} /></button>} />
      <CardBody className="grid gap-4">
        {clause ? <ClausePanel lease={lease} neg={neg} clause={clause} thread={thread} run={run} editable={editable} onSpecialFor={onSpecialFor} /> : <ThreadGroups neg={neg} onSelect={onSelect} />}
      </CardBody>
    </Card>
  );
}

function ThreadGroups({ neg, onSelect }: { neg: LeaseNegotiation; onSelect: (id: string) => void }) {
  if (neg.threads.length === 0) return <p className="text-sm text-muted m-0">{t("lease.pane.empty")}</p>;
  const groups: { key: "mine" | "unsent" | "tenant" | "resolved"; items: LeaseThread[] }[] = [
    { key: "mine", items: neg.threads.filter((th) => th.status !== "resolved" && th.whose_turn === "operator" && !th.unsent) },
    { key: "unsent", items: neg.threads.filter((th) => th.status !== "resolved" && th.unsent) },
    { key: "tenant", items: neg.threads.filter((th) => th.status !== "resolved" && th.whose_turn === "client" && !th.unsent) },
    { key: "resolved", items: neg.threads.filter((th) => th.status === "resolved") },
  ];
  return (
    <div className="grid gap-3">
      <p className="text-xs text-muted m-0">{t("lease.pane.empty")}</p>
      {groups.filter((g) => g.items.length > 0).map((g) => <Group key={g.key} label={tEnum("lease.pane.groups", g.key)} items={g.items} onSelect={onSelect} open={g.key !== "resolved"} />)}
    </div>
  );
}
function Group({ label, items, onSelect, open: initial }: { label: string; items: LeaseThread[]; onSelect: (id: string) => void; open: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div>
      <button type="button" className="flex items-center gap-2 w-full text-left text-xs font-semibold text-muted mb-1" aria-expanded={open} onClick={() => setOpen((o) => !o)}><span>{label}</span><Pill tone="neutral">{items.length}</Pill></button>
      {open && <ul className="grid gap-1">{items.map((th) => <li key={th.id}><ThreadRow th={th} onClick={() => onSelect(th.clause_id)} /></li>)}</ul>}
    </div>
  );
}

// ---------------------------------------------------------------- one clause ---------------------------------------

function ClausePanel({ lease, neg, clause, thread, run, editable, onSpecialFor }: { lease: LeaseDraft; neg: LeaseNegotiation; clause: LeaseClause; thread: LeaseThread | null; run: Run; editable: boolean; onSpecialFor: PaneProps["onSpecialFor"] }) {
  const [compare, setCompare] = useState(false);
  const [mode, setMode] = useState<"idle" | "remark" | "edit">("idle");
  const [text, setText] = useState("");
  const openThread = useOpenThread(lease.id);
  const editClause = useEditClause(lease.id);
  useEffect(() => { setMode("idle"); setCompare(false); setText(""); }, [clause.id]);
  const overridden = lease.clauses.find((c) => c.container === "annex:3" && c.overrides_clause_id === clause.id && c.status === "accepted");
  const isSpecial = clause.container === "annex:3";
  const openForMe = thread && thread.status !== "resolved";
  const canRemark = editable && !openForMe;

  const addRemark = async () => { const r = await run(openThread.mutateAsync({ clause_id: clause.id, text: text.trim() }), t("lease.pane.remarkAdded")); if (r) { setMode("idle"); setText(""); } };
  const saveWording = async (allow_locked = false) => { const r = await run(editClause.mutateAsync({ clause_id: clause.id, text: text.trim(), allow_locked }), t("lease.pane.wordingSaved")); if (r) { setMode("idle"); setText(""); } };

  return (
    <>
      <div className="grid gap-2">
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {clause.locked && <span className="pill"><IconLock width={12} height={12} />{t("contract.locked")}</span>}
          {clause.changed && <Pill tone="info">{t("lease.pane.changedMark")}</Pill>}
          {clause.provenance?.check && <Pill tone="warning">{t("lease.pane.checkMark")}</Pill>}
          {isSpecial && clause.status && <Pill tone={clause.status === "accepted" ? "success" : clause.status === "proposed" ? "warning" : "neutral"}>{tEnum("lease.special.status", clause.status)}</Pill>}
          {overridden && <span className="text-muted">{t("lease.pane.overridden", { number: overridden.number })}</span>}
        </div>
        {mode === "edit" ? (
          <div>
            <textarea className="fld" rows={5} value={text} onChange={(e) => setText(e.target.value)} aria-label={t("lease.pane.editWording")} autoFocus />
            <div className="flex gap-2 justify-end mt-2 flex-wrap">
              <Button size="sm" onClick={() => setMode("idle")}>{t("common.cancel")}</Button>
              {clause.locked ? <Button size="sm" variant="primary" busy={editClause.isPending} disabled={!text.trim()} onClick={() => saveWording(true)}>{t("lease.pane.unlockEdit")}</Button>
                : <Button size="sm" variant="primary" busy={editClause.isPending} disabled={!text.trim()} onClick={() => saveWording()}>{t("common.save")}</Button>}
            </div>
          </div>
        ) : (
          <p className={cx("text-sm whitespace-pre-wrap m-0", compare && "line-through text-muted")}>{clause.text}</p>
        )}
        {compare && clause.original_text && <div><div className="text-xs font-semibold text-muted">{t("lease.pane.original")}</div><p className="text-sm whitespace-pre-wrap m-0">{clause.original_text}</p></div>}
        {clause.changed && clause.original_text && mode !== "edit" && <Button size="sm" variant="text" className="w-fit" onClick={() => setCompare((c) => !c)}>{t("lease.pane.compare")}</Button>}
      </div>

      {thread && <Thread th={thread} />}

      {editable && mode === "idle" && !openForMe && (
        <div className="flex gap-2 flex-wrap">
          {canRemark && <Button size="sm" onClick={() => { setMode("remark"); setText(""); }}>{t("lease.pane.addRemark")}</Button>}
          {clause.locked ? (
            <div className="grid gap-1 w-full">
              <div className="note info text-xs"><span>{t("lease.pane.locked")}</span></div>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="primary" onClick={() => onSpecialFor({ clauseId: clause.id, number: clause.number, container: clause.container })}>{t("lease.pane.toSpecial")}</Button>
                <Button size="sm" variant="text" onClick={() => { setMode("edit"); setText(clause.text); }}>{t("lease.pane.editWording")}</Button>
              </div>
            </div>
          ) : <Button size="sm" onClick={() => { setMode("edit"); setText(clause.text); }}>{t("lease.pane.editWording")}</Button>}
          {thread?.status === "resolved" && <ReplyButton lease={lease} th={thread} run={run} label={t("lease.pane.reply")} />}
        </div>
      )}
      {mode === "remark" && (
        <div>
          <textarea className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("lease.pane.remarkPlaceholder")} aria-label={t("lease.pane.addRemark")} autoFocus />
          <div className="flex gap-2 justify-end mt-2"><Button size="sm" onClick={() => setMode("idle")}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={openThread.isPending} disabled={!text.trim()} onClick={addRemark}>{t("lease.pane.send")}</Button></div>
        </div>
      )}

      {openForMe && thread && <ThreadActions lease={lease} neg={neg} clause={clause} th={thread} run={run} editable={editable} />}
    </>
  );
}

// ---------------------------------------------------------------- the thread ---------------------------------------

function Thread({ th }: { th: LeaseThread }) {
  const last = th.messages[th.messages.length - 1];
  const note = th.status === "resolved" ? t("lease.pane.status.resolved", { label: th.resolution_label ?? "" })
    : th.status === "awaiting_confirmation" ? (th.proposal?.by === "operator" ? t("lease.pane.status.awaitingTenant") : t("lease.pane.status.awaitingYou"))
    : th.whose_turn === "operator" ? t("lease.pane.status.yourTurn") : t("lease.pane.status.tenantTurn");
  return (
    <div className="grid gap-2">
      <ol className="grid gap-2">{th.messages.map((m) => <Bubble key={m.id} m={m} />)}</ol>
      <div className="text-xs text-muted flex items-center gap-2 flex-wrap">
        <span>{note}</span>
        {last && last.author_type === "operator" && last.meta.round_nr == null && <Pill tone="info">{t("lease.pane.unsentNote")}</Pill>}
      </div>
    </div>
  );
}

function Bubble({ m }: { m: LeaseThreadMessage }) {
  const mine = m.author_type === "operator";
  if (m.author_type === "system") return <li className="text-center text-xs text-muted whitespace-pre-wrap">{m.body}</li>;
  const p = m.meta.proposal;
  return (
    <li className={cx("flex", mine ? "justify-end" : "justify-start")}>
      <div className="max-w-[90%] rounded-control px-3 py-2 text-sm" style={{ background: mine ? "var(--color-primary-subtle)" : "var(--color-surface-subtle)" }}>
        <div className="text-xs text-muted flex items-center gap-2 flex-wrap mb-0.5">
          <span className="font-medium">{m.author_name || (mine ? t("lease.pane.us") : t("lease.pane.tenant"))}</span>
          <span>{fmtDateTime(m.created_at)}</span>
          {m.meta.round_nr != null && <span className="pill">{t("lease.pane.round", { n: m.meta.round_nr })}</span>}
          {m.meta.kind && m.meta.kind !== "proposal" && <span>{tEnum("lease.pane.kinds", m.meta.kind)}</span>}
        </div>
        {p && m.meta.kind === "proposal" && (
          <div className="text-xs font-semibold mb-1">
            {p.kind === "fact" ? t("lease.pane.proposal.fact", { label: tEnum("lease.pane.facts", p.fact_key ?? ""), value: valueToString(p.value) }) : p.kind === "wording" ? t("lease.pane.proposal.wording") : t("lease.pane.proposal.special")}
          </div>
        )}
        {p?.kind === "wording" && p.before && <div className="text-xs text-muted line-through whitespace-pre-wrap mb-1">{p.before}</div>}
        <div className="whitespace-pre-wrap">{m.body}</div>
      </div>
    </li>
  );
}

function ReplyButton({ lease, th, run, label }: { lease: LeaseDraft; th: LeaseThread; run: Run; label: string }) {
  const act = useThreadAction(lease.id);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  if (!open) return <Button size="sm" variant="text" onClick={() => setOpen(true)}>{label}</Button>;
  return (
    <div className="w-full">
      <textarea className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("lease.pane.answerPlaceholder")} aria-label={t("lease.pane.reply")} autoFocus />
      <div className="flex gap-2 justify-end mt-2"><Button size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={act.isPending} disabled={!text.trim()} onClick={async () => { const r = await run(act.mutateAsync({ tid: th.id, action: "answer", body: { text: text.trim() } }), t("lease.pane.answered")); if (r) { setOpen(false); setText(""); } }}>{t("lease.pane.send")}</Button></div>
    </div>
  );
}

// ---------------------------------------------------------------- „Kuidas lahendame?” --------------------------------

type Option = "explain" | "fact" | "wording" | "special" | "answer";

function ThreadActions({ lease, clause, th, run, editable }: { lease: LeaseDraft; neg: LeaseNegotiation; clause: LeaseClause; th: LeaseThread; run: Run; editable: boolean }) {
  const act = useThreadAction(lease.id);
  const [opt, setOpt] = useState<Option | null>(null);
  const [text, setText] = useState("");
  const [value, setValue] = useState("");
  const [decline, setDecline] = useState(false);
  useEffect(() => { setOpt(null); setText(""); setValue(""); setDecline(false); }, [th.id, th.status]);
  if (!editable) return null;

  // the tenant proposed something → confirm or decline
  if (th.status === "awaiting_confirmation") {
    if (th.proposal?.by !== "client") return null; // our own proposal is waiting for the tenant — the note above says so
    return (
      <div className="grid gap-2">
        {decline ? (
          <div>
            <textarea className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("lease.pane.answerPlaceholder")} aria-label={t("lease.pane.declineText")} autoFocus />
            <div className="flex gap-2 justify-end mt-2"><Button size="sm" onClick={() => setDecline(false)}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={act.isPending} onClick={async () => { const r = await run(act.mutateAsync({ tid: th.id, action: "decide", body: { accept: false, text: text.trim() || null } }), t("lease.pane.declined")); if (r) setDecline(false); }}>{t("lease.pane.send")}</Button></div>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="primary" busy={act.isPending} onClick={() => run(act.mutateAsync({ tid: th.id, action: "decide", body: { accept: true } }), t("lease.pane.accepted"))}>{t("lease.pane.accept")}</Button>
            <Button size="sm" onClick={() => setDecline(true)}>{t("lease.pane.decline")}</Button>
          </div>
        )}
      </div>
    );
  }
  if (th.whose_turn !== "operator") return <ReplyButton lease={lease} th={th} run={run} label={t("lease.pane.reply")} />;

  const factKey = clause.fact_key && FACT_INPUT[clause.fact_key] ? clause.fact_key : null;
  const factLabel = factKey ? tEnum("lease.pane.facts", factKey) : "";
  const specialPrefix = t("lease.pane.specialPrefix", { container: clause.container === "general" ? t("lease.pane.specialGeneral") : t("lease.pane.specialMain"), number: clause.number });
  const pick = (o: Option) => { setOpt(o); setText(o === "wording" ? clause.text : o === "special" ? specialPrefix : ""); setValue(""); };
  const submit = async () => {
    let p: Promise<unknown>;
    let ok = t("lease.pane.proposed");
    switch (opt) {
      case "explain": p = act.mutateAsync({ tid: th.id, action: "explain", body: { text: text.trim() } }); ok = t("lease.pane.explained"); break;
      case "answer": p = act.mutateAsync({ tid: th.id, action: "answer", body: { text: text.trim() } }); ok = t("lease.pane.answered"); break;
      case "fact": {
        const kind = FACT_INPUT[factKey ?? ""];
        const v: unknown = kind === "number" ? Number(value.replace(",", ".")) : value;
        p = act.mutateAsync({ tid: th.id, action: "propose", body: { kind: "fact", fact_key: factKey, value: v, text: text.trim() || null } });
        break;
      }
      case "wording": p = act.mutateAsync({ tid: th.id, action: "propose", body: { kind: "wording", wording: text.trim() } }); break;
      case "special": p = act.mutateAsync({ tid: th.id, action: "propose", body: { kind: "special_term", special_text: text.trim(), overrides_label: t("lease.pane.clause", { number: clause.number }) } }); break;
      default: return;
    }
    const r = await run(p, ok);
    if (r) { setOpt(null); setText(""); setValue(""); }
  };
  const valid = opt === "fact" ? value.trim() !== "" : text.trim() !== "";

  if (opt) {
    const title = opt === "explain" ? t("lease.pane.explain") : opt === "fact" ? t("lease.pane.changeFact", { label: factLabel }) : opt === "wording" ? t("lease.pane.changeWording") : opt === "special" ? t("lease.pane.special") : t("lease.pane.answerOnly");
    return (
      <div className="grid gap-2">
        <button type="button" className="text-xs text-muted text-left w-fit" onClick={() => setOpt(null)}>{t("lease.pane.backToOptions")}</button>
        <div className="text-sm font-semibold">{title}</div>
        {opt === "fact" && (
          FACT_INPUT[factKey ?? ""] === "text"
            ? <textarea className="fld" rows={3} value={value} onChange={(e) => setValue(e.target.value)} aria-label={t("lease.pane.newValue")} autoFocus />
            : <Input label={t("lease.pane.newValue")} type={FACT_INPUT[factKey ?? ""] === "date" ? "date" : "number"} step={factKey === "rent" ? "0.01" : "1"} inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        )}
        <textarea className="fld" rows={opt === "wording" || opt === "special" ? 5 : 3} value={text} onChange={(e) => setText(e.target.value)} autoFocus={opt !== "fact"}
          placeholder={opt === "explain" ? t("lease.pane.explainPlaceholder") : opt === "answer" ? t("lease.pane.answerPlaceholder") : opt === "fact" ? t("lease.pane.messageOptional") : t("lease.pane.newWording")}
          aria-label={opt === "fact" ? t("lease.pane.messageOptional") : opt === "wording" || opt === "special" ? t("lease.pane.newWording") : title} />
        <div className="flex gap-2 justify-end"><Button size="sm" onClick={() => setOpt(null)}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={act.isPending} disabled={!valid} onClick={submit}>{t("lease.pane.send")}</Button></div>
      </div>
    );
  }

  return (
    <div className="grid gap-1">
      <div className="text-sm font-semibold mb-1">{t("lease.pane.how")}</div>
      <Opt title={t("lease.pane.explain")} sub={t("lease.pane.explainSub")} onClick={() => pick("explain")} />
      {factKey ? <Opt title={t("lease.pane.changeFact", { label: factLabel })} sub={t("lease.pane.changeSub")} onClick={() => pick("fact")} />
        : !clause.locked && <Opt title={t("lease.pane.changeWording")} sub={t("lease.pane.changeSub")} onClick={() => pick("wording")} />}
      {factKey && !clause.locked && <Opt title={t("lease.pane.changeWording")} sub={t("lease.pane.changeSub")} onClick={() => pick("wording")} />}
      <Opt title={t("lease.pane.special")} sub={t("lease.pane.specialSub")} onClick={() => pick("special")} />
      <div className="flex gap-3 flex-wrap mt-1">
        <Button size="sm" variant="text" onClick={() => pick("answer")}>{t("lease.pane.answerOnly")}</Button>
        <Button size="sm" variant="text" busy={act.isPending} onClick={() => run(act.mutateAsync({ tid: th.id, action: "unchanged" }), t("lease.pane.unchangedDone"))}>{t("lease.pane.unchanged")}</Button>
      </div>
    </div>
  );
}

function Opt({ title, sub, onClick }: { title: ReactNode; sub?: string; onClick: () => void }) {
  return (
    <button type="button" className="text-left rounded-control px-3 py-2 hover:bg-canvas border" style={{ borderColor: "var(--line)" }} onClick={onClick}>
      <span className="block text-sm font-medium">{title}</span>
      {sub && <span className="block text-xs text-muted">{sub}</span>}
    </button>
  );
}

/** One thread in a list: „p 3.1 · Üür” + the last message excerpt. Numbers are never repeated elsewhere in the pane. */
export function ThreadRow({ th, onClick, active }: { th: LeaseThread; onClick: () => void; active?: boolean }) {
  const last = th.messages[th.messages.length - 1];
  return (
    <button type="button" className={cx("w-full text-left rounded-control px-2 py-1.5 hover:bg-canvas grid gap-0.5", active && "bg-canvas")} onClick={onClick}>
      <span className="text-sm font-medium flex items-center gap-2 flex-wrap"><span className="font-mono text-xs text-muted">{t("lease.pane.clause", { number: th.clause_number ?? "?" })}</span>{th.clause_heading}{th.unsent && <Pill tone="info">{t("lease.pane.groups.unsent")}</Pill>}{th.status === "resolved" && th.resolution_label && <Pill tone="neutral">{th.resolution_label}</Pill>}</span>
      {last && <span className="block text-xs text-muted truncate">{last.body}</span>}
    </button>
  );
}
