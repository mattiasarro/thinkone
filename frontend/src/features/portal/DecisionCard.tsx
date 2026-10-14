"use client";
import { forwardRef, useState } from "react";
import { CardHeader } from "@/components/ui/Card";
import { IconCheck } from "@/components/ui/Icons";
import { Modal } from "@/components/ui/Modal";
import { t } from "@/i18n";
import type { PortalQuote } from "@/types/portal";
import { MessageBubble } from "./MessageBubble";

interface Props {
  q: PortalQuote;
  busy: boolean;
  onAccept: () => void;
  onPropose: (text: string) => Promise<unknown>;
  onReject: (reason?: string) => Promise<unknown>;
}

export const DecisionCard = forwardRef<HTMLElement, Props>(function DecisionCard({ q, busy, onAccept, onPropose, onReject }, ref) {
  const [negotiating, setNegotiating] = useState(false);
  const [proposal, setProposal] = useState("");
  const [extension, setExtension] = useState("");
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const thread = q.messages.filter((m) => m.channel === "negotiation");
  const landlord = q.contact.company;

  const submitProposal = async () => { if (!proposal.trim()) return; await onPropose(proposal.trim()); setProposal(""); setNegotiating(false); };
  const submitExtension = async () => { if (!extension.trim()) return; await onPropose(extension.trim()); setExtension(""); };

  let body: React.ReactNode;
  if (q.can_respond) {
    body = (
      <div className="grid gap-4">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary" style={{ background: "var(--color-success)", boxShadow: "none" }} onClick={() => setAcceptOpen(true)} disabled={busy}>
            <IconCheck />{t("portal.decision.accept")}
          </button>
          {!negotiating && <button type="button" className="btn btn-ghost" onClick={() => setNegotiating(true)} disabled={busy}>{t("portal.decision.negotiate")}</button>}
        </div>
        {negotiating && (
          <div className="field mb-0">
            <label htmlFor="portal-proposal">{t("portal.decision.proposalLabel")}</label>
            <textarea id="portal-proposal" className="fld" rows={4} value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder={t("portal.decision.proposalPlaceholder")} autoFocus maxLength={5000} />
            <div className="flex gap-2 mt-3 flex-wrap">
              <button type="button" className="btn btn-primary" onClick={submitProposal} disabled={!proposal.trim()} aria-busy={busy || undefined}>{t("portal.decision.sendProposal")}</button>
              <button type="button" className="btn btn-text" onClick={() => { setNegotiating(false); setProposal(""); }} disabled={busy}>{t("common.cancel")}</button>
            </div>
          </div>
        )}
        <hr className="border-0 border-t" style={{ borderColor: "var(--line)" }} />
        <div>
          <button type="button" className="btn btn-text btn-destructive btn-sm" onClick={() => setRejectOpen(true)} disabled={busy}>{t("portal.decision.reject")}</button>
        </div>
      </div>
    );
  } else if (q.status === "client_proposal") {
    body = (
      <div className="grid gap-4">
        <div className="note">
          <span className="portal-dots" aria-hidden="true"><i /><i /><i /></span>
          <div><b>{t("portal.decision.waiting")}</b><div className="text-xs opacity-80">{t("portal.decision.waitingSub")}</div></div>
        </div>
        {q.can_extend && (
          <div className="field mb-0">
            <label htmlFor="portal-extend">{t("portal.decision.extendLabel")}</label>
            <textarea id="portal-extend" className="fld" rows={3} value={extension} onChange={(e) => setExtension(e.target.value)} placeholder={t("portal.decision.extendPlaceholder")} maxLength={5000} />
            <div className="mt-3"><button type="button" className="btn btn-ghost" onClick={submitExtension} disabled={!extension.trim()} aria-busy={busy || undefined}>{t("portal.decision.extendSend")}</button></div>
          </div>
        )}
      </div>
    );
  } else if (q.status === "accepted") {
    body = <div className="note success"><IconCheck width={18} height={18} /><span>{t("portal.decision.accepted")}</span></div>;
  } else {
    body = <div className="note"><span>{q.step_text || q.step_title}</span></div>;
  }

  return (
    <section ref={ref} id="otsus" className="card scroll-mt-20" tabIndex={-1} aria-label={t("portal.decision.title")}>
      <CardHeader title={t("portal.decision.title")}>{q.can_respond && <p className="text-muted text-sm mt-0.5">{t("portal.decision.sub")}</p>}</CardHeader>
      <div className="card-b grid gap-6">
        {body}
        {thread.length > 0 && (
          <div>
            <div className="overline mb-3">{t("portal.decision.thread")}</div>
            <div className="portal-thread">
              {thread.map((m) => <MessageBubble key={m.id} m={m} landlord={landlord} showVersion />)}
            </div>
          </div>
        )}
      </div>

      <Modal open={acceptOpen} onClose={() => setAcceptOpen(false)} title={t("portal.decision.acceptTitle")} footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setAcceptOpen(false)} disabled={busy}>{t("common.cancel")}</button>
          <button type="button" className="btn btn-primary" style={{ background: "var(--color-success)", boxShadow: "none" }} onClick={onAccept} aria-busy={busy || undefined} disabled={busy}>{t("portal.decision.accept")}</button>
        </>
      }>
        <p>{t("portal.decision.acceptBody")}</p>
      </Modal>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title={t("portal.decision.rejectTitle")} sub={t("portal.decision.rejectBody")} footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={() => setRejectOpen(false)} disabled={busy}>{t("common.cancel")}</button>
          <button type="button" className="btn btn-destructive" onClick={async () => { await onReject(reason); setRejectOpen(false); setReason(""); }} aria-busy={busy || undefined} disabled={busy}>{t("portal.decision.reject")}</button>
        </>
      }>
        <div className="field mb-0">
          <label htmlFor="portal-reject-reason">{t("portal.decision.rejectReason")}</label>
          <textarea id="portal-reject-reason" className="fld" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={2000} />
        </div>
      </Modal>
    </section>
  );
});
