"use client";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/lib/queries/auth";
import { isApiError } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Spinner, ErrorState } from "@/components/ui/State";
import { t } from "@/i18n";
import { cx } from "@/lib/format";
import { SetupBar } from "@/features/setup/SetupBar";

/** Demo shell (index.html): sidebar in the left column across both rows, topbar beside it, the page column below the topbar. */
export function AppShell({ children }: { children: ReactNode }) {
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (me.error && isApiError(me.error) && me.error.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [me.error, router, pathname]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem("thinkone_sbmin") === "1"); } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    document.body.classList.toggle("nav-open", mobileOpen);
    return () => document.body.classList.remove("nav-open");
  }, [mobileOpen]);
  const toggleCollapsed = () => {
    setCollapsed((c) => { try { localStorage.setItem("thinkone_sbmin", c ? "0" : "1"); } catch { /* ignore */ } return !c; });
  };

  if (me.isLoading || (me.error && isApiError(me.error) && me.error.status === 401)) {
    return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  }
  if (me.error || !me.data) {
    return <div className="min-h-screen grid place-items-center p-6"><div className="max-w-md w-full"><ErrorState error={me.error} onRetry={() => me.refetch()} /></div></div>;
  }

  return (
    <div className={cx("app", collapsed && "sb-min", mobileOpen && "nav-open")}>
      <a href="#main" className="skip-link">{t("common.skipToContent")}</a>
      {mobileOpen && <button type="button" className="nav-backdrop" tabIndex={-1} aria-label={t("nav.closeMenu")} onClick={() => setMobileOpen(false)} />}
      <Topbar me={me.data} onOpenMobile={() => setMobileOpen(true)} />
      <Suspense fallback={<aside className="sidebar" aria-hidden />}>
        <Sidebar me={me.data} onCloseMobile={() => setMobileOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </Suspense>
      <div className="main">
        <main id="main" tabIndex={-1} className="view outline-none"><SetupBar />{children}</main>
      </div>
    </div>
  );
}
