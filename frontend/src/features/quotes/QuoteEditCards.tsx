"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { useAssets } from "@/lib/queries/portfolio";
import { useAddQuoteSpace, useAddQuoteTerm, useDeleteQuoteAttachment, useRemoveQuoteSpace, useRemoveQuoteTerm, useUpdateQuote, useUpdateQuoteSpace, useUpdateQuoteTerm, useUploadQuoteAttachment } from "@/lib/queries/quotes";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Popover } from "@/components/ui/Popover";
import { Pill, statusTone } from "@/components/ui/Pill";
import { IconExternal, IconLock, IconPlus, IconTrash, IconX } from "@/components/ui/Icons";
import { cx, fmtEur, fmtNum } from "@/lib/format";
import type { Run } from "./quoteRun";
import type { QuoteDetail, QuoteScheduleStep, QuoteSpace, SpaceAttributes } from "@/types/api";

const PERIODS = [12, 24, 36, 60, 120];
const SELECTABLE = new Set(["vaba", "pakkumisel"]);
const num = (v: string): number | null => { const s = v.trim().replace(",", "."); if (s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };

// ---------------------------------------------------------------- Pinnad ja hind ----------------------------------

export function SpacesCard({ q, run }: { q: QuoteDetail; run: Run }) {
  const editable = q.editable;
  const update = useUpdateQuote(q.id);
  const addSpace = useAddQuoteSpace(q.id);
  const removeSpace = useRemoveQuoteSpace(q.id);
  const [remove, setRemove] = useState<QuoteSpace | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const others = useAssets({ type_code: "space", parent_id: q.property.id });
  const inQuote = new Set(q.spaces.map((s) => s.space_id));
  const candidates = (others.data ?? []).filter((s) => !inQuote.has(s.id) && SELECTABLE.has(s.status ?? ""));
  const pa = q.property_attributes;
  const tot = q.totals;
  const customPeriod = !PERIODS.includes(q.period_months);
  const [custom, setCustom] = useState(customPeriod);
  const patch = (body: Parameters<typeof update.mutateAsync>[0]) => run(update.mutateAsync({ ...body, expected_version: q.version }));
  return (
    <Card>
      <CardHeader title={t("quotes.spaces.title")} actions={editable && (
        <Popover open={addOpen} onClose={() => setAddOpen(false)} trigger={<Button size="sm" onClick={() => setAddOpen((o) => !o)}><IconPlus width={14} height={14} />{t("quotes.spaces.add")}</Button>}>
          <div role="menu" className="min-w-[240px]">
            {candidates.length === 0 ? <p className="text-sm text-muted px-3 py-2">{t("quotes.spaces.noMore")}</p> : candidates.map((s) => {
              const a = s.attributes as Partial<SpaceAttributes>;
              return <button key={s.id} role="menuitem" type="button" className="drop-item" onClick={async () => { setAddOpen(false); await run(addSpace.mutateAsync(s.id)); }}><span className="flex-1 truncate">{s.name}</span><span className="text-xs text-muted">{fmtNum(a.rentable_area_m2)} m²</span><Pill tone={statusTone(s.status)}>{tEnum("assets.status", s.status)}</Pill></button>;
            })}
          </div>
        </Popover>
      )} />
      <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
        {q.spaces.map((s) => <SpaceRow key={s.id} q={q} s={s} run={run} onRemove={() => setRemove(s)} />)}
      </ul>
      <CardBody className="border-t grid gap-4">
        <div className="grid gap-x-4 sm:grid-cols-2">
          <div className="field">
            <label className="field-label">{t("quotes.spaces.period")}</label>
            <div className="flex gap-2">
              <select className="fld" disabled={!editable} value={custom ? "custom" : String(q.period_months)} onChange={(e) => { if (e.target.value === "custom") setCustom(true); else { setCustom(false); void patch({ period_months: Number(e.target.value) }); } }} aria-label={t("quotes.spaces.period")}>
                {PERIODS.map((m) => <option key={m} value={m}>{t("quotes.key.months", { n: m })}</option>)}
                <option value="custom">{t("quotes.spaces.periodCustom")}</option>
              </select>
              {custom && <input className="fld w-28" type="number" min={1} max={600} disabled={!editable} defaultValue={q.period_months} aria-label={t("quotes.spaces.periodMonths")} onBlur={(e) => { const n = num(e.target.value); if (n && n !== q.period_months) void patch({ period_months: Math.round(n) }); }} />}
            </div>
          </div>
          <Input label={t("quotes.spaces.validUntil")} type="date" disabled={!editable} defaultValue={q.valid_until} key={q.valid_until} onBlur={(e) => { if (e.target.value && e.target.value !== q.valid_until) void patch({ valid_until: e.target.value }); }} />
        </div>
        <dl className="kv text-sm">
          <dt>{t("quotes.spaces.utility")}</dt>
          <dd className="font-normal">{pa.utility_cost_winter == null && pa.utility_cost_summer == null ? <span className="text-muted">{t("quotes.spaces.utilityNone")}</span> : <>
            {t("quotes.spaces.utilityLine", { winter: fmtNum(pa.utility_cost_winter), summer: fmtNum(pa.utility_cost_summer) })} · {t("quotes.spaces.utilityTotals", { winter: fmtNum(tot.utility_winter), summer: fmtNum(tot.utility_summer) })}
            <span className="text-muted"> · {t("quotes.spaces.utilitySource", { source: pa.utility_source || t("quotes.spaces.utilityManual") })}</span></>}</dd>
          <dt>{t("quotes.spaces.vat")}</dt>
          <dd className="font-normal">{tot.vat_taxable ? t("quotes.spaces.vatYes", { rate: fmtNum((tot.vat_rate ?? 0) * 100) }) : t("quotes.spaces.vatNo")}</dd>
        </dl>
        <Features q={q} editable={editable} onSave={(features) => patch({ features })} />
      </CardBody>
      <ConfirmDialog open={!!remove} onClose={() => setRemove(null)} busy={removeSpace.isPending} title={t("quotes.spaces.remove")} body={remove ? t("quotes.spaces.removeConfirm", { name: remove.name }) : null}
        onConfirm={async () => { if (!remove) return; await run(removeSpace.mutateAsync(remove.space_id)); setRemove(null); }} />
    </Card>
  );
}

function SpaceRow({ q, s, run, onRemove }: { q: QuoteDetail; s: QuoteSpace; run: Run; onRemove: () => void }) {
  const editable = q.editable;
  const upd = useUpdateQuoteSpace(q.id);
  const patch = (body: Omit<Parameters<typeof upd.mutateAsync>[0], "space_id">) => run(upd.mutateAsync({ space_id: s.space_id, expected_version: q.version, ...body }));
  const [sched, setSched] = useState<boolean>(!!s.schedule);
  const [steps, setSteps] = useState<{ until: string; price: string }[]>(() => toDraft(s.schedule, s.price_per_m2));
  const onPrice = (v: string) => { const n = num(v); if (n === null) { if (s.price_override !== null) void patch({ clear_price: true }); } else if (n !== s.price_per_m2) void patch({ price_per_m2: n }); };
  const onElectrical = (v: string) => { const n = num(v); if (n === null) { if (s.electrical_override !== null) void patch({ clear_electrical: true }); } else if (n !== s.electrical_a) void patch({ electrical_a: n }); };
  const onCount = (v: string) => { const n = num(v); if (n === null) void patch({ clear_parking_count: true }); else if (n !== s.parking.count) void patch({ parking_count: Math.round(n) }); };
  const mySpots = new Set(s.parking.spots.map((x) => x.id));
  const toggleSpot = (id: string) => { const ids = mySpots.has(id) ? s.parking.spots.map((x) => x.id).filter((x) => x !== id) : [...s.parking.spots.map((x) => x.id), id]; void patch({ parking_spot_ids: ids }); };
  const resetSpots = () => void patch({ parking_spot_ids: q.register_spots.filter((x) => x.space_id === s.space_id && !x.out_of_service).map((x) => x.id) });
  const saveSchedule = () => {
    const schedule: QuoteScheduleStep[] = steps.map((st) => ({ until_month: num(st.until) === null ? null : Math.round(num(st.until) as number), price: num(st.price) ?? s.price_per_m2 }));
    void patch({ schedule });
  };
  return (
    <li className="px-[var(--card-padding)] py-3 grid gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="min-w-0 flex-1">
          <Link href={`/app/portfell/pind/${s.space_id}`} className="text-primary font-semibold">{s.name}</Link>
          <span className="text-muted text-sm"> · {fmtNum(s.area_m2)} m²{s.parts ? ` · ${s.parts}` : ""}</span>
        </span>
        <span className="font-mono text-sm tabular-nums">{fmtEur(s.line.monthly_net)}{s.line.stepped && <span className="text-muted"> · ø {fmtEur(s.line.avg_price_per_m2)}</span>}</span>
        {editable && <button type="button" className="icon-btn !w-8 !h-8" aria-label={t("quotes.spaces.remove")} title={q.spaces.length <= 1 ? t("quotes.spaces.removeLast") : t("quotes.spaces.remove")} disabled={q.spaces.length <= 1} onClick={onRemove}><IconX width={14} height={14} /></button>}
      </div>
      <div className="grid gap-x-3 grid-cols-2 sm:grid-cols-3 items-end">
        <Input label={t("quotes.spaces.price")} type="number" step="0.01" inputMode="decimal" disabled={!editable || sched} key={`p${s.price_override ?? ""}`} defaultValue={s.price_override ?? ""} placeholder={s.list_price != null ? String(s.list_price) : undefined}
          hint={s.list_price != null ? t("quotes.spaces.listPrice", { price: fmtEur(s.list_price) }) : undefined} onBlur={(e) => onPrice(e.target.value)} />
        <Input label={t("quotes.spaces.electrical")} type="number" step="1" inputMode="numeric" disabled={!editable} key={`e${s.electrical_override ?? ""}`} defaultValue={s.electrical_override ?? ""} placeholder={s.electrical_space != null ? String(s.electrical_space) : undefined}
          hint={s.electrical_space != null ? t("quotes.spaces.electricalSpace", { a: fmtNum(s.electrical_space) }) : undefined} onBlur={(e) => onElectrical(e.target.value)} />
        {!q.has_register && <Input label={t("quotes.spaces.parkingCount")} type="number" step="1" inputMode="numeric" disabled={!editable} key={`c${s.parking.count ?? ""}`} defaultValue={s.parking.count ?? ""} onBlur={(e) => onCount(e.target.value)} />}
        {editable && !sched && <div className="field"><Button size="sm" variant="text" onClick={() => setSched(true)}>{t("quotes.spaces.schedule")}</Button></div>}
      </div>
      {sched && (
        <div className="rounded-control p-3 grid gap-2" style={{ background: "var(--color-surface-subtle)" }}>
          <div className="text-xs font-semibold text-muted">{t("quotes.spaces.scheduleTitle")}</div>
          {steps.map((st, i) => {
            const last = i === steps.length - 1;
            return (
              <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-muted w-16">{t("quotes.spaces.scheduleUntil")}</span>
                {last ? <span className="w-20 text-muted">{t("quotes.spaces.scheduleOpen")}</span> : <input className="fld fld-sm w-20" type="number" min={1} disabled={!editable} value={st.until} onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, until: e.target.value } : y)))} aria-label={t("quotes.spaces.scheduleUntil")} />}
                <input className="fld fld-sm w-24" type="number" step="0.01" disabled={!editable} value={st.price} onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} aria-label={t("quotes.spaces.schedulePrice")} />
                <span className="text-muted">{t("quotes.spaces.schedulePrice")}</span>
                {editable && steps.length > 2 && !last && <button type="button" className="icon-btn !w-7 !h-7" aria-label={t("common.remove")} onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}><IconX width={12} height={12} /></button>}
              </div>
            );
          })}
          {editable && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="text" onClick={() => setSteps((x) => [...x.slice(0, -1), { until: "", price: x[x.length - 1]?.price ?? "" }, x[x.length - 1]])}>{t("quotes.spaces.scheduleAdd")}</Button>
              <Button size="sm" variant="primary" busy={upd.isPending} onClick={saveSchedule}>{t("quotes.spaces.scheduleSave")}</Button>
              <Button size="sm" variant="text" onClick={async () => { await patch({ clear_schedule: true }); setSched(false); setSteps(toDraft(null, s.price_per_m2)); }}>{t("quotes.spaces.scheduleClear")}</Button>
            </div>
          )}
        </div>
      )}
      {q.has_register && (
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold text-muted">{t("quotes.spaces.parking")}</span>{editable && <Button size="sm" variant="text" className="!min-h-0 h-6 px-2 text-xs" onClick={resetSpots}>{t("quotes.spaces.parkingReset")}</Button>}</div>
          <div className="flex flex-wrap gap-1">
            {q.register_spots.map((sp) => {
              const on = mySpots.has(sp.id);
              const label = `${sp.number ?? "?"}${sp.zone ? ` · ${sp.zone}` : ""}`;
              const cls = cx("pill select-none", on && "primary", sp.out_of_service && "error", editable && !sp.out_of_service && "cursor-pointer");
              return editable ? <button key={sp.id} type="button" className={cls} aria-pressed={on} disabled={sp.out_of_service} title={sp.out_of_service ? t("quotes.spaces.parkingOut") : undefined} onClick={() => toggleSpot(sp.id)}>{label}</button>
                : on ? <span key={sp.id} className={cls}>{label}</span> : null;
            })}
            {!editable && s.parking.spots.length === 0 && <span className="text-sm text-muted">—</span>}
          </div>
        </div>
      )}
    </li>
  );
}

