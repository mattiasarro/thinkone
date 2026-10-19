"use client";
import { useSearchParams } from "next/navigation";
import { t } from "@/i18n";
import { PageHead } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { CompaniesTab } from "./CompaniesTab";
import { MembersTab } from "./MembersTab";
import { TemplatesTab } from "./TemplatesTab";
import { NotificationsTab } from "./NotificationsTab";
import { SuperadminTab } from "./SuperadminTab";
import { useMe } from "@/lib/queries/auth";

const TABS = ["ettevotted", "kasutajad", "mallid", "teavitused", "superadmin"] as const;
type TabKey = (typeof TABS)[number];

export function SettingsPage() {
  const params = useSearchParams();
  const superadmin = useMe().data?.superadmin === true;
  const raw = params.get("tab");
  const allowed = (TABS as readonly string[]).includes(raw ?? "") && (raw !== "superadmin" || superadmin);
  const tab: TabKey = allowed ? (raw as TabKey) : "ettevotted";
  return (
    <div className="grid gap-5">
      <PageHead title={t("settings.title")} />
      <Tabs variant="line" ariaLabel={t("settings.title")} active={tab} tabs={[
        { key: "ettevotted", label: t("settings.tabs.companies"), href: "/app/seaded?tab=ettevotted" },
        { key: "kasutajad", label: t("settings.tabs.members"), href: "/app/seaded?tab=kasutajad" },
        { key: "mallid", label: t("settings.tabs.templates"), href: "/app/seaded?tab=mallid" },
        { key: "teavitused", label: t("settings.tabs.notifications"), href: "/app/seaded?tab=teavitused" },
        ...(superadmin ? [{ key: "superadmin", label: t("settings.tabs.superadmin"), href: "/app/seaded?tab=superadmin" }] : []),
      ]} />
      {tab === "ettevotted" && <CompaniesTab />}
      {tab === "kasutajad" && <MembersTab />}
      {tab === "mallid" && <TemplatesTab />}
      {tab === "teavitused" && <NotificationsTab />}
      {tab === "superadmin" && <SuperadminTab />}
    </div>
  );
}
