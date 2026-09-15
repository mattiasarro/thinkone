"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Me } from "@/types/api";
import { t } from "@/i18n";
import { useSwitchAccount } from "@/lib/queries/auth";
import { useToast } from "@/components/ui/Toast";
import { errorMessage } from "@/lib/api";
import { IconCheck, IconChevron } from "@/components/ui/Icons";
import { useClickOutside } from "@/lib/hooks";
import { useRef } from "react";
import { cx } from "@/lib/format";

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
    <div ref={ref} className="relative mt-auto mb-3 px-3">
      <div className="overline">{t("nav.company")}</div>
      <button type="button" className={cx("flex items-center gap-2 text-left mt-0.5 w-full", !multi && "cursor-default")} onClick={() => multi && setOpen((o) => !o)} aria-haspopup={multi ? "listbox" : undefined} aria-expanded={multi ? open : undefined} disabled={sw.isPending}>
        <span className="font-bold text-sm truncate">{me.account.name}</span>
        {multi && <IconChevron width={14} height={14} className="text-muted flex-none" />}
      </button>
      <div className="text-xs text-muted">{t(`topbar.role.${me.account.role}` as "topbar.role.admin") || me.account.role}</div>
      {open && (
        <ul role="listbox" aria-label={t("nav.switchAccount")} className="drop rise left-0 right-0 top-auto bottom-full mb-2 min-w-0">
          {me.accounts.map((a) => (
            <li key={a.id}>
              <button type="button" role="option" aria-selected={a.id === me.account.id} className="drop-item justify-between" onClick={() => pick(a.id)}>
                <span className="min-w-0"><span className="block font-semibold truncate">{a.name}</span><span className="block text-xs text-muted">{a.role}</span></span>
                {a.id === me.account.id && <IconCheck width={14} height={14} className="text-primary" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
