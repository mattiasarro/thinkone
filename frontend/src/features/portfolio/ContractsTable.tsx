"use client";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { Table, Td } from "@/components/ui/Table";
import { Pill, statusTone } from "@/components/ui/Pill";
import { fmtDate } from "@/lib/format";
import type { ContractSummary } from "@/types/api";

const DRAFT_TURN: Record<string, { key: "draft" | "sent" | "ready_to_sign"; tone: "primary" | "neutral" | "success" }> = { draft: { key: "draft", tone: "primary" }, sent: { key: "sent", tone: "neutral" }, ready_to_sign: { key: "ready_to_sign", tone: "success" } };

/** Platform lease drafts: the turn is known from the status alone for draft (ours), sent (the tenant's) and ready_to_sign; negotiating needs the negotiation state, so only the status shows. */
function draftTurn(c: ContractSummary) {
  if (c.origin !== "platform" || c.type_code !== "lease") return null;
  const x = DRAFT_TURN[c.status];
  return x ? <Pill tone={x.tone}>{tEnum("lease.list.turn", x.key)}</Pill> : null;
}

export function ContractsTable({ rows }: { rows: ContractSummary[] }) {
  const router = useRouter();
  return (
    <Table>
      <thead>
        <tr>
          <th>{t("portfolio.contracts.number")}</th><th>{t("portfolio.contracts.title")}</th><th>{t("portfolio.contracts.party")}</th>
          <th>{t("common.category")}</th><th>{t("common.status")}</th><th>{t("portfolio.contracts.start")}</th><th>{t("portfolio.contracts.end")}</th><th>{t("portfolio.contracts.nextKeyDate")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.id} className="clickable" tabIndex={0} onClick={() => router.push(`/app/portfell/leping/${c.id}`)} onKeyDown={(e) => { if (e.key === "Enter") router.push(`/app/portfell/leping/${c.id}`); }}>
            <Td l={t("portfolio.contracts.number")}><span className="id">{c.number ?? "—"}</span></Td>
            <Td l={t("portfolio.contracts.title")}>
              <span className="font-semibold">{c.title}</span>
              {c.origin === "imported" && <Pill tone="info" className="ml-2">{t("portfolio.contracts.importedBadge")}</Pill>}
            </Td>
            <Td l={t("portfolio.contracts.party")}>{c.party?.name ?? "—"}</Td>
            <Td l={t("common.category")}>{c.category ? <span className="pill">{tEnum("contract.category", c.category)}</span> : "—"}</Td>
            <Td l={t("common.status")}><Pill tone={statusTone(c.status)}>{tEnum("contract.status", c.status)}</Pill></Td>
            <Td l={t("portfolio.contracts.start")}>{fmtDate(c.start_date)}</Td>
            <Td l={t("portfolio.contracts.end")}>{fmtDate(c.end_date)}</Td>
            <Td l={t("portfolio.contracts.nextKeyDate")}>{draftTurn(c) ?? (c.key_dates_next ? <span className="text-sm">{tEnum("keyDates.kinds", c.key_dates_next.kind_code)} · {fmtDate(c.key_dates_next.due_date)}</span> : "—")}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
