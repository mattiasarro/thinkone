"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useCancelQuote, useDeleteQuote, usePostQuoteMessage, useQuote, useRemindQuote, useResendLetter, useSendQuote, useSnoozeQuote, useUpdateQuote, useMarkQuoteRead } from "@/lib/queries/quotes";
import { Card, CardBody, CardHeader, PageHead } from "@/components/ui/Card";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Pill, statusTone, type Tone } from "@/components/ui/Pill";
import { ErrorState, Loading } from "@/components/ui/State";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { IconArrowRight, IconChevronLeft, IconExternal, IconLink, IconTrash } from "@/components/ui/Icons";
import { useConvertQuote, useLease } from "@/lib/queries/leases";
import { cx, daysUntil, firstOfNextMonth, fmtDate, fmtDateTime, fmtEur, fmtNum, valueToString } from "@/lib/format";
import { useRun, type Run } from "./quoteRun";
import { AttachmentsCard, SpacesCard, TermsCard } from "./QuoteEditCards";
import type { QuoteChange, QuoteDetail, QuoteMessage } from "@/types/api";

const OPEN = new Set(["draft", "sent", "client_proposal", "accepted"]);

export function QuoteDetailPage({ id }: { id: string }) {
  const q = useQuote(id);
  if (q.isLoading) return <Loading rows={6} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <Detail q={q.data} refetch={() => void q.refetch()} />;
}

