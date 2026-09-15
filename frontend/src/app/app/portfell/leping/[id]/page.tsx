import type { Metadata } from "next";
import { ContractDetailPage } from "@/features/contracts/ContractDetailPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("portfolio.tabs.contracts") };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContractDetailPage id={id} />;
}
