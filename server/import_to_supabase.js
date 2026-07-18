// import_to_supabase.js
// clears and re-imports all CSV files into Supabase tables.
// run from the server/ directory: node import_to_supabase.js

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const CSV_DIR = path.join(__dirname, '../backend/pipeline/csv');

// maps each CSV file to its Supabase table.
// columnMap: renames CSV header -> DB column name when they differ.
const TABLE_CONFIG = [
  {
    csv: 'top10_channels_per_country.csv',
    table: 'top10_channels_per_country',
  },
  {
    csv: 'top10_categories_per_country.csv',
    table: 'top10_categories_per_country',
  },
  {
    csv: 'top10_videos_per_country.csv',
    table: 'top10_videos_per_country',
  },
  {
    csv: 'category_trends_over_time.csv',
    table: 'category_trends_over_time',
  },
  {
    csv: 'video_trends_over_time.csv',
    table: 'video_trends_over_time',
  },
];

// handles quoted fields (including commas and escaped quotes inside values).
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // escaped quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current === '' ? null : current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current === '' ? null : current);
  return result;
}

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];
    let headers = null;

    const rl = createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity,
    });

    rl.on('line', (line) => {
      if (!headers) {
        headers = parseCSVLine(line);
      } else if (line.trim()) {
        const values = parseCSVLine(line);
        const row = {};
        headers.forEach((header, i) => {
          row[header] = values[i] ?? null;
        });
        rows.push(row);
      }
    });

    rl.on('close', () => resolve({ headers, rows }));
    rl.on('error', reject);
  });
}

async function importTable({ csv, table, columnMap = {} }) {
  const filePath = path.join(CSV_DIR, csv);
  console.log(`\n[${table}]`);
  console.log(`  Reading ${csv}...`);

  const { headers, rows } = await readCSV(filePath);
  console.log(`  Found ${rows.length} rows`);

  // Remap CSV headers to DB column names where they differ
  const dbColumns = headers.map((h) => columnMap[h] || h);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`DELETE FROM "${table}"`);
    console.log(`  Cleared existing rows`);

    const BATCH_SIZE = 500;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const colCount = dbColumns.length;

      const placeholders = batch
        .map(
          (_, rowIdx) =>
            `(${dbColumns.map((_, colIdx) => `$${rowIdx * colCount + colIdx + 1}`).join(', ')})`
        )
        .join(', ');

      const values = batch.flatMap((row) =>
        headers.map((h) => {
          const val = row[h];
          return val === '' ? null : val;
        })
      );

      const query = `
        INSERT INTO "${table}" (${dbColumns.map((c) => `"${c}"`).join(', ')})
        VALUES ${placeholders}
      `;
      await client.query(query, values);
      inserted += batch.length;
    }

    await client.query('COMMIT');
    console.log(`  Inserted ${inserted} rows`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  const maskedUrl = process.env.DATABASE_URL?.replace(/:([^:@]+)@/, ':***@') ?? '(not set)';
  console.log('Starting Supabase import...');
  console.log(`Database: ${maskedUrl}\n`);

  try {
    for (const config of TABLE_CONFIG) {
      await importTable(config);
    }
    console.log('\nDone. All tables updated successfully.');
  } catch (err) {
    console.error('\nImport failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
