"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "@/i18n";
import { cx, fmtNum } from "@/lib/format";
import { errorMessage } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useCompanies, useEhr, useSaveCompany } from "@/lib/queries/settings";
import { useAssets, useCreateAsset } from "@/lib/queries/portfolio";
import { useImports, useUploadImport, IMPORT_PENDING } from "@/lib/queries/imports";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Dropzone } from "@/components/ui/FileInput";
import { Pill } from "@/components/ui/Pill";
import { Spinner, Loading } from "@/components/ui/State";
import { AriregisterSearch } from "@/components/ui/AriregisterSearch";
import { useToast } from "@/components/ui/Toast";
import { IconArrowLeft, IconArrowRight, IconBuilding, IconCheck, IconChevronRight, IconGrid, IconInfo, IconLock, IconPlus, IconSearch } from "@/components/ui/Icons";
import { SpacesImport } from "@/features/assets/SpacesImport";
import { useSetupSteps, type SetupStep } from "./useSetupSteps";
import type { AriregisterHit, Asset, Company, EhrHit, ImportJob, PropertyAttributes } from "@/types/api";

const CONTRACT_EXT = new Set(["pdf", "docx", "asice", "bdoc", "sce"]);
const TABLE_EXT = new Set(["csv", "tsv", "txt", "xlsx", "xls", "ods", "numbers"]);
const ACCEPT = ".pdf,.docx,.asice,.bdoc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.etsi.asic-e+zip";

/** „Alusta · 10 minutit” (demo v623 `View.alusta`): ONE page — the four-step rail on the left, the active step's form on the right.
 *  Done-state comes from the data; confirming a step moves to the next unfinished one without leaving the page. */
