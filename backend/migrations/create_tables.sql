CREATE TABLE IF NOT EXISTS "top10_channels_per_country" (
  "video_trending_country" VARCHAR(255) NOT NULL,
  "channel_title"          VARCHAR(255),
  "channel_custom_url"     VARCHAR(255),
  "video_category_id"      VARCHAR(255),
  "trending_appearances"   BIGINT DEFAULT 0,
  "total_views"            BIGINT DEFAULT 0,
  "total_videos"           BIGINT DEFAULT 0,
  "channel_subscribers"    BIGINT DEFAULT 0,
  "channel_view_count"     BIGINT DEFAULT 0,
  "rank"                   INTEGER,
  PRIMARY KEY ("video_trending_country", "rank")
);

CREATE TABLE IF NOT EXISTS "top10_categories_per_country" (
  "video_trending_country" VARCHAR(255) NOT NULL,
  "video_category_id"      VARCHAR(255),
  "trending_appearances"   BIGINT DEFAULT 0,
  "total_views"            BIGINT DEFAULT 0,
  "avg_views"              BIGINT DEFAULT 0,
  "total_likes"            BIGINT DEFAULT 0,
  "rank"                   INTEGER,
  PRIMARY KEY ("video_trending_country", "rank")
);

CREATE TABLE IF NOT EXISTS "category_trends_over_time" (
  "video_trending_country" VARCHAR(255) NOT NULL,
  "video_category_id"      VARCHAR(255) NOT NULL,
  "trending_year"          INTEGER NOT NULL,
  "trending_month"         INTEGER NOT NULL CHECK (
    "trending_month" >= 1
    AND "trending_month" <= 12
  ),
  "trending_appearances"   BIGINT DEFAULT 0,
  "total_views"            BIGINT DEFAULT 0,
  "top5_tags"              TEXT,
  PRIMARY KEY (
    "video_trending_country",
    "video_category_id",
    "trending_year",
    "trending_month"
  )
);

CREATE TABLE IF NOT EXISTS "top10_videos_per_country" (
  "video_trending_country" VARCHAR(255) NOT NULL,
  "video_category_id"      VARCHAR(255),
  "video_title"            TEXT,
  "channel_title"          VARCHAR(255),
  "video_duration"         VARCHAR(255),
  "video_view_count"       BIGINT DEFAULT 0,
  "engagement_rating"      DECIMAL(10, 4),
  "trending_appearances"   BIGINT DEFAULT 0,
  "peak_trending_date"     VARCHAR(255),
  "rank"                   INTEGER,
  PRIMARY KEY ("video_trending_country", "rank")
);

CREATE TABLE IF NOT EXISTS "video_trends_over_time" (
  "video_trending_country" VARCHAR(255) NOT NULL,
  "trending_year"          INTEGER NOT NULL,
  "trending_month"         INTEGER NOT NULL CHECK (
    "trending_month" >= 1
    AND "trending_month" <= 12
  ),
  "video_title"            TEXT,
  "video_category_id"      VARCHAR(255),
  "channel_title"          VARCHAR(255),
  "video_view_count"       BIGINT DEFAULT 0,
  "video_like_count"       BIGINT DEFAULT 0,
  "video_comment_count"    BIGINT DEFAULT 0,
  "video_duration"         VARCHAR(255),
  "trending_appearances"   BIGINT DEFAULT 0,
  PRIMARY KEY (
    "video_trending_country",
    "trending_year",
    "trending_month"
  )
);

CREATE INDEX IF NOT EXISTS idx_top_channels_country      ON "top10_channels_per_country" ("video_trending_country");
CREATE INDEX IF NOT EXISTS idx_top_channels_appearances  ON "top10_channels_per_country" ("trending_appearances" DESC);

CREATE INDEX IF NOT EXISTS idx_top_categories_country      ON "top10_categories_per_country" ("video_trending_country");
CREATE INDEX IF NOT EXISTS idx_top_categories_appearances  ON "top10_categories_per_country" ("trending_appearances" DESC);

CREATE INDEX IF NOT EXISTS idx_category_trends_country ON "category_trends_over_time" ("video_trending_country");
CREATE INDEX IF NOT EXISTS idx_category_trends_date    ON "category_trends_over_time" ("trending_year", "trending_month");

CREATE INDEX IF NOT EXISTS idx_top_videos_country      ON "top10_videos_per_country" ("video_trending_country");
CREATE INDEX IF NOT EXISTS idx_top_videos_views        ON "top10_videos_per_country" ("video_view_count" DESC);
CREATE INDEX IF NOT EXISTS idx_top_videos_engagement   ON "top10_videos_per_country" ("engagement_rating" DESC);
CREATE INDEX IF NOT EXISTS idx_top_videos_appearances  ON "top10_videos_per_country" ("trending_appearances" DESC);
CREATE INDEX IF NOT EXISTS idx_top_videos_category     ON "top10_videos_per_country" ("video_category_id");

CREATE INDEX IF NOT EXISTS idx_top_video_over_time_country   ON "video_trends_over_time" ("video_trending_country");
CREATE INDEX IF NOT EXISTS idx_top_video_over_time_date      ON "video_trends_over_time" ("trending_year", "trending_month");
CREATE INDEX IF NOT EXISTS idx_top_video_over_time_views     ON "video_trends_over_time" ("video_view_count" DESC);
CREATE INDEX IF NOT EXISTS idx_top_video_over_time_category  ON "video_trends_over_time" ("video_category_id");
