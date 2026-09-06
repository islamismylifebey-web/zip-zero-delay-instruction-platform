import path from "node:path";
import type { NextConfig } from "next";

const frontendOnly = process.env.VERCEL === "1" || process.env.ZIP_FRONTEND_ONLY === "1";

const nextConfig: NextConfig = {
  typescript: { tsconfigPath: frontendOnly ? "tsconfig.vercel.json" : "tsconfig.json" },
  webpack(config, { webpack }) {
    if (frontendOnly) {
      const stub = path.resolve(process.cwd(), "lib/vercel-cloudflare-workers-stub.ts");
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/, stub));
    }
    return config;
  },
};

export default nextConfig;
