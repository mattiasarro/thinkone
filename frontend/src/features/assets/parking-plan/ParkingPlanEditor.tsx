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
import type { AssetDetail, ParkingLot, ParkingPlan, ParkingPlanDraft, ParkingPlanSave, SpotGeom, SpotType } from "@/types/api";
import { ParkingPlanView, type ViewHandle, type ViewSpot } from "./ParkingPlanView";
import { DEFAULT_FRAME, DEFAULT_M_PER_PX, GRID, MIN_SIZE, NEUTRAL, STANDARD, corners, fromPlanSpot, newLotId, nextNumber, normRot, resizeFromCorner, rotateTowards, round2, rowAfter, snap, spaceColor, type EditorSpot, type EditorState } from "./model";

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

const bgUrlOf = (propertyId: string, lot: ParkingLot | undefined) => (lot?.background ? `${API_BASE}/assets/${propertyId}/parking/plan/background?attachment_id=${lot.background.attachment_id}` : null);
const cloneLot = (l: ParkingLot): ParkingLot => ({ ...l, background: l.background ? { ...l.background } : null });
function initState(plan: ParkingPlan): EditorState {
  return { lots: plan.lots.map(cloneLot), spots: plan.spots.map(fromPlanSpot) };
}

function Editor({ property, plan }: { property: AssetDetail; plan: ParkingPlan }) {
  const save = useSaveParkingPlan(property.id);
  const derive = useDeriveParkingPlan(property.id);
  const discard = useDiscardParkingDraft(property.id);
  const toast = useToast();
  const view = useRef<ViewHandle>(null);
  const spaces = useMemo(() => property.children.filter((c) => c.type_code === "space" && c.status !== "jagatud" && c.status !== "mitteaktiivne"), [property.children]);
  const spaceIndex = useMemo(() => new Map(spaces.map((s, i) => [s.id, i])), [spaces]);

  const [state, setState] = useState<EditorState>(() => initState(plan));
  const [past, setPast] = useState<EditorState[]>([]);
  const [future, setFuture] = useState<EditorState[]>([]);
  const [dirty, setDirty] = useState(false);
  const [clearDraft, setClearDraft] = useState(false);
  const [activeLot, setActiveLot] = useState<string | null>(plan.lots[0]?.id ?? null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [hoverSpace, setHoverSpace] = useState<string | null>(null);
  const [hoverSpot, setHoverSpot] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("select");
  const [mode, setMode] = useState<"space" | "status">("space");
  const [filter, setFilter] = useState<string | null>(null);
  const [showBg, setShowBg] = useState(true);
  const [rowN, setRowN] = useState("5");
  const [calib, setCalib] = useState("");
  const [newLotName, setNewLotName] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<SpotGeom | null>(null);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const drag = useRef<Drag | null>(null);
  const newSeq = useRef(0);

  // The server's copy wins while nothing is edited (a register change in the other tab, the draft arriving).
  useEffect(() => { if (!dirty) { setState(initState(plan)); setPast([]); setFuture([]); } }, [plan, dirty]);
  useEffect(() => { if (!activeLot || !state.lots.some((l) => l.id === activeLot)) setActiveLot(state.lots[0]?.id ?? null); }, [state.lots, activeLot]);

  const lot = state.lots.find((l) => l.id === activeLot);
  const frame = lot ?? DEFAULT_FRAME;
  const bg = lot?.background ?? null;
  const bgUrl = bgUrlOf(property.id, lot);
  const firstLot = state.lots[0]?.id;
  const lotOf = (s: EditorSpot) => (s.geom ? s.geom.lot ?? firstLot : null);

  const commit = useCallback((next: EditorState, from?: EditorState) => {
    setPast((p) => [...p.slice(-60), from ?? state]);
    setFuture([]);
    setState(next);
    setDirty(true);
  }, [state]);
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setPast((p) => p.slice(0, -1)); setFuture((f) => [state, ...f]); setState(prev); setDirty(true); };
  const redo = () => { const next = future[0]; if (!next) return; setFuture((f) => f.slice(1)); setPast((p) => [...p, state]); setState(next); setDirty(true); };

  const onLot = (s: EditorSpot) => lotOf(s) === activeLot;
  const selected = state.spots.filter((s) => sel.has(s.key));
  const one = selected.length === 1 ? selected[0] : null;
  const placed = state.spots.filter(onLot);
  const unplaced = state.spots.filter((s) => !s.geom && s.id);

  // ---- lots ----
  const patchLot = (id: string, patch: Partial<ParkingLot>) => commit({ ...state, lots: state.lots.map((l) => (l.id === id ? { ...l, ...patch } : l)) });
  const addLot = (name: string) => {
    const l: ParkingLot = { id: newLotId(), name: name.trim() || t("assets.parkingScheme.lotDefault"), units: "m", width: DEFAULT_FRAME.width, height: DEFAULT_FRAME.height, background: null };
    commit({ ...state, lots: [...state.lots, l] });
    setActiveLot(l.id);
    setSel(new Set());
  };
  const removeLot = (id: string) => {
    const n = state.spots.filter((s) => lotOf(s) === id).length;
    if (!confirm(t("assets.parkingScheme.lotRemoveConfirm", { n }))) return;
    commit({ lots: state.lots.filter((l) => l.id !== id), spots: state.spots.filter((s) => !(lotOf(s) === id && !s.id)).map((s) => (lotOf(s) === id ? { ...s, geom: null } : s)) });
    setSel(new Set());
  };
  /** Picking a plan as a lot's background: the image's pixel size sets a provisional scale (5 cm per pixel) on an empty lot. */
  const setBackground = (lotId: string, attachmentId: string | null) => {
    if (!attachmentId) { patchLot(lotId, { background: null }); return; }
    const target = state.lots.find((l) => l.id === lotId)!;
    const empty = !state.spots.some((s) => lotOf(s) === lotId);
    const snapshot = state;
    const img = new Image();
    img.onload = () => {
      const w = round2(img.naturalWidth * DEFAULT_M_PER_PX), h = round2(img.naturalHeight * DEFAULT_M_PER_PX);
      const bw = empty ? w : target.width, bh = empty ? h : target.height;
      setPast((p) => [...p.slice(-60), snapshot]); setFuture([]); setDirty(true);
      setState((s) => ({ ...s, lots: s.lots.map((l) => (l.id === lotId ? { ...l, ...(empty ? { width: w, height: h } : {}), background: { attachment_id: attachmentId, x: 0, y: 0, w: bw, h: bh, opacity: 0.6 } } : l)) }));
    };
    img.src = `${API_BASE}/assets/${property.id}/parking/plan/background?attachment_id=${attachmentId}`;
  };

  // ---- spots ----
  const patchSpots = (keys: Set<string>, fn: (s: EditorSpot) => EditorSpot) => commit({ ...state, spots: state.spots.map((s) => (keys.has(s.key) ? fn(s) : s)) });
  const withLot = (g: SpotGeom): SpotGeom => ({ ...g, lot: activeLot });
  const addSpots = (geoms: SpotGeom[], base?: Partial<EditorSpot>, select = true) => {
    const spots = [...state.spots];
    const keys: string[] = [];
    for (const g of geoms) {
      const key = `new:${++newSeq.current}`;
      keys.push(key);
      spots.push({ key, id: null, number: nextNumber(spots), zone: base?.zone ?? null, type: base?.type ?? "tavaline", reserve: false, out_of_service: false, status: null, space_id: base?.space_id ?? null, contract: null, geom: withLot(g) });
    }
    commit({ ...state, spots });
    if (select) setSel(new Set(keys));
  };
  const placeSpot = (key: string) => {
    const c = view.current?.centre() ?? { x: frame.width / 2, y: frame.height / 2 };
    const n = placed.length;
    const g: SpotGeom = withLot({ x: snap(c.x + (n % 6) * STANDARD.w, GRID), y: snap(c.y, GRID), w: STANDARD.w, h: STANDARD.h, rot: one?.geom?.rot ?? 0 });
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
    if (!one?.geom || !lot || !(target > 0)) return;
    const f = target / one.geom.w;
    const sc = (g: SpotGeom): SpotGeom => ({ ...g, x: round2(g.x * f), y: round2(g.y * f), w: round2(g.w * f), h: round2(g.h * f) });
    commit({ lots: state.lots.map((l) => (l.id === lot.id ? { ...l, width: round2(l.width * f), height: round2(l.height * f), background: l.background ? { ...l.background, x: round2(l.background.x * f), y: round2(l.background.y * f), w: round2(l.background.w * f), h: round2(l.background.h * f) } : null } : l)),
      spots: state.spots.map((s) => (onLot(s) ? { ...s, geom: sc(s.geom!) } : s)) });
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
    const dl = d.lot && "width" in d.lot ? (d.lot as ParkingLot) : null;
    let lots = state.lots.map(cloneLot);
    const lotId = dl?.id ?? activeLot ?? newLotId();
    const existing = lots.find((l) => l.id === lotId);
    const lotEmpty = !state.spots.some((s) => lotOf(s) === lotId);
    if (!existing) lots = [...lots, { id: lotId, name: dl?.name ?? t("assets.parkingScheme.lotDefault"), units: "m", width: dl?.width ?? DEFAULT_FRAME.width, height: dl?.height ?? DEFAULT_FRAME.height, background: dl?.background ?? null }];
    else if (lotEmpty && dl) lots = lots.map((l) => (l.id === lotId ? { ...l, width: dl.width, height: dl.height, background: dl.background ?? l.background ?? null } : l));
    const spots = state.spots.map((s) => ({ ...s }));
    const taken = new Set(spots.map((s) => s.number));
    for (const ds of d.spots) {
      const geom = { ...ds.geom, lot: lotId };
      const bound = ds.spot_id ? spots.find((s) => s.id === ds.spot_id) : undefined;
      if (bound) { if (!bound.geom) bound.geom = geom; continue; }
      const number = ds.label && !taken.has(ds.label) ? ds.label : nextNumber(spots);
      taken.add(number);
      spots.push({ key: `new:${++newSeq.current}`, id: null, number, zone: null, type: ds.type ?? "tavaline", reserve: false, out_of_service: false, status: null, space_id: null, contract: null, geom });
    }
    commit({ lots, spots });
    setActiveLot(lotId);
    setClearDraft(true);
    toast.success(t("assets.parkingScheme.draftApplied", { n: d.spots.length }));
  };

  const doSave = async () => {
    const orig = new Map(plan.spots.map((s) => [s.id, s]));
    const body: ParkingPlanSave = { lots: state.lots, clear_draft: clearDraft, spots: [], new: [] };
    const norm = (g: SpotGeom | null) => (g ? { ...g, lot: g.lot ?? firstLot ?? null } : null);
    for (const s of state.spots) {
      if (!s.id) { if (s.geom) body.new!.push({ number: s.number.trim(), zone: s.zone, type: s.type, geom: norm(s.geom)!, space_id: s.space_id }); continue; }
      const o = orig.get(s.id);
      const geomChanged = JSON.stringify(norm(o?.geom ?? null)) !== JSON.stringify(norm(s.geom));
      const spaceChanged = (o?.space_id ?? null) !== s.space_id;
      if (geomChanged || spaceChanged) body.spots!.push({ id: s.id, geom: norm(s.geom), ...(spaceChanged ? { space_id: s.space_id, set_space: true } : {}) });
    }
    try {
      const res = await save.mutateAsync(body);
      setDirty(false); setClearDraft(false); setPast([]); setFuture([]); setSel(new Set());
      setState(initState(res));
      toast.success(t("assets.parkingScheme.saved", { n: res.spots.filter((s) => s.geom).length }));
    } catch (e) { toast.error(errorMessage(e)); }
  };
  /** Read a plan with the model: the active lot's own background, or a named file (into the lot using it, else a new lot). */
  const doDerive = async (attachmentId?: string) => {
    const aid = attachmentId ?? lot?.background?.attachment_id ?? null;
    const target = aid ? state.lots.find((l) => l.background?.attachment_id === aid) : lot;
    try { await derive.mutateAsync({ attachment_id: aid, lot_id: target?.id ?? null }); toast.success(t("assets.parkingScheme.derived")); }
    catch (e) { toast.error(errorMessage(e)); }
  };
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
    if (tool === "pan" || e.button !== 0 || !lot) return false;
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
        const hit = placed.filter((s) => s.geom!.x >= xa && s.geom!.x <= xb && s.geom!.y >= ya && s.geom!.y <= yb).map((s) => s.key);
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
    if (e.key.toLowerCase() === "r" && sel.size) { rotateSelected(e.shiftKey ? 45 : 90); return; }
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
  // Hovering a legend row lights its boxes; hovering a box lights its legend row.
  const hoverSpaceId = hoverSpace ?? (hoverSpot ? state.spots.find((s) => s.key === hoverSpot)?.space_id ?? null : null);
  const viewSpots: ViewSpot[] = placed.map((s) => ({
    key: s.key, geom: s.geom!, label: s.number, fill: fillOf(s), selected: sel.has(s.key), dashed: s.reserve, crossed: s.out_of_service,
    highlighted: !!hoverSpace && s.space_id === hoverSpace, dim: (!!filter && s.space_id !== filter) || (!!hoverSpace && s.space_id !== hoverSpace),
    title: `${s.number}${s.zone ? ` · ${s.zone}` : ""} · ${tEnum("assets.parkingReg.types", s.type)}${s.space_id ? ` · ${spaces.find((x) => x.id === s.space_id)?.name ?? ""}` : ""}`,
  }));
  const handleR = 0.35;
  const draft = plan.draft;
  const draftLotName = draft?.lot ? (state.lots.find((l) => l.id === draft.lot!.id)?.name ?? draft.lot.name) : "";
  const counts = new Map<string, number>();
  for (const s of state.spots) if (s.space_id) counts.set(s.space_id, (counts.get(s.space_id) ?? 0) + 1);
  const perLot = (id: string) => state.spots.filter((s) => lotOf(s) === id).length;

  return (
    <div className="grid gap-3" onKeyDown={onKey} tabIndex={0} style={{ outline: "none" }}>
      {draft && draft.status === "ready" && !clearDraft && (
        <div className="note primary flex-wrap items-center gap-2">
          <span className="font-semibold">{t("assets.parkingScheme.draftReady", { n: draft.spots.length, m: draft.matched ?? 0, lot: draftLotName })}</span>
          {draft.notes && <span className="text-sm text-muted">{draft.notes}</span>}
          <span className="ml-auto flex gap-2"><Button size="sm" variant="primary" onClick={() => acceptDraft(draft)}>{t("assets.parkingScheme.draftAccept")}</Button><Button size="sm" busy={discard.isPending} onClick={doDiscard}>{t("assets.parkingScheme.draftDiscard")}</Button></span>
        </div>
      )}
      {draft && draft.status === "failed" && (
        <div className="note warning flex-wrap items-center gap-2"><span>{t("assets.parkingScheme.draftFailed")} {draft.error}</span><span className="ml-auto flex gap-2"><Button size="sm" busy={derive.isPending} onClick={() => doDerive()}>{t("assets.parkingScheme.derive")}</Button><Button size="sm" variant="text" busy={discard.isPending} onClick={doDiscard}>{t("assets.parkingScheme.draftDiscard")}</Button></span></div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="tabbar" role="tablist" aria-label={t("assets.parkingScheme.lots")}>
          {state.lots.map((l) => <button key={l.id} type="button" role="tab" className={cx(l.id === activeLot && "active")} aria-selected={l.id === activeLot} onClick={() => { setActiveLot(l.id); setSel(new Set()); }}>{l.name}<span className="ml-2 opacity-70 tabular-nums">{perLot(l.id)}</span></button>)}
        </div>
        {newLotName === null ? <Button size="sm" variant="text" onClick={() => setNewLotName("")}>+ {t("assets.parkingScheme.lotAdd")}</Button>
          : <form className="flex gap-1 items-center" onSubmit={(e) => { e.preventDefault(); addLot(newLotName); setNewLotName(null); }}>
            <input className="fld fld-sm w-40" autoFocus aria-label={t("assets.parkingScheme.lotName")} placeholder={t("assets.parkingScheme.lotName")} value={newLotName} onChange={(e) => setNewLotName(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") setNewLotName(null); }} />
            <Button size="sm" type="submit" variant="primary">{t("common.add")}</Button><Button size="sm" variant="text" onClick={() => setNewLotName(null)}>{t("common.cancel")}</Button>
          </form>}
        <span className="ml-auto flex gap-2 items-center">
          <Button size="sm" variant="primary" busy={save.isPending} disabled={!dirty && !clearDraft} onClick={doSave}>{t("assets.parkingScheme.save")}{dirty ? " •" : ""}</Button>
        </span>
      </div>
      {lot ? (
        <>
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
            {lot.background && <Button size="sm" className="ml-auto" busy={derive.isPending} onClick={() => doDerive()}>{t("assets.parkingScheme.derive")}</Button>}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
            <div className="card overflow-hidden" style={{ height: "min(70vh, 720px)" }}>
              <ParkingPlanView key={lot.id} ref={view} frame={frame} spots={viewSpots} backgroundUrl={showBg ? bgUrl : null} backgroundOpacity={bg?.opacity ?? 0.6} cursor={tool === "draw" ? "crosshair" : tool === "pan" ? "grab" : "default"}
                onSpotPointerDown={onSpotDown} onSpotHover={setHoverSpot} onCanvasPointerDown={onCanvasDown} onPointerMove={onMove} onPointerUp={onUp}>
                {one?.geom && onLot(one) && (() => {
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
                  {one?.geom && <div className="text-xs text-muted tabular-nums">{one.geom.w} × {one.geom.h} m · {one.geom.rot}°</div>}
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => rotateSelected(45)} title="⇧R">{t("assets.parkingScheme.rotate45")}</Button>
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
                    <li key={s.id}><button type="button" className={cx("flex items-center gap-2 w-full text-left rounded px-1 transition-colors", (filter === s.id || hoverSpaceId === s.id) && "bg-[var(--color-primary-subtle)]")}
                      onClick={() => setFilter(filter === s.id ? null : s.id)} onPointerEnter={() => setHoverSpace(s.id)} onPointerLeave={() => setHoverSpace(null)}>
                      <span className="inline-block w-3 h-3 rounded-sm flex-none" style={{ background: spaceColor(i) }} /><span className="truncate">{s.name}</span><span className="ml-auto tabular-nums text-muted">{counts.get(s.id) ?? 0}</span></button></li>
                  ))}
                  <li className="flex items-center gap-2 px-1"><span className="inline-block w-3 h-3 rounded-sm flex-none" style={{ background: NEUTRAL }} /><span>{t("assets.parkingReg.withoutSpace")}</span><span className="ml-auto tabular-nums text-muted">{state.spots.filter((s) => !s.space_id).length}</span></li>
                </ul>
              </div>
              <div className="card pad grid gap-2">
                <h3 className="text-sm">{t("assets.parkingScheme.lot")}</h3>
                <div className="field"><label htmlFor="pp-lot-name">{t("assets.parkingScheme.lotName")}</label><input id="pp-lot-name" className="fld fld-sm" value={lot.name} onChange={(e) => patchLot(lot.id, { name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="field"><label htmlFor="pp-w">{t("assets.parkingScheme.width")}</label><input id="pp-w" className="fld fld-sm" inputMode="decimal" value={lot.width} onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) patchLot(lot.id, { width: v }); }} /></div>
                  <div className="field"><label htmlFor="pp-h">{t("assets.parkingScheme.height")}</label><input id="pp-h" className="fld fld-sm" inputMode="decimal" value={lot.height} onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0) patchLot(lot.id, { height: v }); }} /></div>
                </div>
                <div className="field"><label htmlFor="pp-bg">{t("assets.parkingScheme.background")}</label>
                  <select id="pp-bg" className="fld fld-sm" value={bg?.attachment_id ?? ""} onChange={(e) => setBackground(lot.id, e.target.value || null)}>
                    <option value="">{t("assets.parkingScheme.noBackgroundOpt")}</option>{plan.plan_attachments.map((a) => <option key={a.id} value={a.id}>{a.filename}</option>)}
                  </select>
                  {plan.plan_attachments.length === 0 && <p className="text-xs text-muted mt-1">{t("assets.parkingScheme.noBackground")}</p>}
                </div>
                {bg && (
                  <>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showBg} onChange={(e) => setShowBg(e.target.checked)} />{t("assets.parkingScheme.showBackground")}</label>
                    <label className="grid gap-1 text-xs text-muted">{t("assets.parkingScheme.opacity")}<input type="range" min={0.1} max={1} step={0.05} value={bg.opacity ?? 0.6} onChange={(e) => patchLot(lot.id, { background: { ...bg, opacity: parseFloat(e.target.value) } })} /></label>
                  </>
                )}
                <Button size="sm" variant="text" className="btn-destructive w-fit" onClick={() => removeLot(lot.id)}>{t("assets.parkingScheme.lotRemove")}</Button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="card pad grid gap-3 text-sm text-muted">
          <p>{t("assets.parkingScheme.noLots")}</p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="primary" onClick={() => setNewLotName("")}>+ {t("assets.parkingScheme.lotAdd")}</Button>
            {plan.plan_attachments.map((a) => <Button key={a.id} busy={derive.isPending} onClick={() => doDerive(a.id)}>{t("assets.parkingScheme.deriveFrom", { file: a.filename })}</Button>)}
          </div>
        </div>
      )}
    </div>
  );
}

