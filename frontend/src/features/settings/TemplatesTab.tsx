"use client";
import { useState } from "react";
import { t, tEnum } from "@/i18n";
import { useCompanies, useCreateTemplate, useTemplate, useTemplates, useUploadGeneralTerms } from "@/lib/queries/settings";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { ClauseTree } from "@/features/contracts/ClauseTree";
import { IconPlus, IconUpload } from "@/components/ui/Icons";
import type { Template, TemplateKind } from "@/types/api";

const KINDS: TemplateKind[] = ["general_terms", "special_terms_base", "quote_base"];

export function TemplatesTab() {
  const [companyId, setCompanyId] = useState("");
  const companies = useCompanies();
  const list = useTemplates(companyId || null);
  const [upload, setUpload] = useState(false);
  const [create, setCreate] = useState<TemplateKind | null>(null);
  const [view, setView] = useState<Template | null>(null);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <select className="fld w-auto" value={companyId} onChange={(e) => setCompanyId(e.target.value)} aria-label={t("settings.templates.company")}>
          <option value="">{t("settings.templates.allCompanies")}</option>{(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="sm:ml-auto flex gap-2 flex-wrap">
          <Button onClick={() => setUpload(true)}><IconUpload width={16} height={16} />{t("settings.templates.upload")}</Button>
          <Button variant="primary" onClick={() => setCreate("special_terms_base")}><IconPlus width={16} height={16} />{t("settings.templates.create")}</Button>
        </div>
      </div>
      {list.isLoading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (
        KINDS.map((kind) => {
          const items = (list.data ?? []).filter((x) => x.kind === kind);
          return (
            <Card key={kind}>
              <CardHeader title={tEnum("settings.templates.kinds", kind)} actions={<span className="text-muted text-sm">{items.length}</span>} />
              {items.length === 0 ? <EmptyState title={t("settings.templates.empty")} /> : (
                <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
                  {items.map((tp) => (
                    <li key={tp.id} className="flex items-center gap-3 px-[var(--card-padding)] py-3 flex-wrap">
                      <span className="min-w-0 flex-1"><span className="block font-semibold text-sm truncate">{tp.name}</span><span className="block text-xs text-muted">{t("settings.templates.version")} {tp.version} · {t("settings.templates.nodes", { n: tp.node_count })} · {fmtDate(tp.created_at)}</span></span>
                      {tp.is_current && <Pill tone="success">{t("settings.templates.current")}</Pill>}
                      <Button size="sm" onClick={() => setView(tp)}>{t("settings.templates.view")}</Button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })
      )}
      <UploadModal open={upload} onClose={() => setUpload(false)} />
      <CreateModal open={!!create} kind={create ?? "special_terms_base"} onClose={() => setCreate(null)} />
      <ViewModal tp={view} onClose={() => setView(null)} />
    </div>
  );
}

function UploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const companies = useCompanies();
  const up = useUploadGeneralTerms();
  const toast = useToast();
  const submit = async () => {
    if (!file || !name) { setErr(t("common.required")); return; }
    try { await up.mutateAsync({ file, name, company_id: companyId || null }); toast.success(t("settings.templates.saved")); setFile(null); setName(""); onClose(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("settings.templates.upload")} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={submit} busy={up.isPending}>{t("common.upload")}</Button></>}>
      <Input label={t("settings.templates.file")} type="file" required accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" error={!file ? err ?? undefined : undefined} onChange={(e) => { setFile(e.target.files?.[0] ?? null); if (!name && e.target.files?.[0]) setName(e.target.files[0].name.replace(/\.docx$/i, "")); }} />
      <Input label={t("settings.templates.name")} required value={name} error={!name ? err ?? undefined : undefined} onChange={(e) => setName(e.target.value)} />
      <Select label={t("settings.templates.company")} placeholder={t("settings.templates.allCompanies")} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
    </Modal>
  );
}

function CreateModal({ open, kind: initialKind, onClose }: { open: boolean; kind: TemplateKind; onClose: () => void }) {
  const [kind, setKind] = useState<TemplateKind>(initialKind);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const companies = useCompanies();
  const create = useCreateTemplate();
  const toast = useToast();
  const submit = async () => {
    if (!name) { setErr(t("common.required")); return; }
    try { await create.mutateAsync({ kind, name, company_id: companyId || null, body: { text } }); toast.success(t("settings.templates.saved")); setName(""); setText(""); onClose(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("settings.templates.create")} wide footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={submit} busy={create.isPending}>{t("common.save")}</Button></>}>
      <Select label={t("settings.templates.kind")} value={kind} onChange={(e) => setKind(e.target.value as TemplateKind)} options={[{ value: "special_terms_base", label: tEnum("settings.templates.kinds", "special_terms_base") }, { value: "quote_base", label: tEnum("settings.templates.kinds", "quote_base") }]} />
      <Input label={t("settings.templates.name")} required value={name} error={err ?? undefined} onChange={(e) => setName(e.target.value)} />
      <Select label={t("settings.templates.company")} placeholder={t("settings.templates.allCompanies")} value={companyId} onChange={(e) => setCompanyId(e.target.value)}>{(companies.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
      <Textarea label={t("settings.templates.body")} rows={12} value={text} onChange={(e) => setText(e.target.value)} />
    </Modal>
  );
}

function ViewModal({ tp, onClose }: { tp: Template | null; onClose: () => void }) {
  const q = useTemplate(tp?.id);
  return (
    <Modal open={!!tp} onClose={onClose} title={tp?.name ?? ""} sub={tp ? `${tEnum("settings.templates.kinds", tp.kind)} · ${t("settings.templates.version")} ${tp.version}` : undefined} wide>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : q.data?.clauses ? <ClauseTree clauses={q.data.clauses} /> : <pre className="whitespace-pre-wrap font-ui text-sm">{q.data?.body?.text ?? "—"}</pre>}
    </Modal>
  );
}
