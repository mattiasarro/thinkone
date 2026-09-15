"use client";
import { t, tEnum } from "@/i18n";
import { Table, Td } from "@/components/ui/Table";
import { Pill, statusTone } from "@/components/ui/Pill";
import { fmtNum } from "@/lib/format";
import { IconEdit, IconTrash } from "@/components/ui/Icons";
import type { Asset, SpaceAttributes } from "@/types/api";

export function SpacesTable({ spaces, onEdit, onDelete, extra }: { spaces: Asset[]; onEdit?: (s: Asset) => void; onDelete?: (s: Asset) => void; extra?: (s: Asset) => React.ReactNode }) {
  return (
    <Table>
      <thead><tr><th>{t("assets.spaceName")}</th><th>{t("assets.spaceType")}</th><th className="num">{t("assets.rentable")}</th><th className="num">{t("assets.price")}</th><th>{t("common.status")}</th>{(onEdit || onDelete || extra) && <th />}</tr></thead>
      <tbody>
        {spaces.map((s) => {
          const a = s.attributes as Partial<SpaceAttributes>;
          return (
            <tr key={s.id}>
              <Td l={t("assets.spaceName")}><span className="font-semibold">{s.name}</span></Td>
              <Td l={t("assets.spaceType")}>{a.type ? tEnum("assets.spaceTypes", a.type) : "—"}</Td>
              <Td l={t("assets.rentable")} num>{fmtNum(a.rentable_area_m2)}</Td>
              <Td l={t("assets.price")} num>{fmtNum(a.price_per_m2)}</Td>
              <Td l={t("common.status")}>{s.status ? <Pill tone={statusTone(s.status)}>{tEnum("assets.status", s.status)}</Pill> : "—"}</Td>
              {(onEdit || onDelete || extra) && (
                <Td className="text-right">
                  <span className="inline-flex items-center gap-1 flex-wrap justify-end">
                    {extra?.(s)}
                    {onEdit && <button type="button" className="icon-btn !w-8 !h-8" aria-label={t("common.edit")} onClick={() => onEdit(s)}><IconEdit width={14} height={14} /></button>}
                    {onDelete && <button type="button" className="icon-btn !w-8 !h-8 text-error" aria-label={t("common.delete")} onClick={() => onDelete(s)}><IconTrash width={14} height={14} /></button>}
                  </span>
                </Td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
