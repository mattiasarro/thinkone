"use client";
import { t } from "@/i18n";
import { usePortfolioSummary } from "@/lib/queries/portfolio";
import type { PortfolioSummary } from "@/types/api";

export type SetupKey = "company" | "building" | "spaces" | "contracts";
export interface SetupStep { key: SetupKey; index: number; title: string; short: string; min: number; done: boolean; pending: boolean; count: number }

const MIN: Record<SetupKey, number> = { company: 2, building: 2, spaces: 4, contracts: 2 };
const TITLE = { company: "home.setup.company", building: "home.setup.building", spaces: "home.setup.spaces", contracts: "home.setup.contracts" } as const;
const SHORT = { company: "setup.steps.company", building: "setup.steps.building", spaces: "setup.steps.spaces", contracts: "setup.steps.contracts" } as const;

/** „Alusta · 10 minutit” (demo v623 `alSammud`): done-state comes from the data, never from a checkbox. */
export function setupSteps(summary: PortfolioSummary | undefined): SetupStep[] | null {
  if (!summary) return null;
  const contracts = Object.values(summary.contracts_by_status).reduce((a, b) => a + b, 0);
  const counts: Record<SetupKey, number> = { company: summary.companies, building: summary.assets.properties, spaces: summary.assets.spaces, contracts };
  return (["company", "building", "spaces", "contracts"] as SetupKey[]).map((key, index) => ({
    key, index, title: t(TITLE[key]), short: t(SHORT[key]), min: MIN[key], count: counts[key], done: counts[key] > 0,
    pending: key === "contracts" && contracts === 0 && summary.open_imports > 0,
  }));
}

export function useSetupSteps() {
  const summary = usePortfolioSummary();
  const steps = setupSteps(summary.data);
  const done = steps?.filter((s) => s.done).length ?? 0;
  const next = steps?.find((s) => !s.done) ?? null;
  const minutesLeft = steps?.filter((s) => !s.done).reduce((a, s) => a + s.min, 0) ?? 0;
  return { steps, done, next, minutesLeft, complete: !!steps && !next, isLoading: summary.isLoading, refetch: summary.refetch };
}
