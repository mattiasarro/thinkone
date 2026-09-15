"use client";
import { useState } from "react";
import Link from "next/link";
import { t } from "@/i18n";
import { useMarkRead, useNotifications } from "@/lib/queries/auth";
import { Popover } from "@/components/ui/Popover";
import { IconBell } from "@/components/ui/Icons";
import { fmtDateTime, cx } from "@/lib/format";
import type { Notification } from "@/types/api";

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const q = useNotifications();
  const mark = useMarkRead();
  const items = q.data ?? [];
  const unread = items.filter((n) => !n.read_at);
  const onOpen = (n: Notification) => {
    if (!n.read_at) mark.mutate(n.id);
    setOpen(false);
  };
  return (
    <Popover open={open} onClose={() => setOpen(false)} className="w-[min(92vw,380px)]" trigger={
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={unread.length ? `${t("topbar.notifications")} — ${t("topbar.unread", { n: unread.length })}` : t("topbar.notifications")}>
        <IconBell />
        {unread.length > 0 && <span className="dot" aria-hidden>{unread.length > 99 ? "99+" : unread.length}</span>}
      </button>
    }>
      <div className="flex items-center justify-between px-3 py-2">
        <h3 className="text-sm">{t("topbar.notifications")}</h3>
        {unread.length > 0 && <button type="button" className="btn btn-text btn-sm" onClick={() => unread.forEach((n) => mark.mutate(n.id))}>{t("topbar.markAllRead")}</button>}
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        {items.length === 0 ? (
          <div className="p-3 text-sm text-muted">{t("topbar.noNotifications")}</div>
        ) : items.slice(0, 30).map((n) => {
          const inner = (
            <>
              <span className={cx("w-2 h-2 rounded-full mt-1.5 flex-none", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
              <span className="min-w-0">
                <span className={cx("block text-sm", !n.read_at && "font-semibold")}>{n.title}</span>
                {n.body && <span className="block text-xs text-muted line-clamp-2">{n.body}</span>}
                <span className="block text-[11px] text-muted mt-0.5">{fmtDateTime(n.created_at)}</span>
              </span>
            </>
          );
          return n.link ? (
            <Link key={n.id} href={n.link} className="drop-item items-start" onClick={() => onOpen(n)}>{inner}</Link>
          ) : (
            <button key={n.id} type="button" className="drop-item items-start" onClick={() => onOpen(n)}>{inner}</button>
          );
        })}
      </div>
    </Popover>
  );
}
