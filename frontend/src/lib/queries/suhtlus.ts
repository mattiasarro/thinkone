"use client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Thread, ThreadQuote } from "@/types/suhtlus";

type QC = ReturnType<typeof useQueryClient>;

export const THREADS_KEY = ["messages", "threads"] as const;

/** Reading or writing a thread changes the unread counts everywhere: the list, the quote list/detail and the bell. */
function invalidateThread(qc: QC, id: string) {
  qc.invalidateQueries({ queryKey: THREADS_KEY });
  qc.invalidateQueries({ queryKey: ["quotes"] });
  qc.invalidateQueries({ queryKey: ["quote", id] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function useThreads(params: { unanswered?: boolean; q?: string } = {}) {
  const query = { unanswered: params.unanswered ? true : undefined, q: params.q || undefined };
  return useQuery({ queryKey: [...THREADS_KEY, query], queryFn: () => api.get<Thread[]>("/messages/threads", query), placeholderData: keepPreviousData });
}

/** Same cache entry as useQuote(id) in queries/quotes.ts, so both pages stay in sync. */
export function useThreadQuote(id: string | undefined) {
  return useQuery({ queryKey: ["quote", id], queryFn: () => api.get<ThreadQuote>(`/quotes/${id}`), enabled: !!id });
}

export function useSendThreadMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => api.post<ThreadQuote>(`/quotes/${id}/messages`, { body, channel: "chat" }),
    onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateThread(qc, id); qc.invalidateQueries({ queryKey: ["audit"] }); },
  });
}

export function useMarkThreadRead(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post<void>(`/quotes/${id}/messages/read`), onSuccess: () => invalidateThread(qc, id) });
}
