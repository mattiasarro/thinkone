"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { IconArrowRight, IconChevronLeft } from "@/components/ui/Icons";
import { ParkingRegister } from "./ParkingRegister";
import { ParkingPlanEditor } from "./parking-plan/ParkingPlanEditor";
import type { AssetDetail } from "@/types/api";

export function StepParking({ property, onBack, onNext }: { property: AssetDetail; onBack: () => void; onNext: () => void }) {
  const [tab, setTab] = useState<"register" | "plan">("register");
  const hasSpots = property.parking_spots.length > 0;
  return (
    <div className="grid gap-4">
      <div className="card pad grid gap-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="grow"><h2 className="text-lg mb-1">{t("assets.parkingReg.title")}</h2><p className="text-muted text-sm">{tab === "plan" ? t("assets.parkingScheme.sub") : t("assets.parkingReg.sub")}</p></div>
          {hasSpots && <Tabs tabs={[{ key: "register", label: t("assets.parkingScheme.register") }, { key: "plan", label: t("assets.parkingScheme.tab") }]} active={tab} onChange={(k) => setTab(k as "register" | "plan")} />}
        </div>
        {tab === "plan" && hasSpots ? <ParkingPlanEditor property={property} /> : <ParkingRegister property={property} compact />}
      </div>
      <div className="flex justify-between gap-2"><Button onClick={onBack}><IconChevronLeft width={16} height={16} />{t("common.back")}</Button><Button variant="primary" onClick={onNext}>{t("common.next")}<IconArrowRight width={16} height={16} /></Button></div>
    </div>
  );
}
