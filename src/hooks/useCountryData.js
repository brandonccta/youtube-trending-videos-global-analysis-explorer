import { useState, useCallback } from 'react';
import { fetchTopChannels, fetchTopCategories } from '../api/countries';

export function useCountryData() {
  const [selectedIso, setSelectedIso]   = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [channels, setChannels]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const selectCountry = useCallback(async (iso, name) => {
    if (!iso) return;
    setSelectedIso(iso);
    setSelectedName(name);
    setChannels([]);
    setCategories([]);
    setError(null);
    setLoading(true);

    try {
      const [ch, cat] = await Promise.all([
        fetchTopChannels(name),
        fetchTopCategories(name),
      ]);
      setChannels(ch);
      setCategories(cat);
    } catch (err) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSelectedIso(null);
    setSelectedName(null);
    setChannels([]);
    setCategories([]);
    setError(null);
    setLoading(false);
  }, []);

  return { selectedIso, selectedName, channels, categories, loading, error, selectCountry, clear };
}
