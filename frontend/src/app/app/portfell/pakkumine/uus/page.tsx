import type { Metadata } from "next";
import { Suspense } from "react";
import { QuoteWizard } from "@/features/quotes/QuoteWizard";
import { Loading } from "@/components/ui/State";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("quotes.wizard.title") };
export default function Page() {
  return <Suspense fallback={<Loading rows={4} />}><QuoteWizard /></Suspense>;
}
