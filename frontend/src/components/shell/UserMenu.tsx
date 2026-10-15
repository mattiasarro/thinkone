"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Me } from "@/types/api";
import { t } from "@/i18n";
import { initials } from "@/lib/format";
import { useLogout } from "@/lib/queries/auth";
import { Popover } from "@/components/ui/Popover";
import { IconLogout, IconSettings } from "@/components/ui/Icons";

/** Sidebar footer user row (demo `.sb-user`): avatar · name · role; the menu opens upwards. */
export function UserMenu({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const logout = useLogout();
  const router = useRouter();
  const doLogout = async () => {
    setOpen(false);
    try { await logout.mutateAsync(); } finally { router.replace("/login"); }
  };
  const role = t(`topbar.role.${me.account.role}` as "topbar.role.admin") || me.account.role;
  return (
    <Popover open={open} onClose={() => setOpen(false)} align="left" className="user-pop" trigger={
      <button type="button" className="sb-user" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={t("topbar.userMenu")}>
        <div className="av">{initials(me.name)}</div>
        <div className="min-w-0"><div className="nm">{me.name}</div><div className="rl">{role}</div></div>
      </button>
    }>
      <div role="menu">
        <div className="drop-lbl">{me.email}</div>
        <Link href="/app/seaded" role="menuitem" className="drop-item" onClick={() => setOpen(false)}><IconSettings />{t("topbar.settings")}</Link>
        <div className="drop-div" />
        <button type="button" role="menuitem" className="drop-item" onClick={doLogout}><IconLogout />{t("topbar.logout")}</button>
      </div>
    </Popover>
  );
}
