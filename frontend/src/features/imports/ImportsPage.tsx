"use client";
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n";
import { useImportDesk } from "@/lib/queries/imports";
import { useSetupSteps } from "@/features/setup/useSetupSteps";
import { LinkButton } from "@/components/ui/Button";
import { ErrorState, Loading, Spinner } from "@/components/ui/State";
import { IconArrowLeft, IconUpload } from "@/components/ui/Icons";
import { cx, fmtDateTime } from "@/lib/format";
import type { DeskBatch } from "@/types/api";
import { IMPORT_ACCEPT, useImportFiles } from "./useImportFiles";
import { useDropOverlay } from "./useDropOverlay";

const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;

/** „Lepingute import” (demo v638 `impLoendHTML`): the imports as cards, Pooleli and Lõpetatud; empty → one big drop area. */
export function ImportsPage() {
  const desk = useImportDesk();
  const router = useRouter();
  const { send, busy } = useImportFiles();
  const setup = useSetupSteps();
  const input = useRef<HTMLInputElement>(null);
  const onFiles = async (files: File[]) => { const r = await send(files); if (r) router.push(`/app/portfell/import/p/${r.batchId}`); };
  const over = useDropOverlay(onFiles);
  const pending = !!setup.steps && !setup.complete;

  if (desk.isLoading) return <Loading rows={4} />;
  if (desk.error) return <ErrorState error={desk.error} onRetry={() => desk.refetch()} />;
  const batches = desk.data?.batches ?? [];
  const open = batches.filter((b) => b.state !== "done"), done = batches.filter((b) => b.state === "done");
  return (
    <div className="ib">
      <LinkButton href={pending ? "/app/alusta" : "/app/portfell"} variant="ghost" size="sm" className="w-fit mb-[18px]"><IconArrowLeft width={16} height={16} />{pending ? t("imports.desk.backSetup") : t("imports.desk.backPortfolio")}</LinkButton>
      <div className="page-head">
        <div className="min-w-0">
          {pending && <div className="overline ib-samm">{t("imports.desk.setupStep")}</div>}
          <h1 className="page-h1">{t("imports.title")}</h1>
          <p className="page-sub">{batches.length ? t("imports.desk.listSub") : t("imports.desk.emptySub")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <LinkButton href="/app/portfell/import/manual" variant="ghost">{t("imports.manualLink")}</LinkButton>
          {batches.length > 0 && <button type="button" className={cx("btn", open.length ? "btn-ghost" : "btn-primary")} onClick={() => input.current?.click()} disabled={busy}>{busy ? <Spinner /> : <IconUpload width={16} height={16} />}{t("imports.desk.newImport")}</button>}
        </div>
      </div>
      <input ref={input} type="file" multiple accept={IMPORT_ACCEPT} hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void onFiles(f); }} />
      {batches.length === 0 ? (
        <DropArea busy={busy} onPick={() => input.current?.click()} />
      ) : (
        <>
          <Group title={t("imports.desk.open")} sub={t("imports.desk.openSub")} list={open} />
          <Group title={t("imports.desk.done")} sub={t("imports.desk.doneSub")} list={done} />
        </>
      )}
      <DropOverlay on={over} text={batches.length ? t("imports.desk.dropOverlayNew") : t("imports.desk.dropOverlay")} />
    </div>
  );
}

export function DropArea({ busy, onPick }: { busy: boolean; onPick: () => void }) {
  return (
    <button type="button" className="ib-tyhi w-full" onClick={onPick} disabled={busy}>
      <span className="ib-tyhi-ik"><IconUpload /></span>
      <b>{t("imports.desk.dropTitle")}</b>
      <span>{t("imports.desk.dropText")}<br />{t("imports.desk.dropText2")}</span>
      <span className="btn btn-primary">{busy ? <Spinner /> : null}{t("imports.desk.pickFiles")}</span>
    </button>
  );
}

export function DropOverlay({ on, text }: { on: boolean; text: string }) {
  return <div className={cx("ib-lohista", on && "on")} aria-hidden><div><IconUpload /><b>{text}</b><span>{t("imports.desk.dropTypes")}</span></div></div>;
}

function Group({ title, sub, list }: { title: string; sub: string; list: DeskBatch[] }) {
  if (!list.length) return null;
  return (
    <section className="ib-ryhm">
      <div className="ib-ryhm-pea"><h2>{title}</h2><span className="ib-arv">{list.length}</span><p>{sub}</p></div>
      <div className="ib-kaardid">{list.map((b) => <BatchCard key={b.id} b={b} />)}</div>
    </section>
  );
}

/** Demo `impPartiiKaart`: name + state · time, files, contracts · committed / records · progress · whose turn. */
function BatchCard({ b }: { b: DeskBatch }) {
  const pct = b.records ? Math.round(((b.committed + b.excluded) / b.records) * 100) : 0;
  const mine = b.state === "open";
  const step: { kord: string; tx: ReactNode } = b.reading
    ? { kord: "teine", tx: t("imports.desk.stepReading", { done: b.files - b.reading, n: b.files }) }
    : mine ? { kord: "minu", tx: [b.review ? (b.review === 1 ? t("imports.desk.needsReviewOne") : t("imports.desk.needsReviewMany", { n: b.review })) : "", b.ready ? t("imports.desk.readyN", { n: b.ready }) : ""].filter(Boolean).join(" · ") }
    : { kord: "ok", tx: t("imports.desk.stepOk") };
  const pill = b.reading ? ["blue", t("imports.desk.stateReading")] : mine ? ["amber", t("imports.desk.stateOpen")] : ["green", t("imports.desk.stateDone")];
  return (
    <Link href={`/app/portfell/import/p/${b.id}`} className={cx("card ib-kaart", mine && "minu")}>
      <div className="ib-kaart-pea"><span className="t">{b.name}</span><span className={`pill ${pill[0]}`}>{pill[1]}</span></div>
      <div className="s">{t("imports.desk.cardMeta", { time: b.time, files: n(b.files, t("imports.desk.fileOne"), t("imports.desk.fileMany")), contracts: n(b.contracts, "leping", "lepingut") })}</div>
      <div className="ib-kaart-jalus"><span className="sum">{b.committed}<small> {t("imports.desk.cardCommitted", { n: b.records })}</small></span><span className="per">{b.excluded ? `${b.excluded} ${t("imports.desk.olek.excluded")}` : ""}</span></div>
      <div className="ib-kaart-aeg"><span>{b.opened_at ? t("imports.desk.lastOpened", { date: fmtDateTime(b.opened_at) }) : t("imports.desk.notStarted")}</span><span className="track"><i style={{ width: `${pct}%` }} /></span><span>{pct}%</span></div>
      <div className={cx("ib-kaart-samm", step.kord)}>{step.kord === "teine" ? <Spinner /> : <i />}<span>{step.tx}</span></div>
    </Link>
  );
}

