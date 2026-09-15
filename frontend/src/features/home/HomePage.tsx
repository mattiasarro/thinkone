"use client";
import Link from "next/link";
import { useMemo } from "react";
import { t, tEnum } from "@/i18n";
import { useMe } from "@/lib/queries/auth";
import { useKeyDates, usePortfolioHealth } from "@/lib/queries/portfolio";
import { useImports } from "@/lib/queries/imports";
import { addDays, daysUntil, fmtDate, isoDay } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill, severityTone } from "@/components/ui/Pill";
import { Loading, EmptyState } from "@/components/ui/State";
import { IconBuilding, IconImport, IconUsers, IconArrowRight, IconAlert, IconCal, IconFile } from "@/components/ui/Icons";

type Item = { key: string; href: string; icon: React.ReactNode; title: string; sub: string; pill?: React.ReactNode; sort: number };

export function HomePage() {
  const me = useMe();
  const today = useMemo(() => new Date(), []);
  const kd = useKeyDates({ from: isoDay(addDays(today, -365)), to: isoDay(addDays(today, 30)) });
  const imports = useImports();
  const health = usePortfolioHealth();

  const h = today.getHours();
  const greet = h < 11 ? "home.greetingMorning" : h < 18 ? "home.greetingDay" : "home.greetingEvening";
  const firstName = me.data?.name.split(" ")[0] ?? "";

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const d of kd.data ?? []) {
      if (d.fired_at && daysUntil(d.due_date) < 0) continue;
      const n = daysUntil(d.due_date);
      out.push({
        key: `kd-${d.id}`, href: d.contract ? `/app/portfell/leping/${d.contract.id}` : "/app/kalender", icon: <IconCal />, sort: n,
        title: `${d.title}${d.contract ? ` — ${[d.contract.number, d.contract.party_name ?? d.contract.title].filter(Boolean).join(" · ")}` : ""}`,
        sub: t("home.keyDateDue", { date: fmtDate(d.due_date) }),
        pill: <Pill tone={n < 0 ? "error" : n <= 7 ? "warning" : "neutral"}>{n < 0 ? t("home.overdue") : t("home.inDays", { n })}</Pill>,
      });
    }
    for (const j of imports.data ?? []) {
      if (j.status !== "review") continue;
      out.push({ key: `imp-${j.id}`, href: `/app/portfell/import/${j.id}`, icon: <IconImport />, sort: -0.5, title: j.reviewed?.contract.title || j.proposal?.contract.title || j.source_document?.filename || t("common.untitled"), sub: t("home.importInReview"), pill: <Pill tone="warning">{tEnum("imports.status", j.status)}</Pill> });
    }
    for (const f of health.data?.findings ?? []) {
      if (f.severity === "info") continue;
      out.push({ key: `hf-${f.code}`, href: "/app/ylevaade", icon: <IconAlert />, sort: f.severity === "error" ? -1 : -0.2, title: f.title, sub: t("home.finding", { count: f.count }), pill: <Pill tone={severityTone(f.severity)}>{tEnum("overview.severity", f.severity)}</Pill> });
    }
    return out.sort((a, b) => a.sort - b.sort);
  }, [kd.data, imports.data, health.data]);

  const loading = kd.isLoading || imports.isLoading || health.isLoading;

  return (
    <div className="grid gap-6 max-w-[960px]">
      <div className="pt-4">
        <h1 className="font-heading text-[32px] leading-10 md:text-[40px] md:leading-[44px] font-semibold tracking-tight">{t(greet, { name: firstName })}</h1>
        <p className="page-sub">{t("nav.avalehtQ")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/app/portfell/objekt/uus" icon={<IconBuilding />} label={t("home.addAsset")} />
        <QuickLink href="/app/portfell/import" icon={<IconImport />} label={t("home.importContract")} />
        <QuickLink href="/app/portfell?tab=osapooled&new=1" icon={<IconUsers />} label={t("home.addParty")} />
      </div>

      <Card>
        <CardHeader title={t("home.needsAction")} actions={items.length > 0 && <Pill tone="primary">{items.length}</Pill>} />
        <div className="px-[var(--card-padding)]">
          {loading ? (
            <div className="py-4"><Loading /></div>
          ) : items.length === 0 ? (
            <EmptyState title={t("home.needsActionEmpty")} icon={<IconFile width={40} height={40} />} />
          ) : (
            <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
              {items.map((it) => (
                <li key={it.key}>
                  <Link href={it.href} className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-control hover:bg-canvas min-h-[52px]">
                    <span className="w-9 h-9 rounded-control grid place-items-center flex-none text-muted" style={{ background: "var(--color-surface-subtle)" }}>{it.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate">{it.title}</span>
                      <span className="block text-xs text-muted">{it.sub}</span>
                    </span>
                    {it.pill}
                    <IconArrowRight width={16} height={16} className="text-muted flex-none" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card pad flex items-center gap-3 hover:shadow-floating transition-shadow min-h-[64px]">
      <span className="w-10 h-10 rounded-control grid place-items-center text-primary flex-none" style={{ background: "var(--color-primary-subtle)" }}>{icon}</span>
      <span className="font-semibold text-sm">{label}</span>
      <IconArrowRight width={16} height={16} className="ml-auto text-muted" />
    </Link>
  );
}
