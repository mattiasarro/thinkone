"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t, tEnum } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, FormRow } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useContracts, useKeyDateKinds, useSaveKeyDate } from "@/lib/queries/portfolio";
import type { KeyDate } from "@/types/api";

const schema = z.object({
  contract_id: z.string().optional(),
  kind_code: z.string().min(1, t("common.required")),
  title: z.string().min(1, t("common.required")),
  due_date: z.string().min(1, t("common.required")),
  notify_days_before: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function KeyDateDialog({ open, onClose, initial, contractId, lockContract }: { open: boolean; onClose: () => void; initial?: KeyDate | null; contractId?: string; lockContract?: boolean }) {
  const kinds = useKeyDateKinds();
  const contracts = useContracts({ view: "all" });
  const save = useSaveKeyDate();
  const toast = useToast();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { contract_id: contractId ?? "", kind_code: "", title: "", due_date: "", notify_days_before: "" } });

  useEffect(() => {
    if (!open) return;
    reset({
      contract_id: initial?.contract?.id ?? contractId ?? "",
      kind_code: initial?.kind_code ?? "",
      title: initial?.title ?? "",
      due_date: initial?.due_date?.slice(0, 10) ?? "",
      notify_days_before: initial?.notify_days_before != null ? String(initial.notify_days_before) : "",
    });
  }, [open, initial, contractId, reset]);

  const kind = watch("kind_code");
  useEffect(() => {
    if (!initial && kind) {
      const k = kinds.data?.find((x) => x.code === kind);
      if (k) {
        setValue("notify_days_before", String(k.default_notify_days));
        setValue("title", k.name_et);
      }
    }
  }, [kind, kinds.data, initial, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: initial?.id, contract_id: v.contract_id || null, kind_code: v.kind_code, title: v.title, due_date: v.due_date, notify_days_before: v.notify_days_before ? Number(v.notify_days_before) : null });
      toast.success(t("keyDates.saved"));
      onClose();
    } catch (e) { toast.error(errorMessage(e)); }
  });

  return (
    <Modal open={open} onClose={onClose} title={initial ? t("keyDates.edit") : t("keyDates.add")} footer={
      <>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" type="submit" form="keydate-form" busy={save.isPending}>{t("common.save")}</Button>
      </>
    }>
      <form id="keydate-form" onSubmit={onSubmit} noValidate>
        {!lockContract && (
          <Select label={t("keyDates.contract")} placeholder={t("keyDates.noContract")} {...register("contract_id")}>
            {(contracts.data ?? []).map((c) => <option key={c.id} value={c.id}>{[c.number, c.title].filter(Boolean).join(" · ")}</option>)}
          </Select>
        )}
        <FormRow>
          <Select label={t("keyDates.kind")} required placeholder={t("common.selectPlaceholder")} error={errors.kind_code?.message} {...register("kind_code")}>
            {(kinds.data ?? []).map((k) => <option key={k.code} value={k.code}>{k.name_et || tEnum("keyDates.kinds", k.code)}</option>)}
          </Select>
          <Input label={t("keyDates.dueDate")} type="date" required error={errors.due_date?.message} {...register("due_date")} />
        </FormRow>
        <Input label={t("keyDates.title_")} required error={errors.title?.message} {...register("title")} />
        <Input label={t("keyDates.notifyDays")} type="number" min={0} inputMode="numeric" {...register("notify_days_before")} />
      </form>
    </Modal>
  );
}
