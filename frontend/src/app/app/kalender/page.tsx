import type { Metadata } from "next";
import { CalendarPage } from "@/features/keydates/CalendarPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("nav.kalender") };
export default function Page() { return <CalendarPage />; }
