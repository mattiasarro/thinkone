"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t, tEnum } from "@/i18n";
import { Input, Select, FormRow } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useCreateAsset, useUpdateAsset } from "@/lib/queries/portfolio";
import type { Asset, SpaceAttributes } from "@/types/api";

const num = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().optional());
const schema = z.object({
  name: z.string().min(1, t("common.required")),
  type: z.string().min(1, t("common.required")),
  rentable_area_m2: z.preprocess((v) => (v === "" ? undefined : Number(v)), z.number({ message: t("common.required") }).positive(t("common.required"))),
  price_per_m2: num, net_area_m2: num, coefficient: num, electrical_capacity_kw: num, parking_spots: num,
});
type FormIn = z.input<typeof schema>;
type Form = z.output<typeof schema>;
/** Values match the backend CSV vocabulary (real_estate vertical): büroo | ladu | tootmine | … */
export const SPACE_TYPES = ["büroo", "ladu", "kaubandus", "tootmine", "laobokss", "parkimine", "muu"];

export function SpaceForm({ propertyId, companyId, space, onDone, onCancel }: { propertyId: string; companyId: string | null; space?: Asset | null; onDone: () => void; onCancel: () => void }) {
  const a = (space?.attributes ?? {}) as Partial<SpaceAttributes>;
  const create = useCreateAsset();
  const update = useUpdateAsset();
  const toast = useToast();
  const { register, handleSubmit, formState: { errors } } = useForm<FormIn, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: { name: space?.name ?? "", type: a.type ?? "büroo", rentable_area_m2: a.rentable_area_m2, price_per_m2: a.price_per_m2 ?? undefined, net_area_m2: a.net_area_m2 ?? undefined, coefficient: a.coefficient ?? undefined, electrical_capacity_kw: a.electrical_capacity_kw ?? undefined, parking_spots: a.parking_spots ?? undefined },
  });
  const onSubmit = handleSubmit(async (v) => {
    const attributes: SpaceAttributes = { ...a, type: v.type, rentable_area_m2: v.rentable_area_m2, price_per_m2: v.price_per_m2 ?? null, net_area_m2: v.net_area_m2 ?? null, coefficient: v.coefficient ?? null, electrical_capacity_kw: v.electrical_capacity_kw ?? null, parking_spots: v.parking_spots ?? null };
    try {
      if (space) await update.mutateAsync({ id: space.id, name: v.name, attributes: attributes as unknown as Record<string, unknown> });
      else await create.mutateAsync({ type_code: "space", name: v.name, parent_id: propertyId, company_id: companyId, attributes: attributes as unknown as Record<string, unknown> });
      toast.success(t("assets.spaceSaved"));
      onDone();
    } catch (e) { toast.error(errorMessage(e)); }
  });
  return (
    <form onSubmit={(e) => { e.stopPropagation(); onSubmit(e); }} noValidate className="rounded-control p-4 border" style={{ borderColor: "var(--color-divider)", background: "var(--color-canvas)" }}>
      <FormRow>
        <Input label={t("assets.spaceName")} required autoFocus error={errors.name?.message} {...register("name")} />
        <Select label={t("assets.spaceType")} required error={errors.type?.message} {...register("type")} options={SPACE_TYPES.map((s) => ({ value: s, label: tEnum("assets.spaceTypes", s) }))} />
      </FormRow>
      <FormRow>
        <Input label={t("assets.rentable")} required type="number" step="0.01" inputMode="decimal" error={errors.rentable_area_m2?.message} {...register("rentable_area_m2")} />
        <Input label={t("assets.price")} type="number" step="0.01" inputMode="decimal" {...register("price_per_m2")} />
      </FormRow>
      <details>
        <summary className="text-primary font-semibold text-sm cursor-pointer mb-3">{t("assets.moreFields")}</summary>
        <FormRow>
          <Input label={t("assets.net")} type="number" step="0.01" inputMode="decimal" {...register("net_area_m2")} />
          <Input label={t("assets.coefficient")} type="number" step="0.01" inputMode="decimal" {...register("coefficient")} />
          <Input label={t("assets.electrical")} type="number" step="0.1" inputMode="decimal" {...register("electrical_capacity_kw")} />
          <Input label={t("assets.parking")} type="number" inputMode="numeric" {...register("parking_spots")} />
        </FormRow>
      </details>
      <div className="flex justify-end gap-2 mt-2"><Button onClick={onCancel}>{t("common.cancel")}</Button><Button type="submit" variant="primary" busy={create.isPending || update.isPending}>{t("common.save")}</Button></div>
    </form>
  );
}
