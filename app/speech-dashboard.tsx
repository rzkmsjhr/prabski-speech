"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Speech = {
  id: number;
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
  updatedAt: string;
};

type FormState = {
  adminKey: string;
  title: string;
  venue: string;
  city: string;
  date: string;
  time: string;
  timeZone: string;
  notes: string;
  sourceUrl: string;
  latitude: string;
  longitude: string;
  youtubeUrl: string;
};

const initialForm: FormState = {
  adminKey: "",
  title: "",
  venue: "",
  city: "",
  date: "",
  time: "",
  timeZone: "Asia/Jakarta",
  notes: "",
  sourceUrl: "",
  latitude: "",
  longitude: "",
  youtubeUrl: "",
};

const zoneOffsets: Record<string, string> = {
  "Asia/Jakarta": "+07:00",
  "Asia/Makassar": "+08:00",
  "Asia/Jayapura": "+09:00",
};

const zoneLabels: Record<string, string> = {
  "Asia/Jakarta": "WIB",
  "Asia/Makassar": "WITA",
  "Asia/Jayapura": "WIT",
};

function formatDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(value));
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(new Date(value));
}

function countdown(target: string, now: number) {
  const difference = Math.max(0, new Date(target).getTime() - now);
  const days = Math.floor(difference / 86_400_000);
  const hours = Math.floor((difference / 3_600_000) % 24);
  const minutes = Math.floor((difference / 60_000) % 60);
  const seconds = Math.floor((difference / 1_000) % 60);
  return { days, hours, minutes, seconds, passed: difference === 0 };
}

