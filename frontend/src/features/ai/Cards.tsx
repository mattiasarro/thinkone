"use client";
import { useState } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { errorMessage } from "@/lib/api";
import { cx, valueToString } from "@/lib/format";
import { useAiFeedback, useConfirmAiCard } from "@/lib/queries/ai";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { IconArrowRight, IconCheck, IconCopy, IconInfo } from "@/components/ui/Icons";
import type { AiCard, ClarifyCard, ConfirmCard, DraftCard, LinksCard, TableCard } from "@/types/ai";

export interface CardCtx { threadId: string; messageId: string; live: boolean; onEdit: (prefill: string) => void }

export function CardView({ card, ctx }: { card: AiCard; ctx: CardCtx }) {
  switch (card.type) {
    case "links": return <LinksView card={card} />;
    case "table": return <TableView card={card} />;
    case "confirm": return <ConfirmView card={card} ctx={ctx} />;
    case "draft": return <DraftView card={card} ctx={ctx} />;
    case "clarify": return <ClarifyView card={card} />;
    default: return null;
  }
}

function Shell({ title, children, className }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx("rounded-control border overflow-hidden bg-surface rise", className)} style={{ borderColor: "var(--line)" }}>
      {title && <header className="px-3.5 py-2 text-xs font-semibold text-muted border-b" style={{ borderColor: "var(--line)" }}>{title}</header>}
      {children}
    </section>
  );
}

function href(link: string | null | undefined): string | null {
  if (!link) return null;
  return link.startsWith("/") ? link : `/${link}`;
}

