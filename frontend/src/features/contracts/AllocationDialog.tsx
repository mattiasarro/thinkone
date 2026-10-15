"use client";
import { useEffect, useState } from "react";
import { t, tEnum } from "@/i18n";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { useAssets, useCreateAllocation } from "@/lib/queries/portfolio";
import { fmtNum } from "@/lib/format";
import type { ContractDetail, SpaceAttributes } from "@/types/api";

/** „Lisa pind” on the contract page: bind the contract to a building, or to one of its spaces (exclusive by default). */
export function AllocationDialog({ open, onClose, c }: { open: boolean; onClose: () => void; c: ContractDetail }) {
  const [assetId, setAssetId] = useState("");
  const [spaceId, setSpaceId] = useState("");
  const [kind, setKind] = useState<"exclusive" | "coverage">("exclusive");
  const properties = useAssets({ type_code: "property" });
  const spaces = useAssets({ type_code: "space", parent_id: assetId || undefined });
  const create = useCreateAllocation(c.id);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    // default to the building the contract already sits in (a space's parent, or the property itself)
    const have = c.allocations.find((a) => a.asset?.type_code === "space" && a.asset.parent_id)?.asset?.parent_id ?? c.allocations.find((a) => a.asset?.type_code === "property")?.asset?.id ?? "";
    setAssetId(have); setSpaceId("");
    setKind(c.category === "lease" ? "exclusive" : "coverage");
  }, [open, c.allocations, c.category]);

  const taken = new Set(c.allocations.map((a) => a.asset?.id));
  const pickable = (spaces.data ?? []).filter((s) => s.status !== "jagatud" && s.status !== "mitteaktiivne" && !taken.has(s.id));
  const targetId = spaceId || assetId;
  // exclusive allocations only live on units (spaces); a whole building is covered
  const effectiveKind = spaceId ? kind : "coverage";

  const submit = async () => {
    if (!targetId) return;
    try {
      await create.mutateAsync({ asset_id: targetId, kind: effectiveKind });
      toast.success(t("contract.allocationAdded"));
      onClose();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("contract.addAllocation")} sub={t("contract.addAllocationSub")} footer={
      <>
        <Button onClick={onClose}>{t("common.cancel")}</Button>
        <Button variant="primary" onClick={submit} disabled={!targetId} busy={create.isPending}>{t("common.add")}</Button>
      </>
    }>
      <Select label={t("imports.asset")} value={assetId} placeholder={t("common.selectPlaceholder")} onChange={(e) => { setAssetId(e.target.value); setSpaceId(""); }}>
        {(properties.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </Select>
      <Select label={t("imports.space")} value={spaceId} placeholder={t("contract.allocationWholeAsset")} disabled={!assetId} onChange={(e) => setSpaceId(e.target.value)}>
        {pickable.map((s) => <option key={s.id} value={s.id}>{s.name} · {fmtNum((s.attributes as Partial<SpaceAttributes>).rentable_area_m2)} m²{s.status && s.status !== "vaba" ? ` · ${tEnum("assets.status", s.status)}` : ""}</option>)}
      </Select>
      <Select label={t("imports.allocationKind")} value={effectiveKind} disabled={!spaceId} onChange={(e) => setKind(e.target.value as "exclusive" | "coverage")}
        options={[{ value: "exclusive", label: tEnum("contract.allocationKind", "exclusive") }, { value: "coverage", label: tEnum("contract.allocationKind", "coverage") }]} />
    </Modal>
  );
}
