import { useState, useCallback, useRef } from 'react';
import {
  fetchTopChannels,
  fetchTopCategories,
  fetchTopVideos,
  type TopChannelRow,
  type TopCategoryRow,
  type TopVideoRow,
} from '../services/countries';

export function useCountryData() {
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [channels, setChannels] = useState<TopChannelRow[]>([]);
  const [categories, setCategories] = useState<TopCategoryRow[]>([]);
  const [videos, setVideos] = useState<TopVideoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const selectCountry = useCallback(async (iso: string, name: string) => {
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
    } catch (err: unknown) {
      if (abortRef.current !== controller) return;
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
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

