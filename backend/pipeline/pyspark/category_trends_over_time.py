from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.window import Window

spark = SparkSession.builder \
    .appName("Category Trends Over Time by Country") \
    .getOrCreate()

df = spark.read.parquet("../../data/processed/cleaned_youtube_trending_videos_global")

# cast view count to long for cleaner aggregation
df = df.withColumn("video_view_count", F.col("video_view_count").cast("long"))

# extract date components for time-based analysis
df = df.withColumn(
    "trending_date",
    F.to_date(F.col("video_trending_date"), "yyyy.MM.dd")
) \
.withColumn("trending_month", F.month("trending_date")) \
.withColumn("trending_year", F.year("trending_date"))

# select only necessary columns for Analysis 2
df = df.select(
    "video_id",
    "video_trending_country",
    "video_category_id",
    "video_view_count",
    "video_tags",
    "trending_year",
    "trending_month"
)

# --------------------------------------------------------------
# Analysis 2: Category trending frequency over time by country |
# --------------------------------------------------------------
# explode tags and count top tags by country, category, and month/year
tags_df = (
    df.filter(F.col("video_tags").isNotNull())
      # split on comma from the raw tag string
      .withColumn("tag", F.explode(F.split(F.col("video_tags"), ",")))
      # normalize case & trim
      .withColumn("tag", F.lower(F.trim(F.col("tag"))))
      # remove empty/too‑short tags
      .filter(F.length("tag") > 1)
      # strip problematic characters so each tag is CSV/Supabase‑safe TEXT
      .withColumn(
          "tag",
          F.regexp_replace(
              F.regexp_replace(
                  F.regexp_replace(
                      F.col("tag"),
                      r'[\n\r\t]', ' '              # remove line breaks / tabs
                  ),
                  r'["]', ''                       # remove double quotes
              ),
              r'[|,;]', ' '                       # remove delimiters that confuse CSV/SQL
          )
      )
      # collapse multiple spaces
      .withColumn("tag", F.regexp_replace(F.col("tag"), r'\s+', ' '))
      .filter(F.length("tag") > 1)
)

tag_counts = tags_df.groupBy(
    "video_trending_country", "video_category_id", "trending_year", "trending_month", "tag"
).agg(F.count("*").alias("tag_count"))

window_tag = Window.partitionBy(
    "video_trending_country", "video_category_id", "trending_year", "trending_month"
).orderBy(F.desc("tag_count"))

top5_tags = (
    tag_counts
    .withColumn("row_num", F.row_number().over(window_tag))
    .filter(F.col("row_num") <= 5)
    .groupBy("video_trending_country", "video_category_id", "trending_year", "trending_month")
    .agg(F.collect_list("tag").alias("top5_tags"))
)

# Step 1: Calculate trending_appearances (count all appearances, including duplicates)
trending_appearances = df.groupBy("video_trending_country", "video_category_id", "trending_year", "trending_month") \
    .agg(F.count("video_id").alias("trending_appearances"))

# Step 2: Deduplicate videos to get unique video_id per country/category/year/month
# For each unique video, use the MAXIMUM view count
unique_videos = df.groupBy("video_trending_country", "video_category_id", "trending_year", "trending_month", "video_id") \
    .agg(F.max("video_view_count").alias("video_view_count"))

# Step 3: Aggregate unique videos to get total_views
video_stats = unique_videos.groupBy("video_trending_country", "video_category_id", "trending_year", "trending_month") \
    .agg(F.sum("video_view_count").alias("total_views"))

# Step 4: Join all aggregations together
category_over_time = (
    trending_appearances
      .join(video_stats, on=["video_trending_country", "video_category_id", "trending_year", "trending_month"], how="inner")
      .join(
          top5_tags,
          on=["video_trending_country", "video_category_id", "trending_year", "trending_month"],
          how="left"
      )
      .orderBy("video_trending_country", "video_category_id", "trending_year", "trending_month")
)

# show table
category_over_time.show(10, truncate=False)

# ----------------------------------------------------------
# Export dataframe to CSV file in "LOOK HERE" folder |
# ----------------------------------------------------------
# create "LOOK HERE" folder in output directory
output_folder = "../output/LOOK HERE"

# export Analysis 2: category_over_time (convert array column to string for CSV)
category_over_time_export = category_over_time.withColumn(
    "top5_tags",
    F.concat_ws("|", F.col("top5_tags"))  # e.g. "comedy|funny|memes"
)

category_over_time_export.coalesce(1).write.csv(
    f"{output_folder}/category_trends_over_time.csv",
    header=True,
    mode="overwrite",
    quote='"',
    escape='"',
    quoteAll=False
)

print(f"\nDataframe exported to {output_folder}/category_trends_over_time.csv")

spark.stop()
