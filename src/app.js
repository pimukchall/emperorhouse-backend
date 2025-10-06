import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { env, getCorsOptions } from "#config/env.js";
import { httpLogger } from "#lib/logger.js";
import { ensureUploadDirs, UPLOADS_BASE } from "#lib/paths.js";
import { notFound, errorHandler } from "#mw/error.js";
import swaggerUi from "swagger-ui-express";
import path from "node:path";
import fs from "node:fs";

// routes (mount ใต้ /api)
import authRouter from "#modules/auth/routes.js";
import usersRouter from "#modules/users/routes.js";
import userDepartmentsChildRouter from "#modules/user-departments/routes.js";
import rolesRouter from "#modules/roles/routes.js";
import departmentsRouter from "#modules/departments/routes.js";
import filesRouter from "#modules/files/routes.js";
import contactsRouter from "#modules/contacts/routes.js";
import organizationsRouter from "#modules/organizations/routes.js";
import evalsRouter from "#modules/evals/routes.js";
import evalCyclesRouter from "#modules/eval-cycles/routes.js";

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
app.use(cors(getCorsOptions()));
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


let openapiSpec = null;
try {
  const specPath = path.resolve(process.cwd(), "src/docs/openapi.json");
  openapiSpec = JSON.parse(fs.readFileSync(specPath, "utf-8"));
} catch (e) {
  console.error("Failed to load OpenAPI spec:", e?.message);
  openapiSpec = { openapi: "3.0.3", info: { title: "API", version: "0.0.0" }, paths: {} };
}


// helper
const API = (p = "") => `/api${p}`;

// health
app.get(API("/health"), (_req, res) => {
  res.json({ ok: true, env: env.NODE_ENV, time: new Date().toISOString() });
});

// Swagger UI
app.get(API("/openapi.json"), (_req, res) => res.json(openapiSpec));
app.use(API("/docs"), swaggerUi.serve, swaggerUi.setup(openapiSpec));

// mount routes
app.use(API("/auth"), authRouter);
app.use(API("/users"), usersRouter);
app.use(API("/users/:id/departments"), userDepartmentsChildRouter);
app.use(API("/roles"), rolesRouter);
app.use(API("/departments"), departmentsRouter);
app.use(API("/files"), filesRouter);
app.use(API("/contacts"), contactsRouter);
app.use(API("/organizations"), organizationsRouter);
app.use(API("/evals"), evalsRouter);
app.use(API("/eval-cycles"), evalCyclesRouter);

// 404 + error handler (มาตรฐานอ่านง่าย)
app.use(notFound);
app.use(errorHandler);
