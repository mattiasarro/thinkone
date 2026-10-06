"use client";
import { useRouter } from "next/navigation";
import { t } from "@/i18n";
import { useAsset } from "@/lib/queries/portfolio";
import { ErrorState, Loading } from "@/components/ui/State";
import { PageHead } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { IconChevronLeft, IconCheck } from "@/components/ui/Icons";
import { cx } from "@/lib/format";
import { StepBuilding } from "./StepBuilding";
import { StepSpaces } from "./StepSpaces";
import { StepPlans } from "./StepPlans";
import { StepParking } from "./StepParking";
import { StepSettings } from "./StepSettings";
import type { AssetDetail, PropertyAttributes } from "@/types/api";

export type WizardStep = 1 | 2 | 3 | 4 | 5;
const STEPS = ["assets.steps.building", "assets.steps.spaces", "assets.steps.plans", "assets.steps.parking", "assets.steps.settings"] as const;

/** Which steps already have data (demo v801: „tehtud sammud tulevad andmetest”). */
export function stepState(p: AssetDetail | null | undefined): Record<WizardStep, "done" | "todo"> {
  if (!p) return { 1: "todo", 2: "todo", 3: "todo", 4: "todo", 5: "todo" };
  const a = p.attributes as PropertyAttributes;
  const spaces = p.children.filter((c) => c.type_code === "space");
  return {
    1: "done",
    2: spaces.length > 0 ? "done" : "todo",
    3: spaces.length > 0 && spaces.every((s) => s.attachments.some((x) => x.role === "floor_plan")) ? "done" : "todo",
    4: p.parking_spots.length > 0 || a.has_parking === false ? "done" : "todo",
    5: a.utility_cost_winter != null || a.utility_cost_summer != null ? "done" : "todo",
  };
}

export function ObjectWizard({ propertyId, step }: { propertyId?: string; step: WizardStep }) {
  const router = useRouter();
  const asset = useAsset(propertyId);
  const go = (id: string, s: number) => router.push(s === 1 ? `/app/portfell/objekt/${id}?edit=1` : `/app/portfell/objekt/${id}?edit=1&step=${s}`);
  const stepValid: WizardStep = propertyId ? step : 1;
  const state = stepState(asset.data);
  const p = asset.data;

  return (
    <div className="grid gap-4 max-w-[1100px]">
      <LinkButton href={propertyId ? `/app/portfell/objekt/${propertyId}` : "/app/portfell?tab=esemed"} variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{propertyId ? asset.data?.name ?? t("assets.editTitle") : t("portfolio.tabs.assets")}</LinkButton>
      <PageHead title={propertyId ? asset.data?.name ?? t("assets.editTitle") : t("assets.newTitle")} sub={t("assets.stepsHint")} />
      <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)] items-start">
        <ol className="grid gap-1 md:sticky md:top-20" aria-label={t("assets.newTitle")}>
          {STEPS.map((k, i) => {
            const n = (i + 1) as WizardStep;
            const done = state[n] === "done" && n !== stepValid;
            const canClick = !!propertyId;
            return (
              <li key={k}>
                <button type="button" disabled={!canClick} onClick={() => propertyId && go(propertyId, n)} aria-current={n === stepValid ? "step" : undefined}
                  className={cx("w-full flex items-center gap-3 px-3 py-2 rounded-control text-sm text-left transition-colors", n === stepValid ? "bg-surface shadow-surface font-semibold text-primary" : canClick ? "hover:bg-[rgb(20_26_38/0.05)] text-ink" : "text-muted")}>
                  <span className={cx("w-6 h-6 rounded-full grid place-items-center text-xs font-semibold flex-none", n === stepValid ? "bg-primary text-white" : done ? "text-success" : "text-muted")} style={{ background: n === stepValid ? "var(--color-primary)" : done ? "var(--color-success-subtle)" : "var(--color-surface-subtle)" }}>{done ? <IconCheck width={12} height={12} /> : n}</span>
                  <span>{t(k)}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <div className="min-w-0">
          {propertyId && asset.isLoading ? <Loading /> : propertyId && (asset.error || !p) ? <ErrorState error={asset.error} onRetry={() => asset.refetch()} /> : (
            <>
              {stepValid === 1 && <StepBuilding property={p ?? null} onSaved={(id) => go(id, 2)} />}
              {stepValid === 2 && p && <StepSpaces property={p} onBack={() => go(p.id, 1)} onNext={() => go(p.id, 3)} />}
              {stepValid === 3 && p && <StepPlans property={p} onBack={() => go(p.id, 2)} onNext={() => go(p.id, 4)} />}
              {stepValid === 4 && p && <StepParking property={p} onBack={() => go(p.id, 3)} onNext={() => go(p.id, 5)} />}
              {stepValid === 5 && p && <StepSettings property={p} onBack={() => go(p.id, 4)} onFinish={() => router.push(`/app/portfell/objekt/${p.id}`)} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
