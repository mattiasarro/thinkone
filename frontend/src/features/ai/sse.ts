import { API_BASE, ApiError, onUnauthorized } from "@/lib/api";
import type { AiStreamEvent } from "@/types/ai";

/**
 * POST /agent/threads/{id}/messages?stream=true and parse the Server-Sent Events (`event:` + `data:` lines, blank-line delimited).
 * The `api` helper buffers the body, so streaming uses plain fetch; cookies ride along with `credentials: "include"`.
 */
export async function streamAiMessage(threadId: string, text: string, onEvent: (ev: AiStreamEvent) => void, signal?: AbortSignal): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/agent/threads/${threadId}/messages?stream=true`, {
      method: "POST", credentials: "include", signal,
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ text }),
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "network", "network");
  }
  if (res.status === 401) { onUnauthorized.handler?.(); throw new ApiError(401, "unauthorized"); }
  if (!res.ok) {
    let detail = res.statusText || `HTTP ${res.status}`;
    try { const b = await res.json(); if (typeof b?.detail === "string") detail = b.detail; } catch { /* non-JSON */ }
    throw new ApiError(res.status, detail);
  }
  if (!res.body) throw new ApiError(0, "network", "network");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let sawDone = false;
  const dispatch = (block: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length === 0) return;
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(data.join("\n")) as Record<string, unknown>; } catch { return; }
    const ev = { ...payload, type: (payload.type as string | undefined) ?? event } as AiStreamEvent;
    if (ev.type === "done") sawDone = true;
    onEvent(ev);
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    buf = buf.replace(/\r\n/g, "\n");
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      dispatch(block);
    }
  }
  buf += decoder.decode();
  if (buf.trim()) dispatch(buf);
  if (!sawDone) onEvent({ type: "done", status: "failed", error: "stream ended" });
}
