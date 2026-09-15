import type { Metadata } from "next";
import { ObjectWizard } from "@/features/assets/ObjectWizard";
import { PropertyDetail } from "@/features/assets/PropertyDetail";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("assets.editTitle") };
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string; step?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (sp.edit) {
    const step = sp.step === "2" ? 2 : sp.step === "3" ? 3 : 1;
    return <ObjectWizard propertyId={id} step={step} />;
  }
  return <PropertyDetail id={id} />;
}
