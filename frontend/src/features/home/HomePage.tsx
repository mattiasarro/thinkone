"use client";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useMe } from "@/lib/queries/auth";
import { useAttention, usePortfolioSummary } from "@/lib/queries/portfolio";
import { useThreads } from "@/lib/queries/suhtlus";
import { daysUntil, fmtDate } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { Button, LinkButton } from "@/components/ui/Button";
import { Loading } from "@/components/ui/State";
import { IconBuilding, IconImport, IconUsers, IconArrowRight, IconArrowUp, IconCal, IconFile, IconCheck, IconChat, Glyph } from "@/components/ui/Icons";
import { cx } from "@/lib/format";
import type { AttentionRow } from "@/types/api";

const LATER_KEY = "thinkone.home.later";
const rowKey = (r: AttentionRow) => `${r.kind}:${r.link}:${r.step ?? ""}`;

/** Small line icon per row kind (demo v787 `.dh-ic`): quotes and contracts are documents, imports an arrow-in, key dates a calendar. */
function KindIcon({ kind, ...p }: { kind: string; width?: number; height?: number; className?: string }) {
  if (kind === "import") return <IconImport {...p} />;
  if (kind === "key_date") return <IconCal {...p} />;
  return <IconFile {...p} />;
}

/** The row's verb: by next-step code first, by kind otherwise (tEnum falls back to the raw value when a key is missing). */
function verb(r: AttentionRow): string {
  if (r.step) { const v = tEnum("home.focus.verb", r.step); if (v !== r.step) return v; }
  const k = tEnum("home.focus.kind", r.kind);
  return k === r.kind ? t("common.open") : k;
}

function dueLabel(due: string | null): { text: string; late: boolean } | null {
  if (!due) return null;
  const n = daysUntil(due);
  if (n < 0) return { text: t("home.focus.overdue"), late: true };
  if (n === 0) return { text: t("home.focus.today"), late: true };
  return { text: t("home.focus.due", { date: fmtDate(due) }), late: false };
}

