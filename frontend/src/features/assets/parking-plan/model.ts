import type { ParkingPlanFrame, PlanSpot, SpotGeom, SpotType, UUID } from "@/types/api";

/** The schematic is data in metres: each register spot may carry one box (centre x,y · size w,h · rot° clockwise).
 *  The editor works on this state and both it and the read-only view render the same JSON. */
export interface EditorSpot {
  key: string; // register id, or "new:<n>" for a box drawn before it has a register row
  id: UUID | null;
  number: string;
  zone: string | null;
  type: SpotType;
  reserve: boolean;
  out_of_service: boolean;
  status: PlanSpot["status"];
  space_id: UUID | null;
  contract: PlanSpot["contract"];
  geom: SpotGeom | null;
}

export interface EditorState { frame: ParkingPlanFrame; spots: EditorSpot[] }

export const STANDARD = { w: 2.5, h: 5 };
export const GRID = 0.25; // metres: move/draw snap
export const SIZE_STEP = 0.1;
export const ROT_STEP = 5;
export const MIN_SIZE = 0.5;
export const DEFAULT_FRAME: ParkingPlanFrame = { units: "m", width: 60, height: 40, background: null };
export const DEFAULT_M_PER_PX = 0.05; // a plan image with no scale: 2000 px ≈ 100 m

export const snap = (v: number, step: number) => Math.round(v / step) * step;
export const round2 = (v: number) => Math.round(v * 100) / 100;
export const normRot = (r: number) => ((r % 360) + 360) % 360;

export function fromPlanSpot(s: PlanSpot): EditorSpot {
  return { key: s.id, id: s.id, number: s.number, zone: s.zone, type: s.type, reserve: s.reserve, out_of_service: s.out_of_service, status: s.status, space_id: s.space_id, contract: s.contract, geom: s.geom ? { ...s.geom } : null };
}

/** Width/height unit vectors of a rotated box (rot° clockwise, SVG y down). */
export function axes(rot: number) {
  const a = (rot * Math.PI) / 180;
  return { u: { x: Math.cos(a), y: Math.sin(a) }, v: { x: -Math.sin(a), y: Math.cos(a) } };
}

export function corners(g: SpotGeom): { x: number; y: number }[] {
  const { u, v } = axes(g.rot);
  const hw = g.w / 2, hh = g.h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([a, b]) => ({ x: g.x + a * u.x + b * v.x, y: g.y + a * u.y + b * v.y }));
}

export function containsPoint(g: SpotGeom, p: { x: number; y: number }) {
  const { u, v } = axes(g.rot);
  const dx = p.x - g.x, dy = p.y - g.y;
  return Math.abs(dx * u.x + dy * u.y) <= g.w / 2 && Math.abs(dx * v.x + dy * v.y) <= g.h / 2;
}

/** Resize by dragging corner `i` while the opposite corner stays put. */
export function resizeFromCorner(g: SpotGeom, i: number, p: { x: number; y: number }): SpotGeom {
  const o = corners(g)[(i + 2) % 4];
  const { u, v } = axes(g.rot);
  const dx = p.x - o.x, dy = p.y - o.y;
  const du = dx * u.x + dy * u.y, dv = dx * v.x + dy * v.y;
  const w = Math.max(MIN_SIZE, snap(Math.abs(du), SIZE_STEP)), h = Math.max(MIN_SIZE, snap(Math.abs(dv), SIZE_STEP));
  const su = Math.sign(du) || 1, sv = Math.sign(dv) || 1;
  return { ...g, w: round2(w), h: round2(h), x: round2(o.x + (su * w / 2) * u.x + (sv * h / 2) * v.x), y: round2(o.y + (su * w / 2) * u.y + (sv * h / 2) * v.y) };
}

export function rotateTowards(g: SpotGeom, p: { x: number; y: number }): SpotGeom {
  const deg = (Math.atan2(p.y - g.y, p.x - g.x) * 180) / Math.PI + 90; // the handle sits above the box's centre
  let rot = normRot(snap(deg, ROT_STEP));
  for (const q of [0, 90, 180, 270, 360]) if (Math.abs(rot - q) <= 7) rot = q % 360;
  return { ...g, rot };
}

/** N boxes laid next to `g` along its width (a parking row in one action). */
export function rowAfter(g: SpotGeom, n: number): SpotGeom[] {
  const { u } = axes(g.rot);
  return Array.from({ length: n }, (_, i) => ({ ...g, x: round2(g.x + u.x * g.w * (i + 1)), y: round2(g.y + u.y * g.w * (i + 1)) }));
}

export function nextNumber(spots: { number: string }[]): string {
  const nums = spots.map((s) => parseInt(s.number.replace(/\D/g, ""), 10)).filter((n) => Number.isFinite(n));
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

/** Stable, distinct colour per space (golden-angle hues). */
export function spaceColor(index: number): string {
  return `hsl(${Math.round((index * 137.508) % 360)} 62% 52%)`;
}

export const NEUTRAL = "hsl(220 10% 72%)";
