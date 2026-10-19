"use client";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/api";
import { useUploadImport } from "@/lib/queries/imports";
import { useToast } from "@/components/ui/Toast";

export const CONTRACT_EXT = new Set(["pdf", "docx", "asice", "bdoc", "sce"]);
const TABLE_EXT = new Set(["csv", "tsv", "txt", "xlsx", "xls", "ods", "numbers"]);
export const IMPORT_ACCEPT = ".pdf,.docx,.asice,.bdoc,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.etsi.asic-e+zip";

/** One drop = one import (demo `impLisaFailid`): every file of the drop goes into the same batch — a new one, or the
 *  batch the desk shows. Spreadsheets and other types are refused with a word before anything is sent. → the batch id. */
export function useImportFiles() {
  const upload = useUploadImport();
  const toast = useToast();
  const send = async (files: File[], batchId?: string): Promise<{ batchId: string; n: number } | null> => {
    const ok = files.filter((f) => {
      const ext = f.name.toLowerCase().split(".").pop() ?? "";
      if (TABLE_EXT.has(ext)) { toast.error(t("imports.csvNotHere", { name: f.name })); return false; }
      if (!CONTRACT_EXT.has(ext)) { toast.error(t("imports.unsupportedType", { name: f.name })); return false; }
      return true;
    });
    if (!ok.length) return null;
    const id = batchId ?? crypto.randomUUID();
    let n = 0;
    for (const f of ok) {
      try { await upload.mutateAsync({ file: f, batchId: id }); n++; } catch (e) { toast.error(`${f.name}: ${errorMessage(e)}`); }
    }
    return n ? { batchId: id, n } : null;
  };
  return { send, busy: upload.isPending };
}
