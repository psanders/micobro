CREATE TABLE `cash_closes` (
	`id` text PRIMARY KEY NOT NULL,
	`amount_cents` integer NOT NULL,
	`period_start` integer,
	`closed_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
