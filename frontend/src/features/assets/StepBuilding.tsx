"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t } from "@/i18n";
import { Input, Select, FormRow } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useCompanies, useEhr } from "@/lib/queries/settings";
import { useCreateAsset, useUpdateAsset } from "@/lib/queries/portfolio";
import { Spinner } from "@/components/ui/State";
import { IconSearch, IconArrowRight, IconBuilding } from "@/components/ui/Icons";
import type { AssetDetail, EhrHit, PropertyAttributes } from "@/types/api";

const num = z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().optional());
const schema = z.object({
  name: z.string().min(1, t("common.required")),
  address: z.string().min(1, t("common.required")),
  company_id: z.string().min(1, t("common.required")),
  ehr_code: z.string().optional(), use_type: z.string().optional(),
  footprint_m2: num, net_area_m2: num, floors: num, build_year: num,
});
type FormIn = z.input<typeof schema>;
type Form = z.output<typeof schema>;

export function StepBuilding({ property, onSaved }: { property?: AssetDetail | null; onSaved: (id: string) => void }) {
  const companies = useCompanies();
  const create = useCreateAsset();
  const update = useUpdateAsset();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);
  const ehr = useEhr(dq);
  const [more, setMore] = useState(!!property);
  const attrs = (property?.attributes ?? {}) as PropertyAttributes;
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormIn, unknown, Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: property?.name ?? "", address: attrs.address ?? "", company_id: property?.company_id ?? "", ehr_code: attrs.ehr_code ?? "", use_type: attrs.use_type ?? "",
      footprint_m2: attrs.footprint_m2 ?? undefined, net_area_m2: attrs.net_area_m2 ?? undefined, floors: attrs.floors ?? undefined, build_year: attrs.build_year ?? undefined,
    },
  });
  useEffect(() => {
    if (!property && companies.data?.length === 1) setValue("company_id", companies.data[0].id);
  }, [companies.data, property, setValue]);

  const pick = (h: EhrHit) => {
    setValue("address", h.address); setValue("ehr_code", h.ehr_code); setValue("use_type", h.use_type ?? "");
    setValue("footprint_m2", h.footprint_m2 ?? undefined); setValue("net_area_m2", h.net_area_m2 ?? undefined); setValue("floors", h.floors ?? undefined); setValue("build_year", h.build_year ?? undefined);
    setMore(true); setQ("");
  };

  const onSubmit = handleSubmit(async (v) => {
    const attributes: PropertyAttributes = { ...attrs, address: v.address, ehr_code: v.ehr_code || null, use_type: v.use_type || null, footprint_m2: v.footprint_m2 ?? null, net_area_m2: v.net_area_m2 ?? null, floors: v.floors ?? null, build_year: v.build_year ?? null };
    try {
      if (property) { await update.mutateAsync({ id: property.id, name: v.name, company_id: v.company_id || null, attributes: attributes as Record<string, unknown> }); onSaved(property.id); }
      else { const a = await create.mutateAsync({ type_code: "property", name: v.name, company_id: v.company_id || null, attributes: attributes as Record<string, unknown> }); onSaved(a.id); }
      toast.success(t("assets.propertySaved"));
    } catch (e) { toast.error(errorMessage(e)); }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="card pad">
        <h2 className="text-lg mb-1">{t("assets.steps.building")}</h2>
        <p className="text-muted text-sm mb-4">{t("assets.ehrSearchHint")}</p>
        <div className="relative">
          <label className="flex items-center gap-2 fld h-12">
            <IconSearch width={16} height={16} className="text-muted flex-none" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("assets.ehrSearch")} aria-label={t("assets.ehrSearch")} className="flex-1 min-w-0 bg-transparent outline-none" />
            {ehr.isFetching && <Spinner />}
          </label>
          {dq.length >= 2 && !ehr.isLoading && (
            <div className="mt-2 grid gap-2">
              {(ehr.data ?? []).length === 0 ? <p className="text-sm text-muted px-1">{t("assets.ehrNoResults")}</p> : (ehr.data ?? []).slice(0, 8).map((h) => (
                <button key={h.ehr_code} type="button" className="flex items-center gap-3 text-left p-3 rounded-control hover:bg-canvas border" style={{ borderColor: "var(--line)" }} onClick={() => pick(h)}>
                  <span className="w-9 h-9 rounded-control grid place-items-center text-muted flex-none" style={{ background: "var(--color-surface-subtle)" }}><IconBuilding width={18} height={18} /></span>
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-sm truncate">{h.address}</span><span className="block text-xs text-muted">EHR {h.ehr_code}{h.use_type ? ` · ${h.use_type}` : ""}{h.net_area_m2 ? ` · ${h.net_area_m2} m²` : ""}</span></span>
                  <span className="btn btn-ghost btn-sm">{t("assets.useResult")}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="mt-5">
          <FormRow>
            <Input label={t("assets.name")} required error={errors.name?.message} {...register("name")} />
            <Select label={t("assets.company")} required placeholder={t("common.selectPlaceholder")} error={errors.company_id?.message} hint={companies.data && companies.data.length === 0 ? <Link href="/app/seaded?tab=ettevotted" className="text-primary font-semibold">{t("assets.noCompanies")}</Link> : undefined} {...register("company_id")}>
              {(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormRow>
          <Input label={t("assets.address")} required error={errors.address?.message} {...register("address")} />
          <button type="button" className="text-primary font-semibold text-sm mb-3" onClick={() => setMore((m) => !m)} aria-expanded={more}>{more ? t("common.showLess") : t("assets.moreFields")}</button>
          {more && (
            <FormRow cols={3}>
              <Input label={t("assets.ehrCode")} {...register("ehr_code")} />
              <Input label={t("assets.useType")} {...register("use_type")} />
              <Input label={t("assets.buildYear")} type="number" inputMode="numeric" {...register("build_year")} />
              <Input label={t("assets.footprint")} type="number" step="0.01" inputMode="decimal" {...register("footprint_m2")} />
              <Input label={t("assets.netArea")} type="number" step="0.01" inputMode="decimal" {...register("net_area_m2")} />
              <Input label={t("assets.floors")} type="number" inputMode="numeric" {...register("floors")} />
            </FormRow>
          )}
        </div>
      </div>
      <div className="flex justify-end"><Button type="submit" variant="primary" busy={create.isPending || update.isPending}>{t("common.next")}<IconArrowRight width={16} height={16} /></Button></div>
    </form>
  );
}
