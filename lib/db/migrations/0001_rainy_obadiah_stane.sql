CREATE TABLE `loans` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`principal_cents` integer NOT NULL,
	`interest_rate_bps` integer NOT NULL,
	`term_count` integer NOT NULL,
	`frequency` text NOT NULL,
	`start_date` integer NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`loan_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_at` integer NOT NULL,
	`method` text,
	`notes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action
);
