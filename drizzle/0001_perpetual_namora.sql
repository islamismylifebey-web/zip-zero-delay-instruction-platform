CREATE TABLE `workspace_members` (
	`member_email` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`crew_id` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