function Detail({ q, refetch }: { q: QuoteDetail; refetch: () => void }) {
  const run = useRun(refetch);
  const router = useRouter();
  const toast = useToast();
  const cancel = useCancelQuote(q.id);
  const del = useDeleteQuote();
  const markRead = useMarkQuoteRead(q.id);
  const [cancelDlg, setCancelDlg] = useState(false);
  const [delDlg, setDelDlg] = useState(false);
  const [changesOpen, setChangesOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [viewVersion, setViewVersion] = useState<number | null>(null);
  const isOpen = OPEN.has(q.status);
  const latest = q.versions[q.versions.length - 1];

  // unread client messages → read once on open
  const marked = useRef(false);
  useEffect(() => { if (!marked.current && q.unread > 0) { marked.current = true; markRead.mutate(); } }, [q.unread, markRead]);

  const docSrc = viewVersion ? `/api/v1/quotes/${q.id}/versions/${viewVersion}/document.html` : `/api/v1/quotes/${q.id}/document.html`;
  const onCancel = async () => { const r = await run(cancel.mutateAsync({}), t("quotes.guide.cancelled")); if (r) setCancelDlg(false); };
  const onDelete = async () => { try { await del.mutateAsync(q.id); toast.success(t("quotes.actions.deleted")); router.replace("/app/portfell?tab=pakkumised"); } catch (e) { setDelDlg(false); await run(Promise.reject(e)); } };

  return (
    <div className="grid gap-5">
      <LinkButton href="/app/portfell?tab=pakkumised" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("quotes.back")}</LinkButton>
      <PageHead
        title={<span className="flex items-center gap-3 flex-wrap"><span className="font-mono text-base text-muted font-medium">{q.number}</span>{q.party.name}</span>}
        sub={<span className="flex flex-wrap items-center gap-2 mt-2"><Pill tone={statusTone(q.status)}>{tEnum("quotes.status", q.status)}</Pill><Link href={`/app/portfell/objekt/${q.property.id}`} className="text-primary font-semibold text-sm">{q.property.name}</Link>{q.space_names.length > 0 && <span className="text-muted text-sm">· {q.space_names.join(", ")}</span>}</span>}
        actions={<>
          {q.link && <a href={q.link.url} target="_blank" rel="noopener" className="btn btn-ghost"><IconExternal width={16} height={16} />{t("quotes.client.viewAsClient")}</a>}
          {isOpen && q.status !== "draft" && <Button variant="text" onClick={() => setCancelDlg(true)}>{t("quotes.guide.cancel")}</Button>}
          {q.status === "draft" && <Button variant="text" className="btn-destructive" onClick={() => setDelDlg(true)}><IconTrash width={16} height={16} />{t("quotes.actions.delete")}</Button>}
        </>}
      />

      {/* riba: document pills */}
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <button type="button" className={cx("pill", viewVersion === null && "primary")} onClick={() => setViewVersion(null)}>{t("quotes.riba.document")}</button>
        {q.attachments.map((a) => a.url ? <a key={a.attachment_id} href={a.url} target="_blank" rel="noopener" className="pill hover:text-ink">{t("quotes.attachments.item", { number: a.number, title: a.title })}</a> : <span key={a.attachment_id} className="pill">{t("quotes.attachments.item", { number: a.number, title: a.title })}</span>)}
        {latest?.pdf_url && <a href={latest.pdf_url} target="_blank" rel="noopener" className="pill hover:text-ink">{t("quotes.riba.preview")}</a>}
        {q.pending_changes.length > 0 && <button type="button" className="pill warning" onClick={() => setChangesOpen(true)}>{t("quotes.riba.changes", { n: q.pending_changes.length })}</button>}
        {q.versions.length > 0 && <button type="button" className={cx("pill", viewVersion !== null && "info")} onClick={() => setVersionsOpen(true)}>{viewVersion !== null ? `${t("quotes.versions.v", { n: viewVersion })} · ` : ""}{t("quotes.riba.versions", { n: q.versions.length })}</button>}
      </div>

      <KeySheet q={q} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] items-start">
        <div className="min-w-0">
          <iframe key={`${q.version}-${viewVersion ?? "live"}`} title={t("quotes.riba.document")} src={docSrc} className="w-full bg-white rounded-surface shadow-surface" style={{ minHeight: "1100px", border: 0 }} />
        </div>
        <div className="grid gap-5 min-w-0">
          <GuideCard q={q} run={run} onCancel={() => setCancelDlg(true)} />
          <ClientCard q={q} run={run} />
          <SpacesCard q={q} run={run} />
          <TermsCard q={q} run={run} />
          <AttachmentsCard q={q} run={run} />
          {q.status !== "draft" && <NegotiationCard q={q} />}
          {q.status !== "draft" && <ChatCard q={q} run={run} />}
          <LettersCard q={q} />
        </div>
      </div>

      <Modal open={changesOpen} onClose={() => setChangesOpen(false)} title={t("quotes.changes.title")} sub={t("quotes.changes.sub")}>
        <ChangeList changes={q.pending_changes} />
      </Modal>
      <Modal open={versionsOpen} onClose={() => setVersionsOpen(false)} title={t("quotes.versions.title")} wide>
        <ol className="grid gap-4">
          {[...q.versions].reverse().map((v) => (
            <li key={v.id} className="rounded-control p-3 grid gap-2" style={{ background: "var(--color-surface-subtle)" }}>
              <div className="flex items-center gap-2 flex-wrap">
                <Pill tone={v.number === q.sent_version ? "primary" : "neutral"}>{t("quotes.versions.v", { n: v.number })}</Pill>
                <span className="text-sm text-muted">{fmtDateTime(v.created_at)}</span>
                <span className="ml-auto flex gap-1">
                  {v.pdf_url && <a href={v.pdf_url} target="_blank" rel="noopener" className="btn btn-text btn-sm"><IconExternal width={14} height={14} />{t("quotes.versions.pdf")}</a>}
                  <Button size="sm" variant={viewVersion === v.number ? "primary" : "ghost"} onClick={() => { setViewVersion(v.number); setVersionsOpen(false); }}>{t("quotes.versions.open")}</Button>
                </span>
              </div>
              {v.note && <p className="text-sm whitespace-pre-wrap"><span className="text-muted">{t("quotes.versions.note")}:</span> {v.note}</p>}
              {v.changes.length === 0 ? <p className="text-xs text-muted">{t("quotes.versions.noChanges")}</p> : <ChangeList changes={v.changes} compact />}
            </li>
          ))}
        </ol>
      </Modal>
      <ConfirmDialog open={cancelDlg} onClose={() => setCancelDlg(false)} onConfirm={onCancel} busy={cancel.isPending} title={t("quotes.guide.cancel")} body={t("quotes.guide.cancelConfirm", { number: q.number })} />
      <ConfirmDialog open={delDlg} onClose={() => setDelDlg(false)} onConfirm={onDelete} busy={del.isPending} title={t("quotes.actions.delete")} body={t("quotes.actions.deleteConfirm", { number: q.number })} />
    </div>
  );
}

