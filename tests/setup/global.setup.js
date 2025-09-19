/**
 * Global test setup for Vitest
 * - Ensure process.env NODE_ENV and test URLs
 */
import 'dotenv/config';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '4000';
process.env.ACCESS_TTL_SEC = process.env.ACCESS_TTL_SEC || '900';        // 15m
process.env.REFRESH_TTL_SEC = process.env.REFRESH_TTL_SEC || '604800';   // 7d
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.COOKIE_SECURE = process.env.COOKIE_SECURE || 'false';
process.env.FRONTEND_BASE_URL = process.env.FRONTEND_BASE_URL || 'http://localhost:3000';
process.env.APP_NAME = process.env.APP_NAME || 'EMP One (Test)';
