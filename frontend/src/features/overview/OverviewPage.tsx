"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { t, tEnum } from "@/i18n";
import { useAssets, useContracts, usePortfolioHealth, usePortfolioSummary } from "@/lib/queries/portfolio";
import { Card, CardHeader, CardBody, PageHead } from "@/components/ui/Card";
import { Pill, severityTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { cx, daysUntil, fmtDate, fmtDateTime, fmtEur, fmtNum, fmtPct } from "@/lib/format";
import type { Asset, ContractSummary, HealthFinding, SpaceAttributes } from "@/types/api";

type Kpi = "rent" | "occupancy" | "ending" | "vacant";
const RENT_KEYS = ["rent_monthly", "monthly_rent", "rent"];

/** Monthly net rent of a contract from its current-value projection ({value, unit, label} per key); per-m² values are not a monthly rent. */
function monthlyRent(c: ContractSummary): number {
  for (const k of RENT_KEYS) {
    const v = c.current_values?.[k];
    if (v == null) continue;
    if (typeof v === "number") return v;
    if (typeof v === "object") {
      const o = v as { value?: unknown; unit?: unknown };
      const unit = typeof o.unit === "string" ? o.unit : "";
      if (/m²|m2/.test(unit)) continue;
      const n = typeof o.value === "number" ? o.value : Number(o.value);
      if (Number.isFinite(n)) return n;
    }
  }
  return 0;
}

/** Contract starts per month over the last 12 months (oldest → newest): the tiny strip under each tile. */
function startsByMonth(rows: ContractSummary[]): number[] {
  const now = new Date();
  const out = Array.from({ length: 12 }, () => 0);
  for (const c of rows) {
    if (!c.start_date) continue;
    const d = new Date(c.start_date);
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diff >= 0 && diff < 12) out[11 - diff] += 1;
  }
  return out;
}

