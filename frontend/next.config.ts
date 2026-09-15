import type { NextConfig } from "next";

// /api/* is served by the runtime proxy in src/app/api/[...path]/route.ts (API_INTERNAL_URL read per request).
const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
