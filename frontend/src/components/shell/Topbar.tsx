"use client";
import type { Me } from "@/types/api";
import { t } from "@/i18n";
import { IconMenu, IconPlus } from "@/components/ui/Icons";
import { SearchBox } from "./SearchBox";
import { NotificationsBell } from "./NotificationsBell";
import { Popover } from "@/components/ui/Popover";
import { useState } from "react";
import Link from "next/link";

export function Topbar({ me, onOpenMobile }: { me: Me; onOpenMobile: () => void }) {
  const [newOpen, setNewOpen] = useState(false);
  return (
    <header className="sticky top-0 z-[20] h-16 flex items-center gap-3 px-4 md:px-6 bg-surface border-b" style={{ borderColor: "var(--line)" }}>
      <button type="button" className="icon-btn md:hidden" onClick={onOpenMobile} aria-label={t("nav.openMenu")} aria-controls="sidebar"><IconMenu /></button>
      <div className="flex-1 min-w-0 flex items-center justify-center gap-2">
        <SearchBox />
        <Popover open={newOpen} onClose={() => setNewOpen(false)} trigger={
          <button type="button" className="btn btn-primary btn-sm h-10 px-3" onClick={() => setNewOpen((o) => !o)} aria-haspopup="menu" aria-expanded={newOpen}>
            <IconPlus width={16} height={16} /><span className="hidden sm:inline">{t("nav.newButton")}</span>
          </button>
        }>
          <div role="menu" className="min-w-[200px]">
            <Link role="menuitem" className="drop-item" href="/app/portfell/objekt/uus" onClick={() => setNewOpen(false)}>{t("home.addAsset")}</Link>
            <Link role="menuitem" className="drop-item" href="/app/portfell/import" onClick={() => setNewOpen(false)}>{t("home.importContract")}</Link>
            <Link role="menuitem" className="drop-item" href="/app/portfell?tab=osapooled&new=1" onClick={() => setNewOpen(false)}>{t("home.addParty")}</Link>
          </div>
        </Popover>
      </div>
      <div className="flex items-center gap-1">
        <NotificationsBell />
        <span className="sr-only">{me.name}</span>
      </div>
    </header>
  );
}
