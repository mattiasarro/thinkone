"use client";
import type { Me } from "@/types/api";
import { t } from "@/i18n";
import { IconMenu, IconMoon, IconPlus, IconSun } from "@/components/ui/Icons";
import { SearchBox } from "./SearchBox";
import { NotificationsBell } from "./NotificationsBell";
import { Popover } from "@/components/ui/Popover";
import { useTheme } from "@/lib/theme";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "./Sidebar";
import { cx } from "@/lib/format";

/** Topbar beside the sidebar (demo): crumb left, omnibox + „+ Uus” centred, theme switch and notifications right. */
export function Topbar({ me, onOpenMobile }: { me: Me; onOpenMobile: () => void }) {
  const [newOpen, setNewOpen] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const pathname = usePathname();
  const section = NAV.find((n) => ("exact" in n && n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(n.href + "/")))
    ?? (pathname.startsWith("/app/alusta") ? { label: "nav.alusta" as const } : pathname.startsWith("/app/seaded") ? { label: "nav.seaded" as const } : pathname.startsWith("/app/audit") ? { label: "nav.audit" as const } : null);
  return (
    <header className="topbar">
      <div className="top-left">
        <button type="button" className="mobile-nav-toggle" onClick={onOpenMobile} aria-label={t("nav.openMenu")} aria-controls="sidebar"><IconMenu /></button>
        <div className="crumb">{t("app.name")}{section && <><b>/</b>{t(section.label)}</>}</div>
      </div>
      <div className="omni-center">
        {/* on the home page the big composer carries the input role (demo `.dash-shell .omni-wrap { display: none }`) */}
        {pathname !== "/app" && <SearchBox />}
        <Popover open={newOpen} onClose={() => setNewOpen(false)} className="loo-pop" trigger={
          <button type="button" className={cx("btn btn-primary btn-sm btn-loo", newOpen && "open")} onClick={() => setNewOpen((o) => !o)} aria-haspopup="menu" aria-expanded={newOpen} title={t("nav.newButton")}>
            <IconPlus /><span>{t("nav.newButton")}</span>
          </button>
        }>
          <div role="menu">
            <Link role="menuitem" className="drop-item" href="/app/portfell/pakkumine/uus" onClick={() => setNewOpen(false)}>{t("nav.newQuote")}</Link>
            <Link role="menuitem" className="drop-item" href="/app/portfell/leping/uus" onClick={() => setNewOpen(false)}>{t("nav.newLease")}</Link>
            <Link role="menuitem" className="drop-item" href="/app/portfell/objekt/uus" onClick={() => setNewOpen(false)}>{t("home.addAsset")}</Link>
            <Link role="menuitem" className="drop-item" href="/app/portfell/import" onClick={() => setNewOpen(false)}>{t("home.importContract")}</Link>
            <Link role="menuitem" className="drop-item" href="/app/portfell?tab=osapooled&new=1" onClick={() => setNewOpen(false)}>{t("home.addParty")}</Link>
          </div>
        </Popover>
      </div>
      <div className="top-actions">
        <button type="button" className="icon-btn theme-btn" onClick={toggleTheme} title={t("nav.theme")} aria-label={t("nav.theme")}>
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        <NotificationsBell />
        <span className="sr-only">{me.name}</span>
      </div>
    </header>
  );
}
