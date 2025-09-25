// src/middlewares/auth.js
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/* ========== helpers: read & verify token ========== */
function readBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1] || null;
}
function readAccessCookie(req) {
  const c = req.cookies || {};
  return c.access_token || c.accessToken || c.sid || c.jwt || c.token || null;
}
function verifyAccess(token) {
  if (!token) return null;
  const secrets = [
    process.env.JWT_ACCESS_SECRET,
    process.env.ACCESS_TOKEN_SECRET,
    process.env.JWT_SECRET,
  ].filter(Boolean);
  for (const s of secrets) {
    try {
      return jwt.verify(token, s);
    } catch (_) {}
  }
  return null;
}

/* ========== core builders ========== */
function buildMeFromUser(u) {
  if (!u) return null;
  const primary = u.primaryUserDept || u.userDepartments?.[0] || null;
  const dept = primary?.department || null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    roleName: u.role?.name || "user",
    primaryDeptId: dept?.id ?? null,
    primaryDeptCode: dept?.code ?? null,
    primaryLevel: primary?.positionLevel ?? null,
    primaryPosition: primary?.positionName ?? null,
    departments: (u.userDepartments || []).map((d) => ({
      id: d.department?.id,
      code: d.department?.code,
      nameTh: d.department?.nameTh,
      nameEn: d.department?.nameEn,
    })),
  };
}

async function fetchUserSnapshot(id) {
  return prisma.user.findFirst({
    where: { id: Number(id), deletedAt: null },
    select: {
      id: true,
      email: true,
      name: true,
      role: { select: { name: true } },
      userDepartments: {
        where: { isActive: true, endedAt: null },
        select: {
          positionLevel: true,
          positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
        },
      },
      primaryUserDept: {
        select: {
          positionLevel: true,
          positionName: true,
          department: { select: { id: true, code: true, nameTh: true, nameEn: true } },
        },
      },
    },
  });
}

/* ========== middlewares ========== */

/**
 * requireAuth:
 * - อ่านโทเค็นจาก Authorization: Bearer หรือคุกกี้
 * - verify → ตั้ง req.user / req.userId / req.auth (payload)
 * - ไม่ดึงข้อมูลหนักจาก DB ที่นี่ (ให้ requireMe รับช่วงต่อ)
 */
export async function requireAuth(req, res, next) {
  // เผื่อ upstream ใส่มาอยู่แล้ว
  if (req?.me?.id) return next();

  // โทเค็นจาก header/cookie
  const token = readBearer(req) || readAccessCookie(req);
  const payload = verifyAccess(token);

  // เผื่อ session-style ที่ตั้งค่าไว้ที่อื่น
  const sessionUid =
    req.user?.id || req.userId || req.auth?.sub || req.session?.user?.id;

  const uid = Number(payload?.sub || payload?.uid || sessionUid) || null;
  if (!uid) {
    return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
  }

  // ตั้ง context เบื้องต้น (ยังไม่มีรายละเอียด dept)
  req.user = { id: uid, role: payload?.role || req.session?.user?.roleName };
  req.userId = uid;
  req.auth = payload || { sub: uid, role: req.user.role };

  return next();
}

/**
 * requireMe:
 * - ใช้ uid จาก requireAuth → โหลด snapshot ผู้ใช้จาก DB
 * - สร้าง req.me (มี roleName / primaryDept / departments ครบ)
 * - sync บางฟิลด์เข้า req.session.user (กันโค้ดเก่า)
 */
export async function requireMe(req, res, next) {
  const uid = Number(req?.user?.id || req?.userId || req?.auth?.sub) || null;
  if (!uid) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

  // ถ้ามี me แล้วและครบถ้วน ก็ข้ามได้
  if (req.me?.id === uid && Array.isArray(req.me.departments)) {
    return next();
  }

  const u = await fetchUserSnapshot(uid);
  if (!u) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });

  req.me = buildMeFromUser(u);

  // sync บางส่วนเข้ากับ session (ถ้ามี)
  req.session = req.session || {};
  req.session.user = {
    ...(req.session.user || {}),
    id: req.me.id,
    email: req.me.email,
    name: req.me.name,
    roleName: req.me.roleName,
    primaryDeptId: req.me.primaryDeptId,
    primaryDeptCode: req.me.primaryDeptCode,
    primaryLevel: req.me.primaryLevel,
    primaryPosition: req.me.primaryPosition,
    departments: req.me.departments,
  };

  return next();
}

/**
 * requireRole(...roles):
 * - บังคับ role ตรงตัว (เช่น "admin","hr")
 */
export function requireRole(...roles) {
  const needs = roles.map((r) => String(r || "").toLowerCase());
  return (req, res, next) => {
    const got =
      String(req.me?.roleName || req.user?.role || req.auth?.role || "").toLowerCase();
    if (!got) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    if (!needs.length || needs.includes(got)) return next();
    return res.status(403).json({ ok: false, error: "FORBIDDEN" });
  };
}
