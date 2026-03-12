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
 * - Day: 06:00–17:59
 * - Night: 18:00–05:59
 *
 * You can later swap this for sun-rise/set by lat/lng if you want.
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

export function readStoredThemeMode() {
  try {
    const v = localStorage.getItem('ge_theme_mode');
    if (v === THEME_MODE.AUTO || v === THEME_MODE.DAY || v === THEME_MODE.NIGHT) return v;
  } catch {
    // ignore
  }
  return THEME_MODE.AUTO;
}

export function storeThemeMode(mode) {
  try {
    localStorage.setItem('ge_theme_mode', mode);
  } catch {
    // ignore
  }
}