function ChangeList({ changes, compact }: { changes: QuoteChange[]; compact?: boolean }) {
  return (
    <ul className={cx("grid", compact ? "gap-1 text-xs" : "gap-2 text-sm")}>
      {changes.map((c) => <li key={c.key} className="flex gap-2 flex-wrap"><span className="font-medium">{c.label}:</span><span className="text-muted line-through">{valueToString(c.before)}</span><span>→</span><span className="font-semibold">{valueToString(c.after)}</span></li>)}
    </ul>
  );
}

/** Key-data sheet (demo `offerVotiHTML`): four numbers above the document, the time on the right. */
function KeySheet({ q }: { q: QuoteDetail }) {
  const tot = q.totals;
  const n = daysUntil(q.valid_until);
  const time = !OPEN.has(q.status) ? `${tEnum("quotes.status", q.status)}${q.close_reason ? ` · ${q.close_reason}` : ""}`
    : q.status === "accepted" ? t("quotes.validUntilOnly", { date: fmtDate(q.valid_until) })
    : n < 0 ? t("quotes.expiredOn", { date: fmtDate(q.valid_until) }) : t("quotes.validDaysUntil", { n, date: fmtDate(q.valid_until) });
  return (
    <Card className="pad">
      <div className="flex flex-wrap items-start gap-4 justify-between">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 flex-1 min-w-0">
          <Tile label={t("quotes.key.rent")} value={fmtEur(tot.monthly_net)} sub={tot.vat_taxable ? t("quotes.key.gross", { amount: fmtEur(tot.monthly_gross) }) : undefined} />
          <Tile label={t("quotes.key.price")} value={fmtEur(tot.avg_price_per_m2)} sub={tot.stepped ? "ø" : undefined} />
          <Tile label={t("quotes.key.area")} value={`${fmtNum(tot.area_m2)} m²`} />
          <Tile label={t("quotes.key.period")} value={t("quotes.key.months", { n: q.period_months })} />
        </div>
        <div className={cx("text-sm font-medium self-center", OPEN.has(q.status) && n <= 3 ? "text-warning" : "text-muted")}>{time}</div>
      </div>
    </Card>
  );
}
function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="min-w-0"><div className="overline">{label}</div><div className="font-heading text-2xl font-semibold tabular-nums mt-0.5">{value}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div>;
}

// ---------------------------------------------------------------- juhtkaart ---------------------------------------

