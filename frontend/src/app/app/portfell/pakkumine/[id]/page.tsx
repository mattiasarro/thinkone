import type { Metadata } from "next";
import { QuoteDetailPage } from "@/features/quotes/QuoteDetailPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("quotes.one") };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <QuoteDetailPage id={id} />;
}
