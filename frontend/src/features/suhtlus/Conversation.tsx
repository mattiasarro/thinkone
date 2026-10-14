"use client";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { t, tEnum } from "@/i18n";
import { errorMessage } from "@/lib/api";
import { cx, fmtDate, fmtDateTime, isoDay } from "@/lib/format";
import { useMarkThreadRead, useSendThreadMessage, useThreadQuote } from "@/lib/queries/suhtlus";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, statusTone } from "@/components/ui/Pill";
import { ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { IconChevronLeft, IconExternal } from "@/components/ui/Icons";
import type { Thread, ThreadMessage, ThreadQuote } from "@/types/suhtlus";
import { Avatar } from "./ThreadList";

const timeFmt = new Intl.DateTimeFormat("et-EE", { hour: "2-digit", minute: "2-digit" });

export function Conversation({ id, thread, onBack }: { id: string; thread: Thread | undefined; onBack: () => void }) {
  if (thread?.subject_type === "contract") return <ContractStub thread={thread} onBack={onBack} />;
  return <QuoteConversation id={id} thread={thread} onBack={onBack} />;
}

function BackButton({ onBack }: { onBack: () => void }) {
  return <Button variant="text" size="sm" className="lg:hidden -ml-2" onClick={onBack}><IconChevronLeft />{t("suhtlus.back")}</Button>;
}

function ContractStub({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  return (
    <section className="card flex flex-col">
      <header className="card-h">
        <div className="min-w-0 grid gap-1">
          <BackButton onBack={onBack} />
          <h3 className="truncate">{thread.title}</h3>
        </div>
        <LinkButton href={thread.link} size="sm">{t("suhtlus.openContract")}<IconExternal /></LinkButton>
      </header>
      <div className="card-b"><div className="note info">{t("suhtlus.contractSoon")}</div></div>
    </section>
  );
}

function QuoteConversation({ id, thread, onBack }: { id: string; thread: Thread | undefined; onBack: () => void }) {
  const q = useThreadQuote(id);
  const markRead = useMarkThreadRead(id);
  const marked = useRef<string | null>(null);
  const unread = (thread?.unread ?? 0) > 0 || (q.data?.unread ?? 0) > 0;
  useEffect(() => {
    if (!q.data || !unread || marked.current === id) return;
    marked.current = id;
    markRead.mutate();
  }, [id, unread, q.data, markRead]);

  if (q.isLoading && !q.data) return <section className="card p-6"><Loading rows={6} /></section>;
  if (q.error || !q.data) return <section className="card p-6"><BackButton onBack={onBack} /><ErrorState error={q.error} onRetry={() => q.refetch()} /></section>;
  return <QuoteThread quote={q.data} onBack={onBack} />;
}

function QuoteThread({ quote, onBack }: { quote: ThreadQuote; onBack: () => void }) {
  const href = `/app/portfell/pakkumine/${quote.id}`;
  const messages = useMemo(() => [...quote.messages].sort((a, b) => a.created_at.localeCompare(b.created_at)), [quote.messages]);
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, quote.id]);
  const step = quote.next_step;
  const mine = step?.side === "operator";

  return (
    <section className="card flex flex-col min-h-0 lg:h-[calc(100vh-200px)] lg:min-h-[480px]">
      <header className="card-h">
        <div className="min-w-0 grid gap-1">
          <BackButton onBack={onBack} />
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={quote.party.name} large />
            <div className="min-w-0">
              <h3 className="truncate flex items-center gap-2 flex-wrap">
                <span>{quote.number} · {quote.party.name}</span>
                <Pill tone={statusTone(quote.status)}>{tEnum("quotes.status", quote.status)}</Pill>
              </h3>
              <div className="text-sm text-muted truncate">{[quote.property.name, ...quote.space_names].filter(Boolean).join(" · ")}</div>
            </div>
          </div>
        </div>
        <LinkButton href={href} size="sm">{t("suhtlus.openQuote")}<IconExternal /></LinkButton>
      </header>

      {step && (
        <div className={cx("note mx-4 mt-4 items-start", mine ? "warning" : "")} role="status">
          <Pill tone={mine ? "warning" : "neutral"} className="flex-none">{mine ? t("suhtlus.yourTurn") : t("suhtlus.clientTurn")}</Pill>
          <div className="min-w-0"><b>{step.title}</b>{step.text && <span className="block text-sm mt-0.5" style={{ color: "var(--color-text)" }}>{step.text}</span>}</div>
        </div>
      )}

      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto p-4 grid gap-3 content-start max-h-[60vh] lg:max-h-none">
        {messages.length === 0 && <div className="empty py-8 text-sm">{t("suhtlus.noMessages")}</div>}
        <Timeline messages={messages} />
      </div>

      <Composer quote={quote} href={href} />
    </section>
  );
}

