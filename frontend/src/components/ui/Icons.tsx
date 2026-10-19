import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({ viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, width: 20, height: 20, ...props });

export const IconSpark = (p: P) => <svg {...base(p)}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>;
export const IconGrid = (p: P) => <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></svg>;
export const IconBuilding = (p: P) => <svg {...base(p)}><path d="M3 21h18M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M15 9h3a2 2 0 0 1 2 2v10M9 7h2M9 11h2M9 15h2" /></svg>;
export const IconCal = (p: P) => <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
export const IconChat = (p: P) => <svg {...base(p)}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg>;
export const IconSettings = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.03-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34c.63-.26 1.03-.88 1.03-1.56V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1.03 1.56a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87c.26.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.4-1.56 1.03Z" /></svg>;
export const IconBell = (p: P) => <svg {...base(p)}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21a2 2 0 0 0 4 0" /></svg>;
export const IconSearch = (p: P) => <svg {...base(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
export const IconPlus = (p: P) => <svg {...base(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconMenu = (p: P) => <svg {...base(p)}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
export const IconX = (p: P) => <svg {...base(p)}><path d="m6 6 12 12M6 18 18 6" /></svg>;
export const IconChevron = (p: P) => <svg {...base(p)}><path d="m6 9 6 6 6-6" /></svg>;
export const IconChevronRight = (p: P) => <svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>;
export const IconChevronLeft = (p: P) => <svg {...base(p)}><path d="m15 6-6 6 6 6" /></svg>;
export const IconCheck = (p: P) => <svg {...base(p)}><path d="m5 12 5 5L20 7" /></svg>;
export const IconUpload = (p: P) => <svg {...base(p)}><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>;
export const IconFile = (p: P) => <svg {...base(p)}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></svg>;
export const IconUsers = (p: P) => <svg {...base(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2" /></svg>;
export const IconImport = (p: P) => <svg {...base(p)}><path d="M12 4v12M7 11l5 5 5-5M4 20h16" /></svg>;
export const IconTrash = (p: P) => <svg {...base(p)}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;
export const IconEdit = (p: P) => <svg {...base(p)}><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3ZM13 6l3 3" /></svg>;
export const IconExternal = (p: P) => <svg {...base(p)}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></svg>;
export const IconLogout = (p: P) => <svg {...base(p)}><path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M15 16l4-4-4-4M19 12H9" /></svg>;
export const IconAlert = (p: P) => <svg {...base(p)}><path d="M12 9v4M12 17h.01M10.3 4.3 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" /></svg>;
export const IconInfo = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg>;
export const IconLock = (p: P) => <svg {...base(p)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
export const IconArrowLeft = (p: P) => <svg {...base(p)}><path d="M19 12H5M11 6l-6 6 6 6" /></svg>;
export const IconArrowRight = (p: P) => <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const IconClock = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconLink = (p: P) => <svg {...base(p)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;

export const LogoMark = (p: P) => (
  <svg viewBox="0 0 116 116" xmlns="http://www.w3.org/2000/svg" aria-label="ThinkOne" {...p}>
    <rect width="116" height="116" rx="26" fill="currentColor" />
    <g transform="translate(28.2 20.9) scale(0.64)" fill="var(--on-ink)">
      <path d="M0,33.06v47.14h31.79v-29.6L7.67,31.96h51.52V.17h-26.31c-.55,0-1.1.55-1.64.55L.55,31.42c0,.55-.55,1.1-.55,1.64Z" />
      <path d="M92.63,82.94v-47.14h-32.34v30.15l24.12,18.09h-50.97v31.79h26.31c.55,0,1.1-.55,1.64-.55l30.69-30.69s.55-1.1.55-1.64Z" />
    </g>
  </svg>
);
export const IconDownload = (p: P) => <svg {...base(p)}><path d="M12 4v11M7 10l5 5 5-5M4 20h16" /></svg>;
/** Four-point sparkle — the AI assistant (nav, context chip). */
export const IconAi = (p: P) => <svg {...base(p)}><path d="M12 3c.6 4.6 3.4 7.4 8 8-4.6.6-7.4 3.4-8 8-.6-4.6-3.4-7.4-8-8 4.6-.6 7.4-3.4 8-8Z" /><path d="M19 15c.2 1.6 1.2 2.6 2.8 2.8-1.6.2-2.6 1.2-2.8 2.8-.2-1.6-1.2-2.6-2.8-2.8 1.6-.2 2.6-1.2 2.8-2.8Z" /></svg>;
export const IconClip = (p: P) => <svg {...base(p)}><path d="M21 12.3l-8.2 8.2a6 6 0 0 1-8.5-8.5L12.6 3.7a4 4 0 0 1 5.7 5.7l-8.3 8.3a2 2 0 0 1-2.9-2.9l7.8-7.7" /></svg>;
export const IconMic = (p: P) => <svg {...base(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>;
export const IconArrowUp = (p: P) => <svg {...base(p)}><path d="M12 19V5M6 11l6-6 6 6" /></svg>;
export const IconCopy = (p: P) => <svg {...base(p)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></svg>;
export const IconStop = (p: P) => <svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
export const IconMoon = (p: P) => <svg {...base(p)}><path d="M20 13.2A8.4 8.4 0 0 1 10.8 4a8.4 8.4 0 1 0 9.2 9.2Z" /></svg>;
export const IconSun = (p: P) => <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></svg>;
export const IconSidebar = (p: P) => <svg {...base(p)}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9.5 4v16" /></svg>;
/** The bare ThinkOne glyph (no box) — the AI mark in the omnibox and composer. */
export const Glyph = (p: P) => (
  <svg viewBox="0 0 93 116" xmlns="http://www.w3.org/2000/svg" aria-hidden fill="currentColor" {...p}>
    <path d="M0,33.06v47.14h31.79v-29.6L7.67,31.96h51.52V.17h-26.31c-.55,0-1.1.55-1.64.55L.55,31.42c0,.55-.55,1.1-.55,1.64Z" />
    <path d="M92.63,82.94v-47.14h-32.34v30.15l24.12,18.09h-50.97v31.79h26.31c.55,0,1.1-.55,1.64-.55l30.69-30.69s.55-1.1.55-1.64Z" />
  </svg>
);
/** Full ThinkOne lockup (demo index.html v409): boxed mark + wordmark, all in currentColor; the mark's glyph in --on-ink. */
export const LogoFull = (p: P) => (
  <svg viewBox="0 0 525 116" xmlns="http://www.w3.org/2000/svg" aria-label="ThinkOne" {...p}>
    <g transform="translate(58 58) rotate(-8) scale(.88) translate(-58 -58)">
      <rect width="116" height="116" rx="26" fill="currentColor" />
      <g transform="translate(28.2 20.9) scale(0.64)" fill="var(--on-ink)">
        <path d="M0,33.06v47.14h31.79v-29.6L7.67,31.96h51.52V.17h-26.31c-.55,0-1.1.55-1.64.55L.55,31.42c0,.55-.55,1.1-.55,1.64Z" />
        <path d="M92.63,82.94v-47.14h-32.34v30.15l24.12,18.09h-50.97v31.79h26.31c.55,0,1.1-.55,1.64-.55l30.69-30.69s.55-1.1.55-1.64Z" />
      </g>
    </g>
    <g transform="translate(24 0)" fill="currentColor">
      <path d="M130.73,80.64v-31.4h-14.2v-10.1h40.61v10.1h-14.64v31.4h-11.76Z" />
      <path d="M168.56,80.64v-41.49h11.76v41.49h-11.76ZM173,65.21l.11-10.32h30.4v10.32h-30.51ZM197.08,80.64v-41.49h11.76v41.49h-11.76Z" />
      <path d="M250,80.64v-41.49h10.76l23.52,27.62-2.22-.55c-.22-1.55-.44-3-.55-4.22-.11-1.22-.22-2.44-.33-3.55s-.22-2.22-.22-3.22c0-1.11-.11-2.22-.11-3.33v-12.76h11.32v41.49h-10.87l-25.07-29.62,3.88,1c.11,1.22.22,2.22.33,3.22s.22,1.89.33,2.77.22,1.89.22,2.77c.11,1,.11,2.11.11,3.33s.11,2.66.11,4.1v12.31h-11.21s0,.11,0,.11Z" />
      <path d="M307.13,80.64v-41.49h11.76v41.49h-11.76ZM315.01,69.65l-3.55-9.21,23.63-21.3h13.98l-34.06,30.51ZM336.42,80.64l-16.09-20.41,7.43-7.1,22.41,27.51h-13.76Z" />
      <path d="M380.47,81.19c-3.33,0-6.32-.55-8.99-1.55-2.66-1-4.99-2.55-7.1-4.44-2-1.89-3.55-4.1-4.66-6.77-1.11-2.55-1.55-5.44-1.55-8.43s.55-5.88,1.55-8.43c1.11-2.55,2.66-4.88,4.66-6.77s4.33-3.44,7.1-4.44c2.66-1,5.66-1.55,8.99-1.55s6.21.55,8.99,1.55c2.77,1,5.1,2.55,7.1,4.44,2,1.89,3.55,4.22,4.66,6.77s1.66,5.44,1.66,8.43-.55,5.88-1.66,8.43-2.66,4.88-4.66,6.77-4.33,3.33-7.1,4.44-5.77,1.55-8.99,1.55ZM380.47,78.31c2.77,0,5.33-.44,7.66-1.33,2.33-.89,4.44-2.11,6.1-3.77,1.78-1.66,3-3.55,3.99-5.77.89-2.22,1.44-4.66,1.44-7.32s-.44-5.1-1.44-7.32c-.89-2.22-2.22-4.22-3.99-5.77-1.78-1.66-3.77-2.88-6.1-3.77s-4.88-1.33-7.66-1.33-5.33.44-7.66,1.33c-2.33.89-4.33,2.22-6.1,3.77-1.66,1.66-3,3.55-3.99,5.77-.89,2.22-1.44,4.66-1.44,7.32s.44,5.1,1.44,7.32c.89,2.22,2.22,4.1,3.99,5.77,1.66,1.66,3.77,2.88,6.1,3.77,2.33.89,4.88,1.33,7.66,1.33Z" />
      <path d="M417.19,80.64v-41.49h2.88l32.4,37.94-.67,1.55c-.11-.44-.11-1.44-.11-2.88,0-1.55,0-3.22-.11-5.21,0-2-.11-3.99-.11-5.99v-25.41h3v41.49h-3.11l-32.28-38.05.55-1.66v2.88c0,1.33.11,2.77.11,4.44.11,1.66.11,3.33.22,4.88.11,1.66.11,3.11.11,4.44v23.08s-2.88,0-2.88,0Z" />
      <path d="M472.33,80.64v-41.49h27.51v3h-24.52v35.5h24.3v3h-27.29ZM473.88,60.67v-3h22.63v3h-22.63Z" />
      <polygon points="235.24 70.87 235.24 48.91 235.24 39.14 223.48 39.14 223.48 80.64 235.24 80.64 235.24 70.87" />
    </g>
  </svg>
);
