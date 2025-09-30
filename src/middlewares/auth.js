import { prisma } from "#lib/prisma.js";
import {
  readBearer,
  readAccessCookie,
  verifyAccessToken,
} from "#lib/tokens.js";

/* -------- presenters ---------- */
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
          department: {
            select: { id: true, code: true, nameTh: true, nameEn: true },
          },
        },
      },
      primaryUserDept: {
        select: {
          positionLevel: true,
          positionName: true,
          department: {
            select: { id: true, code: true, nameTh: true, nameEn: true },
          },
        },
      },
    },
  });
}

function unauthorized(res, msg = "กรุณาเข้าสู่ระบบ") {
  return res.status(401).json({ ok: false, error: { code: "UNAUTHORIZED", message: msg } });
}
function forbidden(res, msg = "คุณไม่มีสิทธิ์ทำรายการนี้") {
  return res.status(403).json({ ok: false, error: { code: "FORBIDDEN", message: msg } });
}

/* -------- middlewares ---------- */

/** ตรวจ token พื้นฐาน → ตั้ง req.user/req.userId/req.auth */
export async function requireAuth(req, res, next) {
  // ถ้ามี me อยู่แล้ว (เช่น middleware ก่อนหน้าโหลดไว้) ก็ผ่านได้
  if (req?.me?.id) return next();

  const token = readBearer(req) || readAccessCookie(req);

  let payload = null;
  try {
    payload = token ? verifyAccessToken(token) : null;
  } catch {
    // token ผิด/หมดอายุ → ถือว่าไม่ผ่าน
    return unauthorized(res);
  }

  const sessionUid =
    req.user?.id || req.userId || req.auth?.sub || req.session?.user?.id;

  const uid = Number(payload?.sub ?? payload?.uid ?? sessionUid) || null;
  if (!uid) return unauthorized(res);

  req.user = { id: uid, role: payload?.role || req.session?.user?.roleName };
  req.userId = uid;
  req.auth = payload || { sub: uid, role: req.user.role };

  return next();
}

/** โหลด snapshot ผู้ใช้ → ตั้ง req.me และ sync session */
export async function requireMe(req, res, next) {
  const uid = Number(req?.user?.id || req?.userId || req?.auth?.sub) || null;
  if (!uid) return unauthorized(res);

  // มีแคชแล้วก็ข้ามได้
  if (req.me?.id === uid && Array.isArray(req.me.departments)) return next();

  const u = await fetchUserSnapshot(uid);
  if (!u) return unauthorized(res, "บัญชีผู้ใช้ไม่พร้อมใช้งาน");

  req.me = buildMeFromUser(u);

  // sync กับ session (รองรับโค้ดเก่า)
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

/** บังคับ role */
export function requireRole(...roles) {
  const needs = roles.map((r) => String(r || "").toLowerCase());
  return (req, res, next) => {
    const got = String(
      req.me?.roleName || req.user?.role || req.auth?.role || ""
    ).toLowerCase();
    if (!got) return unauthorized(res);
    if (!needs.length || needs.includes(got)) return next();
    return forbidden(res);
  };
}
