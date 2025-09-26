import { cleanEnv, str, num, bool, url, port } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV:          str({ choices: ["development", "test", "production"], default: "development" }),
  PORT:              port({ default: 4000 }),
  DATABASE_URL:      str(),                // Prisma จะตรวจรูปแบบอีกชั้น
  FRONTEND_BASE_URL: url(),                // บังคับเป็น http/https ที่ถูกต้อง

  JWT_ACCESS_SECRET:  str(),
  JWT_REFRESH_SECRET: str(),
  ACCESS_TTL_SEC:     num({ default: 900 }),
  REFRESH_TTL_SEC:    num({ default: 604800 }),

  SMTP_HOST:   str({ default: "" }),       // ว่างได้ใน dev → mailer จะ fallback Ethereal
  SMTP_PORT:   num({ default: 465 }),
  SMTP_SECURE: bool({ default: true }),
  SMTP_USER:   str({ default: "" }),
  SMTP_PASS:   str({ default: "" }),
  MAIL_FROM:   str({ default: "EMP One <no-reply@example.com>" }),

  UPLOAD_BASE_DIR: str({ default: "./upload" }),
});

// --------- Helpers (ใช้ร่วมทั้งแอป) ----------
export const isProd = env.NODE_ENV === "production";
export const ACCESS_TTL_MS  = env.ACCESS_TTL_SEC  * 1000;
export const REFRESH_TTL_MS = env.REFRESH_TTL_SEC * 1000;

// cookie สำหรับ refresh token ที่ /api/auth/*
export const refreshCookieOpts = Object.freeze({
  httpOnly: true,
  sameSite: "lax",                 // ถ้าต้อง cross-site จริง ให้ใช้ "none" + HTTPS
  secure: isProd,
  path: "/api/auth",
  maxAge: REFRESH_TTL_MS,
});
