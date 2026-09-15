"use client";
import { useState } from "react";
import { t, tEnum } from "@/i18n";
import { useContracts } from "@/lib/queries/portfolio";
import { useDebounced } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { LinkButton } from "@/components/ui/Button";
import { ContractsTable } from "./ContractsTable";
import { IconSearch } from "@/components/ui/Icons";

const STATUSES = ["draft", "active", "signed", "ended", "terminated", "expired", "archived"];
const CATEGORIES = ["lease", "maintenance", "management", "insurance", "security", "employment", "other"];
const TYPES = ["lease", "employment", "imported", "supporting"];

export function ContractsTab() {
  const [view, setView] = useState<"active" | "archive" | "all">("active");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const dq = useDebounced(q, 300);
  const list = useContracts({ view, q: dq || undefined, status: status || undefined, type_code: type || undefined, category: category || undefined });
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 h-10 px-3 rounded-control bg-surface shadow-surface w-full sm:w-[280px]">
          <IconSearch width={14} height={14} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("portfolio.contracts.search")} aria-label={t("common.search")} className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
        </label>
        <select className="fld w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("common.status")}>
          <option value="">{t("portfolio.contracts.anyStatus")}</option>{STATUSES.map((s) => <option key={s} value={s}>{tEnum("contract.status", s)}</option>)}
        </select>
        <select className="fld w-auto" value={type} onChange={(e) => setType(e.target.value)} aria-label={t("common.type")}>
          <option value="">{t("portfolio.contracts.anyType")}</option>{TYPES.map((s) => <option key={s} value={s}>{tEnum("contract.type", s)}</option>)}
        </select>
        <select className="fld w-auto" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("common.category")}>
          <option value="">{t("portfolio.contracts.anyCategory")}</option>{CATEGORIES.map((s) => <option key={s} value={s}>{tEnum("contract.category", s)}</option>)}
        </select>
        <div className="sm:ml-auto">
          <Tabs tabs={[{ key: "active", label: t("portfolio.contracts.viewActive") }, { key: "archive", label: t("portfolio.contracts.viewArchive") }, { key: "all", label: t("portfolio.contracts.viewAll") }]} active={view} onChange={(k) => setView(k as typeof view)} />
        </div>
      </div>
      <Card>
        {list.isLoading ? <div className="p-6"><Loading rows={5} /></div> : list.error ? <div className="p-6"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div> : (list.data ?? []).length === 0 ? (
          <EmptyState title={t("portfolio.contracts.empty")} sub={t("portfolio.contracts.emptySub")} action={<LinkButton href="/app/portfell/import" variant="primary">{t("home.importContract")}</LinkButton>} />
        ) : <ContractsTable rows={list.data ?? []} />}
      </Card>
    </div>
  );
}
