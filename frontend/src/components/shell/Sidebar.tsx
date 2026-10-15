"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { Me } from "@/types/api";
import { t } from "@/i18n";
import { cx } from "@/lib/format";
import { useTheme } from "@/lib/theme";
import { IconAi, IconBuilding, IconCal, IconChat, IconClock, IconGrid, IconSettings, IconSpark, IconX, IconSidebar, IconMoon, IconSun, LogoFull, LogoMark } from "@/components/ui/Icons";
import { CompanySwitcher } from "./CompanySwitcher";
import { UserMenu } from "./UserMenu";

export const NAV = [
  { href: "/app", label: "nav.avaleht", q: "nav.avalehtQ", Icon: IconSpark, exact: true },
  { href: "/app/ylevaade", label: "nav.ylevaade", q: "nav.ylevaadeQ", Icon: IconGrid },
  { href: "/app/portfell", label: "nav.portfell", q: "nav.portfellQ", Icon: IconBuilding },
  { href: "/app/kalender", label: "nav.kalender", q: "nav.kalenderQ", Icon: IconCal },
  { href: "/app/suhtlus", label: "nav.suhtlus", q: "nav.suhtlusQ", Icon: IconChat },
  { href: "/app/ai", label: "nav.ai", q: "nav.aiQ", Icon: IconAi },
] as const;

/** Portfolio sub-links (demo v474): every tab one click away; the active place is the sub-link, the parent carries no fill. */
const PORTFELL_SUB = [
  { key: "lepingud", label: "portfolio.tabs.contracts" },
  { key: "pakkumised", label: "portfolio.tabs.quotes" },
  { key: "esemed", label: "portfolio.tabs.assets" },
  { key: "osapooled", label: "portfolio.tabs.parties" },
] as const;

export function Sidebar({ me, onCloseMobile, collapsed, onToggleCollapsed }: { me: Me; onCloseMobile: () => void; collapsed: boolean; onToggleCollapsed: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [theme, toggleTheme] = useTheme();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const portfellOn = pathname === "/app/portfell";
  const sub = portfellOn ? (params.get("tab") ?? "lepingud") : null;
  return (
    <aside id="sidebar" className="sidebar" aria-label={t("nav.mainNav")}>
      <div className="sb-top">
        <button type="button" className="mobile-nav-close" onClick={onCloseMobile} aria-label={t("nav.closeMenu")}><IconX /></button>
        <Link href="/app" aria-label={t("app.name")} className="flex items-center min-w-0">
          <LogoMark className="logo-mark" />
          <LogoFull className="logo" />
        </Link>
        <button type="button" className="sb-collapse" onClick={onToggleCollapsed} aria-label={collapsed ? t("nav.expand") : t("nav.collapse")} title={collapsed ? t("nav.expand") : t("nav.collapse")}>
          <IconSidebar />
        </button>
      </div>

      <nav className="nav" aria-label={t("nav.mainNav")}>
        {NAV.map(({ href, label, q, Icon, ...rest }) => {
          const active = isActive(href, "exact" in rest ? rest.exact : false);
          const hasSub = href === "/app/portfell";
          return (
            <div key={href} className="contents">
              <Link href={href} aria-current={active && !hasSub ? "page" : undefined} title={t(q)} className={cx(active && "active")}>
                <Icon className="ic" />
                <span>{t(label)}</span>
              </Link>
              {hasSub && portfellOn && (
                <div className="nav-sub">
                  {PORTFELL_SUB.map((s) => (
                    <Link key={s.key} href={`/app/portfell?tab=${s.key}`} className={cx(sub === s.key && "on")} aria-current={sub === s.key ? "page" : undefined}>
                      <span>{t(s.label)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <CompanySwitcher me={me} />

      <div className="sb-foot">
        <button type="button" className="sb-item sb-theme" onClick={toggleTheme}>
          {theme === "dark" ? <IconSun className="ic" /> : <IconMoon className="ic" />}
          <span>{t("nav.theme")}</span>
        </button>
        <Link href="/app/audit" className={cx("sb-item", isActive("/app/audit") && "active")} aria-current={isActive("/app/audit") ? "page" : undefined} title={t("nav.audit")}>
          <IconClock className="ic" />
          <span>{t("nav.audit")}</span>
        </Link>
        <Link href="/app/seaded" className={cx("sb-item", isActive("/app/seaded") && "active")} aria-current={isActive("/app/seaded") ? "page" : undefined} title={t("nav.seaded")}>
          <IconSettings className="ic" />
          <span>{t("nav.seaded")}</span>
        </Link>
        <UserMenu me={me} />
      </div>
    </aside>
  );
}
