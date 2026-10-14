"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { t, tEnum } from "@/i18n";
import { useAssets, useCreateAsset } from "@/lib/queries/portfolio";
import { useCompanies } from "@/lib/queries/settings";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconBuilding, IconPlus, IconUsers } from "@/components/ui/Icons";
import { Pill, statusTone } from "@/components/ui/Pill";
import { fmtEur } from "@/lib/format";
import type { Asset } from "@/types/api";

export function AssetsTab() {
  const props = useAssets({ type_code: "property" });
  const spaces = useAssets({ type_code: "space" });
  const companies = useCompanies();
  const byCompany = new Map((companies.data ?? []).map((c) => [c.id, c.name]));
  const spacesOf = (p: Asset) => (spaces.data ?? []).filter((s) => s.parent_id === p.id);
  return (
    <div className="grid gap-4">
      <div className="flex justify-end"><LinkButton href="/app/portfell/objekt/uus" variant="primary"><IconPlus width={16} height={16} />{t("portfolio.assets.addProperty")}</LinkButton></div>
      {props.isLoading ? <Loading /> : props.error ? <ErrorState error={props.error} onRetry={() => props.refetch()} /> : (props.data ?? []).length === 0 ? (
        <Card><EmptyState icon={<IconBuilding width={40} height={40} />} title={t("portfolio.assets.empty")} sub={t("portfolio.assets.emptySub")} action={<LinkButton href="/app/portfell/objekt/uus" variant="primary">{t("portfolio.assets.addProperty")}</LinkButton>} /></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(props.data ?? []).map((p) => {
            const sp = spacesOf(p);
            const total = sp.length || p.children_count || 0;
            const occupied = sp.filter((s) => s.status === "üüritud" || s.status === "täidetud").length;
            const partial = sp.filter((s) => s.status === "osaliselt").length;
            const free = sp.filter((s) => s.status === "vaba").length;
            const pct = total ? Math.round(((occupied + partial * 0.5) / total) * 100) : 0;
            const addr = (p.attributes.address as string | undefined) ?? "";
            return (
              <Link key={p.id} href={`/app/portfell/objekt/${p.id}`} className="card pad hover:shadow-floating transition-shadow flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-control grid place-items-center text-primary flex-none" style={{ background: "var(--color-primary-subtle)" }}><IconBuilding /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-semibold text-base truncate">{p.name}</div>
                    <div className="text-xs text-muted truncate">{addr || t("portfolio.assets.noAddress")}</div>
                    {p.company_id && byCompany.get(p.company_id) && <div className="text-xs text-muted truncate">{byCompany.get(p.company_id)}</div>}
                  </div>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--color-surface-subtle)" }}><div className="h-full rounded-full" style={{ width: `${pct}%`, background: "var(--color-success-vivid, #22C55E)" }} /></div>
                <div className="flex flex-wrap gap-1 text-xs">
                  <Pill>{t("portfolio.assets.spaces", { n: total })}</Pill>
                  <Pill tone="success">{t("portfolio.assets.occupancy", { occupied, total })}</Pill>
                  {free > 0 && <Pill tone="primary">{t("portfolio.assets.free", { n: free })}</Pill>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      <EmploymentSection />
    </div>
  );
}

// ---------------------------------------------------------------- Osakonnad ja ametikohad --------------------------

/** The employment vertical's asset UI: departments (containers) with their positions (units; capacity = headcount) — minimal but complete. */
function EmploymentSection() {
  const departments = useAssets({ type_code: "department" });
  const positions = useAssets({ type_code: "position" });
  const [addDept, setAddDept] = useState(false);
  const [addPosFor, setAddPosFor] = useState<Asset | null>(null);
  const depts = departments.data ?? [];
  const positionsOf = (d: Asset) => (positions.data ?? []).filter((p) => p.parent_id === d.id);
  const orphans = (positions.data ?? []).filter((p) => !p.parent_id || !depts.some((d) => d.id === p.parent_id));
  return (
    <Card>
      <CardHeader title={t("assets.employment.title")} actions={<Button size="sm" onClick={() => setAddDept(true)}><IconPlus width={14} height={14} />{t("assets.employment.addDepartment")}</Button>}>
        <p className="text-sm text-muted">{t("assets.employment.sub")}</p>
      </CardHeader>
      {departments.isLoading || positions.isLoading ? <div className="card-b"><Loading /></div> : departments.error ? <div className="card-b"><ErrorState error={departments.error} onRetry={() => departments.refetch()} /></div> : depts.length === 0 && orphans.length === 0 ? (
        <EmptyState icon={<IconUsers width={40} height={40} />} title={t("assets.employment.empty")} sub={t("assets.employment.emptySub")} action={<Button variant="primary" onClick={() => setAddDept(true)}>{t("assets.employment.addDepartment")}</Button>} />
      ) : (
        <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
          {depts.map((d) => <DepartmentRow key={d.id} dept={d} positions={positionsOf(d)} onAddPosition={() => setAddPosFor(d)} />)}
          {orphans.length > 0 && <DepartmentRow dept={null} positions={orphans} />}
        </ul>
      )}
      <DepartmentModal open={addDept} onClose={() => setAddDept(false)} />
      <PositionModal dept={addPosFor} onClose={() => setAddPosFor(null)} />
    </Card>
  );
}

function DepartmentRow({ dept, positions, onAddPosition }: { dept: Asset | null; positions: Asset[]; onAddPosition?: () => void }) {
  return (
    <li className="px-[var(--card-padding)] py-3 grid gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="w-9 h-9 rounded-control grid place-items-center flex-none text-muted" style={{ background: "var(--color-surface-subtle)" }}><IconUsers width={18} height={18} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold truncate">{dept?.name ?? t("lease.wizard.employment.noDepartment")}</span>
          <span className="block text-xs text-muted">{positions.length === 0 ? t("assets.employment.noPositions") : t("assets.employment.positions", { n: positions.length })}</span>
        </span>
        {onAddPosition && <Button size="sm" variant="text" onClick={onAddPosition}><IconPlus width={14} height={14} />{t("assets.employment.addPosition")}</Button>}
      </div>
      {positions.length > 0 && (
        <ul className="grid gap-1 sm:pl-12">
          {positions.map((p) => {
            const a = p.attributes as { duties?: string | null; salary?: number | string | null; headcount?: number | null };
            const total = p.capacity ?? Number(a.headcount ?? 1);
            return (
              <li key={p.id} className="flex items-center gap-3 text-sm flex-wrap py-1">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{p.name}</span>
                  {a.duties && <span className="block text-xs text-muted truncate">{a.duties}</span>}
                </span>
                <span className="text-xs text-muted tabular-nums">{p.occupancy ? t("assets.employment.occupancy", { occupied: p.occupancy.occupied, total: p.occupancy.units || total }) : t("assets.employment.headcountN", { n: total })}{a.salary != null && a.salary !== "" ? ` · ${fmtEur(Number(a.salary))}` : ""}</span>
                <Pill tone={statusTone(p.status)}>{tEnum("assets.status", p.status)}</Pill>
                <Link href={`/app/portfell/leping/uus?kind=employment`} className="text-primary text-xs font-semibold whitespace-nowrap">{t("home.createLease")} →</Link>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}

function DepartmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useCreateAsset();
  const toast = useToast();
  const [name, setName] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try { await create.mutateAsync({ type_code: "department", name: name.trim(), attributes: {} }); toast.success(t("assets.employment.departmentSaved")); setName(""); onClose(); } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t("assets.employment.addDepartment")} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" form="dept-form" variant="primary" busy={create.isPending} disabled={!name.trim()}>{t("common.add")}</Button></>}>
      <form id="dept-form" onSubmit={submit} noValidate>
        <Input label={t("assets.employment.departmentName")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </form>
    </Modal>
  );
}

function PositionModal({ dept, onClose }: { dept: Asset | null; onClose: () => void }) {
  const create = useCreateAsset();
  const toast = useToast();
  const [name, setName] = useState("");
  const [duties, setDuties] = useState("");
  const [requirements, setRequirements] = useState("");
  const [salary, setSalary] = useState("");
  const [headcount, setHeadcount] = useState("1");
  const reset = () => { setName(""); setDuties(""); setRequirements(""); setSalary(""); setHeadcount("1"); };
  const hc = Math.max(1, Math.round(Number(headcount) || 1));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!dept || !name.trim()) return;
    const sal = salary.trim() === "" ? null : Number(salary.replace(",", "."));
    try {
      await create.mutateAsync({ type_code: "position", name: name.trim(), parent_id: dept.id, company_id: dept.company_id ?? undefined, capacity: hc,
        attributes: { duties: duties.trim() || null, requirements: requirements.trim() || null, salary: sal !== null && Number.isFinite(sal) ? sal : null, headcount: hc } });
      toast.success(t("assets.employment.positionSaved")); reset(); onClose();
    } catch (err) { toast.error(errorMessage(err)); }
  };
  return (
    <Modal open={!!dept} onClose={onClose} title={t("assets.employment.addPosition")} sub={dept?.name} footer={<><Button onClick={onClose}>{t("common.cancel")}</Button><Button type="submit" form="pos-form" variant="primary" busy={create.isPending} disabled={!name.trim()}>{t("common.add")}</Button></>}>
      <form id="pos-form" onSubmit={submit} noValidate>
        <Input label={t("assets.employment.positionName")} value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Textarea label={t("assets.employment.duties")} rows={3} value={duties} onChange={(e) => setDuties(e.target.value)} />
        <Textarea label={t("assets.employment.requirements")} rows={2} value={requirements} onChange={(e) => setRequirements(e.target.value)} />
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input label={t("assets.employment.salary")} type="number" min={0} step="0.01" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} />
          <Input label={t("assets.employment.headcount")} type="number" min={1} step="1" inputMode="numeric" value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
