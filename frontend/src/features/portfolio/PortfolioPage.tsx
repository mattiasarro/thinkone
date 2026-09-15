"use client";
import { useSearchParams } from "next/navigation";
import { t } from "@/i18n";
import { PageHead } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ContractsTab } from "./ContractsTab";
import { AssetsTab } from "./AssetsTab";
import { PartiesTab } from "./PartiesTab";

const TABS = ["lepingud", "esemed", "osapooled"] as const;
type TabKey = (typeof TABS)[number];

export function PortfolioPage() {
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: TabKey = (TABS as readonly string[]).includes(raw ?? "") ? (raw as TabKey) : "lepingud";
  return (
    <div className="grid gap-5">
      <PageHead title={t("portfolio.title")} sub={t("portfolio.sub")} />
      <Tabs ariaLabel={t("portfolio.title")} active={tab} tabs={[
        { key: "lepingud", label: t("portfolio.tabs.contracts"), href: "/app/portfell?tab=lepingud" },
        { key: "esemed", label: t("portfolio.tabs.assets"), href: "/app/portfell?tab=esemed" },
        { key: "osapooled", label: t("portfolio.tabs.parties"), href: "/app/portfell?tab=osapooled" },
        { key: "import", label: t("portfolio.tabs.imports"), href: "/app/portfell/import" },
      ]} />
      {tab === "lepingud" && <ContractsTab />}
      {tab === "esemed" && <AssetsTab />}
      {tab === "osapooled" && <PartiesTab />}
    </div>
  );
}
