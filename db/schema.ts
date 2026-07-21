import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const speechSchedule = sqliteTable("speech_schedule", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  venue: text("venue").notNull(),
  city: text("city").notNull(),
  startsAt: text("starts_at").notNull(),
  timeZone: text("time_zone").notNull(),
  notes: text("notes").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
