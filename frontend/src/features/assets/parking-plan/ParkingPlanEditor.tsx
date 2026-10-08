"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as RPointerEvent } from "react";
import { t, tEnum } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { ErrorState, Loading } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { API_BASE, errorMessage } from "@/lib/api";
import { cx } from "@/lib/format";
import { useDeriveParkingPlan, useDiscardParkingDraft, useParkingPlan, useSaveParkingPlan } from "@/lib/queries/portfolio";
import type { AssetDetail, ParkingPlan, ParkingPlanDraft, ParkingPlanFrame, ParkingPlanSave, SpotGeom, SpotType } from "@/types/api";
import { ParkingPlanView, type ViewHandle, type ViewSpot } from "./ParkingPlanView";
import { DEFAULT_FRAME, DEFAULT_M_PER_PX, GRID, MIN_SIZE, NEUTRAL, STANDARD, corners, fromPlanSpot, nextNumber, normRot, resizeFromCorner, rotateTowards, round2, rowAfter, snap, spaceColor, type EditorSpot, type EditorState } from "./model";

type Tool = "select" | "draw" | "pan";
type Drag =
  | { kind: "move"; start: { x: number; y: number }; geoms: Record<string, SpotGeom>; snapshot: EditorState }
  | { kind: "resize"; key: string; corner: number; snapshot: EditorState }
  | { kind: "rotate"; key: string; snapshot: EditorState }
  | { kind: "draw"; start: { x: number; y: number } }
  | { kind: "marquee"; start: { x: number; y: number }; add: boolean };

const TYPES: SpotType[] = ["tavaline", "elektriauto", "ligipääsetav"];
const STATUS_FILL: Record<string, string> = { vaba: "hsl(220 60% 60%)", "üüritud": "hsl(150 45% 42%)", reserv: "hsl(38 70% 50%)", "kasutusest väljas": "hsl(220 8% 60%)" };

