"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { t } from "@/i18n";
import { useAccount, useUpdateAccount } from "@/lib/queries/settings";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import type { NotifyDays, QuoteDefaults } from "@/types/api";

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
    </div>
  );
}
