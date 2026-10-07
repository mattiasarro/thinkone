"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { t, tEnum } from "@/i18n";
import { Button, LinkButton } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Table, Td } from "@/components/ui/Table";
import { Pill, type Tone } from "@/components/ui/Pill";
import { EmptyState, Loading } from "@/components/ui/State";
import { ConfirmDialog, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { API_BASE, errorMessage } from "@/lib/api";
import { cx } from "@/lib/format";
import { useAssignParking, useDeleteParking, useImportParking, useParking, useSetHasParking, useUpdateParking } from "@/lib/queries/portfolio";
import { IconPlus, IconTrash } from "@/components/ui/Icons";
import type { AssetDetail, ParkingImportResult, ParkingSpot, SpotType } from "@/types/api";

export function spotTone(s: ParkingSpot): Tone {
  if (s.out_of_service) return "error";
  if (s.status === "üüritud") return "success";
  if (s.reserve) return "warning";
  if (s.type === "elektriauto") return "info";
  return "primary";
}

export function SpotChip({ s, on, onClick, title }: { s: ParkingSpot; on?: boolean; onClick?: () => void; title?: string }) {
  const cls = cx("pill select-none", on ? "primary" : spotTone(s) === "primary" ? "" : spotTone(s), onClick && "cursor-pointer");
  const label = `${s.number}${s.zone ? ` · ${s.zone}` : ""}`;
  return onClick ? <button type="button" className={cls} aria-pressed={on} onClick={onClick} title={title}>{label}</button> : <span className={cls} title={title}>{label}</span>;
}

/** Add spots: a range (first–last, zone, type) or a pasted/uploaded `nr;tsoon;tüüp;pind` table, with a dry-run preview. */
function AddSpots({ propertyId, onDone }: { propertyId: string; onDone: () => void }) {
  const imp = useImportParking(propertyId);
  const toast = useToast();
  const [mode, setMode] = useState<"range" | "table">("range");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [zone, setZone] = useState(""); const [type, setType] = useState<SpotType>("tavaline");
  const [text, setText] = useState(""); const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParkingImportResult | null>(null);
  const rangeText = () => `${from.trim()}${to.trim() && to.trim() !== from.trim() ? `-${to.trim()}` : ""};${zone.trim()};${type};`;
  const run = async (dryRun: boolean) => {
    try {
      const r = await imp.mutateAsync(mode === "range" ? { text: rangeText(), dryRun } : { file: file ?? undefined, text: file ? undefined : text, dryRun });
      if (dryRun) setPreview(r);
      else { toast.success(t("assets.parkingReg.added", { n: r.created })); setPreview(null); setFrom(""); setTo(""); setText(""); setFile(null); onDone(); }
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const ready = mode === "range" ? !!from.trim() : !!file || !!text.trim();
  return (
    <div className="rounded-control p-4 border grid gap-3" style={{ borderColor: "var(--color-divider)", background: "var(--color-canvas)" }}>
      <div className="tabbar" role="tablist"><button type="button" role="tab" className={cx(mode === "range" && "active")} aria-selected={mode === "range"} onClick={() => { setMode("range"); setPreview(null); }}>{t("assets.parkingReg.range")}</button><button type="button" role="tab" className={cx(mode === "table" && "active")} aria-selected={mode === "table"} onClick={() => { setMode("table"); setPreview(null); }}>{t("assets.importTable")}</button></div>
      {mode === "range" ? (
        <div className="grid gap-x-3 sm:grid-cols-4">
          <Input label={t("assets.parkingReg.rangeFrom")} value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} inputMode="numeric" />
          <Input label={t("assets.parkingReg.rangeTo")} value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} inputMode="numeric" />
          <Input label={t("assets.parkingReg.zone")} value={zone} onChange={(e) => setZone(e.target.value)} />
          <Select label={t("assets.parkingReg.type")} value={type} onChange={(e) => setType(e.target.value as SpotType)} options={(["tavaline", "elektriauto", "ligipääsetav"] as SpotType[]).map((v) => ({ value: v, label: tEnum("assets.parkingReg.types", v) }))} />
        </div>
      ) : (
        <div className="grid gap-2">
          <p className="text-muted text-sm">{t("assets.parkingReg.addHint")} <a className="text-primary font-semibold" href={`${API_BASE}/assets/parking/csv-template`} target="_blank" rel="noopener">{t("assets.parkingReg.template")}</a></p>
          <div className="field"><label htmlFor="pk-file">{t("assets.csvFile")}</label><input id="pk-file" type="file" accept=".csv,.tsv,text/csv,text/plain" className="text-sm" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} /></div>
          <Textarea label={t("assets.pasteText")} rows={4} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder={t("assets.parkingReg.addPlaceholder")} disabled={!!file} />
        </div>
      )}
      {preview && (
        <div className="grid gap-2">
          <div className="flex gap-2 flex-wrap items-center"><Pill tone="success">{t("assets.parkingReg.commit", { n: preview.created })}</Pill>{preview.skipped > 0 && <Pill tone="warning">{t("assets.parkingReg.skipped", { n: preview.skipped })}</Pill>}</div>
          {preview.rows.some((r) => !r.ok) && <ul className="text-sm text-error grid gap-1">{preview.rows.filter((r) => !r.ok).map((r) => <li key={r.row}>{t("assets.row")} {r.row}: {r.errors.join("; ")}</li>)}</ul>}
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {!preview ? <Button onClick={() => run(true)} busy={imp.isPending} disabled={!ready}>{t("assets.parkingReg.preview")}</Button>
          : <Button variant="primary" onClick={() => run(false)} busy={imp.isPending} disabled={preview.created === 0}>{t("assets.parkingReg.commit", { n: preview.created })}</Button>}
        <Button variant="text" onClick={onDone}>{t("common.cancel")}</Button>
      </div>
    </div>
  );
}

/** Pick which register spots are a space's default spots (demo: the ONE place to edit „pinna kohad”). */
export function SpaceSpotsDialog({ propertyId, spaceId, spaceName, spots, open, onClose }: { propertyId: string; spaceId: string; spaceName: string; spots: ParkingSpot[]; open: boolean; onClose: () => void }) {
  const assign = useAssignParking(propertyId);
  const toast = useToast();
  const mine = spots.filter((s) => s.space_id === spaceId).map((s) => s.number);
  const [picked, setPicked] = useState<string[] | null>(null);
  const cur = picked ?? mine;
  const toggle = (n: string) => setPicked(cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n]);
  const save = async () => { try { await assign.mutateAsync({ space_id: spaceId, numbers: cur }); toast.success(t("assets.parkingReg.updated")); setPicked(null); onClose(); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <Modal open={open} onClose={() => { setPicked(null); onClose(); }} title={`${t("assets.parkingReg.spaceSpots")} · ${spaceName}`} sub={t("assets.parkingNumbersHint")}
      footer={<><Button onClick={() => { setPicked(null); onClose(); }}>{t("common.cancel")}</Button><Button variant="primary" busy={assign.isPending} onClick={save}>{t("assets.parkingReg.spaceSpotsSave")}</Button></>}>
      <div className="flex flex-wrap gap-1.5">
        {spots.map((s) => <SpotChip key={s.id} s={s} on={cur.includes(s.number)} onClick={() => toggle(s.number)} title={s.space_id && s.space_id !== spaceId ? `${t("assets.parkingPickTaken")}: ${s.space_name}` : tEnum("assets.parkingReg.statuses", s.status)} />)}
      </div>
    </Modal>
  );
}

export function ParkingRegister({ property, compact }: { property: AssetDetail; compact?: boolean }) {
  const parking = useParking(property.id);
  const update = useUpdateParking(property.id);
  const assign = useAssignParking(property.id);
  const del = useDeleteParking(property.id);
  const setHas = useSetHasParking(property.id);
  const toast = useToast();
  const [view, setView] = useState<"spaces" | "spots">("spaces");
  const [adding, setAdding] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [confirmDel, setConfirmDel] = useState(false);
  const [editSpace, setEditSpace] = useState<{ id: string; name: string } | null>(null);
  const spots = useMemo(() => parking.data ?? [], [parking.data]);
  const spaces = property.children.filter((c) => c.type_code === "space" && c.status !== "jagatud");
  const hasParking = (property.attributes as { has_parking?: boolean | null }).has_parking;
  const act = async (fn: () => Promise<unknown>, msg?: string) => { try { await fn(); if (msg) toast.success(msg); setSel(new Set()); } catch (e) { toast.error(errorMessage(e)); } };
  const patch = (p: Record<string, unknown>) => act(() => update.mutateAsync({ ids: [...sel], patch: p }), t("assets.parkingReg.updated"));
  const selected = spots.filter((s) => sel.has(s.id));

  if (parking.isLoading) return <Loading />;
  if (spots.length === 0 && hasParking === false && !adding) {
    return <div className="grid gap-3"><div className="note info">{t("assets.parkingReg.noneSet")}</div><Button className="w-fit" onClick={() => setAdding(true)}><IconPlus width={14} height={14} />{t("assets.parkingReg.changeMind")}</Button></div>;
  }
  if (spots.length === 0 && !adding) {
    return (
      <div className="grid gap-3">
        <EmptyState title={t("assets.parkingReg.question")} sub={t("assets.parkingReg.emptySub")} action={<span className="flex gap-2 flex-wrap justify-center"><Button variant="primary" onClick={() => setAdding(true)}><IconPlus width={14} height={14} />{t("assets.parkingReg.yes")}</Button><Button busy={setHas.isPending} onClick={() => act(() => setHas.mutateAsync(false))}>{t("assets.parkingReg.no")}</Button></span>} />
      </div>
    );
  }
  const groups = spaces.map((sp) => ({ space: sp, spots: spots.filter((s) => s.space_id === sp.id) }));
  const noSpace = spots.filter((s) => !s.space_id && !s.reserve && !s.out_of_service && s.type !== "elektriauto");
  const pools: { key: string; label: string; spots: ParkingSpot[] }[] = [
    { key: "none", label: t("assets.parkingReg.withoutSpace"), spots: noSpace },
    { key: "ev", label: t("assets.parkingReg.ev"), spots: spots.filter((s) => !s.space_id && s.type === "elektriauto" && !s.out_of_service) },
    { key: "reserve", label: t("assets.parkingReg.reserve"), spots: spots.filter((s) => !s.space_id && s.reserve && !s.out_of_service) },
    { key: "out", label: t("assets.parkingReg.out"), spots: spots.filter((s) => s.out_of_service) },
  ].filter((p) => p.spots.length > 0);
  const free = spots.filter((s) => s.status === "vaba").length;
  return (
    <div className="grid gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="tabbar" role="tablist">
          <button type="button" role="tab" className={cx(view === "spaces" && "active")} aria-selected={view === "spaces"} onClick={() => setView("spaces")}>{t("assets.parkingReg.viewBySpace")}</button>
          <button type="button" role="tab" className={cx(view === "spots" && "active")} aria-selected={view === "spots"} onClick={() => setView("spots")}>{t("assets.parkingReg.viewSpots")}</button>
        </div>
        <span className="flex gap-1 ml-auto"><Pill>{t("assets.parkingReg.spots", { n: spots.length })}</Pill><Pill tone="primary">{t("assets.parkingReg.free", { n: free })}</Pill></span>
        {!adding && <Button size="sm" onClick={() => setAdding(true)}><IconPlus width={14} height={14} />{t("assets.parkingReg.add")}</Button>}
      </div>
      {adding && <AddSpots propertyId={property.id} onDone={() => setAdding(false)} />}
      {view === "spaces" ? (
        <div className="card overflow-hidden">
          <Table>
            <thead><tr><th>{t("assets.parkingReg.space")}</th><th>{t("assets.space.tenant")}</th><th className="num">{t("assets.parking")}</th><th>{t("assets.parkingReg.viewSpots")}</th><th /></tr></thead>
            <tbody>
              {groups.map(({ space, spots: sps }) => {
                const contract = sps.find((s) => s.contract)?.contract;
                return (
                  <tr key={space.id}>
                    <Td l={t("assets.parkingReg.space")}><Link href={`/app/portfell/pind/${space.id}`} className="font-semibold text-primary">{space.name}</Link></Td>
                    <Td l={t("assets.space.tenant")}>{contract ? <Link href={`/app/portfell/leping/${contract.id}`} className="text-primary">{contract.number}</Link> : <span className="text-muted">—</span>}</Td>
                    <Td l={t("assets.parking")} num>{sps.length || "—"}</Td>
                    <Td><span className="flex flex-wrap gap-1">{sps.map((s) => <SpotChip key={s.id} s={s} title={tEnum("assets.parkingReg.statuses", s.status)} />)}</span></Td>
                    <Td className="text-right"><Button size="sm" variant="text" onClick={() => setEditSpace({ id: space.id, name: space.name })}>{t("assets.parkingReg.editSpaceSpots")}</Button></Td>
                  </tr>
                );
              })}
              {pools.map((p) => (
                <tr key={p.key}>
                  <Td l={t("assets.parkingReg.space")}><span className="font-semibold text-muted">{p.label}</span></Td>
                  <Td />
                  <Td num>{p.spots.length}</Td>
                  <Td><span className="flex flex-wrap gap-1">{p.spots.map((s) => <SpotChip key={s.id} s={s} title={tEnum("assets.parkingReg.statuses", s.status)} />)}</span></Td>
                  <Td />
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ) : (
        <div className="grid gap-3">
          {sel.size > 0 && (
            <div className="note primary flex-wrap items-center gap-2">
              <span className="font-semibold">{t("assets.parkingReg.selected", { n: sel.size })}</span>
              <select className="fld fld-sm w-auto" aria-label={t("assets.parkingReg.setType")} value="" onChange={(e) => { if (e.target.value) patch({ type: e.target.value }); }}>
                <option value="">{t("assets.parkingReg.setType")}…</option>{(["tavaline", "elektriauto", "ligipääsetav"] as SpotType[]).map((v) => <option key={v} value={v}>{tEnum("assets.parkingReg.types", v)}</option>)}
              </select>
              <select className="fld fld-sm w-auto" aria-label={t("assets.parkingReg.assign")} value="" onChange={(e) => { const v = e.target.value; if (v === "__none") act(() => update.mutateAsync({ ids: [...sel], patch: { space_id: null } }), t("assets.parkingReg.updated")); else if (v) act(() => assign.mutateAsync({ space_id: v, numbers: [...new Set([...spots.filter((s) => s.space_id === v).map((s) => s.number), ...selected.map((s) => s.number)])] }), t("assets.parkingReg.updated")); }}>
                <option value="">{t("assets.parkingReg.assign")}…</option>{spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}<option value="__none">{t("assets.parkingReg.unassign")}</option>
              </select>
              <Button size="sm" onClick={() => patch({ reserve: !selected.every((s) => s.reserve) })}>{t("assets.parkingReg.setReserve")}</Button>
              <Button size="sm" onClick={() => patch({ out_of_service: !selected.every((s) => s.out_of_service) })}>{t("assets.parkingReg.setOut")}</Button>
              <Button size="sm" variant="text" className="btn-destructive" onClick={() => setConfirmDel(true)}><IconTrash width={14} height={14} />{t("assets.parkingReg.delete")}</Button>
              <Button size="sm" variant="text" onClick={() => setSel(new Set())}>{t("assets.parkingReg.clear")}</Button>
            </div>
          )}
          <div className="card overflow-hidden">
            <Table stack={false}>
              <thead><tr><th><input type="checkbox" aria-label={t("assets.parkingReg.selectAll")} checked={sel.size === spots.length && spots.length > 0} onChange={(e) => setSel(e.target.checked ? new Set(spots.map((s) => s.id)) : new Set())} /></th><th>{t("assets.parkingReg.number")}</th><th>{t("assets.parkingReg.zone")}</th><th>{t("assets.parkingReg.type")}</th><th>{t("assets.parkingReg.status")}</th><th>{t("assets.parkingReg.space")}</th><th>{t("assets.parkingReg.contract")}</th></tr></thead>
              <tbody>
                {spots.map((s) => (
                  <tr key={s.id} className={cx(sel.has(s.id) && "uncertain")}>
                    <Td><input type="checkbox" aria-label={s.number} checked={sel.has(s.id)} onChange={(e) => { const n = new Set(sel); if (e.target.checked) n.add(s.id); else n.delete(s.id); setSel(n); }} /></Td>
                    <Td num>{s.number}</Td>
                    <Td>{s.zone ?? "—"}</Td>
                    <Td>{tEnum("assets.parkingReg.types", s.type)}{s.reserve ? ` · ${t("assets.parkingReg.reserve")}` : ""}</Td>
                    <Td><Pill tone={spotTone(s)}>{tEnum("assets.parkingReg.statuses", s.status)}</Pill></Td>
                    <Td>{s.space_id ? <Link href={`/app/portfell/pind/${s.space_id}`} className="text-primary font-semibold">{s.space_name}</Link> : <span className="text-muted">{t("assets.parkingReg.noSpace")}</span>}</Td>
                    <Td>{s.contract ? <Link href={`/app/portfell/leping/${s.contract.id}`} className="text-primary">{s.contract.number}</Link> : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </div>
      )}
      {!compact && <LinkButton href={`/app/portfell/objekt/${property.id}`} variant="text" size="sm" className="w-fit">{t("assets.space.back")} →</LinkButton>}
      {editSpace && <SpaceSpotsDialog propertyId={property.id} spaceId={editSpace.id} spaceName={editSpace.name} spots={spots} open onClose={() => setEditSpace(null)} />}
      <ConfirmDialog open={confirmDel} onClose={() => setConfirmDel(false)} busy={del.isPending} title={t("assets.parkingReg.delete")} body={t("assets.parkingReg.deleteConfirm", { n: sel.size })}
        onConfirm={() => act(async () => { await del.mutateAsync([...sel]); setConfirmDel(false); }, t("assets.parkingReg.deleted", { n: sel.size }))} />
    </div>
  );
}
