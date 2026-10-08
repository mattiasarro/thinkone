"use client";
import { t } from "@/i18n";
import { useAsset } from "@/lib/queries/portfolio";
import { ErrorState, Loading } from "@/components/ui/State";
import { PageHead } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { IconChevronLeft } from "@/components/ui/Icons";
import { ParkingRegister } from "./ParkingRegister";
import { ParkingPlanEditor } from "./parking-plan/ParkingPlanEditor";
import { Tabs } from "@/components/ui/Tabs";
import { useState } from "react";

/** `#/parkimine/<objId>` in the demo: the ONE place to manage a building's spots (type, zone, reserve, out of service, space). */
export function ParkingPage({ propertyId }: { propertyId: string }) {
  const q = useAsset(propertyId);
  const [tab, setTab] = useState<"register" | "plan">("register");
  if (q.isLoading) return <Loading rows={5} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data;
  return (
    <div className="grid gap-5">
      <LinkButton href={`/app/portfell/objekt/${p.id}`} variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{p.name}</LinkButton>
      <PageHead title={`${t("assets.parkingReg.title")} · ${p.name}`} sub={tab === "plan" ? t("assets.parkingScheme.sub") : t("assets.parkingReg.sub")}
        actions={p.parking_spots.length > 0 && <Tabs tabs={[{ key: "register", label: t("assets.parkingScheme.register") }, { key: "plan", label: t("assets.parkingScheme.tab") }]} active={tab} onChange={(k) => setTab(k as "register" | "plan")} />} />
      {tab === "plan" && p.parking_spots.length > 0 ? <ParkingPlanEditor property={p} /> : <ParkingRegister property={p} />}
    </div>
  );
}