export function ParkingPlanEditor({ property }: { property: AssetDetail }) {
  const q = useParkingPlan(property.id);
  if (q.isLoading) return <Loading rows={6} />;
  if (q.error || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  return <Editor property={property} plan={q.data} />;
}

function initState(plan: ParkingPlan): EditorState {
  return { frame: plan.frame ? { ...plan.frame, background: plan.frame.background ? { ...plan.frame.background } : null } : { ...DEFAULT_FRAME }, spots: plan.spots.map(fromPlanSpot) };
}

function Editor({ property, plan }: { property: AssetDetail; plan: ParkingPlan }) {
  const save = useSaveParkingPlan(property.id);
  const derive = useDeriveParkingPlan(property.id);
  const discard = useDiscardParkingDraft(property.id);
  const toast = useToast();
  const view = useRef<ViewHandle>(null);
  const spaces = useMemo(() => property.children.filter((c) => c.type_code === "space" && c.status !== "jagatud"), [property.children]);
  const spaceIndex = useMemo(() => new Map(spaces.map((s, i) => [s.id, i])), [spaces]);

  const [state, setState] = useState<EditorState>(() => initState(plan));
  const [past, setPast] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  const [dirty, setDirty] = useState(false);
  const [clearDraft, setClearDraft] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [tool, setTool] = useState<Tool>("select");
  const [mode, setMode] = useState<"space" | "status">("space");
  const [filter, setFilter] = useState<string | null>(null);
  const [showBg, setShowBg] = useState(true);
  const [rowN, setRowN] = useState("5");
  const [calib, setCalib] = useState("");
  const [drawing, setDrawing] = useState<SpotGeom | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const newSeq = useRef(0);

  // The server's copy wins while nothing is edited (a register change in the other tab, the draft arriving).
  useEffect(() => { if (!dirty) { setState(initState(plan)); setPast([]); setFuture([]); } }, [plan, dirty]);

  // No frame yet but a plan uploaded → the image's pixel size sets a provisional scale (5 cm per pixel), calibrated later.
  const bgUrl = plan.plan_attachment ? `${API_BASE}/assets/${property.id}/parking/plan/background` : null;
  useEffect(() => {
    if (plan.frame || !plan.plan_attachment || dirty) return;
    const img = new Image();
    img.onload = () => {
      const w = round2(img.naturalWidth * DEFAULT_M_PER_PX), h = round2(img.naturalHeight * DEFAULT_M_PER_PX);
      setState((s) => (s.frame.background ? s : { ...s, frame: { units: "m", width: w, height: h, background: { attachment_id: plan.plan_attachment!.id, x: 0, y: 0, w, h, opacity: 0.6 } } }));
    };
    img.src = `${API_BASE}/assets/${property.id}/parking/plan/background`;
  }, [plan.frame, plan.plan_attachment, property.id, dirty]);

  const commit = useCallback((next: EditorState, from?: EditorState) => {
    setPast((p) => [...p.slice(-60), from ?? state]);
    setFuture([]);
    setState(next);
    setDirty(true);
  }, [state]);
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast((p) => p.slice(0, -1)); setFuture((f) => [state, ...f]); setState(prev); setDirty(true); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture((f) => f.slice(1)); setPast((p) => [...p, state]); setState(next); setDirty(true); };

  const selected = state.spots.filter((s) => sel.has(s.key));
  const one = selected.length === 1 ? selected[0] : null;
  const placed = state.spots.filter((s) => s.geom);
  const unplaced = state.spots.filter((s) => !s.geom && s.id);
  const bg = state.frame.background;

  const patchSpots = (keys: Set<string>, fn: (s: EditorSpot) => EditorSpot) => commit({ ...state, spots: state.spots.map((s) => (keys.has(s.key) ? fn(s) : s)) });
  const addSpots = (geoms: SpotGeom[], base?: Partial<EditorSpot>, select = true) => {
    const spots = [...state.spots];
    const keys: string[] = [];
    for (const g of geoms) {
      const key = `new:${++newSeq.current}`;
      keys.push(key);
      spots.push({ key, id: null, number: nextNumber(spots), zone: base?.zone ?? null, type: base?.type ?? "tavaline", reserve: false, out_of_service: false, status: null, space_id: base?.space_id ?? null, contract: null, geom: g });
    }
    commit({ ...state, spots });
    if (select) setSel(new Set(keys));
  };
  const placeSpot = (key: string) => {
    const c = view.current?.centre() ?? { x: state.frame.width / 2, y: state.frame.height / 2 };
    const n = placed.length;
    const g: SpotGeom = { x: snap(c.x + (n % 6) * STANDARD.w, GRID), y: snap(c.y, GRID), w: STANDARD.w, h: STANDARD.h, rot: one?.geom?.rot ?? 0 };
    patchSpots(new Set([key]), (s) => ({ ...s, geom: g }));
    setSel(new Set([key]));
  };
  const removeSelected = () => {
    if (!sel.size) return;
    commit({ ...state, spots: state.spots.filter((s) => !(sel.has(s.key) && !s.id)).map((s) => (sel.has(s.key) ? { ...s, geom: null } : s)) });
    setSel(new Set());
  };
  const rotateSelected = (deg: number) => patchSpots(sel, (s) => (s.geom ? { ...s, geom: { ...s.geom, rot: normRot(s.geom.rot + deg) } } : s));
  const duplicateSelected = () => { if (selected.length) addSpots(selected.filter((s) => s.geom).map((s) => ({ ...s.geom!, x: round2(s.geom!.x + s.geom!.w), y: s.geom!.y })), { type: one?.type, space_id: one?.space_id ?? null }); };
  const fillRow = () => {
    const n = Math.max(1, Math.min(60, parseInt(rowN, 10) || 1));
    if (one?.geom) addSpots(rowAfter(one.geom, n), { type: one.type, zone: one.zone, space_id: one.space_id });
  };
  const nudge = (dx: number, dy: number) => patchSpots(sel, (s) => (s.geom ? { ...s, geom: { ...s.geom, x: round2(s.geom.x + dx), y: round2(s.geom.y + dy) } } : s));
  const calibrate = () => {
    const target = parseFloat(calib.replace(",", "."));
    if (!one?.geom || !(target > 0)) return;
    const f = target / one.geom.w;
    const sc = (g: SpotGeom): SpotGeom => ({ ...g, x: round2(g.x * f), y: round2(g.y * f), w: round2(g.w * f), h: round2(g.h * f) });
    commit({ frame: { ...state.frame, width: round2(state.frame.width * f), height: round2(state.frame.height * f), background: bg ? { ...bg, x: round2(bg.x * f), y: round2(bg.y * f), w: round2(bg.w * f), h: round2(bg.h * f) } : null },
      spots: state.spots.map((s) => (s.geom ? { ...s, geom: sc(s.geom) } : s)) });
    setCalib("");
  };
  /** A drawn box takes over an unplaced register row: the row gets the box, the provisional spot disappears. */
  const bindTo = (newKey: string, spotId: string) => {
    const g = state.spots.find((s) => s.key === newKey)?.geom;
    if (!g) return;
    commit({ ...state, spots: state.spots.filter((s) => s.key !== newKey).map((s) => (s.id === spotId ? { ...s, geom: g } : s)) });
    setSel(new Set([spotId]));
  };

  const acceptDraft = (d: ParkingPlanDraft) => {
    const frame: ParkingPlanFrame = placed.length === 0 && d.width && d.height ? { units: "m", width: d.width, height: d.height, background: d.background ?? null } : state.frame;
    const spots = state.spots.map((s) => ({ ...s }));
    const taken = new Set(spots.map((s) => s.number));
    for (const ds of d.spots) {
      const bound = ds.spot_id ? spots.find((s) => s.id === ds.spot_id) : undefined;
      if (bound) { if (!bound.geom) bound.geom = { ...ds.geom }; continue; }
      const number = ds.label && !taken.has(ds.label) ? ds.label : nextNumber(spots);
      taken.add(number);
      spots.push({ key: `new:${++newSeq.current}`, id: null, number, zone: null, type: ds.type ?? "tavaline", reserve: false, out_of_service: false, status: null, space_id: null, contract: null, geom: { ...ds.geom } });
    }
    commit({ frame, spots });
    setClearDraft(true);
    toast.success(t("assets.parkingScheme.draftApplied", { n: d.spots.length }));
  };

  const doSave = async () => {
    const orig = new Map(plan.spots.map((s) => [s.id, s]));
    const body: ParkingPlanSave = { frame: state.frame, clear_draft: clearDraft, spots: [], new: [] };
    for (const s of state.spots) {
      if (!s.id) { if (s.geom) body.new!.push({ number: s.number.trim(), zone: s.zone, type: s.type, geom: s.geom, space_id: s.space_id }); continue; }
      const o = orig.get(s.id);
      const geomChanged = JSON.stringify(o?.geom ?? null) !== JSON.stringify(s.geom);
      const spaceChanged = (o?.space_id ?? null) !== s.space_id;
      if (geomChanged || spaceChanged) body.spots!.push({ id: s.id, geom: s.geom, ...(spaceChanged ? { space_id: s.space_id, set_space: true } : {}) });
    }
    try {
      const res = await save.mutateAsync(body);
      setDirty(false); setClearDraft(false); setPast([]); setFuture([]); setSel(new Set());
      setState(initState(res));
      toast.success(t("assets.parkingScheme.saved", { n: res.spots.filter((s) => s.geom).length }));
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const doDerive = async () => { try { await derive.mutateAsync(); toast.success(t("assets.parkingScheme.derived")); } catch (e) { toast.error(errorMessage(e)); } };
  const doDiscard = async () => { try { await discard.mutateAsync(); setClearDraft(false); } catch (e) { toast.error(errorMessage(e)); } };

  // ---- pointer interactions (coordinates in metres via the view) ----
  const pt = (e: RPointerEvent<SVGElement>) => view.current!.toMetres(e.clientX, e.clientY);
  const onSpotDown = (key: string, e: RPointerEvent<SVGElement>) => {
    if (tool === "pan" || e.button !== 0) return;
    const next = new Set(sel);
    if (e.shiftKey) { if (next.has(key)) next.delete(key); else next.add(key); }
    else if (!next.has(key)) { next.clear(); next.add(key); }
    setSel(next);
    const geoms: Record<string, SpotGeom> = {};
    for (const s of state.spots) if (next.has(s.key) && s.geom) geoms[s.key] = s.geom;
    drag.current = { kind: "move", start: pt(e), geoms, snapshot: state };
  };
  const onCanvasDown = (e: RPointerEvent<SVGSVGElement>) => {
    if (drag.current) return true; // a handle started the drag and let the event bubble here
    if (tool === "pan" || e.button !== 0) return false;
    const p = pt(e);
    if (tool === "draw") { drag.current = { kind: "draw", start: { x: snap(p.x, GRID), y: snap(p.y, GRID) } }; return true; }
    drag.current = { kind: "marquee", start: p, add: e.shiftKey };
    if (!e.shiftKey) setSel(new Set());
    return true;
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = pt(e);
    if (d.kind === "move") {
      const dx = snap(p.x - d.start.x, GRID), dy = snap(p.y - d.start.y, GRID);
      setState((s) => ({ ...s, spots: s.spots.map((sp) => (d.geoms[sp.key] ? { ...sp, geom: { ...d.geoms[sp.key], x: round2(d.geoms[sp.key].x + dx), y: round2(d.geoms[sp.key].y + dy) } } : sp)) }));
    } else if (d.kind === "resize") {
      setState((s) => ({ ...s, spots: s.spots.map((sp) => (sp.key === d.key && sp.geom ? { ...sp, geom: resizeFromCorner(d.snapshot.spots.find((x) => x.key === d.key)!.geom!, d.corner, p) } : sp)) }));
    } else if (d.kind === "rotate") {
      setState((s) => ({ ...s, spots: s.spots.map((sp) => (sp.key === d.key && sp.geom ? { ...sp, geom: rotateTowards(sp.geom, p) } : sp)) }));
    } else if (d.kind === "draw") {
      const x1 = snap(p.x, GRID), y1 = snap(p.y, GRID);
      setDrawing({ x: round2((d.start.x + x1) / 2), y: round2((d.start.y + y1) / 2), w: round2(Math.abs(x1 - d.start.x)), h: round2(Math.abs(y1 - d.start.y)), rot: 0 });
    } else if (d.kind === "marquee") {
      setMarquee({ x0: d.start.x, y0: d.start.y, x1: p.x, y1: p.y });
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "move" || d.kind === "resize" || d.kind === "rotate") {
      if (JSON.stringify(d.snapshot.spots) !== JSON.stringify(state.spots)) { setPast((p) => [...p.slice(-60), d.snapshot]); setFuture([]); setDirty(true); }
    } else if (d.kind === "draw") {
      const g = drawing && drawing.w >= MIN_SIZE && drawing.h >= MIN_SIZE ? drawing : { x: d.start.x, y: d.start.y, w: STANDARD.w, h: STANDARD.h, rot: 0 };
      setDrawing(null);
      addSpots([g], { type: "tavaline" });
    } else if (d.kind === "marquee") {
      if (marquee) {
        const xa = Math.min(marquee.x0, marquee.x1), xb = Math.max(marquee.x0, marquee.x1), ya = Math.min(marquee.y0, marquee.y1), yb = Math.max(marquee.y0, marquee.y1);
        const hit = state.spots.filter((s) => s.geom && s.geom.x >= xa && s.geom.x <= xb && s.geom.y >= ya && s.geom.y <= yb).map((s) => s.key);
        setSel(d.add ? new Set([...sel, ...hit]) : new Set(hit));
      }
      setMarquee(null);
    }
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (meta && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); return; }
    if (e.key === "Escape") { setSel(new Set()); setTool("select"); return; }
    if (e.key.toLowerCase() === "r" && sel.size) { rotateSelected(e.shiftKey ? -90 : 90); return; }
    if (e.key.toLowerCase() === "d" && sel.size) { e.preventDefault(); duplicateSelected(); return; }
    if (e.key.toLowerCase() === "v") { setTool("select"); return; }
    if (e.key.toLowerCase() === "b") { setTool("draw"); return; }
    const step = e.shiftKey ? 1 : GRID;
    if (e.key === "ArrowLeft") { e.preventDefault(); nudge(-step, 0); } else if (e.key === "ArrowRight") { e.preventDefault(); nudge(step, 0); }
    else if (e.key === "ArrowUp") { e.preventDefault(); nudge(0, -step); } else if (e.key === "ArrowDown") { e.preventDefault(); nudge(0, step); }
  };

  // ---- rendering ----
  const fillOf = (s: EditorSpot) => {
    if (mode === "status") return s.out_of_service ? STATUS_FILL["kasutusest väljas"] : STATUS_FILL[s.status ?? "vaba"] ?? NEUTRAL;
    return s.space_id && spaceIndex.has(s.space_id) ? spaceColor(spaceIndex.get(s.space_id)!) : NEUTRAL;
  };
  const viewSpots: ViewSpot[] = placed.map((s) => ({
    key: s.key, geom: s.geom!, label: s.number, fill: fillOf(s), selected: sel.has(s.key), dashed: s.reserve, crossed: s.out_of_service,
    dim: !!filter && s.space_id !== filter, title: `${s.number}${s.zone ? ` · ${s.zone}` : ""} · ${tEnum("assets.parkingReg.types", s.type)}${s.space_id ? ` · ${spaces.find((x) => x.id === s.space_id)?.name ?? ""}` : ""}`,
  }));
  const handleR = 0.35;
  const draft = plan.draft;
  const counts = new Map<string, number>();
  for (const s of state.spots) if (s.space_id) counts.set(s.space_id, (counts.get(s.space_id) ?? 0) + 1);

  return (
    <div className="grid gap-3" onKeyDown={onKey} tabIndex={0} style={{ outline: "none" }}>
      {draft && draft.status === "ready" && !clearDraft && (
        <div className="note primary flex-wrap items-center gap-2">
          <span className="font-semibold">{t("assets.parkingScheme.draftReady", { n: draft.spots.length, m: draft.matched ?? 0 })}</span>
          {draft.notes && <span className="text-sm text-muted">{draft.notes}</span>}
          <span className="ml-auto flex gap-2"><Button size="sm" variant="primary" onClick={() => acceptDraft(draft)}>{t("assets.parkingScheme.draftAccept")}</Button><Button size="sm" busy={discard.isPending} onClick={doDiscard}>{t("assets.parkingScheme.draftDiscard")}</Button></span>
        </div>
      )}
      {draft && draft.status === "failed" && (
        <div className="note warning flex-wrap items-center gap-2"><span>{t("assets.parkingScheme.draftFailed")} {draft.error}</span><span className="ml-auto flex gap-2"><Button size="sm" busy={derive.isPending} onClick={doDerive}>{t("assets.parkingScheme.derive")}</Button><Button size="sm" variant="text" busy={discard.isPending} onClick={doDiscard}>{t("assets.parkingScheme.draftDiscard")}</Button></span></div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="tabbar" role="tablist" aria-label={t("assets.parkingScheme.tool")}>
          <button type="button" role="tab" className={cx(tool === "select" && "active")} aria-selected={tool === "select"} onClick={() => setTool("select")} title="V">{t("assets.parkingScheme.toolSelect")}</button>
          <button type="button" role="tab" className={cx(tool === "draw" && "active")} aria-selected={tool === "draw"} onClick={() => setTool("draw")} title="B">{t("assets.parkingScheme.toolDraw")}</button>
          <button type="button" role="tab" className={cx(tool === "pan" && "active")} aria-selected={tool === "pan"} onClick={() => setTool("pan")}>{t("assets.parkingScheme.toolPan")}</button>
        </div>
        <Button size="sm" onClick={undo} disabled={!past.length} title="⌘Z">{t("assets.parkingScheme.undo")}</Button>
        <Button size="sm" onClick={redo} disabled={!future.length} title="⇧⌘Z">{t("assets.parkingScheme.redo")}</Button>
        <Button size="sm" onClick={() => view.current?.fit()}>{t("assets.parkingScheme.fit")}</Button>
        <Button size="sm" onClick={() => view.current?.zoomBy(1.25)} aria-label="+">+</Button>
        <Button size="sm" onClick={() => view.current?.zoomBy(0.8)} aria-label="−">−</Button>
        <div className="tabbar" role="tablist" aria-label={t("assets.parkingScheme.colour")}>
          <button type="button" role="tab" className={cx(mode === "space" && "active")} aria-selected={mode === "space"} onClick={() => setMode("space")}>{t("assets.parkingScheme.bySpace")}</button>
          <button type="button" role="tab" className={cx(mode === "status" && "active")} aria-selected={mode === "status"} onClick={() => setMode("status")}>{t("assets.parkingScheme.byStatus")}</button>
        </div>
        <span className="ml-auto flex gap-2 items-center">
          {plan.plan_attachment && <Button size="sm" busy={derive.isPending} onClick={doDerive} title={plan.plan_attachment.filename}>{t("assets.parkingScheme.derive")}</Button>}
          <Button size="sm" variant="primary" busy={save.isPending} disabled={!dirty && !clearDraft} onClick={doSave}>{t("assets.parkingScheme.save")}{dirty ? " •" : ""}</Button>
        </span>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="card overflow-hidden" style={{ height: "min(70vh, 720px)" }}>
          <ParkingPlanView ref={view} frame={state.frame} spots={viewSpots} backgroundUrl={showBg ? bgUrl : null} backgroundOpacity={bg?.opacity ?? 0.6} cursor={tool === "draw" ? "crosshair" : tool === "pan" ? "grab" : "default"}
            onSpotPointerDown={onSpotDown} onCanvasPointerDown={onCanvasDown} onPointerMove={onMove} onPointerUp={onUp}>
            {one?.geom && (() => {
              const g = one.geom; const cs = corners(g); const top = { x: (cs[0].x + cs[1].x) / 2, y: (cs[0].y + cs[1].y) / 2 };
              const a = ((g.rot - 90) * Math.PI) / 180; const rh = { x: top.x + Math.cos(a) * 1.2, y: top.y + Math.sin(a) * 1.2 };
              return (
                <g>
                  <line x1={top.x} y1={top.y} x2={rh.x} y2={rh.y} stroke="var(--color-primary)" strokeWidth={0.06} />
                  <circle cx={rh.x} cy={rh.y} r={handleR} fill="#fff" stroke="var(--color-primary)" strokeWidth={0.08} style={{ cursor: "grab" }}
                    onPointerDown={(e) => { if (e.button === 0) drag.current = { kind: "rotate", key: one.key, snapshot: state }; }} />
                  {cs.map((c, i) => <rect key={i} x={c.x - handleR / 2} y={c.y - handleR / 2} width={handleR} height={handleR} fill="#fff" stroke="var(--color-primary)" strokeWidth={0.08} style={{ cursor: "nwse-resize" }}
                    onPointerDown={(e) => { if (e.button === 0) drag.current = { kind: "resize", key: one.key, corner: i, snapshot: state }; }} />)}
                </g>
              );
            })()}
            {drawing && <rect x={drawing.x - drawing.w / 2} y={drawing.y - drawing.h / 2} width={drawing.w} height={drawing.h} fill="var(--color-primary-ring)" stroke="var(--color-primary)" strokeWidth={0.08} strokeDasharray="0.3 0.2" pointerEvents="none" />}
            {marquee && <rect x={Math.min(marquee.x0, marquee.x1)} y={Math.min(marquee.y0, marquee.y1)} width={Math.abs(marquee.x1 - marquee.x0)} height={Math.abs(marquee.y1 - marquee.y0)} fill="var(--color-primary-ring)" stroke="var(--color-primary)" strokeWidth={0.05} pointerEvents="none" />}
          </ParkingPlanView>
        </div>
        <div className="grid gap-3 content-start">
          {selected.length > 0 ? (
            <div className="card pad grid gap-2">
              <div className="flex items-center gap-2"><h3 className="text-sm">{one ? `${t("assets.parkingReg.number")} ${one.number}` : t("assets.parkingReg.selected", { n: selected.length })}</h3>{one && !one.id && <Pill tone="warning">{t("assets.parkingScheme.newSpot")}</Pill>}{one?.status && <Pill tone={one.out_of_service ? "error" : one.status === "üüritud" ? "success" : "primary"}>{tEnum("assets.parkingReg.statuses", one.status)}</Pill>}</div>
              {one && !one.id && (
                <>
                  <div className="field"><label htmlFor="pp-number">{t("assets.parkingReg.number")}</label><input id="pp-number" className="fld fld-sm" value={one.number} onChange={(e) => patchSpots(sel, (s) => ({ ...s, number: e.target.value }))} /></div>
                  {unplaced.length > 0 && (
                    <div className="field"><label htmlFor="pp-bind">{t("assets.parkingScheme.bind")}</label>
                      <select id="pp-bind" className="fld fld-sm" value="" onChange={(e) => { if (e.target.value) bindTo(one.key, e.target.value); }}>
                        <option value="">{t("assets.parkingScheme.bindHint")}</option>{unplaced.map((s) => <option key={s.id} value={s.id!}>{s.number}{s.zone ? ` · ${s.zone}` : ""}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
              {one && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="field"><label htmlFor="pp-type">{t("assets.parkingReg.type")}</label><select id="pp-type" className="fld fld-sm" value={one.type} disabled={!!one.id} onChange={(e) => patchSpots(sel, (s) => ({ ...s, type: e.target.value as SpotType }))}>{TYPES.map((v) => <option key={v} value={v}>{tEnum("assets.parkingReg.types", v)}</option>)}</select></div>
                  <div className="field"><label htmlFor="pp-zone">{t("assets.parkingReg.zone")}</label><input id="pp-zone" className="fld fld-sm" value={one.zone ?? ""} disabled={!!one.id} onChange={(e) => patchSpots(sel, (s) => ({ ...s, zone: e.target.value || null }))} /></div>
                </div>
              )}
              <div className="field"><label htmlFor="pp-space">{t("assets.parkingReg.space")}</label>
                <select id="pp-space" className="fld fld-sm" value={one ? one.space_id ?? "" : selected.every((s) => s.space_id === selected[0].space_id) ? selected[0].space_id ?? "" : "__mixed"} onChange={(e) => { const v = e.target.value; if (v !== "__mixed") patchSpots(sel, (s) => ({ ...s, space_id: v || null })); }}>
                  <option value="">{t("assets.parkingReg.noSpace")}</option>{!one && <option value="__mixed" disabled>—</option>}{spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {one?.geom && (
                <div className="text-xs text-muted tabular-nums">{one.geom.w} × {one.geom.h} m · {one.geom.rot}°</div>
              )}
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" onClick={() => rotateSelected(90)} title="R">{t("assets.parkingScheme.rotate")}</Button>
                <Button size="sm" onClick={duplicateSelected} title="D">{t("assets.parkingScheme.duplicate")}</Button>
                <Button size="sm" variant="text" className="btn-destructive" onClick={removeSelected} title="⌫">{t("assets.parkingScheme.remove")}</Button>
              </div>
              {one?.geom && (
                <>
                  <div className="flex gap-2 items-end">
                    <div className="field grow"><label htmlFor="pp-row">{t("assets.parkingScheme.rowCount")}</label><input id="pp-row" className="fld fld-sm" inputMode="numeric" value={rowN} onChange={(e) => setRowN(e.target.value)} /></div>
                    <Button size="sm" onClick={fillRow}>{t("assets.parkingScheme.rowFill")}</Button>
                  </div>
                  <div className="flex gap-2 items-end">
                    <div className="field grow"><label htmlFor="pp-cal">{t("assets.parkingScheme.calibrate")}</label><input id="pp-cal" className="fld fld-sm" inputMode="decimal" placeholder={String(STANDARD.w)} value={calib} onChange={(e) => setCalib(e.target.value)} /></div>
                    <Button size="sm" onClick={calibrate} disabled={!calib}>{t("assets.parkingScheme.calibrateApply")}</Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="card pad grid gap-2 text-sm text-muted">
              <p>{t("assets.parkingScheme.hint")}</p>
              <p className="text-xs">{t("assets.parkingScheme.keys")}</p>
            </div>
          )}
          <div className="card pad grid gap-2">
            <h3 className="text-sm flex items-center gap-2">{t("assets.parkingScheme.unplaced")}<Pill>{unplaced.length}</Pill></h3>
            {unplaced.length === 0 ? <p className="text-xs text-muted">{t("assets.parkingScheme.allPlaced")}</p>
              : <div className="flex flex-wrap gap-1 max-h-40 overflow-auto">{unplaced.map((s) => <button key={s.key} type="button" className="pill cursor-pointer" onClick={() => placeSpot(s.key)} title={t("assets.parkingScheme.placeHint")}>{s.number}{s.zone ? ` · ${s.zone}` : ""}</button>)}</div>}
          </div>
          <div className="card pad grid gap-2">
            <h3 className="text-sm">{t("assets.parkingScheme.legend")}</h3>
            <ul className="grid gap-1 text-sm max-h-56 overflow-auto">
              {spaces.map((s, i) => (
                <li key={s.id}><button type="button" className={cx("flex items-center gap-2 w-full text-left rounded px-1", filter === s.id && "bg-[var(--color-primary-subtle)]")} onClick={() => setFilter(filter === s.id ? null : s.id)}>
                  <span className="inline-block w-3 h-3 rounded-sm flex-none" style={{ background: spaceColor(i) }} /><span className="truncate">{s.name}</span><span className="ml-auto tabular-nums text-muted">{counts.get(s.id) ?? 0}</span></button></li>
              ))}
              <li className="flex items-center gap-2 px-1"><span className="inline-block w-3 h-3 rounded-sm flex-none" style={{ background: NEUTRAL }} /><span>{t("assets.parkingReg.withoutSpace")}</span><span className="ml-auto tabular-nums text-muted">{state.spots.filter((s) => !s.space_id).length}</span></li>
            </ul>
          </div>
          <div className="card pad grid gap-2">
            <h3 className="text-sm">{t("assets.parkingScheme.frame")}</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="field"><label htmlFor="pp-w">{t("assets.parkingScheme.width")}</label><input id="pp-w" className="fld fld-sm" inputMode="decimal" value={state.frame.width} onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) commit({ ...state, frame: { ...state.frame, width: v } }); }} /></div>
              <div className="field"><label htmlFor="pp-h">{t("assets.parkingScheme.height")}</label><input id="pp-h" className="fld fld-sm" inputMode="decimal" value={state.frame.height} onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) commit({ ...state, frame: { ...state.frame, height: v } }); }} /></div>
            </div>
            {bg ? (
              <>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showBg} onChange={(e) => setShowBg(e.target.checked)} />{t("assets.parkingScheme.background")}{plan.plan_attachment ? ` · ${plan.plan_attachment.filename}` : ""}</label>
                <label className="grid gap-1 text-xs text-muted">{t("assets.parkingScheme.opacity")}<input type="range" min={0.1} max={1} step={0.05} value={bg.opacity ?? 0.6} onChange={(e) => commit({ ...state, frame: { ...state.frame, background: { ...bg, opacity: parseFloat(e.target.value) } } })} /></label>
              </>
            ) : <p className="text-xs text-muted">{t("assets.parkingScheme.noBackground")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Read-only schematic with a set of spots highlighted (a space's spots, a lease's spots). Renders nothing until boxes exist. */
export function ParkingPlanPreview({ plan, spaces, highlight, minHeight = 260 }: { plan: ParkingPlan; spaces: { id: string; name: string }[]; highlight: Set<string>; minHeight?: number }) {
  const frame = plan.frame;
  const placed = plan.spots.filter((s) => s.geom);
  if (!frame || placed.length === 0) return null;
  const idx = new Map(spaces.map((s, i) => [s.id, i]));
  const spots: ViewSpot[] = placed.map((s) => ({ key: s.id, geom: s.geom!, label: s.number, fill: s.space_id && idx.has(s.space_id) ? spaceColor(idx.get(s.space_id)!) : NEUTRAL, highlighted: highlight.has(s.id), dim: highlight.size > 0 && !highlight.has(s.id), dashed: s.reserve, crossed: s.out_of_service }));
  const bgUrl = frame.background ? `${API_BASE}/assets/${plan.property_id}/parking/plan/background` : null;
  return <div style={{ height: minHeight }}><ParkingPlanView frame={frame} spots={spots} backgroundUrl={bgUrl} backgroundOpacity={frame.background?.opacity ?? 0.6} minHeight={minHeight} /></div>;
}
