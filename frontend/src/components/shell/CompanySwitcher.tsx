"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@/types/api";
import { t } from "@/i18n";
import { useSwitchAccount } from "@/lib/queries/auth";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconCheck, IconChevron } from "@/components/ui/Icons";
import { useClickOutside } from "@/lib/hooks";
import { cx } from "@/lib/format";

/** Company context above the sidebar footer (demo `.sb-context`): mono label · company · role; the menu opens upwards. */
export function CompanySwitcher({ me }: { me: Me }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);
  const sw = useSwitchAccount();
  const toast = useToast();
  const router = useRouter();
  const multi = me.accounts.length > 1;
  const pick = async (id: string) => {
    setOpen(false);
    if (id === me.account.id) return;
    try { await sw.mutateAsync(id); router.push("/app"); router.refresh(); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div ref={ref} className="sb-context">
      <div className="lbl">{t("nav.company")}</div>
      <button type="button" className={cx("co-btn", !multi && "cursor-default")} onClick={() => multi && setOpen((o) => !o)} aria-haspopup={multi ? "listbox" : undefined} aria-expanded={multi ? open : undefined} disabled={sw.isPending}>
        <span className="org truncate">{me.account.name}</span>
        {multi && <span className="chev"><IconChevron width={14} height={14} /></span>}
      </button>
      <div className="obj">{t(`topbar.role.${me.account.role}` as "topbar.role.admin") || me.account.role}</div>
      {open && (
        <ul role="listbox" aria-label={t("nav.switchAccount")} className="co-menu rise m-0 p-1.5 list-none">
          {me.accounts.map((a) => (
            <li key={a.id}>
              <button type="button" role="option" aria-selected={a.id === me.account.id} className="drop-item justify-between" onClick={() => pick(a.id)}>
                <span className="min-w-0"><span className={cx("block truncate", a.id === me.account.id ? "font-bold text-ink" : "font-semibold")}>{a.name}</span><span className="block text-[11px] text-faint">{a.role}</span></span>
                {a.id === me.account.id && <IconCheck width={14} height={14} className="text-primary flex-none" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
