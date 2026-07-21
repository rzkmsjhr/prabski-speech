CREATE TABLE `speech_schedule` (
	`id` integer PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`venue` text NOT NULL,
	`city` text NOT NULL,
	`starts_at` text NOT NULL,
	`time_zone` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
