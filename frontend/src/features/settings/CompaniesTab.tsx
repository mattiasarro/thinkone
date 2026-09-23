"use client";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { t } from "@/i18n";
import { fetchAriregisterDetail, useAriregister, useCompanies, useDeleteCompany, useSaveCompany, useUploadLogo, openAttachment } from "@/lib/queries/settings";
import { useDebounced } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal, ConfirmDialog } from "@/components/ui/Modal";
import { Input, FormRow } from "@/components/ui/Field";
import { EmptyState, ErrorState, Loading, Spinner } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconBuilding, IconEdit, IconPlus, IconSearch, IconTrash, IconUpload } from "@/components/ui/Icons";
import type { AriregisterHit, Company } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, t("common.required")), registry_code: z.string().optional(), vat_number: z.string().optional(), address: z.string().optional(),
  email: z.string().email(t("common.validationError")).optional().or(z.literal("")), phone: z.string().optional(), accent_color: z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function CompaniesTab() {
  const list = useCompanies();
  const [modal, setModal] = useState<{ open: boolean; company?: Company | null }>({ open: false });
  const [del, setDel] = useState<Company | null>(null);
  const remove = useDeleteCompany();
  const upload = useUploadLogo();
  const toast = useToast();
  const onDelete = async () => { if (!del) return; try { await remove.mutateAsync(del.id); toast.success(t("settings.companies.deleted")); setDel(null); } catch (e) { toast.error(errorMessage(e)); } };
  const onLogo = async (c: Company, f: File | undefined) => { if (!f) return; try { await upload.mutateAsync({ id: c.id, file: f }); toast.success(t("settings.companies.logoUploaded")); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><Button variant="primary" onClick={() => setModal({ open: true, company: null })}><IconPlus width={16} height={16} />{t("settings.companies.add")}</Button></div>
      {list.isLoading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (list.data ?? []).length === 0 ? (
        <Card><EmptyState icon={<IconBuilding width={40} height={40} />} title={t("settings.companies.empty")} sub={t("settings.companies.emptySub")} action={<Button variant="primary" onClick={() => setModal({ open: true, company: null })}>{t("settings.companies.add")}</Button>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(list.data ?? []).map((c) => (
            <Card key={c.id} pad className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <button type="button" className="w-12 h-12 rounded-control grid place-items-center flex-none font-heading font-bold text-lg text-white overflow-hidden" style={{ background: c.accent_color || "var(--color-primary)" }} onClick={() => c.logo_attachment_id && openAttachment(c.logo_attachment_id)} aria-label={t("settings.companies.logo")} disabled={!c.logo_attachment_id}>
                  {c.name[0]?.toUpperCase()}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-heading font-semibold text-base truncate">{c.name}</div>
                  <div className="text-xs text-muted">{[c.registry_code && `${t("settings.companies.registryCode")} ${c.registry_code}`, c.vat_number && `${t("settings.companies.vatNumber")} ${c.vat_number}`].filter(Boolean).join(" · ") || "—"}</div>
                  {c.address && <div className="text-xs text-muted truncate">{c.address}</div>}
                </div>
              </div>
              <div className="flex gap-1 flex-wrap mt-auto">
                <Button size="sm" onClick={() => setModal({ open: true, company: c })}><IconEdit width={14} height={14} />{t("common.edit")}</Button>
                <label className="btn btn-ghost btn-sm cursor-pointer"><IconUpload width={14} height={14} />{t("settings.companies.uploadLogo")}<input type="file" accept="image/png,image/jpeg,image/svg+xml" className="sr-only" aria-label={`${t("settings.companies.uploadLogo")} — ${c.name}`} onChange={(e) => { onLogo(c, e.target.files?.[0]); e.target.value = ""; }} /></label>
                <Button size="sm" variant="text" className="btn-destructive ml-auto" onClick={() => setDel(c)} aria-label={t("common.delete")}><IconTrash width={14} height={14} /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <CompanyModal open={modal.open} onClose={() => setModal({ open: false })} initial={modal.company} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={onDelete} busy={remove.isPending} title={t("common.delete")} body={del ? t("settings.companies.deleteConfirm", { name: del.name }) : null} />
    </div>
  );
}

function CompanyModal({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: Company | null }) {
  const save = useSaveCompany();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);
  const reg = useAriregister(dq);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { name: "", accent_color: "#1F5EFF" } });
  useEffect(() => {
    if (!open) return;
    setQ("");
    reset({ name: initial?.name ?? "", registry_code: initial?.registry_code ?? "", vat_number: initial?.vat_number ?? "", address: initial?.address ?? "", email: initial?.email ?? "", phone: initial?.phone ?? "", accent_color: initial?.accent_color ?? "#1F5EFF" });
  }, [open, initial, reset]);
  const [enriching, setEnriching] = useState(false);
  const pick = async (h: AriregisterHit) => {
    setValue("name", h.name); setValue("registry_code", h.registry_code); setValue("address", h.address ?? ""); setValue("vat_number", h.vat_number ?? ""); setQ("");
    setEnriching(true);
    const d = await fetchAriregisterDetail(h.registry_code); // VAT number + contacts live on the company card, not in search results
    setEnriching(false);
    if (!d) return;
    if (d.vat_number) setValue("vat_number", d.vat_number);
    if (d.address) setValue("address", d.address);
    if (d.email) setValue("email", d.email);
    if (d.phone) setValue("phone", d.phone);
  };
  const onSubmit = handleSubmit(async (v) => {
    try {
      await save.mutateAsync({ id: initial?.id, name: v.name, registry_code: v.registry_code || null, vat_number: v.vat_number || null, address: v.address || null, email: v.email || null, phone: v.phone || null, accent_color: v.accent_color || null });
      toast.success(t("settings.companies.saved")); onClose();
    } catch (e) { toast.error(errorMessage(e)); }
  });
  return (
    <Modal open={open} onClose={onClose} title={initial ? t("settings.companies.edit") : t("settings.companies.add")} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" type="submit" form="company-form" busy={save.isPending}>{t("common.save")}</Button></>}>
      <form id="company-form" onSubmit={onSubmit} noValidate>
        {!initial && (
          <div className="field">
            <label htmlFor="ar-q">{t("settings.companies.searchRegistry")}</label>
            <div className="flex items-center gap-2 fld"><IconSearch width={16} height={16} className="text-muted flex-none" /><input id="ar-q" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 min-w-0 bg-transparent outline-none" placeholder={t("settings.companies.registryHint")} />{(reg.isFetching || enriching) && <Spinner />}</div>
            {dq.length >= 2 && !reg.isLoading && (
              <div className="mt-2 grid gap-1">
                {(reg.data ?? []).length === 0 ? <p className="text-sm text-muted">{t("common.noResults")}</p> : (reg.data ?? []).slice(0, 6).map((h) => (
                  <button key={h.registry_code} type="button" className="drop-item border" style={{ borderColor: "var(--line)" }} onClick={() => pick(h)}>
                    <span className="min-w-0"><span className="block font-semibold text-sm truncate">{h.name}</span><span className="block text-xs text-muted">{h.registry_code}{h.legal_form ? ` · ${h.legal_form}` : ""}{h.address ? ` · ${h.address}` : ""}{h.status ? ` · ${h.status}` : ""}</span></span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Input label={t("settings.companies.name")} required error={errors.name?.message} {...register("name")} />
        <FormRow><Input label={t("settings.companies.registryCode")} {...register("registry_code")} /><Input label={t("settings.companies.vatNumber")} {...register("vat_number")} /></FormRow>
        <Input label={t("settings.companies.address")} {...register("address")} />
        <FormRow><Input label={t("settings.companies.email")} type="email" error={errors.email?.message} {...register("email")} /><Input label={t("settings.companies.phone")} {...register("phone")} /></FormRow>
        <div className="field">
          <label htmlFor="accent">{t("settings.companies.accentColor")}</label>
          <div className="flex items-center gap-2"><input id="accent" type="color" className="w-10 h-10 rounded-control border p-0.5 cursor-pointer" style={{ borderColor: "var(--color-border-control)" }} {...register("accent_color")} /><input className="fld w-32 font-mono" aria-label={t("settings.companies.accentColor")} {...register("accent_color")} /></div>
        </div>
      </form>
    </Modal>
  );
}
