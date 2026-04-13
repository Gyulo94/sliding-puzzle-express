const express = require("express");
const scoreController = require("../controllers/scoreController");

// ====================== 1. 점수 라우터 생성 ======================
const router = express.Router();

// ====================== 2. 점수/랭킹 엔드포인트 매핑 ======================
// 점수 저장 요청 처리 라우트
router.post("/scores", scoreController.createScore);
// 랭킹 조회 요청 처리 라우트
router.get("/scores", scoreController.getScores);

// ====================== 3. 라우터 내보내기 ======================
module.exports = router;
