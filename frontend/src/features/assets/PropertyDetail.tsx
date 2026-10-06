"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useAsset, useDeleteAsset } from "@/lib/queries/portfolio";
import { openAttachment, useCompanies } from "@/lib/queries/settings";
import { Card, CardHeader, CardBody, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconEdit, IconFile, IconPlus, IconTrash } from "@/components/ui/Icons";
import { fmtNum } from "@/lib/format";
import { SpacesTable } from "./SpacesTable";
import { SpotChip } from "./ParkingRegister";
import { AttachmentsList } from "@/features/contracts/AttachmentsList";
import type { AssetChild, PropertyAttributes } from "@/types/api";

export function PropertyDetail({ id }: { id: string }) {
  const q = useAsset(id);
  const companies = useCompanies();
  const remove = useDeleteAsset();
  const toast = useToast();
  const router = useRouter();
  const [del, setDel] = useState(false);
  if (q.isLoading) return <Loading rows={5} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const p = q.data;
  const a = p.attributes as PropertyAttributes;
  const spaces = p.children.filter((c) => c.type_code === "space" && c.status !== "jagatud").sort((x, y) => x.name.localeCompare(y.name, "et", { numeric: true }));
  const occupied = spaces.filter((s) => s.status === "üüritud" || s.status === "täidetud").length;
  const free = spaces.filter((s) => s.status === "vaba").length;
  const company = companies.data?.find((c) => c.id === p.company_id);
  const spots = p.parking_spots;
  const freeSpots = spots.filter((s) => s.status === "vaba").length;
  const floorPlanLink = (s: AssetChild) => {
    const plan = s.attachments.find((x) => x.role === "floor_plan");  // newest first
    return plan && <button type="button" className="icon-btn !w-6 !h-6 text-muted" aria-label={`${t("assets.floorPlan")} — ${s.name}`} title={plan.filename} onClick={() => openAttachment(plan.id).catch((e) => toast.error(errorMessage(e)))}><IconFile width={14} height={14} /></button>;
  };
  const onDelete = async () => { try { await remove.mutateAsync(id); toast.success(t("assets.propertyDeleted")); router.replace("/app/portfell?tab=esemed"); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div className="grid gap-5">
      <LinkButton href="/app/portfell?tab=esemed" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("portfolio.tabs.assets")}</LinkButton>
      <PageHead title={p.name} sub={<span>{a.address ?? t("portfolio.assets.noAddress")}{a.ehr_code ? ` · EHR ${a.ehr_code}` : ""}{company ? ` · ${company.name}` : ""}</span>}
        actions={<><LinkButton href={`/app/portfell/objekt/${id}?edit=1`} variant="primary"><IconEdit width={16} height={16} />{t("common.edit")}</LinkButton><Button variant="text" className="btn-destructive" onClick={() => setDel(true)} disabled={!!p.delete_block_reason} title={p.delete_block_reason ?? undefined}><IconTrash width={16} height={16} />{t("assets.deleteProperty")}</Button></>} />
      <div className="flex flex-wrap gap-1"><Pill>{t("portfolio.assets.spaces", { n: spaces.length })}</Pill><Pill tone="success">{t("portfolio.assets.occupancy", { occupied, total: spaces.length })}</Pill>{free > 0 && <Pill tone="primary">{t("portfolio.assets.free", { n: free })}</Pill>}{spots.length > 0 && <Pill tone="info">{t("assets.summaryParking", { n: spots.length })}</Pill>}</div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start">
        <div className="grid gap-5">
          <Card>
            <CardHeader title={t("assets.spaces")} actions={<><LinkButton href={`/app/portfell/objekt/${id}?edit=1&step=3`} size="sm" variant="text"><IconUploadSmall />{t("assets.plans.title")}</LinkButton><LinkButton href={`/app/portfell/objekt/${id}?edit=1&step=2`} size="sm"><IconPlus width={14} height={14} />{t("assets.addSpace")}</LinkButton></>} />
            {spaces.length === 0 ? <EmptyState title={t("assets.noSpaces")} sub={t("assets.noSpacesSub")} /> : <SpacesTable spaces={spaces} nameAddon={floorPlanLink} />}
          </Card>
          <Card>
            <CardHeader title={t("assets.parkingReg.title")} actions={<LinkButton href={`/app/portfell/objekt/${id}/parkimine`} size="sm">{spots.length ? t("assets.parkingReg.manage") : t("assets.parkingReg.add")}</LinkButton>} />
            <CardBody>
              {spots.length === 0 ? <p className="text-sm text-muted">{a.has_parking === false ? t("assets.parkingReg.noneSet") : t("assets.parkingReg.empty")}</p> : (
                <div className="grid gap-2">
                  <div className="flex gap-1 flex-wrap"><Pill>{t("assets.parkingReg.spots", { n: spots.length })}</Pill><Pill tone="primary">{t("assets.parkingReg.free", { n: freeSpots })}</Pill></div>
                  <div className="flex flex-wrap gap-1">{spots.map((s) => <SpotChip key={s.id} s={s} title={`${tEnum("assets.parkingReg.statuses", s.status)}${s.space_name ? ` · ${s.space_name}` : ""}`} />)}</div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
        <div className="grid gap-5">
          <Card>
            <CardHeader title={t("assets.detailsTab")} />
            <CardBody>
              <dl className="kv">
                <dt>{t("assets.useType")}</dt><dd>{a.use_type ?? "—"}</dd>
                <dt>{t("assets.footprint")}</dt><dd>{fmtNum(a.footprint_m2)}</dd>
                <dt>{t("assets.netArea")}</dt><dd>{fmtNum(a.net_area_m2)}</dd>
                <dt>{t("assets.floors")}</dt><dd>{fmtNum(a.floors)}</dd>
                <dt>{t("assets.buildYear")}</dt><dd>{a.build_year ?? "—"}</dd>
                <dt>{t("assets.vatTaxable")}</dt><dd>{a.vat_taxable == null ? "—" : a.vat_taxable ? t("common.yes") : t("common.no")}</dd>
                <dt>{t("assets.utilityWinter")}</dt><dd>{fmtNum(a.utility_cost_winter)}</dd>
                <dt>{t("assets.utilitySummer")}</dt><dd>{fmtNum(a.utility_cost_summer)}</dd>
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("assets.allocations")} />
            <CardBody>
              {p.allocations.length === 0 ? <p className="text-sm text-muted">{t("assets.noAllocations")}</p> : (
                <ul className="grid gap-2 text-sm">{p.allocations.map((al) => (
                  <li key={al.id} className="flex items-center gap-2">
                    {al.contract ? <Link href={`/app/portfell/leping/${al.contract.id}`} className="text-primary font-semibold truncate">{[al.contract.number, al.contract.party_name ?? al.contract.title].filter(Boolean).join(" · ")}</Link> : <span>{al.asset?.name ?? "—"}</span>}
                    <span className="pill ml-auto">{tEnum("contract.allocationKind", al.kind)}</span>
                  </li>
                ))}</ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={t("assets.attachmentsList")} />
            <CardBody><AttachmentsList items={p.attachments} subjectType="asset" subjectId={p.id} /></CardBody>
          </Card>
        </div>
      </div>
      <ConfirmDialog open={del} onClose={() => setDel(false)} onConfirm={onDelete} busy={remove.isPending} title={t("assets.deleteProperty")} body={t("assets.deletePropertyConfirm", { name: p.name })} />
    </div>
  );
}

function IconUploadSmall() { return <IconFile width={14} height={14} />; }