/** ONE guide card (demo `juhtKaart`): whose-turn mark · text · meta · ONE primary button; other options as text links. */
function GuideCard({ q, run, onCancel }: { q: QuoteDetail; run: Run; onCancel: () => void }) {
  const ns = q.next_step;
  const toast = useToast();
  const send = useSendQuote(q.id);
  const remind = useRemindQuote(q.id);
  const snooze = useSnoozeQuote(q.id);
  const resend = useResendLetter(q.id);
  const [sendOpen, setSendOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminder, setReminder] = useState(q.reminder?.text ?? "");
  const [email, setEmail] = useState(q.contact.email);
  useEffect(() => { setReminder(q.reminder?.text ?? ""); }, [q.reminder?.text]);
  const n = daysUntil(q.valid_until);

  const whose: { tone: Tone; label: string } = !ns ? { tone: "success", label: t("quotes.guide.done") } : ns.side === "client" ? { tone: "neutral", label: t("quotes.guide.clientTurn") } : { tone: ns.urgent ? "warning" : "primary", label: t("quotes.guide.yourTurn") };
  const title = ns ? ns.title : q.status === "converted" ? t("quotes.guide.convertedTitle") : t("quotes.guide.closed");
  const text = ns ? ns.text : q.status === "converted" ? t("quotes.guide.convertedText") : `${tEnum("quotes.status", q.status)}${q.close_reason ? ` · ${t("quotes.guide.reason")}: ${q.close_reason}` : ""}`;

  const doSend = async () => { const r = await run(send.mutateAsync({ message: msg.trim() || null, expected_version: q.version }), t("quotes.guide.sent")); if (r) { setSendOpen(false); setMsg(""); } };
  const doRemind = async () => { const r = await run(remind.mutateAsync({ text: reminder.trim() || null }), t("quotes.guide.reminded")); if (r) setReminderOpen(false); };
  const convert = useConvertQuote(q.id);
  const router = useRouter();
  const [mode, setMode] = useState<"separate" | "shared">("separate");
  const [handover, setHandover] = useState(firstOfNextMonth());
  const contractIds = ((q.conversion?.contract_ids as string[] | undefined) ?? []);
  const doConvert = async () => {
    const drafts = await run(convert.mutateAsync({ mode: q.spaces.length > 1 ? mode : "separate", handover: handover || null }), undefined);
    if (drafts && drafts.length) { toast.success(drafts.length > 1 ? t("quotes.guide.convertedMany", { n: drafts.length }) : t("quotes.guide.converted")); router.push(`/app/portfell/leping/${drafts[0].id}`); }
  };

  let body: ReactNode = null;
  let primary: ReactNode = null;
  let secondary: ReactNode = null;
  switch (ns?.code) {
    case "send":
      primary = <Button variant="primary" onClick={() => setSendOpen(true)}>{t("quotes.guide.send")}</Button>;
      break;
    case "answer":
      body = (
        <div>
          <textarea className="fld" rows={4} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("quotes.guide.replyPlaceholder")} aria-label={t("quotes.guide.reply")} />
          <p className="text-xs text-muted mt-1">{q.pending_changes.length > 0 ? t("quotes.guide.resendWithChanges", { n: q.pending_changes.length, v: q.sent_version + 1 }) : t("quotes.guide.resendNoChanges", { v: q.sent_version })}</p>
        </div>
      );
      primary = <Button variant="primary" busy={send.isPending} disabled={!msg.trim() && q.pending_changes.length === 0} onClick={doSend}>{t("quotes.guide.resend")}</Button>;
      secondary = <Button variant="text" size="sm" onClick={onCancel}>{t("quotes.guide.cancel")}</Button>;
      break;
    case "remind":
      body = <textarea className="fld" rows={6} value={reminder} onChange={(e) => setReminder(e.target.value)} aria-label={t("quotes.guide.remind")} />;
      primary = <Button variant="primary" busy={remind.isPending} onClick={doRemind}>{t("quotes.guide.remind")}</Button>;
      secondary = <Button variant="text" size="sm" busy={snooze.isPending} onClick={() => run(snooze.mutateAsync(3), t("quotes.guide.snoozed"))}>{t("quotes.guide.remindLater")}</Button>;
      break;
    case "bounced":
      body = (
        <div>
          <div className="note error mb-3"><span>{t("quotes.guide.bounced")}{q.delivery?.error ? ` — ${q.delivery.error}` : ""}</span></div>
          <Input label={t("quotes.guide.bouncedEmail")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      );
      primary = <Button variant="primary" busy={resend.isPending} onClick={() => run(resend.mutateAsync({ email: email.trim() || null }), t("quotes.guide.letterResent"))}>{t("quotes.guide.resendLetter")}</Button>;
      break;
    case "waiting":
      body = reminderOpen ? <textarea className="fld" rows={6} value={reminder} onChange={(e) => setReminder(e.target.value)} aria-label={t("quotes.guide.remind")} /> : null;
      primary = reminderOpen ? <Button variant="primary" busy={remind.isPending} onClick={doRemind}>{t("quotes.guide.remind")}</Button> : null;
      secondary = <>
        {reminderOpen ? <Button variant="text" size="sm" onClick={() => setReminderOpen(false)}>{t("common.cancel")}</Button> : <Button variant="text" size="sm" onClick={() => setReminderOpen(true)}>{t("quotes.guide.remindOpen")}</Button>}
        <Button variant="text" size="sm" onClick={onCancel}>{t("quotes.guide.cancel")}</Button>
      </>;
      break;
    case "convert":
      body = <ConvertForm q={q} mode={mode} setMode={setMode} handover={handover} setHandover={setHandover} />;
      primary = <Button variant="primary" busy={convert.isPending} disabled={!handover} onClick={doConvert}>{t("quotes.guide.convert")}</Button>;
      secondary = <Button variant="text" size="sm" onClick={onCancel}>{t("quotes.guide.cancel")}</Button>;
      break;
    default:
      if (q.status === "converted" && contractIds.length > 0) body = <ConvertedList ids={contractIds} />;
      break;
  }

  return (
    <Card>
      <CardBody className="grid gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Pill tone={whose.tone}>{whose.label}</Pill>
          {ns?.code === "waiting" && <span className="text-xs text-muted">{n >= 0 ? t("quotes.validDays", { n }) : t("quotes.expiredOn", { date: fmtDate(q.valid_until) })}</span>}
        </div>
        <div>
          <h3 className="text-base">{ns?.code === "convert" ? t("quotes.guide.accepted") : title}</h3>
          <p className="text-sm text-muted mt-1">{text}</p>
        </div>
        {body}
        {(primary || secondary) && <div className="flex items-center gap-2 flex-wrap">{primary}<span className="ml-auto flex gap-1">{secondary}</span></div>}
      </CardBody>
      <Modal open={sendOpen} onClose={() => setSendOpen(false)} title={t("quotes.guide.sendTitle")} sub={t("quotes.guide.sendSub", { email: q.contact.email || "—" })}
        footer={<><Button onClick={() => setSendOpen(false)}>{t("common.cancel")}</Button><Button variant="primary" busy={send.isPending} onClick={doSend}>{t("quotes.guide.send")}</Button></>}>
        <textarea className="fld" rows={5} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder={t("quotes.guide.sendMessage")} aria-label={t("quotes.guide.sendMessage")} />
      </Modal>
    </Card>
  );
}

