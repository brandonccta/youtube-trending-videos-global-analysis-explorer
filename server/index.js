import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
const { Pool } = pg;

const app = express();
const PORT = process.env.PORT ?? 4000;

// allow all origins in production, or specific origin in development
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// ── Bootstrap ───────────────────────────────────────────────────
let pool;
let dbInitialized = false;

async function initializeDatabase() {
  if (pool && dbInitialized) return;

  // support both connection string (supabase/neon) and individual params
  const connectionConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DB_SSL !== 'false' ? { rejectUnauthorized: false } : false,
      }
    : {
        host: process.env.DB_HOST ?? 'localhost',
        port: parseInt(process.env.DB_PORT ?? '5432'),
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_NAME ?? 'youtube_analysis',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      };

  pool = new Pool({
    ...connectionConfig,
    max: 10, // connection pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  // test connection
  try {
    const client = await pool.connect();
    const dbName = connectionConfig.database || connectionConfig.connectionString?.split('/').pop();
    console.log(`[DB] Connected to "${dbName}"`);
    client.release();
    dbInitialized = true;
  } catch (err) {
    console.error('[DB] Connection failed:', err.message);
    throw err;
  }
}

async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeDatabase();
  }
}

async function start() {
  await initializeDatabase();
  app.listen(PORT, () => {
    console.log(`\nYouTube Analysis API  →  http://localhost:${PORT}\n`);
  });
}

// ── Helpers ─────────────────────────────────────────────────────
// get all table names (postgresql equivalent of SHOW TABLES)
async function getTableNames() {
  await ensureDbInitialized();
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return result.rows.map((r) => r.table_name);
}

async function assertTable(name) {
  await ensureDbInitialized();
  const tables = await getTableNames();
  if (!tables.includes(name)) {
    throw Object.assign(new Error(`Table "${name}" not found`), {
      status: 404,
    });
  }
}

// ── Routes ──────────────────────────────────────────────────────

