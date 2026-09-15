"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Me, Member, Notification } from "@/types/api";

export const meKey = ["me"] as const;

export function useMe(enabled = true) {
  return useQuery({ queryKey: meKey, queryFn: () => api.get<Me>("/auth/me"), enabled, staleTime: 60_000 });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; password: string }) => api.post<Me>("/auth/login", body),
    onSuccess: (me) => qc.setQueryData(meKey, me),
  });
}
export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { account_name: string; email: string; name: string; password: string }) => api.post<Me>("/auth/register", body),
    onSuccess: (me) => qc.setQueryData(meKey, me),
  });
}
export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { token: string; name: string; password: string }) => api.post<Me>("/auth/invite/accept", body),
    onSuccess: (me) => qc.setQueryData(meKey, me),
  });
}
export function useLogout() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.post<void>("/auth/logout"), onSettled: () => qc.clear() });
}
export function useSwitchAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => api.post<Me>(`/auth/switch/${accountId}`),
    onSuccess: (me) => { qc.clear(); qc.setQueryData(meKey, me); },
  });
}

export function useMembers() {
  return useQuery({ queryKey: ["members"], queryFn: () => api.get<Member[]>("/auth/members") });
}
export function useInvite() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (body: { email: string; role: string }) => api.post<Member>("/auth/invite", body), onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }) });
}
export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...body }: { id: string; role?: string; notification_prefs?: Record<string, unknown> }) => api.patch<Member>(`/auth/members/${id}`, body), onSuccess: () => qc.invalidateQueries({ queryKey: ["members"] }) });
}

export function useNotifications(enabled = true) {
  return useQuery({ queryKey: ["notifications"], queryFn: () => api.get<Notification[]>("/notifications"), enabled, refetchInterval: 60_000 });
}
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.post<void>(`/notifications/${id}/read`), onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }) });
}
