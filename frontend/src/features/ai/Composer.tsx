"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, type KeyboardEvent } from "react";
import { t } from "@/i18n";
import { cx } from "@/lib/format";
import { useAiUsage } from "@/lib/queries/ai";
import { IconArrowUp } from "@/components/ui/Icons";

export interface ComposerHandle { focus: () => void }

export const Composer = forwardRef<ComposerHandle, { value: string; onChange: (v: string) => void; onSend: (text: string) => void; busy: boolean }>(function Composer({ value, onChange, onSend, busy }, ref) {
  const ta = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => { ta.current?.focus(); const el = ta.current; if (el) el.setSelectionRange(el.value.length, el.value.length); } }), []);
  // auto-grow up to ~6 lines
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);
  const submit = () => {
    const text = value.trim();
    if (!text || busy) return;
    onSend(text);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
  };
  const canSend = !!value.trim() && !busy;
  return (
    <div className="grid gap-2">
      <form className="flex items-end gap-2 p-2 pl-4 rounded-[18px] border bg-surface shadow-surface" style={{ borderColor: "var(--color-divider)" }} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <textarea
          ref={ta}
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKey}
          placeholder={t("ai.composer.placeholder")}
          aria-label={t("ai.composer.placeholder")}
          disabled={busy}
          className="flex-1 min-w-0 resize-none bg-transparent outline-none text-[15px] leading-6 py-2 max-h-[160px] disabled:text-muted"
        />
        <button type="submit" aria-label={t("ai.composer.send")} title={t("ai.composer.send")} disabled={!canSend} aria-busy={busy || undefined}
          className={cx("w-10 h-10 rounded-full grid place-items-center flex-none transition-colors", canSend ? "bg-accent text-accent-on hover:bg-primary-hover" : "bg-subtle text-muted cursor-not-allowed")}>
          {busy ? <span className="spinner !w-4 !h-4 !border-divider !border-t-muted" /> : <IconArrowUp width={18} height={18} />}
        </button>
      </form>
      <UsageLine />
    </div>
  );
});

function UsageLine() {
  const usage = useAiUsage();
  const u = usage.data;
  if (!u) return <p className="m-0 h-4 text-center text-[11.5px] text-muted hidden sm:block">{t("ai.composer.hint")}</p>;
  const pct = u.budget > 0 ? Math.min(100, Math.round(((u.budget - u.remaining) / u.budget) * 100)) : 0;
  return (
    <p className={cx("m-0 text-center text-[11.5px]", u.exhausted ? "text-warning" : "text-muted")}>
      {u.exhausted ? t("ai.usageExhausted", { n: u.runs }) : t("ai.usage", { n: u.runs, pct })}
      <span className="hidden sm:inline"> · {t("ai.composer.hint")}</span>
    </p>
  );
}
