"use client";
import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/api";
import { cx, fmtDate } from "@/lib/format";
import { useCommitReady, useImportBatch, useRemoveImport } from "@/lib/queries/imports";
import { useSetupSteps } from "@/features/setup/useSetupSteps";
import { Button, LinkButton } from "@/components/ui/Button";
import { ErrorState, Loading, Spinner } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { IconArrowLeft, IconArrowRight, IconCheck, IconLock, IconPlus } from "@/components/ui/Icons";
import type { DeskToimik, ToimikState } from "@/types/api";
import { IMPORT_ACCEPT, useImportFiles } from "./useImportFiles";
import { useDropOverlay } from "./useDropOverlay";
import { DropOverlay } from "./ImportsPage";
import { ToimikRow, rowTitle } from "./deskRows";

const GROUPS: { key: ToimikState; states: ToimikState[] }[] = [
  { key: "loen", states: ["loen"] }, { key: "ootab", states: ["ootab"] }, { key: "valmis", states: ["valmis"] },
  { key: "kinnitatud", states: ["kinnitatud"] }, { key: "ei", states: ["ei", "viga"] },
];
const plural = (n: number, one: string, many: string) => (n === 1 ? one : many.replace("{n}", String(n)));

/** One import (demo v638 `impLaudHTML`): summary card with counts, the toimik strip and „Kinnita N valmis”, then the
 *  toimikud grouped by state — a contract with its annexes and documents on one row. */
