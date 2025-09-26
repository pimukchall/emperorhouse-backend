import path from "node:path";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import { config as dotenvConfig } from "dotenv";
import { env } from "./config/env.js";

// ===== env (.env.development / .env.production)
const NODE_ENV = process.env.NODE_ENV ?? "development";
const envFile =
  NODE_ENV === "production" ? ".env.production" : ".env.development";
dotenvConfig({ path: path.resolve(process.cwd(), envFile) });

const IS_PROD = NODE_ENV === "production";
const PORT = Number(process.env.PORT || 4000);
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || "http://localhost:3000";

// ===== import routes (ทุกอย่างจะ mount ใต้ /api)
import authRouter from "./routes/auth.routes.js";
import usersRouter from "./routes/users.routes.js";
import userDepartmentsChildRouter from "./routes/user-departments.routes.js";
import rolesRouter from "./routes/roles.routes.js";
import departmentsRouter from "./routes/departments.routes.js";
import filesRouter from "./routes/files.routes.js";
import contactsRouter from "./routes/contacts.routes.js";
import organizationsRouter from "./routes/organizations.routes.js";
import profileRouter from "./routes/profile.routes.js";
import evalsRouter from "./routes/evals.routes.js";
import cyclesRouter from "./routes/cycles.routes.js";

const app = express();
if (IS_PROD) app.set("trust proxy", 1);

// security headers
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));

// CORS + cookie
app.use(cors({ origin: FRONTEND_BASE_URL, credentials: true }));
app.options(/.*/, cors({ origin: FRONTEND_BASE_URL, credentials: true }));

// parsers & logs
app.use(morgan(IS_PROD ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// static files (เช่น avatar) — นอก /api
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
app.use(
  "/files",
  express.static(UPLOADS_DIR, {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "same-site");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// ===== helper
const API = (p = "") => `/api${p}`;

// ===== health
app.get(API("/health"), (_req, res) => {
  res.json({ ok: true, env: NODE_ENV, time: new Date().toISOString() });
});

// ===== mount routes (ทุกอย่างใต้ /api)
// หมายเหตุ: การตรวจ auth/me อยู่ในไฟล์ route แต่ละอัน (ผ่าน requireAuth/requireMe)
app.use(API("/auth"), authRouter);
app.use(API("/users"), usersRouter);
app.use(API("/users/:id/departments"), userDepartmentsChildRouter);
app.use(API("/roles"), rolesRouter);
app.use(API("/departments"), departmentsRouter);
app.use(API(""), filesRouter); // มี /api/profile/files/... อยู่ในไฟล์นี้
app.use(API("/contacts"), contactsRouter);
app.use(API("/organizations"), organizationsRouter);
app.use(API("/profile"), profileRouter);
app.use(API("/evals"), evalsRouter);
app.use(API("/cycles"), cyclesRouter);

// ===== 404 + error handler
app.use((_req, res) => res.status(404).json({ ok: false, error: "Not Found" }));
app.use((err, _req, res, _next) => {
  console.error("Unhandled Error:", err);
  res.status(err?.status || 500).json({
    ok: false,
    error: IS_PROD ? "Internal Server Error" : err?.message || "Internal Error",
  });
});

// ===== start
app.listen(env.PORT, () => {
  console.log(`Server started on port ${env.PORT} (${NODE_ENV})`);
  if (!IS_PROD) {
    console.log(`- Frontend URL: ${env.FRONTEND_BASE_URL}`);
  }
});
