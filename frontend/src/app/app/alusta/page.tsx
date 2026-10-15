import { Suspense } from "react";
import type { Metadata } from "next";
import { SetupPage } from "@/features/setup/SetupPage";
import { Loading } from "@/components/ui/State";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("setup.title") };
export default function Page() { return <Suspense fallback={<Loading />}><SetupPage /></Suspense>; }
