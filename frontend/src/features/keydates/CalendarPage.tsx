"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { t, tEnum } from "@/i18n";
import { useDeleteKeyDate, useKeyDates, useReopenKeyDate, useResolveKeyDate } from "@/lib/queries/portfolio";
import { Card } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconArrowRight, IconCal, IconChevronLeft, IconChevronRight, IconMenu, IconPlus, IconX } from "@/components/ui/Icons";
import { cx, daysUntil, fmtDate, fmtFixed, isoDay } from "@/lib/format";
import { KeyDateDialog } from "./KeyDateDialog";
import { KeyDateStatusText, decides, isOpen } from "./KeyDateStatus";
import type { KeyDate } from "@/types/api";

const MONTHS = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const WD = t("keyDates.cal.weekdays").split(",");
const WD_LONG = t("keyDates.cal.weekdaysLong").split(",");
const DOW = t("keyDates.cal.dow").split(",");
const nOf = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("{n}", String(n)));
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

/** „2 kuu pärast” / „5 p tagasi” (demo `kalSuht`). */
function rel(d: number): string {
  if (d === 0) return t("keyDates.cal.rel.today");
  if (d === 1) return t("keyDates.cal.rel.tomorrow");
  if (d === -1) return t("keyDates.cal.rel.yesterday");
  if (d < 0) return -d <= 60 ? t("keyDates.cal.rel.daysAgo", { n: -d }) : t("keyDates.cal.rel.monthsAgo", { n: Math.round(-d / 30.44) });
  if (d <= 60) return t("keyDates.cal.rel.days", { n: d });
  return d < 730 ? t("keyDates.cal.rel.months", { n: Math.round(d / 30.44) }) : t("keyDates.cal.rel.years", { n: Math.round(d / 365) });
}
const money = (n: number, unit: string | null, frac = 0) => `${fmtFixed(n, frac)} ${unit && !/eur|€/i.test(unit) ? unit : "€"}`;
const pctTxt = (p: number) => p.toFixed(1).replace(".", ",");
const method = (k: KeyDate) => {
  const p = k.projection;
  if (!p) return "";
  return p.method === "cpi" ? t("keyDates.cal.cpi") : p.method === "fixed_pct" && p.pct != null ? t("keyDates.cal.fixed", { rate: String(p.pct).replace(".", ",") }) : "";
};
/** „1 409 € → 1 452 € (+3,0 %) · fikseeritud 3 %” — the timeline's line under an indexation. */
function projLine(k: KeyDate) {
  const p = k.projection;
  if (!p) return null;
  if (p.new == null) return <>{money(p.old, p.unit)} · {t("keyDates.cal.cpiAsk")}</>;
  return <>{money(p.old, p.unit)} → <b>{money(p.new, p.unit)}</b>{p.pct != null && ` (${p.pct >= 0 ? "+" : ""}${pctTxt(p.pct)} %)`}{method(k) && ` · ${method(k)}`}</>;
}
const kindLabel = (k: KeyDate) => tEnum("keyDates.kinds", k.kind_code);
const who = (k: KeyDate) => k.contract?.party_name ?? k.contract?.title ?? "";

type Who = "" | "otsus" | "ise";

/** Kalender = the demo's timeline (v625 → v735): type tabs with counts · who acts · Loend/Kuu · „Järgmised 30 päeva” · one card
 *  with the timeline (date · spine · event · when · arrow), months as headings, „Täna” where today is; a row opens its detail
 *  in place. Filled dot = someone has to decide or act, hollow = nothing to do. */
