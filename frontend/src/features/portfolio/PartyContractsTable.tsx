"use client";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { Table, Td } from "@/components/ui/Table";
import { Pill, statusTone } from "@/components/ui/Pill";
import { fmtDate } from "@/lib/format";
import type { PartyContractRow } from "@/types/api";

/** A party's contracts with the party's role in each (the party can be tenant on one lease and guarantor on another). */
export function PartyContractsTable({ rows }: { rows: PartyContractRow[] }) {
  const router = useRouter();
  const go = (id: string) => router.push(`/app/portfell/leping/${id}`);
  return (
    <Table>
      <thead>
        <tr>
          <th>{t("portfolio.contracts.number")}</th><th>{t("portfolio.contracts.title")}</th><th>{t("contract.partyRole")}</th>
          <th>{t("common.category")}</th><th>{t("common.status")}</th><th>{t("portfolio.contracts.start")}</th><th>{t("portfolio.contracts.end")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="clickable" tabIndex={0} onClick={() => go(c.id)} onKeyDown={(e) => { if (e.key === "Enter") go(c.id); }}>
            <Td l={t("portfolio.contracts.number")}><span className="id">{c.number ?? "—"}</span></Td>
            <Td l={t("portfolio.contracts.title")}><span className="font-semibold">{c.title}</span></Td>
            <Td l={t("contract.partyRole")}>{c.role ? <span className="pill primary">{tEnum("imports.partyRoles", c.role)}</span> : "—"}</Td>
            <Td l={t("common.category")}>{c.category ? <span className="pill">{tEnum("contract.category", c.category)}</span> : "—"}</Td>
            <Td l={t("common.status")}><Pill tone={statusTone(c.status)}>{tEnum("contract.status", c.status)}</Pill></Td>
            <Td l={t("portfolio.contracts.start")}>{fmtDate(c.start_date)}</Td>
            <Td l={t("portfolio.contracts.end")}>{fmtDate(c.end_date)}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
