import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { IconCheck, IconClock, IconEdit } from "@/components/ui/Icons";
import { cx } from "@/lib/format";

export type StatusTone = "client" | "wait" | "done";

/** The one guide card: the icon box background alone carries the state (demo v781/v782) — amber = Teie kord, grey = waiting, green = closed. One primary action at most. */
export function StatusBox({ tone, title, text, cta }: { tone: StatusTone; title: string; text?: string | null; cta?: ReactNode }) {
  return (
    <Card pad className={cx("portal-hero", !!cta && "has-cta")}>
      <span className={cx("portal-hero-ic", tone === "client" ? "client" : tone === "done" ? "done" : undefined)} aria-hidden="true">
        {tone === "client" ? <IconEdit /> : tone === "done" ? <IconCheck /> : <IconClock />}
      </span>
      <div className="min-w-0">
        <div className="portal-hero-t">{title}</div>
        {text && <div className="portal-hero-s">{text}</div>}
      </div>
      {cta && <div className="portal-hero-cta">{cta}</div>}
    </Card>
  );
}
