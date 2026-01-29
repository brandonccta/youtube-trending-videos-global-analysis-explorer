from pyspark.sql.functions import col
from .schemas import youtube_schema

def load_youtube_data(spark, path):
    return (
        spark.read
        .schema(youtube_schema)
        .option("header", True)
        .csv(path)
        .filter(col("video_trending_country").isNotNull())
    )
