import type { ReactNode } from "react";
import { cx } from "@/lib/format";

export type Tone = "neutral" | "success" | "warning" | "error" | "info" | "primary";

export function Pill({ tone = "neutral", children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return <span className={cx("pill", tone !== "neutral" && tone, className)} title={title}>{children}</span>;
}

export function statusTone(status: string | null | undefined): Tone {
  switch ((status ?? "").toLowerCase()) {
    case "active": case "signed": case "kehtiv": case "täidetud": case "committed": case "üüritud": return "success";
    case "draft": case "pending": case "review": case "osaliselt": case "uploaded": case "extracting": case "structuring": case "invited": return "warning";
    case "ended": case "terminated": case "expired": case "archived": case "failed": case "täitmata": return "error";
    case "imported": case "manual": return "info";
    case "vaba": return "primary";
    default: return "neutral";
  }
}

export function severityTone(s: "info" | "warning" | "error"): Tone {
  return s === "error" ? "error" : s === "warning" ? "warning" : "info";
}
