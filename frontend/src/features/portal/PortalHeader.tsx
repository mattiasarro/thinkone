"use client";
import { useParams } from "next/navigation";
import { LogoMark } from "@/components/ui/Icons";
import { t } from "@/i18n";
import { usePortalQuote } from "@/lib/queries/portal";

/** Logo centered (demo v774), landlord company on the right. Reads the same cached query as the page — no extra request. */
export function PortalHeader() {
  const params = useParams<{ token?: string }>();
  const token = typeof params?.token === "string" ? params.token : "";
  const { data } = usePortalQuote(token);
  const landlord = data?.contact.company ?? null;
  return (
    <header className="portal-header">
      <div className="portal-header-in">
        <div className="portal-brand">
          <LogoMark width={30} height={30} className="text-ink" />
          <div className="leading-tight">
            <div className="font-heading font-semibold text-base">{t("app.name")}</div>
            <div className="text-muted text-[11px]">{t("portal.brand")}</div>
          </div>
        </div>
        {landlord && <div className="portal-landlord" title={landlord}>{landlord}</div>}
      </div>
    </header>
  );
}
