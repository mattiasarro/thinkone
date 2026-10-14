"use client";
import { forwardRef, useEffect, useState } from "react";
import { IconCheck, IconChevronLeft, IconEdit } from "@/components/ui/Icons";
import { Pill } from "@/components/ui/Pill";
import { t } from "@/i18n";
import { cx } from "@/lib/format";
import type { LeaseProposal, LeaseThread, LeaseWish, PortalClause, PortalLease } from "@/types/portal";
import { MessageBubble } from "../MessageBubble";
import { clauseTitle, factInputType, factText, groupOf, isUnsent, kindLabel, threadNote, threadOf, type ThreadGroup } from "./util";

export interface PaneActions {
  openThread: (clauseId: string, text: string, wish?: LeaseWish) => Promise<unknown>;
  reply: (threadId: string, text: string) => Promise<unknown>;
  decide: (threadId: string, accept: boolean, text?: string) => Promise<unknown>;
  ok: (threadId: string) => Promise<unknown>;
}

interface Props {
  lease: PortalLease;
  selected: string | null;
  onSelect: (clauseId: string | null) => void;
  actions: PaneActions;
  busy: boolean;
}

const GROUPS: ThreadGroup[] = ["mine", "unsent", "waiting", "resolved"];

/** The right pane: comments and discussions live here, always (demo v432). One clause at a time; otherwise the grouped thread list. */
export const LeasePane = forwardRef<HTMLElement, Props>(function LeasePane({ lease, selected, onSelect, actions, busy }, ref) {
  const clause = selected ? lease.clauses.find((c) => c.id === selected) ?? null : null;
  const landlord = lease.contact.company ?? lease.landlord_name;
  return (
    <aside ref={ref} className="pl-pane portal-lease-pane card" aria-label={t("portal.lease.pane.title")} tabIndex={-1}>
      {clause ? (
        <ClauseView lease={lease} clause={clause} thread={threadOf(lease, clause.id)} landlord={landlord} onBack={() => onSelect(null)} actions={actions} busy={busy} />
      ) : (
        <ThreadList lease={lease} onSelect={onSelect} />
      )}
    </aside>
  );
});

// ---------------------------------------------------------------- list

function ThreadList({ lease, onSelect }: { lease: PortalLease; onSelect: (id: string) => void }) {
  const groups = GROUPS.map((g) => ({ g, items: lease.threads.filter((th) => groupOf(th) === g) })).filter((x) => x.items.length);
  return (
    <div className="pl-pane-in">
      <header className="pl-pane-h">
        <h3>{t("portal.lease.pane.title")}</h3>
        <span className="text-muted text-xs">{lease.threads.length ? t("portal.lease.pane.count", { n: lease.threads.length }) : null}</span>
      </header>
      {groups.length === 0 && (
        <p className="text-muted text-sm">{lease.can_comment ? t("portal.lease.pane.empty") : t("portal.lease.pane.emptyWait")}</p>
      )}
      {groups.map(({ g, items }) => (
        <section key={g} className="pl-group" aria-label={t(`portal.lease.pane.groups.${g}`)}>
          <div className="overline mb-2">{t(`portal.lease.pane.groups.${g}`)} · {items.length}</div>
          <div className="pl-rows">
            {items.map((th) => <ThreadRow key={th.id} th={th} onClick={() => onSelect(th.clause_id)} />)}
          </div>
        </section>
      ))}
      {lease.turn === "operator" && <OperatorTurnNote />}
    </div>
  );
}

function ThreadRow({ th, onClick }: { th: LeaseThread; onClick: () => void }) {
  const last = th.messages[th.messages.length - 1];
  const round = last?.meta?.round_nr;
  return (
    <button type="button" className="pl-row" onClick={onClick}>
      <span className="pl-row-t">{clauseTitle(th.clause_number, th.clause_heading)}</span>
      {last && <span className="pl-row-x">{last.body}</span>}
      <span className="pl-row-m">
        {th.status === "resolved" && th.resolution_label && <Pill tone={th.resolution === "unchanged" ? "neutral" : "success"}>{th.resolution_label}</Pill>}
        {typeof round === "number" && <Pill>{t("portal.decision.version", { n: round })}</Pill>}
      </span>
    </button>
  );
}

function OperatorTurnNote() {
  return <p className="pl-turn text-muted text-sm">{t("portal.lease.pane.operatorTurn")}</p>;
}

// ---------------------------------------------------------------- one clause

interface ClauseProps { lease: PortalLease; clause: PortalClause; thread: LeaseThread | null; landlord: string | null; onBack: () => void; actions: PaneActions; busy: boolean }

