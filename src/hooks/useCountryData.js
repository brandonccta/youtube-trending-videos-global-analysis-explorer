// hooks/useCountryData.js
// Encapsulates all data-fetching logic for a selected country.
// Components just call selectCountry(iso) and read { data, loading, error }.

import { useState, useCallback } from 'react';
import { fetchCountry } from '../api/countries';

export function useCountryData() {
  const [selectedIso, setSelectedIso]   = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [data, setData]                 = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const selectCountry = useCallback(async (iso, name) => {
    if (!iso) return;
    setSelectedIso(iso);
    setSelectedName(name);
    setData(null);
    setError(null);
    setLoading(true);

    try {
      const result = await fetchCountry(iso);
      setData(result);
    } catch (err) {
      setError(err.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setSelectedIso(null);
    setSelectedName(null);
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { selectedIso, selectedName, data, loading, error, selectCountry, clear };
}
