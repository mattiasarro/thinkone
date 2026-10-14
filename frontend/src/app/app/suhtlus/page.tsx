import { Suspense } from "react";
import type { Metadata } from "next";
import { t } from "@/i18n";
import { Loading } from "@/components/ui/State";
import { SuhtlusPage } from "@/features/suhtlus/SuhtlusPage";

export const metadata: Metadata = { title: t("nav.suhtlus") };
export default function Page() {
  return <Suspense fallback={<Loading />}><SuhtlusPage /></Suspense>;
}
