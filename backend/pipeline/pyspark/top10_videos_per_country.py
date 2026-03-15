from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

spark = SparkSession.builder \
    .appName("Top10 Trending Videos per Country") \
    .getOrCreate()

df = spark.read.parquet("../../data/processed/cleaned_youtube_trending_videos_global")

# cast numeric columns to long for cleaner aggregation
df = df.withColumn("video_view_count", F.col("video_view_count").cast("long")) \
       .withColumn("video_like_count", F.col("video_like_count").cast("long")) \
       .withColumn("video_comment_count", F.col("video_comment_count").cast("long"))

# select only necessary columns for Analysis 4
df = df.select(
    "video_id",
    "video_trending_country",
    "video_category_id",
    "video_title",
    "video_trending_date",
    "video_view_count",
    "video_like_count",
    "video_comment_count",
    "channel_title",
    "video_duration"
)

# filter out null values for required columns
# df = df.filter(F.col("video_view_count").isNotNull()) \
#        .filter(F.col("video_trending_country").isNotNull()) \
#        .filter(F.col("video_title").isNotNull())

# ---------------------------------------------------------------------
# Analysis 4: Top 10 trending videos by country |
# ---------------------------------------------------------------------
# calculate engagement rating: (likes + comments) / views * 100
# This gives a percentage engagement rate
df = df.withColumn(
    "engagement_rating",
    F.when(F.col("video_view_count") > 0,
           F.round((F.coalesce(F.col("video_like_count"), F.lit(0)) + 
                   F.coalesce(F.col("video_comment_count"), F.lit(0))) / 
                  F.col("video_view_count") * 100, 4)
    ).otherwise(F.lit(0.0))
)

# Count trending appearances for each video_id per country
trending_appearances = df.groupBy("video_id", "video_trending_country") \
    .agg(F.count("*").alias("trending_appearances"))

# Use window function to get the row with max view_count for each video_id per country
# This allows us to capture the trending_date when the video had peak views
window_video_max = Window.partitionBy("video_id", "video_trending_country") \
    .orderBy(F.desc("video_view_count"))

# Get the row with maximum view_count for each video (includes trending_date at peak)
# This gives us one row per video per country with the peak performance data
unique_videos = df.withColumn("row_num", F.row_number().over(window_video_max)) \
    .filter(F.col("row_num") == 1) \
    .select(
        "video_id",
        "video_trending_country",
        "video_category_id",
        "video_title",
        "video_view_count",
        "engagement_rating",
        "video_trending_date",
        "channel_title",
        "video_duration"
    ) \
    .withColumnRenamed("video_trending_date", "peak_trending_date") \
    .join(trending_appearances, on=["video_id", "video_trending_country"], how="left")

# create window to rank unique videos by trending appearances within each country
# Primary sort: trending_appearances (more appearances = higher rank)
# Tiebreaker: video_view_count (higher views = higher rank when appearances are equal)
window_country = Window.partitionBy("video_trending_country") \
    .orderBy(
        F.desc("trending_appearances"),  # primary sort: more appearances = higher rank
        F.desc("video_view_count")        # tiebreaker: higher views = higher rank
    )

# rank unique videos and get top 10 per country
# Use row_number() to ensure exactly 10 videos per country (ties broken by view_count)
top_videos_per_country = unique_videos \
    .withColumn("rank", F.row_number().over(window_country)) \
    .filter(F.col("rank") <= 10) \
    .select(
        "video_trending_country",
        "video_category_id",
        "video_title",
        "channel_title",
        "video_duration",
        "video_view_count",
        "engagement_rating",
        "trending_appearances",
        "peak_trending_date",
        "rank"
    ) \
    .orderBy("video_trending_country", "rank")

# show table
top_videos_per_country.show(10, truncate=False)

# ----------------------------------------------------------
# Export dataframe to CSV file in "LOOK HERE" folder |
# ----------------------------------------------------------
# create "LOOK HERE" folder in output directory
output_folder = "../output/LOOK HERE"

# export Analysis 4: top_videos_per_country
# Use explicit quote and escape settings to ensure proper CSV formatting for Supabase
top_videos_per_country.coalesce(1).write.csv(
    f"{output_folder}/top_videos_per_country.csv",
    header=True,
    mode="overwrite",
    quote='"',
    escape='"',
    quoteAll=False
)

print(f"\nDataframe exported to {output_folder}/top_videos_per_country.csv")

spark.stop()
