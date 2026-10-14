"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import type { PortalQuote } from "@/types/portal";

export const portalKey = (token: string) => ["portal", token] as const;

/** The whole deal room in one call. A 404 means the link is invalid, expired or revoked — never retried, handled by the page. */
export function usePortalQuote(token: string) {
  return useQuery({
    queryKey: portalKey(token),
    queryFn: () => api.get<PortalQuote>(`/portal/${encodeURIComponent(token)}`),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: token.length > 0,
  });
}

export function isLinkGone(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/** Every portal action returns the fresh PortalQuoteOut, so the cache is replaced from the response. */
function usePortalAction<V>(token: string, fn: (v: V) => Promise<PortalQuote>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (q) => qc.setQueryData(portalKey(token), q),
    onError: (e) => {
      // the link may have been revoked or the quote moved on (expired, cancelled) between load and action — refresh so the page shows the real state
      if (isApiError(e) && (e.status === 404 || e.status === 409)) qc.invalidateQueries({ queryKey: portalKey(token) });
    },
  });
}

export function usePortalAccept(token: string) {
  return usePortalAction<void>(token, () => api.post<PortalQuote>(`/portal/${encodeURIComponent(token)}/accept`));
}
export function usePortalPropose(token: string) {
  return usePortalAction<string>(token, (text) => api.post<PortalQuote>(`/portal/${encodeURIComponent(token)}/propose`, { text }));
}
export function usePortalReject(token: string) {
  return usePortalAction<string | undefined>(token, (reason) => api.post<PortalQuote>(`/portal/${encodeURIComponent(token)}/reject`, { reason: reason?.trim() || null }));
}
export function usePortalMessage(token: string) {
  return usePortalAction<string>(token, (text) => api.post<PortalQuote>(`/portal/${encodeURIComponent(token)}/messages`, { text }));
}
