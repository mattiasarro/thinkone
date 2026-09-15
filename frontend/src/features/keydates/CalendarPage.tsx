"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { t, tEnum } from "@/i18n";
import { useDeleteKeyDate, useKeyDateKinds, useKeyDates } from "@/lib/queries/portfolio";
import { PageHead, Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconChevronRight, IconEdit, IconPlus, IconTrash } from "@/components/ui/Icons";
import { cx, daysUntil, fmtDate, isoDay } from "@/lib/format";
import { KeyDateDialog } from "./KeyDateDialog";
import type { KeyDate } from "@/types/api";

const MONTHS = ["jaanuar", "veebruar", "märts", "aprill", "mai", "juuni", "juuli", "august", "september", "oktoober", "november", "detsember"];
const DOW = ["E", "T", "K", "N", "R", "L", "P"];

export function CalendarPage() {
  const [view, setView] = useState<"list" | "month">("list");
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [kind, setKind] = useState("");
  const [dialog, setDialog] = useState<{ open: boolean; item?: KeyDate | null }>({ open: false });
  const [del, setDel] = useState<KeyDate | null>(null);
  const kinds = useKeyDateKinds();
  const toast = useToast();
  const remove = useDeleteKeyDate();

  const range = useMemo(() => {
    if (view === "month") {
      const from = new Date(cursor); const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      return { from: isoDay(from), to: isoDay(to) };
    }
    const from = new Date(); from.setDate(from.getDate() - 30);
    const to = new Date(); to.setDate(to.getDate() + 365);
    return { from: isoDay(from), to: isoDay(to) };
  }, [view, cursor]);

  const q = useKeyDates({ from: range.from, to: range.to, kind: kind || undefined });
  const items = useMemo(() => [...(q.data ?? [])].sort((a, b) => a.due_date.localeCompare(b.due_date)), [q.data]);

  const onDelete = async () => {
    if (!del) return;
    try { await remove.mutateAsync(del.id); toast.success(t("keyDates.deleted")); setDel(null); } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <div className="grid gap-5">
      <PageHead title={t("keyDates.title")} sub={t("keyDates.sub")} actions={<Button variant="primary" onClick={() => setDialog({ open: true, item: null })}><IconPlus width={16} height={16} />{t("keyDates.add")}</Button>} />
      <div className="flex flex-wrap items-center gap-3">
        <Tabs tabs={[{ key: "list", label: t("keyDates.viewList") }, { key: "month", label: t("keyDates.viewMonth") }]} active={view} onChange={(k) => setView(k as "list" | "month")} />
        <select className="fld w-auto min-w-[180px]" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("keyDates.kind")}>
          <option value="">{t("keyDates.anyKind")}</option>
          {(kinds.data ?? []).map((k) => <option key={k.code} value={k.code}>{k.name_et || tEnum("keyDates.kinds", k.code)}</option>)}
        </select>
        {view === "month" && (
          <div className="flex items-center gap-1 ml-auto">
            <button type="button" className="icon-btn" aria-label={t("keyDates.prevMonth")} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><IconChevronLeft /></button>
            <span className="font-heading font-semibold text-base min-w-[150px] text-center capitalize">{MONTHS[cursor.getMonth()]} {cursor.getFullYear()}</span>
            <button type="button" className="icon-btn" aria-label={t("keyDates.nextMonth")} onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><IconChevronRight /></button>
          </div>
        )}
      </div>

      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : view === "list" ? (
        <ListView items={items} onEdit={(i) => setDialog({ open: true, item: i })} onDelete={setDel} />
      ) : (
        <MonthView cursor={cursor} items={items} onEdit={(i) => setDialog({ open: true, item: i })} />
      )}

      <KeyDateDialog open={dialog.open} onClose={() => setDialog({ open: false })} initial={dialog.item} />
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={onDelete} busy={remove.isPending} title={t("common.delete")} body={del ? t("keyDates.deleteConfirm", { title: del.title }) : null} />
    </div>
  );
}

