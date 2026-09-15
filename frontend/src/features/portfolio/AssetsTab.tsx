"use client";
import Link from "next/link";
import { t } from "@/i18n";
import { useAssets } from "@/lib/queries/portfolio";
import { useCompanies } from "@/lib/queries/settings";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { IconBuilding, IconPlus } from "@/components/ui/Icons";
import { Pill } from "@/components/ui/Pill";
import type { Asset } from "@/types/api";

export function AssetsTab() {
  const props = useAssets({ type_code: "property" });
  const spaces = useAssets({ type_code: "space" });
  const companies = useCompanies();
  const byCompany = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const spacesOf = (p: Asset) => (spaces.data ?? []).filter((s) => s.parent_id === p.id);
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><LinkButton href="/app/portfell/objekt/uus" variant="primary"><IconPlus width={16} height={16} />{t("portfolio.assets.addProperty")}</LinkButton></div>
      {props.isLoading ? <Loading /> : props.error ? <ErrorState error={props.error} onRetry={() => props.refetch()} /> : (props.data ?? []).length === 0 ? (
        <Card><EmptyState icon={<IconBuilding width={40} height={40} />} title={t("portfolio.assets.empty")} sub={t("portfolio.assets.emptySub")} action={<LinkButton href="/app/portfell/objekt/uus" variant="primary">{t("portfolio.assets.addProperty")}</LinkButton>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(props.data ?? []).map((p) => {
            const sp = spacesOf(p);
            const total = sp.length || p.children_count || 0;
            const occupied = sp.filter((s) => s.status === "üüritud" || s.status === "täidetud").length;
            const partial = sp.filter((s) => s.status === "osaliselt").length;
            const free = sp.filter((s) => s.status === "vaba").length;
            const pct = total ? Math.round(((occupied + partial * 0.5) / total) * 100) : 0;
            const addr = (p.attributes.address as string | undefined) ?? "";
            return (
              <Link key={p.id} href={`/app/portfell/objekt/${p.id}`} className="card pad hover:shadow-floating transition-shadow flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-control grid place-items-center text-primary flex-none" style={{ background: "var(--color-primary-subtle)" }}><IconBuilding /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-semibold text-base truncate">{p.name}</div>
                    <div className="text-xs text-muted truncate">{addr || t("portfolio.assets.noAddress")}</div>
                    {p.company_id && byCompany.get(p.company_id) && <div className="text-xs text-muted truncate">{byCompany.get(p.company_id)}</div>}
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-subtle)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-success-vivid, #22C55E)" }} /></div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <Pill>{t("portfolio.assets.spaces", { n: total })}</Pill>
                  <Pill tone="success">{t("portfolio.assets.occupancy", { occupied, total })}</Pill>
                  {free > 0 && <Pill tone="primary">{t("portfolio.assets.free", { n: free })}</Pill>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
