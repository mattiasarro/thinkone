"use client";
import { QueryClient, QueryClientProvider, MutationCache, QueryCache } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { isApiError, onUnauthorized } from "./api";
import { ToastProvider } from "@/components/ui/Toast";

function redirectToLogin() {
  if (typeof window === "undefined") return;
  const p = window.location.pathname;
  if (p.startsWith("/login") || p.startsWith("/register") || p.startsWith("/invite")) return;
  const next = encodeURIComponent(p + window.location.search);
  window.location.assign(`/login?next=${next}`);
}

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        retry: (count, err) => !(isApiError(err) && (err.status === 401 || err.status === 403 || err.status === 404)) && count < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
    queryCache: new QueryCache({ onError: (err) => { if (isApiError(err) && err.status === 401) redirectToLogin(); } }),
    mutationCache: new MutationCache({ onError: (err) => { if (isApiError(err) && err.status === 401) redirectToLogin(); } }),
  });
}

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    onUnauthorized.handler = redirectToLogin;
    return makeQueryClient();
  });
  return (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}
