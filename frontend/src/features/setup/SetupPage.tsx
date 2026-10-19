"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { t } from "@/i18n";
import { cx, fmtDate, fmtNum } from "@/lib/format";
import { errorMessage, API_BASE } from "@/lib/api";
import { useDebounced } from "@/lib/hooks";
import { useCompanies, useEhr, useSaveCompany } from "@/lib/queries/settings";
import { useAssets, useCreateAsset, useImportSpaces } from "@/lib/queries/portfolio";
import { useImports, useUploadImport, IMPORT_PENDING } from "@/lib/queries/imports";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Dropzone } from "@/components/ui/FileInput";
import { Spinner, Loading } from "@/components/ui/State";
import { AriregisterSearch, hitAddress } from "@/components/ui/AriregisterSearch";
import { useToast } from "@/components/ui/Toast";
import { IconAlert, IconArrowLeft, IconArrowRight, IconBuilding, IconCheck, IconChevronRight, IconGrid, IconInfo, IconLock, IconPlus, IconSearch, IconUpload } from "@/components/ui/Icons";
import { useSetupSteps, type SetupStep } from "./useSetupSteps";
import type { AriregisterHit, Asset, Company, EhrHit, ImportJob, PropertyAttributes, SpaceImportResult } from "@/types/api";

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
  const later = (i: number) => <button type="button" className="steplink" onClick={() => after(i)}>{t("setup.later")}</button>;

  return (
    <div className="max-w-[1100px]">
      <LinkButton href="/app" variant="ghost" size="sm" className="w-fit mb-[18px]"><IconArrowLeft width={16} height={16} />{t("nav.avaleht")}</LinkButton>
      <div className="al-pea">
        <div className="min-w-0">
          <div className="overline">{companyName ? t("setup.overline", { name: companyName }) : t("setup.overlineNew")}</div>
          <h1 className="page-h1 mt-2">{complete ? t("setup.titleDone") : t("setup.title")}</h1>
          <p className="page-sub">{complete ? t("setup.subDone") : t("setup.sub")}</p>
        </div>
        <div className="al-edu" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done} aria-label={t("setup.progress", { n: done })}>
          <div className="al-edu-a"><b>{done}</b><span>{t("setup.ofSteps")}</span></div>
          <div className="al-edu-riba">{steps.map((s) => <i key={s.key} className={s.done ? "ok" : s.pending ? "pool" : undefined} />)}</div>
          <small>{complete ? t("setup.allDone") : t("setup.leftShort", { min: setup.minutesLeft })}</small>
        </div>
      </div>

      <div className="al-grid">
        <nav className="card al-rada" aria-label={t("setup.railLabel")}>
          <ol>
            {steps.map((s) => (
              <li key={s.key} className={cx(s.done && "ok", s.index === current && "on", s.pending && "pool")}>
                <button type="button" onClick={() => go(s.index)} aria-current={s.index === current ? "step" : undefined}>
                  <span className="al-nr">{s.done ? <IconCheck /> : s.index + 1}</span>
                  <span className="al-tx"><b>{s.title}</b><small>{status(s)}</small></span>
                </button>
              </li>
            ))}
          </ol>
          <p className="al-rada-noot"><IconLock /><span>{t("setup.railNote")}</span></p>
        </nav>

        <div className="al-sisu min-w-0">
          {current < 0 ? (
            <DoneCard steps={steps} companies={companies.data ?? []} properties={propList} />
          ) : current === 0 ? (
            <StepCard i={0} step={steps[0]} title={t("setup.company.q")} sub={t("setup.company.sub")}>
              {steps[0].done && redo !== 0
                ? <CompanyDone companies={companies.data ?? []} footer={<><Link href="/app/seaded?tab=ettevotted" className="steplink">{t("setup.change")}</Link>{nextButton(0)}</>} />
                : <CompanyForm onDone={() => { refresh(); after(0); }} later={later(0)} />}
            </StepCard>
          ) : current === 1 ? (
            <StepCard i={1} step={steps[1]} title={t("setup.building.q")} sub={t("setup.building.sub")}>
              {steps[1].done && redo !== 1
                ? <BuildingDone properties={propList} footer={<><button type="button" className="steplink" onClick={() => setRedo(1)}>{t("setup.building.addAnother")}</button>{nextButton(1)}</>} />
                : <BuildingForm company={companies.data?.[0] ?? null} existing={propList} goCompany={() => go(0)} onDone={() => { refresh(); after(1); }} later={later(1)} />}
            </StepCard>
          ) : current === 2 ? (
            <StepCard i={2} step={steps[2]} title={t("setup.spaces.q")} sub={t("setup.spaces.sub")}>
              {steps[2].done && redo !== 2
                ? <SpacesDone properties={propList} footer={<><span className="al-jalus-l">{propList[0] && <Link href={`/app/portfell/objekt/${propList[0].id}?edit=1&step=2`} className="steplink">{t("setup.spaces.editor")}</Link>}{propList.some((p) => !p.children_count) && <button type="button" className="steplink" onClick={() => setRedo(2)}>{t("setup.spaces.addOther")}</button>}</span>{nextButton(2)}</>} />
                : <SpacesForm properties={propList} goBuilding={() => go(1)} onDone={() => { refresh(); void properties.refetch(); after(2); }} later={later(2)} />}
            </StepCard>
          ) : (
            <StepCard i={3} step={steps[3]} title={t("setup.contracts.q")} sub={t("setup.contracts.sub")}>
              {steps[3].done
                ? <ContractsDone n={steps[3].count} footer={<><Link href="/app/portfell/import" className="steplink">{t("setup.contracts.desk")}</Link>{first < 0 ? <LinkButton href="/app/portfell" variant="primary">{t("setup.done.openPortfolio")}<IconArrowRight width={16} height={16} /></LinkButton> : nextButton(3)}</>} />
                : <ContractsForm open={openImports} onUploaded={() => { refresh(); void imports.refetch(); }} later={<button type="button" className="steplink" onClick={() => router.push("/app")}>{t("setup.later")}</button>} />}
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
function DoneLine({ children }: { children: ReactNode }) { return <div className="al-tehtud"><IconCheck /><span>{children}</span></div>; }
function Note({ children }: { children: ReactNode }) { return <p className="al-noot"><IconInfo /><span>{children}</span></p>; }
function Empty({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) { return <div className="al-tyhi"><b>{title}</b>{sub && <span>{sub}</span>}{children}</div>; }
function KV({ rows }: { rows: [string, ReactNode, boolean?][] }) {
  return <dl className="al-kv">{rows.map(([k, v, mono]) => <div key={k} className="contents"><dt>{k}</dt><dd className={mono ? "mono" : undefined}>{v ?? "—"}</dd></div>)}</dl>;
}
function Picked({ title, sub, pill, children, actions }: { title: string; sub: string; pill?: ReactNode; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="al-valik">
      <div className="al-valik-pea"><span className="al-valik-ik"><IconBuilding /></span><div className="al-valik-t"><b>{title}</b><small className="tabular-nums">{sub}</small></div>{pill}</div>
      {children}
      <div className="al-valik-teg">{actions}</div>
    </div>
  );
}
function Chips({ label, items }: { label?: string; items: { t: string; s?: string; on: () => void }[] }) {
  return <div className="al-naited">{label && <span>{label}</span>}{items.map((n) => <button key={n.t} type="button" className="al-naide" onClick={n.on}>{n.t}{n.s && <span className="al-naide-s">{n.s}</span>}</button>)}</div>;
}
function ObjRow({ href, icon, title, sub }: { href: string; icon: ReactNode; title: string; sub: string }) {
  return <Link href={href} className="al-obj-r"><span className="al-valik-ik">{icon}</span><span className="al-pick-t"><b>{title}</b><small>{sub}</small></span><IconChevronRight /></Link>;
}
// EHR addresses run county → parish → village → street; the demo reads them street first, without the county.
const ehrAddress = (a: string) => { const p = a.split(",").map((x) => x.trim()).filter(Boolean); return /maakond/i.test(p[0] ?? "") ? p.slice(1).reverse().join(", ") : a; };
const REGISTERED = new Set(["R", "registrisse kantud"]);

/* --- 1 · company from äriregister ----------------------------------------------------------------------------- */
// The demo's two example companies (`AL_REG_NAITED`) — one click fills the search.
const REG_EXAMPLES = [{ t: "Taevavärava OÜ", q: "16333502" }, { t: "B11G OÜ", q: "16614862" }];
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
      : { name: hit!.name, registry_code: hit!.registry_code, address: hitAddress(hit!) || null, vat_number: hit!.vat_number, email: hit!.email, phone: hit!.phone, accent_color: null };
    try { await save.mutateAsync(body); toast.success(t("setup.company.confirmed", { name: body.name })); onDone(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const registered = !hit?.status || REGISTERED.has(hit.status) || REGISTERED.has(hit.status.toLowerCase());
  return (
    <>
      <Body>
        {manual ? (
          <div className="grid gap-1">
            <Input label={t("setup.company.name")} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <div className="grid sm:grid-cols-2 gap-x-4"><Input label={t("setup.company.registryCode")} value={code} onChange={(e) => setCode(e.target.value)} /><Input label={t("setup.company.address")} value={address} onChange={(e) => setAddress(e.target.value)} /></div>
            <div><button type="button" className="steplink" onClick={() => setManual(false)}>{t("settings.companies.searchRegistry")}</button></div>
          </div>
        ) : (
          <>
            <AriregisterSearch id="al-reg" variant="setup" onPick={pick} picked={!!hit} onQuery={() => setHit(null)} examples={REG_EXAMPLES} examplesLabel={t("setup.company.examples")} />
            {hit ? (
              <Picked title={hit.name} sub={hit.registry_code} pill={hit.status ? <span className={cx("al-seis", registered ? "green" : "amber")}>{registered ? t("setup.company.status_registered") : hit.status}</span> : undefined}
                actions={<><button type="button" className="steplink" onClick={() => { setHit(null); document.getElementById("al-reg")?.focus(); }}>{t("setup.pickOther")}</button><a className="steplink" href={`https://ariregister.rik.ee/est/company/${hit.registry_code}`} target="_blank" rel="noopener noreferrer">{t("setup.company.openRegistry")}</a></>}>
                <div className="overline">{t("setup.company.knows")}</div>
                <KV rows={[[t("setup.company.address"), hitAddress(hit) || "—"], ...(hit.legal_form ? [[t("setup.company.legalForm"), hit.legal_form.toLowerCase()] as [string, ReactNode]] : []), ...(hit.vat_number ? [[t("setup.company.vat"), hit.vat_number, true] as [string, ReactNode, boolean]] : []), [t("setup.company.source"), `${t("setup.company.sourceValue")} · ${fmtDate(new Date())}`]]} />
                {!registered && <div className="al-hoiatus"><IconAlert /><span>{t("setup.company.statusWarn", { status: (hit.status ?? "").toLowerCase() })}</span></div>}
              </Picked>
            ) : <div><button type="button" className="steplink" onClick={() => setManual(true)}>{t("setup.manual")}</button></div>}
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
        {c && <KV rows={[[t("setup.company.company"), c.name], [t("setup.company.registryCode"), c.registry_code || "—", true], ...(c.vat_number ? [[t("setup.company.vat"), c.vat_number, true] as [string, ReactNode, boolean]] : []), [t("setup.company.address"), c.address || "—"], [t("setup.company.source"), t("setup.company.sourceValue")]]} />}
      </Body>
      <Footer>{footer}</Footer>
    </>
  );
}

/* --- 2 · building from EHR ------------------------------------------------------------------------------------ */
function BuildingForm({ company, existing, goCompany, onDone, later }: { company: Company | null; existing: Asset[]; goCompany: () => void; onDone: () => void; later: ReactNode }) {
  const create = useCreateAsset();
  const toast = useToast();
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 350);
  const ehr = useEhr(dq);
  const [hit, setHit] = useState<EhrHit | null>(null);
  const [manual, setManual] = useState(false);
  const [name, setName] = useState(""); const [address, setAddress] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const taken = new Set(existing.map((p) => (p.attributes as PropertyAttributes).ehr_code).filter(Boolean));
  // EHR addresses run county → parish → village → street, so the street part (last) is the natural object name
  const pickHit = (h: EhrHit) => { setHit(h); setName(h.address.split(",").pop()?.trim() || h.address); };
  if (!company) {
    return (
      <>
        <Body><Empty title={t("setup.building.noCompany")} /></Body>
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
  // „Näiteks”: the company's own street address is the likeliest first building (demo `alEhrResHTML`)
  const street = (company.address ?? "").split(",")[0]?.trim();
  const fill = (v: string) => { setQ(v); setHit(null); input.current?.focus(); };
  const examples = street ? [{ t: street, s: t("setup.building.companyAddress"), on: () => fill(street) }] : [];
  const hits = (ehr.data ?? []).slice(0, 8);
  const m2 = (v: number | null | undefined) => (v != null ? `${nf(v, 0)} m²` : "—");
  return (
    <>
      <Body>
        {manual ? (
          <div className="grid gap-1">
            <Input label={t("setup.building.name")} required value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            <Input label={t("setup.building.address")} required value={address} onChange={(e) => setAddress(e.target.value)} />
            <div><button type="button" className="steplink" onClick={() => setManual(false)}>{t("assets.ehrSearch")}</button></div>
          </div>
        ) : (
          <>
            <div className="al-otsi">
              <span className="al-otsi-ik"><IconSearch /></span>
              <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setHit(null); }} placeholder={t("setup.building.placeholder")} aria-label={t("setup.building.placeholder")} autoComplete="off" spellCheck={false} autoFocus />
              <span className="al-otsi-src">{ehr.isFetching && <Spinner />}{t("setup.building.source")}</span>
            </div>
            {hit ? (
              <Picked title={ehrAddress(hit.address)} sub={`EHR ${hit.ehr_code}`} actions={<button type="button" className="steplink" onClick={() => { setHit(null); input.current?.focus(); }}>{t("setup.pickOther")}</button>}>
                <div className="overline">{t("setup.building.knows")}</div>
                <KV rows={[[t("setup.building.useType"), hit.use_type || "—"], [t("setup.building.footprint"), m2(hit.footprint_m2), true], [t("setup.building.netArea"), m2(hit.net_area_m2), true], [t("setup.building.floors"), hit.floors ?? "—", true], [t("setup.building.buildYear"), hit.build_year ?? "—", true]]} />
                <Input label={t("setup.building.name")} value={name} onChange={(e) => setName(e.target.value)} />
              </Picked>
            ) : (
              <>
                <div className="al-res" aria-live="polite">
                  {dq.length < 2 ? (examples.length > 0 && <Chips label={t("setup.building.examples")} items={examples} />)
                    : ehr.isLoading ? null
                    : hits.length === 0 ? <Empty title={t("setup.building.noResults")} sub={examples.length ? t("setup.building.noResultsSub") : undefined}>{examples.length > 0 && <Chips items={examples} />}</Empty>
                    : hits.map((h) => {
                      const own = taken.has(h.ehr_code);
                      return (
                        <button key={h.ehr_code} type="button" className="al-pick" disabled={own} onClick={() => pickHit(h)}>
                          <span className="al-pick-t"><b>{ehrAddress(h.address)}</b><small>{[h.use_type, h.build_year, own && t("setup.building.inPortfolio")].filter(Boolean).join(" · ") || "—"}</small></span>
                          <span className="al-pick-r"><span className="mono">EHR {h.ehr_code}</span></span>
                        </button>
                      );
                    })}
                </div>
                <div><button type="button" className="steplink" onClick={() => setManual(true)}>{t("setup.manual")}</button></div>
              </>
            )}
          </>
        )}
      </Body>
      <Footer>{later}<Button variant="primary" disabled={!ok} busy={create.isPending} onClick={confirm}><IconCheck width={16} height={16} />{t("setup.building.confirm")}</Button></Footer>
    </>
  );
}
function BuildingDone({ properties, footer }: { properties: Asset[]; footer: ReactNode }) {
  return (
    <>
      <Body>
        <DoneLine>{properties.length === 1 ? t("setup.building.doneOne") : t("setup.building.doneMany", { n: properties.length })}</DoneLine>
        <div className="al-obj">{properties.map((p) => { const a = p.attributes as PropertyAttributes; return <ObjRow key={p.id} href={`/app/portfell/objekt/${p.id}`} icon={<IconBuilding />} title={p.name} sub={`${a.address ? ehrAddress(a.address) : "—"}${a.ehr_code ? ` · EHR ${a.ehr_code}` : ""}`} />; })}</div>
      </Body>
      <Footer>{footer}</Footer>
    </>
  );
}

/* --- 3 · spaces from a table (same backend import as the object wizard; demo v623 `alPindVorm`) ---------------- */
const spacesN = (n: number) => (n === 1 ? t("setup.spaces.spacesOne") : t("setup.spaces.spacesMany", { n }));
// demo `eur(n, frac)`: fixed decimals, every number grouped with a space (262,5 · 7,60 · 1 995)
const nfCache = new Map<number, Intl.NumberFormat>();
const nf = (n: number, frac = 2) => { let f = nfCache.get(frac); if (!f) { f = new Intl.NumberFormat("et-EE", { minimumFractionDigits: frac, maximumFractionDigits: frac, useGrouping: "always" }); nfCache.set(frac, f); } return f.format(n); };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
function SpacesForm({ properties, goBuilding, onDone, later }: { properties: Asset[]; goBuilding: () => void; onDone: () => void; later: ReactNode }) {
  const target = properties.find((p) => !p.children_count) ?? properties[0] ?? null;
  const imp = useImportSpaces(target?.id ?? "");
  const toast = useToast();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState("");
  const [preview, setPreview] = useState<SpaceImportResult | null>(null);
  const [error, setError] = useState("");
  const csv = useRef<HTMLInputElement>(null);
  const run = async (dryRun: boolean, src: { file: File | null; text: string }) => {
    setError("");
    try {
      const r = await imp.mutateAsync({ file: src.file ?? undefined, text: src.file ? undefined : src.text, dryRun });
      if (dryRun) setPreview(r);
      else { toast.success(t("setup.spaces.added", { n: r.created + r.updated, name: target?.name ?? "" })); onDone(); }
    } catch (e) { setPreview(null); if (dryRun) setError(errorMessage(e)); else toast.error(errorMessage(e)); }
  };
  const debounced = useDebounced(text, 600);
  useEffect(() => {
    if (file || !debounced.trim() || !target) return;
    void run(true, { file: null, text: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the settled text changes
  }, [debounced, file]);
  if (!target) {
    return (
      <>
        <Body><Empty title={t("setup.spaces.noBuilding")} sub={t("setup.spaces.noBuildingSub")} /></Body>
        <Footer><span /><Button variant="primary" onClick={goBuilding}>{t("home.setup.building")}<IconArrowRight width={16} height={16} /></Button></Footer>
      </>
    );
  }
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 1024 * 1024) { setError(t("setup.spaces.csvTooBig")); setPreview(null); return; }
    setFile(f); setSource(f.name); setText(""); void run(true, { file: f, text: "" });
  };
  const rows = preview?.rows ?? [];
  const bad = rows.filter((r) => !r.ok).length;
  const area = (r: (typeof rows)[number]) => num(r.data.rentable_area_m2);
  const price = (r: (typeof rows)[number]) => num(r.data.price_per_m2);
  const parking = (r: (typeof rows)[number]) => (Array.isArray(r.data.parking_numbers) ? r.data.parking_numbers.length : num(r.data.parking_spots) ?? 0);
  const totalM2 = rows.reduce((a, r) => a + (area(r) ?? 0), 0);
  const totalRent = rows.reduce((a, r) => a + (area(r) ?? 0) * (price(r) ?? 0), 0);
  const ready = rows.length > 0 && bad === 0;
  return (
    <>
      <Body>
        <div className="al-siht"><IconBuilding /><span>{t("setup.spaces.target")} <b>{target.name}</b></span></div>
        <div className="al-allikad">
          <button type="button" className="al-allikas" onClick={() => csv.current?.click()}><span className="al-allikas-ik"><IconUpload /></span><b>{t("setup.spaces.csv")}</b><small>{file ? file.name : t("setup.spaces.csvSub")}</small></button>
          <Link href={`/app/portfell/objekt/${target.id}?edit=1&step=2`} className="al-allikas"><span className="al-allikas-ik"><IconPlus /></span><b>{t("setup.spaces.manual")}</b><small>{t("setup.spaces.manualSub")}</small></Link>
        </div>
        <input ref={csv} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
        <Textarea label={t("setup.spaces.paste")} rows={4} spellCheck={false} className="al-kleebi" value={text} placeholder={t("setup.spaces.pastePlaceholder")}
          onChange={(e) => { setText(e.target.value); setFile(null); setSource(e.target.value.trim() ? t("setup.spaces.pasted") : ""); setPreview(null); }} />
        <div className="al-kleebi-abi">
          <span>{t("setup.spaces.helpRequired")} <b>{t("setup.spaces.helpName")}</b>, <b>{t("setup.spaces.helpArea")}</b>, <b>{t("setup.spaces.helpPrice")}</b>. {t("setup.spaces.helpTail")}</span>
          <a className="steplink" href={`${API_BASE}/assets/spaces/csv-template`} target="_blank" rel="noopener">{t("setup.spaces.template")}</a>
        </div>
        {error ? <div className="al-viga" role="alert"><IconAlert /><span>{error}</span></div>
          : imp.isPending && !preview ? <p className="al-res-olek flex items-center gap-2"><Spinner />{t("setup.spaces.reading")}</p>
          : rows.length > 0 && (
            <div className="al-eel">
              <div className="al-eel-pea"><b>{t("setup.spaces.preview")}</b><span>{t("setup.spaces.previewLine", { n: spacesN(rows.length), m2: nf(totalM2, 1), eur: nf(totalRent, 0) })}{source ? ` · ${source}` : ""}</span>
                {bad > 0 && <span className="al-eel-vead">{bad === 1 ? t("setup.spaces.previewErrorsOne") : t("setup.spaces.previewErrors", { n: bad })}</span>}</div>
              <div className="al-eel-tbl"><table>
                <thead><tr><th>{t("setup.spaces.colSpace")}</th><th>{t("setup.spaces.colType")}</th><th className="r">{t("setup.spaces.colArea")}</th><th className="r">{t("setup.spaces.colPrice")}</th><th className="r">{t("setup.spaces.colRent")}</th><th className="r">{t("setup.spaces.colParking")}</th><th>{t("setup.spaces.colState")}</th></tr></thead>
                <tbody>{rows.map((r) => {
                  const m = area(r), h = price(r), p = parking(r);
                  return (
                    <tr key={r.row} className={r.ok ? undefined : "viga"}>
                      <td><b>{String(r.data.name ?? "—")}</b>{!r.ok && <small>{r.errors.join(" · ")}</small>}</td>
                      <td>{String(r.data.type ?? "—")}</td>
                      <td className="r mono">{m != null ? nf(m, 1) : "—"}</td><td className="r mono">{h != null ? nf(h) : "—"}</td><td className="r mono">{m != null && h != null ? nf(m * h, 0) : "—"}</td>
                      <td className="r mono">{p ? (p === 1 ? t("setup.spaces.parkingOne") : t("setup.spaces.parkingMany", { n: p })) : "—"}</td>
                      <td>{t("setup.spaces.stateFree")}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            </div>
          )}
      </Body>
      <Footer>{later}<Button variant="primary" disabled={!ready} busy={imp.isPending && !!preview} onClick={() => run(false, { file, text })}><IconCheck width={16} height={16} />{rows.length ? t("setup.spaces.add", { n: spacesN(rows.length) }) : t("setup.spaces.addNone")}</Button></Footer>
    </>
  );
}
function SpacesDone({ properties, footer }: { properties: Asset[]; footer: ReactNode }) {
  return (
    <>
      <Body>
        <DoneLine>{t("setup.spaces.doneLine")}</DoneLine>
        <div className="al-obj">{properties.filter((p) => p.children_count).map((p) => <ObjRow key={p.id} href={`/app/portfell/objekt/${p.id}`} icon={<IconGrid />} title={t("setup.spaces.doneRow", { name: p.name, n: spacesN(p.children_count ?? 0) })} sub={(p.attributes as PropertyAttributes).address ? ehrAddress((p.attributes as PropertyAttributes).address as string) : "—"} />)}</div>
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
    return (
      <>
        <Body>
          <div className="al-laud">
            <div className="al-laud-a kord"><b>{n("review")}</b><span>{t("setup.contracts.needsReview")}</span></div>
            <div className="al-laud-a"><b>{n(...IMPORT_PENDING)}</b><span>{t("setup.contracts.reading")}</span></div>
            <div className="al-laud-a"><b>{n("failed")}</b><span>{t("setup.contracts.failed")}</span></div>
          </div>
          <Note>{t("setup.contracts.pendingNote", { n: open.length })}</Note>
        </Body>
        <Footer>{later}<LinkButton href="/app/portfell/import" variant="primary">{t("setup.contracts.continueDesk")}<IconArrowRight width={16} height={16} /></LinkButton></Footer>
      </>
    );
  }
  return (
    <>
      <Body><Dropzone className="al-drop" onFiles={onFiles} multiple accept={ACCEPT} label={upload.isPending ? t("imports.uploading") : t("setup.contracts.drop")} hint={t("setup.contracts.dropHint")} busy={upload.isPending} /></Body>
      <Footer>{later}<LinkButton href="/app/portfell/import" variant="primary">{t("setup.contracts.openDesk")}<IconArrowRight width={16} height={16} /></LinkButton></Footer>
    </>
  );
}
function ContractsDone({ n, footer }: { n: number; footer: ReactNode }) {
  return (
    <>
      <Body>
        <DoneLine>{t("setup.contracts.doneLine", { n })}</DoneLine>
        <Note>{t("setup.contracts.doneNote")}</Note>
      </Body>
      <Footer>{footer}</Footer>
    </>
  );
}

/* --- all four done (demo `alValmisHTML`) ---------------------------------------------------------------------- */
function DoneCard({ steps, companies, properties }: { steps: SetupStep[]; companies: Company[]; properties: Asset[] }) {
  return (
    <section className="card al-valmis">
      <span className="al-valmis-ik"><IconCheck /></span>
      <h2>{t("setup.done.title")}</h2>
      <p>{t("setup.done.sub")}</p>
      <dl className="al-valmis-kv">
        <div><dt>{t("setup.done.company")}</dt><dd>{companies.map((c) => c.name).join(", ") || "—"}</dd></div>
        <div><dt>{properties.length === 1 ? t("setup.done.building") : t("setup.done.buildings")}</dt><dd>{properties.map((p) => p.name).join(", ") || "—"}</dd></div>
        <div><dt>{t("setup.done.spaces")}</dt><dd>{spacesN(steps[2].count)}</dd></div>
        <div><dt>{t("setup.done.contracts")}</dt><dd>{t("setup.done.contractsValue", { n: steps[3].count })}</dd></div>
      </dl>
      <div className="al-valmis-teg"><LinkButton href="/app/portfell" variant="primary">{t("setup.done.openPortfolio")}<IconArrowRight width={16} height={16} /></LinkButton><LinkButton href="/app" variant="ghost">{t("setup.done.openHome")}</LinkButton></div>
    </section>
  );
}
