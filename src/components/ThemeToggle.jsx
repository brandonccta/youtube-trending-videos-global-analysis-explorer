import { THEME_MODE } from '../theme/theme';
import { useTheme } from '../theme/ThemeProvider';

const OPTIONS = [
  { mode: THEME_MODE.DAY, label: 'Light' },
  { mode: THEME_MODE.NIGHT, label: 'Dark' },
];

export default function ThemeToggle() {
  const { mode, setMode, resolvedTheme, timeZone } = useTheme();

  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="hidden md:block text-[0.56rem] tracking-[0.14em] uppercase text-ge-muted">
      </div>

      <button
        type="button"
        onClick={() =>
          setMode(mode === THEME_MODE.DAY ? THEME_MODE.NIGHT : THEME_MODE.DAY)
        }
        className="relative inline-flex items-center justify-center rounded-full border border-ge-border bg-ge-surface w-24 h-8 cursor-pointer transition-colors"
        aria-label="Toggle theme"
      >
        {/* Sliding thumb */}
        <span
          className={[
            'absolute top-0.5 bottom-0.5 w-1/2 rounded-full bg-ge-accent transition-all',
            mode === THEME_MODE.NIGHT ? 'left-1/2' : 'left-0',
          ].join(' ')}
        />

        {/* Labels */}
        <span
          className={[
            'relative z-10 w-12 flex items-center justify-center text-[0.62rem] font-display font-semibold tracking-wide uppercase transition-colors',
            mode === THEME_MODE.DAY ? 'text-ge-bg' : 'text-ge-muted',
          ].join(' ')}
        >
          Light
        </span>
        <span
          className={[
            'relative z-10 w-12 flex items-center justify-center text-[0.62rem] font-display font-semibold tracking-wide uppercase transition-colors',
            mode === THEME_MODE.NIGHT ? 'text-ge-bg' : 'text-ge-muted',
          ].join(' ')}
        >
          Dark
        </span>
      </button>
    </div>
  );
}

