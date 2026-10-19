import type { Metadata } from "next";
import { ImportBatchPage } from "@/features/imports/ImportBatchPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("imports.title") };
export default async function Page({ params }: { params: Promise<{ batch: string }> }) {
  const { batch } = await params;
  return <ImportBatchPage batchId={batch} />;
}
