"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RiskReport } from "@/types/api";

const POLL_MS = 2_000;
const POLL_MAX_MS = 60_000;

/** All reports of a party, newest first. While the newest one is still queued (live worker) the list is refetched every 2 s, for at most 60 s. */
export function useRiskHistory(partyId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["risk", partyId],
    queryFn: () => api.get<RiskReport[]>(`/parties/${partyId}/risk`),
    enabled: !!partyId && enabled,
    refetchInterval: (q) => {
      const latest = q.state.data?.[0];
      if (!latest || latest.status !== "queued") return false;
      return Date.now() - new Date(latest.created_at).getTime() < POLL_MAX_MS ? POLL_MS : false;
    },
  });
}

/** POST /parties/{id}/risk — orders a report (in dev it comes back „ready” inline; live mode returns „queued” and useRiskHistory polls). */
export function useOrderRisk(partyId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<RiskReport>(`/parties/${partyId}/risk`),
    onSuccess: (r) => {
      qc.setQueryData<RiskReport[]>(["risk", partyId], (old) => [r, ...(old ?? []).filter((x) => x.id !== r.id)]);
      qc.invalidateQueries({ queryKey: ["risk", partyId] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
  });
}
