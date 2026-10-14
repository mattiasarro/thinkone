import type { Metadata } from "next";
import { Suspense } from "react";
import { LeaseWizard } from "@/features/leases/LeaseWizard";
import { Loading } from "@/components/ui/State";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("lease.wizard.title") };
export default function Page() {
  return <Suspense fallback={<Loading rows={4} />}><LeaseWizard /></Suspense>;
}
