"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { t } from "@/i18n";
import { Input, Checkbox, FormRow, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useUpdateAsset } from "@/lib/queries/portfolio";
import { useTemplates, useUploadAttachment } from "@/lib/queries/settings";
import { AttachmentsList } from "@/features/contracts/AttachmentsList";
import { IconChevronLeft, IconCheck, IconUpload } from "@/components/ui/Icons";
import { fmtNum } from "@/lib/format";
import type { AssetDetail, PropertyAttributes, SpaceAttributes } from "@/types/api";

type Form = { vat_taxable: boolean; utility_cost_winter: string; utility_cost_summer: string; template_id: string };
const ROLES: { role: string; label: "assets.sitePlan" | "assets.parkingPlan" | "assets.logo" | "assets.genericAttachment" }[] = [
  { role: "site_plan", label: "assets.sitePlan" }, { role: "parking_plan", label: "assets.parkingPlan" }, { role: "logo", label: "assets.logo" }, { role: "generic", label: "assets.genericAttachment" },
];

export function StepSettings({ property, onBack, onFinish }: { property: AssetDetail; onBack: () => void; onFinish: () => void }) {
  const a = property.attributes as PropertyAttributes;
  const update = useUpdateAsset();
  const upload = useUploadAttachment();
  const templates = useTemplates(property.company_id);
  const toast = useToast();
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<Form>({ defaultValues: { vat_taxable: a.vat_taxable ?? true, utility_cost_winter: a.utility_cost_winter != null ? String(a.utility_cost_winter) : "", utility_cost_summer: a.utility_cost_summer != null ? String(a.utility_cost_summer) : "", template_id: a.template_id ?? "" } });
  const spaces = property.children.filter((c) => c.type_code === "space" && c.status !== "jagatud");
  const area = spaces.reduce((s, x) => s + (Number((x.attributes as Partial<SpaceAttributes>).rentable_area_m2) || 0), 0);
  const withPlan = spaces.filter((s) => s.attachments.some((x) => x.role === "floor_plan")).length;
  const general = (templates.data ?? []).filter((x) => x.kind === "general_terms" && x.is_current);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ id: property.id, attributes: { ...a, vat_taxable: v.vat_taxable, utility_cost_winter: v.utility_cost_winter ? Number(v.utility_cost_winter.replace(",", ".")) : null, utility_cost_summer: v.utility_cost_summer ? Number(v.utility_cost_summer.replace(",", ".")) : null, template_id: v.template_id || null } as Record<string, unknown> });
      toast.success(t("assets.propertySaved"));
      onFinish();
    } catch (e) { toast.error(errorMessage(e)); }
  });
  const up = async (subjectId: string, role: string, f: File | undefined) => {
    if (!f) return;
    setBusyRole(`${subjectId}:${role}`);
    try { await upload.mutateAsync({ subject_type: "asset", subject_id: subjectId, role, file: f }); toast.success(t("assets.uploaded")); } catch (e) { toast.error(errorMessage(e)); } finally { setBusyRole(null); }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="card pad">
        <h2 className="text-lg mb-4">{t("assets.steps.settings")}</h2>
        <Checkbox label={t("assets.vatTaxable")} {...register("vat_taxable")} />
        <FormRow>
          <Input label={t("assets.utilityWinter")} type="number" step="0.01" inputMode="decimal" {...register("utility_cost_winter")} />
          <Input label={t("assets.utilitySummer")} type="number" step="0.01" inputMode="decimal" {...register("utility_cost_summer")} />
        </FormRow>
        <Select label={t("assets.template")} placeholder={t("assets.templateDefault")} hint={<span>{t("assets.templateHint")} <Link href="/app/seaded?tab=mallid" className="text-primary font-semibold">{t("settings.title")} →</Link></span>} {...register("template_id")}>
          {general.map((x) => <option key={x.id} value={x.id}>{x.name} · v{x.version}</option>)}
        </Select>
      </div>
      <div className="card pad">
        <h3 className="text-base mb-3">{t("assets.attachments")}</h3>
        <div className="grid gap-2 sm:grid-cols-2 mb-4">
          {ROLES.map(({ role, label }) => (
            <label key={role} className="btn btn-ghost justify-start cursor-pointer" aria-busy={busyRole === `${property.id}:${role}` || undefined}>
              <IconUpload width={14} height={14} />{t("assets.uploadFor", { role: t(label) })}
              <input type="file" className="sr-only" aria-label={t("assets.uploadFor", { role: t(label) })} accept={role === "logo" ? "image/png,image/jpeg,image/svg+xml" : ".pdf,application/pdf,image/*"} onChange={(e) => { up(property.id, role, e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          ))}
        </div>
        <AttachmentsList items={property.attachments} subjectType="asset" subjectId={property.id} allowUpload={false} />
      </div>
      <div className="card pad">
        <h3 className="text-base mb-2">{t("assets.summary")}</h3>
        <ul className="text-sm grid gap-1">
          <li>{t("assets.summarySpaces", { n: spaces.length, area: fmtNum(area) })}</li>
          <li>{t("assets.summaryPlans", { n: withPlan })}</li>
          <li>{property.parking_spots.length > 0 ? t("assets.summaryParking", { n: property.parking_spots.length }) : a.has_parking === false ? t("assets.summaryNoParking") : "—"}</li>
        </ul>
      </div>
      <div className="flex justify-between gap-2"><Button onClick={onBack}><IconChevronLeft width={16} height={16} />{t("common.back")}</Button><Button type="submit" variant="primary" busy={update.isPending}><IconCheck width={16} height={16} />{t("assets.finish")}</Button></div>
    </form>
  );
}
