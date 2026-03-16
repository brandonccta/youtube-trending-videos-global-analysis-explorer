const API_BASE = import.meta.env.VITE_API_BASE ?? '';

/**
 * Helper function to handle API error responses consistently
 * @param {Response} res - fetch response object
 * @returns {Promise<string>} error message
 */
async function getErrorMessage(res) {
  let errorMessage = `${res.status} ${res.statusText}`;
  try {
    const errorData = await res.json();
    errorMessage = errorData.error || errorMessage;
  } catch {
    errorMessage = (await res.text()) || errorMessage;
  }
  return errorMessage;
}

/**
 * Fetch top YouTube channels for a country by name.
 * @param {string} countryName - e.g. "United States", "Japan"
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object[]>}
 */
export async function fetchTopChannels(countryName, { signal } = {}) {
  if (!countryName) return [];
  const url = `${API_BASE}/api/country/top_channels?country=${encodeURIComponent(countryName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch top YouTube categories for a country by name.
 * @param {string} countryName - e.g. "United States", "Japan"
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object[]>}
 */
export async function fetchTopCategories(countryName, { signal } = {}) {
  if (!countryName) return [];
  const url = `${API_BASE}/api/country/top_categories?country=${encodeURIComponent(countryName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch top YouTube videos for a country by name.
 * @param {string} countryName - e.g. "United States", "Japan"
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<object[]>}
 */
export async function fetchTopVideos(countryName, { signal } = {}) {
  if (!countryName) return [];
  const url = `${API_BASE}/api/country/top_videos?country=${encodeURIComponent(countryName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return res.json();
}

/**
 * Fetch category trending appearances over time for a country.
 * @param {string} countryName - e.g. "United States", "Japan"
 * @returns {Promise<object[]>} array of { date, category, trending_appearances }
 */
export async function fetchCategoryTrendingOverTime(countryName) {
  if (!countryName) return [];
  const url = `${API_BASE}/api/query`;
  // escape single quotes in country name to prevent sql injection
  const escapedCountryName = countryName.replace(/'/g, "''");

  // monthly time-series lives in category_trends_over_time
  const sql = `
    SELECT
      TO_CHAR(
        TO_DATE(
          "trending_year"::text || '-' || LPAD("trending_month"::text, 2, '0') || '-01',
          'YYYY-MM-DD'
        ),
        'YYYY-MM-DD'
      ) AS date,
      "video_category_id" AS category,
      "trending_appearances" AS trending_appearances,
      "top5_tags" AS top5_tags
    FROM "category_trends_over_time"
    WHERE "video_trending_country" = '${escapedCountryName}'
    ORDER BY "trending_year" ASC, "trending_month" ASC, "video_category_id" ASC
  `;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    const errorMessage = await getErrorMessage(res);
    throw new Error(`API error: ${errorMessage}`);
  }

  return res.json();
}

/**
 * Fetch top video over time for a country.
 * @param {string} countryName - e.g. "United States", "Japan"
 * @returns {Promise<object[]>} array of { date, video_title, category, channel_title, video_view_count, video_like_count, video_comment_count, trending_appearances }
 */
export async function fetchTopVideosOverTime(countryName) {
  if (!countryName) return [];
  const url = `${API_BASE}/api/query`;
  // escape single quotes in country name to prevent sql injection
  const escapedCountryName = countryName.replace(/'/g, "''");

  // monthly time-series lives in video_trends_over_time
  const sql = `
    SELECT
      TO_CHAR(
        TO_DATE(
          "trending_year"::text || '-' || LPAD("trending_month"::text, 2, '0') || '-01',
          'YYYY-MM-DD'
        ),
        'YYYY-MM-DD'
      ) AS date,
      "video_title" AS video_title,
      "video_category_id" AS category,
      "channel_title" AS channel_title,
      "video_view_count" AS video_view_count,
      "video_like_count" AS video_like_count,
      "video_comment_count" AS video_comment_count,
      "video_duration" AS video_duration,
      "trending_appearances" AS trending_appearances
    FROM "video_trends_over_time"
    WHERE "video_trending_country" = '${escapedCountryName}'
    ORDER BY "trending_year" ASC, "trending_month" ASC
  `;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    const errorMessage = await getErrorMessage(res);
    throw new Error(`API error: ${errorMessage}`);
  }

  return res.json();
}
