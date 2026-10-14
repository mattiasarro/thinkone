"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useAsset, useAssets, useParties, useParty } from "@/lib/queries/portfolio";
import { useAccount } from "@/lib/queries/settings";
import { useCreateLease } from "@/lib/queries/leases";
import { useDebounced } from "@/lib/hooks";
import { Card, CardBody, CardHeader, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { Pill, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconPlus, IconSearch, IconCheck } from "@/components/ui/Icons";
import { cx, firstOfNextMonth, fmtEur, fmtNum } from "@/lib/format";
import { PartyModal } from "@/features/portfolio/PartyModal";
import type { Asset, Party, SpaceAttributes } from "@/types/api";

const STEPS = ["client", "risk", "spaces", "terms"] as const;
type Step = (typeof STEPS)[number];
const SELECTABLE = new Set(["vaba", "pakkumisel"]);
const PERIODS = [12, 24, 36, 60, 120];

/** „Loo leping 0-st”: Klient → Riskiraport (placeholder until 3.3) → Pinnad → Tingimused; creates a draft and opens it. */
export function LeaseWizard() {
  const sp = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const partyParam = sp.get("party_id");
  const spaceParam = sp.get("space_id");
  const propertyParam = sp.get("property_id");
  const [step, setStep] = useState<Step>(partyParam ? "risk" : "client");
  const [party, setParty] = useState<Party | null>(null);
  const [propertyId, setPropertyId] = useState<string>(propertyParam ?? "");
  const [spaceIds, setSpaceIds] = useState<string[]>(spaceParam ? [spaceParam] : []);
  const [months, setMonths] = useState<number>(60);
  const [custom, setCustom] = useState(false);
  const [handover, setHandover] = useState(firstOfNextMonth());
  const [deposit, setDeposit] = useState<string>("");
  const [purpose, setPurpose] = useState("");
  const create = useCreateLease();
  const account = useAccount();
  useEffect(() => { const q = account.data?.settings.quote; if (q) { setMonths((m) => (m === 60 ? q.period_months : m)); setDeposit((d) => (d === "" ? String(q.deposit_months) : d)); } }, [account.data]);

  const prefParty = useParty(partyParam ?? undefined);
  useEffect(() => { if (prefParty.data && !party) setParty(prefParty.data); }, [prefParty.data, party]);
  const prefSpace = useAsset(spaceParam ?? undefined);
  useEffect(() => { if (prefSpace.data?.parent_id && !propertyId) setPropertyId(prefSpace.data.parent_id); }, [prefSpace.data, propertyId]);

  const idx = STEPS.indexOf(step);
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
      <PageHead title={t("lease.wizard.title")} />
      <div className="stepper" role="list">
        {STEPS.map((s, i) => (
          <button key={s} type="button" role="listitem" className={cx("st", s === step && "active", i < idx && "done")} onClick={() => { if (i < idx) setStep(s); }} disabled={i > idx}>
            <span className="n">{i < idx ? <IconCheck width={12} height={12} /> : i + 1}</span>{tEnum("lease.wizard.steps", s)}
          </button>
        ))}
      </div>
      {step === "client" && <StepClient party={party} onPick={(p) => { setParty(p); setStep("risk"); }} />}
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
      {step === "terms" && (
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
    </div>
  );
}

function StepClient({ party, onPick }: { party: Party | null; onPick: (p: Party) => void }) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const list = useParties({ q: dq || undefined });
  const [add, setAdd] = useState(false);
  return (
    <Card>
      <CardHeader title={t("quotes.wizard.clientPick")} actions={<Button size="sm" onClick={() => setAdd(true)}><IconPlus width={14} height={14} />{t("quotes.wizard.addParty")}</Button>} />
      <CardBody>
        <label className="flex items-center gap-2 h-10 px-3 rounded-control bg-canvas w-full mb-3">
          <IconSearch width={14} height={14} className="text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("quotes.wizard.clientSearch")} aria-label={t("common.search")} className="flex-1 min-w-0 bg-transparent outline-none text-sm" />
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
      </CardBody>
      <PartyModal open={add} onClose={() => setAdd(false)} defaults={{ roles: ["tenant"] }} onSaved={(p) => onPick(p)} />
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
