"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Account, AriregisterHit, Attachment, AttachmentRole, AttachmentSubject, Company, CompanyInput, EhrHit, NotifyDays, Template, TemplateDetail, TemplateKind } from "@/types/api";

export function useAccount() {
  return useQuery({ queryKey: ["account"], queryFn: () => api.get<Account>("/account") });
}
export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { name?: string; settings?: { notify_days?: Partial<NotifyDays> } }) => api.patch<Account>("/account", body), onSuccess: (a) => qc.setQueryData(["account"], a) });
}

export function useCompanies() {
  return useQuery({ queryKey: ["companies"], queryFn: () => api.get<Company[]>("/companies") });
}
export function useSaveCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<CompanyInput> & { id?: string }) => (id ? api.patch<Company>(`/companies/${id}`, body) : api.post<Company>("/companies", body)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }),
  });
}
export function useDeleteCompany() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/companies/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }) });
}
export function useUploadLogo() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, file }: { id: string; file: File }) => api.upload<Company>(`/companies/${id}/logo`, { file }), onSuccess: () => qc.invalidateQueries({ queryKey: ["companies"] }) });
}

export function useAriregister(q: string) {
  return useQuery({ queryKey: ["ariregister", q], queryFn: ({ signal }) => api.get<AriregisterHit[]>("/integrations/ariregister", { q }, signal), enabled: q.trim().length >= 2, staleTime: 60_000 });
}

/** Full company card (VAT number, contacts, board) — one call when a search hit is picked. Fails soft: null when the registry has no card. */
export async function fetchAriregisterDetail(registryCode: string): Promise<AriregisterHit | null> {
  try { return await api.get<AriregisterHit>(`/integrations/ariregister/${encodeURIComponent(registryCode)}`); } catch { return null; }
}
export function useEhr(q: string) {
  return useQuery({ queryKey: ["ehr", q], queryFn: ({ signal }) => api.get<EhrHit[]>("/integrations/ehr", { q }, signal), enabled: q.trim().length >= 2, staleTime: 60_000 });
}

export function useAttachments(subjectType: AttachmentSubject, subjectId: string | undefined) {
  return useQuery({ queryKey: ["attachments", subjectType, subjectId], queryFn: () => api.get<Attachment[]>("/attachments", { subject_type: subjectType, subject_id: subjectId }), enabled: !!subjectId });
}
export function useUploadAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { subject_type: AttachmentSubject; subject_id: string; role: AttachmentRole | string; file: File }) => api.upload<Attachment>("/attachments", a),
    onSuccess: (_r, v) => { qc.invalidateQueries({ queryKey: ["attachments", v.subject_type, v.subject_id] }); qc.invalidateQueries({ queryKey: ["asset", v.subject_id] }); qc.invalidateQueries({ queryKey: ["contract", v.subject_id] }); },
  });
}
export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/attachments/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["attachments"] }); qc.invalidateQueries({ queryKey: ["asset"] }); qc.invalidateQueries({ queryKey: ["contract"] }); } });
}
export async function openAttachment(id: string) {
  const { url } = await api.get<{ url: string }>(`/attachments/${id}/url`);
  window.open(url, "_blank", "noopener");
}

export function useTemplates(companyId?: string | null) {
  return useQuery({ queryKey: ["templates", companyId ?? null], queryFn: () => api.get<Template[]>("/templates", companyId ? { company_id: companyId } : undefined) });
}
export function useTemplate(id: string | undefined) {
  return useQuery({ queryKey: ["template", id], queryFn: () => api.get<TemplateDetail>(`/templates/${id}`), enabled: !!id });
}
export function useCreateTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: TemplateKind; name: string; company_id?: string | null; body: { text: string } }) => api.post<Template>("/templates", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
export function useUploadGeneralTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { file: File; name: string; company_id?: string | null }) => api.upload<Template>("/templates/general-terms", { file: b.file, name: b.name, company_id: b.company_id || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["templates"] }),
  });
}
