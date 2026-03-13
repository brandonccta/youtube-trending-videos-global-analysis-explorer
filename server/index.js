import "dotenv/config";
import express from "express";
import cors from "cors";
import mysql from "mysql2/promise";
import { Client } from "ssh2";
import net from "net";
import { readFileSync } from "fs";
import { homedir } from "os";
import path from "path";

const app = express();
const PORT = process.env.PORT ?? 4000;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

// ── SSH tunnel through a jump host ──────────────────────────────
function resolvePath(p) {
  if (p.startsWith("~")) return path.join(homedir(), p.slice(1));
  return p;
}

function buildAuthConfig(prefix) {
  const password = process.env[`${prefix}_PASSWORD`] ?? "";
  const keyPath = process.env[`${prefix}_PRIVATE_KEY`];

  const cfg = {
    host: process.env[`${prefix}_HOST`],
    port: parseInt(process.env[`${prefix}_PORT`] ?? "22"),
    username: process.env[`${prefix}_USER`],
    tryKeyboard: true,
  };

  if (keyPath) {
    cfg.privateKey = readFileSync(resolvePath(keyPath));
    const passphrase = process.env[`${prefix}_PASSPHRASE`];
    if (passphrase) cfg.passphrase = passphrase;
  }

  if (process.env.SSH_AGENT_SOCK || process.env.SSH_AUTH_SOCK) {
    cfg.agent = process.env.SSH_AGENT_SOCK || process.env.SSH_AUTH_SOCK;
  }

  if (!keyPath && password) {
    cfg.password = password;
    // Force keyboard-interactive first — UCR servers reject plain "password" auth
    cfg.authHandler = (methodsLeft, partialSuccess, callback) => {
      if (methodsLeft === null) {
        return callback("keyboard-interactive");
      }
      if (methodsLeft.includes("keyboard-interactive")) {
        return callback("keyboard-interactive");
      }
      if (methodsLeft.includes("password")) {
        return callback("password");
      }
      return callback(false);
    };
  }

  return cfg;
}

function createSSHTunnel() {
  return new Promise((resolve, reject) => {
    const jumpClient = new Client();
    const targetClient = new Client();

    const jumpCfg = buildAuthConfig("SSH_JUMP");
    const targetCfg = buildAuthConfig("SSH_TARGET");

    jumpClient.on("ready", () => {
      console.log(`[SSH] Jump host connected  (${jumpCfg.host})`);

      jumpClient.forwardOut(
        "127.0.0.1",
        0,
        process.env.SSH_TARGET_HOST,
        parseInt(process.env.SSH_TARGET_PORT ?? "22"),
        (err, stream) => {
          if (err) return reject(err);
          targetClient.connect({ ...targetCfg, sock: stream });
        },
      );
    });

    targetClient.on("ready", () => {
      console.log(
        `[SSH] Target host connected (${process.env.SSH_TARGET_HOST})`,
      );

      const dbHost = process.env.DB_HOST ?? "127.0.0.1";
      const dbPort = parseInt(process.env.DB_PORT ?? "3306");

      const server = net.createServer((sock) => {
        targetClient.forwardOut(
          "127.0.0.1",
          0,
          dbHost,
          dbPort,
          (err, stream) => {
            if (err) {
              sock.end();
              return;
            }
            sock.pipe(stream).pipe(sock);
          },
        );
      });

      server.listen(0, "127.0.0.1", () => {
        const localPort = server.address().port;
        console.log(
          `[SSH] Tunnel open  localhost:${localPort} → ${dbHost}:${dbPort}`,
        );
        resolve({ localPort, server, jumpClient, targetClient });
      });
    });

    // Handle keyboard-interactive auth (common on university servers)
    for (const client of [jumpClient, targetClient]) {
      const isJump = client === jumpClient;
      const pw = isJump ? jumpCfg.password : targetCfg.password;
      client.on(
        "keyboard-interactive",
        (_name, _inst, _lang, _prompts, finish) => {
          finish([pw]);
        },
      );
    }

    jumpClient.on("error", (e) => {
      console.error("[SSH] Jump error:", e.message);
      reject(e);
    });
    targetClient.on("error", (e) => {
      console.error("[SSH] Target error:", e.message);
      reject(e);
    });

    jumpClient.connect(jumpCfg);
  });
}

// ── Bootstrap ───────────────────────────────────────────────────
let pool;
let tunnel;

async function start() {
  const dbConfig = {
    host: process.env.DB_HOST ?? "127.0.0.1",
    port: parseInt(process.env.DB_PORT ?? "3306"),
    user: process.env.DB_USER ?? "root",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME ?? "youtube_analysis",
    waitForConnections: true,
    connectionLimit: 10,
  };

  if (process.env.SSH_ENABLED === "true") {
    tunnel = await createSSHTunnel();
    dbConfig.host = "127.0.0.1";
    dbConfig.port = tunnel.localPort;
  }

  pool = mysql.createPool(dbConfig);

  const conn = await pool.getConnection();
  console.log(`[DB] Connected to "${dbConfig.database}"`);
  conn.release();

  app.listen(PORT, () => {
    console.log(`\nYouTube Analysis API  →  http://localhost:${PORT}\n`);
  });
}

