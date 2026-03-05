import { buildSqlString } from '../api/countries';

const FEATURED = ['population','gdp','capital','region','life_expectancy','area'];
const LABELS = {
  population:'Population', gdp:'GDP', capital:'Capital', region:'Region',
  life_expectancy:'Life Expectancy', area:'Land Area', currency:'Currency',
  hdi:'HDI Score', languages:'Languages', exports:'Top Exports', imports:'Top Imports',
};

export default function Sidebar({ selectedIso, selectedName, data, loading, error }) {
  const hasSelection = !!selectedIso;
  const keys     = data ? Object.keys(data) : [];
  const featured = FEATURED.filter(k => keys.includes(k));
  const rest     = keys.filter(k => !FEATURED.includes(k) && k !== 'country' && k !== 'iso_code');

  return (
    <aside className="w-80 shrink-0 bg-ge-panel border-l border-ge-border flex flex-col overflow-hidden">

      {/* Top header */}
      <div className={`px-6 pt-5 pb-4 border-b border-ge-border relative overflow-hidden shrink-0 ${hasSelection ? 'after:absolute after:top-0 after:left-0 after:right-0 after:h-0.5 after:bg-linear-to-r after:from-transparent after:via-ge-accent after:to-transparent' : ''}`}>
        <div className="text-[0.56rem] tracking-[0.16em] uppercase text-ge-muted mb-2">Selected Country</div>
        <div className="font-display font-black text-[1.55rem] text-ge-text leading-tight tracking-tight min-h-[1.8rem]">
          {selectedName ?? '—'}
        </div>
        {hasSelection && (
          <div className="flex gap-1.5 flex-wrap mt-2.5">
            <span className="bg-ge-surface border border-ge-border rounded px-2 py-0.5 text-[0.6rem] text-ge-accent">{selectedIso}</span>
            {data?.region   && <span className="bg-[rgba(245,158,11,0.05)] border border-[rgba(245,158,11,0.3)] rounded px-2 py-0.5 text-[0.6rem] text-ge-gold">{data.region}</span>}
            {data?.currency && <span className="bg-ge-surface border border-ge-border rounded px-2 py-0.5 text-[0.6rem] text-ge-accent">{data.currency}</span>}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5">

        {/* Empty state */}
        {!hasSelection && (
          <div className="h-full flex flex-col items-center justify-center gap-4 text-center px-6 text-ge-muted">
            <div className="text-4xl opacity-10 animate-globe-idle">🌍</div>
            <p className="text-[0.68rem] leading-relaxed">Spin the globe and click any country, or use the search bar to fly directly to a location.</p>
          </div>
        )}

        {/* Loading */}
        {hasSelection && loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-ge-muted text-[0.68rem]">
            <div className="w-6 h-6 border-2 border-ge-border border-t-ge-accent rounded-full animate-spin-slow" />
            <span>Querying database...</span>
          </div>
        )}

        {/* Error */}
        {hasSelection && !loading && error && (
          <>
            <SqlBox iso={selectedIso} />
            <div className="bg-[rgba(248,113,113,0.08)] border border-[rgba(248,113,113,0.3)] rounded-lg px-3.5 py-3 text-[0.67rem] text-ge-red mb-2">⚠ {error}</div>
            <p className="text-[0.63rem] text-ge-muted leading-relaxed">Check your API endpoint in the config below, or set <code className="text-ge-accent bg-ge-surface px-1 rounded">VITE_USE_MOCK=true</code>.</p>
          </>
        )}

        {/* No data */}
        {hasSelection && !loading && !error && !data && (
          <>
            <SqlBox iso={selectedIso} />
            <div className="flex flex-col items-center gap-3 py-6 text-ge-muted text-center">
              <div className="text-3xl opacity-15">🔍</div>
              <p className="text-[0.68rem]">No record found for <strong className="text-ge-text">{selectedName}</strong>.</p>
            </div>
          </>
        )}

        {/* Data */}
        {hasSelection && !loading && !error && data && (
          <>
            <SqlBox iso={selectedIso} />

            {/* Stat grid */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              {featured.map((k, i) => {
                const isWide   = k === 'capital' || k === 'region';
                const isAccent = k === 'gdp' || k === 'population';
                const isSm     = isWide;
                return (
                  <div
                    key={k}
                    className={`bg-ge-surface border border-ge-border rounded-lg p-3 hover:border-ge-accent transition-colors animate-fade-in ${isWide ? 'col-span-2' : ''}`}
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="text-[0.55rem] tracking-[0.12em] uppercase text-ge-muted mb-1">{LABELS[k] ?? k}</div>
                    <div className={`font-display font-bold leading-snug ${isSm ? 'text-[0.82rem]' : 'text-[0.95rem]'} ${isAccent ? 'text-ge-accent' : 'text-ge-text'}`}>
                      {data[k]}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Extra rows */}
            {rest.length > 0 && (
              <>
                <div className="text-[0.56rem] tracking-[0.14em] uppercase text-ge-muted mb-2.5 pb-1.5 border-b border-ge-border">Additional Fields</div>
                {rest.map(k => (
                  <div key={k} className="flex justify-between items-start py-1.5 border-b border-ge-border/50 last:border-0 gap-3">
                    <span className="text-[0.62rem] text-ge-muted shrink-0">{LABELS[k] ?? k}</span>
                    <span className="text-[0.65rem] text-ge-text text-right">{data[k]}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>

      {/* Config panel */}
      <div className="px-5 py-4 border-t border-ge-border bg-ge-surface shrink-0">
        <div className="text-[0.56rem] tracking-widest uppercase text-ge-muted mb-2">⚙ Backend API</div>
        <input className="w-full bg-ge-panel border border-ge-border rounded px-2.5 py-1.5 font-mono text-[0.63rem] text-ge-text outline-none focus:border-ge-accent transition-colors mb-1.5 placeholder:text-ge-muted" id="cfg-url" placeholder="http://localhost:4000" defaultValue="http://localhost:4000" />
        <input className="w-full bg-ge-panel border border-ge-border rounded px-2.5 py-1.5 font-mono text-[0.63rem] text-ge-text outline-none focus:border-ge-accent transition-colors mb-2.5 placeholder:text-ge-muted" id="cfg-col" placeholder="Key column (e.g. iso_code)" defaultValue="iso_code" />
        <button className="bg-ge-accent text-black font-display font-bold text-[0.7rem] tracking-wide px-3.5 py-1.5 rounded hover:opacity-85 transition-opacity">
          View Setup Instructions
        </button>
      </div>
    </aside>
  );
}

function SqlBox({ iso }) {
  return (
    <div className="bg-[#020810] border border-ge-border rounded-lg px-3.5 py-2.5 text-[0.6rem] leading-relaxed mb-4 break-all font-mono">
      <span className="text-ge-indigo">SELECT</span>{' '}*{' '}
      <span className="text-ge-indigo">FROM</span>{' '}
      <span className="text-ge-gold">countries</span>{' '}
      <span className="text-ge-indigo">WHERE</span>{' '}
      iso_code = <span className="text-ge-green">'{iso}'</span>
    </div>
  );
}
