"use client";
import { useState } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { useAddContractParty, useParties, useRemoveContractParty, useUpdateContractParty } from "@/lib/queries/portfolio";
import { errorMessage } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { Modal } from "@/components/ui/Modal";
import { Checkbox, Input, Select } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import { useDebounced } from "@/lib/hooks";
import { fmtDate } from "@/lib/format";
import { PARTY_ROLES, type ContractDetail, type ContractParty } from "@/types/api";

const roleOptions = PARTY_ROLES.map((r) => ({ value: r, label: tEnum("imports.partyRoles", r) }));

/** „Pooled”: every party of the contract with its role in THIS contract; exactly one is primary (what lists and the calendar show). */
export function PartiesCard({ c }: { c: ContractDetail }) {
  const [add, setAdd] = useState(false);
  const update = useUpdateContractParty(c.id);
  const remove = useRemoveContractParty(c.id);
  const toast = useToast();
  const rows = c.parties ?? [];
  const setRole = async (cp: ContractParty, role: string) => { try { await update.mutateAsync({ id: cp.id, role }); toast.success(t("contract.partyUpdated")); } catch (e) { toast.error(errorMessage(e)); } };
  const makePrimary = async (cp: ContractParty) => { try { await update.mutateAsync({ id: cp.id, is_primary: true }); } catch (e) { toast.error(errorMessage(e)); } };
  const onRemove = async (cp: ContractParty) => { try { await remove.mutateAsync(cp.id); toast.success(t("contract.partyRemoved")); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <Card>
      <CardHeader title={t("contract.parties")} actions={<Button size="sm" onClick={() => setAdd(true)}><IconPlus width={14} height={14} />{t("contract.addParty")}</Button>} />
      {rows.length === 0 ? <p className="text-sm text-muted px-[var(--card-padding)] py-4">{t("contract.noParties")}</p> : (
        <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
          {rows.map((cp) => {
            const lockRemove = cp.is_primary && rows.length > 1;
            const validity = cp.valid_from && cp.valid_to ? t("contract.partyValid", { from: fmtDate(cp.valid_from), to: fmtDate(cp.valid_to) }) : cp.valid_from ? t("contract.partyFrom", { from: fmtDate(cp.valid_from) }) : cp.valid_to ? t("contract.partyTo", { to: fmtDate(cp.valid_to) }) : null;
            return (
              <li key={cp.id} className="flex items-center gap-2 px-[var(--card-padding)] py-2.5 flex-wrap">
                <span className="min-w-0 flex-1 basis-40">
                  <Link href={`/app/portfell/osapool/${cp.party.id}`} className="block text-sm font-semibold text-primary truncate">{cp.party.name}</Link>
                  <span className="block text-xs text-muted truncate">{[cp.party.registry_code, validity, tEnum("contract.partySource", cp.source)].filter(Boolean).join(" · ")}</span>
                </span>
                <Select className="!mb-0 w-40" aria-label={t("contract.partyRole")} value={cp.role} options={roleOptions} onChange={(e) => setRole(cp, e.target.value)} disabled={update.isPending} />
                {cp.is_primary ? <Pill tone="primary">{t("contract.primary")}</Pill> : <Button size="sm" variant="text" onClick={() => makePrimary(cp)} disabled={update.isPending}>{t("contract.makePrimary")}</Button>}
                <button type="button" className="icon-btn !w-8 !h-8 text-error disabled:opacity-40" aria-label={t("contract.removeParty")} title={lockRemove ? t("contract.primaryKeep") : t("contract.removeParty")} disabled={lockRemove || remove.isPending} onClick={() => onRemove(cp)}><IconTrash width={14} height={14} /></button>
              </li>
            );
          })}
        </ul>
      )}
      <AddPartyDialog open={add} onClose={() => setAdd(false)} c={c} />
    </Card>
  );
}

function AddPartyDialog({ open, onClose, c }: { open: boolean; onClose: () => void; c: ContractDetail }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const parties = useParties({ q: dq || undefined });
  const [partyId, setPartyId] = useState("");
  const [role, setRole] = useState<string>(defaultRole(c.category));
  const [primary, setPrimary] = useState(false);
  const add = useAddContractParty(c.id);
  const toast = useToast();
  const onContract = new Set((c.parties ?? []).map((x) => `${x.party.id}:${x.role}`));
  const submit = async () => {
    if (!partyId) return;
    try { await add.mutateAsync({ party_id: partyId, role, is_primary: primary }); toast.success(t("contract.partyAdded")); setPartyId(""); setQ(""); setPrimary(false); onClose(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("contract.addParty")} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" onClick={submit} disabled={!partyId || onContract.has(`${partyId}:${role}`)} busy={add.isPending}>{t("common.add")}</Button></>}>
      <div className="grid gap-2">
        <Input className="!mb-0" aria-label={t("common.search")} placeholder={t("portfolio.parties.search")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="fld" aria-label={t("contract.pickParty")} value={partyId} onChange={(e) => setPartyId(e.target.value)} size={Math.min(6, Math.max(3, (parties.data ?? []).length + 1))}>
          <option value="">{t("common.selectPlaceholder")}</option>
          {(parties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.registry_code ? ` (${p.registry_code})` : ""}{onContract.has(`${p.id}:${role}`) ? ` · ${t("contract.partyAlreadyOn")}` : ""}</option>)}
        </select>
        <Select label={t("contract.partyRole")} value={role} options={roleOptions} onChange={(e) => setRole(e.target.value)} />
        <Checkbox label={t("contract.primary")} checked={primary} onChange={(e) => setPrimary(e.target.checked)} />
      </div>
    </Modal>
  );
}

/** The counterparty role of a category — the same table as the backend's counterparty_role(). */
export function defaultRole(category: string | null | undefined): string {
  return ({ lease: "tenant", employment: "employee", insurance: "insurer", maintenance: "maintainer", management: "manager", security: "security" } as Record<string, string>)[category ?? ""] ?? "supplier";
}
