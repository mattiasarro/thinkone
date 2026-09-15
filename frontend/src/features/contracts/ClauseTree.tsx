"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { cx } from "@/lib/format";
import { IconChevron, IconLock } from "@/components/ui/Icons";
import type { Clause } from "@/types/api";

interface Node { clause: Clause; children: Node[] }

function buildTree(clauses: Clause[]): Node[] {
  const roots: Node[] = [];
  const stack: Node[] = [];
  for (const c of clauses) {
    const node: Node = { clause: c, children: [] };
    while (stack.length && stack[stack.length - 1].clause.level >= c.level) stack.pop();
    if (stack.length) stack[stack.length - 1].children.push(node);
    else roots.push(node);
    stack.push(node);
  }
  return roots;
}

export function ClauseTree({ clauses, imported }: { clauses: Clause[]; imported?: boolean }) {
  const tree = buildTree(clauses);
  return <div>{tree.map((n) => <ClauseNode key={n.clause.id} node={n} imported={imported} depth={0} />)}</div>;
}

function ClauseNode({ node, imported, depth }: { node: Node; imported?: boolean; depth: number }) {
  const [open, setOpen] = useState(depth < 1);
  const c = node.clause;
  const number = imported && c.source_number ? c.source_number : c.number;
  const hasChildren = node.children.length > 0;
  return (
    <div className={cx("clause", c.locked && "locked")} style={{ paddingLeft: depth * 16 }}>
      <div className="flex items-start gap-2">
        {hasChildren ? (
          <button type="button" className="icon-btn !w-7 !h-7 flex-none -ml-1" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={open ? t("common.showLess") : t("common.showMore")}>
            <IconChevron width={14} height={14} className={cx("transition-transform", !open && "-rotate-90")} />
          </button>
        ) : <span className="w-6 flex-none" />}
        <span className="no pt-1">{number}</span>
        <div className="min-w-0 flex-1">
          {c.heading && <div className="font-semibold text-sm pt-1 flex items-center gap-2">{c.heading}{c.locked && <IconLock width={12} height={12} className="text-muted" aria-label={t("contract.locked")} />}</div>}
          {(!hasChildren || open || !c.heading) && c.text && <p className={cx("text-sm whitespace-pre-wrap", c.heading ? "text-muted mt-1" : "pt-1")}>{c.text}</p>}
        </div>
      </div>
      {open && hasChildren && <div className="mt-1">{node.children.map((ch) => <ClauseNode key={ch.clause.id} node={ch} imported={imported} depth={depth + 1} />)}</div>}
    </div>
  );
}
