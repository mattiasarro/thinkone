import type { Metadata } from "next";
import { Suspense } from "react";
import { PartyDetailPage } from "@/features/portfolio/PartyDetailPage";
import { Loading } from "@/components/ui/State";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("portfolio.tabs.parties") };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Suspense fallback={<Loading />}><PartyDetailPage id={id} /></Suspense>;
}