/** „Ülevaade = sakid” (demo v674/698): four KPI tiles that are tabs → ONE detail pane; neutral colours; the health box stays below. */
export function OverviewPage() {
  const summary = usePortfolioSummary();
  const health = usePortfolioHealth();
  const leases = useContracts({ view: "active", category: "lease" });
  const spaces = useAssets({ type_code: "space" });
  const props = useAssets({ type_code: "property" });
  const [tab, setTab] = useState<Kpi>("rent");
  const s = summary.data;

  const data = useMemo(() => {
    const rows = (leases.data ?? []).map((c) => ({ c, rent: monthlyRent(c) }));
    const rentTotal = rows.reduce((a, r) => a + r.rent, 0);
    const ending = rows.filter((r) => r.c.end_date && daysUntil(r.c.end_date) >= 0 && daysUntil(r.c.end_date) <= 365).sort((a, b) => (a.c.end_date ?? "").localeCompare(b.c.end_date ?? ""));
    const endingRent = ending.reduce((a, r) => a + r.rent, 0);
    const vacant = (spaces.data ?? []).filter((sp) => sp.status === "vaba").map((sp) => {
      const a = sp.attributes as Partial<SpaceAttributes>;
      const area = Number(a.rentable_area_m2 ?? 0), price = a.price_per_m2 == null ? null : Number(a.price_per_m2);
      return { sp, area, price, value: price == null ? 0 : area * price };
    }).sort((a, b) => b.value - a.value);
    const vacantTotal = vacant.reduce((a, r) => a + r.value, 0);
    const byProperty = (props.data ?? []).map((p) => {
      const mine = (spaces.data ?? []).filter((sp) => sp.parent_id === p.id && sp.status !== "mitteaktiivne" && sp.status !== "jagatud");
      const occupied = mine.filter((sp) => sp.status === "üüritud" || sp.status === "täidetud").length + mine.filter((sp) => sp.status === "osaliselt").length * 0.5;
      return { p, total: mine.length, occupied, pct: mine.length ? occupied / mine.length : 0 };
    }).sort((a, b) => b.pct - a.pct);
    const strip = startsByMonth(leases.data ?? []);
    return { rows: rows.sort((a, b) => b.rent - a.rent), rentTotal, ending, endingRent, vacant, vacantTotal, byProperty, strip, hasHistory: strip.some((n) => n > 0) };
  }, [leases.data, spaces.data, props.data]);

  const occPct = s && s.assets.spaces > 0 ? s.assets.occupied / s.assets.spaces : 0;
  const loading = summary.isLoading || leases.isLoading || spaces.isLoading;
  const tiles: { key: Kpi; label: string; value: string; sub: string }[] = [
    { key: "rent", label: t("overview.kpi.rent"), value: fmtEur(data.rentTotal), sub: t("overview.kpi.rentSub", { n: data.rows.length }) },
    { key: "occupancy", label: t("overview.kpi.occupancy"), value: fmtPct(occPct), sub: t("overview.kpi.occupancySub", { occupied: s?.assets.occupied ?? 0, total: s?.assets.spaces ?? 0 }) },
    { key: "ending", label: t("overview.kpi.ending"), value: String(data.ending.length), sub: t("overview.kpi.endingSub", { n: data.ending.length, pct: fmtPct(data.rentTotal ? data.endingRent / data.rentTotal : 0) }) },
    { key: "vacant", label: t("overview.kpi.vacant"), value: fmtEur(data.vacantTotal), sub: t("overview.kpi.vacantSub", { n: data.vacant.length }) },
  ];

  return (
    <div className="grid gap-6">
      <PageHead title={t("overview.title")} sub={t("overview.sub")} />
      {summary.error ? <ErrorState error={summary.error} onRetry={() => summary.refetch()} /> : leases.error ? <ErrorState error={leases.error} onRetry={() => leases.refetch()} /> : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4" role="tablist" aria-label={t("overview.kpi.tabs")}>
            {tiles.map((k) => {
              const active = k.key === tab;
              return (
                <button key={k.key} type="button" role="tab" aria-selected={active} onClick={() => setTab(k.key)}
                  className={cx("card pad text-left min-w-0 transition-shadow hover:shadow-floating border-2", active ? "border-ink" : "border-transparent")}>
                  <div className="overline">{k.label}</div>
                  <div className="font-heading text-[22px] leading-7 md:text-[26px] md:leading-8 font-semibold mt-1 tabular-nums text-ink break-words">{loading ? "…" : k.value}</div>
                  <div className="text-muted text-xs mt-1 leading-4">{k.sub}</div>
                  <Strip values={data.strip} placeholder={!data.hasHistory} active={active} />
                </button>
              );
            })}
          </div>

          <Card>
            <CardHeader title={t(`overview.kpi.${tab}List`)} overline={tab === "rent" || tab === "ending" ? t("overview.kpi.trend") : undefined} />
            {loading ? <CardBody><Loading /></CardBody> : (
              <>
                {tab === "rent" && <RentList rows={data.rows} />}
                {tab === "occupancy" && <OccupancyList rows={data.byProperty} />}
                {tab === "ending" && <EndingList rows={data.ending} />}
                {tab === "vacant" && <VacantList rows={data.vacant} byProperty={new Map((props.data ?? []).map((p) => [p.id, p.name]))} />}
              </>
            )}
          </Card>
        </>
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

/** A 12-bar strip (the last 12 months of contract starts); a flat placeholder when there is no history yet. Ink on the active tile, grey otherwise. */
function Strip({ values, placeholder, active }: { values: number[]; placeholder: boolean; active: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[3px] h-6 mt-3" aria-hidden>
      {values.map((v, i) => {
        const h = placeholder ? 25 : Math.max(8, Math.round((v / max) * 100));
        return <span key={i} className="flex-1 rounded-[2px]" style={{ height: `${h}%`, background: active ? "var(--color-text)" : "var(--color-divider)", opacity: placeholder ? 0.5 : 1 }} />;
      })}
    </div>
  );
}

function Empty() { return <CardBody><p className="text-sm text-muted m-0">{t("overview.kpi.noData")}</p></CardBody>; }

function RentList({ rows }: { rows: { c: ContractSummary; rent: number }[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
      {rows.map(({ c, rent }) => (
        <li key={c.id}>
          <Link href={`/app/portfell/leping/${c.id}`} className="flex items-center gap-3 px-[var(--card-padding)] py-2.5 hover:bg-canvas text-sm">
            <span className="font-mono text-xs text-muted w-24 flex-none truncate">{c.number ?? "—"}</span>
            <span className="min-w-0 flex-1 truncate"><span className="font-medium">{c.party?.name ?? c.title}</span>{c.party && <span className="text-muted"> · {c.title}</span>}</span>
            <span className="font-mono tabular-nums">{rent ? fmtEur(rent) : "—"}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function OccupancyList({ rows }: { rows: { p: Asset; total: number; occupied: number; pct: number }[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
      {rows.map(({ p, total, occupied, pct }) => (
        <li key={p.id}>
          <Link href={`/app/portfell/objekt/${p.id}`} className="grid gap-1 px-[var(--card-padding)] py-2.5 hover:bg-canvas text-sm">
            <span className="flex items-center gap-3"><span className="font-medium min-w-0 flex-1 truncate">{p.name}</span><span className="text-muted text-xs">{t("overview.kpi.spaces", { occupied: fmtNum(occupied), total })}</span><span className="font-mono tabular-nums w-12 text-right">{fmtPct(pct)}</span></span>
            <span className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-subtle)" }}><span className="block h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: "var(--color-text)" }} /></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function EndingList({ rows }: { rows: { c: ContractSummary; rent: number }[] }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
      {rows.map(({ c, rent }) => {
        const n = c.end_date ? daysUntil(c.end_date) : null;
        return (
          <li key={c.id}>
            <Link href={`/app/portfell/leping/${c.id}`} className="flex items-center gap-3 px-[var(--card-padding)] py-2.5 hover:bg-canvas text-sm flex-wrap">
              <span className="font-mono text-xs text-muted w-24 flex-none truncate">{c.number ?? "—"}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{c.party?.name ?? c.title}</span>
              <span className={cx("text-xs tabular-nums", n !== null && n <= 90 ? "text-warning font-semibold" : "text-muted")}>{c.end_date ? `${fmtDate(c.end_date)} · ${t("overview.kpi.endsIn", { n })}` : t("overview.kpi.noEnd")}</span>
              <span className="font-mono tabular-nums w-24 text-right">{rent ? fmtEur(rent) : "—"}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function VacantList({ rows, byProperty }: { rows: { sp: Asset; area: number; price: number | null; value: number }[]; byProperty: Map<string, string> }) {
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
      {rows.map(({ sp, area, price, value }) => (
        <li key={sp.id}>
          <Link href={`/app/portfell/pind/${sp.id}`} className="flex items-center gap-3 px-[var(--card-padding)] py-2.5 hover:bg-canvas text-sm flex-wrap">
            <span className="min-w-0 flex-1 truncate"><span className="font-medium">{sp.name}</span>{sp.parent_id && byProperty.get(sp.parent_id) && <span className="text-muted"> · {byProperty.get(sp.parent_id)}</span>}</span>
            <span className="text-muted text-xs tabular-nums">{fmtNum(area)} m²{price != null ? ` · ${fmtEur(price)}/m²` : ` · ${t("overview.kpi.listPrice")}`}</span>
            <span className="font-mono tabular-nums w-24 text-right">{price != null ? fmtEur(value) : "—"}</span>
          </Link>
        </li>
      ))}
    </ul>
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
