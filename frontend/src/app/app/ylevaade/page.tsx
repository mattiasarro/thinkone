import type { Metadata } from "next";
import { OverviewPage } from "@/features/overview/OverviewPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("nav.ylevaade") };
export default function Page() { return <OverviewPage />; }
