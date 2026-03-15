create table if not exists "top10_channels_per_country" (
  "video_trending_country" VARCHAR(255) not null,
  "channel_title" VARCHAR(255),
  "channel_custom_url" VARCHAR(255),
  "video_category_id" VARCHAR(255),
  "trending_appearances" BIGINT default 0,
  "total_views" BIGINT default 0,
  "channel_video_count" BIGINT default 0,
  "channel_subscribers" BIGINT default 0,
  "channel_view_count" BIGINT default 0,
  "rank" INTEGER,
  primary key ("video_trending_country", "rank")
);

create table if not exists "top10_categories_per_country" (
  "video_trending_country" VARCHAR(255) not null,
  "video_category_id" VARCHAR(255),
  "trending_appearances" BIGINT default 0,
  "total_views" BIGINT default 0,
  "avg_views" BIGINT default 0,
  "total_likes" BIGINT default 0,
  "rank" INTEGER,
  primary key ("video_trending_country", "rank")
);

create table if not exists "category_trends_over_time" (
  "video_trending_country" VARCHAR(255) not null,
  "video_category_id" VARCHAR(255) not null,
  "trending_year" INTEGER not null,
  "trending_month" INTEGER not null check (
    "trending_month" >= 1
    and "trending_month" <= 12
  ),
  "trending_appearances" BIGINT default 0,
  "total_views" BIGINT default 0,
  "top5_tags" TEXT,
  primary key (
    "video_trending_country",
    "video_category_id",
    "trending_year",
    "trending_month"
  )
);

create table if not exists "top10_videos_per_country" (
  "video_trending_country" VARCHAR(255) not null,
  "video_category_id" VARCHAR(255),
  "video_title" TEXT,
  "channel_title" VARCHAR(255),
  "video_duration" VARCHAR(255),
  "video_view_count" BIGINT default 0,
  "engagement_rating" DECIMAL(10, 4),
  "trending_appearances" BIGINT default 0,
  "peak_trending_date" VARCHAR(255),
  "rank" INTEGER,
  primary key ("video_trending_country", "rank")
);

create table if not exists "video_trends_over_time" (
  "video_trending_country" VARCHAR(255) not null,
  "trending_year" INTEGER not null,
  "trending_month" INTEGER not null check (
    "trending_month" >= 1
    and "trending_month" <= 12
  ),
  "video_title" TEXT,
  "video_category_id" VARCHAR(255),
  "channel_title" VARCHAR(255),
  "video_view_count" BIGINT default 0,
  "video_like_count" BIGINT default 0,
  "video_comment_count" BIGINT default 0,
  "video_duration" VARCHAR(255),
  "trending_appearances" BIGINT default 0,
  primary key (
    "video_trending_country",
    "trending_year",
    "trending_month"
  )
);

create index IF not exists idx_top_channels_country on "top10_channels_per_country" ("video_trending_country");

create index IF not exists idx_top_channels_appearances on "top10_channels_per_country" ("trending_appearances" desc);

create index IF not exists idx_top_categories_country on "top10_categories_per_country" ("video_trending_country");

create index IF not exists idx_top_categories_appearances on "top10_categories_per_country" ("trending_appearances" desc);

create index IF not exists idx_category_trends_country on "category_trends_over_time" ("video_trending_country");

create index IF not exists idx_category_trends_date on "category_trends_over_time" ("trending_year", "trending_month");

create index IF not exists idx_top_videos_country on "top10_videos_per_country" ("video_trending_country");

create index IF not exists idx_top_videos_views on "top10_videos_per_country" ("video_view_count" desc);

create index IF not exists idx_top_videos_engagement on "top10_videos_per_country" ("engagement_rating" desc);

create index IF not exists idx_top_videos_appearances on "top10_videos_per_country" ("trending_appearances" desc);

create index IF not exists idx_top_videos_category on "top10_videos_per_country" ("video_category_id");

create index IF not exists idx_video_trends_over_time_country on "video_trends_over_time" ("video_trending_country");

create index IF not exists idx_video_trends_over_time_date on "video_trends_over_time" ("trending_year", "trending_month");

create index IF not exists idx_video_trends_over_time_views on "video_trends_over_time" ("video_view_count" desc);

create index IF not exists idx_video_trends_over_time_category on "video_trends_over_time" ("video_category_id");