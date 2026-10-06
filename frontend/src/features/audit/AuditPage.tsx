"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { useAuditLog, useAuditStats } from "@/lib/queries/portfolio";
import { useMe } from "@/lib/queries/auth";
import { useDebounced } from "@/lib/hooks";
import { Card, PageHead } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { EmptyState, ErrorState, Loading } from "@/components/ui/State";
import { IconArrowRight, IconFile, IconSpark, IconUsers, IconSettings } from "@/components/ui/Icons";
import { API_BASE, qs } from "@/lib/api";
import { cx, fmtDate, valueToString } from "@/lib/format";
import type { AuditEvent } from "@/types/api";

const ACTORS = ["human", "system", "agent"] as const;

/** „Olem ID: silt vana → uus” — the structured change, when the payload carries one. */
function changeText(e: AuditEvent): string | null {
  const p = e.payload ?? {};
  if (Array.isArray(p.before) || Array.isArray(p.after) || typeof p.before === "string" || typeof p.after === "string" || typeof p.before === "number" || typeof p.after === "number") {
    if (p.before !== undefined || p.after !== undefined) return `${valueToString(p.before ?? "—")} → ${valueToString(p.after ?? "—")}`;
  }
  const attrs = p.attributes as Record<string, [unknown, unknown]> | undefined;
  if (attrs && typeof attrs === "object") {
    return Object.entries(attrs).slice(0, 3).map(([k, v]) => `${k}: ${valueToString(v?.[0] ?? "—")} → ${valueToString(v?.[1] ?? "—")}`).join(" · ");
  }
  if (Array.isArray(p.name) && p.name.length === 2) return `${valueToString(p.name[0])} → ${valueToString(p.name[1])}`;
  return null;
}

function payloadHint(e: AuditEvent): string {
  const p = e.payload ?? {};
  const bits: string[] = [];
  for (const k of ["name", "filename", "number", "title", "contract_number", "asset_name", "created", "updated", "rejected", "kind", "status", "category", "role", "email"]) {
    if (p[k] !== undefined && p[k] !== null && typeof p[k] !== "object") bits.push(`${k}: ${valueToString(p[k])}`);
  }
  return bits.slice(0, 4).join(" · ");
}

