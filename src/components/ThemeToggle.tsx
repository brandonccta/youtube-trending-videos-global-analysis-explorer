import { useEffect, useState, type CSSProperties } from 'react';
import { THEME_MODE } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';

export default function ThemeToggle() {
  const { mode, setMode, resolvedTheme } = useTheme();
  const [hasMounted, setHasMounted] = useState(false);

  // avoid transition animation on initial page load; enable after first paint.
  useEffect(() => {
    setHasMounted(true);
  }, []);

  // when mode is auto, visually reflect the currently resolved theme.
  const displayMode = mode === THEME_MODE.AUTO ? resolvedTheme : mode;

  const thumbStyle: CSSProperties =
    displayMode === THEME_MODE.DARK
      ? { transform: 'translateX(100%)' }
      : { transform: 'translateX(0%)' };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => {
          const nextMode = displayMode === THEME_MODE.LIGHT ? THEME_MODE.DARK : THEME_MODE.LIGHT;
          setMode(nextMode);
        }}
        className="relative inline-flex items-center justify-center rounded-full border border-ge-border bg-ge-surface w-24 h-8 cursor-pointer transition-colors"
        aria-label="Toggle theme"
      >
        {/* Sliding thumb */}
        <span
          className={['absolute top-0.5 bottom-0.5 w-1/2 rounded-full bg-ge-accent left-0'].join(
            ' '
          )}
          style={{
            ...thumbStyle,
            transition: hasMounted ? 'transform 260ms ease-out' : 'none',
          }}
        />

        {/* Labels */}
        <span
          className={[
            'relative z-10 w-12 flex items-center justify-center text-[0.62rem] font-display font-semibold tracking-wide uppercase',
            hasMounted && 'transition-colors duration-300 ease-out',
            displayMode === THEME_MODE.LIGHT ? 'text-ge-bg' : 'text-ge-muted',
          ].join(' ')}
        >
          Light
        </span>
        <span
          className={[
            'relative z-10 w-12 flex items-center justify-center text-[0.62rem] font-display font-semibold tracking-wide uppercase',
            hasMounted && 'transition-colors duration-300 ease-out',
            displayMode === THEME_MODE.DARK ? 'text-ge-bg' : 'text-ge-muted',
          ].join(' ')}
        >
          Dark
        </span>
      </button>
    </div>
  );
}
