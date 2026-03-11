const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/**
 * Fetch top YouTube channels for a country by name.
 * @param {string} countryName - e.g. "United States", "Japan"
 * @returns {Promise<object[]>}
 */
export async function fetchTopChannels(countryName) {
  if (!countryName) return [];
  const url = `${API_BASE}/api/tables/top_channels_per_country?video_trending_country=${encodeURIComponent(countryName)}&limit=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch top YouTube categories for a country by name.
 * @param {string} countryName - e.g. "United States", "Japan"
 * @returns {Promise<object[]>}
 */
export async function fetchTopCategories(countryName) {
  if (!countryName) return [];
  const url = `${API_BASE}/api/tables/top_categories_per_country?video_trending_country=${encodeURIComponent(countryName)}&limit=10`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}
