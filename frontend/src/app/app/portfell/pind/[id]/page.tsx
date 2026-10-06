import type { Metadata } from "next";
import { SpaceDetail } from "@/features/assets/SpaceDetail";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("assets.space.title") };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SpaceDetail id={id} />;
}
