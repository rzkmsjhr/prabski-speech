"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Speech = {
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

function SpeechMap({ speech }: { speech: Speech | null }) {
  const latitude = speech?.latitude ?? -2.35;
  const longitude = speech?.longitude ?? 117.5;
  const latitudeSpan = speech ? 0.035 : 10;
  const longitudeSpan = speech ? 0.055 : 25;
  const bbox = [
    longitude - longitudeSpan,
    latitude - latitudeSpan,
    longitude + longitudeSpan,
    latitude + latitudeSpan,
  ].join(",");
  const marker = speech ? `&marker=${latitude}%2C${longitude}` : "";
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik${marker}`;

  return (
    <div className="map-frame">
      <iframe
        title={speech ? `Peta lokasi ${speech.venue}` : "Peta Indonesia"}
        src={mapUrl}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="map-overlay">
        <span>{speech ? "TITIK PIDATO BERIKUTNYA" : "MENUNGGU TITIK LOKASI"}</span>
        <strong>{speech ? speech.venue : "Indonesia"}</strong>
        <small>{speech ? speech.city : "Koordinat akan muncul setelah jadwal diterbitkan"}</small>
      </div>
    </div>
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
  const [speech, setSpeech] = useState<Speech | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [form, setForm] = useState<FormState>(initialForm);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function loadSpeech() {
    try {
      const response = await fetch("/api/speech", { cache: "no-store" });
      const data = (await response.json()) as { speech: Speech | null };
      setSpeech(data.speech);
      if (data.speech) {
        setForm((current) => formFromSpeech(data.speech as Speech, current.adminKey));
      }
    } catch {
      setMessage("Jadwal belum dapat dimuat. Coba segarkan halaman.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSpeech();
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const remaining = useMemo(
    () => (speech ? countdown(speech.startsAt, now) : null),
    [speech, now],
  );

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
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-admin-key": form.adminKey,
        },
        body: JSON.stringify({
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
      setSpeech(data.speech || null);
      if (data.speech) setForm((current) => formFromSpeech(data.speech as Speech, current.adminKey));
      setMessage("Jadwal berhasil diterbitkan.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Gagal menyimpan jadwal.");
    } finally {
      setSaving(false);
    }
  }

  async function clearSpeech() {
    if (!form.adminKey) {
      setMessage("Masukkan kunci admin terlebih dahulu.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/speech", {
        method: "DELETE",
        headers: { "x-admin-key": form.adminKey },
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "Gagal menghapus jadwal.");
      setSpeech(null);
      setForm((current) => ({ ...initialForm, adminKey: current.adminKey }));
      setMessage("Jadwal telah dikosongkan.");
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
              <h2>Lokasi pidato berikutnya</h2>
            </div>
            <span className="map-provider">OPENSTREETMAP</span>
          </div>
          <SpeechMap speech={speech} />
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
          ) : speech ? (
            <div className="event-content">
              <p className="event-date">{formatDate(speech.startsAt, speech.timeZone)}</p>
              <h3>{speech.title}</h3>
              <div className="event-meta">
                <div><span>WAKTU</span><strong>{formatTime(speech.startsAt, speech.timeZone)} {zoneLabels[speech.timeZone] || ""}</strong></div>
                <div><span>LOKASI</span><strong>{speech.venue}</strong><small>{speech.city}</small></div>
              </div>
              {speech.notes && <p className="event-notes">{speech.notes}</p>}
              {speech.sourceUrl && <a className="source-link" href={speech.sourceUrl} target="_blank" rel="noreferrer">Lihat sumber jadwal ↗</a>}
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
              <div><strong>Belum ada jadwal yang diterbitkan</strong><p>Gunakan panel editor di bawah saat Anda menemukan agenda berikutnya.</p></div>
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

      {speech?.youtubeUrl && <YouTubeLive url={speech.youtubeUrl} />}

      <section className="editor shell">
        <details>
          <summary><span><b>＋</b> Kelola jadwal pidato</span><small>KHUSUS ADMIN</small></summary>
          <form onSubmit={submitSpeech}>
            <div className="form-intro">
              <div><h2>{speech ? "Edit agenda aktif" : "Terbitkan agenda berikutnya"}</h2>{speech && <button className="load-current" type="button" onClick={() => setForm((current) => formFromSpeech(speech, current.adminKey))}>Muat ulang data aktif</button>}</div>
              <p>{speech ? "Data aktif sudah dimuat ke formulir. Ubah bagian yang diperlukan, lalu tekan Terbitkan jadwal untuk memperbaruinya." : "Isi data yang sudah Anda verifikasi. Jadwal terakhir akan langsung menggantikan jadwal sebelumnya."}</p>
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
            <div className="form-actions"><button className="primary" disabled={saving}>{saving ? "Menyimpan…" : "Terbitkan jadwal"}</button><button className="secondary" type="button" disabled={saving || !speech} onClick={clearSpeech}>Kosongkan jadwal</button>{message && <p role="status">{message}</p>}</div>
          </form>
        </details>
      </section>

      <footer className="shell"><p><strong>Prabowo Speech Watch</strong> — pembaruan agenda dimasukkan secara manual.</p><p>Kurs bersifat informatif, bukan saran finansial.</p></footer>
    </main>
  );
}
