"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ImportCommitInput, ImportJob, ImportJobDetail, Proposal } from "@/types/api";

const PENDING = new Set(["uploaded", "extracting", "structuring"]);

export function useImports() {
  return useQuery({
    queryKey: ["imports"],
    queryFn: () => api.get<ImportJob[]>("/imports"),
    refetchInterval: (q) => (q.state.data?.some((j) => PENDING.has(j.status)) ? 2000 : false),
  });
}
export function useImport(id: string | undefined) {
  return useQuery({
    queryKey: ["import", id],
    queryFn: () => api.get<ImportJobDetail>(`/imports/${id}`),
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && PENDING.has(q.state.data.status) ? 2000 : false),
  });
}
export function useUploadImport() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (file: File) => api.upload<ImportJob>("/imports", { file }), onSuccess: () => qc.invalidateQueries({ queryKey: ["imports"] }) });
}
export function useSaveReview(id: string) {
  return useMutation({ mutationFn: (reviewed: Proposal) => api.patch<ImportJob>(`/imports/${id}`, { reviewed }) });
}
export function useCommitImport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportCommitInput) => api.post<{ contract_id: string }>(`/imports/${id}/commit`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["imports"] }); qc.invalidateQueries({ queryKey: ["import", id] }); qc.invalidateQueries({ queryKey: ["contracts"] }); },
  });
}
export interface ManualImportInput {
  file: File; title: string; category: string; counterparty_name: string; registry_code?: string; signed_at?: string; start_date?: string; end_date?: string;
  key_dates: { kind: string; date: string; title: string }[]; parameters: { key: string; value: string; text: string }[]; company_id?: string; asset_id?: string;
}
export function useManualImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (m: ManualImportInput) => api.upload<{ contract_id: string }>("/imports/manual", {
      file: m.file, title: m.title, category: m.category, counterparty_name: m.counterparty_name, registry_code: m.registry_code || undefined,
      signed_at: m.signed_at || undefined, start_date: m.start_date || undefined, end_date: m.end_date || undefined,
      key_dates: JSON.stringify(m.key_dates), parameters: JSON.stringify(m.parameters), company_id: m.company_id || undefined, asset_id: m.asset_id || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["imports"] }); qc.invalidateQueries({ queryKey: ["contracts"] }); },
  });
}
export { PENDING as IMPORT_PENDING };
