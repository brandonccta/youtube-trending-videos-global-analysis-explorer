# 🌍 Globe Explorer

Interactive 3D globe that queries your MySQL database when a country is selected.

Built with **React + Vite + react-globe.gl + Express + MySQL**.

---

## Project Structure

```
globe-explorer/
├── src/
│   ├── api/
│   │   └── countries.js       ← All fetch logic. Swap mock → real here.
│   ├── components/
│   │   ├── GlobeView.jsx      ← react-globe.gl wrapper
│   │   ├── GlobeView.module.css
│   │   ├── SearchBar.jsx      ← Search + sensitivity slider
│   │   ├── SearchBar.module.css
│   │   ├── Sidebar.jsx        ← Data panel
│   │   └── Sidebar.module.css
│   ├── data/
│   │   └── countries.js       ← Country list with lat/lng for fly-to
│   ├── hooks/
│   │   └── useCountryData.js  ← Fetch state management
│   ├── styles/
│   │   └── global.css
│   ├── App.jsx                ← Root, owns all shared state
│   ├── App.module.css
│   └── main.jsx
├── server/
│   ├── index.js               ← Express + MySQL API
│   ├── package.json
│   └── .env.example
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

---

## Quick Start (Mock Data — no backend needed)

```bash
# 1. Install dependencies
npm install

# 2. Run the dev server
npm run dev

# 3. Open http://localhost:3000
```

The app runs with built-in mock data by default — no database required.

---

## Connecting Your MySQL Database

### Step 1 — Set up the frontend .env

```bash
cp .env.example .env
```

Edit `.env`:
```
VITE_API_BASE=http://localhost:4000
VITE_KEY_COLUMN=iso_code        # ← your column name
VITE_USE_MOCK=false             # ← switch off mock data
```

### Step 2 — Set up the backend

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=your_database
KEY_COLUMN=iso_code
```

### Step 3 — Start both servers

Terminal 1 (API):
```bash
cd server
npm run dev
```

Terminal 2 (React):
```bash
# from project root
npm run dev
```

---

## Expected MySQL Table Shape

Your `countries` table must have at least a lookup column (default: `iso_code`).
All other columns are displayed automatically in the sidebar.

```sql
CREATE TABLE countries (
  id              INT PRIMARY KEY AUTO_INCREMENT,
  iso_code        CHAR(3) NOT NULL,   -- e.g. 'USA'
  country         VARCHAR(100),
  capital         VARCHAR(100),
  region          VARCHAR(100),
  population      VARCHAR(50),
  gdp             VARCHAR(50),
  currency        CHAR(3),
  area            VARCHAR(50),
  life_expectancy VARCHAR(20),
  languages       VARCHAR(200),
  exports         VARCHAR(200),
  imports         VARCHAR(200),
  hdi             DECIMAL(4,3),
  -- add any other columns you want — they appear in the sidebar automatically
  INDEX (iso_code)
);
```

---

## Customisation

| What                        | Where                              |
|-----------------------------|------------------------------------|
| Add more countries to search | `src/data/countries.js`            |
| Change which fields are "featured" stat cards | `src/components/Sidebar.jsx` → `FEATURED` array |
| Change field display labels | `src/components/Sidebar.jsx` → `LABELS` object   |
| Change globe texture / colours | `src/components/GlobeView.jsx`    |
| Add authentication to API   | `server/index.js`                  |
| Deploy                      | Vite → any static host; Express → Railway / Render / VPS |

---

## Tech Stack

| Layer     | Library            | Why                                      |
|-----------|--------------------|------------------------------------------|
| UI        | React 18 + Vite    | Fast dev, CSS Modules for scoped styles  |
| Globe     | react-globe.gl     | WebGL via Three.js, drag/fly built-in    |
| API calls | native fetch       | No extra lib needed                      |
| Backend   | Express 4          | Simple, pairs naturally with React       |
| Database  | mysql2             | Promise-based, connection pooling        |
