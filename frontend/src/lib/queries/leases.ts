"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { EmploymentCreateInput, EmploymentTermsPatch, LeaseChatMessage, LeaseClausePatch, LeaseConvertInput, LeaseCreateInput, LeaseDecideInput, LeaseDraft, LeaseNegotiation, LeaseProposeInput, LeaseSpecialInput, LeaseTermsPatch } from "@/types/api";

type QC = ReturnType<typeof useQueryClient>;

/** Every lease mutation refetches the draft, its negotiation, the contract projections, the registry, the audit log and the bell. */
function invalidateLease(qc: QC, id?: string) {
  if (id) { qc.invalidateQueries({ queryKey: ["lease", id] }); qc.invalidateQueries({ queryKey: ["lease-negotiation", id] }); qc.invalidateQueries({ queryKey: ["lease-chat", id] }); qc.invalidateQueries({ queryKey: ["contract", id] }); }
  else { qc.invalidateQueries({ queryKey: ["lease"] }); qc.invalidateQueries({ queryKey: ["lease-negotiation"] }); qc.invalidateQueries({ queryKey: ["contract"] }); }
  qc.invalidateQueries({ queryKey: ["contracts"] });
  qc.invalidateQueries({ queryKey: ["quotes"] });
  qc.invalidateQueries({ queryKey: ["quote"] });
  qc.invalidateQueries({ queryKey: ["assets"] });
  qc.invalidateQueries({ queryKey: ["asset"] });
  qc.invalidateQueries({ queryKey: ["audit"] });
  qc.invalidateQueries({ queryKey: ["notifications"] });
  qc.invalidateQueries({ queryKey: ["messages", "threads"] });
  qc.invalidateQueries({ queryKey: ["key-dates"] });
}

export function useLease(id: string | undefined) {
  return useQuery({ queryKey: ["lease", id], queryFn: () => api.get<LeaseDraft>(`/leases/${id}`), enabled: !!id });
}
export function useLeaseNegotiation(id: string | undefined) {
  return useQuery({ queryKey: ["lease-negotiation", id], queryFn: () => api.get<LeaseNegotiation>(`/leases/${id}/negotiation`), enabled: !!id });
}
export function useConvertQuote(quoteId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: LeaseConvertInput) => api.post<LeaseDraft[]>(`/leases/from-quote/${quoteId}`, body), onSuccess: (drafts) => { for (const d of drafts) qc.setQueryData(["lease", d.id], d); invalidateLease(qc); qc.invalidateQueries({ queryKey: ["quote", quoteId] }); } });
}
export function useCreateLease() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: LeaseCreateInput) => api.post<LeaseDraft>("/leases", body), onSuccess: (d) => { qc.setQueryData(["lease", d.id], d); invalidateLease(qc); } });
}
function useLeaseMutation<B>(id: string, fn: (body: B) => Promise<LeaseDraft>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (d) => { qc.setQueryData(["lease", id], d); invalidateLease(qc, id); } });
}
function useNegotiationMutation<B>(id: string, fn: (body: B) => Promise<LeaseNegotiation>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (n) => { qc.setQueryData(["lease-negotiation", id], n); invalidateLease(qc, id); } });
}
export function useUpdateLeaseTerms(id: string) {
  return useLeaseMutation(id, (body: LeaseTermsPatch) => api.patch<LeaseDraft>(`/leases/${id}/terms`, body));
}
/** Tööleping (employment vertical) on the same draft engine: POST /leases/employment and PATCH /leases/{id}/employment-terms. */
export function useCreateEmployment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: EmploymentCreateInput) => api.post<LeaseDraft>("/leases/employment", body), onSuccess: (d) => { qc.setQueryData(["lease", d.id], d); invalidateLease(qc); } });
}
export function useUpdateEmploymentTerms(id: string) {
  return useLeaseMutation(id, (body: EmploymentTermsPatch) => api.patch<LeaseDraft>(`/leases/${id}/employment-terms`, body));
}
export function useUpdateLeaseContact(id: string) {
  return useLeaseMutation(id, (body: { name: string; email: string; phone: string }) => api.patch<LeaseDraft>(`/leases/${id}/contact`, body));
}
export function useEditClause(id: string) {
  return useLeaseMutation(id, ({ clause_id, ...body }: LeaseClausePatch & { clause_id: string }) => api.patch<LeaseDraft>(`/leases/${id}/clauses/${clause_id}`, body));
}
export function useAddSpecial(id: string) {
  return useLeaseMutation(id, (body: LeaseSpecialInput) => api.post<LeaseDraft>(`/leases/${id}/special`, body));
}
export function useRemoveSpecial(id: string) {
  return useLeaseMutation(id, (clause_id: string) => api.delete<LeaseDraft>(`/leases/${id}/special/${clause_id}`));
}
export function useSendLease(id: string) {
  return useNegotiationMutation(id, (body: { message?: string | null; expected_version?: number } = {}) => api.post<LeaseNegotiation>(`/leases/${id}/send`, body));
}
export function useSendRound(id: string) {
  return useNegotiationMutation(id, (body: { body?: string | null } = {}) => api.post<LeaseNegotiation>(`/leases/${id}/round`, body));
}
export function useCancelLease(id: string) {
  return useLeaseMutation(id, (body: { body?: string | null } = {}) => api.post<LeaseDraft>(`/leases/${id}/cancel`, body));
}
export function useOpenThread(id: string) {
  return useNegotiationMutation(id, (body: { clause_id: string; text: string }) => api.post<LeaseNegotiation>(`/leases/${id}/threads`, body));
}
export type ThreadActionInput =
  | { tid: string; action: "explain" | "answer"; body: { text: string } }
  | { tid: string; action: "propose"; body: LeaseProposeInput }
  | { tid: string; action: "decide"; body: LeaseDecideInput }
  | { tid: string; action: "unchanged"; body?: undefined };
export function useThreadAction(id: string) {
  return useNegotiationMutation(id, ({ tid, action, body }: ThreadActionInput) => api.post<LeaseNegotiation>(`/leases/${id}/threads/${tid}/${action}`, body));
}
export function useLeaseChat(id: string | undefined, enabled = true) {
  return useQuery({ queryKey: ["lease-chat", id], queryFn: () => api.get<LeaseChatMessage[]>(`/leases/${id}/chat`), enabled: !!id && enabled });
}
export function usePostLeaseChat(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: string) => api.post<LeaseChatMessage[]>(`/leases/${id}/chat`, { body }), onSuccess: (m) => { qc.setQueryData(["lease-chat", id], m); invalidateLease(qc, id); } });
}
export function useMarkLeaseChatRead(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post<void>(`/leases/${id}/chat/read`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["messages", "threads"] }); qc.invalidateQueries({ queryKey: ["notifications"] }); qc.invalidateQueries({ queryKey: ["contracts"] }); } });
}
