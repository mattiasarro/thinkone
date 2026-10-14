"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, isApiError } from "@/lib/api";
import { isPortalLease, type LeaseWish, type PortalDocument, type PortalLease, type PortalQuote } from "@/types/portal";

export const portalKey = (token: string) => ["portal", token] as const;
const base = (token: string) => `/portal/${encodeURIComponent(token)}`;

/** The whole deal room in one call — a quote or a lease draft. A 404 means the link is invalid, expired or revoked — never retried, handled by the page. */
export function usePortalDocument(token: string) {
  return useQuery({
    queryKey: portalKey(token),
    queryFn: () => api.get<PortalDocument>(base(token)),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: token.length > 0,
  });
}

/** The same query narrowed to a quote (null while the link opens a lease). */
export function usePortalQuote(token: string) {
  return useQuery({
    queryKey: portalKey(token),
    queryFn: () => api.get<PortalDocument>(base(token)),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    enabled: token.length > 0,
    select: (d): PortalQuote | null => (isPortalLease(d) ? null : d),
  });
}

export function isLinkGone(error: unknown): boolean {
  return isApiError(error) && error.status === 404;
}

/** Every portal action returns the fresh document, so the cache is replaced from the response. */
function usePortalAction<V, D extends PortalDocument>(token: string, fn: (v: V) => Promise<D>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (d) => qc.setQueryData(portalKey(token), d),
    onError: (e) => {
      // the link may have been revoked or the document moved on (expired, cancelled, turn flipped) between load and action — refresh so the page shows the real state
      if (isApiError(e) && (e.status === 404 || e.status === 409)) qc.invalidateQueries({ queryKey: portalKey(token) });
    },
  });
}

// ---------------------------------------------------------------- quote

export function usePortalAccept(token: string) {
  return usePortalAction<void, PortalQuote>(token, () => api.post<PortalQuote>(`${base(token)}/accept`));
}
export function usePortalPropose(token: string) {
  return usePortalAction<string, PortalQuote>(token, (text) => api.post<PortalQuote>(`${base(token)}/propose`, { text }));
}
export function usePortalReject(token: string) {
  return usePortalAction<string | undefined, PortalQuote>(token, (reason) => api.post<PortalQuote>(`${base(token)}/reject`, { reason: reason?.trim() || null }));
}
export function usePortalMessage(token: string) {
  return usePortalAction<string, PortalQuote>(token, (text) => api.post<PortalQuote>(`${base(token)}/messages`, { text }));
}

// ---------------------------------------------------------------- lease draft (one round = one letter: remarks are drafts until /send)

export function useLeaseOpenThread(token: string) {
  return usePortalAction<{ clause_id: string; text: string; wish?: LeaseWish }, PortalLease>(token, (body) => api.post<PortalLease>(`${base(token)}/lease/threads`, body));
}
export function useLeaseReply(token: string) {
  return usePortalAction<{ thread_id: string; text: string }, PortalLease>(token, ({ thread_id, text }) => api.post<PortalLease>(`${base(token)}/lease/threads/${thread_id}/reply`, { text }));
}
export function useLeaseDecide(token: string) {
  return usePortalAction<{ thread_id: string; accept: boolean; text?: string }, PortalLease>(token, ({ thread_id, accept, text }) =>
    api.post<PortalLease>(`${base(token)}/lease/threads/${thread_id}/decide`, { accept, text: text?.trim() || null }));
}
export function useLeaseOk(token: string) {
  return usePortalAction<string, PortalLease>(token, (thread_id) => api.post<PortalLease>(`${base(token)}/lease/threads/${thread_id}/ok`));
}
export function useLeaseSendRound(token: string) {
  return usePortalAction<string | undefined, PortalLease>(token, (body) => api.post<PortalLease>(`${base(token)}/lease/send`, { body: body?.trim() || null }));
}
export function useLeaseAcceptAll(token: string) {
  return usePortalAction<void, PortalLease>(token, () => api.post<PortalLease>(`${base(token)}/lease/accept`));
}
export function useLeaseChat(token: string) {
  return usePortalAction<string, PortalLease>(token, (text) => api.post<PortalLease>(`${base(token)}/lease/messages`, { text }));
}