// ── Helpers ─────────────────────────────────────────────────────
async function getTableNames() {
  const [rows] = await pool.query("SHOW TABLES");
  return rows.map((r) => Object.values(r)[0]);
}

async function assertTable(name) {
  const tables = await getTableNames();
  if (!tables.includes(name)) {
    throw Object.assign(new Error(`Table "${name}" not found`), {
      status: 404,
    });
  }
}

// ── Routes ──────────────────────────────────────────────────────

// List all tables
app.get("/api/tables", async (_req, res) => {
  try {
    res.json(await getTableNames());
  } catch (err) {
    console.error("[DB]", err.message);
    res.status(500).json({ error: "Database error" });
  }
});

// Describe a table's columns
app.get("/api/tables/:table/schema", async (req, res) => {
  try {
    await assertTable(req.params.table);
    const [cols] = await pool.query(
      `SHOW COLUMNS FROM \`${req.params.table}\``,
    );
    res.json(cols);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// Country-specific helpers (used by the React app)
app.get("/api/country/top_channels", async (req, res) => {
  try {
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({ error: 'Missing "country" query parameter' });
    }

    await assertTable("top_channels_per_country");

    const sql = `
      SELECT *
      FROM \`top_channels_per_country\`
      WHERE \`video_trending_country\` = ?
      ORDER BY \`trending_appearances\` DESC
      LIMIT 10
    `;

    const [rows] = await pool.query(sql, [country]);
    res.json(rows);
  } catch (err) {
    console.error("[API] /api/country/top_channels:", err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

app.get("/api/country/top_categories", async (req, res) => {
  try {
    const { country } = req.query;
    if (!country) {
      return res.status(400).json({ error: 'Missing "country" query parameter' });
    }

    await assertTable("top_categories_per_country");

    const sql = `
      SELECT *
      FROM \`top_categories_per_country\`
      WHERE \`video_trending_country\` = ?
      ORDER BY \`trending_appearances\` DESC
      LIMIT 5
    `;

    const [rows] = await pool.query(sql, [country]);
    res.json(rows);
  } catch (err) {
    console.error("[API] /api/country/top_categories:", err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// Generic table query (supports ?limit=100&offset=0 and simple equality filters)
app.get("/api/tables/:table", async (req, res) => {
  try {
    await assertTable(req.params.table);

    const limit = Math.min(parseInt(req.query.limit ?? "100"), 10000);
    const offset = parseInt(req.query.offset ?? "0");

    const filters = { ...req.query };
    delete filters.limit;
    delete filters.offset;

    let sql = `SELECT * FROM \`${req.params.table}\``;
    const vals = [];

    const whereClauses = Object.entries(filters).map(([col, val]) => {
      vals.push(val);
      return `\`${col}\` = ?`;
    });

    if (whereClauses.length) sql += " WHERE " + whereClauses.join(" AND ");
    sql += " LIMIT ? OFFSET ?";
    vals.push(limit, offset);

    const [rows] = await pool.query(sql, vals);
    res.json(rows);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
});

// Run a raw read-only query (POST { "sql": "SELECT ..." })
app.post("/api/query", async (req, res) => {
  try {
    const { sql } = req.body;
    if (!sql || typeof sql !== "string") {
      return res.status(400).json({ error: 'Missing "sql" in request body' });
    }

    const normalized = sql.trim().toUpperCase();
    if (
      !normalized.startsWith("SELECT") &&
      !normalized.startsWith("SHOW") &&
      !normalized.startsWith("DESCRIBE")
    ) {
      return res
        .status(403)
        .json({ error: "Only SELECT / SHOW / DESCRIBE queries are allowed" });
    }

    const [rows] = await pool.query(sql);
    res.json(rows);
  } catch (err) {
    console.error("[DB]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: process.env.DB_NAME });
  } catch {
    res.status(503).json({ status: "unhealthy" });
  }
});

// ── Graceful shutdown ───────────────────────────────────────────
let shuttingDown = false;

function cleanup() {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log("\nShutting down…");
  pool?.end().catch(() => {});

  if (tunnel?.targetClient) {
    console.log("[SSH] Stopping remote MySQL…");
    tunnel.targetClient.exec(
      "mysqladmin -h 127.0.0.1 -u root shutdown",
      (err, stream) => {
        if (err) console.error("[SSH] Failed to stop MySQL:", err.message);
        else
          stream.on("close", () => console.log("[SSH] Remote MySQL stopped."));

        tunnel.targetClient?.end();
        tunnel.jumpClient?.end();
        tunnel.server?.close();
        process.exit(0);
      },
    );
  } else {
    process.exit(0);
  }
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

// ── Start ───────────────────────────────────────────────────────
start().catch((err) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
