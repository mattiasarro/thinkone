"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { t } from "@/i18n";
import { API_BASE } from "@/lib/api";
import { cx } from "@/lib/format";
import { IconFile } from "@/components/ui/Icons";
import type { ImportSourceFile } from "@/types/api";

/** Where the review points in the original: a page and the strings to mark on it (demo `irMargi`). ``seq`` re-runs the
 *  same focus when the operator clicks the same value twice. */
export interface SourceFocus { file?: number; page?: number | null; needles: string[]; seq: number }

// pdf.js from cdnjs, loaded only here and only when a PDF is shown (the demo's PDFJS_CDN — same version)
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
interface PdfViewport { width: number; height: number; convertToViewportRectangle(r: number[]): number[] }
interface PdfTextItem { str?: string; transform: number[]; width: number; height: number; hasEOL?: boolean }
interface PdfPage { view: number[]; getViewport(o: { scale: number }): PdfViewport; render(o: { canvasContext: CanvasRenderingContext2D; viewport: PdfViewport }): { promise: Promise<void> }; getTextContent(): Promise<{ items: PdfTextItem[] }> }
interface PdfDoc { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> }
interface PdfLib { getDocument(src: { data: Uint8Array }): { promise: Promise<PdfDoc> }; GlobalWorkerOptions: { workerSrc: string } }
let pdfjs: Promise<PdfLib> | null = null;
function loadPdfjs(): Promise<PdfLib> {
  if (pdfjs) return pdfjs;
  pdfjs = new Promise<PdfLib>((res, rej) => {
    const s = document.createElement("script");
    s.src = `${PDFJS_CDN}pdf.min.js`;
    s.onload = () => { const lib = (window as unknown as { pdfjsLib: PdfLib }).pdfjsLib; lib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN}pdf.worker.min.js`; res(lib); };
    s.onerror = () => { pdfjs = null; rej(new Error("pdf.js")); };
    document.head.appendChild(s);
  });
  return pdfjs;
}

/** One rendered page: the image plus every text run's box (in % of the page) for marking values. */
interface Sheet { n: number; url: string; ratio: number; runs: { s: string; box: [number, number, number, number] }[] }

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** The runs of a page that contain the needle (whitespace-insensitive, across run boundaries). */
function findRuns(runs: Sheet["runs"], needle: string): number[] {
  const n = norm(needle);
  if (n.length < 2) return [];
  let text = "";
  const owner: number[] = [];
  runs.forEach((r, i) => {
    const s = norm(r.s);
    if (!s) return;
    if (text && !text.endsWith(" ")) { text += " "; owner.push(i); }
    text += s;
    for (let k = 0; k < s.length; k++) owner.push(i);
  });
  const at = text.indexOf(n);
  if (at < 0) return [];
  return Array.from(new Set(owner.slice(at, at + n.length)));
}

/** Text of a page with the first hit of a needle wrapped (no-PDF fallback: DOCX, or pdf.js unavailable). */
function markText(text: string, needles: string[]): { before: string; hit: string; after: string } | null {
  const low = text.toLowerCase();
  for (const nd of needles) {
    const n = nd.trim().toLowerCase();
    if (n.length < 2) continue;
    const at = low.indexOf(n);
    if (at >= 0) return { before: text.slice(0, at), hit: text.slice(at, at + n.length), after: text.slice(at + n.length) };
  }
  return null;
}

export function fileLabel(f: ImportSourceFile, mainLabel: string, pages: number | null): string {
  if (f.main) return pages ? `${mainLabel} · ${pages} lk` : mainLabel;
  const base = f.name.replace(/\.[^.]+$/, "");
  const plan = /plaan|plan|joonis/i.test(base), space = base.match(/(?:pind|p)[_\s-]*0*(\d{1,3})/i), annex = base.match(/lisa[_\s-]*(\d+)/i);
  if (plan) return space ? `${t("imports.ir.tabPlan")} · P${space[1]}` : t("imports.ir.tabPlan");
  if (annex) return `${t("imports.ir.tabAnnex")} ${annex[1]}`;
  return base.length > 26 ? `${base.slice(0, 24)}…` : base;
}

export function SourceViewer({ jobId, files, textPages, tab, onTab, focus, mainLabel, onPages }: {
  jobId: string; files: ImportSourceFile[]; textPages: { page: number; text: string }[]; tab: number; onTab: (i: number) => void;
  focus: SourceFocus | null; mainLabel: string; onPages?: (n: number) => void;
}) {
  const file = files.find((f) => f.index === tab) ?? files[0];
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [state, setState] = useState<"loading" | "pdf" | "image" | "text">("loading");
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [mainPages, setMainPages] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const url = file ? `${API_BASE}/imports/${jobId}/files/${file.index}` : null;
  const kind = file?.kind ?? (textPages.length ? "docx" : "other");

  // render the chosen file: PDF → pages (sequentially, so the first is up at once), image → <img>, else the text pages
  useEffect(() => {
    let dead = false;
    const objectUrls: string[] = [];
    setSheets([]); setTotal(null); setImgUrl(null);
    if (!url || kind === "docx" || kind === "other") { setState("text"); return; }
    setState("loading");
    (async () => {
      try {
        const res = await fetch(url, { credentials: "include" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (dead) return;
        if (kind === "image") { const u = URL.createObjectURL(blob); objectUrls.push(u); setImgUrl(u); setState("image"); return; }
        const lib = await loadPdfjs();
        const doc = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
        if (dead) { void doc.destroy(); return; }
        setTotal(doc.numPages); setState("pdf");
        if (file?.main) { setMainPages(doc.numPages); onPages?.(doc.numPages); }
        const W = 794 * Math.min(2, window.devicePixelRatio || 1);
        for (let n = 1; n <= doc.numPages; n++) {
          const pg = await doc.getPage(n);
          const vp = pg.getViewport({ scale: W / pg.view[2] });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height);
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          const items = (await pg.getTextContent()).items;
          const runs = items.filter((it) => it.str).map((it) => {
            const h = it.height || Math.abs(it.transform[3]) || 10, x = it.transform[4], y = it.transform[5];
            const [x1, y1, x2, y2] = vp.convertToViewportRectangle([x, y, x + it.width, y + h]);
            return { s: it.str as string, box: [Math.min(x1, x2) / vp.width * 100, Math.min(y1, y2) / vp.height * 100, Math.abs(x2 - x1) / vp.width * 100, Math.abs(y2 - y1) / vp.height * 100] as [number, number, number, number] };
          });
          const out = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
          if (dead) break;
          const u = out ? URL.createObjectURL(out) : canvas.toDataURL();
          if (out) objectUrls.push(u);
          setSheets((s) => [...s, { n, url: u, ratio: vp.height / vp.width, runs }]);
        }
        void doc.destroy();
      } catch {
        if (!dead) setState("text"); // pdf.js or the file unavailable → the extracted text
      }
    })();
    return () => { dead = true; objectUrls.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, kind]);

  // what to mark: the focused page's runs that contain a needle (first needle that hits wins)
  const marks = useMemo(() => {
    if (!focus || state !== "pdf" || (focus.file != null && focus.file !== file?.index)) return null;
    const order = focus.page ? [...sheets.filter((s) => s.n === focus.page), ...sheets.filter((s) => s.n !== focus.page)] : sheets;
    for (const nd of focus.needles) {
      for (const sh of order) {
        const hit = findRuns(sh.runs, nd);
        if (hit.length) return { page: sh.n, boxes: hit.map((i) => sh.runs[i].box) };
      }
    }
    return focus.page ? { page: focus.page, boxes: [] as Sheet["runs"][number]["box"][] } : null;
  }, [focus, sheets, state, file?.index]);

  // scroll to the mark (or the page) once it is rendered
  const pendingSeq = useRef<number | null>(null);
  useEffect(() => { if (focus) pendingSeq.current = focus.seq; }, [focus]);
  useEffect(() => {
    if (pendingSeq.current == null || !box.current) return;
    const el = box.current.querySelector<HTMLElement>(".ir-hl") ?? (marks ? box.current.querySelector<HTMLElement>(`[data-page="${marks.page}"]`) : null)
      ?? (state === "text" ? box.current.querySelector<HTMLElement>("mark, .ir-on") : null);
    if (!el) return;
    pendingSeq.current = null;
    el.scrollIntoView({ behavior: "smooth", block: el.classList.contains("ir-leht") ? "start" : "center" });
  }, [marks, sheets, state]);

  return (
    <div className="ir-vasak-in">
      {files.length > 1 || file ? (
        <div className="ir-dokud" role="tablist" aria-label={t("imports.ir.docs")}>
          {files.map((f) => (
            <button key={f.index} type="button" role="tab" aria-selected={f.index === file?.index} className={cx("ir-dok", f.index === file?.index && "on")} title={f.name} onClick={() => onTab(f.index)}>
              {fileLabel(f, mainLabel, f.main ? (mainPages ?? (f.index === file?.index ? total : null)) : null)}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={box} className="ir-orig">
        {state === "loading" && sheets.length === 0 && <div className="ir-laen"><IconFile width={18} height={18} /><span>{t("imports.ir.opening")}</span></div>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {state === "image" && imgUrl && <div className="ir-leht ir-pilt"><img src={imgUrl} alt={file?.name ?? ""} /></div>}
        {state === "pdf" && sheets.map((sh) => (
          <div key={sh.n} className="ir-leht" data-page={sh.n} style={{ aspectRatio: `1 / ${sh.ratio}` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sh.url} alt={t("imports.page", { n: sh.n })} draggable={false} />
            {marks?.page === sh.n && marks.boxes.map((b, i) => <div key={`${focus?.seq}-${i}`} className="ir-hl" style={{ left: `${b[0]}%`, top: `${b[1]}%`, width: `${b[2]}%`, height: `${b[3]}%` }} />)}
            <span className="ir-leht-nr">{sh.n} / {total}</span>
          </div>
        ))}
        {state === "pdf" && total != null && sheets.length < total && <div className="ir-laen ir-laen-s"><span>{t("imports.ir.pagesLeft", { n: total - sheets.length })}</span></div>}
        {state === "text" && (textPages.length ? textPages.map((p) => {
          const m = focus && (focus.page == null || focus.page === p.page) ? markText(p.text, focus.needles) : null;
          return (
            <div key={p.page} className={cx("ir-leht ir-word", focus?.page === p.page && !m && "ir-on")} data-page={p.page}>
              {m ? <>{m.before}<mark className="on">{m.hit}</mark>{m.after}</> : p.text}
              <span className="ir-leht-nr">{p.page} / {textPages.length}</span>
            </div>
          );
        }) : <div className="ir-laen"><span>{t("imports.ir.noPreview")}</span></div>)}
      </div>
    </div>
  );
}
