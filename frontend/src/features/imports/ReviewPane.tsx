"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { cx, fmtDate, fmtDateTime, fmtFixed, initials } from "@/lib/format";
import { useAssets, useParking, useParties } from "@/lib/queries/portfolio";
import { SpotChip } from "@/features/assets/ParkingRegister";
import { IconAlert, IconArrowRight, IconCal, IconCheck, IconEdit, IconInfo, IconShield, IconTrash, IconX } from "@/components/ui/Icons";
import type { Asset, DeskRow, ImportJobDetail, ImportSourceFile, Proposal, SpaceAttributes } from "@/types/api";
import { ExistingPicker, RegistryRow, contractArea, spaceKey, spaceKeys, dropPartyRow, isOurs, pickableSpace, roleOptions, setPartyRow, spaceArea, suggestSpace, type LinkState, type PartyRow } from "./LinkSection";
import { HEAD_DATES, crossChecks, fmtValue, headDateLabel, headDateUnsure, kdLabel, needlesFor, toIso, sameSpots, type ParkingCheck, type Spot } from "./reviewModel";
import { UNCERTAIN } from "./reviewState";

const CATEGORIES = ["lease", "maintenance", "management", "insurance", "security", "employment", "other"];

/** What every step needs from the review: the draft, the checks, the one active place and the viewer. */
export interface ReviewCtl {
  job: ImportJobDetail; draft: Proposal; original: Proposal;
  edit: (p: Proposal, check?: string) => void;
  checked: Set<string>; check: (key: string, v: boolean) => void;
  active: string | null; activate: (key: string) => void;
  editing: string | null; setEditing: (key: string | null) => void;
  show: (page: number | null | undefined, needles: string[], file?: number) => void;
  /** Drop an extracted value (a parameter or a calendar date) — the operator decides it is wrong or not material. */
  remove: (kind: "parameter" | "key_date", i: number) => void;
}

// ---------------------------------------------------------------- building blocks ---------------------------------

export function Step({ nr, title, ok, extra, children }: { nr: number; title: string; ok: boolean; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className={cx("ir-q", ok ? "ok" : "kord")}>
      <div className="ir-q-pea"><span className="ir-q-nr">{ok ? <IconCheck /> : nr}</span><span className="ir-q-t">{title}</span>{extra ?? <em>{ok ? t("imports.ir.ok") : t("imports.ir.look")}</em>}</div>
      {children}
    </section>
  );
}

/** Inline edit field: Enter saves, Esc cancels (demo `ir-kk-in`). */
function EditField({ initial, placeholder, label, type, options, onSave, onCancel }: { initial: string; placeholder?: string; label: string; type?: "text" | "select"; options?: { value: string; label: string }[]; onSave: (v: string) => string | null; onCancel: () => void }) {
  const [v, setV] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement & HTMLSelectElement>(null);
  useEffect(() => { ref.current?.focus(); if (ref.current && "select" in ref.current && type !== "select") ref.current.select(); }, [type]);
  const save = () => { const e = onSave(v); if (e) setErr(e); };
  return (
    <div className="ir-kk-in" onClick={(e) => e.stopPropagation()}>
      {type === "select"
        ? <select ref={ref} className="ir-sel" aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") onCancel(); }}>{options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
        : <input ref={ref} type="text" aria-label={label} placeholder={placeholder} value={v} onChange={(e) => { setV(e.target.value); setErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } if (e.key === "Escape") { e.preventDefault(); onCancel(); } }} />}
      {err && <div className="ir-kk-err">{err}</div>}
      <div className="ir-kk-teg">
        <button type="button" className="btn btn-primary btn-sm" onClick={save}>{t("common.save")}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>{t("common.cancel")}</button>
      </div>
    </div>
  );
}

