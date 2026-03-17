/**
 * Format large numbers with K/M/B suffixes for display.
 * Returns '0' for non-finite or negative inputs.
 */
export function formatViews(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}

