import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { THEME_MODE, getSystemTimeZone, readStoredThemeMode, resolveThemeFromTime, storeThemeMode } from './theme';

const ThemeContext = createContext(null);

function applyResolvedThemeToDom(resolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme; // 'day' | 'night'
}

function useAutoThemeTimer({ enabled, timeZone, onTick }) {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => onTickRef.current?.();

    // Tick immediately, then align to the next minute boundary for stability.
    tick();
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    let intervalId;
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, Math.max(250, msToNextMinute));

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [enabled, timeZone]); // re-align if timezone changes
}

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => readStoredThemeMode()); // 'auto' | 'day' | 'night'
  const [timeZone] = useState(() => getSystemTimeZone());
  const [resolvedTheme, setResolvedTheme] = useState(() => {
    return mode === THEME_MODE.AUTO ? resolveThemeFromTime({ timeZone }) : mode;
  });

  // Keep resolved theme updated if mode changes.
  useEffect(() => {
    const nextResolved = mode === THEME_MODE.AUTO ? resolveThemeFromTime({ timeZone }) : mode;
    setResolvedTheme(nextResolved);
  }, [mode, timeZone]);

  // Auto timer only when mode === auto
  useAutoThemeTimer({
    enabled: mode === THEME_MODE.AUTO,
    timeZone,
    onTick: () => setResolvedTheme(resolveThemeFromTime({ timeZone })),
  });

  // Apply to DOM
  useEffect(() => {
    applyResolvedThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  // Persist mode
  useEffect(() => {
    storeThemeMode(mode);
  }, [mode]);

  const value = useMemo(() => ({
    mode,
    setMode,
    resolvedTheme, // 'day' | 'night'
    timeZone,
  }), [mode, resolvedTheme, timeZone]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

