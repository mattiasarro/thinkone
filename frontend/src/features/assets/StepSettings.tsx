"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { t } from "@/i18n";
import { Input, Checkbox, FormRow } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useUpdateAsset } from "@/lib/queries/portfolio";
import { useUploadAttachment } from "@/lib/queries/settings";
import { AttachmentsList } from "@/features/contracts/AttachmentsList";
import { IconChevronLeft, IconCheck, IconUpload } from "@/components/ui/Icons";
import type { AssetDetail, PropertyAttributes } from "@/types/api";

type Form = { vat_taxable: boolean; utility_cost_winter: string; utility_cost_summer: string };
const ROLES: { role: string; label: "assets.sitePlan" | "assets.parkingPlan" | "assets.logo" | "assets.genericAttachment" }[] = [
  { role: "site_plan", label: "assets.sitePlan" }, { role: "parking_plan", label: "assets.parkingPlan" }, { role: "logo", label: "assets.logo" }, { role: "generic", label: "assets.genericAttachment" },
];

export function StepSettings({ property, onBack, onFinish }: { property: AssetDetail; onBack: () => void; onFinish: () => void }) {
  const a = property.attributes as PropertyAttributes;
  const update = useUpdateAsset();
  const upload = useUploadAttachment();
  const toast = useToast();
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const { register, handleSubmit } = useForm<Form>({ defaultValues: { vat_taxable: a.vat_taxable ?? true, utility_cost_winter: a.utility_cost_winter != null ? String(a.utility_cost_winter) : "", utility_cost_summer: a.utility_cost_summer != null ? String(a.utility_cost_summer) : "" } });
  const spaces = property.children.filter((c) => c.type_code === "space");

  const onSubmit = handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ id: property.id, attributes: { ...a, vat_taxable: v.vat_taxable, utility_cost_winter: v.utility_cost_winter ? Number(v.utility_cost_winter) : null, utility_cost_summer: v.utility_cost_summer ? Number(v.utility_cost_summer) : null } as Record<string, unknown> });
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
      {spaces.length > 0 && (
        <div className="card pad">
          <h3 className="text-base mb-3">{t("assets.floorPlan")}</h3>
          <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
            {spaces.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2 flex-wrap">
                <span className="font-medium text-sm flex-1 min-w-[160px]">{s.name}</span>
                <label className="btn btn-ghost btn-sm cursor-pointer" aria-busy={busyRole === `${s.id}:floor_plan` || undefined}>
                  <IconUpload width={14} height={14} />{t("assets.floorPlan")}
                  <input type="file" className="sr-only" aria-label={`${t("assets.floorPlan")} — ${s.name}`} accept=".pdf,application/pdf,image/*" onChange={(e) => { up(s.id, "floor_plan", e.target.files?.[0]); e.target.value = ""; }} />
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-between gap-2"><Button onClick={onBack}><IconChevronLeft width={16} height={16} />{t("common.back")}</Button><Button type="submit" variant="primary" busy={update.isPending}><IconCheck width={16} height={16} />{t("assets.finish")}</Button></div>
    </form>
  );
}
