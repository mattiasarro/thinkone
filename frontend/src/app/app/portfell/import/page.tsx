import type { Metadata } from "next";
import { ImportsPage } from "@/features/imports/ImportsPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("imports.title") };
export default function Page() { return <ImportsPage />; }
