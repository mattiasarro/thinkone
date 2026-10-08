"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { cx } from "@/lib/format";
import type { ParkingPlanFrame, SpotGeom } from "@/types/api";
import { NEUTRAL, normRot } from "./model";

export interface ViewSpot { key: string; geom: SpotGeom; label: string; fill: string; dim?: boolean; selected?: boolean; highlighted?: boolean; dashed?: boolean; crossed?: boolean; title?: string }

export interface ViewHandle {
  fit: () => void;
  zoomBy: (factor: number) => void;
  toMetres: (clientX: number, clientY: number) => { x: number; y: number };
  centre: () => { x: number; y: number };
}

interface Props {
  frame: ParkingPlanFrame;
  spots: ViewSpot[];
  backgroundUrl?: string | null;
  backgroundOpacity?: number;
  className?: string;
  minHeight?: number;
  interactive?: boolean; // wheel zoom + drag pan on empty space
  cursor?: string;
  onSpotPointerDown?: (key: string, e: RPointerEvent<SVGElement>) => void;
  onSpotClick?: (key: string) => void;
  onCanvasPointerDown?: (e: RPointerEvent<SVGSVGElement>) => boolean | void; // return true to take over the drag
  onPointerMove?: (e: RPointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: RPointerEvent<SVGSVGElement>) => void;
  children?: ReactNode; // overlays in metre coordinates
}

/** Read-only SVG renderer of the schematic: the frame in metres, the uploaded plan underneath, one box per placed spot.
 *  The editor and the lease views share it; pan/zoom lives here so every viewer behaves the same. */
