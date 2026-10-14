"use client";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { useOrderRisk, useRiskHistory } from "@/lib/queries/risk";
import { Pill, type Tone } from "@/components/ui/Pill";
import { Spinner } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import type { RiskLevel, RiskReport } from "@/types/api";

export const LEVEL_TONE: Record<RiskLevel, Tone> = { KÕRGE: "error", KESKMINE: "warning", MADAL: "success" };
export function levelTone(level: string | null | undefined): Tone {
  return (level && LEVEL_TONE[level as RiskLevel]) || "neutral";
}
export function partyHasRisk(p: { kind: string; registry_code: string | null } | null | undefined): boolean {
  return !!p && p.kind !== "person" && !!p.registry_code;
}

/** Small score pill (tone by level) + report date, linking to the party's risk tab; without a report a text button that orders one. */
export function RiskPill({ partyId, href, enabled = true }: { partyId: string; href?: string; enabled?: boolean }) {
  const history = useRiskHistory(partyId, enabled);
  const order = useOrderRisk(partyId);
  const toast = useToast();
  if (!enabled) return null;
  const latest: RiskReport | undefined = history.data?.[0];
  const link = href ?? `/app/portfell/osapool/${partyId}?tab=risk`;
  if (history.isLoading) return <span className="pill"><Spinner className="!w-3 !h-3" /></span>;
  if (!latest || (latest.status === "failed" && history.data?.length === 1)) {
    return (
      <button type="button" className="btn btn-text btn-sm -ml-2 text-muted" disabled={order.isPending} aria-busy={order.isPending || undefined}
        onClick={async () => { try { await order.mutateAsync(); toast.success(t("risk.ordered")); } catch (e) { toast.error(errorMessage(e)); } }}>
        {t("risk.missing")} · {t("risk.order")}
      </button>
    );
  }
  if (latest.status === "queued") return <Link href={link} className="pill info" title={t("risk.queued")}><Spinner className="!w-3 !h-3" />{t("risk.title")}</Link>;
  const ready = latest.status === "ready" ? latest : history.data?.find((r) => r.status === "ready");
  if (!ready) return <Link href={link} className="pill error">{t("risk.failed")}</Link>;
  return (
    <Link href={link} title={t("risk.open")} className="inline-flex items-center gap-2">
      <Pill tone={levelTone(ready.score)}>{t("risk.title")} · {tEnum("risk.levels", ready.score)}</Pill>
      <span className="text-xs text-muted">{fmtDate(ready.generated_at ?? ready.created_at)}</span>
    </Link>
  );
}
