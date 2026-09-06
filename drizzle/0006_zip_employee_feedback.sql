CREATE TABLE `zip_employee_feedback` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_email` text NOT NULL,
  `job_id` text NOT NULL,
  `employee_id` text NOT NULL,
  `signal` text NOT NULL,
  `detail` text NOT NULL DEFAULT '',
  `created_at` text NOT NULL,
  `reviewed_at` text,
  FOREIGN KEY (`owner_email`) REFERENCES `workspace_states`(`owner_email`) ON UPDATE no action ON DELETE cascade,
  UNIQUE(`owner_email`, `job_id`, `employee_id`)
);
--> statement-breakpoint
CREATE INDEX `zip_employee_feedback_owner_email_idx` ON `zip_employee_feedback` (`owner_email`);
--> statement-breakpoint
CREATE INDEX `zip_employee_feedback_reviewed_at_idx` ON `zip_employee_feedback` (`reviewed_at`);