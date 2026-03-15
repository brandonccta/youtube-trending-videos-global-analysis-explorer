from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

spark = SparkSession.builder \
    .appName("Top10 Trending Categories per Country") \
    .getOrCreate()

df = spark.read.parquet("../../data/processed/cleaned_youtube_trending_videos_global")

# cast view count and like count to long for cleaner aggregation
df = df.withColumn("video_view_count", F.col("video_view_count").cast("long"))
df = df.withColumn("video_like_count", F.col("video_like_count").cast("long"))

# select only necessary columns for Analysis 1
df = df.select(
    "video_id",
    "video_trending_country",
    "video_category_id",
    "video_view_count",
    "video_like_count"
)

# ----------------------------------------------------------
# Analysis 1: Ranked category frequency & views by country |
# ----------------------------------------------------------
# Step 1: Calculate trending_appearances (count all appearances, including duplicates)
trending_appearances = df.groupBy("video_trending_country", "video_category_id") \
    .agg(F.count("video_id").alias("trending_appearances"))

# Step 2: Deduplicate videos to get unique video_id per country/category
# For each unique video, use the MAXIMUM view count and like count
unique_videos = df.groupBy("video_trending_country", "video_category_id", "video_id") \
    .agg(
        F.max("video_view_count").alias("video_view_count"),
        F.max("video_like_count").alias("video_like_count")
    )

# Step 3: Aggregate unique videos to get total_views, avg_views, and total_likes
video_stats = unique_videos.groupBy("video_trending_country", "video_category_id") \
    .agg(
        F.sum("video_view_count").alias("total_views"),
        F.round(F.avg("video_view_count"), 0).cast("long").alias("avg_views"),
        F.sum("video_like_count").alias("total_likes")
    )

# Step 4: Join trending_appearances with video_stats
category_by_country = trending_appearances \
    .join(video_stats, on=["video_trending_country", "video_category_id"], how="inner")

# split data by country and rank categories within each country
window_country = Window.partitionBy("video_trending_country") \
    .orderBy(
        F.desc("trending_appearances"),  # primary sort: more appearances = higher rank
        F.desc("total_views")            # tiebreaker: higher views = higher rank
    )

top_categories_per_country = category_by_country \
    .withColumn("rank", F.row_number().over(window_country)) \
    .filter(F.col("rank") <= 10) \
    .orderBy("video_trending_country", "rank")

# show table
top_categories_per_country.show(10, truncate=False)

# ----------------------------------------------------------
# Export dataframe to CSV file in "LOOK HERE" folder |
# ----------------------------------------------------------
# create "LOOK HERE" folder in output directory
output_folder = "../output/LOOK HERE"

# export Analysis 1: top_categories_per_country
top_categories_per_country.coalesce(1).write.csv(
    f"{output_folder}/top_categories_per_country.csv",
    header=True,
    mode="overwrite"
)

print(f"\nDataframe exported to {output_folder}/top_categories_per_country.csv")

spark.stop()
