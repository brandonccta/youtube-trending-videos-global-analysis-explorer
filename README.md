## YouTube Trending Videos Global Analysis Explorer

Interactive 3D globe to explore **YouTube trending videos** by country.  
Click a country (or search for one) to see its top channels, categories, and videos, plus time‑series views of how trends evolve over time.

Built with **React + Vite + D3.js + Express + Supabase (PostgreSQL)**.

---

## 1. What This App Does

- **Explore global trends**: Spin a 3D globe and select any country.
- **See top performers**: For the selected country, view top 10 **channels**, **categories**, and **videos** with views, engagement, and trending counts.
- **Analyze over time**: Open the **Explore More** modal to see line charts for categories and videos trending month‑by‑month.

Data includes trending dates, countries, categories, views, likes, comments, engagement rating, and channel stats.

---

## 2. Dataset

This app is built on the **YouTube Trending Videos Global** dataset from Kaggle:

**Source**:  
`https://www.kaggle.com/datasets/canerkonuk/youtube-trending-videos-global/data`

It provides, for many countries:

- **Video**: title, category, duration, views, likes, comments, tags
- **Channel**: title, subscriber count, country
- **Trending**: date and country each video appeared in the trending list

---

## 3. Data Pipeline (High Level)

Raw CSV from Kaggle → cleaned, aggregated, exported to CSV → loaded into Supabase → exposed via API → visualized in the React frontend.

- **Cleaning** (`backend/pipeline/pyspark/clean_data.py`)
  - Reads the raw Kaggle CSV
  - Filters bad / null records, keeps relevant columns, outputs cleaned Parquet.

- **Aggregation** (`backend/pipeline/pyspark/*.py`)
  - `top10_*_per_country.py`: top 10 **videos**, **channels**, **categories** per country.
  - `*_trends_over_time.py`: monthly time‑series for categories and videos (views, likes, comments, trending_appearances).

- **CSV Export** (`backend/pipeline/csv/*.csv`)
  - Each aggregation writes a CSV (e.g. `top10_videos_per_country.csv`, `category_trends_over_time.csv`).

- **Supabase Load**
  - PostgreSQL tables defined in `backend/migrations/create_tables.sql`.
  - CSVs imported into Supabase (indexes added on country/date for fast queries).

- **API Layer** (`server/index.js`)
  - Express app connected to Supabase.
  - Country endpoints: `/api/country/top_channels`, `/api/country/top_categories`, `/api/country/top_videos`.
  - Generic read‑only query endpoint: `/api/query` (used for trends‑over‑time charts).

- **Frontend**
  - React app (`src/`) calls these endpoints via `src/services/countries.js`.
  - `useCountryData` hook wires API responses into the globe and sidebar.

---

## 4. Using the Frontend

### 4.1 Basic Interaction

- **Rotate the globe**: Click‑and‑drag anywhere on the globe.
- **Select a country**: Click it on the globe.
  - The globe flies to center that country and highlights it.
  - The right‑hand sidebar shows that country’s stats.
- **Search for a country**:
  - Use the search bar at the top (type e.g. “Japan” or “Brazil”).
  - Pick a result to fly the globe there.
- **Sensitivity slider**:
  - Adjusts how fast the globe rotates while dragging (0–10).

### 4.2 Sidebar Tabs

When a country is selected, the sidebar (`Sidebar.jsx`) shows:

- **Top Channels** tab:
  - Top 10 channels by trending appearances.
  - Shows channel name (links to YouTube where possible), subscribers, category, total views, number of videos, and how many times they trended.

- **Top Categories** tab:
  - Top 10 categories with small bar‑chart style view.
  - Shows total views, average views, likes, and trending_appearances per category.

- **Top Videos** tab:
  - Top 10 videos by trending_appearances.
  - Shows video title, channel, category, views, engagement rating, and trending_appearances.

If there is no selection, you’ll see a short “how to use” empty state.  
If the country has no data, you’ll see a “no trending data” message.  
Loading and error states are handled with a spinner and inline error box.

### 4.3 Explore More (Trends Over Time)

When a country has data, the globe (`GlobeView.jsx`) shows an **Explore More** button:

