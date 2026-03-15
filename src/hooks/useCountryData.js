import { useState, useCallback } from 'react';
import { fetchTopChannels, fetchTopCategories, fetchTopVideos } from '../api/countries';

export function useCountryData() {
  const [selectedIso, setSelectedIso]   = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [channels, setChannels]         = useState([]);
  const [categories, setCategories]     = useState([]);
  const [videos, setVideos]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const selectCountry = useCallback(async (iso, name) => {
    if (!iso) return;
    setSelectedIso(iso);
    setSelectedName(name);
    setChannels([]);
    setCategories([]);
    setVideos([]);
    setError(null);
    setLoading(true);

    try {
      const [ch, cat, vid] = await Promise.all([
        fetchTopChannels(name),
        fetchTopCategories(name),
        fetchTopVideos(name),
      ]);
      setChannels(ch);
      setCategories(cat);
      setVideos(vid);
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
    setVideos([]);
    setError(null);
    setLoading(false);
  }, []);

  return { selectedIso, selectedName, channels, categories, videos, loading, error, selectCountry, clear };
}
