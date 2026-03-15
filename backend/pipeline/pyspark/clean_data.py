from pyspark.sql import SparkSession
from pyspark.sql import functions as F

spark = SparkSession.builder \
    .appName("YouTube Data Cleaning") \
    .getOrCreate()

df = spark.read.csv(
    "youtube_trending_videos_global.csv",
    header=True,
    inferSchema=False,
    multiLine=True,
    escape='"'
)

columns_to_keep = [
    "video_id",
    "video_published_at",
    "video_trending__date",
    "video_trending_country",
    "video_title",
    "video_category_id",
    "video_tags",
    "video_duration",
    "video_view_count",
    "video_like_count",
    "video_comment_count",
    "channel_id",
    "channel_subscriber_count",
    "channel_country",
    "channel_title"
]

cleaned_df = df.select(columns_to_keep) \
    .withColumnRenamed("video_trending__date", "video_trending_date") \
    .filter(F.col("video_id").isNotNull()) \
    .filter(F.col("video_published_at").isNotNull()) \
    .filter(F.col("video_view_count").isNotNull()) \
    .filter(~F.lower(F.col("video_category_id")).isin("true", "false"))

print("\nCleaned data preview (15 columns):")

cleaned_df.write.parquet(
    "cleaned_youtube_trending_videos_global",
    mode="overwrite"
)

print("\nData saved to 'cleaned_youtube_trending_videos_global' folder")

spark.stop()
