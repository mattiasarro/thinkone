"use client";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cx } from "@/lib/format";
import { IconAlert, IconCheck, IconInfo } from "./Icons";

type Kind = "success" | "error" | "info";
interface Toast { id: number; kind: Kind; text: string; leaving?: boolean }
interface Ctx { push: (text: string, kind?: Kind) => void; success: (text: string) => void; error: (text: string) => void; info: (text: string) => void }

const ToastCtx = createContext<Ctx | null>(null);
/** Module-level handle so non-React code (e.g. QueryClient handlers) can toast. */
export const toastBus: { push: Ctx["push"] } = { push: () => {} };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 250);
  }, []);
  const push = useCallback((text: string, kind: Kind = "info") => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-3), { id, kind, text }]);
    setTimeout(() => dismiss(id), kind === "error" ? 7000 : 4000);
  }, [dismiss]);
  const ctx = useMemo<Ctx>(() => ({ push, success: (x) => push(x, "success"), error: (x) => push(x, "error"), info: (x) => push(x, "info") }), [push]);
  toastBus.push = push;
  return (
    <ToastCtx.Provider value={ctx}>
      {children}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[26px] z-[200] grid gap-2 justify-items-center pointer-events-none px-4 w-full max-w-[600px]" aria-live="polite" aria-relevant="additions">
        {items.map((tst) => (
          <button key={tst.id} type="button" onClick={() => dismiss(tst.id)} className={cx("toastx pointer-events-auto", tst.kind === "success" && "ok", tst.kind === "error" && "err", tst.leaving ? "out" : "rise")}>
            <span className="tic">
              {tst.kind === "success" ? <IconCheck width={16} height={16} /> : tst.kind === "error" ? <IconAlert width={16} height={16} /> : <IconInfo width={16} height={16} />}
            </span>
            <span className="break-words">{tst.text}</span>
          </button>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const c = useContext(ToastCtx);
  if (!c) throw new Error("useToast outside ToastProvider");
  return c;
}
