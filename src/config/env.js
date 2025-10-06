// #config/env.js
import { cleanEnv, str, num, bool, url, port } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV:          str({ choices: ["development", "test", "production"], default: "development" }),
  PORT:              port({ default: 4000 }),
  DATABASE_URL:      str(),                // Prisma จะตรวจรูปแบบอีกชั้น
  FRONTEND_BASE_URL: url(),                // ต้องมี http/https

  JWT_ACCESS_SECRET:  str(),
  JWT_REFRESH_SECRET: str(),
  ACCESS_TTL_SEC:     num({ default: 900 }),       // 15 นาที
  REFRESH_TTL_SEC:    num({ default: 604800 }),    // 7 วัน

  // Crypto / Hash
  BCRYPT_SALT_ROUNDS: num({ default: 10 }),

  // SMTP (ปล่อยว่างใน dev → mailer จะ fallback เป็น Ethereal)
  SMTP_HOST:   str({ default: "" }),
  SMTP_PORT:   num({ default: 465 }),
  SMTP_SECURE: bool({ default: true }),
  SMTP_USER:   str({ default: "" }),
  SMTP_PASS:   str({ default: "" }),
  MAIL_FROM:   str({ default: "EMP One <no-reply@example.com>" }),

  // Uploads
  UPLOAD_BASE_DIR: str({ default: "./upload" }),

  // CORS (คอมมาเซพฯ: http://localhost:3000,https://app.example.com)
  CORS_ORIGINS: str({ default: "" }),
});

// --------- Helpers ----------
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

// --------- CORS helpers ----------
function parseOrigins(input) {
  return String(input || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * ใช้ใน server: app.use(cors(getCorsOptions()))
 * - ถ้าไม่ตั้ง CORS_ORIGINS → อนุญาต origin เดียวคือ FRONTEND_BASE_URL
 * - ถ้าตั้ง → อนุญาตรายการนั้น (รวม FRONTEND_BASE_URL เข้ามาด้วยกันพลาด)
 */
export function getCorsOptions() {
  const list = new Set(parseOrigins(env.CORS_ORIGINS));
  list.add(env.FRONTEND_BASE_URL); // เผื่อคนลืมใส่ซ้ำ
  const origins = Array.from(list);

  return {
    origin(origin, cb) {
      // ไม่มี origin (เช่น Postman) → allow
      if (!origin) return cb(null, true);
      // ตรงกับ whitelist → allow
      if (origins.some(o => origin === o)) return cb(null, true);
      // ไม่ตรง → block
      cb(new Error("CORS: Origin not allowed"));
    },
    credentials: true,
  };
}