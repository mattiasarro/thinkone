"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { AiConfirmResult, AiFeedbackInput, AiThread, AiThreadDetail, AiThreadInput, AiUsage } from "@/types/ai";

export const AI_KEYS = {
  threads: ["ai", "threads"] as const,
  thread: (id: string) => ["ai", "thread", id] as const,
  usage: ["ai", "usage"] as const,
};

export function useAiThreads() {
  return useQuery({ queryKey: AI_KEYS.threads, queryFn: () => api.get<AiThread[]>("/agent/threads") });
}
export function useAiThread(id: string | null | undefined) {
  return useQuery({ queryKey: AI_KEYS.thread(id ?? ""), queryFn: () => api.get<AiThreadDetail>(`/agent/threads/${id}`), enabled: !!id });
}
export function useAiUsage() {
  return useQuery({ queryKey: AI_KEYS.usage, queryFn: () => api.get<AiUsage>("/agent/usage"), staleTime: 30_000 });
}
export function useCreateAiThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AiThreadInput) => api.post<AiThreadDetail>("/agent/threads", body),
    onSuccess: (t) => { qc.setQueryData(AI_KEYS.thread(t.id), t); qc.invalidateQueries({ queryKey: AI_KEYS.threads }); },
  });
}
export function useDeleteAiThread() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/agent/threads/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: AI_KEYS.threads });
      const prev = qc.getQueryData<AiThread[]>(AI_KEYS.threads);
      if (prev) qc.setQueryData(AI_KEYS.threads, prev.filter((x) => x.id !== id));
      return { prev };
    },
    onError: (_e, _id, ctx) => { if (ctx?.prev) qc.setQueryData(AI_KEYS.threads, ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: AI_KEYS.threads }),
  });
}
export function useRestoreAiThread() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post<AiThread>(`/agent/threads/${id}/restore`), onSuccess: () => qc.invalidateQueries({ queryKey: AI_KEYS.threads }) });
}
export function useConfirmAiCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thread_id, message_id, card_id }: { thread_id: string; message_id: string; card_id: string }) =>
      api.post<AiConfirmResult>(`/agent/threads/${thread_id}/messages/${message_id}/cards/${card_id}/confirm`),
    onSuccess: (_r, v) => {
      qc.invalidateQueries({ queryKey: AI_KEYS.thread(v.thread_id) });
      qc.invalidateQueries({ queryKey: ["quotes"] }); qc.invalidateQueries({ queryKey: ["contracts"] }); qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["audit"] }); qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
export function useAiFeedback() {
  return useMutation({ mutationFn: (body: AiFeedbackInput) => api.post<{ id: string }>("/agent/feedback", body) });
}
