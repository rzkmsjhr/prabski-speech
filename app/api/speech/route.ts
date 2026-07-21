import { env } from "cloudflare:workers";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T>() => Promise<T | null>;
  all: <T>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};

type Database = {
  prepare: (query: string) => Statement;
  batch: (statements: Statement[]) => Promise<unknown>;
};

type ColumnRow = { name: string };
type TableDefinition = { sql: string | null };

type SpeechRow = {
  id: number;
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

type SpeechInput = {
  title: string;
  venue: string;
  city: string;
  startsAt: string;
  timeZone: string;
  notes: string;
  sourceUrl: string;
  latitude: number;
  longitude: number;
  youtubeUrl: string;
};

const schema = `CREATE TABLE IF NOT EXISTS speech_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
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

let databaseReady: Promise<Database> | null = null;

async function initializeDatabase() {
  const db = bindings().DB;
  if (!db) throw new Error("Database belum tersedia.");
  await db.prepare(schema).run();
  const existingColumns = await db.prepare("PRAGMA table_info(speech_schedule)").all<ColumnRow>();
  const columnNames = new Set(existingColumns.results.map((column) => column.name));
  const additions = [
    ["latitude", "ALTER TABLE speech_schedule ADD COLUMN latitude REAL NOT NULL DEFAULT 0"],
    ["longitude", "ALTER TABLE speech_schedule ADD COLUMN longitude REAL NOT NULL DEFAULT 0"],
    ["youtube_url", "ALTER TABLE speech_schedule ADD COLUMN youtube_url TEXT NOT NULL DEFAULT ''"],
  ] as const;
  for (const [column, sql] of additions) {
    if (!columnNames.has(column)) await db.prepare(sql).run();
  }
  const definition = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'speech_schedule'").first<TableDefinition>();
  if (definition?.sql && /CHECK\s*\(\s*id\s*=\s*1\s*\)/i.test(definition.sql)) {
    await db.batch([
      db.prepare("DROP TABLE IF EXISTS speech_schedule_repaired"),
      db.prepare(`CREATE TABLE speech_schedule_repaired (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      )`),
      db.prepare(`INSERT INTO speech_schedule_repaired
        (id, title, venue, city, starts_at, time_zone, notes, source_url, latitude, longitude, youtube_url, updated_at)
        SELECT id, title, venue, city, starts_at, time_zone, notes, source_url, latitude, longitude, youtube_url, updated_at
        FROM speech_schedule`),
      db.prepare("DROP TABLE speech_schedule"),
      db.prepare("ALTER TABLE speech_schedule_repaired RENAME TO speech_schedule"),
    ]);
  }
  return db;
}

function database() {
  if (!databaseReady) {
    databaseReady = initializeDatabase().catch((error) => {
      databaseReady = null;
      throw error;
    });
  }
  return databaseReady;
}

function serialize(row: SpeechRow) {
  return {
    id: row.id,
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

function validate(input: Record<string, unknown>): { data?: SpeechInput; error?: string } {
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
    return { error: "Lengkapi judul, lokasi, kota, tanggal, dan waktu." };
  }
  if (!Object.hasOwn({ "Asia/Jakarta": 1, "Asia/Makassar": 1, "Asia/Jayapura": 1 }, timeZone)) {
    return { error: "Zona waktu tidak dikenali." };
  }
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return { error: "Tautan sumber harus diawali http:// atau https://." };
  }
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { error: "Koordinat latitude atau longitude tidak valid." };
  }
  if (youtubeUrl) {
    try {
      const url = new URL(youtubeUrl);
      const host = url.hostname.replace(/^www\./, "");
      if (!["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) throw new Error();
    } catch {
      return { error: "Tautan YouTube tidak valid." };
    }
  }
  return { data: { title, venue, city, startsAt, timeZone, notes, sourceUrl, latitude, longitude, youtubeUrl } };
}

export async function GET() {
  try {
    const db = await database();
    const result = await db.prepare("SELECT * FROM speech_schedule ORDER BY starts_at ASC, id ASC").all<SpeechRow>();
    return Response.json({ speeches: result.results.map(serialize) }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ speeches: [] }, { headers: { "cache-control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Kunci admin tidak valid." }, { status: 401 });
  try {
    const parsed = validate((await request.json()) as Record<string, unknown>);
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });
    const data = parsed.data;
    const updatedAt = new Date().toISOString();
    const db = await database();
    const row = await db.prepare(`INSERT INTO speech_schedule (title, venue, city, starts_at, time_zone, notes, source_url, latitude, longitude, youtube_url, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`)
      .bind(data.title, data.venue, data.city, data.startsAt, data.timeZone, data.notes, data.sourceUrl, data.latitude, data.longitude, data.youtubeUrl, updatedAt)
      .first<SpeechRow>();
    if (!row) throw new Error();
    return Response.json({ speech: serialize(row) }, { status: 201 });
  } catch (error) {
    console.error("Unable to create speech schedule", error);
    return Response.json({ error: "Jadwal belum dapat disimpan." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Kunci admin tidak valid." }, { status: 401 });
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const id = Number(input.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Jadwal tidak dikenali." }, { status: 400 });
    const parsed = validate(input);
    if (!parsed.data) return Response.json({ error: parsed.error }, { status: 400 });
    const data = parsed.data;
    const updatedAt = new Date().toISOString();
    const db = await database();
    const row = await db.prepare(`UPDATE speech_schedule SET title = ?, venue = ?, city = ?, starts_at = ?, time_zone = ?, notes = ?,
      source_url = ?, latitude = ?, longitude = ?, youtube_url = ?, updated_at = ? WHERE id = ? RETURNING *`)
      .bind(data.title, data.venue, data.city, data.startsAt, data.timeZone, data.notes, data.sourceUrl, data.latitude, data.longitude, data.youtubeUrl, updatedAt, id)
      .first<SpeechRow>();
    if (!row) return Response.json({ error: "Jadwal tidak ditemukan." }, { status: 404 });
    return Response.json({ speech: serialize(row) });
  } catch (error) {
    console.error("Unable to update speech schedule", error);
    return Response.json({ error: "Jadwal belum dapat diperbarui." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Kunci admin tidak valid." }, { status: 401 });
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Jadwal tidak dikenali." }, { status: 400 });
    const db = await database();
    await db.prepare("DELETE FROM speech_schedule WHERE id = ?").bind(id).run();
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Unable to delete speech schedule", error);
    return Response.json({ error: "Jadwal belum dapat dihapus." }, { status: 500 });
  }
}
