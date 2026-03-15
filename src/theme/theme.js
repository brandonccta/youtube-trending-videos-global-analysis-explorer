export const THEME_MODE = /** @type {const} */ ({
  AUTO: 'auto',
  DAY: 'day',
  NIGHT: 'night',
});

export function getSystemTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Daytime heuristic:
 * - day: 06:00–17:59
 * - night: 18:00–05:59
 *
 * you can later swap this for sun-rise/set by lat/lng if you want.
 */
export function resolveThemeFromTime({ now = new Date(), timeZone }) {
  const tz = timeZone || getSystemTimeZone();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hourStr = parts.find(p => p.type === 'hour')?.value ?? '0';
  const hour = Number(hourStr);
  const isDay = Number.isFinite(hour) && hour >= 6 && hour < 18;
  return isDay ? THEME_MODE.DAY : THEME_MODE.NIGHT;
}
