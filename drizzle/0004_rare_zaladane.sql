CREATE TABLE `youtube_live_cache` (
	`channel_handle` text PRIMARY KEY NOT NULL,
	`video_id` text DEFAULT '' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`channel_title` text DEFAULT '' NOT NULL,
	`checked_at` text NOT NULL
);
