CREATE TABLE `customer_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`photo` text NOT NULL,
	`pushed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `profile` ADD `photo` text;