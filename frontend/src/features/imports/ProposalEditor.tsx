"use client";
import { t, tEnum } from "@/i18n";
import { Input, Select, Textarea, FormRow } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import { fmtPct, cx } from "@/lib/format";
import { useKeyDateKinds } from "@/lib/queries/portfolio";
import { UNCERTAIN } from "./reviewState";
import type { Proposal, ProposalKeyDate, ProposalParameter, ProposalParty } from "@/types/api";

const CATEGORIES = ["lease", "maintenance", "management", "insurance", "security", "other"];

interface Props { draft: Proposal; onChange: (p: Proposal) => void; checked: Set<string>; onCheck: (key: string, v: boolean) => void; onAnchor: (page: number | null | undefined) => void }

export function ProposalEditor({ draft, onChange, checked, onCheck, onAnchor }: Props) {
  const kinds = useKeyDateKinds();
  const setContract = <K extends keyof Proposal["contract"]>(k: K, v: Proposal["contract"][K]) => onChange({ ...draft, contract: { ...draft.contract, [k]: v } });
  const setParam = (i: number, patch: Partial<ProposalParameter>) => { onChange({ ...draft, parameters: draft.parameters.map((p, j) => (j === i ? { ...p, ...patch } : p)) }); onCheck(`parameter:${i}`, true); };
  const setKd = (i: number, patch: Partial<ProposalKeyDate>) => { onChange({ ...draft, key_dates: draft.key_dates.map((p, j) => (j === i ? { ...p, ...patch } : p)) }); onCheck(`key_date:${i}`, true); };
  const setParty = (i: number, patch: Partial<ProposalParty>) => { onChange({ ...draft, parties: draft.parties.map((p, j) => (j === i ? { ...p, ...patch } : p)) }); onCheck(`party:${i}`, true); };
  const c = draft.contract;

  return (
    <div className="grid gap-5">
      <section className="card pad">
        <h3 className="text-base mb-3">{t("imports.contractFields")}</h3>
        <Input label={t("portfolio.contracts.title")} value={c.title} onChange={(e) => setContract("title", e.target.value)} />
        <FormRow>
          <Select label={t("common.category")} value={c.category} onChange={(e) => setContract("category", e.target.value)} options={CATEGORIES.map((k) => ({ value: k, label: tEnum("contract.category", k) }))} />
          <Input label={t("contract.number")} value={c.number ?? ""} onChange={(e) => setContract("number", e.target.value || null)} />
        </FormRow>
        <FormRow cols={3}>
          <Input label={t("contract.signedAt")} type="date" value={c.signed_at?.slice(0, 10) ?? ""} onChange={(e) => setContract("signed_at", e.target.value || null)} />
          <Input label={t("contract.startDate")} type="date" value={c.start_date?.slice(0, 10) ?? ""} onChange={(e) => setContract("start_date", e.target.value || null)} />
          <Input label={t("contract.endDate")} type="date" value={c.end_date?.slice(0, 10) ?? ""} onChange={(e) => setContract("end_date", e.target.value || null)} />
        </FormRow>
        <FormRow>
          <Input label={t("imports.counterparty")} value={c.counterparty_name} onChange={(e) => setContract("counterparty_name", e.target.value)} />
          <Input label={t("imports.ourCompany")} value={c.our_company_name ?? ""} onChange={(e) => setContract("our_company_name", e.target.value || null)} />
        </FormRow>
        <Textarea label={t("imports.summary")} rows={3} value={c.summary} onChange={(e) => setContract("summary", e.target.value)} />
      </section>

      <section className="card">
        <div className="card-h"><h3>{t("imports.parties")}</h3></div>
        <div className="card-b grid gap-3">
          {draft.parties.map((p, i) => {
            const unc = p.confidence < UNCERTAIN;
            const key = `party:${i}`;
            return (
              <div key={i} className={cx("rounded-control p-3 grid gap-2", unc && !checked.has(key) ? "bg-warning-subtle" : "bg-canvas")}>
                <div className="grid gap-2 sm:grid-cols-[1.5fr_1fr_1fr]">
                  <input className="fld fld-sm" aria-label={t("common.name")} value={p.name} onChange={(e) => setParty(i, { name: e.target.value })} />
                  <input className="fld fld-sm" aria-label={t("imports.role")} value={p.role} onChange={(e) => setParty(i, { role: e.target.value })} placeholder={t("imports.role")} />
                  <input className="fld fld-sm" aria-label={t("portfolio.parties.registryCode")} value={p.registry_code ?? ""} onChange={(e) => setParty(i, { registry_code: e.target.value || null })} placeholder={t("portfolio.parties.registryCode")} />
                </div>
                <ConfRow confidence={p.confidence} checkKey={key} checked={checked} onCheck={onCheck} />
              </div>
            );
          })}
          {draft.parties.length === 0 && <p className="text-sm text-muted">{t("common.none")}</p>}
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h3>{t("imports.parameters")}</h3><Button size="sm" onClick={() => onChange({ ...draft, parameters: [...draft.parameters, { key: "", label: "", value: "", text: "", confidence: 1 }] })}><IconPlus width={14} height={14} />{t("imports.addParameter")}</Button></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>{t("imports.label")}</th><th>{t("imports.value")}</th><th>{t("imports.text")}</th><th>{t("imports.confidence")}</th><th>{t("imports.checked")}</th><th /></tr></thead>
            <tbody>
              {draft.parameters.map((p, i) => {
                const unc = p.confidence < UNCERTAIN; const key = `parameter:${i}`;
                return (
                  <tr key={i} className={cx(unc && !checked.has(key) && "uncertain")}>
                    <td className="align-top min-w-[140px]">
                      <input className="fld fld-sm" aria-label={t("imports.label")} value={p.label} onChange={(e) => setParam(i, { label: e.target.value })} />
                      <span className="block text-[11px] text-muted mt-1 font-mono truncate">{p.key}{p.source_number ? ` · ${p.source_number}` : ""}</span>
                    </td>
                    <td className="align-top min-w-[120px]"><span className="flex gap-1"><input className="fld fld-sm" aria-label={t("imports.value")} value={p.value ?? ""} onChange={(e) => setParam(i, { value: e.target.value })} />{p.unit && <span className="text-xs text-muted pt-2">{p.unit}</span>}</span></td>
                    <td className="align-top min-w-[200px]"><textarea className="fld fld-sm !min-h-[36px] !py-1.5" rows={2} aria-label={t("imports.text")} value={p.text} onChange={(e) => setParam(i, { text: e.target.value })} /></td>
                    <td className="align-top whitespace-nowrap"><ConfCell confidence={p.confidence} page={p.page} onAnchor={onAnchor} /></td>
                    <td className="align-top"><input type="checkbox" aria-label={t("imports.checked")} checked={checked.has(key)} onChange={(e) => onCheck(key, e.target.checked)} /></td>
                    <td className="align-top"><button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.remove")} onClick={() => onChange({ ...draft, parameters: draft.parameters.filter((_, j) => j !== i) })}><IconTrash width={14} height={14} /></button></td>
                  </tr>
                );
              })}
              {draft.parameters.length === 0 && <tr><td colSpan={6} className="text-sm text-muted">{t("common.none")}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h3>{t("imports.keyDates")}</h3><Button size="sm" onClick={() => onChange({ ...draft, key_dates: [...draft.key_dates, { kind: "", date: "", title: "", confidence: 1 }] })}><IconPlus width={14} height={14} />{t("imports.addKeyDate")}</Button></div>
        <div className="card-b grid gap-2">
          {draft.key_dates.map((k, i) => {
            const unc = k.confidence < UNCERTAIN; const key = `key_date:${i}`;
            return (
              <div key={i} className={cx("rounded-control p-3 grid gap-2", unc && !checked.has(key) ? "bg-warning-subtle" : "bg-canvas")}>
                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
                  <select className="fld fld-sm" aria-label={t("keyDates.kind")} value={k.kind} onChange={(e) => setKd(i, { kind: e.target.value })}>
                    <option value="">{t("common.selectPlaceholder")}</option>
                    {(kinds.data ?? []).map((kk) => <option key={kk.code} value={kk.code}>{kk.name_et || tEnum("keyDates.kinds", kk.code)}</option>)}
                    {k.kind && !kinds.data?.some((kk) => kk.code === k.kind) && <option value={k.kind}>{tEnum("keyDates.kinds", k.kind)}</option>}
                  </select>
                  <input className="fld fld-sm" type="date" aria-label={t("keyDates.dueDate")} value={k.date?.slice(0, 10) ?? ""} onChange={(e) => setKd(i, { date: e.target.value })} />
                  <input className="fld fld-sm" aria-label={t("keyDates.title_")} value={k.title} onChange={(e) => setKd(i, { title: e.target.value })} />
                  <button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.remove")} onClick={() => onChange({ ...draft, key_dates: draft.key_dates.filter((_, j) => j !== i) })}><IconTrash width={14} height={14} /></button>
                </div>
                <ConfRow confidence={k.confidence} page={k.page} onAnchor={onAnchor} checkKey={key} checked={checked} onCheck={onCheck} />
              </div>
            );
          })}
          {draft.key_dates.length === 0 && <p className="text-sm text-muted">{t("common.none")}</p>}
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h3>{t("imports.clauses")}</h3><span className="text-muted text-sm">{draft.clauses.length}</span></div>
        <div className="card-b">
          {draft.clauses.length === 0 ? <p className="text-sm text-muted">{t("imports.noClauses")}</p> : (
            <div>
              {draft.clauses.map((cl, i) => (
                <div key={i} className="clause flex gap-3" style={{ paddingLeft: Math.max(0, cl.level - 1) * 16 }}>
                  <span className="no pt-0.5">{cl.number}</span>
                  <div className="min-w-0 flex-1">
                    {cl.heading && <div className="font-semibold text-sm">{cl.heading}</div>}
                    <p className="text-sm whitespace-pre-wrap">{cl.text}</p>
                  </div>
                  {cl.page && <button type="button" className="pill flex-none self-start hover:bg-primary-subtle" onClick={() => onAnchor(cl.page)}>{t("imports.pageAnchor", { n: cl.page })}</button>}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function ConfCell({ confidence, page, onAnchor }: { confidence: number; page?: number | null; onAnchor: (p: number | null | undefined) => void }) {
  const unc = confidence < UNCERTAIN;
  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      <Pill tone={unc ? "warning" : "success"} title={unc ? t("imports.uncertain") : undefined}>{fmtPct(confidence)}</Pill>
      {page && <button type="button" className="pill hover:bg-primary-subtle" onClick={() => onAnchor(page)}>{t("imports.pageAnchor", { n: page })}</button>}
    </span>
  );
}

function ConfRow({ confidence, page, onAnchor, checkKey, checked, onCheck }: { confidence: number; page?: number | null; onAnchor?: (p: number | null | undefined) => void; checkKey: string; checked: Set<string>; onCheck: (k: string, v: boolean) => void }) {
  const unc = confidence < UNCERTAIN;
  return (
    <div className="flex items-center gap-3 flex-wrap text-xs">
      <Pill tone={unc ? "warning" : "success"}>{fmtPct(confidence)}</Pill>
      {page && onAnchor && <button type="button" className="pill hover:bg-primary-subtle" onClick={() => onAnchor(page)}>{t("imports.pageAnchor", { n: page })}</button>}
      {unc && !checked.has(checkKey) && <span className="text-warning font-medium">{t("imports.uncertain")}</span>}
      <label className="flex items-center gap-2 ml-auto cursor-pointer"><input type="checkbox" checked={checked.has(checkKey)} onChange={(e) => onCheck(checkKey, e.target.checked)} />{t("imports.checked")}</label>
    </div>
  );
}
