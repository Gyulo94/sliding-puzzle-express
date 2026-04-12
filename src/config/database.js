const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  ssl:
    process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 10,
});

async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS scores (
      score_id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      difficulty SMALLINT NOT NULL CHECK (difficulty IN (3, 4, 5)),
      time_seconds INTEGER NOT NULL CHECK (time_seconds >= 0),
      moves INTEGER NOT NULL CHECK (moves >= 0),
      hints INTEGER NOT NULL CHECK (hints >= 0),
      score INTEGER NOT NULL CHECK (score >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    WITH ranked_scores AS (
      SELECT
        score_id,
        ROW_NUMBER() OVER (
          PARTITION BY user_id, difficulty
          ORDER BY score DESC, time_seconds ASC, moves ASC, hints ASC, created_at ASC, score_id ASC
        ) AS row_number
      FROM scores
    )
    DELETE FROM scores s
    USING ranked_scores r
    WHERE s.score_id = r.score_id
      AND r.row_number > 1
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS scores_user_difficulty_unique_idx
    ON scores (user_id, difficulty)
  `);
}

module.exports = {
  pool,
  ensureSchema,
};