function ListView({ items, onEdit, onDelete }: { items: KeyDate[]; onEdit: (k: KeyDate) => void; onDelete: (k: KeyDate) => void }) {
  if (items.length === 0) return <Card><EmptyState title={t("keyDates.empty")} /></Card>;
  const groups = new Map<string, KeyDate[]>();
  for (const it of items) {
    const d = new Date(it.due_date); const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    groups.set(key, [...(groups.get(key) ?? []), it]);
  }
  return (
    <div className="grid gap-4">
      {[...groups.entries()].map(([k, list]) => {
        const [y, m] = k.split("-");
        return (
          <Card key={k}>
            <div className="card-h"><h3 className="capitalize">{MONTHS[Number(m) - 1]} {y}</h3><span className="text-muted text-sm">{list.length}</span></div>
            <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
              {list.map((it) => <Row key={it.id} it={it} onEdit={onEdit} onDelete={onDelete} />)}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}

function Row({ it, onEdit, onDelete }: { it: KeyDate; onEdit: (k: KeyDate) => void; onDelete: (k: KeyDate) => void }) {
  const n = daysUntil(it.due_date);
  return (
    <li className="flex items-center gap-3 px-[var(--card-padding)] py-3 flex-wrap">
      <span className="font-mono text-sm tabular-nums w-24 flex-none">{fmtDate(it.due_date)}</span>
      <Pill tone={n < 0 ? "error" : n <= 30 ? "warning" : "neutral"}>{n < 0 ? t("home.overdue") : t("home.inDays", { n })}</Pill>
      <span className="pill info">{tEnum("keyDates.kinds", it.kind_code)}</span>
      <span className="min-w-0 flex-1 basis-[200px]">
        <span className="block font-semibold text-sm truncate">{it.title}</span>
        {it.contract ? (
          <Link href={`/app/portfell/leping/${it.contract.id}`} className="block text-xs text-primary truncate">{[it.contract.number, it.contract.party_name ?? it.contract.title].filter(Boolean).join(" · ")}</Link>
        ) : <span className="block text-xs text-muted">{t("keyDates.noContract")}</span>}
      </span>
      {it.fired_at && <Pill tone="success">{t("keyDates.fired")}</Pill>}
      <span className="flex gap-1 ml-auto">
        <button type="button" className="icon-btn" onClick={() => onEdit(it)} aria-label={t("common.edit")}><IconEdit width={16} height={16} /></button>
        <button type="button" className="icon-btn text-error" onClick={() => onDelete(it)} aria-label={t("common.delete")}><IconTrash width={16} height={16} /></button>
      </span>
    </li>
  );
}

function MonthView({ cursor, items, onEdit }: { cursor: Date; items: KeyDate[]; onEdit: (k: KeyDate) => void }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startPad = (first.getDay() + 6) % 7;
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startPad).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const byDay = new Map<number, KeyDate[]>();
  for (const it of items) { const d = new Date(it.due_date).getDate(); byDay.set(d, [...(byDay.get(d) ?? []), it]); }
  const todayIso = isoDay(new Date());
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 text-center text-xs font-semibold uppercase text-muted py-2 border-b" style={{ background: "var(--color-thead)", borderColor: "var(--color-divider)" }}>
        {DOW.map((d) => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          const iso = d ? isoDay(new Date(cursor.getFullYear(), cursor.getMonth(), d)) : "";
          return (
            <div key={i} className={cx("min-h-[72px] md:min-h-[96px] border-b border-r p-1 text-xs", !d && "bg-canvas")} style={{ borderColor: "var(--line)" }}>
              {d && <div className={cx("w-6 h-6 grid place-items-center rounded-full mb-1 font-semibold", iso === todayIso && "bg-primary text-white")}>{d}</div>}
              {d && (byDay.get(d) ?? []).map((it) => (
                <button key={it.id} type="button" onClick={() => onEdit(it)} className="block w-full text-left truncate rounded px-1 py-0.5 mb-0.5 text-[11px] font-medium hover:opacity-80" style={{ background: "var(--color-primary-subtle)", color: "var(--color-primary)" }} title={`${it.title}${it.contract ? ` — ${it.contract.number ?? it.contract.title}` : ""}`}>
                  {it.title}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
