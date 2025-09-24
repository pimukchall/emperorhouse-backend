// src/index.js
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { config as dotenvConfig } from 'dotenv';
import { ensureUploadDirs, UPLOADS_BASE } from './lib/paths.js';

// ───────────────────────────────────────────────────────────────────────────────
// 0) Load environment (.env.development / .env.production)
// ───────────────────────────────────────────────────────────────────────────────
const NODE_ENV = process.env.NODE_ENV ?? 'development';
const envFile = NODE_ENV === 'production' ? '.env.production' : '.env.development';
dotenvConfig({ path: path.resolve(process.cwd(), envFile) });

// ----- routes -----
import authRouter from './routes/auth.routes.js';
import usersRouter from './routes/users.routes.js';
import userDepartmentsChildRouter from './routes/user-departments.routes.js';
import rolesRouter from './routes/roles.routes.js';
import departmentsRouter from './routes/departments.routes.js';
import filesRouter from './routes/files.routes.js';
import contactsRouter from './routes/contacts.routes.js';
import organizationsRouter from './routes/organizations.routes.js';
import profileRouter from './routes/profile.routes.js';
import evalsRouter from "./routes/evals.routes.js";
import cyclesRouter from "./routes/cycles.routes.js";

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const IS_PROD = NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 4000);

// ───────────────────────────────────────────────────────────────────────────────
// 1) Core Config
// ───────────────────────────────────────────────────────────────────────────────
const FRONTEND_BASE_URL =
  process.env.FRONTEND_BASE_URL || 'http://localhost:3000';

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || 'dev-access-secret';

// require secret in prod
if (IS_PROD && !process.env.JWT_ACCESS_SECRET) {
  console.error('FATAL: JWT_ACCESS_SECRET is required in production.');
  process.exit(1);
}

// เตรียมโฟลเดอร์อัปโหลด (นอกโปรเจกต์) ตามค่าใน paths.js
ensureUploadDirs();

// ───────────────────────────────────────────────────────────────────────────────
// 2) Express App
// ───────────────────────────────────────────────────────────────────────────────
const app = express();

// trust proxy เฉพาะ prod (ต้องมากหลังสร้าง app)
if (IS_PROD) {
  app.set('trust proxy', 1);
}

app.disable('x-powered-by');

// security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
  })
);

// CORS
app.use(
  cors({
    origin: FRONTEND_BASE_URL,
    credentials: true,
  })
);
app.options(/.*/, cors({ origin: FRONTEND_BASE_URL, credentials: true }));

// logger
app.use(morgan(IS_PROD ? 'combined' : 'dev'));

// parsers
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// static files
app.use(
  '/files',
  express.static(UPLOADS_BASE, {
    setHeaders: (res) => {
      res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
      res.setHeader('X-Content-Type-Options', 'nosniff');
    },
  })
);

// attach user from JWT (cookie-first, fallback bearer)
app.use((req, _res, next) => {
  const fromCookie = req.cookies?.access_token;
  const fromBearer = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

  const token = fromCookie || fromBearer;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_ACCESS_SECRET);
      req.user = payload;
      req.userId = payload.sub;
      req.auth = payload;
    } catch {
      // ignore invalid
    }
  }
  next();
});

// ───────────────────────────────────────────────────────────────────────────────
// 3) Routes
// ───────────────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, env: NODE_ENV, time: new Date().toISOString() });
});

app.use('/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/users/:id/departments', userDepartmentsChildRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/departments', departmentsRouter);
app.use(filesRouter); // ต้องมี basePath ภายใน
app.use('/api/contacts', contactsRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/profile', profileRouter);
app.use("/api/evals", evalsRouter);
app.use("/api/cycles", cyclesRouter);

// ───────────────────────────────────────────────────────────────────────────────
// 4) Error Handlers
// ───────────────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found' });
});

app.use((err, _req, res, _next) => {
  console.error('Unhandled Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: IS_PROD ? 'Internal Server Error' : (err.message || 'Internal Error'),
    ...(IS_PROD ? {} : { stack: err.stack }),
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// 5) Start
// ───────────────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(
    `API ready on http://localhost:${PORT} [env=${NODE_ENV}] (files: /files → ${UPLOADS_BASE})`
  );
});
