"use client";
import { t, tEnum } from "@/i18n";
import { cx, fmtDateTime, initials } from "@/lib/format";
import { Tabs } from "@/components/ui/Tabs";
import { Pill, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { IconChat, IconSearch } from "@/components/ui/Icons";
import type { Thread } from "@/types/suhtlus";

export type ThreadFilter = "ootel" | "koik";

export function ThreadList({ threads, isLoading, error, refetch, selectedId, onSelect, q, onQ, filter, onFilter, counts, hasAny }: {
  threads: Thread[] | undefined; isLoading: boolean; error: unknown; refetch: () => void;
  selectedId: string | null; onSelect: (th: Thread) => void;
  q: string; onQ: (v: string) => void; filter: ThreadFilter; onFilter: (f: ThreadFilter) => void;
  counts: { ootel: number; koik: number }; hasAny: boolean;
}) {
  return (
    <aside className="card flex flex-col min-h-0 lg:h-[calc(100vh-200px)] lg:min-h-[480px]" aria-label={t("suhtlus.threads")}>
      <div className="grid gap-3 p-3 border-b" style={{ borderColor: "var(--line)" }}>
        <label className="flex items-center gap-2 h-10 px-3 rounded-control bg-canvas">
          <IconSearch width={14} height={14} className="text-muted" />
          <input value={q} onChange={(e) => onQ(e.target.value)} placeholder={t("suhtlus.search")} aria-label={t("common.search")} className="flex-1 min-w-0 bg-transparent outline-none text-sm" autoComplete="off" />
        </label>
        <Tabs ariaLabel={t("suhtlus.threads")} active={filter} onChange={(k) => onFilter(k as ThreadFilter)} tabs={[
          { key: "ootel", label: t("suhtlus.pending"), count: counts.ootel },
          { key: "koik", label: t("suhtlus.all"), count: counts.koik },
        ]} />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2">
        {isLoading && !threads ? <div className="p-3"><Loading rows={4} /></div>
          : error ? <div className="p-3"><ErrorState error={error} onRetry={refetch} /></div>
          : !threads || threads.length === 0 ? (
            hasAny ? <div className="empty py-8 text-sm">{t("suhtlus.noMatch")}</div>
              : <EmptyState icon={<IconChat width={40} height={40} />} title={t("suhtlus.empty")} />
          ) : (
            <ul className="grid gap-1 m-0 p-0 list-none">
              {threads.map((th) => <Row key={`${th.subject_type}:${th.subject_id}`} th={th} selected={th.subject_id === selectedId} onSelect={() => onSelect(th)} />)}
            </ul>
          )}
      </div>
    </aside>
  );
}

function Row({ th, selected, onSelect }: { th: Thread; selected: boolean; onSelect: () => void }) {
  const party = th.party_name ?? th.title;
  const mine = th.last_author_type === "operator";
  return (
    <li>
      <button type="button" onClick={onSelect} aria-current={selected || undefined}
        className={cx("w-full text-left flex gap-3 items-start p-3 rounded-control transition-colors", selected ? "bg-primary-subtle" : "hover:bg-canvas", th.unread > 0 && "font-medium")}>
        <Avatar name={party} unread={th.unread > 0} />
        <span className="flex-1 min-w-0 grid gap-0.5">
          <span className="flex items-baseline gap-2">
            <span className="truncate font-semibold">{party}</span>
            <time className="ml-auto flex-none text-xs text-muted tabular-nums" dateTime={th.last_at}>{fmtDateTime(th.last_at)}</time>
          </span>
          <span className="text-xs text-muted truncate">{th.title}</span>
          <span className={cx("text-sm truncate", th.unread > 0 ? "text-ink" : "text-muted")}>{mine ? `${t("suhtlus.you")}: ` : ""}{th.last_body}</span>
          <span className="flex items-center gap-1.5 flex-wrap mt-1">
            {th.unread > 0 && <Pill tone="primary">{t("suhtlus.unread", { n: th.unread })}</Pill>}
            {th.status && <Pill tone={statusTone(th.status)}>{tEnum(`${th.subject_type === "contract" ? "contract" : "quotes"}.status`, th.status)}</Pill>}
          </span>
        </span>
      </button>
    </li>
  );
}

export function Avatar({ name, unread, large }: { name: string; unread?: boolean; large?: boolean }) {
  return (
    <span aria-hidden="true" className={cx("rounded-full grid place-items-center font-bold flex-none", large ? "w-11 h-11 text-base" : "w-9 h-9 text-sm", unread ? "text-onink" : "text-ink")}
      style={{ background: unread ? "var(--color-primary)" : "var(--color-surface-subtle)" }}>
      {initials(name)}
    </span>
  );
}
