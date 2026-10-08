"use client";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, type Query } from "@/lib/api";
import type { Allocation, Asset, AssetDetail, AssetInput, AuditEvent, AuditStats, ContractDetail, ContractParty, ContractSummary, PartyContractRow, KeyDate, KeyDateKind, ParkingImportResult, ParkingPlan, ParkingPlanSave, ParkingSpot, Party, PartyInput, PlanRow, PortfolioHealth, PortfolioSummary, SearchHit, SpaceImportResult, SplitUnitInput } from "@/types/api";

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
    mutationFn: (body: { notes?: string | null; category?: string; title?: string }) => api.patch<ContractDetail>(`/contracts/${id}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contract", id] }); qc.invalidateQueries({ queryKey: ["contracts"] }); },
  });
}
const invalidateContractParties = (qc: ReturnType<typeof useQueryClient>, id: string) => {
  qc.invalidateQueries({ queryKey: ["contract", id] }); qc.invalidateQueries({ queryKey: ["contracts"] }); qc.invalidateQueries({ queryKey: ["party-contracts"] });
  qc.invalidateQueries({ queryKey: ["parties"] }); qc.invalidateQueries({ queryKey: ["party"] }); qc.invalidateQueries({ queryKey: ["audit"] });
};
export function useAddContractParty(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { party_id: string; role: string; is_primary?: boolean; valid_from?: string | null }) => api.post<ContractParty>(`/contracts/${contractId}/parties`, body),
    onSuccess: () => invalidateContractParties(qc, contractId),
  });
}
export function useUpdateContractParty(contractId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; role?: string; is_primary?: boolean; valid_from?: string | null; valid_to?: string | null }) => api.patch<ContractParty>(`/contracts/${contractId}/parties/${id}`, body),
    onSuccess: () => invalidateContractParties(qc, contractId),
  });
}
export function useRemoveContractParty(contractId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/contracts/${contractId}/parties/${id}`), onSuccess: () => invalidateContractParties(qc, contractId) });
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
export function useAuditLog(params: Query) {
  return useQuery({ queryKey: ["audit", "log", params], queryFn: () => api.get<AuditEvent[]>("/audit", { limit: 200, ...params }), placeholderData: keepPreviousData });
}
export function useAuditStats() {
  return useQuery({ queryKey: ["audit", "stats"], queryFn: () => api.get<AuditStats>("/audit/stats") });
}

// ---- parties ----
export function useParties(params: Query = {}) {
  return useQuery({ queryKey: ["parties", params], queryFn: () => api.get<Party[]>("/parties", params), placeholderData: keepPreviousData });
}
export function useParty(id: string | undefined) {
  return useQuery({ queryKey: ["party", id], queryFn: () => api.get<Party>(`/parties/${id}`), enabled: !!id });
}
export function usePartyContracts(id: string | undefined) {
  return useQuery({ queryKey: ["party-contracts", id], queryFn: () => api.get<PartyContractRow[]>(`/parties/${id}/contracts`), enabled: !!id });
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
    onSuccess: () => invalidateAssets(qc),
  });
}
export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/assets/${id}`), onSuccess: () => invalidateAssets(qc) });
}
export function useImportSpaces(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, text, dryRun }: { file?: File; text?: string; dryRun: boolean }) =>
      file ? api.upload<SpaceImportResult>(`/assets/${propertyId}/spaces/import`, { file }, { dry_run: dryRun }) : api.post<SpaceImportResult>(`/assets/${propertyId}/spaces/import`, { text }, { dry_run: dryRun }),
    onSuccess: (_r, v) => { if (!v.dryRun) invalidateAssets(qc); },
  });
}
const invalidateAssets = (qc: ReturnType<typeof useQueryClient>) => { qc.invalidateQueries({ queryKey: ["assets"] }); qc.invalidateQueries({ queryKey: ["asset"] }); qc.invalidateQueries({ queryKey: ["parking"] }); qc.invalidateQueries({ queryKey: ["parking-plan"] }); qc.invalidateQueries({ queryKey: ["audit"] }); };

// ---- parking register ----
export function useParking(propertyId: string | undefined) {
  return useQuery({ queryKey: ["parking", propertyId], queryFn: () => api.get<ParkingSpot[]>(`/assets/${propertyId}/parking`), enabled: !!propertyId });
}
export function useImportParking(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ file, text, dryRun }: { file?: File; text?: string; dryRun: boolean }) =>
      file ? api.upload<ParkingImportResult>(`/assets/${propertyId}/parking/import`, { file }, { dry_run: dryRun }) : api.post<ParkingImportResult>(`/assets/${propertyId}/parking/import`, { text }, { dry_run: dryRun }),
    onSuccess: (_r, v) => { if (!v.dryRun) invalidateAssets(qc); },
  });
}
export function useUpdateParking(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: { ids: string[]; patch: Record<string, unknown> }) => api.post<ParkingSpot[]>(`/assets/${propertyId}/parking/update`, b), onSuccess: () => invalidateAssets(qc) });
}
export function useAssignParking(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: { space_id: string | null; numbers: string[] }) => api.post<ParkingSpot[]>(`/assets/${propertyId}/parking/assign`, b), onSuccess: () => invalidateAssets(qc) });
}
export function useDeleteParking(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (ids: string[]) => api.post<void>(`/assets/${propertyId}/parking/delete`, { ids }), onSuccess: () => invalidateAssets(qc) });
}
export function useSetHasParking(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (has_parking: boolean) => api.post<Asset>(`/assets/${propertyId}/parking/has-parking`, { has_parking }), onSuccess: () => invalidateAssets(qc) });
}

// ---- parking schematic (boxes per register spot) ----
export function useParkingPlan(propertyId: string | undefined) {
  return useQuery({ queryKey: ["parking-plan", propertyId], queryFn: () => api.get<ParkingPlan>(`/assets/${propertyId}/parking/plan`), enabled: !!propertyId });
}
export function useSaveParkingPlan(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: ParkingPlanSave) => api.put<ParkingPlan>(`/assets/${propertyId}/parking/plan`, b), onSuccess: () => invalidateAssets(qc) });
}
export function useDeriveParkingPlan(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (b: { attachment_id?: string | null; lot_id?: string | null } = {}) => api.post<ParkingPlan>(`/assets/${propertyId}/parking/plan/derive`, b), onSuccess: () => invalidateAssets(qc) });
}
export function useDiscardParkingDraft(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.delete(`/assets/${propertyId}/parking/plan/draft`), onSuccess: () => invalidateAssets(qc) });
}

// ---- plans (bulk floor-plan upload) ----
export function useUploadPlans(propertyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ files, mapping, dryRun }: { files: File[]; mapping?: Record<string, string>; dryRun: boolean }) =>
      api.uploadMany<PlanRow[]>(`/assets/${propertyId}/plans`, files.map((file) => ({ field: "files", file })), { mapping: mapping ? JSON.stringify(mapping) : undefined }, { dry_run: dryRun }),
    onSuccess: (_r, v) => { if (!v.dryRun) { invalidateAssets(qc); qc.invalidateQueries({ queryKey: ["attachments"] }); } },
  });
}

// ---- split / merge ----
export function useSplitSpace(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (units: SplitUnitInput[]) => api.post<Asset[]>(`/assets/${spaceId}/split`, { units }), onSuccess: () => invalidateAssets(qc) });
}
export function useMergeSpace(spaceId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post<Asset>(`/assets/${spaceId}/merge`), onSuccess: () => invalidateAssets(qc) });
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