/** Avaleht = „Fookus” (demo v672 → v770): greeting · ONE compact focus card · „Järgmisena” rows · two links · the composer. */
export function HomePage() {
  const me = useMe();
  const router = useRouter();
  const summary = usePortfolioSummary();
  const attention = useAttention();
  const threads = useThreads({ unanswered: true });
  const [later, setLater] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [q, setQ] = useState("");
  const firstName = me.data?.name.split(" ")[0] ?? "";

  // „Hiljem” moves a row to the end for this browser session (demo `ACT_HILJEM`)
  useEffect(() => { try { const raw = sessionStorage.getItem(LATER_KEY); if (raw) setLater(JSON.parse(raw) as string[]); } catch { /* no storage */ } }, []);
  const postpone = (k: string) => setLater((x) => { const next = [...x.filter((y) => y !== k), k]; try { sessionStorage.setItem(LATER_KEY, JSON.stringify(next)); } catch { /* no storage */ } return next; });

  const rows = useMemo(() => {
    const all = attention.data?.rows ?? [];
    const idx = new Map(later.map((k, i) => [k, i]));
    const head = all.filter((r) => !idx.has(rowKey(r)));
    const tail = all.filter((r) => idx.has(rowKey(r))).sort((a, b) => (idx.get(rowKey(a)) ?? 0) - (idx.get(rowKey(b)) ?? 0));
    return [...head, ...tail];
  }, [attention.data, later]);
  const focus = rows[0];
  const rest = rows.slice(1);
  const visible = showAll ? rest : rest.slice(0, 4);
  const unanswered = threads.data?.length ?? 0;
  const automatic = attention.data?.automatic ?? 0;

  const ask = (e: FormEvent) => { e.preventDefault(); const text = q.trim(); if (!text) return; router.push(`/app/ai?q=${encodeURIComponent(text)}`); };

  return (
    <div className="grid gap-6 max-w-[760px]">
      <div className="pt-4">
        <h1 className="font-heading text-[clamp(26px,2.5vw,32px)] leading-[1.15] font-[650] tracking-[-.03em] [text-wrap:balance]">{t("home.focus.hello", { name: firstName })}</h1>
        <p className="page-sub">{attention.isLoading ? t("common.loading") : rows.length === 0 ? t("home.focus.empty") : rows.length === 1 ? t("home.focus.waitingOne") : t("home.focus.waiting", { n: rows.length })}</p>
      </div>

      <SetupCard summary={summary.data} />

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <QuickLink href="/app/portfell/pakkumine/uus" icon={<IconFile />} label={t("home.createQuote")} />
        <QuickLink href="/app/portfell/leping/uus" icon={<IconFile />} label={t("home.createLease")} />
        <QuickLink href="/app/portfell/objekt/uus" icon={<IconBuilding />} label={t("home.addAsset")} />
        <QuickLink href="/app/portfell/import" icon={<IconImport />} label={t("home.importContract")} />
        <QuickLink href="/app/portfell?tab=osapooled&new=1" icon={<IconUsers />} label={t("home.addParty")} />
      </div>

      {attention.isLoading ? <Card pad><Loading /></Card> : focus && (
        <>
          <FocusCard row={focus} onLater={rows.length > 1 ? () => postpone(rowKey(focus)) : undefined} />
          {rest.length > 0 && (
            <Card>
              <CardHeader title={t("home.focus.next", { n: rest.length })} />
              <ul className="px-[var(--card-padding)] m-0 p-0 list-none">
                {visible.map((r, i) => {
                  const due = dueLabel(r.due);
                  return (
                    <li key={rowKey(r)}>
                      <Link href={r.link} className="dh-row">
                        <span className="dh-n">{String(i + 2).padStart(2, "0")}</span>
                        <KindIcon kind={r.kind} width={16} height={16} className="text-muted flex-none" />
                        <span className="min-w-0 text-[13.5px]">
                          <b className="block font-semibold text-ink truncate">{r.title}</b>
                          <small className="block text-xs text-muted truncate mt-0.5">{r.text}</small>
                        </span>
                        <span className={cx("dh-miks text-xs tabular-nums whitespace-nowrap", due && (due.late || r.tone === "red") ? "text-warning-ink font-semibold" : "text-muted")}>{due?.text}</span>
                        <span className="dh-go">{verb(r)}<IconArrowRight /></span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {!showAll && rest.length > 4 && <div className="px-[var(--card-padding)] pb-3"><Button variant="text" size="sm" onClick={() => setShowAll(true)}>{t("home.focus.showMore")} · {rest.length - 4}</Button></div>}
            </Card>
          )}
        </>
      )}

      {(unanswered > 0 || automatic > 0) && (
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold">
          {unanswered > 0 && <Link href="/app/suhtlus" className="text-primary inline-flex items-center gap-2"><IconChat width={16} height={16} />{unanswered === 1 ? t("home.focus.threads") : t("home.focus.threadsMany", { n: unanswered })}</Link>}
          {automatic > 0 && <Link href="/app/kalender" className="text-muted inline-flex items-center gap-2"><IconCal width={16} height={16} />{automatic === 1 ? t("home.focus.automaticOne") : t("home.focus.automatic", { n: automatic })}</Link>}
        </div>
      )}

      <form onSubmit={ask} className="composer mt-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("home.focus.composer")} aria-label={t("home.focus.composer")} />
        <div className="comp-row">
          <span className="comp-mark" aria-hidden><Glyph /></span>
          <span className="comp-sp" />
          <button type="submit" className="send-btn" aria-label={t("home.focus.send")} disabled={!q.trim()}><IconArrowUp /></button>
        </div>
      </form>
    </div>
  );
}

/** ONE compact focus card: label · small icon + title · one line · ONE primary button · „Hiljem” (no AI draft, no quote, no prism). */
function FocusCard({ row, onLater }: { row: AttentionRow; onLater?: () => void }) {
  const urgent = row.tone === "red";
  const due = dueLabel(row.due);
  return (
    <Card className="dh-hero px-5 py-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={cx("dh-l", urgent && "!text-error")}>{urgent ? t("home.focus.labelUrgent") : t("home.focus.labelYours")}</span>
        {due && <span className={cx("ml-auto text-xs font-medium whitespace-nowrap", due.late ? "text-warning-ink font-semibold" : "text-muted")}>{due.text}</span>}
      </div>
      <h2 className="dh-t mt-2 flex items-center gap-2 min-w-0"><KindIcon kind={row.kind} width={17} height={17} className="text-muted flex-none" /><span className="truncate">{row.title}</span></h2>
      <p className="text-[13px] text-muted mt-1 truncate">{row.text}</p>
      <div className="flex items-center gap-2 mt-3.5 flex-wrap">
        <LinkButton href={row.link} variant="primary" size="sm">{verb(row)}</LinkButton>
        {onLater && <Button variant="text" size="sm" className="ml-auto" onClick={onLater}>{t("home.focus.later")}</Button>}
      </div>
    </Card>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="card flex items-center gap-3 px-4 py-3 hover:shadow-floating transition-shadow min-h-[56px]">
      <span className="w-9 h-9 rounded-control grid place-items-center text-ink bg-subtle flex-none [&>svg]:w-[17px] [&>svg]:h-[17px]">{icon}</span>
      <span className="font-semibold text-[13px]">{label}</span>
      <IconArrowRight width={14} height={14} className="ml-auto text-faint" />
    </Link>
  );
}

/** „Alusta · 10 minutit” (demo v623): four setup steps whose done-state comes from the data, shown until all are done. */
function SetupCard({ summary }: { summary: ReturnType<typeof usePortfolioSummary>["data"] }) {
  if (!summary) return null;
  const contracts = Object.values(summary.contracts_by_status).reduce((a, b) => a + b, 0);
  const steps = [
    { key: "company", done: summary.companies > 0, href: "/app/seaded?tab=ettevotted", title: t("home.setup.company"), sub: t("home.setup.companySub"), icon: <IconUsers /> },
    { key: "building", done: summary.assets.properties > 0, href: "/app/portfell/objekt/uus", title: t("home.setup.building"), sub: t("home.setup.buildingSub"), icon: <IconBuilding /> },
    { key: "spaces", done: summary.assets.spaces > 0, href: "/app/portfell?tab=esemed", title: t("home.setup.spaces"), sub: t("home.setup.spacesSub"), icon: <IconFile /> },
    { key: "contracts", done: contracts > 0, href: "/app/portfell/import", title: t("home.setup.contracts"), sub: t("home.setup.contractsSub"), icon: <IconImport /> },
  ];
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card>
      <CardHeader title={t("home.setup.title")} actions={<Pill tone="primary">{t("home.setup.progress", { done, total: steps.length })}</Pill>}>
        <p className="text-sm text-muted">{t("home.setup.sub")}</p>
      </CardHeader>
      <ol className="px-[var(--card-padding)] pb-2 divide-y" style={{ borderColor: "var(--line)" }}>
        {steps.map((s, i) => (
          <li key={s.key}>
            <Link href={s.href} className="flex items-center gap-3 py-3 -mx-2 px-2 rounded-control hover:bg-subtle min-h-[52px]">
              <span className={cx("w-9 h-9 rounded-control grid place-items-center flex-none", s.done ? "text-success-ink bg-success-subtle" : "text-ink bg-subtle")}>{s.done ? <IconCheck /> : s.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{i + 1}. {s.title}</span>
                <span className="block text-xs text-muted">{s.sub}</span>
              </span>
              <Pill tone={s.done ? "success" : "neutral"}>{s.done ? t("home.setup.done") : t("home.setup.todo")}</Pill>
              <IconArrowRight width={16} height={16} className="text-muted flex-none" />
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
