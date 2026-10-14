"use client";
import { forwardRef, useEffect, useRef, type KeyboardEvent } from "react";
import { IconArrowRight, IconChat } from "@/components/ui/Icons";
import { t } from "@/i18n";
import type { PortalQuote } from "@/types/portal";
import { MessageBubble } from "./MessageBubble";

interface Props { q: PortalQuote; draft: string; setDraft: (v: string) => void; busy: boolean; onSend: (text: string) => Promise<unknown> }

/** Human↔human chat with the landlord (demo v786: alone, full width). The ref points at the textarea so the wish chips can pre-fill it. */
export const ChatCard = forwardRef<HTMLTextAreaElement, Props>(function ChatCard({ q, draft, setDraft, busy, onSend }, ref) {
  const list = useRef<HTMLDivElement>(null);
  const msgs = q.messages.filter((m) => m.channel === "chat");
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [msgs.length]);

  const send = async () => { const text = draft.trim(); if (!text || busy) return; await onSend(text); setDraft(""); };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } };

  return (
    <section className="card" aria-label={t("portal.chat.title")}>
      <header className="card-h">
        <div className="min-w-0"><h3>{t("portal.chat.title")}</h3><p className="text-muted text-sm mt-0.5">{t("portal.chat.sub")}</p></div>
      </header>
      <div ref={list} className="portal-chat-list" aria-live="polite">
        {msgs.length ? msgs.map((m) => <MessageBubble key={m.id} m={m} landlord={q.contact.company} />) : (
          <div className="empty py-8"><div className="mx-auto mb-2 w-6 h-6 text-muted"><IconChat /></div><p className="text-sm">{t("portal.chat.empty")}</p></div>
        )}
      </div>
      <div className="portal-chat-in">
        <label htmlFor="portal-chat" className="sr-only">{t("portal.chat.placeholder")}</label>
        <textarea ref={ref} id="portal-chat" className="fld" rows={1} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} placeholder={t("portal.chat.placeholder")} maxLength={5000} />
        <button type="button" className="portal-send" onClick={send} disabled={!draft.trim() || busy} aria-label={t("portal.chat.send")} title={t("portal.chat.send")}><IconArrowRight /></button>
      </div>
    </section>
  );
});
