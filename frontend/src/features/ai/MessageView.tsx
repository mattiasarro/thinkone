"use client";
import { Fragment, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { cx } from "@/lib/format";
import { IconAi, IconAlert, IconCheck } from "@/components/ui/Icons";
import type { AiCitation, AiMessage, AiStep } from "@/types/ai";
import { CardView, type CardCtx } from "./Cards";

const DRAFT_TOOLS = new Set(["create_quote_draft", "create_lease_draft", "draft_special_term", "draft_commercial_text", "create_party_from_registry"]);
const CITE_RE = /\[§([^\]|]+)\|([0-9a-fA-F-]{6,})\]/g;

export function MessageView({ m, threadId, contextContractId, live, onEdit }: { m: AiMessage; threadId: string; contextContractId: string | null; live: boolean; onEdit: (prefill: string) => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-2.5 rounded-[16px_16px_4px_16px] text-[14.5px] leading-relaxed whitespace-pre-wrap bg-subtle" aria-label={t("ai.you")}>{m.text}</div>
      </div>
    );
  }
  const ctx: CardCtx = { threadId, messageId: m.id, live, onEdit };
  const streaming = m.status === "streaming";
  return (
    <div className="flex gap-3 items-start">
      <span aria-hidden="true" className={cx("w-8 h-8 rounded-[10px] grid place-items-center flex-none text-white", streaming && "animate-pulse")} style={{ background: "var(--color-text)" }}><IconAi width={16} height={16} /></span>
      <div className="min-w-0 flex-1 grid gap-3">
        {m.steps.length > 0 && <Steps steps={m.steps} open={streaming} />}
        {m.text ? <AnswerText text={m.text} citations={m.citations} fallbackContractId={contextContractId} /> : streaming ? <div className="text-sm text-muted">{t("ai.thinking")}</div> : null}
        {m.cards.map((c, i) => <CardView key={"id" in c && c.id ? c.id : `${c.type}-${i}`} card={c} ctx={ctx} />)}
        {m.status === "budget" && <div className="note warning text-sm"><IconAlert width={16} height={16} className="flex-none mt-0.5" /><span>{t("ai.budgetNote")}</span></div>}
        {m.status === "failed" && <div className="note error text-sm"><IconAlert width={16} height={16} className="flex-none mt-0.5" /><span>{m.error || t("ai.failedNote")}</span></div>}
      </div>
    </div>
  );
}

function Steps({ steps, open }: { steps: AiStep[]; open: boolean }) {
  return (
    <details open={open} className="rounded-control border text-xs" style={{ borderColor: "var(--line)" }}>
      <summary className="px-3 py-2 text-muted cursor-pointer select-none list-none flex items-center gap-2">
        <span className="font-semibold">{t("ai.workLog")}</span><span>· {steps.length}</span>
      </summary>
      <ol className="m-0 px-3 pb-2 list-none grid gap-1">
        {steps.map((s, i) => {
          const draft = DRAFT_TOOLS.has(s.tool);
          const failed = !s.ok;
          return (
            <li key={i} className={cx("flex items-center gap-2 min-h-[22px]", failed ? "text-error opacity-80" : "text-ink")}>
              <span className={cx("w-4 h-4 grid place-items-center flex-none rounded-full", failed ? "bg-error-subtle" : "bg-success-subtle text-success")}>
                {failed ? <IconAlert width={11} height={11} /> : <IconCheck width={11} height={11} />}
              </span>
              <span className="font-medium">{tEnum("ai.tools", s.tool)}</span>
              {s.summary && s.summary !== s.tool && <span className="text-muted truncate">· {s.summary}</span>}
              <span className="ml-auto flex-none text-muted">{failed ? t("ai.stepFailed") : draft ? t("ai.stepPrepare") : t("ai.stepRead")}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/** Paragraphs, simple bullet lists, **bold** and citation chips `[§3.1|<clause id>]` → /app/portfell/leping/{contract}?clause={id}. */
export function AnswerText({ text, citations, fallbackContractId }: { text: string; citations: AiCitation[]; fallbackContractId: string | null }) {
  const byClause = useMemo(() => new Map(citations.map((c) => [c.clause_id, c])), [citations]);
  const blocks = useMemo(() => text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean), [text]);
  const inline = (s: string, key: string): ReactNode[] => {
    const out: ReactNode[] = [];
    let last = 0, n = 0;
    for (const m of s.matchAll(CITE_RE)) {
      const idx = m.index ?? 0;
      if (idx > last) out.push(<Fragment key={`${key}-t${n++}`}>{bold(s.slice(last, idx), `${key}-b${n}`)}</Fragment>);
      const number = m[1].trim(), clauseId = m[2];
      const cit = byClause.get(clauseId) ?? [...byClause.values()].find((c) => c.clause_id.startsWith(clauseId));
      const contractId = cit?.contract_id ?? fallbackContractId;
      const chip = (
        <span className="inline-flex items-center h-[22px] px-2 rounded-sm border font-mono text-[11px] font-semibold align-[1px] whitespace-nowrap transition-colors hover:bg-ink hover:text-white"
          style={{ borderColor: "var(--color-divider)", background: "var(--color-surface-subtle)" }}>§{number}</span>
      );
      out.push(contractId
        ? <Link key={`${key}-c${n++}`} href={`/app/portfell/leping/${contractId}?clause=${cit?.clause_id ?? clauseId}`} title={t("ai.openClause", { n: number })} className="mx-0.5">{chip}</Link>
        : <Fragment key={`${key}-c${n++}`}>{chip}</Fragment>);
      last = idx + m[0].length;
    }
    if (last < s.length) out.push(<Fragment key={`${key}-t${n++}`}>{bold(s.slice(last), `${key}-b${n}`)}</Fragment>);
    return out;
  };
  return (
    <div className="grid gap-3 text-[15px] leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.length >= 2 && lines.every((l) => /^\s*\|.*\|\s*$/.test(l))) {
          const cells = (l: string) => l.trim().slice(1, -1).split("|").map((c) => c.trim());
          const head = cells(lines[0]);
          const body = lines.slice(1).filter((l) => !/^\s*\|(\s*:?-+:?\s*\|)+\s*$/.test(l)).map(cells);
          return (
            <div key={i} className="tbl-wrap rounded-control border" style={{ borderColor: "var(--line)" }}>
              <table className="tbl text-[13px]">
                <thead><tr>{head.map((h, j) => <th key={j} className="!px-3.5 !py-1.5">{inline(h, `${i}-h${j}`)}</th>)}</tr></thead>
                <tbody>{body.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} className={cx("!px-3.5 !py-2", /^[\d\s.,]+(\s*(m²|€|%))?$/.test(c) && "num")}>{inline(c, `${i}-${j}-${k}`)}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={i} className="m-0 pl-5 grid gap-1">
              {lines.map((l, j) => <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), `${i}-${j}`)}</li>)}
            </ul>
          );
        }
        return (
          <p key={i} className="m-0" style={{ textWrap: "pretty" }}>
            {lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l, `${i}-${j}`)}</Fragment>)}
          </p>
        );
      })}
    </div>
  );
}

function bold(s: string, key: string): ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return s;
  return parts.map((p, i) => (p.startsWith("**") && p.endsWith("**") ? <b key={`${key}-${i}`}>{p.slice(2, -2)}</b> : <Fragment key={`${key}-${i}`}>{p}</Fragment>));
}
