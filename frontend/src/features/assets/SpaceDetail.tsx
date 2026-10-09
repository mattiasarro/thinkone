"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useAsset, useDeleteAsset, useKeyDates, useMergeSpace, useParkingPlan, useSplitSpace } from "@/lib/queries/portfolio";
import { ParkingPlanPreview } from "./parking-plan/ParkingPlanEditor";
import { Card, CardHeader, CardBody, PageHead, Stat } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill, statusTone } from "@/components/ui/Pill";
import { ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconEdit, IconTrash, IconArrowRight } from "@/components/ui/Icons";
import { cx, daysUntil, fmtDate, fmtEur, fmtNum } from "@/lib/format";
import { SpaceForm } from "./SpaceForm";
import { partsLabel } from "./SpacesTable";
import { SpotChip, SpaceSpotsDialog } from "./ParkingRegister";
import { AttachmentsList } from "@/features/contracts/AttachmentsList";
import { SPACE_PART_KEYS, type Allocation, type AssetDetail, type SpaceAttributes, type SpacePartKey, type SplitUnitInput } from "@/types/api";

const ACTIVE = new Set(["active", "signed", "draft", "pending"]);

/** `#/pind/<id>` in the demo: header · guide · now · deadlines · archive · actions by status. */
export function SpaceDetail({ id }: { id: string }) {
  const q = useAsset(id);
  const remove = useDeleteAsset();
  const merge = useMergeSpace(id);
  const toast = useToast();
  const router = useRouter();
  const [edit, setEdit] = useState(false);
  const [split, setSplit] = useState(false);
  const [mergeDlg, setMergeDlg] = useState(false);
  const [del, setDel] = useState(false);
  const [spotsDlg, setSpotsDlg] = useState(false);
  const p = q.data;
  const contractIds = useMemo(() => (p?.allocations ?? []).map((a) => a.contract?.id).filter(Boolean) as string[], [p]);
  const kd = useKeyDates({ from: new Date().toISOString().slice(0, 10) }, contractIds.length > 0);
  if (q.isLoading) return <Loading rows={5} />;
  if (q.error || !p) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const a = p.attributes as Partial<SpaceAttributes>;
  const current = p.allocations.filter((al) => al.contract && ACTIVE.has(al.contract.status ?? ""));
  const archive = p.allocations.filter((al) => !current.includes(al));
  const rent = a.price_per_m2 != null && a.rentable_area_m2 ? a.price_per_m2 * a.rentable_area_m2 : null;
  const dates = (kd.data ?? []).filter((d) => d.contract && contractIds.includes(d.contract.id)).slice(0, 8);
  const property = p.parent;
  const spots = p.parking_spots;
  const onDelete = async () => {
    try { await remove.mutateAsync(id); toast.success(t("assets.space.deleted", { name: p.name })); router.replace(property ? `/app/portfell/objekt/${property.id}` : "/app/portfell?tab=esemed"); } catch (e) { toast.error(errorMessage(e)); }
  };
  const onMerge = async () => { try { await merge.mutateAsync(); setMergeDlg(false); toast.success(t("assets.space.merged", { name: p.name })); } catch (e) { toast.error(errorMessage(e)); } };
  const inactive = p.status === "mitteaktiivne";
  const former = p.former_units ?? [];
  return (
    <div className="grid gap-5">
      <LinkButton href={property ? `/app/portfell/objekt/${property.id}` : "/app/portfell?tab=esemed"} variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{property?.name ?? t("assets.space.back")}</LinkButton>
      <PageHead title={p.name} sub={<span className="flex flex-wrap items-center gap-2"><Pill tone={statusTone(p.status)}>{tEnum("assets.status", p.status)}</Pill><span>{a.type ? tEnum("assets.spaceTypes", a.type) : ""}{partsLabel(a) ? ` · ${partsLabel(a)}` : ""}</span>{p.split_parent && <span className="text-muted">{t("assets.space.splitParent")}: <Link className="text-primary font-semibold" href={`/app/portfell/pind/${p.split_parent.id}`}>{p.split_parent.name}</Link></span>}</span>}
        actions={<Button variant="primary" onClick={() => setEdit(true)}><IconEdit width={16} height={16} />{t("assets.space.editData")}</Button>} />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={t("assets.space.area")} value={`${fmtNum(a.rentable_area_m2)} m²`} />
        <Stat label={t("assets.space.pricePerM2")} value={a.price_per_m2 != null ? fmtEur(a.price_per_m2) : "—"} />
        <Stat label={t("assets.space.rentMonthly")} value={rent != null ? fmtEur(rent) : "—"} tone={rent != null ? "primary" : undefined} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        <div className="grid gap-5">
          <Card>
            <CardHeader title={t("assets.space.now")} />
            <CardBody>
              {inactive ? <p className="text-sm text-muted">{t("assets.space.inactiveNote", { name: p.split_parent?.name ?? "—" })}</p>
              : p.status === "jagatud" ? (
                <ul className="grid gap-2 text-sm">{p.split_units.map((u) => <li key={u.id} className="flex items-center gap-2"><Link href={`/app/portfell/pind/${u.id}`} className="text-primary font-semibold">{u.name}</Link><span className="text-muted">{fmtNum((u.attributes as Partial<SpaceAttributes> | undefined)?.rentable_area_m2)} m²</span>{u.status && <Pill tone={statusTone(u.status)} className="ml-auto">{tEnum("assets.status", u.status)}</Pill>}</li>)}</ul>
              ) : current.length === 0 ? <p className="text-sm text-muted">{t("assets.space.noContract")}</p> : (
                <ul className="grid gap-3">{current.map((al) => <ContractRow key={al.id} al={al} />)}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("assets.space.upcoming")} />
            <CardBody>
              {dates.length === 0 ? <p className="text-sm text-muted">{t("assets.space.noUpcoming")}</p> : (
                <ul className="grid gap-2 text-sm">{dates.map((d) => { const n = daysUntil(d.due_date); return (
                  <li key={d.id} className="flex items-center gap-3"><span className="font-mono text-xs text-muted w-24 flex-none">{fmtDate(d.due_date)}</span><span className="flex-1 min-w-0 truncate">{d.title}{d.contract ? ` · ${d.contract.number}` : ""}</span><Pill tone={n < 0 ? "error" : n <= 30 ? "warning" : "neutral"}>{n < 0 ? t("home.overdue") : t("home.inDays", { n })}</Pill></li>); })}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("assets.space.archive")} />
            <CardBody>{archive.length === 0 ? <p className="text-sm text-muted">{t("assets.space.noArchive")}</p> : <ul className="grid gap-3">{archive.map((al) => <ContractRow key={al.id} al={al} />)}</ul>}</CardBody>
          </Card>
        </div>
        <div className="grid gap-5">
          <Card>
            <CardHeader title={t("assets.space.actions")} />
            <CardBody>
              <ul className="grid gap-2">
                {current.map((al) => al.contract && <li key={al.id}><LinkButton href={`/app/portfell/leping/${al.contract.id}`} className="w-full justify-between">{t("assets.space.openContract")} · {al.contract.number}<IconArrowRight width={16} height={16} /></LinkButton></li>)}
                {inactive ? null : p.status === "jagatud" ? <li><Button className="w-full" onClick={() => setMergeDlg(true)}>{t("assets.space.merge")}</Button></li>
                  : <li><Button className="w-full" onClick={() => setSplit(true)} disabled={!!p.split_block_reason} title={p.split_block_reason ?? undefined}>{t("assets.space.split")}</Button></li>}
                <li><Button variant="text" className="btn-destructive w-full" onClick={() => setDel(true)} disabled={!!p.delete_block_reason} title={p.delete_block_reason ?? undefined}><IconTrash width={16} height={16} />{t("assets.space.delete")}</Button></li>
                {p.delete_block_reason && <li className="text-xs text-muted">{p.delete_block_reason}</li>}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("assets.detailsTab")} />
            <CardBody>
              <dl className="kv">
                <dt>{t("assets.space.parent")}</dt><dd>{property ? <Link href={`/app/portfell/objekt/${property.id}`} className="text-primary">{property.name}</Link> : "—"}</dd>
                <dt>{t("assets.spaceType")}</dt><dd>{a.type ? tEnum("assets.spaceTypes", a.type) : "—"}</dd>
                <dt>{t("assets.floor")}</dt><dd>{a.floor ?? "—"}</dd>
                <dt>{t("assets.space.electrical")}</dt><dd>{a.electrical_capacity_a != null ? `${fmtNum(a.electrical_capacity_a)} A` : "—"}</dd>
                {SPACE_PART_KEYS.filter((k) => a.parts?.[k]).map((k) => <span key={k} className="contents"><dt>{tEnum("assets.partNames", k)}</dt><dd>{fmtNum(a.parts?.[k])} m²</dd></span>)}
              </dl>
            </CardBody>
          </Card>
          {former.length > 0 && (
            <Card>
              <CardHeader title={t("assets.space.formerUnits")} />
              <CardBody>
                <ul className="grid gap-2 text-sm">{former.map((u) => <li key={u.id} className="flex items-center gap-2"><Link href={`/app/portfell/pind/${u.id}`} className="text-primary font-semibold">{u.name}</Link><span className="text-muted">{fmtNum((u.attributes as Partial<SpaceAttributes> | undefined)?.rentable_area_m2)} m²</span><Pill tone={statusTone(u.status)} className="ml-auto">{tEnum("assets.status", u.status)}</Pill></li>)}</ul>
                <p className="text-xs text-muted mt-2">{t("assets.space.formerUnitsSub")}</p>
              </CardBody>
            </Card>
          )}
          <Card>
            <CardHeader title={t("assets.space.parking")} actions={property && (property.attributes as { has_parking?: boolean | null })?.has_parking !== false && <Button size="sm" variant="text" onClick={() => setSpotsDlg(true)}>{t("assets.parkingReg.editSpaceSpots")}</Button>} />
            <CardBody>
              {spots.length === 0 ? <p className="text-sm text-muted">{a.parking_spots ? `${a.parking_spots}` : t("assets.space.noParkingSpots")}</p> : <div className="flex flex-wrap gap-1">{spots.map((s) => <SpotChip key={s.id} s={s} title={`${tEnum("assets.parkingReg.statuses", s.status)}${s.contract ? ` · ${s.contract.number}` : ""}`} />)}</div>}
              {property && spots.length > 0 && <SpacePlanPreview propertyId={property.id} spaceId={p.id} />}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("assets.space.plan")} />
            <CardBody><AttachmentsList items={p.attachments} subjectType="asset" subjectId={p.id} role="floor_plan" compact /></CardBody>
          </Card>
        </div>
      </div>
      <Modal open={edit} onClose={() => setEdit(false)} title={t("assets.space.editTitle")} wide>
        {property && <SpaceForm propertyId={property.id} companyId={p.company_id} space={p} onDone={() => setEdit(false)} onCancel={() => setEdit(false)} standalone />}
      </Modal>
      {property && <SplitDialog open={split} onClose={() => setSplit(false)} space={p} />}
      {property && spotsDlg && <PropertySpotsDialog propertyId={property.id} spaceId={p.id} spaceName={p.name} onClose={() => setSpotsDlg(false)} />}
      <ConfirmDialog open={mergeDlg} onClose={() => setMergeDlg(false)} onConfirm={onMerge} busy={merge.isPending} title={t("assets.space.merge")}
        body={t("assets.space.mergeConfirm", { name: p.name, units: p.split_units.map((u) => u.name).join(" + ") })} />
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={onDelete} busy={remove.isPending} title={t("assets.space.delete")}
        body={<span>{t("assets.space.deleteConfirm", { name: p.name, area: fmtNum(a.rentable_area_m2), property: property?.name ?? "" })}{spots.length > 0 && <span className="block mt-1 text-muted">{t("assets.space.deleteParkingNote", { numbers: spots.map((s) => s.number).join(", ") })}</span>}</span>} />
    </div>
  );
}

