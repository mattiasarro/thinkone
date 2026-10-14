"use client";
import { useEffect, useRef } from "react";
import { t } from "@/i18n";
import { IconAi, IconArrowRight } from "@/components/ui/Icons";
import type { AiMessage } from "@/types/ai";
import { MessageView } from "./MessageView";

const EXAMPLES = ["indexation", "freeSpaces", "openQuotes", "ending", "keyDates"] as const;

export function Conversation({ messages, threadId, contextContractId, liveId, onSend, onEdit }: {
  messages: AiMessage[]; threadId: string | null; contextContractId: string | null; liveId: string | null; onSend: (text: string) => void; onEdit: (prefill: string) => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  const lastKey = last ? `${last.id}:${last.text.length}:${last.steps.length}:${last.cards.length}` : "";
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [lastKey, threadId]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center text-center pt-12 pb-6 rise">
        <span aria-hidden="true" className="w-[54px] h-[54px] rounded-[16px] grid place-items-center text-white" style={{ background: "var(--color-text)", boxShadow: "0 0 32px -4px var(--color-primary-ring)" }}><IconAi width={24} height={24} /></span>
        <h2 className="mt-5 mb-2 text-[26px] leading-tight font-heading">{t("ai.emptyTitle")}</h2>
        <p className="m-0 max-w-[54ch] text-sm leading-relaxed text-muted">{t("ai.emptySub")}</p>
        <div className="grid sm:grid-cols-2 gap-2.5 w-full max-w-[640px] mt-7">
          {EXAMPLES.map((k) => (
            <button key={k} type="button" onClick={() => onSend(t(`ai.examples.${k}`))}
              className="flex items-start gap-2.5 min-h-[56px] px-4 py-3 rounded-[14px] border bg-surface text-left text-[13.5px] leading-snug font-medium text-ink/85 hover:text-ink hover:bg-canvas transition-colors"
              style={{ borderColor: "var(--line)" }}>
              <IconArrowRight width={15} height={15} className="flex-none mt-0.5 text-muted" />{t(`ai.examples.${k}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-7" aria-live="polite" aria-busy={!!liveId}>
      {messages.map((m) => <MessageView key={m.id} m={m} threadId={threadId ?? ""} contextContractId={contextContractId} live={m.id === liveId || m.status === "streaming"} onEdit={onEdit} />)}
      <div ref={end} />
    </div>
  );
}
