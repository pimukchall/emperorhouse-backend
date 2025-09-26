import { cleanEnv, str, num, bool } from "envalid";

export const env = cleanEnv(process.env, {
  NODE_ENV:       str({ choices: ["development","test","production"], default: "development" }),
  PORT:           num({ default: 4000 }),
  DATABASE_URL:   str(),
  FRONTEND_BASE_URL: str(),

  JWT_ACCESS_SECRET:  str(),
  JWT_REFRESH_SECRET: str(),
  ACCESS_TTL_SEC:     num({ default: 900 }),
  REFRESH_TTL_SEC:    num({ default: 604800 }),

  SMTP_HOST:    str({ default: "" }),
  SMTP_PORT:    num({ default: 465 }),
  SMTP_SECURE:  bool({ default: true }),
  SMTP_USER:    str({ default: "" }),
  SMTP_PASS:    str({ default: "" }),
  MAIL_FROM:    str({ default: "no-reply@example.com" }),

  UPLOAD_BASE_DIR: str({ default: "./upload" }),
});
