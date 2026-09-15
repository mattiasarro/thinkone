"use client";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { IconUpload } from "./Icons";

export function Dropzone({ onFiles, accept, multiple, label, hint, busy, className }: { onFiles: (files: File[]) => void; accept?: string; multiple?: boolean; label: ReactNode; hint?: ReactNode; busy?: boolean; className?: string }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) onFiles(multiple ? files : files.slice(0, 1));
  };
  return (
    <div
      className={cx("dropzone", over && "over", busy && "opacity-60 pointer-events-none", className)}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      onClick={() => input.current?.click()}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.current?.click(); } }}
      role="button"
      tabIndex={0}
      aria-labelledby={id}
      aria-busy={busy || undefined}
    >
      <IconUpload className="mx-auto mb-2" width={28} height={28} />
      <div id={id} className="font-semibold text-ink">{label}</div>
      {hint && <div className="text-xs mt-1">{hint}</div>}
      <input ref={input} type="file" className="sr-only" accept={accept} multiple={multiple} onChange={(e) => { const f = Array.from(e.target.files ?? []); if (f.length) onFiles(f); e.target.value = ""; }} tabIndex={-1} />
    </div>
  );
}
