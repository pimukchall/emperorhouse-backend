import jwt from "jsonwebtoken";

const ACCESS_TTL   = process.env.ACCESS_TOKEN_TTL   || "15m";
const REFRESH_TTL  = process.env.REFRESH_TOKEN_TTL  || "7d";
const ACCESS_SECRET  = process.env.ACCESS_TOKEN_SECRET  || "dev_access_secret_change_me";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || "dev_refresh_secret_change_me";

export function signAccessToken(payload, opts = {}) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL, ...opts });
}
export function verifyAccessToken(token) { return jwt.verify(token, ACCESS_SECRET); }

export function signRefreshToken(payload, opts = {}) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL, ...opts });
}
export function verifyRefreshToken(token) { return jwt.verify(token, REFRESH_SECRET); }

export function setRefreshCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true, sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}
export function clearRefreshCookie(res) {
  res.clearCookie("refresh_token", { path: "/auth" });
}

export function readBearer(req) {
  const h = req.headers?.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || null;
}
