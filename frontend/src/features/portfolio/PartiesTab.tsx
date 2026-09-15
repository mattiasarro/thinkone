"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useParties } from "@/lib/queries/portfolio";
import { useDebounced } from "@/lib/hooks";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Table, Td } from "@/components/ui/Table";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { IconPlus, IconSearch, IconUsers } from "@/components/ui/Icons";
import { PartyModal } from "./PartyModal";
import type { Party } from "@/types/api";

export function PartiesTab() {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const list = useParties({ q: dq || undefined });
  const router = useRouter();
  const params = useSearchParams();
  const [modal, setModal] = useState<{ open: boolean; party?: Party | null }>({ open: false });
  useEffect(() => { if (params.get("new") === "1") setModal({ open: true, party: null }); }, [params]);
  const closeModal = () => { setModal({ open: false }); if (params.get("new")) router.replace("/app/portfell?tab=osapooled"); };
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 h-10 px-3 rounded-control bg-surface shadow-surface w-full sm:w-[280px]">
          <IconSearch width={14} height={14} className="text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("portfolio.parties.search")} aria-label={t("common.search")} className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
        </label>
        <Button variant="primary" className="sm:ml-auto" onClick={() => setModal({ open: true, party: null })}><IconPlus width={16} height={16} />{t("portfolio.parties.add")}</Button>
      </div>
      <Card>
        {list.isLoading ? <div className="p-6"><Loading rows={5} /></div> : list.error ? <div className="p-6"><ErrorState error={list.error} onRetry={() => list.refetch()} /></div> : (list.data ?? []).length === 0 ? (
          <EmptyState icon={<IconUsers width={40} height={40} />} title={t("portfolio.parties.empty")} sub={t("portfolio.parties.emptySub")} />
        ) : (
          <Table>
            <thead><tr><th>{t("portfolio.parties.name")}</th><th>{t("portfolio.parties.kind")}</th><th>{t("portfolio.parties.code")}</th><th>{t("portfolio.parties.contact")}</th><th>{t("portfolio.parties.roles")}</th></tr></thead>
            <tbody>
              {(list.data ?? []).map((p) => (
                <tr key={p.id} className="clickable" tabIndex={0} onClick={() => router.push(`/app/portfell/osapool/${p.id}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/app/portfell/osapool/${p.id}`); }}>
                  <Td l={t("portfolio.parties.name")}><span className="font-semibold">{p.name}</span></Td>
                  <Td l={t("portfolio.parties.kind")}>{tEnum("portfolio.parties.kinds", p.kind)}</Td>
                  <Td l={t("portfolio.parties.code")}><span className="id">{p.registry_code ?? p.personal_code ?? "—"}</span></Td>
                  <Td l={t("portfolio.parties.contact")}><span className="text-sm">{[p.contact_name, p.email].filter(Boolean).join(" · ") || "—"}</span></Td>
                  <Td l={t("portfolio.parties.roles")}><span className="flex flex-wrap gap-1">{p.roles.length ? p.roles.map((r) => <span key={r} className="pill">{tEnum("portfolio.parties.roleNames", r)}</span>) : "—"}</span></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <PartyModal open={modal.open} onClose={closeModal} initial={modal.party} />
    </div>
  );
}