// list all tables
app.get('/api/tables', async (_req, res) => {
  try {
    await ensureDbInitialized();
    res.json(await getTableNames());
  } catch (err) {
    console.error('[DB]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// describe a table's columns (postgresql equivalent of SHOW COLUMNS)
app.get('/api/tables/:table/schema', async (req, res) => {
  try {
    await ensureDbInitialized();
    await assertTable(req.params.table);
    const result = await pool.query(
      `SELECT 
        column_name as Field,
        data_type as Type,
        is_nullable as Null,
        column_default as Default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position`,
      [req.params.table]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// country-specific helpers (used by the react app)
app.get('/api/country/top_channels', async (req, res) => {
  try {
    await ensureDbInitialized();
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({ error: 'Missing "country" query parameter' });
    }

    await assertTable('top10_channels_per_country');

    const sql = `
      SELECT *
      FROM "top10_channels_per_country"
      WHERE "video_trending_country" = $1
      ORDER BY "trending_appearances" DESC
      LIMIT 10
    `;

    const result = await pool.query(sql, [country]);
    res.json(result.rows);
  } catch (err) {
    console.error('[API] /api/country/top_channels:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get('/api/country/top_categories', async (req, res) => {
  try {
    await ensureDbInitialized();
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({ error: 'Missing "country" query parameter' });
    }

    await assertTable('top10_categories_per_country');

    const sql = `
      SELECT *
      FROM "top10_categories_per_country"
      WHERE "video_trending_country" = $1
      ORDER BY "trending_appearances" DESC
      LIMIT 10
    `;

    const result = await pool.query(sql, [country]);
    res.json(result.rows);
  } catch (err) {
    console.error('[API] /api/country/top_categories:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get('/api/country/top_videos', async (req, res) => {
  try {
    await ensureDbInitialized();
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({ error: 'Missing "country" query parameter' });
    }

    await assertTable('top10_videos_per_country');

    const sql = `
      SELECT *
      FROM "top10_videos_per_country"
      WHERE "video_trending_country" = $1
      ORDER BY "trending_appearances" DESC
      LIMIT 10
    `;

    const result = await pool.query(sql, [country]);
    res.json(result.rows);
  } catch (err) {
    console.error('[API] /api/country/top_videos:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get('/api/country/category_trends', async (req, res) => {
  try {
    await ensureDbInitialized();
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({ error: 'Missing "country" query parameter' });
    }

    const sql = `
      SELECT
        TO_CHAR(
          TO_DATE(
            "trending_year"::text || '-' || LPAD("trending_month"::text, 2, '0') || '-01',
            'YYYY-MM-DD'
          ),
          'YYYY-MM-DD'
        ) AS date,
        "video_category_id" AS category,
        "trending_appearances" AS trending_appearances,
        "top5_tags" AS top5_tags
      FROM "category_trends_over_time"
      WHERE "video_trending_country" = $1
      ORDER BY "trending_year" ASC, "trending_month" ASC, "video_category_id" ASC
    `;

    const result = await pool.query(sql, [country]);
    res.json(result.rows);
  } catch (err) {
    console.error('[API] /api/country/category_trends:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get('/api/country/video_trends', async (req, res) => {
  try {
    await ensureDbInitialized();
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({ error: 'Missing "country" query parameter' });
    }

    const sql = `
      SELECT
        TO_CHAR(
          TO_DATE(
            "trending_year"::text || '-' || LPAD("trending_month"::text, 2, '0') || '-01',
            'YYYY-MM-DD'
          ),
          'YYYY-MM-DD'
        ) AS date,
        "video_title" AS video_title,
        "video_category_id" AS category,
        "channel_title" AS channel_title,
        "video_view_count" AS video_view_count,
        "video_like_count" AS video_like_count,
        "video_comment_count" AS video_comment_count,
        "video_duration" AS video_duration,
        "trending_appearances" AS trending_appearances
      FROM "video_trends_over_time"
      WHERE "video_trending_country" = $1
      ORDER BY "trending_year" ASC, "trending_month" ASC
    `;

    const result = await pool.query(sql, [country]);
    res.json(result.rows);
  } catch (err) {
    console.error('[API] /api/country/video_trends:', err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// generic table query (supports ?limit=100&offset=0 and simple equality filters)
app.get('/api/tables/:table', async (req, res) => {
  try {
    await ensureDbInitialized();
    await assertTable(req.params.table);

    const limit = Math.min(parseInt(req.query.limit ?? '100'), 10000);
    const offset = parseInt(req.query.offset ?? '0');

    const filters = { ...req.query };
    delete filters.limit;
    delete filters.offset;

    let sql = `SELECT * FROM "${req.params.table}"`;
    const vals = [];
    let paramIndex = 1;

    const whereClauses = Object.entries(filters).map(([col, val]) => {
      vals.push(val);
      return `"${col}" = $${paramIndex++}`;
    });

    if (whereClauses.length) sql += ' WHERE ' + whereClauses.join(' AND ');
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    vals.push(limit, offset);

    const result = await pool.query(sql, vals);
    res.json(result.rows);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// run a raw read-only query (POST { "sql": "SELECT ..." })
app.post('/api/query', async (req, res) => {
  try {
    await ensureDbInitialized();
    const { sql } = req.body;
    if (!sql || typeof sql !== 'string') {
      return res.status(400).json({ error: 'Missing "sql" in request body' });
    }

    const normalized = sql.trim().toUpperCase();
    if (
      !normalized.startsWith('SELECT') &&
      !normalized.startsWith('SHOW') &&
      !normalized.startsWith('DESCRIBE') &&
      !normalized.startsWith('WITH')
    ) {
      return res
        .status(403)
        .json({ error: 'Only SELECT / SHOW / DESCRIBE / WITH queries are allowed' });
    }

    const result = await pool.query(sql);
    res.json(result.rows);
  } catch (err) {
    console.error('[DB]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// health check
app.get('/api/health', async (_req, res) => {
  try {
    await ensureDbInitialized();
    await pool.query('SELECT 1');
    const dbName = process.env.DATABASE_URL
      ? process.env.DATABASE_URL.split('/').pop().split('?')[0]
      : process.env.DB_NAME || 'unknown';
    res.json({ status: 'ok', database: dbName });
  } catch {
    res.status(503).json({ status: 'unhealthy' });
  }
});

// ── Graceful shutdown ───────────────────────────────────────────
let shuttingDown = false;

function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('\nShutting down…');
  pool?.end().catch(() => {});

  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// ── Start (for local development only) ───────────────────────────
// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  start().catch((err) => {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  });
}

// Export for Vercel serverless functions
export default app;
