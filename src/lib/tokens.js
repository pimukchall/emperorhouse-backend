import jwt from "jsonwebtoken";
import crypto from "crypto";
import { env } from "#config/env.js";
import { prisma } from "#lib/prisma.js";

const ACCESS_SECRET  = env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = env.JWT_REFRESH_SECRET;

const ACCESS_TTL_SEC  = Number(env.ACCESS_TTL_SEC);
const REFRESH_TTL_SEC = Number(env.REFRESH_TTL_SEC);

const ACCESS_TTL  = `${ACCESS_TTL_SEC}s`;
const REFRESH_TTL = `${REFRESH_TTL_SEC}s`;

const AUTH_COOKIE_PATH = "/api/auth";

/* -------------------------------- Access Token -------------------------------- */
export function signAccessToken(payload, opts = {}) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL, ...opts });
}
export function verifyAccessToken(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

/* ----------------------------- Refresh Token (DB) ----------------------------- */
/**
 * สร้าง refresh token ที่มี jti + บันทึก DB พร้อมวันหมดอายุ
 * NOTE: payload คาดหวังว่ามี sub (user id)
 */
export async function signRefreshToken(payload = {}, opts = {}) {
  const jti = crypto.randomBytes(16).toString("hex");
  const token = jwt.sign({ ...payload, jti }, REFRESH_SECRET, { expiresIn: REFRESH_TTL, ...opts });

  const sub = Number(payload?.sub);
  if (!sub || Number.isNaN(sub)) {
    // แม้จะเซ็นโทเคนได้ แต่เพื่อความถูกต้องของระบบ rotate/revoke ต้องมี userId
    throw new Error("signRefreshToken: missing payload.sub (userId)");
  }

  const expiresAt = new Date(Date.now() + REFRESH_TTL_SEC * 1000);
  await prisma.refreshToken.create({
    data: {
      jti,
      userId: sub,
      expiresAt,
    },
  });

  return token;
}

/**
 * ตรวจสอบ refresh token + เช็คกับ DB ว่า revoked/หมดอายุหรือไม่
 * คืน decoded ที่ผ่านการตรวจสอบแล้ว
 */
export async function verifyRefreshToken(token) {
  const decoded = jwt.verify(token, REFRESH_SECRET);
  const jti = decoded?.jti;
  if (!jti) throw new Error("verifyRefreshToken: missing jti");

  const rec = await prisma.refreshToken.findUnique({ where: { jti } });
  if (!rec) throw new Error("refresh token not found");
  if (rec.revoked) throw new Error("refresh token revoked");
  if (rec.expiresAt.getTime() < Date.now()) throw new Error("refresh token expired");

  return decoded; // { sub, jti, iat, exp, ... }
}

/** ยกเลิก refresh token โดย jti */
export async function revokeRefreshTokenByJti(jti, replacedBy = null) {
  if (!jti) return;
  await prisma.refreshToken.updateMany({
    where: { jti, revoked: false },
    data: { revoked: true, replacedBy: replacedBy || null },
  });
}

/**
 * หมุน refresh token (rotate):
 * 1) verify โทเคนเก่า (เช็ค DB)
 * 2) revoke โทเคนเก่า
 * 3) sign โทเคนใหม่ + บันทึก DB
 * คืน { oldDecoded, newToken, newDecoded }
 */
export async function rotateRefreshToken(oldToken) {
  const oldDecoded = await verifyRefreshToken(oldToken);
  const sub = oldDecoded?.sub;
  const newToken = await signRefreshToken({ sub });
  // เชื่อมความสัมพันธ์เก่า/ใหม่
  await prisma.refreshToken.update({
    where: { jti: oldDecoded.jti },
    data: { revoked: true, replacedBy: jwt.decode(newToken)?.jti || null },
  });
  const newDecoded = jwt.decode(newToken);
  return { oldDecoded, newToken, newDecoded };
}

/* --------------------------------- Cookies ---------------------------------- */
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

/* --------------------------------- Helpers ---------------------------------- */
export function readBearer(req) {
  const h = req.headers?.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || null;
}
export function readAccessCookie(req) {
  const c = req.cookies || {};
  return c.access_token || c.accessToken || c.sid || c.jwt || c.token || null;
}
