const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1_000;
const OPEN_HOUR = 7;
const CLOSE_HOUR = 20;
const WEEKDAY_INTERVAL_MS = 5 * 60 * 1_000;
const WEEKEND_INTERVAL_MS = 30 * 60 * 1_000;

export type YouTubeMonitorSchedule = {
  isOpen: boolean;
  isWeekend: boolean;
  intervalMs: number;
  nextActionAt: number;
};

function jakartaTimeAsUtc(nowMs: number) {
  return new Date(nowMs + JAKARTA_OFFSET_MS);
}

function jakartaWallClockToUtc(year: number, month: number, day: number, hour: number) {
  return Date.UTC(year, month, day, hour) - JAKARTA_OFFSET_MS;
}

export function youtubeMonitorSchedule(nowMs = Date.now()): YouTubeMonitorSchedule {
  const jakartaNow = jakartaTimeAsUtc(nowMs);
  const year = jakartaNow.getUTCFullYear();
  const month = jakartaNow.getUTCMonth();
  const day = jakartaNow.getUTCDate();
  const hour = jakartaNow.getUTCHours();
  const dayOfWeek = jakartaNow.getUTCDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const intervalMs = isWeekend ? WEEKEND_INTERVAL_MS : WEEKDAY_INTERVAL_MS;
  const opensAt = jakartaWallClockToUtc(year, month, day, OPEN_HOUR);
  const closesAt = jakartaWallClockToUtc(year, month, day, CLOSE_HOUR);
  const isOpen = hour >= OPEN_HOUR && hour < CLOSE_HOUR;

  if (isOpen) {
    return {
      isOpen,
      isWeekend,
      intervalMs,
      nextActionAt: Math.min(nowMs + intervalMs, closesAt),
    };
  }

  return {
    isOpen,
    isWeekend,
    intervalMs,
    nextActionAt: hour < OPEN_HOUR
      ? opensAt
      : jakartaWallClockToUtc(year, month, day + 1, OPEN_HOUR),
  };
}
