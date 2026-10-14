"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/api";
import { AI_KEYS, useAiThread, useAiThreads, useCreateAiThread, useDeleteAiThread, useRestoreAiThread } from "@/lib/queries/ai";
import { useToast } from "@/components/ui/Toast";
import { IconArrowRight, IconInfo, IconMenu, IconX } from "@/components/ui/Icons";
import type { AiContextType, AiMessage, AiThread, AiThreadDetail, AiThreadInput } from "@/types/ai";
import { streamAiMessage } from "./sse";
import { ThreadList, contextLabel, threadTitle } from "./ThreadList";
import { Conversation } from "./Conversation";
import { Composer, type ComposerHandle } from "./Composer";

const CONTEXT_TYPES = new Set<string>(["contract", "quote", "party", "asset", "portfolio"]);
const UNDO_MS = 10_000;

interface Live { threadId: string; user: AiMessage; assistant: AiMessage }

function msg(role: AiMessage["role"], text: string, status: AiMessage["status"], id: string): AiMessage {
  return { id, role, text, steps: [], cards: [], citations: [], status, model: null, created_at: new Date().toISOString() };
}

/** AI — one axis: context chip · conversation · composer centred in one column; thread history on the left (drawer on mobile). */
export function AiPage() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const toast = useToast();

  const tParam = params.get("t");
  const qParam = params.get("q");
  const ctxTypeParam = params.get("context_type");
  const ctxType: AiContextType | null = ctxTypeParam && CONTEXT_TYPES.has(ctxTypeParam) ? (ctxTypeParam as AiContextType) : null;
  const ctxId = params.get("context_id");
  const origin = params.get("origin");

  const [activeId, setActiveId] = useState<string | null>(tParam);
  useEffect(() => { setActiveId(tParam); }, [tParam]);

  const threads = useAiThreads();
  const thread = useAiThread(activeId);
  const create = useCreateAiThread();
  const del = useDeleteAiThread();
  const restore = useRestoreAiThread();

  const [draft, setDraft] = useState("");
  const [live, setLive] = useState<Live | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [undo, setUndo] = useState<AiThread | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const composer = useRef<ComposerHandle>(null);

  // ---- streaming turn -------------------------------------------------------------------------------------------
  const send = useCallback(async (threadId: string, text: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const user = msg("user", text, "done", `u-${Date.now()}`);
    let assistant = msg("assistant", "", "streaming", "live");
    setLive({ threadId, user, assistant });
    const update = (fn: (a: AiMessage) => AiMessage) => {
      assistant = fn(assistant);
      const next = assistant;
      setLive((l) => (l && l.threadId === threadId ? { ...l, assistant: next } : l));
    };
    let persisted = true;
    try {
      await streamAiMessage(threadId, text, (ev) => {
        if (ev.type === "step") update((a) => ({ ...a, steps: [...a.steps, { tool: ev.tool, args: ev.args, summary: ev.summary, ok: ev.ok, auto: ev.auto }] }));
        else if (ev.type === "delta") update((a) => ({ ...a, text: a.text + ev.text }));
        else if (ev.type === "card") update((a) => ({ ...a, cards: [...a.cards, ev.card] }));
        else if (ev.type === "done") update((a) => ({ ...a, id: ev.message_id ?? a.id, status: ev.status, text: ev.text ?? a.text, citations: ev.citations ?? a.citations, error: ev.error ?? null }));
      }, ctrl.signal);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      persisted = false;
      update((a) => ({ ...a, status: "failed", error: errorMessage(e) }));
    }
    if (ctrl.signal.aborted) return;
    if (!persisted) return; // keep the failed turn on screen; the server has nothing to refetch
    const finalAssistant = assistant;
    qc.setQueryData<AiThreadDetail>(AI_KEYS.thread(threadId), (old) =>
      old ? { ...old, title: old.title || text.slice(0, 80), last_message_at: new Date().toISOString(), messages: [...old.messages, user, finalAssistant] } : old);
    setLive((l) => (l && l.threadId === threadId ? null : l));
    void qc.invalidateQueries({ queryKey: AI_KEYS.thread(threadId) });
    void qc.invalidateQueries({ queryKey: AI_KEYS.threads });
    void qc.invalidateQueries({ queryKey: AI_KEYS.usage });
  }, [qc]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const newThread = useCallback(async (input: AiThreadInput): Promise<AiThreadDetail | null> => {
    try {
      const th = await create.mutateAsync(input);
      setActiveId(th.id);
      router.replace(`/app/ai?t=${th.id}`);
      return th;
    } catch (e) { toast.error(errorMessage(e)); return null; }
  }, [create, router, toast]);

  const onSend = useCallback(async (text: string) => {
    if (live && live.assistant.status === "streaming") return;
    setDraft("");
    let id = activeId;
    if (!id) {
      const th = await newThread({});
      if (!th) return;
      id = th.id;
    }
    await send(id, text);
  }, [activeId, live, newThread, send]);

  // ---- URL entry points: ?q= (send now, context optional) · ?context_type&context_id (new thread with context) ----
  const handled = useRef<string | null>(null);
  useEffect(() => {
    const key = params.toString();
    if (tParam || handled.current === key) return;
    if (!qParam && !(ctxType && ctxId)) return;
    handled.current = key;
    const input: AiThreadInput = ctxType && ctxId ? { context_type: ctxType, context_id: ctxId, origin_path: origin ?? null } : {};
    void (async () => {
      const th = await newThread(input);
      if (th && qParam?.trim()) await send(th.id, qParam.trim());
    })();
  }, [params, tParam, qParam, ctxType, ctxId, origin, newThread, send]);

  // ---- delete + 10 s undo ---------------------------------------------------------------------------------------
  const onDelete = useCallback((th: AiThread) => {
    del.mutate(th.id, { onError: (e) => toast.error(errorMessage(e)) });
    if (th.id === activeId) { abortRef.current?.abort(); setLive(null); setActiveId(null); router.replace("/app/ai"); }
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(th);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
  }, [activeId, del, router, toast]);
  const onUndo = useCallback(() => {
    const th = undo;
    if (!th) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndo(null);
    restore.mutate(th.id, { onSuccess: () => { toast.success(t("ai.restored")); router.push(`/app/ai?t=${th.id}`); }, onError: (e) => toast.error(errorMessage(e)) });
  }, [undo, restore, router, toast]);
  useEffect(() => () => { if (undoTimer.current) clearTimeout(undoTimer.current); }, []);

  // ---- derived --------------------------------------------------------------------------------------------------
  const detail = thread.data;
  const messages = useMemo<AiMessage[]>(() => {
    const base = activeId && detail?.id === activeId ? detail.messages : [];
    return live && live.threadId === activeId ? [...base, live.user, live.assistant] : base;
  }, [activeId, detail, live]);
  const streaming = !!live && live.threadId === activeId && live.assistant.status === "streaming";
  const liveId = live && live.threadId === activeId ? live.assistant.id : null;
  const contextContractId = detail?.context_type === "contract" ? detail.context_id : null;
  const chipLabel = activeId ? contextLabel(detail) : t("ai.wholePortfolio");
  const originPath = detail?.origin_path && detail.origin_path.startsWith("/") ? detail.origin_path : null;

  const select = (id: string) => { setDrawer(false); router.push(`/app/ai?t=${id}`); };
  const startNew = () => { setDrawer(false); abortRef.current?.abort(); setLive(null); setActiveId(null); setDraft(""); router.push("/app/ai"); composer.current?.focus(); };
  const onEdit = (prefill: string) => { setDraft(prefill); composer.current?.focus(); };

  const list = (
    <ThreadList threads={threads.data} isLoading={threads.isLoading} activeId={activeId} onSelect={select} onNew={startNew} onDelete={onDelete} />
  );

  return (
    <div className="-m-[var(--page-gutter)] h-[calc(100vh-var(--layout-header))] md:grid md:grid-cols-[272px_minmax(0,1fr)]">
      {/* history — left column */}
      <aside className="hidden md:flex flex-col min-h-0 h-full px-3.5 py-4 border-r" style={{ borderColor: "var(--line)", background: "rgb(228 231 238 / 0.35)" }} aria-label={t("ai.history")}>
        {list}
      </aside>
      {/* history — mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-[40] md:hidden">
          <button type="button" className="absolute inset-0" style={{ background: "var(--color-scrim)" }} aria-label={t("ai.closeHistory")} onClick={() => setDrawer(false)} />
          <aside className="absolute left-0 top-0 h-full w-[300px] max-w-[85vw] flex flex-col bg-canvas px-3.5 py-4 shadow-floating rise" aria-label={t("ai.history")}>
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold">{t("ai.history")}</span>
              <button type="button" className="icon-btn" onClick={() => setDrawer(false)} aria-label={t("ai.closeHistory")}><IconX /></button>
            </div>
            <div className="flex-1 min-h-0">{list}</div>
          </aside>
        </div>
      )}

      {/* main axis */}
      <div className="flex flex-col min-w-0 h-full min-h-0">
        <header className="relative flex items-center justify-center gap-3 min-h-[58px] px-14 md:px-8 border-b flex-none" style={{ borderColor: "var(--line)", background: "rgb(240 241 245 / 0.86)", backdropFilter: "blur(10px)" }}>
          <button type="button" className="icon-btn absolute left-2 md:hidden" onClick={() => setDrawer(true)} aria-label={t("ai.openHistory")}><IconMenu /></button>
          {originPath ? (
            <Link href={originPath} title={t("ai.backToOrigin")} className="inline-flex items-center gap-2 min-w-0 h-8 pl-2.5 pr-3 rounded-full border bg-surface text-[12.5px] text-muted hover:bg-canvas transition-colors group"
              style={{ borderColor: "var(--line)" }}>
              <IconInfo width={14} height={14} className="flex-none" /><span>{t("ai.context")}</span><b className="truncate text-ink">{chipLabel}</b>
              <IconArrowRight width={13} height={13} className="flex-none transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 min-w-0 h-8 pl-2.5 pr-3 rounded-full border bg-surface text-[12.5px] text-muted" style={{ borderColor: "var(--line)" }}>
              <IconInfo width={14} height={14} className="flex-none" /><span>{t("ai.context")}</span><b className="truncate text-ink">{chipLabel}</b>
            </span>
          )}
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="w-full max-w-[824px] mx-auto px-4 md:px-8 pt-8 pb-7">
            {thread.error ? <div className="note error">{errorMessage(thread.error)}</div> : null}
            {activeId && thread.isLoading && !detail ? <div className="text-sm text-muted text-center py-10">{t("common.loading")}</div>
              : <Conversation messages={messages} threadId={activeId} contextContractId={contextContractId} liveId={liveId} onSend={(x) => void onSend(x)} onEdit={onEdit} />}
          </div>
        </div>

        <div className="flex-none px-4 md:px-8 pt-3 pb-4" style={{ background: "linear-gradient(to top, var(--color-canvas) 72%, transparent)" }}>
          <div className="relative max-w-[760px] mx-auto">
            {undo && (
              <div className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+10px)] card flex items-center gap-3 px-4 py-2.5 text-sm font-medium rise whitespace-nowrap" style={{ boxShadow: "var(--shadow-floating)" }} role="status">
                <span className="truncate max-w-[50vw]">{t("ai.deleted", { title: threadTitle(undo).length > 40 ? `${threadTitle(undo).slice(0, 38)}…` : threadTitle(undo) })}</span>
                <button type="button" className="btn btn-text btn-sm text-primary" onClick={onUndo}>{t("ai.undo")}</button>
              </div>
            )}
            <Composer ref={composer} value={draft} onChange={setDraft} onSend={(x) => void onSend(x)} busy={streaming || create.isPending} />
          </div>
        </div>
      </div>
    </div>
  );
}
