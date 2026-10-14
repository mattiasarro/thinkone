"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useForm } from "react-hook-form";
import { t } from "@/i18n";
import { useAccount, useAgentUsage, useUpdateAccount } from "@/lib/queries/settings";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import type { Account, NotifyDays, QuoteDefaults } from "@/types/api";

const FIELDS: { key: keyof NotifyDays; label: "settings.notifications.end" | "settings.notifications.indexation" | "settings.notifications.probation" | "settings.notifications.salaryReview" | "settings.notifications.quoteExpiry" }[] = [
  { key: "end", label: "settings.notifications.end" }, { key: "indexation", label: "settings.notifications.indexation" }, { key: "probation", label: "settings.notifications.probation" },
  { key: "salary_review", label: "settings.notifications.salaryReview" }, { key: "quote_expiry", label: "settings.notifications.quoteExpiry" },
];
type Form = Record<keyof NotifyDays, string>;
const QFIELDS: { key: keyof QuoteDefaults; label: "quotes.settings.validityDays" | "quotes.settings.periodMonths" | "quotes.settings.depositMonths" | "quotes.settings.silenceDays" | "quotes.settings.contractLinkDays"; min: number }[] = [
  { key: "validity_days", label: "quotes.settings.validityDays", min: 0 }, { key: "period_months", label: "quotes.settings.periodMonths", min: 1 }, { key: "deposit_months", label: "quotes.settings.depositMonths", min: 0 },
  { key: "silence_days", label: "quotes.settings.silenceDays", min: 1 }, { key: "contract_link_days", label: "quotes.settings.contractLinkDays", min: 1 },
];
type QForm = Record<keyof QuoteDefaults, string>;

export function NotificationsTab() {
  const acc = useAccount();
  const update = useUpdateAccount();
  const toast = useToast();
  const { register, handleSubmit, reset } = useForm<Form>();
  useEffect(() => {
    const nd = acc.data?.settings?.notify_days;
    if (nd) reset(Object.fromEntries(FIELDS.map((f) => [f.key, nd[f.key] != null ? String(nd[f.key]) : ""])) as Form);
  }, [acc.data, reset]);
  const onSubmit = handleSubmit(async (v) => {
    const notify_days = Object.fromEntries(FIELDS.map((f) => [f.key, v[f.key] === "" ? 0 : Number(v[f.key])])) as unknown as NotifyDays;
    try { await update.mutateAsync({ settings: { notify_days } }); toast.success(t("settings.notifications.saved")); } catch (e) { toast.error(errorMessage(e)); }
  });
  const qf = useForm<QForm>();
  useEffect(() => {
    const qd = acc.data?.settings?.quote;
    if (qd) qf.reset(Object.fromEntries(QFIELDS.map((f) => [f.key, qd[f.key] != null ? String(qd[f.key]) : ""])) as QForm);
  }, [acc.data, qf]);
  const onSubmitQuote = qf.handleSubmit(async (v) => {
    const quote = Object.fromEntries(QFIELDS.filter((f) => v[f.key] !== "").map((f) => [f.key, Number(v[f.key])])) as Partial<QuoteDefaults>;
    try { await update.mutateAsync({ settings: { quote } }); toast.success(t("quotes.settings.saved")); } catch (e) { toast.error(errorMessage(e)); }
  });
  if (acc.isLoading) return <Loading />;
  if (acc.error) return <ErrorState error={acc.error} onRetry={() => acc.refetch()} />;
  return (
    <div className="grid gap-5 max-w-[640px]">
    <Card>
      <CardHeader title={t("settings.notifications.title")}><p className="text-muted text-sm">{t("settings.notifications.sub")}</p></CardHeader>
      <form onSubmit={onSubmit} noValidate className="card-b">
        <div className="grid gap-x-4 sm:grid-cols-2">
          {FIELDS.map((f) => <Input key={f.key} label={`${t(f.label)} (${t("settings.notifications.days")})`} type="number" min={0} inputMode="numeric" {...register(f.key)} />)}
        </div>
        <div className="flex justify-end"><Button type="submit" variant="primary" busy={update.isPending}>{t("common.save")}</Button></div>
      </form>
    </Card>
    <Card>
      <CardHeader title={t("quotes.settings.title")}><p className="text-muted text-sm">{t("quotes.settings.sub")}</p></CardHeader>
      <form onSubmit={onSubmitQuote} noValidate className="card-b">
        <div className="grid gap-x-4 sm:grid-cols-2">
          {QFIELDS.map((f) => <Input key={f.key} label={t(f.label)} type="number" min={f.min} inputMode="numeric" {...qf.register(f.key)} />)}
        </div>
        <div className="flex justify-end"><Button type="submit" variant="primary" busy={update.isPending}>{t("common.save")}</Button></div>
      </form>
    </Card>
    <AiCard account={acc.data} />
    </div>
  );
}

/** Settings → Teavitused → „AI”: the monthly token budget (PATCH /account settings.ai) and this month's usage from /agent/usage. */
function AiCard({ account }: { account: Account | undefined }) {
  const update = useUpdateAccount();
  const usage = useAgentUsage();
  const toast = useToast();
  const [budget, setBudget] = useState("");
  useEffect(() => { const b = account?.settings?.ai?.monthly_token_budget ?? usage.data?.budget; if (b != null) setBudget(String(b)); }, [account, usage.data?.budget]);
  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = Math.max(0, Math.round(Number(budget) || 0));
    try { await update.mutateAsync({ settings: { ai: { monthly_token_budget: n } } }); toast.success(t("settings.ai.saved")); } catch (err) { toast.error(errorMessage(err)); }
  };
  const u = usage.data;
  const pct = u && u.budget > 0 ? Math.min(1, u.total_tokens / u.budget) : 0;
  return (
    <Card>
      <CardHeader title={t("settings.ai.title")}><p className="text-muted text-sm">{t("settings.ai.sub")}</p></CardHeader>
      <form onSubmit={onSubmit} noValidate className="card-b grid gap-3">
        <div className="grid gap-x-4 sm:grid-cols-2 items-end">
          <Input label={t("settings.ai.budget")} type="number" min={0} step="1" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value)} hint={t("settings.ai.budgetHint")} />
          <div className="field">
            <span className="field-label">{t("settings.ai.usage")}</span>
            {usage.isLoading ? <Loading rows={1} /> : usage.error ? <ErrorState error={usage.error} onRetry={() => usage.refetch()} /> : u && (
              <div className="grid gap-1 text-sm">
                <div className="flex items-center gap-2 flex-wrap"><span className="font-mono tabular-nums">{t("settings.ai.used", { used: fmtNum(u.total_tokens), budget: fmtNum(u.budget) })}</span><span className="text-muted text-xs">· {t("settings.ai.runs", { n: u.runs })}</span></div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-surface-subtle)" }}><div className="h-full rounded-full" style={{ width: `${Math.round(pct * 100)}%`, background: u.exhausted ? "var(--color-error)" : "var(--color-text)" }} /></div>
                <span className={u.exhausted ? "text-xs text-error font-semibold" : "text-xs text-muted"}>{u.exhausted ? t("settings.ai.exhausted") : t("settings.ai.remaining", { n: fmtNum(u.remaining) })}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end"><Button type="submit" variant="primary" busy={update.isPending}>{t("common.save")}</Button></div>
      </form>
    </Card>
  );
}
