"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Me } from "@/types/api";
import { t } from "@/i18n";
import { cx, initials } from "@/lib/format";
import { IconBuilding, IconCal, IconChat, IconGrid, IconSettings, IconSpark, IconX, IconChevronLeft, IconChevronRight, LogoMark } from "@/components/ui/Icons";
import { CompanySwitcher } from "./CompanySwitcher";
import { UserMenu } from "./UserMenu";

const NAV = [
  { href: "/app", label: "nav.avaleht", q: "nav.avalehtQ", Icon: IconSpark, exact: true },
  { href: "/app/ylevaade", label: "nav.ylevaade", q: "nav.ylevaadeQ", Icon: IconGrid },
  { href: "/app/portfell", label: "nav.portfell", q: "nav.portfellQ", Icon: IconBuilding },
  { href: "/app/kalender", label: "nav.kalender", q: "nav.kalenderQ", Icon: IconCal },
  { href: "/app/suhtlus", label: "nav.suhtlus", q: "nav.suhtlusQ", Icon: IconChat },
] as const;

export function Sidebar({ me, mobileOpen, onCloseMobile, collapsed, onToggleCollapsed }: { me: Me; mobileOpen: boolean; onCloseMobile: () => void; collapsed: boolean; onToggleCollapsed: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  return (
    <aside
      id="sidebar"
      aria-label={t("nav.mainNav")}
      className={cx(
        "fixed md:sticky top-0 z-[30] h-screen w-[248px] md:w-auto flex flex-col px-4 pb-5 transition-transform duration-200",
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      )}
      style={{ background: "var(--color-sidebar)" }}
    >
      <div className="flex items-center gap-3 h-16 -mx-4 px-5 border-b flex-none" style={{ borderColor: "var(--color-divider)" }}>
        <Link href="/app" className="flex items-center gap-2 min-w-0" aria-label={t("app.name")}>
          <LogoMark width={28} height={28} className="text-ink flex-none" />
          {!collapsed && <span className="font-heading font-bold text-lg tracking-tight truncate">{t("app.name")}</span>}
        </Link>
        <button type="button" className="icon-btn ml-auto hidden md:grid" onClick={onToggleCollapsed} aria-label={collapsed ? t("nav.expand") : t("nav.collapse")} title={collapsed ? t("nav.expand") : t("nav.collapse")}>
          {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
        </button>
        <button type="button" className="icon-btn ml-auto md:hidden" onClick={onCloseMobile} aria-label={t("nav.closeMenu")}><IconX /></button>
      </div>

      <nav className="flex flex-col gap-1 mt-5" aria-label={t("nav.mainNav")}>
        {NAV.map(({ href, label, q, Icon, ...rest }) => {
          const active = isActive(href, "exact" in rest ? rest.exact : false);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              title={collapsed ? t(label) : undefined}
              className={cx(
                "flex items-center gap-3 min-h-[44px] rounded-control text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0 w-11 mx-auto" : "px-3 py-2",
                active ? "bg-surface text-primary font-semibold shadow-surface" : "text-ink hover:bg-[rgb(20_26_38/0.05)]",
              )}
            >
              <Icon className={cx("flex-none", active ? "text-primary" : "text-muted")} />
              {!collapsed && (
                <span className="flex flex-col leading-tight min-w-0">
                  <span>{t(label)}</span>
                  <small className={cx("text-xs font-normal truncate", active ? "text-primary/80" : "text-muted")}>{t(q)}</small>
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && <CompanySwitcher me={me} />}

      <div className={cx("border-t pt-4", collapsed ? "mt-auto" : "mt-3")} style={{ borderColor: "var(--color-divider)" }}>
        <Link href="/app/seaded" title={collapsed ? t("nav.seaded") : undefined} aria-current={isActive("/app/seaded") ? "page" : undefined}
          className={cx("flex items-center gap-3 min-h-[44px] rounded-control text-sm font-medium", collapsed ? "justify-center w-11 mx-auto" : "px-3 py-2", isActive("/app/seaded") ? "bg-surface text-primary font-semibold shadow-surface" : "text-ink hover:bg-[rgb(20_26_38/0.05)]")}>
          <IconSettings className={isActive("/app/seaded") ? "text-primary" : "text-muted"} />
          {!collapsed && <span>{t("nav.seaded")}</span>}
        </Link>
        <UserMenu me={me} compact={collapsed} />
      </div>
      {collapsed && <span className="sr-only">{initials(me.name)}</span>}
    </aside>
  );
}
