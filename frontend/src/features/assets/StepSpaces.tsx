"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/State";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useDeleteAsset } from "@/lib/queries/portfolio";
import { IconArrowRight, IconChevronLeft, IconPlus, IconImport } from "@/components/ui/Icons";
import { SpaceForm } from "./SpaceForm";
import { SpacesImport } from "./SpacesImport";
import { SpacesTable } from "./SpacesTable";
import type { Asset, AssetDetail } from "@/types/api";

export function StepSpaces({ property, onNext, onBack }: { property: AssetDetail; onNext: () => void; onBack: () => void }) {
  const spaces = property.children.filter((c) => c.type_code === "space");
  const [mode, setMode] = useState<"none" | "add" | "import">("none");
  const [editing, setEditing] = useState<Asset | null>(null);
  const [del, setDel] = useState<Asset | null>(null);
  const remove = useDeleteAsset();
  const toast = useToast();
  const onDelete = async () => { if (!del) return; try { await remove.mutateAsync(del.id); toast.success(t("assets.spaceDeleted")); setDel(null); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div className="grid gap-4">
      <div className="card">
        <div className="card-h">
          <div><h2 className="text-lg">{t("assets.spaces")}</h2><span className="text-muted text-sm">{t("assets.spacesCount", { n: spaces.length })}</span></div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" size="sm" onClick={() => { setEditing(null); setMode("add"); }}><IconPlus width={14} height={14} />{t("assets.addSpace")}</Button>
            <Button size="sm" onClick={() => setMode("import")}><IconImport width={14} height={14} />{t("assets.importTable")}</Button>
          </div>
        </div>
        <div className="card-b grid gap-4">
          {mode === "add" && <SpaceForm propertyId={property.id} companyId={property.company_id} space={editing} onDone={() => { setMode("none"); setEditing(null); }} onCancel={() => { setMode("none"); setEditing(null); }} />}
          {mode === "import" && <SpacesImport propertyId={property.id} onDone={() => setMode("none")} onCancel={() => setMode("none")} />}
          {spaces.length === 0 ? <EmptyState title={t("assets.noSpaces")} sub={t("assets.noSpacesSub")} /> : <SpacesTable spaces={spaces} onEdit={(s) => { setEditing(s); setMode("add"); }} onDelete={setDel} />}
        </div>
      </div>
      <div className="flex justify-between gap-2"><Button onClick={onBack}><IconChevronLeft width={16} height={16} />{t("common.back")}</Button><Button variant="primary" onClick={onNext}>{t("common.next")}<IconArrowRight width={16} height={16} /></Button></div>
      <ConfirmDialog open={!!del} onClose={() => setDel(null)} onConfirm={onDelete} busy={remove.isPending} title={t("common.delete")} body={del ? t("assets.deleteSpaceConfirm", { name: del.name }) : null} />
    </div>
  );
}
