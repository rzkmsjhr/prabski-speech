import { env } from "cloudflare:workers";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
  run: () => Promise<unknown>;
};

type Database = { prepare: (query: string) => Statement };

type SpeechRow = {
  title: string;
  venue: string;
  city: string;
  starts_at: string;
  time_zone: string;
  notes: string;
  source_url: string;
  latitude: number;
  longitude: number;
  youtube_url: string;
  updated_at: string;
};

const schema = `CREATE TABLE IF NOT EXISTS speech_schedule (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  source_url TEXT NOT NULL DEFAULT '',
  latitude REAL NOT NULL DEFAULT 0,
  longitude REAL NOT NULL DEFAULT 0,
  youtube_url TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
)`;

function bindings() {
  return env as unknown as { DB?: Database; ADMIN_KEY?: string };
}

async function database() {
  const db = bindings().DB;
  if (!db) throw new Error("Database belum tersedia.");
  await db.prepare(schema).run();
  return db;
}

function serialize(row: SpeechRow | null) {
  if (!row) return null;
  return {
    title: row.title,
    venue: row.venue,
    city: row.city,
    startsAt: row.starts_at,
    timeZone: row.time_zone,
    notes: row.notes,
    sourceUrl: row.source_url,
    latitude: row.latitude,
    longitude: row.longitude,
    youtubeUrl: row.youtube_url,
    updatedAt: row.updated_at,
  };
}

function authorized(request: Request) {
  const expected = bindings().ADMIN_KEY;
  return Boolean(expected && request.headers.get("x-admin-key") === expected);
}

export async function GET() {
  try {
    const db = await database();
    const row = await db.prepare("SELECT * FROM speech_schedule WHERE id = 1").first<SpeechRow>();
    return Response.json({ speech: serialize(row) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ speech: null }, { headers: { "cache-control": "no-store" } });
  }
}

export async function PUT(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Kunci admin tidak valid." }, { status: 401 });
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const title = String(input.title || "").trim().slice(0, 140);
    const venue = String(input.venue || "").trim().slice(0, 120);
    const city = String(input.city || "").trim().slice(0, 120);
    const startsAt = String(input.startsAt || "");
    const timeZone = String(input.timeZone || "Asia/Jakarta");
    const notes = String(input.notes || "").trim().slice(0, 500);
    const sourceUrl = String(input.sourceUrl || "").trim().slice(0, 500);
    const latitude = Number(input.latitude);
    const longitude = Number(input.longitude);
    const youtubeUrl = String(input.youtubeUrl || "").trim().slice(0, 500);
    if (!title || !venue || !city || Number.isNaN(Date.parse(startsAt))) {
      return Response.json({ error: "Lengkapi judul, lokasi, kota, tanggal, dan waktu." }, { status: 400 });
    }
    if (!Object.hasOwn({ "Asia/Jakarta": 1, "Asia/Makassar": 1, "Asia/Jayapura": 1 }, timeZone)) {
      return Response.json({ error: "Zona waktu tidak dikenali." }, { status: 400 });
    }
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      return Response.json({ error: "Tautan sumber harus diawali http:// atau https://." }, { status: 400 });
    }
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      return Response.json({ error: "Koordinat latitude atau longitude tidak valid." }, { status: 400 });
    }
    if (youtubeUrl) {
      try {
        const url = new URL(youtubeUrl);
        const host = url.hostname.replace(/^www\./, "");
        if (!["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) throw new Error();
      } catch {
        return Response.json({ error: "Tautan YouTube tidak valid." }, { status: 400 });
      }
    }
    const updatedAt = new Date().toISOString();
    const db = await database();
    await db.prepare(`INSERT INTO speech_schedule (id, title, venue, city, starts_at, time_zone, notes, source_url, latitude, longitude, youtube_url, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET title = excluded.title, venue = excluded.venue, city = excluded.city,
      starts_at = excluded.starts_at, time_zone = excluded.time_zone, notes = excluded.notes,
      source_url = excluded.source_url, latitude = excluded.latitude, longitude = excluded.longitude,
      youtube_url = excluded.youtube_url, updated_at = excluded.updated_at`)
      .bind(title, venue, city, startsAt, timeZone, notes, sourceUrl, latitude, longitude, youtubeUrl, updatedAt).run();
    return Response.json({ speech: { title, venue, city, startsAt, timeZone, notes, sourceUrl, latitude, longitude, youtubeUrl, updatedAt } });
  } catch {
    return Response.json({ error: "Jadwal belum dapat disimpan." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Kunci admin tidak valid." }, { status: 401 });
  try {
    const db = await database();
    await db.prepare("DELETE FROM speech_schedule WHERE id = 1").run();
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Jadwal belum dapat dihapus." }, { status: 500 });
  }
}
