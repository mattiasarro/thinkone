import { Suspense } from "react";
import type { Metadata } from "next";
import { PortfolioPage } from "@/features/portfolio/PortfolioPage";
import { t } from "@/i18n";
import { Loading } from "@/components/ui/State";

export const metadata: Metadata = { title: t("nav.portfell") };
export default function Page() {
  return <Suspense fallback={<Loading />}><PortfolioPage /></Suspense>;
}
