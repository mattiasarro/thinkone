"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { t } from "@/i18n";
import { IconX } from "./Icons";
import { cx } from "@/lib/format";

export function Modal({ open, onClose, title, sub, children, footer, wide }: { open: boolean; onClose: () => void; title: ReactNode; sub?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("input,select,textarea,button:not([data-close])");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const els = Array.from(ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex='-1'])"));
        if (!els.length) return;
        const f = els[0], l = els[els.length - 1];
        if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); }
        else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[40] flex items-end sm:items-center justify-center p-0 sm:p-6" style={{ background: "var(--color-scrim)" }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="modal-title" className={cx("card rise w-full max-h-[92vh] flex flex-col rounded-b-none sm:rounded-b-[var(--radius-surface)]", wide ? "sm:max-w-3xl" : "sm:max-w-lg")} style={{ boxShadow: "var(--shadow-modal)" }}>
        <header className="card-h">
          <div className="min-w-0">
            <h3 id="modal-title">{title}</h3>
            {sub && <p className="text-muted text-sm mt-0.5">{sub}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t("common.close")} data-close><IconX /></button>
        </header>
        <div className="card-b overflow-y-auto flex-1 min-h-0">{children}</div>
        {footer && <footer className="flex items-center justify-end gap-2 flex-wrap px-[var(--card-padding)] py-4 border-t" style={{ borderColor: "var(--line)" }}>{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({ open, onClose, onConfirm, title, body, busy, destructive = true }: { open: boolean; onClose: () => void; onConfirm: () => void; title: ReactNode; body?: ReactNode; busy?: boolean; destructive?: boolean }) {
  return (
    <Modal open={open} onClose={onClose} title={title} footer={
      <>
        <button type="button" className="btn btn-ghost" onClick={onClose}>{t("common.cancel")}</button>
        <button type="button" className={cx("btn", destructive ? "btn-destructive" : "btn-primary")} onClick={onConfirm} aria-busy={busy || undefined} disabled={busy}>{t("common.confirm")}</button>
      </>
    }>
      {body && <p>{body}</p>}
    </Modal>
  );
}
