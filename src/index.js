import 'dotenv/config';
import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ----- routes -----
import authRouter from './routes/auth.routes.js';
import usersRouter from './routes/users.routes.js';
import userDepartmentsChildRouter from './routes/user-departments.routes.js';
import rolesRouter from './routes/roles.routes.js';
import departmentsRouter from './routes/departments.routes.js';
import filesRouter from './routes/files.routes.js';
import contactsRouter from './routes/contacts.routes.js';
import organizationsRouter from "./routes/organizations.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

export function createApp() {
  const app = express();

  // CORS
  app.use(
    cors({
      origin: process.env.FRONTEND_BASE_URL || 'http://localhost:3000',
      credentials: true,
    })
  );

  // parsers
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // session (สำหรับ req.session.user)
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-session-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        maxAge: 7 * 24 * 3600 * 1000,
      },
    })
  );

  app.use(morgan('dev'));

  // static files (อิง env: UPLOADS_DIR) -> /files/**
  const ENV_UPLOADS = process.env.UPLOADS_DIR;
  const UPLOAD_BASE = ENV_UPLOADS
    ? (path.isAbsolute(ENV_UPLOADS) ? ENV_UPLOADS : path.resolve(PROJECT_ROOT, ENV_UPLOADS))
    : path.resolve(PROJECT_ROOT, '..', 'upload');
  const AVATAR_BASE = path.join(UPLOAD_BASE, 'avatars');
  for (const p of [UPLOAD_BASE, AVATAR_BASE]) fs.mkdirSync(p, { recursive: true });

  app.use('/files', express.static(UPLOAD_BASE));

  // mount routes (ครั้งเดียว)
  app.use('/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/users/:id/departments', userDepartmentsChildRouter);
  app.use('/api/roles', rolesRouter);
  app.use('/api/departments', departmentsRouter);
  app.use(filesRouter);
  app.use('/api/contacts', contactsRouter);
  app.use("/api/organizations", organizationsRouter);

  // health
  app.get('/', (_req, res) => res.json({ ok: true }));

  return app;
}

// สร้างแอปและ export ให้เทสใช้
const app = createApp();
export { app };
export default app;

// start server เมื่อไม่ใช่โหมด test
const PORT = Number(process.env.PORT || 4000);
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`API running on ${PORT}`);
  });
}