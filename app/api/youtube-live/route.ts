import { env } from "cloudflare:workers";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type Database = {
  prepare: (query: string) => Statement;
};

type CacheRow = {
  video_id: string;
  title: string;
  channel_title: string;
  checked_at: string;
};

type ChannelResponse = {
  items?: Array<{
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
};

type PlaylistResponse = {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
};

type VideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      title?: string;
      channelTitle?: string;
      liveBroadcastContent?: "live" | "upcoming" | "none";
    };
    status?: { embeddable?: boolean };
    liveStreamingDetails?: { actualEndTime?: string };
  }>;
};

type Broadcast = {
  videoId: string;
  title: string;
  channelTitle: string;
  url: string;
};

const CHANNEL_HANDLE = "SekretariatPresiden";
const CACHE_MAX_AGE_MS = 120_000;
const cacheSchema = `CREATE TABLE IF NOT EXISTS youtube_live_cache (
  channel_handle TEXT PRIMARY KEY,
  video_id TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  channel_title TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL
)`;

function bindings() {
  return env as unknown as { DB?: Database; YOUTUBE_API_KEY?: string };
}

function serialize(row: CacheRow | null): Broadcast | null {
  if (!row?.video_id) return null;
  return {
    videoId: row.video_id,
    title: row.title,
    channelTitle: row.channel_title,
    url: `https://www.youtube.com/watch?v=${row.video_id}`,
  };
}

function youtubeUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function youtubeJson<T>(url: URL) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`YouTube API returned ${response.status}`);
  return (await response.json()) as T;
}

async function findLiveBroadcast(apiKey: string): Promise<Broadcast | null> {
  const channel = await youtubeJson<ChannelResponse>(youtubeUrl("channels", {
    part: "contentDetails",
    forHandle: CHANNEL_HANDLE,
    key: apiKey,
  }));
  const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("YouTube channel was not found");

  const playlist = await youtubeJson<PlaylistResponse>(youtubeUrl("playlistItems", {
    part: "contentDetails",
    playlistId: uploads,
    maxResults: "25",
    key: apiKey,
  }));
  const videoIds = playlist.items
    ?.map((item) => item.contentDetails?.videoId)
    .filter((id): id is string => Boolean(id)) ?? [];
  if (!videoIds.length) return null;

  const videos = await youtubeJson<VideosResponse>(youtubeUrl("videos", {
    part: "snippet,status,liveStreamingDetails",
    id: videoIds.join(","),
    key: apiKey,
  }));
  const byId = new Map(videos.items?.map((item) => [item.id, item]) ?? []);
  const active = videoIds
    .map((id) => byId.get(id))
    .find((video) =>
      video?.snippet?.liveBroadcastContent === "live" &&
      video.status?.embeddable !== false &&
      !video.liveStreamingDetails?.actualEndTime,
    );
  if (!active?.id) return null;
  return {
    videoId: active.id,
    title: active.snippet?.title || "Siaran langsung Sekretariat Presiden",
    channelTitle: active.snippet?.channelTitle || "Sekretariat Presiden",
    url: `https://www.youtube.com/watch?v=${active.id}`,
  };
}

export async function GET() {
  const { DB: db, YOUTUBE_API_KEY: apiKey } = bindings();
  if (!db || !apiKey) {
    return Response.json(
      { broadcast: null, configured: Boolean(apiKey) },
      { headers: { "cache-control": "no-store" } },
    );
  }

  await db.prepare(cacheSchema).run();
  const cached = await db.prepare(
    "SELECT video_id, title, channel_title, checked_at FROM youtube_live_cache WHERE channel_handle = ?",
  ).bind(CHANNEL_HANDLE).first<CacheRow>();
  const cacheAge = cached ? Date.now() - Date.parse(cached.checked_at) : Number.POSITIVE_INFINITY;
  if (cacheAge < CACHE_MAX_AGE_MS) {
    return Response.json(
      { broadcast: serialize(cached), configured: true },
      { headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const broadcast = await findLiveBroadcast(apiKey);
    const checkedAt = new Date().toISOString();
    await db.prepare(`INSERT INTO youtube_live_cache
      (channel_handle, video_id, title, channel_title, checked_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(channel_handle) DO UPDATE SET
        video_id = excluded.video_id,
        title = excluded.title,
        channel_title = excluded.channel_title,
        checked_at = excluded.checked_at`)
      .bind(
        CHANNEL_HANDLE,
        broadcast?.videoId || "",
        broadcast?.title || "",
        broadcast?.channelTitle || "",
        checkedAt,
      )
      .run();
    return Response.json(
      { broadcast, configured: true },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    console.error("Unable to check the YouTube channel", error);
    return Response.json(
      { broadcast: serialize(cached), configured: true, stale: Boolean(cached) },
      { headers: { "cache-control": "no-store" } },
    );
  }
}
