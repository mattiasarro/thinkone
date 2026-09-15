import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "@/lib/format";

type Variant = "primary" | "ghost" | "text" | "destructive";
type Size = "sm" | "md" | "lg";

interface BaseProps { variant?: Variant; size?: Size; busy?: boolean; className?: string; children?: ReactNode }
export interface ButtonProps extends BaseProps, Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> {}

const cls = ({ variant = "ghost", size = "md", className }: BaseProps) =>
  cx("btn", `btn-${variant}`, size !== "md" && `btn-${size}`, className);

export function Button({ variant, size, busy, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={cls({ variant, size, className })} aria-busy={busy || undefined} disabled={rest.disabled || busy} {...rest}>
      {children}
    </button>
  );
}

export function LinkButton({ href, variant, size, className, children, ...rest }: BaseProps & { href: string; target?: string; rel?: string }) {
  return (
    <Link href={href} className={cls({ variant, size, className })} {...rest}>
      {children}
    </Link>
  );
}