export const ParkingPlanView = forwardRef<ViewHandle, Props>(function ParkingPlanView(
  { frame, spots, backgroundUrl, backgroundOpacity = 0.6, className, minHeight = 420, interactive = true, cursor, onSpotPointerDown, onSpotClick, onCanvasPointerDown, onPointerMove, onPointerUp, children }, ref,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const [view, setView] = useState({ k: 10, tx: 0, ty: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const pan = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  const fit = useCallback(() => {
    const el = svgRef.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    const k = Math.min((w - 32) / frame.width, (h - 32) / frame.height);
    setView({ k, tx: (w - frame.width * k) / 2, ty: (h - frame.height * k) / 2 });
  }, [frame.width, frame.height]);

  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Fit once the container has a size, and again whenever the frame changes size (a draft or a calibration).
  const fitKey = size.w ? `${frame.width}x${frame.height}` : "";
  useEffect(() => { if (fitKey) fit(); }, [fitKey, fit]);

  const toMetres = useCallback((clientX: number, clientY: number) => {
    const g = gRef.current;
    const m = g?.getScreenCTM();
    if (!g || !m) return { x: 0, y: 0 };
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    setView((v) => {
      const el = svgRef.current;
      const px = cx ?? (el?.clientWidth ?? 0) / 2, py = cy ?? (el?.clientHeight ?? 0) / 2;
      const k = Math.min(200, Math.max(0.5, v.k * factor));
      const r = k / v.k;
      return { k, tx: px - (px - v.tx) * r, ty: py - (py - v.ty) * r };
    });
  }, []);

  useImperativeHandle(ref, () => ({
    fit,
    zoomBy: (f) => zoomAt(f),
    toMetres,
    centre: () => { const el = svgRef.current; return toMetres((el?.getBoundingClientRect().left ?? 0) + (el?.clientWidth ?? 0) / 2, (el?.getBoundingClientRect().top ?? 0) + (el?.clientHeight ?? 0) / 2); },
  }), [fit, zoomAt, toMetres]);

  // React registers wheel listeners as passive, so the zoom handler is attached natively to be able to stop page scroll.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || !interactive) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [interactive, zoomAt]);

  const down = (e: RPointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    if (e.button === 1 || e.altKey || !(onCanvasPointerDown && onCanvasPointerDown(e))) {
      if (e.button !== 0 && e.button !== 1) return;
      pan.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
    }
    svgRef.current?.setPointerCapture(e.pointerId);
  };
  const move = (e: RPointerEvent<SVGSVGElement>) => {
    if (pan.current) { const p = pan.current; setView((v) => ({ ...v, tx: p.tx + e.clientX - p.x, ty: p.ty + e.clientY - p.y })); return; }
    onPointerMove?.(e);
  };
  const up = (e: RPointerEvent<SVGSVGElement>) => {
    if (pan.current) { pan.current = null; return; }
    onPointerUp?.(e);
  };

  const bg = frame.background;
  const fontPx = 0.9; // metres — readable at any zoom because it scales with the plan
  return (
    <svg ref={svgRef} className={cx("w-full select-none touch-none rounded-control", className)} style={{ minHeight, height: "100%", background: "var(--color-canvas)", cursor: cursor ?? (interactive ? "grab" : "default") }}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} role="img" aria-label="Parkimisskeem">
      <defs>
        <pattern id="pp-grid" width={5} height={5} patternUnits="userSpaceOnUse">
          <path d="M 5 0 L 0 0 0 5" fill="none" stroke="var(--color-divider)" strokeWidth={0.04} />
        </pattern>
        <pattern id="pp-hatch" width={0.6} height={0.6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={0.6} stroke="var(--color-text-secondary)" strokeWidth={0.12} />
        </pattern>
      </defs>
      <g ref={gRef} transform={`translate(${view.tx} ${view.ty}) scale(${view.k})`}>
        <rect x={0} y={0} width={frame.width} height={frame.height} fill="var(--color-surface)" stroke="var(--color-border-control)" strokeWidth={2 / view.k} />
        <rect x={0} y={0} width={frame.width} height={frame.height} fill="url(#pp-grid)" pointerEvents="none" />
        {bg && backgroundUrl && <image href={backgroundUrl} x={bg.x} y={bg.y} width={bg.w} height={bg.h} preserveAspectRatio="none" opacity={backgroundOpacity} style={{ pointerEvents: "none" }} />}
        {spots.map((s) => {
          const g = s.geom;
          const flip = normRot(g.rot) > 90 && normRot(g.rot) < 270;
          const stroke = s.selected ? "var(--color-primary)" : s.highlighted ? "var(--color-text)" : "rgb(20 26 38 / 0.55)";
          return (
            <g key={s.key} transform={`translate(${g.x} ${g.y}) rotate(${g.rot})`} opacity={s.dim ? 0.3 : 1} style={{ cursor: onSpotPointerDown || onSpotClick ? "pointer" : undefined }}
              onPointerDown={(e) => { if (onSpotPointerDown) { e.stopPropagation(); svgRef.current?.setPointerCapture(e.pointerId); onSpotPointerDown(s.key, e); } }}
              onClick={onSpotClick ? () => onSpotClick(s.key) : undefined}>
              {s.title && <title>{s.title}</title>}
              <rect x={-g.w / 2} y={-g.h / 2} width={g.w} height={g.h} rx={0.15} fill={s.fill || NEUTRAL} fillOpacity={s.highlighted ? 0.95 : 0.75} stroke={stroke}
                strokeWidth={s.selected || s.highlighted ? 0.18 : 0.07} strokeDasharray={s.dashed ? "0.3 0.2" : undefined} />
              {s.crossed && <rect x={-g.w / 2} y={-g.h / 2} width={g.w} height={g.h} rx={0.15} fill="url(#pp-hatch)" pointerEvents="none" />}
              <text x={0} y={0} fontSize={Math.min(fontPx, g.w * 0.45)} fontWeight={600} textAnchor="middle" dominantBaseline="central" fill="#fff" stroke="rgb(20 26 38 / 0.55)" strokeWidth={0.02}
                transform={flip ? "rotate(180)" : undefined} pointerEvents="none" style={{ fontFamily: "var(--font-body, system-ui)" }}>{s.label}</text>
            </g>
          );
        })}
        {children}
      </g>
    </svg>
  );
});
