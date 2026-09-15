import type { Metadata } from "next";
import { PartyDetailPage } from "@/features/portfolio/PartyDetailPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("portfolio.tabs.parties") };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PartyDetailPage id={id} />;
}
