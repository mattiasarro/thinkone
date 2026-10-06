"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, tEnum } from "@/i18n";
import { useImports, useUploadImport } from "@/lib/queries/imports";
import { Card, CardHeader, PageHead } from "@/components/ui/Card";
import { Dropzone } from "@/components/ui/FileInput";
import { Table, Td } from "@/components/ui/Table";
import { Pill, statusTone } from "@/components/ui/Pill";
import { EmptyState, ErrorState, Loading, Spinner } from "@/components/ui/State";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { LinkButton } from "@/components/ui/Button";
import { IconChevronLeft, IconFile } from "@/components/ui/Icons";
import { IMPORT_PENDING } from "@/lib/queries/imports";
import type { ImportJob } from "@/types/api";

const CONTRACT_EXT = new Set(["pdf", "docx", "asice", "bdoc", "sce"]);
const TABLE_EXT = new Set(["csv", "tsv", "txt", "xlsx", "xls", "ods", "numbers"]);
const ACCEPT = ".pdf,.docx,.asice,.bdoc,.csv,.tsv,.xlsx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.etsi.asic-e+zip";

function jobHref(j: ImportJob) {
  if (j.status === "committed" && j.committed_contract_id) return `/app/portfell/leping/${j.committed_contract_id}`;
  return `/app/portfell/import/${j.id}`;
}
function jobTitle(j: ImportJob) {
  return j.reviewed?.contract.title || j.proposal?.contract.title || j.source_document?.filename || t("common.untitled");
}

export function ImportsPage() {
  const jobs = useImports();
  const upload = useUploadImport();
  const toast = useToast();
  const router = useRouter();
  const onFiles = async (files: File[]) => {
    for (const f of files) {
      // Say what went wrong before anything is sent: a spreadsheet belongs to the spaces import on the building page,
      // and the OS file picker otherwise just greys such files out without a word.
      const ext = f.name.toLowerCase().split(".").pop() ?? "";
      if (TABLE_EXT.has(ext)) { toast.error(t("imports.csvNotHere", { name: f.name })); continue; }
      if (!CONTRACT_EXT.has(ext)) { toast.error(t("imports.unsupportedType", { name: f.name })); continue; }
      try {
        const j = await upload.mutateAsync(f);
        if (files.length === 1) router.push(`/app/portfell/import/${j.id}`);
      } catch (e) { toast.error(`${f.name}: ${errorMessage(e)}`); }
    }
  };
  return (
    <div className="grid gap-5">
      <LinkButton href="/app/portfell" variant="text" size="sm" className="w-fit -ml-3"><IconChevronLeft width={16} height={16} />{t("portfolio.title")}</LinkButton>
      <PageHead title={t("imports.title")} sub={t("imports.sub")} actions={<LinkButton href="/app/portfell/import/manual">{t("imports.manualLink")}</LinkButton>} />
      <Dropzone onFiles={onFiles} multiple accept={ACCEPT} label={upload.isPending ? t("imports.uploading") : t("imports.dropzone")} hint={t("imports.dropzoneHint")} busy={upload.isPending} />
      {jobs.isLoading ? <Card><div className="p-6"><Loading /></div></Card> : jobs.error ? <Card><div className="p-6"><ErrorState error={jobs.error} onRetry={() => jobs.refetch()} /></div></Card> : (jobs.data ?? []).length === 0 ? (
        <Card><EmptyState icon={<IconFile width={40} height={40} />} title={t("imports.empty")} /></Card>
      ) : ([["inProgress", (jobs.data ?? []).filter((j) => j.status !== "committed" && j.status !== "manual")], ["finished", (jobs.data ?? []).filter((j) => j.status === "committed" || j.status === "manual")]] as const).filter(([, list]) => list.length > 0).map(([key, list]) => (
      <Card key={key}>
        <CardHeader title={key === "inProgress" ? t("imports.inProgress") : t("imports.finished")} actions={<Pill>{list.length}</Pill>} />
        {(
          <Table>
            <thead><tr><th>{t("common.file")}</th><th>{t("common.status")}</th><th>{t("common.created")}</th><th /></tr></thead>
            <tbody>
              {list.map((j) => (
                <tr key={j.id} className="clickable" onClick={() => router.push(jobHref(j))}>
                  <Td l={t("common.file")}><span className="font-semibold">{jobTitle(j)}</span>{j.source_document && j.source_document.filename !== jobTitle(j) && <span className="block text-xs text-muted">{j.source_document.filename}</span>}</Td>
                  <Td l={t("common.status")}><span className="inline-flex items-center gap-2"><Pill tone={statusTone(j.status)}>{tEnum("imports.status", j.status)}</Pill>{IMPORT_PENDING.has(j.status) && <Spinner />}</span>{j.error && <span className="block text-xs text-error mt-1">{j.error}</span>}</Td>
                  <Td l={t("common.created")}>{fmtDateTime(j.created_at)}</Td>
                  <Td className="text-right"><Link href={jobHref(j)} className="btn btn-ghost btn-sm" onClick={(e) => e.stopPropagation()}>{j.status === "committed" ? t("imports.viewContract") : t("common.open")}</Link></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      ))}
    </div>
  );
}
