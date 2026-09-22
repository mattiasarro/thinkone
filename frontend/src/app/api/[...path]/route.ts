/**
 * Runtime API proxy: the browser talks same-origin (/api/...), this handler forwards to the API
 * service over Railway private networking. API_INTERNAL_URL is read at request time, not build time.
 */
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOP_BY_HOP = new Set(["connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "proxy-authorization", "proxy-authenticate", "host", "content-length"]);

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  const base = (process.env.API_INTERNAL_URL ?? "http://localhost:8000").replace(/\/$/, "");
  const url = new URL(`${base}/api/${path.join("/")}`);
  url.search = req.nextUrl.search;
  const headers = new Headers();
  req.headers.forEach((v, k) => { if (!HOP_BY_HOP.has(k.toLowerCase())) headers.set(k, v); });
  headers.set("x-forwarded-host", req.headers.get("host") ?? "");
  headers.set("x-forwarded-proto", req.nextUrl.protocol.replace(":", ""));
  const hasBody = !(req.method === "GET" || req.method === "HEAD");
  const upstream = await fetch(url, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // @ts-expect-error — Node fetch needs duplex for streamed request bodies
    duplex: hasBody ? "half" : undefined,
    redirect: "manual",
    cache: "no-store",
  });
  const out = new Headers();
  // fetch() has already decoded the body, so the upstream content-encoding/length no longer describe it
  const STRIP = new Set([...HOP_BY_HOP, "content-encoding", "content-length"]);
  upstream.headers.forEach((v, k) => { if (!STRIP.has(k.toLowerCase())) out.append(k, v); });
  // fetch collapses multiple Set-Cookie headers; re-expand them
  const cookies = (upstream.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  if (cookies.length) { out.delete("set-cookie"); for (const c of cookies) out.append("set-cookie", c); }
  return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE, proxy as HEAD, proxy as OPTIONS };
