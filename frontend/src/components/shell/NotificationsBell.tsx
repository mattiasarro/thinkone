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
    <Popover open={open} onClose={() => setOpen(false)} className="notif-pop w-[min(92vw,380px)]" trigger={
      <button type="button" className="icon-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={unread.length ? `${t("topbar.notifications")} — ${t("topbar.unread", { n: unread.length })}` : t("topbar.notifications")}>
        <IconBell />
        {unread.length > 0 && <span className="dot" aria-hidden>{unread.length > 99 ? "99+" : unread.length}</span>}
      </button>
    }>
      <div className="np-head">
        <span className="overline">{t("topbar.notifications")}</span>
        {unread.length > 0 && <button type="button" className="steplink" onClick={() => unread.forEach((n) => mark.mutate(n.id))}>{t("topbar.markAllRead")}</button>}
      </div>
      <div>
        {items.length === 0 ? (
          <div className="p-3 text-[12.5px] text-muted">{t("topbar.noNotifications")}</div>
        ) : items.slice(0, 30).map((n) => {
          const inner = (
            <>
              <span className={cx("np-dot", n.read_at && "opacity-0")} aria-hidden />
              <span className="np-tx">
                <span className="t">{n.title}</span>
                {n.body && <span className="s line-clamp-2">{n.body}</span>}
              </span>
              <span className="np-aeg">{fmtDateTime(n.created_at)}</span>
            </>
          );
          return n.link ? (
            <Link key={n.id} href={n.link} className={cx("np-item", n.read_at && "read")} onClick={() => onOpen(n)}>{inner}</Link>
          ) : (
            <button key={n.id} type="button" className={cx("np-item", n.read_at && "read")} onClick={() => onOpen(n)}>{inner}</button>
          );
        })}
      </div>
    </Popover>
  );
}
