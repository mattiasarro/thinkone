"use client";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, FormRow } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useSaveParty } from "@/lib/queries/portfolio";
import type { Party, PartyKind } from "@/types/api";

const schema = z.object({
  kind: z.enum(["ee_company", "foreign_company", "person"]),
  name: z.string().min(1, t("common.required")),
  registry_code: z.string().optional(), personal_code: z.string().optional(), vat_number: z.string().optional(), address: z.string().optional(),
  contact_name: z.string().optional(), email: z.string().email(t("common.validationError")).optional().or(z.literal("")), phone: z.string().optional(), roles: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function PartyModal({ open, onClose, initial, defaults, onSaved }: { open: boolean; onClose: () => void; initial?: Party | null; defaults?: Partial<Party>; onSaved?: (p: Party) => void }) {
  const save = useSaveParty();
  const toast = useToast();
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { kind: "ee_company", name: "" } });
  useEffect(() => {
    if (!open) return;
    const src = initial ?? defaults;
    reset({
      kind: (src?.kind as PartyKind) ?? "ee_company", name: src?.name ?? "", registry_code: src?.registry_code ?? "", personal_code: src?.personal_code ?? "", vat_number: src?.vat_number ?? "",
      address: src?.address ?? "", contact_name: src?.contact_name ?? "", email: src?.email ?? "", phone: src?.phone ?? "", roles: (src?.roles ?? []).join(", "),
    });
  }, [open, initial, defaults, reset]);
  const kind = watch("kind");
  const onSubmit = handleSubmit(async (v) => {
    try {
      const p = await save.mutateAsync({
        id: initial?.id, kind: v.kind, name: v.name, registry_code: v.registry_code || null, personal_code: v.personal_code || null, vat_number: v.vat_number || null, address: v.address || null,
        contact_name: v.contact_name || null, email: v.email || null, phone: v.phone || null, roles: (v.roles ?? "").split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success(t("toast.saved"));
      onSaved?.(p);
      onClose();
    } catch (e) { toast.error(errorMessage(e)); }
  });
  return (
    <Modal open={open} onClose={onClose} title={initial ? t("portfolio.parties.edit") : t("portfolio.parties.add")} footer={
      <><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" type="submit" form="party-form" busy={save.isPending}>{t("common.save")}</Button></>
    }>
      <form id="party-form" onSubmit={onSubmit} noValidate>
        <FormRow>
          <Select label={t("portfolio.parties.kind")} {...register("kind")} options={[
            { value: "ee_company", label: t("portfolio.parties.kinds.ee_company") }, { value: "foreign_company", label: t("portfolio.parties.kinds.foreign_company") }, { value: "person", label: t("portfolio.parties.kinds.person") },
          ]} />
          <Input label={t("portfolio.parties.name")} required error={errors.name?.message} {...register("name")} />
        </FormRow>
        <FormRow>
          {kind === "person" ? <Input label={t("portfolio.parties.personalCode")} {...register("personal_code")} /> : <Input label={t("portfolio.parties.registryCode")} {...register("registry_code")} />}
          {kind !== "person" && <Input label={t("portfolio.parties.vatNumber")} {...register("vat_number")} />}
        </FormRow>
        <Input label={t("portfolio.parties.address")} {...register("address")} />
        <FormRow cols={3}>
          <Input label={t("portfolio.parties.contactName")} {...register("contact_name")} />
          <Input label={t("portfolio.parties.email")} type="email" error={errors.email?.message} {...register("email")} />
          <Input label={t("portfolio.parties.phone")} {...register("phone")} />
        </FormRow>
        <Input label={t("portfolio.parties.roles")} hint={t("portfolio.parties.rolesHint")} {...register("roles")} />
      </form>
    </Modal>
  );
}
