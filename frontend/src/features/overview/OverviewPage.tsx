"use client";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { usePortfolioHealth, usePortfolioSummary } from "@/lib/queries/portfolio";
import { Card, CardHeader, CardBody, PageHead, Stat } from "@/components/ui/Card";
import { Pill, severityTone, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { fmtDateTime } from "@/lib/format";
import type { HealthFinding } from "@/types/api";

export function OverviewPage() {
  const summary = usePortfolioSummary();
  const health = usePortfolioHealth();
  const s = summary.data;
  return (
    <div className="grid gap-6">
      <PageHead title={t("overview.title")} sub={t("overview.sub")} />
      {summary.isLoading ? <Loading /> : summary.error ? <ErrorState error={summary.error} onRetry={() => summary.refetch()} /> : s && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Stat label={t("overview.contracts")} value={Object.values(s.contracts_by_status).reduce((a, b) => a + b, 0)} sub={
            <span className="flex flex-wrap gap-1 mt-1">{Object.entries(s.contracts_by_status).map(([k, v]) => <Pill key={k} tone={statusTone(k)}>{tEnum("contract.status", k)} {v}</Pill>)}</span>
          } />
          <Stat label={t("overview.properties")} value={s.assets.properties} sub={`${t("overview.spaces")}: ${s.assets.spaces} · ${t("overview.occupied")}: ${s.assets.occupied} · ${t("overview.free")}: ${s.assets.free}`} />
          <Stat label={t("overview.keyDates30")} value={s.key_dates_next_30} tone={s.key_dates_next_30 > 0 ? "warning" : undefined} sub={<Link href="/app/kalender" className="text-primary font-semibold">{t("nav.kalender")} →</Link>} />
          <Stat label={t("overview.openImports")} value={s.open_imports} tone={s.open_imports > 0 ? "primary" : undefined} sub={<Link href="/app/portfell/import" className="text-primary font-semibold">{t("portfolio.tabs.imports")} →</Link>} />
        </div>
      )}

      <Card>
        <CardHeader title={t("overview.health")} overline={health.data ? t("overview.healthGenerated", { date: fmtDateTime(health.data.generated_at) }) : undefined}
          actions={health.data && (
            <div className="flex gap-1 flex-wrap text-xs">
              <Pill>{t("overview.totals")} {health.data.totals.contracts}</Pill>
              <Pill tone="success">{t("overview.active")} {health.data.totals.active}</Pill>
              <Pill tone="info">{t("overview.imported")} {health.data.totals.imported}</Pill>
              <Pill tone="primary">{t("overview.platform")} {health.data.totals.platform}</Pill>
            </div>
          )} />
        <CardBody>
          {health.isLoading ? <Loading /> : health.error ? <ErrorState error={health.error} onRetry={() => health.refetch()} /> : health.data && (
            health.data.findings.length === 0 ? <EmptyState title={t("overview.noFindings")} /> : (
              <div className="grid gap-4">
                {[...health.data.findings].sort((a, b) => rank(a) - rank(b)).map((f) => <Finding key={f.code} f={f} />)}
              </div>
            )
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function rank(f: HealthFinding) { return f.severity === "error" ? 0 : f.severity === "warning" ? 1 : 2; }

function Finding({ f }: { f: HealthFinding }) {
  return (
    <details className="rounded-control border" style={{ borderColor: "var(--line)" }} open={f.severity !== "info"}>
      <summary className="flex items-center gap-3 px-4 py-3 cursor-pointer list-none">
        <Pill tone={severityTone(f.severity)}>{tEnum("overview.severity", f.severity)}</Pill>
        <span className="font-semibold text-sm flex-1 min-w-0 truncate">{f.title}</span>
        <span className="text-muted text-sm tabular-nums">{f.count}</span>
      </summary>
      {f.items.length > 0 && (
        <ul className="border-t divide-y" style={{ borderColor: "var(--line)" }}>
          {f.items.map((it, i) => (
            <li key={`${it.contract_id}-${i}`}>
              <Link href={`/app/portfell/leping/${it.contract_id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-canvas text-sm">
                <span className="id text-muted text-xs w-24 flex-none truncate">{it.number ?? "—"}</span>
                <span className="font-medium min-w-0 truncate">{it.title}</span>
                {it.detail && <span className="text-muted text-xs ml-auto truncate max-w-[50%]">{it.detail}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
