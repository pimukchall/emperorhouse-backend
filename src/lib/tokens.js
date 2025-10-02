import jwt from "jsonwebtoken";
import { env } from "#config/env.js";

const ACCESS_SECRET = env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = env.JWT_REFRESH_SECRET;

const ACCESS_TTL_SEC = Number(env.ACCESS_TTL_SEC || 600); // default 10 นาที
const REFRESH_TTL_SEC = Number(env.REFRESH_TTL_SEC || 1209600); // default 14 วัน

const ACCESS_TTL = `${ACCESS_TTL_SEC}s`;
const REFRESH_TTL = `${REFRESH_TTL_SEC}s`;

const AUTH_COOKIE_PATH = "/api/auth";

/* -------------------------------- Access Token -------------------------------- */
export function signAccessToken(payload, opts = {}) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL, ...opts });
}
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/* ------------------------------- Refresh Token -------------------------------- */
export function signRefreshToken(payload = {}, opts = {}) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL, ...opts });
}
export function verifyRefreshToken(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

/* ----------------------------------- Cookie ----------------------------------- */
export function setRefreshCookie(res, token) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: AUTH_COOKIE_PATH,
    maxAge: REFRESH_TTL_SEC * 1000,
  });
}
export function clearRefreshCookie(res) {
  res.clearCookie("refresh_token", { path: AUTH_COOKIE_PATH });
}

/* ---------------------------------- Helpers ----------------------------------- */
export function readBearer(req) {
  const h = req.headers?.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || null;
}
export function readAccessCookie(req) {
  const c = req.cookies || {};
  return c.access_token || c.accessToken || c.sid || c.jwt || c.token || null;
}
