import { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import GlobeView from './components/GlobeView';
import Sidebar   from './components/Sidebar';
import { useCountryData } from './hooks/useCountryData';
import COUNTRIES from './data/countries';

export default function App() {
  const [sensitivity, setSensitivity] = useState(5);
  const [flyTarget, setFlyTarget]     = useState(null);

  const { selectedIso, selectedName, channels, categories, loading, error, selectCountry } = useCountryData();

  useEffect(() => { window.__COUNTRY_LIST__ = COUNTRIES; }, []);

  const handleGlobeClick = useCallback((iso, name) => {
    selectCountry(iso, name);
  }, [selectCountry]);

  const handleSearchSelect = useCallback((country) => {
    setFlyTarget({ lon: country.lng, lat: country.lat });
    selectCountry(country.iso, country.name);
  }, [selectCountry]);

  const handleFlyDone = useCallback(() => setFlyTarget(null), []);

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-ge-bg text-ge-text font-mono">
      <header className="flex items-center gap-4 px-6 py-2.5 bg-ge-panel border-b border-ge-border z-20 shrink-0">
        <div className="font-display font-black text-lg tracking-tight text-ge-accent shrink-0 select-none">
          GLOBE<span className="text-ge-text">EXPLORER</span>
        </div>
        <SearchBar onSelect={handleSearchSelect} sensitivity={sensitivity} onSensitivityChange={setSensitivity} />
        <div className="flex items-center gap-2 text-[0.6rem] text-ge-muted whitespace-nowrap ml-auto shrink-0 tracking-widest uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-ge-green animate-pulse-dot" />
          {selectedName ? `VIEWING · ${selectedName.toUpperCase()}` : 'DRAG TO ROTATE · CLICK TO SELECT'}
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <GlobeView selectedIso={selectedIso} onCountryClick={handleGlobeClick} flyTarget={flyTarget} sensitivity={sensitivity} onFlyDone={handleFlyDone} />
        <Sidebar selectedIso={selectedIso} selectedName={selectedName} channels={channels} categories={categories} loading={loading} error={error} />
      </div>
    </div>
  );
}
