"use client";
import { t } from "@/i18n";
import { useAsset } from "@/lib/queries/portfolio";
import { ErrorState, Loading } from "@/components/ui/State";
import { PageHead } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { IconChevronLeft } from "@/components/ui/Icons";
import { ParkingRegister } from "./ParkingRegister";

/** `#/parkimine/<objId>` in the demo: the ONE place to manage a building's spots (type, zone, reserve, out of service, space). */
export function ParkingPage({ propertyId }: { propertyId: string }) {
  const q = useAsset(propertyId);
  if (q.isLoading) return <Loading rows={5} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data;
  return (
    <div className="grid gap-5">
      <LinkButton href={`/app/portfell/objekt/${p.id}`} variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{p.name}</LinkButton>
      <PageHead title={`${t("assets.parkingReg.title")} · ${p.name}`} sub={t("assets.parkingReg.sub")} />
      <ParkingRegister property={p} />
    </div>
  );
}
