import type { Metadata } from "next";
import { ManualImportPage } from "@/features/imports/ManualImportPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("imports.manual.title") };
export default function Page() { return <ManualImportPage />; }
