"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t, tEnum } from "@/i18n";
import { useManualImport } from "@/lib/queries/imports";
import { useCompanies } from "@/lib/queries/settings";
import { useAssets, useKeyDateKinds } from "@/lib/queries/portfolio";
import { PageHead } from "@/components/ui/Card";
import { Input, Select, FormRow } from "@/components/ui/Field";
import { Button, LinkButton } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconPlus, IconTrash, IconCheck } from "@/components/ui/Icons";

const CATEGORIES = ["lease", "maintenance", "management", "insurance", "security", "other"];
const schema = z.object({
  title: z.string().min(1, t("common.required")), category: z.string().min(1, t("common.required")), counterparty_name: z.string().min(1, t("common.required")),
  registry_code: z.string().optional(), signed_at: z.string().optional(), start_date: z.string().optional(), end_date: z.string().optional(), company_id: z.string().optional(), asset_id: z.string().optional(),
});
type Form = z.infer<typeof schema>;
type KD = { kind: string; date: string; title: string };
type Param = { key: string; value: string; text: string };

export function ManualImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [dates, setDates] = useState<KD[]>([]);
  const [params, setParams] = useState<Param[]>([]);
  const companies = useCompanies();
  const properties = useAssets({ type_code: "property" });
  const kinds = useKeyDateKinds();
  const manual = useManualImport();
  const toast = useToast();
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { category: "other" } });

  const onSubmit = handleSubmit(async (v) => {
    if (!file) { setFileErr(t("common.required")); return; }
    setFileErr(null);
    try {
      const r = await manual.mutateAsync({ file, ...v, key_dates: dates.filter((d) => d.kind && d.date), parameters: params.filter((p) => p.key) });
      toast.success(t("imports.manual.done"));
      router.push(`/app/portfell/leping/${r.contract_id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 max-w-[860px]">
      <LinkButton href="/app/portfell/import" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("imports.title")}</LinkButton>
      <PageHead title={t("imports.manual.title")} sub={t("imports.manual.sub")} />
      <div className="card pad">
        <Input label={t("imports.manual.file")} type="file" required accept=".pdf,.docx,.asice,.bdoc,image/*,application/pdf" error={fileErr ?? undefined} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Input label={t("imports.manual.titleField")} required error={errors.title?.message} {...register("title")} />
        <FormRow>
          <Select label={t("common.category")} required {...register("category")} options={CATEGORIES.map((c) => ({ value: c, label: tEnum("contract.category", c) }))} />
          <Input label={t("imports.manual.counterparty")} required error={errors.counterparty_name?.message} {...register("counterparty_name")} />
        </FormRow>
        <FormRow>
          <Input label={t("imports.manual.registryCode")} {...register("registry_code")} />
          <Input label={t("imports.manual.signedAt")} type="date" {...register("signed_at")} />
        </FormRow>
        <FormRow>
          <Input label={t("imports.manual.startDate")} type="date" {...register("start_date")} />
          <Input label={t("imports.manual.endDate")} type="date" {...register("end_date")} />
        </FormRow>
        <FormRow>
          <Select label={t("imports.company")} placeholder={t("common.selectPlaceholder")} {...register("company_id")}>{(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
          <Select label={t("imports.asset")} placeholder={t("common.selectPlaceholder")} {...register("asset_id")}>{(properties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </FormRow>
      </div>

      <div className="card pad">
        <div className="flex items-center justify-between mb-3"><h3 className="text-base">{t("imports.manual.keyDates")}</h3><Button size="sm" onClick={() => setDates((d) => [...d, { kind: "", date: "", title: "" }])}><IconPlus width={14} height={14} />{t("imports.manual.addRow")}</Button></div>
        {dates.length === 0 && <p className="text-sm text-muted">{t("common.none")}</p>}
        {dates.map((d, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto] mb-2">
            <select className="fld" aria-label={t("keyDates.kind")} value={d.kind} onChange={(e) => setDates((xs) => xs.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}>
              <option value="">{t("common.selectPlaceholder")}</option>{(kinds.data ?? []).map((k) => <option key={k.code} value={k.code}>{k.name_et || tEnum("keyDates.kinds", k.code)}</option>)}
            </select>
            <input className="fld" type="date" aria-label={t("keyDates.dueDate")} value={d.date} onChange={(e) => setDates((xs) => xs.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
            <input className="fld" placeholder={t("keyDates.title_")} aria-label={t("keyDates.title_")} value={d.title} onChange={(e) => setDates((xs) => xs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
            <button type="button" className="icon-btn text-error" aria-label={t("common.remove")} onClick={() => setDates((xs) => xs.filter((_, j) => j !== i))}><IconTrash width={14} height={14} /></button>
          </div>
        ))}
      </div>

      <div className="card pad">
        <div className="flex items-center justify-between mb-3"><h3 className="text-base">{t("imports.manual.parameters")}</h3><Button size="sm" onClick={() => setParams((p) => [...p, { key: "", value: "", text: "" }])}><IconPlus width={14} height={14} />{t("imports.manual.addRow")}</Button></div>
        {params.length === 0 && <p className="text-sm text-muted">{t("common.none")}</p>}
        {params.map((p, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto] mb-2">
            <input className="fld" placeholder={t("imports.key")} aria-label={t("imports.key")} value={p.key} onChange={(e) => setParams((xs) => xs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
            <input className="fld" placeholder={t("imports.value")} aria-label={t("imports.value")} value={p.value} onChange={(e) => setParams((xs) => xs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <input className="fld" placeholder={t("imports.text")} aria-label={t("imports.text")} value={p.text} onChange={(e) => setParams((xs) => xs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
            <button type="button" className="icon-btn text-error" aria-label={t("common.remove")} onClick={() => setParams((xs) => xs.filter((_, j) => j !== i))}><IconTrash width={14} height={14} /></button>
          </div>
        ))}
      </div>
      <div className="flex justify-end"><Button type="submit" variant="primary" size="lg" busy={manual.isPending}><IconCheck width={16} height={16} />{t("imports.manual.submit")}</Button></div>
    </form>
  );
}
