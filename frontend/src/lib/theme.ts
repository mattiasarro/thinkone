"use client";
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
/** Same key as the demo, so a browser that has used the demo keeps its choice. */
export const THEME_KEY = "thinkone_theme";

function read(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** Dark by default (demo v423); the choice lives on <html data-theme> and in localStorage. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => { setTheme(read()); }, []);
  const toggle = useCallback(() => {
    const next: Theme = read() === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
    setTheme(next);
  }, []);
  return [theme, toggle];
}
