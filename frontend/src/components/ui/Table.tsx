import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export function Table({ children, stack = true, className }: { children: ReactNode; stack?: boolean; className?: string }) {
  return (
    <div className="tbl-wrap">
      <table className={cx("tbl", stack && "stack", className)}>{children}</table>
    </div>
  );
}
/** Cell with a stacked-mobile label. */
export function Td({ l, children, className, num, colSpan }: { l?: string; children?: ReactNode; className?: string; num?: boolean; colSpan?: number }) {
  return <td data-l={l} className={cx(num && "num", className)} colSpan={colSpan}>{children}</td>;
}