function dateFields(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).formatToParts(new Date(value));
  const part = (name: string) => parts.find((item) => item.type === name)?.value || "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour")}:${part("minute")}` };
}

function formFromSpeech(speech: Speech, adminKey = ""): FormState {
  const dateTime = dateFields(speech.startsAt, speech.timeZone);
  return {
    adminKey,
    title: speech.title,
    venue: speech.venue,
    city: speech.city,
    date: dateTime.date,
    time: dateTime.time,
    timeZone: speech.timeZone,
    notes: speech.notes,
    sourceUrl: speech.sourceUrl,
    latitude: String(speech.latitude),
    longitude: String(speech.longitude),
    youtubeUrl: speech.youtubeUrl,
  };
}

function youtubeVideoId(url: string) {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return parsed.pathname.split("/").filter(Boolean)[0] || "";
    if (host !== "youtube.com" && host !== "m.youtube.com") return "";
    if (parsed.searchParams.get("v")) return parsed.searchParams.get("v") || "";
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (["live", "embed", "shorts"].includes(parts[0])) return parts[1] || "";
  } catch {
    return "";
  }
  return "";
}

function TradingViewChart() {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    container.current.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbols: [["Dolar AS / Rupiah", "FX_IDC:USDIDR|1D"]],
      chartOnly: false,
      width: "100%",
      height: "100%",
      locale: "id",
      colorTheme: "light",
      backgroundColor: "#fffdf7",
      gridColor: "rgba(27, 36, 31, 0.07)",
      widgetFontColor: "#18211d",
      fontColor: "#65716a",
      chartType: "area",
      lineColor: "#b91f2e",
      topColor: "rgba(185, 31, 46, 0.18)",
      bottomColor: "rgba(185, 31, 46, 0.02)",
      lineWidth: 2,
      showVolume: false,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: "right",
      scaleMode: "Normal",
      valuesTracking: "1",
      changeMode: "price-and-percent",
      dateRanges: ["1d|5", "1m|30", "3m|60", "12m|1D", "all|1M"],
    });
    container.current.append(widget, script);
  }, []);

  return <div ref={container} className="tradingview-widget-container chart-frame" aria-label="Grafik langsung kurs Dolar Amerika Serikat terhadap Rupiah Indonesia" />;
}

function SpeechMap({ speeches }: { speeches: Speech[] }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    let cancelled = false;
    let map: import("leaflet").Map | undefined;

    import("leaflet").then((leaflet) => {
      if (cancelled || !container.current) return;
      map = leaflet.map(container.current, { scrollWheelZoom: false, zoomControl: true }).setView([-2.35, 117.5], 5);
      leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const currentTime = Date.now();
      const upcoming = speeches.filter((item) => new Date(item.startsAt).getTime() >= currentTime);
      const nextId = upcoming[0]?.id;
      const points: [number, number][] = [];
      speeches.forEach((item) => {
        const point: [number, number] = [item.latitude, item.longitude];
        points.push(point);
        const isPast = new Date(item.startsAt).getTime() < currentTime;
        const color = item.id === nextId ? "#b91f2e" : isPast ? "#7d857f" : "#167453";
        const marker = leaflet.circleMarker(point, {
          radius: item.id === nextId ? 10 : 8,
          color: "#fffdf7",
          weight: 3,
          fillColor: color,
          fillOpacity: 1,
        }).addTo(map!);
        const popup = document.createElement("div");
        const title = document.createElement("strong");
        const detail = document.createElement("p");
        title.textContent = item.title;
        detail.textContent = `${formatDate(item.startsAt, item.timeZone)} · ${formatTime(item.startsAt, item.timeZone)} ${zoneLabels[item.timeZone] || ""} · ${item.venue}, ${item.city}`;
        popup.append(title, detail);
        marker.bindPopup(popup);
      });
      if (points.length === 1) map.setView(points[0], 12);
      if (points.length > 1) map.fitBounds(points, { padding: [45, 45], maxZoom: 12 });
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [speeches]);

  return (
    <div className="map-frame">
      <div ref={container} className="leaflet-map" aria-label="Peta seluruh lokasi pidato" />
      <div className="map-overlay">
        <span>PETA SELURUH AGENDA</span>
        <strong>{speeches.length} titik lokasi</strong>
        <small>Merah: agenda berikutnya · Hijau: mendatang · Abu-abu: selesai</small>
      </div>
    </div>
  );
}

function AgendaRow({ speech, label }: { speech: Speech; label?: string }) {
  return (
    <article className="agenda-row">
      <div className="agenda-date"><strong>{new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", timeZone: speech.timeZone }).format(new Date(speech.startsAt))}</strong><span>{formatTime(speech.startsAt, speech.timeZone)} {zoneLabels[speech.timeZone] || ""}</span></div>
      <div className="agenda-main"><div>{label && <span className="agenda-label">{label}</span>}<h3>{speech.title}</h3></div><p>{speech.venue} · {speech.city}</p></div>
      {speech.youtubeUrl && <span className="agenda-video">YOUTUBE</span>}
    </article>
  );
}

function YouTubeLive({ url }: { url: string }) {
  const videoId = youtubeVideoId(url);
  if (!videoId) return null;
  return (
    <section className="youtube-section shell" aria-label="Siaran langsung YouTube">
      <article className="youtube-card">
        <div className="card-heading youtube-heading">
          <div>
            <p className="section-kicker">SIARAN RESMI</p>
            <h2>YouTube Live</h2>
          </div>
          <span className="youtube-live"><i /> LIVE STREAM</span>
        </div>
        <div className="youtube-frame">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
            title="Siaran langsung pidato di YouTube"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </article>
    </section>
  );
}

export function SpeechDashboard() {
  const [speeches, setSpeeches] = useState<Speech[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState<FormState>(initialForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadSpeeches() {
    try {
      const response = await fetch("/api/speech", { cache: "no-store" });
      const data = (await response.json()) as { speeches: Speech[] };
      setSpeeches(data.speeches || []);
    } catch {
      setMessage("Jadwal belum dapat dimuat. Coba segarkan halaman.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpeeches();
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const upcoming = useMemo(() => speeches.filter((item) => new Date(item.startsAt).getTime() >= now), [speeches, now]);
  const past = useMemo(() => speeches.filter((item) => new Date(item.startsAt).getTime() < now).reverse(), [speeches, now]);
  const nextSpeech = upcoming[0] || null;
  const streamingSpeech = upcoming.find((item) => item.youtubeUrl) || null;
  const remaining = useMemo(() => (nextSpeech ? countdown(nextSpeech.startsAt, now) : null), [nextSpeech, now]);

  function updateField(name: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submitSpeech(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const startsAt = `${form.date}T${form.time}:00${zoneOffsets[form.timeZone]}`;
      const response = await fetch("/api/speech", {
        method: editingId ? "PUT" : "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-key": form.adminKey,
        },
        body: JSON.stringify({
          id: editingId,
          title: form.title,
          venue: form.venue,
          city: form.city,
          startsAt,
          timeZone: form.timeZone,
          notes: form.notes,
          sourceUrl: form.sourceUrl,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          youtubeUrl: form.youtubeUrl,
        }),
      });
      const data = (await response.json()) as { speech?: Speech; error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal menyimpan jadwal.");
      await loadSpeeches();
      const action = editingId ? "diperbarui" : "ditambahkan";
      setEditingId(null);
      setForm((current) => ({ ...initialForm, adminKey: current.adminKey }));
      setMessage(`Jadwal berhasil ${action}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan jadwal.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(speech: Speech) {
    setEditingId(speech.id);
    setForm((current) => formFromSpeech(speech, current.adminKey));
    setMessage(`Mengedit: ${speech.title}`);
  }

  function beginCreate() {
    setEditingId(null);
    setForm((current) => ({ ...initialForm, adminKey: current.adminKey }));
    setMessage("Formulir siap untuk jadwal baru.");
  }

  async function deleteSpeech(speech: Speech) {
    if (!form.adminKey) {
      setMessage("Masukkan kunci admin terlebih dahulu.");
      return;
    }
    if (!window.confirm(`Hapus jadwal “${speech.title}”?`)) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/speech?id=${speech.id}`, {
        method: "DELETE",
        headers: { "x-admin-key": form.adminKey },
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal menghapus jadwal.");
      await loadSpeeches();
      if (editingId === speech.id) beginCreate();
      setMessage("Jadwal telah dihapus.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menghapus jadwal.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main>
      <div className="top-rule" />
      <header className="masthead shell">
        <a className="brand" href="#top" aria-label="Pulang ke bagian atas">
          <span className="brand-mark">PS</span>
          <span>
            <strong>Prabowo Speech Watch</strong>
            <small>Pantau agenda pidato berikutnya</small>
          </span>
        </a>
        <div className="live-badge"><span /> PEMBARUAN LANGSUNG</div>
      </header>

      <section id="top" className="hero shell">
        <div className="hero-copy">
          <p className="eyebrow">AGENDA PRESIDEN REPUBLIK INDONESIA</p>
          <h1>Pidato berikutnya.<br /><em>Satu pandangan.</em></h1>
          <p className="lede">Jadwal, lokasi, hitung mundur, dan pergerakan Rupiah—diringkas dalam satu layar yang tenang dan mudah dibaca.</p>
        </div>
        <div className="flag-panel" aria-hidden="true"><span>08</span><b>INDONESIA</b></div>
      </section>

      <section className="map-section shell" aria-label="Peta lokasi pidato">
        <article className="map-card">
          <div className="card-heading map-heading">
            <div>
              <p className="section-kicker">PETA AGENDA</p>
              <h2>Seluruh lokasi pidato</h2>
            </div>
            <span className="map-provider">OPENSTREETMAP</span>
          </div>
          <SpeechMap speeches={speeches} />
        </article>
      </section>

      <section className="dashboard shell" aria-label="Ringkasan utama">
        <article className="speech-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">AGENDA TERDEKAT</p>
              <h2>Pidato selanjutnya</h2>
            </div>
            <span className="verified">● TERVERIFIKASI MANUAL</span>
          </div>

          {loading ? (
            <div className="empty-state"><span className="loader" /> Memuat jadwal…</div>
          ) : nextSpeech ? (
            <div className="event-content">
              <p className="event-date">{formatDate(nextSpeech.startsAt, nextSpeech.timeZone)}</p>
              <h3>{nextSpeech.title}</h3>
              <div className="event-meta">
                <div><span>WAKTU</span><strong>{formatTime(nextSpeech.startsAt, nextSpeech.timeZone)} {zoneLabels[nextSpeech.timeZone] || ""}</strong></div>
                <div><span>LOKASI</span><strong>{nextSpeech.venue}</strong><small>{nextSpeech.city}</small></div>
              </div>
              {nextSpeech.notes && <p className="event-notes">{nextSpeech.notes}</p>}
              {nextSpeech.sourceUrl && <a className="source-link" href={nextSpeech.sourceUrl} target="_blank" rel="noreferrer">Lihat sumber jadwal ↗</a>}
              {remaining && (
                <div className="countdown" aria-label="Hitung mundur menuju acara">
                  {remaining.passed ? <p className="event-started">Waktu acara telah tiba</p> : [
                    [remaining.days, "HARI"],
                    [remaining.hours, "JAM"],
                    [remaining.minutes, "MENIT"],
                    [remaining.seconds, "DETIK"],
                  ].map(([value, label]) => <div key={String(label)}><strong>{String(value).padStart(2, "0")}</strong><span>{label}</span></div>)}
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state no-event">
              <span className="calendar-icon">—</span>
              <div><strong>Belum ada agenda mendatang</strong><p>Tambahkan jadwal baru melalui panel pengelolaan di bawah.</p></div>
            </div>
          )}
        </article>

        <article className="currency-card">
          <div className="card-heading">
            <div>
              <p className="section-kicker">PASAR VALUTA ASING</p>
              <h2>USD / IDR</h2>
            </div>
            <span className="market-live"><i /> LIVE</span>
          </div>
          <p className="chart-note">Pergerakan Dolar AS terhadap Rupiah Indonesia. Grafik diperbarui langsung oleh TradingView.</p>
          <TradingViewChart />
        </article>
      </section>

      <section className="agenda-section shell" aria-label="Daftar seluruh agenda pidato">
        <div className="agenda-heading">
          <div><p className="section-kicker">KALENDER PIDATO</p><h2>Seluruh jadwal</h2></div>
          <div className="agenda-count"><strong>{upcoming.length}</strong><span>MENDATANG</span></div>
        </div>
        <div className="agenda-list">
          {upcoming.length ? upcoming.map((item, index) => <AgendaRow key={item.id} speech={item} label={index === 0 ? "BERIKUTNYA" : undefined} />) : <p className="agenda-empty">Belum ada jadwal mendatang.</p>}
        </div>
        {past.length > 0 && <details className="past-agenda"><summary>Lihat {past.length} agenda yang telah selesai</summary><div className="agenda-list past-list">{past.map((item) => <AgendaRow key={item.id} speech={item} label="SELESAI" />)}</div></details>}
      </section>

      {streamingSpeech && <YouTubeLive url={streamingSpeech.youtubeUrl} />}

      <section className="editor shell">
        <details>
          <summary><span><b>＋</b> Kelola semua jadwal</span><small>KHUSUS ADMIN</small></summary>
          <form onSubmit={submitSpeech}>
            <div className="schedule-manager">
              <div className="manager-heading"><div><p className="section-kicker">DATA TERSIMPAN</p><h2>{speeches.length} jadwal</h2></div><button type="button" className="primary compact" onClick={beginCreate}>＋ Tambah baru</button></div>
              <div className="manager-list">
                {speeches.length ? speeches.map((item) => <div className={`manager-row ${editingId === item.id ? "is-editing" : ""}`} key={item.id}><div><strong>{item.title}</strong><span>{formatDate(item.startsAt, item.timeZone)} · {formatTime(item.startsAt, item.timeZone)} {zoneLabels[item.timeZone] || ""} · {item.city}</span></div><div><button type="button" onClick={() => beginEdit(item)}>Edit</button><button type="button" className="danger" onClick={() => deleteSpeech(item)} disabled={saving}>Hapus</button></div></div>) : <p className="manager-empty">Belum ada jadwal tersimpan.</p>}
              </div>
            </div>
            <div className="form-intro">
              <div><h2>{editingId ? "Edit jadwal" : "Tambah jadwal baru"}</h2>{editingId && <button className="load-current" type="button" onClick={() => { const item = speeches.find((entry) => entry.id === editingId); if (item) beginEdit(item); }}>Muat ulang data</button>}</div>
              <p>{editingId ? "Ubah data yang diperlukan, lalu simpan untuk memperbarui jadwal ini." : "Isi satu agenda. Setelah tersimpan, Anda dapat menambah agenda berikutnya tanpa mengganti data sebelumnya."}</p>
            </div>
            <div className="form-grid">
              <label className="wide">Kunci admin<input type="password" value={form.adminKey} onChange={(e) => updateField("adminKey", e.target.value)} autoComplete="current-password" required /></label>
              <label className="wide">Judul / agenda pidato<input value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="Contoh: Pidato Kenegaraan" required maxLength={140} /></label>
              <label>Nama tempat<input value={form.venue} onChange={(e) => updateField("venue", e.target.value)} placeholder="Gedung / alun-alun" required maxLength={120} /></label>
              <label>Kota / provinsi<input value={form.city} onChange={(e) => updateField("city", e.target.value)} placeholder="Jakarta" required maxLength={120} /></label>
              <label>Tanggal<input type="date" value={form.date} onChange={(e) => updateField("date", e.target.value)} required /></label>
              <label>Waktu<input type="time" value={form.time} onChange={(e) => updateField("time", e.target.value)} required /></label>
              <label>Zona waktu<select value={form.timeZone} onChange={(e) => updateField("timeZone", e.target.value)}><option value="Asia/Jakarta">WIB (UTC+7)</option><option value="Asia/Makassar">WITA (UTC+8)</option><option value="Asia/Jayapura">WIT (UTC+9)</option></select></label>
              <label>Tautan sumber (opsional)<input type="url" value={form.sourceUrl} onChange={(e) => updateField("sourceUrl", e.target.value)} placeholder="https://…" /></label>
              <label>Latitude<input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(e) => updateField("latitude", e.target.value)} placeholder="-6.1754" required /></label>
              <label>Longitude<input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(e) => updateField("longitude", e.target.value)} placeholder="106.8272" required /></label>
              <label className="wide">Tautan YouTube Live (opsional)<input type="url" value={form.youtubeUrl} onChange={(e) => updateField("youtubeUrl", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /><small className="field-help">Kosongkan agar bagian siaran langsung tidak ditampilkan.</small></label>
              <label className="wide">Catatan (opsional)<textarea value={form.notes} onChange={(e) => updateField("notes", e.target.value)} placeholder="Informasi akses, siaran, atau konteks singkat" maxLength={500} /></label>
            </div>
            <div className="form-actions"><button className="primary" disabled={saving}>{saving ? "Menyimpan…" : editingId ? "Simpan perubahan" : "Tambahkan jadwal"}</button>{editingId && <button className="secondary" type="button" disabled={saving} onClick={beginCreate}>Batal edit</button>}{message && <p role="status">{message}</p>}</div>
          </form>
        </details>
      </section>

      <footer className="shell"><p><strong>Prabowo Speech Watch</strong> — pembaruan agenda dimasukkan secara manual.</p><p>Kurs bersifat informatif, bukan saran finansial.</p></footer>
    </main>
  );
}
