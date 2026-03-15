from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

spark = SparkSession.builder \
    .appName("Top10 Trending Channels per Country") \
    .getOrCreate()

df = spark.read.parquet("../../data/processed/cleaned_youtube_trending_videos_global")

# cast view count and channel subscriber count to long for cleaner aggregation
df = df.withColumn("video_view_count", F.col("video_view_count").cast("long"))
df = df.withColumn("channel_subscriber_count", F.col("channel_subscriber_count").cast("long"))
df = df.withColumn("channel_view_count", F.col("channel_view_count").cast("long"))

# select only necessary columns for Analysis 3
df = df.select(
    "video_id",
    "video_trending_country",
    "channel_title",
    "channel_custom_url",
    "video_category_id",
    "video_view_count",
    "channel_view_count",
    "channel_subscriber_count"
)

# ---------------------------------------------------------------------
# Analysis 3: Top channels by trending frequency and views by country |
# ---------------------------------------------------------------------
# Step 1: Calculate trending_appearances (count all appearances, including duplicates)
trending_appearances = df.groupBy("video_trending_country", "channel_title", "video_category_id") \
    .agg(F.count("video_id").alias("trending_appearances"))

# Step 2: Deduplicate videos to get unique video_id per channel/category/country
# For each unique video, use the MAXIMUM view count (in case the same video appears 
# with different view counts over time - we want the highest value)
unique_videos = df.groupBy("video_trending_country", "channel_title", "video_category_id", "video_id") \
    .agg(F.max("video_view_count").alias("video_view_count"))

# Step 3: Aggregate unique videos to get total_views and total_videos
video_stats = unique_videos.groupBy("video_trending_country", "channel_title", "video_category_id") \
    .agg(
        F.sum("video_view_count").alias("total_views"),
        F.count("video_id").alias("total_videos")
    )

# Step 4: Get channel-level metrics (should be same for all rows of same channel)
channel_metrics = df.groupBy("video_trending_country", "channel_title", "video_category_id") \
    .agg(
        F.max("channel_subscriber_count").alias("channel_subscribers"),
        F.first("channel_custom_url").alias("channel_custom_url"),
        F.max("channel_view_count").alias("channel_view_count")
    )

# Step 5: Join all aggregations together
channels_by_country = trending_appearances \
    .join(video_stats, on=["video_trending_country", "channel_title", "video_category_id"], how="inner") \
    .join(channel_metrics, on=["video_trending_country", "channel_title", "video_category_id"], how="inner")

window_country = Window.partitionBy("video_trending_country") \
    .orderBy(
        F.desc("trending_appearances"),  # primary sort: more appearances = higher rank 
        F.desc("total_views")            # tiebreaker: higher views = higher rank
    )

top_channels_per_country = channels_by_country \
    .withColumn("rank", F.row_number().over(window_country)) \
    .filter(F.col("rank") <= 10) \
    .select("video_trending_country", "channel_title", "channel_custom_url", "video_category_id", "trending_appearances", "total_views", "total_videos", "channel_subscribers", "channel_view_count", "rank") \
    .orderBy("video_trending_country", "rank")

# show table
top_channels_per_country.show(10, truncate=False)

# ----------------------------------------------------------
# Export dataframe to CSV file in "LOOK HERE" folder |
# ----------------------------------------------------------
# create "LOOK HERE" folder in output directory
output_folder = "../output/LOOK HERE"

# export Analysis 3: top_channels_per_country
top_channels_per_country.coalesce(1).write.csv(
    f"{output_folder}/top_channels_per_country.csv",
    header=True,
    mode="overwrite"
)

print(f"\nDataframe exported to {output_folder}/top_channels_per_country.csv")

spark.stop()
