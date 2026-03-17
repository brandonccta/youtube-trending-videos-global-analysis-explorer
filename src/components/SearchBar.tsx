import { useState, useRef, useEffect, useCallback } from 'react';
import COUNTRIES, { type Country } from '../data/countries';

export default function SearchBar({
  onSelect,
  onFocus,
  onFirstInteraction,
}: {
  onSelect: (country: Country) => void;
  onFocus?: () => void;
  onFirstInteraction?: () => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Country[]>([]);
  const [open, setOpen] = useState(false);
  const [focusIdx, setFocusIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFirstInteraction?.();
      const q = e.target.value;
      setQuery(q);
      setFocusIdx(-1);
      if (!q.trim()) {
        setResults([]);
        setOpen(false);
        return;
      }
      const lowerQ = q.toLowerCase();
      const m = COUNTRIES.filter((c) => c.name.toLowerCase().includes(lowerQ)).slice(0, 8);
      setResults(m);
      setOpen(m.length > 0);
    },
    [onFirstInteraction]
  );

  const handleFocus = useCallback(() => {
    // clear current selection + input so the user can immediately type a new country.
    onFirstInteraction?.();
    onFocus?.();
    if (query) {
      setQuery('');
      setResults([]);
      setOpen(false);
      setFocusIdx(-1);
    }
  }, [onFirstInteraction, onFocus, query]);

  const pick = useCallback(
    (c: Country) => {
      onFirstInteraction?.();
      setQuery(c.name);
      setOpen(false);
      setResults([]);
      onSelect(c);
    },
    [onFirstInteraction, onSelect]
  );

  const handleKey = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && focusIdx >= 0) {
        const c = results[focusIdx];
        if (c) pick(c);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [open, results, focusIdx, pick]
  );

  const hl = useCallback((text: string, q: string) => {
    if (!q) return text;
    const lowerText = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    const i = lowerText.indexOf(lowerQ);
    if (i < 0) return text;
    return (
      <>
        {text.slice(0, i)}
        <strong className="text-ge-accent font-medium">{text.slice(i, i + q.length)}</strong>
        {text.slice(i + q.length)}
      </>
    );
  }, []);

  return (
    <div className="relative w-full max-w-md" ref={wrapRef}>
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ge-muted text-base pointer-events-none select-none">
        ⌕
      </span>
      <input
        className="w-full bg-ge-surface border border-ge-border rounded-lg py-2 pl-9 pr-8 font-mono text-[0.75rem] text-ge-text outline-none transition-all focus:border-ge-accent focus:shadow-[0_0_0_3px_rgba(56,189,248,0.12)] placeholder:text-ge-muted"
        value={query}
        onChange={handleInput}
        onKeyDown={handleKey}
        onFocus={handleFocus}
        placeholder="Search for a country..."
        autoComplete="off"
        spellCheck={false}
      />
      {query && (
        <button
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ge-muted hover:text-ge-text text-[0.65rem] px-1 transition-colors"
          onClick={() => {
            onFirstInteraction?.();
            onFocus?.();
            setQuery('');
            setOpen(false);
            setResults([]);
            setFocusIdx(-1);
          }}
          type="button"
        >
          ✕
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 bg-ge-surface border border-ge-border rounded-lg z-50 shadow-[0_20px_50px_rgba(0,0,0,0.7)] max-h-60 overflow-y-auto">
          {results.map((c, i) => (
            <div
              key={c.iso}
              className={`flex items-center justify-between px-4 py-2.5 cursor-pointer border-b border-ge-border last:border-0 text-[0.74rem] transition-colors ${i === focusIdx ? 'bg-ge-surface2' : 'hover:bg-ge-surface2'}`}
              onMouseDown={() => pick(c)}
              onMouseEnter={() => setFocusIdx(i)}
            >
              <span className="text-ge-text">{hl(c.name, query)}</span>
              <span className="text-ge-muted text-[0.62rem] ml-3 shrink-0">{c.iso}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