export function ImportBatchPage({ batchId }: { batchId: string }) {
  const desk = useImportBatch(batchId);
  const commitReady = useCommitReady(batchId);
  const remove = useRemoveImport();
  const { send, busy } = useImportFiles();
  const setup = useSetupSteps();
  const router = useRouter();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const over = useDropOverlay((files) => void send(files, batchId));

  if (desk.isLoading) return <Loading rows={6} />;
  if (desk.error || !desk.data?.batch) return <ErrorState error={desk.error} onRetry={() => desk.refetch()} />;
  const b = desk.data.batch, T = desk.data.toimikud ?? [], ready = desk.data.ready!;
  const by = (...s: ToimikState[]) => T.filter((x) => s.includes(x.state)).sort((a, z) => rowTitle(a.row).localeCompare(rowTitle(z.row), "et"));
  const G = { loen: by("loen"), ootab: by("ootab"), valmis: by("valmis"), kinnitatud: by("kinnitatud"), ei: by("ei", "viga") };
  const loen = b.reading;
  // „Jätka” = the file of this import opened last that still waits; else the first in the queue
  const queue = [...G.ootab, ...G.valmis];
  const last = queue.filter((x) => x.row.opened_at).sort((a, z) => (z.row.opened_at ?? "").localeCompare(a.row.opened_at ?? ""))[0];
  const next = last ?? queue[0];
  const pending = !!setup.steps && !setup.complete;

  const confirmReady = async () => {
    try {
      const r = await commitReady.mutateAsync();
      toast.success([plural(r.contracts, "1 leping registris", "{n} lepingut registris"), r.children ? plural(r.children, "1 lisa või dokument", "{n} lisa ja dokumenti") : "", plural(r.key_dates, "1 tähtaeg kalendris", "{n} tähtaega kalendris")].filter(Boolean).join(" · "));
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const removeRow = async (id: string) => { try { await remove.mutateAsync(id); } catch (e) { toast.error(errorMessage(e)); } };

  const tile = (cls: string, n: number, label: string) => <div className={cx("ib-k-a", cls)}><b>{n}</b><span>{label}</span></div>;
  return (
    <div className="ib">
      <LinkButton href="/app/portfell/import" variant="ghost" size="sm" className="w-fit mb-[18px]"><IconArrowLeft width={16} height={16} />{t("imports.desk.back")}</LinkButton>
      <div className="page-head">
        <div className="min-w-0">
          {pending && <div className="overline ib-samm">{t("imports.desk.setupStep")}</div>}
          <h1 className="page-h1">{b.name}</h1>
          <p className="page-sub">{t("imports.desk.batchSub", { time: b.time })}</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Spinner /> : <IconPlus width={16} height={16} />}{t("imports.desk.addFiles")}</button>
      </div>
      <input ref={input} type="file" multiple accept={IMPORT_ACCEPT} hidden onChange={(e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void send(f, batchId); }} />

      <section className="card ib-kokku" aria-label={b.name}>
        <div className="ib-k-rida">
          <div>
            <div className="overline">{t("imports.desk.summaryLabel", { date: fmtDate(b.date) })}</div>
            <div className="ib-k-suur"><b>{b.files}</b><span>{b.files === 1 ? t("imports.desk.fileOne") : t("imports.desk.fileMany")}</span></div>
            <div className="ib-k-s">{loen ? t("imports.desk.reading", { done: b.files - loen, n: b.files })
              : [t("imports.desk.records", { n: plural(b.records, t("imports.desk.recordOne"), t("imports.desk.recordMany")) }), b.children ? t("imports.desk.childrenUnder", { n: plural(b.children, t("imports.desk.childOne"), t("imports.desk.childMany")) }) : ""].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="ib-k-arvud">
            {tile("kord", G.ootab.length, t("imports.desk.tileReview"))}{tile("", G.valmis.length, t("imports.desk.tileReady"))}{tile("ok", G.kinnitatud.length, t("imports.desk.tileCommitted"))}{G.ei.length > 0 && tile("hall", G.ei.length, t("imports.desk.tileExcluded"))}
          </div>
        </div>
        <div className="ib-seg" aria-hidden>{[...G.kinnitatud, ...G.valmis, ...G.ootab, ...G.loen, ...G.ei].map((x) => <i key={x.row.id} className={x.state} title={rowTitle(x.row)} />)}</div>
        <div className="ib-k-teg">
          {next && !loen && <Button variant="primary" onClick={() => router.push(`/app/portfell/import/${next.row.id}`)}>{last ? t("imports.desk.continue") : G.ootab.length ? t("imports.desk.start") : t("imports.desk.reviewReady")}<IconArrowRight width={16} height={16} /></Button>}
          {!next && G.kinnitatud.length > 0 && !loen && <LinkButton href="/app/portfell?tab=lepingud" variant="primary">{t("imports.desk.result")}<IconArrowRight width={16} height={16} /></LinkButton>}
          {G.valmis.length > 0 && !loen && (
            <>
              <Button onClick={confirmReady} busy={commitReady.isPending}><IconCheck width={16} height={16} />{t("imports.desk.confirmReady", { n: G.valmis.length })}</Button>
              <span className="ib-k-note">{[plural(ready.contracts, t("imports.desk.readyContractOne"), t("imports.desk.readyContractMany")), ready.children ? plural(ready.children, t("imports.desk.childOne"), t("imports.desk.childMany")) : "", plural(ready.key_dates, t("imports.desk.readyKeyDateOne"), t("imports.desk.readyKeyDateMany")), ready.new_parties ? plural(ready.new_parties, t("imports.desk.readyPartyOne"), t("imports.desk.readyPartyMany")) : ""].filter(Boolean).join(" · ")}</span>
            </>
          )}
          {loen > 0 && <span className="ib-k-note"><i className="ib-spin" />{t("imports.desk.readingNote")}</span>}
        </div>
      </section>

      {GROUPS.map(({ key }) => <Group key={key} k={key} list={G[key as keyof typeof G]} onRemove={removeRow} />)}

      <div className="ib-jalus">
        <span><IconLock />{t("imports.desk.footer")}</span>
        <span>{G.kinnitatud.length > 0 && <Link className="steplink" href="/app/portfell?tab=lepingud">{t("imports.desk.result")} →</Link>}</span>
      </div>
      <DropOverlay on={over} text={t("imports.desk.dropOverlay")} />
    </div>
  );
}

function Group({ k, list, onRemove }: { k: ToimikState; list: DeskToimik[]; onRemove: (id: string) => void }) {
  if (!list.length) return null;
  const key = k as "loen" | "ootab" | "valmis" | "kinnitatud" | "ei";
  return (
    <section className={cx("ib-ryhm", key)}>
      <div className="ib-ryhm-pea"><h2>{t(`imports.desk.groups.${key}`)}</h2><span className="ib-arv">{list.length}</span><p>{t(`imports.desk.groups.${key}Sub`)}</p></div>
      <div className="card ib-kast">{list.map((tk) => <ToimikRow key={tk.row.id} tk={tk} onRemove={onRemove} />)}</div>
    </section>
  );
}
