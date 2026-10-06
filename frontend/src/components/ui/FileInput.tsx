"use client";
import { useId, useRef, useState, type DragEvent, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { IconUpload } from "./Icons";

/** Files from a drop, with dropped folders walked recursively. A directory arrives in `dataTransfer.files` as a
 *  zero-byte "file" that fetch() cannot read (it surfaces as a network error), so expand it via the entries API. */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? []);
  const entries = items.map((it) => (typeof it.webkitGetAsEntry === "function" ? it.webkitGetAsEntry() : null));
  if (!entries.length || entries.some((e) => e === null)) return Array.from(dt.files ?? []).filter((f) => f.size > 0 || f.type !== "");
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.name.startsWith(".")) return; // .DS_Store and friends
    if (entry.isFile) {
      const f = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
      out.push(f);
      return;
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      for (;;) {
        const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej)); // ≤100 per call
        if (!batch.length) break;
        for (const child of batch) await walk(child);
      }
    }
  };
  for (const e of entries) if (e) await walk(e);
  return out;
}

export function Dropzone({ onFiles, accept, multiple, label, hint, busy, className }: { onFiles: (files: File[]) => void; accept?: string; multiple?: boolean; label: ReactNode; hint?: ReactNode; busy?: boolean; className?: string }) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void filesFromDrop(e.dataTransfer).then((files) => { if (files.length) onFiles(multiple ? files : files.slice(0, 1)); });
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
