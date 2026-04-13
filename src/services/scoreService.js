const { pool } = require("../config/database");

// ====================== 1. 점수 계산 유틸 ======================
/**
 * 난이도(3/4/5)별 기준 점수를 반환하는 함수
 */
function getDifficultyBaseScore(difficulty) {
  const baseByDifficulty = {
    3: 10000,
    4: 14000,
    5: 18000,
  };

  return baseByDifficulty[difficulty] || 0;
}

/**
 * 시간/이동/힌트 정보를 기반으로 최종 점수를 계산하는 함수
 */
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

// ====================== 2. 점수 저장 ======================
/**
 * 사용자 점수를 저장하고 랭킹 반영 여부를 반환하는 함수
 */
async function saveScore({ userId, difficulty, timeSeconds, moves, hints }) {
  const userResult = await pool.query("SELECT 1 FROM users WHERE id = $1", [
    userId,
  ]);
  if (userResult.rowCount === 0) {
    return { userExists: false };
  }

  const submittedScore = calculateScore({
    difficulty,
    timeSeconds,
    moves,
    hints,
  });

  const normalizedTimeSeconds = Math.floor(timeSeconds);
  const normalizedMoves = Math.floor(moves);
  const normalizedHints = Math.floor(hints);

  const persistedResult = await pool.query(
    `
      WITH upserted AS (
        INSERT INTO scores (user_id, difficulty, time_seconds, moves, hints, score)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, difficulty) DO UPDATE
        SET
          time_seconds = EXCLUDED.time_seconds,
          moves = EXCLUDED.moves,
          hints = EXCLUDED.hints,
          score = EXCLUDED.score,
          created_at = NOW()
        WHERE
          EXCLUDED.score > scores.score
          OR (EXCLUDED.score = scores.score AND EXCLUDED.time_seconds < scores.time_seconds)
          OR (EXCLUDED.score = scores.score AND EXCLUDED.time_seconds = scores.time_seconds AND EXCLUDED.moves < scores.moves)
          OR (EXCLUDED.score = scores.score AND EXCLUDED.time_seconds = scores.time_seconds AND EXCLUDED.moves = scores.moves AND EXCLUDED.hints < scores.hints)
        RETURNING score_id, score, TRUE AS ranking_updated
      )
      SELECT score_id, score, ranking_updated
      FROM upserted
      UNION ALL
      SELECT s.score_id, s.score, FALSE AS ranking_updated
      FROM scores s
      WHERE s.user_id = $1
        AND s.difficulty = $2
        AND NOT EXISTS (SELECT 1 FROM upserted)
      LIMIT 1
      `,
    [
      userId,
      difficulty,
      normalizedTimeSeconds,
      normalizedMoves,
      normalizedHints,
      submittedScore,
    ],
  );

  const persistedScore = persistedResult.rows[0];

  return {
    userExists: true,
    scoreId: persistedScore?.score_id ?? null,
    score: submittedScore,
    bestScore: persistedScore?.score ?? submittedScore,
    rankingUpdated: Boolean(persistedScore?.ranking_updated),
  };
}

// ====================== 3. 랭킹 계산/조회 ======================
/**
 * 특정 scoreId의 현재 랭킹 순위를 계산하는 함수
 */
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

/**
 * 난이도별 랭킹 목록과 페이지 정보를 조회하는 함수
 */
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
