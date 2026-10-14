"use client";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, type Query } from "@/lib/api";
import type { QuoteCreateInput, QuoteDetail, QuotePatchInput, QuoteSpacePatchInput, QuoteSummary } from "@/types/api";

type QC = ReturnType<typeof useQueryClient>;

/** Every quote mutation refetches the quote, the list and the registry projection („pakkumisel”); the audit log and the bell follow. */
function invalidateQuote(qc: QC, id?: string) {
  qc.invalidateQueries({ queryKey: ["quotes"] });
  if (id) qc.invalidateQueries({ queryKey: ["quote", id] }); else qc.invalidateQueries({ queryKey: ["quote"] });
  qc.invalidateQueries({ queryKey: ["assets"] });
  qc.invalidateQueries({ queryKey: ["asset"] });
  qc.invalidateQueries({ queryKey: ["audit"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
}

export function useQuotes(params: Query = {}, enabled = true) {
  return useQuery({ queryKey: ["quotes", params], queryFn: () => api.get<QuoteSummary[]>("/quotes", params), placeholderData: keepPreviousData, enabled });
}
export function useQuote(id: string | undefined) {
  return useQuery({ queryKey: ["quote", id], queryFn: () => api.get<QuoteDetail>(`/quotes/${id}`), enabled: !!id });
}
export function useCreateQuote() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: QuoteCreateInput) => api.post<QuoteDetail>("/quotes", body), onSuccess: (q) => { qc.setQueryData(["quote", q.id], q); invalidateQuote(qc, q.id); } });
}
export function useUpdateQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: QuotePatchInput) => api.patch<QuoteDetail>(`/quotes/${id}`, body), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useDeleteQuote() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/quotes/${id}`), onSuccess: () => invalidateQuote(qc) });
}
export function useUpdateQuoteSpace(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ space_id, ...body }: QuoteSpacePatchInput & { space_id: string }) => api.patch<QuoteDetail>(`/quotes/${id}/spaces/${space_id}`, body),
    onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); },
  });
}
export function useAddQuoteSpace(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (space_id: string) => api.post<QuoteDetail>(`/quotes/${id}/spaces/${space_id}`), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useRemoveQuoteSpace(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (space_id: string) => api.delete<QuoteDetail>(`/quotes/${id}/spaces/${space_id}`), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useAddQuoteTerm(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { text: string; expected_version?: number }) => api.post<QuoteDetail>(`/quotes/${id}/terms`, body), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useUpdateQuoteTerm(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ term_id, ...body }: { term_id: string; text: string; expected_version?: number }) => api.patch<QuoteDetail>(`/quotes/${id}/terms/${term_id}`, body),
    onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); },
  });
}
export function useRemoveQuoteTerm(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (term_id: string) => api.delete<QuoteDetail>(`/quotes/${id}/terms/${term_id}`), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useUploadQuoteAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (file: File) => api.upload<QuoteDetail>(`/quotes/${id}/attachments`, { file }), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useDeleteQuoteAttachment(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (attachment_id: string) => api.delete<QuoteDetail>(`/quotes/${id}/attachments/${attachment_id}`), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useSendQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { message?: string | null; expected_version?: number } = {}) => api.post<QuoteDetail>(`/quotes/${id}/send`, body), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useCancelQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { reason?: string | null } = {}) => api.post<QuoteDetail>(`/quotes/${id}/cancel`, body), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useRemindQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { text?: string | null } = {}) => api.post<QuoteDetail>(`/quotes/${id}/remind`, body), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useSnoozeQuote(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (days: number = 3) => api.post<QuoteDetail>(`/quotes/${id}/snooze`, { days }), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useResendLetter(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { email?: string | null } = {}) => api.post<QuoteDetail>(`/quotes/${id}/resend-letter`, body), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function usePostQuoteMessage(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { body: string; channel?: "chat" | "negotiation" }) => api.post<QuoteDetail>(`/quotes/${id}/messages`, body), onSuccess: (q) => { qc.setQueryData(["quote", id], q); invalidateQuote(qc, id); } });
}
export function useMarkQuoteRead(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post<void>(`/quotes/${id}/messages/read`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["quotes"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); } });
}
