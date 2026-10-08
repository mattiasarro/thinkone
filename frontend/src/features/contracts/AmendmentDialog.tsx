"use client";
import { useState } from "react";
import { t, tEnum } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useKeyDateKinds, useRegisterAmendment } from "@/lib/queries/portfolio";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import { isoDay, valueToString } from "@/lib/format";
import type { ContractFact } from "@/types/api";

const OTHER = "__other";
type Param = { key: string; customKey: string; value: string; text: string };
type KD = { kind: string; date: string; title: string };

/** Externally signed amendment of an imported contract: which facts changed, from when, and which dates moved.
 * Nothing is dropped silently: incomplete rows block the submit with a message. */
export function AmendmentDialog({ open, onClose, contractId, facts, endDate }: { open: boolean; onClose: () => void; contractId: string; facts: ContractFact[]; endDate: string | null }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [validFrom, setValidFrom] = useState(isoDay(new Date()));
  const [newEnd, setNewEnd] = useState("");
  const [params, setParams] = useState<Param[]>([]);
  const [dates, setDates] = useState<KD[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const kinds = useKeyDateKinds();
  const reg = useRegisterAmendment(contractId);
  const toast = useToast();
  const current = facts.filter((f) => !f.valid_to);
  const byKey = new Map(current.map((f) => [f.key, f]));
  const keyOf = (p: Param) => (p.key === OTHER ? p.customKey.trim() : p.key);

  const submit = async () => {
    if (!file) { setErr(t("common.required")); return; }
    const badParam = params.some((p) => !keyOf(p) || !p.value.trim());
    const badDate = dates.some((d) => !d.kind || !d.date);
    if (badParam || badDate) { setErr(t("contract.amendmentIncomplete")); return; }
    if (params.length === 0 && dates.length === 0 && !newEnd && !note.trim()) { setErr(t("contract.amendmentEmpty")); return; }
    setErr(null);
    try {
      await reg.mutateAsync({
        file, note, valid_from: validFrom || undefined, end_date: newEnd || undefined,
        parameters: params.map((p) => { const k = keyOf(p); const f = byKey.get(k); return { key: k, label: f?.label ?? k, unit: f?.unit ?? null, value: p.value.trim(), text: p.text.trim() || null }; }),
        key_dates: dates.map((d) => ({ kind: d.kind, date: d.date, title: d.title.trim() || null })),
      });
      toast.success(t("contract.amendmentDone"));
      setFile(null); setNote(""); setNewEnd(""); setParams([]); setDates([]);
      onClose();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("contract.amendmentTitle")} sub={t("contract.amendmentSub")} wide footer={
      <><span className="text-sm text-error mr-auto">{err}</span><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={submit} busy={reg.isPending}>{t("contract.registerAmendment")}</Button></>
    }>
      <Input label={t("contract.amendmentFile")} type="file" required accept=".pdf,.docx,.asice,.bdoc,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      <Textarea label={t("contract.amendmentNote")} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Input label={t("contract.amendmentValidFrom")} type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} hint={t("contract.amendmentValidFromHint")} />
        <Input label={t("contract.amendmentNewEnd")} type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} hint={endDate ? t("contract.amendmentNewEndHint", { date: endDate }) : undefined} />
      </div>

      <div className="flex items-center justify-between mb-2"><span className="field-label mb-0">{t("contract.amendmentParams")}</span><Button size="sm" onClick={() => setParams((p) => [...p, { key: current[0]?.key ?? OTHER, customKey: "", value: "", text: "" }])}><IconPlus width={14} height={14} />{t("imports.manual.addRow")}</Button></div>
      {params.length === 0 && <p className="text-xs text-muted mb-2">{t("contract.amendmentParamsHint")}</p>}
      {params.map((p, i) => {
        const f = byKey.get(p.key);
        const set = (patch: Partial<Param>) => setParams((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
        return (
          <div key={i} className="grid grid-cols-[1.2fr_1fr_1.5fr_auto] gap-2 mb-2 items-start">
            <div className="grid gap-1">
              <select className="fld fld-sm" aria-label={t("imports.key")} value={p.key} onChange={(e) => set({ key: e.target.value })}>
                {current.map((x) => <option key={x.key} value={x.key}>{x.label ?? x.key}</option>)}
                <option value={OTHER}>{t("contract.amendmentOtherKey")}</option>
              </select>
              {p.key === OTHER && <input className="fld fld-sm" placeholder={t("imports.key")} aria-label={t("imports.key")} value={p.customKey} onChange={(e) => set({ customKey: e.target.value })} />}
              {f && <span className="text-xs text-muted truncate">{t("contract.amendmentCurrent", { value: `${valueToString(f.value)}${f.unit ? ` ${f.unit}` : ""}` })}</span>}
            </div>
            <input className="fld fld-sm" placeholder={t("contract.amendmentNewValue")} aria-label={t("contract.amendmentNewValue")} value={p.value} onChange={(e) => set({ value: e.target.value })} />
            <input className="fld fld-sm" placeholder={t("contract.amendmentSentence")} aria-label={t("contract.amendmentSentence")} value={p.text} onChange={(e) => set({ text: e.target.value })} />
            <button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.remove")} onClick={() => setParams((xs) => xs.filter((_, j) => j !== i))}><IconTrash width={14} height={14} /></button>
          </div>
        );
      })}

      <div className="flex items-center justify-between mb-2 mt-4"><span className="field-label mb-0">{t("contract.amendmentKeyDates")}</span><Button size="sm" onClick={() => setDates((d) => [...d, { kind: "", date: "", title: "" }])}><IconPlus width={14} height={14} />{t("imports.manual.addRow")}</Button></div>
      {dates.length === 0 && <p className="text-xs text-muted mb-2">{t("contract.amendmentKeyDatesHint")}</p>}
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
