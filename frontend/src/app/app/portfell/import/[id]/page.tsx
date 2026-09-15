import type { Metadata } from "next";
import { ImportReviewPage } from "@/features/imports/ImportReviewPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("imports.review") };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ImportReviewPage id={id} />;
}
