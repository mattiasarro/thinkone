"use client";
import { useCallback, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { IconLock } from "@/components/ui/Icons";
import { ErrorState } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/api";
import { isLinkGone, usePortalAccept, usePortalMessage, usePortalPropose, usePortalQuote, usePortalReject } from "@/lib/queries/portal";
import { BottomCards } from "./BottomCards";
import { ChatCard } from "./ChatCard";
import { DecisionCard } from "./DecisionCard";
import { DocumentCards } from "./DocumentCards";
import { DocumentSheet } from "./DocumentSheet";
import { StatusBox } from "./StatusBox";

export function PortalQuotePage({ token }: { token: string }) {
  const { data: q, isLoading, error, refetch } = usePortalQuote(token);
  const toast = useToast();
  const accept = usePortalAccept(token);
  const propose = usePortalPropose(token);
  const reject = usePortalReject(token);
  const message = usePortalMessage(token);
  const busy = accept.isPending || propose.isPending || reject.isPending || message.isPending;

  const [draft, setDraft] = useState("");
  const chatInput = useRef<HTMLTextAreaElement>(null);
  const decision = useRef<HTMLElement>(null);

  const goToDecision = useCallback(() => {
    decision.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    decision.current?.focus({ preventScroll: true });
  }, []);
  const prefill = useCallback((text: string) => {
    setDraft(text);
    const el = chatInput.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    requestAnimationFrame(() => { el.focus({ preventScroll: true }); const i = text.indexOf("…"); if (i >= 0) el.setSelectionRange(i, i + 1); });
  }, []);

  const run = useCallback(async (p: Promise<unknown>, ok: string) => {
    try { await p; toast.success(ok); } catch (e) { toast.error(errorMessage(e)); throw e; }
  }, [toast]);

  if (isLoading) return <PortalSkeleton />;
  if (error && isLinkGone(error)) return <LinkGone />;
  if (error || !q) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <div className="grid gap-10">
      <header>
        <h1 className="portal-h1">{t("portal.hello", { name: q.client_name })}</h1>
        <p className="text-muted mt-2">{t("portal.docsLine", { landlord: q.contact.company ?? q.party_name })}{q.whose_turn === "client" && q.can_respond ? ` · ${t("portal.awaitingYou")}` : ""}</p>
      </header>

      <StatusBox q={q} onGoToDecision={goToDecision} />

      <section aria-label={t("portal.yourDocs")}>
        <div className="portal-sek"><h2>{t("portal.yourDocs")}</h2><span>{t("portal.docCount")}</span></div>
        <DocumentCards q={q} onWish={prefill} />
      </section>

      <DocumentSheet q={q} />

      <DecisionCard
        ref={decision}
        q={q}
        busy={busy}
        onAccept={() => { void run(accept.mutateAsync(), t("portal.toast.accepted")).catch(() => {}); }}
        onPropose={(text) => run(propose.mutateAsync(text), t("portal.toast.proposed"))}
        onReject={(reason) => run(reject.mutateAsync(reason), t("portal.toast.rejected"))}
      />

      <ChatCard ref={chatInput} q={q} draft={draft} setDraft={setDraft} busy={message.isPending} onSend={(text) => run(message.mutateAsync(text), t("portal.toast.sent"))} />

      <BottomCards q={q} />
    </div>
  );
}

function LinkGone() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card pad className="w-full max-w-[460px] text-center">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full grid place-items-center text-muted" style={{ background: "var(--color-surface-subtle)" }}><IconLock /></div>
        <h2 className="text-lg">{t("portal.invalid.title")}</h2>
        <p className="text-muted text-sm mt-2">{t("portal.invalid.sub")}</p>
      </Card>
    </div>
  );
}

function PortalSkeleton() {
  return (
    <div className="grid gap-10" role="status" aria-label={t("common.loading")}>
      <div><div className="skel h-9 w-64 max-w-full" /><div className="skel h-4 w-48 mt-3" /></div>
      <div className="card pad flex items-center gap-4"><div className="skel w-14 h-14 rounded-2xl" /><div className="flex-1"><div className="skel h-5 w-1/2" /><div className="skel h-4 w-3/4 mt-2" /></div></div>
      <div className="portal-cards"><div className="card pad"><div className="skel h-4 w-1/3" /><div className="skel h-6 w-2/3 mt-4" /><div className="skel h-8 w-1/2 mt-5" /></div><div className="card pad"><div className="skel h-5 w-1/2" /><div className="skel h-4 w-full mt-3" /></div></div>
      <div className="skel h-[600px] w-full rounded-[var(--radius-surface)]" />
    </div>
  );
}