function Timeline({ messages }: { messages: ThreadMessage[] }) {
  const today = isoDay(new Date());
  let prevDay = "";
  return (
    <>
      {messages.map((m) => {
        const day = isoDay(new Date(m.created_at));
        const sep = day !== prevDay;
        prevDay = day;
        return (
          <div key={m.id} className="contents">
            {sep && (
              <div className="flex items-center gap-3 text-xs text-muted my-1" aria-hidden="true">
                <span className="flex-1 h-px" style={{ background: "var(--line)" }} /><span>{day === today ? t("common.today") : fmtDate(m.created_at)}</span><span className="flex-1 h-px" style={{ background: "var(--line)" }} />
              </div>
            )}
            <Bubble m={m} />
          </div>
        );
      })}
    </>
  );
}

function Bubble({ m }: { m: ThreadMessage }) {
  const time = timeFmt.format(new Date(m.created_at));
  const neg = m.channel === "negotiation";
  const tags = neg && (
    <span className="inline-flex gap-1 items-center">
      {m.meta.version !== undefined && <Pill tone="info">{t("suhtlus.version", { n: m.meta.version })}</Pill>}
      {m.meta.kind && <span className="text-xs text-muted">{tEnum("suhtlus.kind", m.meta.kind)}</span>}
    </span>
  );
  if (m.author_type === "system") {
    return (
      <div className="justify-self-center text-center text-xs text-muted max-w-[85%]" title={fmtDateTime(m.created_at)}>
        <span className="whitespace-pre-wrap">{m.body}</span>{tags && <span className="ml-2">{tags}</span>} · {time}
      </div>
    );
  }
  const mine = m.author_type === "operator";
  return (
    <div className={cx("max-w-[85%] sm:max-w-[72%] grid gap-1", mine ? "justify-self-end text-right" : "justify-self-start")}>
      <div className={cx("rounded-surface px-3.5 py-2.5 text-sm text-left whitespace-pre-wrap break-words", mine ? "bg-primary-subtle" : "bg-surface-subtle")}>
        {tags && <div className="mb-1">{tags}</div>}
        {m.body}
      </div>
      <div className="text-xs text-muted">{mine ? (m.author_name || t("suhtlus.you")) : (m.author_name || t("suhtlus.client"))} · <time dateTime={m.created_at} title={fmtDateTime(m.created_at)}>{time}</time></div>
    </div>
  );
}

function Composer({ quote, href }: { quote: ThreadQuote; href: string }) {
  const [text, setText] = useState("");
  const send = useSendThreadMessage(quote.id);
  const toast = useToast();
  if (quote.status === "client_proposal") {
    return (
      <footer className="p-4 border-t" style={{ borderColor: "var(--line)" }}>
        <div className="note warning items-center justify-between flex-wrap">
          <span>{t("suhtlus.proposalNote")}</span>
          <LinkButton href={href} size="sm" variant="primary">{t("suhtlus.openQuote")}</LinkButton>
        </div>
      </footer>
    );
  }
  const submit = async () => {
    const body = text.trim();
    if (!body || send.isPending) return;
    try { await send.mutateAsync(body); setText(""); toast.success(t("suhtlus.sent")); } catch (e) { toast.error(errorMessage(e)); }
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(); }
  };
  return (
    <footer className="p-4 border-t grid gap-2" style={{ borderColor: "var(--line)" }}>
      <form className="flex gap-2 items-end" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <textarea className="fld flex-1 min-h-[44px]" rows={2} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={onKey} placeholder={t("suhtlus.write")} aria-label={t("suhtlus.write")} />
        <Button type="submit" variant="primary" busy={send.isPending} disabled={!text.trim()}>{t("suhtlus.send")}</Button>
      </form>
      <p className="text-xs text-muted m-0 hidden sm:block">{t("suhtlus.hint")}</p>
    </footer>
  );
}
