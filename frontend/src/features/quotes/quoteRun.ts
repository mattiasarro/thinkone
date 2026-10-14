"use client";
import { useCallback } from "react";
import { t } from "@/i18n";
import { errorMessage, isApiError } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

/** Runs a quote mutation: success toast, 409 → „keegi muutis vahepeal” + refetch, other errors → error toast. */
export function useRun(refetch: () => void) {
  const toast = useToast();
  return useCallback(async <T,>(p: Promise<T>, ok?: string): Promise<T | undefined> => {
    try {
      const r = await p;
      if (ok) toast.success(ok);
      return r;
    } catch (e) {
      if (isApiError(e) && e.status === 409) { toast.info(t("quotes.conflict")); refetch(); } else toast.error(errorMessage(e));
      return undefined;
    }
  }, [toast, refetch]);
}
export type Run = ReturnType<typeof useRun>;
