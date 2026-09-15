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
import type { NotifyDays } from "@/types/api";

const FIELDS: { key: keyof NotifyDays; label: "settings.notifications.end" | "settings.notifications.indexation" | "settings.notifications.probation" | "settings.notifications.salaryReview" | "settings.notifications.quoteExpiry" }[] = [
  { key: "end", label: "settings.notifications.end" }, { key: "indexation", label: "settings.notifications.indexation" }, { key: "probation", label: "settings.notifications.probation" },
  { key: "salary_review", label: "settings.notifications.salaryReview" }, { key: "quote_expiry", label: "settings.notifications.quoteExpiry" },
];
type Form = Record<keyof NotifyDays, string>;

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
  if (acc.isLoading) return <Loading />;
  if (acc.error) return <ErrorState error={acc.error} onRetry={() => acc.refetch()} />;
  return (
    <Card className="max-w-[640px]">
      <CardHeader title={t("settings.notifications.title")}><p className="text-muted text-sm">{t("settings.notifications.sub")}</p></CardHeader>
      <form onSubmit={onSubmit} noValidate className="card-b">
        <div className="grid gap-x-4 sm:grid-cols-2">
          {FIELDS.map((f) => <Input key={f.key} label={`${t(f.label)} (${t("settings.notifications.days")})`} type="number" min={0} inputMode="numeric" {...register(f.key)} />)}
        </div>
        <div className="flex justify-end"><Button type="submit" variant="primary" busy={update.isPending}>{t("common.save")}</Button></div>
      </form>
    </Card>
  );
}
