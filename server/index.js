// server/index.js
// Express backend that queries your MySQL database.
//
// Setup:
//   cd server
//   npm install express mysql2 cors dotenv
//   cp .env.example .env   → fill in your DB credentials
//   node index.js

import 'dotenv/config';
import express  from 'express';
import cors     from 'cors';
import mysql    from 'mysql2/promise';

const app  = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: 'http://localhost:3000' })); // your React dev server
app.use(express.json());

// ── MySQL connection pool ──────────────────────────────────────
const pool = mysql.createPool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     process.env.DB_PORT     ?? 3306,
  user:     process.env.DB_USER     ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME     ?? 'world_explorer',
  waitForConnections: true,
  connectionLimit:    10,
});

// ── GET /api/countries?iso_code=USA ───────────────────────────
// Change `iso_code` to whatever column name you use.
app.get('/api/countries', async (req, res) => {
  const keyColumn = process.env.KEY_COLUMN ?? 'iso_code';
  const keyValue  = req.query[keyColumn];

  if (!keyValue) {
    return res.status(400).json({ error: `Missing query param: ${keyColumn}` });
  }

  try {
    // Parameterised query prevents SQL injection
    const [rows] = await pool.query(
      `SELECT * FROM countries WHERE \`${keyColumn}\` = ? LIMIT 1`,
      [keyValue]
    );

    if (rows.length === 0) {
      return res.status(404).json(null);
    }

    return res.json(rows[0]);
  } catch (err) {
    console.error('[DB error]', err.message);
    return res.status(500).json({ error: 'Database error' });
  }
});

// ── GET /api/countries/all ─────────────────────────────────────
// Optional: return all rows (useful for pre-loading or admin views)
app.get('/api/countries/all', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM countries');
    return res.json(rows);
  } catch (err) {
    console.error('[DB error]', err.message);
    return res.status(500).json({ error: 'Database error' });
  }
});

// ── Health check ───────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Globe Explorer API running on http://localhost:${PORT}`);
});
