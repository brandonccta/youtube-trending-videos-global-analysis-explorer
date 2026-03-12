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
  const url = `${API_BASE}/api/tables/top_categories_per_country?video_trending_country=${encodeURIComponent(countryName)}&limit=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch category trending appearances over time for a country.
 * @param {string} countryName - e.g. "United States", "Japan"
 * @returns {Promise<object[]>} Array of { date, category, trending_appearances }
 */
export async function fetchCategoryTrendingOverTime(countryName) {
  if (!countryName) return [];
  const url = `${API_BASE}/api/query`;
  // Escape single quotes in country name to prevent SQL injection
  const escapedCountryName = countryName.replace(/'/g, "''");

  // Monthly time-series lives in `category_trends_over_time`
  const sql = `
    SELECT
      CONCAT(\`trending_year\`, '-', LPAD(\`trending_month\`, 2, '0'), '-01') AS date,
      \`video_category_id\` AS category,
      \`trending_appearances\` AS trending_appearances,
      \`top5_tags\` AS top5_tags
    FROM \`category_trends_over_time\`
    WHERE \`video_trending_country\` = '${escapedCountryName}'
    ORDER BY \`trending_year\` ASC, \`trending_month\` ASC, \`video_category_id\` ASC
  `;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    let errorMessage = `${res.status} ${res.statusText}`;
    try {
      const errorData = await res.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = (await res.text()) || errorMessage;
    }
    throw new Error(`API error: ${errorMessage}`);
  }

  return res.json();
}