function ClauseView({ lease, clause, thread, landlord, onBack, actions, busy }: ClauseProps) {
  const note = thread ? threadNote(thread) : null;
  return (
    <div className="pl-pane-in">
      <button type="button" className="btn btn-text btn-sm pl-back" onClick={onBack}><IconChevronLeft />{t("portal.lease.pane.back")}</button>
      <div className="pl-clause">
        <div className="pl-clause-t">{clauseTitle(clause.number, clause.heading)}</div>
        {clause.overrides_label && <div className="text-muted text-xs mt-1">{t("portal.lease.pane.overrides", { label: clause.overrides_label })}</div>}
        <p className="pl-clause-x">{clause.text}</p>
      </div>

      {thread && thread.messages.length > 0 && (
        <div className="portal-thread pl-thread">
          {thread.messages.map((m) => (
            <MessageBubble key={m.id} m={m} landlord={landlord} tags={<MessageTags round={m.meta?.round_nr ?? null} kind={m.meta?.kind} />} />
          ))}
        </div>
      )}
      {note && (
        <div className={cx("pl-note", note.tone)}>
          {note.tone === "done" ? <IconCheck width={14} height={14} /> : <i aria-hidden="true" />}
          <span>{note.text}</span>
        </div>
      )}

      {lease.can_comment ? (
        <ClauseActions lease={lease} clause={clause} thread={thread} actions={actions} busy={busy} />
      ) : lease.turn === "operator" ? <OperatorTurnNote /> : null}
    </div>
  );
}

function MessageTags({ round, kind }: { round: number | null; kind?: string }) {
  const label = kindLabel(kind);
  return (
    <>
      {typeof round === "number" && <Pill className="ml-1">{t("portal.decision.version", { n: round })}</Pill>}
      {label && <Pill className="ml-1" tone={kind === "accept" || kind === "ok" ? "success" : kind === "proposal" ? "info" : "neutral"}>{label}</Pill>}
    </>
  );
}

// ---------------------------------------------------------------- the tenant's actions on a clause

function ClauseActions({ lease, clause, thread, actions, busy }: Omit<ClauseProps, "landlord" | "onBack">) {
  if (!thread) return <NewRemark lease={lease} clause={clause} onSubmit={(text, wish) => actions.openThread(clause.id, text, wish)} busy={busy} />;
  if (thread.status === "awaiting_confirmation" && thread.proposal?.by === "operator") {
    return <ProposalDecision lease={lease} proposal={thread.proposal} onAccept={() => actions.decide(thread.id, true)} onDecline={(text) => actions.decide(thread.id, false, text)} busy={busy} />;
  }
  if (thread.status === "awaiting_confirmation") return null; // the client's own proposal awaits the landlord — nothing to do (API gap: the portal cannot propose)
  if (thread.status === "resolved") {
    return <ReplyBox label={t("portal.lease.reply")} fieldLabel={t("portal.lease.replyLabel")} placeholder={t("portal.lease.reopenPlaceholder")} onSubmit={(text) => actions.reply(thread.id, text)} busy={busy} />;
  }
  if (isUnsent(thread)) {
    return <ReplyBox always fieldLabel={t("portal.lease.extend")} placeholder={t("portal.lease.extendPlaceholder")} submitLabel={t("portal.lease.add")} ghost onSubmit={(text) => actions.reply(thread.id, text)} busy={busy} />;
  }
  if (thread.whose_turn === "client") {
    return (
      <ReplyBox label={t("portal.lease.reply")} fieldLabel={t("portal.lease.replyLabel")} placeholder={t("portal.lease.replyPlaceholder")} onSubmit={(text) => actions.reply(thread.id, text)} busy={busy}
        extra={<button type="button" className="btn btn-ghost btn-sm" onClick={() => actions.ok(thread.id)} disabled={busy} title={t("portal.lease.okTitle")}><IconCheck />{t("portal.lease.ok")}</button>} />
    );
  }
  return null; // sent and waiting for the landlord — the note says so
}

function NewRemark({ lease, clause, onSubmit, busy }: { lease: PortalLease; clause: PortalClause; onSubmit: (text: string, wish?: LeaseWish) => Promise<unknown>; busy: boolean }) {
  const [text, setText] = useState("");
  const [wishOpen, setWishOpen] = useState(false);
  const [value, setValue] = useState("");
  useEffect(() => { setText(""); setWishOpen(false); setValue(""); }, [clause.id]);
  const factLabel = clause.fact_key ? lease.fact_keys[clause.fact_key] ?? clause.fact_key : null;
  const inputType = clause.fact_key ? factInputType(clause.fact_key) : "text";
  const wish: LeaseWish | undefined = wishOpen && clause.fact_key && value.trim() !== ""
    ? { fact_key: clause.fact_key, value: inputType === "number" ? Number(value) : value.trim(), label: factLabel ?? clause.fact_key }
    : undefined;
  const canSend = (text.trim() !== "" || !!wish) && !busy;
  const submit = async () => { if (!canSend) return; await onSubmit(text.trim(), wish); setText(""); setValue(""); setWishOpen(false); };
  return (
    <div className="pl-act">
      {factLabel && clause.fact_key && (
        <div className="pl-wish">
          <button type="button" className="btn btn-text btn-sm" onClick={() => setWishOpen((o) => !o)} aria-expanded={wishOpen}><IconEdit />{t("portal.lease.wish", { label: factLabel })}</button>
          {wishOpen && (
            <div className="field mb-0 mt-2">
              <label htmlFor="pl-wish-in">{t("portal.lease.wishValue")}</label>
              <input id="pl-wish-in" className="fld" type={inputType} step={inputType === "number" ? "any" : undefined} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
            </div>
          )}
        </div>
      )}
      <div className="field mb-0">
        <label htmlFor="pl-remark">{t("portal.lease.remark")}</label>
        <textarea id="pl-remark" className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("portal.lease.remarkPlaceholder")} maxLength={5000} />
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={!canSend} aria-busy={busy || undefined}>{t("portal.lease.addRemark")}</button>
      </div>
    </div>
  );
}

