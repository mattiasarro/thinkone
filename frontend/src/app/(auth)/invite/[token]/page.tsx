import type { Metadata } from "next";
import { InviteForm } from "@/components/auth/InviteForm";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.inviteTitle") };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <InviteForm token={token} />;
}
