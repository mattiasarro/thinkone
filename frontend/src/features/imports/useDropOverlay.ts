"use client";
import { useEffect, useRef, useState } from "react";

/** Files dragged anywhere over the page → a full-screen „Lase lahti” overlay; dropping hands them to ``onFiles`` (demo `ib-lohista`). */
export function useDropOverlay(onFiles: (files: File[]) => void): boolean {
  const [on, setOn] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  cb.current = onFiles;
  useEffect(() => {
    const hasFiles = (e: DragEvent) => !!e.dataTransfer && Array.from(e.dataTransfer.types).includes("Files");
    const enter = (e: DragEvent) => { if (!hasFiles(e)) return; e.preventDefault(); depth.current++; setOn(true); };
    const over = (e: DragEvent) => { if (hasFiles(e)) e.preventDefault(); };
    const leave = () => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setOn(false); };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault(); depth.current = 0; setOn(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) cb.current(files);
    };
    window.addEventListener("dragenter", enter); window.addEventListener("dragover", over); window.addEventListener("dragleave", leave); window.addEventListener("drop", drop);
    return () => { window.removeEventListener("dragenter", enter); window.removeEventListener("dragover", over); window.removeEventListener("dragleave", leave); window.removeEventListener("drop", drop); };
  }, []);
  return on;
}
