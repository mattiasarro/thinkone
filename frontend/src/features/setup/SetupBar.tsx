"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { t } from "@/i18n";
import { IconArrowRight } from "@/components/ui/Icons";
import { useSetupSteps } from "./useSetupSteps";

/** Demo v623 `alRibaHTML`: while setup is unfinished, every main page says where it stands — one thin card linking back to „Alusta”. */
export function SetupBar() {
  const pathname = usePathname();
  const { steps, done, next, minutesLeft } = useSetupSteps();
  // the import pages say it in their own overline (demo „Seadistus · samm 4 / 4 · olemasolevad lepingud”)
  if (!steps || !next || pathname === "/app" || pathname.startsWith("/app/alusta") || pathname.startsWith("/app/portfell/import")) return null;
  return (
    <Link href="/app/alusta" className="card flex items-center gap-3 px-4 py-2.5 mb-5 hover:shadow-floating transition-shadow">
      <span className="font-mono text-[12px] font-[650] tabular-nums text-ink flex-none">{done}/{steps.length}</span>
      <span className="min-w-0 flex-1"><b className="block text-sm font-semibold truncate">{t("home.setup.barTitle")}</b><small className="block text-xs text-muted truncate">{t("home.setup.barNext", { step: next.title.charAt(0).toLowerCase() + next.title.slice(1), min: minutesLeft })}</small></span>
      <span className="text-sm font-semibold inline-flex items-center gap-1 flex-none">{t("home.setup.barGo")}<IconArrowRight width={14} height={14} /></span>
    </Link>
  );
}
