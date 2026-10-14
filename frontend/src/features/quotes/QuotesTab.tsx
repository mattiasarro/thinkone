"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useQuotes } from "@/lib/queries/quotes";
import { useDebounced } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { LinkButton } from "@/components/ui/Button";
import { Table, Td } from "@/components/ui/Table";
import { Pill, statusTone } from "@/components/ui/Pill";
import { IconPlus, IconSearch } from "@/components/ui/Icons";
import { daysUntil, fmtDate, fmtEur } from "@/lib/format";
import type { QuoteSummary } from "@/types/api";

type View = "open" | "draft" | "sent" | "mine" | "action" | "closed";
const VIEWS: View[] = ["open", "draft", "sent", "mine", "action", "closed"];
const OPEN = new Set(["draft", "sent", "client_proposal", "accepted"]);

/** Validity text for a row: „kehtib veel N päeva” while open, otherwise the date. */
export function validityText(q: QuoteSummary): string {
  if (!OPEN.has(q.status) || q.status === "accepted") return t("quotes.validUntil", { date: fmtDate(q.valid_until) });
  const n = daysUntil(q.valid_until);
  return n < 0 ? t("quotes.expiredOn", { date: fmtDate(q.valid_until) }) : t("quotes.validDays", { n });
}

export function QuotesTab() {
  const [view, setView] = useState<View>("open");
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  // one list query per server view; the finer demo filters are applied client-side so the counts stay consistent
  const list = useQuotes({ view: view === "closed" ? "closed" : "open", q: dq || undefined });
  const rows = useMemo(() => {
    const all = list.data ?? [];
    switch (view) {
      case "draft": return all.filter((x) => x.status === "draft");
      case "sent": return all.filter((x) => x.status === "sent");
      case "mine": return all.filter((x) => x.status === "client_proposal" || x.status === "accepted");
      case "action": return all.filter((x) => x.next_step?.side === "operator");
      default: return all;
    }
  }, [list.data, view]);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 h-10 px-3 rounded-control bg-surface shadow-surface w-full sm:w-[280px]">
          <IconSearch width={14} height={14} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("quotes.search")} aria-label={t("common.search")} className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
        </label>
        <div className="sm:ml-auto flex items-center gap-3 flex-wrap">
          <Tabs tabs={VIEWS.map((k) => ({ key: k, label: tEnum("quotes.views", k) }))} active={view} onChange={(k) => setView(k as View)} />
          <LinkButton href="/app/portfell/pakkumine/uus" variant="primary"><IconPlus width={16} height={16} />{t("quotes.create")}</LinkButton>
        </div>
      </div>
      <Card>
        {list.isLoading ? <div className="p-6"><Loading rows={5} /></div> : list.error ? <div className="p-6"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div> : rows.length === 0 ? (
          <EmptyState title={t("quotes.empty")} sub={t("quotes.emptySub")} action={<LinkButton href="/app/portfell/pakkumine/uus" variant="primary">{t("quotes.create")}</LinkButton>} />
        ) : <QuotesTable rows={rows} />}
      </Card>
    </div>
  );
}

export function QuotesTable({ rows }: { rows: QuoteSummary[] }) {
  const router = useRouter();
  const go = (id: string) => router.push(`/app/portfell/pakkumine/${id}`);
  return (
    <Table>
      <thead>
        <tr>
          <th>{t("quotes.cols.number")}</th><th>{t("quotes.cols.party")}</th><th>{t("quotes.cols.property")}</th><th className="num">{t("quotes.cols.rent")}</th>
          <th>{t("quotes.cols.status")}</th><th>{t("quotes.cols.validity")}</th><th>{t("quotes.cols.next")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((x) => (
          <tr key={x.id} className="clickable" tabIndex={0} onClick={() => go(x.id)} onKeyDown={(e) => { if (e.key === "Enter") go(x.id); }}>
            <Td l={t("quotes.cols.number")}><span className="id">{x.number}</span></Td>
            <Td l={t("quotes.cols.party")}><span className="font-semibold">{x.party.name}</span></Td>
            <Td l={t("quotes.cols.property")}>{x.property.name}{x.space_names.length > 0 && <span className="text-muted"> · {x.space_names.join(", ")}</span>}</Td>
            <Td l={t("quotes.cols.rent")} num>{fmtEur(x.totals.monthly_net)}</Td>
            <Td l={t("quotes.cols.status")}><Pill tone={statusTone(x.status)}>{tEnum("quotes.status", x.status)}</Pill></Td>
            <Td l={t("quotes.cols.validity")}><span className="text-sm">{validityText(x)}</span></Td>
            <Td l={t("quotes.cols.next")}>
              {x.next_step ? <span className={x.next_step.urgent ? "text-warning font-medium" : ""}>{x.next_step.title}</span> : "—"}
              {x.unread > 0 && <Pill tone="primary" className="ml-2">{t("quotes.unread", { n: x.unread })}</Pill>}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
