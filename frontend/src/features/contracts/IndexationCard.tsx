"use client";
import { useEffect, useMemo, useState } from "react";
import { t } from "@/i18n";
import { useApplyIndexation, useIndexation } from "@/lib/queries/portfolio";
import { errorMessage } from "@/lib/api";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, fmtFixed } from "@/lib/format";
import type { IndexationProposal } from "@/types/api";

interface Row { id: string; due: string; locked: boolean; applied: boolean; pct: string; amount: string; touched: boolean }

const num = (s: string): number | null => { const v = Number(s.replace(/\s/g, "").replace(",", ".")); return s.trim() === "" || isNaN(v) ? null : v; };
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Resolving an indexation is what changes the rent: every open, due indexation of this contract in one place — row by row
 *  (applied/skipped, % or amount, the chain compounds), or only today's rent („Tean ainult praegust üüri”). */
export function IndexationCard({ contractId }: { contractId: string }) {
  const q = useIndexation(contractId);
  if (!q.data || q.data.steps.length === 0) return null;
  return <Catchup key={q.data.steps.map((s) => s.key_date_id).join()} contractId={contractId} p={q.data} />;
}

function Catchup({ contractId, p }: { contractId: string; p: IndexationProposal }) {
  const apply = useApplyIndexation(contractId);
  const toast = useToast();
  const rate = p.rule.method === "fixed_pct" && p.rule.rate != null ? String(p.rule.rate).replace(".", ",") : "";
  const [rows, setRows] = useState<Row[]>(() => p.steps.map((s) => ({ id: s.key_date_id, due: s.due_date, locked: s.locked, applied: true, pct: rate, amount: "", touched: false })));
  const [mode, setMode] = useState<"steps" | "current">("steps");
  const [current, setCurrent] = useState("");
  const rent = p.rent;

  // the chain: each applied row starts from the rent the previous one left (compounding); a typed amount wins over the %
  const chain = useMemo(() => {
    let base = rent?.value ?? null;
    return rows.map((r) => {
      if (!r.applied || r.locked || base == null) return null;
      const pct = num(r.pct);
      const amt = r.touched ? num(r.amount) : pct != null ? round2(base * (1 + pct / 100)) : null;
      if (amt != null) base = amt;
      return amt;
    });
  }, [rows, rent]);
  const final = [...chain].reverse().find((x) => x != null) ?? rent?.value ?? null;
  const lastDue = rows.filter((r) => !r.locked).at(-1)?.due ?? rows.at(-1)?.due;
  useEffect(() => { if (mode === "current" && current === "" && final != null) setCurrent(fmtFixed(final).replace(/\s/g, "")); }, [mode, current, final]);

  const set = (i: number, patch: Partial<Row>) => setRows((xs) => xs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const submit = async () => {
    try {
      if (mode === "current") {
        const v = num(current);
        if (v == null || v <= 0) { toast.error(t("indexation.needAmount")); return; }
        await apply.mutateAsync({ current_rent: v });
      } else {
        if (rent && rows.some((r, i) => r.applied && !r.locked && chain[i] == null)) { toast.error(t("indexation.needAmount")); return; }
        await apply.mutateAsync({ steps: rows.map((r, i) => ({ key_date_id: r.id, applied: r.applied, amount: r.applied && !r.locked && rent ? chain[i] : null })) });
      }
      toast.success(t("indexation.saved"));
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const unit = rent?.unit ? ` ${rent.unit}` : "";

  return (
    <Card className="border-warning">
      <CardHeader title={t("indexation.title")} />
      <CardBody>
        <p className="text-sm font-medium">{rows.length === 1 ? t("indexation.openOne", { date: fmtDate(rows[0].due) }) : t("indexation.openMany", { n: rows.length })}</p>
        <p className="text-xs text-muted mt-1">
          {p.rule.method === "fixed_pct" ? t("indexation.ruleFixed", { rate }) : p.rule.method === "cpi" ? t("indexation.ruleCpi") : t("indexation.ruleNone")}
        </p>
        <p className="text-xs text-muted">
          {rent?.value != null ? <>{rent.label}: {t("indexation.current", { value: `${fmtFixed(rent.value)}${unit}`, date: fmtDate(rent.valid_from) })}</> : t("indexation.noRent")}
        </p>

        {mode === "steps" ? (
          <div className="mt-3 grid gap-1.5">
            <div className="grid grid-cols-[6.5rem_3.5rem_4rem_minmax(0,1fr)] gap-2 text-xs text-muted">
              <span>{t("indexation.date")}</span><span>{t("indexation.applied")}</span><span>{rent ? t("indexation.pct") : ""}</span><span>{rent ? t("indexation.amount") : ""}</span>
            </div>
            {rows.map((r, i) => (
              <div key={r.id} className="grid grid-cols-[6.5rem_3.5rem_4rem_minmax(0,1fr)] gap-2 items-center text-sm">
                <span className="font-mono tabular-nums">{fmtDate(r.due)}</span>
                <input type="checkbox" className="w-4 h-4" checked={r.applied} onChange={(e) => set(i, { applied: e.target.checked })} aria-label={`${t("indexation.applied")} ${fmtDate(r.due)}`} />
                {r.locked || !rent ? (
                  <span className="col-span-2 text-xs text-muted">{r.locked ? t("indexation.locked") : ""}</span>
                ) : (
                  <>
                    <input className="fld !h-8 !px-2 tabular-nums" inputMode="decimal" disabled={!r.applied} value={r.applied ? r.pct : ""} onChange={(e) => set(i, { pct: e.target.value, touched: false })} aria-label={`${t("indexation.pct")} ${fmtDate(r.due)}`} />
                    <input className="fld !h-8 !px-2 tabular-nums" inputMode="decimal" disabled={!r.applied}
                           value={!r.applied ? "" : r.touched ? r.amount : chain[i] != null ? fmtFixed(chain[i]!).replace(/\s/g, "") : ""}
                           onChange={(e) => set(i, { amount: e.target.value, touched: true })} aria-label={`${t("indexation.amount")} ${fmtDate(r.due)}`} />
                  </>
                )}
              </div>
            ))}
            {rent?.value != null && final != null && (
              <p className="text-sm mt-1">{t("indexation.after")}: <strong className="tabular-nums">{fmtFixed(final)}{unit}</strong></p>
            )}
          </div>
        ) : (
          <div className="mt-3 grid gap-1">
            <label className="text-xs text-muted" htmlFor="ix-current">{t("indexation.currentLabel")}{unit && ` (${rent?.unit})`}</label>
            <input id="ix-current" className="fld tabular-nums" inputMode="decimal" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <p className="text-xs text-muted">{t("indexation.currentHint", { date: fmtDate(lastDue) })}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 justify-end mt-3">
          {rent?.value != null && (
            <Button size="sm" variant="text" className="mr-auto -ml-2" onClick={() => setMode(mode === "steps" ? "current" : "steps")}>
              {mode === "steps" ? t("indexation.onlyCurrent") : t("indexation.stepByStep")}
            </Button>
          )}
          <Button size="sm" variant="primary" busy={apply.isPending} onClick={submit}>{t("indexation.confirm")}</Button>
        </div>
      </CardBody>
    </Card>
  );
}
