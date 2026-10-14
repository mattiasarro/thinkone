import type { Metadata } from "next";
import { PortalQuotePage } from "@/features/portal/PortalQuotePage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("portal.title") };

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PortalQuotePage token={token} />;
}
