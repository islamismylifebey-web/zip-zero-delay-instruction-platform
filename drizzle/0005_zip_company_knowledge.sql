CREATE TABLE `zip_company_knowledge` (
  `owner_email` text PRIMARY KEY NOT NULL,
  `data` text NOT NULL,
  `version` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`owner_email`) REFERENCES `workspace_states`(`owner_email`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `zip_pending_drafts` ADD `knowledge_version` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `zip_pending_drafts` ADD `preset_id` text DEFAULT '' NOT NULL;
