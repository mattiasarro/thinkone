"use client";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { cx, fmtDate, fmtFixed } from "@/lib/format";
import { IconCheck, IconChevronRight, IconEdit, IconEye, IconFile, IconShield, IconX } from "@/components/ui/Icons";
import type { DeskRow, DeskToimik } from "@/types/api";

/** File badge (demo `impIkoon`): ASiC-E shield, PDF, WORD, scan. */
export function FileBadge({ row, small }: { row: Pick<DeskRow, "format" | "status" | "error">; small?: boolean }) {
  const scan = row.status === "failed" && /tekstikiht|skaneeri/i.test(row.error ?? "");
  const f = scan ? "skann" : row.format === "asice" ? "asice" : row.format === "docx" ? "docx" : row.format === "pdf" ? "pdf" : "fail";
  const [label, Icon] = ({ asice: ["ASiC-E", IconShield], pdf: ["PDF", IconFile], docx: ["WORD", IconEdit], skann: ["SKANN", IconEye], fail: ["FAIL", IconFile] } as const)[f];
  return <span className={cx("ib-ik", small && "s")} data-f={f} aria-hidden><Icon /><b>{label}</b></span>;
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const annexLabel = (r: DeskRow) => [r.annex_number ? t("imports.desk.annex", { nr: r.annex_number }) : t("imports.desk.annexNoNr"), r.heading].filter(Boolean).join(" · ");
const changes = (r: DeskRow) => r.changes.slice(0, 2).map((c) => `${lower(c.label)} → ${[c.value, c.unit].filter(Boolean).join(" ")}`).join(" · ");
const out = (r: DeskRow) => r.state === "ei" || r.state === "viga";

/** Row title (demo `impPealkiri`): the counterparty for a lease, „Lisa N · …” owner for an annex, the type for a document. */
export function rowTitle(r: DeskRow): string {
  if (out(r)) return r.filename;
  if (r.kind === "document") return r.title || t("imports.desk.document");
  if (r.kind === "annex") return r.counterparty || annexLabel(r);
  return r.counterparty || (r.category === "lease" ? t("imports.desk.unknownTenant") : r.title || r.filename);
}

function subtitle(r: DeskRow): string {
  if (r.state === "viga") return t("imports.desk.readFailed");
  if (r.state === "ei") return r.kind === "annex" ? [annexLabel(r), r.counterparty].filter(Boolean).join(" · ") : [r.category === "lease" ? t("imports.desk.lease") : tEnum("contract.category", r.category ?? "other"), r.counterparty].filter(Boolean).join(" · ");
  if (r.kind === "annex") return [annexLabel(r), r.parent?.number ? t("imports.desk.amends", { number: r.parent.number }) : ""].filter(Boolean).join(" · ");
  if (r.kind === "document") return `${t("imports.desk.document")} · ${r.filename}`;
  if (r.category !== "lease") return [tEnum("contract.category", r.category ?? "other"), r.spaces.join(" + ")].filter(Boolean).join(" · ");
  return [t("imports.desk.lease"), r.spaces.length ? r.spaces.join(" + ") : t("imports.desk.noSpace"), r.spaces.length && r.area_m2 ? `${fmtFixed(r.area_m2, 1)} m²` : ""].filter(Boolean).join(" · ");
}

function facts(r: DeskRow): string {
  if (r.state === "ei") return r.excluded_reason ?? "";
  if (r.state === "viga") return r.error ?? "";
  if (r.state === "kinnitatud") return r.committed_number ? t("imports.desk.inRegistry", { number: r.committed_number }) : t("imports.desk.saved");
  if (r.kind === "contract") {
    const period = r.start_date && r.end_date ? `${fmtDate(r.start_date)} – ${fmtDate(r.end_date)}` : r.end_date ? fmtDate(r.end_date) : "";
    return [r.monthly != null ? t("imports.desk.perMonth", { eur: fmtFixed(r.monthly) }) : "", period].filter(Boolean).join(" · ");
  }
  if (r.kind === "annex") return changes(r);
  return r.parent?.number ? t("imports.desk.attachTo", { number: r.parent.number }) : t("imports.desk.attachFile");
}

/** State word (demo `impOlek`). */
function Olek({ tk }: { tk: DeskToimik }) {
  const r = tk.row;
  if (tk.state === "loen") return <span className="ib-olek loen"><i className="ib-spin" />{tEnum("imports.desk.statusReading", r.status)}</span>;
  if (tk.state === "viga") return <span className="ib-olek viga">{t("imports.desk.olek.failed")}</span>;
  if (tk.state === "ei") return <span className="ib-olek hall">{t("imports.desk.olek.excluded")}</span>;
  if (tk.state === "kinnitatud") return <span className="ib-olek ok2"><IconCheck />{r.kind === "annex" ? t("imports.desk.olek.committedAnnex") : r.kind === "document" ? t("imports.desk.olek.committedDoc") : t("imports.desk.olek.committed")}</span>;
  if (tk.state === "valmis") return <span className="ib-olek ok"><IconCheck />{r.kind === "contract" ? t("imports.desk.olek.ok") : t("imports.desk.olek.okAnnex")}</span>;
  const n = tk.open;
  const link = r.needs_link ? t("imports.desk.olek.pickSpace") : r.needs_parent ? t("imports.desk.olek.pickContract") : "";
  const rest = n - (r.needs_link || r.needs_parent ? 1 : 0);
  const txt = [link, rest > 0 ? (rest === 1 ? t("imports.desk.olek.reviewOne") : t("imports.desk.olek.reviewMany", { n: rest })) : ""].filter(Boolean).join(" · ") || t("imports.desk.olek.review");
  return <span className="ib-olek kord"><i />{txt}</span>;
}

function ChildRow({ c }: { c: DeskRow }) {
  const title = c.kind === "annex" ? annexLabel(c) : c.title || t("imports.desk.document");
  const sub = c.kind === "annex" ? changes(c) || c.title || "" : t("imports.desk.child.fileOnly");
  const open = c.open + (c.needs_parent ? 1 : 0);
  return (
    <Link href={`/app/portfell/import/${c.id}`} className="ib-laps" title={c.filename}>
      <FileBadge row={c} small />
      <span className="ib-laps-t"><b>{title}</b><small>{sub}</small></span>
      <span className={cx("ib-olek", c.state === "kinnitatud" ? "ok2" : open ? "kord" : "hall")}>
        {c.state === "kinnitatud" ? <><IconCheck />{t("imports.desk.child.withContract")}</> : open ? <><i />{open === 1 ? t("imports.desk.child.reviewOne") : t("imports.desk.child.reviewMany", { n: open })}</> : t("imports.desk.child.followsContract")}
      </span>
    </Link>
  );
}

/** One toimik (demo `impRida`): the contract row and its annexes/documents on a tree line below. */
export function ToimikRow({ tk, onRemove }: { tk: DeskToimik; onRemove: (id: string) => void }) {
  const r = tk.row;
  const gone = tk.state === "ei" || tk.state === "viga";
  return (
    <div className={cx("ib-toimik", tk.state)}>
      {tk.state === "loen" ? (
        <div className="ib-rida loen">
          <FileBadge row={r} />
          <span className="ib-kes"><b>{r.filename}</b><small>{tEnum("imports.desk.statusReading", r.status)}</small></span>
          <span className="ib-loen-riba"><i /></span>
          <Olek tk={tk} />
          <span />
        </div>
      ) : (
        <Link href={`/app/portfell/import/${r.id}`} className={cx("ib-rida", tk.state)} title={r.filename}>
          <FileBadge row={r} />
          <span className="ib-kes"><b>{rowTitle(r)}</b><small>{subtitle(r)}</small></span>
          <span className="ib-fakt">{facts(r)}</span>
          <Olek tk={tk} />
          {gone ? (
            <button type="button" className="ib-x" title={t("imports.desk.remove")} aria-label={t("imports.desk.remove")} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(r.id); }}><IconX /></button>
          ) : <span className="ib-nool" aria-hidden><IconChevronRight /></span>}
        </Link>
      )}
      {tk.children.length > 0 && <div className="ib-lapsed">{tk.children.map((c) => <ChildRow key={c.id} c={c} />)}</div>}
    </div>
  );
}
