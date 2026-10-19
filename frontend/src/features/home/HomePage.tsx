"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useMe } from "@/lib/queries/auth";
import { useCompanies } from "@/lib/queries/settings";
import { useAttention, usePortfolioSummary } from "@/lib/queries/portfolio";
import { useThreads } from "@/lib/queries/suhtlus";
import { daysUntil, fmtDate } from "@/lib/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Popover } from "@/components/ui/Popover";
import { Loading } from "@/components/ui/State";
import { IconBuilding, IconImport, IconUsers, IconArrowRight, IconArrowUp, IconCal, IconFile, IconCheck, IconChat, IconChevron, IconClip, IconMic, Glyph } from "@/components/ui/Icons";
import { cx } from "@/lib/format";
import type { AttentionRow } from "@/types/api";
import { setupSteps, type SetupStep } from "@/features/setup/useSetupSteps";

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
  const summary = usePortfolioSummary();
  const companies = useCompanies();
  const attention = useAttention();
  const threads = useThreads({ unanswered: true });
  const [later, setLater] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(false);
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

  const steps = setupSteps(summary.data);
  const setupPending = !!steps && steps.some((s) => !s.done);

  // New account: the setup flow is the home page's only content until it is done (demo v623 → `View.dashboard`).
  if (setupPending) return (
    <div className="mx-auto w-full max-w-[720px] pt-4">
      <div className="dm-hi">{t("home.focus.hello", { name: firstName })}</div>
      <h1 className="dh-h1">{t("home.setup.ask")}</h1>
      <HomeComposer className="mt-10" placeholder={t("home.setup.composer")} />
      <SetupCard steps={steps} company={companies.data?.[0]?.name} />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[720px] grid gap-6">
      <div className="pt-4">
        <div className="dm-hi">{t("home.focus.hello", { name: firstName })}</div>
        <h1 className="dh-h1">{attention.isLoading ? t("common.loading") : rows.length === 0 ? t("home.focus.empty") : rows.length === 1 ? t("home.focus.waitingOne") : t("home.focus.waiting", { n: rows.length })}</h1>
      </div>

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

      <HomeComposer className="mt-2" />
    </div>
  );
}

type PresetId = "quick" | "analysis" | "generator";
const PRESETS: PresetId[] = ["quick", "analysis", "generator"];

type Recognition = { lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RecognitionCtor = new () => Recognition;
const speechCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** The home composer (demo v672 `dashKomposer`): input on top, control row below — mark · mode chip · attachment · voice · send. Sends to the AI page. */
function HomeComposer({ placeholder, className }: { placeholder?: string; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [preset, setPreset] = useState<PresetId>("quick");
  const [menu, setMenu] = useState(false);
  const [canTalk, setCanTalk] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);
  useEffect(() => { setCanTalk(!!speechCtor()); return () => rec.current?.stop(); }, []);

  const ask = (e: FormEvent) => {
    e.preventDefault();
    const text = q.trim(); if (!text) return;
    router.push(`/app/ai?q=${encodeURIComponent(t(`home.focus.presets.${preset}.prefix`) + text)}`);
  };
  const talk = () => {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = speechCtor(); if (!Ctor) return;
    const r = new Ctor();
    r.lang = "et-EE"; r.interimResults = true; r.continuous = false;
    const before = q ? q.replace(/\s*$/, " ") : "";
    r.onresult = (e) => setQ(before + Array.from(e.results).map((x) => x[0].transcript).join(""));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r; r.start(); setListening(true);
  };

  const ph = placeholder && preset === "quick" ? placeholder : t(`home.focus.presets.${preset}.ph`);
  return (
    <form onSubmit={ask} className={cx("composer", className)}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={ph} aria-label={ph} autoComplete="off" />
      <div className="comp-row">
        <span className="comp-mark" aria-hidden><Glyph /></span>
        <Popover open={menu} onClose={() => setMenu(false)} align="left" className="preset-menu" trigger={
          <button type="button" className="preset-btn" onClick={() => setMenu((o) => !o)} aria-haspopup="menu" aria-expanded={menu} title={t("home.focus.mode")}>
            {t(`home.focus.presets.${preset}.t`)}<IconChevron />
          </button>
        }>
          <div role="menu">
            {PRESETS.map((id) => (
              <button key={id} type="button" role="menuitemradio" aria-checked={id === preset} className="preset-item" onClick={() => { setPreset(id); setMenu(false); }}>
                <span className="t">{t(`home.focus.presets.${id}.t`)}{id === preset && <IconCheck />}</span>
                <span className="s">{t(`home.focus.presets.${id}.s`)}</span>
              </button>
            ))}
          </div>
        </Popover>
        <span className="comp-sp" />
        <Link href="/app/portfell/import" className="icon-btn" title={t("home.focus.attach")} aria-label={t("home.focus.attach")}><IconClip /></Link>
        {canTalk && <button type="button" className={cx("icon-btn", listening && "rec")} onClick={talk} title={listening ? t("home.focus.voiceStop") : t("home.focus.voice")} aria-label={listening ? t("home.focus.voiceStop") : t("home.focus.voice")} aria-pressed={listening}><IconMic /></button>}
        <button type="submit" className="send-btn" aria-label={t("home.focus.send")}><IconArrowUp /></button>
      </div>
    </form>
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

/** „Alusta · 10 minutit” (demo v623 `alDashHTML`): progress, the four steps as a rail with their done-state from the data, every step and the button opening the ONE setup page. */
function SetupCard({ steps, company }: { steps: SetupStep[]; company?: string }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  const left = steps.filter((s) => !s.done).reduce((a, s) => a + s.min, 0);
  const status = (s: SetupStep) => s.done ? t("setup.statusDone") : s.pending ? t("setup.statusPendingShort") : s.key === next.key ? t("setup.statusNext", { min: s.min }) : t("setup.minutes", { min: s.min });
  return (
    <section className="card al-dash mt-[22px]">
      <div className="al-dash-pea">
        <div>
          <div className="overline">{company ? t("setup.overline", { name: company }) : t("setup.overlineNew")}</div>
          <h2>{t("home.setup.title")}</h2>
          <p>{t("home.setup.sub")}</p>
        </div>
        <div className="al-dash-edu"><b>{done}</b><span>/ {steps.length}</span></div>
      </div>
      <ol className="al-dash-rada">
        {steps.map((s) => (
          <li key={s.key} className={s.done ? "ok" : s.key === next.key ? "on" : undefined}>
            <Link href={`/app/alusta?step=${s.index + 1}`}>
              <span className="al-dash-o">{s.done ? <IconCheck /> : <i>{s.index + 1}</i>}{status(s)}</span>
              <b>{s.title}</b>
            </Link>
          </li>
        ))}
      </ol>
      <div className="al-dash-jalus">
        <span>{t("home.setup.left", { min: left })}</span>
        <LinkButton href={`/app/alusta?step=${next.index + 1}`} variant="primary">{done ? t("home.setup.resume", { step: next.short }) : t("home.setup.start", { step: next.short })}<IconArrowRight width={14} height={14} /></LinkButton>
      </div>
    </section>
  );
}
