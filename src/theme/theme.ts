export const THEME_MODE = {
  AUTO: 'auto',
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type ThemeMode = (typeof THEME_MODE)[keyof typeof THEME_MODE];

/** The resolved theme is always a concrete value — never 'auto'. */
export type ResolvedTheme = 'light' | 'dark';

export function getSystemTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Daytime heuristic:
 * - light: 06:00–17:59
 * - dark: 18:00–05:59
 */
export function resolveThemeFromTime({
  now = new Date(),
  timeZone,
}: {
  now?: Date;
  timeZone?: string;
}): ResolvedTheme {
  const tz = timeZone || getSystemTimeZone();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '0';
  const hour = Number(hourStr);
  const isDay = Number.isFinite(hour) && hour >= 6 && hour < 18;
  return isDay ? THEME_MODE.LIGHT : THEME_MODE.DARK;
}