/** Demo „lepingu kuju” (v649): by default one space = one lease; a shared lease is the exception and only for one building's spaces. */
function ConvertForm({ q, mode, setMode, handover, setHandover }: { q: QuoteDetail; mode: "separate" | "shared"; setMode: (m: "separate" | "shared") => void; handover: string; setHandover: (v: string) => void }) {
  const n = q.spaces.length;
  return (
    <div className="grid gap-3">
      <div>
        <div className="overline mb-1">{t("quotes.guide.shapeTitle", { n })}</div>
        <div className="flex gap-1 flex-wrap" role="group" aria-label={t("quotes.guide.shapeTitle", { n })}>
          <button type="button" className={cx("pill cursor-pointer", mode === "separate" && "primary")} aria-pressed={mode === "separate"} onClick={() => setMode("separate")}>{n > 1 ? t("quotes.guide.shapeSeparate", { n }) : t("quotes.guide.shapeOne")}</button>
          {n > 1 && <button type="button" className={cx("pill cursor-pointer", mode === "shared" && "primary")} aria-pressed={mode === "shared"} onClick={() => setMode("shared")}>{t("quotes.guide.shapeShared")}</button>}
        </div>
      </div>
      <Input label={t("quotes.guide.handover")} type="date" value={handover} onChange={(e) => setHandover(e.target.value)} className="!mb-0" />
    </div>
  );
}