/** The building's schematic with this space's spots highlighted; nothing until boxes have been drawn. */
function SpacePlanPreview({ propertyId, spaceId }: { propertyId: string; spaceId: string }) {
  const plan = useParkingPlan(propertyId);
  const prop = useAsset(propertyId);
  if (!plan.data || !prop.data) return null;
  const spaces = prop.data.children.filter((c) => c.type_code === "space");
  const mine = new Set(plan.data.spots.filter((s) => s.space_id === spaceId).map((s) => s.id));
  return <div className="mt-3"><ParkingPlanPreview plan={plan.data} spaces={spaces} highlight={mine} /></div>;
}

function PropertySpotsDialog({ propertyId, spaceId, spaceName, onClose }: { propertyId: string; spaceId: string; spaceName: string; onClose: () => void }) {
  const prop = useAsset(propertyId);
  if (!prop.data) return null;
  return <SpaceSpotsDialog propertyId={propertyId} spaceId={spaceId} spaceName={spaceName} spots={prop.data.parking_spots} open onClose={onClose} />;
}

function ContractRow({ al }: { al: Allocation }) {
  const c = al.contract;
  if (!c) return null;
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="min-w-0 flex-1">
        <Link href={`/app/portfell/leping/${c.id}`} className="block font-semibold text-primary truncate">{[c.number, c.party_name ?? c.title].filter(Boolean).join(" · ")}</Link>
        <span className="block text-xs text-muted">{t("assets.space.period")}: {fmtDate(al.period_start)} – {al.period_end ? fmtDate(al.period_end) : "…"} · {tEnum("contract.allocationKind", al.kind)}</span>
      </span>
      <Pill tone={statusTone(c.status)}>{tEnum("contract.status", c.status ?? "")}</Pill>
    </li>
  );
}

