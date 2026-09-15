"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useRegisterAmendment } from "@/lib/queries/portfolio";
import { useKeyDateKinds } from "@/lib/queries/portfolio";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import { tEnum } from "@/i18n";

type Param = { key: string; value: string; text: string };
type KD = { kind: string; date: string; title: string };

export function AmendmentDialog({ open, onClose, contractId }: { open: boolean; onClose: () => void; contractId: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [params, setParams] = useState<Param[]>([]);
  const [dates, setDates] = useState<KD[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const kinds = useKeyDateKinds();
  const reg = useRegisterAmendment(contractId);
  const toast = useToast();

  const submit = async () => {
    if (!file) { setErr(t("common.required")); return; }
    setErr(null);
    try {
      await reg.mutateAsync({ file, note, parameters: params.filter((p) => p.key), key_dates: dates.filter((d) => d.kind && d.date) });
      toast.success(t("contract.amendmentDone"));
      setFile(null); setNote(""); setParams([]); setDates([]);
      onClose();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("contract.amendmentTitle")} sub={t("contract.amendmentSub")} wide footer={
      <><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={submit} busy={reg.isPending}>{t("contract.registerAmendment")}</Button></>
    }>
      <Input label={t("contract.amendmentFile")} type="file" required accept=".pdf,.docx,.asice,.bdoc,application/pdf" error={err ?? undefined} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Textarea label={t("contract.amendmentNote")} value={note} onChange={(e) => setNote(e.target.value)} rows={3} />

      <div className="flex items-center justify-between mb-2"><span className="field-label mb-0">{t("contract.amendmentParams")}</span><Button size="sm" onClick={() => setParams((p) => [...p, { key: "", value: "", text: "" }])}><IconPlus width={14} height={14} />{t("imports.manual.addRow")}</Button></div>
      {params.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2 mb-2 items-start">
          <input className="fld fld-sm" placeholder={t("imports.key")} aria-label={t("imports.key")} value={p.key} onChange={(e) => setParams((xs) => xs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} />
          <input className="fld fld-sm" placeholder={t("imports.value")} aria-label={t("imports.value")} value={p.value} onChange={(e) => setParams((xs) => xs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
          <input className="fld fld-sm" placeholder={t("imports.text")} aria-label={t("imports.text")} value={p.text} onChange={(e) => setParams((xs) => xs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.remove")} onClick={() => setParams((xs) => xs.filter((_, j) => j !== i))}><IconTrash width={14} height={14} /></button>
        </div>
      ))}

      <div className="flex items-center justify-between mb-2 mt-4"><span className="field-label mb-0">{t("contract.amendmentKeyDates")}</span><Button size="sm" onClick={() => setDates((d) => [...d, { kind: "", date: "", title: "" }])}><IconPlus width={14} height={14} />{t("imports.manual.addRow")}</Button></div>
      {dates.map((d, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1.5fr_auto] gap-2 mb-2 items-start">
          <Select className="!mb-0" aria-label={t("keyDates.kind")} value={d.kind} placeholder={t("common.selectPlaceholder")} onChange={(e) => setDates((xs) => xs.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)))}>
            {(kinds.data ?? []).map((k) => <option key={k.code} value={k.code}>{k.name_et || tEnum("keyDates.kinds", k.code)}</option>)}
          </Select>
          <input className="fld" type="date" aria-label={t("keyDates.dueDate")} value={d.date} onChange={(e) => setDates((xs) => xs.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} />
          <input className="fld" placeholder={t("keyDates.title_")} aria-label={t("keyDates.title_")} value={d.title} onChange={(e) => setDates((xs) => xs.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
          <button type="button" className="icon-btn text-error" aria-label={t("common.remove")} onClick={() => setDates((xs) => xs.filter((_, j) => j !== i))}><IconTrash width={14} height={14} /></button>
        </div>
      ))}
    </Modal>
  );
}