- Clicking it opens `CategoryTrendingModal.jsx` with:
  - **Categories Over Time** tab:
    - Line chart of monthly trending_appearances for the top categories.
    - Legend lets you toggle categories (up to 3 selected at a time).
    - Hover to see month, category, count, and top 5 tags.
  - **Videos Over Time** tab:
    - Line chart of top videos over time (one line per video).
    - Hover to see title, channel, views, likes, comments, duration, and trending_appearances.

Both charts are built with D3, resize with the window, and show tooltips on hover.

### 4.4 Theme Toggle

- The header includes a **theme toggle** (`ThemeToggle.jsx` / `theme/`).
- Switches between light and dark modes; preference can be stored locally.

---

## 5. Project Structure

```
youtube-trending-videos-global-analysis-explorer/
├── backend/
│   ├── migrations/
│   │   └── create_tables.sql          ← PostgreSQL table definitions
│   └── pipeline/
│       ├── csv/                       ← Exported CSV files
│       │   ├── top10_videos_per_country.csv
│       │   ├── top10_channels_per_country.csv
│       │   ├── top10_categories_per_country.csv
│       │   ├── category_trends_over_time.csv
│       │   └── video_trends_over_time.csv
│       ├── pyspark/                   ← PySpark aggregation scripts
│       │   ├── clean_data.py
│       │   ├── top10_videos_per_country.py
│       │   ├── top10_channels_per_country.py
│       │   ├── top10_categories_per_country.py
│       │   ├── category_trends_over_time.py
│       │   └── video_trends_over_time.py
│       └── PIPELINE_FLOW.md           ← Detailed pipeline documentation
├── server/
│   ├── index.js                       ← Express API server
│   └── package.json
├── src/
│   ├── components/
│   │   ├── GlobeView.jsx              ← 3D globe component (D3.js)
│   │   ├── Sidebar.jsx                ← Data display panel
│   │   ├── SearchBar.jsx              ← Country search with autocomplete
│   │   ├── CategoryTrendingModal.jsx  ← Time-series charts modal
│   │   └── ThemeToggle.jsx             ← Dark/light mode toggle
│   ├── services/
│   │   └── countries.js               ← API fetch functions
│   ├── hooks/
│   │   └── useCountryData.js          ← Data fetching hook
│   ├── data/
│   │   └── countries.js                ← Country list with coordinates
│   ├── theme/
│   │   ├── theme.js                   ← Theme configuration
│   │   └── ThemeProvider.jsx           ← Theme context provider
│   ├── styles/
│   │   └── global.css                 ← Global styles
│   ├── App.jsx                        ← Root component
│   └── main.jsx                       ← Entry point
├── package.json
├── vite.config.mjs                    ← Vite configuration
└── README.md
```

---

## 6. Quick Setup

**Prereqs**

- Node.js 18+, npm
- Python 3.8+ with PySpark (to rerun the pipeline)
- Supabase (or any PostgreSQL instance)
- Downloaded Kaggle dataset

**Backend**

- `cd server && npm install`
- Copy `.env.example` to `.env` and set either `DATABASE_URL` or individual `DB_*` vars plus `CORS_ORIGIN=http://localhost:3000`.
- Create tables using `backend/migrations/create_tables.sql`.
- Import CSVs from `backend/pipeline/csv/` into the matching tables.
- Start API: `npm run dev` → `http://localhost:4000`.

**Frontend**

- From project root: `npm install`
- Copy `.env.example` to `.env` and set `VITE_API_BASE=http://localhost:4000` (or rely on Vite proxy).
- Start dev server: `npm run dev` → open `http://localhost:3000`.

**Regenerating Data (optional)**

- Download the Kaggle CSV into your data directory.
- `cd backend/pipeline/pyspark`
- Run:
  - `spark-submit clean_data.py`
  - `spark-submit top10_videos_per_country.py`
  - `spark-submit top10_channels_per_country.py`
  - `spark-submit top10_categories_per_country.py`
  - `spark-submit category_trends_over_time.py`
  - `spark-submit video_trends_over_time.py`
- Re-import the generated CSVs into Supabase.

---

## 7. Notes

- Core API routes live in `server/index.js`.
- Frontend data fetching is centralized in `src/services/countries.js` and `src/hooks/useCountryData.js`.
- For deeper pipeline details, see `backend/pipeline/PIPELINE_FLOW.md`.

The YouTube data is sourced from Kaggle and subject to Kaggle’s terms of use.
