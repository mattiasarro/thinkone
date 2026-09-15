"use client";
import { useState } from "react";
import { t, tEnum } from "@/i18n";
import { openAttachment, useDeleteAttachment, useUploadAttachment } from "@/lib/queries/settings";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { fmtBytes, fmtDate } from "@/lib/format";
import { IconExternal, IconFile, IconTrash, IconUpload } from "@/components/ui/Icons";
import type { Attachment, AttachmentSubject } from "@/types/api";

export function AttachmentsList({ items, subjectType, subjectId, role = "generic", allowUpload = true, allowDelete = true, compact }: { items: Attachment[]; subjectType: AttachmentSubject; subjectId: string; role?: string; allowUpload?: boolean; allowDelete?: boolean; compact?: boolean }) {
  const up = useUploadAttachment();
  const del = useDeleteAttachment();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const onFile = async (f: File | undefined) => {
    if (!f) return;
    try { await up.mutateAsync({ subject_type: subjectType, subject_id: subjectId, role, file: f }); toast.success(t("assets.uploaded")); } catch (e) { toast.error(errorMessage(e)); }
  };
  const onOpen = async (a: Attachment) => { setBusyId(a.id); try { await openAttachment(a.id); } catch (e) { toast.error(errorMessage(e)); } finally { setBusyId(null); } };
  const onDelete = async (a: Attachment) => { if (!confirm(t("common.deleteConfirm", { name: a.filename }))) return; try { await del.mutateAsync(a.id); toast.success(t("toast.deleted")); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div>
      {items.length === 0 ? <p className="text-sm text-muted">{t("assets.noAttachments")}</p> : (
        <ul className="divide-y" style={{ borderColor: "var(--line)" }}>
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 py-2">
              <IconFile width={18} height={18} className="text-muted flex-none" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium truncate">{a.filename}</span>
                {!compact && <span className="block text-xs text-muted">{tEnum("assets", roleKey(a.role))} · {fmtBytes(a.size)} · {fmtDate(a.created_at)}</span>}
              </span>
              <button type="button" className="icon-btn" aria-label={t("common.newTab")} onClick={() => onOpen(a)} disabled={busyId === a.id}><IconExternal width={16} height={16} /></button>
              {allowDelete && <button type="button" className="icon-btn text-error" aria-label={t("assets.deleteAttachment")} onClick={() => onDelete(a)}><IconTrash width={16} height={16} /></button>}
            </li>
          ))}
        </ul>
      )}
      {allowUpload && (
        <label className="btn btn-ghost btn-sm mt-3 cursor-pointer">
          <IconUpload width={14} height={14} />{up.isPending ? t("common.loading") : t("common.upload")}
          <input type="file" className="sr-only" aria-label={t("common.upload")} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} disabled={up.isPending} />
        </label>
      )}
    </div>
  );
}

function roleKey(role: string): string {
  return role === "site_plan" ? "sitePlan" : role === "parking_plan" ? "parkingPlan" : role === "floor_plan" ? "floorPlan" : role === "logo" ? "logo" : "genericAttachment";
}
