"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { useAddSpecial, useLeaseChat, useMarkLeaseChatRead, usePostLeaseChat, useRemoveSpecial, useUpdateEmploymentTerms, useUpdateLeaseContact, useUpdateLeaseTerms } from "@/lib/queries/leases";
import { useParking } from "@/lib/queries/portfolio";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { ConfirmDialog } from "@/components/ui/Modal";
import { Pill, type Tone } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { IconExternal, IconLink, IconTrash, IconX } from "@/components/ui/Icons";
import { cx, fmtDate, fmtDateTime, fmtEur, fmtNum } from "@/lib/format";
import type { Run } from "@/features/quotes/quoteRun";
import type { EmploymentTermsPatch, LeaseChatMessage, LeaseDealSpace, LeaseDraft, LeaseIndexation, LeaseNegotiation, LeaseRepresentative, LeaseRepresentatives, LeaseScheduleStep, LeaseSpaceTerms, LeaseTermsPatch } from "@/types/api";

const PERIODS = [12, 24, 36, 60, 120];
/** The employment vertical (Tööleping) reuses the lease draft page; a few labels flip: Üürnik → Töötaja, Üürileandja → Tööandja. */
export const isEmployment = (lease: LeaseDraft) => lease.deal.vertical === "employment";
const num = (v: string): number | null => { const s = v.trim().replace(",", "."); if (s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const DELIVERY_TONE: Record<string, Tone> = { queued: "neutral", sent: "info", delivered: "success", bounced: "error", failed: "error" };

// ---------------------------------------------------------------- Tehing --------------------------------------------

export function DealCard(props: { lease: LeaseDraft; run: Run; editable: boolean }) {
  return isEmployment(props.lease) ? <EmploymentDealCard {...props} /> : <LeaseDealCard {...props} />;
}

function LeaseDealCard({ lease, run, editable }: { lease: LeaseDraft; run: Run; editable: boolean }) {
  const update = useUpdateLeaseTerms(lease.id);
  const d = lease.deal;
  const ix = d.indexation ?? {};
  const [custom, setCustom] = useState(d.months !== null && !PERIODS.includes(d.months));
  const patch = (body: LeaseTermsPatch) => run(update.mutateAsync({ ...body, expected_version: lease.version }), t("lease.deal.saved"));
  const setIx = (p: Partial<LeaseIndexation>) => patch({ indexation: { ...ix, ...p } });
  const property = d.property;
  const parking = useParking(property && property.attributes.has_parking !== false ? property.id : undefined);
  const spots = parking.data ?? [];
  return (
    <Card>
      <CardHeader title={t("lease.deal.title")} />
      {!editable && <p className="text-xs text-muted px-[var(--card-padding)] pt-3 m-0">{t("lease.deal.readOnly")}</p>}
      <CardBody className="grid gap-2">
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Input label={t("lease.deal.handover")} type="date" disabled={!editable} key={`h${d.handover}`} defaultValue={d.handover} hint={t("lease.deal.end", { date: fmtDate(d.end) })} onBlur={(e) => { if (e.target.value && e.target.value !== d.handover) void patch({ handover: e.target.value }); }} />
          <div className="field">
            <label className="field-label">{t("lease.deal.months")}</label>
            <div className="flex gap-2">
              <select className="fld" disabled={!editable} value={custom ? "custom" : String(d.months)} onChange={(e) => { if (e.target.value === "custom") setCustom(true); else { setCustom(false); void patch({ months: Number(e.target.value) }); } }} aria-label={t("lease.deal.months")}>
                {PERIODS.map((m) => <option key={m} value={m}>{t("lease.deal.monthsN", { n: m })}</option>)}
                <option value="custom">{t("lease.deal.custom")}</option>
              </select>
              {custom && <input className="fld w-28" type="number" min={1} max={600} disabled={!editable} defaultValue={d.months ?? ""} aria-label={t("lease.deal.monthsInput")} onBlur={(e) => { const n = num(e.target.value); if (n && Math.round(n) !== d.months) void patch({ months: Math.round(n) }); }} />}
            </div>
          </div>
        </div>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Input label={t("lease.deal.deposit")} type="number" min={0} max={24} step="1" inputMode="numeric" disabled={!editable} key={`dm${d.deposit_months}`} defaultValue={d.deposit_months} hint={d.deposit_months ? fmtEur(d.deposit) : undefined} onBlur={(e) => { const n = num(e.target.value); if (n !== null && Math.round(n) !== d.deposit_months) void patch({ deposit_months: Math.round(n) }); }} />
          <div className="field">
            <label className="field-label">{t("lease.deal.indexation")}</label>
            <select className="fld" disabled={!editable} value={ix.method ?? ""} onChange={(e) => setIx({ method: e.target.value || null, rate: e.target.value === "fixed_pct" ? (ix.rate ?? 3) : null, frequency_months: ix.frequency_months ?? 12 })} aria-label={t("lease.deal.indexMethod")}>
              <option value="">{t("lease.deal.indexNone")}</option>
              <option value="fixed_pct">{t("lease.deal.indexFixed")}</option>
              <option value="stat_cpi">{t("lease.deal.indexCpi")}</option>
            </select>
          </div>
        </div>
        {ix.method && (
          <div className="grid gap-x-3 sm:grid-cols-2">
            {ix.method === "fixed_pct" && <Input label={t("lease.deal.indexRate")} type="number" step="0.1" inputMode="decimal" disabled={!editable} key={`r${ix.rate ?? ""}`} defaultValue={ix.rate ?? ""} onBlur={(e) => { const n = num(e.target.value); if (n !== null && n !== ix.rate) void setIx({ rate: n }); }} />}
            <Input label={t("lease.deal.indexNext")} type="date" disabled={!editable} key={`n${ix.next_date ?? ""}`} defaultValue={ix.next_date ?? ""} onBlur={(e) => { if (e.target.value && e.target.value !== ix.next_date) void setIx({ next_date: e.target.value }); }} />
          </div>
        )}
        <TextField label={t("lease.deal.purpose")} value={lease.terms.purpose ?? ""} placeholder={d.purpose} editable={editable} onSave={(v) => patch({ purpose: v })} />
        <TextField label={t("lease.deal.termNotes")} value={lease.terms.term_notes ?? ""} placeholder={d.term_notes} editable={editable} onSave={(v) => patch({ term_notes: v })} />
      </CardBody>
      <div className="border-t px-[var(--card-padding)] pt-3" style={{ borderColor: "var(--line)" }}><div className="text-xs font-semibold text-muted">{t("lease.deal.spaces")}</div></div>
      <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
        {d.spaces.map((s) => <SpaceRow key={s.space_id} lease={lease} s={s} terms={(lease.terms.spaces ?? []).find((x) => x.space_id === s.space_id)} spots={spots} hasRegister={spots.length > 0} editable={editable} patch={patch} busy={update.isPending} />)}
      </ul>
    </Card>
  );
}

/** „Tehing” for a Tööleping (deal.vertical === "employment"): the TLS main terms, saved through PATCH /employment-terms; no spaces, parking, deposit or indexation. */
function EmploymentDealCard({ lease, run, editable }: { lease: LeaseDraft; run: Run; editable: boolean }) {
  const update = useUpdateEmploymentTerms(lease.id);
  const d = lease.deal;
  const e = d.employment;
  const patch = (body: EmploymentTermsPatch) => run(update.mutateAsync({ ...body, expected_version: lease.version }), t("lease.deal.employment.saved"));
  const [fixed, setFixed] = useState(d.months !== null);
  if (!e) return null;
  return (
    <Card>
      <CardHeader title={t("lease.deal.title")}>
        <p className="text-sm text-muted m-0">{t("lease.deal.employment.position")}: <span className="font-medium text-ink">{e.position.name}</span>{e.department && <span> · {e.department.name}</span>}</p>
      </CardHeader>
      {!editable && <p className="text-xs text-muted px-[var(--card-padding)] pt-3 m-0">{t("lease.deal.readOnly")}</p>}
      <CardBody className="grid gap-2">
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Input label={t("lease.deal.employment.salary")} type="number" min={0} step="0.01" inputMode="decimal" disabled={!editable} key={`s${e.salary}`} defaultValue={e.salary} onBlur={(ev) => { const n = num(ev.target.value); if (n !== null && n > 0 && n !== e.salary) void patch({ salary: n }); }} />
          <Input label={t("lease.deal.employment.start")} type="date" disabled={!editable} key={`h${d.handover}`} defaultValue={d.handover} hint={d.end ? t("lease.deal.employment.end", { date: fmtDate(d.end) }) : t("lease.deal.employment.openEnded")} onBlur={(ev) => { if (ev.target.value && ev.target.value !== d.handover) void patch({ start: ev.target.value }); }} />
        </div>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <div className="field">
            <label className="field-label">{t("lease.deal.employment.months")}</label>
            <div className="flex gap-2">
              <select className="fld" disabled={!editable} value={fixed ? "fixed" : "open"} onChange={(ev) => { const f = ev.target.value === "fixed"; setFixed(f); if (!f && d.months !== null) void patch({ months: null }); }} aria-label={t("lease.deal.employment.months")}>
                <option value="open">{t("lease.deal.employment.openEnded")}</option>
                <option value="fixed">{t("lease.deal.employment.fixed")}</option>
              </select>
              {fixed && <input className="fld w-28" type="number" min={1} max={600} disabled={!editable} key={`m${d.months ?? ""}`} defaultValue={d.months ?? ""} aria-label={t("lease.deal.employment.monthsInput")} onBlur={(ev) => { const n = num(ev.target.value); if (n && Math.round(n) !== d.months) void patch({ months: Math.round(n) }); }} />}
            </div>
          </div>
          <div className="field">
            <label className="field-label">{t("lease.deal.employment.probation")}</label>
            <select className="fld" disabled={!editable} value={String(e.probation_months)} onChange={(ev) => void patch({ probation_months: Number(ev.target.value) })} aria-label={t("lease.deal.employment.probation")}>
              {[0, 1, 2, 3, 4].map((n) => <option key={n} value={n}>{n === 0 ? t("lease.deal.employment.probationNone") : t("lease.deal.monthsN", { n })}</option>)}
            </select>
            {e.probation_end && <span className="field-hint">{t("lease.deal.employment.probationEnd", { date: fmtDate(e.probation_end) })}</span>}
          </div>
        </div>
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Input label={t("lease.deal.employment.workingTime")} disabled={!editable} key={`w${e.working_time}`} defaultValue={e.working_time} onBlur={(ev) => { const v = ev.target.value.trim(); if (v && v !== e.working_time) void patch({ working_time: v }); }} />
          <Input label={t("lease.deal.employment.place")} disabled={!editable} key={`p${e.place ?? ""}`} defaultValue={e.place ?? ""} onBlur={(ev) => { const v = ev.target.value.trim(); if (v !== (e.place ?? "")) void patch({ place: v || null }); }} />
        </div>
        <div className="grid gap-x-3 grid-cols-2 sm:grid-cols-3">
          <Input label={t("lease.deal.employment.salaryReview")} type="date" disabled={!editable} key={`r${e.salary_review ?? ""}`} defaultValue={e.salary_review ?? ""} onBlur={(ev) => { if (ev.target.value && ev.target.value !== e.salary_review) void patch({ salary_review: ev.target.value }); }} />
          <Input label={t("lease.deal.employment.vacationDays")} type="number" min={0} max={60} step="1" inputMode="numeric" disabled={!editable} key={`v${e.vacation_days}`} defaultValue={e.vacation_days} onBlur={(ev) => { const n = num(ev.target.value); if (n !== null && Math.round(n) !== e.vacation_days) void patch({ vacation_days: Math.round(n) }); }} />
          <Input label={t("lease.deal.employment.payDay")} type="number" min={1} max={28} step="1" inputMode="numeric" disabled={!editable} key={`d${e.pay_day}`} defaultValue={e.pay_day} onBlur={(ev) => { const n = num(ev.target.value); if (n !== null && Math.round(n) !== e.pay_day) void patch({ pay_day: Math.min(28, Math.max(1, Math.round(n))) }); }} />
        </div>
        <TextField label={t("lease.deal.employment.termNotes")} value={lease.terms.term_notes ?? ""} placeholder={d.term_notes} editable={editable} onSave={(v) => patch({ term_notes: v })} />
      </CardBody>
    </Card>
  );
}

/** A textarea that saves on blur when its value changed (the deal text facts: purpose, term notes). */
function TextField({ label, value, placeholder, editable, onSave }: { label: string; value: string; placeholder?: string; editable: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <div className="field">
      <label className="field-label">{label}</label>
      <textarea className="fld" rows={2} disabled={!editable} value={v} placeholder={placeholder} onChange={(e) => setV(e.target.value)} onBlur={() => { if (v.trim() !== value.trim()) onSave(v.trim()); }} aria-label={label} />
    </div>
  );
}

function SpaceRow({ lease, s, terms, spots, hasRegister, editable, patch, busy }: { lease: LeaseDraft; s: LeaseDealSpace; terms: LeaseSpaceTerms | undefined; spots: { id: string; number: string; zone: string | null; out_of_service: boolean; space_id: string | null }[]; hasRegister: boolean; editable: boolean; patch: (b: LeaseTermsPatch) => Promise<unknown>; busy: boolean }) {
  const space = (body: Omit<LeaseSpaceTerms, "space_id">) => patch({ spaces: [{ space_id: s.space_id, ...body }] });
  const [sched, setSched] = useState<boolean>(!!(s.schedule && s.schedule.length > 1));
  const [steps, setSteps] = useState<{ until: string; price: string }[]>(() => toDraft(s.schedule, s.price_per_m2));
  const mySpots = new Set(terms?.parking_spot_ids ?? []);
  const toggleSpot = (id: string) => { const ids = mySpots.has(id) ? [...mySpots].filter((x) => x !== id) : [...mySpots, id]; void space({ parking_spot_ids: ids }); };
  const resetSpots = () => void space({ parking_spot_ids: spots.filter((x) => x.space_id === s.space_id && !x.out_of_service).map((x) => x.id) });
  const saveSchedule = () => {
    const schedule: LeaseScheduleStep[] = steps.map((st) => ({ until_month: num(st.until) === null ? null : Math.round(num(st.until) as number), price: num(st.price) ?? s.price_per_m2 }));
    void space({ schedule });
  };
  const multi = lease.deal.spaces.length > 1;
  return (
    <li className="px-[var(--card-padding)] py-3 grid gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="min-w-0 flex-1"><Link href={`/app/portfell/pind/${s.space_id}`} className="text-primary font-semibold">{s.name}</Link><span className="text-muted text-sm"> · {fmtNum(s.area_m2)} m²{s.type ? ` · ${s.type}` : ""}</span></span>
        {multi && <span className="font-mono text-sm tabular-nums">{fmtEur(s.line.monthly_net)}{s.line.stepped && <span className="text-muted"> · ø {fmtEur(s.line.avg_price_per_m2)}</span>}</span>}
      </div>
      <div className="grid gap-x-3 grid-cols-2 sm:grid-cols-3 items-end">
        <Input label={t("lease.deal.price")} type="number" step="0.01" inputMode="decimal" disabled={!editable || sched} key={`p${s.price_per_m2}`} defaultValue={s.price_per_m2} onBlur={(e) => { const n = num(e.target.value); if (n !== null && n !== s.price_per_m2) void space({ price_per_m2: n }); }} />
        <Input label={t("lease.deal.electrical")} type="number" step="1" inputMode="numeric" disabled={!editable} key={`e${s.electrical_a ?? ""}`} defaultValue={s.electrical_a ?? ""} onBlur={(e) => { const n = num(e.target.value); if (n !== null && n !== s.electrical_a) void space({ electrical_a: n }); }} />
        {!hasRegister && <Input label={t("lease.deal.parkingCount")} type="number" step="1" inputMode="numeric" disabled={!editable} key={`c${s.parking_count}`} defaultValue={s.parking_count} onBlur={(e) => { const n = num(e.target.value); if (n !== null && Math.round(n) !== s.parking_count) void space({ parking_count: Math.round(n), parking_spot_ids: null }); }} />}
        {editable && !sched && <div className="field"><Button size="sm" variant="text" onClick={() => setSched(true)}>{t("lease.deal.schedule")}</Button></div>}
      </div>
      {sched && (
        <div className="rounded-control p-3 grid gap-2" style={{ background: "var(--color-surface-subtle)" }}>
          <div className="text-xs font-semibold text-muted">{t("lease.deal.scheduleTitle")}</div>
          {steps.map((st, i) => {
            const last = i === steps.length - 1;
            return (
              <div key={i} className="flex items-center gap-2 text-sm flex-wrap">
                <span className="text-muted w-16">{t("lease.deal.scheduleUntil")}</span>
                {last ? <span className="w-20 text-muted">{t("lease.deal.scheduleOpen")}</span> : <input className="fld fld-sm w-20" type="number" min={1} disabled={!editable} value={st.until} onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, until: e.target.value } : y)))} aria-label={t("lease.deal.scheduleUntil")} />}
                <input className="fld fld-sm w-24" type="number" step="0.01" disabled={!editable} value={st.price} onChange={(e) => setSteps((x) => x.map((y, j) => (j === i ? { ...y, price: e.target.value } : y)))} aria-label={t("lease.deal.schedulePrice")} />
                <span className="text-muted">{t("lease.deal.schedulePrice")}</span>
                {editable && steps.length > 2 && !last && <button type="button" className="icon-btn !w-7 !h-7" aria-label={t("common.remove")} onClick={() => setSteps((x) => x.filter((_, j) => j !== i))}><IconX width={12} height={12} /></button>}
              </div>
            );
          })}
          {editable && (
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="text" onClick={() => setSteps((x) => [...x.slice(0, -1), { until: "", price: x[x.length - 1]?.price ?? "" }, x[x.length - 1]])}>{t("lease.deal.scheduleAdd")}</Button>
              <Button size="sm" variant="primary" busy={busy} onClick={saveSchedule}>{t("lease.deal.scheduleSave")}</Button>
              <Button size="sm" variant="text" onClick={async () => { await space({ schedule: null }); setSched(false); setSteps(toDraft(null, s.price_per_m2)); }}>{t("lease.deal.scheduleClear")}</Button>
            </div>
          )}
        </div>
      )}
      {hasRegister && (
        <div>
          <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold text-muted">{t("lease.deal.parking")}</span>{editable && <Button size="sm" variant="text" className="!min-h-0 h-6 px-2 text-xs" onClick={resetSpots}>{t("lease.deal.parkingReset")}</Button>}</div>
          <div className="flex flex-wrap gap-1">
            {spots.map((sp) => {
              const on = mySpots.has(sp.id);
              const label = `${sp.number}${sp.zone ? ` · ${sp.zone}` : ""}`;
              const cls = cx("pill select-none", on && "primary", sp.out_of_service && "error", editable && !sp.out_of_service && "cursor-pointer");
              return editable ? <button key={sp.id} type="button" className={cls} aria-pressed={on} disabled={sp.out_of_service} title={sp.out_of_service ? t("lease.deal.parkingOut") : undefined} onClick={() => toggleSpot(sp.id)}>{label}</button>
                : on ? <span key={sp.id} className={cls}>{label}</span> : null;
            })}
            {!editable && mySpots.size === 0 && <span className="text-sm text-muted">—</span>}
          </div>
        </div>
      )}
    </li>
  );
}

