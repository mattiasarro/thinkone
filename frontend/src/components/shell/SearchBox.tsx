"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useDebounced, useClickOutside } from "@/lib/hooks";
import { useSearch } from "@/lib/queries/portfolio";
import { IconSearch } from "@/components/ui/Icons";
import { Spinner } from "@/components/ui/State";
import { cx } from "@/lib/format";
import type { SearchHit } from "@/types/api";

export function hitHref(h: SearchHit): string {
  if (h.link) return h.link.startsWith("/") ? h.link : `/${h.link}`;
  switch (h.entity_type) {
    case "contract": return `/app/portfell/leping/${h.entity_id}`;
    case "party": return `/app/portfell/osapool/${h.entity_id}`;
    case "asset": case "space": case "property": return `/app/portfell/objekt/${h.entity_id}`;
    case "key_date": return `/app/kalender`;
    default: return "/app/portfell";
  }
}

export function SearchBox() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(-1);
  const dq = useDebounced(q, 250);
  const res = useSearch(dq);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  useClickOutside(ref, () => setOpen(false), open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); input.current?.focus(); setOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = res.data ?? [];
  const go = (h: SearchHit) => { setOpen(false); setQ(""); router.push(hitHref(h)); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && idx >= 0 && hits[idx]) go(hits[idx]);
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={ref} className="relative w-full max-w-[560px]">
      <div className="flex items-center gap-2 h-10 px-3 rounded-control border" style={{ borderColor: "var(--color-divider)", background: "var(--color-canvas)" }}>
        <IconSearch width={16} height={16} className="text-muted flex-none" />
        <input
          ref={input}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setIdx(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={t("topbar.searchPlaceholder")}
          aria-label={t("topbar.searchLabel")}
          role="combobox"
          aria-expanded={open && dq.length >= 2}
          aria-controls="search-results"
          aria-autocomplete="list"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm"
        />
        <kbd className="hidden sm:inline text-[11px] text-muted border rounded px-1" style={{ borderColor: "var(--color-divider)" }}>⌘K</kbd>
      </div>
      {open && dq.trim().length >= 2 && (
        <div id="search-results" role="listbox" className="drop rise left-0 right-0 max-h-[60vh] overflow-y-auto">
          {res.isLoading ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted"><Spinner /> {t("topbar.searching")}</div>
          ) : hits.length === 0 ? (
            <div className="p-3 text-sm text-muted">{t("topbar.noSearchResults")}</div>
          ) : (
            hits.map((h, i) => (
              <button key={`${h.entity_type}-${h.entity_id}`} type="button" role="option" aria-selected={i === idx} className={cx("drop-item", i === idx && "bg-canvas")} onMouseEnter={() => setIdx(i)} onClick={() => go(h)}>
                <span className="pill flex-none">{tEnum("search.entity", h.entity_type)}</span>
                <span className="min-w-0"><span className="block truncate font-medium">{h.title}</span>{h.subtitle && <span className="block text-xs text-muted truncate">{h.subtitle}</span>}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
