import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieSession from 'cookie-session';

import { router as healthRouter } from './routes/health.js';
import { router as usersRouter } from './routes/users.js';
import { router as authRouter } from './routes/auth.js';
import { router as profileRouter } from './routes/profile.js';
import { router as rolesRouter } from './routes/roles.js';
import { router as departmentsRouter } from './routes/departments.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: true,          // ปล่อยให้ front ส่งคุกกี้ได้ (ถ้าจะล็อก domain ค่อยปรับ)
  credentials: true
}));

app.use(express.json());
app.use(morgan('dev'));

app.use(cookieSession({
  name: process.env.SESSION_NAME || 'sid',
  secret: process.env.SESSION_SECRET,
  // จะเซ็ต maxAge ตาม remember ที่ /auth/login
  maxAge: undefined,
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  domain: process.env.SESSION_DOMAIN || undefined,
}));

app.use('/health', healthRouter);
app.use('/api/users', usersRouter);
app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/api/roles', rolesRouter);
app.use('/api/departments', departmentsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
