import { Suspense } from "react";
import type { Metadata } from "next";
import { CalendarPage } from "@/features/keydates/CalendarPage";
import { t } from "@/i18n";
import { Loading } from "@/components/ui/State";

export const metadata: Metadata = { title: t("nav.kalender") };
export default function Page() { return <Suspense fallback={<Loading />}><CalendarPage /></Suspense>; }
