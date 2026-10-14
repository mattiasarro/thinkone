"use client";
import { useMemo } from "react";
import { t, tEnum } from "@/i18n";
import { cx } from "@/lib/format";
import { Loading } from "@/components/ui/State";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import type { AiThread } from "@/types/ai";

type GroupKey = "today" | "yesterday" | "week" | "older";
const ORDER: GroupKey[] = ["today", "yesterday", "week", "older"];
const timeFmt = new Intl.DateTimeFormat("et-EE", { hour: "2-digit", minute: "2-digit" });
const dayFmt = new Intl.DateTimeFormat("et-EE", { day: "2-digit", month: "2-digit" });

function groupOf(iso: string, now: Date): GroupKey {
  const d = new Date(iso);
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((start.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return "week";
  return "older";
}

export function threadTime(th: AiThread): string { return th.last_message_at ?? th.created_at; }
export function threadTitle(th: AiThread): string { return th.title.trim() || t("ai.untitled"); }
export function contextLabel(th: Pick<AiThread, "context_type" | "context_label"> | null | undefined): string {
  if (!th?.context_type || th.context_type === "portfolio") return t("ai.wholePortfolio");
  return th.context_label || tEnum("search.entity", th.context_type);
}

export function ThreadList({ threads, isLoading, activeId, onSelect, onNew, onDelete, className }: {
  threads: AiThread[] | undefined; isLoading: boolean; activeId: string | null;
  onSelect: (id: string) => void; onNew: () => void; onDelete: (th: AiThread) => void; className?: string;
}) {
  const groups = useMemo(() => {
    const now = new Date();
    const g: Record<GroupKey, AiThread[]> = { today: [], yesterday: [], week: [], older: [] };
    for (const th of threads ?? []) g[groupOf(threadTime(th), now)].push(th);
    return g;
  }, [threads]);
  const now = new Date();
  return (
    <div className={cx("flex flex-col gap-3 h-full min-h-0", className)}>
      <button type="button" onClick={onNew} className="btn btn-ghost w-full justify-start border" style={{ borderColor: "var(--color-divider)", background: "var(--color-surface)" }}>
        <IconPlus width={15} height={15} />{t("ai.newThread")}
      </button>
      <nav aria-label={t("ai.history")} className="flex-1 min-h-0 overflow-y-auto -mx-1.5 px-1.5 pb-3">
        {isLoading && !threads ? <div className="p-2"><Loading rows={4} /></div>
          : !threads || threads.length === 0 ? <p className="m-0 p-2.5 text-[12.5px] leading-relaxed text-muted">{t("ai.noThreads")}</p>
          : ORDER.filter((k) => groups[k].length > 0).map((k) => (
            <section key={k} className="mt-3.5 first:mt-0">
              <h4 className="px-2.5 pb-1.5 text-[11.5px] font-semibold text-muted font-ui">{t(`ai.groups.${k}`)}</h4>
              <ul className="m-0 p-0 list-none grid gap-0.5">
                {groups[k].map((th) => <Row key={th.id} th={th} selected={th.id === activeId} now={now} onSelect={() => onSelect(th.id)} onDelete={() => onDelete(th)} />)}
              </ul>
            </section>
          ))}
      </nav>
    </div>
  );
}

function Row({ th, selected, now, onSelect, onDelete }: { th: AiThread; selected: boolean; now: Date; onSelect: () => void; onDelete: () => void }) {
  const d = new Date(threadTime(th));
  const sameDay = d.toDateString() === now.toDateString();
  return (
    <li className="relative group">
      <button type="button" onClick={onSelect} aria-current={selected || undefined}
        className={cx("w-full text-left grid gap-0.5 py-2 pl-2.5 pr-10 rounded-[9px] transition-colors", selected ? "bg-subtle" : "hover:bg-surface")}>
        <span className={cx("truncate text-[13px] leading-[1.35]", selected ? "font-semibold text-ink" : "font-medium text-ink/85")}>{threadTitle(th)}</span>
        <span className="flex justify-between gap-2 text-[11.5px] text-muted">
          <span className="truncate">{contextLabel(th)}</span>
          <time className="flex-none tabular-nums" dateTime={threadTime(th)}>{sameDay ? timeFmt.format(d) : dayFmt.format(d)}</time>
        </span>
      </button>
      <button type="button" onClick={onDelete} aria-label={t("ai.deleteThread")} title={t("ai.deleteThread")}
        className={cx("icon-btn !w-8 !h-8 absolute top-1/2 -translate-y-1/2 right-1 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100", selected ? "opacity-100" : "opacity-0")}>
        <IconTrash width={15} height={15} />
      </button>
    </li>
  );
}
