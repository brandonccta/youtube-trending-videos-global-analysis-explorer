from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

spark = SparkSession.builder \
    .appName("Video Trends Over Time by Country") \
    .getOrCreate()

df = spark.read.parquet("../../data/processed/cleaned_youtube_trending_videos_global")

# cast numeric columns to long for cleaner aggregation
df = df.withColumn("video_view_count", F.col("video_view_count").cast("long")) \
       .withColumn("video_like_count", F.col("video_like_count").cast("long")) \
       .withColumn("video_comment_count", F.col("video_comment_count").cast("long"))

# extract date components for time-based analysis
df = df.withColumn(
    "trending_date",
    F.to_date(F.col("video_trending_date"), "yyyy.MM.dd")
) \
.withColumn("trending_month", F.month("trending_date")) \
.withColumn("trending_year", F.year("trending_date"))

# select columns from analysis2.py (25-31) and analysis4.py (19-28)
# removing duplicates: video_id, video_trending_country, video_category_id, video_view_count
# Note: video_trending_date is used to create trending_year and trending_month above, but not needed after
df = df.select(
    "video_id",
    "video_trending_country",
    "video_category_id",
    "video_view_count",
    "trending_year",
    "trending_month",
    "video_title",
    "video_like_count",
    "video_comment_count",
    "channel_title",
    "video_duration"
)

# ---------------------------------------------------------------------
# Analysis 5: Top video at specific points in time by country |
# ---------------------------------------------------------------------
# Step 1: Count trending appearances for each video_id per country, year, and month
trending_appearances = df.groupBy("video_id", "video_trending_country", "trending_year", "trending_month") \
    .agg(F.count("video_id").alias("trending_appearances"))

# Step 2: Deduplicate videos to get unique video_id per country/year/month
# For each unique video, use the MAXIMUM view count and get other fields from the row with max views
window_video_max = Window.partitionBy("video_id", "video_trending_country", "trending_year", "trending_month") \
    .orderBy(F.desc("video_view_count"))

unique_videos = df.withColumn("row_num", F.row_number().over(window_video_max)) \
    .filter(F.col("row_num") == 1) \
    .select(
        "video_id",
        "video_trending_country",
        "trending_year",
        "trending_month",
        "video_title",
        "video_category_id",
        "channel_title",
        "video_view_count",
        "video_like_count",
        "video_comment_count",
        "video_duration"
    )

# Step 3: Join unique videos with trending_appearances
videos_with_appearances = unique_videos.join(
    trending_appearances,
    on=["video_id", "video_trending_country", "trending_year", "trending_month"],
    how="inner"
)

# Step 4: Rank videos by trending appearances within each time period and country
# Use video_view_count as tiebreaker when trending_appearances are equal
window_time_country = Window.partitionBy(
    "video_trending_country", "trending_year", "trending_month"
).orderBy(
    F.desc("trending_appearances"),  # primary sort: more appearances = higher rank
    F.desc("video_view_count")       # tiebreaker: higher views = higher rank
)

# Get the top video (rank 1) for each time period and country
# Use row_number() instead of rank() to ensure exactly one row per partition
top_video_over_time = (
    videos_with_appearances
    .withColumn("rank", F.row_number().over(window_time_country))
    .filter(F.col("rank") == 1)
    .select(
        "video_trending_country",
        "trending_year",
        "trending_month",
        "video_title",
        "video_category_id",
        "channel_title",
        "video_view_count",
        "video_like_count",
        "video_comment_count",
        "video_duration",
        "trending_appearances"
    )
    .orderBy("video_trending_country", "trending_year", "trending_month")
)

# show table
top_video_over_time.show(20, truncate=False)

# ----------------------------------------------------------
# Export dataframe to CSV file in "LOOK HERE" folder |
# ----------------------------------------------------------
# create "LOOK HERE" folder in output directory
output_folder = "../output/LOOK HERE"

# export Analysis 5: top_video_over_time
top_video_over_time_export = top_video_over_time

top_video_over_time_export.coalesce(1).write.csv(
    f"{output_folder}/top_video_over_time.csv",
    header=True,
    mode="overwrite",
    quote='"',
    escape='"',
    quoteAll=False
)

print(f"\nDataframe exported to {output_folder}/top_video_over_time.csv")

spark.stop()