export function SetupPage() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const setup = useSetupSteps();
  const companies = useCompanies();
  const properties = useAssets({ type_code: "property" });
  const imports = useImports();
  const [sel, setSel] = useState<number | null>(null);   // null = the first unfinished step (or the summary when all are done)
  const [redo, setRedo] = useState<number | null>(null);  // a done step opened again („Muuda”, „Lisa veel üks hoone”)

  const wanted = Number(params.get("step"));
  useEffect(() => { if (wanted >= 1 && wanted <= 4) setSel(wanted - 1); }, [wanted]);

  const steps = setup.steps;
  const first = steps?.findIndex((s) => !s.done) ?? -1;
  const current = steps ? (sel != null && sel >= 0 && sel < 4 ? sel : sel === -1 && first < 0 ? -1 : first) : -1;
  const refresh = () => { void qc.invalidateQueries({ queryKey: ["portfolio"] }); void setup.refetch(); };
  const after = (i: number) => { // the next unfinished step after i, else any unfinished one, else the summary
    if (!steps) return;
    let j = steps.findIndex((s, k) => k > i && !s.done);
    if (j < 0) j = steps.findIndex((s, k) => k !== i && !s.done);
    setRedo(null); setSel(j >= 0 ? j : -1);
  };
  const go = (i: number) => { setRedo(null); setSel(i); document.querySelector(".al-sisu")?.scrollIntoView({ block: "start", behavior: "smooth" }); };

  const companyName = companies.data?.[0]?.name;
  const propList = useMemo(() => (properties.data ?? []).filter((a) => a.type_code === "property"), [properties.data]);
  const openImports = useMemo(() => (imports.data ?? []).filter((j) => j.status !== "committed" && j.status !== "manual"), [imports.data]);

  if (!steps) return <Loading />;
  const done = steps.filter((s) => s.done).length;
  const complete = first < 0;
  const detail = (s: SetupStep): string => {
    if (s.key === "company") return companies.data?.map((c) => c.name).join(", ") || "";
    if (s.key === "building") return propList.map((p) => p.name).join(", ");
    if (s.key === "spaces") return t("setup.spaces.perBuilding", { n: s.count });
    return t("setup.contracts.doneLine", { n: s.count });
  };
  const status = (s: SetupStep) => s.done ? detail(s) : s.pending ? t("setup.statusPending", { n: openImports.length }) : s.index === first ? t("setup.statusNext", { min: s.min }) : t("setup.minutes", { min: s.min });
  const nextButton = (i: number) => {
    let j = steps.findIndex((s, k) => k > i && !s.done);
    if (j < 0) j = steps.findIndex((s, k) => k !== i && !s.done);
    return j >= 0
      ? <Button variant="primary" onClick={() => go(j)}>{t("setup.next", { step: steps[j].short })}<IconArrowRight width={16} height={16} /></Button>
      : <Button variant="primary" onClick={() => go(-1)}>{t("setup.summary")}<IconArrowRight width={16} height={16} /></Button>;
  };
  const later = (i: number) => <Button variant="text" size="sm" onClick={() => after(i)}>{t("setup.later")}</Button>;

  return (
    <div className="grid gap-5 max-w-[1100px]">
      <LinkButton href="/app" variant="ghost" size="sm" className="w-fit"><IconArrowLeft width={16} height={16} />{t("nav.avaleht")}</LinkButton>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="overline">{companyName ? t("setup.overline", { name: companyName }) : t("setup.overlineNew")}</div>
          <h1 className="page-h1 mt-1">{complete ? t("setup.titleDone") : t("setup.title")}</h1>
          <p className="page-sub">{complete ? t("setup.subDone") : t("setup.sub")}</p>
        </div>
        <div className="al-edu" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done} aria-label={t("setup.progress", { n: done })}>
          <div className="al-edu-a"><b>{done}</b><span>{t("setup.ofSteps")}</span></div>
          <div className="al-edu-riba">{steps.map((s) => <i key={s.key} className={s.done ? "ok" : s.pending ? "pool" : undefined} />)}</div>
          <small>{complete ? t("setup.allDone") : t("setup.leftShort", { min: setup.minutesLeft })}</small>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-[300px_minmax(0,1fr)] items-start">
        <nav className="card p-2.5 md:sticky md:top-20" aria-label={t("setup.railLabel")}>
          <ol className="grid gap-1">
            {steps.map((s) => {
              const on = s.index === current;
              return (
                <li key={s.key}>
                  <button type="button" onClick={() => go(s.index)} aria-current={on ? "step" : undefined}
                    className={cx("w-full flex items-center gap-3 px-3 py-[11px] rounded-control text-left transition-colors", on ? "bg-subtle shadow-[inset_0_0_0_1px_var(--line)]" : "hover:bg-subtle")}>
                    <span className={cx("w-7 h-7 rounded-[8px] grid place-items-center font-mono text-[12px] font-[650] flex-none", on ? "bg-ink text-onink" : s.done ? "text-success-ink bg-success-subtle" : s.pending ? "text-warning-ink bg-warning-subtle" : "text-ink2 shadow-[inset_0_0_0_1.5px_var(--line-strong)]")}>{s.done && !on ? <IconCheck width={12} height={12} /> : s.index + 1}</span>
                    <span className="min-w-0 grid gap-0.5"><b className="block text-[13.5px] font-semibold text-ink">{s.title}</b><small className="block text-[11.5px] text-muted truncate">{status(s)}</small></span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="al-rada-noot"><IconLock /><span>{t("setup.railNote")}</span></p>
        </nav>

        <div className="al-sisu min-w-0">
          {current < 0 ? (
            <DoneCard steps={steps} companies={companies.data ?? []} properties={propList} />
          ) : current === 0 ? (
            <StepCard i={0} step={steps[0]} title={t("setup.company.q")} sub={t("setup.company.sub")}>
              {steps[0].done && redo !== 0
                ? <CompanyDone companies={companies.data ?? []} footer={<><Link href="/app/seaded?tab=ettevotted" className="steplink">{t("setup.company.editInSettings")}</Link>{nextButton(0)}</>} />
                : <CompanyForm onDone={() => { refresh(); after(0); }} later={later(0)} />}
            </StepCard>
          ) : current === 1 ? (
            <StepCard i={1} step={steps[1]} title={t("setup.building.q")} sub={t("setup.building.sub")}>
              {steps[1].done && redo !== 1
                ? <BuildingDone properties={propList} footer={<><button type="button" className="steplink" onClick={() => setRedo(1)}>{t("setup.building.addAnother")}</button>{nextButton(1)}</>} />
                : <BuildingForm company={companies.data?.[0] ?? null} goCompany={() => go(0)} onDone={() => { refresh(); after(1); }} later={later(1)} />}
            </StepCard>
          ) : current === 2 ? (
            <StepCard i={2} step={steps[2]} title={t("setup.spaces.q")} sub={t("setup.spaces.sub")}>
              {steps[2].done && redo !== 2
                ? <SpacesDone properties={propList} footer={<><span className="flex gap-4 flex-wrap">{propList[0] && <Link href={`/app/portfell/objekt/${propList[0].id}?edit=1&step=2`} className="steplink">{t("setup.spaces.editor")}</Link>}{propList.some((p) => !p.children_count) && <button type="button" className="steplink" onClick={() => setRedo(2)}>{t("setup.spaces.addOther")}</button>}</span>{nextButton(2)}</>} />
                : <SpacesForm properties={propList} goBuilding={() => go(1)} onDone={() => { refresh(); void properties.refetch(); after(2); }} later={later(2)} />}
            </StepCard>
          ) : (
            <StepCard i={3} step={steps[3]} title={t("setup.contracts.q")} sub={t("setup.contracts.sub")}>
              {steps[3].done
                ? <ContractsDone n={steps[3].count} footer={<><Link href="/app/portfell/import" className="steplink">{t("setup.contracts.desk")}</Link>{nextButton(3)}</>} />
                : <ContractsForm open={openImports} onUploaded={() => { refresh(); void imports.refetch(); }} later={<Button variant="text" size="sm" onClick={() => router.push("/app")}>{t("setup.later")}</Button>} />}
            </StepCard>
          )}
        </div>
      </div>
    </div>
  );
}

function StepCard({ i, step, title, sub, children }: { i: number; step: SetupStep; title: string; sub: string; children: ReactNode }) {
  return (
    <section className="card overflow-hidden" data-i={i}>
      <header className="al-k-pea">
        <div className="overline">{t("setup.stepOf", { n: i + 1 })} · {step.done ? t("setup.statusDone") : step.pending ? t("setup.statusPendingShort") : t("setup.minutes", { min: step.min })}</div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </header>
      {children}
    </section>
  );
}
function Body({ children }: { children: ReactNode }) { return <div className="al-k-keha">{children}</div>; }
function Footer({ children }: { children: ReactNode }) { return <footer className="al-k-jalus">{children}</footer>; }
function DoneLine({ children }: { children: ReactNode }) { return <div className="flex items-center gap-2 text-sm font-semibold text-success-ink"><IconCheck width={16} height={16} className="flex-none" /><span>{children}</span></div>; }
function KV({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">{rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="min-w-0 break-words">{v ?? "—"}</dd></div>)}</dl>;
}
function Picked({ icon, title, sub, pill, children, onOther }: { icon: ReactNode; title: string; sub: string; pill?: ReactNode; children: ReactNode; onOther: () => void }) {
  return (
    <div className="rounded-control border p-4 grid gap-3" style={{ borderColor: "var(--line-strong)", background: "var(--surface-soft)" }}>
      <div className="flex items-center gap-3"><span className="w-9 h-9 rounded-control grid place-items-center bg-ink text-onink flex-none">{icon}</span><span className="min-w-0 flex-1"><b className="block text-sm font-semibold truncate">{title}</b><small className="block text-xs text-muted font-mono">{sub}</small></span>{pill}</div>
      {children}
      <div><button type="button" className="steplink" onClick={onOther}>{t("setup.pickOther")}</button></div>
    </div>
  );
}

/* --- 1 · company from äriregister ----------------------------------------------------------------------------- */
function CompanyForm({ onDone, later }: { onDone: () => void; later: ReactNode }) {
  const save = useSaveCompany();
  const toast = useToast();
  const [hit, setHit] = useState<AriregisterHit | null>(null);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState(""); const [code, setCode] = useState(""); const [address, setAddress] = useState("");
  const pick = (h: AriregisterHit, d: AriregisterHit | null) => setHit(d ? { ...h, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v != null && v !== "")) } as AriregisterHit : h);
  const ok = manual ? name.trim().length > 0 : !!hit;
  const confirm = async () => {
    const body = manual ? { name: name.trim(), registry_code: code.trim() || null, address: address.trim() || null, vat_number: null, email: null, phone: null, accent_color: null }
      : { name: hit!.name, registry_code: hit!.registry_code, address: hit!.address, vat_number: hit!.vat_number, email: hit!.email, phone: hit!.phone, accent_color: null };
    try { await save.mutateAsync(body); toast.success(t("setup.company.confirmed", { name: body.name })); onDone(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <>
      <Body>
        {manual ? (
          <div className="grid gap-1">
            <Input label={t("setup.company.name")} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="grid sm:grid-cols-2 gap-x-4"><Input label={t("setup.company.registryCode")} value={code} onChange={(e) => setCode(e.target.value)} /><Input label={t("setup.company.address")} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div><button type="button" className="steplink" onClick={() => setManual(false)}>{t("settings.companies.searchRegistry")}</button></div>
          </div>
        ) : hit ? (
          <Picked icon={<IconBuilding width={18} height={18} />} title={hit.name} sub={hit.registry_code} pill={hit.status ? <Pill>{hit.status}</Pill> : undefined} onOther={() => setHit(null)}>
            <div className="overline">{t("setup.company.knows")}</div>
            <KV rows={[[t("setup.company.address"), hit.address || "—"], [t("setup.company.legalForm"), hit.legal_form || "—"], [t("setup.company.vat"), hit.vat_number || "—"], [t("setup.company.source"), t("setup.company.sourceValue")]]} />
          </Picked>
        ) : (
          <>
            <AriregisterSearch id="al-reg" variant="setup" onPick={pick} />
            <div><button type="button" className="steplink" onClick={() => setManual(true)}>{t("setup.manual")}</button></div>
          </>
        )}
      </Body>
      <Footer>{later}<Button variant="primary" disabled={!ok} busy={save.isPending} onClick={confirm}><IconCheck width={16} height={16} />{t("setup.company.confirm")}</Button></Footer>
    </>
  );
}
function CompanyDone({ companies, footer }: { companies: Company[]; footer: ReactNode }) {
  const c = companies[0];
  return (
    <>
      <Body>
        <DoneLine>{t("setup.company.doneLine")}</DoneLine>
        {c && <KV rows={[[t("setup.company.company"), c.name], [t("setup.company.registryCode"), <span key="r" className="font-mono">{c.registry_code || "—"}</span>], ...(c.vat_number ? [[t("setup.company.vat"), <span key="v" className="font-mono">{c.vat_number}</span>] as [string, ReactNode]] : []), [t("setup.company.address"), c.address || "—"], [t("setup.company.source"), t("setup.company.sourceValue")]]} />}
      </Body>
      <Footer>{footer}</Footer>
    </>
  );
}

/* --- 2 · building from EHR ------------------------------------------------------------------------------------ */
function BuildingForm({ company, goCompany, onDone, later }: { company: Company | null; goCompany: () => void; onDone: () => void; later: ReactNode }) {
  const create = useCreateAsset();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);
  const ehr = useEhr(dq);
  const [hit, setHit] = useState<EhrHit | null>(null);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState(""); const [address, setAddress] = useState("");
  // EHR addresses run county → parish → village → street, so the street part (last) is the natural object name
  const pickHit = (h: EhrHit) => { setHit(h); setName(h.address.split(",").pop()?.trim() || h.address); setQ(""); };
  if (!company) {
    return (
      <>
        <Body><div className="note"><IconInfo /><span>{t("setup.building.noCompany")}</span></div></Body>
        <Footer><span />
          <Button variant="primary" onClick={goCompany}>{t("home.setup.company")}<IconArrowRight width={16} height={16} /></Button></Footer>
      </>
    );
  }
  const ok = name.trim().length > 0 && (manual ? address.trim().length > 0 : !!hit);
  const confirm = async () => {
    const attributes: PropertyAttributes = manual
      ? { address: address.trim(), ehr_code: null, use_type: null, footprint_m2: null, net_area_m2: null, floors: null, build_year: null, ehr_source: "manual", ehr_payload: null }
      : { address: hit!.address, ehr_code: hit!.ehr_code, use_type: hit!.use_type ?? null, footprint_m2: hit!.footprint_m2 ?? null, net_area_m2: hit!.net_area_m2 ?? null, floors: hit!.floors ?? null, build_year: hit!.build_year ?? null, ehr_source: hit!.ehr_payload ? "ehr" : "manual", ehr_payload: hit!.ehr_payload ?? null };
    try {
      await create.mutateAsync({ type_code: "property", name: name.trim(), company_id: company.id, attributes: attributes as Record<string, unknown> });
      toast.success(t("setup.building.confirmed", { name: name.trim() })); onDone();
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <>
      <Body>
        {manual ? (
          <div className="grid gap-1">
            <Input label={t("setup.building.name")} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Input label={t("setup.building.address")} required value={address} onChange={(e) => setAddress(e.target.value)} />
            <div><button type="button" className="steplink" onClick={() => setManual(false)}>{t("assets.ehrSearch")}</button></div>
          </div>
        ) : hit ? (
          <Picked icon={<IconBuilding width={18} height={18} />} title={hit.address} sub={`EHR ${hit.ehr_code}`} onOther={() => setHit(null)}>
            <div className="overline">{t("setup.building.knows")}</div>
            <KV rows={[[t("setup.building.useType"), hit.use_type || "—"], [t("setup.building.footprint"), hit.footprint_m2 != null ? `${fmtNum(hit.footprint_m2)} m²` : "—"], [t("setup.building.netArea"), hit.net_area_m2 != null ? `${fmtNum(hit.net_area_m2)} m²` : "—"], [t("setup.building.floors"), hit.floors ?? "—"], [t("setup.building.buildYear"), hit.build_year ?? "—"]]} />
            <Input label={t("setup.building.name")} required value={name} onChange={(e) => setName(e.target.value)} />
          </Picked>
        ) : (
          <>
            <div className="relative">
              <label className="flex items-center gap-2 fld h-12">
                <IconSearch width={16} height={16} className="text-muted flex-none" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("assets.ehrSearch")} aria-label={t("assets.ehrSearch")} className="flex-1 min-w-0 bg-transparent outline-none" autoFocus />
                {ehr.isFetching && <Spinner />}
              </label>
              {dq.length >= 2 && !ehr.isLoading && (
                <div className="mt-2 grid gap-2">
                  {(ehr.data ?? []).length === 0 ? <p className="text-sm text-muted px-1">{t("assets.ehrNoResults")}</p> : (ehr.data ?? []).slice(0, 8).map((h) => (
                    <button key={h.ehr_code} type="button" className="flex items-center gap-3 text-left p-3 rounded-control hover:bg-canvas border" style={{ borderColor: "var(--line)" }} onClick={() => pickHit(h)}>
                      <span className="w-9 h-9 rounded-control grid place-items-center text-muted flex-none bg-subtle"><IconBuilding width={18} height={18} /></span>
                      <span className="min-w-0 flex-1"><span className="block font-semibold text-sm truncate">{h.address}</span><span className="block text-xs text-muted">EHR {h.ehr_code}{h.use_type ? ` · ${h.use_type}` : ""}{h.build_year ? ` · ${h.build_year}` : ""}</span></span>
                      <span className="btn btn-ghost btn-sm">{t("assets.useResult")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div><button type="button" className="steplink" onClick={() => setManual(true)}>{t("setup.manual")}</button></div>
          </>
        )}
      </Body>
      <Footer>{later}<Button variant="primary" disabled={!ok} busy={create.isPending} onClick={confirm}><IconCheck width={16} height={16} />{t("setup.building.confirm")}</Button></Footer>
    </>
  );
}
function PropertyRow({ p, icon, sub }: { p: Asset; icon: ReactNode; sub: string }) {
  return (
    <Link href={`/app/portfell/objekt/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 -mx-1 rounded-control hover:bg-subtle">
      <span className="w-9 h-9 rounded-control grid place-items-center bg-subtle text-ink flex-none">{icon}</span>
      <span className="min-w-0 flex-1"><b className="block text-sm font-semibold truncate">{p.name}</b><small className="block text-xs text-muted truncate">{sub}</small></span>
      <IconChevronRight width={16} height={16} className="text-muted flex-none" />
    </Link>
  );
}
function BuildingDone({ properties, footer }: { properties: Asset[]; footer: ReactNode }) {
  return (
    <>
      <Body>
        <DoneLine>{properties.length === 1 ? t("setup.building.doneOne") : t("setup.building.doneMany", { n: properties.length })}</DoneLine>
        <div className="grid">{properties.map((p) => { const a = p.attributes as PropertyAttributes; return <PropertyRow key={p.id} p={p} icon={<IconBuilding width={18} height={18} />} sub={`${a.address || "—"}${a.ehr_code ? ` · EHR ${a.ehr_code}` : ""}`} />; })}</div>
      </Body>
      <Footer>{footer}</Footer>
    </>
  );
}

/* --- 3 · spaces from a table (the same import as the object wizard) ------------------------------------------- */
function SpacesForm({ properties, goBuilding, onDone, later }: { properties: Asset[]; goBuilding: () => void; onDone: () => void; later: ReactNode }) {
  const target = properties.find((p) => !p.children_count) ?? properties[0] ?? null;
  if (!target) {
    return (
      <>
        <Body><div className="note"><IconInfo /><span><b>{t("setup.spaces.noBuilding")}</b> {t("setup.spaces.noBuildingSub")}</span></div></Body>
        <Footer><span /><Button variant="primary" onClick={goBuilding}>{t("home.setup.building")}<IconArrowRight width={16} height={16} /></Button></Footer>
      </>
    );
  }
  return (
    <>
      <Body>
        <div className="flex items-center gap-2 text-sm"><IconBuilding width={16} height={16} className="text-muted flex-none" /><span>{t("setup.spaces.target")} <b>{target.name}</b></span></div>
        <SpacesImport propertyId={target.id} onDone={onDone} onCancel={goBuilding} />
        <Link href={`/app/portfell/objekt/${target.id}?edit=1&step=2`} className="flex items-center gap-3 p-3 rounded-control border hover:bg-subtle w-fit" style={{ borderColor: "var(--line)" }}>
          <span className="w-8 h-8 rounded-control grid place-items-center bg-subtle text-ink flex-none"><IconPlus width={16} height={16} /></span>
          <span><b className="block text-sm font-semibold">{t("setup.spaces.manual")}</b><small className="block text-xs text-muted">{t("setup.spaces.manualSub")}</small></span>
        </Link>
      </Body>
      <Footer>{later}<span /></Footer>
    </>
  );
}
function SpacesDone({ properties, footer }: { properties: Asset[]; footer: ReactNode }) {
  return (
    <>
      <Body>
        <DoneLine>{t("setup.spaces.doneLine")}</DoneLine>
        <div className="grid">{properties.filter((p) => p.children_count).map((p) => <PropertyRow key={p.id} p={p} icon={<IconGrid width={18} height={18} />} sub={t("setup.spaces.perBuilding", { n: p.children_count ?? 0 })} />)}</div>
      </Body>
      <Footer>{footer}</Footer>
    </>
  );
}

/* --- 4 · existing contracts → the import desk --------------------------------------------------------------- */
function ContractsForm({ open, onUploaded, later }: { open: ImportJob[]; onUploaded: () => void; later: ReactNode }) {
  const upload = useUploadImport();
  const toast = useToast();
  const onFiles = async (files: File[]) => {
    let n = 0;
    for (const f of files) {
      const ext = f.name.toLowerCase().split(".").pop() ?? "";
      if (TABLE_EXT.has(ext)) { toast.error(t("imports.csvNotHere", { name: f.name })); continue; }
      if (!CONTRACT_EXT.has(ext)) { toast.error(t("imports.unsupportedType", { name: f.name })); continue; }
      try { await upload.mutateAsync(f); n++; } catch (e) { toast.error(`${f.name}: ${errorMessage(e)}`); }
    }
    if (n) { toast.success(t("setup.contracts.uploaded", { n })); onUploaded(); }
  };
  if (open.length > 0) {
    const n = (...st: string[]) => open.filter((j) => st.includes(j.status)).length;
    const stat = (v: number, label: string, warn?: boolean) => <div className={cx("card px-4 py-3", warn && v > 0 && "shadow-[inset_0_0_0_1px_var(--amber)]")}><b className="font-heading text-2xl font-[650] tabular-nums block">{v}</b><span className="text-xs text-muted">{label}</span></div>;
    return (
      <>
        <Body>
          <div className="grid grid-cols-3 gap-3">{stat(n("review"), t("setup.contracts.needsReview"), true)}{stat(n(...IMPORT_PENDING), t("setup.contracts.reading"))}{stat(n("failed"), t("setup.contracts.failed"))}</div>
          <div className="note"><IconInfo /><span>{t("setup.contracts.pendingNote", { n: open.length })}</span></div>
          <Dropzone onFiles={onFiles} multiple accept={ACCEPT} label={upload.isPending ? t("imports.uploading") : t("setup.contracts.drop")} hint={t("setup.contracts.dropHint")} busy={upload.isPending} />
        </Body>
        <Footer>{later}<LinkButton href="/app/portfell/import" variant="primary">{t("setup.contracts.continueDesk")}<IconArrowRight width={16} height={16} /></LinkButton></Footer>
      </>
    );
  }
  return (
    <>
      <Body><Dropzone onFiles={onFiles} multiple accept={ACCEPT} label={upload.isPending ? t("imports.uploading") : t("setup.contracts.drop")} hint={t("setup.contracts.dropHint")} busy={upload.isPending} /></Body>
      <Footer>{later}<LinkButton href="/app/portfell/import" variant="primary">{t("setup.contracts.openDesk")}<IconArrowRight width={16} height={16} /></LinkButton></Footer>
    </>
  );
}
function ContractsDone({ n, footer }: { n: number; footer: ReactNode }) {
  return (
    <>
      <Body>
        <DoneLine>{t("setup.contracts.doneLine", { n })}</DoneLine>
        <div className="note"><IconInfo /><span>{t("setup.contracts.doneNote")}</span></div>
      </Body>
      <Footer>{footer}</Footer>
    </>
  );
}

/* --- all four done -------------------------------------------------------------------------------------------- */
function DoneCard({ steps, companies, properties }: { steps: SetupStep[]; companies: Company[]; properties: Asset[] }) {
  return (
    <section className="card px-[var(--card-padding)] py-8 grid gap-5 text-center justify-items-center">
      <span className="w-12 h-12 rounded-full grid place-items-center bg-success-subtle text-success-ink"><IconCheck width={22} height={22} /></span>
      <div><h2 className="font-heading text-2xl font-[650] tracking-[-.02em]">{t("setup.done.title")}</h2><p className="text-sm text-muted mt-1 max-w-[52ch]">{t("setup.done.sub")}</p></div>
      <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-left w-full max-w-[560px]">
        <div><dt className="overline">{t("setup.done.company")}</dt><dd className="mt-1 font-semibold">{companies.map((c) => c.name).join(", ") || "—"}</dd></div>
        <div><dt className="overline">{properties.length === 1 ? t("setup.done.building") : t("setup.done.buildings")}</dt><dd className="mt-1 font-semibold">{properties.map((p) => p.name).join(", ") || "—"}</dd></div>
        <div><dt className="overline">{t("setup.done.spaces")}</dt><dd className="mt-1 font-semibold">{t("setup.spaces.perBuilding", { n: steps[2].count })}</dd></div>
        <div><dt className="overline">{t("setup.done.contracts")}</dt><dd className="mt-1 font-semibold">{t("setup.done.contractsValue", { n: steps[3].count })}</dd></div>
      </dl>
      <div className="flex gap-2 flex-wrap justify-center"><LinkButton href="/app/portfell" variant="primary">{t("setup.done.openPortfolio")}<IconArrowRight width={16} height={16} /></LinkButton><LinkButton href="/app">{t("setup.done.openHome")}</LinkButton></div>
    </section>
  );
}