export function CalendarPage() {
  const params = useSearchParams();
  const router = useRouter();
  const contractId = params.get("contract");
  const [view, setView] = useState<"list" | "month">("list");
  const [kind, setKind] = useState("");
  const [whoF, setWhoF] = useState<Who>("");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [dialog, setDialog] = useState<{ open: boolean; item?: KeyDate | null }>({ open: false });
  const [del, setDel] = useState<KeyDate | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pop, setPop] = useState<KeyDate | null>(null);
  const toast = useToast();
  const remove = useDeleteKeyDate();

  const from = useMemo(() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return isoDay(d); }, []);
  const q = useKeyDates({ from, contract_id: contractId ?? undefined });
  const all = useMemo(() => [...(q.data ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date)), [q.data]);
  const kinds = useMemo(() => { const m = new Map<string, number>(); for (const k of all) m.set(k.kind_code, (m.get(k.kind_code) ?? 0) + 1); return [...m.entries()]; }, [all]);
  const activeKind = kind && kinds.some(([k]) => k === kind) ? kind : "";
  const match = (k: KeyDate) => (!activeKind || k.kind_code === activeKind) && (!whoF || (whoF === "otsus") === decides(k));
  const items = all.filter(match);
  const contractName = contractId ? (all[0]?.contract ? [all[0].contract.number, who(all[0])].filter(Boolean).join(" · ") : "") : "";

  const onDelete = async () => {
    if (!del) return;
    try { await remove.mutateAsync(del.id); toast.success(t("keyDates.deleted")); setDel(null); setPop(null); } catch (e) { toast.error(errorMessage(e)); }
  };
  const detail = (k: KeyDate) => <Detail k={k} onEdit={() => setDialog({ open: true, item: k })} onDelete={() => setDel(k)} />;

  return (
    <div className="grid gap-4">
      <div className="page-head"><div className="min-w-0"><h1 className="page-h1">{t("keyDates.title")}</h1></div></div>
      <Tabs variant="line" ariaLabel={t("keyDates.cal.byKind")} active={activeKind} onChange={(k) => { setKind(k); setOpenId(null); }}
            tabs={[{ key: "", label: t("keyDates.cal.all"), count: all.length }, ...kinds.map(([k, n]) => ({ key: k, label: tEnum("keyDates.tabs", k), count: n }))]}
            actions={
              <span className="flex flex-wrap items-center gap-2.5 pb-1.5">
                <Tabs ariaLabel={t("keyDates.cal.who")} active={whoF} onChange={(k) => { setWhoF(k as Who); setOpenId(null); }}
                      tabs={[{ key: "", label: t("keyDates.cal.all") }, { key: "otsus", label: t("keyDates.cal.decide") }, { key: "ise", label: t("keyDates.cal.auto") }]} />
                <Button size="sm" onClick={() => setDialog({ open: true, item: null })}><IconPlus width={14} height={14} />{t("keyDates.cal.add")}</Button>
                <span className="pf-mode" role="group" aria-label={t("keyDates.cal.view")}>
                  <button type="button" className={cx(view === "list" && "on")} aria-pressed={view === "list"} title={t("keyDates.cal.list")} aria-label={t("keyDates.cal.list")} onClick={() => setView("list")}><IconMenu /></button>
                  <button type="button" className={cx(view === "month" && "on")} aria-pressed={view === "month"} title={t("keyDates.cal.month")} aria-label={t("keyDates.cal.month")} onClick={() => setView("month")}><IconCal /></button>
                </span>
              </span>
            } />
      {contractId && (
        <div><button type="button" className="chip on" onClick={() => router.replace("/app/kalender")} title={t("keyDates.cal.allContracts")}>
          {t("keyDates.cal.onlyContract", { name: contractName || "…" })}<IconX />
        </button></div>
      )}

      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : view === "list" ? (
        <>
          <Next30 items={items} filtered={!!(activeKind || whoF)} onPick={(k) => { setOpenId(k.id); requestAnimationFrame(() => document.getElementById(`kal-${k.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })); }} />
          <Timeline items={items} openId={openId} onToggle={(id) => setOpenId(openId === id ? null : id)} detail={detail} />
        </>
      ) : (
        <Month cursor={cursor} setCursor={setCursor} items={items} onPick={setPop} />
      )}

      <Modal open={!!pop} onClose={() => setPop(null)} title={pop ? kindLabel(pop) : ""}
             sub={pop ? `${[pop.contract?.number, who(pop)].filter(Boolean).join(" · ")} · ${fmtDate(pop.due_date)} · ${rel(daysUntil(pop.due_date))}` : undefined}>
        {pop && detail(pop)}
      </Modal>
      <KeyDateDialog open={dialog.open} onClose={() => setDialog({ open: false })} initial={dialog.item} contractId={contractId ?? undefined} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={onDelete} busy={remove.isPending} title={t("common.delete")} body={del ? t("keyDates.deleteConfirm", { title: del.title }) : null} />
    </div>
  );
}

/** „Järgmised 30 päeva” (demo `kal30HTML`): count · legend · up to four rows; a row takes you to it on the timeline, opened. */
function Next30({ items, filtered, onPick }: { items: KeyDate[]; filtered: boolean; onPick: (k: KeyDate) => void }) {
  const near = items.filter((k) => { const d = daysUntil(k.due_date); return d >= 0 && d <= 30; });
  const n = near.filter(decides).length;
  return (
    <Card className="kal30 reveal">
      <div className="kal30-pea">
        <div>
          <h2>{t("keyDates.cal.next30")}</h2>
          <p>{near.length ? `${nOf(near.length, t("keyDates.cal.deadlineOne"), t("keyDates.cal.deadlineMany"))} · ${n ? t("keyDates.cal.decideN", { n }) : t("keyDates.cal.allAuto")}`
            : filtered ? t("keyDates.cal.next30Filtered") : t("keyDates.cal.next30None")}</p>
        </div>
        <Legend />
      </div>
      {near.length > 0 && (
        <div className="kal30-read">
          {near.slice(0, 4).map((k) => {
            const d = daysUntil(k.due_date), ise = !decides(k);
            return (
              <button key={k.id} type="button" className={cx("kal30-r", ise && "ise")} onClick={() => onPick(k)}>
                <span className="kal30-p"><b>{d}</b><small>{d === 1 ? t("keyDates.cal.dayOne") : t("keyDates.cal.dayMany")}</small></span>
                <span className={cx("kal-dot", ise && "ise")} />
                <span className="kal30-tx"><b>{kindLabel(k)}</b><span>{[who(k), k.contract?.number].filter(Boolean).join(" · ")}</span></span>
                <span className="kal30-kp">{fmtDate(k.due_date).slice(0, 5)}</span>
                <span className="kal30-s">{ise ? t("keyDates.cal.legendAuto") : t("keyDates.cal.legendDecide")}</span>
              </button>
            );
          })}
        </div>
      )}
      {near.length > 4 && <div className="kal30-veel">{t("keyDates.cal.more", { n: near.length - 4 })}</div>}
    </Card>
  );
}

const Legend = () => <span className="kal-leg"><i />{t("keyDates.cal.legendDecide")}<i className="ise" />{t("keyDates.cal.legendAuto")}</span>;

function TodayLine() {
  const now = new Date();
  return <div className="kal-tana" aria-label={t("keyDates.cal.today")}><span className="kal-tana-d">{t("keyDates.cal.today")}</span><span className="kal-tana-p" /><span className="kal-tana-l">{fmtDate(now)} · {WD_LONG[now.getDay()]}</span></div>;
}

/** The timeline: months as headings, „Täna” before the first date still to come, past rows fade (an open task does not). */
function Timeline({ items, openId, onToggle, detail }: { items: KeyDate[]; openId: string | null; onToggle: (id: string) => void; detail: (k: KeyDate) => React.ReactNode }) {
  if (items.length === 0) return <Card className="kal-aeg reveal"><p className="text-sm text-muted text-center py-6">{t("keyDates.cal.empty")}</p></Card>;
  const todayIso = isoDay(new Date()), thisMonth = todayIso.slice(0, 7);
  const groups: { key: string; items: KeyDate[] }[] = [];
  for (const k of items) { const key = k.due_date.slice(0, 7); const g = groups.at(-1); if (g && g.key === key) g.items.push(k); else groups.push({ key, items: [k] }); }
  const firstComing = items.find((k) => k.due_date.slice(0, 10) >= todayIso)?.id;
  return (
    <Card className="kal-aeg reveal">
      {groups.map((g) => {
        const [y, m] = g.key.split("-"), n = g.items.filter(decides).length;
        const todayBefore = g.items[0].id === firstComing && g.key !== thisMonth;   // today falls in an earlier month — the line goes above this heading
        return (
          <Fragment key={g.key}>
            {todayBefore && <TodayLine />}
            <section>
              <div className="kal-kuu-h">
                <h2>{cap(MONTHS[Number(m) - 1])}<span className="kal-a">{y}</span></h2>
                <span className="kal-kuu-n">{nOf(g.items.length, t("keyDates.cal.eventOne"), t("keyDates.cal.eventMany"))}{n ? ` · ${t("keyDates.cal.decideN", { n })}` : ""}</span>
                {g.key === thisMonth && <span className="kal-see">{t("keyDates.cal.thisMonth")}</span>}
              </div>
              <div className="kal-tl-list">
                {g.items.map((k) => (
                  <Fragment key={k.id}>
                    {k.id === firstComing && !todayBefore && <TodayLine />}
                    <Row k={k} open={openId === k.id} onToggle={() => onToggle(k.id)} />
                    {openId === k.id && <div className="kal-expand"><div className="kal-exp-in">{detail(k)}</div></div>}
                  </Fragment>
                ))}
              </div>
            </section>
          </Fragment>
        );
      })}
      {!firstComing && <TodayLine />}
    </Card>
  );
}

function Row({ k, open, onToggle }: { k: KeyDate; open: boolean; onToggle: () => void }) {
  const d = daysUntil(k.due_date), ise = !decides(k), past = d < 0 && !isOpen(k);
  const sub = projLine(k) ?? (k.title !== kindLabel(k) ? k.title : null);
  const showStatus = k.status && k.status !== "upcoming";
  return (
    <div id={`kal-${k.id}`} role="button" tabIndex={0} aria-expanded={open} className={cx("kal-tl", ise && "ise", past && "moodas", !ise && d >= 0 && d <= 60 && "kiire", open && "open")}
         onClick={onToggle} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}>
      <div className="kal-tl-d"><b>{k.due_date.slice(8, 10)}</b><small>{WD[day(k.due_date).getDay()]}</small></div>
      <span className={cx("kal-dot", ise && "ise")} title={ise ? t("keyDates.cal.legendAuto") : t("keyDates.cal.legendDecide")} />
      <div className="kal-tl-sisu">
        <div className="kal-tl-t"><b>{kindLabel(k)}</b>{who(k) && <span className="kal-tl-kes">{who(k)}</span>}</div>
        {(sub || showStatus) && <div className="kal-tl-s">{sub}{sub && showStatus ? " · " : ""}{showStatus && <KeyDateStatusText k={k} />}</div>}
      </div>
      <div className="kal-tl-m"><span className="kal-tl-aeg">{rel(d)}</span>{k.contract?.number && <span className="mono">{k.contract.number}</span>}</div>
      {k.contract ? (
        <Link className="kal-tl-go" href={`/app/portfell/leping/${k.contract.id}`} title={t("keyDates.cal.openContract")} aria-label={t("keyDates.cal.openContract")} onClick={(e) => e.stopPropagation()}><IconArrowRight /></Link>
      ) : <span aria-hidden="true" />}
    </div>
  );
}

/** A date's detail (inline under its row, or the month view's popup): what it does, and what you can do about it. */
function Detail({ k, onEdit, onDelete }: { k: KeyDate; onEdit: () => void; onDelete: () => void }) {
  const resolve = useResolveKeyDate();
  const reopen = useReopenKeyDate();
  const toast = useToast();
  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast.success(msg); } catch (e) { toast.error(errorMessage(e)); } };
  const p = k.projection, open = isOpen(k);
  const contractHref = k.contract ? `/app/portfell/leping/${k.contract.id}` : null;
  return (
    <div>
      {k.kind_code === "indexation" ? (
        p ? (
          <div className="kal-hind">
            <div><span className="lbl">{t("keyDates.cal.oldRent")}</span><span className="calc">{method(k)}</span><span className="amt">{money(p.old, p.unit, 2)}</span></div>
            <div><span className="lbl">{t("keyDates.cal.newRent")}</span><span className="calc">{p.pct != null ? `${p.pct >= 0 ? "+" : ""}${pctTxt(p.pct)} %` : t("keyDates.cal.cpiAsk")}</span><span className="amt">{p.new != null ? money(p.new, p.unit, 2) : "—"}</span></div>
          </div>
        ) : <p className="text-muted">{k.status === "skipped" ? t("keyDates.statusHint.skipped") : t("keyDates.cal.noRent")}</p>
      ) : <p>{k.title}</p>}
      <p className="text-xs text-muted mt-2.5">
        <KeyDateStatusText k={k} />
        {k.status === "upcoming" && ` · ${k.fired_at ? t("keyDates.cal.notified", { date: fmtDate(k.fired_at) }) : t("keyDates.cal.notify", { n: k.notify_days_before ?? 0 })}`}
      </p>
      <div className="kal-act">
        {open && k.kind_code === "indexation" && contractHref && <LinkButton size="sm" variant="primary" href={contractHref}>{t("keyDates.cal.confirmOnContract")}<IconArrowRight width={14} height={14} /></LinkButton>}
        {open && k.kind_code !== "indexation" && (
          <>
            <Button size="sm" variant="primary" busy={resolve.isPending} onClick={() => run(() => resolve.mutateAsync({ id: k.id, resolution: "done" }), t("keyDates.resolved"))}>{t("keyDates.markDone")}</Button>
            <Button size="sm" onClick={() => run(() => resolve.mutateAsync({ id: k.id, resolution: "skipped" }), t("keyDates.resolved"))}>{t("keyDates.markSkipped")}</Button>
          </>
        )}
        {k.resolution && <Button size="sm" busy={reopen.isPending} onClick={() => run(() => reopen.mutateAsync(k.id), t("keyDates.reopened"))}>{t("keyDates.reopen")}</Button>}
        {contractHref && !(open && k.kind_code === "indexation") && <LinkButton size="sm" href={contractHref}>{t("keyDates.cal.openContract")}</LinkButton>}
        <button type="button" className="steplink" onClick={onEdit}>{t("keyDates.cal.edit")}</button>
        <button type="button" className="steplink text-error" onClick={onDelete}>{t("keyDates.cal.delete")}</button>
      </div>
    </div>
  );
}

/** Month view (demo `kal-kuu-vaade`): this month by default, today framed, past days dim, the same dot on each event; a chip opens the detail. */
function Month({ cursor, setCursor, items, onPick }: { cursor: Date; setCursor: (d: Date) => void; items: KeyDate[]; onPick: (k: KeyDate) => void }) {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const ym = `${y}-${String(m + 1).padStart(2, "0")}`;
  const now = new Date(), todayIso = isoDay(now), thisYm = todayIso.slice(0, 7);
  const lead = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate();
  const byDay = new Map<number, KeyDate[]>();
  for (const k of items) if (k.due_date.slice(0, 7) === ym) { const d = Number(k.due_date.slice(8, 10)); byDay.set(d, [...(byDay.get(d) ?? []), k]); }
  const inMonth = [...byDay.values()].flat(), n = inMonth.filter(decides).length;
  const prev = new Date(y, m - 1, 1), next = new Date(y, m + 1, 1);
  return (
    <Card className="kal-kuu-vaade reveal">
      <div className="kal-kv-pea">
        <Button size="sm" onClick={() => setCursor(prev)} aria-label={t("keyDates.cal.prev")}><IconChevronLeft width={14} height={14} /><span className="max-md:hidden capitalize">{MONTHS[prev.getMonth()]}</span></Button>
        <div className="kal-kv-t">
          <h2>{MONTHS[m]} {y}</h2>
          <span>
            {inMonth.length ? `${nOf(inMonth.length, t("keyDates.cal.eventOne"), t("keyDates.cal.eventMany"))}${n ? ` · ${t("keyDates.cal.decideN", { n })}` : ""}` : t("keyDates.cal.noEvents")}
            {ym !== thisYm && <> · <button type="button" className="steplink" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>{t("keyDates.cal.todayLink")}</button></>}
          </span>
        </div>
        <Button size="sm" onClick={() => setCursor(next)} aria-label={t("keyDates.cal.next")}><span className="max-md:hidden capitalize">{MONTHS[next.getMonth()]}</span><IconChevronRight width={14} height={14} /></Button>
      </div>
      <div className="cal-head">{DOW.map((d) => <div key={d}>{d}</div>)}</div>
      <div className="cal-grid">
        {Array.from({ length: lead }, (_, i) => <div key={`o${i}`} className="cal-cell off" />)}
        {Array.from({ length: dim }, (_, i) => {
          const d = i + 1, iso = `${ym}-${String(d).padStart(2, "0")}`, today = iso === todayIso, wk = (lead + i) % 7 >= 5;
          return (
            <div key={d} className={cx("cal-cell", today && "today", iso < todayIso && "past", wk && "wk")}>
              <div className="cal-d">{d}{today && <span>{t("keyDates.cal.rel.today")}</span>}</div>
              {(byDay.get(d) ?? []).map((k) => (
                <button key={k.id} type="button" className={cx("cal-chip", !decides(k) && "ise")} title={`${kindLabel(k)} · ${who(k)}`} onClick={() => onPick(k)}>
                  <i className="cal-p" /><span>{kindLabel(k)}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      <div className="kal-kv-leg"><Legend /></div>
    </Card>
  );
}
