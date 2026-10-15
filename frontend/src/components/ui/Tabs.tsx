"use client";
import Link from "next/link";
import { cx } from "@/lib/format";

export interface Tab { key: string; label: string; href?: string; count?: number }

/**
 * Two shapes from the demo: `seg` (default) = the segmented switch (`pf-views`: quiet 13/500, active = soft fill);
 * `line` = page tabs (`pf-tabs`: underlined 14/600, ink underline on the active one).
 */
export function Tabs({ tabs, active, onChange, ariaLabel, variant = "seg", actions }: { tabs: Tab[]; active: string; onChange?: (k: string) => void; ariaLabel?: string; variant?: "seg" | "line"; actions?: React.ReactNode }) {
  const count = (tab: Tab) => tab.count !== undefined && <span className="opacity-70 tabular-nums font-mono text-[11px]">{tab.count}</span>;
  return (
    <nav className={cx("tabbar", variant === "line" && "line")} aria-label={ariaLabel} role="tablist">
      {tabs.map((tab) =>
        tab.href ? (
          <Link key={tab.key} href={tab.href} className={cx(tab.key === active && "active")} role="tab" aria-selected={tab.key === active}>
            {tab.label}{count(tab)}
          </Link>
        ) : (
          <button key={tab.key} type="button" className={cx(tab.key === active && "active")} role="tab" aria-selected={tab.key === active} onClick={() => onChange?.(tab.key)}>
            {tab.label}{count(tab)}
          </button>
        ),
      )}
      {actions && <span className="ml-auto flex items-center gap-2">{actions}</span>}
    </nav>
  );
}
