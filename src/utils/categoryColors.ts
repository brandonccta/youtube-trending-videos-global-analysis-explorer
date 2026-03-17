export type CategoryColors = { bg: string; border: string; text: string };

export const CATEGORY_COLORS: Record<string, CategoryColors> = {
  Gaming: { bg: 'rgba(139,92,246,0.08)', border: 'rgba(139,92,246,0.35)', text: '#a78bfa' },
  Sports: { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.35)', text: '#34d399' },
  Music: { bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.35)', text: '#fb923c' },
  Entertainment: { bg: 'rgba(56,189,248,0.08)', border: 'rgba(56,189,248,0.35)', text: '#38bdf8' },
  'People & Blogs': {
    bg: 'rgba(244,114,182,0.08)',
    border: 'rgba(244,114,182,0.35)',
    text: '#f472b6',
  },
  'News & Politics': {
    bg: 'rgba(248,113,113,0.08)',
    border: 'rgba(248,113,113,0.35)',
    text: '#f87171',
  },
  Comedy: { bg: 'rgba(253,224,71,0.08)', border: 'rgba(253,224,71,0.35)', text: '#fde047' },
  Education: { bg: 'rgba(45,212,191,0.08)', border: 'rgba(45,212,191,0.35)', text: '#2dd4bf' },
  'Film & Animation': {
    bg: 'rgba(244,63,94,0.08)',
    border: 'rgba(244,63,94,0.35)',
    text: '#f43f5e',
  },
  'Science & Technology': {
    bg: 'rgba(96,165,250,0.08)',
    border: 'rgba(96,165,250,0.35)',
    text: '#60a5fa',
  },
  'Howto & Style': {
    bg: 'rgba(217,70,239,0.08)',
    border: 'rgba(217,70,239,0.35)',
    text: '#d946ef',
  },
  'Autos & Vehicles': {
    bg: 'rgba(74,222,128,0.08)',
    border: 'rgba(74,222,128,0.35)',
    text: '#4ade80',
  },
  'Travel & Events': {
    bg: 'rgba(251,191,36,0.08)',
    border: 'rgba(251,191,36,0.35)',
    text: '#fbbf24',
  },
  'Pets & Animals': {
    bg: 'rgba(163,230,53,0.08)',
    border: 'rgba(163,230,53,0.35)',
    text: '#a3e635',
  },
};

export const DEFAULT_CATEGORY_COLORS: CategoryColors = {
  bg: 'rgba(56,189,248,0.06)',
  border: 'rgba(56,189,248,0.2)',
  text: '#38bdf8',
};

export function categoryColorsFor(category: unknown): CategoryColors {
  const key = String(category ?? '').trim();
  return CATEGORY_COLORS[key] ?? DEFAULT_CATEGORY_COLORS;
}

const FALLBACK_LINE_COLORS = [
  '#60A5FA', // blue
  '#34D399', // green
  '#FBBF24', // amber
  '#F87171', // red
  '#A78BFA', // purple
  '#F472B6', // pink
  '#22D3EE', // cyan
  '#FB923C', // orange
  '#4ADE80', // emerald
  '#818CF8', // indigo
];

export function categoryLineColor(category: unknown): string {
  const key = String(category ?? '').trim();
  const fromMap = CATEGORY_COLORS[key];
  if (fromMap) return fromMap.text;

  const cat = key || 'Unknown';
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
  return FALLBACK_LINE_COLORS[hash % FALLBACK_LINE_COLORS.length] ?? FALLBACK_LINE_COLORS[0]!;
}
