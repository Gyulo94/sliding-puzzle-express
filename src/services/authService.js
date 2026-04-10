const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");

const ACCESS_TOKEN_EXPIRES_IN = "7d";

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

function verifyAccessToken(accessToken) {
  const jwtSecret = process.env.JWT_SECRET || "dev-only-secret-change-me";
  return jwt.verify(accessToken, jwtSecret);
}

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
    // Backward compatibility for existing plain-text records.
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
