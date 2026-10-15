"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useDebounced, useClickOutside } from "@/lib/hooks";
import { useSearch } from "@/lib/queries/portfolio";
import { Glyph, IconAi, IconArrowUp, IconBuilding, IconCal, IconFile, IconUsers } from "@/components/ui/Icons";
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

function HitIcon({ type }: { type: string }) {
  if (type === "party") return <IconUsers className="ic" />;
  if (type === "key_date") return <IconCal className="ic" />;
  if (type === "asset" || type === "space" || type === "property") return <IconBuilding className="ic" />;
  return <IconFile className="ic" />;
}

/** The omnibox (demo v773): 32 px flat box with the ThinkOne glyph, ⌘K, results below; Enter with no result or the send button asks the AI. */
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
  const ask = () => { const text = q.trim(); if (!text) return; setOpen(false); setQ(""); router.push(`/app/ai?q=${encodeURIComponent(text)}`); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, hits.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { if (idx >= 0 && hits[idx]) go(hits[idx]); else ask(); }
    else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
  };

  return (
    <div ref={ref} className="omni-wrap">
      <div className="omni">
        <span className="omni-mark" title={t("app.name")}><Glyph /></span>
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
          autoComplete="off"
        />
        <kbd>⌘K</kbd>
        <button type="button" className="omni-send" onClick={ask} title={t("topbar.send")} aria-label={t("topbar.send")}><IconArrowUp /></button>
      </div>
      {open && dq.trim().length >= 2 && (
        <div id="search-results" role="listbox" className="drop omni-pop rise">
          {res.isLoading ? (
            <div className="flex items-center gap-2 p-3 text-[12.5px] text-muted"><Spinner /> {t("topbar.searching")}</div>
          ) : (
            <>
              {hits.length > 0 && <div className="om-lbl">{t("topbar.searchLabel")}</div>}
              {hits.length === 0 && <div className="p-3 text-[12.5px] text-muted">{t("topbar.noSearchResults")}</div>}
              {hits.map((h, i) => (
                <button key={`${h.entity_type}-${h.entity_id}`} type="button" role="option" aria-selected={i === idx} className={cx("om-row", i === idx && "sel")} onMouseEnter={() => setIdx(i)} onClick={() => go(h)}>
                  <HitIcon type={h.entity_type} />
                  <span className="tx"><span className="t">{h.title}</span><span className="s">{tEnum("search.entity", h.entity_type)}{h.subtitle ? ` · ${h.subtitle}` : ""}</span></span>
                </button>
              ))}
              <button type="button" role="option" aria-selected={false} className="om-row om-ai" onClick={ask}>
                <IconAi className="ic" />
                <span className="tx"><span className="t">{t("topbar.askAi", { q: dq.trim() })}</span></span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