function toDraft(schedule: LeaseScheduleStep[] | null, price: number): { until: string; price: string }[] {
  if (schedule && schedule.length > 1) return schedule.map((st) => ({ until: st.until_month == null ? "" : String(st.until_month), price: String(st.price) }));
  return [{ until: "12", price: String(price) }, { until: "", price: String(price) }];
}

// ---------------------------------------------------------------- Esindajad ----------------------------------------

/** „Poolte esindajad = tabel” (demo v699): two small tables; the landlord's side is ours to edit until signing, the tenant's side only while drafting. */
export function RepsCard({ lease, run, editable }: { lease: LeaseDraft; run: Run; editable: boolean }) {
  const update = useUpdateLeaseTerms(lease.id);
  const reps = lease.deal.representatives;
  const [edit, setEdit] = useState<"landlord" | "tenant" | null>(null);
  const [rows, setRows] = useState<LeaseRepresentative[]>([]);
  const start = (side: "landlord" | "tenant") => { setEdit(side); setRows(reps[side].map((r) => ({ ...r }))); };
  const save = async () => { if (!edit) return; const body: LeaseRepresentatives = { ...reps, [edit]: rows }; const r = await run(update.mutateAsync({ representatives: body, expected_version: lease.version }), t("lease.reps.saved")); if (r) setEdit(null); };
  const employment = isEmployment(lease);
  const table = (side: "landlord" | "tenant") => {
    const can = editable && (side === "landlord" || lease.status === "draft");
    const list = edit === side ? rows : reps[side];
    const label = employment ? (side === "landlord" ? t("lease.employment.employer") : t("lease.employment.employee")) : t(`lease.reps.${side}`);
    return (
      <div>
        <div className="flex items-center gap-2 mb-1"><span className="text-xs font-semibold text-muted">{label}</span>{can && edit !== side && <Button size="sm" variant="text" className="!min-h-0 h-6 px-2 text-xs" onClick={() => start(side)}>{t("lease.reps.edit")}</Button>}</div>
        <table className="w-full text-xs">
          <thead><tr className="text-muted text-left"><th className="font-medium pr-2 py-1">{t("lease.reps.role")}</th><th className="font-medium pr-2 py-1">{t("lease.reps.name")}</th><th className="font-medium pr-2 py-1">{t("lease.reps.phone")}</th><th className="font-medium py-1">{t("lease.reps.email")}</th></tr></thead>
          <tbody>
            {list.map((r, i) => (
              <tr key={i} className="align-top">
                <td className="pr-2 py-1">{r.role}</td>
                {edit === side ? (<>
                  <td className="pr-2 py-1"><input className="fld fld-sm" value={r.name} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)))} aria-label={t("lease.reps.name")} /></td>
                  <td className="pr-2 py-1"><input className="fld fld-sm" value={r.phone} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, phone: e.target.value } : y)))} aria-label={t("lease.reps.phone")} /></td>
                  <td className="py-1"><input className="fld fld-sm" type="email" value={r.email} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, email: e.target.value } : y)))} aria-label={t("lease.reps.email")} /></td>
                </>) : (<>
                  <td className="pr-2 py-1 font-medium">{r.name || t("lease.reps.empty")}</td>
                  <td className="pr-2 py-1">{r.phone || t("lease.reps.empty")}</td>
                  <td className="py-1 break-all">{r.email || t("lease.reps.empty")}</td>
                </>)}
              </tr>
            ))}
          </tbody>
        </table>
        {edit === side && <div className="flex gap-2 justify-end mt-2"><Button size="sm" onClick={() => setEdit(null)}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={update.isPending} onClick={save}>{t("common.save")}</Button></div>}
      </div>
    );
  };
  return (
    <Card>
      <CardHeader title={t("lease.reps.title")} />
      <CardBody className="grid gap-4">{table("landlord")}{table("tenant")}</CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- Üürnik (klient) ------------------------------------

export function ClientCard({ lease, neg, run }: { lease: LeaseDraft; neg: LeaseNegotiation; run: Run }) {
  const update = useUpdateLeaseContact(lease.id);
  const toast = useToast();
  const [c, setC] = useState(lease.contact);
  useEffect(() => setC(lease.contact), [lease.contact]);
  const dirty = c.name !== lease.contact.name || c.email !== lease.contact.email || c.phone !== lease.contact.phone;
  const editable = lease.status === "draft";
  const copy = async () => { if (!neg.link) return; try { await navigator.clipboard.writeText(neg.link.url); toast.success(t("lease.client.linkCopied")); } catch { toast.error(t("common.error")); } };
  const employment = isEmployment(lease);
  return (
    <Card>
      <CardHeader title={employment ? t("lease.employment.employee") : t("lease.client.title")} />
      <CardBody className="grid gap-3">
        <div className="text-sm">
          {lease.party ? <Link href={`/app/portfell/osapool/${lease.party.id}`} className="text-primary font-semibold">{lease.party.name}</Link> : "—"}
          {lease.party?.registry_code && <span className="text-muted"> · {lease.party.registry_code}</span>}
          {lease.quote_id && <Link href={`/app/portfell/pakkumine/${lease.quote_id}`} className="text-muted text-xs ml-2">{t("lease.client.fromQuote")} →</Link>}
        </div>
        {editable ? (
          <div>
            <Input label={t("lease.client.contactName")} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Input label={t("lease.client.email")} type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
              <Input label={t("lease.client.phone")} value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
            </div>
            {dirty && <div className="flex justify-end gap-2 -mt-2"><Button size="sm" onClick={() => setC(lease.contact)}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={update.isPending} onClick={() => run(update.mutateAsync(c), t("lease.client.saved"))}>{t("common.save")}</Button></div>}
          </div>
        ) : (
          <dl className="kv text-sm">
            <dt>{t("lease.client.contactName")}</dt><dd>{lease.contact.name || "—"}</dd>
            <dt>{t("lease.client.email")}</dt><dd>{lease.contact.email ? <a className="text-primary" href={`mailto:${lease.contact.email}`}>{lease.contact.email}</a> : "—"}</dd>
            <dt>{t("lease.client.phone")}</dt><dd>{lease.contact.phone || "—"}</dd>
          </dl>
        )}
        {neg.link && (
          <div className="rounded-control p-3 grid gap-2 text-sm" style={{ background: "var(--color-surface-subtle)" }}>
            <div className="flex items-center gap-2"><IconLink width={14} height={14} className="text-muted" /><span>{t("lease.client.link", { date: fmtDate(neg.link.expires_at) })}</span></div>
            <div className="text-xs text-muted">{neg.link.opened_at ? t("lease.client.opened", { at: fmtDateTime(neg.link.opened_at) }) : t("lease.client.notOpened")}</div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={copy}>{t("lease.client.copyLink")}</Button>
              <a href={neg.link.url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm"><IconExternal width={14} height={14} />{employment ? t("lease.employment.viewAsEmployee") : t("lease.client.viewAsTenant")}</a>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- Lisa 3 --------------------------------------------

const MAIN_KEYS = ["rent", "parking", "handover", "purpose", "deposit_months", "months", "term_notes", "indexation"];

export function SpecialCard({ lease, run, editable, prefill, onPrefillDone }: { lease: LeaseDraft; run: Run; editable: boolean; prefill: { clauseId: string; number: string; container: string } | null; onPrefillDone: () => void }) {
  const add = useAddSpecial(lease.id);
  const del = useRemoveSpecial(lease.id);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [over, setOver] = useState("");
  const [label, setLabel] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  useEffect(() => {
    if (!prefill) return;
    setAdding(true);
    setText(t("lease.pane.specialPrefix", { container: prefill.container === "general" ? t("lease.pane.specialGeneral") : t("lease.pane.specialMain"), number: prefill.number }));
    setOver(prefill.container === "general" ? `general:${prefill.clauseId}` : `main:${lease.clauses.find((c) => c.id === prefill.clauseId)?.fact_key ?? ""}`);
    setLabel("");
    onPrefillDone();
  }, [prefill, lease.clauses, onPrefillDone]);
  const specials = lease.clauses.filter((c) => c.container === "annex:3");
  const byId = new Map(lease.clauses.map((c) => [c.id, c]));
  const reset = () => { setAdding(false); setText(""); setOver(""); setLabel(""); };
  const submit = async () => { const r = await run(add.mutateAsync({ text: text.trim(), overrides: over || null, overrides_label: label.trim() || null, status: "accepted" }), t("lease.special.added")); if (r) reset(); };
  const tone = (s: string | null): Tone => (s === "accepted" ? "success" : s === "proposed" ? "warning" : "neutral");
  return (
    <Card>
      <div id="lease-special" className="scroll-mt-20" />
      <CardHeader title={t("lease.special.title")} actions={editable && !adding && <Button size="sm" variant="text" onClick={() => setAdding(true)}>{t("lease.special.add")}</Button>} />
      <CardBody>
        {specials.length === 0 && !adding ? <p className="text-sm text-muted">{t("lease.special.none")}</p> : (
          <ol className="grid gap-3 text-sm">
            {specials.map((c) => {
              const target = c.overrides_clause_id ? byId.get(c.overrides_clause_id) : null;
              const overLabel = target ? t("lease.pane.clause", { number: target.number }) : c.overrides_label;
              return (
                <li key={c.id} className="flex gap-2">
                  <span className="text-muted font-mono text-xs pt-0.5 w-6 flex-none">{c.number}</span>
                  <div className="flex-1 min-w-0">
                    <p className="whitespace-pre-wrap m-0">{c.text}</p>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-muted mt-1">
                      <Pill tone={tone(c.status)}>{tEnum("lease.special.status", c.status)}</Pill>
                      {overLabel && <span>{t("lease.special.overrides", { label: overLabel })}</span>}
                      {c.origin_note && <span>{t("lease.special.origin", { note: c.origin_note })}</span>}
                    </div>
                  </div>
                  {editable && c.status !== "proposed" && <button type="button" className="icon-btn !w-8 !h-8 text-error flex-none" aria-label={t("common.delete")} onClick={() => setConfirm(c.id)}><IconTrash width={14} height={14} /></button>}
                </li>
              );
            })}
          </ol>
        )}
        {adding && (
          <div className="mt-3 grid gap-2">
            <textarea className="fld" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("lease.special.placeholder")} aria-label={t("lease.special.add")} autoFocus />
            <div className="grid gap-x-3 sm:grid-cols-2">
              <div className="field">
                <label className="field-label">{t("lease.special.overridesPick")}</label>
                <select className="fld" value={over} onChange={(e) => setOver(e.target.value)} aria-label={t("lease.special.overridesPick")}>
                  <option value="">{t("lease.special.overridesNone")}</option>
                  {MAIN_KEYS.map((k) => { const cl = lease.clauses.find((c) => c.container === "main" && c.fact_key === k); return cl ? <option key={k} value={`main:${k}`}>{t("lease.pane.clause", { number: cl.number })} · {cl.heading}</option> : null; })}
                  {over.startsWith("general:") && <option value={over}>{t("lease.pane.clause", { number: byId.get(over.slice(8))?.number ?? "" })} · {byId.get(over.slice(8))?.heading ?? ""}</option>}
                </select>
              </div>
              <Input label={t("lease.special.overridesLabel")} value={label} onChange={(e) => setLabel(e.target.value)} />
            </div>
            <div className="flex gap-2 justify-end"><Button size="sm" onClick={reset}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={add.isPending} disabled={!text.trim()} onClick={submit}>{t("common.add")}</Button></div>
          </div>
        )}
      </CardBody>
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} busy={del.isPending} title={t("common.delete")} body={t("lease.special.removeConfirm")} onConfirm={async () => { if (!confirm) return; await run(del.mutateAsync(confirm), t("lease.special.removed")); setConfirm(null); }} />
    </Card>
  );
}

// ---------------------------------------------------------------- Vestlus -------------------------------------------

export function ChatCard({ lease, run }: { lease: LeaseDraft; run: Run }) {
  const chat = useLeaseChat(lease.id);
  const post = usePostLeaseChat(lease.id);
  const markRead = useMarkLeaseChatRead(lease.id);
  const marked = useRef(false);
  const [text, setText] = useState("");
  const items = useMemo(() => chat.data ?? [], [chat.data]);
  useEffect(() => { if (!marked.current && items.some((m) => m.author_type === "client")) { marked.current = true; markRead.mutate(); } }, [items, markRead]);
  const send = async () => { const r = await run(post.mutateAsync(text.trim()), t("lease.chat.sent")); if (r) setText(""); };
  return (
    <Card>
      <CardHeader title={t("lease.chat.title")} />
      <CardBody className="grid gap-3">
        {items.length === 0 ? <p className="text-sm text-muted">{t("lease.chat.none")}</p> : <ChatThread items={items} />}
        {lease.status !== "cancelled" && (
          <div>
            <textarea className="fld" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={isEmployment(lease) ? t("lease.employment.chatPlaceholder") : t("lease.chat.placeholder")} aria-label={t("lease.chat.title")} />
            <div className="flex justify-end mt-2"><Button size="sm" variant="primary" busy={post.isPending} disabled={!text.trim()} onClick={send}>{t("lease.chat.send")}</Button></div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
function ChatThread({ items }: { items: LeaseChatMessage[] }) {
  return (
    <ol className="grid gap-2">
      {items.map((m) => {
        const mine = m.author_type === "operator";
        return (
          <li key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
            <div className="max-w-[88%] rounded-control px-3 py-2 text-sm" style={{ background: mine ? "var(--color-primary-subtle)" : "var(--color-surface-subtle)" }}>
              <div className="text-xs text-muted flex items-center gap-2 flex-wrap mb-0.5"><span className="font-medium">{m.author_name ?? (mine ? t("lease.pane.us") : t("lease.pane.tenant"))}</span><span>{fmtDateTime(m.created_at)}</span></div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------------------------------------------------------------- Kirjad + Voorud -----------------------------------

export function LettersRoundsCard({ neg }: { neg: LeaseNegotiation }) {
  return (
    <Card>
      <CardHeader title={t("lease.letters.title")} />
      <CardBody className="grid gap-4">
        {neg.letters.length === 0 ? <p className="text-sm text-muted m-0">{t("lease.letters.none")}</p> : (
          <ul className="grid gap-2 text-sm">
            {[...neg.letters].reverse().map((l) => (
              <li key={l.id} className="flex items-center gap-2 flex-wrap">
                <span className="min-w-0 flex-1"><span className="font-medium">{tEnum("lease.letters.kinds", l.kind) === l.kind ? l.title : tEnum("lease.letters.kinds", l.kind)}</span><span className="block text-xs text-muted truncate">{l.to ?? "—"} · {fmtDateTime(l.created_at)}</span></span>
                <Pill tone={DELIVERY_TONE[l.status] ?? "neutral"} title={l.error ?? undefined}>{tEnum("quotes.client.delivery", l.status)}</Pill>
              </li>
            ))}
          </ul>
        )}
        <div>
          <div className="text-xs font-semibold text-muted mb-1">{t("lease.rounds.title")}</div>
          {neg.rounds.length === 0 ? <p className="text-sm text-muted m-0">{t("lease.rounds.none")}</p> : (
            <ul className="grid gap-1 text-sm">
              {[...neg.rounds].reverse().map((r) => (
                <li key={r.nr} className="flex items-center gap-2 flex-wrap">
                  <span>{t("lease.rounds.item", { n: r.nr, side: r.side === "operator" ? t("lease.rounds.operator") : t("lease.rounds.client"), date: fmtDate(r.created_at) })}</span>
                  {r.version_no != null && <Pill tone="info">{t("lease.rounds.version", { n: r.version_no })}</Pill>}
                  {r.thread_ids.length > 0 && <span className="text-xs text-muted">{t("lease.rounds.threads", { n: r.thread_ids.length })}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
