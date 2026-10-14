"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { t, tEnum } from "@/i18n";
import { useOrderRisk, useRiskHistory } from "@/lib/queries/risk";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading, Spinner } from "@/components/ui/State";
import { Table, Td } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { cx, fmtDate, fmtDateTime, fmtNum } from "@/lib/format";
import type { RiskLevel, RiskQuarter, RiskReport } from "@/types/api";
import { levelTone } from "./RiskPill";

const LEVELS: RiskLevel[] = ["KÕRGE", "KESKMINE", "MADAL"];
const LEVEL_VAR: Record<RiskLevel, string> = { KÕRGE: "var(--color-error)", KESKMINE: "var(--color-warning)", MADAL: "var(--color-success)" };
const ROMAN = ["I", "II", "III", "IV"];

const eurK = (v: number | null | undefined): string => (v === null || v === undefined ? "—" : Math.abs(v) >= 10_000 ? `${fmtNum(Math.round(v / 1000))} k€` : `${fmtNum(Math.round(v))} €`);

/**
 * Riskiraport card: gauge (score word, „nõuandev”), summary, counts by level + „Liidestamata”, turnover strip, company card,
 * signals table, sources footer and the history list. Fetches by party id; `compact` (quote wizard) shows score, summary and signals only.
 * Advisory only — nothing here blocks a quote or a lease.
 */
export function RiskReportCard({ partyId, compact, focus, footer, title }: { partyId: string; compact?: boolean; focus?: boolean; footer?: ReactNode; title?: ReactNode }) {
  const history = useRiskHistory(partyId);
  const order = useOrderRisk(partyId);
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    // ?tab=risk (the agent's confirmation card links here): scroll after the router's own scroll-to-top has run
    if (!focus || history.isLoading) return;
    const id = setTimeout(() => { ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }); ref.current?.focus({ preventScroll: true }); }, 120);
    return () => clearTimeout(id);
  }, [focus, history.isLoading]);

  const reports = history.data ?? [];
  const latest = reports[0];
  const report = (selected && reports.find((r) => r.id === selected)) || latest;
  const orderNow = async () => {
    try { setSelected(null); await order.mutateAsync(); toast.success(t("risk.ordered")); } catch (e) { toast.error(errorMessage(e)); }
  };
  const orderBtn = (label = t("risk.orderNew"), variant: "primary" | "ghost" = "ghost") => (
    <Button variant={variant} size="sm" busy={order.isPending} disabled={latest?.status === "queued"} onClick={orderNow}>{label}</Button>
  );

  let body: ReactNode;
  if (history.isLoading) body = <CardBody><Loading /></CardBody>;
  else if (history.error) body = <CardBody><ErrorState error={history.error} onRetry={() => history.refetch()} /></CardBody>;
  else if (!report) body = <EmptyState title={t("risk.empty")} sub={t("risk.emptySub")} action={<Button variant="primary" busy={order.isPending} onClick={orderNow}>{t("risk.order")}</Button>} />;
  else if (report.status === "queued") body = <CardBody><div className="flex items-center gap-3 text-sm text-muted" role="status"><Spinner />{t("risk.queued")}</div></CardBody>;
  else if (report.status === "failed") body = (
    <CardBody className="grid gap-3">
      <div className="note error" role="alert"><span><b>{t("risk.failed")}</b>{report.error ? ` — ${report.error}` : ""}</span></div>
      {reports.length > 1 && !compact && <History reports={reports} current={report.id} onSelect={setSelected} />}
    </CardBody>
  );
  else body = <Ready report={report} reports={reports} compact={!!compact} onSelect={setSelected} />;

  return (
    <Card className={cx("outline-none", focus && "ring-2 ring-[color:var(--color-primary-ring)]")}>
      <section ref={ref} tabIndex={-1} className="outline-none scroll-mt-20" id="riskiraport">
        <CardHeader title={title ?? t("risk.title")} overline={t("risk.advisory")} actions={report && report.status !== "queued" ? orderBtn() : undefined} />
        {body}
        {footer && <div className="px-[var(--card-padding)] pb-[var(--card-padding)]">{footer}</div>}
      </section>
    </Card>
  );
}

