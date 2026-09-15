"use client";
import { useRef, type ReactNode } from "react";
import { useClickOutside } from "@/lib/hooks";
import { cx } from "@/lib/format";

export function Popover({ open, onClose, trigger, children, className, align = "right" }: { open: boolean; onClose: () => void; trigger: ReactNode; children: ReactNode; className?: string; align?: "left" | "right" }) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClose, open);
  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && <div className={cx("drop rise", align === "left" && "left-0 right-auto", className)}>{children}</div>}
    </div>
  );
}
