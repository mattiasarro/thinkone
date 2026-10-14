import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n";
import { Loading } from "@/components/ui/State";
import { AiPage } from "@/features/ai/AiPage";

export const metadata: Metadata = { title: t("ai.title") };
export default function Page() {
  return <Suspense fallback={<Loading />}><AiPage /></Suspense>;
}
