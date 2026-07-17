CREATE TABLE `profile` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`avatar_key` text,
	`business_name` text,
	`phone` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