/** Current raw value of an editable field and how to write it back. Keys: c:<field>, parameter:i, key_date:i, party:i. */
function fieldOf(draft: Proposal, key: string): { raw: string; placeholder: string; type?: "select"; apply: (raw: string) => Proposal | string } {
  const [kind, rest] = key.split(":");
  const i = Number(rest);
  if (kind === "c" || kind === "contract") {
    const f = rest as keyof Proposal["contract"];
    const isDate = f === "signed_at" || f === "start_date" || f === "end_date";
    if (f === "category") return { raw: draft.contract.category, placeholder: "", type: "select", apply: (r) => ({ ...draft, contract: { ...draft.contract, category: r as Proposal["contract"]["category"] } }) };
    if (isDate) return { raw: draft.contract[f] ? fmtDate(draft.contract[f] as string) : "", placeholder: "pp.kk.aaaa", apply: (r) => { if (!r.trim()) return { ...draft, contract: { ...draft.contract, [f]: null } }; const iso = toIso(r); return iso ? { ...draft, contract: { ...draft.contract, [f]: iso } } : t("imports.ir.badDate"); } };
    return { raw: String(draft.contract[f] ?? ""), placeholder: "", apply: (r) => ({ ...draft, contract: { ...draft.contract, [f]: r.trim() || (f === "title" || f === "counterparty_name" || f === "summary" ? "" : null) } }) };
  }
  if (kind === "parameter") {
    const p = draft.parameters[i];
    return { raw: p.value == null ? "" : /^-?\d+\.\d+$/.test(String(p.value)) ? String(p.value).replace(".", ",") : String(p.value), placeholder: p.unit ?? "", apply: (r) => {
      const v = /^-?[\d\s]+(,\d+)?$/.test(r.trim()) ? r.trim().replace(/\s/g, "").replace(",", ".") : r.trim();
      return { ...draft, parameters: draft.parameters.map((x, j) => (j === i ? { ...x, value: v } : x)) };
    } };
  }
  if (kind === "key_date") {
    const k = draft.key_dates[i];
    return { raw: fmtDate(k.date), placeholder: "pp.kk.aaaa", apply: (r) => { const iso = toIso(r); return iso ? { ...draft, key_dates: draft.key_dates.map((x, j) => (j === i ? { ...x, date: iso } : x)) } : t("imports.ir.badDate"); } };
  }
  const p = draft.parties[i];
  return { raw: [p.name, p.registry_code].filter(Boolean).join(" · "), placeholder: t("imports.ir.partyPlaceholder"), apply: (r) => {
    const [name, reg] = r.split("·").map((x) => x.trim());
    return name ? { ...draft, parties: draft.parties.map((x, j) => (j === i ? { ...x, name, registry_code: reg || null } : x)) } : t("imports.ir.nameRequired");
  } };
}

function Editor({ c, k, label }: { c: ReviewCtl; k: string; label: string }) {
  const f = fieldOf(c.draft, k);
  return <EditField initial={f.raw} placeholder={f.placeholder} label={label} type={f.type} options={f.type === "select" ? CATEGORIES.map((v) => ({ value: v, label: tEnum("contract.category", v) })) : undefined}
    onCancel={() => c.setEditing(null)}
    onSave={(raw) => { const r = f.apply(raw); if (typeof r === "string") return r; c.edit(r, k.startsWith("c:") ? undefined : k); c.setEditing(null); return null; }} />;
}

/** One place to look at (demo `irKaart`): reason in one line · Õige / Paranda · page. */
function SpotCard({ c, s }: { c: ReviewCtl; s: Spot }) {
  const on = c.active === s.key, editing = c.editing === s.key;
  return (
    <div className={cx("ir-kk", on && "akt")} data-ak={s.key} tabIndex={0} onClick={() => !on && c.activate(s.key)}>
      <div className="ir-kk-pea"><span className="ir-kk-k">{s.label}</span><span className="ir-kk-t">{t("imports.ir.look")}</span></div>
      {editing ? <Editor c={c} k={s.key} label={s.label} /> : <div className="ir-kk-v">{s.value}</div>}
      <div className="ir-kk-miks">{s.note}</div>
      {on && !editing && (
        <div className="ir-kk-teg" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => c.check(s.key, true)}><IconCheck width={14} height={14} />{t("imports.ir.right")}</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => c.setEditing(s.key)}><IconEdit width={14} height={14} />{t("imports.ir.fix")}</button>
          {(s.kind === "parameter" || s.kind === "key_date") && <button type="button" className="btn btn-ghost btn-sm" onClick={() => c.remove(s.kind as "parameter" | "key_date", s.idx)}><IconTrash width={14} height={14} />{t("imports.ir.remove")}</button>}
          {s.page ? <button type="button" className="ir-kk-lk mono" onClick={() => c.show(s.page, s.needles)}>{t("imports.pageAnchor", { n: s.page })}</button> : null}
        </div>
      )}
    </div>
  );
}

/** An uncertain value the operator already settled (demo `irTehtudRida`). */
function DoneRow({ c, k, label, value, fixed }: { c: ReviewCtl; k: string; label: string; value: string; fixed: boolean }) {
  return (
    <div className="ir-tr"><span className="ir-tr-ic"><IconCheck /></span><span className="ir-tr-t"><span className="ir-tr-k">{label}</span><b>{value}</b></span>
      <em>{fixed ? t("imports.ir.fixed") : t("imports.ir.rightDone")}</em>
      <button type="button" className="steplink" onClick={() => c.check(k, false)}>{t("imports.ir.change")}</button></div>
  );
}