/** Read-only schematic(s) with a set of spots highlighted (a space's spots, a lease's spots): every lot that holds one of
 *  them, or the first lot when none does. Renders nothing until boxes exist. */
export function ParkingPlanPreview({ plan, spaces, highlight, minHeight = 260 }: { plan: ParkingPlan; spaces: { id: string; name: string }[]; highlight: Set<string>; minHeight?: number }) {
  const placed = plan.spots.filter((s) => s.geom);
  if (plan.lots.length === 0 || placed.length === 0) return null;
  const first = plan.lots[0].id;
  const lotOf = (g: SpotGeom) => g.lot ?? first;
  const idx = new Map(spaces.map((s, i) => [s.id, i]));
  const shown = plan.lots.filter((l) => placed.some((s) => highlight.has(s.id) && lotOf(s.geom!) === l.id));
  const lots = shown.length ? shown : [plan.lots[0]];
  return (
    <div className="grid gap-2">
      {lots.map((l) => {
        const spots: ViewSpot[] = placed.filter((s) => lotOf(s.geom!) === l.id).map((s) => ({ key: s.id, geom: s.geom!, label: s.number, fill: s.space_id && idx.has(s.space_id) ? spaceColor(idx.get(s.space_id)!) : NEUTRAL, highlighted: highlight.has(s.id), dim: highlight.size > 0 && !highlight.has(s.id), dashed: s.reserve, crossed: s.out_of_service }));
        return (
          <div key={l.id} className="grid gap-1">
            {plan.lots.length > 1 && <div className="text-xs font-semibold text-muted">{l.name}</div>}
            <div style={{ height: minHeight }}><ParkingPlanView frame={l} spots={spots} backgroundUrl={bgUrlOf(plan.property_id, l)} backgroundOpacity={l.background?.opacity ?? 0.6} minHeight={minHeight} /></div>
          </div>
        );
      })}
    </div>
  );
}