function ConvertedList({ ids }: { ids: string[] }) {
  return <ul className="grid gap-1">{ids.map((id) => <li key={id}><LeaseLink id={id} /></li>)}</ul>;
}
function LeaseLink({ id }: { id: string }) {
  const l = useLease(id);
  return (
    <Link href={`/app/portfell/leping/${id}`} className="flex items-center gap-2 text-sm text-primary font-semibold">
      <span className="font-mono text-xs text-muted">{l.data?.number ?? t("quotes.guide.openLease")}</span>{l.data?.title ?? ""}{l.data && <Pill tone={statusTone(l.data.status)}>{tEnum("contract.status", l.data.status)}</Pill>}<IconArrowRight width={14} height={14} />
    </Link>
  );
}

// ---------------------------------------------------------------- Klient -----------------------------------------

const DELIVERY_TONE: Record<string, Tone> = { queued: "neutral", sent: "info", delivered: "success", bounced: "error", failed: "error" };

function ClientCard({ q, run }: { q: QuoteDetail; run: Run }) {
  const update = useUpdateQuote(q.id);
  const toast = useToast();
  const [c, setC] = useState(q.contact);
  useEffect(() => setC(q.contact), [q.contact]);
  const dirty = c.name !== q.contact.name || c.email !== q.contact.email || c.phone !== q.contact.phone;
  const editable = q.status === "draft";
  const last = q.letters[q.letters.length - 1];
  const copy = async () => { if (!q.link) return; try { await navigator.clipboard.writeText(q.link.url); toast.success(t("quotes.client.linkCopied")); } catch { toast.error(t("common.error")); } };
  return (
    <Card>
      <CardHeader title={t("quotes.client.title")} />
      <CardBody className="grid gap-3">
        <div className="text-sm">
          <Link href={`/app/portfell/osapool/${q.party.id}`} className="text-primary font-semibold">{q.party.name}</Link>
          {q.party.registry_code && <span className="text-muted"> · {q.party.registry_code}</span>}
        </div>
        {editable ? (
          <div>
            <Input label={t("quotes.client.contactName")} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />
            <div className="grid gap-x-3 sm:grid-cols-2">
              <Input label={t("quotes.client.email")} type="email" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />
              <Input label={t("quotes.client.phone")} value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />
            </div>
            {dirty && <div className="flex justify-end gap-2 -mt-2"><Button size="sm" onClick={() => setC(q.contact)}>{t("common.cancel")}</Button><Button size="sm" variant="primary" busy={update.isPending} onClick={() => run(update.mutateAsync({ contact: c, expected_version: q.version }), t("quotes.client.saved"))}>{t("common.save")}</Button></div>}
          </div>
        ) : (
          <dl className="kv text-sm">
            <dt>{t("quotes.client.contactName")}</dt><dd>{q.contact.name || "—"}</dd>
            <dt>{t("quotes.client.email")}</dt><dd>{q.contact.email ? <a className="text-primary" href={`mailto:${q.contact.email}`}>{q.contact.email}</a> : "—"}</dd>
            <dt>{t("quotes.client.phone")}</dt><dd>{q.contact.phone || "—"}</dd>
          </dl>
        )}
        {q.link && (
          <div className="rounded-control p-3 grid gap-2 text-sm" style={{ background: "var(--color-surface-subtle)" }}>
            <div className="flex items-center gap-2"><IconLink width={14} height={14} className="text-muted" /><span>{t("quotes.client.link", { date: fmtDate(q.link.expires_at) })}</span></div>
            <div className="text-xs text-muted">{q.link.opened_at ? t("quotes.client.opened", { at: fmtDateTime(q.link.opened_at) }) : t("quotes.client.notOpened")}</div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={copy}>{t("quotes.client.copyLink")}</Button>
              <a href={q.link.url} target="_blank" rel="noopener" className="btn btn-ghost btn-sm"><IconExternal width={14} height={14} />{t("quotes.client.viewAsClient")}</a>
            </div>
          </div>
        )}
        {last && (
          <div className="flex items-center gap-2 text-xs text-muted flex-wrap">
            <span>{t("quotes.client.lastLetter")}: {tEnum("quotes.letters.kinds", last.kind)} · {fmtDateTime(last.created_at)}</span>
            <Pill tone={DELIVERY_TONE[last.status] ?? "neutral"}>{tEnum("quotes.client.delivery", last.status)}</Pill>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------------------------------------------------------------- Läbirääkimised · Vestlus · Kirjad ----------------

function Thread({ items }: { items: QuoteMessage[] }) {
  return (
    <ol className="grid gap-2">
      {items.map((m) => {
        const mine = m.author_type === "operator";
        return (
          <li key={m.id} className={cx("flex", mine ? "justify-end" : "justify-start")}>
            <div className={cx("max-w-[88%] rounded-control px-3 py-2 text-sm", mine ? "bg-primary-subtle" : "bg-canvas")} style={{ background: mine ? "var(--color-primary-subtle)" : "var(--color-surface-subtle)" }}>
              <div className="text-xs text-muted flex items-center gap-2 flex-wrap mb-0.5"><span className="font-medium">{m.author_name ?? (mine ? t("quotes.negotiation.operator") : t("quotes.negotiation.client"))}</span><span>{fmtDateTime(m.created_at)}</span>{m.meta?.version != null && <span className="pill">{t("quotes.versions.v", { n: m.meta.version })}</span>}</div>
              <div className="whitespace-pre-wrap">{m.body}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function NegotiationCard({ q }: { q: QuoteDetail }) {
  const items = q.messages.filter((m) => m.channel === "negotiation");
  const collapsible = q.status !== "client_proposal" && items.length > 0;
  const [open, setOpen] = useState(!collapsible);
  if (items.length === 0 && q.status !== "client_proposal") return null;
  return (
    <Card>
      <CardHeader title={collapsible && !open ? t("quotes.negotiation.history", { n: items.length }) : t("quotes.negotiation.title")} actions={collapsible && <Button size="sm" variant="text" onClick={() => setOpen((o) => !o)}>{open ? t("common.showLess") : t("common.showMore")}</Button>} />
      {open && <CardBody>{items.length === 0 ? <p className="text-sm text-muted">{t("quotes.negotiation.none")}</p> : <Thread items={items} />}</CardBody>}
    </Card>
  );
}

function ChatCard({ q, run }: { q: QuoteDetail; run: Run }) {
  const post = usePostQuoteMessage(q.id);
  const [text, setText] = useState("");
  const items = q.messages.filter((m) => m.channel === "chat");
  const send = async () => { const r = await run(post.mutateAsync({ body: text.trim(), channel: "chat" })); if (r) setText(""); };
  return (
    <Card>
      <CardHeader title={t("quotes.chat.title")} />
      <CardBody className="grid gap-3">
        {items.length === 0 ? <p className="text-sm text-muted">{t("quotes.chat.none")}</p> : <Thread items={items} />}
        {OPEN.has(q.status) && (
          <div>
            <textarea className="fld" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={t("quotes.chat.placeholder")} aria-label={t("quotes.chat.title")} />
            <div className="flex justify-end mt-2"><Button size="sm" variant="primary" busy={post.isPending} disabled={!text.trim()} onClick={send}>{t("quotes.chat.send")}</Button></div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function LettersCard({ q }: { q: QuoteDetail }) {
  return (
    <Card>
      <CardHeader title={t("quotes.letters.title")} />
      <CardBody>
        {q.letters.length === 0 ? <p className="text-sm text-muted">{t("quotes.letters.none")}</p> : (
          <ul className="grid gap-2 text-sm">
            {[...q.letters].reverse().map((l) => (
              <li key={l.id} className="flex items-center gap-2 flex-wrap">
                <span className="min-w-0 flex-1"><span className="font-medium">{tEnum("quotes.letters.kinds", l.kind)}</span><span className="block text-xs text-muted truncate">{l.to ?? "—"} · {fmtDateTime(l.created_at)}</span></span>
                <Pill tone={DELIVERY_TONE[l.status] ?? "neutral"} title={l.error ?? undefined}>{tEnum("quotes.client.delivery", l.status)}</Pill>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
