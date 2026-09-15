"use client";
import { useState } from "react";
import { t } from "@/i18n";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { Table, Td } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { useToast } from "@/components/ui/Toast";
import { errorMessage, API_BASE } from "@/lib/api";
import { useImportSpaces } from "@/lib/queries/portfolio";
import { valueToString } from "@/lib/format";
import type { SpaceImportResult } from "@/types/api";

export function SpacesImport({ propertyId, onDone, onCancel }: { propertyId: string; onDone: () => void; onCancel: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<SpaceImportResult | null>(null);
  const imp = useImportSpaces(propertyId);
  const toast = useToast();
  const run = async (dryRun: boolean) => {
    try {
      const r = await imp.mutateAsync({ file: file ?? undefined, text: file ? undefined : text, dryRun });
      if (dryRun) setPreview(r);
      else { toast.success(t("assets.importDone", { created: r.created, updated: r.updated })); onDone(); }
    } catch (e) { toast.error(errorMessage(e)); }
  };
  const okRows = preview?.rows.filter((r) => r.ok).length ?? 0;
  const hasErrors = !!preview && preview.rows.some((r) => !r.ok);
  const cols = preview ? Array.from(new Set(preview.rows.flatMap((r) => Object.keys(r.data ?? {})))) : [];
  return (
    <div className="rounded-control p-4 border grid gap-3" style={{ borderColor: "var(--color-divider)", background: "var(--color-canvas)" }}>
      <h3 className="text-base">{t("assets.importTitle")}</h3>
      <p className="text-muted text-sm">{t("assets.importHint")}</p>
      <a className="text-primary font-semibold text-sm w-fit" href={`${API_BASE}/assets/spaces/csv-template`} target="_blank" rel="noopener">{t("assets.downloadTemplate")}</a>
      <div className="field">
        <label htmlFor="csv-file">{t("assets.csvFile")}</label>
        <input id="csv-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values,text/plain" className="text-sm" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null); }} />
      </div>
      <Textarea label={t("assets.pasteText")} rows={5} value={text} onChange={(e) => { setText(e.target.value); setPreview(null); }} placeholder={t("assets.importPlaceholder")} disabled={!!file} />
      <div className="flex gap-2 flex-wrap">
        <Button onClick={() => run(true)} busy={imp.isPending && !preview} disabled={!file && !text.trim()}>{t("assets.preview")}</Button>
        <Button variant="text" onClick={onCancel}>{t("common.cancel")}</Button>
      </div>
      {preview && (
        <div className="grid gap-3">
          <div className="flex items-center gap-2 flex-wrap"><h4 className="text-sm">{t("assets.previewTitle")}</h4><Pill tone="success">{t("assets.rowOk")} {okRows}</Pill>{hasErrors && <Pill tone="error">{t("assets.rowErrors")} {preview.rows.length - okRows}</Pill>}</div>
          {hasErrors && <div className="note warning">{t("assets.importHasErrors")}</div>}
          <div className="card overflow-hidden">
            <Table stack={false}>
              <thead><tr><th>{t("assets.row")}</th><th>{t("common.status")}</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.row} className={r.ok ? "" : "uncertain"}>
                    <Td num>{r.row}</Td>
                    <Td>{r.ok ? <Pill tone="success">{t("assets.rowOk")}</Pill> : <span className="grid gap-0.5">{r.errors.map((e, i) => <Pill key={i} tone="error">{e}</Pill>)}</span>}</Td>
                    {cols.map((c) => <Td key={c}>{valueToString(r.data?.[c])}</Td>)}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          <div className="flex justify-end"><Button variant="primary" onClick={() => run(false)} busy={imp.isPending} disabled={hasErrors || okRows === 0}>{t("assets.commitImport", { n: okRows })}</Button></div>
        </div>
      )}
    </div>
  );
}
