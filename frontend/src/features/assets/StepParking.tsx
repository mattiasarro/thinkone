"use client";
import { t } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { IconArrowRight, IconChevronLeft } from "@/components/ui/Icons";
import { ParkingRegister } from "./ParkingRegister";
import type { AssetDetail } from "@/types/api";

export function StepParking({ property, onBack, onNext }: { property: AssetDetail; onBack: () => void; onNext: () => void }) {
  return (
    <div className="grid gap-4">
      <div className="card pad grid gap-4">
        <div><h2 className="text-lg mb-1">{t("assets.parkingReg.title")}</h2><p className="text-muted text-sm">{t("assets.parkingReg.sub")}</p></div>
        <ParkingRegister property={property} compact />
      </div>
      <div className="flex justify-between gap-2"><Button onClick={onBack}><IconChevronLeft width={16} height={16} />{t("common.back")}</Button><Button variant="primary" onClick={onNext}>{t("common.next")}<IconArrowRight width={16} height={16} /></Button></div>
    </div>
  );
}
