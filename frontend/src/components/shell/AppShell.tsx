"use client";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMe } from "@/lib/queries/auth";
import { isApiError } from "@/lib/api";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Spinner, ErrorState } from "@/components/ui/State";
import { t } from "@/i18n";
import { cx } from "@/lib/format";

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
    try { setCollapsed(localStorage.getItem("t1.sb") === "1"); } catch { /* ignore */ }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => { try { localStorage.setItem("t1.sb", c ? "0" : "1"); } catch { /* ignore */ } return !c; });
  };

  if (me.isLoading || (me.error && isApiError(me.error) && me.error.status === 401)) {
    return <div className="min-h-screen grid place-items-center"><Spinner /></div>;
  }
  if (me.error || !me.data) {
    return <div className="min-h-screen grid place-items-center p-6"><div className="max-w-md w-full"><ErrorState error={me.error} onRetry={() => me.refetch()} /></div></div>;
  }

  return (
    <div className={cx("min-h-screen md:grid", collapsed ? "md:grid-cols-[76px_minmax(0,1fr)]" : "md:grid-cols-[248px_minmax(0,1fr)]")}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] btn btn-primary">{t("common.skipToContent")}</a>
      {mobileOpen && <button type="button" className="fixed inset-0 z-[29] md:hidden" style={{ background: "var(--color-scrim)" }} aria-label={t("nav.closeMenu")} onClick={() => setMobileOpen(false)} />}
      <Sidebar me={me.data} mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <div className="min-w-0 flex flex-col min-h-screen">
        <Topbar me={me.data} onOpenMobile={() => setMobileOpen(true)} />
        <main id="main" tabIndex={-1} className="flex-1 min-w-0 outline-none" style={{ padding: "var(--page-gutter)" }}>
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
