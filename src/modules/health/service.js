import { prisma as defaultPrisma } from "#lib/prisma.js";
import { env } from "#config/env.js";

export async function healthService({ prisma = defaultPrisma } = {}) {
  const ts = new Date();
  const uptimeSec = Math.floor(process.uptime());
  const version = process.env.npm_package_version || null;

  // ping DB แบบเร็ว ๆ
  let db = { ok: true, latencyMs: null };
  const t0 = Date.now();
  try {
    // ใช้ raw select 1; ถ้าใช้ PostgreSQL เปลี่ยนเป็น `SELECT 1`
    await prisma.$queryRaw`SELECT 1`;
    db.latencyMs = Date.now() - t0;
  } catch (e) {
    db = { ok: false, error: e?.code || e?.message || "DB_ERROR" };
  }

  return {
    status: db.ok ? "UP" : "DEGRADED",
    ts: ts.toISOString(),
    uptimeSec,
    version,
    env: env.NODE_ENV,
    db,
  };
}