function LinksView({ card }: { card: LinksCard }) {
  return (
    <Shell title={card.title}>
      {card.items.length === 0 ? <div className="px-3.5 py-3 text-sm text-muted">{t("ai.card.linksEmpty")}</div> : (
        <ul className="m-0 p-0 list-none">
          {card.items.map((it, i) => {
            const h = href(it.link);
            const body = (
              <>
                <span className="pill flex-none">{tEnum("search.entity", it.entity_type)}</span>
                <span className="min-w-0 flex-1 grid"><span className="truncate font-medium">{it.title}</span>{it.subtitle && <span className="truncate text-xs text-muted">{it.subtitle}</span>}</span>
                {h && <IconArrowRight width={14} height={14} className="text-muted flex-none" />}
              </>
            );
            const cls = "flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] border-t first:border-t-0";
            return (
              <li key={`${it.entity_type}-${it.link ?? i}`} style={{ borderColor: "var(--line)" }} className="border-t first:border-t-0">
                {h ? <Link href={h} className={cx(cls, "hover:bg-canvas transition-colors")} style={{ borderColor: "var(--line)" }}>{body}</Link>
                  : <div className={cls} style={{ borderColor: "var(--line)" }}>{body}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </Shell>
  );
}

function TableView({ card }: { card: TableCard }) {
  const cols = card.columns.length ? card.columns : Object.keys(card.rows[0] ?? {}).filter((k) => k !== "link");
  return (
    <Shell title={card.title}>
      <div className="tbl-wrap">
        <table className="tbl text-[13px]">
          <thead><tr>{cols.map((c) => <th key={c} className="!px-3.5 !py-1.5">{c}</th>)}</tr></thead>
          <tbody>
            {card.rows.map((r, i) => {
              const h = href(typeof r.link === "string" ? r.link : null);
              return (
                <tr key={i} className={cx(h && "clickable")}>
                  {cols.map((c, j) => (
                    <td key={c} className={cx("!px-3.5 !py-2", typeof r[c] === "number" && "num")}>
                      {h && j === 0 ? <Link href={h} className="font-medium text-ink hover:text-primary">{valueToString(r[c])}</Link> : valueToString(r[c])}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function ConfirmView({ card, ctx }: { card: ConfirmCard; ctx: CardCtx }) {
  const confirm = useConfirmAiCard();
  const feedback = useAiFeedback();
  const toast = useToast();
  const [result, setResult] = useState<{ link: string; title: string } | null>(card.confirmed_at ? { link: card.result_link ?? "", title: card.title } : null);
  const [discarded, setDiscarded] = useState(false);
  const onConfirm = async () => {
    try {
      const r = await confirm.mutateAsync({ thread_id: ctx.threadId, message_id: ctx.messageId, card_id: card.id });
      setResult({ link: r.link, title: r.title });
      toast.success(t("ai.card.confirmedToast", { title: r.title }));
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const onDiscard = () => {
    setDiscarded(true);
    feedback.mutate({ message_id: ctx.live ? null : ctx.messageId, card_id: card.id, kind: card.action, fate: "discarded", draft_text: card.text ?? null });
  };
  const onEdit = () => ctx.onEdit(t("ai.card.editPrefill", { title: `${card.title}${card.text ? ` (${card.text})` : ""}` }));
  const link = result?.link ? href(result.link) : null;
  return (
    <Shell className={cx(discarded && "opacity-60")}>
      <div className="px-4 py-3.5 grid gap-1">
        <div className="font-semibold">{card.title}</div>
        {card.text && <div className="text-sm text-muted">{card.text}</div>}
      </div>
      <footer className="px-4 py-3 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: "var(--line)" }}>
        {result ? (
          <>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success"><IconCheck width={16} height={16} />{t("ai.card.confirmed")}</span>
            {link && <Link href={link} className="btn btn-ghost btn-sm">{t("ai.card.open")}</Link>}
          </>
        ) : discarded ? (
          <span className="text-sm text-muted">{t("ai.card.discarded")}</span>
        ) : (
          <>
            <Button variant="primary" size="sm" busy={confirm.isPending} disabled={ctx.live} onClick={onConfirm}>{t("ai.card.confirm")}</Button>
            <Button size="sm" onClick={onEdit}>{t("ai.card.edit")}</Button>
            <Button variant="text" size="sm" onClick={onDiscard}>{t("ai.card.discard")}</Button>
          </>
        )}
      </footer>
    </Shell>
  );
}

function DraftView({ card, ctx }: { card: DraftCard; ctx: CardCtx }) {
  const feedback = useAiFeedback();
  const toast = useToast();
  const [fate, setFate] = useState<"used" | "discarded" | null>(null);
  const [copied, setCopied] = useState(false);
  const text = card.text ?? "";
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { toast.error(t("common.error")); }
  };
  const decide = (f: "used" | "discarded") => {
    setFate(f);
    feedback.mutate({ message_id: ctx.live ? null : ctx.messageId, card_id: card.id, kind: card.kind, fate: f, draft_text: text, final_text: f === "used" ? text : null });
  };
  const sub = [card.document.overrides_label && t("ai.card.overrides", { label: card.document.overrides_label })].filter(Boolean).join(" · ");
  return (
    <Shell title={sub ? `${card.title} · ${sub}` : card.title} className={cx(fate === "discarded" && "opacity-60")}>
      <div className="px-4 py-3.5">
        {text ? <blockquote className="m-0 px-3.5 py-3 rounded-sm border text-sm leading-relaxed whitespace-pre-wrap" style={{ borderColor: "var(--color-divider)", background: "var(--color-canvas)" }}>{text}</blockquote>
          : <div className="text-sm text-muted">{t("ai.card.noText")}</div>}
      </div>
      <footer className="px-4 py-3 border-t flex items-center gap-2 flex-wrap" style={{ borderColor: "var(--line)" }}>
        <Button size="sm" onClick={copy} disabled={!text}><IconCopy width={14} height={14} />{copied ? t("ai.card.copied") : t("ai.card.copy")}</Button>
        {fate === "used" ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success"><IconCheck width={16} height={16} />{t("ai.card.used")}</span>
          : fate === "discarded" ? <span className="text-sm text-muted">{t("ai.card.discarded")}</span>
          : (
            <>
              <Button variant="primary" size="sm" disabled={!text} onClick={() => decide("used")}>{t("ai.card.use")}</Button>
              <Button variant="text" size="sm" onClick={() => decide("discarded")}>{t("ai.card.discard")}</Button>
            </>
          )}
      </footer>
    </Shell>
  );
}

function ClarifyView({ card }: { card: ClarifyCard }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted" role="note">
      <IconInfo width={16} height={16} className="flex-none" /><span>{card.title ? `${card.title} · ` : ""}{t("ai.card.clarify")}</span>
    </div>
  );
}
