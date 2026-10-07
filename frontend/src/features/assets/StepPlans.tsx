"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Dropzone } from "@/components/ui/FileInput";
import { Table, Td } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useUploadPlans } from "@/lib/queries/portfolio";
import { openAttachment } from "@/lib/queries/settings";
import { fmtBytes } from "@/lib/format";
import { IconArrowRight, IconChevronLeft, IconFile } from "@/components/ui/Icons";
import type { AssetDetail, PlanRow } from "@/types/api";

/** Bulk floor-plan upload (demo v797–801): drop many files → filename matching → confirm file → space rows. */
export function PlansUploader({ property, onDone }: { property: AssetDetail; onDone?: () => void }) {
  const upload = useUploadPlans(property.id);
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<PlanRow[] | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const spaces = property.children.filter((c) => c.type_code === "space" && c.status !== "jagatud");

  // The server asks the model once for every file not in `mapping`; after the first proposal the mapping covers
  // every row, so corrections and the final confirm never re-run the matching behind the operator's back.
  const fullMapping = (rs: PlanRow[], m: Record<string, string>) =>
    Object.fromEntries(rs.map((r) => [r.filename, m[r.filename] ?? (r.target === "space" ? r.space_id ?? "property" : r.target)]));
  const propose = async (fs: File[], m: Record<string, string>) => {
    try {
      const rs = await upload.mutateAsync({ files: fs, mapping: m, dryRun: true });
      setRows(rs);
      setMapping(fullMapping(rs, m));
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const onFiles = async (fs: File[]) => { const all = [...files, ...fs]; setFiles(all); await propose(all, mapping); };
  const change = async (filename: string, target: string) => { const m = { ...mapping, [filename]: target }; setMapping(m); await propose(files, m); };
  const commit = async () => {
    try {
      const res = await upload.mutateAsync({ files, mapping, dryRun: false });
      toast.success(t("assets.plans.done", { n: res.filter((r) => r.target !== "skip").length }));
      setFiles([]); setRows(null); setMapping({});
      onDone?.();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const bound = rows?.filter((r) => r.target !== "skip").length ?? 0;
  return (
    <div className="grid gap-4">
      <Dropzone onFiles={onFiles} multiple accept=".pdf,.png,.jpg,.jpeg,.svg,.zip,application/pdf,image/png,image/jpeg,image/svg+xml,application/zip" label={upload.isPending && !rows ? t("assets.plans.matching") : t("assets.plans.drop")} hint={t("assets.plans.dropHint")} busy={upload.isPending && !rows} />
      {rows && rows.length > 0 && (
        <div className="grid gap-3">
          <div className="card overflow-hidden">
            <Table stack={false}>
              <thead><tr><th>{t("assets.plans.file")}</th><th>{t("assets.plans.target")}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.filename} className={r.target === "skip" ? "opacity-60" : ""}>
                    <Td><span className="inline-flex items-center gap-2"><IconFile width={16} height={16} className="text-muted flex-none" /><span className="font-medium text-sm">{r.filename}</span><span className="text-xs text-muted">{fmtBytes(r.size)}</span></span></Td>
                    <Td>
                      <select className="fld fld-sm max-w-[260px]" aria-label={t("assets.plans.target")} value={r.target === "space" ? r.space_id ?? "" : r.target} onChange={(e) => change(r.filename, e.target.value)}>
                        <option value="property">{t("assets.plans.property")}</option>
                        {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        <option value="skip">{t("assets.plans.skip")}</option>
                      </select>
                    </Td>
                    <Td><span className="text-xs text-muted">{r.note}</span></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="primary" onClick={commit} busy={upload.isPending} disabled={bound === 0}>{t("assets.plans.confirm", { n: bound })}</Button>
            <Button variant="text" onClick={() => { setFiles([]); setRows(null); setMapping({}); }}>{t("common.cancel")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function StepPlans({ property, onBack, onNext }: { property: AssetDetail; onBack: () => void; onNext: () => void }) {
  const toast = useToast();
  const spaces = property.children.filter((c) => c.type_code === "space" && c.status !== "jagatud");
  const withPlan = spaces.filter((s) => s.attachments.some((a) => a.role === "floor_plan"));
  // Building-level plans: files the plans step could not match to a space (site plan) and the parking plan.
  const buildingPlans = property.attachments.filter((a) => a.role === "site_plan" || a.role === "parking_plan");
  const open = (id: string) => openAttachment(id).catch((e) => toast.error(errorMessage(e)));
  return (
    <div className="grid gap-4">
      <div className="card pad grid gap-4">
        <div><h2 className="text-lg mb-1">{t("assets.plans.title")}</h2><p className="text-muted text-sm">{t("assets.plans.sub")}</p></div>
        <PlansUploader property={property} />
      </div>
      {(spaces.length > 0 || buildingPlans.length > 0) && (
        <div className="card">
          <div className="card-h"><h3>{t("assets.plans.current")}</h3><span className="flex gap-1"><Pill tone="success">{withPlan.length} {t("assets.plans.withPlan")}</Pill>{spaces.length - withPlan.length > 0 && <Pill>{spaces.length - withPlan.length} {t("assets.plans.noPlan")}</Pill>}</span></div>
          <ul className="divide-y px-[var(--card-padding)]" style={{ borderColor: "var(--line)" }}>
            {buildingPlans.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <span className="font-medium flex-1 min-w-0 truncate">{t("assets.plans.property")} <span className="text-muted font-normal">· {t(a.role === "parking_plan" ? "assets.parkingPlan" : "assets.sitePlan")}</span></span>
                <button type="button" className="text-primary font-semibold text-xs inline-flex items-center gap-1" onClick={() => open(a.id)}><IconFile width={14} height={14} />{a.filename}</button>
              </li>
            ))}
            {spaces.map((s) => {
              const plan = s.attachments.find((a) => a.role === "floor_plan");
              return (
                <li key={s.id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="font-medium flex-1 min-w-0 truncate">{s.name}</span>
                  {plan ? <button type="button" className="text-primary font-semibold text-xs inline-flex items-center gap-1" onClick={() => open(plan.id)}><IconFile width={14} height={14} />{plan.filename}</button> : <span className="text-xs text-muted">{t("assets.plans.noPlan")}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="flex justify-between gap-2"><Button onClick={onBack}><IconChevronLeft width={16} height={16} />{t("common.back")}</Button><Button variant="primary" onClick={onNext}>{t("common.next")}<IconArrowRight width={16} height={16} /></Button></div>
    </div>
  );
}
