import { useState, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import GlobeView from './components/GlobeView';
import Sidebar from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import CategoryTrendingModal from './components/CategoryTrendingModal';
import { useCountryData } from './hooks/useCountryData';
import type { Country } from './data/countries';

export default function App() {
  const [sensitivity, setSensitivity] = useState(5); // 0-10 range, 5 is centered
  const [flyTarget, setFlyTarget] = useState<{ lon: number; lat: number } | null>(null);
  const [showHints, setShowHints] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const {
    selectedIso,
    selectedName,
    channels,
    categories,
    videos,
    loading,
    error,
    selectCountry,
    clear,
  } = useCountryData();

  const dismissHints = useCallback(() => setShowHints(false), []);
  const closeModal = useCallback(() => setShowModal(false), []);
  const handleExploreMore = useCallback(() => setShowModal(true), []);

  const handleSearchSelect = useCallback(
    (country: Country) => {
      setFlyTarget({ lon: country.lng, lat: country.lat });
      selectCountry(country.iso, country.name);
    },
    [selectCountry]
  );

  const handleSearchFocus = useCallback(() => {
    // clicking into the search bar should put you immediately into "new search" mode.
    setFlyTarget(null);
    clear();
    dismissHints();
  }, [clear, dismissHints]);

  const handleFlyDone = useCallback(() => setFlyTarget(null), []);

  const hasCountryData =
    !loading && !error && (channels.length > 0 || categories.length > 0 || videos.length > 0);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-ge-bg text-ge-text font-mono">
      <header className="ge-header flex flex-col sm:flex-row sm:flex-wrap items-center gap-2 sm:gap-x-4 sm:gap-y-2 pl-3 pr-4 sm:pr-7 py-2.5 bg-ge-panel border-b border-ge-border z-20 shrink-0">
        <div className="ge-header-brand flex items-center justify-center sm:justify-start gap-2.5 font-display font-black text-lg tracking-tight text-ge-accent shrink-0 select-none w-full sm:w-auto">
          <img
            src="/favicon.png"
            alt="Globe Explorer logo"
            className="w-9 h-9 rounded-full object-cover drop-shadow-[0_0_6px_var(--ge-logo-shadow)] bg-transparent"
          />
          <span>
            GLOBE<span className="text-ge-text">EXPLORER</span>
          </span>
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4 flex-1 w-full sm:min-w-[360px] min-w-0">
          <div className="flex-1 min-w-0 sm:min-w-[220px] sm:max-w-md">
            <SearchBar
              onSelect={handleSearchSelect}
              onFocus={handleSearchFocus}
              onFirstInteraction={dismissHints}
            />
          </div>
          <div className="flex items-center gap-2 text-[0.6rem] text-ge-muted whitespace-nowrap shrink-0 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-ge-green animate-pulse-dot" />
            {selectedName ? `VIEWING · ${selectedName.toUpperCase()}` : 'VIEWING · WORLD'}
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 w-full sm:w-auto">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[0.58rem] uppercase tracking-widest text-ge-muted whitespace-nowrap">
              Sensitivity
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              value={sensitivity}
              onChange={(e) => setSensitivity(Number(e.target.value))}
              className="w-20 h-[3px] appearance-none bg-ge-border rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ge-accent [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(56,189,248,0.4)] [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <span className="text-[0.65rem] text-ge-accent min-w-4 text-right">{sensitivity}</span>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <div className="ge-main flex flex-1 overflow-hidden">
        <GlobeView
          selectedIso={selectedIso}
          onCountryClick={selectCountry}
          flyTarget={flyTarget}
          sensitivity={sensitivity}
          onFlyDone={handleFlyDone}
          showHints={showHints}
          onFirstInteraction={dismissHints}
          onExploreMore={handleExploreMore}
          showExploreMore={!!selectedIso && hasCountryData}
        />
        <Sidebar
          selectedIso={selectedIso}
          selectedName={selectedName}
          channels={channels}
          categories={categories}
          videos={videos}
          loading={loading}
          error={error}
        />
      </div>

      <CategoryTrendingModal countryName={selectedName} isOpen={showModal} onClose={closeModal} />
    </div>
  );
}

