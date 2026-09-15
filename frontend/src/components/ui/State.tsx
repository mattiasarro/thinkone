import type { ReactNode } from "react";
import { t } from "@/i18n";
import { errorMessage } from "@/lib/api";
import { cx } from "@/lib/format";

export function Spinner({ className }: { className?: string }) {
  return <span className={cx("spinner inline-block", className)} role="status" aria-label={t("common.loading")} />;
}

export function Loading({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx("grid gap-3", className)} role="status" aria-label={t("common.loading")}>
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="skel h-5" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function EmptyState({ title, sub, action, icon }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="mx-auto mb-3 w-10 h-10 text-muted">{icon}</div>}
      <h3>{title}</h3>
      {sub && <p className="text-sm">{sub}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="note error items-center justify-between flex-wrap" role="alert">
      <span>{errorMessage(error)}</span>
      {onRetry && <button type="button" className="btn btn-sm btn-ghost" onClick={onRetry}>{t("common.retry")}</button>}
    </div>
  );
}

/** Renders loading/error/empty/data in one place. */
export function QueryState<T>({ isLoading, error, data, empty, refetch, children, rows }: { isLoading: boolean; error: unknown; data: T | undefined; empty?: ReactNode; refetch?: () => void; children: (data: T) => ReactNode; rows?: number }) {
  if (isLoading) return <Loading rows={rows} />;
  if (error) return <ErrorState error={error} onRetry={refetch} />;
  if (data === undefined) return null;
  if (empty !== undefined && Array.isArray(data) && data.length === 0) return <>{empty}</>;
  return <>{children(data)}</>;
}
