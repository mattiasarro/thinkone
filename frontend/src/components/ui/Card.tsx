import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Card({ children, className, pad }: { children: ReactNode; className?: string; pad?: boolean }) {
  return <section className={cx("card", pad && "pad", className)}>{children}</section>;
}

export function CardHeader({ title, overline, actions, children }: { title?: ReactNode; overline?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <header className="card-h">
      <div className="min-w-0">
        {overline && <div className="overline">{overline}</div>}
        {title && <h3 className="truncate">{title}</h3>}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("card-b", className)}>{children}</div>;
}

export function PageHead({ title, sub, actions }: { title: ReactNode; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div className="min-w-0">
        <h1 className="page-h1">{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "primary" | "warning" | "error" | "success" }) {
  const color = tone === "primary" ? "text-primary" : tone === "warning" ? "text-warning" : tone === "error" ? "text-error" : tone === "success" ? "text-success" : "text-ink";
  return (
    <div className="card pad min-w-0">
      <div className="overline">{label}</div>
      <div className={cx("font-heading text-[32px] leading-10 font-semibold mt-1 tabular-nums", color)}>{value}</div>
      {sub && <div className="text-muted text-sm mt-1">{sub}</div>}
    </div>
  );
}
