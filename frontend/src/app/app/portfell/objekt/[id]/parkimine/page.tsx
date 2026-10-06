import type { Metadata } from "next";
import { ParkingPage } from "@/features/assets/ParkingPage";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("assets.parkingReg.title") };
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ParkingPage propertyId={id} />;
}
