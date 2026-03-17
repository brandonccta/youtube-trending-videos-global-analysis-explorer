const API_BASE = import.meta.env.VITE_API_BASE ?? '';

type ApiRow = Record<string, unknown>;

export type TopChannelRow = ApiRow & {
  rank?: number;
  channel_title?: string;
  channel_custom_url?: string;
  channel_subscribers?: number;
  total_views?: number;
  total_videos?: number;
  trending_appearances?: number;
  video_category_id?: string;
};

export type TopCategoryRow = ApiRow & {
  rank?: number;
  video_category_id?: string;
  total_views?: number;
  avg_views?: number;
  total_likes?: number;
  trending_appearances?: number;
};

export type TopVideoRow = ApiRow & {
  video_title?: string;
  title?: string;
  channel_title?: string;
  video_category_id?: string;
  video_view_count?: number;
  view_count?: number;
  views?: number;
  total_views?: number;
  engagement_rating?: number | string | null;
  engagement_score?: number | string | null;
  engagement?: number | string | null;
  trending_appearances?: number;
};

export type CategoryTrendRow = ApiRow & {
  date?: string;
  category?: string;
  trending_appearances?: number;
  top5_tags?: unknown;
};

export type VideoTrendRow = ApiRow & {
  date?: string;
  video_title?: string;
  category?: string;
  channel_title?: string;
  video_view_count?: number;
  video_like_count?: number;
  video_comment_count?: number;
  video_duration?: string | null;
  trending_appearances?: number;
};

function toNumber(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function normalizeTopChannels(rows: TopChannelRow[]): TopChannelRow[] {
  return rows.map((r) => ({
    ...r,
    rank: toNumber(r.rank) ?? r.rank,
    channel_subscribers: toNumber(r.channel_subscribers) ?? r.channel_subscribers,
    total_views: toNumber(r.total_views) ?? r.total_views,
    total_videos: toNumber(r.total_videos) ?? r.total_videos,
    trending_appearances: toNumber(r.trending_appearances) ?? r.trending_appearances,
  }));
}

function normalizeTopCategories(rows: TopCategoryRow[]): TopCategoryRow[] {
  return rows.map((r) => ({
    ...r,
    rank: toNumber(r.rank) ?? r.rank,
    total_views: toNumber(r.total_views) ?? r.total_views,
    avg_views: toNumber(r.avg_views) ?? r.avg_views,
    total_likes: toNumber(r.total_likes) ?? r.total_likes,
    trending_appearances: toNumber(r.trending_appearances) ?? r.trending_appearances,
  }));
}

function normalizeTopVideos(rows: TopVideoRow[]): TopVideoRow[] {
  return rows.map((r) => ({
    ...r,
    // prefer existing canonical keys; otherwise fall back to common alternates
    video_title: r.video_title ?? r.title,
    video_view_count: r.video_view_count ?? r.view_count ?? r.views ?? r.total_views,
    engagement_rating: r.engagement_rating ?? r.engagement_score ?? r.engagement,
    trending_appearances: toNumber(r.trending_appearances) ?? r.trending_appearances,
  }));
}

function normalizeCategoryTrends(rows: CategoryTrendRow[]): CategoryTrendRow[] {
  return rows.map((r) => ({
    ...r,
    trending_appearances: toNumber(r.trending_appearances) ?? r.trending_appearances,
  }));
}

function normalizeVideoTrends(rows: VideoTrendRow[]): VideoTrendRow[] {
  return rows.map((r) => ({
    ...r,
    trending_appearances: toNumber(r.trending_appearances) ?? r.trending_appearances,
    video_view_count: toNumber(r.video_view_count) ?? r.video_view_count,
    video_like_count: toNumber(r.video_like_count) ?? r.video_like_count,
    video_comment_count: toNumber(r.video_comment_count) ?? r.video_comment_count,
  }));
}

async function getErrorMessage(res: Response): Promise<string> {
  const fallback = `${res.status} ${res.statusText}`;
  try {
    const text = await res.text();
    if (!text) return fallback;
    try {
      const data = JSON.parse(text) as { error?: string };
      return data.error || text || fallback;
    } catch {
      return text || fallback;
    }
  } catch {
    return fallback;
  }
}

export async function fetchTopChannels(
  countryName: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<TopChannelRow[]> {
  if (!countryName) return [];
  const url = `${API_BASE}/api/country/top_channels?country=${encodeURIComponent(countryName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return normalizeTopChannels((await res.json()) as TopChannelRow[]);
}

export async function fetchTopCategories(
  countryName: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<TopCategoryRow[]> {
  if (!countryName) return [];
  const url = `${API_BASE}/api/country/top_categories?country=${encodeURIComponent(countryName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return normalizeTopCategories((await res.json()) as TopCategoryRow[]);
}

export async function fetchTopVideos(
  countryName: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<TopVideoRow[]> {
  if (!countryName) return [];
  const url = `${API_BASE}/api/country/top_videos?country=${encodeURIComponent(countryName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`);
  return normalizeTopVideos((await res.json()) as TopVideoRow[]);
}

export async function fetchCategoryTrendingOverTime(
  countryName: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<CategoryTrendRow[]> {
  if (!countryName) return [];
  const url = `${API_BASE}/api/country/category_trends?country=${encodeURIComponent(countryName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res);
    throw new Error(`API error: ${errorMessage}`);
  }
  return normalizeCategoryTrends((await res.json()) as CategoryTrendRow[]);
}

export async function fetchTopVideosOverTime(
  countryName: string,
  { signal }: { signal?: AbortSignal } = {}
): Promise<VideoTrendRow[]> {
  if (!countryName) return [];
  const url = `${API_BASE}/api/country/video_trends?country=${encodeURIComponent(countryName)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    const errorMessage = await getErrorMessage(res);
    throw new Error(`API error: ${errorMessage}`);
  }
  return normalizeVideoTrends((await res.json()) as VideoTrendRow[]);
}