function toDraft(schedule: QuoteScheduleStep[] | null, price: number): { until: string; price: string }[] {
  if (schedule && schedule.length) return schedule.map((st) => ({ until: st.until_month == null ? "" : String(st.until_month), price: String(st.price) }));
  return [{ until: "12", price: String(price) }, { until: "", price: String(price) }];
}

const SUGGEST = ["load", "height", "dock", "cooling", "ventilation"] as const;

function Features({ q, editable, onSave }: { q: QuoteDetail; editable: boolean; onSave: (f: { label: string; value: string }[]) => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const have = new Set(q.features.map((f) => f.label));
  const add = () => { if (!pending) return; onSave([...q.features, { label: pending, value: value.trim() }]); setPending(null); setValue(""); };
  return (
    <div>
      <div className="text-xs font-semibold text-muted mb-1">{t("quotes.spaces.features")}</div>
      <div className="flex flex-wrap gap-1 items-center">
        {q.features.map((f) => (
          <span key={f.label} className="pill primary">{f.label}{f.value ? `: ${f.value}` : ""}{editable && <button type="button" className="ml-1 -mr-1 inline-grid place-items-center w-4 h-4 rounded-full hover:bg-subtle" aria-label={t("common.remove")} onClick={() => onSave(q.features.filter((x) => x.label !== f.label))}><IconX width={10} height={10} /></button>}</span>
        ))}
        {editable && SUGGEST.map((k) => { const label = tEnum("quotes.spaces.featureSuggest", k); if (have.has(label)) return null; return <button key={k} type="button" className={cx("pill cursor-pointer", pending === label && "info")} onClick={() => { setPending(label); setValue(""); }}>+ {label}</button>; })}
        {q.features.length === 0 && !editable && <span className="text-sm text-muted">—</span>}
      </div>
      {pending && (
        <div className="flex items-end gap-2 mt-2">
          <Input label={`${pending} · ${t("quotes.spaces.featureValue")}`} value={value} autoFocus onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} className="!mb-0 flex-1" />
          <Button size="sm" variant="primary" onClick={add}>{t("quotes.spaces.featureAdd")}</Button>
          <Button size="sm" variant="text" onClick={() => setPending(null)}>{t("common.cancel")}</Button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- Eritingimused -----------------------------------

export function TermsCard({ q, run }: { q: QuoteDetail; run: Run }) {
  const add = useAddQuoteTerm(q.id);
  const upd = useUpdateQuoteTerm(q.id);
  const del = useRemoveQuoteTerm(q.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const editable = q.editable;
  return (
    <Card>
      <CardHeader title={t("quotes.terms.title")} actions={editable && !adding && <Button size="sm" variant="text" onClick={() => setAdding(true)}>{t("quotes.terms.add")}</Button>} />
      <CardBody>
        {q.special_terms.length === 0 && !adding ? <p className="text-sm text-muted">{t("quotes.terms.none")}</p> : (
          <ol className="grid gap-2 text-sm">
            {q.special_terms.map((term, i) => (
              <li key={term.id} className="flex gap-2">
                <span className="text-muted font-mono text-xs pt-0.5 w-5 flex-none">{i + 1}.</span>
                {editing === term.id ? (
                  <div className="flex-1">
                    <textarea className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} aria-label={t("quotes.terms.title")} autoFocus />
                    <div className="flex gap-2 justify-end mt-2">
                      <Button size="sm" variant="text" className="btn-destructive mr-auto" onClick={async () => { await run(del.mutateAsync(term.id)); setEditing(null); }}><IconTrash width={14} height={14} />{t("common.delete")}</Button>
                      <Button size="sm" onClick={() => setEditing(null)}>{t("common.cancel")}</Button>
                      <Button size="sm" variant="primary" busy={upd.isPending} onClick={async () => { await run(upd.mutateAsync({ term_id: term.id, text, expected_version: q.version })); setEditing(null); }}>{t("common.save")}</Button>
                    </div>
                  </div>
                ) : (
                  <button type="button" className={cx("flex-1 text-left min-w-0 rounded-control -mx-1 px-1", editable && !term.auto_kind && "hover:bg-canvas cursor-text")} disabled={!editable || !!term.auto_kind} onClick={() => { setEditing(term.id); setText(term.text); }}>
                    <span className="whitespace-pre-wrap">{term.text}</span>
                    {term.auto_kind && <span className="block text-xs text-muted mt-0.5 flex items-center gap-1"><IconLock width={12} height={12} />{t("quotes.terms.auto")}{term.overrides_label ? ` · ${term.overrides_label}` : ""}</span>}
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {adding && (
          <div className="mt-3">
            <textarea className="fld" rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("quotes.terms.placeholder")} aria-label={t("quotes.terms.add")} autoFocus />
            <div className="flex gap-2 justify-end mt-2">
              <Button size="sm" onClick={() => { setAdding(false); setDraft(""); }}>{t("common.cancel")}</Button>
              <Button size="sm" variant="primary" busy={add.isPending} disabled={!draft.trim()} onClick={async () => { const r = await run(add.mutateAsync({ text: draft.trim(), expected_version: q.version })); if (r) { setAdding(false); setDraft(""); } }}>{t("common.add")}</Button>
            </div>
          </div>
        )}
        <p className="text-xs text-muted mt-3">{t("quotes.terms.note")}</p>
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- Lisad ---------------------------------------------

export function AttachmentsCard({ q, run }: { q: QuoteDetail; run: Run }) {
  const upload = useUploadQuoteAttachment(q.id);
  const del = useDeleteQuoteAttachment(q.id);
  const input = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState<{ id: string; title: string } | null>(null);
  const editable = q.editable;
  const items = useMemo(() => q.attachments, [q.attachments]);
  return (
    <Card>
      <CardHeader title={t("quotes.attachments.title")} actions={editable && <>
        <Button size="sm" busy={upload.isPending} onClick={() => input.current?.click()}><IconPlus width={14} height={14} />{t("quotes.attachments.upload")}</Button>
        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) await run(upload.mutateAsync(f), t("quotes.attachments.uploaded")); }} />
      </>} />
      <CardBody>
        {items.length === 0 ? <p className="text-sm text-muted">{t("quotes.attachments.none")}</p> : (
          <ul className="grid gap-2 text-sm">
            {items.map((a) => (
              <li key={a.attachment_id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate">{t("quotes.attachments.item", { number: a.number, title: a.title })}</span>
                {a.url && <a href={a.url} target="_blank" rel="noopener" className="btn btn-text btn-sm"><IconExternal width={14} height={14} />{t("common.open")}</a>}
                {editable && a.kind === "upload" && <button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.delete")} onClick={() => setConfirm({ id: a.attachment_id, title: a.title })}><IconTrash width={14} height={14} /></button>}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} busy={del.isPending} title={t("common.delete")} body={confirm ? t("quotes.attachments.deleteConfirm", { title: confirm.title }) : null}
        onConfirm={async () => { if (!confirm) return; await run(del.mutateAsync(confirm.id)); setConfirm(null); }} />
    </Card>
  );
}

