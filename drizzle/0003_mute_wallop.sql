PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_speech_schedule` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`venue` text NOT NULL,
	`city` text NOT NULL,
	`starts_at` text NOT NULL,
	`time_zone` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`latitude` real DEFAULT 0 NOT NULL,
	`longitude` real DEFAULT 0 NOT NULL,
	`youtube_url` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_speech_schedule`("id", "title", "venue", "city", "starts_at", "time_zone", "notes", "source_url", "latitude", "longitude", "youtube_url", "updated_at") SELECT "id", "title", "venue", "city", "starts_at", "time_zone", "notes", "source_url", "latitude", "longitude", "youtube_url", "updated_at" FROM `speech_schedule`;--> statement-breakpoint
DROP TABLE `speech_schedule`;--> statement-breakpoint
ALTER TABLE `__new_speech_schedule` RENAME TO `speech_schedule`;--> statement-breakpoint
PRAGMA foreign_keys=ON;