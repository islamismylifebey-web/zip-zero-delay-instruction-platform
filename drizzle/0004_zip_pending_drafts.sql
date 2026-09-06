CREATE TABLE `zip_pending_drafts` (
  `draft_id` text PRIMARY KEY NOT NULL,
  `owner_email` text NOT NULL,
  `assignee_id` text NOT NULL,
  `professional_assignment` text NOT NULL,
  `checklist_json` text NOT NULL,
  `created_by` text NOT NULL,
  `created_at` text NOT NULL,
  `expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `zip_pending_drafts_owner_email_idx` ON `zip_pending_drafts` (`owner_email`);
--> statement-breakpoint
CREATE INDEX `zip_pending_drafts_expires_at_idx` ON `zip_pending_drafts` (`expires_at`);
