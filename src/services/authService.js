const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

// ====================== 1. 인증 토큰 상수 ======================
/**
 * 액세스 토큰 만료 기간
 */
const ACCESS_TOKEN_EXPIRES_IN = "7d";

// ====================== 2. 토큰 생성/검증 ======================
/**
 * 사용자 정보를 기반으로 액세스 토큰을 생성하는 함수
 */
function createAccessToken(user) {
  const jwtSecret = process.env.JWT_SECRET || "dev-only-secret-change-me";

  return jwt.sign(
    {
      sub: user.id,
      name: user.name,
      type: "access",
    },
    jwtSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRES_IN },
  );
}

/**
 * 액세스 토큰의 유효성을 검증하고 페이로드를 반환하는 함수
 */
function verifyAccessToken(accessToken) {
  const jwtSecret = process.env.JWT_SECRET || "dev-only-secret-change-me";
  return jwt.verify(accessToken, jwtSecret);
}

// ====================== 3. 회원가입 서비스 ======================
/**
 * 회원가입 시 중복 아이디를 검사하고 새 사용자를 생성하는 함수
 */
async function signup({ id, name, password }) {
  const existsResult = await pool.query("SELECT 1 FROM users WHERE id = $1", [
    id,
  ]);
  if (existsResult.rowCount > 0) {
    return { conflict: true };
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await pool.query(
    "INSERT INTO users (id, name, password) VALUES ($1, $2, $3)",
    [id, name, passwordHash],
  );

  return { conflict: false };
}

// ====================== 4. 로그인 서비스 ======================
/**
 * 로그인 정보를 검증하고 인증 토큰을 발급하는 함수
 */
async function login({ id, password }) {
  const result = await pool.query(
    "SELECT id, name, password FROM users WHERE id = $1",
    [id],
  );

  if (result.rowCount === 0) {
    return { authenticated: false };
  }

  const user = result.rows[0];
  let matched = false;

  if (typeof user.password === "string" && user.password.startsWith("$2")) {
    matched = await bcrypt.compare(password, user.password);
  } else {
    // 기존 평문 비밀번호 레코드와의 하위 호환 처리.
    matched = user.password === password;
    if (matched) {
      const upgradedHash = await bcrypt.hash(password, 12);
      await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
        upgradedHash,
        id,
      ]);
    }
  }

  if (!matched) {
    return { authenticated: false };
  }

  const safeUser = {
    id: user.id,
    name: user.name,
  };

  const accessToken = createAccessToken(safeUser);

  return {
    authenticated: true,
    user: safeUser,
    accessToken,
  };
}

module.exports = {
  signup,
  login,
  verifyAccessToken,
};
