import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack(config) {
    if (process.env.VERCEL === "1" || process.env.ZIP_FRONTEND_ONLY === "1") {
      config.resolve.alias["cloudflare:workers"] = path.resolve(process.cwd(), "lib/vercel-cloudflare-workers-stub.ts");
    }
    return config;
  },
};

export default nextConfig;
