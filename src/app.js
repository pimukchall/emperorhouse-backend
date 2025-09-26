import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { env } from "./config/env.js";
import { httpLogger } from "./lib/logger.js";
import { ensureUploadDirs, UPLOADS_BASE } from "./lib/paths.js";
import { notFound, errorHandler } from "./middlewares/error.js";

// routes (mount ใต้ /api)
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

export const app = express();
const IS_PROD = env.NODE_ENV === "production";
if (IS_PROD) app.set("trust proxy", 1);

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "same-site" },
    contentSecurityPolicy: false,
  })
);

// Logger + CORS + parsers
app.use(httpLogger);
app.use(cors({ origin: env.FRONTEND_BASE_URL, credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files (นอก /api) – เตรียมโฟลเดอร์ให้พร้อมใช้งานก่อน
ensureUploadDirs();
app.use(
  "/files",
  express.static(UPLOADS_BASE, {
    setHeaders: (res) => {
      res.setHeader("Cross-Origin-Resource-Policy", "same-site");
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  })
);

// helper
const API = (p = "") => `/api${p}`;

// health
app.get(API("/health"), (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV, time: new Date().toISOString() });
});

// mount routes
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

// 404 + error handler (มาตรฐานอ่านง่าย)
app.use(notFound);
app.use(errorHandler);
