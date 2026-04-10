const { pool } = require("../config/database");

function getDifficultyBaseScore(difficulty) {
  const baseByDifficulty = {
    3: 10000,
    4: 14000,
    5: 18000,
  };

  return baseByDifficulty[difficulty] || 0;
}

function calculateScore({ difficulty, timeSeconds, moves, hints }) {
  const BONUS_COEFFICIENT = 1200;

  const baseScore = getDifficultyBaseScore(difficulty);
  if (!baseScore) return 0;

  const safeTime = Math.max(0, Number(timeSeconds) || 0);
  const safeMoves = Math.max(0, Number(moves) || 0);
  const safeHints = Math.max(0, Number(hints) || 0);

  const penalty = safeTime * 10 + safeMoves * 16 + safeHints * 260;
  const damping = Math.exp(-penalty / 12000);
  const bonus = Math.round(
    difficulty * difficulty * BONUS_COEFFICIENT * damping,
  );

  return Math.max(0, Math.round(baseScore + bonus - penalty));
}

async function saveScore({ userId, difficulty, timeSeconds, moves, hints }) {
  const userResult = await pool.query("SELECT 1 FROM users WHERE id = $1", [
    userId,
  ]);
  if (userResult.rowCount === 0) {
    return { userExists: false };
  }

  const score = calculateScore({
    difficulty,
    timeSeconds,
    moves,
    hints,
  });

  const insertResult = await pool.query(
    `
      INSERT INTO scores (user_id, difficulty, time_seconds, moves, hints, score)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING score_id
      `,
    [
      userId,
      difficulty,
      Math.floor(timeSeconds),
      Math.floor(moves),
      Math.floor(hints),
      score,
    ],
  );

  return {
    userExists: true,
    scoreId: insertResult.rows[0].score_id,
    score,
  };
}

async function getRankByScoreId({ difficulty, scoreId }) {
  const result = await pool.query(
    `
      WITH target AS (
        SELECT score_id, score, time_seconds, moves, hints, created_at
        FROM scores
        WHERE score_id = $2 AND difficulty = $1
      )
      SELECT 1 + COUNT(*) AS rank
      FROM scores s
      CROSS JOIN target t
      WHERE s.difficulty = $1
        AND (
          s.score > t.score
          OR (s.score = t.score AND s.time_seconds < t.time_seconds)
          OR (s.score = t.score AND s.time_seconds = t.time_seconds AND s.moves < t.moves)
          OR (s.score = t.score AND s.time_seconds = t.time_seconds AND s.moves = t.moves AND s.hints < t.hints)
          OR (s.score = t.score AND s.time_seconds = t.time_seconds AND s.moves = t.moves AND s.hints = t.hints AND s.created_at < t.created_at)
          OR (s.score = t.score AND s.time_seconds = t.time_seconds AND s.moves = t.moves AND s.hints = t.hints AND s.created_at = t.created_at AND s.score_id < t.score_id)
        )
      `,
    [difficulty, scoreId],
  );

  if (result.rowCount === 0 || !result.rows[0]) return null;
  return Number(result.rows[0].rank);
}

async function getRanking({ difficulty, limit, page = 1, scoreId = null }) {
  const safeLimit = Math.max(1, Number(limit) || 10);
  const safePage = Math.max(1, Number(page) || 1);

  const totalCountResult = await pool.query(
    `
      SELECT COUNT(*)::int AS total_count
      FROM scores
      WHERE difficulty = $1
      `,
    [difficulty],
  );
  const totalCount = totalCountResult.rows[0]?.total_count || 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
  const currentPage = Math.min(safePage, totalPages);
  const offset = (currentPage - 1) * safeLimit;

  const result = await pool.query(
    `
      SELECT
        s.user_id,
        u.name,
        s.difficulty,
        s.time_seconds,
        s.moves,
        s.hints,
        s.score,
        s.created_at
      FROM scores s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.difficulty = $1
      ORDER BY s.score DESC, s.time_seconds ASC, s.moves ASC, s.hints ASC, s.created_at ASC
      LIMIT $2
      OFFSET $3
      `,
    [difficulty, safeLimit, offset],
  );

  let myRank = null;
  if (scoreId) {
    myRank = await getRankByScoreId({ difficulty, scoreId });
  }

  return {
    items: result.rows,
    myRank,
    pagination: {
      page: currentPage,
      limit: safeLimit,
      totalCount,
      totalPages,
    },
  };
}

module.exports = {
  calculateScore,
  saveScore,
  getRanking,
};
