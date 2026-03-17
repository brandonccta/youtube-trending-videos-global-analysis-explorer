import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { THEME_MODE, getSystemTimeZone, resolveThemeFromTime, type ThemeMode, type ResolvedTheme } from './theme';

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: Dispatch<SetStateAction<ThemeMode>>;
  resolvedTheme: ResolvedTheme;
  timeZone: string;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyResolvedThemeToDom(resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;
  root.dataset.theme = resolvedTheme; // 'light' | 'dark'
}

function useAutoThemeTimer({
  enabled,
  timeZone,
  onTick,
}: {
  enabled: boolean;
  timeZone: string;
  onTick: () => void;
}) {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;

  useEffect(() => {
    if (!enabled) return;

    const tick = () => onTickRef.current?.();

    // tick immediately, then align to the next minute boundary for stability.
    tick();
    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(
      () => {
        tick();
        intervalId = window.setInterval(tick, 60_000);
      },
      Math.max(250, msToNextMinute)
    );

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [enabled, timeZone]); // re-align if timezone changes
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // always start in auto on each page load; do not persist mode across reloads.
  const [mode, setMode] = useState<ThemeMode>(THEME_MODE.AUTO);
  const [timeZone] = useState(() => getSystemTimeZone());
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => {
    return mode === THEME_MODE.AUTO ? resolveThemeFromTime({ timeZone }) : (mode as ResolvedTheme);
  });

  // keep resolved theme updated if mode changes.
  useEffect(() => {
    const nextResolved = mode === THEME_MODE.AUTO ? resolveThemeFromTime({ timeZone }) : (mode as ResolvedTheme);
    setResolvedTheme(nextResolved);
  }, [mode, timeZone]);

  // auto timer only when mode === auto
  useAutoThemeTimer({
    enabled: mode === THEME_MODE.AUTO,
    timeZone,
    onTick: () => setResolvedTheme(resolveThemeFromTime({ timeZone })),
  });

  // apply to dom. use layout effect so the correct theme is set
  // before the browser paints, avoiding a dark→light flicker.
  useLayoutEffect(() => {
    applyResolvedThemeToDom(resolvedTheme);
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      setMode,
      resolvedTheme, // 'light' | 'dark'
      timeZone,
    }),
    [mode, resolvedTheme, timeZone]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}

