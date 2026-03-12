import { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import GlobeView from './components/GlobeView';
import Sidebar   from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import CategoryTrendingModal from './components/CategoryTrendingModal';
import { useCountryData } from './hooks/useCountryData';
import COUNTRIES from './data/countries';

export default function App() {
  const [sensitivity, setSensitivity] = useState(5); // 0-10 range, 5 is centered
  const [flyTarget, setFlyTarget]     = useState(null);
  const [showHints, setShowHints]     = useState(true);
  const [showModal, setShowModal]     = useState(false);

  const { selectedIso, selectedName, channels, categories, loading, error, selectCountry, clear } = useCountryData();

  useEffect(() => { window.__COUNTRY_LIST__ = COUNTRIES; }, []);

  const dismissHints = useCallback(() => setShowHints(false), []);

  const handleGlobeClick = useCallback((iso, name) => {
    selectCountry(iso, name);
  }, [selectCountry]);

  const handleSearchSelect = useCallback((country) => {
    setFlyTarget({ lon: country.lng, lat: country.lat });
    selectCountry(country.iso, country.name);
  }, [selectCountry]);

  const handleSearchFocus = useCallback(() => {
    // Clicking into the search bar should put you immediately into "new search" mode.
    setFlyTarget(null);
    clear();
    dismissHints();
  }, [clear]);

  const handleFlyDone = useCallback(() => setFlyTarget(null), []);

  const handleExploreMore = useCallback(() => {
    setShowModal(true);
  }, []);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-ge-bg text-ge-text font-mono">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2.5 bg-ge-panel border-b border-ge-border z-20 shrink-0">
        <div className="font-display font-black text-lg tracking-tight text-ge-accent shrink-0 select-none">
          GLOBE<span className="text-ge-text">EXPLORER</span>
        </div>

        <div className="flex items-center gap-4 flex-1 min-w-[360px]">
          <div className="flex-1 min-w-[220px] max-w-md">
            <SearchBar onSelect={handleSearchSelect} onFocus={handleSearchFocus} onFirstInteraction={dismissHints} />
          </div>

          <div className="flex items-center gap-2 text-[0.6rem] text-ge-muted whitespace-nowrap shrink-0 tracking-widest uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-ge-green animate-pulse-dot" />
            {selectedName ? `VIEWING · ${selectedName.toUpperCase()}` : 'DRAG TO ROTATE · CLICK TO SELECT'}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-[0.58rem] uppercase tracking-widest text-ge-muted whitespace-nowrap">Sensitivity</span>
          <input
            type="range"
            min={0} max={10} step={1}
            value={sensitivity}
            onChange={e => setSensitivity(Number(e.target.value))}
            className="w-20 h-[3px] appearance-none bg-ge-border rounded-full outline-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-ge-accent [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(56,189,248,0.4)] [&::-webkit-slider-thumb]:cursor-pointer"
          />
          <span className="text-[0.65rem] text-ge-accent min-w-4 text-right">{sensitivity}</span>
        </div>

        <ThemeToggle />
      </header>
      <div className="flex flex-1 overflow-hidden">
        <GlobeView
          selectedIso={selectedIso}
          onCountryClick={handleGlobeClick}
          flyTarget={flyTarget}
          sensitivity={sensitivity}
          onFlyDone={handleFlyDone}
          showHints={showHints}
          onFirstInteraction={dismissHints}
          onExploreMore={handleExploreMore}
        />
        <Sidebar selectedIso={selectedIso} selectedName={selectedName} channels={channels} categories={categories} loading={loading} error={error} />
      </div>

      <CategoryTrendingModal
        countryName={selectedName}
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </div>
  );
}
