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
import { StepSettings } from "./StepSettings";

const STEPS = ["assets.steps.building", "assets.steps.spaces", "assets.steps.settings"] as const;

export function ObjectWizard({ propertyId, step }: { propertyId?: string; step: 1 | 2 | 3 }) {
  const router = useRouter();
  const asset = useAsset(propertyId);
  const go = (id: string, s: number) => router.push(s === 1 ? `/app/portfell/objekt/${id}?edit=1` : `/app/portfell/objekt/${id}?edit=1&step=${s}`);
  const stepValid: 1 | 2 | 3 = propertyId ? step : 1;

  return (
    <div className="grid gap-4 max-w-[900px]">
      <LinkButton href={propertyId ? `/app/portfell/objekt/${propertyId}` : "/app/portfell?tab=esemed"} variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{propertyId ? asset.data?.name ?? t("assets.editTitle") : t("portfolio.tabs.assets")}</LinkButton>
      <PageHead title={propertyId ? asset.data?.name ?? t("assets.editTitle") : t("assets.newTitle")} />
      <ol className="stepper" aria-label={t("assets.newTitle")}>
        {STEPS.map((k, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const done = n < stepValid;
          const canClick = !!propertyId;
          return (
            <li key={k}>
              <button type="button" className={cx("st", n === stepValid && "active", done && "done")} aria-current={n === stepValid ? "step" : undefined} disabled={!canClick} onClick={() => propertyId && go(propertyId, n)}>
                <span className="n">{done ? <IconCheck width={12} height={12} /> : n}</span>{t(k)}
              </button>
            </li>
          );
        })}
      </ol>
      {propertyId && asset.isLoading ? <Loading /> : propertyId && (asset.error || !asset.data) ? <ErrorState error={asset.error} onRetry={() => asset.refetch()} /> : (
        <>
          {stepValid === 1 && <StepBuilding property={asset.data ?? null} onSaved={(id) => go(id, 2)} />}
          {stepValid === 2 && asset.data && <StepSpaces property={asset.data} onBack={() => go(asset.data!.id, 1)} onNext={() => go(asset.data!.id, 3)} />}
          {stepValid === 3 && asset.data && <StepSettings property={asset.data} onBack={() => go(asset.data!.id, 2)} onFinish={() => router.push(`/app/portfell/objekt/${asset.data!.id}`)} />}
        </>
      )}
    </div>
  );
}
