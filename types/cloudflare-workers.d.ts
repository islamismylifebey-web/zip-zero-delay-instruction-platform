import type { AnyD1Database } from "drizzle-orm/d1";

declare module "cloudflare:workers" {
  export const env: {
    DB: AnyD1Database;
    BUCKET: any;
    OPENAI_API_KEY?: string;
    ZIP_FRONTEND_ORIGINS?: string;
    CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
    CLOUDFLARE_ACCESS_AUD?: string;
  };
}
