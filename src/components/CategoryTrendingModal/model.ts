import type { CategoryTrendRow, VideoTrendRow } from '../../services/countries';

// normalize date to yyyy-mm-dd format for consistent key matching
export function normalizeDate(dateStr: unknown): string {
  if (!dateStr) return '';
  // extract date part from iso string or use as-is if already in yyyy-mm-dd format
  return String(dateStr).split('T')[0];
}

// Parse top5_tags from TEXT column (handles JSON arrays, pipe-separated strings, or arrays)
export function parseTags(tagsRaw: unknown): string[] {
  if (tagsRaw == null || tagsRaw === '' || (typeof tagsRaw === 'string' && !tagsRaw.trim())) {
    return [];
  }

  // if already an array, filter and return
  if (Array.isArray(tagsRaw)) {
    return tagsRaw
      .filter((t) => t != null && String(t).trim())
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0);
  }

  // if string, try to parse as json first, then fall back to pipe-separated
  if (typeof tagsRaw === 'string') {
    const trimmed = tagsRaw.trim();
    if (!trimmed) return [];

    // try parsing as json array (e.g., '["tag1","tag2"]')
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((t) => t != null && String(t).trim())
            .map((t) => String(t).trim())
            .filter((t) => t.length > 0);
        }
      } catch {
        // not valid json, fall through to pipe-separated parsing
      }
    }

    // fall back to pipe-separated string (e.g., 'tag1|tag2|tag3')
    return trimmed
      .split('|')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  return [];
}

// Format ISO 8601 duration (e.g. PT4M2S, PT1H1M39S) to human-readable (e.g. "4m 2s", "1h 1m 39s")
export function formatVideoDuration(isoDuration: unknown): string | null {
  if (isoDuration == null || isoDuration === '') return null;
  const str = String(isoDuration).trim().toUpperCase();
  if (!str.startsWith('PT')) return String(isoDuration);
  const hours = str.match(/(\d+)H/)?.[1];
  const minutes = str.match(/(\d+)M/)?.[1];
  const seconds = str.match(/(\d+)S/)?.[1];
  const parts: string[] = [];
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (seconds) parts.push(`${seconds}s`);
  return parts.length ? parts.join(' ') : null;
}

export function computeTopCategories(categoryData: CategoryTrendRow[]): string[] {
  const totals = new Map<string, number>();
  for (const row of categoryData) {
    const cat = row.category;
    if (!cat) continue;
    const v = Number(row.trending_appearances) || 0;
    totals.set(cat, (totals.get(cat) || 0) + v);
  }
  return Array.from(totals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat]) => cat);
}

export function computeVideoCategories(videoData: VideoTrendRow[]): string[] {
  const categories = new Set<string>();
  for (const row of videoData) {
    if (row.category) categories.add(row.category);
  }
  return Array.from(categories).sort();
}

export function buildParsedTagsMap(
  filteredCategoryData: CategoryTrendRow[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const row of filteredCategoryData) {
    const dateKey = normalizeDate(row.date);
    const key = `${row.category}|${dateKey}`;
    const tags = parseTags(row?.top5_tags);
    map.set(key, tags.slice(0, 5));
  }
  return map;
}

export type SelectedCategoryCard = {
  key: string;
  category: string;
  date: string | null | undefined;
  trending_appearances: number;
  top5_tags: string[];
};

export type SelectedVideoCard = {
  key: string;
  video_title: string | null | undefined;
  category: string | null | undefined;
  channel_title: string | null | undefined;
  date: string | null | undefined;
  video_view_count: number;
  video_like_count: number;
  video_comment_count: number;
  video_duration: string | null | undefined;
  trending_appearances: number;
};

export function buildSelectedCategoryCards({
  filteredCategoryData,
  selectedKeys,
  parsedTags,
}: {
  filteredCategoryData: CategoryTrendRow[];
  selectedKeys: string[];
  parsedTags: Map<string, string[]>;
}): SelectedCategoryCard[] {
  const byKey = new Map<string, CategoryTrendRow>(
    filteredCategoryData.map((r) => {
      const dateKey = normalizeDate(r.date);
      return [`${r.category}|${dateKey}`, r];
    })
  );

  return selectedKeys
    .map((key) => {
      const row = byKey.get(key);
      if (!row) return null;

      // get tags from parsedTags map, with fallback to raw data
      let tags = parsedTags.get(key) || [];
      if (tags.length === 0 && row.top5_tags) {
        tags = parseTags(row.top5_tags).slice(0, 5);
      }

      return {
        key,
        category: row.category ?? '',
        date: row.date,
        trending_appearances: Number(row.trending_appearances) || 0,
        top5_tags: tags,
      };
    })
    .filter(Boolean) as SelectedCategoryCard[];
}

export function buildSelectedVideoCards({
  filteredVideoData,
  selectedKeys,
}: {
  filteredVideoData: VideoTrendRow[];
  selectedKeys: string[];
}): SelectedVideoCard[] {
  // key is "video_title|date" — composite to avoid date collisions across videos
  const byKey = new Map<string, VideoTrendRow>(
    filteredVideoData.map((r) => {
      const dateKey = normalizeDate(r.date);
      return [`${r.video_title ?? ''}|${dateKey}`, r];
    })
  );

  return selectedKeys
    .map((key) => {
      const row = byKey.get(key);
      if (!row) return null;
      return {
        key,
        video_title: row.video_title,
        category: row.category,
        channel_title: row.channel_title,
        date: row.date,
        video_view_count: Number(row.video_view_count) || 0,
        video_like_count: Number(row.video_like_count) || 0,
        video_comment_count: Number(row.video_comment_count) || 0,
        video_duration: row.video_duration,
        trending_appearances: Number(row.trending_appearances) || 0,
      };
    })
    .filter(Boolean) as SelectedVideoCard[];
}
