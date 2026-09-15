import { Suspense } from "react";
import type { Metadata } from "next";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { t } from "@/i18n";
import { Loading } from "@/components/ui/State";

export const metadata: Metadata = { title: t("settings.title") };
export default function Page() {
  return <Suspense fallback={<Loading />}><SettingsPage /></Suspense>;
}
