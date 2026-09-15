import { t } from "@/i18n";

export class ApiError extends Error {
  status: number;
  detail: string;
  code: string;
  errors?: { loc?: (string | number)[]; msg?: string; field?: string; message?: string }[];
  constructor(status: number, detail: string, code = "error", errors?: ApiError["errors"]) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
    this.code = code;
    this.errors = errors;
  }
}

export const API_BASE = "/api/v1";

export type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(params?: Query): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function parseError(res: Response): Promise<ApiError> {
  let detail = res.statusText || `HTTP ${res.status}`;
  let code = "error";
  let errors: ApiError["errors"];
  try {
    const body = await res.json();
    if (typeof body?.detail === "string") detail = body.detail;
    else if (Array.isArray(body?.detail)) {
      // FastAPI request validation errors
      errors = body.detail;
      detail = body.detail.map((e: { msg?: string }) => e.msg).filter(Boolean).join("; ") || detail;
      code = "validation";
    }
    if (typeof body?.code === "string") code = body.code;
    if (Array.isArray(body?.errors)) errors = body.errors;
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, detail, code, errors);
}

export const onUnauthorized: { handler: (() => void) | null } = { handler: null };

async function request<T>(method: string, path: string, init: { body?: unknown; form?: FormData; query?: Query; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (init.form) body = init.form;
  else if (init.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(init.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}${qs(init.query)}`, { method, headers, body, credentials: "include", signal: init.signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiError(0, "network", "network");
  }
  if (res.status === 401) {
    onUnauthorized.handler?.();
    throw await parseError(res);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>("GET", path, { query, signal }),
  post: <T>(path: string, body?: unknown, query?: Query) => request<T>("POST", path, { body, query }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
  /** Multipart upload; values may be File, Blob, string, or undefined (skipped). */
  upload: <T>(path: string, fields: Record<string, File | Blob | string | number | boolean | null | undefined>, query?: Query) => {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) {
      if (v === undefined || v === null) continue;
      if (v instanceof Blob) form.append(k, v);
      else form.append(k, String(v));
    }
    return request<T>("POST", path, { form, query });
  },
};

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export function errorMessage(e: unknown, fallback?: string): string {
  const fb = fallback ?? t("common.error");
  if (isApiError(e)) {
    if (e.code === "network") return t("common.networkError");
    if (e.status === 401) return t("common.sessionExpired");
    return e.detail || fb;
  }
  if (e instanceof Error) return e.message || fb;
  return fb;
}
