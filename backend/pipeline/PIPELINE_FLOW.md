# Pipeline Flow Documentation

This document describes the complete data pipeline flow from raw data to Supabase database.

## Pipeline Stages

```
┌─────────────────┐
│  Raw CSV Data   │
│  (External)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Data Cleaning  │
│  ../data/       │
│  clean_data.py  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Parquet Files  │
│  (Cleaned Data) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Aggregation    │
│  pyspark/       │
│  aggregate_data │
│  .py            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CSV Export     │
│  pyspark/       │
│  export_to_csv  │
│  .py            │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  CSV Files      │
│  ../data/csv/   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase Import│
│  ../scripts/    │
│  import_csv_to  │
│  _supabase.py   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
│  (PostgreSQL)   │
└─────────────────┘
```

## Stage Details

### 1. Data Cleaning (`../data/clean_data.py`)

- **Input**: Raw YouTube trending videos CSV
- **Process**:
  - Filters null values
  - Removes invalid data
  - Selects relevant columns
- **Output**: Parquet format cleaned data
- **Location**: Can be run locally or on cluster

### 2. Data Aggregation (`pyspark/aggregate_data.py`)

- **Input**: Cleaned Parquet data
- **Process**:
  - Top 10 videos per country
  - Top 10 channels per country
  - Top 10 categories per country
  - Category trends over time
  - Video trends over time
- **Output**: Aggregated DataFrames (cached)
- **Execution**: Typically on cluster via SSH

### 3. CSV Export (`pyspark/export_to_csv.py`)

- **Input**: Aggregated DataFrames
- **Process**: Exports each aggregation to CSV
- **Output**: CSV files in `../data/csv/`
- **Files Generated**:
  - `top10_videos_per_country.csv`
  - `top10_channels_per_country.csv`
  - `top10_categories_per_country.csv`
  - `category_trends_over_time.csv`
  - `video_trends_over_time.csv`

### 4. Database Import (`../scripts/import_csv_to_supabase.py`)

- **Input**: CSV files from `../data/csv/`
- **Process**:
  - Connects to Supabase PostgreSQL
  - Imports CSV data into tables
  - Handles batch inserts
- **Output**: Data in Supabase database
- **Tables**: See `../migrations/create_tables_postgresql.sql`

## Execution Methods

### Local Execution

```bash
# 1. Clean data
cd ../data
python clean_data.py

# 2. Aggregate (if PySpark installed locally)
cd ../backend-pipeline/pyspark
spark-submit aggregate_data.py
spark-submit export_to_csv.py

# 3. Import to Supabase
cd ../../scripts
python import_csv_to_supabase.py
```

### Cluster Execution (via SSH)

```bash
# Run complete pipeline on cluster
cd backend-pipeline/cluster
./ssh_execute.sh
```

## File Locations Reference

| Component         | Location                                     | Description               |
| ----------------- | -------------------------------------------- | ------------------------- |
| Data cleaning     | `../data/clean_data.py`                      | PySpark cleaning script   |
| Raw data          | External                                     | Original YouTube dataset  |
| Cleaned data      | Parquet files                                | Output from clean_data.py |
| Aggregation       | `pyspark/aggregate_data.py`                  | Main aggregation logic    |
| CSV export        | `pyspark/export_to_csv.py`                   | CSV export script         |
| CSV output        | `../data/csv/`                               | Generated CSV files       |
| Import script     | `../scripts/import_csv_to_supabase.py`       | Supabase import           |
| Database schema   | `../migrations/create_tables_postgresql.sql` | Table definitions         |
| Cluster execution | `cluster/ssh_execute.sh`                     | SSH automation script     |

## Notes

- Not all files live in this repository (some are on the cluster)
- The `data/` folder is part of the backend pipeline
- CSV files serve as the interface between PySpark and Supabase
- The pipeline can be run entirely on a cluster or split between local and cluster
