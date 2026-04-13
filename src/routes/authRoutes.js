const express = require("express");
const authController = require("../controllers/authController");

// ====================== 1. 인증 라우터 생성 ======================
const router = express.Router();

// ====================== 2. 인증 엔드포인트 매핑 ======================
// 회원가입 요청 처리 라우트
router.post("/signup", authController.signup);
// 로그인 요청 처리 라우트
router.post("/login", authController.login);
// 토큰 기반 내 정보 조회 라우트
router.get("/me", authController.me);

// ====================== 3. 라우터 내보내기 ======================
module.exports = router;
