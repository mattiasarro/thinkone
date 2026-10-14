"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/api";
import { useLeaseAcceptAll, useLeaseChat, useLeaseDecide, useLeaseOk, useLeaseOpenThread, useLeaseReply, useLeaseSendRound } from "@/lib/queries/portal";
import type { PortalLease } from "@/types/portal";
import { ChatCard } from "./ChatCard";
import { StatusBox } from "./StatusBox";
import { LeaseBottomCards } from "./lease/LeaseBottomCards";
import { LeaseDocCard } from "./lease/LeaseDocCard";
import { LeasePane, type PaneActions } from "./lease/LeasePane";
import { LeaseSheet, type SelectSource } from "./lease/LeaseSheet";

const PANE_FIXED_FROM = 1440;

/** The tenant's lease draft: the A4 sheet is the only document view, the pane on the right holds every discussion, one guide card with one primary action. */
export function PortalLeasePage({ token, lease }: { token: string; lease: PortalLease }) {
  const toast = useToast();
  const openThread = useLeaseOpenThread(token);
  const reply = useLeaseReply(token);
  const decide = useLeaseDecide(token);
  const ok = useLeaseOk(token);
  const sendRound = useLeaseSendRound(token);
  const acceptAll = useLeaseAcceptAll(token);
  const chat = useLeaseChat(token);
  const busy = openThread.isPending || reply.isPending || decide.isPending || ok.isPending || sendRound.isPending || acceptAll.isPending;

  const [selected, setSelected] = useState<string | null>(null);
  const [source, setSource] = useState<SelectSource>(null);
  const [draft, setDraft] = useState("");
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [cover, setCover] = useState("");
  const pane = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLElement>(null);

  // the pane is fixed at the right edge on wide screens — the shell reserves room for it (.portal.has-pane)
  useEffect(() => {
    const root = document.querySelector(".portal");
    root?.classList.add("has-pane");
    return () => root?.classList.remove("has-pane");
  }, []);

  const scrollToPane = useCallback(() => {
    const el = pane.current;
    if (!el) return;
    if (window.innerWidth < PANE_FIXED_FROM) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else el.scrollTo({ top: 0, behavior: "smooth" });
    el.focus({ preventScroll: true });
  }, []);

  const selectFromDoc = useCallback((id: string) => { setSelected(id); setSource("doc"); }, []);
  const selectFromPane = useCallback((id: string | null) => { setSelected(id); setSource("pane"); }, []);

  // Esc and a click outside the pane/document release the selection (demo v761)
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (document.querySelector("[role='dialog']")) return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === "TEXTAREA" || a.tagName === "INPUT")) { a.blur(); return; }
      selectFromPane(null);
    };
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el || el.closest(".portal-lease-pane, .portal-lease-sheet, .portal-header, button, a, input, textarea, select, label, [role='dialog']")) return;
      selectFromPane(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown); };
  }, [selected, selectFromPane]);

  const run = useCallback(async (p: Promise<unknown>, okText: string) => {
    try { await p; toast.success(okText); } catch (e) { toast.error(errorMessage(e)); throw e; }
  }, [toast]);

  const actions: PaneActions = {
    openThread: (clause_id, text, wish) => run(openThread.mutateAsync({ clause_id, text, wish }), t("portal.lease.toast.remark")),
    reply: (thread_id, text) => run(reply.mutateAsync({ thread_id, text }), t("portal.lease.toast.reply")),
    decide: (thread_id, accept, text) => run(decide.mutateAsync({ thread_id, accept, text }), accept ? t("portal.lease.toast.confirmed") : t("portal.lease.toast.declined")),
    ok: (thread_id) => run(ok.mutateAsync(thread_id), t("portal.lease.toast.ok")),
  };

  const goToPending = () => {
    const first = lease.threads.find((th) => th.status !== "resolved" && th.whose_turn === "client");
    if (first) selectFromPane(first.clause_id);
    scrollToPane();
  };

  // one primary action (demo v807): accept all · send the letter · decide the proposals
  const mine = lease.turn === "client";
  let cta: React.ReactNode = null;
  if (mine && lease.open_count === 0) {
    cta = <button type="button" className="btn btn-primary" onClick={() => setAcceptOpen(true)} disabled={busy}>{t("portal.lease.acceptAll")}</button>;
  } else if (lease.can_send) {
    cta = <button type="button" className="btn btn-primary" onClick={() => setSendOpen(true)} disabled={busy}>{lease.unsent_count > 0 ? t("portal.lease.sendRound", { n: lease.unsent_count }) : t("portal.lease.sendAnswers")}</button>;
  } else if (mine && lease.pending_count > 0) {
    cta = <button type="button" className="btn btn-primary" onClick={goToPending}>{t("portal.lease.decidePending", { n: lease.pending_count })}</button>;
  }
  const tone = mine ? "client" : lease.status === "ready_to_sign" ? "done" : "wait";
  const landlord = lease.contact.company ?? lease.landlord_name ?? lease.party_name;

  return (
    <div className="portal-lease">
      <header className="pl-head">
        <h1 className="portal-h1">{t("portal.hello", { name: lease.client_name })}</h1>
        <p className="text-muted mt-2">{t("portal.lease.line", { number: lease.number, property: lease.property_name ?? landlord, spaces: lease.space_names.join(", ") })}</p>
      </header>

      <div className="pl-guide"><StatusBox tone={tone} title={lease.step_title} text={lease.step_text} cta={cta} /></div>

      <section className="pl-docs" aria-label={t("portal.yourDocs")}>
        <div className="portal-sek"><h2>{t("portal.yourDocs")}</h2><span>{t("portal.docCount")}</span></div>
        <LeaseDocCard lease={lease} />
      </section>

      <LeasePane ref={pane} lease={lease} selected={selected} onSelect={selectFromPane} actions={actions} busy={busy} />

      <LeaseSheet ref={sheet} lease={lease} selected={selected} source={source} onDocSelect={selectFromDoc} />

      <ChatCard className="pl-chat" messages={lease.chat} landlord={lease.contact.company} draft={draft} setDraft={setDraft} busy={chat.isPending}
        onSend={(text) => run(chat.mutateAsync(text), t("portal.lease.toast.chat"))} />

      <LeaseBottomCards lease={lease} />

      <Modal open={acceptOpen} onClose={() => setAcceptOpen(false)} title={t("portal.lease.acceptTitle")} footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setAcceptOpen(false)} disabled={busy}>{t("common.cancel")}</button>
          <button type="button" className="btn btn-primary" style={{ background: "var(--color-success)", boxShadow: "none" }} disabled={busy} aria-busy={busy || undefined}
            onClick={() => { void run(acceptAll.mutateAsync(), t("portal.lease.toast.accepted")).then(() => setAcceptOpen(false)).catch(() => {}); }}>{t("portal.lease.acceptAll")}</button>
        </>
      }>
        <p>{t("portal.lease.acceptBody")}</p>
      </Modal>

      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t("portal.lease.sendTitle")} sub={t("portal.lease.sendBody")} footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setSendOpen(false)} disabled={busy}>{t("common.cancel")}</button>
          <button type="button" className="btn btn-primary" disabled={busy} aria-busy={busy || undefined}
            onClick={() => { void run(sendRound.mutateAsync(cover), t("portal.lease.toast.sent")).then(() => { setSendOpen(false); setCover(""); }).catch(() => {}); }}>{t("portal.lease.send")}</button>
        </>
      }>
        <div className="field mb-0">
          <label htmlFor="pl-cover">{t("portal.lease.coverNote")}</label>
          <textarea id="pl-cover" className="fld" rows={3} value={cover} onChange={(e) => setCover(e.target.value)} placeholder={t("portal.lease.coverPlaceholder")} maxLength={5000} />
        </div>
      </Modal>
    </div>
  );
}
