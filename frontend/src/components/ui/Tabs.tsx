"use client";
import Link from "next/link";
import { cx } from "@/lib/format";

export interface Tab { key: string; label: string; href?: string; count?: number }

export function Tabs({ tabs, active, onChange, ariaLabel }: { tabs: Tab[]; active: string; onChange?: (k: string) => void; ariaLabel?: string }) {
  return (
    <nav className="tabbar" aria-label={ariaLabel} role="tablist">
      {tabs.map((tab) =>
        tab.href ? (
          <Link key={tab.key} href={tab.href} className={cx(tab.key === active && "active")} role="tab" aria-selected={tab.key === active}>
            {tab.label}{tab.count !== undefined && <span className="ml-2 opacity-70 tabular-nums">{tab.count}</span>}
          </Link>
        ) : (
          <button key={tab.key} type="button" className={cx(tab.key === active && "active")} role="tab" aria-selected={tab.key === active} onClick={() => onChange?.(tab.key)}>
            {tab.label}{tab.count !== undefined && <span className="ml-2 opacity-70 tabular-nums">{tab.count}</span>}
          </button>
        ),
      )}
    </nav>
  );
}
