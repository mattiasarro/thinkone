"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { t } from "@/i18n";
import { useDebounced } from "@/lib/hooks";
import { cx } from "@/lib/format";
import { useThreads } from "@/lib/queries/suhtlus";
import { PageHead } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/State";
import { IconChat } from "@/components/ui/Icons";
import type { Thread } from "@/types/suhtlus";
import { ThreadList, type ThreadFilter } from "./ThreadList";
import { Conversation } from "./Conversation";

/** Suhtlus — „Mida osapooled ütlevad?”: thread list left, the selected conversation right (`?t=<subject_id>`). */
export function SuhtlusPage() {
  const router = useRouter();
  const params = useSearchParams();
  const selectedId = params.get("t");
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 300);
  const [filter, setFilter] = useState<ThreadFilter | null>(null);

  const all = useThreads({ q: dq });
  const pending = useThreads({ unanswered: true, q: dq });
  // default tab: „Ootab vastust” when something is unread, else „Kõik” — decided once the first list arrives
  useEffect(() => {
    if (filter !== null || !all.data) return;
    setFilter(all.data.some((x) => x.unread > 0) ? "ootel" : "koik");
  }, [filter, all.data]);
  const active: ThreadFilter = filter ?? "koik";
  const list = active === "ootel" ? pending : all;

  const selected = useMemo<Thread | undefined>(() => (all.data ?? pending.data ?? []).find((x) => x.subject_id === selectedId), [all.data, pending.data, selectedId]);
  const select = useCallback((th: Thread) => router.push(`/app/suhtlus?t=${th.subject_id}`), [router]);
  const back = useCallback(() => router.replace("/app/suhtlus"), [router]);

  return (
    <div>
      <PageHead title={t("suhtlus.title")} sub={t("suhtlus.sub")} />
      <div className="grid gap-4 items-start lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className={cx("min-w-0", selectedId && "hidden lg:block")}>
          <ThreadList threads={list.data} isLoading={list.isLoading} error={list.error} refetch={() => list.refetch()}
            selectedId={selectedId} onSelect={select} q={q} onQ={setQ} filter={active} onFilter={setFilter}
            counts={{ ootel: pending.data?.length ?? 0, koik: all.data?.length ?? 0 }} hasAny={(all.data?.length ?? 0) > 0 || !!dq} />
        </div>
        <div className={cx("min-w-0", !selectedId && "hidden lg:block")}>
          {selectedId ? <Conversation key={selectedId} id={selectedId} thread={selected} onBack={back} />
            : <section className="card"><EmptyState icon={<IconChat width={40} height={40} />} title={t("suhtlus.pick")} sub={t("suhtlus.pickSub")} /></section>}
        </div>
      </div>
    </div>
  );
}
