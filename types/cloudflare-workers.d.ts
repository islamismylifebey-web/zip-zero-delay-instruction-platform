declare module "cloudflare:workers" {
  export const env: {
    DB: import("drizzle-orm/d1").AnyD1Database;
    BUCKET: any;
    OPENAI_API_KEY?: string;
    ZIP_FRONTEND_ORIGINS?: string;
    CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
    CLOUDFLARE_ACCESS_AUD?: string;
  };
}
