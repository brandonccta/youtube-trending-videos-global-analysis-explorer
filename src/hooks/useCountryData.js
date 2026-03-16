import { useState, useCallback, useRef } from 'react';
import { fetchTopChannels, fetchTopCategories, fetchTopVideos } from '../services/countries';

export function useCountryData() {
  const [selectedIso, setSelectedIso] = useState(null);
  const [selectedName, setSelectedName] = useState(null);
  const [channels, setChannels] = useState([]);
  const [categories, setCategories] = useState([]);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const selectCountry = useCallback(async (iso, name) => {
    if (!iso) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    setSelectedIso(iso);
    setSelectedName(name);
    setChannels([]);
    setCategories([]);
    setVideos([]);
    setError(null);
    setLoading(true);

    try {
      const [ch, cat, vid] = await Promise.all([
        fetchTopChannels(name, { signal }),
        fetchTopCategories(name, { signal }),
        fetchTopVideos(name, { signal }),
      ]);
      if (abortRef.current !== controller) return;
      setChannels(ch);
      setCategories(cat);
      setVideos(vid);
    } catch (err) {
      if (err.name === 'AbortError' || abortRef.current !== controller) return;
      setError(err.message ?? 'Unknown error');
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setLoading(false);
      }
    }
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSelectedIso(null);
    setSelectedName(null);
    setChannels([]);
    setCategories([]);
    setVideos([]);
    setError(null);
    setLoading(false);
  }, []);

  return {
    selectedIso,
    selectedName,
    channels,
    categories,
    videos,
    loading,
    error,
    selectCountry,
    clear,
  };
}
