const scoreService = require("../services/scoreService");

// ====================== 1. 점수 저장 API ======================
/**
 * 점수 입력값을 검증하고 최고 기록 반영 결과를 응답하는 함수
 */
async function createScore(req, res) {
  const userId = (req.body?.userId || "").trim();
  const difficulty = Number(req.body?.difficulty);
  const timeSeconds = Number(req.body?.timeSeconds);
  const moves = Number(req.body?.moves);
  const hints = Number(req.body?.hints);

  const invalidNumber =
    !Number.isInteger(difficulty) ||
    !Number.isFinite(timeSeconds) ||
    !Number.isFinite(moves) ||
    !Number.isFinite(hints);

  if (!userId || invalidNumber || ![3, 4, 5].includes(difficulty)) {
    return res.status(400).json({ message: "점수 데이터가 올바르지 않습니다" });
  }

  if (timeSeconds < 0 || moves < 0 || hints < 0) {
    return res.status(400).json({ message: "점수 데이터가 올바르지 않습니다" });
  }

  try {
    const result = await scoreService.saveScore({
      userId,
      difficulty,
      timeSeconds,
      moves,
      hints,
    });

    if (!result.userExists) {
      return res.status(404).json({ message: "사용자를 찾을 수 없습니다" });
    }

    return res.status(201).json({
      message: result.rankingUpdated
        ? "최고 기록이 랭킹에 반영되었습니다"
        : "기존 최고 기록이 유지되었습니다",
      score: result.score,
      bestScore: result.bestScore,
      scoreId: result.scoreId,
      rankingUpdated: result.rankingUpdated,
    });
  } catch (error) {
    console.error("Score save failed:", error);
    return res
      .status(500)
      .json({ message: "점수 저장 중 오류가 발생했습니다" });
  }
}

// ====================== 2. 랭킹 조회 API ======================
/**
 * 난이도/페이지 조건으로 랭킹 목록을 조회해 응답하는 함수
 */
async function getScores(req, res) {
  const difficulty = Number(req.query?.difficulty || 4);
  const rawLimit = Number(req.query?.limit || 10);
  const rawPage = Number(req.query?.page || 1);
  const rawScoreId = req.query?.scoreId;
  const scoreId =
    rawScoreId === undefined || rawScoreId === null || rawScoreId === ""
      ? null
      : Number(rawScoreId);

  const limit = Number.isInteger(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 50)
    : 10;
  const page = Number.isInteger(rawPage) ? Math.max(rawPage, 1) : 1;

  if (![3, 4, 5].includes(difficulty)) {
    return res.status(400).json({ message: "난이도 값이 올바르지 않습니다" });
  }

  if (scoreId !== null && (!Number.isInteger(scoreId) || scoreId <= 0)) {
    return res.status(400).json({ message: "scoreId 값이 올바르지 않습니다" });
  }

  try {
    const rankingData = await scoreService.getRanking({
      difficulty,
      limit,
      page,
      scoreId,
    });
    return res.status(200).json(rankingData);
  } catch (error) {
    console.error("Ranking fetch failed:", error);
    return res
      .status(500)
      .json({ message: "랭킹 조회 중 오류가 발생했습니다" });
  }
}

module.exports = {
  createScore,
  getScores,
};
