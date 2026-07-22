import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectRoot = new URL("../", import.meta.url);

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
  const [dashboard, liveRoute, migration, envExample] = await Promise.all([
    readFile(new URL("app/speech-dashboard.tsx", projectRoot), "utf8"),
    readFile(new URL("app/api/youtube-live/route.ts", projectRoot), "utf8"),
    readFile(new URL("drizzle/0004_rare_zaladane.sql", projectRoot), "utf8"),
    readFile(new URL(".env.example", projectRoot), "utf8"),
  ]);

  assert.match(dashboard, /VIDEO PIDATO/);
  assert.match(dashboard, /LIVE SEKRETARIAT PRESIDEN/);
  assert.match(dashboard, /hasYouTube/);
  assert.match(liveRoute, /SekretariatPresiden/);
  assert.match(liveRoute, /liveBroadcastContent === "live"/);
  assert.match(liveRoute, /YOUTUBE_API_KEY/);
  assert.match(migration, /CREATE TABLE `youtube_live_cache`/);
  assert.match(envExample, /YOUTUBE_API_KEY=/);
});