export function AuditPage() {
  const me = useMe();
  const [actor, setActor] = useState<string>("");
  const [entity, setEntity] = useState<string>("");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(200);
  const dq = useDebounced(q, 300);
  const params = useMemo(() => ({ actor_type: actor || undefined, entity_type: entity || undefined, q: dq || undefined, limit }), [actor, entity, dq, limit]);
  const log = useAuditLog(params);
  const stats = useAuditStats();
  const rows = useMemo(() => log.data ?? [], [log.data]);
  const groups = useMemo(() => {
    const out: { day: string; rows: AuditEvent[] }[] = [];
    for (const e of rows) {
      const day = (e.ts ?? "").slice(0, 10);
      const g = out[out.length - 1];
      if (g && g.day === day) g.rows.push(e); else out.push({ day, rows: [e] });
    }
    return out;
  }, [rows]);
  const total = Object.values(stats.data?.actor_type ?? {}).reduce((a, b) => a + b, 0);
  const exportHref = (format: string) => `${API_BASE}/audit/export${qs({ format, actor_type: actor || undefined, entity_type: entity || undefined, q: dq || undefined })}`;
  const today = new Date().toISOString().slice(0, 10);
  const actorIcon = (k: string) => (k === "agent" ? <IconSpark width={14} height={14} /> : k === "system" ? <IconSettings width={14} height={14} /> : <IconUsers width={14} height={14} />);
  return (
    <div className="grid gap-5">
      <PageHead title={t("audit.title")} sub={<span>{me.data?.account.name ? <span className="overline block">{t("nav.company")} · {me.data.account.name}</span> : null}{t("audit.sub")}</span>}
        actions={<span className="flex gap-2 flex-wrap">{(["csv", "jsonl", "pdf"] as const).map((f) => <a key={f} className="btn btn-ghost btn-sm" href={exportHref(f)} target="_blank" rel="noopener"><IconFile width={14} height={14} />{f === "csv" ? t("audit.exportCsv") : f === "jsonl" ? t("audit.exportJsonl") : t("audit.exportPdf")}</a>)}</span>} />
      <div className="grid gap-3">
        <div className="tabbar" role="group" aria-label={t("audit.actorFilter")}>
          <button type="button" className={cx(!actor && "active")} onClick={() => setActor("")}>{t("audit.all")} <span className="ml-1 opacity-70 tabular-nums">{total}</span></button>
          {ACTORS.map((k) => <button key={k} type="button" className={cx(actor === k && "active")} onClick={() => setActor(actor === k ? "" : k)}>{tEnum("audit.actors", k)} <span className="ml-1 opacity-70 tabular-nums">{stats.data?.actor_type[k] ?? 0}</span></button>)}
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label={t("audit.entityFilter")}>
          {Object.entries(stats.data?.entity_type ?? {}).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
            <button key={k} type="button" className={cx("pill cursor-pointer", entity === k && "primary")} aria-pressed={entity === k} onClick={() => setEntity(entity === k ? "" : k)}>{tEnum("audit.entities", k)} · {n}</button>
          ))}
        </div>
        <Input className="!mb-0 max-w-[480px]" aria-label={t("audit.search")} placeholder={t("audit.search")} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <Card>
        {log.isLoading ? <div className="p-6"><Loading rows={6} /></div> : log.error ? <div className="p-6"><ErrorState error={log.error} onRetry={() => log.refetch()} /></div> : rows.length === 0 ? <EmptyState title={t("audit.empty")} /> : (
          <div className="px-[var(--card-padding)] pb-4">
            {groups.map((g) => (
              <section key={g.day} className="pt-4">
                <div className="overline mb-2">{g.day === today ? t("audit.today") : fmtDate(g.day)}</div>
                <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
                  {g.rows.map((e) => {
                    const change = changeText(e);
                    const inner = (
                      <>
                        <span className="font-mono text-xs text-muted w-12 flex-none pt-0.5">{(e.ts ?? "").slice(11, 16)}</span>
                        <span className={cx("w-6 h-6 rounded-full grid place-items-center flex-none", e.actor_type === "agent" ? "text-primary" : "text-muted")} style={{ background: "var(--color-surface-subtle)" }} title={tEnum("audit.actors", e.actor_type ?? "")}>{actorIcon(e.actor_type ?? "human")}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm"><b>{e.action}</b>{e.entity_label ? <span> · {e.entity_label}</span> : null}</span>
                          <span className="block text-xs text-muted truncate">{e.actor_name ?? tEnum("audit.actors", e.actor_type ?? "")}{e.on_behalf_of ? ` · ${t("audit.onBehalf")}` : ""} · {tEnum("audit.entities", e.entity_type ?? "")}{change ? <span className="font-mono"> · {change}</span> : payloadHint(e) ? ` · ${payloadHint(e)}` : ""}{e.reason ? ` · ${e.reason}` : ""}</span>
                        </span>
                        <span className="font-mono text-xs text-muted flex-none">E-{String(e.id).padStart(5, "0")}</span>
                        {e.entity_link && <IconArrowRight width={14} height={14} className="text-muted flex-none" />}
                      </>
                    );
                    return (
                      <li key={String(e.id)}>
                        {e.entity_link ? <Link href={e.entity_link} className="flex items-start gap-3 py-2 -mx-2 px-2 rounded-control hover:bg-canvas">{inner}</Link> : <div className="flex items-start gap-3 py-2 -mx-2 px-2">{inner}</div>}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
            {rows.length >= limit && <div className="pt-4"><Button variant="text" size="sm" onClick={() => setLimit((n) => Math.min(500, n + 200))} disabled={limit >= 500}>{t("audit.more")} →</Button></div>}
          </div>
        )}
      </Card>
    </div>
  );
}
