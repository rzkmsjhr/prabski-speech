import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const speechSchedule = sqliteTable("speech_schedule", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  venue: text("venue").notNull(),
  city: text("city").notNull(),
  startsAt: text("starts_at").notNull(),
  timeZone: text("time_zone").notNull(),
  notes: text("notes").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
  latitude: real("latitude").notNull().default(0),
  longitude: real("longitude").notNull().default(0),
  youtubeUrl: text("youtube_url").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});

export const youtubeLiveCache = sqliteTable("youtube_live_cache", {
  channelHandle: text("channel_handle").primaryKey(),
  videoId: text("video_id").notNull().default(""),
  title: text("title").notNull().default(""),
  channelTitle: text("channel_title").notNull().default(""),
  checkedAt: text("checked_at").notNull(),
});
