// @ts-check

/**
 * Frontend domain model types (JSDoc).
 * These are used for incremental type-checking before we convert to .ts/.tsx.
 */

/**
 * @typedef {Object} Country
 * @property {string} name
 * @property {string} iso - ISO 3166-1 alpha-3 (used throughout the app)
 * @property {string} alpha2 - ISO 3166-1 alpha-2 (for flags)
 * @property {string} num - ISO 3166-1 numeric (zero-padded string) used by world-atlas topojson ids
 * @property {number} lat
 * @property {number} lng
 */

/**
 * Minimal row shapes returned by the API (Postgres rows serialized to JSON).
 * We keep these broad on purpose; normalization later will provide canonical shapes.
 *
 * @typedef {Object<string, unknown>} ApiRow
 */

/** @typedef {ApiRow & { rank?: number, channel_title?: string, channel_custom_url?: string, channel_subscribers?: number, total_views?: number, total_videos?: number, trending_appearances?: number, video_category_id?: string }} TopChannelRow */
/** @typedef {ApiRow & { rank?: number, video_category_id?: string, total_views?: number, avg_views?: number, total_likes?: number, trending_appearances?: number }} TopCategoryRow */
/** @typedef {ApiRow & { video_title?: string, title?: string, channel_title?: string, video_category_id?: string, video_view_count?: number, view_count?: number, views?: number, total_views?: number, engagement_rating?: number|string|null, engagement_score?: number|string|null, engagement?: number|string|null, trending_appearances?: number }} TopVideoRow */

/** @typedef {ApiRow & { date?: string, category?: string, trending_appearances?: number|string, top5_tags?: unknown }} CategoryTrendRow */
/** @typedef {ApiRow & { date?: string, video_title?: string, category?: string, channel_title?: string, video_view_count?: number|string, video_like_count?: number|string, video_comment_count?: number|string, video_duration?: string|null, trending_appearances?: number|string }} VideoTrendRow */

export {};