function Ready({ report: r, reports, compact, onSelect }: { report: RiskReport; reports: RiskReport[]; compact: boolean; onSelect: (id: string) => void }) {
  const s = r.sources ?? {};
  const unavailable = s.unavailable ?? [];
  const counts = Object.fromEntries(LEVELS.map((l) => [l, r.signals.filter((x) => x.level === l).length])) as Record<RiskLevel, number>;
  const quarters = (s.quarters ?? []).filter((q) => q.turnover !== null && q.turnover !== undefined);
  const asOf = s.as_of?.debt || s.as_of?.quarters || null;
  return (
    <CardBody className="grid gap-5">
      <div className={cx("grid gap-5 items-start", !compact && "md:grid-cols-[auto_minmax(0,1fr)]")}>
        <Gauge level={r.score} points={r.points} />
        <div className="grid gap-3 min-w-0">
          {r.summary && <p className="text-sm leading-6">{r.summary}</p>}
          <div className="flex flex-wrap gap-2">
            {LEVELS.map((l) => <Pill key={l} tone={counts[l] ? levelTone(l) : "neutral"}>{tEnum("risk.levels", l)} <b className="tabular-nums">{counts[l]}</b></Pill>)}
            <Pill title={unavailable.join(", ") || undefined}>{t("risk.unavailableN", { n: unavailable.length })}</Pill>
          </div>
          <p className="text-xs text-muted">{t("risk.advisoryNote")}</p>
        </div>
      </div>

      {!compact && (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <div className="rounded-control p-4 grid gap-2" style={{ background: "var(--color-surface-subtle)" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-semibold">{t("risk.turnover")}</span>
              {s.as_of?.quarters && <span className="text-xs text-muted">EMTA · {t("risk.asOf", { date: fmtAsOf(s.as_of.quarters) })}</span>}
            </div>
            {quarters.length ? <Turnover quarters={quarters} /> : <p className="text-sm text-muted">{t("risk.noTurnover")}</p>}
          </div>
          <div className="rounded-control p-4 grid gap-2" style={{ background: "var(--color-surface-subtle)" }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-semibold">{t("risk.company")}</span>
              {s.status && <Pill tone={/kantud|registered|aktiivne|active/i.test(s.status) ? "success" : "error"}>{s.status}</Pill>}
            </div>
            <dl className="kv text-sm [&_dd]:text-left [&_dd]:font-medium">
              <dt>{t("risk.companyName")}</dt><dd>{s.name ?? "—"}</dd>
              <dt>{t("risk.registryCode")}</dt><dd className="font-mono">{s.registry_code ?? "—"}</dd>
              <dt>{t("risk.legalForm")}</dt><dd>{s.legal_form ?? "—"}</dd>
              <dt>{t("risk.registeredOn")}</dt><dd>{s.registered_on ? fmtDate(s.registered_on) : "—"}</dd>
              <dt>{t("risk.activity")}</dt><dd>{s.activity ?? "—"}</dd>
            </dl>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{t("risk.signals")}</span><span className="overline">{t("risk.checks", { n: r.signals.length })}</span></div>
        {r.signals.length === 0 ? <p className="text-sm text-muted">{t("risk.noSignals")}</p> : (
          <div className="-mx-[var(--card-padding)]">
            <Table>
              <thead><tr><th>{t("risk.source")}</th><th>{t("risk.level")}</th><th>{t("risk.signal")}</th></tr></thead>
              <tbody>
                {r.signals.map((sig, i) => (
                  <tr key={i}>
                    <Td l={t("risk.source")} className="whitespace-nowrap font-semibold">{sig.source}</Td>
                    <Td l={t("risk.level")}><Pill tone={levelTone(sig.level)}>{tEnum("risk.levels", sig.level)}</Pill></Td>
                    <Td l={t("risk.signal")} className="text-muted">{sig.text}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted leading-5">
        <b className="font-semibold text-ink">{t("risk.sources")}:</b> {t("risk.sourcesNames")}
        {asOf && <> · {t("risk.asOf", { date: fmtAsOf(asOf) })}</>}
        {unavailable.length > 0 && <> · {t("risk.unavailableList", { list: unavailable.join(", ") })}</>}
        {r.generated_at && <> · {t("risk.generatedAt", { at: fmtDateTime(r.generated_at) })}</>}
      </p>

      {!compact && reports.length > 1 && <History reports={reports} current={r.id} onSelect={onSelect} />}
    </CardBody>
  );
}

/** Semicircle gauge: three rounded segments (red → amber → green) with the marker on the segment of the score, the score word large below. */
function Gauge({ level, points }: { level: RiskLevel | null; points: number }) {
  const cx0 = 100, cy = 96, R = 78;
  const ang = (p: number) => ((180 - p * 180) * Math.PI) / 180;
  const pt = (p: number, rad: number) => [cx0 + rad * Math.cos(ang(p)), cy - rad * Math.sin(ang(p))] as const;
  const arc = (p0: number, p1: number) => { const [x0, y0] = pt(p0, R), [x1, y1] = pt(p1, R); return `M${x0.toFixed(2)},${y0.toFixed(2)} A${R},${R} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`; };
  const segs: [number, number, RiskLevel][] = [[0, 1 / 3, "KÕRGE"], [1 / 3, 2 / 3, "KESKMINE"], [2 / 3, 1, "MADAL"]];
  const gap = 0.025;
  const seg = segs.find((x) => x[2] === level);
  const marker = seg ? pt((seg[0] + seg[1]) / 2, R) : null;
  const color = level ? LEVEL_VAR[level] : "var(--color-text-secondary)";
  return (
    <div className="grid justify-items-center w-[220px] max-w-full mx-auto md:mx-0" aria-label={`${t("risk.riskIs")} ${tEnum("risk.levels", level)}`}>
      <svg viewBox="0 0 200 110" className="w-full h-auto" aria-hidden="true">
        {segs.map(([p0, p1, l]) => <path key={l} d={arc(p0 + gap, p1 - gap)} fill="none" stroke={LEVEL_VAR[l]} strokeWidth={10} strokeLinecap="round" opacity={level && l !== level ? 0.28 : 1} />)}
        {marker && <circle cx={marker[0].toFixed(2)} cy={marker[1].toFixed(2)} r={9} fill={color} stroke="var(--color-surface)" strokeWidth={3} />}
        <text x={100} y={92} textAnchor="middle" fontSize={34} fontWeight={700} fontFamily="var(--font-heading)" fill={color} letterSpacing="-0.02em">{level ? tEnum("risk.levels", level).toUpperCase() : "—"}</text>
      </svg>
      <div className="text-xs text-muted -mt-1">{t("risk.riskIs")} <b style={{ color }}>{level ? tEnum("risk.levels", level).toLowerCase() : "—"}</b> · {t("risk.points", { n: points })} · {t("risk.advisory")}</div>
    </div>
  );
}

/** Quarterly turnover bars (EMTA, up to 8 quarters); the last-4 sum above, hover/title gives the exact value. */
function Turnover({ quarters }: { quarters: RiskQuarter[] }) {
  const kv = quarters.slice(-8);
  const max = Math.max(...kv.map((q) => q.turnover ?? 0), 1);
  const last4 = kv.slice(-4);
  const sum = last4.reduce((a, q) => a + (q.turnover ?? 0), 0);
  const emp = last4[last4.length - 1]?.employees;
  return (
    <div className="grid gap-2">
      <div className="text-xs text-muted"><b className="text-base font-semibold text-ink mr-1">{eurK(sum)}</b>{t("risk.turnoverLast4")}{emp !== null && emp !== undefined ? ` · ${t("risk.employees", { n: emp })}` : ""}</div>
      <div className="flex items-end gap-1.5 h-24">
        {kv.map((q, i) => {
          const h = Math.max(4, ((q.turnover ?? 0) / max) * 100);
          const label = `${t("risk.quarter", { q: ROMAN[q.q - 1] ?? q.q, year: q.year })} · ${fmtNum(Math.round(q.turnover ?? 0))} €${q.employees !== null && q.employees !== undefined ? ` · ${t("risk.employees", { n: q.employees })}` : ""}`;
          return (
            <div key={`${q.year}-${q.q}`} className="flex-1 min-w-0 grid gap-1 h-full content-end" title={label}>
              <div className="rounded-sm w-full" style={{ height: `${h}%`, background: i >= kv.length - 4 ? "var(--color-primary)" : "var(--color-divider)" }} />
              <div className="text-[10px] text-muted text-center font-mono truncate">{ROMAN[q.q - 1] ?? q.q}{q.q === 1 || i === 0 ? <span className="hidden sm:inline"> {q.year}</span> : null}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function History({ reports, current, onSelect }: { reports: RiskReport[]; current: string; onSelect: (id: string) => void }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-semibold">{t("risk.history")}</span>
      <ul className="grid gap-1 text-sm">
        {reports.map((r, i) => (
          <li key={r.id}>
            <button type="button" className={cx("flex items-center gap-3 w-full text-left px-2 py-1.5 rounded-control hover:bg-canvas", r.id === current && "bg-canvas")} onClick={() => onSelect(r.id)} aria-current={r.id === current || undefined}>
              <span className="tabular-nums text-muted w-32 shrink-0">{fmtDateTime(r.generated_at ?? r.created_at)}</span>
              {r.status === "ready" ? <Pill tone={levelTone(r.score)}>{tEnum("risk.levels", r.score)}</Pill> : r.status === "queued" ? <Pill tone="info">{t("common.loading")}</Pill> : <Pill tone="error">{t("risk.failed")}</Pill>}
              {r.status === "ready" && <span className="text-muted text-xs">{t("risk.points", { n: r.points })}</span>}
              {i === 0 && <span className="text-xs text-muted ml-auto">{t("risk.current")}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** EMTA as-of values are either an ISO date or a „2026-Q3” tag. */
function fmtAsOf(v: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(v);
  if (m) return t("risk.quarter", { q: ROMAN[Number(m[2]) - 1], year: m[1] });
  return /^\d{4}-\d{2}-\d{2}/.test(v) ? fmtDate(v) : v;
}