type UnitDraft = { name: string; price: string; area: string; parts: Record<SpacePartKey, string>; parking: string[] };
const emptyUnit = (): UnitDraft => ({ name: "", price: "", area: "", parts: { ladu: "", kontor: "", myygisaal: "", olmeala: "", yhisala: "" }, parking: [] });
const n = (v: string) => Number(String(v).replace(",", ".")) || 0;

/** Split a space into rental units (demo v588/v639): parts are divided between units; the sums must match the parent. */
function SplitDialog({ open, onClose, space }: { open: boolean; onClose: () => void; space: AssetDetail }) {
  const a = space.attributes as Partial<SpaceAttributes>;
  const splitMut = useSplitSpace(space.id);
  const toast = useToast();
  const parentParts = a.parts ?? {};
  const keys = SPACE_PART_KEYS.filter((k) => parentParts[k]);
  const mySpots = space.parking_spots;
  const former = space.former_units ?? [];
  const [units, setUnits] = useState<UnitDraft[]>(() => former.length >= 2
    ? former.map((u) => { const ua = (u.attributes ?? {}) as Partial<SpaceAttributes>; const parts = emptyUnit().parts; for (const k of keys) if (ua.parts?.[k]) parts[k] = String(ua.parts[k]); return { name: u.name, price: ua.price_per_m2 != null ? String(ua.price_per_m2) : "", area: ua.rentable_area_m2 != null ? String(ua.rentable_area_m2) : "", parts, parking: [] }; })
    : [
      { ...emptyUnit(), name: `${space.name}A`, price: a.price_per_m2 != null ? String(a.price_per_m2) : "" },
      { ...emptyUnit(), name: `${space.name}B`, price: a.price_per_m2 != null ? String(a.price_per_m2) : "" },
    ]);
  const setUnit = (i: number, patch: Partial<UnitDraft>) => setUnits((u) => u.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const byParts = keys.length > 0;  // without a parts breakdown on the parent, each unit states its rentable area
  const unitArea = (u: UnitDraft) => (byParts ? keys.reduce((s, k) => s + n(u.parts[k]), 0) : n(u.area));
  const total = units.reduce((s, u) => s + unitArea(u), 0);
  const leftover = (k: SpacePartKey) => Math.round(((parentParts[k] ?? 0) - units.reduce((s, u) => s + n(u.parts[k]), 0)) * 100) / 100;
  const save = async () => {
    const body: SplitUnitInput[] = units.map((u) => ({ name: u.name.trim(), price_per_m2: n(u.price), parking_numbers: u.parking,
      parts: byParts ? Object.fromEntries(keys.filter((k) => n(u.parts[k]) > 0).map((k) => [k, n(u.parts[k])])) : {}, ...(byParts ? {} : { rentable_area_m2: n(u.area) }) }));
    try { const res = await splitMut.mutateAsync(body); toast.success(t("assets.space.splitDone", { name: space.name, units: res.map((x) => x.name).join(" + ") })); onClose(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`${t("assets.space.splitTitle")} · ${space.name}`} sub={former.length >= 2 ? `${t("assets.space.splitSub")} ${t("assets.space.formerUnitsHint")}` : t("assets.space.splitSub")} wide
      footer={<><span className={cx("text-sm mr-auto font-mono", Math.abs(total - (a.rentable_area_m2 ?? 0)) > 0.05 ? "text-error" : "text-muted")}>{t("assets.space.unitsTotal", { sum: fmtNum(total), area: fmtNum(a.rentable_area_m2) })}</span><Button onClick={onClose}>{t("common.cancel")}</Button><Button variant="primary" busy={splitMut.isPending} onClick={save}>{t("assets.space.split")}</Button></>}>
      <div className="grid gap-4">
        {units.map((u, i) => (
          <div key={i} className="rounded-control p-3 border grid gap-2" style={{ borderColor: "var(--color-divider)" }}>
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Input label={t("assets.space.unitName")} value={u.name} onChange={(e) => setUnit(i, { name: e.target.value })} />
              <Input label={t("assets.space.unitPrice")} type="number" step="0.01" inputMode="decimal" value={u.price} onChange={(e) => setUnit(i, { price: e.target.value })} />
            </div>
            {!byParts && <Input label={t("assets.space.unitArea")} type="number" step="0.01" inputMode="decimal" value={u.area} hint={i === units.length - 1 && Math.abs(total - (a.rentable_area_m2 ?? 0)) > 0.05 ? `${total < (a.rentable_area_m2 ?? 0) ? "+" : ""}${fmtNum(Math.round(((a.rentable_area_m2 ?? 0) - total) * 100) / 100)}` : undefined} onChange={(e) => setUnit(i, { area: e.target.value })} />}
            {byParts && <div className="field-label">{t("assets.space.unitParts")} <span className="text-xs text-muted font-normal font-mono">· {fmtNum(unitArea(u))} m²</span></div>}
            {byParts && <div className="grid gap-x-3 grid-cols-2 sm:grid-cols-5">
              {keys.map((k) => <Input key={k} label={`${tEnum("assets.partNames", k)} (${fmtNum(parentParts[k])})`} type="number" step="0.01" inputMode="decimal" value={u.parts[k]} hint={i === units.length - 1 && leftover(k) !== 0 ? `${leftover(k) > 0 ? "+" : ""}${fmtNum(leftover(k))}` : undefined} onChange={(e) => setUnit(i, { parts: { ...u.parts, [k]: e.target.value } })} />)}
            </div>}
            {mySpots.length > 0 && (
              <div><div className="field-label">{t("assets.space.unitParking")}</div><div className="flex flex-wrap gap-1">{mySpots.map((s) => { const on = u.parking.includes(s.number); const elsewhere = !on && units.some((o) => o.parking.includes(s.number)); return <SpotChip key={s.id} s={s} on={on} onClick={() => !elsewhere && setUnit(i, { parking: on ? u.parking.filter((x) => x !== s.number) : [...u.parking, s.number] })} title={elsewhere ? t("assets.parkingPickTaken") : undefined} />; })}</div></div>
            )}
            {units.length > 2 && <Button size="sm" variant="text" className="w-fit" onClick={() => setUnits((x) => x.filter((_, j) => j !== i))}>{t("assets.space.removeUnit")}</Button>}
          </div>
        ))}
        <Button size="sm" className="w-fit" onClick={() => setUnits((x) => [...x, { ...emptyUnit(), name: `${space.name}${String.fromCharCode(65 + x.length)}`, price: a.price_per_m2 != null ? String(a.price_per_m2) : "" }])}>{t("assets.space.addUnit")}</Button>
      </div>
    </Modal>
  );
}
