import { sql } from "drizzle-orm";
import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const workspaceStates = sqliteTable("workspace_states", {
  ownerEmail: text("owner_email").primaryKey(),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const workspaceMembers = sqliteTable("workspace_members", {
  memberEmail: text("member_email").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  crewId: text("crew_id").notNull(),
  displayName: text("display_name").notNull(),
  platformRole: text("platform_role").notNull().default("employee"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index("workspace_members_owner_email_idx").on(table.ownerEmail)]);
