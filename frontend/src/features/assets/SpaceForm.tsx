"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t, tEnum } from "@/i18n";
import { Input, Select, FormRow } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useAssignParking, useCreateAsset, useParking, useUpdateAsset } from "@/lib/queries/portfolio";
import { cx } from "@/lib/format";
import { type Asset, type ParkingSpot, type SpaceAttributes } from "@/types/api";

const num = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(String(v).replace(",", "."))), z.number().nonnegative().optional());
const schema = z.object({
  name: z.string().min(1, t("common.required")),
  type: z.string().min(1, t("common.required")),
  rentable_area_m2: z.preprocess((v) => (v === "" ? undefined : Number(String(v).replace(",", "."))), z.number({ message: t("common.required") }).positive(t("common.required"))),
  price_per_m2: num, electrical_capacity_a: num, parking_spots: num, floor: z.string().optional(),
});
type FormIn = z.input<typeof schema>;
type Form = z.output<typeof schema>;
/** Values match the backend CSV vocabulary (real_estate vertical): büroo | ladu | tootmine | … */
export const SPACE_TYPES = ["büroo", "ladu", "kaubandus", "tootmine", "laobokss", "parkimine", "muu"];

export function SpaceForm({ propertyId, companyId, space, onDone, onCancel, standalone }: { propertyId: string; companyId: string | null; space?: Asset | null; onDone: () => void; onCancel: () => void; standalone?: boolean }) {
  const a = (space?.attributes ?? {}) as Partial<SpaceAttributes>;
  const create = useCreateAsset();
  const update = useUpdateAsset();
  const assign = useAssignParking(propertyId);
  const parking = useParking(propertyId);
  const toast = useToast();
  const register_ = useMemo(() => parking.data ?? [], [parking.data]);
  const hasRegister = register_.length > 0;
  const mine = useMemo(() => register_.filter((s) => space && s.space_id === space.id).map((s) => s.number), [register_, space]);
  const [numbers, setNumbers] = useState<string[] | null>(null); // null = untouched
  const picked = numbers ?? mine;
  const { register, handleSubmit, formState: { errors } } = useForm<FormIn, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: space?.name ?? "", type: a.type ?? "büroo", rentable_area_m2: a.rentable_area_m2, price_per_m2: a.price_per_m2 ?? undefined,
      electrical_capacity_a: a.electrical_capacity_a ?? undefined, parking_spots: a.parking_spots ?? undefined, floor: a.floor ?? "",
    },
  });
  const locked = !!space && space.status !== "vaba" && space.status !== "jagatud" && space.status !== null;

  const onSubmit = handleSubmit(async (v) => {
    // Area parts (ladu/kontor/…) are not edited here; they come from the spaces import and are kept as-is via `...a`.
    const attributes: Record<string, unknown> = { ...a, type: v.type, rentable_area_m2: v.rentable_area_m2, price_per_m2: v.price_per_m2 ?? null,
      electrical_capacity_a: v.electrical_capacity_a ?? null, floor: v.floor || null, parking_spots: hasRegister ? picked.length : v.parking_spots ?? null };
    try {
      let id = space?.id;
      if (space) await update.mutateAsync({ id: space.id, name: v.name, attributes });
      else { const created = await create.mutateAsync({ type_code: "space", name: v.name, parent_id: propertyId, company_id: companyId, attributes }); id = created.id; }
      if (hasRegister && id && numbers !== null && [...numbers].sort().join() !== [...mine].sort().join()) await assign.mutateAsync({ space_id: id, numbers });
      toast.success(t("assets.spaceSaved"));
      onDone();
    } catch (e) { toast.error(errorMessage(e)); }
  });
  const toggle = (s: ParkingSpot) => {
    const cur = new Set(picked);
    if (cur.has(s.number)) cur.delete(s.number); else cur.add(s.number);
    setNumbers([...cur]);
  };
  return (
    <form onSubmit={(e) => { e.stopPropagation(); onSubmit(e); }} noValidate className={cx(!standalone && "rounded-control p-4 border")} style={standalone ? undefined : { borderColor: "var(--color-divider)", background: "var(--color-canvas)" }}>
      <FormRow>
        <Input label={t("assets.spaceName")} required autoFocus error={errors.name?.message} {...register("name")} />
        <Select label={t("assets.spaceType")} required error={errors.type?.message} {...register("type")} options={SPACE_TYPES.map((s) => ({ value: s, label: tEnum("assets.spaceTypes", s) }))} />
      </FormRow>
      <FormRow cols={3}>
        <Input label={t("assets.rentable")} required type="number" step="0.01" inputMode="decimal" error={errors.rentable_area_m2?.message} readOnly={locked} hint={locked ? t("contract.locked") : undefined} {...register("rentable_area_m2")} />
        <Input label={t("assets.price")} type="number" step="0.01" inputMode="decimal" {...register("price_per_m2")} />
        <Input label={t("assets.electrical")} type="number" step="1" inputMode="decimal" {...register("electrical_capacity_a")} />
      </FormRow>
      <FormRow>
        <Input label={t("assets.floor")} {...register("floor")} />
        {!hasRegister && <Input label={t("assets.parking")} type="number" inputMode="numeric" hint={parking.isLoading ? undefined : t("assets.parkingNoRegister")} {...register("parking_spots")} />}
      </FormRow>
      {hasRegister && (
        <fieldset className="field">
          <legend className="field-label">{t("assets.parkingNumbers")} <span className="text-xs text-muted font-normal">· {picked.length}</span></legend>
          <p className="text-xs text-muted mb-2">{t("assets.parkingNumbersHint")} <Link href={`/app/portfell/objekt/${propertyId}/parkimine`} className="text-primary font-semibold">{t("assets.parkingRegisterLink")}</Link></p>
          <div className="flex flex-wrap gap-1.5">
            {register_.map((s) => {
              const on = picked.includes(s.number);
              const other = !!s.space_id && (!space || s.space_id !== space.id);
              return (
                <button key={s.id} type="button" onClick={() => toggle(s)} aria-pressed={on} title={other ? `${t("assets.parkingPickTaken")}: ${s.space_name}` : s.status ?? undefined}
                  className={cx("pill cursor-pointer select-none", on ? "primary" : other ? "warning" : s.out_of_service ? "error" : "", s.type === "elektriauto" && !on && "info")}>
                  {s.number}{other && !on ? ` · ${s.space_name}` : ""}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <div className="flex justify-end gap-2 mt-2"><Button onClick={onCancel}>{t("common.cancel")}</Button><Button type="submit" variant="primary" busy={create.isPending || update.isPending || assign.isPending}>{t("common.save")}</Button></div>
    </form>
  );
}
