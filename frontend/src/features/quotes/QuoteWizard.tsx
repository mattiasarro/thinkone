"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useAsset, useAssets, useParties, useParty } from "@/lib/queries/portfolio";
import { useCreateQuote } from "@/lib/queries/quotes";
import { useDebounced } from "@/lib/hooks";
import { Card, CardBody, CardHeader, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";
import { Pill, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconChevronLeft, IconPlus, IconSearch, IconCheck } from "@/components/ui/Icons";
import { cx, fmtEur, fmtNum } from "@/lib/format";
import { PartyModal } from "@/features/portfolio/PartyModal";
import { RiskReportCard } from "@/features/risk/RiskReportCard";
import { partyHasRisk } from "@/features/risk/RiskPill";
import { useRiskHistory } from "@/lib/queries/risk";
import type { Asset, Party, SpaceAttributes } from "@/types/api";

const STEPS = ["client", "risk", "spaces"] as const;
type Step = (typeof STEPS)[number];
const SELECTABLE = new Set(["vaba", "pakkumisel"]);

/** Demo wizard: Klient → Riskiraport (placeholder until 3.3) → Pinnad; creates a draft and opens it. */
export function QuoteWizard() {
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
  const create = useCreateQuote();

  // prefills: ?party_id= selects the party; ?space_id= resolves the property and ticks the space
  const prefParty = useParty(partyParam ?? undefined);
  useEffect(() => { if (prefParty.data && !party) setParty(prefParty.data); }, [prefParty.data, party]);
  const prefSpace = useAsset(spaceParam ?? undefined);
  useEffect(() => { if (prefSpace.data?.parent_id && !propertyId) setPropertyId(prefSpace.data.parent_id); }, [prefSpace.data, propertyId]);

  const idx = STEPS.indexOf(step);
  const submit = async () => {
    if (!party || !propertyId || spaceIds.length === 0) return;
    try {
      const q = await create.mutateAsync({ party_id: party.id, property_id: propertyId, space_ids: spaceIds });
      toast.success(t("quotes.wizard.created"));
      router.push(`/app/portfell/pakkumine/${q.id}`);
    } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div className="grid gap-5 max-w-[880px]">
      <LinkButton href="/app/portfell?tab=pakkumised" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("quotes.back")}</LinkButton>
      <PageHead title={t("quotes.wizard.title")} />
      <div className="stepper" role="list">
        {STEPS.map((s, i) => (
          <button key={s} type="button" role="listitem" className={cx("st", s === step && "active", i < idx && "done")} onClick={() => { if (i < idx) setStep(s); }} disabled={i > idx}>
            <span className="n">{i < idx ? <IconCheck width={12} height={12} /> : i + 1}</span>{tEnum("quotes.wizard.steps", s)}
          </button>
        ))}
      </div>
      {step === "client" && <StepClient party={party} onPick={(p) => { setParty(p); setStep("risk"); }} />}
      {step === "risk" && <StepRisk party={party} onBack={() => setStep("client")} onNext={() => setStep("spaces")} />}
      {step === "spaces" && (
        <StepSpaces propertyId={propertyId} onProperty={(id) => { setPropertyId(id); setSpaceIds([]); }} spaceIds={spaceIds} onSpaces={setSpaceIds}
          footer={<div className="flex items-center justify-between gap-2 mt-4 flex-wrap"><span className="text-sm text-muted">{t("quotes.wizard.selected", { n: spaceIds.length })}</span><div className="flex gap-2"><Button onClick={() => setStep("risk")}>{t("common.back")}</Button><Button variant="primary" busy={create.isPending} disabled={!party || !propertyId || spaceIds.length === 0} onClick={submit}>{t("quotes.wizard.create")}</Button></div></div>} />
      )}
    </div>
  );
}

/** Step 2 — advisory risk report (Phase 3.3): shows the latest report compact, orders one on demand, never blocks („Jätka ilma”). */
function StepRisk({ party, onBack, onNext }: { party: Party | null; onBack: () => void; onNext: () => void }) {
  const hasRisk = partyHasRisk(party);
  const history = useRiskHistory(party?.id, hasRisk);
  const hasReport = (history.data ?? []).some((r) => r.status === "ready");
  const nav = (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      {party ? <p className="text-sm"><span className="text-muted">{t("quotes.wizard.clientSelected")}:</span> <span className="font-semibold">{party.name}</span>{party.registry_code && <span className="text-muted"> · {party.registry_code}</span>}</p> : <span />}
      <div className="flex gap-2"><Button onClick={onBack}>{t("common.back")}</Button><Button variant="primary" onClick={onNext}>{hasReport ? t("risk.wizard.continue") : t("risk.wizard.skip")}</Button></div>
    </div>
  );
  if (!party || !hasRisk) {
    return (
      <Card>
        <CardHeader title={t("risk.wizard.title")} overline={t("risk.advisory")} />
        <CardBody className="grid gap-4"><p className="text-sm text-muted">{party && party.kind === "person" ? t("risk.wizard.notCompany") : t("risk.notCompany")}</p>{nav}</CardBody>
      </Card>
    );
  }
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">{t("risk.wizard.text")}</p>
      <RiskReportCard partyId={party.id} compact title={t("risk.wizard.title")} footer={nav} />
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
