CREATE TABLE `visits` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`loan_id` text,
	`outcome` text NOT NULL,
	`promise_date` integer,
	`promise_amount_cents` integer,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`loan_id`) REFERENCES `loans`(`id`) ON UPDATE no action ON DELETE no action
);
