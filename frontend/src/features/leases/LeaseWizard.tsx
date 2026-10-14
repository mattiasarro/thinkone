"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useAsset, useAssets, useParties, useParty } from "@/lib/queries/portfolio";
import { useAccount } from "@/lib/queries/settings";
import { useCreateEmployment, useCreateLease } from "@/lib/queries/leases";
import { useDebounced } from "@/lib/hooks";
import { Card, CardBody, CardHeader, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Pill, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconPlus, IconSearch, IconCheck, IconFile, IconUsers } from "@/components/ui/Icons";
import { cx, firstOfNextMonth, fmtEur, fmtNum } from "@/lib/format";
import { PartyModal } from "@/features/portfolio/PartyModal";
import type { Asset, Party, SpaceAttributes } from "@/types/api";

type Kind = "lease" | "employment";
const LEASE_STEPS = ["kind", "client", "risk", "spaces", "terms"] as const;
const EMPLOYMENT_STEPS = ["kind", "candidate", "position", "terms"] as const;
type Step = (typeof LEASE_STEPS)[number] | (typeof EMPLOYMENT_STEPS)[number];
const SELECTABLE = new Set(["vaba", "pakkumisel"]);
const PERIODS = [12, 24, 36, 60, 120];
const num = (v: string): number | null => { const s = v.trim().replace(",", "."); if (s === "") return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
// stable objects: PartyModal resets its form whenever `defaults` changes identity
const TENANT_DEFAULTS: Partial<Party> = { roles: ["tenant"] };
const EMPLOYEE_DEFAULTS: Partial<Party> = { kind: "person", roles: ["employee"] };

/** „Loo leping 0-st”: Liik → (Üürileping: Klient → Riskiraport → Pinnad → Tingimused | Tööleping: Kandidaat → Ametikoht → Tingimused); creates a draft and opens it. */
export function LeaseWizard() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const partyParam = sp.get("party_id");
  const spaceParam = sp.get("space_id");
  const propertyParam = sp.get("property_id");
  const kindParam = sp.get("kind") === "employment" ? "employment" : partyParam || spaceParam || propertyParam ? "lease" : null;
  const [kind, setKind] = useState<Kind | null>(kindParam);
  const [step, setStep] = useState<Step>(kindParam === "employment" ? "candidate" : kindParam === "lease" ? (partyParam ? "risk" : "client") : "kind");
  const [party, setParty] = useState<Party | null>(null);
  const [propertyId, setPropertyId] = useState<string>(propertyParam ?? "");
  const [spaceIds, setSpaceIds] = useState<string[]>(spaceParam ? [spaceParam] : []);
  const [months, setMonths] = useState<number>(60);
  const [custom, setCustom] = useState(false);
  const [handover, setHandover] = useState(firstOfNextMonth());
  const [deposit, setDeposit] = useState<string>("");
  const [purpose, setPurpose] = useState("");
  const [positionId, setPositionId] = useState<string>("");
  const create = useCreateLease();
  const createEmployment = useCreateEmployment();
  const account = useAccount();
  const positions = useAssets({ type_code: "position" });
  const departments = useAssets({ type_code: "department" });
  useEffect(() => { const q = account.data?.settings.quote; if (q) { setMonths((m) => (m === 60 ? q.period_months : m)); setDeposit((d) => (d === "" ? String(q.deposit_months) : d)); } }, [account.data]);

  const prefParty = useParty(partyParam ?? undefined);
  useEffect(() => { if (prefParty.data && !party) setParty(prefParty.data); }, [prefParty.data, party]);
  const prefSpace = useAsset(spaceParam ?? undefined);
  useEffect(() => { if (prefSpace.data?.parent_id && !propertyId) setPropertyId(prefSpace.data.parent_id); }, [prefSpace.data, propertyId]);

  const steps: readonly Step[] = kind === "employment" ? EMPLOYMENT_STEPS : LEASE_STEPS;
  const idx = steps.indexOf(step);
  const pickKind = (k: Kind) => { setKind(k); setStep(k === "employment" ? "candidate" : "client"); };
  const submit = async () => {
    if (!party || !propertyId || spaceIds.length === 0) return;
    try {
      const d = await create.mutateAsync({ party_id: party.id, property_id: propertyId, spaces: spaceIds.map((space_id) => ({ space_id })), months, handover: handover || null, deposit_months: deposit === "" ? null : Number(deposit), purpose: purpose.trim() || null });
      toast.success(t("lease.wizard.created"));
      router.push(`/app/portfell/leping/${d.id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div className="grid gap-5 max-w-[880px]">
      <LinkButton href="/app/portfell?tab=lepingud" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("lease.back")}</LinkButton>
      <PageHead title={kind === "employment" ? t("lease.wizard.employment.title") : t("lease.wizard.title")} />
      <div className="stepper" role="list">
        {steps.map((s, i) => (
          <button key={s} type="button" role="listitem" className={cx("st", s === step && "active", i < idx && "done")} onClick={() => { if (i < idx) setStep(s); }} disabled={i > idx}>
            <span className="n">{i < idx ? <IconCheck width={12} height={12} /> : i + 1}</span>{s === "candidate" || s === "position" ? tEnum("lease.wizard.employment.steps", s) : tEnum("lease.wizard.steps", s)}
          </button>
        ))}
      </div>
      {step === "kind" && <StepKind kind={kind} onPick={pickKind} hasPositions={(positions.data ?? []).length > 0} loading={positions.isLoading} />}

      {/* ---- Üürileping ---- */}
      {step === "client" && <StepParty party={party} onPick={(p) => { setParty(p); setStep("risk"); }} title={t("quotes.wizard.clientPick")} placeholder={t("quotes.wizard.clientSearch")} defaults={TENANT_DEFAULTS} onBack={() => setStep("kind")} />}
      {step === "risk" && (
        <Card>
          <CardHeader title={t("quotes.wizard.riskTitle")} />
          <CardBody>
            <p className="text-sm text-muted">{t("quotes.wizard.riskText")}</p>
            {party && <p className="text-sm mt-2"><span className="text-muted">{t("quotes.wizard.clientSelected")}:</span> <span className="font-semibold">{party.name}</span>{party.registry_code && <span className="text-muted"> · {party.registry_code}</span>}</p>}
            <div className="flex justify-end gap-2 mt-4"><Button onClick={() => setStep("client")}>{t("common.back")}</Button><Button variant="primary" onClick={() => setStep("spaces")}>{t("quotes.wizard.riskSkip")}</Button></div>
          </CardBody>
        </Card>
      )}
      {step === "spaces" && (
        <StepSpaces propertyId={propertyId} onProperty={(id) => { setPropertyId(id); setSpaceIds([]); }} spaceIds={spaceIds} onSpaces={setSpaceIds}
          footer={<div className="flex items-center justify-between gap-2 mt-4 flex-wrap"><span className="text-sm text-muted">{t("quotes.wizard.selected", { n: spaceIds.length })}</span><div className="flex gap-2"><Button onClick={() => setStep("risk")}>{t("common.back")}</Button><Button variant="primary" disabled={!propertyId || spaceIds.length === 0} onClick={() => setStep("terms")}>{t("lease.wizard.next")}</Button></div></div>} />
      )}
      {step === "terms" && kind !== "employment" && (
        <Card>
          <CardHeader title={t("lease.wizard.termsTitle")} />
          <CardBody>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <div className="field">
                <label className="field-label">{t("lease.wizard.months")}</label>
                <div className="flex gap-2">
                  <select className="fld" value={custom || !PERIODS.includes(months) ? "custom" : String(months)} onChange={(e) => { if (e.target.value === "custom") setCustom(true); else { setCustom(false); setMonths(Number(e.target.value)); } }} aria-label={t("lease.wizard.months")}>
                    {PERIODS.map((m) => <option key={m} value={m}>{t("lease.deal.monthsN", { n: m })}</option>)}
                    <option value="custom">{t("lease.deal.custom")}</option>
                  </select>
                  {(custom || !PERIODS.includes(months)) && <input className="fld w-28" type="number" min={1} max={600} value={months} onChange={(e) => setMonths(Math.max(1, Math.round(Number(e.target.value) || 1)))} aria-label={t("lease.deal.monthsInput")} />}
                </div>
              </div>
              <Input label={t("lease.wizard.handover")} type="date" value={handover} onChange={(e) => setHandover(e.target.value)} />
              <Input label={t("lease.wizard.deposit")} type="number" min={0} max={24} step="1" inputMode="numeric" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
            <div className="field"><label className="field-label">{t("lease.wizard.purpose")}</label><textarea className="fld" rows={2} value={purpose} onChange={(e) => setPurpose(e.target.value)} aria-label={t("lease.wizard.purpose")} /></div>
            <div className="flex justify-end gap-2 mt-2"><Button onClick={() => setStep("spaces")}>{t("common.back")}</Button><Button variant="primary" busy={create.isPending} disabled={!party || !propertyId || spaceIds.length === 0 || !handover} onClick={submit}>{t("lease.wizard.create")}</Button></div>
          </CardBody>
        </Card>
      )}

      {/* ---- Tööleping ---- */}
      {step === "candidate" && <StepParty party={party} onPick={(p) => { setParty(p); setStep("position"); }} title={t("lease.wizard.employment.candidatePick")} placeholder={t("lease.wizard.employment.candidateSearch")} defaults={EMPLOYEE_DEFAULTS} onBack={() => setStep("kind")} />}
      {step === "position" && (
        <StepPosition positions={positions.data ?? []} departments={departments.data ?? []} loading={positions.isLoading} error={positions.error} retry={() => positions.refetch()} positionId={positionId}
          onPick={(id) => { setPositionId(id); setStep("terms"); }} onBack={() => setStep("candidate")} />
      )}
      {step === "terms" && kind === "employment" && party && (
        <StepEmploymentTerms party={party} position={(positions.data ?? []).find((p) => p.id === positionId) ?? null} busy={createEmployment.isPending} onBack={() => setStep("position")}
          onSubmit={async (body) => {
            if (!positionId) return;
            try {
              const d = await createEmployment.mutateAsync({ party_id: party.id, position_id: positionId, ...body });
              toast.success(t("lease.wizard.employment.created"));
              router.push(`/app/portfell/leping/${d.id}`);
            } catch (e) { toast.error(errorMessage(e)); }
          }} />
      )}
    </div>
  );
}

/** Step 1 „Lepingu liik”: two choices; Tööleping only when at least one position asset exists. */
function StepKind({ kind, onPick, hasPositions, loading }: { kind: Kind | null; onPick: (k: Kind) => void; hasPositions: boolean; loading: boolean }) {
  const opt = (k: Kind, icon: React.ReactNode, title: string, sub: string, disabled: boolean, hint?: string) => (
    <button type="button" disabled={disabled} onClick={() => onPick(k)} aria-pressed={kind === k}
      className={cx("card pad text-left flex items-start gap-3 border-2 transition-shadow", disabled ? "opacity-60 cursor-not-allowed" : "hover:shadow-floating", kind === k ? "border-ink" : "border-transparent")}>
      <span className="w-10 h-10 rounded-control grid place-items-center flex-none text-primary" style={{ background: "var(--color-primary-subtle)" }}>{icon}</span>
      <span className="min-w-0">
        <span className="block font-heading font-semibold text-base">{title}</span>
        <span className="block text-sm text-muted mt-0.5">{sub}</span>
        {hint && <span className="block text-xs text-warning mt-1">{hint}</span>}
      </span>
    </button>
  );
  return (
    <Card>
      <CardHeader title={t("lease.wizard.kind.title")} />
      <CardBody className="grid gap-3 sm:grid-cols-2">
        {opt("lease", <IconFile />, t("lease.wizard.kind.lease"), t("lease.wizard.kind.leaseSub"), false)}
        {opt("employment", <IconUsers />, t("lease.wizard.kind.employment"), t("lease.wizard.kind.employmentSub"), loading || !hasPositions, !loading && !hasPositions ? t("lease.wizard.kind.needPosition") : undefined)}
      </CardBody>
    </Card>
  );
}

function StepParty({ party, onPick, title, placeholder, defaults, onBack }: { party: Party | null; onPick: (p: Party) => void; title: string; placeholder: string; defaults: Partial<Party>; onBack: () => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const list = useParties({ q: dq || undefined });
  const [add, setAdd] = useState(false);
  return (
    <Card>
      <CardHeader title={title} actions={<Button size="sm" onClick={() => setAdd(true)}><IconPlus width={14} height={14} />{t("quotes.wizard.addParty")}</Button>} />
      <CardBody>
        <label className="flex items-center gap-2 h-10 px-3 rounded-control bg-canvas w-full mb-3">
          <IconSearch width={14} height={14} className="text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={t("common.search")} className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
        </label>
        {list.isLoading ? <Loading /> : list.error ? <ErrorState error={list.error} onRetry={() => list.refetch()} /> : (list.data ?? []).length === 0 ? <EmptyState title={t("quotes.wizard.noParties")} /> : (
          <ul className="divide-y -mx-2" style={{ borderColor: "var(--line)" }}>
            {(list.data ?? []).map((p) => (
              <li key={p.id}>
                <button type="button" className={cx("flex items-center gap-3 w-full text-left px-2 py-2.5 rounded-control hover:bg-canvas", party?.id === p.id && "bg-canvas")} onClick={() => onPick(p)}>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate">{p.name}</span>
                    <span className="block text-xs text-muted">{[p.registry_code ?? p.personal_code, p.email].filter(Boolean).join(" · ") || tEnum("portfolio.parties.kinds", p.kind)}</span>
                  </span>
                  {p.roles.slice(0, 2).map((r) => <span key={r} className="pill">{tEnum("portfolio.parties.roleNames", r)}</span>)}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-start mt-3"><Button onClick={onBack}>{t("common.back")}</Button></div>
      </CardBody>
      <PartyModal open={add} onClose={() => setAdd(false)} defaults={defaults} onSaved={(p) => onPick(p)} />
    </Card>
  );
}

function StepSpaces({ propertyId, onProperty, spaceIds, onSpaces, footer }: { propertyId: string; onProperty: (id: string) => void; spaceIds: string[]; onSpaces: (ids: string[]) => void; footer: React.ReactNode }) {
  const props = useAssets({ type_code: "property" });
  const spaces = useAssets({ type_code: "space", parent_id: propertyId });
  const rows = useMemo(() => (propertyId ? (spaces.data ?? []) : []), [spaces.data, propertyId]);
  const toggle = (s: Asset) => onSpaces(spaceIds.includes(s.id) ? spaceIds.filter((x) => x !== s.id) : [...spaceIds, s.id]);
  return (
    <Card>
      <CardHeader title={t("quotes.wizard.spacesTitle")} />
      <CardBody>
        <Select label={t("quotes.wizard.property")} value={propertyId} onChange={(e) => onProperty(e.target.value)} placeholder={t("quotes.wizard.propertyPlaceholder")}
          options={(props.data ?? []).map((p) => ({ value: p.id, label: p.name }))} />
        {propertyId && (spaces.isLoading ? <Loading /> : rows.length === 0 ? <p className="text-sm text-muted">{t("quotes.wizard.noSpaces")}</p> : (
          <ul className="divide-y -mx-2" style={{ borderColor: "var(--line)" }}>
            {rows.map((s) => {
              const a = s.attributes as Partial<SpaceAttributes>;
              const ok = SELECTABLE.has(s.status ?? "");
              const on = spaceIds.includes(s.id);
              return (
                <li key={s.id}>
                  <label className={cx("flex items-center gap-3 px-2 py-2.5 rounded-control", ok ? "cursor-pointer hover:bg-canvas" : "opacity-60")}>
                    <input type="checkbox" checked={on} disabled={!ok} onChange={() => toggle(s)} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{s.name}</span>
                      <span className="block text-xs text-muted">{fmtNum(a.rentable_area_m2)} m²{a.price_per_m2 != null ? ` · ${fmtEur(a.price_per_m2)}/m²` : ""}{a.type ? ` · ${tEnum("assets.spaceTypes", a.type)}` : ""}</span>
                    </span>
                    <Pill tone={statusTone(s.status)}>{tEnum("assets.status", s.status)}</Pill>
                  </label>
                </li>
              );
            })}
          </ul>
        ))}
        {footer}
      </CardBody>
    </Card>
  );
}

/** Tööleping step 3 „Ametikoht”: position assets with their department, duties and headcount (capacity); the quota comes from occupancy. */
function StepPosition({ positions, departments, loading, error, retry, positionId, onPick, onBack }: { positions: Asset[]; departments: Asset[]; loading: boolean; error: unknown; retry: () => void; positionId: string; onPick: (id: string) => void; onBack: () => void }) {
  const byDept = new Map(departments.map((d) => [d.id, d.name]));
  return (
    <Card>
      <CardHeader title={t("lease.wizard.employment.positionPick")} />
      <CardBody>
        {loading ? <Loading /> : error ? <ErrorState error={error} onRetry={retry} /> : positions.length === 0 ? <EmptyState title={t("lease.wizard.employment.noPositions")} /> : (
          <ul className="divide-y -mx-2" style={{ borderColor: "var(--line)" }}>
            {positions.map((p) => {
              const a = p.attributes as { duties?: string | null; salary?: number | string | null; headcount?: number | null };
              const total = p.capacity ?? Number(a.headcount ?? 1);
              const free = p.occupancy?.free ?? null;
              const full = free !== null && free <= 0;
              return (
                <li key={p.id}>
                  <button type="button" disabled={full} className={cx("flex items-center gap-3 w-full text-left px-2 py-2.5 rounded-control", full ? "opacity-60 cursor-not-allowed" : "hover:bg-canvas", positionId === p.id && "bg-canvas")} onClick={() => onPick(p.id)}>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{p.name}<span className="text-muted font-normal"> · {(p.parent_id && byDept.get(p.parent_id)) || t("lease.wizard.employment.noDepartment")}</span></span>
                      {a.duties && <span className="block text-xs text-muted truncate">{a.duties}</span>}
                      <span className="block text-xs text-muted">{t("lease.wizard.employment.headcount", { n: total })}{free !== null ? ` · ${full ? t("lease.wizard.employment.full") : t("lease.wizard.employment.free", { n: free })}` : ""}{a.salary != null && a.salary !== "" ? ` · ${fmtEur(Number(a.salary))}` : ""}</span>
                    </span>
                    <Pill tone={statusTone(p.status)}>{tEnum("assets.status", p.status)}</Pill>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex justify-start mt-3"><Button onClick={onBack}>{t("common.back")}</Button></div>
      </CardBody>
    </Card>
  );
}

type EmploymentBody = { salary: number; start: string; months: number | null; probation_months: number; working_time: string | null; place: string | null; salary_review: string | null; vacation_days: number; pay_day: number };

/** Tööleping step 4 „Tingimused”: salary, start, term (tähtajatu toggle), probation 0–4, working time, place, pay day, vacation days. */
function StepEmploymentTerms({ party, position, busy, onBack, onSubmit }: { party: Party; position: Asset | null; busy: boolean; onBack: () => void; onSubmit: (b: EmploymentBody) => void }) {
  const listed = position ? (position.attributes as { salary?: number | string | null }).salary : null;
  const [salary, setSalary] = useState<string>(listed != null && listed !== "" ? String(listed) : "");
  const [start, setStart] = useState(firstOfNextMonth());
  const [fixed, setFixed] = useState(false);
  const [months, setMonths] = useState<string>("12");
  const [probation, setProbation] = useState<number>(4);
  const [workingTime, setWorkingTime] = useState(t("lease.wizard.employment.workingTimeDefault"));
  const [place, setPlace] = useState("");
  const [payDay, setPayDay] = useState<string>("10");
  const [vacation, setVacation] = useState<string>("28");
  const [review, setReview] = useState("");
  const salaryN = num(salary);
  const monthsN = fixed ? num(months) : null;
  const ok = salaryN !== null && salaryN > 0 && !!start && (!fixed || (monthsN !== null && monthsN >= 1));
  return (
    <Card>
      <CardHeader title={t("lease.wizard.employment.termsTitle")}>
        <p className="text-sm text-muted">{party.name}{position && <> · {position.name}</>}</p>
      </CardHeader>
      <CardBody>
        <div className="grid gap-x-4 sm:grid-cols-2">
          <Input label={t("lease.wizard.employment.salary")} type="number" min={0} step="0.01" inputMode="decimal" value={salary} onChange={(e) => setSalary(e.target.value)} required />
          <Input label={t("lease.wizard.employment.start")} type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          <div className="field">
            <label className="field-label">{t("lease.wizard.employment.term")}</label>
            <div className="flex gap-2">
              <select className="fld" value={fixed ? "fixed" : "open"} onChange={(e) => setFixed(e.target.value === "fixed")} aria-label={t("lease.wizard.employment.term")}>
                <option value="open">{t("lease.wizard.employment.openEnded")}</option>
                <option value="fixed">{t("lease.wizard.employment.fixed")}</option>
              </select>
              {fixed && <input className="fld w-28" type="number" min={1} max={600} value={months} onChange={(e) => setMonths(e.target.value)} aria-label={t("lease.wizard.employment.months")} />}
            </div>
          </div>
          <Select label={t("lease.wizard.employment.probation")} value={String(probation)} onChange={(e) => setProbation(Number(e.target.value))}
            options={[0, 1, 2, 3, 4].map((n) => ({ value: String(n), label: n === 0 ? t("lease.wizard.employment.probationNone") : t("lease.deal.monthsN", { n }) }))} />
          <Input label={t("lease.wizard.employment.workingTime")} value={workingTime} onChange={(e) => setWorkingTime(e.target.value)} />
          <Input label={t("lease.wizard.employment.place")} value={place} onChange={(e) => setPlace(e.target.value)} />
          <Input label={t("lease.wizard.employment.payDay")} type="number" min={1} max={28} step="1" inputMode="numeric" value={payDay} onChange={(e) => setPayDay(e.target.value)} />
          <Input label={t("lease.wizard.employment.vacationDays")} type="number" min={0} max={60} step="1" inputMode="numeric" value={vacation} onChange={(e) => setVacation(e.target.value)} />
          <Input label={t("lease.wizard.employment.salaryReview")} type="date" value={review} onChange={(e) => setReview(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 mt-2">
          <Button onClick={onBack}>{t("common.back")}</Button>
          <Button variant="primary" busy={busy} disabled={!ok} onClick={() => onSubmit({
            salary: salaryN ?? 0, start, months: monthsN === null ? null : Math.round(monthsN), probation_months: probation, working_time: workingTime.trim() || null, place: place.trim() || null,
            salary_review: review || null, vacation_days: Math.max(0, Math.round(num(vacation) ?? 28)), pay_day: Math.min(28, Math.max(1, Math.round(num(payDay) ?? 10))),
          })}>{t("lease.wizard.employment.create")}</Button>
        </div>
      </CardBody>
    </Card>
  );
}