/** A sure value: click shows it in the original; the pencil edits it in place. */
function SureRow({ c, k, label, value, page, needles }: { c: ReviewCtl; k: string; label: string; value: string; page?: number | null; needles: string[] }) {
  const [kind, idx] = k.split(":");
  const removable = kind === "parameter" || kind === "key_date";
  if (c.editing === k) return <div className="ir-kr-ed"><span>{label}</span><Editor c={c} k={k} label={label} /></div>;
  return (
    <div className="ir-kr-w">
      <button type="button" className={cx("ir-kr", c.active === `show:${k}` && "ir-on")} onClick={() => { c.activate(`show:${k}`); c.show(page, needles); }}><span>{label}</span><b>{value}</b></button>
      <span className="ir-kr-ed-w">
        <button type="button" className="ir-kr-ed-b" aria-label={`${t("imports.ir.fix")}: ${label}`} title={t("imports.ir.fix")} onClick={() => c.setEditing(k)}><IconEdit width={13} height={13} /></button>
        {removable && <button type="button" className="ir-kr-ed-b" aria-label={`${t("imports.ir.remove")}: ${label}`} title={t("imports.ir.remove")} onClick={() => c.remove(kind as "parameter" | "key_date", Number(idx))}><IconTrash width={13} height={13} /></button>}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------- the header ------------------------------------------

export function PaneHead({ overline, title, sub, mono }: { overline: string; title: string; sub?: string; mono?: string }) {
  return (
    <div className="ir-pea">
      <div className="overline">{overline}</div>
      <h2 className="ir-h">{title}</h2>
      {(sub || mono) && <div className="ir-sub">{sub}{mono && <span className="ir-sub-t mono">{mono}</span>}</div>}
    </div>
  );
}

/** Digital signatures from the container (demo `irUsaldus`): who · when — one signature = the other party signed apart. */
export function Signatures({ job }: { job: ImportJobDetail }) {
  const A = job.source_document?.container_signatures ?? [];
  if (!A.length) return null;
  const one = A.length === 1;
  const fmt = job.source_document?.format === "asice" ? (/\.bdoc$/i.test(job.source_document.filename) ? "BDOC" : "ASiC-E") : "";
  return (
    <div className={cx("ir-usk", one && "kord")}>
      <div className="ir-usk-pea"><IconShield /><b>{t("imports.ir.signed")}</b><span>{[fmt, A.length === 1 ? t("imports.ir.sigOne") : t("imports.ir.sigMany", { n: A.length })].filter(Boolean).join(" · ")}</span></div>
      {A.map((a, i) => {
        const who = a.name ?? a.signer ?? "—", when = a.signing_time ?? a.signed_at ?? a.time;
        return (
          <div key={i} className="ir-usk-r"><span className="ir-av">{initials(who)}</span>
            <span className="ir-usk-kes"><b>{who}</b><small>{[t("imports.ir.signer"), when ? fmtDateTime(when) : null].filter(Boolean).join(" · ")}</small></span>
            <i className={a.valid === false ? "kord" : "ok"}>{a.valid === false ? <IconAlert /> : <IconCheck />}</i></div>
        );
      })}
      <div className="ir-usk-s">{one ? t("imports.ir.sigMissing") + " " : ""}{t("imports.ir.sigNote")}</div>
    </div>
  );
}

// ---------------------------------------------------------------- step 1 · parties ----------------------------------

export function PartiesStep({ c, link, onLink, spots }: { c: ReviewCtl; link: LinkState; onLink: (s: LinkState) => void; spots: Spot[] }) {
  const d = c.draft;
  const rows = link.parties;
  const prim = rows.find((r) => r.include && r.is_primary);
  const primSrc = prim?.index != null ? d.parties[prim.index] : null;
  const name = primSrc?.name || d.contract.counterparty_name || "—";
  const reg = primSrc?.registry_code ?? null;
  const known = useParties({ q: reg && /^\d{8}$/.test(reg) ? reg : undefined });
  const existing = reg ? (known.data ?? []).find((p) => p.registry_code === reg) : undefined;
  const [open, setOpen] = useState<number | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const mine = spots.filter((s) => s.step === 1);
  const settled = d.parties.map((p, i) => ({ p, i })).filter(({ p, i }) => p.confidence < UNCERTAIN && c.checked.has(`party:${i}`));
  const valid = rows.some((r) => r.include) && rows.filter((r) => r.include && r.is_primary).length === 1 && rows.filter((r) => r.include).every((r) => (r.mode === "new" ? r.index != null : !!r.party_id));
  const set = (i: number, patch: Partial<PartyRow>) => onLink({ ...link, parties: setPartyRow(rows, i, patch) });
  return (
    <Step nr={1} title={t("imports.ir.q1")} ok={!mine.length && valid}>
      <button type="button" className={cx("ir-q-v", c.active === "show:who" && "ir-on")} onClick={() => { c.activate("show:who"); c.show(primSrc?.page, needlesFor(reg, name)); }}>{tEnum("contract.category", d.contract.category)} · {name}</button>
      <div className="ir-q-s">{existing ? t("imports.ir.partyKnown", { code: existing.registry_code ?? "" }) : reg ? t("imports.ir.partyNew", { code: reg }) : t("imports.ir.partyNoCode")}</div>
      {reg && <div className="ir-q-s"><RegistryRow code={reg} contractName={name} /></div>}
      {settled.map(({ p, i }) => <DoneRow key={i} c={c} k={`party:${i}`} label={tEnum("imports.partyRoles", p.role)} value={[p.name, p.registry_code].filter(Boolean).join(" · ")} fixed={(c.original.parties[i]?.name ?? "") !== p.name || (c.original.parties[i]?.registry_code ?? null) !== (p.registry_code ?? null)} />)}
      {mine.map((s) => <SpotCard key={s.key} c={c} s={s} />)}
      <div className="ir-pooled">
        {rows.map((r, i) => {
          const src = r.index != null ? d.parties[r.index] : null;
          const ours = r.index != null && isOurs(d, r.index);
          const nm = src?.name ?? (r.party_id ? names[r.party_id] : null);
          return (
            <div key={i} className={cx("ir-pool-w", !r.include && !ours && "off")}>
              <button type="button" className="ir-pool" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span className="imp-pool-r">{tEnum("imports.partyRoles", r.include ? r.role : src?.role ?? r.role)}{ours ? ` · ${t("imports.ir.ours")}` : ""}</span>
                <b>{nm || t("imports.ir.pickParty")}</b>
                {src?.registry_code && <span className="mono muted">{src.registry_code}</span>}
                {r.include && r.is_primary && <span className="imp-pool-p">{t("imports.ir.primary")}</span>}
                {!r.include && !ours && <span className="imp-pool-x">{t("imports.ir.notAdded")}</span>}
              </button>
              {open === i && (
                <div className="ir-pool-ed">
                  <label className="ir-pool-c"><input type="checkbox" checked={r.include} onChange={(e) => set(i, { include: e.target.checked })} />{ours ? t("imports.ir.includeOurs") : t("imports.includeParty")}</label>
                  {r.include && <>
                    <select className="ir-sel" aria-label={t("imports.role")} value={r.role} onChange={(e) => set(i, { role: e.target.value })}>{roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
                    <label className="ir-pool-c"><input type="radio" name="primaryParty" checked={r.is_primary} onChange={() => set(i, { is_primary: true })} />{t("imports.ir.makePrimary")}</label>
                    {src && (
                      <div className="ir-seg" role="radiogroup" aria-label={t("imports.ir.partySource")}>
                        <button type="button" className={cx("chip", r.mode === "new" && "on")} aria-pressed={r.mode === "new"} onClick={() => set(i, { mode: "new" })}>{t("imports.createNew")}</button>
                        <button type="button" className={cx("chip", r.mode === "existing" && "on")} aria-pressed={r.mode === "existing"} onClick={() => set(i, { mode: "existing" })}>{t("imports.pickExisting")}</button>
                      </div>
                    )}
                    {r.mode === "existing" && <ExistingPicker value={r.party_id} onChange={(id, n) => { setNames((m) => ({ ...m, [id]: n })); set(i, { party_id: id }); }} />}
                  </>}
                  {!src && <button type="button" className="steplink" onClick={() => { onLink({ ...link, parties: dropPartyRow(rows, i) }); setOpen(null); }}>{t("common.remove")}</button>}
                </div>
              )}
            </div>
          );
        })}
        <button type="button" className="steplink ir-pool-add" onClick={() => { onLink({ ...link, parties: [...rows, { index: null, party_id: "", role: "other", is_primary: !rows.some((r) => r.include), include: true, mode: "existing" }] }); setOpen(rows.length); }}>{t("imports.ir.addParty")}</button>
        {!valid && <div className="ir-kk-err">{rows.some((r) => r.include && r.mode === "existing" && !r.party_id) ? t("imports.ir.pickPartyErr") : t("imports.onePrimary")}</div>}
      </div>
    </Step>
  );
}

// ---------------------------------------------------------------- step 2 · space --------------------------------------

export function SpaceStep({ c, link, onLink, properties, companies, spots, park: chk }: { c: ReviewCtl; link: LinkState; onLink: (s: LinkState) => void; properties: Asset[]; companies: { id: string; name: string }[]; spots: Spot[]; park: ParkingCheck | null }) {
  const [parkOpen, setParkOpen] = useState(false);
  const d = c.draft;
  const spaces = useAssets({ type_code: "space", parent_id: link.asset_id || undefined });
  const parking = useParking(link.asset_id || undefined);
  const [picking, setPicking] = useState(false);
  const area = useMemo(() => contractArea(d), [d]);
  const named = spaceKeys(d.asset_hint?.name);
  const isNamed = (s: Asset) => named.includes(spaceKey(s.name) ?? "");
  const list = (spaces.data ?? []).filter(pickableSpace);
  const picked = link.space_ids.map((id) => (spaces.data ?? []).find((s) => s.id === id)).filter((s): s is Asset => !!s);
  const suggestion = link.asset_id && !picked.length ? suggestSpace(spaces.data ?? [], area) : null;
  const property = properties.find((p) => p.id === link.asset_id);
  const sum = picked.reduce((a, s) => a + spaceArea(s), 0);
  const lease = d.contract.category === "lease";
  const missing = spots.some((s) => s.kind === "space");
  const setPark = (nums: string[] | null) => { onLink({ ...link, parking_numbers: nums }); setParkOpen(false); };
  const ok = !missing && (!!picked.length || (link.allocation_kind === "coverage" && !!link.asset_id) || !properties.length);
  const showPicker = picking || (!picked.length && !suggestion);
  const same = (s: Asset) => area != null && Math.abs(spaceArea(s) - area) <= 0.15;
  // the spaces the contract names first, then the same area, then free ones; all of them, filterable
  const [q, setQ] = useState("");
  const sorted = [...list].sort((a, b) => Number(isNamed(b)) - Number(isNamed(a)) || Number(same(b)) - Number(same(a)) || Number(b.status === "vaba") - Number(a.status === "vaba") || a.name.localeCompare(b.name, "et", { numeric: true }))
    .filter((s) => !q.trim() || `${s.name} ${(s.attributes as Partial<SpaceAttributes>).type ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));
  // one click picks one space and closes the list; when the contract names several, the list stays open to pick them all
  const toggle = (id: string) => {
    const multi = picking || named.length > 1;
    if (multi && !picking) setPicking(true);
    onLink({ ...link, space_ids: link.space_ids.includes(id) ? link.space_ids.filter((x) => x !== id) : lease && !multi ? [id] : [...link.space_ids, id], allocation_kind: "exclusive", parking_numbers: null });
  };
  const spotsAll = parking.data ?? [];
  const spaceSpots = link.space_ids.length ? spotsAll.filter((s) => s.space_id && link.space_ids.includes(s.space_id)).map((s) => s.number) : [];
  const park = link.parking_numbers ?? spaceSpots;
  return (
    <Step nr={2} title={t("imports.ir.q2")} ok={ok && !showPicker} extra={!ok ? <em>{picked.length ? t("imports.ir.look") : t("imports.ir.pickSpace")}</em> : undefined}>
      {picked.length > 0 && (
        <>
          <button type="button" className={cx("ir-q-v", c.active === "show:space" && "ir-on")} onClick={() => { c.activate("show:space"); c.show(null, [d.asset_hint?.name ?? "", area != null ? fmtFixed(area, 1) : ""].filter(Boolean)); }}>
            {picked.map((s) => s.name).join(" + ")} · {property?.name ?? ""} · {fmtFixed(sum, 1)} m²</button>
          <div className="ir-q-s">
            {area != null && Math.abs(area - sum) <= 0.15 ? t("imports.ir.areaMatches", { area: fmtFixed(area, 1) }) : area != null ? <span className="ir-warn">{t("imports.ir.areaDiffers", { a: fmtFixed(area, 1), b: fmtFixed(sum, 1) })}</span> : t("imports.ir.picked")}
            {" · "}<button type="button" className="steplink" onClick={() => setPicking(!picking)}>{picking ? t("imports.ir.close") : t("imports.ir.change")}</button>
          </div>
        </>
      )}
      {!picked.length && link.allocation_kind === "coverage" && property && <div className="ir-q-v">{property.name}</div>}
      {suggestion && !picked.length && (
        <div className="ir-kk akt" data-ak="space">
          <div className="ir-kk-pea"><span className="ir-kk-k">{t("imports.ir.space")}</span><span className="ir-kk-t">{t("imports.ir.look")}</span></div>
          <div className="ir-kk-v">{t("imports.spaceSuggest", { name: suggestion.name })}</div>
          <div className="ir-kk-miks">{t("imports.spaceSuggestWhy", { area: fmtFixed(area ?? 0, 1), name: suggestion.name })}</div>
          <div className="ir-kk-teg">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onLink({ ...link, space_ids: [suggestion.id], allocation_kind: "exclusive", parking_numbers: null })}><IconCheck width={14} height={14} />{t("imports.ir.yesSpace", { name: suggestion.name })}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicking(true)}>{t("imports.ir.otherSpace")}</button>
          </div>
        </div>
      )}
      {showPicker && (
        <div className="ir-pv">
          {companies.length > 1 && (
            <select className="ir-sel" aria-label={t("imports.company")} value={link.company_id} onChange={(e) => onLink({ ...link, company_id: e.target.value })}>
              <option value="">{t("imports.company")}…</option>{companies.map((co) => <option key={co.id} value={co.id}>{co.name}</option>)}</select>
          )}
          {properties.length !== 1 || !link.asset_id ? (
            <select className="ir-sel" aria-label={t("imports.asset")} value={link.asset_id} onChange={(e) => onLink({ ...link, asset_id: e.target.value, space_ids: [], parking_numbers: null })}>
              <option value="">{t("imports.ir.pickBuilding")}</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          ) : null}
          {!lease && link.asset_id && (
            <div className="ir-seg">
              <button type="button" className={cx("chip", link.allocation_kind === "coverage" && "on")} onClick={() => onLink({ ...link, allocation_kind: "coverage", space_ids: [] })}>{t("imports.ir.wholeBuilding")}</button>
              <button type="button" className={cx("chip", link.allocation_kind === "exclusive" && "on")} onClick={() => onLink({ ...link, allocation_kind: "exclusive" })}>{t("imports.ir.someSpaces")}</button>
            </div>
          )}
          {link.asset_id && (lease || link.allocation_kind === "exclusive") && (
            <>
              <div className="ir-pv-s">{named.length > 1 ? t("imports.ir.pickSpacesHint", { n: named.length }) : area != null ? t("imports.ir.pickSpaceHintArea", { area: fmtFixed(area, 1) }) : t("imports.ir.pickSpaceHint")}</div>
              {list.length > 12 && <input className="fld fld-sm" type="search" aria-label={t("imports.ir.findSpace")} placeholder={t("imports.ir.findSpace")} value={q} onChange={(e) => setQ(e.target.value)} />}
              <div className="ir-pv-l">
                {sorted.map((s) => (
                  <button key={s.id} type="button" className={cx("ir-pv-r", (same(s) || isNamed(s)) && "sobib", link.space_ids.includes(s.id) && "on")} aria-pressed={link.space_ids.includes(s.id)} onClick={() => toggle(s.id)}>
                    <b>{s.name}</b><span>{[(s.attributes as Partial<SpaceAttributes>).type, `${fmtFixed(spaceArea(s), 1)} m²`].filter(Boolean).join(" · ")}</span>
                    <small>{isNamed(s) ? t("imports.ir.namedInContract") : same(s) ? t("imports.ir.sameArea") : tEnum("assets.status", s.status)}</small>
                  </button>
                ))}
                {!sorted.length && <div className="ir-pv-s">{spaces.isLoading ? t("common.loading") : t("imports.ir.noSpacesInBuilding")}</div>}
              </div>
            </>
          )}
          {!properties.length && <div className="ir-pv-s">{t("imports.ir.noBuildings")} <Link className="steplink" href="/app/portfell/objekt/uus">{t("imports.ir.addBuilding")}</Link></div>}
        </div>
      )}
      {chk && picked.length > 0 && (chk.differs || chk.problems.length > 0) && (() => {
        const usingContract = link.parking_numbers != null && chk.register.length > 0 && sameSpots(link.parking_numbers, chk.register);
        return (
          <div className="ir-pn">
            <div className="ir-pn-pea"><IconInfo /><b>{t("imports.ir.parkDiff")}</b>{chk.page ? <button type="button" className="ir-kk-lk mono" onClick={() => c.show(chk.page, chk.needles)}>{t("imports.pageAnchor", { n: chk.page })}</button> : null}</div>
            <div className="ir-pn-r"><span>{t("imports.ir.parkContractRow")}</span><b>{[chk.count != null ? `${chk.count} ${chk.count === 1 ? t("imports.ir.spotOne") : t("imports.ir.spotMany")}` : "", chk.named.length ? `nr ${chk.named.join(", ")}` : t("imports.ir.parkNoNumbers")].filter(Boolean).join(" · ")}</b></div>
            <div className="ir-pn-r"><span>{t("imports.ir.parkSpaceRow")}</span><b>{chk.spaceDefault.length ? `nr ${chk.spaceDefault.join(", ")}` : t("imports.ir.parkingNone")}</b></div>
            {chk.problems.map((x) => <div key={x} className="ir-pn-x">{x}</div>)}
            <div className="ir-kk-teg">
              {usingContract
                ? <><span className="ir-pn-on">{t("imports.ir.parkUsing")}</span><button type="button" className="steplink" onClick={() => setPark(null)}>{t("imports.ir.parkRestore")}</button></>
                : chk.register.length > 0 && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPark(chk.register)}>{t("imports.ir.parkUseContract", { list: chk.register.join(", ") })}</button>}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParkOpen(true)}>{t("imports.ir.parkPick")}</button>
            </div>
          </div>
        );
      })()}
      {picked.length > 0 && lease && spotsAll.length > 0 && (
        <details className="ir-voldik" open={parkOpen || undefined} onToggle={(e) => setParkOpen((e.target as HTMLDetailsElement).open)}>
          <summary><b>{t("imports.ir.parking", { n: park.length })}</b><span>{park.length ? park.join(", ") : t("imports.ir.parkingNone")}</span>
            {chk && !chk.differs && !chk.problems.length && <em className="ir-park-ok">{t("imports.ir.parkMatches")}</em>}</summary>
          <div className="ir-park">{spotsAll.map((s) => <SpotChip key={s.id} s={s} on={park.includes(s.number)} other={(!!s.contract || s.status === "üüritud") && !(s.space_id && link.space_ids.includes(s.space_id))} onClick={() => onLink({ ...link, parking_numbers: park.includes(s.number) ? park.filter((x) => x !== s.number) : [...park, s.number] })} title={s.space_id && !link.space_ids.includes(s.space_id) ? `${t("assets.parkingPickTaken")}: ${s.space_name}` : tEnum("assets.parkingReg.statuses", s.status)} />)}</div>
        </details>
      )}
    </Step>
  );
}

// ---------------------------------------------------------------- step 3 · values -------------------------------------

export function ValuesStep({ c, nr, spots, spaceArea: sa }: { c: ReviewCtl; nr: number; spots: Spot[]; spaceArea: number | null }) {
  const d = c.draft, o = c.original;
  const mine = spots.filter((s) => s.step === 3);
  const doneP = d.parameters.map((p, i) => ({ p, i })).filter(({ p, i }) => p.confidence < UNCERTAIN && c.checked.has(`parameter:${i}`));
  const doneK = d.key_dates.map((k, i) => ({ k, i })).filter(({ k, i }) => k.confidence < UNCERTAIN && c.checked.has(`key_date:${i}`));
  const doneD = HEAD_DATES.filter((f) => headDateUnsure(d, f) && c.checked.has(`contract:${f}`));
  const anyUnsure = d.parameters.some((p) => p.confidence < UNCERTAIN) || d.key_dates.some((k) => k.confidence < UNCERTAIN) || HEAD_DATES.some((f) => headDateUnsure(d, f));
  const datePage = (f: "start_date" | "end_date") => d.date_checks?.[f]?.page;
  const head: { k: string; l: string; v: string; needles: string[]; page?: number | null }[] = [
    { k: "c:category", l: t("common.category"), v: tEnum("contract.category", d.contract.category), needles: [] },
    { k: "c:title", l: t("portfolio.contracts.title"), v: d.contract.title || "—", needles: needlesFor(d.contract.title) },
    { k: "c:number", l: t("contract.number"), v: d.contract.number || "—", needles: needlesFor(d.contract.number) },
    { k: "c:signed_at", l: t("contract.signedAt"), v: d.contract.signed_at ? fmtDate(d.contract.signed_at) : "—", needles: needlesFor(d.contract.signed_at) },
    // start and end appear once: here when sure, as a card (then a done row) above when the reading was unsure
    ...HEAD_DATES.filter((f) => !headDateUnsure(d, f)).map((f) => ({ k: `c:${f}`, l: headDateLabel(f), v: d.contract[f] ? fmtDate(d.contract[f]) : "—", needles: needlesFor(d.contract[f]), page: datePage(f) })),
  ];
  const sureP = d.parameters.map((p, i) => ({ p, i })).filter(({ p }) => p.confidence >= UNCERTAIN);
  const sureK = d.key_dates.map((k, i) => ({ k, i })).filter(({ k }) => k.confidence >= UNCERTAIN);
  const total = head.length + sureP.length + sureK.length;
  const R = crossChecks(d, sa);
  return (
    <Step nr={nr} title={t("imports.ir.q3")} ok={!mine.length} extra={mine.length ? <span className="ir-q-arv">{mine.length}</span> : undefined}>
      {doneP.map(({ p, i }) => <DoneRow key={`p${i}`} c={c} k={`parameter:${i}`} label={p.label || p.key} value={fmtValue(p.value, p.unit)} fixed={String(o.parameters.find((x) => x.key === p.key && x.label === p.label)?.value ?? p.value ?? "") !== String(p.value ?? "")} />)}
      {doneD.map((f) => <DoneRow key={f} c={c} k={`contract:${f}`} label={headDateLabel(f)} value={d.contract[f] ? fmtDate(d.contract[f]) : "—"} fixed={(o.contract[f] ?? null) !== (d.contract[f] ?? null)} />)}
      {doneK.map(({ k, i }) => <DoneRow key={`k${i}`} c={c} k={`key_date:${i}`} label={kdLabel(k)} value={fmtDate(k.date)} fixed={(o.key_dates.find((x) => x.kind === k.kind && x.title === k.title)?.date ?? k.date) !== k.date} />)}
      {mine.map((s) => <SpotCard key={s.key} c={c} s={s} />)}
      {!mine.length && <div className="ir-koik"><IconCheck />{anyUnsure ? t("imports.ir.allChecked") : t("imports.ir.allSure", { n: total })}</div>}
      <details className="ir-voldik" open={!mine.length && !anyUnsure ? true : undefined}>
        <summary><b>{t("imports.ir.sureN", { n: total })}</b><span>{t("imports.ir.clickShows")}</span></summary>
        <div className="ir-kindlad">
          {head.map((h) => <SureRow key={h.k} c={c} k={h.k} label={h.l} value={h.v} page={h.page} needles={h.needles} />)}
          {sureP.map(({ p, i }) => <SureRow key={`p${i}`} c={c} k={`parameter:${i}`} label={p.label || p.key} value={fmtValue(p.value, p.unit)} page={p.page} needles={needlesFor(p.value, p.text)} />)}
          {sureK.map(({ k, i }) => <SureRow key={`k${i}`} c={c} k={`key_date:${i}`} label={kdLabel(k)} value={fmtDate(k.date)} page={k.page} needles={needlesFor(k.date)} />)}
        </div>
        {R.length > 0 && <div className="ir-rist">{R.map((r) => <span key={r}><IconCheck />{r}</span>)}</div>}
      </details>
    </Step>
  );
}

// ---------------------------------------------------------------- step 4 · annexes and documents ----------------------

export function FilesStep({ nr, rows: children, files, onTab, mainLabel }: { nr: number; rows: DeskRow[]; files: ImportSourceFile[]; onTab: (i: number) => void; mainLabel: (f: ImportSourceFile) => string }) {
  const extra = files.filter((f) => !f.main);
  if (!children.length && !extra.length) return null;
  const open = children.reduce((a, r) => a + (r.state === "ootab" ? Math.max(1, r.open) : 0), 0);
  const n = children.length + extra.length;
  return (
    <Step nr={nr} title={t("imports.ir.q4")} ok={!open} extra={open ? <span className="ir-q-arv">{open}</span> : <em>{n === 1 ? t("imports.ir.fileOne") : t("imports.ir.fileMany", { n })}</em>}>
      {extra.map((f) => (
        <div key={`f${f.index}`} className="ir-laps">
          <button type="button" className="ir-laps-pea" onClick={() => onTab(f.index)}><span className="ir-laps-t"><b>{mainLabel(f)}</b><small>{t("imports.ir.sameContainer")} · {f.name}</small></span><em><IconCheck /></em></button>
        </div>
      ))}
      {children.map((r) => {
        const kind = r.kind === "annex" ? (r.annex_number ? t("imports.desk.annex", { nr: r.annex_number }) : t("imports.desk.annexNoNr")) : t("imports.desk.document");
        const waits = r.state === "ootab";
        return (
          <div key={r.id} className={cx("ir-laps", waits && "kord")}>
            <Link className="ir-laps-pea" href={`/app/portfell/import/${r.id}`}>
              <span className="ir-laps-t"><b>{[kind, r.heading || r.title].filter(Boolean).join(" · ")}</b><small>{[t("imports.ir.ownFile"), r.state === "kinnitatud" ? t("imports.desk.olek.committedAnnex") : r.kind === "document" ? t("imports.desk.child.fileOnly") : t("imports.desk.child.followsContract")].join(" · ")}</small></span>
              <em>{waits ? (r.open === 1 || !r.open ? t("imports.desk.child.reviewOne") : t("imports.desk.child.reviewMany", { n: r.open })) : <IconCheck />}</em>
            </Link>
            {r.changes.length > 0 && (
              <div className="ir-muut">{r.changes.map((ch, i) => <div key={i} className="ir-mr"><span>{ch.label}</span><i><IconArrowRight /></i><b>{fmtValue(ch.value, ch.unit)}</b></div>)}</div>
            )}
          </div>
        );
      })}
    </Step>
  );
}

// ---------------------------------------------------------------- calendar · clauses ----------------------------------

/** What lands in the calendar on commit: the contract's start and end (from the head — one copy) and the key dates. */
export function CalendarCard({ c, contract }: { c: ReviewCtl; contract: boolean }) {
  const d = c.draft;
  const head = contract ? HEAD_DATES.filter((f) => d.contract[f] && !d.key_dates.some((k) => k.kind === (f === "start_date" ? "start" : "end")))
    .map((f) => ({ id: f, kind: f === "start_date" ? "start" : "end", date: d.contract[f] as string, title: "", page: d.date_checks?.[f]?.page ?? null })) : [];
  const rows = [...head, ...d.key_dates.map((k, i) => ({ id: `k${i}`, kind: k.kind, date: k.date, title: k.title, page: k.page ?? null }))];
  if (!rows.length) return null;
  return (
    <div className="ir-kal">
      <div className="ir-kal-pea"><IconCal /><b>{t("imports.ir.calendar")}</b><span>{t("imports.ir.calendarSub")}</span></div>
      {rows.sort((a, b) => a.date.localeCompare(b.date)).map((k) => (
        <button key={k.id} type="button" className="ir-kal-r" onClick={() => c.show(k.page, needlesFor(k.date))}>
          <span className="mono">{fmtDate(k.date)}</span><span><b>{tEnum("keyDates.kinds", k.kind)}</b>{k.title && k.title !== tEnum("keyDates.kinds", k.kind) && <small>{k.title}</small>}</span>
        </button>
      ))}
    </div>
  );
}

export function ClausesCard({ c }: { c: ReviewCtl }) {
  const P = c.draft.clauses;
  if (!P.length) return null;
  return (
    <details className="ir-voldik ir-pkt">
      <summary><b>{t("imports.ir.clausesN", { n: P.length })}</b><span>{t("imports.ir.clausesSub")}</span></summary>
      <div className="ir-pkt-l">
        {P.map((p, i) => (
          <button key={i} type="button" className="ir-pkt-r" style={{ paddingLeft: 6 + Math.max(0, p.level - 1) * 10 }} onClick={() => c.show(p.page, [p.text.slice(0, 48), p.heading ?? ""].filter(Boolean))}>
            <span className="mono">{p.number}</span><span>{p.heading && <b>{p.heading} </b>}{p.text.slice(0, 120)}{p.text.length > 120 ? "…" : ""}</span>{p.page ? <small>{t("imports.pageAnchor", { n: p.page })}</small> : <small />}
          </button>
        ))}
      </div>
    </details>
  );
}

export function Note({ children, tone }: { children: ReactNode; tone?: "amber" }) {
  return <div className={cx("ir-ocr", tone !== "amber" && "neutral")}>{tone === "amber" ? <IconAlert /> : <IconX />}<div>{children}</div></div>;
}

/** The last removed value, with the way back (the removal is saved like any edit). */
export function RemovedNote({ label, value, onUndo }: { label: string; value: string; onUndo: () => void }) {
  return (
    <div className="ir-tr ir-tr-x" role="status"><span className="ir-tr-ic"><IconTrash /></span><span className="ir-tr-t"><span className="ir-tr-k">{t("imports.ir.removed")}</span><b>{label} · {value}</b></span>
      <span /><button type="button" className="steplink" onClick={onUndo}>{t("imports.ir.undo")}</button></div>
  );
}
