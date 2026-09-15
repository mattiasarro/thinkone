"use client";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, type Query } from "@/lib/api";
import type { Allocation, Asset, AssetDetail, AssetInput, AuditEvent, ContractDetail, ContractSummary, KeyDate, KeyDateKind, Party, PartyInput, PortfolioHealth, PortfolioSummary, SearchHit, SpaceImportResult } from "@/types/api";

// ---- contracts ----
export function useContracts(params: Query) {
  return useQuery({ queryKey: ["contracts", params], queryFn: () => api.get<ContractSummary[]>("/contracts", params), placeholderData: keepPreviousData });
}
export function useContract(id: string | undefined) {
  return useQuery({ queryKey: ["contract", id], queryFn: () => api.get<ContractDetail>(`/contracts/${id}`), enabled: !!id });
}
export function useUpdateContract(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { notes?: string | null; category?: string; party_id?: string | null; title?: string }) => api.patch<ContractDetail>(`/contracts/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract", id] }); qc.invalidateQueries({ queryKey: ["contracts"] }); },
  });
}
export function useRegisterAmendment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: { file: File; note: string; parameters: unknown[]; key_dates: unknown[] }) =>
      api.upload<unknown>(`/contracts/${id}/amendments`, { file: f.file, note: f.note, parameters: JSON.stringify(f.parameters), key_dates: JSON.stringify(f.key_dates) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract", id] }); qc.invalidateQueries({ queryKey: ["audit"] }); qc.invalidateQueries({ queryKey: ["key-dates"] }); },
  });
}
export function useAudit(entityType: string, entityId: string | undefined) {
  return useQuery({ queryKey: ["audit", entityType, entityId], queryFn: () => api.get<AuditEvent[]>("/audit", { entity_type: entityType, entity_id: entityId }), enabled: !!entityId });
}

// ---- parties ----
export function useParties(params: Query = {}) {
  return useQuery({ queryKey: ["parties", params], queryFn: () => api.get<Party[]>("/parties", params), placeholderData: keepPreviousData });
}
export function useParty(id: string | undefined) {
  return useQuery({ queryKey: ["party", id], queryFn: () => api.get<Party>(`/parties/${id}`), enabled: !!id });
}
export function usePartyContracts(id: string | undefined) {
  return useQuery({ queryKey: ["party-contracts", id], queryFn: () => api.get<ContractSummary[]>(`/parties/${id}/contracts`), enabled: !!id });
}
export function useSaveParty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<PartyInput> & { id?: string }) => (id ? api.patch<Party>(`/parties/${id}`, body) : api.post<Party>("/parties", body)),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ["parties"] }); qc.invalidateQueries({ queryKey: ["party", p.id] }); },
  });
}
export function useDeleteParty() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/parties/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["parties"] }) });
}

// ---- assets ----
export function useAssets(params: Query) {
  return useQuery({ queryKey: ["assets", params], queryFn: () => api.get<Asset[]>("/assets", params), placeholderData: keepPreviousData });
}
export function useAsset(id: string | undefined) {
  return useQuery({ queryKey: ["asset", id], queryFn: () => api.get<AssetDetail>(`/assets/${id}`), enabled: !!id });
}
export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: AssetInput) => api.post<Asset>("/assets", body), onSuccess: (a) => { qc.invalidateQueries({ queryKey: ["assets"] }); if (a.parent_id) qc.invalidateQueries({ queryKey: ["asset", a.parent_id] }); } });
}
export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<AssetInput> & { id: string }) => api.patch<Asset>(`/assets/${id}`, body),
    onSuccess: (a) => { qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["asset", a.id] }); if (a.parent_id) qc.invalidateQueries({ queryKey: ["asset", a.parent_id] }); },
  });
}
export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/assets/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["asset"] }); } });
}
export function useImportSpaces(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, text, dryRun }: { file?: File; text?: string; dryRun: boolean }) =>
      file ? api.upload<SpaceImportResult>(`/assets/${propertyId}/spaces/import`, { file }, { dry_run: dryRun }) : api.post<SpaceImportResult>(`/assets/${propertyId}/spaces/import`, { text }, { dry_run: dryRun }),
    onSuccess: (_r, v) => { if (!v.dryRun) { qc.invalidateQueries({ queryKey: ["asset", propertyId] }); qc.invalidateQueries({ queryKey: ["assets"] }); } },
  });
}
export type { Allocation };

// ---- key dates ----
export function useKeyDates(params: Query, enabled = true) {
  return useQuery({ queryKey: ["key-dates", params], queryFn: () => api.get<KeyDate[]>("/key-dates", params), enabled, placeholderData: keepPreviousData });
}
export function useKeyDateKinds() {
  return useQuery({ queryKey: ["key-date-kinds"], queryFn: () => api.get<KeyDateKind[]>("/key-dates/kinds"), staleTime: 10 * 60_000 });
}
export interface KeyDateInput { contract_id: string | null; kind_code: string; title: string; due_date: string; notify_days_before: number | null }
export function useSaveKeyDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<KeyDateInput> & { id?: string }) => (id ? api.patch<KeyDate>(`/key-dates/${id}`, body) : api.post<KeyDate>("/key-dates", body)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["key-dates"] }); qc.invalidateQueries({ queryKey: ["contract"] }); },
  });
}
export function useDeleteKeyDate() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/key-dates/${id}`), onSuccess: () => { qc.invalidateQueries({ queryKey: ["key-dates"] }); qc.invalidateQueries({ queryKey: ["contract"] }); } });
}

// ---- overview ----
export function usePortfolioSummary() {
  return useQuery({ queryKey: ["portfolio", "summary"], queryFn: () => api.get<PortfolioSummary>("/portfolio/summary") });
}
export function usePortfolioHealth() {
  return useQuery({ queryKey: ["portfolio", "health"], queryFn: () => api.get<PortfolioHealth>("/portfolio/health") });
}
export function useSearch(q: string) {
  return useQuery({ queryKey: ["search", q], queryFn: ({ signal }) => api.get<SearchHit[]>("/search", { q }, signal), enabled: q.trim().length >= 2, staleTime: 30_000 });
}
