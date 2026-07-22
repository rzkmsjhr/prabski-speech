import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

test("YouTube monitor follows Jakarta weekday, weekend, and overnight hours", async () => {
  const { youtubeMonitorSchedule } = await import(
    new URL("app/youtube-monitor-schedule.ts", projectRoot)
  );
  const weekday = youtubeMonitorSchedule(Date.parse("2026-07-22T03:00:00.000Z"));
  const nearClosing = youtubeMonitorSchedule(Date.parse("2026-07-22T12:58:00.000Z"));
  const overnight = youtubeMonitorSchedule(Date.parse("2026-07-22T13:00:00.000Z"));
  const weekend = youtubeMonitorSchedule(Date.parse("2026-07-25T03:00:00.000Z"));

  assert.equal(weekday.isOpen, true);
  assert.equal(weekday.isWeekend, false);
  assert.equal(weekday.intervalMs, 5 * 60 * 1_000);
  assert.equal(nearClosing.nextActionAt, Date.parse("2026-07-22T13:00:00.000Z"));
  assert.equal(overnight.isOpen, false);
  assert.equal(overnight.nextActionAt, Date.parse("2026-07-23T00:00:00.000Z"));
  assert.equal(weekend.isOpen, true);
  assert.equal(weekend.isWeekend, true);
  assert.equal(weekend.intervalMs, 30 * 60 * 1_000);
});

test("production build emits the Cloudflare Worker and browser assets", async () => {
  await Promise.all([
    access(new URL("dist/server/index.js", projectRoot)),
    access(new URL("dist/client", projectRoot)),
    access(new URL("dist/server/wrangler.json", projectRoot)),
  ]);

  const generatedConfig = await readFile(
    new URL("dist/server/wrangler.json", projectRoot),
    "utf8",
  );
  assert.match(generatedConfig, /"binding":\s*"DB"/);
  assert.match(generatedConfig, /85bcb688-f5ca-42bb-8d10-30927663995e/);
});

test("public and admin routes use the intended dashboard modes", async () => {
  const [homePage, adminPage, apiRoute] = await Promise.all([
    readFile(new URL("app/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/input-data/page.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/speech/route.ts", projectRoot), "utf8"),
  ]);

  assert.match(homePage, /<SpeechDashboard\s*\/>/);
  assert.doesNotMatch(homePage, /adminMode/);
  assert.match(adminPage, /<SpeechDashboard adminMode\s*\/>/);
  assert.match(apiRoute, /bindings\(\)\.DB/);
  assert.match(apiRoute, /x-admin-key/);
});

test("YouTube live monitoring keeps manual and channel videos independent", async () => {
  const [dashboard, liveRoute, schedule, migration, envExample] = await Promise.all([
    readFile(new URL("app/speech-dashboard.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/youtube-live/route.ts", projectRoot), "utf8"),
    readFile(new URL("app/youtube-monitor-schedule.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0004_rare_zaladane.sql", projectRoot), "utf8"),
    readFile(new URL(".env.example", projectRoot), "utf8"),
  ]);

  assert.match(dashboard, /VIDEO PIDATO/);
  assert.match(dashboard, /LIVE SEKRETARIAT PRESIDEN/);
  assert.match(dashboard, /hasYouTube/);
  assert.match(dashboard, /TRADINGVIEW_DEFAULT_RANGE = "5D"/);
  assert.match(dashboard, /TRADINGVIEW_DEFAULT_INTERVAL = "1"/);
  assert.doesNotMatch(dashboard, /"1d\|1"/);
  assert.match(liveRoute, /SekretariatPresiden/);
  assert.match(liveRoute, /liveBroadcastContent === "live"/);
  assert.match(liveRoute, /YOUTUBE_API_KEY/);
  assert.match(liveRoute, /if \(!schedule\.isOpen\)/);
  assert.match(liveRoute, /cacheAge < schedule\.intervalMs/);
  assert.match(schedule, /WEEKDAY_INTERVAL_MS = 5 \* 60 \* 1_000/);
  assert.match(schedule, /WEEKEND_INTERVAL_MS = 30 \* 60 \* 1_000/);
  assert.match(schedule, /OPEN_HOUR = 7/);
  assert.match(schedule, /CLOSE_HOUR = 20/);
  assert.match(dashboard, /if \(!schedule\.isOpen\)/);
  assert.doesNotMatch(dashboard, /setInterval\(\(\) => void loadChannelBroadcast/);
  assert.match(migration, /CREATE TABLE `youtube_live_cache`/);
  assert.match(envExample, /YOUTUBE_API_KEY=/);
});
