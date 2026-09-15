"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Me } from "@/types/api";
import { t } from "@/i18n";
import { cx, initials } from "@/lib/format";
import { useLogout } from "@/lib/queries/auth";
import { Popover } from "@/components/ui/Popover";
import { IconLogout, IconSettings } from "@/components/ui/Icons";

export function UserMenu({ me, compact }: { me: Me; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const logout = useLogout();
  const router = useRouter();
  const doLogout = async () => {
    setOpen(false);
    try { await logout.mutateAsync(); } finally { router.replace("/login"); }
  };
  return (
    <Popover open={open} onClose={() => setOpen(false)} align="left" className="bottom-full top-auto mb-2 min-w-[220px]" trigger={
      <button type="button" className={cx("flex items-center gap-3 mt-2 rounded-control w-full text-left hover:bg-[rgb(20_26_38/0.05)]", compact ? "justify-center w-11 mx-auto h-11" : "px-3 py-2")} onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t("topbar.userMenu")}>
        <span className="w-[34px] h-[34px] rounded-full grid place-items-center text-white font-bold text-sm flex-none" style={{ background: "var(--color-primary)" }}>{initials(me.name)}</span>
        {!compact && <span className="min-w-0"><span className="block text-sm font-bold truncate">{me.name}</span><span className="block text-xs text-muted truncate">{me.email}</span></span>}
      </button>
    }>
      <div role="menu">
        <Link href="/app/seaded" role="menuitem" className="drop-item" onClick={() => setOpen(false)}><IconSettings width={16} height={16} className="text-muted" />{t("topbar.settings")}</Link>
        <button type="button" role="menuitem" className="drop-item" onClick={doLogout}><IconLogout width={16} height={16} className="text-muted" />{t("topbar.logout")}</button>
      </div>
    </Popover>
  );
}
