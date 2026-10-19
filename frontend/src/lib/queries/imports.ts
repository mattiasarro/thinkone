"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DeskOut, DeskReady, ImportCommitInput, ImportJob, ImportJobDetail, Proposal } from "@/types/api";

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
/** One drop = one import (batch): pass the same ``batchId`` for every file of the drop, or the batch the desk shows. */
export function useUploadImport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, batchId }: { file: File; batchId?: string }) => api.upload<ImportJob>("/imports", { file, ...(batchId ? { batch_id: batchId } : {}) }),
    onSuccess: () => invalidate(qc),
  });
}
const invalidate = (qc: ReturnType<typeof useQueryClient>, id?: string) => {
  qc.invalidateQueries({ queryKey: ["imports"] }); qc.invalidateQueries({ queryKey: ["import-desk"] }); qc.invalidateQueries({ queryKey: ["portfolio"] });
  if (id) qc.invalidateQueries({ queryKey: ["import", id] });
};
export function useImportDesk() {
  return useQuery({ queryKey: ["import-desk"], queryFn: () => api.get<DeskOut>("/imports/desk"),
    refetchInterval: (q) => (q.state.data?.batches.some((b) => b.reading > 0) ? 2500 : false), refetchIntervalInBackground: true });
}
export function useImportBatch(batchId: string | undefined) {
  return useQuery({ queryKey: ["import-desk", batchId], queryFn: () => api.get<DeskOut>(`/imports/desk/${batchId}`), enabled: !!batchId,
    refetchInterval: (q) => ((q.state.data?.batch?.reading ?? 0) > 0 ? 2500 : false), refetchIntervalInBackground: true });
}
export function useCommitReady(batchId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post<DeskReady>(`/imports/batches/${batchId}/commit-ready`, {}),
    onSuccess: () => { invalidate(qc); qc.invalidateQueries({ queryKey: ["contracts"] }); } });
}
export function useSaveDeskState(id: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { checked?: string[]; link?: Record<string, unknown> | null; parent_job_id?: string | null; parent_contract_id?: string | null }) =>
    api.patch<ImportJob>(`/imports/${id}/desk`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ["import-desk"] }) });
}
export function useExcludeImport() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.post<ImportJob>(`/imports/${id}/exclude`, { reason: reason ?? null }), onSuccess: (_r, v) => invalidate(qc, v.id) });
}
export function useRestoreImport() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post<ImportJob>(`/imports/${id}/restore`, {}), onSuccess: (_r, id) => invalidate(qc, id) });
}
export function useRemoveImport() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/imports/${id}`), onSuccess: () => invalidate(qc) });
}
export const markOpened = (id: string) => api.post(`/imports/${id}/opened`, {}).catch(() => undefined);
export function useSaveReview(id: string) {
  return useMutation({ mutationFn: (reviewed: Proposal) => api.patch<ImportJob>(`/imports/${id}`, { reviewed }) });
}
export function useCommitImport(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ImportCommitInput) => api.post<{ contract_id: string }>(`/imports/${id}/commit`, body),
    onSuccess: () => { invalidate(qc, id); qc.invalidateQueries({ queryKey: ["contracts"] }); },
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
