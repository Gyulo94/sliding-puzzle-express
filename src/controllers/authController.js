const authService = require("../services/authService");

// ====================== 1. 회원가입 API ======================
/**
 * 회원가입 요청을 검증하고 사용자 생성 결과를 응답하는 함수
 */
async function signup(req, res) {
  const id = (req.body?.id || "").trim();
  const name = (req.body?.name || "").trim();
  const password = (req.body?.password || "").trim();

  if (!id || !name || !password) {
    return res
      .status(400)
      .json({ message: "아이디, 이름, 비밀번호를 모두 입력해주세요" });
  }

  try {
    const result = await authService.signup({ id, name, password });

    if (result.conflict) {
      return res.status(409).json({ message: "이미 존재하는 아이디입니다" });
    }

    return res.status(201).json({ message: "회원가입 완료! 로그인해주세요" });
  } catch (error) {
    console.error("Signup failed:", error);
    return res
      .status(500)
      .json({ message: "회원가입 처리 중 오류가 발생했습니다" });
  }
}

// ====================== 2. 로그인 API ======================
/**
 * 로그인 요청을 검증하고 인증 토큰을 발급해 응답하는 함수
 */
async function login(req, res) {
  const id = (req.body?.id || "").trim();
  const password = (req.body?.password || "").trim();

  if (!id || !password) {
    return res
      .status(400)
      .json({ message: "아이디와 비밀번호를 입력해주세요" });
  }

  try {
    const result = await authService.login({ id, password });

    if (!result.authenticated) {
      return res
        .status(401)
        .json({ message: "아이디 또는 비밀번호가 올바르지 않습니다" });
    }

    return res.status(200).json({
      message: "로그인 성공",
      id: result.user.id,
      name: result.user.name,
      accessToken: result.accessToken,
    });
  } catch (error) {
    console.error("Login failed:", error);
    return res
      .status(500)
      .json({ message: "로그인 처리 중 오류가 발생했습니다" });
  }
}

// ====================== 3. 내 정보 조회 API ======================
/**
 * Bearer 토큰을 검증해 현재 사용자 정보를 반환하는 함수
 */
async function me(req, res) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "인증 토큰이 필요합니다" });
  }

  try {
    const decoded = authService.verifyAccessToken(token);
    return res.status(200).json({
      id: decoded.sub,
      name: decoded.name || "",
    });
  } catch (error) {
    return res.status(401).json({ message: "유효하지 않은 토큰입니다" });
  }
}

module.exports = {
  signup,
  login,
  me,
};
