import type { Metadata } from "next";
import { AuditPage } from "@/features/audit/AuditPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("audit.title") };
export default function Page() { return <AuditPage />; }
