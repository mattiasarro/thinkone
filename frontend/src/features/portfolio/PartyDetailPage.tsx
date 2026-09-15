"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useDeleteParty, useParty, usePartyContracts } from "@/lib/queries/portfolio";
import { Card, CardHeader, CardBody, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconEdit, IconTrash } from "@/components/ui/Icons";
import { PartyModal } from "./PartyModal";
import { ContractsTable } from "./ContractsTable";

export function PartyDetailPage({ id }: { id: string }) {
  const party = useParty(id);
  const contracts = usePartyContracts(id);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  const remove = useDeleteParty();
  const toast = useToast();
  const router = useRouter();
  if (party.isLoading) return <Loading />;
  if (party.error || !party.data) return <ErrorState error={party.error} onRetry={() => party.refetch()} />;
  const p = party.data;
  const onDelete = async () => {
    try { await remove.mutateAsync(id); toast.success(t("toast.deleted")); router.replace("/app/portfell?tab=osapooled"); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div className="grid gap-5">
      <LinkButton href="/app/portfell?tab=osapooled" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("portfolio.tabs.parties")}</LinkButton>
      <PageHead title={p.name} sub={<span className="flex flex-wrap gap-1 mt-1"><span className="pill">{tEnum("portfolio.parties.kinds", p.kind)}</span>{p.roles.map((r) => <span key={r} className="pill primary">{tEnum("portfolio.parties.roleNames", r)}</span>)}</span>}
        actions={<><Button onClick={() => setEdit(true)}><IconEdit width={16} height={16} />{t("common.edit")}</Button><Button variant="text" className="btn-destructive" onClick={() => setDel(true)}><IconTrash width={16} height={16} />{t("common.delete")}</Button></>} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-start">
        <Card>
          <CardHeader title={t("assets.detailsTab")} />
          <CardBody>
            <dl className="kv">
              {p.kind === "person" ? <><dt>{t("portfolio.parties.personalCode")}</dt><dd>{p.personal_code ?? "—"}</dd></> : <><dt>{t("portfolio.parties.registryCode")}</dt><dd>{p.registry_code ?? "—"}</dd><dt>{t("portfolio.parties.vatNumber")}</dt><dd>{p.vat_number ?? "—"}</dd></>}
              <dt>{t("portfolio.parties.address")}</dt><dd>{p.address ?? "—"}</dd>
              <dt>{t("portfolio.parties.contactName")}</dt><dd>{p.contact_name ?? "—"}</dd>
              <dt>{t("portfolio.parties.email")}</dt><dd>{p.email ? <a className="text-primary" href={`mailto:${p.email}`}>{p.email}</a> : "—"}</dd>
              <dt>{t("portfolio.parties.phone")}</dt><dd>{p.phone ?? "—"}</dd>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={t("portfolio.parties.contracts")} />
          {contracts.isLoading ? <div className="p-6"><Loading /></div> : contracts.error ? <div className="p-6"><ErrorState error={contracts.error} onRetry={() => contracts.refetch()} /></div> : (contracts.data ?? []).length === 0 ? <EmptyState title={t("portfolio.parties.noContracts")} /> : <ContractsTable rows={contracts.data ?? []} />}
        </Card>
      </div>
      <PartyModal open={edit} onClose={() => setEdit(false)} initial={p} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={onDelete} busy={remove.isPending} title={t("common.delete")} body={t("portfolio.parties.deleteConfirm", { name: p.name })} />
    </div>
  );
}
