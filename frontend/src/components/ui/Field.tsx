"use client";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cx } from "@/lib/format";

interface Wrap { label?: ReactNode; error?: string; hint?: ReactNode; className?: string; required?: boolean }

function Wrapper({ id, label, error, hint, className, required, children }: Wrap & { id: string; children: ReactNode }) {
  return (
    <div className={cx("field", className)}>
      {label && (
        <label htmlFor={id}>
          {label}
          {required && <span className="text-error" aria-hidden> *</span>}
        </label>
      )}
      {children}
      {error ? <span className="field-err" id={`${id}-err`} role="alert">{error}</span> : hint ? <span className="field-hint" id={`${id}-hint`}>{hint}</span> : null}
    </div>
  );
}

export type InputProps = Wrap & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, hint, className, required, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrapper id={fid} label={label} error={error} hint={hint} className={className} required={required}>
      <input ref={ref} id={fid} className="fld" aria-invalid={error ? true : undefined} aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined} {...rest} />
    </Wrapper>
  );
});

export type SelectProps = Wrap & Omit<SelectHTMLAttributes<HTMLSelectElement>, "className"> & { placeholder?: string; options?: { value: string; label: string }[] };
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ label, error, hint, className, required, id, placeholder, options, children, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrapper id={fid} label={label} error={error} hint={hint} className={className} required={required}>
      <select ref={ref} id={fid} className="fld" aria-invalid={error ? true : undefined} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        {children}
      </select>
    </Wrapper>
  );
});

export type TextareaProps = Wrap & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className">;
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ label, error, hint, className, required, id, ...rest }, ref) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <Wrapper id={fid} label={label} error={error} hint={hint} className={className} required={required}>
      <textarea ref={ref} id={fid} className="fld" aria-invalid={error ? true : undefined} {...rest} />
    </Wrapper>
  );
});

export const Checkbox = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "className" | "type"> & { label: ReactNode; className?: string }>(
  function Checkbox({ label, className, id, ...rest }, ref) {
    const auto = useId();
    const fid = id ?? auto;
    return (
      <label htmlFor={fid} className={cx("check", className)}>
        <input ref={ref} type="checkbox" id={fid} {...rest} />
        <span>{label}</span>
      </label>
    );
  },
);

export function FormRow({ children, cols = 2 }: { children: ReactNode; cols?: 2 | 3 }) {
  return <div className={cx("grid gap-x-4", cols === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>{children}</div>;
}