function ProposalDecision({ lease, proposal, onAccept, onDecline, busy }: { lease: PortalLease; proposal: LeaseProposal; onAccept: () => Promise<unknown>; onDecline: (text: string) => Promise<unknown>; busy: boolean }) {
  const [declining, setDeclining] = useState(false);
  const [text, setText] = useState("");
  const submitDecline = async () => { if (!text.trim() || busy) return; await onDecline(text.trim()); setText(""); setDeclining(false); };
  return (
    <div className="pl-act">
      <div className="pl-prop">
        <div className="overline mb-2">{t("portal.lease.proposal.title")}</div>
        {proposal.kind === "fact" && (
          <div className="pl-prop-fact">{t("portal.lease.proposal.fact", { label: lease.fact_keys[proposal.fact_key ?? ""] ?? proposal.fact_key ?? "", value: factText(proposal.fact_key, proposal.value) })}</div>
        )}
        {proposal.kind === "wording" && (
          <div className="portal-lease-wording">
            {proposal.before && <span className="portal-lease-before">{proposal.before}</span>}
            <span>{proposal.text}</span>
          </div>
        )}
        {proposal.kind === "special_term" && (
          <div><div>{proposal.text}</div><div className="text-muted text-xs mt-1">{t("portal.lease.proposal.special")}</div></div>
        )}
      </div>
      {!declining ? (
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className="btn btn-primary btn-sm" style={{ background: "var(--color-success)", boxShadow: "none" }} onClick={onAccept} disabled={busy} aria-busy={busy || undefined}><IconCheck />{t("portal.lease.confirm")}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDeclining(true)} disabled={busy}>{t("portal.lease.declineBtn")}</button>
        </div>
      ) : (
        <div className="field mb-0 mt-3">
          <label htmlFor="pl-decline">{t("portal.lease.declineLabel")}</label>
          <textarea id="pl-decline" className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("portal.lease.replyPlaceholder")} autoFocus maxLength={5000} />
          <div className="flex justify-end gap-2 mt-3">
            <button type="button" className="btn btn-text btn-sm" onClick={() => { setDeclining(false); setText(""); }} disabled={busy}>{t("common.cancel")}</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={submitDecline} disabled={!text.trim() || busy} aria-busy={busy || undefined}>{t("portal.lease.sendReply")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReplyProps { label?: string; fieldLabel: string; placeholder: string; submitLabel?: string; always?: boolean; ghost?: boolean; extra?: React.ReactNode; onSubmit: (text: string) => Promise<unknown>; busy: boolean }

/** „Vastan” opens the textarea (or it is always open for extending an unsent remark); the reply goes into the same thread. */
function ReplyBox({ label, fieldLabel, placeholder, submitLabel, always, ghost, extra, onSubmit, busy }: ReplyProps) {
  const [open, setOpen] = useState(!!always);
  const [text, setText] = useState("");
  const submit = async () => { if (!text.trim() || busy) return; await onSubmit(text.trim()); setText(""); if (!always) setOpen(false); };
  if (!open) {
    return (
      <div className="pl-act flex flex-wrap gap-2">
        {extra}
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setOpen(true)} disabled={busy}>{label}</button>
      </div>
    );
  }
  return (
    <div className="pl-act">
      <div className="field mb-0">
        <label htmlFor="pl-reply">{fieldLabel}</label>
        <textarea id="pl-reply" className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} autoFocus={!always} maxLength={5000} />
      </div>
      <div className="flex justify-end gap-2 mt-3">
        {!always && <button type="button" className="btn btn-text btn-sm" onClick={() => { setOpen(false); setText(""); }} disabled={busy}>{t("common.cancel")}</button>}
        <button type="button" className={cx("btn btn-sm", ghost ? "btn-ghost" : "btn-primary")} onClick={submit} disabled={!text.trim() || busy} aria-busy={busy || undefined}>{submitLabel ?? t("portal.lease.sendReply")}</button>
      </div>
    </div>
  );
}
